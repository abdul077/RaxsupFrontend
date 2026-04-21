import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { LayoutService } from '../../../core/services/layout.service';
import { DriverService } from '../../../core/services/driver.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  SIDEBAR_NAV,
  SidebarGroupKey,
  SidebarNavBlock,
  SidebarNavDivider,
  SidebarNavLeaf,
} from './sidebar-nav.config';
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent implements OnInit, OnDestroy {
  isBeta = environment.isBeta;
  readonly sidebarNav = SIDEBAR_NAV;

  isAdminExpanded = false;
  isLoadsExpanded = false;
  isFinancialExpanded = false;
  isComplianceExpanded = false;
  pendingDriversCount = 0;
  private navSub?: Subscription;

  constructor(
    public authService: AuthService,
    public layoutService: LayoutService,
    private router: Router,
    private driverService: DriverService
  ) {}

  ngOnInit(): void {
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(event => {
        this.layoutService.closeSidebar();
        this.syncExpandStateFromUrl(event.urlAfterRedirects || event.url);
      });

    this.syncExpandStateFromUrl(this.router.url);

    if (this.authService.hasRole('Admin')) {
      this.loadPendingDriversCount();
    }
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  private syncExpandStateFromUrl(url: string): void {
    if (url?.startsWith('/admin')) {
      this.isAdminExpanded = true;
    }
    if (url?.startsWith('/loads')) {
      this.isLoadsExpanded = true;
    }
    if (url?.startsWith('/financial')) {
      this.isFinancialExpanded = true;
    }
    if (url?.startsWith('/compliance')) {
      this.isComplianceExpanded = true;
    }
  }

  loadPendingDriversCount(): void {
    this.driverService.getPendingDrivers().subscribe({
      next: drivers => {
        this.pendingDriversCount = drivers.length;
      },
      error: () => {},
    });
  }

  hasRole(role: string): boolean {
    return this.authService.hasRole(role);
  }

  hasAnyRole(roles: string[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  getCurrentUser() {
    return this.authService.getCurrentUser();
  }

  getRoleDisplayName(role: string | undefined): string {
    if (!role) return 'User';
    return role
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  visibleLink(link: SidebarNavLeaf): boolean {
    if (!link.rolesAny?.length) {
      return true;
    }
    return this.hasAnyRole(link.rolesAny);
  }

  dividerVisible(block: SidebarNavDivider): boolean {
    if (!block.rolesAny?.length) {
      return true;
    }
    return this.hasAnyRole(block.rolesAny);
  }

  navBlockVisible(block: SidebarNavBlock): boolean {
    if (block.kind === 'divider') {
      return this.dividerVisible(block);
    }
    if (block.kind === 'link') {
      return this.visibleLink(block.link);
    }
    return this.hasAnyRole(block.rolesAny);
  }

  isGroupExpanded(key: SidebarGroupKey): boolean {
    switch (key) {
      case 'loads':
        return this.isLoadsExpanded;
      case 'financial':
        return this.isFinancialExpanded;
      case 'compliance':
        return this.isComplianceExpanded;
      case 'admin':
        return this.isAdminExpanded;
      default:
        return false;
    }
  }

  toggleGroup(key: SidebarGroupKey, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    switch (key) {
      case 'loads':
        this.isLoadsExpanded = !this.isLoadsExpanded;
        break;
      case 'financial':
        this.isFinancialExpanded = !this.isFinancialExpanded;
        break;
      case 'compliance':
        this.isComplianceExpanded = !this.isComplianceExpanded;
        break;
      case 'admin':
        this.isAdminExpanded = !this.isAdminExpanded;
        break;
    }
  }

  trackNavBlock(_index: number, block: SidebarNavBlock): string {
    if (block.kind === 'link') {
      return `l-${block.link.id}`;
    }
    if (block.kind === 'group') {
      return `g-${block.id}`;
    }
    return `d-${_index}`;
  }

}

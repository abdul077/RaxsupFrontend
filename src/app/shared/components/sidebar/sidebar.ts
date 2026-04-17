import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

export interface SidebarSearchResult {
  id: string;
  label: string;
  routerLink: string;
  iconClass: string;
  exact?: boolean;
  /** Parent section label for nested items */
  groupCaption?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
  navSearchQuery = '';
  private navSub?: Subscription;

  @ViewChild('menuSearchInput') menuSearchInput?: ElementRef<HTMLInputElement>;

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
        this.navSearchQuery = '';
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

  get isMenuSearchActive(): boolean {
    return this.navSearchQuery.trim().length > 0;
  }

  get menuSearchResults(): SidebarSearchResult[] {
    const q = this.navSearchQuery.trim().toLowerCase();
    if (!q) {
      return [];
    }
    const rows: SidebarSearchResult[] = [];
    for (const block of SIDEBAR_NAV) {
      if (block.kind === 'divider') {
        continue;
      }
      if (block.kind === 'link') {
        if (!this.visibleLink(block.link)) {
          continue;
        }
        if (this.matchTextForLink(block.link).includes(q)) {
          rows.push(this.toSearchResult(block.link));
        }
        continue;
      }
      if (!this.hasAnyRole(block.rolesAny)) {
        continue;
      }
      if (this.matchTextForGroup(block).includes(q)) {
        rows.push({
          id: `${block.id}__root`,
          label: block.label,
          routerLink: block.routerLink,
          iconClass: block.iconClass,
          exact: block.exact,
        });
      }
      for (const child of block.children) {
        if (!this.visibleLink(child)) {
          continue;
        }
        if (this.matchTextForLink(child, block.label).includes(q)) {
          rows.push({
            ...this.toSearchResult(child),
            groupCaption: block.label,
          });
        }
      }
    }
    return rows;
  }

  private toSearchResult(link: SidebarNavLeaf): SidebarSearchResult {
    return {
      id: link.id,
      label: link.label,
      routerLink: link.routerLink,
      iconClass: link.iconClass,
      exact: link.exact,
    };
  }

  private matchTextForLink(link: SidebarNavLeaf, parentSection?: string): string {
    const parts = [link.label, link.routerLink.replace(/\//g, ' '), ...(link.keywords ?? [])];
    if (parentSection) {
      parts.push(parentSection);
    }
    return parts.join(' ').toLowerCase();
  }

  private matchTextForGroup(group: Extract<SidebarNavBlock, { kind: 'group' }>): string {
    return [group.label, group.routerLink.replace(/\//g, ' '), ...(group.keywords ?? [])]
      .join(' ')
      .toLowerCase();
  }

  clearMenuSearch(): void {
    this.navSearchQuery = '';
  }

  onSearchResultNavigate(): void {
    this.navSearchQuery = '';
  }

  onMenuSearchKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.clearMenuSearch();
      (ev.target as HTMLInputElement)?.blur();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent): void {
    if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
      const t = ev.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && t !== this.menuSearchInput?.nativeElement) {
        return;
      }
      ev.preventDefault();
      queueMicrotask(() => this.focusMenuSearch());
    }
  }

  private focusMenuSearch(): void {
    this.menuSearchInput?.nativeElement?.focus();
  }
}

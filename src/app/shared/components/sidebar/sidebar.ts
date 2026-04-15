import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { LayoutService } from '../../../core/services/layout.service';
import { DriverService } from '../../../core/services/driver.service';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent implements OnInit, OnDestroy {
  isBeta = environment.isBeta;
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
    // Auto-expand menus and close mobile sidebar on route change
    this.navSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.layoutService.closeSidebar();
        if (event.url?.startsWith('/admin')) {
          this.isAdminExpanded = true;
        }
        if (event.url?.startsWith('/loads')) {
          this.isLoadsExpanded = true;
        }
        if (event.url?.startsWith('/financial')) {
          this.isFinancialExpanded = true;
        }
        if (event.url?.startsWith('/compliance')) {
          this.isComplianceExpanded = true;
        }
      });

    // Check initial route
    const currentUrl = this.router.url;
    if (currentUrl?.startsWith('/admin')) {
      this.isAdminExpanded = true;
    }
    if (currentUrl?.startsWith('/loads')) {
      this.isLoadsExpanded = true;
    }
    if (currentUrl?.startsWith('/financial')) {
      this.isFinancialExpanded = true;
    }
    if (currentUrl?.startsWith('/compliance')) {
      this.isComplianceExpanded = true;
    }

    // Load pending drivers count if admin
    if (this.authService.hasRole('Admin')) {
      this.loadPendingDriversCount();
    }
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  loadPendingDriversCount(): void {
    this.driverService.getPendingDrivers().subscribe({
      next: (drivers) => {
        this.pendingDriversCount = drivers.length;
      },
      error: () => {
        // Silently fail - don't show error in sidebar
      }
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
    // Convert role names to display format (e.g., "FleetManager" -> "Fleet Manager")
    return role
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  toggleAdminMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.isAdminExpanded = !this.isAdminExpanded;
  }

  toggleLoadsMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.isLoadsExpanded = !this.isLoadsExpanded;
  }

  toggleFinancialMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.isFinancialExpanded = !this.isFinancialExpanded;
  }

  toggleComplianceMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.isComplianceExpanded = !this.isComplianceExpanded;
  }
}


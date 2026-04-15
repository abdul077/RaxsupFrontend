import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { LayoutService } from '../../../core/services/layout.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Notification } from '../../../core/models/admin.model';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class TopbarComponent implements OnInit, OnDestroy {
  isBeta = environment.isBeta;
  unreadCount = 0;
  notifications: Notification[] = [];
  showNotificationDropdown = false;
  pageName = 'Dashboard';
  private readonly easternTimeZone = 'America/New_York';
  private subscriptions: Subscription[] = [];
  private timeUpdateInterval?: any;
  currentTime = Date.now(); // Used to trigger change detection for time updates

  private readonly routeToPageName: Record<string, string> = {
    'dashboard': 'Dashboard',
    'loads': 'Loads',
    'loads/create': 'Create Load',
    'loads/accessorial-types': 'Accessorial Types',
    'drivers': 'Drivers',
    'drivers/create': 'Create Driver',
    'drivers/reports': 'Driver Reports',
    'drivers/documents': 'Driver Documents',
    'drivers/settlements': 'Driver Settlements',
    'drivers/my-profile': 'My Profile',
    'drivers/my-referrals': 'My Referrals',
    'drivers/my-incidents': 'My Incidents',
    'drivers/my-vehicles': 'My Vehicles',
    'owner-operators': 'Owner Operators',
    'owner-operators/create': 'Create Owner Operator',
    'customers': 'Brokers',
    'equipment': 'Equipment',
    'financial': 'Financial',
    'financial/invoices': 'Invoices',
    'financial/invoices/create': 'Create Invoice',
    'financial/settlements': 'Settlements',
    'financial/settlements/create': 'Create Settlement',
    'financial/payments': 'All Payments',
    'financial/reports': 'Financial Reports',
    'financial/accounts-payable': 'Accounts Payable',
    'financial/accounts-payable/create': 'Create Accounts Payable',
    'financial/accounts-receivable': 'Accounts Receivable',
    'financial/accounts-receivable/create': 'Create Accounts Receivable',
    'payroll': 'Payroll',
    'payroll/list': 'Payroll List',
    'payroll/create': 'Create Payroll',
    'payroll/sync-management': 'Sync Management',
    'compliance': 'Compliance',
    'compliance/dashboard': 'Compliance Dashboard',
    'compliance/incidents': 'Incidents',
    'compliance/incidents/create': 'Create Incident',
    'compliance/calendar': 'Compliance Calendar',
    'compliance/inspections/create': 'Add Inspection',
    'admin': 'Admin',
    'admin/users': 'Users',
    'admin/inactive-users': 'Inactive Users',
    'admin/companies': 'Companies',
    'admin/branches': 'Branches',
    'admin/api-keys': 'API Keys',
    'admin/notifications': 'Notifications',
    'admin/audit-logs': 'Audit Logs',
    'admin/email-logs': 'Email Logs',
    'admin/pending-drivers': 'Pending Drivers',
    'admin/rejected-drivers': 'Rejected Drivers',
    'admin/motive': 'Motive Admin',
    'reports': 'Reports',
    'messaging': 'Messages',
    'profile': 'Profile',
    'profile/my-profile': 'My Profile',
    'profile/settings': 'Settings',
    'profile/help': 'Help & Support',
  };

  constructor(
    public authService: AuthService,
    public layoutService: LayoutService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  toggleSidebar(): void {
    this.layoutService.toggleSidebar();
  }

  ngOnInit(): void {
    // Subscribe to unread count
    const unreadSub = this.notificationService.unreadCount$.subscribe(count => {
      this.unreadCount = count;
    });

    // Subscribe to notifications (show latest 5 in dropdown)
    const notifSub = this.notificationService.notifications$.subscribe(notifications => {
      this.notifications = notifications.slice(0, 5);
    });

    // Subscribe to route changes to update page name
    const routerSub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.pageName = this.getPageNameFromRoute();
      this.cdr.markForCheck();
    });

    this.subscriptions.push(unreadSub, notifSub, routerSub);

    // Set initial page name
    this.pageName = this.getPageNameFromRoute();

    // Update time every 30 seconds to refresh "time ago" displays
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime = Date.now();
      this.cdr.markForCheck();
    }, 30000); // Update every 30 seconds
  }

  private getPageNameFromRoute(): string {
    const url = this.router.url.split('?')[0];
    const path = url.startsWith('/') ? url.slice(1) : url;

    // Try exact match first
    if (this.routeToPageName[path]) {
      return this.routeToPageName[path];
    }

    // Handle dynamic routes (e.g., /drivers/123, /loads/456)
    const segments = path.split('/');
    if (segments.length >= 2) {
      const lastSegment = segments[segments.length - 1];
      const firstSegment = segments[0];

      // Nested sub-routes: drivers/123/analytics, drivers/123/loads, etc.
      if (segments.length >= 3) {
        if (firstSegment === 'drivers' && lastSegment === 'loads') return 'Driver Loads';
        if (firstSegment === 'drivers' && lastSegment === 'analytics') return 'Driver Analytics';
        if (firstSegment === 'drivers' && lastSegment === 'activity') return 'Driver Activity';
        if (firstSegment === 'drivers' && lastSegment === 'edit') return 'Edit Driver';
        if (firstSegment === 'loads' && lastSegment === 'edit') return 'Edit Load';
        if (firstSegment === 'financial' && segments[1] === 'invoices' && lastSegment === 'edit') return 'Edit Invoice';
        if (firstSegment === 'financial' && segments[1] === 'settlements' && lastSegment === 'edit') return 'Edit Settlement';
        if (firstSegment === 'financial' && segments[1] === 'accounts-payable' && lastSegment === 'edit') return 'Edit Accounts Payable';
        if (firstSegment === 'financial' && segments[1] === 'accounts-receivable' && lastSegment === 'edit') return 'Edit Accounts Receivable';
        if (firstSegment === 'compliance' && lastSegment === 'edit') return 'Edit Incident';
        if (firstSegment === 'admin' && segments[1] === 'users') return 'User Details';
        if (firstSegment === 'owner-operators' && lastSegment === 'edit') return 'Edit Owner Operator';
      }

      // Simple detail routes: drivers/123, loads/456, invoices/789
      const basePath = segments.slice(0, -1).join('/');
      const parentName = this.routeToPageName[basePath];
      if (parentName) {
        if (lastSegment === 'edit') return `Edit ${parentName}`;
        // Use singular for detail page title (Load Details, Driver Details) to match load-detail UI
        const detailTitle =
          parentName === 'Loads' ? 'Load' :
          parentName === 'Drivers' ? 'Driver' :
          parentName === 'Brokers' ? 'Broker' :
          parentName;
        return `${detailTitle} Details`;
      }

      // Check if first segment maps (e.g., drivers/123 -> Driver Details)
      const sectionName = this.routeToPageName[firstSegment];
      if (sectionName && !isNaN(Number(lastSegment))) {
        const detailTitle =
          sectionName === 'Loads' ? 'Load' :
          sectionName === 'Drivers' ? 'Driver' :
          sectionName === 'Brokers' ? 'Broker' :
          sectionName;
        return `${detailTitle} Details`;
      }
    }

    // Fallback: format path as title (e.g., "financial-reports" -> "Financial Reports")
    return path
      .split('/')
      .map(s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
      .join(' / ') || 'Dashboard';
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }

  toggleNotificationDropdown(): void {
    this.showNotificationDropdown = !this.showNotificationDropdown;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.notification-dropdown');
    if (!clickedInside && this.showNotificationDropdown) {
      this.showNotificationDropdown = false;
    }
  }

  handleNotificationClick(notification: Notification): void {
    // Mark as read
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.notificationId);
    }

    // Navigate to action URL if provided
    if (notification.actionUrl) {
      this.router.navigate([notification.actionUrl]);
    }

    // Close dropdown
    this.showNotificationDropdown = false;
  }

  markAsRead(notification: Notification, event: Event): void {
    event.stopPropagation();
    this.notificationService.markAsRead(notification.notificationId);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  getIconClass(notification: Notification): string {
    switch (notification.category) {
      case 'Info':
        return 'fa-info-circle text-info';
      case 'Warning':
        return 'fa-exclamation-triangle text-warning';
      case 'Error':
        return 'fa-times-circle text-danger';
      case 'Success':
        return 'fa-check-circle text-success';
      default:
        return 'fa-bell text-secondary';
    }
  }

  getTimeAgo(dateString: string | undefined): string {
    if (!dateString) return '';
    
    const date = this.parseNotificationDate(dateString);
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return '';
    }

    // Use currentTime to ensure timestamps refresh over time
    const now = new Date(this.currentTime);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Handle negative time (future dates)
    if (seconds < 0) return 'Just now';

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    // For older dates, format in Eastern Time for display
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.easternTimeZone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  }

  logout(): void {
    this.authService.logout();
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

  private parseNotificationDate(dateString: string): Date | null {
    if (!dateString) return null;

    try {
      const timestampStr = dateString.trim();
      let date: Date;
      
      // If the timestamp doesn't have timezone info, assume it's UTC
      // This matches the TimeZoneService approach
      if (timestampStr.includes('T') && !timestampStr.endsWith('Z') && !timestampStr.match(/[+-]\d{2}:?\d{2}$/)) {
        // No timezone indicator - treat as UTC by appending 'Z'
        date = new Date(timestampStr + 'Z');
      } else {
        // Has timezone info, parse directly
        date = new Date(timestampStr);
      }
      
      // Verify date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date after parsing:', dateString);
        return null;
      }
      
      return date;
    } catch (error) {
      console.error('Error parsing notification date:', error, dateString);
      return null;
    }
  }
}


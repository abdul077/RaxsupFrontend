import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotificationApiService } from '../../../core/services/notification-api.service';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth';
import { Notification } from '../../../core/models/admin.model';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PaginationComponent],
  templateUrl: './notification-list.html',
  styleUrl: './notification-list.scss',
})
export class NotificationListComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  filterUnread = false;
  loading = false;
  markingAllRead = false;

  // Filters and search
  searchQuery = '';
  typeFilter: 'all' | 'message' | 'alert' = 'all';
  sortOrder: 'unread-first' | 'newest' = 'unread-first';

  // Selection (for bulk actions)
  selectedIds = new Set<number>();

  /** Which notification's three-dot menu is open (null = none). */
  openMenuNotificationId: number | null = null;
  deletingIds = new Set<number>();

  // Client-side pagination (applied to filtered list)
  pageNumber = 1;
  pageSize = 25;

  /** Filtered list (search + type + unread filter + sort). */
  get filteredNotifications(): Notification[] {
    let list = this.notifications;
    if (this.filterUnread) list = list.filter(n => !n.isRead);
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(n =>
        (n.title ?? '').toLowerCase().includes(q) ||
        (n.message ?? '').toLowerCase().includes(q) ||
        (n.userName ?? '').toLowerCase().includes(q)
      );
    }
    if (this.typeFilter === 'message') {
      list = list.filter(n => !n.category || n.category === 'Info' || n.category === 'Success');
    } else if (this.typeFilter === 'alert') {
      list = list.filter(n => n.category === 'Warning' || n.category === 'Error');
    }
    if (this.sortOrder === 'unread-first') {
      list = [...list].sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1));
    } else {
      list = [...list].sort((a, b) => {
        const da = this.parseNotificationDate(a.createdAt)?.getTime() ?? 0;
        const db = this.parseNotificationDate(b.createdAt)?.getTime() ?? 0;
        return db - da;
      });
    }
    return list;
  }

  get totalCount(): number {
    return this.filteredNotifications.length;
  }
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }
  get paginatedNotifications(): Notification[] {
    const start = (this.pageNumber - 1) * this.pageSize;
    return this.filteredNotifications.slice(start, start + this.pageSize);
  }

  /** Group current page items by date label (Today, Yesterday, or formatted date). */
  get notificationsByDate(): { label: string; items: Notification[] }[] {
    const now = new Date(this.currentTime);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayMs = 86400000;
    const groups = new Map<string, Notification[]>();
    for (const n of this.paginatedNotifications) {
      const date = this.parseNotificationDate(n.createdAt);
      const t = date ? date.getTime() : 0;
      let label: string;
      if (t >= todayStart) label = 'Today';
      else if (t >= todayStart - dayMs) label = 'Yesterday';
      else
        label = date
          ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined }).format(date)
          : 'Older';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(n);
    }
    const order = ['Today', 'Yesterday'];
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return 0;
      })
      .map(([label, items]) => ({ label, items }));
  }

  /** Stats for summary cards (from full list, not filtered). */
  get statsTotal(): number {
    return this.notifications.length;
  }
  get statsUnread(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }
  get statsMessages(): number {
    return this.notifications.filter(n => !n.category || n.category === 'Info' || n.category === 'Success').length;
  }
  get statsAlerts(): number {
    return this.notifications.filter(n => n.category === 'Warning' || n.category === 'Error').length;
  }

  /** True when current user is Admin — we use admin API and show only their notifications. */
  isAdmin = false;
  private readonly easternTimeZone = 'America/New_York';
  private timeUpdateInterval?: any;
  currentTime = Date.now(); // Used to trigger change detection for time updates

  constructor(
    private notificationApiService: NotificationApiService,
    private adminService: AdminService,
    private authService: AuthService,
    private timeZoneService: TimeZoneService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isAdmin = this.authService.hasRole('Admin');
    this.loadNotifications();

    // Update time every 30 seconds to refresh "time ago" displays
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime = Date.now();
      this.cdr.markForCheck();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }

  loadNotifications(): void {
    this.loading = true;
    this.cdr.markForCheck();

    const isRead = this.filterUnread ? false : undefined;

    if (this.isAdmin) {
      const userId = this.authService.getCurrentUser()?.userId;
      if (userId == null) {
        this.loading = false;
        this.cdr.markForCheck();
        return;
      }
      this.adminService.getNotifications(userId, isRead).subscribe({
        next: (data) => {
          this.notifications = data;
          this.pageNumber = 1;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading admin notifications:', error);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.notificationApiService.getMyNotifications(isRead).subscribe({
        next: (data) => {
          this.notifications = data;
          this.pageNumber = 1;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading notifications:', error);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  onPageChange(page: number): void {
    this.pageNumber = page;
    this.cdr.markForCheck();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageNumber = 1;
    this.cdr.markForCheck();
  }

  onSearchOrFilter(): void {
    this.pageNumber = 1;
    this.cdr.markForCheck();
  }

  isSelected(notification: Notification): boolean {
    return this.selectedIds.has(notification.notificationId);
  }

  toggleSelection(notification: Notification): void {
    const id = notification.notificationId;
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
    this.cdr.markForCheck();
  }

  get hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  get isAllOnPageSelected(): boolean {
    const page = this.paginatedNotifications;
    return page.length > 0 && page.every(n => this.selectedIds.has(n.notificationId));
  }

  selectAllOnPage(): void {
    this.paginatedNotifications.forEach(n => this.selectedIds.add(n.notificationId));
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.cdr.markForCheck();
  }

  deleteSelected(): void {
    if (!this.hasSelection) return;
    const ids = Array.from(this.selectedIds);
    ids.forEach(id => this.deletingIds.add(id));
    this.cdr.markForCheck();

    const deleteNext = (index: number) => {
      if (index >= ids.length) {
        this.deletingIds.clear();
        this.clearSelection();
        this.loadNotifications();
        this.cdr.markForCheck();
        return;
      }
      this.notificationApiService.deleteNotification(ids[index]).subscribe({
        next: () => deleteNext(index + 1),
        error: (err) => {
          console.error('Error deleting notification:', err);
          this.deletingIds.clear();
          this.clearSelection();
          this.loadNotifications();
          this.cdr.markForCheck();
        }
      });
    };
    deleteNext(0);
  }

  deleteNotification(notification: Notification): void {
    const id = notification.notificationId;
    if (this.deletingIds.has(id)) return;
    this.deletingIds.add(id);
    this.openMenuNotificationId = null;
    this.cdr.markForCheck();

    this.notificationApiService.deleteNotification(id).subscribe({
      next: () => {
        this.deletingIds.delete(id);
        this.selectedIds.delete(id);
        this.loadNotifications();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error deleting notification:', err);
        this.deletingIds.delete(id);
        this.cdr.markForCheck();
      }
    });
  }

  toggleMenu(notification: Notification): void {
    this.openMenuNotificationId = this.openMenuNotificationId === notification.notificationId ? null : notification.notificationId;
    this.cdr.markForCheck();
  }

  closeMenu(): void {
    this.openMenuNotificationId = null;
    this.cdr.markForCheck();
  }

  isMenuOpen(notification: Notification): boolean {
    return this.openMenuNotificationId === notification.notificationId;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.openMenuNotificationId != null) {
      this.closeMenu();
    }
  }

  goToAction(notification: Notification): void {
    const url = notification.actionUrl;
    if (url) window.open(url, '_blank');
  }

  markAsRead(notification: Notification): void {
    if (notification.isRead) return;
    const mark$ = this.isAdmin
      ? this.adminService.markNotificationRead(notification.notificationId)
      : this.notificationApiService.markAsRead(notification.notificationId);
    mark$.subscribe({
      next: () => this.loadNotifications(),
      error: (error) => console.error('Error marking notification as read:', error)
    });
  }

  markAllAsRead(): void {
    const unread = this.notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    this.markingAllRead = true;
    this.cdr.markForCheck();
    this.notificationApiService.markAllAsRead().subscribe({
      next: () => {
        this.loadNotifications();
        this.markingAllRead = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error marking all as read:', error);
        this.markingAllRead = false;
        this.cdr.markForCheck();
      }
    });
  }

  formatCreatedAt(dateString: string | undefined): string {
    return this.timeZoneService.formatDateTime(dateString);
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


import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { Notification } from '../models/admin.model';
import { NotificationSignalRService } from './notification-signalr.service';
import { NotificationApiService } from './notification-api.service';
import { NotificationAudioService } from './notification-audio.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private unreadCountSubject = new BehaviorSubject<number>(0);
  private pollingSubscription?: Subscription;
  private signalRSubscription?: Subscription;

  public notifications$ = this.notificationsSubject.asObservable();
  public unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(
    private notificationSignalR: NotificationSignalRService,
    private notificationApi: NotificationApiService,
    private audioService: NotificationAudioService
  ) {
    // Subscribe to real-time notifications from SignalR
    this.signalRSubscription = this.notificationSignalR.notification$.subscribe(notification => {
      console.log('[NotificationService] Received real-time notification:', notification);
      this.addNotification(notification);
      this.playNotificationSound(notification);
    });
  }

  /**
   * Initialize the notification system
   */
  async initialize(): Promise<void> {
    try {
      // Try to start SignalR connection
      await this.notificationSignalR.startConnection();
      console.log('[NotificationService] SignalR connection started');
    } catch (error) {
      console.error('[NotificationService] Failed to start SignalR:', error);
    }

    // Always start polling as a fallback
    this.startPolling();

    // Initial fetch of notifications
    this.fetchNotifications();
  }

  /**
   * Start polling for notifications (fallback mechanism)
   */
  startPolling(): void {
    // Poll every 60 seconds
    this.pollingSubscription = interval(60000).subscribe(() => {
      this.fetchNotifications();
    });
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }

  /**
   * Fetch notifications from API
   */
  private fetchNotifications(): void {
    this.notificationApi.getMyNotifications().subscribe({
      next: (notifications) => {
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();
      },
      error: (error) => {
        console.error('[NotificationService] Error fetching notifications:', error);
      }
    });
  }

  /**
   * Fetch unread count
   */
  fetchUnreadCount(): void {
    this.notificationApi.getUnreadCount().subscribe({
      next: (response) => {
        this.unreadCountSubject.next(response.count);
      },
      error: (error) => {
        console.error('[NotificationService] Error fetching unread count:', error);
      }
    });
  }

  /**
   * Add a new notification to the list
   */
  private addNotification(notification: Notification): void {
    const current = this.notificationsSubject.value;
    
    // Check if notification already exists (prevent duplicates)
    const exists = current.some(n => n.notificationId === notification.notificationId);
    if (exists) {
      return;
    }

    // Add to the beginning of the list
    this.notificationsSubject.next([notification, ...current]);
    this.updateUnreadCount();
  }

  /**
   * Update unread count based on current notifications
   */
  private updateUnreadCount(): void {
    const unread = this.notificationsSubject.value.filter(n => !n.isRead).length;
    this.unreadCountSubject.next(unread);
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(notification: Notification): void {
    if (notification.category) {
      this.audioService.play(notification.category);
    }
  }

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: number): void {
    this.notificationApi.markAsRead(notificationId).subscribe({
      next: () => {
        // Update local state
        const notifications = this.notificationsSubject.value.map(n =>
          n.notificationId === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n
        );
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();

        // Also notify via SignalR
        this.notificationSignalR.markAsRead(notificationId);
      },
      error: (error) => {
        console.error('[NotificationService] Error marking notification as read:', error);
      }
    });
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead(): void {
    this.notificationApi.markAllAsRead().subscribe({
      next: (response) => {
        // Update local state
        const notifications = this.notificationsSubject.value.map(n => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString()
        }));
        this.notificationsSubject.next(notifications);
        this.updateUnreadCount();

        // Also notify via SignalR
        this.notificationSignalR.markAllAsRead();
      },
      error: (error) => {
        console.error('[NotificationService] Error marking all as read:', error);
      }
    });
  }

  /**
   * Get current notifications
   */
  getNotifications(): Notification[] {
    return this.notificationsSubject.value;
  }

  /**
   * Get current unread count
   */
  getUnreadCount(): number {
    return this.unreadCountSubject.value;
  }

  /**
   * Cleanup notification system (public method for manual cleanup)
   */
  cleanup(): void {
    this.stopPolling();
    if (this.signalRSubscription) {
      this.signalRSubscription.unsubscribe();
      this.signalRSubscription = undefined;
    }
    this.notificationSignalR.stopConnection();

    // Clear local state
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  /**
   * Cleanup on service destroy
   */
  ngOnDestroy(): void {
    this.cleanup();
  }
}


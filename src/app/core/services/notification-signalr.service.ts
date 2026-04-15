import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from './auth';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/admin.model';

@Injectable({
  providedIn: 'root',
})
export class NotificationSignalRService {
  private hubConnection?: HubConnection;
  private connectionStateSubject = new BehaviorSubject<HubConnectionState>(HubConnectionState.Disconnected);
  public connectionState$ = this.connectionStateSubject.asObservable();

  // Notification events
  private notificationSubject = new Subject<Notification>();
  public notification$ = this.notificationSubject.asObservable();

  constructor(private authService: AuthService) {}

  async startConnection(): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const apiUrl = environment.apiUrl.replace('/api', '');
    this.hubConnection = new HubConnectionBuilder()
      .withUrl(`${apiUrl}/notificationhub`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Exponential backoff: 0s, 2s, 10s, 30s, then 30s intervals
          if (retryContext.previousRetryCount === 0) return 0;
          if (retryContext.previousRetryCount === 1) return 2000;
          if (retryContext.previousRetryCount === 2) return 10000;
          return 30000;
        }
      })
      .build();

    // Register event handlers
    this.registerHandlers();

    // Update connection state
    this.hubConnection.onclose(() => {
      this.connectionStateSubject.next(HubConnectionState.Disconnected);
    });

    this.hubConnection.onreconnecting(() => {
      this.connectionStateSubject.next(HubConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected(() => {
      this.connectionStateSubject.next(HubConnectionState.Connected);
    });

    try {
      await this.hubConnection.start();
      this.connectionStateSubject.next(HubConnectionState.Connected);
      console.log('[NotificationSignalR] Connection established successfully');
    } catch (error) {
      console.error('[NotificationSignalR] Error starting connection:', error);
      this.connectionStateSubject.next(HubConnectionState.Disconnected);
      throw error;
    }
  }

  private registerHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.on('ReceiveNotification', (notification: Notification) => {
      console.log('[NotificationSignalR] 📬📬📬 ReceiveNotification received:', notification);
      console.log('[NotificationSignalR] Notification details:', {
        id: notification.notificationId,
        title: notification.title,
        message: notification.message?.substring(0, 50),
        category: notification.category
      });
      this.notificationSubject.next(notification);
    });
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.connectionStateSubject.next(HubConnectionState.Disconnected);
    }
  }

  async markAsRead(notificationId: number): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke('MarkAsRead', notificationId);
        console.log(`[NotificationSignalR] Marked notification ${notificationId} as read`);
      } catch (error) {
        console.error(`[NotificationSignalR] Error marking notification as read:`, error);
      }
    }
  }

  async markAllAsRead(): Promise<void> {
    if (this.hubConnection?.state === HubConnectionState.Connected) {
      try {
        await this.hubConnection.invoke('MarkAllAsRead');
        console.log('[NotificationSignalR] Marked all notifications as read');
      } catch (error) {
        console.error('[NotificationSignalR] Error marking all notifications as read:', error);
      }
    }
  }

  getConnectionState(): HubConnectionState {
    return this.hubConnection?.state ?? HubConnectionState.Disconnected;
  }
}


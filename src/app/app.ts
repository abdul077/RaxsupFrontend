import { Component, signal, OnInit, OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth';
import { NotificationService } from './core/services/notification.service';
import { SignalRService } from './core/services/signalr.service';
import { Subscription } from 'rxjs';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('RaxsUpFrontend');
  private authSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private signalRService: SignalRService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    // Set document title from environment (Beta vs production)
    const baseTitle = 'RaxsUp';
    const suffix = environment.isBeta ? ' Beta' : '';
    this.titleService.setTitle(`${baseTitle}${suffix} - Load Management System`);

    // Debug: Check current user's token and role
    this.debugTokenInfo();

    // Subscribe to authentication state changes
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      if (user) {
        // User logged in - initialize notifications and SignalR
        this.initializeNotifications();
        this.initializeSignalR();
      } else {
        // User logged out - cleanup notifications and SignalR
        this.cleanupNotifications();
        this.cleanupSignalR();
      }
    });
  }

  private debugTokenInfo(): void {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Decode JWT token (format: header.payload.signature)
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          
          // JWT tokens from .NET use these claim types
          const role = payload.role || 
                      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
          const userId = payload.nameid || 
                        payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
          const username = payload.unique_name || 
                          payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];
          
          console.log('═══════════════════════════════════════');
          console.log('🔐 CURRENT USER TOKEN INFO:');
          console.log('═══════════════════════════════════════');
          console.log('👤 User ID:', userId);
          console.log('👤 Username:', username);
          console.log('🎭 Role:', role);
          console.log('📋 Full Token Payload:', payload);
          console.log('═══════════════════════════════════════');
          
          // Check if user has Driver role
          if (role !== 'Driver') {
            console.warn('⚠️  WARNING: Current user is NOT a Driver!');
            console.warn('⚠️  The /drivers/my-profile endpoint requires "Driver" role.');
            console.warn('⚠️  Current role:', role);
          } else {
            console.log('✅ User has Driver role - /drivers/my-profile should work!');
          }
        }
      } catch (error) {
        console.error('❌ Failed to decode token:', error);
      }
    } else {
      console.log('ℹ️  No token found - user is not logged in');
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe from auth changes
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }

    // Cleanup notifications and SignalR
    this.cleanupNotifications();
    this.cleanupSignalR();
  }

  private async initializeNotifications(): Promise<void> {
    try {
      console.log('[App] 🔔🔔🔔 Initializing notification system...');
      await this.notificationService.initialize();
      console.log('[App] ✅✅✅ Notification system initialized successfully');
    } catch (error) {
      console.error('[App] ❌❌❌ Failed to initialize notification system:', error);
    }
  }

  private cleanupNotifications(): void {
    try {
      this.notificationService.cleanup();
      console.log('[App] Notification system cleaned up');
    } catch (error) {
      console.error('[App] Failed to cleanup notification system:', error);
    }
  }

  private async initializeSignalR(): Promise<void> {
    try {
      console.log('[App] 🔌🔌🔌 Initializing SignalR connection...');
      await this.signalRService.startConnection();
      console.log('[App] ✅✅✅ SignalR connection initialized successfully');
      const connectionState = this.signalRService.getConnectionState();
      console.log('[App] SignalR connection state:', connectionState);
    } catch (error) {
      console.error('[App] ❌❌❌ Failed to initialize SignalR connection:', error);
    }
  }

  private async cleanupSignalR(): Promise<void> {
    try {
      await this.signalRService.stopConnection();
      console.log('[App] SignalR connection cleaned up');
    } catch (error) {
      console.error('[App] Failed to cleanup SignalR connection:', error);
    }
  }
}

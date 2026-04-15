import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // Skip loading indicator for certain requests
  // 1. Requests with X-Skip-Loading header
  // 2. Notification API calls (background polling/updates)
  // 3. SignalR hub connections (negotiation, reconnect)
  // 4. All chat API calls (background polling/real-time updates)
  const url = req.url.toLowerCase();
  const skipLoading =
    req.headers.has('X-Skip-Loading') ||
    url.includes('/notifications') ||
    url.includes('/notification') ||
    url.includes('/chathub') ||
    url.includes('/notificationhub') ||
    url.includes('/chats/') ||
    url.includes('negotiate') ||
    url.includes('signalr') ||
    url.includes('fleet-locations');

  if (!skipLoading) {
    loadingService.show();
  }

  return next(req).pipe(
    finalize(() => {
      if (!skipLoading) {
        loadingService.hide();
      }
    })
  );
};


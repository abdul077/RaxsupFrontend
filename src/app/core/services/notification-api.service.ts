import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../models/admin.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  private apiUrl = `${environment.apiUrl}/notifications`;
  private skipLoadingHeaders = new HttpHeaders({ 'X-Skip-Loading': 'true' });

  constructor(private http: HttpClient) {}

  getMyNotifications(isRead?: boolean): Observable<Notification[]> {
    let params = new HttpParams();
    if (isRead !== undefined) params = params.set('isRead', isRead.toString());
    return this.http.get<Notification[]>(`${this.apiUrl}/my-notifications`, { 
      params,
      headers: this.skipLoadingHeaders
    });
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/unread-count`, {
      headers: this.skipLoadingHeaders
    });
  }

  markAsRead(id: number): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/${id}/read`, {}, {
      headers: this.skipLoadingHeaders
    });
  }

  markAllAsRead(): Observable<{ success: boolean; count: number }> {
    return this.http.put<{ success: boolean; count: number }>(`${this.apiUrl}/mark-all-read`, {}, {
      headers: this.skipLoadingHeaders
    });
  }

  deleteNotification(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`, {
      headers: this.skipLoadingHeaders
    });
  }
}


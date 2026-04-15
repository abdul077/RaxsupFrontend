import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MotiveExternalIdMapping,
  MotiveSummary,
  MotiveStatus,
  MotiveSyncLog,
  MotiveWebhookEvent
} from '../models/motive-admin.model';

@Injectable({
  providedIn: 'root'
})
export class MotiveAdminService {
  private apiUrl = `${environment.apiUrl}/motive`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<MotiveStatus> {
    return this.http.get<MotiveStatus>(`${this.apiUrl}/status`);
  }

  getSummary(): Observable<MotiveSummary> {
    return this.http.get<MotiveSummary>(`${this.apiUrl}/summary`);
  }

  getSyncLogs(
    take: number = 100,
    opts?: {
      status?: string;
      entityType?: string;
      from?: string;
      to?: string;
      search?: string;
    }
  ): Observable<MotiveSyncLog[]> {
    let params = new HttpParams().set('take', take.toString());
    params = this.addOpt(params, 'status', opts?.status);
    params = this.addOpt(params, 'entityType', opts?.entityType);
    params = this.addOpt(params, 'from', opts?.from);
    params = this.addOpt(params, 'to', opts?.to);
    params = this.addOpt(params, 'search', opts?.search);
    return this.http.get<MotiveSyncLog[]>(`${this.apiUrl}/sync/logs`, { params });
  }

  getSyncLogById(id: number): Observable<MotiveSyncLog> {
    return this.http.get<MotiveSyncLog>(`${this.apiUrl}/sync/logs/${id}`);
  }

  getWebhookEvents(
    take: number = 100,
    opts?: {
      status?: string;
      eventType?: string;
      entityType?: string;
      from?: string;
      to?: string;
      search?: string;
    }
  ): Observable<MotiveWebhookEvent[]> {
    let params = new HttpParams().set('take', take.toString());
    params = this.addOpt(params, 'status', opts?.status);
    params = this.addOpt(params, 'eventType', opts?.eventType);
    params = this.addOpt(params, 'entityType', opts?.entityType);
    params = this.addOpt(params, 'from', opts?.from);
    params = this.addOpt(params, 'to', opts?.to);
    params = this.addOpt(params, 'search', opts?.search);
    return this.http.get<MotiveWebhookEvent[]>(`${this.apiUrl}/webhooks/events`, { params });
  }

  getWebhookEventById(id: number): Observable<{ payload: string } & MotiveWebhookEvent> {
    return this.http.get<{ payload: string } & MotiveWebhookEvent>(`${this.apiUrl}/webhooks/events/${id}`);
  }

  getMappings(
    take: number = 200,
    opts?: {
      entityType?: string;
      syncStatus?: string;
      search?: string;
    }
  ): Observable<MotiveExternalIdMapping[]> {
    let params = new HttpParams().set('take', take.toString());
    params = this.addOpt(params, 'entityType', opts?.entityType);
    params = this.addOpt(params, 'syncStatus', opts?.syncStatus);
    params = this.addOpt(params, 'search', opts?.search);
    return this.http.get<MotiveExternalIdMapping[]>(`${this.apiUrl}/mappings`, { params });
  }

  private addOpt(params: HttpParams, key: string, value?: string): HttpParams {
    if (!value) return params;
    const trimmed = value.trim();
    if (trimmed === '') return params;
    return params.set(key, trimmed);
  }
}


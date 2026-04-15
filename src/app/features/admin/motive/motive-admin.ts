import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MotiveAdminService } from '../../../core/services/motive-admin.service';
import {
  MotiveExternalIdMapping,
  MotiveSummary,
  MotiveStatus,
  MotiveSyncLog,
  MotiveWebhookEvent
} from '../../../core/models/motive-admin.model';

@Component({
  selector: 'app-motive-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './motive-admin.html',
  styleUrl: './motive-admin.scss'
})
export class MotiveAdminComponent implements OnInit {
  summary?: MotiveSummary;
  status?: MotiveStatus;

  syncLogs: MotiveSyncLog[] = [];
  webhookEvents: MotiveWebhookEvent[] = [];
  mappings: MotiveExternalIdMapping[] = [];

  lastRefreshedAt?: Date;

  loadingSummary = false;
  loadingStatus = false;
  loadingLogs = false;
  loadingWebhooks = false;
  loadingMappings = false;

  logsTake = 100;
  webhooksTake = 100;
  mappingsTake = 200;

  // Sync logs filters
  logsStatusFilter = '';
  logsEntityTypeFilter = '';
  logsSearch = '';
  logsFrom = '';
  logsTo = '';
  logsSort: { key: 'startedAt' | 'status' | 'syncLogId'; dir: 'asc' | 'desc' } = { key: 'startedAt', dir: 'desc' };

  // Webhooks filters
  webhookStatusFilter = '';
  webhookEventTypeFilter = '';
  webhookEntityTypeFilter = '';
  webhooksSearch = '';
  webhooksFrom = '';
  webhooksTo = '';
  webhooksSort: { key: 'receivedAt' | 'status' | 'webhookEventId'; dir: 'asc' | 'desc' } = {
    key: 'receivedAt',
    dir: 'desc'
  };

  // Mappings filters
  mappingEntityTypeFilter = '';
  mappingSyncStatusFilter = '';
  mappingsSearch = '';
  mappingsSort: {
    key: 'mappingId' | 'entityType' | 'syncStatus' | 'createdAt' | 'lastSyncedAt';
    dir: 'asc' | 'desc';
  } = { key: 'createdAt', dir: 'desc' };

  errorSummary?: string;
  errorStatus?: string;
  errorLogs?: string;
  errorWebhooks?: string;
  errorMappings?: string;

  activeTab: 'status' | 'syncLogs' | 'webhooks' | 'mappings' = 'status';

  detailOpen = false;
  detailType: 'syncLog' | 'webhook' | 'mapping' | null = null;
  detailLoading = false;
  detailError?: string;
  selectedSyncLog?: MotiveSyncLog;
  selectedWebhookEvent?: (MotiveWebhookEvent & { payload?: string });
  selectedMapping?: MotiveExternalIdMapping;

  constructor(private motiveAdmin: MotiveAdminService) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.errorSummary = undefined;
    this.errorStatus = undefined;
    this.errorLogs = undefined;
    this.errorWebhooks = undefined;
    this.errorMappings = undefined;

    this.lastRefreshedAt = new Date();
    this.loadSummary();
    this.loadStatus();
    this.loadSyncLogs();
    this.loadWebhookEvents();
    this.loadMappings();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.motiveAdmin.getSummary().subscribe({
      next: (data) => {
        this.summary = data;
        this.loadingSummary = false;
      },
      error: (err) => {
        this.loadingSummary = false;
        this.errorSummary = this.formatError(err);
      }
    });
  }

  loadStatus(): void {
    this.loadingStatus = true;
    this.motiveAdmin.getStatus().subscribe({
      next: (data) => {
        this.status = data;
        this.loadingStatus = false;
      },
      error: (err) => {
        this.loadingStatus = false;
        this.errorStatus = this.formatError(err);
      }
    });
  }

  loadSyncLogs(): void {
    this.loadingLogs = true;
    this.motiveAdmin
      .getSyncLogs(this.logsTake, {
        status: this.logsStatusFilter || undefined,
        entityType: this.logsEntityTypeFilter || undefined,
        from: this.toUtcIso(this.logsFrom) || undefined,
        to: this.toUtcIso(this.logsTo) || undefined,
        search: this.logsSearch || undefined
      })
      .subscribe({
      next: (data) => {
        this.syncLogs = data || [];
        this.loadingLogs = false;
      },
      error: (err) => {
        this.loadingLogs = false;
        this.errorLogs = this.formatError(err);
      }
    });
  }

  loadWebhookEvents(): void {
    this.loadingWebhooks = true;
    this.motiveAdmin
      .getWebhookEvents(this.webhooksTake, {
        status: this.webhookStatusFilter || undefined,
        eventType: this.webhookEventTypeFilter || undefined,
        entityType: this.webhookEntityTypeFilter || undefined,
        from: this.toUtcIso(this.webhooksFrom) || undefined,
        to: this.toUtcIso(this.webhooksTo) || undefined,
        search: this.webhooksSearch || undefined
      })
      .subscribe({
        next: (data) => {
          this.webhookEvents = data || [];
          this.loadingWebhooks = false;
        },
        error: (err) => {
          this.loadingWebhooks = false;
          this.errorWebhooks = this.formatError(err);
        }
      });
  }

  loadMappings(): void {
    this.loadingMappings = true;
    this.motiveAdmin
      .getMappings(this.mappingsTake, {
        entityType: this.mappingEntityTypeFilter || undefined,
        syncStatus: this.mappingSyncStatusFilter || undefined,
        search: this.mappingsSearch || undefined
      })
      .subscribe({
        next: (data) => {
          this.mappings = data || [];
          this.loadingMappings = false;
        },
        error: (err) => {
          this.loadingMappings = false;
          this.errorMappings = this.formatError(err);
        }
      });
  }

  setTab(tab: 'status' | 'syncLogs' | 'webhooks' | 'mappings'): void {
    this.activeTab = tab;
  }

  setLogsSort(key: 'startedAt' | 'status' | 'syncLogId'): void {
    if (this.logsSort.key === key) {
      this.logsSort.dir = this.logsSort.dir === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.logsSort = { key, dir: key === 'startedAt' ? 'desc' : 'asc' };
  }

  setWebhooksSort(key: 'receivedAt' | 'status' | 'webhookEventId'): void {
    if (this.webhooksSort.key === key) {
      this.webhooksSort.dir = this.webhooksSort.dir === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.webhooksSort = { key, dir: key === 'receivedAt' ? 'desc' : 'asc' };
  }

  setMappingsSort(key: 'mappingId' | 'entityType' | 'syncStatus' | 'createdAt' | 'lastSyncedAt'): void {
    if (this.mappingsSort.key === key) {
      this.mappingsSort.dir = this.mappingsSort.dir === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.mappingsSort = { key, dir: key === 'createdAt' || key === 'lastSyncedAt' ? 'desc' : 'asc' };
  }

  get sortedSyncLogs(): MotiveSyncLog[] {
    const dir = this.logsSort.dir === 'asc' ? 1 : -1;
    const key = this.logsSort.key;
    return (this.syncLogs || []).slice().sort((a, b) => {
      if (key === 'syncLogId') return (a.syncLogId - b.syncLogId) * dir;
      if (key === 'status') return (a.status || '').localeCompare(b.status || '') * dir;
      const at = new Date(a.startedAt).getTime();
      const bt = new Date(b.startedAt).getTime();
      if (!isFinite(at) || !isFinite(bt)) return 0;
      return (at - bt) * dir;
    });
  }

  get sortedWebhookEvents(): MotiveWebhookEvent[] {
    const dir = this.webhooksSort.dir === 'asc' ? 1 : -1;
    const key = this.webhooksSort.key;
    return (this.webhookEvents || []).slice().sort((a, b) => {
      if (key === 'webhookEventId') return (a.webhookEventId - b.webhookEventId) * dir;
      if (key === 'status') return (a.status || '').localeCompare(b.status || '') * dir;
      const at = new Date(a.receivedAt).getTime();
      const bt = new Date(b.receivedAt).getTime();
      if (!isFinite(at) || !isFinite(bt)) return 0;
      return (at - bt) * dir;
    });
  }

  get sortedMappings(): MotiveExternalIdMapping[] {
    const dir = this.mappingsSort.dir === 'asc' ? 1 : -1;
    const key = this.mappingsSort.key;
    return (this.mappings || []).slice().sort((a, b) => {
      if (key === 'mappingId') return (a.mappingId - b.mappingId) * dir;
      if (key === 'entityType') return (a.entityType || '').localeCompare(b.entityType || '') * dir;
      if (key === 'syncStatus') return (a.syncStatus || '').localeCompare(b.syncStatus || '') * dir;

      const at = this.safeDateMs(key === 'createdAt' ? a.createdAt : a.lastSyncedAt);
      const bt = this.safeDateMs(key === 'createdAt' ? b.createdAt : b.lastSyncedAt);
      if (at === null && bt === null) return 0;
      if (at === null) return 1 * dir; // nulls last
      if (bt === null) return -1 * dir;
      return (at - bt) * dir;
    });
  }

  clearMappingsFilters(): void {
    this.mappingEntityTypeFilter = '';
    this.mappingSyncStatusFilter = '';
    this.mappingsSearch = '';
  }

  openSyncLogDetails(syncLogId: number): void {
    this.detailOpen = true;
    this.detailType = 'syncLog';
    this.detailLoading = true;
    this.detailError = undefined;
    this.selectedSyncLog = undefined;
    this.selectedWebhookEvent = undefined;

    this.motiveAdmin.getSyncLogById(syncLogId).subscribe({
      next: (log) => {
        this.selectedSyncLog = log;
        this.detailLoading = false;
      },
      error: (err) => {
        this.detailLoading = false;
        this.detailError = this.formatError(err);
      }
    });
  }

  openWebhookDetails(webhookEventId: number): void {
    this.detailOpen = true;
    this.detailType = 'webhook';
    this.detailLoading = true;
    this.detailError = undefined;
    this.selectedSyncLog = undefined;
    this.selectedWebhookEvent = undefined;

    this.motiveAdmin.getWebhookEventById(webhookEventId).subscribe({
      next: (evt) => {
        this.selectedWebhookEvent = evt;
        this.detailLoading = false;
      },
      error: (err) => {
        this.detailLoading = false;
        this.detailError = this.formatError(err);
      }
    });
  }

  openMappingDetails(mapping: MotiveExternalIdMapping): void {
    this.detailOpen = true;
    this.detailType = 'mapping';
    this.detailLoading = false;
    this.detailError = undefined;
    this.selectedSyncLog = undefined;
    this.selectedWebhookEvent = undefined;
    this.selectedMapping = mapping;
  }

  closeDetail(): void {
    this.detailOpen = false;
    this.detailType = null;
    this.detailLoading = false;
    this.detailError = undefined;
    this.selectedSyncLog = undefined;
    this.selectedWebhookEvent = undefined;
    this.selectedMapping = undefined;
  }

  formatJsonPreview(json: string | undefined | null, maxLen: number = 160): string {
    if (!json) return '';
    const compact = json.replace(/\s+/g, ' ').trim();
    return compact.length > maxLen ? compact.slice(0, maxLen) + '…' : compact;
  }

  formatJsonPretty(json: string | undefined | null): string {
    if (!json) return '';
    try {
      const parsed = JSON.parse(json);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return json;
    }
  }

  formatDuration(startedAt: string, completedAt?: string | null): string {
    if (!startedAt || !completedAt) return '';
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    if (!isFinite(start) || !isFinite(end) || end < start) return '';
    const ms = end - start;
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${min}m ${rem}s`;
  }

  async copyToClipboard(text: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore (no clipboard permission / unsupported)
    }
  }

  copyValue(value: string | number | null | undefined): void {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (!text) return;
    void this.copyToClipboard(text);
  }

  downloadText(filename: string, content: string): void {
    if (!content) return;
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  statusBadgeClass(status: string | undefined | null): string {
    const s = (status || '').toLowerCase();
    if (s === 'success' || s === 'processed' || s === 'active') return 'badge ok';
    if (s === 'failed') return 'badge bad';
    if (s === 'partial' || s === 'pending' || s === 'processing' || s === 'paused') return 'badge warn';
    return 'badge';
  }

  private formatError(err: any): string {
    if (err?.error?.title && err?.error?.detail) return `${err.error.title}: ${err.error.detail}`;
    if (err?.error?.detail && err?.error?.title) return `${err.error.title}: ${err.error.detail}`;
    if (err?.error?.detail) return err.error.detail;
    if (err?.error?.message) return err.error.message;
    if (typeof err?.error === 'string') return err.error;
    return 'Failed to load Motive data.';
  }

  private toUtcIso(datetimeLocal: string | undefined | null): string | undefined {
    if (!datetimeLocal) return undefined;
    const trimmed = datetimeLocal.trim();
    if (trimmed === '') return undefined;
    const dt = new Date(trimmed);
    if (!isFinite(dt.getTime())) return undefined;
    return dt.toISOString();
  }

  private safeDateMs(date: string | null | undefined): number | null {
    if (!date) return null;
    const ms = new Date(date).getTime();
    return isFinite(ms) ? ms : null;
  }
}


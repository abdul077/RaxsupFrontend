import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { AuditLog } from '../../../core/models/admin.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, FilterState } from '../../../shared/components/data-table/data-table.models';
import { PagedResult } from '../../../core/models/load.model';

@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './audit-log-list.html',
  styleUrl: './audit-log-list.scss',
})
export class AuditLogListComponent implements OnInit {
  tableConfig!: TableConfig<AuditLog>;
  tableRefreshTrigger = 0;
  @ViewChild('auditLogActionsCell', { static: true }) auditLogActionsCell!: TemplateRef<{ $implicit: AuditLog }>;

  filterUserId?: number;
  filterEntityName: string = '';
  filterAction: string = '';
  filterFromDate?: string;
  filterToDate?: string;

  selectedLog: AuditLog | null = null;

  constructor(
    private adminService: AdminService,
    private timeZoneService: TimeZoneService
  ) {}

  ngOnInit(): void {
    this.initializeTableConfig();
  }

  initializeTableConfig(): void {
    this.tableConfig = {
      columns: [
        {
          key: 'timestamp',
          label: 'Timestamp',
          type: 'custom',
          sortable: false,
          width: '160px',
          render: (row) => {
            const primary = this.getRelativeTime(row.timestamp);
            const secondary = this.formatTimestamp(row.timestamp);
            return `${primary} · ${secondary}`;
          }
        },
        {
          key: 'user',
          label: 'User',
          type: 'custom',
          sortable: false,
          width: '140px',
          render: (row) => {
            const name = row.userName || 'System';
            const id = row.userId ? `ID: ${row.userId}` : '';
            return id ? `${name} (${id})` : name;
          }
        },
        {
          key: 'action',
          label: 'Action',
          type: 'badge',
          sortable: false,
          width: '120px',
          badgeClass: (row) => 'badge badge-' + this.getActionColor(row.action),
          render: (row) => row.action
        },
        {
          key: 'entity',
          label: 'Entity',
          type: 'custom',
          sortable: false,
          width: '140px',
          render: (row) => {
            if (row.entityName || row.entityId) {
              const parts = [];
              if (row.entityName) parts.push(row.entityName);
              if (row.entityId) parts.push(`ID: ${row.entityId}`);
              return parts.join(' ');
            }
            return '-';
          }
        }
      ],
      enableSelection: false,
      enablePagination: true,
      defaultPageSize: 50,
      pageSizeOptions: [25, 50, 100, 200],
      emptyMessage: 'No audit logs found. Try adjusting your filters.',
      rowClickable: false
    };
  }

  /** Server-side data source: filters (userId, entityName, action, fromDate, toDate) + pageNumber, pageSize. */
  dataSource = (filters: FilterState): Observable<PagedResult<AuditLog>> => {
    const pageNumber = filters.pageNumber || 1;
    const pageSize = filters.pageSize || 50;
    const fromDate = this.filterFromDate ? this.timeZoneService.getStartOfDayET(this.filterFromDate) : undefined;
    const toDate = this.filterToDate ? this.timeZoneService.getEndOfDayET(this.filterToDate) : undefined;
    const entityName = this.filterEntityName?.trim() || undefined;
    const action = this.filterAction?.trim() || undefined;

    return this.adminService.getAuditLogs(
      this.filterUserId,
      entityName,
      action,
      fromDate,
      toDate,
      pageNumber,
      pageSize
    ).pipe(
      map((data) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        const totalCount = data?.totalCount ?? 0;
        const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(totalCount / pageSize));
        return {
          items,
          totalCount,
          pageNumber: data?.pageNumber ?? pageNumber,
          pageSize: data?.pageSize ?? pageSize,
          totalPages,
          hasPreviousPage: pageNumber > 1,
          hasNextPage: pageNumber < totalPages
        };
      })
    );
  };

  applyFilters(): void {
    this.tableRefreshTrigger++;
  }

  clearFilters(): void {
    this.filterUserId = undefined;
    this.filterEntityName = '';
    this.filterAction = '';
    this.filterFromDate = undefined;
    this.filterToDate = undefined;
    this.tableRefreshTrigger++;
  }

  openDetailsModal(log: AuditLog): void {
    this.selectedLog = log;
  }

  closeDetailsModal(): void {
    this.selectedLog = null;
  }

  getActionColor(action: string): string {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('add')) return 'success';
    if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('modify')) return 'info';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return 'danger';
    if (actionLower.includes('login') || actionLower.includes('activate') || actionLower.includes('enable')) return 'success';
    if (actionLower.includes('logout') || actionLower.includes('deactivate') || actionLower.includes('disable')) return 'warning';
    return 'secondary';
  }

  getRelativeTime(timestamp: string): string {
    const now = new Date();
    const timestampStr = timestamp.trim();
    let time: Date;
    if (timestampStr.includes('T') && !timestampStr.endsWith('Z') && !timestampStr.match(/[+-]\d{2}:\d{2}$/)) {
      time = new Date(timestampStr + 'Z');
    } else {
      time = new Date(timestampStr);
    }
    const diffMs = now.getTime() - time.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    const formatted = this.timeZoneService.formatDate(time.toISOString(), 'MMM d, y');
    return formatted || time.toLocaleDateString();
  }

  formatTimestamp(timestamp: string): string {
    return this.timeZoneService.formatDateTimeUTCToEastern(timestamp);
  }

  formatDetails(details: string | undefined): string {
    if (!details) return '';
    try {
      const parsed = JSON.parse(details);
      return this.formatJsonForDisplay(parsed);
    } catch {
      return details;
    }
  }

  formatJsonForDisplay(obj: any, indent: number = 0): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number') return obj.toString();
    if (typeof obj === 'boolean') return obj.toString();
    if (Array.isArray(obj)) {
      return obj.map(item => this.formatJsonForDisplay(item, indent + 1)).join(', ');
    }
    if (typeof obj === 'object') {
      const entries = Object.entries(obj).filter(([key]) => !this.isDateKey(key));
      if (entries.length === 0) return '';
      if (entries.length === 1) {
        const [key, value] = entries[0];
        if (value && typeof value === 'object' && ('Old' in value || 'New' in value)) {
          const changeObj = value as any;
          const oldVal = changeObj['Old'] ?? changeObj['old'] ?? 'N/A';
          const newVal = changeObj['New'] ?? changeObj['new'] ?? 'N/A';
          return `${key}: ${this.formatValue(oldVal, key)} → ${this.formatValue(newVal, key)}`;
        }
      }
      return entries.map(([key, value]) => {
        const formattedValue = this.formatJsonForDisplay(value, indent + 1);
        return `${key}: ${formattedValue}`;
      }).join(', ');
    }
    return String(obj);
  }

  private readonly COUNT_KEYS = ['RecordsFailed', 'RecordsProcessed', 'RecordCount', 'RecordsSuccess', 'Count', 'Total'];
  private readonly DATE_KEYS = ['CreatedAt', 'UpdatedAt', 'CompletedAt', 'DeletedAt', 'Timestamp', 'LastModified', 'ModifiedAt'];

  formatValue(value: any, key?: string): string {
    if (value === null || value === undefined) return 'N/A';
    const isCountField = key && this.COUNT_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()));
    if (isCountField) return String(value);
    if (typeof value === 'string') {
      const formatted = this.tryFormatDateAsET(value);
      if (formatted !== null) return formatted;
      return value;
    }
    if (typeof value === 'number') {
      const isMsTimestamp = value >= 1e12 && value <= 2e15;
      const isSecTimestamp = value >= 1e9 && value < 1e12;
      if (isMsTimestamp || isSecTimestamp) {
        const date = new Date(isSecTimestamp ? value * 1000 : value);
        if (!isNaN(date.getTime())) {
          return this.timeZoneService.formatDateTimeUTCToEastern(date.toISOString());
        }
      }
      return String(value);
    }
    return String(value);
  }

  private tryFormatDateAsET(s: string): string | null {
    if (!s || typeof s !== 'string') return null;
    const trimmed = s.trim();
    if (/^\d+$/.test(trimmed) && trimmed.length < 10) return null;
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    if (year < 1970 || year > 2100) return null;
    return this.timeZoneService.formatDateTimeUTCToEastern(trimmed.includes('T') ? trimmed : date.toISOString());
  }

  hasReadableDetails(details: string | undefined): boolean {
    if (!details) return false;
    try {
      const parsed = JSON.parse(details);
      return typeof parsed === 'object';
    } catch {
      return false;
    }
  }

  getFormattedDetails(details: string | undefined): Array<{ key: string; value: string; isChange: boolean; oldValue?: string; newValue?: string }> {
    if (!details) return [];
    try {
      const parsed = JSON.parse(details);
      const items = this.parseDetailsToItems(parsed);
      return items.filter(item => !this.isDateKey(item.key));
    } catch {
      return [{ key: 'Raw Data', value: details, isChange: false }];
    }
  }

  private isDateKey(key: string): boolean {
    const keyLower = key.toLowerCase();
    const baseKey = key.split('.').pop() || key;
    const baseKeyLower = baseKey.toLowerCase();
    return this.DATE_KEYS.some(dk => baseKeyLower.includes(dk.toLowerCase()) || keyLower.includes(dk.toLowerCase()));
  }

  parseDetailsToItems(obj: any, prefix: string = ''): Array<{ key: string; value: string; isChange: boolean; oldValue?: string; newValue?: string }> {
    const items: Array<{ key: string; value: string; isChange: boolean; oldValue?: string; newValue?: string }> = [];
    if (obj === null || obj === undefined) {
      return [{ key: prefix || 'Value', value: 'N/A', isChange: false }];
    }
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return [{ key: prefix || 'Value', value: String(obj), isChange: false }];
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        items.push(...this.parseDetailsToItems(item, `${prefix}[${index}]`));
      });
      return items;
    }
    if (typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value && typeof value === 'object' && ('Old' in value || 'New' in value)) {
          const changeObj = value as any;
          const oldVal = changeObj['Old'] ?? changeObj['old'] ?? null;
          const newVal = changeObj['New'] ?? changeObj['new'] ?? null;
          const oldFormatted = this.formatValue(oldVal, fullKey);
          const newFormatted = this.formatValue(newVal, fullKey);
          items.push({
            key: fullKey,
            value: `${oldFormatted} → ${newFormatted}`,
            isChange: true,
            oldValue: oldFormatted,
            newValue: newFormatted
          });
        } else {
          items.push(...this.parseDetailsToItems(value, fullKey));
        }
      });
    }
    return items;
  }
}

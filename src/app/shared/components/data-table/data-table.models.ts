import { TemplateRef } from '@angular/core';
import { Observable } from 'rxjs';
import { PagedResult } from '../../../core/models/load.model';

// Column action button
export interface ColumnAction<T = any> {
  label?: string;
  icon: string;
  action: (row: T) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info' | 'outline-primary' | 'outline-secondary' | 'outline-danger' | 'outline-success' | 'outline-warning' | 'outline-info';
  title?: string;
  disabled?: (row: T) => boolean;
}

// Column definition
export interface TableColumn<T = any> {
  key: string;
  label: string;
  type?: 'text' | 'badge' | 'checkbox' | 'toggle' | 'actions' | 'custom' | 'template';
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'date' | 'number';
  filterOptions?: any[]; // For select filters - array of { value: any, label: string }
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => any; // Custom renderer function
  badgeClass?: (row: T) => string; // For badge type columns
  hidden?: boolean;
  sticky?: boolean; // For sticky columns (e.g., first column or actions)
  actions?: ColumnAction<T>[]; // Action buttons for actions type columns
  cellTemplate?: TemplateRef<{ $implicit: T; row?: T; column?: TableColumn<T> }>; // Custom template for complex cell rendering
}

// Table configuration
export interface TableConfig<T = any> {
  columns: TableColumn<T>[];
  enableSelection?: boolean;
  enableBulkActions?: boolean;
  bulkActions?: BulkAction<T>[];
  enableGlobalSearch?: boolean;
  enablePagination?: boolean;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  rowClickable?: boolean;
  rowClass?: (row: T) => string | string[]; // Custom row classes
}

// Bulk action
export interface BulkAction<T = any> {
  label: string;
  icon?: string;
  action: (selectedRows: T[]) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info';
  disabled?: (selectedRows: T[]) => boolean;
  confirmMessage?: string; // Optional confirmation message
}

// Filter state
export interface FilterState {
  globalSearch?: string;
  columnFilters?: { [key: string]: any };
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  pageNumber: number;
  pageSize: number;
}

// Data source function type
export type DataSourceFunction<T = any> = (filters: FilterState) => Observable<PagedResult<T>>;

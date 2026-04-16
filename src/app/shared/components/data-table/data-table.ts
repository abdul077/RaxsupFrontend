import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { PaginationComponent } from '../pagination/pagination';
import { TableConfig, TableColumn, FilterState, BulkAction, DataSourceFunction } from './data-table.models';
import { PagedResult } from '../../../core/models/load.model';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTableComponent<T = any> implements OnInit, OnChanges, OnDestroy {
  @Input() config!: TableConfig<T>;
  @Input() dataSource!: DataSourceFunction<T>;
  @Input() loading: boolean = false;
  @Input() suppressLoadingState: boolean = false;
  @Input() emptyMessage: string = 'No data found';
  @Input() refreshTrigger: any; // When this changes, refresh the table

  @Output() rowClick = new EventEmitter<T>();
  @Output() selectionChange = new EventEmitter<T[]>();
  @Output() filterChange = new EventEmitter<FilterState>();
  @Output() dataLoaded = new EventEmitter<PagedResult<T>>();

  data: T[] = [];
  totalCount: number = 0;
  totalPages: number = 1;
  selectedRows: Set<T> = new Set();
  isAllSelected: boolean = false;

  // Filter state
  filterState: FilterState = {
    pageNumber: 1,
    pageSize: 50,
  };

  // Column filter values
  columnFilterValues: { [key: string]: any } = {};
  globalSearchTerm: string = '';

  // Sort state
  currentSortColumn?: string;
  currentSortDirection: 'asc' | 'desc' = 'asc';

  // Debounced search
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Initialize filter state from config
    if (this.config?.defaultPageSize) {
      this.filterState.pageSize = this.config.defaultPageSize;
    }

    // Setup debounced search
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((searchTerm) => {
        this.filterState.globalSearch = searchTerm || undefined;
        this.applyFilters();
      });

    // Load initial data
    if (this.config && typeof this.dataSource === 'function') {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['dataSource']) {
      if (this.config && typeof this.dataSource === 'function') {
        this.loadData();
      }
    }
    if (changes['refreshTrigger'] && this.config && typeof this.dataSource === 'function') {
      // Reset to first page when external refresh (e.g. status filter tab change) so we don't stay on page 3 with fewer results
      this.filterState.pageNumber = 1;
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    if (!this.dataSource || !this.config) return;

    this.loading = true;
    this.dataSource(this.filterState).subscribe({
      next: (result: PagedResult<T>) => {
        this.data = result.items || [];
        this.totalCount = result.totalCount || 0;
        this.totalPages = result.totalPages || Math.max(1, Math.ceil(this.totalCount / this.filterState.pageSize));
        this.loading = false;
        this.updateSelectAllState();
        this.dataLoaded.emit(result);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading table data:', error);
        this.data = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.loading = false;
        this.dataLoaded.emit({ items: [], totalCount: 0, pageNumber: 1, pageSize: this.filterState.pageSize, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
        this.cdr.detectChanges();
      },
    });
  }

  applyFilters(): void {
    // Update filter state with column filters
    this.filterState.columnFilters = {};
    Object.keys(this.columnFilterValues).forEach((key) => {
      const value = this.columnFilterValues[key];
      if (value !== null && value !== undefined && value !== '') {
        this.filterState.columnFilters![key] = value;
      }
    });

    // Reset to first page when filters change
    this.filterState.pageNumber = 1;
    this.filterState.sortColumn = this.currentSortColumn;
    this.filterState.sortDirection = this.currentSortDirection;

    this.filterChange.emit({ ...this.filterState });
    this.loadData();
  }

  onGlobalSearchChange(value: string): void {
    this.globalSearchTerm = value;
    this.searchSubject.next(value);
  }

  onColumnFilterChange(key: string, value: any): void {
    this.columnFilterValues[key] = value;
    this.applyFilters();
  }

  clearFilters(): void {
    this.globalSearchTerm = '';
    this.columnFilterValues = {};
    this.filterState.globalSearch = undefined;
    this.filterState.columnFilters = {};
    this.currentSortColumn = undefined;
    this.currentSortDirection = 'asc';
    this.applyFilters();
  }

  onSort(column: TableColumn<T>): void {
    if (!column.sortable) return;

    if (this.currentSortColumn === column.key) {
      // Toggle direction
      if (this.currentSortDirection === 'asc') {
        this.currentSortDirection = 'desc';
      } else {
        // Reset to unsorted
        this.currentSortColumn = undefined;
        this.currentSortDirection = 'asc';
      }
    } else {
      this.currentSortColumn = column.key;
      this.currentSortDirection = 'asc';
    }

    this.applyFilters();
  }

  getSortIcon(column: TableColumn<T>): string {
    if (!column.sortable || this.currentSortColumn !== column.key) {
      return 'fa-sort';
    }
    return this.currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.selectedRows.clear();
    } else {
      this.data.forEach((row) => this.selectedRows.add(row));
    }
    this.updateSelectAllState();
    this.emitSelectionChange();
  }

  toggleRowSelection(row: T): void {
    if (this.selectedRows.has(row)) {
      this.selectedRows.delete(row);
    } else {
      this.selectedRows.add(row);
    }
    this.updateSelectAllState();
    this.emitSelectionChange();
  }

  isRowSelected(row: T): boolean {
    return this.selectedRows.has(row);
  }

  private updateSelectAllState(): void {
    if (this.data.length === 0) {
      this.isAllSelected = false;
      return;
    }
    this.isAllSelected = this.data.every((row) => this.selectedRows.has(row));
  }

  private emitSelectionChange(): void {
    this.selectionChange.emit(Array.from(this.selectedRows));
  }

  onPageChange(page: number): void {
    this.filterState.pageNumber = page;
    this.loadData();
  }

  onPageSizeChange(size: number): void {
    this.filterState.pageSize = size;
    this.filterState.pageNumber = 1;
    this.loadData();
  }

  onRowClick(row: T, event?: MouseEvent): void {
    if (this.config?.rowClickable === false) {
      return;
    }

    const target = event?.target as HTMLElement | null;
    if (target) {
      // If user clicked an interactive control inside the row, don't treat it as a row click.
      // This avoids swallowing clicks on dropdowns, links, and buttons.
      const interactiveSelector =
        'a,button,input,select,textarea,label,[role="button"],.dropdown,.dropdown-menu,.dropdown-item';
      if (target.closest(interactiveSelector)) {
        return;
      }
    }

    this.rowClick.emit(row);
  }

  onActionClick(action: any, row: T): void {
    if (action && action.action) {
      action.action(row);
    }
  }

  getActionIconClass(action: any, row: T): string {
    // Handle dynamic toggle icon
    if (action.icon === 'fa-toggle-off') {
      const isActive = (row as any)?.isActive;
      return isActive ? 'fa-toggle-on' : 'fa-toggle-off';
    }
    return '';
  }

  onBulkAction(action: BulkAction<T>): void {
    const selected = Array.from(this.selectedRows);
    if (selected.length === 0) return;

    if (action.confirmMessage) {
      if (!confirm(action.confirmMessage)) {
        return;
      }
    }

    action.action(selected);
  }

  isBulkActionDisabled(action: BulkAction<T>): boolean {
    if (this.selectedRows.size === 0) return true;
    if (action.disabled) {
      return action.disabled(Array.from(this.selectedRows));
    }
    return false;
  }

  getVisibleColumns(): TableColumn<T>[] {
    return this.config?.columns?.filter((col) => !col.hidden) || [];
  }

  getFilterableColumns(): TableColumn<T>[] {
    return this.getVisibleColumns().filter((col) => col.filterable);
  }

  getCellValue(row: T, column: TableColumn<T>): any {
    if (column.render) {
      return column.render(row);
    }

    // Access nested properties using dot notation
    const keys = column.key.split('.');
    let value: any = row;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined || value === null) break;
    }
    return value;
  }

  getBadgeClass(row: T, column: TableColumn<T>): string {
    if (column.badgeClass) {
      return column.badgeClass(row);
    }
    return 'badge badge-info';
  }

  getRowClass(row: T): string {
    if (this.config?.rowClass) {
      const classes = this.config.rowClass(row);
      return Array.isArray(classes) ? classes.join(' ') : classes;
    }
    return '';
  }

  trackByFn(index: number, item: T): any {
    // Try to find an id property, otherwise use index
    return (item as any)?.id ?? (item as any)?.logId ?? (item as any)?.customerId ?? (item as any)?.userId ?? (item as any)?.driverId ?? (item as any)?.equipmentId ?? index;
  }

  hasActiveFilters(): boolean {
    return !!(
      this.globalSearchTerm ||
      Object.keys(this.columnFilterValues).length > 0
    );
  }
}

import { Component, OnInit, OnDestroy, ViewChild, TemplateRef, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';
import { LoadService } from '../../../core/services/load.service';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { Load, LoadDetail, LoadAssignment, PagedResult } from '../../../core/models/load.model';
import { Customer } from '../../../core/models/customer.model';
import { Driver } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/driver.service';
import { Equipment } from '../../../core/models/equipment.model';
import { EquipmentService } from '../../../core/services/equipment.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, FilterState } from '../../../shared/components/data-table/data-table.models';

export interface TodayKpis {
  totalLoads: number;
  inTransit: number;
  late: number;
  delivered: number;
  revenueToday: number;
}

interface FilterChip {
  key: keyof LoadListAdvancedFilters | 'status' | 'datePreset';
  label: string;
}

interface ColumnOption {
  key: string;
  label: string;
  required?: boolean;
}

type DatePresetOption =
  | 'All'
  | 'Today'
  | 'Yesterday'
  | 'This Week'
  | 'Last Week'
  | 'This Month'
  | 'Last Month';

type FilterSectionKey = 'assignment' | 'dateSchedule' | 'rateFlags';

interface LoadListAdvancedFilters {
  customerId?: number;
  driverId?: number;
  equipmentId?: number;
  createdFrom?: string;
  createdTo?: string;
  pickupFrom?: string;
  pickupTo?: string;
  deliveryFrom?: string;
  deliveryTo?: string;
  minRate?: number;
  maxRate?: number;
  loadType?: string;
  isOverdue?: boolean;
  isUnassigned?: boolean;
  isHighValue?: boolean;
  highValueThreshold?: number;
}

@Component({
  selector: 'app-load-list',
  imports: [CommonModule, FormsModule, RouterModule, DataTableComponent],
  providers: [DatePipe],
  templateUrl: './load-list.html',
  styleUrl: './load-list.scss',
})
export class LoadListComponent implements OnInit, OnDestroy {
  customers: Customer[] = [];
  drivers: Driver[] = [];
  equipments: Equipment[] = [];
  showCreateModal = false;
  showEditModal = false;
  showStatusModal = false;
  selectedLoad: Load | null = null;
  
  statusFilter: string = '';
  assignedByUserIdFilter?: number;
  showAdvancedFilters = false;
  statusCounts: Record<string, number> = {};
  advancedFilters: LoadListAdvancedFilters = {
    highValueThreshold: 5000
  };
  
  // Today KPIs - derived from table data (no separate dashboard API)
  todayKpis: TodayKpis | null = null;
  
  // Load details drawer (right-side)
  drawerOpen = false;
  drawerLoad: LoadDetail | null = null;
  drawerLoading = false;
  drawerTab: 'overview' | 'stops' | 'driver' | 'documents' | 'timeline' | 'notes' = 'overview';
  
  // Table
  tableConfig!: TableConfig<Load>;
  tableRefreshTrigger = 0;
  showColumnMenu = false;
  columnOptions: ColumnOption[] = [];
  @ViewChild('loadActionsCell', { static: true }) loadActionsCell!: TemplateRef<{ $implicit: Load }>;
  @ViewChild('smartRouteCell', { static: true }) smartRouteCell!: TemplateRef<{ $implicit: Load }>;
  @ViewChild('driverEquipmentCell', { static: true }) driverEquipmentCell!: TemplateRef<{ $implicit: Load }>;
  @ViewChild('pickupDeliveryCell', { static: true }) pickupDeliveryCell!: TemplateRef<{ $implicit: Load }>;
  @ViewChild('routePickupDeliveryCell', { static: true }) routePickupDeliveryCell!: TemplateRef<{ $implicit: Load }>;
  @ViewChild('pickupCell', { static: true }) pickupCell!: TemplateRef<{ $implicit: Load }>;
  @ViewChild('dropoffCell', { static: true }) dropoffCell!: TemplateRef<{ $implicit: Load }>;

  // Form data
  formData: any = {
    loadNumber: '',
    customerId: null,
    origin: '',
    destination: '',
    pickupDateTime: '',
    deliveryDateTime: '',
    totalRate: null,
    currency: 'USD',
    notes: '',
    deadheadOrigin: '',
    deadheadDestination: '',
    deadheadAmount: null as number | null
  };

  statusOptions = [
    'Created',
    'Assigned',
    'PickedUp',
    'InTransit',
    'Delivered',
    'Completed',
    'Settled',
    'Cancelled'
  ];
  loadTypeOptions = [
    'DRY VAN',
    'REEFER',
    'FLAT BED',
    'LTL',
    'HOTSHOT',
    'INTERMODAL'
  ];
  datePresetOptions: DatePresetOption[] = [
    'All',
    'Today',
    'Yesterday',
    'This Week',
    'Last Week',
    'This Month',
    'Last Month'
  ];
  selectedDatePreset: DatePresetOption = 'All';
  filterSectionOpen: Record<FilterSectionKey, boolean> = {
    assignment: true,
    dateSchedule: true,
    rateFlags: true
  };
  /** Status options for manual update; excludes Assigned (set automatically when driver is assigned). */
  get statusOptionsForUpdate(): string[] {
    if (!this.selectedLoad) {
      return [];
    }

    return this.getAvailableStatusTransitions(this.selectedLoad);
  }
  newStatus: string = '';

  constructor(
    private loadService: LoadService,
    private apiService: ApiService,
    private driverService: DriverService,
    private equipmentService: EquipmentService,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
    private datePipe: DatePipe,
    private timeZoneService: TimeZoneService
  ) {}

  ngOnInit(): void {
    this.applyRouteFilters();
    if (!this.authService.hasRole('Driver')) {
      this.loadCustomers();
      this.loadDrivers();
      this.loadEquipments();
    }
    this.initializeTableConfig();
  }

  private applyRouteFilters(): void {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status');
    const assignedByUserId = params.get('assignedByUserId');

    if (status) {
      this.statusFilter = status;
    }

    if (assignedByUserId) {
      const parsed = Number(assignedByUserId);
      this.assignedByUserIdFilter = Number.isFinite(parsed) ? parsed : undefined;
    }

    this.advancedFilters = {
      customerId: this.parseOptionalNumber(params.get('customerId')),
      driverId: this.parseOptionalNumber(params.get('driverId')),
      equipmentId: this.parseOptionalNumber(params.get('equipmentId')),
      createdFrom: params.get('createdFrom') || undefined,
      createdTo: params.get('createdTo') || undefined,
      pickupFrom: params.get('pickupFrom') || undefined,
      pickupTo: params.get('pickupTo') || undefined,
      deliveryFrom: params.get('deliveryFrom') || undefined,
      deliveryTo: params.get('deliveryTo') || undefined,
      minRate: this.parseOptionalNumber(params.get('minRate')),
      maxRate: this.parseOptionalNumber(params.get('maxRate')),
      loadType: params.get('loadType') || undefined,
      isOverdue: this.parseOptionalBoolean(params.get('isOverdue')),
      isUnassigned: this.parseOptionalBoolean(params.get('isUnassigned')),
      isHighValue: this.parseOptionalBoolean(params.get('isHighValue')),
      highValueThreshold: this.parseOptionalNumber(params.get('highValueThreshold')) ?? 5000
    };
    const preset = params.get('datePreset') as DatePresetOption | null;
    this.selectedDatePreset = preset && this.datePresetOptions.includes(preset) ? preset : 'All';
  }

  ngOnDestroy(): void {
    // cleanup if needed
  }

  /** Compute KPI cards from the table's loaded data (no separate dashboard API). */
  onTableDataLoaded(result: PagedResult<Load>): void {
    this.statusCounts = this.buildStatusCounts(result.items || []);
    if (this.authService.hasRole('Driver')) return;
    const items = result.items || [];
    const totalCount = result.totalCount ?? 0;
    const inTransit = items.filter((l) =>
      l.status === 'Dispatched' || l.status === 'PickedUp' || l.status === 'InTransit'
    ).length;
    const late = items.filter((l) => this.isOverdueLoad(l)).length;
    const delivered = items.filter((l) => l.status === 'Delivered').length;
    const revenueToday = items
      .filter((l) =>
        (l.status === 'Delivered' || l.status === 'Completed') && this.isDeliveryToday(l)
      )
      .reduce((sum, l) => sum + (l.totalRate || 0), 0);
    this.todayKpis = {
      totalLoads: totalCount,
      inTransit,
      late,
      delivered,
      revenueToday
    };
  }

  private isDeliveryToday(load: Load): boolean {
    if (!load.deliveryDateTime) return false;
    const d = new Date(load.deliveryDateTime);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  loadCustomers(): void {
    this.apiService.get<Customer[]>('customers').subscribe({
      next: (data) => {
        this.customers = data;
      },
      error: () => {
        this.customers = [];
      }
    });
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        this.drivers = result.items || [];
      },
      error: () => {
        this.drivers = [];
      }
    });
  }

  loadEquipments(): void {
    this.equipmentService.getEquipments().subscribe({
      next: (data) => {
        this.equipments = data || [];
      },
      error: () => {
        this.equipments = [];
      }
    });
  }

  onDriverFilterChange(): void {
    const selectedEquipmentId = this.advancedFilters.equipmentId;
    if (!selectedEquipmentId) return;
    const isStillVisible = this.getVisibleEquipments().some((equipment) => equipment.equipmentId === selectedEquipmentId);
    if (!isStillVisible) {
      this.advancedFilters.equipmentId = undefined;
    }
  }

  getVisibleEquipments(): Equipment[] {
    const driverId = this.advancedFilters.driverId;
    if (!driverId) {
      return this.equipments;
    }
    return this.equipments.filter((equipment) => equipment.assignedToDriverId === driverId);
  }

  getEquipmentLabelWithId(equipment: Equipment): string {
    const plate = equipment.plateNumber?.trim();
    const type = this.toTitleCase(equipment.equipmentType?.trim());
    if (plate && type) {
      return `${plate} - ${type}`;
    }
    if (plate) {
      return plate;
    }
    if (type) {
      return type;
    }
    return 'Vehicle';
  }

  private toTitleCase(value?: string): string | undefined {
    if (!value) return undefined;
    return value
      .toLowerCase()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  initializeTableConfig(): void {
    this.tableConfig = {
      columns: [
        {
          key: 'loadNumber',
          label: 'Load #',
          type: 'custom',
          sortable: true,
          width: '120px',
          render: (row) => row.loadNumber
        },
        {
          key: 'pickup',
          label: 'Pickup',
          type: 'template',
          cellTemplate: this.pickupCell,
          sortable: true,
          width: '230px',
          render: (row) => row.pickupDateTime || ''
        },
        {
          key: 'dropoff',
          label: 'Dropoff',
          type: 'template',
          cellTemplate: this.dropoffCell,
          sortable: true,
          width: '230px',
          render: (row) => row.deliveryDateTime || ''
        },
        {
          key: 'distanceKm',
          label: 'Distance',
          type: 'custom',
          sortable: true,
          width: '120px',
          align: 'right',
          render: (row) => this.formatDistanceKm(row.distanceKm)
        },
        {
          key: 'driverEquipment',
          label: 'Driver & Equipment',
          type: 'template',
          cellTemplate: this.driverEquipmentCell,
          sortable: true,
          width: '220px',
          render: (row) => row.ownerOperatorName || row.driverName || '-'
        },
        {
          key: 'totalRate',
          label: 'Rate',
          type: 'custom',
          sortable: true,
          align: 'right',
          width: '120px',
          render: (row) => this.formatCurrency(row.totalRate, row.currency)
        },
        {
          key: 'loadType',
          label: 'Load Type',
          type: 'badge',
          sortable: true,
          render: (row) => row.loadType || '-',
          badgeClass: () => 'badge bg-secondary'
        },
        {
          key: 'status',
          label: 'Status',
          type: 'badge',
          sortable: true,
          badgeClass: (row) => 'badge ' + this.getStatusBadgeClass(row.status),
          render: (row) => this.getStatusDisplayLabel(row.status)
        },
        {
          key: 'actions',
          label: 'Actions',
          type: 'template',
          cellTemplate: this.loadActionsCell,
          width: '72px',
          align: 'right',
          sticky: true
        }
      ],
      enableSelection: false,
      enableGlobalSearch: true,
      enablePagination: true,
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
      emptyMessage: 'No loads found. Try adjusting your filters or create a new load.',
      rowClickable: true,
    };
    this.columnOptions = [
      { key: 'loadNumber', label: 'Load #', required: true },
      { key: 'pickup', label: 'Pickup' },
      { key: 'dropoff', label: 'Dropoff' },
      { key: 'distanceKm', label: 'Distance' },
      { key: 'driverEquipment', label: 'Driver & Equipment' },
      { key: 'totalRate', label: 'Rate' },
      { key: 'loadType', label: 'Load Type' },
      { key: 'status', label: 'Status' },
      { key: 'actions', label: 'Actions', required: true }
    ];
  }

  toggleColumnMenu(): void {
    this.showColumnMenu = !this.showColumnMenu;
  }

  isColumnVisible(columnKey: string): boolean {
    const column = this.tableConfig.columns.find((col) => col.key === columnKey);
    return !!column && !column.hidden;
  }

  toggleColumnVisibility(columnKey: string): void {
    const option = this.columnOptions.find((o) => o.key === columnKey);
    if (option?.required) return;
    const column = this.tableConfig.columns.find((col) => col.key === columnKey);
    if (!column) return;
    column.hidden = !column.hidden;
    this.tableConfig = {
      ...this.tableConfig,
      columns: [...this.tableConfig.columns]
    };
  }

  dataSource = (filters: FilterState): Observable<PagedResult<Load>> => {
    const pageNumber = filters.pageNumber || 1;
    const pageSize = filters.pageSize || 20;
    const search = filters.globalSearch?.trim() || undefined;

    if (this.authService.hasRole('Driver')) {
      const params: any = { pageNumber, pageSize };
      if (this.statusFilter) params.status = this.statusFilter;
      if (search) params.searchTerm = search;

      return this.apiService.get<{ items: Load[]; totalCount: number; totalPages?: number }>('loads/my-loads', params).pipe(
        map((data) => {
          const totalPages = data.totalPages ?? Math.ceil((data.totalCount || 0) / pageSize);
          return {
            items: data.items || [],
            totalCount: data.totalCount || 0,
            pageNumber,
            pageSize,
            totalPages,
            hasPreviousPage: pageNumber > 1,
            hasNextPage: pageNumber < totalPages
          };
        })
      );
    }

    return this.loadService.getLoads(
      this.statusFilter || undefined,
      this.advancedFilters.customerId,
      search,
      pageNumber,
      pageSize,
      this.assignedByUserIdFilter,
      this.advancedFilters
    ).pipe(
      map((data) => ({
        ...data,
        hasPreviousPage: data.pageNumber > 1,
        hasNextPage: data.pageNumber < (data.totalPages || 1)
      }))
    );
  };

  selectStatusTab(status: string): void {
    this.statusFilter = status;
    this.syncFiltersToRoute();
    this.tableRefreshTrigger++;
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  toggleFilterSection(section: FilterSectionKey): void {
    this.filterSectionOpen[section] = !this.filterSectionOpen[section];
  }

  applyAdvancedFilters(): void {
    if (this.advancedFilters.minRate != null && this.advancedFilters.maxRate != null) {
      if (this.advancedFilters.minRate > this.advancedFilters.maxRate) {
        const swap = this.advancedFilters.minRate;
        this.advancedFilters.minRate = this.advancedFilters.maxRate;
        this.advancedFilters.maxRate = swap;
      }
    }

    this.syncFiltersToRoute();
    this.tableRefreshTrigger++;
  }

  clearAdvancedFilters(): void {
    this.advancedFilters = { highValueThreshold: 5000 };
    this.selectedDatePreset = 'All';
    this.syncFiltersToRoute();
    this.tableRefreshTrigger++;
  }

  onDatePresetChange(): void {
    const range = this.getDateRangeFromPreset(this.selectedDatePreset);
    if (!range) {
      this.advancedFilters.createdFrom = undefined;
      this.advancedFilters.createdTo = undefined;
      return;
    }
    this.advancedFilters.createdFrom = range.from;
    this.advancedFilters.createdTo = range.to;
  }

  resetAllFilters(): void {
    this.statusFilter = '';
    this.clearAdvancedFilters();
  }

  hasActiveAdvancedFilters(): boolean {
    return this.getActiveFilterChips().length > 0;
  }

  getActiveFilterChips(): FilterChip[] {
    const chips: FilterChip[] = [];

    if (this.statusFilter) {
      chips.push({ key: 'status', label: `Status: ${this.getStatusDisplayLabel(this.statusFilter)}` });
    }
    if (this.selectedDatePreset !== 'All') {
      chips.push({ key: 'datePreset', label: `Date preset: ${this.selectedDatePreset}` });
    }
    if (this.advancedFilters.customerId) chips.push({ key: 'customerId', label: `Broker: BR${this.advancedFilters.customerId}` });
    if (this.advancedFilters.driverId) chips.push({ key: 'driverId', label: `Driver: ${this.getDriverLabelWithId(this.advancedFilters.driverId)}` });
    if (this.advancedFilters.equipmentId) {
      const selectedEquipment = this.equipments.find((equipment) => equipment.equipmentId === this.advancedFilters.equipmentId);
      chips.push({
        key: 'equipmentId',
        label: selectedEquipment
          ? `Vehicle: ${this.getEquipmentLabelWithId(selectedEquipment)}`
          : 'Vehicle selected'
      });
    }
    if (this.advancedFilters.pickupFrom) chips.push({ key: 'pickupFrom', label: `Pickup from: ${this.advancedFilters.pickupFrom}` });
    if (this.advancedFilters.pickupTo) chips.push({ key: 'pickupTo', label: `Pickup to: ${this.advancedFilters.pickupTo}` });
    if (this.advancedFilters.deliveryFrom) chips.push({ key: 'deliveryFrom', label: `Delivery from: ${this.advancedFilters.deliveryFrom}` });
    if (this.advancedFilters.deliveryTo) chips.push({ key: 'deliveryTo', label: `Delivery to: ${this.advancedFilters.deliveryTo}` });
    if (this.advancedFilters.minRate != null) chips.push({ key: 'minRate', label: `Min rate: ${this.formatCurrency(this.advancedFilters.minRate)}` });
    if (this.advancedFilters.maxRate != null) chips.push({ key: 'maxRate', label: `Max rate: ${this.formatCurrency(this.advancedFilters.maxRate)}` });
    if (this.advancedFilters.loadType) chips.push({ key: 'loadType', label: `Load type: ${this.advancedFilters.loadType}` });
    if (this.advancedFilters.isOverdue != null) chips.push({ key: 'isOverdue', label: `Overdue: ${this.advancedFilters.isOverdue ? 'Yes' : 'No'}` });
    if (this.advancedFilters.isUnassigned != null) chips.push({ key: 'isUnassigned', label: `Unassigned: ${this.advancedFilters.isUnassigned ? 'Yes' : 'No'}` });
    if (this.advancedFilters.isHighValue != null) chips.push({ key: 'isHighValue', label: `High value: ${this.advancedFilters.isHighValue ? 'Yes' : 'No'}` });

    return chips;
  }

  removeFilterChip(chip: FilterChip): void {
    if (chip.key === 'status') {
      this.statusFilter = '';
    } else if (chip.key === 'datePreset') {
      this.selectedDatePreset = 'All';
      this.advancedFilters.createdFrom = undefined;
      this.advancedFilters.createdTo = undefined;
    } else if (chip.key === 'highValueThreshold') {
      this.advancedFilters.highValueThreshold = 5000;
    } else {
      delete this.advancedFilters[chip.key];
    }
    this.syncFiltersToRoute();
    this.tableRefreshTrigger++;
  }

  getStatusCount(status: string): number {
    return this.statusCounts[status] ?? 0;
  }

  getDriverLabelWithId(driverId: number | undefined): string {
    if (!driverId) return '';
    const driver = this.drivers.find((d) => d.driverId === driverId);
    if (!driver) {
      return `RO${driverId}`;
    }
    return `${driver.fullName} (RO${driver.driverId})`;
  }

  private buildStatusCounts(items: Load[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const status of this.statusOptions) {
      counts[status] = 0;
    }
    for (const item of items) {
      if (item.status && counts[item.status] != null) {
        counts[item.status]++;
      }
    }
    return counts;
  }

  private syncFiltersToRoute(): void {
    const queryParams: Record<string, unknown> = {
      status: this.statusFilter || null,
      assignedByUserId: this.assignedByUserIdFilter ?? null,
      customerId: this.advancedFilters.customerId ?? null,
      driverId: this.advancedFilters.driverId ?? null,
      equipmentId: this.advancedFilters.equipmentId ?? null,
      createdFrom: this.advancedFilters.createdFrom ?? null,
      createdTo: this.advancedFilters.createdTo ?? null,
      pickupFrom: this.advancedFilters.pickupFrom ?? null,
      pickupTo: this.advancedFilters.pickupTo ?? null,
      deliveryFrom: this.advancedFilters.deliveryFrom ?? null,
      deliveryTo: this.advancedFilters.deliveryTo ?? null,
      minRate: this.advancedFilters.minRate ?? null,
      maxRate: this.advancedFilters.maxRate ?? null,
      loadType: this.advancedFilters.loadType ?? null,
      isOverdue: this.advancedFilters.isOverdue ?? null,
      isUnassigned: this.advancedFilters.isUnassigned ?? null,
      isHighValue: this.advancedFilters.isHighValue ?? null,
      highValueThreshold: this.advancedFilters.highValueThreshold ?? 5000,
      datePreset: this.selectedDatePreset !== 'All' ? this.selectedDatePreset : null
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  private parseOptionalNumber(value: string | null): number | undefined {
    if (value == null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseOptionalBoolean(value: string | null): boolean | undefined {
    if (value == null || value === '') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  private getDateRangeFromPreset(preset: DatePresetOption): { from: string; to: string } | null {
    if (preset === 'All') return null;

    const now = new Date();
    const toDateString = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === 'Today') {
      return { from: toDateString(start), to: toDateString(end) };
    }

    if (preset === 'Yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      return { from: toDateString(start), to: toDateString(end) };
    }

    if (preset === 'This Week' || preset === 'Last Week') {
      const day = start.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + mondayOffset);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);

      if (preset === 'Last Week') {
        start.setDate(start.getDate() - 7);
        end.setDate(end.getDate() - 7);
      }

      return { from: toDateString(start), to: toDateString(end) };
    }

    if (preset === 'This Month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: toDateString(monthStart), to: toDateString(monthEnd) };
    }

    if (preset === 'Last Month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toDateString(monthStart), to: toDateString(monthEnd) };
    }

    return null;
  }

  openCreateModal(): void {
    this.formData = {
      loadNumber: '',
      customerId: null,
      origin: '',
      destination: '',
      pickupDateTime: '',
      deliveryDateTime: '',
      totalRate: null,
      currency: 'USD',
      notes: '',
      deadheadOrigin: '',
      deadheadDestination: '',
      deadheadAmount: null
    };
    this.showCreateModal = true;
  }

  openEditModal(load: Load): void {
    this.selectedLoad = load;
    this.formData = {
      loadNumber: load.loadNumber,
      customerId: load.customerId,
      origin: load.origin,
      destination: load.destination,
      pickupDateTime: load.pickupDateTime ? new Date(load.pickupDateTime).toISOString().slice(0, 16) : '',
      deliveryDateTime: load.deliveryDateTime ? new Date(load.deliveryDateTime).toISOString().slice(0, 16) : '',
      totalRate: load.totalRate,
      currency: load.currency,
      notes: load.notes || '',
      deadheadOrigin: load.deadheadOrigin || '',
      deadheadDestination: load.deadheadDestination || '',
      deadheadAmount: load.deadheadAmount ?? null
    };
    this.showEditModal = true;
  }

  openStatusModal(load: Load): void {
    if (!this.canUpdateLoadStatus()) {
      return;
    }

    this.selectedLoad = load;
    const availableTransitions = this.getAvailableStatusTransitions(load);
    if (!availableTransitions.length) {
      alert('No valid status updates are available for this load.');
      return;
    }

    this.newStatus = availableTransitions[0] ?? '';
    this.showStatusModal = true;
  }

  closeModals(): void {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.showStatusModal = false;
    this.selectedLoad = null;
  }

  createLoad(): void {
    const dhO = (this.formData.deadheadOrigin || '').trim();
    const dhD = (this.formData.deadheadDestination || '').trim();
    const payload = {
      ...this.formData,
      pickupDateTime: this.formData.pickupDateTime || null,
      deliveryDateTime: this.formData.deliveryDateTime || null,
      customerId: this.formData.customerId || null,
      totalRate: this.formData.totalRate || null,
      deadheadOrigin: dhO || undefined,
      deadheadDestination: dhD || undefined,
      deadheadAmount: this.formData.deadheadAmount != null ? this.formData.deadheadAmount : undefined
    };

    this.loadService.createLoad(payload).subscribe({
      next: () => {
        this.closeModals();
        this.tableRefreshTrigger++;
      },
      error: (error) => {
        console.error('Error creating load:', error);
        alert('Failed to create load. Please try again.');
      }
    });
  }

  updateLoad(): void {
    if (!this.selectedLoad) return;

    const dhO = (this.formData.deadheadOrigin || '').trim();
    const dhD = (this.formData.deadheadDestination || '').trim();
    const payload = {
      ...this.formData,
      pickupDateTime: this.formData.pickupDateTime || null,
      deliveryDateTime: this.formData.deliveryDateTime || null,
      customerId: this.formData.customerId || null,
      totalRate: this.formData.totalRate || null,
      // Send strings (including empty) so the API can clear deadhead locations on update.
      deadheadOrigin: dhO,
      deadheadDestination: dhD,
      deadheadAmount: this.formData.deadheadAmount != null ? this.formData.deadheadAmount : undefined
    };

    this.loadService.updateLoad(this.selectedLoad.loadId, payload).subscribe({
      next: () => {
        this.closeModals();
        this.tableRefreshTrigger++;
      },
      error: (error) => {
        console.error('Error updating load:', error);
        alert('Failed to update load. Please try again.');
      }
    });
  }

  updateStatus(): void {
    if (!this.selectedLoad) return;
    if (!this.canUpdateLoadStatus()) return;
    if (!this.newStatus) {
      alert('Please select a valid status.');
      return;
    }

    const allowedTransitions = this.getAvailableStatusTransitions(this.selectedLoad);
    if (!allowedTransitions.includes(this.newStatus)) {
      alert('This status update is not allowed for your role or the load state.');
      return;
    }

    // Assigned is set automatically when a driver is assigned; do not allow manual update
    if (this.newStatus === 'Assigned') {
      alert('Status "Assigned" is set automatically when a driver is assigned to the load.');
      return;
    }

    // Load must be assigned to a driver before it can be marked as Delivered
    if (this.newStatus === 'Delivered') {
      const hasDriver = this.selectedLoad.driverName || this.selectedLoad.ownerOperatorName;
      if (!hasDriver) {
        alert('The load must be assigned to a driver before it can be marked as Delivered.');
        return;
      }
    }

    if (this.newStatus === 'Completed') {
      const hasDriver = this.selectedLoad.driverName || this.selectedLoad.ownerOperatorName;
      if (!hasDriver) {
        alert('The load must be assigned to a driver before it can be marked as Completed.');
        return;
      }
    }

    this.loadService.updateLoadStatus(this.selectedLoad.loadId, this.newStatus).subscribe({
      next: () => {
        this.closeModals();
        this.tableRefreshTrigger++;
      },
      error: (error) => {
        console.error('Error updating status:', error);
        const msg = error?.error?.message || error?.message || 'Failed to update status. Please try again.';
        alert(msg);
      }
    });
  }

  viewLoadDetails(load: Load): void {
    this.openDrawer(load.loadId);
  }

  openDrawer(loadId: number): void {
    this.drawerOpen = true;
    this.drawerTab = 'overview';
    this.drawerLoad = null;
    this.drawerLoading = true;
    this.loadService.getLoadById(loadId).subscribe({
      next: (detail) => {
        this.drawerLoad = detail;
        this.drawerLoading = false;
      },
      error: () => {
        this.drawerLoading = false;
      }
    });
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.drawerLoad = null;
  }

  setDrawerTab(tab: 'overview' | 'stops' | 'driver' | 'documents' | 'timeline' | 'notes'): void {
    this.drawerTab = tab;
  }

  /** Stops to show in drawer: always Origin first, then any API stops, then Destination last. */
  getDrawerStops(): { sequenceNo: number; location: string; stopType: string; plannedDateTime?: string }[] {
    if (!this.drawerLoad) return [];
    const origin: { sequenceNo: number; location: string; stopType: string; plannedDateTime?: string } = {
      sequenceNo: 1,
      location: this.drawerLoad.origin || '—',
      stopType: 'Origin',
      plannedDateTime: this.drawerLoad.pickupDateTime
    };
    const destination: { sequenceNo: number; location: string; stopType: string; plannedDateTime?: string } = {
      sequenceNo: 0, // will set after we know total count
      location: this.drawerLoad.destination || '—',
      stopType: 'Destination',
      plannedDateTime: this.drawerLoad.deliveryDateTime
    };
    const middle = (this.drawerLoad.stops ?? []).map((s, i) => ({
      sequenceNo: i + 2,
      location: s.location,
      stopType: s.stopType,
      plannedDateTime: s.plannedDateTime
    }));
    destination.sequenceNo = middle.length + 2;
    return [origin, ...middle, destination];
  }

  /** True when Stops tab is showing only Origin/Destination (no explicit stops on load). */
  get drawerStopsIsDerived(): boolean {
    return !!this.drawerLoad && !(this.drawerLoad.stops?.length);
  }

  stopSequenceTrackBy(_index: number, stop: { sequenceNo: number }): number {
    return stop.sequenceNo;
  }

  openLoadFullPage(load: Load): void {
    this.router.navigate(['/loads', load.loadId]);
  }

  /** Scroll the actions row into view so the dropdown menu is fully visible. */
  scrollActionsIntoView(event: Event): void {
    const el = event.target as HTMLElement;
    const row = el.closest('tr');
    if (row) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  /**
   * Bootstrap dropdowns won't auto-close if we stop event propagation to prevent row-click.
   * Explicitly hide the dropdown after a menu item is selected.
   */
  closeActionsDropdown(event: Event): void {
    event.stopPropagation();
    const target = event.target as HTMLElement | null;
    const dropdownRoot = target?.closest?.('.dropdown') as HTMLElement | null;
    const toggle = dropdownRoot?.querySelector?.('[data-bs-toggle="dropdown"]') as HTMLElement | null;

    const w = window as any;
    const Dropdown = w?.bootstrap?.Dropdown;
    if (Dropdown && toggle) {
      try {
        Dropdown.getOrCreateInstance(toggle).hide();
        return;
      } catch {
        // fall through to class-based hide
      }
    }

    // Fallback (no bootstrap instance): remove show classes.
    dropdownRoot?.classList?.remove('show');
    const menu = dropdownRoot?.querySelector?.('.dropdown-menu') as HTMLElement | null;
    menu?.classList?.remove('show');
  }

  /** Driver/O-O name for drawer: from load or first assignment. */
  get drawerDriverName(): string {
    if (!this.drawerLoad) return '';
    return this.drawerLoad.ownerOperatorName || this.drawerLoad.driverName ||
      (this.drawerLoad.assignments?.[0]?.driverName ?? '') || '—';
  }

  /** Equipment plate for drawer: from load or first assignment. */
  get drawerEquipmentPlate(): string {
    if (!this.drawerLoad) return '';
    return this.drawerLoad.equipmentPlateNumber ||
      (this.drawerLoad.assignments?.[0]?.equipmentPlateNumber ?? '') || '—';
  }

  /** Equipment ID for drawer: from load or first assignment (for link). */
  get drawerEquipmentId(): number | null {
    if (!this.drawerLoad) return null;
    const id = this.drawerLoad.equipmentId ?? this.drawerLoad.assignments?.[0]?.equipmentId;
    return id != null ? id : null;
  }

  /** First assignment for drawer (Assigned at, ETA, ETD, Status). */
  get drawerFirstAssignment(): LoadAssignment | null {
    return this.drawerLoad?.assignments?.[0] ?? null;
  }

  /** Driver status for display (derived from load status when no dedicated field) */
  getDriverStatusDisplay(load: Load): string {
    if (load.status === 'Dispatched' || load.status === 'PickedUp' || load.status === 'InTransit') return 'Driving';
    if (load.status === 'Assigned') return 'Assigned';
    if (load.status === 'Delivered' || load.status === 'Completed' || load.status === 'Settled') return 'Available';
    return 'Available';
  }

  /** User-facing label for load status (tabs, table, exports use API PascalCase values). */
  getStatusDisplayLabel(status: string | undefined): string {
    if (!status) return '-';
    const map: Record<string, string> = {
      Created: 'Created',
      Assigned: 'Assigned',
      Dispatched: 'En route',
      PickedUp: 'Picked up',
      InTransit: 'In transit',
      Delivered: 'Delivered',
      Completed: 'Completed',
      Settled: 'Settled',
      Cancelled: 'Cancelled'
    };
    return map[status] || status;
  }

  /** Initial for avatar */
  getInitial(name: string | undefined): string {
    if (!name || !name.trim()) return '—';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name[0].toUpperCase();
  }

  /** Table/drawer: show km from API (number or occasional string) without breaking the template. */
  formatDistanceKm(km: number | string | null | undefined): string {
    if (km == null || km === '') return '— km';
    const n = typeof km === 'number' ? km : Number(km);
    if (!Number.isFinite(n)) return '— km';
    return `${Math.round(n)} km`;
  }

  formatCurrencyCompact(amount?: number, currency: string = 'USD'): string {
    if (amount == null) return '—';
    if (amount === 0) return '$0';
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  }

  exportCsv(): void {
    const params: any = { pageNumber: 1, pageSize: 5000 };
    if (this.statusFilter) params.status = this.statusFilter;
    this.loadService.getLoads(
      this.statusFilter || undefined,
      undefined,
      undefined,
      1,
      5000
    ).subscribe({
      next: (res) => {
        const headers = ['Load #', 'Broker', 'Origin', 'Destination', 'Driver', 'Equipment', 'Pickup', 'Delivery', 'Rate', 'Status'];
        const rows = (res.items || []).map((l: Load) => [
          l.loadNumber,
          l.customerName ?? '',
          l.origin ?? '',
          l.destination ?? '',
          (l.ownerOperatorName || l.driverName) ?? '',
          l.equipmentPlateNumber ?? '',
          l.pickupDateTime ? this.formatDate(l.pickupDateTime) : '',
          l.deliveryDateTime ? this.formatDate(l.deliveryDateTime) : '',
          this.formatCurrency(l.totalRate, l.currency),
          this.getStatusDisplayLabel(l.status)
        ]);
        const csv = [headers.join(','), ...rows.map((r: string[]) => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `loads-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    });
  }

  exportPdf(): void {
    const w = window.open('', '_blank');
    if (!w) {
      alert('Please allow popups for this site to export or print the loads list.');
      return;
    }
    w.document.write('<html><head><title>Dispatch</title></head><body>Generating report...</body></html>');
    w.document.close();

    const pageSize = 500;
    const params: Record<string, unknown> = { pageNumber: 1, pageSize };
    if (this.statusFilter) params['status'] = this.statusFilter;
    const logoUrl = window.location.origin + '/assets/logo.png';
    const generatedAt = new Date().toLocaleString();

    const onData = (items: Load[]) => {
      const rows = items.map((l: Load) =>
        `<tr><td>${l.loadNumber}</td><td>${l.customerName ?? ''}</td><td>${l.origin ?? ''} → ${l.destination ?? ''}</td><td>${(l.ownerOperatorName || l.driverName) ?? '-'}</td><td>${l.equipmentPlateNumber ?? '-'}</td><td>${this.formatCurrency(l.totalRate, l.currency)}</td><td><span class="badge badge-${(l.status || '').toLowerCase()}">${this.getStatusDisplayLabel(l.status)}</span></td></tr>`
      ).join('');
      w.document.open();
      w.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Dispatch Report</title>
          <style>
            @page { margin: 1.2cm; }
            * { box-sizing: border-box; }
            body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; line-height: 1.4; color: #1a1a1a; }
            .report-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 16px; margin-bottom: 20px; border-bottom: 2px solid #2563eb; }
            .report-header .logo { height: 44px; width: auto; display: block; }
            .report-title { font-size: 1.75rem; font-weight: 700; color: #1e3a5f; letter-spacing: -0.02em; margin: 0; }
            .report-meta { font-size: 0.8rem; color: #64748b; margin-top: 4px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; }
            th { background: #1e3a5f; color: #fff; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
            tbody tr:nth-child(even) { background: #f8fafc; }
            tbody tr:hover { background: #f1f5f9; }
            td { vertical-align: top; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
            .badge-created { background: #e2e8f0; color: #475569; }
            .badge-assigned { background: #dbeafe; color: #1d4ed8; }
            .badge-dispatched { background: #ccfbf1; color: #0f766e; }
            .badge-pickedup { background: #e0e7ff; color: #4338ca; }
            .badge-intransit { background: #dbeafe; color: #1d4ed8; }
            .badge-delivered { background: #dcfce7; color: #15803d; }
            .badge-completed { background: #a7f3d0; color: #047857; }
            .badge-settled { background: #1e293b; color: #f8fafc; }
            .badge-cancelled { background: #fee2e2; color: #b91c1c; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .report-header { border-bottom-color: #1e3a5f; }
              th { background: #1e3a5f !important; color: #fff !important; }
              tbody tr:nth-child(even) { background: #f8fafc !important; }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <img src="${logoUrl}" alt="RaxUp" class="logo" onerror="this.style.display='none'">
            <div style="text-align: right;">
              <h1 class="report-title">Dispatch</h1>
              <p class="report-meta">Generated ${generatedAt}</p>
            </div>
          </div>
          <table>
            <thead><tr><th>Load #</th><th>Broker</th><th>Route</th><th>Driver</th><th>Equipment</th><th>Rate</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>
      `);
      w.document.close();
      w.print();
      w.close();
    };

    const onError = () => {
      w.document.open();
      w.document.write('<html><head><title>Error</title></head><body>Failed to load data for export.</body></html>');
      w.document.close();
      w.close();
    };

    if (this.authService.hasRole('Driver')) {
      this.apiService.get<{ items: Load[]; totalCount: number }>('loads/my-loads', params).subscribe({
        next: (data) => onData(data.items || []),
        error: onError
      });
    } else {
      this.loadService.getLoads(
        this.statusFilter || undefined,
        undefined,
        undefined,
        1,
        pageSize
      ).subscribe({
        next: (res) => onData(res.items || []),
        error: onError
      });
    }
  }

  getDocumentViewUrl(loadId: number, documentId: number): string {
    return this.loadService.getDocumentViewUrl(loadId, documentId);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.drawerOpen) this.closeDrawer();
    else if (this.showCreateModal || this.showEditModal || this.showStatusModal) this.closeModals();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
    window.alert('Shortcuts:\n• Esc — Close drawer or modal\n• ? — Show this help');
  }

  navigateToCreate(): void {
    this.router.navigate(['/loads/create']);
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Created': 'bg-secondary',
      'Assigned': 'bg-info',
      'Dispatched': 'bg-info',
      'PickedUp': 'bg-primary',
      'InTransit': 'bg-primary',
      'Delivered': 'bg-success',
      'Completed': 'bg-success',
      'Settled': 'bg-dark',
      'Cancelled': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  getStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'Created': 'fa-file-alt',
      'Assigned': 'fa-user-check',
      'Dispatched': 'fa-paper-plane',
      'PickedUp': 'fa-dolly',
      'InTransit': 'fa-truck',
      'Delivered': 'fa-check-circle',
      'Completed': 'fa-flag-checkered',
      'Settled': 'fa-money-check-alt',
      'Cancelled': 'fa-times-circle'
    };
    return iconMap[status] || 'fa-circle';
  }

  formatDate(dateString?: string): string {
    return this.timeZoneService.formatDateTime(dateString);
  }

  formatDateRelative(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return this.formatDate(dateString);
  }

  /** Short label for pickup/delivery: "Today, 8:00 AM" or full date when not today/tomorrow. */
  formatPickupDeliveryDateTime(dateString?: string): string {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const sameDay = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (sameDay) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    return this.formatDate(dateString);
  }

  getDateBadgeClass(dateString?: string, isDelivery: boolean = false): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (isDelivery && diffDays < 0) return 'bg-danger'; // Overdue
    if (diffDays === 0) return 'bg-success'; // Today
    if (diffDays === 1) return 'bg-warning'; // Tomorrow
    if (diffDays > 1 && diffDays <= 3) return 'bg-info'; // Soon
    return '';
  }

  isTerminalStatus(status: string): boolean {
    return ['Delivered', 'Completed', 'Settled', 'Cancelled'].includes(status);
  }

  isUrgentLoad(load: Load): boolean {
    if (!load.pickupDateTime) return false;
    const pickupDate = new Date(load.pickupDateTime);
    const now = new Date();
    const diffHours = (pickupDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24;
  }

  isOverdueLoad(load: Load): boolean {
    if (!load.deliveryDateTime) return false;
    const deliveryDate = new Date(load.deliveryDateTime);
    const now = new Date();
    return (
      deliveryDate < now &&
      load.status !== 'Delivered' &&
      load.status !== 'Completed' &&
      load.status !== 'Settled'
    );
  }

  isHighValueLoad(load: Load, threshold: number = 5000): boolean {
    return (load.totalRate || 0) >= threshold;
  }

  getLoadPriorityClass(load: Load): string {
    if (this.isOverdueLoad(load)) return 'table-danger';
    if (this.isUrgentLoad(load)) return 'table-warning';
    if (this.isHighValueLoad(load)) return 'table-info';
    return '';
  }

  formatCurrency(amount?: number, currency: string = 'USD'): string {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  canCreateLoad(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Dispatcher']);
  }

  canEditLoad(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Dispatcher']);
  }

  canUpdateLoadStatus(): boolean {
    return this.authService.hasRole('Admin');
  }

  private getAvailableStatusTransitions(load: Load): string[] {
    const currentStatus = load.status;
    const isDispatcher = this.authService.hasAnyRole(['Dispatcher']);

    // Dispatchers can only mark a delivered load as completed.
    if (isDispatcher) {
      return currentStatus === 'Delivered' ? ['Completed'] : [];
    }

    const statusFlow: Record<string, string[]> = {
      'Created': [],
      'Assigned': ['PickedUp', 'InTransit'],
      'Dispatched': ['PickedUp', 'InTransit'],
      'PickedUp': ['InTransit'],
      'InTransit': ['Delivered'],
      'Delivered': ['Completed', 'Settled'],
      'Completed': ['Settled'],
      'Settled': [],
      'Cancelled': []
    };

    let allowedTransitions = [...(statusFlow[currentStatus] || [])];

    if (allowedTransitions.includes('Delivered')) {
      if (!this.canMarkAsDelivered(load) || !this.isLoadAssignedToDriver(load)) {
        allowedTransitions = allowedTransitions.filter((status) => status !== 'Delivered');
      }
    }

    if (currentStatus !== 'Cancelled' && currentStatus !== 'Settled') {
      allowedTransitions.push('Cancelled');
    }

    return allowedTransitions;
  }

  private canMarkAsDelivered(load: Load): boolean {
    if (!load.deliveryDateTime) {
      return true;
    }

    return new Date() >= new Date(load.deliveryDateTime);
  }

  private isLoadAssignedToDriver(load: Load): boolean {
    return !!(load.driverName || load.ownerOperatorName);
  }
}

import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { LiveFleetMapComponent } from '../../../shared/components/live-fleet-map/live-fleet-map';
import { ChartConfiguration, ChartData, ChartOptions } from 'chart.js';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';
import { AdminService } from '../../../core/services/admin.service';
import { LoadService } from '../../../core/services/load.service';
import { ComplianceService } from '../../../core/services/compliance.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { Load } from '../../../core/models/load.model';
import { Incident } from '../../../core/models/compliance.model';
import { AuditLog } from '../../../core/models/admin.model';
import {
  Subscription,
  Subject,
  EMPTY,
  of,
  forkJoin,
  timer,
  filter,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  catchError,
} from 'rxjs';
import { GlobalSearchService } from '../../../core/services/global-search.service';
import { GlobalSearchResult } from '../../../core/models/global-search.model';

interface LoadsByPeriod {
  date: string;
  count: number;
}

interface RevenueByPeriod {
  date: string;
  amount: number;
}

interface LoadStatusSummary {
  status: string;
  count: number;
  totalRevenue?: number;
}

interface TripStatusSummary {
  status: string;
  count: number;
}

interface RevenueExpenseCategory {
  category: string;
  revenue: number;
  expenses: number;
}

interface TopBroker {
  customerId: number;
  customerName: string;
  loadCount: number;
}

type TopBrokerPeriod = 'daily' | 'weekly' | 'monthly' | 'all-time';
type RevenueByTruckPeriod = 'today' | 'weekly' | 'monthly' | '3-months';

interface RevenueByTruck {
  equipmentId: number;
  truckLabel: string;
  plateNumber: string;
  loadCount: number;
  grossRevenue: number;
}

type DispatcherDateRange = 'today' | 'this-week' | 'this-month' | 'custom';
type DispatcherStatusFilter = 'all' | 'active' | 'completed' | 'cancelled';
type DispatcherSortDirection = 'desc' | 'asc';
type DispatcherWidgetView = 'list' | 'chart';

interface DispatcherLoadStats {
  dispatcherUserId: number;
  dispatcherName: string;
  avatarUrl?: string;
  totalLoads: number;
  activeLoads: number;
  completedLoads: number;
  cancelledLoads: number;
  percentageShare: number;
}

interface TotalGrossRevenueResponse {
  grossRevenue?: number;
}

/** Display model for alerts shown in the Alerts card (notifications + stats-based) */
interface DashboardAlertDisplay {
  category?: string;
  title?: string;
  message?: string;
  actionUrl?: string;
  /** Route path segments (use with queryParams to avoid encoding ? and = in the URL) */
  actionRoute?: string[];
  actionQueryParams?: Record<string, string>;
}

interface DashboardStats {
  totalLoads?: number;
  activeLoads?: number;
  assignedLoads?: number;
  deliveredLoads?: number;
  totalDrivers?: number;
  availableDrivers?: number;
  totalEquipment?: number;
  activeEquipment?: number;
  totalCustomers?: number;
  totalRevenue?: number;
  pendingInvoices?: number;
  openIncidents?: number;
  delayedTrips?: number;
  cancelledTrips?: number;
  availableVehicles?: number;
  inMaintenance?: number;
  driversOnDuty?: number;
  driversNearHosLimit?: number;
  pendingInvoicesTotal?: number;
  averageRatePerMile?: number;
  dueForService?: number;
  engineAlerts?: number;
  lowFuelWarnings?: number;
  drivingHoursToday?: number;
  hosRemaining?: number;
  violationsCount?: number;
  currentMonthEarnings?: number;
  yearToDateEarnings?: number;
  pendingPaymentsTotal?: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  expiringDocumentsCount?: number;
  upcomingLoadsCount?: number;
  loadsByPeriod?: LoadsByPeriod[];
  revenueByPeriod?: RevenueByPeriod[];
  loadStatusSummary?: LoadStatusSummary[];
  tripStatusSummary?: TripStatusSummary[];
  revenueExpenseByCategory?: RevenueExpenseCategory[];
}

interface DispatcherOperationsSnapshot {
  loadsAssignedToday: number;
  unassignedLoads: number;
  pickupsToday: number;
  deliveriesToday: number;
  lastUpdated: Date | null;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, RouterModule, BaseChartDirective, LiveFleetMapComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  /** Skip global HTTP overlay; dashboard uses per-section spinners instead. */
  private readonly skipGlobalHttpLoading = { 'X-Skip-Loading': 'true' };

  stats: DashboardStats | null = null;
  /** True only until the first dashboard stats response (success or error). */
  statsLoading = true;
  recentLoads: Load[] = [];
  currentLoads: Load[] = [];
  upcomingLoads: Load[] = [];
  driverIncidents: Incident[] = [];
  dashboardAlerts: DashboardAlertDisplay[] = [];
  topBrokers: TopBroker[] = [];
  topBrokersLoading = false;
  topBrokersPeriod: TopBrokerPeriod = 'all-time';
  revenueByTruck: RevenueByTruck[] = [];
  totalGrossRevenue = 0;
  revenueByTruckLoading = false;
  revenueByTruckPeriod: RevenueByTruckPeriod = 'weekly';
  loadsLoading = true;
  currentLoadsLoading = false;
  upcomingLoadsLoading = false;
  incidentsLoading = false;
  auditLogsLoading = false;
  recentAuditLogs: AuditLog[] = [];
  showStatusModal = false;
  selectedLoad: Load | null = null;
  newStatus = '';
  statusOptions = [
    'Created',
    'Assigned',
    'Dispatched',
    'PickedUp',
    'InTransit',
    'Delivered',
    'Completed',
    'Settled',
    'Cancelled'
  ];
  private routerSubscription?: Subscription;
  private notificationsSubscription?: Subscription;
  private readonly destroy$ = new Subject<void>();
  private readonly globalSearchInput$ = new Subject<string>();

  @ViewChild('globalSearchPanel', { read: ElementRef }) globalSearchPanel?: ElementRef<HTMLElement>;

  searchQuery = '';
  searchPanelOpen = false;
  globalSearchResults: GlobalSearchResult | null = null;

  // Chart data
  loadStatusChartData!: ChartData<'doughnut'>;
  loadsOverTimeChartData!: ChartData<'bar'>;
  revenueOverTimeChartData!: ChartData<'line'>;
  fleetChartData!: ChartData<'doughnut'>;
  tripStatusChartData: ChartData<'pie'> = { labels: [], datasets: [] };
  revenueExpenseChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  grossRevenueByTruckChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  dispatcherLoadsChartData: ChartData<'bar'> = { labels: [], datasets: [] };

  // Chart options
  loadStatusChartOptions: ChartOptions<'doughnut'> = {};
  loadsOverTimeChartOptions: ChartOptions<'bar'> = {};
  revenueOverTimeChartOptions: ChartOptions<'line'> = {};
  fleetChartOptions: ChartOptions<'doughnut'> = {};
  tripStatusChartOptions: ChartOptions<'pie'> = {};
  revenueExpenseChartOptions: ChartOptions<'bar'> = {};
  grossRevenueByTruckChartOptions: ChartOptions<'bar'> = {};
  dispatcherLoadsChartOptions: ChartOptions<'bar'> = {};

  dispatcherLoads: DispatcherLoadStats[] = [];
  dispatcherLoadsLoading = false;
  dispatcherWidgetView: DispatcherWidgetView = 'list';
  dispatcherDateRange: DispatcherDateRange = 'this-month';
  dispatcherStatusFilter: DispatcherStatusFilter = 'all';
  dispatcherSortDirection: DispatcherSortDirection = 'desc';
  dispatcherCustomStartDate = '';
  dispatcherCustomEndDate = '';
  dispatcherOpsLoading = false;
  dispatcherOps: DispatcherOperationsSnapshot = {
    loadsAssignedToday: 0,
    unassignedLoads: 0,
    pickupsToday: 0,
    deliveriesToday: 0,
    lastUpdated: null
  };
  private dispatcherRealtimeSubscription?: Subscription;

  // TMS color palette - White, Gray, Navy Blue only
  private readonly tmsColors = {
    navy: '#1a365d',
    navyLight: '#2c5282',
    gray: '#6c757d',
    grayDark: '#495057',
    grayDarker: '#212529',
    grayLight: '#e9ecef',
    white: '#ffffff'
  };

  constructor(
    private apiService: ApiService,
    public authService: AuthService,
    private adminService: AdminService,
    private loadService: LoadService,
    private complianceService: ComplianceService,
    private notificationService: NotificationService,
    private timeZoneService: TimeZoneService,
    private router: Router,
    private globalSearchService: GlobalSearchService
  ) {}

  ngOnInit(): void {
    this.globalSearchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          const trimmed = q.trim();
          if (trimmed.length < 2) {
            this.globalSearchResults = null;
            return EMPTY;
          }
          return this.globalSearchService.search(trimmed, 8).pipe(
            catchError(() => {
              this.globalSearchResults = null;
              return of(null);
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((data) => {
        if (!data) {
          return;
        }
        this.globalSearchResults = {
          loads: data.loads ?? [],
          brokers: data.brokers ?? [],
          invoices: data.invoices ?? [],
          drivers: data.drivers ?? [],
          ownerOperators: data.ownerOperators ?? [],
        };
      });

    this.initializeChartOptions();
    this.loadDashboardStats();
    this.loadRecentLoads();
    if (!this.authService.hasRole('Driver')) {
      this.loadTotalGrossRevenue();
      this.loadRevenueByTruck();
    }
    if (this.authService.hasAnyRole(['Admin', 'Dispatcher', 'FleetManager'])) {
      this.loadTopBrokers();
    }
    if (this.authService.hasRole('Admin')) {
      this.loadDispatcherLoads();
    }
    if (this.showDispatcherOperationsCards()) {
      this.loadDispatcherOperationsSnapshot();
      this.dispatcherRealtimeSubscription = timer(60000, 60000).subscribe(() => {
        this.loadDashboardStats();
        this.loadDispatcherOperationsSnapshot();
      });
    }
    if (this.authService.hasRole('Driver')) {
      this.loadDriverIncidents();
    } else {
      this.loadCurrentLoads();
      if (this.authService.hasAnyRole(['Admin', 'Dispatcher', 'FleetManager', 'Accountant'])) {
        this.loadAuditLogs();
      }
    }
    this.notificationsSubscription = this.notificationService.notifications$.subscribe(
      () => this.buildDashboardAlerts()
    );

    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        if (event.url === '/dashboard' || event.url === '/') {
          this.loadDashboardStats();
          this.loadRecentLoads();
          if (!this.authService.hasRole('Driver')) {
            this.loadTotalGrossRevenue();
            this.loadRevenueByTruck();
          }
          if (this.authService.hasAnyRole(['Admin', 'Dispatcher', 'FleetManager'])) {
            this.loadTopBrokers();
          }
          if (this.authService.hasRole('Admin')) {
            this.loadDispatcherLoads();
          }
          if (this.showDispatcherOperationsCards()) {
            this.loadDispatcherOperationsSnapshot();
          }
          if (this.authService.hasRole('Driver')) {
            this.loadDriverIncidents();
          } else {
            this.loadCurrentLoads();
            if (this.authService.hasAnyRole(['Admin', 'Dispatcher', 'FleetManager', 'Accountant'])) {
              this.loadAuditLogs();
            }
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.notificationsSubscription?.unsubscribe();
    this.dispatcherRealtimeSubscription?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  showDispatcherOperationsCards(): boolean {
    return this.authService.hasAnyRole(['Dispatcher', 'Admin']);
  }

  private loadDispatcherOperationsSnapshot(): void {
    this.dispatcherOpsLoading = true;
    const { start, end } = this.getTodayIsoRange();
    const baseHeaders = this.skipGlobalHttpLoading;

    const createdToday$ = this.loadService.getLoads(
      undefined,
      undefined,
      undefined,
      1,
      1,
      undefined,
      { createdFrom: start, createdTo: end },
      baseHeaders
    );
    const unassignedToday$ = this.loadService.getLoads(
      undefined,
      undefined,
      undefined,
      1,
      1,
      undefined,
      { createdFrom: start, createdTo: end, isUnassigned: true },
      baseHeaders
    );
    const unassignedOverall$ = this.loadService.getLoads(
      undefined,
      undefined,
      undefined,
      1,
      1,
      undefined,
      { isUnassigned: true },
      baseHeaders
    );
    const pickupsToday$ = this.loadService.getLoads(
      undefined,
      undefined,
      undefined,
      1,
      1,
      undefined,
      { pickupFrom: start, pickupTo: end },
      baseHeaders
    );
    const deliveriesToday$ = this.loadService.getLoads(
      undefined,
      undefined,
      undefined,
      1,
      1,
      undefined,
      { deliveryFrom: start, deliveryTo: end },
      baseHeaders
    );

    forkJoin({
      createdToday: createdToday$,
      unassignedToday: unassignedToday$,
      unassignedOverall: unassignedOverall$,
      pickupsToday: pickupsToday$,
      deliveriesToday: deliveriesToday$
    }).subscribe({
      next: (result) => {
        const createdTodayCount = result.createdToday.totalCount ?? 0;
        const unassignedTodayCount = result.unassignedToday.totalCount ?? 0;
        this.dispatcherOps = {
          loadsAssignedToday: Math.max(0, createdTodayCount - unassignedTodayCount),
          unassignedLoads: result.unassignedOverall.totalCount ?? 0,
          pickupsToday: result.pickupsToday.totalCount ?? 0,
          deliveriesToday: result.deliveriesToday.totalCount ?? 0,
          lastUpdated: new Date()
        };
        this.dispatcherOpsLoading = false;
      },
      error: () => {
        this.dispatcherOps = {
          loadsAssignedToday: 0,
          unassignedLoads: 0,
          pickupsToday: 0,
          deliveriesToday: 0,
          lastUpdated: new Date()
        };
        this.dispatcherOpsLoading = false;
      }
    });
  }

  private getTodayIsoRange(): { start: string; end: string } {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  canUseGlobalSearch(): boolean {
    return this.authService.hasAnyRole([
      'Admin',
      'Dispatcher',
      'FleetManager',
      'Accountant',
      'Driver',
      'OwnerOperator',
    ]);
  }

  onGlobalSearchInput(value: string): void {
    this.searchQuery = value;
    this.globalSearchInput$.next(value);
  }

  onGlobalSearchFocus(): void {
    this.searchPanelOpen = true;
  }

  closeGlobalSearchPanel(): void {
    this.searchPanelOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.searchPanelOpen) {
      return;
    }
    const root = this.globalSearchPanel?.nativeElement;
    if (root && !root.contains(event.target as Node)) {
      this.searchPanelOpen = false;
    }
  }

  hasGlobalSearchHits(): boolean {
    const r = this.globalSearchResults;
    if (!r) {
      return false;
    }
    return (
      r.loads.length > 0 ||
      r.brokers.length > 0 ||
      r.invoices.length > 0 ||
      r.drivers.length > 0 ||
      r.ownerOperators.length > 0
    );
  }

  navigateToSearchHit(kind: 'load' | 'broker' | 'invoice' | 'driver' | 'ownerOperator', id: number): void {
    this.closeGlobalSearchPanel();
    switch (kind) {
      case 'load':
        void this.router.navigate(['/loads', id]);
        break;
      case 'broker':
        void this.router.navigate(['/customers', id]);
        break;
      case 'invoice':
        void this.router.navigate(['/financial/invoices', id]);
        break;
      case 'driver':
        void this.router.navigate(['/drivers', id]);
        break;
      case 'ownerOperator':
        void this.router.navigate(['/owner-operators', id]);
        break;
    }
  }

  /** Build combined alerts from notifications + stats-based operational alerts */
  private buildDashboardAlerts(): void {
    const notifications = this.notificationService.getNotifications();
    const notificationAlerts: DashboardAlertDisplay[] = notifications
      .filter(n => !n.isRead)
      .map(n => ({
        category: n.category,
        title: n.title,
        message: n.message,
        actionUrl: n.actionUrl
      }));

    const statsAlerts = this.buildStatsBasedAlerts();
    this.dashboardAlerts = [...notificationAlerts, ...statsAlerts].slice(0, 8);
  }

  /** Derive alerts from dashboard stats (operational issues) */
  private buildStatsBasedAlerts(): DashboardAlertDisplay[] {
    if (!this.stats) return [];
    const alerts: DashboardAlertDisplay[] = [];

    if (this.authService.hasRole('Driver')) {
      const expiring = this.stats.expiringDocumentsCount ?? 0;
      if (expiring > 0) {
        alerts.push({
          category: 'Warning',
          title: `${expiring} document(s) expiring soon`,
          actionRoute: ['/drivers/my-profile'],
          actionQueryParams: { tab: 'documents' }
        });
      }
      return alerts;
    }

    const delayed = this.stats.delayedTrips ?? 0;
    if (delayed > 0) {
      alerts.push({
        category: 'Warning',
        title: `${delayed} delayed trip(s)`,
        actionUrl: '/loads'
      });
    }
    const hosLimit = this.stats.driversNearHosLimit ?? 0;
    if (hosLimit > 0) {
      alerts.push({
        category: 'Warning',
        title: `${hosLimit} driver(s) near HOS limit`,
        actionUrl: '/compliance'
      });
    }
    const engine = this.stats.engineAlerts ?? 0;
    if (engine > 0) {
      alerts.push({
        category: 'Error',
        title: `${engine} engine alert(s)`,
        actionUrl: '/equipment'
      });
    }
    const dueService = this.stats.dueForService ?? 0;
    if (dueService > 0) {
      alerts.push({
        category: 'Info',
        title: `${dueService} vehicle(s) due for service`,
        actionUrl: '/equipment'
      });
    }
    const lowFuel = this.stats.lowFuelWarnings ?? 0;
    if (lowFuel > 0) {
      alerts.push({
        category: 'Warning',
        title: `${lowFuel} low fuel warning(s)`,
        actionUrl: '/equipment'
      });
    }
    const violations = this.stats.violationsCount ?? 0;
    if (violations > 0) {
      alerts.push({
        category: 'Error',
        title: `${violations} HOS violation(s)`,
        actionUrl: '/compliance'
      });
    }
    const incidents = this.stats.openIncidents ?? 0;
    if (incidents > 0) {
      alerts.push({
        category: 'Warning',
        title: `${incidents} open incident(s)`,
        actionUrl: '/compliance'
      });
    }

    return alerts;
  }

  initializeChartOptions(): void {
    // Load Status Doughnut Chart Options
    this.loadStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: {
              size: 12,
              weight: 500
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    };

    // Loads Over Time Bar Chart Options
    this.loadsOverTimeChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            font: {
              size: 11
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          ticks: {
            font: {
              size: 11
            },
            maxRotation: 45,
            minRotation: 45,
            callback: (value, index) => {
              const date = this.loadsOverTimeChartData?.labels?.[index] as string;
              if (date) {
                const d = new Date(date);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }
              return '';
            }
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const date = items[0].label;
              if (date) {
                const d = new Date(date);
                return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              }
              return '';
            },
            label: (context) => {
              return `Loads: ${context.parsed.y}`;
            }
          }
        }
      }
    };

    // Revenue Over Time Line Chart Options
    this.revenueOverTimeChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: {
              size: 11
            },
            callback: (value) => {
              return this.formatCurrency(value as number);
            }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          ticks: {
            font: {
              size: 11
            },
            maxRotation: 45,
            minRotation: 45,
            callback: (value, index) => {
              const date = this.revenueOverTimeChartData?.labels?.[index] as string;
              if (date) {
                const d = new Date(date);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }
              return '';
            }
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const date = items[0].label;
              if (date) {
                const d = new Date(date);
                return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
              }
              return '';
            },
            label: (context) => {
              return `Revenue: ${this.formatCurrency(context.parsed.y as number)}`;
            }
          }
        }
      },
      elements: {
        line: {
          tension: 0.3,
          borderWidth: 3
        },
        point: {
          radius: 4,
          hoverRadius: 6
        }
      }
    };

    // Fleet Doughnut Chart Options
    this.fleetChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: { size: 12, weight: 500 }
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    };

    // Trip Status Pie Chart Options
    this.tripStatusChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 10, font: { size: 11 } }
        }
      }
    };

    // Revenue & Expenses Bar Chart Options
    this.revenueExpenseChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => this.formatCurrency(v as number)
          }
        }
      },
      plugins: {
        legend: { position: 'top' }
      }
    };

    this.grossRevenueByTruckChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => this.formatCurrency(v as number)
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          ticks: {
            autoSkip: false
          },
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const item = this.revenueByTruck[context.dataIndex];
              const loadCount = item?.loadCount ?? 0;
              return `Gross: ${this.formatCurrency(context.parsed.y as number)} | Loads: ${loadCount}`;
            }
          }
        }
      }
    };

    this.dispatcherLoadsChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            autoSkip: false
          }
        }
      },
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const index = elements[0].index;
        const row = this.dispatcherLoads[index];
        if (row) {
          this.drillDownDispatcherLoads(row);
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const row = this.dispatcherLoads[context.dataIndex];
              if (!row) {
                return `Loads: ${context.parsed.y}`;
              }
              return [
                `Total Loads: ${row.totalLoads}`,
                `Active: ${row.activeLoads}`,
                `Completed: ${row.completedLoads}`,
                `Cancelled: ${row.cancelledLoads}`,
                `Share: ${row.percentageShare.toFixed(2)}%`
              ];
            }
          }
        }
      }
    };
  }

  loadDashboardStats(): void {
    if (this.stats == null) {
      this.statsLoading = true;
    }
    // Use driver-specific endpoint if user is a driver
    const endpoint = this.authService.hasRole('Driver') 
      ? 'reports/driver-dashboard' 
      : 'reports/dashboard';
    
    // Add chartDays parameter for non-driver dashboard
    const params = this.authService.hasRole('Driver') 
      ? undefined 
      : { chartDays: 14 };
    
    this.apiService.get<DashboardStats>(endpoint, params, this.skipGlobalHttpLoading).subscribe({
      next: (data) => {
        // Normalize property names to camelCase in case backend returns PascalCase
        const d = data as Record<string, unknown>;
        const get = (k: string, k2: string, def: unknown = 0) => d[k] ?? d[k2] ?? def;
        this.stats = {
          totalLoads: get('totalLoads', 'TotalLoads') as number,
          activeLoads: get('activeLoads', 'ActiveLoads') as number,
          assignedLoads: get('assignedLoads', 'AssignedLoads') as number,
          deliveredLoads: get('deliveredLoads', 'DeliveredLoads') as number,
          totalDrivers: get('totalDrivers', 'TotalDrivers') as number,
          availableDrivers: get('availableDrivers', 'AvailableDrivers') as number,
          totalEquipment: get('totalEquipment', 'TotalEquipment') as number,
          activeEquipment: get('activeEquipment', 'ActiveEquipment') as number,
          totalCustomers: get('totalCustomers', 'TotalCustomers') as number,
          totalRevenue: get('totalRevenue', 'TotalRevenue') as number,
          pendingInvoices: get('pendingInvoices', 'PendingInvoices') as number,
          openIncidents: get('openIncidents', 'OpenIncidents') as number,
          delayedTrips: get('delayedTrips', 'DelayedTrips') as number,
          cancelledTrips: get('cancelledTrips', 'CancelledTrips') as number,
          availableVehicles: get('availableVehicles', 'AvailableVehicles') as number,
          inMaintenance: get('inMaintenance', 'InMaintenance') as number,
          driversOnDuty: get('driversOnDuty', 'DriversOnDuty') as number,
          driversNearHosLimit: get('driversNearHosLimit', 'DriversNearHosLimit') as number,
          pendingInvoicesTotal: get('pendingInvoicesTotal', 'PendingInvoicesTotal') as number,
          averageRatePerMile: get('averageRatePerMile', 'AverageRatePerMile') as number,
          dueForService: get('dueForService', 'DueForService') as number,
          engineAlerts: get('engineAlerts', 'EngineAlerts') as number,
          lowFuelWarnings: get('lowFuelWarnings', 'LowFuelWarnings') as number,
          drivingHoursToday: get('drivingHoursToday', 'DrivingHoursToday') as number,
          hosRemaining: get('hosRemaining', 'HosRemaining', 11) as number,
          violationsCount: get('violationsCount', 'ViolationsCount') as number,
          currentMonthEarnings: get('currentMonthEarnings', 'CurrentMonthEarnings') as number,
          yearToDateEarnings: get('yearToDateEarnings', 'YearToDateEarnings') as number,
          pendingPaymentsTotal: get('pendingPaymentsTotal', 'PendingPaymentsTotal') as number,
          lastPaymentDate: get('lastPaymentDate', 'LastPaymentDate', undefined) as string | undefined,
          lastPaymentAmount: get('lastPaymentAmount', 'LastPaymentAmount') as number,
          expiringDocumentsCount: get('expiringDocumentsCount', 'ExpiringDocumentsCount') as number,
          upcomingLoadsCount: get('upcomingLoadsCount', 'UpcomingLoadsCount') as number,
          loadsByPeriod: (get('loadsByPeriod', 'LoadsByPeriod', []) as LoadsByPeriod[]),
          revenueByPeriod: (get('revenueByPeriod', 'RevenueByPeriod', []) as RevenueByPeriod[]),
          loadStatusSummary: (get('loadStatusSummary', 'LoadStatusSummary', []) as LoadStatusSummary[]),
          tripStatusSummary: (get('tripStatusSummary', 'TripStatusSummary', []) as TripStatusSummary[]),
          revenueExpenseByCategory: (get('revenueExpenseByCategory', 'RevenueExpenseByCategory', []) as RevenueExpenseCategory[])
        };
        this.statsLoading = false;
        // Build chart data and alerts
        this.buildChartData();
        this.buildDashboardAlerts();
      },
      error: (error) => {
        console.error('Error loading dashboard stats:', error);
        // Initialize with default values so dashboard still shows
        this.stats = {
          totalLoads: 0,
          activeLoads: 0,
          assignedLoads: 0,
          deliveredLoads: 0,
          totalDrivers: 0,
          availableDrivers: 0,
          totalEquipment: 0,
          activeEquipment: 0,
          totalCustomers: 0,
          totalRevenue: 0,
          pendingInvoices: 0,
          openIncidents: 0,
          loadsByPeriod: [],
          revenueByPeriod: [],
          loadStatusSummary: [],
          tripStatusSummary: [],
          revenueExpenseByCategory: []
        };
        this.statsLoading = false;
        this.buildChartData();
        this.buildDashboardAlerts();
      }
    });
  }

  loadTopBrokers(limit: number = 10): void {
    this.topBrokersLoading = true;
    this.apiService
      .get<TopBroker[]>('reports/top-brokers', { limit, period: this.topBrokersPeriod }, this.skipGlobalHttpLoading)
      .subscribe({
      next: (data) => {
        const brokerData = (Array.isArray(data) ? data : []) as unknown[];
        this.topBrokers = brokerData.map((item) => {
          const i = item as Record<string, unknown>;
          return {
            customerId: (i['customerId'] ?? i['CustomerId'] ?? 0) as number,
            customerName: (i['customerName'] ?? i['CustomerName'] ?? '-') as string,
            loadCount: (i['loadCount'] ?? i['LoadCount'] ?? 0) as number
          };
        });
        this.topBrokersLoading = false;
      },
      error: () => {
        this.topBrokers = [];
        this.topBrokersLoading = false;
      }
    });
  }

  onTopBrokersPeriodChange(period: TopBrokerPeriod): void {
    this.topBrokersPeriod = period;
    this.loadTopBrokers();
  }

  loadRevenueByTruck(): void {
    this.revenueByTruckLoading = true;
    this.apiService
      .get<RevenueByTruck[]>('reports/revenue-by-truck', { period: this.revenueByTruckPeriod }, this.skipGlobalHttpLoading)
      .subscribe({
      next: (data) => {
        const rows = (Array.isArray(data) ? data : []) as unknown[];
        this.revenueByTruck = rows.map((item) => {
          const i = item as Record<string, unknown>;
          return {
            equipmentId: (i['equipmentId'] ?? i['EquipmentId'] ?? 0) as number,
            truckLabel: (i['truckLabel'] ?? i['TruckLabel'] ?? '-') as string,
            plateNumber: (i['plateNumber'] ?? i['PlateNumber'] ?? '') as string,
            loadCount: (i['loadCount'] ?? i['LoadCount'] ?? 0) as number,
            grossRevenue: (i['grossRevenue'] ?? i['GrossRevenue'] ?? 0) as number
          };
        });
        this.revenueByTruckLoading = false;
        this.buildChartData();
      },
      error: () => {
        this.revenueByTruck = [];
        this.revenueByTruckLoading = false;
        this.buildChartData();
      }
    });
  }

  onRevenueByTruckPeriodChange(period: RevenueByTruckPeriod): void {
    this.revenueByTruckPeriod = period;
    this.loadRevenueByTruck();
  }

  loadDispatcherLoads(): void {
    this.dispatcherLoadsLoading = true;
    const params: Record<string, string> = {
      dateRange: this.dispatcherDateRange,
      sortDirection: this.dispatcherSortDirection
    };

    if (this.dispatcherStatusFilter !== 'all') {
      params['status'] = this.dispatcherStatusFilter;
    }

    if (this.dispatcherDateRange === 'custom') {
      if (!this.dispatcherCustomStartDate || !this.dispatcherCustomEndDate) {
        this.dispatcherLoads = [];
        this.dispatcherLoadsChartData = { labels: [], datasets: [] };
        this.dispatcherLoadsLoading = false;
        return;
      }

      params['startDate'] = this.dispatcherCustomStartDate;
      params['endDate'] = this.dispatcherCustomEndDate;
    }

    this.apiService
      .get<DispatcherLoadStats[]>('reports/loads-per-dispatcher', params, this.skipGlobalHttpLoading)
      .subscribe({
      next: (data) => {
        const rows = Array.isArray(data) ? data : [];
        this.dispatcherLoads = rows.map((item) => {
          const i = item as unknown as Record<string, unknown>;
          return {
            dispatcherUserId: (i['dispatcherUserId'] ?? i['DispatcherUserId'] ?? 0) as number,
            dispatcherName: (i['dispatcherName'] ?? i['DispatcherName'] ?? '-') as string,
            avatarUrl: (i['avatarUrl'] ?? i['AvatarUrl'] ?? undefined) as string | undefined,
            totalLoads: (i['totalLoads'] ?? i['TotalLoads'] ?? 0) as number,
            activeLoads: (i['activeLoads'] ?? i['ActiveLoads'] ?? 0) as number,
            completedLoads: (i['completedLoads'] ?? i['CompletedLoads'] ?? 0) as number,
            cancelledLoads: (i['cancelledLoads'] ?? i['CancelledLoads'] ?? 0) as number,
            percentageShare: (i['percentageShare'] ?? i['PercentageShare'] ?? 0) as number
          };
        });
        this.buildDispatcherLoadsChartData();
        this.dispatcherLoadsLoading = false;
      },
      error: () => {
        this.dispatcherLoads = [];
        this.dispatcherLoadsChartData = { labels: [], datasets: [] };
        this.dispatcherLoadsLoading = false;
      }
    });
  }

  onDispatcherDateRangeChange(): void {
    if (this.dispatcherDateRange !== 'custom') {
      this.loadDispatcherLoads();
    }
  }

  onDispatcherCustomDateApply(): void {
    this.loadDispatcherLoads();
  }

  onDispatcherStatusChange(): void {
    this.loadDispatcherLoads();
  }

  onDispatcherSortChange(): void {
    this.loadDispatcherLoads();
  }

  onDispatcherViewChange(view: DispatcherWidgetView): void {
    this.dispatcherWidgetView = view;
  }

  refreshDispatcherWidget(): void {
    this.loadDispatcherLoads();
  }

  loadTotalGrossRevenue(): void {
    this.apiService.get<TotalGrossRevenueResponse>('reports/total-gross-revenue', undefined, this.skipGlobalHttpLoading).subscribe({
      next: (data) => {
        const d = data as Record<string, unknown>;
        this.totalGrossRevenue = (d['grossRevenue'] ?? d['GrossRevenue'] ?? 0) as number;
      },
      error: () => {
        this.totalGrossRevenue = 0;
      }
    });
  }

  buildChartData(): void {
    if (!this.stats) return;

    // Build Load Status Doughnut Chart
    const statusSummary = this.stats.loadStatusSummary || [];
    const statusColors: { [key: string]: string } = {
      'Created': this.tmsColors.gray,
      'Assigned': this.tmsColors.navyLight,
      'Dispatched': this.tmsColors.navyLight,
      'PickedUp': this.tmsColors.navy,
      'InTransit': this.tmsColors.navy,
      'Delivered': this.tmsColors.grayDark,
      'Completed': this.tmsColors.grayDark,
      'Settled': this.tmsColors.grayDarker,
      'Cancelled': this.tmsColors.gray
    };

    this.loadStatusChartData = {
      labels: statusSummary.map(s => s.status),
      datasets: [{
        data: statusSummary.map(s => s.count),
        backgroundColor: statusSummary.map(s => statusColors[s.status] || this.tmsColors.gray),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    // Build Loads Over Time Bar Chart
    const loadsByPeriod = this.stats.loadsByPeriod || [];
    this.loadsOverTimeChartData = {
      labels: loadsByPeriod.map(l => l.date),
      datasets: [{
        label: 'Loads',
        data: loadsByPeriod.map(l => l.count),
        backgroundColor: this.tmsColors.navy + '80',
        borderColor: this.tmsColors.navy,
        borderWidth: 2
      }]
    };

    // Build Revenue Over Time Line Chart
    const revenueByPeriod = this.stats.revenueByPeriod || [];
    this.revenueOverTimeChartData = {
      labels: revenueByPeriod.map(r => r.date),
      datasets: [{
        label: 'Revenue',
        data: revenueByPeriod.map(r => r.amount),
        borderColor: this.tmsColors.grayDark,
        backgroundColor: this.tmsColors.grayLight,
        fill: true,
        tension: 0.3
      }]
    };

    // Build Fleet Doughnut Chart (only for non-drivers)
    if (!this.authService.hasRole('Driver') && (this.stats.totalDrivers ?? 0) > 0) {
      const onTrip = this.stats.activeLoads || 0; // Using active loads as proxy for "on trip"
      const available = this.stats.availableDrivers || 0;
      const other = Math.max(0, (this.stats.totalDrivers || 0) - available - onTrip);

      this.fleetChartData = {
        labels: ['On Trip', 'Available', 'Other'],
        datasets: [{
          data: [onTrip, available, other],
          backgroundColor: [
            this.tmsColors.navy,
            this.tmsColors.gray,
            this.tmsColors.grayLight
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      };
    } else {
      this.fleetChartData = {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 0 }]
      };
    }

    // Trip Status Pie Chart (OnTime, Delayed, Cancelled)
    const tripSummary = this.stats.tripStatusSummary || [];
    const tripColors: Record<string, string> = {
      OnTime: this.tmsColors.navy,
      Delayed: this.tmsColors.grayDarker,
      Cancelled: this.tmsColors.gray
    };
    this.tripStatusChartData = {
      labels: tripSummary.map(s => s.status),
      datasets: [{
        data: tripSummary.map(s => s.count),
        backgroundColor: tripSummary.map(s => tripColors[s.status] || this.tmsColors.gray),
        borderWidth: 2,
        borderColor: '#252f3d'
      }]
    };

    // Revenue & Expenses Bar Chart
    const revExp = this.stats.revenueExpenseByCategory || [];
    this.revenueExpenseChartData = {
      labels: revExp.map(r => r.category),
      datasets: [
        {
          label: 'Revenue',
          data: revExp.map(r => r.revenue),
          backgroundColor: this.tmsColors.navy + 'cc',
          borderColor: this.tmsColors.navy
        },
        {
          label: 'Expenses',
          data: revExp.map(r => r.expenses),
          backgroundColor: this.tmsColors.gray + 'cc',
          borderColor: this.tmsColors.gray
        }
      ]
    };

    this.grossRevenueByTruckChartData = {
      labels: this.revenueByTruck.map(r => r.truckLabel),
      datasets: [
        {
          label: 'Gross Revenue',
          data: this.revenueByTruck.map(r => r.grossRevenue),
          backgroundColor: this.tmsColors.navy + 'cc',
          borderColor: this.tmsColors.navy,
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    };
  }

  private buildDispatcherLoadsChartData(): void {
    const labels = this.dispatcherLoads.map(d => d.dispatcherName);
    const values = this.dispatcherLoads.map(d => d.totalLoads);
    const colors = this.dispatcherLoads.map(d => this.getWorkloadColor(d.totalLoads));
    this.dispatcherLoadsChartData = {
      labels,
      datasets: [
        {
          label: 'Loads',
          data: values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    };
  }

  getDispatcherInitial(name: string): string {
    if (!name?.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  getDispatcherProgress(loadCount: number): number {
    const max = Math.max(...this.dispatcherLoads.map(x => x.totalLoads), 0);
    if (max <= 0) return 0;
    return Math.round((loadCount / max) * 100);
  }

  getWorkloadLabel(loadCount: number): 'High' | 'Medium' | 'Low' {
    const sorted = this.dispatcherLoads.map(x => x.totalLoads).sort((a, b) => a - b);
    if (!sorted.length) return 'Low';

    const lowThreshold = sorted[Math.floor((sorted.length - 1) / 3)];
    const highThreshold = sorted[Math.floor(((sorted.length - 1) * 2) / 3)];
    if (loadCount >= highThreshold) return 'High';
    if (loadCount >= lowThreshold) return 'Medium';
    return 'Low';
  }

  getWorkloadBadgeClass(loadCount: number): string {
    const label = this.getWorkloadLabel(loadCount);
    if (label === 'High') return 'dispatcher-workload-high';
    if (label === 'Medium') return 'dispatcher-workload-medium';
    return 'dispatcher-workload-low';
  }

  getWorkloadColor(loadCount: number): string {
    const label = this.getWorkloadLabel(loadCount);
    if (label === 'High') return '#dc3545';
    if (label === 'Medium') return '#f0ad4e';
    return '#198754';
  }

  getDispatcherTooltip(item: DispatcherLoadStats): string {
    return `Active: ${item.activeLoads} | Completed: ${item.completedLoads} | Cancelled: ${item.cancelledLoads}`;
  }

  drillDownDispatcherLoads(item: DispatcherLoadStats): void {
    const queryParams: Record<string, string | number> = {
      assignedByUserId: item.dispatcherUserId,
      dispatcherName: item.dispatcherName
    };

    if (this.dispatcherStatusFilter !== 'all') {
      queryParams['status'] = this.mapDispatcherStatusToLoadStatus(this.dispatcherStatusFilter);
    }

    this.router.navigate(['/loads'], { queryParams });
  }

  private mapDispatcherStatusToLoadStatus(filter: DispatcherStatusFilter): string {
    switch (filter) {
      case 'active':
        return 'InTransit';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  }

  loadCurrentLoads(): void {
    this.currentLoadsLoading = true;
    this.loadService.getLoads(undefined, undefined, undefined, 1, 20, undefined, undefined, this.skipGlobalHttpLoading).subscribe({
      next: (data) => {
        const now = new Date();
        this.currentLoads = data.items.filter(
          l =>
            l.status === 'Dispatched' ||
            l.status === 'PickedUp' ||
            l.status === 'InTransit' ||
            l.status === 'Assigned' ||
            l.status === 'Delivered' ||
            l.status === 'Completed' ||
            l.status === 'Cancelled'
        ).slice(0, 5);
        this.currentLoadsLoading = false;
      },
      error: () => {
        this.currentLoads = [];
        this.currentLoadsLoading = false;
      }
    });
  }

  loadRecentLoads(): void {
    this.loadsLoading = true;
    
    // Use driver-specific endpoint if user is a driver - fetch once for both recent and upcoming
    if (this.authService.hasRole('Driver')) {
      this.upcomingLoadsLoading = true;
      this.apiService
        .get<{ items: Load[]; totalCount: number; pageNumber: number; pageSize: number }>(
          'loads/my-loads',
          { pageNumber: 1, pageSize: 20 },
          this.skipGlobalHttpLoading
        )
        .subscribe({
        next: (data) => {
          this.recentLoads = data.items.slice(0, 5);
          const now = new Date();
          this.upcomingLoads = data.items
            .filter(load =>
              (load.status === 'Assigned' ||
                load.status === 'Dispatched' ||
                load.status === 'PickedUp' ||
                load.status === 'InTransit') &&
              load.pickupDateTime &&
              new Date(load.pickupDateTime) >= now
            )
            .sort((a, b) => {
              const dateA = a.pickupDateTime ? new Date(a.pickupDateTime).getTime() : 0;
              const dateB = b.pickupDateTime ? new Date(b.pickupDateTime).getTime() : 0;
              return dateA - dateB;
            })
            .slice(0, 5);
          this.loadsLoading = false;
          this.upcomingLoadsLoading = false;
        },
        error: () => {
          this.loadsLoading = false;
          this.upcomingLoadsLoading = false;
        }
      });
    } else {
      this.loadService.getLoads(undefined, undefined, undefined, 1, 5, undefined, undefined, this.skipGlobalHttpLoading).subscribe({
        next: (data) => {
          // Get the 5 most recent loads (already sorted by backend)
          this.recentLoads = data.items;
          this.loadsLoading = false;
        },
        error: () => {
          this.loadsLoading = false;
        }
      });
    }
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Created': 'bg-secondary',
      'Assigned': 'bg-info',
      'Dispatched': 'bg-info',
      'PickedUp': 'status-in-transit',
      'InTransit': 'status-in-transit',
      'Delivered': 'status-delivered',
      'Completed': 'status-delivered',
      'Settled': 'bg-dark',
      'Cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'bg-secondary';
  }

  isLoadDelayed(load: Load): boolean {
    if (
      load.status !== 'InTransit' &&
      load.status !== 'Assigned' &&
      load.status !== 'Dispatched' &&
      load.status !== 'PickedUp'
    )
      return false;
    if (!load.deliveryDateTime) return false;
    return new Date(load.deliveryDateTime) < new Date();
  }

  getTripDisplayStatus(load: Load): string {
    if (load.status === 'Cancelled') return 'Cancelled';
    if (load.status === 'Delivered') return 'Delivered';
    if (load.status === 'Completed') return 'Completed';
    if (this.isLoadDelayed(load)) return 'Delayed';
    if (load.status === 'InTransit') return 'In transit';
    if (load.status === 'Dispatched') return 'Dispatched';
    if (load.status === 'PickedUp') return 'Picked up';
    return 'Assigned';
  }

  getTripStatusBadgeClass(load: Load): string {
    if (load.status === 'Cancelled') return 'status-cancelled';
    if (load.status === 'Delivered' || load.status === 'Completed') return 'status-delivered';
    if (this.isLoadDelayed(load)) return 'status-delayed';
    return 'status-in-transit';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(amount?: number, currency: string = 'USD'): string {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  /** Compact format for KPI cards - uses K/M suffix for large values to prevent overflow */
  formatCurrencyCompact(amount?: number, currency: string = 'USD'): string {
    if (amount == null) return '-';
    if (amount === 0) return '$0';
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) {
      const val = amount / 1_000_000;
      const formatted = new Intl.NumberFormat('en-US', { style: 'decimal', maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(val);
      return `$${formatted}M`;
    }
    if (abs >= 1_000) {
      const val = amount / 1_000;
      const formatted = new Intl.NumberFormat('en-US', { style: 'decimal', maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(val);
      return `$${formatted}K`;
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  formatRatePerMile(rate?: number): string {
    const safeRate = rate ?? 0;
    return `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safeRate)}/mi`;
  }

  getLoadStatusPercentage(): number {
    if (!this.stats || !this.stats.totalLoads || this.stats.totalLoads === 0) return 0;
    const activeLoads = this.stats.activeLoads ?? 0;
    return Math.round((activeLoads / this.stats.totalLoads) * 100);
  }

  getDriverAvailabilityPercentage(): number {
    if (!this.stats || !this.stats.totalDrivers || this.stats.totalDrivers === 0) return 0;
    const availableDrivers = this.stats.availableDrivers ?? 0;
    return Math.round((availableDrivers / this.stats.totalDrivers) * 100);
  }

  getEquipmentUtilizationPercentage(): number {
    if (!this.stats || !this.stats.totalEquipment || this.stats.totalEquipment === 0) return 0;
    const activeEquipment = this.stats.activeEquipment ?? 0;
    return Math.round((activeEquipment / this.stats.totalEquipment) * 100);
  }

  canCreateLoad(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Dispatcher']);
  }

  canEditLoad(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Dispatcher']);
  }

  getStatusDisplayLabel(status: string | undefined): string {
    if (!status) return '-';
    const map: Record<string, string> = {
      Created: 'Created',
      Assigned: 'Assigned',
      Dispatched: 'Dispatched',
      PickedUp: 'Picked up',
      InTransit: 'In transit',
      Delivered: 'Delivered',
      Completed: 'Completed',
      Settled: 'Settled',
      Cancelled: 'Cancelled'
    };
    return map[status] || status;
  }

  openStatusModal(load: Load): void {
    this.selectedLoad = load;
    this.newStatus = load.status;
    this.showStatusModal = true;
  }

  closeStatusModal(): void {
    this.showStatusModal = false;
    this.selectedLoad = null;
  }

  updateLoadStatus(): void {
    if (!this.selectedLoad) return;

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
        this.closeStatusModal();
        this.loadCurrentLoads();
      },
      error: (error) => {
        console.error('Error updating status:', error);
        const msg = error?.error?.message || error?.message || 'Failed to update status. Please try again.';
        alert(msg);
      }
    });
  }

  loadUpcomingLoads(): void {
    this.upcomingLoadsLoading = true;
    // Get loads without status filter, then filter on frontend
    this.apiService
      .get<{ items: Load[]; totalCount: number }>('loads/my-loads', { pageNumber: 1, pageSize: 20 }, this.skipGlobalHttpLoading)
      .subscribe({
      next: (data) => {
        const now = new Date();
        // Filter for Assigned/InTransit with upcoming pickup dates, then sort by pickup date
        this.upcomingLoads = data.items
          .filter(load => 
            (load.status === 'Assigned' ||
              load.status === 'Dispatched' ||
              load.status === 'PickedUp' ||
              load.status === 'InTransit') &&
            load.pickupDateTime && 
            new Date(load.pickupDateTime) >= now
          )
          .sort((a, b) => {
            const dateA = a.pickupDateTime ? new Date(a.pickupDateTime).getTime() : 0;
            const dateB = b.pickupDateTime ? new Date(b.pickupDateTime).getTime() : 0;
            return dateA - dateB;
          })
          .slice(0, 5); // Limit to 5 most upcoming
        this.upcomingLoadsLoading = false;
      },
      error: () => {
        this.upcomingLoads = [];
        this.upcomingLoadsLoading = false;
      }
    });
  }

  loadDriverIncidents(): void {
    this.incidentsLoading = true;
    // Load unresolved incidents first (most important)
    this.complianceService.getMyIncidents(false, this.skipGlobalHttpLoading).subscribe({
      next: (data) => {
        // Sort by incident date (most recent first)
        this.driverIncidents = data.sort((a, b) => {
          const dateA = new Date(a.incidentDate).getTime();
          const dateB = new Date(b.incidentDate).getTime();
          return dateB - dateA;
        }).slice(0, 5); // Limit to 5 most recent
        this.incidentsLoading = false;
      },
      error: (err) => {
        console.error('Error loading driver incidents:', err);
        this.driverIncidents = [];
        this.incidentsLoading = false;
      }
    });
  }

  loadAuditLogs(): void {
    this.auditLogsLoading = true;
    this.adminService
      .getAuditLogs(undefined, undefined, undefined, undefined, undefined, 1, 5, this.skipGlobalHttpLoading)
      .subscribe({
      next: (data) => {
        this.recentAuditLogs = data.items?.slice(0, 5) ?? [];
        this.auditLogsLoading = false;
      },
      error: () => {
        this.recentAuditLogs = [];
        this.auditLogsLoading = false;
      }
    });
  }

  getAuditRelativeTime(timestamp: string): string {
    const now = new Date();
    const timestampStr = timestamp?.trim() ?? '';
    if (!timestampStr) return '-';
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
    return this.timeZoneService.formatDate(time.toISOString(), 'MMM d, y') || time.toLocaleDateString();
  }

  formatAuditTimestamp(timestamp: string): string {
    return this.timeZoneService.formatDateTime(timestamp);
  }

  formatAuditAction(action: string): string {
    if (!action) return '';
    const lower = action.toLowerCase();
    if (lower === 'create') return 'Created';
    if (lower === 'update') return 'Updated';
    if (lower === 'delete') return 'Deleted';
    return action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
  }

  getAuditRelativeTimeShort(timestamp: string): string {
    const full = this.getAuditRelativeTime(timestamp);
    return full.replace('minute ', 'min ').replace('minutes ', 'min ').replace(' hour ', ' hr ').replace(' hours ', ' hrs ');
  }

  getSeverityBadgeClass(severity: string): string {
    const severityMap: { [key: string]: string } = {
      'Low': 'bg-info',
      'Medium': 'bg-warning',
      'High': 'bg-danger',
      'Critical': 'bg-danger'
    };
    return severityMap[severity] || 'bg-secondary';
  }

  hasChartData(chartData: ChartData<any> | undefined): boolean {
    if (!chartData?.datasets?.[0]?.data || chartData.datasets[0].data.length === 0) {
      return false;
    }
    // Check if there's at least one non-zero value
    const data = chartData.datasets[0].data as number[];
    return data.some(value => value > 0);
  }

  hasFleetChartData(): boolean {
    if (!this.fleetChartData?.datasets?.[0]?.data) {
      return false;
    }
    const data = this.fleetChartData.datasets[0].data as number[];
    return data.length > 0 && data.some(d => d > 0);
  }
}

import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { map, Observable, forkJoin } from 'rxjs';
import { DriverService } from '../../../core/services/driver.service';
import { AuthService } from '../../../core/services/auth';
import { Driver } from '../../../core/models/driver.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, FilterState } from '../../../shared/components/data-table/data-table.models';
import { PagedResult } from '../../../core/models/load.model';

@Component({
  selector: 'app-driver-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DataTableComponent],
  templateUrl: './driver-list.html',
  styleUrl: './driver-list.scss',
})
export class DriverListComponent implements OnInit {
  ownerOperatorCardsLoading = false;
  ownerOperatorCards = {
    fleetStatus: {
      activeOO: 0,
      totalOO: 0,
      onRoad: 0,
      idle: 0,
      offDuty: 0
    },
    complianceHealth: {
      healthScore: 0,
      expiredOrExpiringDocs: 0,
      safetyAlerts: 0,
      actionRequired: 0
    }
  };
  showStatusModal = false;
  showBulkStatusModal = false;
  selectedDriver: Driver | null = null;
  selectedDrivers: Set<number> = new Set();
  bulkNewStatus: string = '';

  // Filters
  statusFilter: string = '';
  typeFilter: string = '';

  // Table
  tableConfig!: TableConfig<Driver>;
  tableRefreshTrigger = 0;
  @ViewChild('driverActionsCell', { static: true }) driverActionsCell!: TemplateRef<{ $implicit: Driver }>;
  @ViewChild('referralsCell', { static: true }) referralsCell!: TemplateRef<{ $implicit: Driver }>;

  statusOptions = ['Active', 'OnTrip', 'Available', 'OffDuty'];
  typeOptions = ['Employee', 'OwnerOperator'];
  newStatus: string = '';
  /** When true, this page shows only inactive drivers (route /drivers/inactive). */
  inactiveOnlyPage = false;

  constructor(
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService
  ) {}


  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.inactiveOnlyPage = !!data['inactiveOnly'];
    if (this.inactiveOnlyPage) {
      this.statusFilter = 'Inactive';
    }
    this.initializeTableConfig();
    if (!this.inactiveOnlyPage) {
      this.loadOwnerOperatorCardStats();
    }
  }

  initializeTableConfig(): void {
    const isDispatcher = this.authService.hasRole('Dispatcher');
    this.tableConfig = {
      columns: [
        {
          key: 'driverId',
          label: 'Id',
          type: 'custom',
          sortable: true,
          width: '90px',
          render: (row) => 'RO' + row.driverId
        },
        {
          key: 'fullName',
          label: 'Name',
          type: 'custom',
          sortable: true,
          render: (row) => row.fullName
        },
        {
          key: 'status',
          label: 'Status',
          type: 'badge',
          sortable: true,
          badgeClass: (row) => this.getStatusBadgeClass(row.status),
          render: (row) => row.status
        },
        {
          key: 'referrerName',
          label: 'Referred By',
          type: 'custom',
          sortable: false,
          width: '140px',
          render: (row) => row.referrerName || '-'
        },
        {
          key: 'referralCount',
          label: 'Referrals',
          type: 'template',
          cellTemplate: this.referralsCell,
          sortable: false,
          width: '100px'
        },
        {
          key: 'mobilePhone',
          label: 'Phone',
          type: 'custom',
          sortable: true,
          width: '130px',
          render: (row) => row.mobilePhone || '-'
        },
        {
          key: 'email',
          label: 'Email',
          type: 'custom',
          sortable: true,
          width: '180px',
          render: (row) => row.email || '-'
        },
        {
          key: 'actions',
          label: 'Actions',
          type: 'template',
          cellTemplate: this.driverActionsCell,
          width: '120px',
          align: 'right'
        }
      ],
      // Dispatchers should have read-only list access (no select-all / row checkboxes).
      enableSelection: !isDispatcher,
      enableGlobalSearch: true,
      enablePagination: true,
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
      emptyMessage: 'No owner operators found. Try adjusting your filters.',
      rowClickable: true
    };
  }

  dataSource = (filters: FilterState): Observable<PagedResult<Driver>> => {
    const pageNumber = filters.pageNumber || 1;
    const pageSize = filters.pageSize || 20;
    const search = filters.globalSearch?.trim() || undefined;

    return this.driverService.getDrivers(
      this.statusFilter || undefined,
      this.typeFilter || undefined,
      undefined,
      search,
      pageNumber,
      pageSize
    ).pipe(
      map((data) => {
        const totalPages = data.totalPages ?? Math.max(1, Math.ceil((data.totalCount || 0) / pageSize));
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
  };

  selectStatusTab(status: string): void {
    this.statusFilter = status;
    this.tableRefreshTrigger++;
    this.loadOwnerOperatorCardStats();
  }

  onSelectionChange(rows: Driver[]): void {
    this.selectedDrivers = new Set(rows.map((d) => d.driverId));
  }

  openStatusModal(driver: Driver): void {
    this.selectedDriver = driver;
    this.newStatus = driver.status;
    this.showStatusModal = true;
  }

  updateStatus(): void {
    if (!this.selectedDriver) return;

    this.driverService.updateDriverStatus(this.selectedDriver.driverId, this.newStatus).subscribe({
      next: () => {
        this.showStatusModal = false;
        this.selectedDriver = null;
        this.tableRefreshTrigger++;
        this.loadOwnerOperatorCardStats();
      },
      error: (err) => {
        console.error('Error updating driver status:', err);
        alert('Failed to update driver status');
      }
    });
  }

  viewDriverDetails(driver: Driver): void {
    this.router.navigate(['/drivers', driver.driverId]);
  }

  navigateToDetail(id: number): void {
    this.router.navigate(['/drivers', id]);
  }

  navigateToCreate(): void {
    this.router.navigate(['/drivers/create']);
  }

  navigateToEdit(id: number): void {
    this.router.navigate(['/drivers', id, 'edit']);
  }

  deleteDriver(driver: Driver): void {
    if (!confirm(`Are you sure you want to delete driver ${driver.fullName}?`)) {
      return;
    }

    this.driverService.deleteDriver(driver.driverId).subscribe({
      next: () => {
        this.tableRefreshTrigger++;
      },
      error: (err) => {
        console.error('Error deleting driver:', err);
        let errorMessage = 'Failed to delete driver';
        if (err.error?.message) {
          errorMessage = err.error.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        alert(errorMessage);
      }
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Active':
      case 'Available':
        return 'badge bg-success';
      case 'OnTrip':
        return 'badge bg-primary';
      case 'Inactive':
        return 'badge bg-secondary';
      case 'OffDuty':
        return 'badge bg-warning';
      default:
        return 'badge bg-secondary';
    }
  }

  getTypeBadgeClass(type: string): string {
    if (type === 'Employee') {
      return 'badge bg-primary';
    } else if (type === 'OwnerOperator') {
      return 'badge bg-warning text-dark';
    }
    return 'badge bg-secondary';
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  getReferralLink(driverId: number): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/auth/login?ref=${driverId}`;
  }

  copyReferralLink(driver: Driver): void {
    const link = this.getReferralLink(driver.driverId);
    
    // Try modern clipboard API (only works in secure contexts - HTTPS)
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
    const isSecureContext = typeof window !== 'undefined' ? window.isSecureContext : false;
    
    if (clipboard && isSecureContext && typeof clipboard.writeText === 'function') {
      clipboard.writeText(link).then(() => {
        alert(`Referral link for ${driver.fullName} copied to clipboard!\n\nLink: ${link}\nReferral Code: ${driver.driverId}`);
      }).catch((err) => {
        console.error('Failed to copy using clipboard API:', err);
        this.fallbackCopyToClipboard(link, driver.fullName, driver.driverId);
      });
      return;
    }
    
    // Use fallback for non-secure contexts or older browsers
    this.fallbackCopyToClipboard(link, driver.fullName, driver.driverId);
  }

  private fallbackCopyToClipboard(text: string, driverName: string, driverId: number): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Make it invisible but still selectable
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert(`Referral link for ${driverName} copied to clipboard!\n\nLink: ${text}\nReferral Code: ${driverId}`);
      } else {
        alert(`Failed to copy automatically. Please manually copy the link:\n\n${text}\n\nReferral Code: ${driverId}`);
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert(`Failed to copy automatically. Please manually copy the link:\n\n${text}\n\nReferral Code: ${driverId}`);
    } finally {
      document.body.removeChild(textArea);
    }
  }

  canEditDriver(): boolean {
    return this.authService.hasAnyRole(['Admin']);
  }

  canAccessSettlements(): boolean {
    return !this.authService.hasRole('Dispatcher');
  }

  bulkUpdateStatus(): void {
    if (this.authService.hasRole('Dispatcher')) {
      return;
    }

    if (this.selectedDrivers.size === 0) {
      alert('Please select at least one driver');
      return;
    }
    this.bulkNewStatus = this.statusOptions[0] ?? 'Active';
    this.showBulkStatusModal = true;
  }

  closeBulkStatusModal(): void {
    this.showBulkStatusModal = false;
    this.bulkNewStatus = '';
  }

  confirmBulkUpdateStatus(): void {
    if (!this.bulkNewStatus) return;

    const updates = Array.from(this.selectedDrivers).map((id) =>
      this.driverService.updateDriverStatus(id, this.bulkNewStatus)
    );
    forkJoin(updates).subscribe({
      next: () => {
        this.closeBulkStatusModal();
        alert(`${this.selectedDrivers.size} driver(s) updated successfully`);
        this.selectedDrivers = new Set();
        this.tableRefreshTrigger++;
        this.loadOwnerOperatorCardStats();
      },
      error: (err) => {
        console.error('Error updating drivers:', err);
        alert('Failed to update some drivers');
      }
    });
  }

  quickAction(driver: Driver, action: string): void {
    switch (action) {
      case 'documents':
        this.router.navigate(['/drivers', driver.driverId], { queryParams: { tab: 'documents' } });
        break;
      case 'loads':
        this.router.navigate(['/drivers', driver.driverId, 'loads']);
        break;
      case 'settlements':
        if (!this.canAccessSettlements()) {
          return;
        }
        this.router.navigate(['/drivers', driver.driverId], { queryParams: { tab: 'settlements' } });
        break;
      case 'analytics':
        this.router.navigate(['/drivers', driver.driverId, 'analytics']);
        break;
    }
  }

  exportDrivers(): void {
    this.driverService.getDrivers(
      this.statusFilter || undefined,
      this.typeFilter || undefined,
      undefined,
      undefined,
      1,
      5000
    ).subscribe({
      next: (data) => {
        const drivers = data.items || [];
        const headers = ['Driver ID', 'Full Name', 'Email', 'Phone', 'Type', 'Status', 'Hire Date'];
        const rows = drivers.map((d: Driver) => [
          d.driverId.toString(),
          d.fullName,
          d.email || '',
          d.mobilePhone || '',
          d.type ?? '',
          d.status,
          d.hireDate ? new Date(d.hireDate).toLocaleDateString() : ''
        ]);
        const csvContent = [
          headers.join(','),
          ...rows.map((row: string[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `drivers-export-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      error: () => alert('Failed to export drivers')
    });
  }

  private loadOwnerOperatorCardStats(): void {
    this.ownerOperatorCardsLoading = true;
    this.driverService.getDrivers(
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      5000
    ).subscribe({
      next: (result) => {
        const allOwnerOperators = result.items || [];
        const filteredOwnerOperators = this.statusFilter
          ? allOwnerOperators.filter((oo) => oo.status === this.statusFilter)
          : allOwnerOperators;

        this.ownerOperatorCards = {
          fleetStatus: this.computeFleetStatus(filteredOwnerOperators),
          complianceHealth: this.computeComplianceHealth(filteredOwnerOperators)
        };
        this.ownerOperatorCardsLoading = false;
      },
      error: () => {
        this.ownerOperatorCardsLoading = false;
      }
    });
  }

  private computeFleetStatus(ownerOperators: Driver[]) {
    const activeStatuses = new Set(['Active', 'Available', 'OnTrip']);
    return {
      activeOO: ownerOperators.filter((oo) => activeStatuses.has(oo.status)).length,
      totalOO: ownerOperators.length,
      onRoad: ownerOperators.filter((oo) => oo.status === 'OnTrip').length,
      idle: ownerOperators.filter((oo) => oo.status === 'Available').length,
      offDuty: ownerOperators.filter((oo) => oo.status === 'OffDuty').length
    };
  }

  private computeComplianceHealth(ownerOperators: Driver[]) {
    const expiredOrExpiringDocs = ownerOperators.filter((oo) => oo.isLicenseExpired || oo.isLicenseExpiringSoon).length;
    const actionRequired = ownerOperators.filter((oo) => oo.isLicenseExpired || oo.status === 'Inactive').length;
    const compliantCount = ownerOperators.filter((oo) => !oo.isLicenseExpired && !oo.isLicenseExpiringSoon && oo.status !== 'Inactive').length;
    const healthScore = ownerOperators.length > 0 ? Math.round((compliantCount / ownerOperators.length) * 100) : 0;

    return {
      healthScore,
      expiredOrExpiringDocs,
      safetyAlerts: 0,
      actionRequired
    };
  }
}

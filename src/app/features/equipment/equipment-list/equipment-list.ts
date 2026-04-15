import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';
import { EquipmentService } from '../../../core/services/equipment.service';
import { DriverService } from '../../../core/services/driver.service';
import { Equipment, CreateEquipmentRequest, UpdateEquipmentRequest, CreateMaintenanceLogRequest, MaintenanceLog } from '../../../core/models/equipment.model';
import { Driver } from '../../../core/models/driver.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { FilterState, TableConfig } from '../../../shared/components/data-table/data-table.models';
import { PagedResult } from '../../../core/models/load.model';

@Component({
  selector: 'app-equipment-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DataTableComponent],
  templateUrl: './equipment-list.html',
  styleUrl: './equipment-list.scss',
})
export class EquipmentListComponent implements OnInit {
  showCreateModal = false;
  showEditModal = false;
  showMaintenanceModal = false;
  showLogsModal = false;
  selectedEquipment: Equipment | null = null;
  maintenanceLogs: MaintenanceLog[] = [];
  loadingLogs = false;
  filterType?: string;
  filterStatus?: string;

  newEquipment: CreateEquipmentRequest = {
    equipmentType: 'Truck',
    status: 'Active'
  };

  editingEquipmentId: number | null = null;
  editEquipment: UpdateEquipmentRequest = {
    equipmentType: 'Truck',
    status: 'Active'
  };

  maintenanceLog: CreateMaintenanceLogRequest = {
    equipmentId: 0,
    serviceType: '',
    serviceDate: new Date().toISOString().split('T')[0],
    cost: 0
  };

  equipmentTypes = ['Truck', 'Trailer', 'Reefer'];
  statusOptions: string[] = [];
  editingStatusEquipmentId: number | null = null;
  drivers: Driver[] = [];
  errorMessage: string = '';
  editErrorMessage: string = '';
  maintenanceErrorMessage: string = '';

  // Table configuration
  tableConfig!: TableConfig<Equipment>;
  tableRefreshTrigger = 0; // Trigger to refresh the table

  @ViewChild(DataTableComponent) dataTable?: DataTableComponent<Equipment>;
  @ViewChild('equipmentTypeCell', { static: true }) equipmentTypeCell!: TemplateRef<{ $implicit: Equipment }>;
  @ViewChild('equipmentStatusCell', { static: true }) equipmentStatusCell!: TemplateRef<{ $implicit: Equipment }>;
  @ViewChild('equipmentActionsCell', { static: true }) equipmentActionsCell!: TemplateRef<{ $implicit: Equipment }>;

  constructor(
    private equipmentService: EquipmentService,
    private driverService: DriverService
  ) {}

  ngOnInit(): void {
    this.loadStatuses();
    this.loadDrivers();
    this.initializeTableConfig();
  }

  initializeTableConfig(): void {
    this.tableConfig = {
      columns: [
        {
          key: 'equipmentType',
          label: 'Type',
          type: 'template',
          cellTemplate: this.equipmentTypeCell,
          sortable: true,
          width: '120px'
        },
        {
          key: 'plateNumber',
          label: 'Plate Number',
          type: 'text',
          sortable: true,
          width: '150px',
          render: (row) => row.plateNumber || '-'
        },
        {
          key: 'makeModel',
          label: 'Make/Model',
          type: 'custom',
          sortable: true,
          render: (row) => {
            if (row.make || row.model) {
              return `${row.make || ''}${row.make && row.model ? ' ' : ''}${row.model || ''}`.trim();
            }
            return '-';
          }
        },
        {
          key: 'currentOdometer',
          label: 'Odometer',
          type: 'custom',
          sortable: true,
          width: '120px',
          align: 'right',
          render: (row) => this.formatOdometer(row.currentOdometer)
        },
        {
          key: 'status',
          label: 'Status',
          type: 'template',
          cellTemplate: this.equipmentStatusCell,
          sortable: true,
          width: '200px'
        },
        {
          key: 'actions',
          label: 'Actions',
          type: 'template',
          cellTemplate: this.equipmentActionsCell,
          width: '180px',
          align: 'center'
        }
      ],
      enableSelection: false,
      enableGlobalSearch: true,
      enablePagination: true,
      defaultPageSize: 50,
      emptyMessage: 'No equipment found',
      rowClickable: false
    };
  }

  // Data source function for universal table
  dataSource = (filters: FilterState): Observable<PagedResult<Equipment>> => {
    const typeFilter = this.filterType === undefined ? undefined : this.filterType;
    const statusFilter = this.filterStatus === undefined ? undefined : this.filterStatus;

    return this.equipmentService.getEquipments(typeFilter, statusFilter).pipe(
      map((equipments: Equipment[]) => {
        let rows = equipments || [];

        // Apply global search filter
        if (filters.globalSearch) {
          const search = filters.globalSearch.toLowerCase().trim();
          rows = rows.filter(equipment => {
            const plateNumber = equipment.plateNumber?.toLowerCase() || '';
            const make = equipment.make?.toLowerCase() || '';
            const model = equipment.model?.toLowerCase() || '';
            const equipmentType = equipment.equipmentType?.toLowerCase() || '';
            const makeModel = `${make} ${model}`.trim();

            return plateNumber.includes(search) ||
              make.includes(search) ||
              model.includes(search) ||
              equipmentType.includes(search) ||
              makeModel.includes(search);
          });
        }

        // Apply sorting
        if (filters.sortColumn && filters.sortDirection) {
          const dir = filters.sortDirection === 'asc' ? 1 : -1;
          rows = [...rows].sort((a, b) => {
            const aVal = this.getSortValue(a, filters.sortColumn!);
            const bVal = this.getSortValue(b, filters.sortColumn!);
            if (aVal < bVal) return -1 * dir;
            if (aVal > bVal) return 1 * dir;
            return 0;
          });
        }

        // Calculate pagination
        const totalCount = rows.length;
        const pageSize = filters.pageSize || 50;
        const pageNumber = filters.pageNumber || 1;
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginated = rows.slice(startIndex, endIndex);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

        return {
          items: paginated,
          totalCount,
          pageNumber,
          pageSize,
          totalPages,
          hasPreviousPage: pageNumber > 1,
          hasNextPage: pageNumber < totalPages
        };
      })
    );
  }

  private getSortValue(equipment: Equipment, column: string): any {
    switch (column) {
      case 'equipmentType':
        return equipment.equipmentType?.toLowerCase() || '';
      case 'plateNumber':
        return equipment.plateNumber?.toLowerCase() || '';
      case 'makeModel':
        return `${equipment.make || ''} ${equipment.model || ''}`.trim().toLowerCase();
      case 'currentOdometer':
        return equipment.currentOdometer ?? 0;
      case 'status':
        return equipment.status?.toLowerCase() || '';
      default:
        return '';
    }
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        // Filter to show only active and available drivers
        this.drivers = (result?.items || []).filter(driver => 
          driver.status === 'Active' || driver.status === 'Available'
        );
      },
      error: () => {
        this.drivers = [];
      }
    });
  }

  loadStatuses(): void {
    this.equipmentService.getEquipmentStatuses().subscribe({
      next: (statuses) => {
        this.statusOptions = statuses;
      },
      error: () => {
        // Fallback to default statuses if API fails
        this.statusOptions = ['Active', 'Assigned', 'InUse', 'InTransit', 'InMaintenance', 'Retired'];
      }
    });
  }

  openCreateModal(): void {
    this.errorMessage = '';
    this.newEquipment = { equipmentType: 'Truck', status: 'Active' };
    this.showCreateModal = true;
  }

  openEditModal(equipment: Equipment): void {
    this.editErrorMessage = '';
    this.editingEquipmentId = equipment.equipmentId;
    this.editEquipment = {
      equipmentType: equipment.equipmentType,
      vin: equipment.vin,
      plateNumber: equipment.plateNumber,
      make: equipment.make,
      model: equipment.model,
      yearManufactured: equipment.yearManufactured,
      currentOdometer: equipment.currentOdometer,
      status: equipment.status,
      assignedToDriverId: equipment.assignedToDriverId
    };
    this.showEditModal = true;
  }

  updateEquipment(): void {
    this.editErrorMessage = '';

    if (!this.editingEquipmentId) {
      this.editErrorMessage = 'No equipment selected for editing.';
      return;
    }

    const validationError = this.validateEquipmentForMotive(this.editEquipment);
    if (validationError) {
      this.editErrorMessage = validationError;
      return;
    }

    this.equipmentService.updateEquipment(this.editingEquipmentId, this.editEquipment).subscribe({
      next: () => {
        this.showEditModal = false;
        this.editingEquipmentId = null;
        this.editErrorMessage = '';
        this.refreshTable();
      },
      error: (error) => {
        console.error('Error updating equipment:', error);
        if (error.error?.message) {
          this.editErrorMessage = error.error.message;
        } else if (error.error?.errors && Array.isArray(error.error.errors)) {
          this.editErrorMessage = error.error.errors.join(', ');
        } else {
          this.editErrorMessage = 'Failed to update equipment. Please try again.';
        }
      }
    });
  }

  createEquipment(): void {
    this.errorMessage = '';

    const validationError = this.validateEquipmentForMotive(this.newEquipment);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.equipmentService.createEquipment(this.newEquipment).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.newEquipment = { equipmentType: 'Truck', status: 'Active' };
        this.errorMessage = '';
        this.refreshTable();
      },
      error: (error) => {
        console.error('Error creating equipment:', error);
        // Extract error message from API response
        if (error.error?.message) {
          this.errorMessage = error.error.message;
        } else if (error.error?.errors && Array.isArray(error.error.errors)) {
          this.errorMessage = error.error.errors.join(', ');
        } else {
          this.errorMessage = 'Failed to create equipment. Please try again.';
        }
      }
    });
  }

  validateEquipmentForMotive(req: CreateEquipmentRequest | UpdateEquipmentRequest): string | null {
    const type = req.equipmentType;
    const isAsset = type === 'Trailer' || type === 'Reefer';

    if (!type) return 'Equipment type is required.';
    if (!req.status) return 'Status is required.';

    if (isAsset) {
      if (!req.make || req.make.trim() === '') return 'Make is required for Trailer/Reefer equipment.';
      if (!req.model || req.model.trim() === '') return 'Model is required for Trailer/Reefer equipment.';
      if (req.yearManufactured === undefined || req.yearManufactured === null) return 'Year Manufactured is required for Trailer/Reefer equipment.';
    }

    return null;
  }

  openMaintenanceModal(equipment: Equipment): void {
    this.selectedEquipment = equipment;
    this.maintenanceErrorMessage = '';
    this.maintenanceLog = {
      equipmentId: equipment.equipmentId,
      serviceType: '',
      serviceDate: new Date().toISOString().split('T')[0],
      cost: 0,
      odometerAtService: undefined,
      vendor: '',
      remarks: ''
    };
    this.showMaintenanceModal = true;
  }

  addMaintenanceLog(form?: any): void {
    // Mark all fields as touched to show validation errors
    if (form) {
      Object.keys(form.controls).forEach(key => {
        form.controls[key].markAsTouched();
      });
    }

    // Frontend validation
    if (!this.maintenanceLog.serviceType || this.maintenanceLog.serviceType.trim() === '') {
      this.maintenanceErrorMessage = 'Service type is required.';
      return;
    }

    if (!this.maintenanceLog.serviceDate) {
      this.maintenanceErrorMessage = 'Service date is required.';
      return;
    }

    // Check if service date is in the future
    if (this.isServiceDateInvalid()) {
      this.maintenanceErrorMessage = 'Service date cannot be in the future.';
      return;
    }

    if (this.maintenanceLog.cost < 0) {
      this.maintenanceErrorMessage = 'Cost cannot be negative.';
      return;
    }

    if (this.maintenanceLog.odometerAtService === undefined || this.maintenanceLog.odometerAtService === null) {
      this.maintenanceErrorMessage = 'Odometer at service is required.';
      return;
    }

    if (this.maintenanceLog.odometerAtService < 0) {
      this.maintenanceErrorMessage = 'Odometer reading cannot be negative.';
      return;
    }

    if (!this.maintenanceLog.vendor || this.maintenanceLog.vendor.trim() === '') {
      this.maintenanceErrorMessage = 'Vendor is required.';
      return;
    }

    if (!this.maintenanceLog.remarks || this.maintenanceLog.remarks.trim() === '') {
      this.maintenanceErrorMessage = 'Remarks are required.';
      return;
    }

    // Prevent submission if form is invalid
    if (form && form.invalid) {
      this.maintenanceErrorMessage = 'Please fill in all required fields correctly.';
      return;
    }

    this.maintenanceErrorMessage = '';
    this.equipmentService.addMaintenanceLog(this.maintenanceLog).subscribe({
      next: () => {
        this.showMaintenanceModal = false;
        this.selectedEquipment = null;
        this.maintenanceErrorMessage = '';
        this.refreshTable();
      },
      error: (error) => {
        console.error('Error adding maintenance log:', error);
        // Extract error message from API response
        if (error.error?.message) {
          this.maintenanceErrorMessage = error.error.message;
        } else if (error.error?.errors && Array.isArray(error.error.errors)) {
          this.maintenanceErrorMessage = error.error.errors.join(', ');
        } else {
          this.maintenanceErrorMessage = 'Failed to add maintenance log. Please try again.';
        }
      }
    });
  }

  isServiceDateInvalid(): boolean {
    if (!this.maintenanceLog.serviceDate) {
      return false; // Let required validation handle this
    }
    const serviceDate = new Date(this.maintenanceLog.serviceDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    return serviceDate > today;
  }

  openLogsModal(equipment: Equipment): void {
    this.selectedEquipment = equipment;
    this.showLogsModal = true;
    this.loadMaintenanceLogs(equipment.equipmentId);
  }

  loadMaintenanceLogs(equipmentId: number): void {
    this.loadingLogs = true;
    this.equipmentService.getMaintenanceLogs(equipmentId).subscribe({
      next: (logs) => {
        this.maintenanceLogs = logs;
        this.loadingLogs = false;
      },
      error: () => {
        this.maintenanceLogs = [];
        this.loadingLogs = false;
      }
    });
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  applyFilters(): void {
    // External filters should reset table to first page
    if (this.dataTable) {
      this.dataTable.filterState.pageNumber = 1;
    }
    this.refreshTable();
  }

  clearFilters(): void {
    this.filterType = undefined;
    this.filterStatus = undefined;
    // Reset table internal filters/search/sort/pagination
    this.dataTable?.clearFilters();
    this.refreshTable();
  }

  formatOdometer(odometer?: number): string {
    if (!odometer) return '-';
    return odometer.toLocaleString() + ' mi';
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  updateEquipmentStatus(equipment: Equipment, newStatus: string): void {
    if (equipment.status === newStatus) {
      return;
    }

    const oldStatus = equipment.status;
    equipment.status = newStatus;

    this.equipmentService.updateEquipmentStatus(equipment.equipmentId, newStatus).subscribe({
      next: () => {
        // Status updated successfully
        this.refreshTable();
      },
      error: (error) => {
        // Revert on error
        equipment.status = oldStatus;
        const errorMessage = error.error?.message || 'Failed to update equipment status. Please try again.';
        alert(errorMessage);
      }
    });
  }

  setToActive(equipment: Equipment): void {
    if (equipment.status === 'Active') {
      return;
    }
    this.updateEquipmentStatus(equipment, 'Active');
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Active': 'badge-success',
      'Assigned': 'badge-info',
      'InUse': 'badge-primary',
      'InTransit': 'badge-primary',
      'InMaintenance': 'badge-warning',
      'Retired': 'badge-danger'
    };
    return statusMap[status] || 'badge-secondary';
  }

  getStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'Active': 'fa-check-circle',
      'Assigned': 'fa-clipboard-check',
      'InUse': 'fa-truck',
      'InTransit': 'fa-truck-moving',
      'InMaintenance': 'fa-wrench',
      'Retired': 'fa-ban'
    };
    return iconMap[status] || 'fa-circle';
  }

  deleteEquipment(equipment: Equipment): void {
    if (!confirm(`Are you sure you want to delete ${equipment.equipmentType}${equipment.plateNumber ? ' (' + equipment.plateNumber + ')' : ''}? This action cannot be undone.`)) {
      return;
    }

    this.equipmentService.deleteEquipment(equipment.equipmentId).subscribe({
      next: () => {
        this.refreshTable();
      },
      error: (error) => {
        console.error('Error deleting equipment:', error);
        const errorMessage = error.error?.message || 'Failed to delete equipment. Please try again.';
        alert(errorMessage);
      }
    });
  }

  private refreshTable(): void {
    this.tableRefreshTrigger++;
  }
}

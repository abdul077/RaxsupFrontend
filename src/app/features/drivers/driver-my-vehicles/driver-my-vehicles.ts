import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { map, Observable, of } from 'rxjs';
import { EquipmentService } from '../../../core/services/equipment.service';
import { DriverService } from '../../../core/services/driver.service';
import { Equipment } from '../../../core/models/equipment.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, FilterState } from '../../../shared/components/data-table/data-table.models';
import { PagedResult } from '../../../core/models/load.model';

@Component({
  selector: 'app-driver-my-vehicles',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent],
  templateUrl: './driver-my-vehicles.html',
  styleUrl: './driver-my-vehicles.scss',
})
export class DriverMyVehiclesComponent implements OnInit {
  /** Current driver's ID from getMyProfile(); used to filter equipment. */
  myDriverId: number | null = null;
  loadingProfile = true;
  tableConfig!: TableConfig<Equipment>;
  tableRefreshTrigger = 0;
  @ViewChild('equipmentTypeCell', { static: true }) equipmentTypeCell!: TemplateRef<{ $implicit: Equipment }>;
  @ViewChild('equipmentStatusCell', { static: true }) equipmentStatusCell!: TemplateRef<{ $implicit: Equipment }>;
  @ViewChild('vehicleActionsCell', { static: true }) vehicleActionsCell!: TemplateRef<{ $implicit: Equipment }>;

  constructor(
    private equipmentService: EquipmentService,
    private driverService: DriverService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeTableConfig();
    this.driverService.getMyProfile().subscribe({
      next: (profile) => {
        this.myDriverId = profile?.driverId ?? null;
        this.loadingProfile = false;
        this.tableRefreshTrigger++;
      },
      error: () => {
        this.myDriverId = null;
        this.loadingProfile = false;
        this.tableRefreshTrigger++;
      }
    });
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
          width: '140px'
        },
        {
          key: 'actions',
          label: 'Actions',
          type: 'template',
          cellTemplate: this.vehicleActionsCell,
          width: '100px',
          align: 'right'
        }
      ],
      enableSelection: false,
      enableGlobalSearch: true,
      enablePagination: true,
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
      emptyMessage: 'No vehicles assigned to you.',
      rowClickable: true
    };
  }

  dataSource = (filters: FilterState): Observable<PagedResult<Equipment>> => {
    if (this.myDriverId == null) {
      return of({
        items: [],
        totalCount: 0,
        pageNumber: filters.pageNumber || 1,
        pageSize: filters.pageSize || 20,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false
      });
    }
    const driverId = this.myDriverId;
    return this.equipmentService.getEquipments(undefined, undefined).pipe(
      map((equipments: Equipment[]) => {
        let rows = (equipments || []).filter(e => e.assignedToDriverId === driverId);

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

        const totalCount = rows.length;
        const pageSize = filters.pageSize || 20;
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
  };

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

  formatOdometer(value: number | undefined): string {
    if (value == null) return '-';
    return value.toLocaleString();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Active':
        return 'badge bg-success';
      case 'Assigned':
      case 'InUse':
      case 'InTransit':
        return 'badge bg-primary';
      case 'InMaintenance':
        return 'badge bg-warning text-dark';
      case 'Retired':
        return 'badge bg-secondary';
      default:
        return 'badge bg-secondary';
    }
  }

  viewVehicleDetails(equipment: Equipment): void {
    this.router.navigate(['/equipment', equipment.equipmentId], {
      state: { equipmentReturnUrl: '/drivers/my-vehicles' }
    });
  }
}

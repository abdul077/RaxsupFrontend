import { Component, OnInit, ViewChild, TemplateRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoadService } from '../../../core/services/load.service';
import { AccessorialType, CreateAccessorialTypeRequest, UpdateAccessorialTypeRequest, PagedResult } from '../../../core/models/load.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, FilterState } from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-accessorial-type-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './accessorial-type-list.html',
  styleUrl: './accessorial-type-list.scss',
})
export class AccessorialTypeListComponent implements OnInit {
  // Modals
  showCreateModal = false;
  showEditModal = false;
  selectedAccessorialType: AccessorialType | null = null;

  // Form data
  newAccessorialType: CreateAccessorialTypeRequest = {
    name: '',
    description: ''
  };
  editAccessorialType: UpdateAccessorialTypeRequest = {};

  // Table
  tableConfig!: TableConfig<AccessorialType>;
  tableRefreshTrigger = 0;
  @ViewChild('actionsCell', { static: true }) actionsCell!: TemplateRef<{ $implicit: AccessorialType }>;

  constructor(private loadService: LoadService) {}

  ngOnInit(): void {
    this.initializeTableConfig();
  }

  initializeTableConfig(): void {
    this.tableConfig = {
      columns: [
        {
          key: 'name',
          label: 'Name',
          type: 'custom',
          sortable: true,
          render: (row) => row.name
        },
        {
          key: 'description',
          label: 'Description',
          type: 'custom',
          sortable: true,
          render: (row) => row.description || '-'
        },
        {
          key: 'actions',
          label: '',
          type: 'template',
          cellTemplate: this.actionsCell,
          width: '50px',
          align: 'right'
        }
      ],
      enableSelection: false,
      enableGlobalSearch: true,
      enablePagination: true,
      defaultPageSize: 25,
      pageSizeOptions: [10, 25, 50, 100],
      emptyMessage: 'No accessorial types found. Create a new one to get started.',
      rowClickable: false,
    };
  }

  /** DataSource: wraps the flat array API into a PagedResult Observable for the data-table. */
  dataSource = (filters: FilterState): Observable<PagedResult<AccessorialType>> => {
    return this.loadService.getAccessorialTypes().pipe(
      map((allItems) => {
        let items = [...allItems];

        // Apply global search filter
        const search = filters.globalSearch?.trim().toLowerCase();
        if (search) {
          items = items.filter(item =>
            item.name.toLowerCase().includes(search) ||
            (item.description && item.description.toLowerCase().includes(search))
          );
        }

        // Apply sorting
        if (filters.sortColumn) {
          const col = filters.sortColumn as keyof AccessorialType;
          const dir = filters.sortDirection === 'desc' ? -1 : 1;
          items.sort((a, b) => {
            const aVal = (a[col] ?? '') as string;
            const bVal = (b[col] ?? '') as string;
            return aVal.localeCompare(bVal) * dir;
          });
        }

        // Apply pagination
        const totalCount = items.length;
        const pageSize = filters.pageSize || 25;
        const pageNumber = filters.pageNumber || 1;
        const totalPages = Math.ceil(totalCount / pageSize) || 1;
        const startIndex = (pageNumber - 1) * pageSize;
        const paginatedItems = items.slice(startIndex, startIndex + pageSize);

        return {
          items: paginatedItems,
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

  // --- Modal methods ---

  openCreateModal(): void {
    this.newAccessorialType = { name: '', description: '' };
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.newAccessorialType = { name: '', description: '' };
  }

  openEditModal(accessorialType: AccessorialType): void {
    this.selectedAccessorialType = accessorialType;
    this.editAccessorialType = {
      name: accessorialType.name,
      description: accessorialType.description || ''
    };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedAccessorialType = null;
    this.editAccessorialType = {};
  }

  closeModals(): void {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.selectedAccessorialType = null;
  }

  isCreateFormValid(): boolean {
    return !!(this.newAccessorialType.name && this.newAccessorialType.name.trim());
  }

  isEditFormValid(): boolean {
    return !!(this.editAccessorialType.name && this.editAccessorialType.name.trim());
  }

  createAccessorialType(): void {
    if (!this.isCreateFormValid()) return;

    this.loadService.createAccessorialType(this.newAccessorialType).subscribe({
      next: () => {
        this.closeCreateModal();
        this.tableRefreshTrigger++;
      },
      error: (err) => {
        console.error('Error creating accessorial type:', err);
        alert(err.error?.message || 'Failed to create accessorial type');
      }
    });
  }

  updateAccessorialType(): void {
    if (!this.selectedAccessorialType || !this.isEditFormValid()) return;

    this.loadService.updateAccessorialType(
      this.selectedAccessorialType.accessorialTypeId,
      this.editAccessorialType
    ).subscribe({
      next: () => {
        this.closeEditModal();
        this.tableRefreshTrigger++;
      },
      error: (err) => {
        console.error('Error updating accessorial type:', err);
        alert(err.error?.message || 'Failed to update accessorial type');
      }
    });
  }

  deleteAccessorialType(accessorialType: AccessorialType): void {
    if (!confirm(`Are you sure you want to delete "${accessorialType.name}"?`)) {
      return;
    }

    this.loadService.deleteAccessorialType(accessorialType.accessorialTypeId).subscribe({
      next: () => {
        this.tableRefreshTrigger++;
      },
      error: (err) => {
        console.error('Error deleting accessorial type:', err);
        alert(err.error?.message || 'Failed to delete accessorial type');
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showCreateModal || this.showEditModal) this.closeModals();
  }
}

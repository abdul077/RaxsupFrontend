import { Component, OnInit, AfterViewInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, of } from 'rxjs';
import { CustomerService } from '../../../core/services/customer.service';
import { AuthService } from '../../../core/services/auth';
import { Customer, CreateCustomerRequest } from '../../../core/models/customer.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, TableColumn, FilterState } from '../../../shared/components/data-table/data-table.models';
import { PagedResult } from '../../../core/models/load.model';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DataTableComponent],
  templateUrl: './customer-list.html',
  styleUrl: './customer-list.scss',
})
export class CustomerListComponent implements OnInit, AfterViewInit {
  customers: Customer[] = [];
  showCreateModal = false;
  showEditModal = false;
  /** Accountants can view but not edit or modify brokers */
  canEditCustomers = true;
  selectedCustomer: Customer | null = null;
  newCustomer: CreateCustomerRequest = {
    companyId: undefined,
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    mcNumber: '',
    dotNumber: ''
  };
  editCustomer: CreateCustomerRequest | null = null;

  // Data table configuration
  tableConfig!: TableConfig<Customer>;
  refreshTrigger = 0;
  loading = false;

  @ViewChild('customerActionsCell', { static: true }) customerActionsCell!: TemplateRef<any>;

  constructor(
    private customerService: CustomerService,
    public authService: AuthService
  ) {
    this.canEditCustomers = !this.authService.hasRole('Accountant');
  }

  ngOnInit(): void {
    this.loadCustomers();
  }

  ngAfterViewInit(): void {
    // Setup table config after view init to include templates
    this.setupTableConfig();
    // Trigger refresh to reload with new config
    this.refreshTrigger++;
  }

  private setupTableConfig(): void {
    const columns: TableColumn<Customer>[] = [
      {
        key: 'customerId',
        label: 'ID',
        sortable: true,
        width: '80px',
        render: (customer: Customer) => String(customer.customerId)
      },
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        filterable: true,
        filterType: 'text'
      },
      {
        key: 'contactPerson',
        label: 'Contact Person',
        sortable: true,
        filterable: true,
        filterType: 'text',
        render: (customer: Customer) => customer.contactPerson || '-'
      },
      {
        key: 'email',
        label: 'Email',
        sortable: true,
        filterable: true,
        filterType: 'text',
        render: (customer: Customer) => customer.email || '-'
      },
      {
        key: 'phone',
        label: 'Phone',
        sortable: true,
        filterable: true,
        filterType: 'text',
        render: (customer: Customer) => customer.phone || '-'
      },
      {
        key: 'isActive',
        label: 'Status',
        type: 'badge',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: true, label: 'Active' },
          { value: false, label: 'Inactive' }
        ],
        width: '100px',
        align: 'center',
        badgeClass: (customer: Customer) => customer.isActive ? 'bg-success' : 'bg-danger',
        render: (customer: Customer) => customer.isActive ? 'Active' : 'Inactive'
      }
    ];

    // Add actions column if user can edit brokers
    if (this.canEditCustomers) {
      columns.push({
        key: 'actions',
        label: 'Actions',
        type: 'template',
        width: '80px',
        align: 'center',
        cellTemplate: this.customerActionsCell
      });
    }

    this.tableConfig = {
      columns,
      enableGlobalSearch: true,
      enablePagination: true,
      pageSizeOptions: [25, 50, 100],
      defaultPageSize: 50,
      emptyMessage: 'No brokers found',
      loadingMessage: 'Loading brokers...',
      rowClickable: false
    };
  }

  loadCustomers(): void {
    this.loading = true;
    this.customerService.getCustomers().subscribe({
      next: (data) => {
        this.customers = data;
        this.loading = false;
        this.refreshTrigger++; // Trigger table refresh after data is loaded
      },
      error: (error) => {
        console.error('Error loading brokers:', error);
        this.loading = false;
      }
    });
  }

  // Data source function for the table
  customerDataSource = (filters: FilterState): Observable<PagedResult<Customer>> => {
    let filteredCustomers = [...this.customers];

    // Apply global search
    if (filters.globalSearch) {
      const search = filters.globalSearch.toLowerCase().trim();
      filteredCustomers = filteredCustomers.filter(customer =>
        customer.name.toLowerCase().includes(search) ||
        (customer.contactPerson && customer.contactPerson.toLowerCase().includes(search)) ||
        (customer.email && customer.email.toLowerCase().includes(search)) ||
        (customer.phone && customer.phone.toLowerCase().includes(search)) ||
        (customer.address && customer.address.toLowerCase().includes(search)) ||
        (customer.mcNumber && customer.mcNumber.toLowerCase().includes(search)) ||
        (customer.dotNumber && customer.dotNumber.toLowerCase().includes(search))
      );
    }

    // Apply column filters
    if (filters.columnFilters) {
      Object.keys(filters.columnFilters).forEach(key => {
        const filterValue = filters.columnFilters![key];
        if (filterValue !== null && filterValue !== undefined && filterValue !== '') {
          filteredCustomers = filteredCustomers.filter(customer => {
            const customerValue = (customer as any)[key];
            if (typeof filterValue === 'boolean') {
              return customerValue === filterValue;
            }
            if (typeof customerValue === 'string') {
              return customerValue.toLowerCase().includes(filterValue.toLowerCase());
            }
            return customerValue === filterValue;
          });
        }
      });
    }

    // Apply sorting
    if (filters.sortColumn && filters.sortDirection) {
      filteredCustomers.sort((a, b) => {
        const aValue = (a as any)[filters.sortColumn!];
        const bValue = (b as any)[filters.sortColumn!];
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        else if (aValue > bValue) comparison = 1;
        
        return filters.sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const totalCount = filteredCustomers.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
    const startIndex = (filters.pageNumber - 1) * filters.pageSize;
    const endIndex = startIndex + filters.pageSize;
    const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

    const result: PagedResult<Customer> = {
      items: paginatedCustomers,
      totalCount,
      pageNumber: filters.pageNumber,
      pageSize: filters.pageSize,
      totalPages,
      hasPreviousPage: filters.pageNumber > 1,
      hasNextPage: filters.pageNumber < totalPages
    };

    return of(result);
  };

  openCreateModal(): void {
    this.newCustomer = {
      companyId: undefined,
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      mcNumber: '',
      dotNumber: ''
    };
    this.showCreateModal = true;
  }

  openEditCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.editCustomer = {
      companyId: customer.companyId,
      name: customer.name,
      contactPerson: customer.contactPerson || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      mcNumber: customer.mcNumber || '',
      dotNumber: customer.dotNumber || ''
    };
    this.showEditModal = true;
  }

  createCustomer(): void {
    // Additional client-side validation
    if (!this.newCustomer.name || this.newCustomer.name.trim() === '') {
      alert('Broker name is required');
      return;
    }
    if (!this.newCustomer.contactPerson || this.newCustomer.contactPerson.trim() === '') {
      alert('Contact person is required');
      return;
    }
    if (!this.newCustomer.email || this.newCustomer.email.trim() === '') {
      alert('Email is required');
      return;
    }
    if (!this.newCustomer.phone || this.newCustomer.phone.trim() === '') {
      alert('Phone number is required');
      return;
    }
    if (!this.newCustomer.address || this.newCustomer.address.trim() === '') {
      alert('Address is required');
      return;
    }

    this.customerService.createCustomer(this.newCustomer).subscribe({
      next: (customerId) => {
        this.showCreateModal = false;
        this.loadCustomers();
        this.refreshTrigger++; // Trigger table refresh
      },
      error: (err) => {
        console.error('Error creating broker:', err);
        const errorMessage = err.error?.message || err.error?.errors?.join(', ') || 'Failed to create broker';
        alert(errorMessage);
      }
    });
  }

  updateCustomer(): void {
    if (!this.selectedCustomer || !this.editCustomer) {
      return;
    }

    // Additional client-side validation (same rules as create)
    if (!this.editCustomer.name || this.editCustomer.name.trim() === '') {
      alert('Broker name is required');
      return;
    }
    if (!this.editCustomer.contactPerson || this.editCustomer.contactPerson.trim() === '') {
      alert('Contact person is required');
      return;
    }
    if (!this.editCustomer.email || this.editCustomer.email.trim() === '') {
      alert('Email is required');
      return;
    }
    if (!this.editCustomer.phone || this.editCustomer.phone.trim() === '') {
      alert('Phone number is required');
      return;
    }
    if (!this.editCustomer.address || this.editCustomer.address.trim() === '') {
      alert('Address is required');
      return;
    }

    this.customerService.updateCustomer(this.selectedCustomer.customerId, {
      name: this.editCustomer.name,
      contactPerson: this.editCustomer.contactPerson,
      email: this.editCustomer.email,
      phone: this.editCustomer.phone,
      address: this.editCustomer.address,
      mcNumber: this.editCustomer.mcNumber ?? '',
      dotNumber: this.editCustomer.dotNumber ?? ''
    }).subscribe({
      next: (response) => {
        if (response.success) {
          // Update local array so UI reflects changes immediately
          this.selectedCustomer!.name = this.editCustomer!.name;
          this.selectedCustomer!.contactPerson = this.editCustomer!.contactPerson;
          this.selectedCustomer!.email = this.editCustomer!.email;
          this.selectedCustomer!.phone = this.editCustomer!.phone;
          this.selectedCustomer!.address = this.editCustomer!.address;
          this.selectedCustomer!.mcNumber = this.editCustomer!.mcNumber?.trim() || undefined;
          this.selectedCustomer!.dotNumber = this.editCustomer!.dotNumber?.trim() || undefined;

          this.showEditModal = false;
          this.selectedCustomer = null;
          this.editCustomer = null;
          this.refreshTrigger++;
        }
      },
      error: (err) => {
        console.error('Error updating broker:', err);
        const errorMessage = err.error?.message || err.error?.errors?.join(', ') || 'Failed to update broker';
        alert(errorMessage);
      }
    });
  }

  toggleActive(customer: Customer): void {
    const newActiveStatus = !customer.isActive;
    
    this.customerService.updateCustomer(customer.customerId, { isActive: newActiveStatus }).subscribe({
      next: (response) => {
        if (response.success) {
          // Update the broker in the local array
          customer.isActive = newActiveStatus;
          // Trigger table refresh
          this.refreshTrigger++;
        }
      },
      error: (err) => {
        console.error('Error updating broker status:', err);
        alert(err.error?.message || 'Failed to update broker status');
      }
    });
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedCustomer = null;
    this.editCustomer = null;
  }
}

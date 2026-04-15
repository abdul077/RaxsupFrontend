import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';
import { FinancialService } from '../../../core/services/financial.service';
import { ApiService } from '../../../core/services/api';
import { Invoice } from '../../../core/models/financial.model';
import { Customer } from '../../../core/models/customer.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, FilterState } from '../../../shared/components/data-table/data-table.models';
import { PagedResult } from '../../../core/models/load.model';
import { buildInvoicePdfHtml } from '../../../core/utils/invoice-pdf-template.util';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DataTableComponent],
  templateUrl: './invoice-list.html',
  styleUrl: './invoice-list.scss',
})
export class InvoiceListComponent implements OnInit {
  customers: Customer[] = [];
  loading = false;
  autoInvoiceEnabled = false;
  showSettingsModal = false;

  // Filters (used by dataSource and external filter UI)
  statusFilter: string = '';
  customerFilter: number | null = null;
  dateFrom: string = '';
  dateTo: string = '';
  dateRangeTab: 'all' | 'today' | 'week' | 'month' | 'year' = 'all';

  // From API (server-side totalCount)
  totalCount = 0;

  // Table
  tableConfig!: TableConfig<Invoice>;
  tableRefreshTrigger = 0;
  @ViewChild('invoiceActionsCell', { static: true }) invoiceActionsCell!: TemplateRef<{ $implicit: Invoice }>;

  statusOptions = ['Draft', 'Sent', 'Paid', 'Cancelled'];

  constructor(
    private financialService: FinancialService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeDates();
    this.loadCustomers();
    this.initializeTableConfig();
    this.loadAutoInvoiceSetting();
  }

  initializeDates(): void {
    this.dateFrom = '';
    this.dateTo = '';
  }

  loadAutoInvoiceSetting(): void {
    this.apiService.get<{ enabled: boolean }>('financial/settings/auto-invoice').subscribe({
      next: (data) => {
        this.autoInvoiceEnabled = data.enabled;
      },
      error: () => {
        this.autoInvoiceEnabled = true;
      }
    });
  }

  toggleAutoInvoice(): void {
    const newValue = !this.autoInvoiceEnabled;
    this.apiService.put('financial/settings/auto-invoice', { enabled: newValue }).subscribe({
      next: () => {
        this.autoInvoiceEnabled = newValue;
        this.showSettingsModal = false;
      },
      error: () => {
        alert('Failed to update setting. Please try again.');
      }
    });
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

  initializeTableConfig(): void {
    this.tableConfig = {
      columns: [
        {
          key: 'invoiceNumber',
          label: 'Invoice #',
          type: 'custom',
          sortable: true,
          width: '120px',
          render: (row) => row.invoiceNumber
        },
        {
          key: 'customerName',
          label: 'Customer',
          type: 'custom',
          sortable: true,
          width: '160px',
          render: (row) => row.customerName ?? '-'
        },
        {
          key: 'issueDate',
          label: 'Issue Date',
          type: 'custom',
          sortable: true,
          width: '110px',
          render: (row) => this.formatDate(row.issueDate)
        },
        {
          key: 'dueDate',
          label: 'Due Date',
          type: 'custom',
          sortable: true,
          width: '110px',
          render: (row) => {
            const date = this.formatDate(row.dueDate);
            return row.isOverdue ? `${date}` : date;
          }
        },
        {
          key: 'totalAmount',
          label: 'Total',
          type: 'custom',
          sortable: true,
          align: 'right',
          width: '110px',
          render: (row) => this.formatCurrency(row.totalAmount)
        },
        {
          key: 'raxUpCommission',
          label: 'Commission',
          type: 'custom',
          sortable: false,
          align: 'right',
          width: '100px',
          render: (row) => this.formatCurrency(row.raxUpCommission ?? 0)
        },
        {
          key: 'paidAmount',
          label: 'Paid',
          type: 'custom',
          sortable: false,
          align: 'right',
          width: '100px',
          render: (row) => this.formatCurrency(row.paidAmount)
        },
        {
          key: 'balance',
          label: 'Balance',
          type: 'custom',
          sortable: false,
          align: 'right',
          width: '100px',
          render: (row) => this.formatCurrency(row.balance)
        },
        {
          key: 'status',
          label: 'Status',
          type: 'badge',
          sortable: true,
          width: '120px',
          badgeClass: (row) => this.getStatusBadgeClass(row.status),
          render: (row) => row.status
        },
        {
          key: 'actions',
          label: 'Actions',
          type: 'template',
          cellTemplate: this.invoiceActionsCell,
          width: '100px',
          align: 'center'
        }
      ],
      enableSelection: false,
      enableGlobalSearch: true,
      enablePagination: true,
      defaultPageSize: 20,
      pageSizeOptions: [10, 20, 50, 100],
      emptyMessage: 'No invoices found. Try adjusting your filters or create a new invoice.',
      rowClickable: true,
      rowClass: (row) => row.isOverdue ? 'invoice-row-overdue' : ''
    };
  }

  /** Server-side data source: pageNumber, pageSize, totalCount, search, sort. */
  dataSource = (filters: FilterState): Observable<PagedResult<Invoice>> => {
    const pageNumber = filters.pageNumber || 1;
    const pageSize = filters.pageSize || 20;
    const searchTerm = filters.globalSearch?.trim() || undefined;
    const customerId = this.customerFilter !== null && this.customerFilter !== undefined
      ? Number(this.customerFilter)
      : undefined;

    return this.financialService.getInvoices({
      customerId,
      status: this.statusFilter || undefined,
      dateFrom: this.dateFrom || undefined,
      dateTo: this.dateTo || undefined,
      searchTerm,
      pageNumber,
      pageSize
    }).pipe(
      map((data) => {
        const totalPages = Math.max(1, Math.ceil((data.totalCount || 0) / pageSize));
        return {
          items: data.items || [],
          totalCount: data.totalCount || 0,
          pageNumber: data.pageNumber ?? pageNumber,
          pageSize: data.pageSize ?? pageSize,
          totalPages,
          hasPreviousPage: pageNumber > 1,
          hasNextPage: pageNumber < totalPages
        };
      })
    );
  };

  onTableDataLoaded(result: PagedResult<Invoice>): void {
    this.totalCount = result.totalCount ?? 0;
  }

  onApplyFilters(): void {
    this.tableRefreshTrigger++;
  }

  setDateRangeTab(tab: 'all' | 'today' | 'week' | 'month' | 'year'): void {
    this.dateRangeTab = tab;
    const today = new Date();
    const toYmd = (d: Date) => d.toISOString().split('T')[0];

    switch (tab) {
      case 'all':
        this.dateFrom = '';
        this.dateTo = '';
        break;
      case 'today':
        this.dateFrom = toYmd(today);
        this.dateTo = toYmd(today);
        break;
      case 'week': {
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        this.dateFrom = toYmd(startOfWeek);
        this.dateTo = toYmd(endOfWeek);
        break;
      }
      case 'month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        this.dateFrom = toYmd(firstDay);
        this.dateTo = toYmd(lastDay);
        break;
      }
      case 'year': {
        const firstDay = new Date(today.getFullYear(), 0, 1);
        const lastDay = new Date(today.getFullYear(), 11, 31);
        this.dateFrom = toYmd(firstDay);
        this.dateTo = toYmd(lastDay);
        break;
      }
    }
    this.tableRefreshTrigger++;
  }

  onClearFilters(): void {
    this.statusFilter = '';
    this.customerFilter = null;
    this.dateRangeTab = 'all';
    this.initializeDates();
    this.tableRefreshTrigger++;
  }

  navigateToCreate(): void {
    this.router.navigate(['/financial/invoices/create']);
  }

  navigateToDetail(id: number): void {
    this.router.navigate(['/financial/invoices', id]);
  }

  navigateToEdit(id: number): void {
    this.router.navigate(['/financial/invoices', id, 'edit']);
  }

  downloadInvoicePdf(invoiceId: number): void {
    const printWindow = window.open('', '_blank', 'width=1024,height=768');
    if (!printWindow) {
      alert('Unable to open print window. Please allow pop-ups and try again.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write('<p style="font-family: Arial, sans-serif; padding: 16px;">Preparing invoice PDF...</p>');
    printWindow.document.close();

    this.financialService.getInvoiceById(invoiceId).subscribe({
      next: (invoice) => {
        const logoUrl = `${window.location.origin}/assets/logo.png`;
        const html = buildInvoicePdfHtml(
          invoice,
          this.formatCurrency.bind(this),
          this.formatDate.bind(this),
          logoUrl
        );
        const blob = new Blob([html], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        printWindow.location.replace(blobUrl);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
      },
      error: () => {
        alert('Failed to generate invoice PDF. Please try again.');
        printWindow.close();
      }
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'Draft': 'bg-secondary',
      'Sent': 'bg-info',
      'Paid': 'bg-success',
      'Overdue': 'bg-danger',
      'Cancelled': 'bg-dark'
    };
    return `badge ${classes[status] || 'bg-secondary'}`;
  }
}

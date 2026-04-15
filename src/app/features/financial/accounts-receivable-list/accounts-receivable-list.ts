import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { ApiService } from '../../../core/services/api';
import { AccountsReceivable } from '../../../core/models/financial.model';
import { Customer } from '../../../core/models/customer.model';

@Component({
  selector: 'app-accounts-receivable-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accounts-receivable-list.html',
  styleUrl: './accounts-receivable-list.scss',
})
export class AccountsReceivableListComponent implements OnInit {
  receivables: AccountsReceivable[] = [];
  customers: Customer[] = [];
  filteredReceivables: AccountsReceivable[] = [];
  
  // Filters
  statusFilter: string = '';
  customerFilter: number | null = null;
  dueDateFrom: string = '';
  dueDateTo: string = '';
  searchTerm: string = '';
  
  statusOptions = ['Open', 'Paid', 'Overdue', 'WrittenOff'];

  constructor(
    private financialService: FinancialService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.loadReceivables();
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

  loadReceivables(): void {
    this.financialService.getAccountsReceivables(
      this.customerFilter || undefined,
      this.statusFilter || undefined,
      undefined, // overdueOnly - removed, using client-side filter instead
      this.dueDateFrom || undefined,
      this.dueDateTo || undefined
    ).subscribe({
      next: (data) => {
        this.receivables = data;
        this.applyFilters();
      },
      error: () => {
      }
    });
  }

  applyFilters(): void {
    this.filteredReceivables = this.receivables.filter(receivable => {
      const matchesStatus = !this.statusFilter || receivable.status === this.statusFilter;
      const customerFilterNum = this.customerFilter !== null && this.customerFilter !== undefined 
        ? Number(this.customerFilter) 
        : null;
      const matchesCustomer = !customerFilterNum || receivable.customerId === customerFilterNum;
      const matchesDateFrom = !this.dueDateFrom || !receivable.dueDate || new Date(receivable.dueDate) >= new Date(this.dueDateFrom);
      const matchesDateTo = !this.dueDateTo || !receivable.dueDate || new Date(receivable.dueDate) <= new Date(this.dueDateTo);
      const matchesSearch = !this.searchTerm || 
        (receivable.invoiceNumber && receivable.invoiceNumber.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        receivable.customerName?.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesStatus && matchesCustomer && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }

  onApplyFilters(): void {
    // Reload receivables from server (customer and status filters are server-side)
    // Then apply client-side filters (date, search)
    this.loadReceivables();
  }

  onClearFilters(): void {
    this.statusFilter = '';
    this.customerFilter = null;
    this.dueDateFrom = '';
    this.dueDateTo = '';
    this.searchTerm = '';
    this.loadReceivables();
  }

  navigateToCreate(): void {
    this.router.navigate(['/financial/accounts-receivable/create']);
  }

  navigateToDetail(id: number): void {
    this.router.navigate(['/financial/accounts-receivable', id]);
  }

  updateStatus(): void {
    this.financialService.updateAccountsReceivableStatus().subscribe({
      next: () => {
        this.loadReceivables();
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
      'Open': 'bg-info',
      'Paid': 'bg-success',
      'Overdue': 'bg-danger',
      'WrittenOff': 'bg-dark'
    };
    return `badge ${classes[status] || 'bg-secondary'}`;
  }
}


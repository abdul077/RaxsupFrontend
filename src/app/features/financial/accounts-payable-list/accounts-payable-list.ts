import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { AccountsPayable } from '../../../core/models/financial.model';

@Component({
  selector: 'app-accounts-payable-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accounts-payable-list.html',
  styleUrl: './accounts-payable-list.scss',
})
export class AccountsPayableListComponent implements OnInit {
  payables: AccountsPayable[] = [];
  filteredPayables: AccountsPayable[] = [];
  
  // Filters
  statusFilter: string = '';
  categoryFilter: string = '';
  vendorNameFilter: string = '';
  dueDateFrom: string = '';
  dueDateTo: string = '';
  
  statusOptions = ['Pending', 'Approved', 'Paid', 'Overdue', 'Cancelled'];
  categoryOptions = ['Fuel', 'Maintenance', 'Insurance', 'Equipment', 'Other'];

  constructor(
    private financialService: FinancialService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPayables();
  }

  loadPayables(): void {
    this.financialService.getAccountsPayables(
      this.statusFilter || undefined,
      this.categoryFilter || undefined,
      this.dueDateFrom || undefined,
      this.dueDateTo || undefined,
      this.vendorNameFilter || undefined
    ).subscribe({
      next: (data) => {
        this.payables = data;
        this.filteredPayables = data;
      },
      error: () => {
      }
    });
  }

  applyFilters(): void {
    this.loadPayables();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.categoryFilter = '';
    this.vendorNameFilter = '';
    this.dueDateFrom = '';
    this.dueDateTo = '';
    this.applyFilters();
  }

  navigateToCreate(): void {
    this.router.navigate(['/financial/accounts-payable/create']);
  }

  navigateToDetail(id: number): void {
    this.router.navigate(['/financial/accounts-payable', id]);
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
      'Pending': 'bg-secondary',
      'Approved': 'bg-info',
      'Paid': 'bg-success',
      'Overdue': 'bg-danger',
      'Cancelled': 'bg-dark'
    };
    return `badge ${classes[status] || 'bg-secondary'}`;
  }
}


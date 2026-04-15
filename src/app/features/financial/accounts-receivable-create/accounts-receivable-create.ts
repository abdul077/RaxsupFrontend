import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { ApiService } from '../../../core/services/api';
import { CreateAccountsReceivableRequest, Invoice } from '../../../core/models/financial.model';
import { Customer } from '../../../core/models/customer.model';

@Component({
  selector: 'app-accounts-receivable-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accounts-receivable-create.html',
  styleUrl: './accounts-receivable-create.scss',
})
export class AccountsReceivableCreateComponent implements OnInit {
  form: CreateAccountsReceivableRequest = {
    customerId: 0,
    invoiceId: undefined,
    amount: 0,
    dueDate: ''
  };

  customers: Customer[] = [];
  invoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  submitting = false;
  loadingCustomers = false;
  loadingInvoices = false;

  constructor(
    private financialService: FinancialService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
    // Set default due date (30 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    this.form.dueDate = dueDate.toISOString().split('T')[0];
  }

  loadCustomers(): void {
    this.loadingCustomers = true;
    this.apiService.get<Customer[]>('customers').subscribe({
      next: (data) => {
        this.customers = data;
        this.loadingCustomers = false;
      },
      error: () => {
        this.customers = [];
        this.loadingCustomers = false;
      }
    });
  }

  loadInvoicesForCustomer(customerId: number): void {
    if (!customerId || customerId <= 0) {
      this.filteredInvoices = [];
      this.invoices = [];
      return;
    }

    this.loadingInvoices = true;
    this.filteredInvoices = [];
    
    // Clear invoice selection when loading new invoices
    this.form.invoiceId = undefined;

    this.financialService.getInvoices({ customerId, pageSize: 1000 }).subscribe({
      next: (data) => {
        this.invoices = data.items;
        this.filteredInvoices = data.items;
        this.loadingInvoices = false;
      },
      error: (error) => {
        console.error('Error loading invoices:', error);
        this.invoices = [];
        this.filteredInvoices = [];
        this.loadingInvoices = false;
      }
    });
  }

  onCustomerChange(): void {
    // Convert customerId to number if it's a string (from select element)
    const customerId = typeof this.form.customerId === 'string' 
      ? parseInt(this.form.customerId, 10) 
      : Number(this.form.customerId);

    // Update form with numeric value
    this.form.customerId = customerId;

    // Clear invoice selection when customer changes
    this.form.invoiceId = undefined;
    this.form.amount = 0;

    // Load invoices for the selected customer
    if (customerId && customerId > 0) {
      this.loadInvoicesForCustomer(customerId);
    } else {
      this.filteredInvoices = [];
      this.invoices = [];
    }
  }

  onInvoiceChange(): void {
    // Convert invoiceId to number if it's a string
    const invoiceId = typeof this.form.invoiceId === 'string' 
      ? parseInt(this.form.invoiceId, 10) 
      : Number(this.form.invoiceId);

    // Update form with numeric value
    this.form.invoiceId = invoiceId;

    // Auto-populate amount and due date from selected invoice
    if (invoiceId && invoiceId > 0) {
      const selectedInvoice = this.filteredInvoices.find(inv => inv.invoiceId === invoiceId);
      if (selectedInvoice) {
        // Use balance if available, otherwise use totalAmount
        this.form.amount = selectedInvoice.balance > 0 ? selectedInvoice.balance : selectedInvoice.totalAmount;
        
        // Use invoice due date if available, otherwise keep current due date
        if (selectedInvoice.dueDate) {
          this.form.dueDate = selectedInvoice.dueDate.split('T')[0];
        }
      }
    } else {
      // Reset amount if no invoice selected
      this.form.amount = 0;
    }
  }

  onSubmit(): void {
    if (!this.form.customerId || !this.form.dueDate || this.form.amount <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    this.submitting = true;
    this.financialService.createAccountsReceivable(this.form).subscribe({
      next: (id) => {
        this.router.navigate(['/financial/accounts-receivable', id]);
      },
      error: () => {
        this.submitting = false;
        alert('Failed to create receivable. Please try again.');
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/financial/accounts-receivable']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}


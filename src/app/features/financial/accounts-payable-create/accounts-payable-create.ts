import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { CreateAccountsPayableRequest, Invoice } from '../../../core/models/financial.model';

@Component({
  selector: 'app-accounts-payable-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accounts-payable-create.html',
  styleUrl: './accounts-payable-create.scss',
})
export class AccountsPayableCreateComponent implements OnInit {
  form: CreateAccountsPayableRequest = {
    vendorName: '',
    vendorAddress: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    amount: 0,
    invoiceNumber: '',
    category: '',
    notes: ''
  };

  categoryOptions = ['Fuel', 'Maintenance', 'Insurance', 'Equipment', 'Other'];
  invoices: Invoice[] = [];
  loadingInvoices = false;
  selectedInvoiceId: number | null = null;
  submitting = false;
  validationErrors: string[] = [];
  showErrors = false;

  constructor(
    private financialService: FinancialService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Calculate default due date (30 days from invoice date)
    const invoiceDate = new Date(this.form.invoiceDate);
    invoiceDate.setDate(invoiceDate.getDate() + 30);
    this.form.dueDate = invoiceDate.toISOString().split('T')[0];
    
    // Load invoices
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loadingInvoices = true;
    this.financialService.getInvoices({ pageSize: 1000 }).subscribe({
      next: (data) => {
        this.invoices = data.items;
        this.loadingInvoices = false;
      },
      error: () => {
        this.invoices = [];
        this.loadingInvoices = false;
      }
    });
  }

  onInvoiceChange(): void {
    // Convert selectedInvoiceId to number (HTML select returns string)
    const invoiceId = typeof this.selectedInvoiceId === 'string' 
      ? parseInt(this.selectedInvoiceId, 10) 
      : Number(this.selectedInvoiceId);
    
    if (invoiceId && !isNaN(invoiceId)) {
      const selectedInvoice = this.invoices.find(inv => inv.invoiceId === invoiceId);
      if (selectedInvoice && selectedInvoice.invoiceNumber) {
        this.form.invoiceNumber = selectedInvoice.invoiceNumber;
      } else {
        // If invoice not found or has no invoice number, clear it
        this.form.invoiceNumber = '';
      }
    } else {
      // No invoice selected
      this.form.invoiceNumber = '';
    }
  }

  onAmountChange(): void {
    // Ensure amount is non-negative
    if (this.form.amount < 0) {
      this.form.amount = 0;
    }
  }

  onInvoiceDateChange(): void {
    // Auto-update due date if invoice date changes and due date is not set or is before invoice date
    if (this.form.invoiceDate) {
      const invoiceDate = new Date(this.form.invoiceDate);
      const dueDate = this.form.dueDate ? new Date(this.form.dueDate) : null;
      
      if (!dueDate || dueDate < invoiceDate) {
        // Set due date to 30 days from invoice date
        invoiceDate.setDate(invoiceDate.getDate() + 30);
        this.form.dueDate = invoiceDate.toISOString().split('T')[0];
      }
    }
  }

  isDueDateInvalid(): boolean {
    if (!this.form.dueDate) {
      return true;
    }

    if (!this.form.invoiceDate) {
      return false;
    }

    const invoiceDate = new Date(this.form.invoiceDate);
    const dueDate = new Date(this.form.dueDate);
    return dueDate < invoiceDate;
  }

  isFormValid(): boolean {
    // Check required fields
    if (!this.form.vendorName || this.form.vendorName.trim() === '') {
      return false;
    }
    if (!this.form.invoiceDate) {
      return false;
    }
    if (!this.form.dueDate) {
      return false;
    }
    if (!this.form.amount || this.form.amount <= 0) {
      return false;
    }
    
    // Validate dates
    const invoiceDate = new Date(this.form.invoiceDate);
    const dueDate = new Date(this.form.dueDate);
    if (dueDate < invoiceDate) {
      return false;
    }
    
    return true;
  }

  scrollToFirstError(): void {
    setTimeout(() => {
      // Priority order: vendorName, invoiceDate, dueDate, amount
      const fieldSelectors = [
        'input[name="vendorName"]',
        'input[name="invoiceDate"]',
        'input[name="dueDate"]',
        'input[name="amount"]'
      ];

      for (const selector of fieldSelectors) {
        const field = document.querySelector(selector) as HTMLElement;
        if (field && field.classList.contains('is-invalid')) {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          field.focus();
          return;
        }
      }

      // If no specific field found, try any invalid field
      const firstErrorField = document.querySelector('.is-invalid') as HTMLElement;
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
        return;
      }

      // If no invalid field found, scroll to error message
      const errorAlert = document.querySelector('.alert-danger');
      if (errorAlert) {
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }

  onSubmit(): void {
    // Ensure amount is non-negative
    if (this.form.amount < 0) {
      this.form.amount = 0;
    }

    if (!this.isFormValid()) {
      this.validationErrors = [];
      
      if (!this.form.vendorName || this.form.vendorName.trim() === '') {
        this.validationErrors.push('Vendor Name is required');
      }
      if (!this.form.invoiceDate) {
        this.validationErrors.push('Invoice Date is required');
      }
      if (!this.form.dueDate) {
        this.validationErrors.push('Due Date is required');
      }
      if (!this.form.amount || this.form.amount <= 0) {
        this.validationErrors.push('Amount must be greater than 0');
      }
      
      // Validate dates
      if (this.form.invoiceDate && this.form.dueDate) {
        const invoiceDate = new Date(this.form.invoiceDate);
        const dueDate = new Date(this.form.dueDate);
        if (dueDate < invoiceDate) {
          this.validationErrors.push('Due Date must be on or after Invoice Date');
        }
      }
      
      this.showErrors = true;
      this.scrollToFirstError();
      return;
    }

    // Clear errors if form is valid
    this.validationErrors = [];
    this.showErrors = false;

    // Prepare payload - convert empty strings to null for optional fields
    // PayableNumber will be auto-generated by the backend
    const payload: any = {
      vendorName: this.form.vendorName.trim(),
      invoiceDate: this.form.invoiceDate,
      dueDate: this.form.dueDate,
      amount: this.form.amount,
      invoiceNumber: this.form.invoiceNumber?.trim() || null,
      category: this.form.category?.trim() || null,
      notes: this.form.notes?.trim() || null,
      vendorAddress: this.form.vendorAddress?.trim() || null
    };

    this.submitting = true;
    this.financialService.createAccountsPayable(payload).subscribe({
      next: (id) => {
        this.router.navigate(['/financial/accounts-payable', id]);
      },
      error: (error) => {
        this.submitting = false;
        this.validationErrors = ['Failed to create payable. Please try again.'];
        this.showErrors = true;
        this.scrollToFirstError();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/financial/accounts-payable']);
  }
}


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { Invoice, RecordPaymentRequest } from '../../../core/models/financial.model';
import { buildInvoicePdfHtml } from '../../../core/utils/invoice-pdf-template.util';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.scss',
})
export class InvoiceDetailComponent implements OnInit {
  invoice: Invoice | null = null;
  loading = true;
  showPaymentModal = false;
  
  paymentForm: RecordPaymentRequest = {
    invoiceId: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    amount: 0,
    method: 'ACH',
    checkNumber: '',
    creditCardNumber: '',
    reference: '',
    bankName: ''
  };

  constructor(
    private financialService: FinancialService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      this.loadInvoice(id);
    });
  }

  loadInvoice(id: number): void {
    this.loading = true;
    this.financialService.getInvoiceById(id).subscribe({
      next: (invoice) => {
        this.invoice = invoice;
        this.paymentForm.invoiceId = invoice.invoiceId;
        this.paymentForm.amount = invoice.balance;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openPaymentModal(): void {
    if (this.invoice) {
      this.paymentForm.amount = this.invoice.balance;
      this.showPaymentModal = true;
    }
  }

  recordPayment(): void {
    if (!this.invoice) return;
    
    // Validate: Check Number is required for Check payments
    if (this.paymentForm.method === 'Check' && !this.paymentForm.checkNumber?.trim()) {
      alert('Check Number is required for Check payments.');
      return;
    }
    
    // Validate: Credit Card Number is required for Credit Card payments
    if (this.paymentForm.method === 'CreditCard' && !this.paymentForm.creditCardNumber?.trim()) {
      alert('Credit Card Number is required for Credit Card payments.');
      return;
    }
    
    this.financialService.recordPayment(this.paymentForm).subscribe({
      next: () => {
        this.showPaymentModal = false;
        this.loadInvoice(this.invoice!.invoiceId);
      }
    });
  }

  sendInvoice(): void {
    if (!this.invoice) return;
    this.financialService.sendInvoice(this.invoice.invoiceId).subscribe({
      next: () => {
        this.loadInvoice(this.invoice!.invoiceId);
      }
    });
  }

  downloadInvoicePdf(): void {
    if (!this.invoice) return;

    const logoUrl = `${window.location.origin}/assets/logo.png`;
    const html = buildInvoicePdfHtml(
      this.invoice,
      this.formatCurrency.bind(this),
      this.formatDate.bind(this),
      logoUrl
    );
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank', 'width=1024,height=768');

    if (!printWindow) {
      alert('Unable to open print window. Please allow pop-ups and try again.');
      URL.revokeObjectURL(blobUrl);
      return;
    }

    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }

  navigateBack(): void {
    this.router.navigate(['/financial/invoices']);
  }

  navigateToEdit(): void {
    if (this.invoice) {
      this.router.navigate(['/financial/invoices', this.invoice.invoiceId, 'edit']);
    }
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


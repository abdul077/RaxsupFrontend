import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { AccountsPayableDetail, MarkAccountsPayablePaidRequest, CreatePayablePaymentRequest } from '../../../core/models/financial.model';

@Component({
  selector: 'app-accounts-payable-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accounts-payable-detail.html',
  styleUrl: './accounts-payable-detail.scss',
})
export class AccountsPayableDetailComponent implements OnInit {
  payable: AccountsPayableDetail | null = null;
  loading = true;
  showPaymentModal = false;
  showMarkPaidModal = false;
  
  paymentForm: CreatePayablePaymentRequest = {
    payableId: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    amount: 0,
    method: 'Check',
    checkNumber: '',
    creditCardNumber: '',
    reference: '',
    notes: ''
  };

  markPaidForm: MarkAccountsPayablePaidRequest = {
    payableId: 0,
    paidAt: new Date().toISOString().split('T')[0],
    paymentMethod: 'Check',
    paymentReference: ''
  };

  constructor(
    private financialService: FinancialService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      this.loadPayable(id);
    });
  }

  loadPayable(id: number): void {
    this.loading = true;
    this.financialService.getAccountsPayableById(id).subscribe({
      next: (payable) => {
        this.payable = payable;
        this.paymentForm.payableId = payable.payableId;
        this.paymentForm.amount = payable.balance;
        this.markPaidForm.payableId = payable.payableId;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openPaymentModal(): void {
    if (this.payable) {
      this.paymentForm.amount = this.payable.balance;
      this.showPaymentModal = true;
    }
  }

  openMarkPaidModal(): void {
    if (this.payable) {
      this.markPaidForm.paidAt = new Date().toISOString().split('T')[0];
      this.showMarkPaidModal = true;
    }
  }

  recordPayment(): void {
    if (!this.payable) return;
    
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
    
    this.financialService.createPayablePayment(this.paymentForm).subscribe({
      next: () => {
        this.showPaymentModal = false;
        this.loadPayable(this.payable!.payableId);
      }
    });
  }

  markAsPaid(): void {
    if (!this.payable) return;
    this.financialService.markAccountsPayablePaid(this.payable.payableId, this.markPaidForm).subscribe({
      next: () => {
        this.showMarkPaidModal = false;
        this.loadPayable(this.payable!.payableId);
      }
    });
  }

  approvePayable(): void {
    if (!this.payable) return;
    this.financialService.approveAccountsPayable(this.payable.payableId).subscribe({
      next: () => {
        this.loadPayable(this.payable!.payableId);
      }
    });
  }

  navigateBack(): void {
    this.router.navigate(['/financial/accounts-payable']);
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


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { AccountsReceivableDetail, RecordReceivablePaymentRequest } from '../../../core/models/financial.model';

@Component({
  selector: 'app-accounts-receivable-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './accounts-receivable-detail.html',
  styleUrl: './accounts-receivable-detail.scss',
})
export class AccountsReceivableDetailComponent implements OnInit {
  receivable: AccountsReceivableDetail | null = null;
  loading = true;
  showPaymentModal = false;
  
  paymentForm: RecordReceivablePaymentRequest = {
    receivableId: 0,
    paymentAmount: 0,
    paidAt: new Date().toISOString().split('T')[0]
  };

  constructor(
    private financialService: FinancialService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      this.loadReceivable(id);
    });
  }

  loadReceivable(id: number): void {
    this.loading = true;
    this.financialService.getAccountsReceivableById(id).subscribe({
      next: (receivable) => {
        this.receivable = receivable;
        this.paymentForm.receivableId = receivable.receivableId;
        this.paymentForm.paymentAmount = receivable.balance;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  openPaymentModal(): void {
    if (this.receivable) {
      this.paymentForm.paymentAmount = this.receivable.balance;
      this.showPaymentModal = true;
    }
  }

  recordPayment(): void {
    if (!this.receivable) return;
    this.financialService.recordReceivablePayment(this.receivable.receivableId, this.paymentForm).subscribe({
      next: () => {
        this.showPaymentModal = false;
        this.loadReceivable(this.receivable!.receivableId);
      }
    });
  }

  navigateBack(): void {
    this.router.navigate(['/financial/accounts-receivable']);
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


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { DriverSettlement } from '../../../core/models/financial.model';

@Component({
  selector: 'app-settlement-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settlement-detail.html',
  styleUrl: './settlement-detail.scss',
})
export class SettlementDetailComponent implements OnInit {
  settlement: DriverSettlement | null = null;
  loading = true;
  processing = false;
  showCancelModal = false;
  showMarkPaidModal = false;
  cancelReason = '';
  paymentMethod = 'ACH';
  paymentReference = '';

  constructor(
    private financialService: FinancialService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      this.loadSettlement(id);
    });
  }

  loadSettlement(id: number): void {
    this.loading = true;
    this.financialService.getSettlementById(id).subscribe({
      next: (settlement) => {
        this.settlement = settlement;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/financial/settlements']);
      }
    });
  }

  navigateBack(): void {
    this.router.navigate(['/financial/settlements']);
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
      'PendingApproval': 'bg-warning',
      'Approved': 'bg-info',
      'Paid': 'bg-success',
      'Cancelled': 'bg-dark'
    };
    return `badge ${classes[status] || 'bg-secondary'}`;
  }

  submitForApproval(): void {
    if (!this.settlement || this.processing) return;
    
    if (!confirm('Submit this settlement for approval?')) return;

    this.processing = true;
    this.financialService.submitSettlementForApproval(this.settlement.settlementId).subscribe({
      next: () => {
        this.loadSettlement(this.settlement!.settlementId);
        this.processing = false;
      },
      error: (error) => {
        alert(error.error?.message || 'Failed to submit settlement for approval');
        this.processing = false;
      }
    });
  }

  approveSettlement(): void {
    if (!this.settlement || this.processing) return;
    
    if (!confirm('Approve this settlement?')) return;

    this.processing = true;
    this.financialService.approveSettlement(this.settlement.settlementId).subscribe({
      next: () => {
        this.loadSettlement(this.settlement!.settlementId);
        this.processing = false;
      },
      error: (error) => {
        alert(error.error?.message || 'Failed to approve settlement');
        this.processing = false;
      }
    });
  }

  openMarkPaidModal(): void {
    this.showMarkPaidModal = true;
    this.paymentMethod = 'ACH';
    this.paymentReference = '';
  }

  closeMarkPaidModal(): void {
    this.showMarkPaidModal = false;
    this.paymentMethod = 'ACH';
    this.paymentReference = '';
  }

  markAsPaid(): void {
    if (!this.settlement || this.processing) return;

    this.processing = true;
    this.financialService.markSettlementPaid(this.settlement.settlementId, {
      settlementId: this.settlement.settlementId,
      paymentMethod: this.paymentMethod,
      paymentReference: this.paymentReference || undefined
    }).subscribe({
      next: () => {
        this.closeMarkPaidModal();
        this.loadSettlement(this.settlement!.settlementId);
        this.processing = false;
      },
      error: (error) => {
        alert(error.error?.message || 'Failed to mark settlement as paid');
        this.processing = false;
      }
    });
  }

  openCancelModal(): void {
    this.showCancelModal = true;
    this.cancelReason = '';
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.cancelReason = '';
  }

  cancelSettlement(): void {
    if (!this.settlement || this.processing) return;

    if (!confirm('Are you sure you want to cancel this settlement?')) return;

    this.processing = true;
    this.financialService.cancelSettlement(
      this.settlement.settlementId,
      this.cancelReason || undefined
    ).subscribe({
      next: () => {
        this.closeCancelModal();
        this.loadSettlement(this.settlement!.settlementId);
        this.processing = false;
      },
      error: (error) => {
        alert(error.error?.message || 'Failed to cancel settlement');
        this.processing = false;
      }
    });
  }
}


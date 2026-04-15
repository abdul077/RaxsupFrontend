import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { PayrollService } from '../../../core/services/payroll.service';
import { Payroll, SyncPayrollToEvereeResponse, SyncPayrollFromEvereeResponse } from '../../../core/models/financial.model';

@Component({
  selector: 'app-payroll-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './payroll-detail.html',
  styleUrl: './payroll-detail.scss',
})
export class PayrollDetailComponent implements OnInit {
  payroll: Payroll | null = null;
  loading = true;
  syncing = false;

  constructor(
    private payrollService: PayrollService,
    private route: ActivatedRoute,
    public router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPayroll(+id);
    }
  }

  loadPayroll(id: number): void {
    this.loading = true;
    // Get all payrolls and find the one we need
    this.payrollService.getPayrolls().subscribe({
      next: (payrolls) => {
        this.payroll = payrolls.find(p => p.payrollId === id) || null;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payroll:', error);
        this.loading = false;
      }
    });
  }

  syncToEveree(): void {
    if (!this.payroll || !confirm('Sync this payroll to Everee?')) {
      return;
    }

    this.syncing = true;
    this.payrollService.syncPayrollToEveree(this.payroll.payrollId).subscribe({
      next: (response: SyncPayrollToEvereeResponse) => {
        this.syncing = false;
        if (response.success) {
          alert('Payroll synced to Everee successfully!');
          this.loadPayroll(this.payroll!.payrollId);
        } else {
          alert(`Failed to sync: ${response.errorMessage || 'Unknown error'}`);
        }
      },
      error: (error) => {
        console.error('Error syncing payroll:', error);
        this.syncing = false;
        alert('Error syncing payroll to Everee');
      }
    });
  }

  syncFromEveree(): void {
    if (!this.payroll || !confirm('Fetch latest data from Everee?')) {
      return;
    }

    this.syncing = true;
    this.payrollService.syncPayrollsFromEveree({ payrollId: this.payroll.payrollId }).subscribe({
      next: (response: SyncPayrollFromEvereeResponse) => {
        this.syncing = false;
        if (response.success) {
          alert('Payroll data synced from Everee successfully!');
          this.loadPayroll(this.payroll!.payrollId);
        } else {
          alert(`Failed to sync: ${response.errors.join(', ')}`);
        }
      },
      error: (error) => {
        console.error('Error syncing from Everee:', error);
        this.syncing = false;
        alert('Error syncing payroll from Everee');
      }
    });
  }

  getSyncStatusClass(syncStatus: string): string {
    switch (syncStatus) {
      case 'Synced':
        return 'badge-success';
      case 'Pending':
        return 'badge-warning';
      case 'Failed':
        return 'badge-danger';
      case 'NeedsUpdate':
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  }
}


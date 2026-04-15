import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PayrollService } from '../../../core/services/payroll.service';
import { DriverService } from '../../../core/services/driver.service';
import { Payroll, SyncPayrollToEvereeResponse, SyncPayrollFromEvereeResponse } from '../../../core/models/financial.model';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-payroll-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payroll-list.html',
  styleUrl: './payroll-list.scss',
})
export class PayrollListComponent implements OnInit {
  payrolls: Payroll[] = [];
  drivers: Driver[] = [];
  filteredPayrolls: Payroll[] = [];
  loading = true;
  
  // Filters
  statusFilter: string = '';
  driverFilter: number | null = null;
  syncStatusFilter: string = '';
  searchTerm: string = '';
  startDate: string = '';
  endDate: string = '';
  
  statusOptions = ['Draft', 'Pending', 'Processing', 'Completed', 'Paid', 'Cancelled'];
  syncStatusOptions = ['NotSynced', 'Pending', 'Synced', 'Failed', 'NeedsUpdate'];

  constructor(
    private payrollService: PayrollService,
    private driverService: DriverService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.loadDrivers();
    this.loadPayrolls();
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        this.drivers = result?.items || [];
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
        this.drivers = [];
      }
    });
  }

  loadPayrolls(): void {
    this.loading = true;
    this.payrollService.getPayrolls(
      this.driverFilter || undefined,
      undefined,
      this.startDate || undefined,
      this.endDate || undefined,
      this.statusFilter || undefined,
      this.syncStatusFilter || undefined
    ).subscribe({
      next: (data) => {
        this.payrolls = data || [];
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payrolls:', error);
        this.payrolls = [];
        this.filteredPayrolls = [];
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    if (!this.payrolls || this.payrolls.length === 0) {
      this.filteredPayrolls = [];
      return;
    }

    this.filteredPayrolls = this.payrolls.filter(payroll => {
      const matchesSearch = !this.searchTerm || 
        payroll.payrollNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (payroll.driverName && payroll.driverName.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (payroll.ownerOperatorName && payroll.ownerOperatorName.toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      return matchesSearch;
    });
  }

  onFilterChange(): void {
    this.loadPayrolls();
  }

  syncToEveree(payrollId: number): void {
    if (!confirm('Sync this payroll to Everee?')) {
      return;
    }

    this.payrollService.syncPayrollToEveree(payrollId).subscribe({
      next: (response: SyncPayrollToEvereeResponse) => {
        if (response.success) {
          alert('Payroll synced to Everee successfully!');
          this.loadPayrolls();
        } else {
          alert(`Failed to sync: ${response.errorMessage || 'Unknown error'}`);
        }
      },
      error: (error) => {
        console.error('Error syncing payroll:', error);
        alert('Error syncing payroll to Everee');
      }
    });
  }

  syncAllFromEveree(): void {
    if (!confirm('Sync all payrolls from Everee? This will update local records with latest data from Everee.')) {
      return;
    }

    this.payrollService.syncPayrollsFromEveree({ syncAll: true }).subscribe({
      next: (response: SyncPayrollFromEvereeResponse) => {
        alert(`Sync completed: ${response.syncedCount} synced, ${response.failedCount} failed`);
        if (response.errors.length > 0) {
          console.error('Sync errors:', response.errors);
        }
        this.loadPayrolls();
      },
      error: (error) => {
        console.error('Error syncing from Everee:', error);
        alert('Error syncing payrolls from Everee');
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

  getStatusClass(status: string): string {
    switch (status) {
      case 'Paid':
        return 'badge-success';
      case 'Completed':
        return 'badge-info';
      case 'Processing':
        return 'badge-warning';
      case 'Cancelled':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  }
}


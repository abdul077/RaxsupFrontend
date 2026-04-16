import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { DriverService } from '../../../core/services/driver.service';
import { DriverSettlement } from '../../../core/models/financial.model';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-driver-settlements-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-settlements-management.html',
  styleUrl: './driver-settlements-management.scss'
})
export class DriverSettlementsManagementComponent implements OnInit {
  settlements: DriverSettlement[] = [];
  drivers: Driver[] = [];
  loading = true;
  selectedSettlements: Set<number> = new Set();

  // Filters
  statusFilter: string = '';
  driverFilter: number | null = null;
  startDate: string = '';
  endDate: string = '';
  searchTerm: string = '';

  statusOptions = ['Draft', 'PendingApproval', 'Approved', 'Paid', 'Cancelled'];

  constructor(
    private driverService: DriverService,
    private financialService: FinancialService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDrivers();
    this.loadSettlements();
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        this.drivers = result?.items || [];
      },
      error: () => {
        this.drivers = [];
      }
    });
  }

  loadSettlements(): void {
    this.loading = true;
    const driverId = this.driverFilter ? Number(this.driverFilter) : undefined;
    this.financialService.getSettlements(driverId, this.statusFilter || undefined).subscribe({
      next: (data) => {
        this.settlements = data || [];
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.settlements = [];
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    // Additional client-side filtering can be added here
    this.loadSettlements();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.driverFilter = null;
    this.startDate = '';
    this.endDate = '';
    this.searchTerm = '';
    this.loadSettlements();
  }

  toggleSettlementSelection(settlementId: number): void {
    if (this.selectedSettlements.has(settlementId)) {
      this.selectedSettlements.delete(settlementId);
    } else {
      this.selectedSettlements.add(settlementId);
    }
  }

  navigateToSettlement(settlementId: number): void {
    this.router.navigate(['/financial/settlements', settlementId], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  navigateToDriver(driverId: number): void {
    this.router.navigate(['/drivers', driverId]);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Paid':
        return 'badge bg-success';
      case 'Approved':
        return 'badge bg-primary';
      case 'PendingApproval':
        return 'badge bg-warning';
      case 'Draft':
        return 'badge bg-secondary';
      case 'Cancelled':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  exportSettlements(): void {
    alert('Export functionality coming soon');
  }
}


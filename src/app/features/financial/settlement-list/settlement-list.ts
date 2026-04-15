import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { DriverService } from '../../../core/services/driver.service';
import { DriverSettlement } from '../../../core/models/financial.model';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-settlement-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settlement-list.html',
  styleUrl: './settlement-list.scss',
})
export class SettlementListComponent implements OnInit {
  settlements: DriverSettlement[] = [];
  drivers: Driver[] = [];
  filteredSettlements: DriverSettlement[] = [];
  
  // Filters
  statusFilter: string = '';
  driverFilter: number | null = null;
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
    // Get all drivers with a large page size
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

  loadSettlements(): void {
    // Convert driverFilter to number if it's set (handle string conversion from select)
    const driverId = this.driverFilter ? Number(this.driverFilter) : undefined;
    this.financialService.getSettlements(
      driverId,
      this.statusFilter || undefined
    ).subscribe({
      next: (data) => {
        this.settlements = data || [];
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error loading settlements:', error);
        this.settlements = [];
        this.filteredSettlements = [];
      }
    });
  }

  applyFilters(): void {
    if (!this.settlements || this.settlements.length === 0) {
      this.filteredSettlements = [];
      return;
    }

    this.filteredSettlements = this.settlements.filter(settlement => {
      // Search is applied client-side
      const matchesSearch = !this.searchTerm || 
        settlement.settlementNumber?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        settlement.driverName?.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchesSearch;
    });
  }

  onApplyFilters(): void {
    // Reload settlements from server with driver and status filters, then apply search filter
    this.loadSettlements();
  }

  onClearFilters(): void {
    this.statusFilter = '';
    this.driverFilter = null;
    this.searchTerm = '';
    // Reload settlements from server without filters
    this.loadSettlements();
  }

  navigateToCreate(): void {
    this.router.navigate(['/financial/settlements/create']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatDate(date: string | undefined | null): string {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return '-';
    }
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

  viewSettlement(settlementId: number): void {
    this.router.navigate(['/financial/settlements', settlementId]);
  }
}


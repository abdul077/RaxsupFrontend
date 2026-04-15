import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { ApiService } from '../../../core/services/api';
import { DriverService } from '../../../core/services/driver.service';
import { FinancialReports } from '../../../core/models/financial.model';
import { Customer } from '../../../core/models/customer.model';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-financial-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './financial-reports.html',
  styleUrl: './financial-reports.scss',
})
export class FinancialReportsComponent implements OnInit {
  reports: FinancialReports | null = null;
  customers: Customer[] = [];
  drivers: Driver[] = [];
  activeTab = 'overview';
  
  startDate: string = '';
  endDate: string = '';
  selectedCustomerId?: number;
  selectedDriverId?: number;

  constructor(
    private financialService: FinancialService,
    private apiService: ApiService,
    private driverService: DriverService
  ) {}

  ngOnInit(): void {
    this.initializeDates();
    this.loadCustomers();
    this.loadDrivers();
    this.loadReports();
  }

  initializeDates(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.startDate = firstDay.toISOString().split('T')[0];
    this.endDate = lastDay.toISOString().split('T')[0];
  }

  loadCustomers(): void {
    this.apiService.get<Customer[]>('customers').subscribe({
      next: (data) => {
        this.customers = data || [];
      },
      error: (error) => {
        console.error('Error loading customers:', error);
        this.customers = [];
      }
    });
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

  loadReports(): void {
    this.financialService.getFinancialReports(
      this.startDate || undefined,
      this.endDate || undefined,
      this.selectedCustomerId,
      this.selectedDriverId
    ).subscribe({
      next: (data) => {
        this.reports = data;
      },
      error: (error) => {
        console.error('Error loading reports:', error);
      }
    });
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }
}


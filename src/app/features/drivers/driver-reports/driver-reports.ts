import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DriverService } from '../../../core/services/driver.service';
import { DriverReports, LicenseExpiration } from '../../../core/models/driver.model';

@Component({
  selector: 'app-driver-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-reports.html',
  styleUrl: './driver-reports.scss',
})
export class DriverReportsComponent implements OnInit {
  loading = true;
  reports: DriverReports | null = null;
  licenseExpirations: LicenseExpiration[] = [];
  activeTab: string = 'overview';

  constructor(private driverService: DriverService) {}

  ngOnInit(): void {
    this.loadReports();
    this.loadLicenseExpirations();
  }

  loadReports(): void {
    this.loading = true;
    this.driverService.getDriverReports().subscribe({
      next: (data) => {
        this.reports = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        alert('Failed to load reports');
      }
    });
  }

  loadLicenseExpirations(): void {
    this.driverService.getLicenseExpirations(90, true).subscribe({
      next: (data) => {
        this.licenseExpirations = data;
      },
      error: () => {
        this.licenseExpirations = [];
      }
    });
  }

  setTab(tab: string): void {
    this.activeTab = tab;
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  getExpiryBadgeClass(isExpired: boolean, isExpiringSoon: boolean): string {
    if (isExpired) return 'badge bg-danger';
    if (isExpiringSoon) return 'badge bg-warning';
    return 'badge bg-success';
  }
}


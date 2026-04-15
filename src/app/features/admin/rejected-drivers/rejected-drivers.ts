import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { RejectedDriver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-rejected-drivers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rejected-drivers.html',
  styleUrl: './rejected-drivers.scss',
})
export class RejectedDriversComponent implements OnInit, OnDestroy {
  rejectedDrivers: RejectedDriver[] = [];
  filteredDrivers: RejectedDriver[] = [];
  errorMessage = '';
  loading = false;

  // Detail modal
  showDetailModal = false;
  driverToView: RejectedDriver | null = null;

  // Filters
  searchTerm = '';
  selectedReferrer = '';
  dateFrom = '';
  dateTo = '';
  referrers: string[] = [];

  // View mode
  viewMode: 'table' | 'grid' = 'table';

  constructor(
    private driverService: DriverService,
    private router: Router,
    private timeZoneService: TimeZoneService
  ) {}

  ngOnInit(): void {
    this.loadRejectedDrivers();
  }

  loadRejectedDrivers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.driverService.getRejectedDrivers().subscribe({
      next: (drivers) => {
        this.rejectedDrivers = drivers;
        this.extractReferrers();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load rejected drivers';
        this.loading = false;
      }
    });
  }

  extractReferrers(): void {
    const uniqueReferrers = new Set<string>();
    this.rejectedDrivers.forEach(driver => {
      if (driver.referrerName) {
        uniqueReferrers.add(driver.referrerName);
      }
    });
    this.referrers = Array.from(uniqueReferrers).sort();
  }

  applyFilters(): void {
    let filtered = [...this.rejectedDrivers];

    // Search filter
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(driver =>
        driver.fullName.toLowerCase().includes(search) ||
        driver.username.toLowerCase().includes(search) ||
        driver.email.toLowerCase().includes(search) ||
        (driver.phoneNumber && driver.phoneNumber.toLowerCase().includes(search))
      );
    }

    // Referrer filter
    if (this.selectedReferrer) {
      filtered = filtered.filter(driver => driver.referrerName === this.selectedReferrer);
    }

    // Date range filter (for rejection date)
    if (this.dateFrom) {
      const fromDate = new Date(this.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(driver => {
        const rejectedDate = new Date(driver.rejectedAt);
        rejectedDate.setHours(0, 0, 0, 0);
        return rejectedDate >= fromDate;
      });
    }

    if (this.dateTo) {
      const toDate = new Date(this.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(driver => {
        const rejectedDate = new Date(driver.rejectedAt);
        return rejectedDate <= toDate;
      });
    }

    this.filteredDrivers = filtered;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedReferrer = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  openDetailModal(driver: RejectedDriver): void {
    this.driverToView = driver;
    this.showDetailModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.driverToView = null;
    document.body.style.overflow = '';
  }

  navigateToDetail(driverId: number): void {
    this.router.navigate(['/drivers', driverId]);
  }

  formatDate(date: string): string {
    if (!date) return '-';
    return this.timeZoneService.formatDateTime(date);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.closeDetailModal();
  }
}


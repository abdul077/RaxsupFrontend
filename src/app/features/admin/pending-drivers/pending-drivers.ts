import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { PendingDriver } from '../../../core/models/driver.model';
import { ConfirmationModalComponent, ConfirmationModalData } from '../../../shared/components/confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-pending-drivers',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './pending-drivers.html',
  styleUrl: './pending-drivers.scss',
})
export class PendingDriversComponent implements OnInit, OnDestroy {
  pendingDrivers: PendingDriver[] = [];
  filteredDrivers: PendingDriver[] = [];
  errorMessage = '';
  successMessage = '';
  loading = false;

  // Modal states
  showApproveModal = false;
  showRejectModal = false;
  showDetailModal = false;
  driverToApprove: PendingDriver | null = null;
  driverToReject: PendingDriver | null = null;
  driverToView: PendingDriver | null = null;
  approving = false;
  rejecting = false;
  modalErrorMessage = '';
  rejectionReason = '';

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
    this.loadPendingDrivers();
  }

  loadPendingDrivers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.driverService.getPendingDrivers().subscribe({
      next: (drivers) => {
        this.pendingDrivers = drivers;
        this.extractReferrers();
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load pending drivers';
        this.loading = false;
      }
    });
  }

  extractReferrers(): void {
    const uniqueReferrers = new Set<string>();
    this.pendingDrivers.forEach(driver => {
      if (driver.referrerName) {
        uniqueReferrers.add(driver.referrerName);
      }
    });
    this.referrers = Array.from(uniqueReferrers).sort();
  }

  applyFilters(): void {
    let filtered = [...this.pendingDrivers];

    // Search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(driver =>
        driver.fullName.toLowerCase().includes(term) ||
        driver.username.toLowerCase().includes(term) ||
        driver.email.toLowerCase().includes(term) ||
        (driver.phoneNumber && driver.phoneNumber.includes(term))
      );
    }

    // Referrer filter
    if (this.selectedReferrer) {
      filtered = filtered.filter(driver => driver.referrerName === this.selectedReferrer);
    }

    // Date filters
    if (this.dateFrom) {
      const fromDate = new Date(this.dateFrom);
      filtered = filtered.filter(driver => new Date(driver.createdAt) >= fromDate);
    }

    if (this.dateTo) {
      const toDate = new Date(this.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(driver => new Date(driver.createdAt) <= toDate);
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

  get confirmationData(): ConfirmationModalData | null {
    if (!this.driverToApprove) return null;

    const details: Array<{ label: string; value: string; icon?: string }> = [
      {
        label: 'Username',
        value: this.driverToApprove.username,
        icon: 'fas fa-user'
      },
      {
        label: 'Email',
        value: this.driverToApprove.email,
        icon: 'fas fa-envelope'
      }
    ];

    if (this.driverToApprove.phoneNumber) {
      details.push({
        label: 'Phone',
        value: this.driverToApprove.phoneNumber,
        icon: 'fas fa-phone'
      });
    }

    if (this.driverToApprove.referrerName) {
      details.push({
        label: 'Referred By',
        value: `<span class="badge bg-info">${this.driverToApprove.referrerName}</span>`,
        icon: 'fas fa-user-friends'
      });
    }

    return {
      title: 'Approve Driver',
      message: `Are you sure you want to approve <strong>${this.driverToApprove.fullName}</strong>?`,
      confirmText: 'Approve Driver',
      cancelText: 'Cancel',
      confirmButtonClass: 'btn-success',
      icon: 'fas fa-check-circle',
      iconColor: '#10b981',
      showDetails: true,
      details: details,
      notice: 'Once approved, the driver will be able to login and access the system.'
    };
  }

  get rejectConfirmationData(): ConfirmationModalData | null {
    if (!this.driverToReject) return null;

    const details: Array<{ label: string; value: string; icon?: string }> = [
      {
        label: 'Username',
        value: this.driverToReject.username,
        icon: 'fas fa-user'
      },
      {
        label: 'Email',
        value: this.driverToReject.email,
        icon: 'fas fa-envelope'
      }
    ];

    if (this.driverToReject.phoneNumber) {
      details.push({
        label: 'Phone',
        value: this.driverToReject.phoneNumber,
        icon: 'fas fa-phone'
      });
    }

    if (this.driverToReject.referrerName) {
      details.push({
        label: 'Referred By',
        value: `<span class="badge bg-info">${this.driverToReject.referrerName}</span>`,
        icon: 'fas fa-user-friends'
      });
    }

    return {
      title: 'Reject Driver',
      message: `Are you sure you want to reject <strong>${this.driverToReject.fullName}</strong>?`,
      confirmText: 'Reject Driver',
      cancelText: 'Cancel',
      confirmButtonClass: 'btn-danger',
      icon: 'fas fa-times-circle',
      iconColor: '#ef4444',
      showDetails: true,
      details: details,
      notice: 'The driver will be notified via email and will not be able to access the system.',
      showInput: true,
      inputLabel: 'Rejection Reason (Optional)',
      inputPlaceholder: 'Please provide a reason for rejection...',
      inputValue: this.rejectionReason
    };
  }

  openApproveModal(driver: PendingDriver): void {
    this.driverToApprove = driver;
    this.showApproveModal = true;
    this.modalErrorMessage = '';
    this.errorMessage = '';
    document.body.style.overflow = 'hidden';
  }

  openRejectModal(driver: PendingDriver): void {
    this.driverToReject = driver;
    this.rejectionReason = '';
    this.showRejectModal = true;
    this.modalErrorMessage = '';
    this.errorMessage = '';
    document.body.style.overflow = 'hidden';
  }

  closeApproveModal(): void {
    this.showApproveModal = false;
    this.driverToApprove = null;
    this.approving = false;
    this.modalErrorMessage = '';
    document.body.style.overflow = '';
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.driverToReject = null;
    this.rejecting = false;
    this.rejectionReason = '';
    this.modalErrorMessage = '';
    document.body.style.overflow = '';
  }

  onApproveModalConfirm(): void {
    this.approveDriver();
  }

  onApproveModalCancel(): void {
    this.closeApproveModal();
  }

  onApproveModalClose(): void {
    this.closeApproveModal();
  }

  onRejectModalConfirm(reason?: string): void {
    // Always update rejectionReason with the value from modal (can be empty string or undefined)
    this.rejectionReason = reason || '';
    this.rejectDriver();
  }

  onRejectModalCancel(): void {
    this.closeRejectModal();
  }

  onRejectModalClose(): void {
    this.closeRejectModal();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.closeDetailModal();
  }

  approveDriver(): void {
    if (!this.driverToApprove) return;

    this.approving = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.modalErrorMessage = '';
    
    this.driverService.approveDriver(this.driverToApprove.driverId).subscribe({
      next: () => {
        this.successMessage = `Driver ${this.driverToApprove!.fullName} has been approved successfully.`;
        this.closeApproveModal();
        this.loadPendingDrivers();
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (err) => {
        this.modalErrorMessage = err.error?.message || 'Failed to approve driver';
        this.approving = false;
      }
    });
  }

  rejectDriver(): void {
    if (!this.driverToReject) return;

    this.rejecting = true;
    this.successMessage = '';
    this.errorMessage = '';
    this.modalErrorMessage = '';
    
    // Get the rejection reason, trim it, and convert empty string to undefined
    const rejectionReason = this.rejectionReason && this.rejectionReason.trim() 
      ? this.rejectionReason.trim() 
      : undefined;
    this.driverService.rejectDriver(this.driverToReject.driverId, rejectionReason).subscribe({
      next: () => {
        this.successMessage = `Driver ${this.driverToReject!.fullName} has been rejected.`;
        this.closeRejectModal();
        this.loadPendingDrivers();
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (err) => {
        this.modalErrorMessage = err.error?.message || 'Failed to reject driver';
        this.rejecting = false;
      }
    });
  }

  formatDate(date: string): string {
    return this.timeZoneService.formatDateTime(date);
  }

  openDetailModal(driver: PendingDriver): void {
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
    this.closeDetailModal();
    this.router.navigate(['/drivers', driverId]);
  }
}

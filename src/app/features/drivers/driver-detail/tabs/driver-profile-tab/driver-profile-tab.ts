import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DriverDetail } from '../../../../../core/models/driver.model';

@Component({
  selector: 'app-driver-profile-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-profile-tab.html',
  styleUrl: './driver-profile-tab.scss'
})
export class DriverProfileTabComponent {
  @Input() driver: DriverDetail | null = null;

  constructor(private router: Router) {}

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatRoId(id: number | undefined | null): string {
    if (id === undefined || id === null) return '-';
    return `RO${id}`;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Active':
      case 'Available':
        return 'badge bg-success';
      case 'OnTrip':
        return 'badge bg-primary';
      case 'Inactive':
        return 'badge bg-secondary';
      case 'OffDuty':
        return 'badge bg-warning';
      default:
        return 'badge bg-secondary';
    }
  }

  getTotalEarnings(): number {
    if (!this.driver || !this.driver.settlements || this.driver.settlements.length === 0) return 0;
    return this.driver.settlements
      .filter(s => s.status === 'Paid')
      .reduce((sum, s) => sum + (s.netPay || 0), 0);
  }

  getCurrentMonthEarnings(): number {
    if (!this.driver || !this.driver.settlements || this.driver.settlements.length === 0) return 0;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.driver.settlements
      .filter(s => {
        if (s.status !== 'Paid') return false;
        const periodStart = s.periodStart ? new Date(s.periodStart) : null;
        return periodStart && periodStart >= currentMonthStart;
      })
      .reduce((sum, s) => sum + (s.netPay || 0), 0);
  }

  getCompletedLoadsCount(): number {
    if (!this.driver || !this.driver.performance) return 0;
    return this.driver.performance.totalDeliveries || 0;
  }

  getReferralEarningsTotal(): number {
    return 0; // TODO: Calculate from referral earnings
  }

  getReferralLink(): string {
    if (!this.driver) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/auth/login?ref=${this.driver.driverId}`;
  }

  copyReferralLink(): void {
    const link = this.getReferralLink();
    if (!link) {
      alert('Referral link is not available');
      return;
    }

    const inputElement = document.getElementById('referralLinkInput') as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
      inputElement.select();
      inputElement.setSelectionRange(0, 99999);
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          alert('Referral link copied to clipboard!');
          return;
        }
      } catch (err) {
        console.error('execCommand failed:', err);
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(() => {
        alert('Referral link copied to clipboard!');
      }).catch((err) => {
        console.error('Failed to copy using clipboard API:', err);
        this.fallbackCopyToClipboard(link);
      });
    } else {
      this.fallbackCopyToClipboard(link);
    }
  }

  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('Referral link copied to clipboard!');
      } else {
        alert('Failed to copy. Please manually copy the link from the input field.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy. Please manually copy the link from the input field.');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  navigateToTab(tab: string): void {
    // Emit event or use router to navigate to tab
    // For now, we'll use a simple approach - parent component handles this
  }
}


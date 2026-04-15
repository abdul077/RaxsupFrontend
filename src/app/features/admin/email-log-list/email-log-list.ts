import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { EmailLog } from '../../../core/models/admin.model';
import { TimeZoneService } from '../../../core/services/timezone.service';

@Component({
  selector: 'app-email-log-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './email-log-list.html',
  styleUrl: './email-log-list.scss',
})
export class EmailLogListComponent implements OnInit, OnDestroy {
  emailLogs: EmailLog[] = [];
  loading = false;
  filterStatus = '';
  filterTo = '';
  private readonly easternTimeZone = 'America/New_York';
  private timeUpdateInterval?: any;
  currentTime = Date.now();
  selectedLog: EmailLog | null = null;

  constructor(
    private adminService: AdminService,
    private timeZoneService: TimeZoneService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEmailLogs();
    
    // Update time every 30 seconds to refresh "time ago" displays
    this.timeUpdateInterval = setInterval(() => {
      this.currentTime = Date.now();
      this.cdr.markForCheck();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }

  loadEmailLogs(): void {
    this.loading = true;
    this.adminService.getEmailLogs(
      this.filterTo || undefined,
      this.filterStatus || undefined
    ).subscribe({
      next: (data) => {
        this.emailLogs = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  formatDateTime(dateString: string | undefined): string {
    return this.timeZoneService.formatDateTime(dateString);
  }

  getTimeAgo(dateString: string | undefined): string {
    if (!dateString) return '';
    
    const date = this.parseDate(dateString);
    if (!date || isNaN(date.getTime())) {
      return '';
    }

    const now = new Date(this.currentTime);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 0) return 'Just now';
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.easternTimeZone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  }

  private parseDate(dateString: string): Date | null {
    if (!dateString) return null;

    try {
      const timestampStr = dateString.trim();
      let date: Date;
      
      if (timestampStr.includes('T') && !timestampStr.endsWith('Z') && !timestampStr.match(/[+-]\d{2}:?\d{2}$/)) {
        date = new Date(timestampStr + 'Z');
      } else {
        date = new Date(timestampStr);
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date;
    } catch (error) {
      return null;
    }
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'sent':
        return 'status-sent';
      case 'failed':
        return 'status-failed';
      case 'pending':
        return 'status-pending';
      default:
        return '';
    }
  }

  viewDetails(log: EmailLog): void {
    this.selectedLog = log;
  }

  closeDetails(): void {
    this.selectedLog = null;
  }

  applyFilters(): void {
    this.loadEmailLogs();
  }

  clearFilters(): void {
    this.filterStatus = '';
    this.filterTo = '';
    this.loadEmailLogs();
  }
}

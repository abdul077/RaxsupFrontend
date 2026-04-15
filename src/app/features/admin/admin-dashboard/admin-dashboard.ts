import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { Company, Branch, ApiKey, Notification, AuditLog, UserDetail } from '../../../core/models/admin.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboardComponent implements OnInit {
  loading = false;
  stats = {
    totalCompanies: 0,
    totalBranches: 0,
    totalUsers: 0,
    activeApiKeys: 0,
    unreadNotifications: 0
  };

  recentNotifications: Notification[] = [];
  recentAuditLogs: AuditLog[] = [];

  constructor(
    private adminService: AdminService,
    private timeZoneService: TimeZoneService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    // Load stats
    this.adminService.getCompanies(true).subscribe({
      next: (companies) => {
        this.stats.totalCompanies = companies.length;
      }
    });

    this.adminService.getBranches(undefined, true).subscribe({
      next: (branches) => {
        this.stats.totalBranches = branches.length;
      }
    });

    this.adminService.getUsers(undefined, true).subscribe({
      next: (users) => {
        this.stats.totalUsers = users.length;
      }
    });

    this.adminService.getApiKeys(true).subscribe({
      next: (keys) => {
        this.stats.activeApiKeys = keys.length;
      }
    });

    this.adminService.getNotifications(undefined, false).subscribe({
      next: (notifications) => {
        this.stats.unreadNotifications = notifications.length;
        this.recentNotifications = notifications.slice(0, 5);
        this.loading = false;
      }
    });

    this.adminService.getAuditLogs(undefined, undefined, undefined, undefined, undefined, 1, 5).subscribe({
      next: (data) => {
        this.recentAuditLogs = data.items?.slice(0, 5) ?? [];
      }
    });
  }

  getRelativeTime(timestamp: string): string {
    const now = new Date();
    
    // Parse timestamp - ensure it's treated as UTC
    const timestampStr = timestamp.trim();
    let time: Date;
    if (timestampStr.includes('T') && !timestampStr.endsWith('Z') && !timestampStr.match(/[+-]\d{2}:\d{2}$/)) {
      time = new Date(timestampStr + 'Z');
    } else {
      time = new Date(timestampStr);
    }
    
    const diffMs = now.getTime() - time.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
    if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
    
    // Fallback: format date in Eastern Time
    const formatted = this.timeZoneService.formatDate(time.toISOString(), 'MMM d, y');
    return formatted || time.toLocaleDateString();
  }

  formatTimestamp(timestamp: string): string {
    return this.timeZoneService.formatDateTime(timestamp);
  }
}


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { ComplianceReports, ComplianceSummary, AuditReadiness } from '../../../core/models/compliance.model';

@Component({
  selector: 'app-compliance-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './compliance-dashboard.html',
  styleUrl: './compliance-dashboard.scss',
})
export class ComplianceDashboardComponent implements OnInit {
  reports: ComplianceReports | null = null;
  loading = true;

  constructor(private complianceService: ComplianceService) {}

  ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);

    this.complianceService.getComplianceReports(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ).subscribe({
      next: (data) => {
        this.reports = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getCompliancePercentage(summary: ComplianceSummary): number {
    if (summary.totalDrivers === 0) return 0;
    return Math.round((summary.compliantDrivers / summary.totalDrivers) * 100);
  }

  getScoreClass(score: number): string {
    if (score >= 90) return 'text-success';
    if (score >= 70) return 'text-warning';
    return 'text-danger';
  }
}


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';

@Component({
  selector: 'app-driver-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-analytics.html',
  styleUrl: './driver-analytics.scss'
})
export class DriverAnalyticsComponent implements OnInit {
  driverId!: number;
  analytics: any = null;
  loading = true;
  startDate: string = '';
  endDate: string = '';

  constructor(
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = +params.get('id')!;
      if (id && id !== this.driverId) {
        this.driverId = id;
        this.loadAnalytics();
      } else if (!this.driverId && id) {
        this.driverId = id;
        this.loadAnalytics();
      }
    });
  }

  loadAnalytics(): void {
    if (!this.driverId) return;
    this.loading = true;
    this.driverService.getDriverAnalytics(
      this.driverId,
      this.startDate || undefined,
      this.endDate || undefined
    ).subscribe({
      next: (data) => {
        this.analytics = data;
        this.loading = false;
      },
      error: () => {
        this.analytics = null;
        this.loading = false;
      }
    });
  }

  applyDateFilter(): void {
    this.loadAnalytics();
  }

  navigateBack(): void {
    this.router.navigate(['/drivers', this.driverId]);
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}


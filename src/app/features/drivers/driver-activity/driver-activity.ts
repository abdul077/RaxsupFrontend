import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';

@Component({
  selector: 'app-driver-activity',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-activity.html',
  styleUrl: './driver-activity.scss'
})
export class DriverActivityComponent implements OnInit {
  driverId!: number;
  activities: any[] = [];
  loading = true;
  activityTypeFilter: string = '';
  startDate: string = '';
  endDate: string = '';
  pageNumber = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 1;

  activityTypes = ['All', 'LoadAssignment', 'DocumentUpload', 'Settlement', 'ProfileUpdate'];

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
        this.loadActivities();
      } else if (!this.driverId && id) {
        this.driverId = id;
        this.loadActivities();
      }
    });
  }

  loadActivities(): void {
    if (!this.driverId) return;
    this.loading = true;
    this.driverService.getDriverActivityLog(
      this.driverId,
      this.activityTypeFilter === 'All' ? undefined : this.activityTypeFilter || undefined,
      this.startDate || undefined,
      this.endDate || undefined,
      this.pageNumber,
      this.pageSize
    ).subscribe({
      next: (data: any) => {
        this.activities = data.activities || [];
        this.totalCount = data.totalCount || 0;
        this.totalPages = data.totalPages || 1;
        this.loading = false;
      },
      error: () => {
        this.activities = [];
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadActivities();
  }

  navigateBack(): void {
    this.router.navigate(['/drivers', this.driverId]);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'LoadAssignment': return 'fa-boxes';
      case 'DocumentUpload': return 'fa-file';
      case 'Settlement': return 'fa-dollar-sign';
      case 'ProfileUpdate': return 'fa-user-edit';
      default: return 'fa-circle';
    }
  }
}


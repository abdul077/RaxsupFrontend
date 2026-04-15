import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { Load } from '../../../core/models/load.model';

interface DriverLoadsResponse {
  loads: Load[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  stats: {
    totalLoads: number;
    completedLoads: number;
    onTimeDeliveries: number;
    totalRevenue: number;
    averageRevenuePerLoad: number;
    onTimeDeliveryRate: number;
  };
}

@Component({
  selector: 'app-driver-loads',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-loads.html',
  styleUrl: './driver-loads.scss'
})
export class DriverLoadsComponent implements OnInit {
  driverId!: number;
  loads: Load[] = [];
  loading = true;
  stats: DriverLoadsResponse['stats'] | null = null;

  // Filters
  statusFilter: string = '';
  customerFilter: number | null = null;
  searchTerm: string = '';
  startDate: string = '';
  endDate: string = '';

  // Pagination
  pageNumber = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 1;

  statusOptions = [
    'Created',
    'Assigned',
    'Dispatched',
    'PickedUp',
    'InTransit',
    'Delivered',
    'Completed',
    'Settled',
    'Cancelled'
  ];

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
        this.loadLoads();
      } else if (!this.driverId && id) {
        this.driverId = id;
        this.loadLoads();
      }
    });
  }

  loadLoads(): void {
    if (!this.driverId) return;
    
    this.loading = true;
    this.driverService.getDriverLoads(
      this.driverId,
      this.statusFilter || undefined,
      this.customerFilter || undefined,
      this.searchTerm || undefined,
      this.startDate || undefined,
      this.endDate || undefined,
      this.pageNumber,
      this.pageSize
    ).subscribe({
      next: (data: DriverLoadsResponse) => {
        this.loads = data.loads;
        this.totalCount = data.totalCount;
        this.totalPages = data.totalPages;
        this.stats = data.stats;
        this.loading = false;
      },
      error: () => {
        this.loads = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.stats = null;
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadLoads();
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.customerFilter = null;
    this.searchTerm = '';
    this.startDate = '';
    this.endDate = '';
    this.pageNumber = 1;
    this.loadLoads();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.pageNumber = page;
      this.loadLoads();
    }
  }

  onPageSizeChange(): void {
    this.pageNumber = 1;
    this.loadLoads();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.pageNumber - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  getEndRecordNumber(): number {
    return Math.min(this.pageNumber * this.pageSize, this.totalCount);
  }

  navigateToLoad(loadId: number): void {
    this.router.navigate(['/loads', loadId]);
  }

  navigateBack(): void {
    this.router.navigate(['/drivers', this.driverId]);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  getStatusDisplayLabel(status: string | undefined): string {
    if (!status) return '-';
    const map: Record<string, string> = {
      Created: 'Created',
      Assigned: 'Assigned',
      Dispatched: 'Dispatched',
      PickedUp: 'Picked up',
      InTransit: 'In transit',
      Delivered: 'Delivered',
      Completed: 'Completed',
      Settled: 'Settled',
      Cancelled: 'Cancelled'
    };
    return map[status] || status;
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Delivered':
      case 'Completed':
      case 'Settled':
        return 'badge bg-success';
      case 'InTransit':
      case 'PickedUp':
        return 'badge bg-primary';
      case 'Assigned':
      case 'Dispatched':
        return 'badge bg-info';
      case 'Created':
        return 'badge bg-secondary';
      case 'Cancelled':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  exportLoads(): void {
    // TODO: Implement export functionality
    alert('Export functionality coming soon');
  }
}


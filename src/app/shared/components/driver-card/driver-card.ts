import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-driver-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-card.html',
  styleUrl: './driver-card.scss'
})
export class DriverCardComponent {
  @Input() driver!: Driver;
  @Input() showActions: boolean = true;

  constructor(private router: Router) {}

  navigateToDetail(): void {
    this.router.navigate(['/drivers', this.driver.driverId]);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
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
}


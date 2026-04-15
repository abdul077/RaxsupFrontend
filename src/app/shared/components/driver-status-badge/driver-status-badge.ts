import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-driver-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span [class]="getBadgeClass()">{{ status }}</span>
  `
})
export class DriverStatusBadgeComponent {
  @Input() status: string = '';

  getBadgeClass(): string {
    switch (this.status) {
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


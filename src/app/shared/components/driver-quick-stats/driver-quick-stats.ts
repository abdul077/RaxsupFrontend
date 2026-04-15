import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-driver-quick-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './driver-quick-stats.html',
  styleUrl: './driver-quick-stats.scss'
})
export class DriverQuickStatsComponent {
  @Input() totalEarnings: number = 0;
  @Input() currentMonthEarnings: number = 0;
  @Input() completedLoads: number = 0;
  @Input() referralCount: number = 0;
  @Input() referralEarnings: number = 0;

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}


import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-expiry-alert',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-expiry-alert.html',
  styleUrl: './document-expiry-alert.scss'
})
export class DocumentExpiryAlertComponent {
  @Input() expiredCount: number = 0;
  @Input() expiringCount: number = 0;

  hasAlerts(): boolean {
    return this.expiredCount > 0 || this.expiringCount > 0;
  }
}


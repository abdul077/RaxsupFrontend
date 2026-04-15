import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { Incident } from '../../../core/models/compliance.model';

@Component({
  selector: 'app-driver-incident-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './driver-incident-detail.html',
  styleUrl: './driver-incident-detail.scss',
})
export class DriverIncidentDetailComponent implements OnInit {
  incident: Incident | null = null;
  loading = true;

  constructor(
    private complianceService: ComplianceService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (isNaN(id) || id <= 0) {
        console.error('Invalid incident ID:', params['id']);
        alert('Invalid incident ID');
        this.router.navigate(['/drivers/my-incidents']);
        return;
      }
      this.loadIncident(id);
    });
  }

  loadIncident(id: number): void {
    this.loading = true;
    console.log('Loading incident with ID:', id);
    this.complianceService.getMyIncidentById(id).subscribe({
      next: (data) => {
        console.log('Incident loaded successfully:', data);
        this.incident = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading incident:', err);
        console.error('Error status:', err?.status);
        console.error('Error error:', err?.error);
        this.loading = false;
        const errorMessage = err?.error?.message || err?.message || 'Failed to load incident details. You may not have access to this incident.';
        alert(errorMessage);
        this.router.navigate(['/drivers/my-incidents']);
      }
    });
  }

  backToList(): void {
    this.router.navigate(['/drivers/my-incidents']);
  }

  getSeverityBadgeClass(severity: string): string {
    const severityMap: { [key: string]: string } = {
      'Low': 'bg-info',
      'Medium': 'bg-warning',
      'High': 'bg-danger',
      'Critical': 'bg-danger'
    };
    return severityMap[severity] || 'bg-secondary';
  }

  getLocationString(): string {
    if (!this.incident) return 'N/A';
    const parts = [this.incident.location, this.incident.city, this.incident.state].filter(x => x);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(amount?: number): string {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
}


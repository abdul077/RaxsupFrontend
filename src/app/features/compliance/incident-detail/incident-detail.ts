import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { Incident } from '../../../core/models/compliance.model';
import { IncidentStatusUpdateComponent } from '../incident-status-update/incident-status-update';

@Component({
  selector: 'app-incident-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, IncidentStatusUpdateComponent],
  templateUrl: './incident-detail.html',
  styleUrl: './incident-detail.scss',
})
export class IncidentDetailComponent implements OnInit {
  incident: Incident | null = null;
  loading = true;
  showStatusModal = false;

  constructor(
    private complianceService: ComplianceService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      this.loadIncident(id);
    });
  }

  loadIncident(id: number): void {
    this.loading = true;
    this.complianceService.getIncidentById(id).subscribe({
      next: (data) => {
        this.incident = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  editIncident(): void {
    if (this.incident) {
      this.router.navigate(['/compliance/incidents', this.incident.incidentId, 'edit']);
    }
  }

  backToList(): void {
    this.router.navigate(['/compliance/incidents']);
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'Critical': return 'bg-danger';
      case 'High': return 'bg-warning';
      case 'Medium': return 'bg-info';
      case 'Low': return 'bg-success';
      default: return 'bg-primary';
    }
  }

  getLocationString(): string {
    if (!this.incident) return 'N/A';
    const parts = [this.incident.location, this.incident.city, this.incident.state].filter(x => x);
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }

  openStatusUpdate(): void {
    this.showStatusModal = true;
  }

  onStatusUpdated(): void {
    if (this.incident) {
      this.loadIncident(this.incident.incidentId);
    }
  }

  onStatusModalClose(): void {
    this.showStatusModal = false;
  }
}


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { Incident } from '../../../core/models/compliance.model';
import { IncidentStatusUpdateComponent } from '../incident-status-update/incident-status-update';

@Component({
  selector: 'app-incident-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IncidentStatusUpdateComponent],
  templateUrl: './incident-list.html',
  styleUrl: './incident-list.scss',
})
export class IncidentListComponent implements OnInit {
  incidents: Incident[] = [];
  filteredIncidents: Incident[] = [];

  // Filters
  driverIdFilter: number | null = null;
  resolvedFilter: boolean | null = null;
  severityFilter: string = '';
  incidentTypeFilter: string = '';
  searchTerm: string = '';

  // Status update modal
  showStatusModal = false;
  selectedIncident: Incident | null = null;

  severityOptions = ['Low', 'Medium', 'High', 'Critical'];
  incidentTypeOptions = ['Accident', 'NearMiss', 'Injury', 'PropertyDamage', 'Other'];

  constructor(
    private complianceService: ComplianceService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadIncidents();
  }

  loadIncidents(): void {
    this.complianceService.getIncidents(
      this.driverIdFilter || undefined,
      undefined,
      this.resolvedFilter ?? undefined
    ).subscribe({
      next: (data) => {
        this.incidents = data;
        this.applyFilters();
      },
      error: () => {
        this.incidents = [];
        this.filteredIncidents = [];
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.incidents];

    if (this.severityFilter) {
      filtered = filtered.filter(i => i.severity === this.severityFilter);
    }

    if (this.incidentTypeFilter) {
      filtered = filtered.filter(i => i.incidentType === this.incidentTypeFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        i.incidentNumber.toLowerCase().includes(term) ||
        i.description.toLowerCase().includes(term) ||
        i.driverName?.toLowerCase().includes(term) ||
        i.location?.toLowerCase().includes(term)
      );
    }

    this.filteredIncidents = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.driverIdFilter = null;
    this.resolvedFilter = null;
    this.severityFilter = '';
    this.incidentTypeFilter = '';
    this.searchTerm = '';
    this.loadIncidents();
  }

  viewIncident(id: number): void {
    this.router.navigate(['/compliance/incidents', id]);
  }

  createIncident(): void {
    this.router.navigate(['/compliance/incidents/create']);
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

  openStatusUpdate(incident: Incident, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedIncident = incident;
    this.showStatusModal = true;
  }

  onStatusUpdated(): void {
    this.loadIncidents();
  }

  onStatusModalClose(): void {
    this.showStatusModal = false;
    this.selectedIncident = null;
  }
}

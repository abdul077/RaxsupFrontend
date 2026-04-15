import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { Incident } from '../../../core/models/compliance.model';

@Component({
  selector: 'app-driver-incidents',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './driver-incidents.html',
  styleUrl: './driver-incidents.scss',
})
export class DriverIncidentsComponent implements OnInit {
  incidents: Incident[] = [];
  filteredIncidents: Incident[] = [];
  loading = true;

  // Filters
  resolvedFilter: boolean | null = null;
  severityFilter: string = '';
  incidentTypeFilter: string = '';
  searchTerm: string = '';

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
    this.loading = true;
    this.complianceService.getMyIncidents(
      this.resolvedFilter ?? undefined
    ).subscribe({
      next: (data) => {
        // Sort by incident date (most recent first)
        this.incidents = data.sort((a, b) => {
          const dateA = new Date(a.incidentDate).getTime();
          const dateB = new Date(b.incidentDate).getTime();
          return dateB - dateA;
        });
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading incidents:', err);
        this.incidents = [];
        this.filteredIncidents = [];
        this.loading = false;
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
        i.location?.toLowerCase().includes(term) ||
        i.incidentType.toLowerCase().includes(term)
      );
    }

    this.filteredIncidents = filtered;
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    this.resolvedFilter = null;
    this.severityFilter = '';
    this.incidentTypeFilter = '';
    this.searchTerm = '';
    this.loadIncidents();
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

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  viewIncident(id: number): void {
    this.router.navigate(['/drivers/my-incidents', id]);
  }
}


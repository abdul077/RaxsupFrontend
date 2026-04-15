import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComplianceService } from '../../../core/services/compliance.service';
import { UpdateIncidentRequest } from '../../../core/models/compliance.model';

@Component({
  selector: 'app-incident-status-update',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incident-status-update.html',
  styleUrl: './incident-status-update.scss',
})
export class IncidentStatusUpdateComponent implements OnInit, OnChanges {
  @Input() show = false;
  @Input() incidentId: number | null = null;
  @Input() currentResolved: boolean = false;
  @Input() currentResolvedDate?: string;
  @Input() incidentDate: string = '';
  
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  loading = false;
  saving = false;
  errors: { [key: string]: string } = {};
  submitted = false;

  formData = {
    resolved: false,
    resolvedDate: undefined as string | undefined,
    resolutionNotes: undefined as string | undefined,
    rootCause: undefined as string | undefined,
    correctiveAction: undefined as string | undefined
  };

  constructor(private complianceService: ComplianceService) {}

  ngOnInit(): void {
    if (this.show) {
      this.initializeForm();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && changes['show'].currentValue) {
      this.initializeForm();
    }
  }

  initializeForm(): void {
    this.formData = {
      resolved: this.currentResolved,
      resolvedDate: this.currentResolvedDate 
        ? new Date(this.currentResolvedDate).toISOString().split('T')[0]
        : undefined,
      resolutionNotes: undefined,
      rootCause: undefined,
      correctiveAction: undefined
    };
    this.errors = {};
    this.submitted = false;
  }

  onClose(): void {
    this.show = false;
    this.close.emit();
  }

  getMaxDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  validateForm(): void {
    this.errors = {};

    if (this.formData.resolved) {
      if (!this.formData.resolvedDate || !this.formData.resolvedDate.trim()) {
        this.errors['resolvedDate'] = 'Resolved date is required when marking incident as resolved';
      } else {
        // Validate resolvedDate is not before incidentDate
        if (this.incidentDate) {
          const resolvedDate = new Date(this.formData.resolvedDate);
          const incidentDate = new Date(this.incidentDate);
          if (resolvedDate < incidentDate) {
            this.errors['resolvedDate'] = 'Resolved date cannot be before incident date';
          }
        }
      }
    }

    // Max length validations
    if (this.formData.resolutionNotes && this.formData.resolutionNotes.length > 5000) {
      this.errors['resolutionNotes'] = 'Resolution notes cannot exceed 5000 characters';
    }

    if (this.formData.rootCause && this.formData.rootCause.length > 2000) {
      this.errors['rootCause'] = 'Root cause cannot exceed 2000 characters';
    }

    if (this.formData.correctiveAction && this.formData.correctiveAction.length > 2000) {
      this.errors['correctiveAction'] = 'Corrective action cannot exceed 2000 characters';
    }
  }

  isFormValid(): boolean {
    this.validateForm();
    return Object.keys(this.errors).length === 0;
  }

  getFieldError(fieldName: string): string {
    return this.errors[fieldName] || '';
  }

  hasError(fieldName: string): boolean {
    return this.submitted && !!this.errors[fieldName];
  }

  onSave(): void {
    if (!this.incidentId) return;
    
    this.submitted = true;
    this.validateForm();

    if (!this.isFormValid()) {
      return;
    }

    this.saving = true;
    
    // Load the current incident data first, then update only the status fields
    this.complianceService.getIncidentById(this.incidentId).subscribe({
      next: (incident) => {
        const updateData: UpdateIncidentRequest = {
          incidentId: this.incidentId!,
          driverId: incident.driverId,
          loadId: incident.loadId,
          equipmentId: incident.equipmentId,
          incidentDate: incident.incidentDate.split('T')[0],
          reportedDate: incident.reportedDate,
          incidentType: incident.incidentType,
          description: incident.description,
          location: incident.location || '',
          city: incident.city || '',
          state: incident.state || '',
          weatherConditions: incident.weatherConditions || '',
          roadConditions: incident.roadConditions || '',
          severity: incident.severity,
          isDOTReportable: incident.isDOTReportable,
          isOSHAReportable: incident.isOSHAReportable,
          dotReportNumber: incident.dotReportNumber,
          oshaReportNumber: incident.oshaReportNumber,
          assignedToUserId: undefined,
          resolved: this.formData.resolved,
          resolvedDate: this.formData.resolved && this.formData.resolvedDate
            ? new Date(this.formData.resolvedDate + 'T00:00:00').toISOString()
            : undefined,
          resolutionNotes: this.formData.resolutionNotes || undefined,
          rootCause: this.formData.rootCause || undefined,
          correctiveAction: this.formData.correctiveAction || undefined,
          estimatedCost: incident.estimatedCost
        };

        this.complianceService.updateIncident(this.incidentId!, updateData).subscribe({
          next: () => {
            this.saving = false;
            this.onClose();
            this.updated.emit();
          },
          error: () => {
            this.saving = false;
            this.errors['general'] = 'Failed to update incident status. Please try again.';
          }
        });
      },
      error: () => {
        this.saving = false;
        this.errors['general'] = 'Failed to load incident data. Please try again.';
      }
    });
  }
}

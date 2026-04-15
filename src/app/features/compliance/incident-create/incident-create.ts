import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { DriverService } from '../../../core/services/driver.service';
import { EquipmentService } from '../../../core/services/equipment.service';
import { CreateIncidentRequest, UpdateIncidentRequest } from '../../../core/models/compliance.model';
import { Driver } from '../../../core/models/driver.model';
import { Load } from '../../../core/models/load.model';
import { Equipment } from '../../../core/models/equipment.model';

@Component({
  selector: 'app-incident-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './incident-create.html',
  styleUrl: './incident-create.scss',
})
export class IncidentCreateComponent implements OnInit {
  isEditMode = false;
  incidentId: number | null = null;
  loading = false;
  saving = false;
  submitted = false;

  drivers: Driver[] = [];
  loads: Load[] = []; // Loads linked to the selected Owner Operator/Driver
  equipments: Equipment[] = [];
  filteredEquipments: Equipment[] = [];
  validationErrors: string[] = [];
  showErrors = false;

  formData: CreateIncidentRequest | UpdateIncidentRequest = {
    driverId: undefined,
    loadId: undefined,
    equipmentId: undefined,
    incidentDate: new Date().toISOString().split('T')[0],
    reportedDate: new Date().toISOString().slice(0, 16), // Format for datetime-local input
    incidentType: '',
    description: '',
    location: '',
    city: '',
    state: '',
    weatherConditions: '',
    roadConditions: '',
    severity: 'Low',
    isDOTReportable: false,
    isOSHAReportable: false,
    reportedByUserId: 1, // TODO: Get from auth service
    assignedToUserId: undefined,
    estimatedCost: undefined,
    resolved: false,
    resolvedDate: undefined,
    resolutionNotes: undefined,
    rootCause: undefined,
    correctiveAction: undefined
  };

  incidentTypeOptions = ['Accident', 'NearMiss', 'Injury', 'PropertyDamage', 'Other'];
  severityOptions = ['Low', 'Medium', 'High', 'Critical'];

  // Validation errors
  errors: { [key: string]: string } = {};

  constructor(
    private complianceService: ComplianceService,
    private driverService: DriverService,
    private equipmentService: EquipmentService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.incidentId = +params['id'];
        this.loadIncident();
      }
    });
    this.loadDrivers();
    this.loadEquipments();
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 100).subscribe({
      next: (data) => {
        // Filter to show only active and available drivers
        this.drivers = data.items.filter(driver => 
          driver.status === 'Active' || driver.status === 'Available'
        );
      }
    });
  }

  loadLoadsForDriver(driverId: number | undefined): void {
    if (!driverId) {
      this.loads = [];
      return;
    }
    this.driverService.getDriverLoads(driverId, undefined, undefined, undefined, undefined, undefined, 1, 100).subscribe({
      next: (data) => {
        this.loads = data.loads ?? data.items ?? [];
      }
    });
  }

  loadEquipments(): void {
    this.equipmentService.getEquipments().subscribe({
      next: (data) => {
        this.equipments = data;
        this.applyEquipmentFilter();
      }
    });
  }

  loadIncident(): void {
    if (!this.incidentId) return;
    this.loading = true;
    this.complianceService.getIncidentById(this.incidentId).subscribe({
      next: (incident) => {
        // Convert reportedDate to datetime-local format if it exists
        let reportedDateFormatted = incident.reportedDate;
        if (incident.reportedDate) {
          const date = new Date(incident.reportedDate);
          // Format as YYYY-MM-DDTHH:mm for datetime-local input
          reportedDateFormatted = date.toISOString().slice(0, 16);
        }
        
        // Convert resolvedDate to date format if it exists
        let resolvedDateFormatted = undefined;
        if (incident.resolvedDate) {
          const date = new Date(incident.resolvedDate);
          // Format as YYYY-MM-DD for date input
          resolvedDateFormatted = date.toISOString().split('T')[0];
        }
        
        this.formData = {
          incidentId: incident.incidentId,
          driverId: incident.driverId,
          loadId: incident.loadId,
          equipmentId: incident.equipmentId,
          incidentDate: incident.incidentDate.split('T')[0],
          reportedDate: reportedDateFormatted,
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
          resolved: incident.resolved,
          resolvedDate: resolvedDateFormatted,
          estimatedCost: incident.estimatedCost
        };
        this.applyEquipmentFilter();
        this.loadLoadsForDriver(incident.driverId);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onDriverChange(driverId: number | undefined): void {
    this.formData.driverId = driverId;
    this.applyEquipmentFilter();
    this.loadLoadsForDriver(driverId);
    // Reset load selection when driver changes (loads are driver-specific)
    this.formData.loadId = undefined;
    // Reset equipment selection if it no longer matches the filtered list
    if (
      this.formData.equipmentId &&
      !this.filteredEquipments.some(e => e.equipmentId === this.formData.equipmentId)
    ) {
      this.formData.equipmentId = undefined;
    }
  }

  private applyEquipmentFilter(): void {
    if (!this.formData.driverId) {
      this.filteredEquipments = [...this.equipments];
      return;
    }
    this.filteredEquipments = this.equipments.filter(
      equipment => equipment.assignedToDriverId === this.formData.driverId
    );
  }

  save(): void {
    this.submitted = true;
    this.validateForm();
    this.validationErrors = this.getValidationErrors();
    this.showErrors = !this.isFormValid();

    if (!this.isFormValid()) {
      this.scrollToFirstError();
      return;
    }
    this.showErrors = false;

    if (this.isEditMode && this.incidentId) {
      this.updateIncident();
    } else {
      this.createIncident();
    }
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const fieldSelectors = [
        'input[name=\"incidentDate\"]',
        'select[name=\"incidentType\"]',
        'select[name=\"severity\"]',
        'textarea[name=\"description\"]'
      ];

      for (const selector of fieldSelectors) {
        const field = document.querySelector(selector) as HTMLElement;
        if (field && field.classList.contains('is-invalid')) {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          field.focus();
          return;
        }
      }

      const firstErrorField = document.querySelector('.is-invalid') as HTMLElement;
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
        return;
      }

      const errorAlert = document.querySelector('.alert-danger');
      if (errorAlert) {
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }

  validateForm(): void {
    this.errors = {};

    // Required fields
    if (!this.formData.incidentDate || !this.formData.incidentDate.trim()) {
      this.errors['incidentDate'] = 'Incident date is required';
    } else {
      // Validate incident date is not in the future
      const incidentDate = new Date(this.formData.incidentDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      if (incidentDate > today) {
        this.errors['incidentDate'] = 'Incident date cannot be in the future';
      }
    }

    if (!this.formData.incidentType || !this.formData.incidentType.trim()) {
      this.errors['incidentType'] = 'Incident type is required';
    }

    if (!this.formData.description || !this.formData.description.trim()) {
      this.errors['description'] = 'Description is required';
    } else if (this.formData.description.trim().length < 10) {
      this.errors['description'] = 'Description must be at least 10 characters';
    }

    if (!this.formData.severity || !this.formData.severity.trim()) {
      this.errors['severity'] = 'Severity is required';
    }

    // Date validation: reported date should not be before incident date
    if (this.formData.reportedDate && this.formData.incidentDate) {
      const reportedDate = new Date(this.formData.reportedDate);
      const incidentDate = new Date(this.formData.incidentDate);
      if (reportedDate < incidentDate) {
        this.errors['reportedDate'] = 'Reported date cannot be before incident date';
      }
    }

    // Max length validations
    if (this.formData.location && this.formData.location.length > 200) {
      this.errors['location'] = 'Location cannot exceed 200 characters';
    }

    if (this.formData.city && this.formData.city.length > 100) {
      this.errors['city'] = 'City cannot exceed 100 characters';
    }

    if (this.formData.state && this.formData.state.length > 50) {
      this.errors['state'] = 'State cannot exceed 50 characters';
    }

    if (this.formData.weatherConditions && this.formData.weatherConditions.length > 200) {
      this.errors['weatherConditions'] = 'Weather conditions cannot exceed 200 characters';
    }

    if (this.formData.roadConditions && this.formData.roadConditions.length > 200) {
      this.errors['roadConditions'] = 'Road conditions cannot exceed 200 characters';
    }

    // Estimated cost validation
    if (this.formData.estimatedCost !== undefined && this.formData.estimatedCost !== null) {
      if (this.formData.estimatedCost < 0) {
        this.errors['estimatedCost'] = 'Estimated cost cannot be negative';
      }
    }

    // DOT/OSHA report number validations (if applicable)
    if (this.isEditMode && (this.formData as UpdateIncidentRequest).dotReportNumber) {
      const dotReportNumber = (this.formData as UpdateIncidentRequest).dotReportNumber;
      if (dotReportNumber && dotReportNumber.length > 100) {
        this.errors['dotReportNumber'] = 'DOT report number cannot exceed 100 characters';
      }
    }

    if (this.isEditMode && (this.formData as UpdateIncidentRequest).oshaReportNumber) {
      const oshaReportNumber = (this.formData as UpdateIncidentRequest).oshaReportNumber;
      if (oshaReportNumber && oshaReportNumber.length > 100) {
        this.errors['oshaReportNumber'] = 'OSHA report number cannot exceed 100 characters';
      }
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

  isValid(fieldName: string): boolean {
    // Only show valid state if submitted, no error, and field has value (for optional fields)
    if (!this.submitted || this.errors[fieldName]) {
      return false;
    }
    // For optional fields, only show valid if they have a value
    const optionalFields = ['location', 'city', 'state', 'weatherConditions', 'roadConditions', 'reportedDate', 'estimatedCost'];
    if (optionalFields.includes(fieldName)) {
      const value = (this.formData as any)[fieldName];
      return value !== undefined && value !== null && value !== '';
    }
    return true;
  }

  getValidationErrors(): string[] {
    return Object.values(this.errors);
  }

  getMaxDate(): string {
    // Return today's date in YYYY-MM-DD format for date input max attribute
    return new Date().toISOString().split('T')[0];
  }

  getMaxDateTime(): string {
    // Return current date/time in YYYY-MM-DDTHH:mm format for datetime-local input max attribute
    return new Date().toISOString().slice(0, 16);
  }

  createIncident(): void {
    this.saving = true;
    // Convert reportedDate from datetime-local format to ISO string if it exists
    const incidentData: CreateIncidentRequest = {
      ...this.formData as CreateIncidentRequest,
      reportedDate: this.formData.reportedDate ? new Date(this.formData.reportedDate).toISOString() : undefined
    };
    
    this.complianceService.createIncident(incidentData).subscribe({
      next: (result) => {
        this.router.navigate(['/compliance/incidents', result.incidentId]);
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  updateIncident(): void {
    if (!this.incidentId) return;
    this.saving = true;
    
    // Load current incident to preserve resolution fields
    this.complianceService.getIncidentById(this.incidentId).subscribe({
      next: (currentIncident) => {
        const updateData = this.formData as UpdateIncidentRequest;
        
        // Convert reportedDate from datetime-local format to ISO string if it exists
        const incidentData: UpdateIncidentRequest = {
          ...updateData,
          reportedDate: this.formData.reportedDate ? new Date(this.formData.reportedDate).toISOString() : undefined,
          // Preserve resolution fields from current incident (status updates are handled separately)
          resolved: currentIncident.resolved,
          resolvedDate: currentIncident.resolvedDate,
          resolutionNotes: (currentIncident as any).resolutionNotes,
          rootCause: (currentIncident as any).rootCause,
          correctiveAction: (currentIncident as any).correctiveAction
        };
        
        this.complianceService.updateIncident(this.incidentId!, incidentData).subscribe({
          next: () => {
            this.router.navigate(['/compliance/incidents', this.incidentId]);
          },
          error: () => {
            this.saving = false;
          }
        });
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.submitted = false;
    this.errors = {};
    if (this.isEditMode && this.incidentId) {
      this.router.navigate(['/compliance/incidents', this.incidentId]);
    } else {
      this.router.navigate(['/compliance/incidents']);
    }
  }
}


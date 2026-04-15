import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { DriverService } from '../../../core/services/driver.service';
import { EquipmentService } from '../../../core/services/equipment.service';
import { CreateInspectionRecordRequest } from '../../../core/models/compliance.model';
import { Driver } from '../../../core/models/driver.model';
import { Equipment } from '../../../core/models/equipment.model';

@Component({
  selector: 'app-inspection-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './inspection-create.html',
  styleUrl: './inspection-create.scss',
})
export class InspectionCreateComponent implements OnInit {
  drivers: Driver[] = [];
  equipments: Equipment[] = [];
  submitting = false;
  validationErrors: string[] = [];
  showErrors = false;

  form: CreateInspectionRecordRequest & { inspectionNumber?: string } = {
    equipmentId: 0,
    inspectionNumber: '',
    inspectionDate: new Date().toISOString().split('T')[0],
    inspectionType: 'DOT',
    result: 'Pass',
    isCritical: false
  };

  inspectionTypes = ['DOT', 'Level1', 'Level2', 'Level3', 'PreTrip', 'PostTrip', 'Annual', 'Other'];
  resultOptions = ['Pass', 'Fail', 'OutOfService'];

  constructor(
    private complianceService: ComplianceService,
    private driverService: DriverService,
    private equipmentService: EquipmentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDriversAndEquipments();
  }

  loadDriversAndEquipments(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 500).subscribe({
      next: (res) => { this.drivers = res.items; }
    });
    this.equipmentService.getEquipments().subscribe({
      next: (data) => { this.equipments = data; }
    });
  }

  onEquipmentChange(): void {
    if (!this.form.equipmentId || this.form.equipmentId === 0) {
      this.form.driverId = undefined;
      return;
    }
    const equipment = this.equipments.find(e => e.equipmentId === this.form.equipmentId);
    this.form.driverId = equipment?.assignedToDriverId ?? undefined;
  }

  private isFormValid(): boolean {
    return !!(
      this.form.equipmentId &&
      this.form.equipmentId > 0 &&
      this.form.inspectionNumber?.trim() &&
      this.form.inspectionDate &&
      this.form.result
    );
  }

  private scrollToFirstError(): void {
    setTimeout(() => {
      const firstErrorField = document.querySelector('.is-invalid') as HTMLElement;
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
      } else {
        const errorAlert = document.querySelector('.alert-danger');
        if (errorAlert) {
          errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    }, 100);
  }

  onSubmit(): void {
    if (!this.isFormValid()) {
      this.validationErrors = [];
      if (!this.form.equipmentId || this.form.equipmentId === 0) {
        this.validationErrors.push('Equipment must be selected');
      }
      if (!this.form.inspectionNumber?.trim()) {
        this.validationErrors.push('Inspection Number is required');
      }
      if (!this.form.inspectionDate) {
        this.validationErrors.push('Inspection Date is required');
      }
      if (!this.form.result) {
        this.validationErrors.push('Result must be selected');
      }
      this.showErrors = true;
      this.scrollToFirstError();
      return;
    }
    this.validationErrors = [];
    this.showErrors = false;
    this.submitting = true;
    const request: CreateInspectionRecordRequest = {
      equipmentId: this.form.equipmentId,
      driverId: this.form.driverId,
      inspectionNumber: this.form.inspectionNumber,
      inspectionDate: this.form.inspectionDate,
      inspectionType: this.form.inspectionType,
      inspector: this.form.inspector,
      inspectorBadgeNumber: this.form.inspectorBadgeNumber,
      location: this.form.location,
      state: this.form.state,
      result: this.form.result,
      oosViolations: this.form.oosViolations,
      totalViolations: this.form.totalViolations,
      remarks: this.form.remarks,
      isCritical: this.form.isCritical
    };
    this.complianceService.createInspectionRecord(request).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/compliance/dashboard']);
      },
      error: () => {
        this.submitting = false;
        this.validationErrors = ['Failed to create inspection record. Please try again.'];
        this.showErrors = true;
        this.scrollToFirstError();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/compliance/dashboard']);
  }
}

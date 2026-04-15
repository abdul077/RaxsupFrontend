import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { CreateDriverRequest, UpdateDriverRequest, OwnerOperator, Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-driver-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-create.html',
  styleUrl: './driver-create.scss',
})
export class DriverCreateComponent implements OnInit {
  driverId: number | null = null;
  isEditMode = false;
  loading = false;
  submitting = false;
  validationErrors: string[] = [];
  showErrors = false;
  ownerOperators: OwnerOperator[] = [];
  availableReferrers: Driver[] = [];

  formData: CreateDriverRequest | UpdateDriverRequest = {
    fullName: '',
    ownerOperatorId: undefined,
    licenseNumber: '',
    licenseState: '',
    licenseExpiry: '',
    mobilePhone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insuranceExpiry: '',
    payStructure: '',
    payRate: undefined,
    type: 'Employee',
    status: 'Available',
    hireDate: ''
  };

  payStructureOptions = ['Percentage', 'PerMile', 'Hourly', 'Salary'];
  typeOptions = ['Employee', 'OwnerOperator'];
  statusOptions = ['Active', 'Inactive', 'OnTrip', 'Available', 'OffDuty'];

  constructor(
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadOwnerOperators();
    this.loadAvailableReferrers();
    
    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.route.snapshot.url[this.route.snapshot.url.length - 1].path === 'edit') {
      this.driverId = +id;
      this.isEditMode = true;
      this.loadDriver();
    }
  }

  loadOwnerOperators(): void {
    this.driverService.getOwnerOperators(true).subscribe({
      next: (data) => {
        this.ownerOperators = data;
      },
      error: () => {
        this.ownerOperators = [];
      }
    });
  }

  loadAvailableReferrers(): void {
    this.driverService.getDrivers('Active', undefined, undefined, undefined, 1, 100).subscribe({
      next: (data) => {
        // Exclude the current driver if in edit mode
        if (this.isEditMode && this.driverId) {
          this.availableReferrers = data.items.filter(d => d.driverId !== this.driverId);
        } else {
          this.availableReferrers = data.items;
        }
      },
      error: () => {
        this.availableReferrers = [];
      }
    });
  }

  loadDriver(): void {
    if (!this.driverId) return;

    this.loading = true;
    this.driverService.getDriverById(this.driverId).subscribe({
      next: (driver) => {
        this.formData = {
          driverId: driver.driverId,
          fullName: driver.fullName,
          ownerOperatorId: driver.ownerOperatorId,
          licenseNumber: driver.licenseNumber,
          licenseState: driver.licenseState,
          licenseExpiry: driver.licenseExpiry,
          mobilePhone: driver.mobilePhone,
          email: driver.email,
          address: driver.address,
          city: driver.city,
          state: driver.state,
          zipCode: driver.zipCode,
          emergencyContactName: driver.emergencyContactName,
          emergencyContactPhone: driver.emergencyContactPhone,
          insuranceCompany: driver.insuranceCompany,
          insurancePolicyNumber: driver.insurancePolicyNumber,
          insuranceExpiry: driver.insuranceExpiry,
          payStructure: driver.payStructure,
          payRate: driver.payRate,
          type: driver.type,
          status: driver.status,
          hireDate: driver.hireDate,
          terminationDate: driver.terminationDate,
          isDQFComplete: driver.isDQFComplete,
          dqfCompletionDate: driver.dqfCompletionDate,
          referredBy: driver.referredBy
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        alert('Failed to load driver details');
        this.router.navigate(['/drivers']);
      }
    });
  }

  isFormValid(): boolean {
    if (!this.formData.fullName?.trim()) {
      return false;
    }
    if (this.isEmailInvalid) {
      return false;
    }
    if (this.isPayRateInvalid) {
      return false;
    }
    return true;
  }

  scrollToFirstError(): void {
    setTimeout(() => {
      const fieldSelectors = [
        'input[name="fullName"]',
        'input[name="email"]',
        'input[name="payRate"]'
      ];
      for (const selector of fieldSelectors) {
        const field = document.querySelector(selector) as HTMLElement;
        if (field?.classList.contains('is-invalid')) {
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
      const errorAlert = document.querySelector('.validation-alert');
      if (errorAlert) {
        errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  }

  onSubmit(): void {
    if (!this.isFormValid()) {
      this.validationErrors = [];
      if (!this.formData.fullName?.trim()) {
        this.validationErrors.push('Full Name is required');
      }
      if (this.isEmailInvalid) {
        this.validationErrors.push('Email must be a valid email address');
      }
      if (this.isPayRateInvalid) {
        this.validationErrors.push('Pay Rate cannot be negative');
      }
      this.showErrors = true;
      this.scrollToFirstError();
      return;
    }
    this.validationErrors = [];
    this.showErrors = false;

    this.submitting = true;

    if (this.isEditMode && this.driverId) {
      const updateData = this.formData as UpdateDriverRequest;
      updateData.driverId = this.driverId;
      
      this.driverService.updateDriver(this.driverId, updateData).subscribe({
        next: () => {
          this.submitting = false;
          this.router.navigate(['/drivers', this.driverId]);
        },
        error: (err) => {
          this.submitting = false;
          this.validationErrors = ['Failed to update driver. Please try again.'];
          this.showErrors = true;
          this.scrollToFirstError();
        }
      });
    } else {
      this.driverService.createDriver(this.formData as CreateDriverRequest).subscribe({
        next: (id) => {
          this.submitting = false;
          this.router.navigate(['/drivers', id]);
        },
        error: (err) => {
          this.submitting = false;
          this.validationErrors = ['Failed to create driver. Please try again.'];
          this.showErrors = true;
          this.scrollToFirstError();
        }
      });
    }
  }

  cancel(): void {
    if (this.isEditMode && this.driverId) {
      this.router.navigate(['/drivers', this.driverId]);
    } else {
      this.router.navigate(['/drivers']);
    }
  }

  get isDQFComplete(): boolean {
    return this.isEditMode && (this.formData as UpdateDriverRequest).isDQFComplete === true;
  }

  get terminationDate(): string | undefined {
    return this.isEditMode ? (this.formData as UpdateDriverRequest).terminationDate : undefined;
  }

  set terminationDate(value: string | undefined) {
    if (this.isEditMode) {
      (this.formData as UpdateDriverRequest).terminationDate = value;
    }
  }

  get dqfCompletionDate(): string | undefined {
    return this.isEditMode ? (this.formData as UpdateDriverRequest).dqfCompletionDate : undefined;
  }

  set dqfCompletionDate(value: string | undefined) {
    if (this.isEditMode) {
      (this.formData as UpdateDriverRequest).dqfCompletionDate = value;
    }
  }

  get updateFormData(): UpdateDriverRequest {
    return this.formData as UpdateDriverRequest;
  }

  get isEmailInvalid(): boolean {
    const email = this.formData.email?.trim();
    return !!(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  }

  get isPayRateInvalid(): boolean {
    const payRate = this.formData.payRate;
    return payRate !== undefined && payRate !== null && payRate < 0;
  }

  /** Profile completion 0–100 for edit mode progress bar (overall). */
  get profileCompletionPercent(): number {
    if (!this.isEditMode || !this.profileCompletionSections.length) return 0;
    const total = this.profileCompletionSections.reduce((sum, s) => sum + s.percent, 0);
    return Math.round(total / this.profileCompletionSections.length);
  }

  /** Sections for vertical progress bar: label and 0–100 percent per section. */
  get profileCompletionSections(): { label: string; percent: number }[] {
    if (!this.isEditMode) return [];
    const d = this.formData;
    const filled = (v: string | undefined): boolean => !!v?.trim();
    const payRateOk = d.payRate !== undefined && d.payRate !== null && d.payRate >= 0;
    return [
      {
        label: 'Basic',
        percent: this.sectionPercent([
          filled(d.fullName),
          filled(d.type),
          filled(d.status),
          filled(d.hireDate)
        ])
      },
      {
        label: 'Contact',
        percent: this.sectionPercent([
          filled(d.mobilePhone),
          filled(d.email),
          filled(d.address),
          filled(d.city),
          filled(d.state),
          filled(d.zipCode),
          filled(d.emergencyContactName),
          filled(d.emergencyContactPhone)
        ])
      },
      {
        label: 'License',
        percent: this.sectionPercent([
          filled(d.licenseNumber),
          filled(d.licenseState),
          filled(d.licenseExpiry)
        ])
      },
      {
        label: 'Insurance',
        percent: this.sectionPercent([
          filled(d.insuranceCompany),
          filled(d.insurancePolicyNumber),
          filled(d.insuranceExpiry)
        ])
      },
      {
        label: 'Pay',
        percent: this.sectionPercent([filled(d.payStructure), payRateOk])
      }
    ];
  }

  private sectionPercent(filled: boolean[]): number {
    if (!filled.length) return 0;
    const count = filled.filter(Boolean).length;
    return Math.round((count / filled.length) * 100);
  }
}


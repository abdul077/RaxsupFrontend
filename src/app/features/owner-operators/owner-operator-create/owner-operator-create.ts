import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { CreateOwnerOperatorRequest, UpdateOwnerOperatorRequest, OwnerOperator } from '../../../core/models/driver.model';

@Component({
  selector: 'app-owner-operator-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './owner-operator-create.html',
  styleUrl: './owner-operator-create.scss',
})
export class OwnerOperatorCreateComponent implements OnInit {
  ownerOperatorId: number | null = null;
  isEditMode = false;
  loading = false;
  submitting = false;
  ownerOperatorForm: FormGroup;
  availableReferrers: OwnerOperator[] = [];

  rateTypeOptions = ['Percentage', 'PerMile', 'FlatRate'];

  constructor(
    private fb: FormBuilder,
    private driverService: DriverService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.ownerOperatorForm = this.fb.group({
      companyName: ['', [Validators.required]],
      contactName: [''],
      phone: [''],
      email: ['', [Validators.email]],
      address: [''],
      city: [''],
      state: [''],
      zipCode: [''],
      taxId: [''],
      defaultRate: [null],
      rateType: [''],
      contractStartDate: [''],
      contractEndDate: [''],
      contractTerms: [''],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadAvailableReferrers();
    
    const id = this.route.snapshot.paramMap.get('id');
    if (id && this.route.snapshot.url[this.route.snapshot.url.length - 1].path === 'edit') {
      this.ownerOperatorId = +id;
      this.isEditMode = true;
      this.loadOwnerOperator();
    }
  }

  loadAvailableReferrers(): void {
    this.driverService.getOwnerOperators(true).subscribe({
      next: (data) => {
        this.availableReferrers = data;
      },
      error: () => {
        this.availableReferrers = [];
      }
    });
  }

  loadOwnerOperator(): void {
    if (!this.ownerOperatorId) return;
    
    this.loading = true;
    this.driverService.getOwnerOperatorById(this.ownerOperatorId).subscribe({
      next: (data) => {
        this.ownerOperatorForm.patchValue({
          companyName: data.companyName,
          contactName: data.contactName || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zipCode: data.zipCode || '',
          taxId: data.taxId || '',
          defaultRate: data.defaultRate || null,
          rateType: data.rateType || '',
          contractStartDate: data.contractStartDate ? new Date(data.contractStartDate).toISOString().split('T')[0] : '',
          contractEndDate: data.contractEndDate ? new Date(data.contractEndDate).toISOString().split('T')[0] : '',
          contractTerms: data.contractTerms || '',
          isActive: data.isActive
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        alert('Failed to load owner operator');
        this.router.navigate(['/owner-operators']);
      }
    });
  }

  onSubmit(): void {
    if (this.ownerOperatorForm.invalid) {
      return;
    }

    this.submitting = true;
    const formValue = this.ownerOperatorForm.value;

    if (this.isEditMode && this.ownerOperatorId) {
      const updateData: UpdateOwnerOperatorRequest = {
        ownerOperatorId: this.ownerOperatorId,
        companyName: formValue.companyName,
        contactName: formValue.contactName || undefined,
        phone: formValue.phone || undefined,
        email: formValue.email || undefined,
        address: formValue.address || undefined,
        city: formValue.city || undefined,
        state: formValue.state || undefined,
        zipCode: formValue.zipCode || undefined,
        taxId: formValue.taxId || undefined,
        defaultRate: formValue.defaultRate || undefined,
        rateType: formValue.rateType || undefined,
        contractStartDate: formValue.contractStartDate || undefined,
        contractEndDate: formValue.contractEndDate || undefined,
        contractTerms: formValue.contractTerms || undefined,
        isActive: formValue.isActive
      };

      this.driverService.updateOwnerOperator(this.ownerOperatorId, updateData).subscribe({
        next: () => {
          this.router.navigate(['/owner-operators', this.ownerOperatorId]);
        },
        error: (error) => {
          alert(error.error?.message || 'Failed to update owner operator');
          this.submitting = false;
        }
      });
    } else {
      const createData: CreateOwnerOperatorRequest = {
        companyName: formValue.companyName,
        contactName: formValue.contactName || undefined,
        phone: formValue.phone || undefined,
        email: formValue.email || undefined,
        address: formValue.address || undefined,
        city: formValue.city || undefined,
        state: formValue.state || undefined,
        zipCode: formValue.zipCode || undefined,
        taxId: formValue.taxId || undefined,
        defaultRate: formValue.defaultRate || undefined,
        rateType: formValue.rateType || undefined,
        contractStartDate: formValue.contractStartDate || undefined,
        contractEndDate: formValue.contractEndDate || undefined,
        contractTerms: formValue.contractTerms || undefined
      };

      this.driverService.createOwnerOperator(createData).subscribe({
        next: (id) => {
          this.router.navigate(['/owner-operators', id]);
        },
        error: (error) => {
          alert(error.error?.message || 'Failed to create owner operator');
          this.submitting = false;
        }
      });
    }
  }

  cancel(): void {
    if (this.isEditMode && this.ownerOperatorId) {
      this.router.navigate(['/owner-operators', this.ownerOperatorId]);
    } else {
      this.router.navigate(['/owner-operators']);
    }
  }
}


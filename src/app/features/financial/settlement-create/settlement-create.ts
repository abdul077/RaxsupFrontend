import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FinancialService } from '../../../core/services/financial.service';
import { ApiService } from '../../../core/services/api';
import { DriverService } from '../../../core/services/driver.service';
import { CreateSettlementRequest, SettlementItem, SettlementDeduction } from '../../../core/models/financial.model';
import { Driver } from '../../../core/models/driver.model';
import { Load, PagedResult } from '../../../core/models/load.model';

@Component({
  selector: 'app-settlement-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './settlement-create.html',
  styleUrl: './settlement-create.scss',
})
export class SettlementCreateComponent implements OnInit {
  loading = false;
  submitting = false;
  validationErrors: string[] = [];
  showErrors = false;
  
  drivers: Driver[] = [];
  loads: Load[] = [];
  allLoads: Load[] = [];
  private preselectedDriverId: number | null = null;
  
  formData: CreateSettlementRequest = {
    driverId: 0,
    periodStart: '',
    periodEnd: '',
    settlementType: 'Weekly',
    items: [],
    deductions: []
  };

  constructor(
    private financialService: FinancialService,
    private apiService: ApiService,
    private driverService: DriverService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const driverIdParam = this.route.snapshot.queryParamMap.get('driverId');
    const parsedDriverId = Number(driverIdParam);
    if (driverIdParam && Number.isFinite(parsedDriverId) && parsedDriverId > 0) {
      this.preselectedDriverId = parsedDriverId;
    }
    this.loadDrivers();
    this.initializePeriod();
  }

  initializePeriod(): void {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    this.formData.periodStart = startOfWeek.toISOString().split('T')[0];
    this.formData.periodEnd = endOfWeek.toISOString().split('T')[0];
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        // Filter to show all drivers whose status is not 'Pending'
        this.drivers = (result?.items || []).filter(d => d.status !== 'Pending');
        if (this.preselectedDriverId) {
          const selectedDriver = this.drivers.find(d => d.driverId === this.preselectedDriverId);
          if (selectedDriver) {
            this.formData.driverId = this.preselectedDriverId;
            this.onDriverChange();
          }
        }
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
        this.drivers = [];
      }
    });
  }

  onDriverChange(): void {
    if (this.formData.driverId && this.formData.driverId > 0) {
      this.loadDriverLoads(this.formData.driverId);
      // Clear existing items when driver changes
      this.formData.items = [];
    } else {
      this.loads = [];
    }
  }

  loadDriverLoads(driverId: number): void {
    this.loading = true;
    // Don't filter by status - get all loads and filter on frontend to handle case sensitivity
    this.driverService.getDriverLoads(driverId, undefined, undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        console.log('Driver loads API response:', result);
        // The API returns 'loads' (camelCase) or 'Loads' (PascalCase) depending on serialization
        const allDriverLoads = result?.loads || result?.Loads || [];
        console.log('All driver loads:', allDriverLoads);
        
        // Filter to only show delivered loads (case-insensitive)
        this.allLoads = allDriverLoads.filter((load: Load) => 
          load.status && load.status.toLowerCase() === 'delivered'
        );
        this.loads = this.allLoads;
        console.log('Filtered delivered loads:', this.loads);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading driver loads:', error);
        console.error('Error details:', error);
        this.loads = [];
        this.allLoads = [];
        this.loading = false;
      }
    });
  }

  addSettlementItem(): void {
    this.formData.items.push({
      loadId: 0,
      description: '',
      rate: 0,
      miles: 0,
      amount: 0,
      itemType: 'Load'
    });
  }

  isFormValid(): boolean {
    // Check basic form fields
    if (!this.formData.driverId || this.formData.driverId === 0) {
      return false;
    }
    if (!this.formData.periodStart || !this.formData.periodEnd) {
      return false;
    }
    
    // Check that at least one settlement item exists
    if (this.formData.items.length === 0) {
      return false;
    }
    
    // Validate all settlement items
    for (const item of this.formData.items) {
      if (!this.isSettlementItemValid(item)) {
        return false;
      }
    }
    
    // Validate all deductions
    for (const deduction of this.formData.deductions) {
      if (!deduction.description || deduction.description.trim() === '') {
        return false;
      }
      if (deduction.amount < 0) {
        return false;
      }
    }
    
    return true;
  }

  removeSettlementItem(index: number): void {
    this.formData.items.splice(index, 1);
    this.calculateTotals();
  }

  updateSettlementItem(index: number): void {
    const item = this.formData.items[index];
    // Ensure rate and miles are non-negative (will be validated on submit to be > 0)
    if (item.rate < 0) {
      item.rate = 0;
    }
    if (item.miles < 0) {
      item.miles = 0;
    }
    item.amount = item.rate * item.miles;
    this.calculateTotals();
  }

  isSettlementItemValid(item: SettlementItem): boolean {
    return item.loadId > 0 && 
           item.description.trim() !== '' && 
           item.rate > 0 && 
           item.miles > 0;
  }

  addDeduction(): void {
    this.formData.deductions.push({
      deductionType: 'Other',
      description: '',
      amount: 0,
      reference: ''
    });
    this.calculateTotals();
  }

  removeDeduction(index: number): void {
    this.formData.deductions.splice(index, 1);
    this.calculateTotals();
  }

  calculateTotals(): void {
    // Ensure all deduction amounts are non-negative
    this.formData.deductions.forEach(deduction => {
      if (deduction.amount < 0) {
        deduction.amount = 0;
      }
    });
    // Total earnings and deductions are calculated on backend
  }

  scrollToFirstError(): void {
    setTimeout(() => {
      // Priority order: driverId, periodStart, periodEnd, then items
      const fieldSelectors = [
        'select[name="driverId"]',
        'input[name="periodStart"]',
        'input[name="periodEnd"]'
      ];

      for (const selector of fieldSelectors) {
        const field = document.querySelector(selector) as HTMLElement;
        if (field && field.classList.contains('is-invalid')) {
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          field.focus();
          return;
        }
      }

      // Check for invalid fields in settlement items (first item's fields)
      const firstItemLoad = document.querySelector('select[name="load0"]') as HTMLElement;
      const firstItemDesc = document.querySelector('input[name="desc0"]') as HTMLElement;
      const firstItemRate = document.querySelector('input[name="rate0"]') as HTMLElement;
      const firstItemMiles = document.querySelector('input[name="miles0"]') as HTMLElement;

      if (firstItemLoad?.classList.contains('is-invalid')) {
        firstItemLoad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstItemLoad.focus();
        return;
      }
      if (firstItemDesc?.classList.contains('is-invalid')) {
        firstItemDesc.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstItemDesc.focus();
        return;
      }
      if (firstItemRate?.classList.contains('is-invalid')) {
        firstItemRate.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstItemRate.focus();
        return;
      }
      if (firstItemMiles?.classList.contains('is-invalid')) {
        firstItemMiles.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstItemMiles.focus();
        return;
      }

      // Check for invalid deduction fields
      const firstDedDesc = document.querySelector('input[name="dedDesc0"]') as HTMLElement;
      const firstDedAmount = document.querySelector('input[name="dedAmount0"]') as HTMLElement;

      if (firstDedDesc?.classList.contains('is-invalid')) {
        firstDedDesc.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstDedDesc.focus();
        return;
      }
      if (firstDedAmount?.classList.contains('is-invalid')) {
        firstDedAmount.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstDedAmount.focus();
        return;
      }

      // If no specific field found, try any invalid field
      const firstErrorField = document.querySelector('.is-invalid') as HTMLElement;
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstErrorField.focus();
        return;
      }

      // If no invalid field found, scroll to error message
      const errorAlert = document.querySelector('.alert-danger');
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
      
      if (!this.formData.driverId || this.formData.driverId === 0) {
        this.validationErrors.push('Owner Operator must be selected');
      }
      if (!this.formData.periodStart || !this.formData.periodEnd) {
        this.validationErrors.push('Period Start and Period End dates are required');
      }
      if (this.formData.items.length === 0) {
        this.validationErrors.push('At least one settlement item is required');
      }
      
      this.formData.items.forEach((item, index) => {
        if (!item.loadId || item.loadId === 0) {
          this.validationErrors.push(`Settlement Item ${index + 1}: Load must be selected`);
        }
        if (!item.description || item.description.trim() === '') {
          this.validationErrors.push(`Settlement Item ${index + 1}: Description is required`);
        }
        if (item.rate <= 0) {
          this.validationErrors.push(`Settlement Item ${index + 1}: Rate must be greater than 0`);
        }
        if (item.miles <= 0) {
          this.validationErrors.push(`Settlement Item ${index + 1}: Miles must be greater than 0`);
        }
      });
      
      this.formData.deductions.forEach((deduction, index) => {
        if (!deduction.description || deduction.description.trim() === '') {
          this.validationErrors.push(`Deduction ${index + 1}: Description is required`);
        }
        if (deduction.amount < 0) {
          this.validationErrors.push(`Deduction ${index + 1}: Amount cannot be negative`);
        }
      });
      
      this.showErrors = true;
      this.scrollToFirstError();
      return;
    }

    // Clear errors if form is valid
    this.validationErrors = [];
    this.showErrors = false;
    
    this.submitting = true;
    this.financialService.createSettlement(this.formData).subscribe({
      next: () => {
        this.router.navigate(['/financial/settlements']);
      },
      error: () => {
        this.submitting = false;
        this.validationErrors = ['Failed to create settlement. Please try again.'];
        this.showErrors = true;
        this.scrollToFirstError();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/financial/settlements']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  getTotalEarnings(): number {
    return this.formData.items.reduce((sum, item) => sum + item.amount, 0);
  }

  getTotalDeductions(): number {
    return this.formData.deductions.reduce((sum, ded) => sum + ded.amount, 0);
  }

  getNetPay(): number {
    return this.getTotalEarnings() - this.getTotalDeductions();
  }
}


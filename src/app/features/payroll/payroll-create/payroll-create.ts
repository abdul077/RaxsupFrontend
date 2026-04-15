import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { PayrollService } from '../../../core/services/payroll.service';
import { FinancialService } from '../../../core/services/financial.service';
import { DriverService } from '../../../core/services/driver.service';
import { CreatePayrollRequest } from '../../../core/models/financial.model';
import { Driver } from '../../../core/models/driver.model';
import { DriverSettlement } from '../../../core/models/financial.model';

@Component({
  selector: 'app-payroll-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payroll-create.html',
  styleUrl: './payroll-create.scss',
})
export class PayrollCreateComponent implements OnInit {
  request: CreatePayrollRequest = {
    payPeriodStart: '',
    payPeriodEnd: '',
    grossPay: 0,
    totalDeductions: 0,
    syncToEveree: false
  };
  
  drivers: Driver[] = [];
  settlements: DriverSettlement[] = [];
  loading = false;
  settlementId?: number;

  constructor(
    private payrollService: PayrollService,
    private financialService: FinancialService,
    private driverService: DriverService,
    private route: ActivatedRoute,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.loadDrivers();
    
    // Check if we're creating from a settlement
    const settlementIdParam = this.route.snapshot.queryParamMap.get('settlementId');
    if (settlementIdParam) {
      this.settlementId = +settlementIdParam;
      this.loadSettlement(this.settlementId);
    }
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        this.drivers = result?.items || [];
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
      }
    });
  }

  loadSettlement(settlementId: number): void {
    this.financialService.getSettlementById(settlementId).subscribe({
      next: (settlement) => {
        this.request.driverId = settlement.driverId;
        this.request.settlementId = settlementId;
        this.request.payPeriodStart = settlement.periodStart;
        this.request.payPeriodEnd = settlement.periodEnd;
        this.request.grossPay = settlement.totalEarnings;
        this.request.totalDeductions = settlement.totalDeductions;
      },
      error: (error) => {
        console.error('Error loading settlement:', error);
      }
    });
  }

  onSubmit(): void {
    if (!this.request.driverId && !this.request.ownerOperatorId) {
      alert('Please select a driver or owner operator');
      return;
    }

    if (!this.request.payPeriodStart || !this.request.payPeriodEnd) {
      alert('Please select pay period dates');
      return;
    }

    if (this.request.grossPay <= 0) {
      alert('Gross pay must be greater than 0');
      return;
    }

    this.loading = true;
    this.payrollService.createPayroll(this.request).subscribe({
      next: (payrollId) => {
        this.loading = false;
        alert('Payroll created successfully!');
        this.router.navigate(['/payroll', payrollId]);
      },
      error: (error) => {
        console.error('Error creating payroll:', error);
        this.loading = false;
        alert('Error creating payroll: ' + (error.error?.message || error.message || 'Unknown error'));
      }
    });
  }

  calculateNetPay(): number {
    return this.request.grossPay - this.request.totalDeductions;
  }
}


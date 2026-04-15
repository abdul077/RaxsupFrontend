import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Customer } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { LoadService } from '../../../core/services/load.service';
import { FinancialService } from '../../../core/services/financial.service';
import { AuthService } from '../../../core/services/auth';
import { Load, PagedResult } from '../../../core/models/load.model';
import {
  Invoice,
  AccountsReceivable,
  FinancialReports,
} from '../../../core/models/financial.model';

const emptyLoadsPage: PagedResult<Load> = {
  items: [],
  totalCount: 0,
  pageNumber: 1,
  pageSize: 100,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.scss',
})
export class CustomerDetailComponent implements OnInit {
  customer: Customer | null = null;
  loading = false;
  relatedLoading = false;
  error: string | null = null;
  tab = 'profile';

  loads: Load[] = [];
  loadsTotalCount = 0;
  loadsPageSize = 100;

  invoices: Invoice[] = [];
  invoicesTotalCount = 0;

  receivables: AccountsReceivable[] | null = null;
  financialSummary: FinancialReports | null = null;

  expandedInvoiceId: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private customerService: CustomerService,
    private loadService: LoadService,
    private financialService: FinancialService,
    private auth: AuthService,
  ) {}

  changeTab(t: string): void {
    this.tab = t;
  }

  get canViewFullFinancial(): boolean {
    return this.auth.hasAnyRole(['Admin', 'Accountant']);
  }

  get totalInvoiceBalance(): number {
    return this.invoices.reduce((sum, i) => sum + (i.balance ?? 0), 0);
  }

  get totalInvoicePaid(): number {
    return this.invoices.reduce((sum, i) => sum + (i.paidAmount ?? 0), 0);
  }

  get totalInvoiceBilled(): number {
    return this.invoices.reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
  }

  get loadsWithDeadhead(): Load[] {
    return this.loads.filter((l) => l.deadheadOrigin || l.deadheadDestination);
  }

  get totalReceivableBalance(): number {
    if (!this.receivables?.length) return 0;
    return this.receivables.reduce((sum, r) => sum + (r.balance ?? 0), 0);
  }

  toggleInvoiceDetails(invoiceId: number): void {
    this.expandedInvoiceId =
      this.expandedInvoiceId === invoiceId ? null : invoiceId;
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (!id || isNaN(id)) {
      this.error = 'Invalid broker id.';
      return;
    }

    this.loading = true;
    this.customerService.getCustomerById(id).subscribe({
      next: (customer) => {
        this.customer = customer;
        this.loading = false;
        this.loadRelatedData(id);
      },
      error: () => {
        this.error = 'Failed to load broker details.';
        this.loading = false;
      },
    });
  }

  private loadRelatedData(customerId: number): void {
    this.relatedLoading = true;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startStr = oneYearAgo.toISOString().split('T')[0]!;
    const endStr = new Date().toISOString().split('T')[0]!;

    const canFull = this.canViewFullFinancial;

    forkJoin({
      loads: this.loadService
        .getLoads(undefined, customerId, undefined, 1, this.loadsPageSize)
        .pipe(catchError(() => of(emptyLoadsPage))),
      invoices: this.financialService
        .getInvoices({
          customerId,
          pageNumber: 1,
          pageSize: 100,
        })
        .pipe(catchError(() => of(null))),
      receivables: canFull
        ? this.financialService
            .getAccountsReceivables(customerId)
            .pipe(catchError(() => of(null)))
        : of(null),
      reports: canFull
        ? this.financialService
            .getFinancialReports(startStr, endStr, customerId)
            .pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: (data) => {
        this.loads = data.loads.items;
        this.loadsTotalCount = data.loads.totalCount;
        if (data.invoices) {
          this.invoices = data.invoices.items;
          this.invoicesTotalCount = data.invoices.totalCount;
        } else {
          this.invoices = [];
          this.invoicesTotalCount = 0;
        }
        this.receivables = data.receivables;
        this.financialSummary = data.reports;
        this.relatedLoading = false;
      },
      error: () => {
        this.relatedLoading = false;
      },
    });
  }
}

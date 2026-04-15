import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  Invoice,
  PagedResult,
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  CreateInvoiceFromLoadRequest,
  Payment,
  RecordPaymentRequest,
  DriverSettlement,
  CreateSettlementRequest,
  ApproveSettlementRequest,
  MarkSettlementPaidRequest,
  FuelAdvance,
  CreateFuelAdvanceRequest,
  FinancialReports,
  AccountsPayable,
  AccountsPayableDetail,
  CreateAccountsPayableRequest,
  UpdateAccountsPayableRequest,
  MarkAccountsPayablePaidRequest,
  AccountsReceivable,
  AccountsReceivableDetail,
  CreateAccountsReceivableRequest,
  RecordReceivablePaymentRequest,
  PayablePayment,
  CreatePayablePaymentRequest
} from '../models/financial.model';

@Injectable({
  providedIn: 'root',
})
export class FinancialService {
  constructor(private apiService: ApiService) {}

  // Invoices (paginated)
  getInvoices(params?: {
    customerId?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    searchTerm?: string;
    pageNumber?: number;
    pageSize?: number;
  }): Observable<PagedResult<Invoice>> {
    const queryParams: Record<string, string | number> = {};
    if (params?.['customerId'] != null) queryParams['customerId'] = params['customerId'];
    if (params?.['status']) queryParams['status'] = params['status'];
    if (params?.['dateFrom']) queryParams['dateFrom'] = params['dateFrom'];
    if (params?.['dateTo']) queryParams['dateTo'] = params['dateTo'];
    if (params?.['searchTerm']) queryParams['searchTerm'] = params['searchTerm'];
    queryParams['pageNumber'] = params?.['pageNumber'] ?? 1;
    queryParams['pageSize'] = params?.['pageSize'] ?? 20;
    return this.apiService.get<PagedResult<Invoice>>('financial/invoices', queryParams);
  }

  getInvoiceById(id: number): Observable<Invoice> {
    return this.apiService.get<Invoice>(`financial/invoices/${id}`);
  }

  createInvoice(request: CreateInvoiceRequest): Observable<number> {
    return this.apiService.post<number>('financial/invoices', request);
  }

  createInvoiceFromLoad(loadId: number, request?: CreateInvoiceFromLoadRequest): Observable<number> {
    return this.apiService.post<number>(`financial/invoices/from-load/${loadId}`, request || {});
  }

  updateInvoice(id: number, request: UpdateInvoiceRequest): Observable<void> {
    return this.apiService.put<void>(`financial/invoices/${id}`, request);
  }

  sendInvoice(id: number): Observable<void> {
    return this.apiService.post<void>(`financial/invoices/${id}/send`, {});
  }

  // Payments
  recordPayment(request: RecordPaymentRequest): Observable<number> {
    return this.apiService.post<number>('financial/payments', request);
  }

  // Settlements
  getSettlements(driverId?: number, status?: string): Observable<DriverSettlement[]> {
    return this.apiService.get<DriverSettlement[]>('financial/settlements', { driverId, status });
  }

  createSettlement(request: CreateSettlementRequest): Observable<number> {
    return this.apiService.post<number>('financial/settlements', request);
  }

  getSettlementById(id: number): Observable<DriverSettlement> {
    return this.apiService.get<DriverSettlement>(`financial/settlements/${id}`);
  }

  approveSettlement(id: number): Observable<void> {
    return this.apiService.post<void>(`financial/settlements/${id}/approve`, {});
  }

  markSettlementPaid(id: number, request: MarkSettlementPaidRequest): Observable<void> {
    return this.apiService.post<void>(`financial/settlements/${id}/mark-paid`, request);
  }

  submitSettlementForApproval(id: number): Observable<void> {
    return this.apiService.post<void>(`financial/settlements/${id}/submit`, {});
  }

  cancelSettlement(id: number, reason?: string): Observable<void> {
    return this.apiService.post<void>(`financial/settlements/${id}/cancel`, { reason });
  }

  // Fuel Advances
  createFuelAdvance(request: CreateFuelAdvanceRequest): Observable<number> {
    return this.apiService.post<number>('financial/fuel-advances', request);
  }

  // Reports
  getFinancialReports(startDate?: string, endDate?: string, customerId?: number, driverId?: number): Observable<FinancialReports> {
    return this.apiService.get<FinancialReports>('financial/reports', { startDate, endDate, customerId, driverId });
  }

  // Accounts Payable
  getAccountsPayables(status?: string, category?: string, dueDateFrom?: string, dueDateTo?: string, vendorName?: string): Observable<AccountsPayable[]> {
    return this.apiService.get<AccountsPayable[]>('financial/accounts-payable', { status, category, dueDateFrom, dueDateTo, vendorName });
  }

  getAccountsPayableById(id: number): Observable<AccountsPayableDetail> {
    return this.apiService.get<AccountsPayableDetail>(`financial/accounts-payable/${id}`);
  }

  createAccountsPayable(request: CreateAccountsPayableRequest): Observable<number> {
    return this.apiService.post<number>('financial/accounts-payable', request);
  }

  updateAccountsPayable(id: number, request: UpdateAccountsPayableRequest): Observable<void> {
    return this.apiService.put<void>(`financial/accounts-payable/${id}`, request);
  }

  approveAccountsPayable(id: number): Observable<void> {
    return this.apiService.post<void>(`financial/accounts-payable/${id}/approve`, {});
  }

  markAccountsPayablePaid(id: number, request: MarkAccountsPayablePaidRequest): Observable<void> {
    return this.apiService.post<void>(`financial/accounts-payable/${id}/mark-paid`, request);
  }

  // Accounts Receivable
  getAccountsReceivables(customerId?: number, status?: string, overdueOnly?: boolean, dueDateFrom?: string, dueDateTo?: string): Observable<AccountsReceivable[]> {
    return this.apiService.get<AccountsReceivable[]>('financial/accounts-receivable', { customerId, status, overdueOnly, dueDateFrom, dueDateTo });
  }

  getAccountsReceivableById(id: number): Observable<AccountsReceivableDetail> {
    return this.apiService.get<AccountsReceivableDetail>(`financial/accounts-receivable/${id}`);
  }

  createAccountsReceivable(request: CreateAccountsReceivableRequest): Observable<number> {
    return this.apiService.post<number>('financial/accounts-receivable', request);
  }

  recordReceivablePayment(id: number, request: RecordReceivablePaymentRequest): Observable<void> {
    return this.apiService.post<void>(`financial/accounts-receivable/${id}/record-payment`, request);
  }

  updateAccountsReceivableStatus(receivableId?: number): Observable<void> {
    return this.apiService.post<void>('financial/accounts-receivable/update-status', receivableId ? { receivableId } : {});
  }

  // Payable Payments
  getPayablePayments(payableId?: number, paymentDateFrom?: string, paymentDateTo?: string): Observable<PayablePayment[]> {
    return this.apiService.get<PayablePayment[]>('financial/payable-payments', { payableId, paymentDateFrom, paymentDateTo });
  }

  createPayablePayment(request: CreatePayablePaymentRequest): Observable<number> {
    return this.apiService.post<number>('financial/payable-payments', request);
  }
}


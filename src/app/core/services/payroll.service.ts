import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  Payroll,
  CreatePayrollRequest,
  SyncWorkerToEvereeRequest,
  SyncWorkerToEvereeResponse,
  SyncPayrollToEvereeResponse,
  SyncPayrollFromEvereeRequest,
  SyncPayrollFromEvereeResponse,
  EvereeIntegrationStatus
} from '../models/financial.model';

@Injectable({
  providedIn: 'root',
})
export class PayrollService {
  constructor(private apiService: ApiService) {}

  // Get Payrolls
  getPayrolls(
    driverId?: number,
    ownerOperatorId?: number,
    startDate?: string,
    endDate?: string,
    status?: string,
    evereeSyncStatus?: string
  ): Observable<Payroll[]> {
    return this.apiService.get<Payroll[]>('payroll', {
      driverId,
      ownerOperatorId,
      startDate,
      endDate,
      status,
      evereeSyncStatus
    });
  }

  // Create Payroll
  createPayroll(request: CreatePayrollRequest): Observable<number> {
    return this.apiService.post<number>('payroll', request);
  }

  // Sync Worker to Everee
  syncWorkerToEveree(request: SyncWorkerToEvereeRequest): Observable<SyncWorkerToEvereeResponse> {
    return this.apiService.post<SyncWorkerToEvereeResponse>('payroll/sync-worker', request);
  }

  // Sync Payroll to Everee
  syncPayrollToEveree(payrollId: number): Observable<SyncPayrollToEvereeResponse> {
    return this.apiService.post<SyncPayrollToEvereeResponse>(`payroll/sync-payroll/${payrollId}`, {});
  }

  // Sync Payrolls from Everee
  syncPayrollsFromEveree(request?: SyncPayrollFromEvereeRequest): Observable<SyncPayrollFromEvereeResponse> {
    return this.apiService.post<SyncPayrollFromEvereeResponse>('payroll/sync-payrolls-from-everee', request || {});
  }

  // Get Everee Integration Status
  getEvereeIntegrationStatus(workerType?: string, syncStatus?: string): Observable<EvereeIntegrationStatus[]> {
    return this.apiService.get<EvereeIntegrationStatus[]>('payroll/integration-status', {
      workerType,
      syncStatus
    });
  }
}


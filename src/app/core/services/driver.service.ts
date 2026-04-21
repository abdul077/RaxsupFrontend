import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from './api';
import { environment } from '../../../environments/environment';
import {
  Driver,
  DriverDetail,
  CreateDriverRequest,
  UpdateDriverRequest,
  UpdateDriverStatusRequest,
  AddDriverDocumentRequest,
  AddSafetyTrainingRequest,
  CreateDriverSettlementRequest,
  DriverDocument,
  DriverSettlement,
  LicenseExpiration,
  DriverReports,
  OwnerOperator,
  OwnerOperatorDetail,
  CreateOwnerOperatorRequest,
  UpdateOwnerOperatorRequest,
  ReferralTree,
  ReferralEarning,
  PendingDriver,
  RejectedDriver,
  PagedResult
} from '../models/driver.model';

@Injectable({
  providedIn: 'root',
})
export class DriverService {
  constructor(private apiService: ApiService) {}

  getDrivers(
    status?: string, 
    type?: string, 
    ownerOperatorId?: number,
    searchTerm?: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<PagedResult<Driver>> {
    const params: any = {};
    if (status) params.status = status;
    if (type) params.type = type;
    if (ownerOperatorId) params.ownerOperatorId = ownerOperatorId;
    if (searchTerm) params.searchTerm = searchTerm;
    params.pageNumber = pageNumber;
    params.pageSize = pageSize;
    return this.apiService.get<PagedResult<Driver>>('drivers', params);
  }

  getMyProfile(): Observable<DriverDetail> {
    return this.apiService.get<DriverDetail>('drivers/me');
  }

  getMyDocuments(documentType?: string): Observable<DriverDocument[]> {
    const params: any = {};
    if (documentType) params.documentType = documentType;
    return this.apiService.get<DriverDocument[]>('drivers/me/documents', params);
  }

  getMySettlements(startDate?: string, endDate?: string, status?: string): Observable<DriverSettlement[]> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (status) params.status = status;
    return this.apiService.get<DriverSettlement[]>('drivers/me/settlements', params);
  }

  getDriverById(id: number): Observable<DriverDetail> {
    return this.apiService.get<DriverDetail>(`drivers/${id}`);
  }

  createDriver(driver: CreateDriverRequest): Observable<number> {
    return this.apiService.post<number>('drivers', driver);
  }

  updateDriver(id: number, driver: UpdateDriverRequest): Observable<any> {
    const { driverId, ...driverData } = driver;
    return this.apiService.put<any>(`drivers/${id}`, { ...driverData, driverId: id });
  }

  deleteDriver(id: number): Observable<any> {
    return this.apiService.delete<any>(`drivers/${id}`);
  }

  updateDriverStatus(id: number, status: string): Observable<any> {
    return this.apiService.patch<any>(`drivers/${id}/status`, { driverId: id, status });
  }

  getDriverDocuments(id: number, documentType?: string): Observable<DriverDocument[]> {
    const params: any = {};
    if (documentType) params.documentType = documentType;
    return this.apiService.get<DriverDocument[]>(`drivers/${id}/documents`, params);
  }

  addDriverDocument(id: number, document: AddDriverDocumentRequest): Observable<number> {
    const { driverId, ...documentData } = document;
    return this.apiService.post<number>(`drivers/${id}/documents`, { ...documentData, driverId: id });
  }

  uploadDriverDocument(id: number, file: File, documentType: string, expiryDate?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (expiryDate) {
      formData.append('expiryDate', expiryDate);
    }
    return this.apiService.post<any>(`drivers/${id}/documents/upload`, formData);
  }

  addSafetyTraining(id: number, training: AddSafetyTrainingRequest): Observable<number> {
    return this.apiService.post<number>(`drivers/${id}/trainings`, { ...training, driverId: id });
  }

  getDriverSettlements(id: number, startDate?: string, endDate?: string, status?: string): Observable<DriverSettlement[]> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (status) params.status = status;
    return this.apiService.get<DriverSettlement[]>(`drivers/${id}/settlements`, params);
  }

  createDriverSettlement(id: number, settlement: CreateDriverSettlementRequest): Observable<number> {
    const { driverId, ...settlementData } = settlement;
    return this.apiService.post<number>(`drivers/${id}/settlements`, { ...settlementData, driverId: id });
  }

  getLicenseExpirations(daysAhead?: number, includeExpired: boolean = false): Observable<LicenseExpiration[]> {
    const params: any = {};
    if (daysAhead) params.daysAhead = daysAhead;
    params.includeExpired = includeExpired;
    return this.apiService.get<LicenseExpiration[]>('drivers/license-expirations', params);
  }

  getDriverReports(reportType?: string): Observable<DriverReports> {
    const params: any = {};
    if (reportType) params.reportType = reportType;
    return this.apiService.get<DriverReports>('drivers/reports', params);
  }

  // Owner-Operator methods
  getOwnerOperators(isActive?: boolean): Observable<OwnerOperator[]> {
    const params: any = {};
    if (isActive !== undefined) params.isActive = isActive;
    return this.apiService.get<OwnerOperator[]>('drivers/owner-operators', params);
  }

  getOwnerOperatorById(id: number): Observable<OwnerOperatorDetail> {
    return this.apiService.get<OwnerOperatorDetail>(`drivers/owner-operators/${id}`);
  }

  createOwnerOperator(ownerOperator: CreateOwnerOperatorRequest): Observable<number> {
    return this.apiService.post<number>('drivers/owner-operators', ownerOperator);
  }

  updateOwnerOperator(id: number, ownerOperator: UpdateOwnerOperatorRequest): Observable<any> {
    return this.apiService.put<any>(`drivers/owner-operators/${id}`, { ...ownerOperator, ownerOperatorId: id });
  }

  deleteOwnerOperator(id: number): Observable<any> {
    return this.apiService.delete<any>(`drivers/owner-operators/${id}`);
  }

  getCurrentUserOwnerOperator(): Observable<OwnerOperator | null> {
    return this.apiService.get<OwnerOperator | null>('drivers/owner-operators/current').pipe(
      catchError(() => of(null))
    );
  }

  // Referral methods
  getMyReferralTree(): Observable<ReferralTree> {
    return this.apiService.get<ReferralTree>('drivers/me/referral-tree');
  }

  getMyReferralEarnings(status?: string, startDate?: string, endDate?: string): Observable<ReferralEarning[]> {
    const params: any = {};
    if (status) params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.apiService.get<ReferralEarning[]>('drivers/me/referral-earnings', params);
  }

  getReferralTree(driverId: number): Observable<ReferralTree> {
    return this.apiService.get<ReferralTree>(`drivers/${driverId}/referral-tree`);
  }

  getReferralEarnings(driverId: number, status?: string, startDate?: string, endDate?: string): Observable<ReferralEarning[]> {
    const params: any = {};
    if (status) params.status = status;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.apiService.get<ReferralEarning[]>(`drivers/${driverId}/referral-earnings`, params);
  }

  recalculateReferralEarnings(driverId: number): Observable<{ message: string; earningsCreated: number }> {
    return this.apiService.post<{ message: string; earningsCreated: number }>(`drivers/${driverId}/referral-earnings/recalculate`, {});
  }

  markReferralEarningPaid(earningId: number, paymentMethod?: string, paymentReference?: string): Observable<{ message: string }> {
    const body: any = {};
    if (paymentMethod) body.paymentMethod = paymentMethod;
    if (paymentReference) body.paymentReference = paymentReference;
    return this.apiService.post<{ message: string }>(`drivers/referral-earnings/${earningId}/mark-paid`, body);
  }

  // Pending driver approval methods
  getPendingDrivers(): Observable<PendingDriver[]> {
    return this.apiService.get<PendingDriver[]>('drivers/pending');
  }

  getRejectedDrivers(): Observable<RejectedDriver[]> {
    return this.apiService.get<RejectedDriver[]>('drivers/rejected');
  }

  approveDriver(driverId: number): Observable<any> {
    return this.apiService.post<any>(`drivers/${driverId}/approve`, {});
  }

  rejectDriver(driverId: number, rejectionReason?: string): Observable<any> {
    const body: { rejectionReason?: string } = {};
    // Only include rejectionReason if it has a non-empty value
    if (rejectionReason && rejectionReason.trim().length > 0) {
      body.rejectionReason = rejectionReason.trim();
    }
    return this.apiService.post<any>(`drivers/${driverId}/reject`, body);
  }

  approveDriverDocument(documentId: number): Observable<any> {
    return this.apiService.post<any>(`drivers/documents/${documentId}/approve`, {});
  }

  rejectDriverDocument(documentId: number, reason?: string): Observable<any> {
    return this.apiService.post<any>(`drivers/documents/${documentId}/reject`, { reason });
  }

  sendComplianceAlertToOwnerOperator(driverId: number, additionalMessage?: string): Observable<{ message: string }> {
    return this.apiService.post<{ message: string }>(
      `drivers/${driverId}/compliance/notify-owner-operator`,
      { additionalMessage }
    );
  }

  getDriverLoads(
    driverId: number,
    status?: string,
    customerId?: number,
    searchTerm?: string,
    startDate?: string,
    endDate?: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<any> {
    const params: any = {};
    if (status) params.status = status;
    if (customerId) params.customerId = customerId;
    if (searchTerm) params.searchTerm = searchTerm;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    params.pageNumber = pageNumber;
    params.pageSize = pageSize;
    return this.apiService.get<any>(`drivers/${driverId}/loads`, params);
  }

  getAllDriverDocuments(
    driverId?: number,
    documentType?: string,
    approvalStatus?: string,
    expiryStatus?: string,
    daysUntilExpiry?: number,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<any> {
    const params: any = {};
    if (driverId) params.driverId = driverId;
    if (documentType) params.documentType = documentType;
    if (approvalStatus) params.approvalStatus = approvalStatus;
    if (expiryStatus) params.expiryStatus = expiryStatus;
    if (daysUntilExpiry) params.daysUntilExpiry = daysUntilExpiry;
    params.pageNumber = pageNumber;
    params.pageSize = pageSize;
    return this.apiService.get<any>('drivers/documents', params);
  }

  bulkApproveDocuments(documentIds: number[]): Observable<any> {
    return this.apiService.post<any>('drivers/documents/bulk-approve', { documentIds });
  }

  bulkRejectDocuments(documentIds: number[], reason?: string): Observable<any> {
    return this.apiService.post<any>('drivers/documents/bulk-reject', { documentIds, reason });
  }

  getDriverAnalytics(
    driverId: number,
    startDate?: string,
    endDate?: string
  ): Observable<any> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.apiService.get<any>(`drivers/${driverId}/analytics`, params);
  }

  getDriverActivityLog(
    driverId: number,
    activityType?: string,
    startDate?: string,
    endDate?: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<any> {
    const params: any = {};
    if (activityType) params.activityType = activityType;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    params.pageNumber = pageNumber;
    params.pageSize = pageSize;
    return this.apiService.get<any>(`drivers/${driverId}/activity`, params);
  }

  getDocumentViewUrl(driverId: number, documentId: number): string {
    return `${environment.apiUrl}/drivers/${driverId}/documents/${documentId}/view`;
  }

  getDocumentDownloadUrl(driverId: number, documentId: number): string {
    return `${environment.apiUrl}/drivers/${driverId}/documents/${documentId}/download`;
  }
}


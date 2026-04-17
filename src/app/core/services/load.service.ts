import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import { environment } from '../../../environments/environment';
import { 
  Load, 
  LoadDetail, 
  LoadActivityLog,
  CreateLoadRequest, 
  CreateLoadStopRequest,
  AssignLoadRequest,
  CreateAccessorialRequest,
  AccessorialType,
  CreateAccessorialTypeRequest,
  UpdateAccessorialTypeRequest,
  PagedResult,
  LoadTracking,
  AddLoadNoteRequest
} from '../models/load.model';

export interface LoadAdvancedFilterParams {
  customerId?: number;
  driverId?: number;
  equipmentId?: number;
  pickupFrom?: string;
  pickupTo?: string;
  deliveryFrom?: string;
  deliveryTo?: string;
  minRate?: number;
  maxRate?: number;
  loadType?: string;
  isOverdue?: boolean;
  isUnassigned?: boolean;
  isHighValue?: boolean;
  highValueThreshold?: number;
}

@Injectable({
  providedIn: 'root',
})
export class LoadService {
  constructor(private apiService: ApiService) {}

  getLoads(
    status?: string, 
    customerId?: number, 
    searchTerm?: string,
    pageNumber: number = 1,
    pageSize: number = 20,
    assignedByUserId?: number,
    advancedFilters?: LoadAdvancedFilterParams
  ): Observable<PagedResult<Load>> {
    const params: any = {};
    if (status) params.status = status;
    if (customerId) params.customerId = customerId;
    if (searchTerm) params.searchTerm = searchTerm;
    if (assignedByUserId) params.assignedByUserId = assignedByUserId;
    if (advancedFilters) {
      if (advancedFilters.driverId) params.driverId = advancedFilters.driverId;
      if (advancedFilters.equipmentId) params.equipmentId = advancedFilters.equipmentId;
      if (advancedFilters.pickupFrom) params.pickupFrom = advancedFilters.pickupFrom;
      if (advancedFilters.pickupTo) params.pickupTo = advancedFilters.pickupTo;
      if (advancedFilters.deliveryFrom) params.deliveryFrom = advancedFilters.deliveryFrom;
      if (advancedFilters.deliveryTo) params.deliveryTo = advancedFilters.deliveryTo;
      if (advancedFilters.minRate != null) params.minRate = advancedFilters.minRate;
      if (advancedFilters.maxRate != null) params.maxRate = advancedFilters.maxRate;
      if (advancedFilters.loadType) params.loadType = advancedFilters.loadType;
      if (advancedFilters.isOverdue != null) params.isOverdue = advancedFilters.isOverdue;
      if (advancedFilters.isUnassigned != null) params.isUnassigned = advancedFilters.isUnassigned;
      if (advancedFilters.isHighValue != null) params.isHighValue = advancedFilters.isHighValue;
      if (advancedFilters.highValueThreshold != null) params.highValueThreshold = advancedFilters.highValueThreshold;
    }
    params.pageNumber = pageNumber;
    params.pageSize = pageSize;
    return this.apiService.get<PagedResult<Load>>('loads', params);
  }

  getLoadById(id: number): Observable<LoadDetail> {
    return this.apiService.get<LoadDetail>(`loads/${id}`);
  }

  addLoadNote(loadId: number, body: AddLoadNoteRequest): Observable<{ loadNoteId: number }> {
    return this.apiService.post<{ loadNoteId: number }>(`loads/${loadId}/notes`, body);
  }

  getLoadTracking(loadId: number): Observable<LoadTracking> {
    return this.apiService.get<LoadTracking>(`loads/${loadId}/tracking`);
  }

  createLoad(load: CreateLoadRequest): Observable<any> {
    return this.apiService.post<any>('loads', load);
  }

  updateLoad(id: number, load: Partial<CreateLoadRequest>): Observable<any> {
    return this.apiService.put<any>(`loads/${id}`, load);
  }

  updateLoadStatus(id: number, status: string): Observable<any> {
    return this.apiService.patch<any>(`loads/${id}/status`, { status });
  }

  assignLoad(id: number, assignment: AssignLoadRequest): Observable<any> {
    return this.apiService.post<any>(`loads/${id}/assign`, assignment);
  }

  updateAssignment(loadId: number, assignmentId: number, assignment: AssignLoadRequest): Observable<any> {
    return this.apiService.put<any>(`loads/${loadId}/assignments/${assignmentId}`, assignment);
  }

  deleteAssignment(loadId: number, assignmentId: number): Observable<any> {
    return this.apiService.delete<any>(`loads/${loadId}/assignments/${assignmentId}`);
  }

  addLoadStop(id: number, stop: CreateLoadStopRequest): Observable<any> {
    return this.apiService.post<any>(`loads/${id}/stops`, stop);
  }

  deleteLoadStop(loadId: number, stopId: number): Observable<any> {
    return this.apiService.delete<any>(`loads/${loadId}/stops/${stopId}`);
  }

  // Document methods (assuming backend endpoints exist or will be created)
  uploadDocument(id: number, file: File, documentType: string): Observable<any> {
    const formData = new FormData();
    formData.append('File', file);
    formData.append('DocumentType', documentType);
    return this.apiService.postFile<any>(`loads/${id}/documents`, formData);
  }

  deleteDocument(loadId: number, documentId: number): Observable<any> {
    return this.apiService.delete<any>(`loads/${loadId}/documents/${documentId}`);
  }

  getDocumentDownloadUrl(loadId: number, documentId: number): string {
    return `${environment.apiUrl}/loads/${loadId}/documents/${documentId}/download`;
  }

  getDocumentViewUrl(loadId: number, documentId: number): string {
    return `${environment.apiUrl}/loads/${loadId}/documents/${documentId}/view`;
  }

  // Accessorial methods (assuming backend endpoints exist or will be created)
  addAccessorial(loadId: number, accessorial: CreateAccessorialRequest): Observable<any> {
    return this.apiService.post<any>(`loads/${loadId}/accessorials`, accessorial);
  }

  updateAccessorial(loadId: number, accessorialId: number, accessorial: Partial<CreateAccessorialRequest>): Observable<any> {
    return this.apiService.put<any>(`loads/${loadId}/accessorials/${accessorialId}`, accessorial);
  }

  deleteAccessorial(loadId: number, accessorialId: number): Observable<any> {
    return this.apiService.delete<any>(`loads/${loadId}/accessorials/${accessorialId}`);
  }

  // Activity log
  getLoadActivityLog(loadId: number, pageNumber: number = 1, pageSize: number = 50): Observable<PagedResult<LoadActivityLog>> {
    return this.apiService.get<PagedResult<LoadActivityLog>>(`loads/${loadId}/activity-log`, { pageNumber, pageSize });
  }

  // Route optimization (placeholder for future Google Maps/Mapbox integration)
  optimizeRoute(origin: string, destination: string, stops?: string[]): Observable<any> {
    // This would call a backend endpoint that integrates with Google Maps/Mapbox API
    return this.apiService.post<any>('loads/optimize-route', { origin, destination, stops });
  }

  // Get accessorial types
  getAccessorialTypes(): Observable<AccessorialType[]> {
    return this.apiService.get<AccessorialType[]>('loads/accessorial-types');
  }

  // Create accessorial type
  createAccessorialType(request: CreateAccessorialTypeRequest): Observable<any> {
    return this.apiService.post<any>('loads/accessorial-types', request);
  }

  // Update accessorial type
  updateAccessorialType(id: number, request: UpdateAccessorialTypeRequest): Observable<any> {
    return this.apiService.put<any>(`loads/accessorial-types/${id}`, request);
  }

  // Delete accessorial type
  deleteAccessorialType(id: number): Observable<any> {
    return this.apiService.delete<any>(`loads/accessorial-types/${id}`);
  }
}


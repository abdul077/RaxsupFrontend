import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Incident,
  CreateIncidentRequest,
  UpdateIncidentRequest,
  Violation,
  CreateViolationRequest,
  DrugTest,
  CreateDrugTestRequest,
  ComplianceCalendar,
  CreateComplianceCalendarRequest,
  MarkCalendarCompleteRequest,
  InspectionRecord,
  CreateInspectionRecordRequest,
  ComplianceReports
} from '../models/compliance.model';

@Injectable({
  providedIn: 'root'
})
export class ComplianceService {
  private apiUrl = `${environment.apiUrl}/compliance`;

  constructor(private http: HttpClient) {}

  // Incidents
  getIncidents(driverId?: number, loadId?: number, resolved?: boolean): Observable<Incident[]> {
    let params = new HttpParams();
    if (driverId) params = params.set('driverId', driverId.toString());
    if (loadId) params = params.set('loadId', loadId.toString());
    if (resolved !== undefined) params = params.set('resolved', resolved.toString());
    return this.http.get<Incident[]>(`${this.apiUrl}/incidents`, { params });
  }

  getIncidentById(id: number): Observable<Incident> {
    return this.http.get<Incident>(`${this.apiUrl}/incidents/${id}`);
  }

  getMyIncidents(resolved?: boolean, extraHeaders?: Record<string, string>): Observable<Incident[]> {
    let params = new HttpParams();
    if (resolved !== undefined) params = params.set('resolved', resolved.toString());
    let headers = new HttpHeaders();
    if (extraHeaders) {
      for (const key of Object.keys(extraHeaders)) {
        headers = headers.set(key, extraHeaders[key]!);
      }
    }
    return this.http.get<Incident[]>(`${this.apiUrl}/incidents/me`, { params, headers });
  }

  getMyIncidentById(id: number): Observable<Incident> {
    return this.http.get<Incident>(`${this.apiUrl}/incidents/me/${id}`);
  }

  createIncident(request: CreateIncidentRequest): Observable<{ incidentId: number }> {
    return this.http.post<{ incidentId: number }>(`${this.apiUrl}/incidents`, request);
  }

  updateIncident(id: number, request: UpdateIncidentRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/incidents/${id}`, { ...request, incidentId: id });
  }

  // Violations
  createViolation(request: CreateViolationRequest): Observable<{ violationId: number }> {
    return this.http.post<{ violationId: number }>(`${this.apiUrl}/violations`, request);
  }

  // Drug Tests
  getDrugTests(driverId?: number, testType?: string, result?: string): Observable<DrugTest[]> {
    let params = new HttpParams();
    if (driverId) params = params.set('driverId', driverId.toString());
    if (testType) params = params.set('testType', testType);
    if (result) params = params.set('result', result);
    return this.http.get<DrugTest[]>(`${this.apiUrl}/drug-tests`, { params });
  }

  createDrugTest(request: CreateDrugTestRequest): Observable<{ drugTestId: number }> {
    return this.http.post<{ drugTestId: number }>(`${this.apiUrl}/drug-tests`, request);
  }

  // Compliance Calendar
  getComplianceCalendar(
    driverId?: number,
    equipmentId?: number,
    itemType?: string,
    isOverdue?: boolean,
    isCompleted?: boolean,
    startDate?: string,
    endDate?: string
  ): Observable<ComplianceCalendar[]> {
    let params = new HttpParams();
    if (driverId) params = params.set('driverId', driverId.toString());
    if (equipmentId) params = params.set('equipmentId', equipmentId.toString());
    if (itemType) params = params.set('itemType', itemType);
    if (isOverdue !== undefined) params = params.set('isOverdue', isOverdue.toString());
    if (isCompleted !== undefined) params = params.set('isCompleted', isCompleted.toString());
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<ComplianceCalendar[]>(`${this.apiUrl}/compliance-calendar`, { params });
  }

  createComplianceCalendar(request: CreateComplianceCalendarRequest): Observable<{ calendarId: number }> {
    return this.http.post<{ calendarId: number }>(`${this.apiUrl}/compliance-calendar`, request);
  }

  markCalendarComplete(id: number, request: MarkCalendarCompleteRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/compliance-calendar/${id}/complete`, { ...request, calendarId: id });
  }

  // Inspection Records
  createInspectionRecord(request: CreateInspectionRecordRequest): Observable<{ inspectionId: number }> {
    return this.http.post<{ inspectionId: number }>(`${this.apiUrl}/inspections`, request);
  }

  // Compliance Reports
  getComplianceReports(
    startDate?: string,
    endDate?: string,
    driverId?: number,
    equipmentId?: number
  ): Observable<ComplianceReports> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    if (driverId) params = params.set('driverId', driverId.toString());
    if (equipmentId) params = params.set('equipmentId', equipmentId.toString());
    return this.http.get<ComplianceReports>(`${this.apiUrl}/reports`, { params });
  }
}


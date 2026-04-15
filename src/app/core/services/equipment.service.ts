import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Equipment, CreateEquipmentRequest, UpdateEquipmentRequest, MaintenanceLog, CreateMaintenanceLogRequest } from '../models/equipment.model';

@Injectable({
  providedIn: 'root'
})
export class EquipmentService {
  private apiUrl = `${environment.apiUrl}/equipment`;

  constructor(private http: HttpClient) {}

  getEquipments(equipmentType?: string, status?: string): Observable<Equipment[]> {
    let params = new HttpParams();
    if (equipmentType) params = params.set('equipmentType', equipmentType);
    if (status) params = params.set('status', status);
    return this.http.get<Equipment[]>(this.apiUrl, { params });
  }

  createEquipment(request: CreateEquipmentRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, request);
  }

  updateEquipment(equipmentId: number, request: UpdateEquipmentRequest): Observable<any> {
    return this.http.put(`${this.apiUrl}/${equipmentId}`, request);
  }

  addMaintenanceLog(request: CreateMaintenanceLogRequest): Observable<{ logId: number }> {
    return this.http.post<{ logId: number }>(`${this.apiUrl}/maintenance`, request);
  }

  getMaintenanceLogs(equipmentId: number): Observable<MaintenanceLog[]> {
    return this.http.get<MaintenanceLog[]>(`${this.apiUrl}/${equipmentId}/maintenance`);
  }

  getEquipmentStatuses(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/statuses`);
  }

  updateEquipmentStatus(equipmentId: number, status: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${equipmentId}/status`, { status });
  }

  deleteEquipment(equipmentId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${equipmentId}`);
  }

  getEquipmentMotiveInfo(equipmentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${equipmentId}/motive`);
  }

  /**
   * Create or link this equipment in Motive. If it has no mapping, creates a vehicle/asset in Motive and saves the mapping.
   * Pass motiveId to link to an existing Motive vehicle/asset instead of creating.
   */
  pushToMotive(equipmentId: number, motiveId?: string): Observable<{ message: string; motiveId?: string }> {
    return this.http.post<{ message: string; motiveId?: string }>(
      `${this.apiUrl}/${equipmentId}/motive`,
      motiveId != null ? { motiveId } : {}
    );
  }

  getFleetLocations(): Observable<FleetLocation[]> {
    return this.http.get<FleetLocation[]>(`${this.apiUrl}/motive/fleet-locations`);
  }
}

export interface FleetLocation {
  equipmentId: number;
  motiveId: string;
  vehicleLabel: string;
  driverName?: string;
  latitude: number;
  longitude: number;
  speedMph: number;
  lastUpdate?: string;
  status: string;
}


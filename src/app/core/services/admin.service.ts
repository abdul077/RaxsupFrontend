import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Company,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  Branch,
  CreateBranchRequest,
  UpdateBranchRequest,
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  UpdateApiKeyRequest,
  Notification,
  CreateNotificationRequest,
  AuditLog,
  AuditLogPagedResult,
  EmailLog,
  Role,
  UserDetail,
  CreateUserRequest,
  UpdateUserRequest
} from '../models/admin.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private apiUrl = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  // Company Management
  getCompanies(isActive?: boolean): Observable<Company[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());
    return this.http.get<Company[]>(`${this.apiUrl}/companies`, { params });
  }

  getCompany(id: number): Observable<Company> {
    return this.http.get<Company>(`${this.apiUrl}/companies/${id}`);
  }

  createCompany(request: CreateCompanyRequest): Observable<{ companyId: number }> {
    return this.http.post<{ companyId: number }>(`${this.apiUrl}/companies`, request);
  }

  updateCompany(id: number, request: UpdateCompanyRequest): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/companies/${id}`, request);
  }

  // Branch Management
  getBranches(companyId?: number, isActive?: boolean): Observable<Branch[]> {
    let params = new HttpParams();
    if (companyId) params = params.set('companyId', companyId.toString());
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());
    return this.http.get<Branch[]>(`${this.apiUrl}/branches`, { params });
  }

  getBranch(id: number): Observable<Branch> {
    return this.http.get<Branch>(`${this.apiUrl}/branches/${id}`);
  }

  createBranch(request: CreateBranchRequest): Observable<{ branchId: number }> {
    return this.http.post<{ branchId: number }>(`${this.apiUrl}/branches`, request);
  }

  updateBranch(id: number, request: UpdateBranchRequest): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/branches/${id}`, request);
  }

  // API Key Management
  getApiKeys(isActive?: boolean, integrationType?: string): Observable<ApiKey[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());
    if (integrationType) params = params.set('integrationType', integrationType);
    return this.http.get<ApiKey[]>(`${this.apiUrl}/api-keys`, { params });
  }

  createApiKey(request: CreateApiKeyRequest): Observable<CreateApiKeyResponse> {
    return this.http.post<CreateApiKeyResponse>(`${this.apiUrl}/api-keys`, request);
  }

  updateApiKey(id: number, request: UpdateApiKeyRequest): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/api-keys/${id}`, request);
  }

  // Notification Management
  getNotifications(
    userId?: number,
    isRead?: boolean,
    notificationType?: string,
    category?: string,
    fromDate?: Date,
    toDate?: Date
  ): Observable<Notification[]> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId.toString());
    if (isRead !== undefined) params = params.set('isRead', isRead.toString());
    if (notificationType) params = params.set('notificationType', notificationType);
    if (category) params = params.set('category', category);
    if (fromDate) params = params.set('fromDate', fromDate.toISOString());
    if (toDate) params = params.set('toDate', toDate.toISOString());
    return this.http.get<Notification[]>(`${this.apiUrl}/notifications`, { params });
  }

  createNotification(request: CreateNotificationRequest): Observable<{ notificationId: number }> {
    return this.http.post<{ notificationId: number }>(`${this.apiUrl}/notifications`, request);
  }

  markNotificationRead(id: number): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/notifications/${id}/read`, {});
  }

  // Audit Logs
  getAuditLogs(
    userId?: number,
    entityName?: string,
    action?: string,
    fromDate?: Date,
    toDate?: Date,
    pageNumber?: number,
    pageSize?: number
  ): Observable<AuditLogPagedResult> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId.toString());
    if (entityName) params = params.set('entityName', entityName);
    if (action) params = params.set('action', action);
    if (fromDate) params = params.set('fromDate', fromDate.toISOString());
    if (toDate) params = params.set('toDate', toDate.toISOString());
    if (pageNumber) params = params.set('pageNumber', pageNumber.toString());
    if (pageSize) params = params.set('pageSize', pageSize.toString());
    return this.http.get<AuditLogPagedResult>(`${this.apiUrl}/audit-logs`, { params });
  }

  // Email Logs
  getEmailLogs(
    to?: string,
    status?: string,
    fromDate?: Date,
    toDate?: Date,
    pageNumber?: number,
    pageSize?: number
  ): Observable<EmailLog[]> {
    let params = new HttpParams();
    if (to) params = params.set('to', to);
    if (status) params = params.set('status', status);
    if (fromDate) params = params.set('fromDate', fromDate.toISOString());
    if (toDate) params = params.set('toDate', toDate.toISOString());
    if (pageNumber) params = params.set('pageNumber', pageNumber.toString());
    if (pageSize) params = params.set('pageSize', pageSize.toString());
    return this.http.get<EmailLog[]>(`${this.apiUrl}/email-logs`, { params });
  }

  // Roles
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`);
  }

  // Users
  checkUserAvailability(username?: string, email?: string): Observable<{ usernameTaken: boolean; emailTaken: boolean }> {
    let params = new HttpParams();
    if (username) params = params.set('username', username);
    if (email) params = params.set('email', email);
    return this.http.get<{ usernameTaken: boolean; emailTaken: boolean }>(`${this.apiUrl}/users/check-availability`, { params });
  }

  getUsers(roleId?: number, isActive?: boolean | null): Observable<UserDetail[]> {
    let params = new HttpParams();
    if (roleId) params = params.set('roleId', roleId.toString());
    // Only set isActive param if it's explicitly true or false (not null/undefined)
    // null means "show all", so we don't send the parameter
    if (isActive === true || isActive === false) {
      params = params.set('isActive', isActive.toString());
    }
    return this.http.get<UserDetail[]>(`${this.apiUrl}/users`, { params });
  }

  createUser(request: CreateUserRequest): Observable<{ userId: number; username: string; message: string }> {
    // Use the auth/register endpoint which requires Admin role
    const registerRequest: any = {
      username: request.username,
      email: request.email,
      fullName: request.fullName,
      roleId: request.roleId
    };
    
    // Only include password if provided (for backward compatibility, but typically not provided for admin-created users)
    if (request.password) {
      registerRequest.password = request.password;
    }
    
    // Only include referredBy if it's provided (for Driver role)
    if (request.referredBy !== undefined) {
      registerRequest.referredBy = request.referredBy;
    }
    
    // Include phoneNumber when provided (e.g. for Driver role, sent to Motive)
    if (request.phoneNumber) {
      registerRequest.phoneNumber = request.phoneNumber;
    }
    
    return this.http.post<{ userId: number; username: string; message: string }>(`${environment.apiUrl}/auth/register`, registerRequest);
  }

  updateUser(id: number, request: UpdateUserRequest): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/users/${id}`, request);
  }

  deleteUser(id: number): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/users/${id}`);
  }
}


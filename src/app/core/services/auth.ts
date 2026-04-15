import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, User } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUserFromStorage();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.setToken(response.token);
        this.setCurrentUser({
          userId: response.userId,
          username: response.username,
          email: response.email,
          fullName: response.fullName,
          role: response.role,
          emailVerified: response.emailVerified
        });
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private setToken(token: string): void {
    localStorage.setItem('token', token);
  }

  private setCurrentUser(user: User): void {
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserSubject.next(user);
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.role === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUser();
    return user ? roles.includes(user.role) : false;
  }

  registerDriver(registrationData: RegisterDriverRequest): Observable<RegisterDriverResponse> {
    return this.http.post<RegisterDriverResponse>(`${this.apiUrl}/register-driver`, registrationData);
  }

  registerOwnerOperator(registrationData: RegisterOwnerOperatorRequest): Observable<RegisterOwnerOperatorResponse> {
    return this.http.post<RegisterOwnerOperatorResponse>(`${this.apiUrl}/register-owner-operator`, registrationData);
  }

  verifyEmail(token: string): Observable<VerifyEmailResponse> {
    return this.http.get<VerifyEmailResponse>(`${this.apiUrl}/verify-email`, {
      params: { token }
    });
  }

  setPassword(token: string, password: string, confirmPassword: string): Observable<SetPasswordResponse> {
    return this.http.post<SetPasswordResponse>(`${this.apiUrl}/set-password`, {
      token,
      newPassword: password,
      confirmPassword
    });
  }
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  redirectUrl?: string;
  passwordSetupToken?: string;
}

export interface SetPasswordResponse {
  success: boolean;
  message: string;
}

export interface RegisterDriverRequest {
  username: string;
  password: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  referredByDriverId?: number; // Optional referral driver ID
}

export interface RegisterDriverResponse {
  userId: number;
  driverId: number;
  username: string;
  message: string;
  requiresApproval: boolean;
  emailSent: boolean;
  emailError?: string;
}

export interface RegisterOwnerOperatorRequest {
  username: string;
  password: string;
  email: string;
  companyName: string;
  contactName?: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  referredByOwnerOperatorId?: number; // Optional referral owner operator ID
}

export interface RegisterOwnerOperatorResponse {
  userId: number;
  ownerOperatorId: number;
  username: string;
  message: string;
  requiresApproval: boolean;
}

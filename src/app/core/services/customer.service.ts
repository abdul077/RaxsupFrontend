import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Customer, CreateCustomerRequest } from '../models/customer.model';

@Injectable({
  providedIn: 'root'
})
export class CustomerService {
  private apiUrl = `${environment.apiUrl}/customers`;

  constructor(private http: HttpClient) {}

  getCustomers(isActive?: boolean): Observable<Customer[]> {
    let params = new HttpParams();
    if (isActive !== undefined) params = params.set('isActive', isActive.toString());
    return this.http.get<Customer[]>(this.apiUrl, { params });
  }

  getCustomerById(customerId: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.apiUrl}/${customerId}`);
  }

  createCustomer(request: CreateCustomerRequest): Observable<number> {
    return this.http.post<number>(this.apiUrl, request);
  }

  updateCustomer(customerId: number, request: Partial<CreateCustomerRequest> & { isActive?: boolean }): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.apiUrl}/${customerId}`, request);
  }
}


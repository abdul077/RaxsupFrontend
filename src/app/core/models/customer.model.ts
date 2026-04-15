export interface Customer {
  customerId: number;
  companyId?: number;
  companyName?: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  mcNumber?: string;
  dotNumber?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCustomerRequest {
  companyId?: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  mcNumber?: string;
  dotNumber?: string;
}


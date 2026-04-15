// Company Models
export interface Company {
  companyId: number;
  companyName: string;
  legalName?: string;
  taxId?: string;
  dunsNumber?: string; // API returns lowercase 'd'
  dUNSNumber?: string; // For compatibility
  mcNumber?: string; // API returns lowercase 'mc'
  mCNumber?: string; // For compatibility
  dotNumber?: string; // API returns lowercase 'dot'
  dOTNumber?: string; // For compatibility
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  branchCount: number;
  userCount: number;
}

export interface CreateCompanyRequest {
  companyName: string;
  legalName?: string;
  taxId?: string;
  dUNSNumber?: string;
  mCNumber?: string;
  dOTNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
}

export interface UpdateCompanyRequest {
  companyName?: string;
  legalName?: string;
  taxId?: string;
  dUNSNumber?: string;
  mCNumber?: string;
  dOTNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  isActive?: boolean;
}

// Branch Models
export interface Branch {
  branchId: number;
  companyId: number;
  companyName: string;
  branchName: string;
  branchCode?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  userCount: number;
}

export interface CreateBranchRequest {
  companyId: number;
  branchName: string;
  branchCode?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  managerName?: string;
}

export interface UpdateBranchRequest {
  branchName?: string;
  branchCode?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  isActive?: boolean;
}

// API Key Models
export interface ApiKey {
  apiKeyId: number;
  keyName: string;
  description?: string;
  integrationType?: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  lastUsedAt?: string;
  createdByUserName?: string;
  isExpired: boolean;
}

export interface CreateApiKeyRequest {
  keyName: string;
  description?: string;
  integrationType?: string;
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  apiKeyId: number;
  apiKeyValue: string; // Only shown once on creation
}

export interface UpdateApiKeyRequest {
  keyName?: string;
  description?: string;
  integrationType?: string;
  expiresAt?: string;
  isActive?: boolean;
}

// Notification Models
export interface Notification {
  notificationId: number;
  userId?: number;
  userName?: string;
  title?: string;
  message: string;
  notificationType: string; // InApp, Email, SMS
  category?: string; // Info, Warning, Error, Success
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  emailSent: boolean;
  emailSentAt?: string;
  smsSent: boolean;
  smsSentAt?: string;
  createdAt: string;
}

export interface CreateNotificationRequest {
  userId?: number;
  title?: string;
  message: string;
  notificationType?: string;
  category?: string;
  actionUrl?: string;
  sendEmail?: boolean;
  sendSms?: boolean;
}

// Audit Log Models
export interface AuditLog {
  logId: number;
  userId?: number;
  userName?: string;
  action: string;
  entityName?: string;
  entityId?: string;
  details?: string;
  timestamp: string;
}

export interface AuditLogPagedResult {
  items: AuditLog[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// Email Log Models
export interface EmailLog {
  emailLogId: number;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  fromEmail?: string;
  fromName?: string;
  status: string; // Pending, Sent, Failed
  errorMessage?: string;
  sentAt: string;
  createdAt: string;
}

// Role Models
export interface Role {
  roleId: number;
  roleName: string;
  description?: string;
  createdAt: string;
}

// User Models (extended)
export interface UserDetail {
  userId: number;
  username: string;
  email?: string;
  fullName?: string;
  roleId: number;
  roleName: string;
  companyId?: number;
  branchId?: number;
  phoneNumber?: string;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface CreateUserRequest {
  username: string;
  password?: string; // Optional - if not provided, user will set password via email verification
  email: string;
  fullName: string;
  roleId: number;
  companyId?: number;
  branchId?: number;
  phoneNumber?: string;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  inAppNotificationsEnabled?: boolean;
  referredBy?: number; // DriverId of the referrer (only used when roleId is Driver)
}

export interface UpdateUserRequest {
  email?: string;
  fullName?: string;
  roleId?: number;
  companyId?: number;
  branchId?: number;
  phoneNumber?: string;
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  inAppNotificationsEnabled?: boolean;
  isActive?: boolean;
}


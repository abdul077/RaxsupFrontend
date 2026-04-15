export interface Driver {
  driverId: number;
  ownerOperatorId?: number;
  ownerOperatorName?: string;
  fullName: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiry?: string;
  mobilePhone?: string;
  email?: string;
  payStructure?: string;
  payRate?: number;
  type: string; // Employee, OwnerOperator
  status: string; // Active, Inactive, OnTrip, Available, OffDuty
  hireDate?: string;
  isDQFComplete: boolean;
  createdAt: string;
  isLicenseExpiringSoon?: boolean;
  isLicenseExpired?: boolean;
  referredBy?: number;
  referrerName?: string;
  referralCount?: number;
}

export interface DriverDetail extends Driver {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
  terminationDate?: string;
  dqfCompletionDate?: string;
  performance?: DriverPerformance;
  compliance?: DriverCompliance;
  documents: DriverDocument[];
  trainings: SafetyTraining[];
  settlements: DriverSettlement[];
}

export interface DriverPerformance {
  performanceId: number;
  onTimeDeliveries: number;
  totalDeliveries: number;
  incidents: number;
  rating?: number;
  onTimeRate: number;
  updatedAt: string;
}

export interface DriverCompliance {
  complianceId: number;
  cdlExpiry?: string;
  medicalCardExpiry?: string;
  drugTestDate?: string;
  lastReviewDate?: string;
  notes?: string;
}

export interface DriverDocument {
  docId: number;
  driverId?: number;
  documentType: string;
  filePath?: string;
  expiryDate?: string;
  uploadedAt: string;
  isApproved?: boolean;
  isRejected?: boolean;
  approvedAt?: string;
  approvedByUserId?: number;
  rejectionReason?: string;
  isExpired?: boolean;
  isExpiringSoon?: boolean;
}

export interface SafetyTraining {
  trainingId: number;
  driverId?: number;
  trainingName: string;
  completionDate?: string;
  certificatePath?: string;
  notes?: string;
}

export interface DriverSettlement {
  settlementId: number;
  driverId: number;
  driverName?: string;
  periodStart: string;
  periodEnd: string;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: string; // Draft, Approved, Paid
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface OwnerOperator {
  ownerOperatorId: number;
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  defaultRate?: number;
  rateType?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractTerms?: string;
  agreementFilePath?: string;
  isActive: boolean;
  createdAt: string;
  driverCount?: number;
  referredBy?: number;
  referrerCompanyName?: string;
}

export interface OwnerOperatorDetail extends OwnerOperator {
  drivers: OwnerOperatorDriver[];
}

export interface OwnerOperatorDriver {
  driverId: number;
  fullName: string;
  email?: string;
  mobilePhone?: string;
  status: string;
  type: string;
}

export interface CreateDriverRequest {
  ownerOperatorId?: number;
  fullName: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiry?: string;
  medicalCardExpiry?: string;
  mobilePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
  payStructure?: string;
  payRate?: number;
  type?: string;
  status?: string;
  hireDate?: string;
  referredBy?: number;
}

export interface UpdateDriverRequest extends CreateDriverRequest {
  driverId: number;
  terminationDate?: string;
  isDQFComplete?: boolean;
  dqfCompletionDate?: string;
}

export interface UpdateDriverStatusRequest {
  driverId: number;
  status: string;
}

export interface AddDriverDocumentRequest {
  driverId: number;
  documentType: string;
  filePath?: string;
  expiryDate?: string;
}

export interface AddSafetyTrainingRequest {
  driverId: number;
  trainingName: string;
  completionDate?: string;
  certificatePath?: string;
  notes?: string;
}

export interface CreateDriverSettlementRequest {
  driverId: number;
  periodStart: string;
  periodEnd: string;
  totalEarnings: number;
  totalDeductions: number;
  notes?: string;
}

export interface CreateOwnerOperatorRequest {
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  taxId?: string;
  defaultRate?: number;
  rateType?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  contractTerms?: string;
  agreementFilePath?: string;
}

export interface UpdateOwnerOperatorRequest extends CreateOwnerOperatorRequest {
  ownerOperatorId: number;
  isActive: boolean;
}

export interface LicenseExpiration {
  driverId: number;
  driverName: string;
  licenseNumber?: string;
  licenseState?: string;
  licenseExpiry?: string;
  medicalCardExpiry?: string;
  insuranceExpiry?: string;
  daysUntilExpiry: number;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export interface DriverReports {
  activeInactive: ActiveInactiveReport;
  performance: PerformanceDashboard;
  compliance: ComplianceDashboard;
}

export interface ActiveInactiveReport {
  activeCount: number;
  inactiveCount: number;
  onTripCount: number;
  availableCount: number;
  drivers: DriverStatus[];
}

export interface DriverStatus {
  driverId: number;
  fullName: string;
  status: string;
  type: string;
  hireDate?: string;
  terminationDate?: string;
}

export interface PerformanceDashboard {
  averageOnTimeRate: number;
  totalDrivers: number;
  driversWithIncidents: number;
  topPerformers: TopPerformer[];
  driverSummaries: DriverPerformanceSummary[];
}

export interface TopPerformer {
  driverId: number;
  fullName: string;
  onTimeRate: number;
  totalDeliveries: number;
  rating?: number;
}

export interface DriverPerformanceSummary {
  driverId: number;
  fullName: string;
  onTimeDeliveries: number;
  totalDeliveries: number;
  onTimeRate: number;
  incidents: number;
  rating?: number;
}

export interface ComplianceDashboard {
  expiringSoonCount: number;
  expiredCount: number;
  dqfCompleteCount: number;
  dqfIncompleteCount: number;
  complianceIssues: ComplianceIssue[];
}

export interface ComplianceIssue {
  driverId: number;
  driverName: string;
  issueType: string; // License, Medical, Insurance, DQF
  expiryDate?: string;
  isExpired: boolean;
  daysUntilExpiry: number;
}

export interface ReferralTree {
  driverId: number;
  driverName: string;
  referredBy?: number;
  referrerName?: string;
  totalReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  referralLevels: ReferralLevel[];
}

export interface ReferralLevel {
  level: number;
  count: number;
  totalEarnings: number;
  drivers: ReferralDriver[];
}

export interface ReferralDriver {
  driverId: number;
  fullName: string;
  children?: ReferralDriver[]; // Nested referrals
  email?: string;
  status: string;
  hireDate?: string;
  totalEarnings: number;
  referralCount: number;
}

export interface ReferralEarning {
  referralEarningId: number;
  referrerDriverId: number;
  referrerDriverName: string;
  referredDriverId: number;
  referredDriverName: string;
  settlementId: number;
  referralLevel: number;
  baseAmount: number;
  commissionRate: number;
  commissionAmount: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
  paidAt?: string;
}

export interface PendingDriver {
  driverId: number;
  userId: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  username: string;
  createdAt: string;
  referredBy?: number;
  referrerName?: string;
}

export interface RejectedDriver {
  driverId: number;
  userId: number;
  fullName: string;
  email: string;
  phoneNumber?: string;
  username: string;
  createdAt: string;
  rejectedAt: string;
  rejectedByUserId?: number;
  rejectedByName?: string;
  rejectionReason?: string;
  referredBy?: number;
  referrerName?: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
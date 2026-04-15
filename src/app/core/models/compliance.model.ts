// Incident Models
export interface Incident {
  incidentId: number;
  incidentNumber: string;
  driverId?: number;
  driverName?: string;
  loadId?: number;
  loadNumber?: string;
  equipmentId?: number;
  equipmentType?: string;
  incidentDate: string;
  reportedDate?: string;
  incidentType: string;
  description: string;
  location?: string;
  city?: string;
  state?: string;
  weatherConditions?: string;
  roadConditions?: string;
  severity: string;
  isDOTReportable: boolean;
  isOSHAReportable: boolean;
  dotReportNumber?: string;
  oshaReportNumber?: string;
  resolved: boolean;
  resolvedDate?: string;
  estimatedCost?: number;
  createdAt: string;
}

export interface CreateIncidentRequest {
  driverId?: number;
  loadId?: number;
  equipmentId?: number;
  incidentDate: string;
  reportedDate?: string;
  incidentType: string;
  description: string;
  location?: string;
  city?: string;
  state?: string;
  weatherConditions?: string;
  roadConditions?: string;
  severity: string;
  isDOTReportable: boolean;
  isOSHAReportable: boolean;
  reportedByUserId: number;
  assignedToUserId?: number;
  estimatedCost?: number;
}

export interface UpdateIncidentRequest {
  incidentId: number;
  driverId?: number;
  loadId?: number;
  equipmentId?: number;
  incidentDate: string;
  reportedDate?: string;
  incidentType: string;
  description: string;
  location?: string;
  city?: string;
  state?: string;
  weatherConditions?: string;
  roadConditions?: string;
  severity: string;
  isDOTReportable: boolean;
  isOSHAReportable: boolean;
  dotReportNumber?: string;
  oshaReportNumber?: string;
  assignedToUserId?: number;
  resolved: boolean;
  resolvedDate?: string;
  resolutionNotes?: string;
  rootCause?: string;
  correctiveAction?: string;
  estimatedCost?: number;
}

// Violation Models
export interface Violation {
  violationId: number;
  driverId: number;
  driverName?: string;
  loadId?: number;
  inspectionId?: number;
  violationDate: string;
  violationType: string;
  category: string;
  severity: string;
  points?: number;
  fineAmount?: number;
  description?: string;
  location?: string;
  state?: string;
  citationNumber?: string;
  isDisputed: boolean;
  disputeDate?: string;
  disputeStatus?: string;
  isPaid: boolean;
  paidDate?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateViolationRequest {
  driverId: number;
  loadId?: number;
  inspectionId?: number;
  violationDate: string;
  violationType: string;
  category: string;
  severity: string;
  points?: number;
  fineAmount?: number;
  description?: string;
  location?: string;
  state?: string;
  citationNumber?: string;
  notes?: string;
}

// Drug Test Models
export interface DrugTest {
  drugTestId: number;
  driverId: number;
  driverName: string;
  testDate: string;
  testType: string;
  testCategory: string;
  result: string;
  testingCompany?: string;
  mro?: string;
  resultDate?: string;
  substanceFound?: string;
  isCleared: boolean;
  createdAt: string;
}

export interface CreateDrugTestRequest {
  driverId: number;
  complianceId?: number;
  testDate: string;
  testType: string;
  testCategory: string;
  result: string;
  testingCompany?: string;
  mro?: string;
  mroPhone?: string;
  resultDate?: string;
  substanceFound?: string;
  level?: number;
  notes?: string;
}

// Compliance Calendar Models
export interface ComplianceCalendar {
  calendarId: number;
  driverId?: number;
  driverName?: string;
  equipmentId?: number;
  equipmentType?: string;
  itemType: string;
  title: string;
  description: string;
  dueDate: string;
  completedDate?: string;
  isCompleted: boolean;
  daysUntilDue: number;
  isOverdue: boolean;
  priority: string;
  notes?: string;
}

export interface CreateComplianceCalendarRequest {
  driverId?: number;
  equipmentId?: number;
  itemType: string;
  title: string;
  description: string;
  dueDate: string;
  priority: string;
  reminderFrequency?: string;
  notes?: string;
}

export interface MarkCalendarCompleteRequest {
  calendarId: number;
  completedDate: string;
  notes?: string;
}

// Inspection Record Models
export interface InspectionRecord {
  inspectionId: number;
  equipmentId: number;
  driverId?: number;
  inspectionNumber: string;
  inspectionDate: string;
  inspectionType: string;
  inspector?: string;
  inspectorBadgeNumber?: string;
  location?: string;
  state?: string;
  result: string;
  oosViolations?: number;
  totalViolations?: number;
  remarks?: string;
  isCritical: boolean;
  createdAt: string;
}

export interface CreateInspectionRecordRequest {
  equipmentId: number;
  driverId?: number;
  inspectionNumber: string;
  inspectionDate: string;
  inspectionType: string;
  inspector?: string;
  inspectorBadgeNumber?: string;
  location?: string;
  state?: string;
  result: string;
  oosViolations?: number;
  totalViolations?: number;
  remarks?: string;
  isCritical: boolean;
}

// Compliance Reports Models
export interface ComplianceReports {
  summary: ComplianceSummary;
  violationTrends: ViolationTrend[];
  auditReadiness: AuditReadiness;
}

export interface ComplianceSummary {
  totalDrivers: number;
  compliantDrivers: number;
  nonCompliantDrivers: number;
  expiringCDLs: number;
  expiringMedicalCards: number;
  overdueItems: number;
  pendingCalendarItems: number;
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  inspectionPassRate: number;
}

export interface ViolationTrend {
  category: string;
  count: number;
  month: string;
}

export interface AuditReadiness {
  isReady: boolean;
  missingItems: string[];
  expiringItems: string[];
  totalViolations: number;
  openIncidents: number;
  overallScore: number;
}


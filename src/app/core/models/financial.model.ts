// Paginated result for invoices
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

// Invoice Models
export interface Invoice {
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName?: string;
  loadId?: number;
  loadNumber?: string;
  issueDate: string;
  dueDate?: string;
  subTotal: number;
  taxAmount: number;
  raxUpCommission: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: string;
  isOverdue: boolean;
  createdAt: string;
  lineItems: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  lineItemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  itemType?: string;
  loadId?: number;
  accessorialId?: number;
}

export interface CreateInvoiceRequest {
  invoiceNumber?: string; // Optional - will be auto-generated if not provided
  customerId: number;
  loadId?: number;
  issueDate: string;
  dueDate?: string;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  currency?: string;
  notes?: string;
  terms?: string;
  lineItems: InvoiceLineItem[];
}

export interface UpdateInvoiceRequest {
  invoiceId: number;
  invoiceNumber?: string;
  customerId?: number;
  issueDate?: string;
  dueDate?: string;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  terms?: string;
  status?: string;
  lineItems: InvoiceLineItem[];
}

export interface CreateInvoiceFromLoadRequest {
  loadId: number;
  dueDate?: string;
  taxRate?: number;
  terms?: string;
  includeAccessorials?: boolean;
  includeDetention?: boolean;
  includeLayover?: boolean;
}

// Payment Models
export interface Payment {
  paymentId: number;
  invoiceId: number;
  paymentDate: string;
  amount: number;
  method: string;
  checkNumber?: string;
  creditCardNumber?: string;
  reference?: string;
  bankName?: string;
  notes?: string;
  isReconciled: boolean;
  createdAt: string;
}

export interface RecordPaymentRequest {
  invoiceId: number;
  paymentDate: string;
  amount: number;
  method: string;
  checkNumber?: string;
  creditCardNumber?: string;
  reference?: string;
  bankName?: string;
  notes?: string;
  bankTransactionId?: number;
}

// Settlement Models
export interface DriverSettlement {
  settlementId: number;
  driverId: number;
  driverName?: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  settlementType: string;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  notes?: string;
  createdAt: string;
  approvedAt?: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  items: SettlementItem[];
  deductions: SettlementDeduction[];
  fuelAdvances: FuelAdvance[];
}

export interface SettlementItem {
  settlementItemId?: number;
  loadId: number;
  description: string;
  rate: number;
  miles: number;
  amount: number;
  itemType: string;
  notes?: string;
}

export interface SettlementDeduction {
  deductionId?: number;
  deductionType: string;
  description: string;
  amount: number;
  reference?: string;
  deductionDate?: string;
}

export interface CreateSettlementRequest {
  driverId: number;
  periodStart: string;
  periodEnd: string;
  settlementType: string;
  notes?: string;
  items: SettlementItem[];
  deductions: SettlementDeduction[];
}

export interface ApproveSettlementRequest {
  settlementId: number;
}

export interface MarkSettlementPaidRequest {
  settlementId: number;
  paymentMethod: string;
  paymentReference?: string;
}

// Fuel Advance Models
export interface FuelAdvance {
  fuelAdvanceId: number;
  driverId: number;
  driverName?: string;
  settlementId?: number;
  loadId?: number;
  advanceDate: string;
  amount: number;
  location?: string;
  receiptNumber?: string;
  isDeducted: boolean;
  deductedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateFuelAdvanceRequest {
  driverId: number;
  loadId?: number;
  advanceDate: string;
  amount: number;
  location?: string;
  receiptNumber?: string;
  notes?: string;
}

// Financial Reports Models
export interface FinancialReports {
  agingReport: AgingReport;
  revenueReport: RevenueReport;
  profitLoss: ProfitLoss;
  settlementHistory: SettlementHistory;
}

export interface AgingReport {
  items: AgingItem[];
  totalCurrent: number;
  total1To30Days: number;
  total31To60Days: number;
  total61To90Days: number;
  totalOver90Days: number;
  grandTotal: number;
}

export interface AgingItem {
  customerId: number;
  customerName: string;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  over90Days: number;
  total: number;
}

export interface RevenueReport {
  byDriver: RevenueByDriver[];
  byCustomer: RevenueByCustomer[];
  totalRevenue: number;
}

export interface RevenueByDriver {
  driverId: number;
  driverName: string;
  loadCount: number;
  totalRevenue: number;
}

export interface RevenueByCustomer {
  customerId: number;
  customerName: string;
  invoiceCount: number;
  totalRevenue: number;
}

export interface ProfitLoss {
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  expenseCategories: ExpenseCategory[];
}

export interface ExpenseCategory {
  category: string;
  amount: number;
}

export interface SettlementHistory {
  settlements: SettlementHistoryItem[];
  totalEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
}

// Payroll Models
export interface Payroll {
  payrollId: number;
  driverId?: number;
  driverName?: string;
  ownerOperatorId?: number;
  ownerOperatorName?: string;
  settlementId?: number;
  payrollNumber: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  evereePayrollId?: string;
  evereeSyncStatus: string;
  lastSyncedAt?: string;
  syncError?: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
}

export interface CreatePayrollRequest {
  driverId?: number;
  ownerOperatorId?: number;
  settlementId?: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPay: number;
  totalDeductions: number;
  notes?: string;
  syncToEveree?: boolean;
}

export interface SyncWorkerToEvereeRequest {
  driverId?: number;
  ownerOperatorId?: number;
}

export interface SyncWorkerToEvereeResponse {
  integrationId: number;
  evereeWorkerId?: string;
  syncStatus: string;
  errorMessage?: string;
  success: boolean;
}

export interface SyncPayrollToEvereeResponse {
  evereePayrollId?: string;
  syncStatus: string;
  errorMessage?: string;
  success: boolean;
}

export interface SyncPayrollFromEvereeRequest {
  payrollId?: number;
  startDate?: string;
  endDate?: string;
  syncAll?: boolean;
}

export interface SyncPayrollFromEvereeResponse {
  syncedCount: number;
  failedCount: number;
  errors: string[];
  success: boolean;
}

// Everee Integration Models
export interface EvereeIntegrationStatus {
  integrationId: number;
  driverId?: number;
  driverName?: string;
  ownerOperatorId?: number;
  ownerOperatorName?: string;
  workerType: string;
  evereeWorkerId?: string;
  syncStatus: string;
  lastSyncedAt?: string;
  syncError?: string;
}

export interface SettlementHistoryItem {
  settlementId: number;
  settlementNumber: string;
  driverId: number;
  driverName: string;
  periodStart: string;
  periodEnd: string;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  createdAt: string;
}

// Accounts Payable Models
export interface AccountsPayable {
  payableId: number;
  payableNumber: string;
  vendorName: string;
  vendorAddress?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  invoiceNumber?: string;
  category?: string;
  notes?: string;
  createdByUserId?: number;
  createdByUserName?: string;
  createdAt: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
  isOverdue: boolean;
  daysPastDue: number;
}

export interface AccountsPayableDetail extends AccountsPayable {
  payments: PayablePayment[];
}

export interface CreateAccountsPayableRequest {
  payableNumber?: string; // Optional - will be auto-generated if not provided
  vendorName: string;
  vendorAddress?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  invoiceNumber?: string;
  category?: string;
  notes?: string;
}

export interface UpdateAccountsPayableRequest {
  payableId: number;
  vendorName?: string;
  vendorAddress?: string;
  invoiceDate?: string;
  dueDate?: string;
  amount?: number;
  invoiceNumber?: string;
  category?: string;
  notes?: string;
  status?: string;
}

export interface MarkAccountsPayablePaidRequest {
  payableId: number;
  paidAt?: string;
  paymentMethod?: string;
  paymentReference?: string;
}

// Accounts Receivable Models
export interface AccountsReceivable {
  receivableId: number;
  customerId: number;
  customerName: string;
  invoiceId?: number;
  invoiceNumber?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  daysPastDue: number;
  status: string;
  createdAt: string;
  paidAt?: string;
  isOverdue: boolean;
}

export interface AccountsReceivableDetail extends AccountsReceivable {}

export interface CreateAccountsReceivableRequest {
  customerId: number;
  invoiceId?: number;
  amount: number;
  dueDate: string;
}

export interface RecordReceivablePaymentRequest {
  receivableId: number;
  paymentAmount: number;
  paidAt?: string;
}

// Payable Payment Models
export interface PayablePayment {
  paymentId: number;
  payableId: number;
  payableNumber: string;
  vendorName: string;
  paymentDate: string;
  amount: number;
  method: string;
  checkNumber?: string;
  creditCardNumber?: string;
  reference?: string;
  notes?: string;
  createdByUserId?: number;
  createdByUserName?: string;
  createdAt: string;
}

export interface CreatePayablePaymentRequest {
  payableId: number;
  paymentDate: string;
  amount: number;
  method: string;
  checkNumber?: string;
  creditCardNumber?: string;
  reference?: string;
  notes?: string;
}


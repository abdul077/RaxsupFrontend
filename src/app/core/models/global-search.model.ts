export interface GlobalSearchLoadHit {
  loadId: number;
  loadNumber: string;
  route?: string | null;
  status?: string | null;
}

export interface GlobalSearchBrokerHit {
  customerId: number;
  name: string;
  mcNumber?: string | null;
  dotNumber?: string | null;
}

export interface GlobalSearchInvoiceHit {
  invoiceId: number;
  invoiceNumber: string;
  customerName?: string | null;
  loadNumber?: string | null;
}

export interface GlobalSearchDriverHit {
  driverId: number;
  fullName: string;
  email?: string | null;
}

export interface GlobalSearchOwnerOperatorHit {
  ownerOperatorId: number;
  companyName: string;
  email?: string | null;
}

export interface GlobalSearchResult {
  loads: GlobalSearchLoadHit[];
  brokers: GlobalSearchBrokerHit[];
  invoices: GlobalSearchInvoiceHit[];
  drivers: GlobalSearchDriverHit[];
  ownerOperators: GlobalSearchOwnerOperatorHit[];
}

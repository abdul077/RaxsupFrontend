export interface Load {
  loadId: number;
  loadNumber: string;
  customerId?: number;
  customerName?: string;
  origin: string;
  destination: string;
  pickupDateTime?: string;
  deliveryDateTime?: string;
  totalRate?: number;
  currency: string;
  loadType?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
  driverName?: string;
  ownerOperatorName?: string;
  equipmentPlateNumber?: string;
  /** Vehicle/equipment type (e.g. Truck, Trailer, Reefer). */
  equipmentType?: string;
  /** Optional: from API for smart route column */
  distanceKm?: number;
  stopsCount?: number;
  equipmentId?: number;
  /** Optional empty repositioning leg (same currency as load for amount). */
  deadheadOrigin?: string;
  deadheadDestination?: string;
  deadheadAmount?: number;
}

export interface LoadNote {
  loadNoteId: number;
  content: string;
  visibility: string;
  createdAt: string;
  createdByUserId: number;
  authorName?: string;
}

export interface LoadDetail extends Load {
  stops: LoadStop[];
  assignments: LoadAssignment[];
  documents: LoadDocument[];
  accessorials?: LoadAccessorial[];
  loadNotes?: LoadNote[];
}

export interface LoadStop {
  stopId: number;
  sequenceNo: number;
  location: string;
  stopType: string; // Pickup, Dropoff
  plannedDateTime?: string;
  actualDateTime?: string;
  notes?: string;
}

export interface LoadAssignment {
  assignmentId: number;
  driverId?: number;
  driverName?: string;
  equipmentId?: number;
  equipmentPlateNumber?: string;
  assignedAt: string;
  eta?: string;
  etd?: string;
  status: string;
  notes?: string;
}

export interface LoadDocument {
  loadDocumentId: number;
  documentType: string; // BOL, POD, RateConfirmation
  filePath: string;
  uploadedAt: string;
}

export interface LoadAccessorial {
  accessorialId: number;
  accessorialTypeId?: number;
  accessorialTypeName?: string;
  amount: number;
  notes?: string;
}

export interface AccessorialType {
  accessorialTypeId: number;
  name: string;
  description?: string;
}

export interface LoadActivityLog {
  logId: number;
  userId?: number;
  userName?: string;
  action: string;
  entityName?: string;
  entityId?: string;
  details?: string;
  timestamp: string;
}

export interface CreateLoadRequest {
  loadNumber: string;
  customerId?: number;
  origin: string;
  destination: string;
  distanceKm?: number;
  pickupDateTime?: string;
  deliveryDateTime?: string;
  totalRate?: number;
  currency?: string;
  loadType?: string;
  notes?: string;
  deadheadOrigin?: string;
  deadheadDestination?: string;
  deadheadAmount?: number;
}

export interface CreateLoadStopRequest {
  sequenceNo: number;
  location: string;
  stopType: string;
  plannedDateTime?: string;
  notes?: string;
}

export interface AssignLoadRequest {
  driverId?: number;
  equipmentId?: number;
  eta?: string;
  etd?: string;
  notes?: string;
}

export interface CreateAccessorialRequest {
  accessorialTypeId?: number;
  amount: number;
  notes?: string;
}

/** POST loads/{id}/notes — visibility: Internal | Driver | Customer | Public */
export interface AddLoadNoteRequest {
  content: string;
  visibility: string;
}

export interface CreateAccessorialTypeRequest {
  name: string;
  description?: string;
}

export interface UpdateAccessorialTypeRequest {
  name?: string;
  description?: string;
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

/** GET loads/{id}/tracking */
export interface LoadTrackingCurrentLocation {
  latitude?: number;
  longitude?: number;
  lastUpdate?: string;
  locationType?: string;
}

export interface LoadTrackingEvent {
  trackingId: number;
  latitude?: number;
  longitude?: number;
  locationType?: string;
  eventType?: string;
  recordedAt: string;
  notes?: string;
}

export interface LoadTracking {
  loadId: number;
  loadNumber: string;
  status: string;
  currentLocation: LoadTrackingCurrentLocation | null;
  history: LoadTrackingEvent[];
}


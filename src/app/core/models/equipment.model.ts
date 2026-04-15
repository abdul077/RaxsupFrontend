export interface Equipment {
  equipmentId: number;
  equipmentType: string; // Truck, Trailer, Reefer
  vin?: string;
  plateNumber?: string;
  make?: string;
  model?: string;
  yearManufactured?: number;
  currentOdometer?: number;
  status: string; // Active, InMaintenance, Retired
  assignedToDriverId?: number;
  assignedDriverName?: string;
  createdAt: string;
}

export interface CreateEquipmentRequest {
  equipmentType: string;
  vin?: string;
  plateNumber?: string;
  make?: string;
  model?: string;
  yearManufactured?: number;
  currentOdometer?: number;
  status?: string;
  assignedToDriverId?: number;
  /** Optional Motive vehicle/asset ID. When provided, RaxsUp links to this Motive entity instead of creating one. */
  motiveId?: string;
}

export interface UpdateEquipmentRequest {
  equipmentType: string;
  vin?: string;
  plateNumber?: string;
  make?: string;
  model?: string;
  yearManufactured?: number;
  currentOdometer?: number;
  status: string;
  assignedToDriverId?: number;
}

export interface MaintenanceLog {
  logId: number;
  equipmentId: number;
  serviceType: string;
  serviceDate: string;
  vendor?: string;
  cost: number;
  odometerAtService?: number;
  remarks?: string;
  createdAt: string;
}

export interface CreateMaintenanceLogRequest {
  equipmentId: number;
  serviceType: string;
  serviceDate: string;
  vendor?: string;
  cost: number;
  odometerAtService?: number;
  remarks?: string;
}


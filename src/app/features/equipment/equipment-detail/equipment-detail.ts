import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EquipmentService } from '../../../core/services/equipment.service';
import { AuthService } from '../../../core/services/auth';
import { Equipment, MaintenanceLog } from '../../../core/models/equipment.model';
import { MotiveExternalIdMapping, MotiveLastSync } from '../../../core/models/motive-admin.model';

interface MotiveLastLocation {
  latitude: number;
  longitude: number;
  locatedAt?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  source: string;
}

interface EquipmentMotiveInfo {
  configured: boolean;
  integrationName: string;
  entityType: string;
  equipmentId: number;
  mapping?: MotiveExternalIdMapping | null;
  lastSync?: MotiveLastSync | null;
  motiveId?: string | null;
  externalId?: string | null;
  lookupResponse?: any;
  motiveEntity?: any;
  lastLocation?: MotiveLastLocation | null;
}

@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './equipment-detail.html',
  styleUrl: './equipment-detail.scss',
})
export class EquipmentDetailComponent implements OnInit {
  equipmentId!: number;
  equipment: Equipment | null = null;
  maintenanceLogs: MaintenanceLog[] = [];
  motiveInfo: EquipmentMotiveInfo | null = null;

  loading = true;
  loadingLogs = false;
  loadingMotive = false;
  pushingToMotive = false;
  motiveError: string = '';
  motiveSuccess: string = '';
  manualMotiveId: string = '';
  notFound = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private equipmentService: EquipmentService,
    private sanitizer: DomSanitizer,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    if (!id || Number.isNaN(id)) {
      this.notFound = true;
      this.loading = false;
      return;
    }

    this.equipmentId = id;
    this.loadEquipment();
    this.loadMaintenanceLogs();
    this.loadMotiveInfo();
  }

  private loadEquipment(): void {
    // Backend currently provides list endpoint, so we fetch and find by id.
    this.loading = true;
    this.equipmentService.getEquipments(undefined, undefined).subscribe({
      next: (items) => {
        this.equipment = (items || []).find(e => e.equipmentId === this.equipmentId) || null;
        this.notFound = !this.equipment;
        this.loading = false;
      },
      error: () => {
        this.equipment = null;
        this.notFound = true;
        this.loading = false;
      }
    });
  }

  private loadMaintenanceLogs(): void {
    this.loadingLogs = true;
    this.equipmentService.getMaintenanceLogs(this.equipmentId).subscribe({
      next: (logs) => {
        this.maintenanceLogs = (logs || []).slice().sort((a, b) => {
          const aTime = new Date(a.serviceDate).getTime();
          const bTime = new Date(b.serviceDate).getTime();
          return bTime - aTime;
        });
        this.loadingLogs = false;
      },
      error: () => {
        this.maintenanceLogs = [];
        this.loadingLogs = false;
      }
    });
  }

  private loadMotiveInfo(): void {
    this.loadingMotive = true;
    this.motiveError = '';
    this.equipmentService.getEquipmentMotiveInfo(this.equipmentId).subscribe({
      next: (info) => {
        this.motiveInfo = info || null;
        this.loadingMotive = false;
      },
      error: (err) => {
        this.motiveInfo = null;
        this.loadingMotive = false;
        this.motiveError = err?.error?.message || 'Failed to load Motive information.';
      }
    });
  }

  goBack(): void {
    const state = this.location.getState() as { equipmentReturnUrl?: string } | null;
    if (state?.equipmentReturnUrl) {
      void this.router.navigateByUrl(state.equipmentReturnUrl);
      return;
    }
    // Drivers cannot open /equipment (list); sending them there hits roleGuard and often lands on dashboard.
    if (this.authService.hasRole('Driver')) {
      void this.router.navigate(['/drivers/my-vehicles']);
      return;
    }
    void this.router.navigate(['/equipment']);
  }

  get backButtonLabel(): string {
    return this.authService.hasRole('Driver') ? 'Back to My Vehicles' : 'Back to Equipment';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatOdometer(odometer?: number): string {
    if (!odometer && odometer !== 0) return '-';
    return odometer.toLocaleString() + ' mi';
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Active': 'badge-success',
      'Assigned': 'badge-info',
      'InUse': 'badge-primary',
      'InTransit': 'badge-primary',
      'InMaintenance': 'badge-warning',
      'Retired': 'badge-danger'
    };
    return statusMap[status] || 'badge-secondary';
  }

  getStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'Active': 'fa-check-circle',
      'Assigned': 'fa-clipboard-check',
      'InUse': 'fa-truck',
      'InTransit': 'fa-truck-moving',
      'InMaintenance': 'fa-wrench',
      'Retired': 'fa-ban'
    };
    return iconMap[status] || 'fa-circle';
  }

  getGoogleMapsLink(lat: number, lon: number): string {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }

  /** Create this equipment in Motive (add vehicle/asset) and link it. Shown when Motive is configured but equipment has no Motive ID. */
  pushToMotive(): void {
    if (!this.equipmentId || this.pushingToMotive) return;
    this.pushingToMotive = true;
    this.motiveError = '';
    this.motiveSuccess = '';
    this.equipmentService.pushToMotive(this.equipmentId).subscribe({
      next: (res) => {
        this.pushingToMotive = false;
        this.motiveSuccess = res?.message || 'Created in Motive and linked.';
        this.loadMotiveInfo();
        setTimeout(() => (this.motiveSuccess = ''), 5000);
      },
      error: (err) => {
        this.pushingToMotive = false;
        this.motiveError = err?.error?.message || 'Failed to create/link in Motive.';
      }
    });
  }

  /** Link this equipment to an existing Motive vehicle/asset by ID (e.g. when Create in Motive did not return an id). */
  linkWithMotiveId(): void {
    const id = this.manualMotiveId?.trim();
    if (!this.equipmentId || this.pushingToMotive || !id) return;
    this.pushingToMotive = true;
    this.motiveError = '';
    this.motiveSuccess = '';
    this.equipmentService.pushToMotive(this.equipmentId, id).subscribe({
      next: (res) => {
        this.pushingToMotive = false;
        this.manualMotiveId = '';
        this.motiveSuccess = res?.message || 'Linked to Motive.';
        this.loadMotiveInfo();
        setTimeout(() => (this.motiveSuccess = ''), 5000);
      },
      error: (err) => {
        this.pushingToMotive = false;
        this.motiveError = err?.error?.message || 'Failed to link with Motive ID.';
      }
    });
  }

  getGoogleMapsEmbedUrl(lat: number, lon: number): SafeResourceUrl {
    const url = `https://www.google.com/maps?q=${lat},${lon}&z=14&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}


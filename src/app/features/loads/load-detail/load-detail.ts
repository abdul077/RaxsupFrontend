import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadService } from '../../../core/services/load.service';
import { ApiService } from '../../../core/services/api';
import { AuthService } from '../../../core/services/auth';
import { DriverService } from '../../../core/services/driver.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { LoadDetail, LoadNote, LoadStop, LoadAssignment, LoadDocument, LoadAccessorial, CreateLoadStopRequest, AssignLoadRequest, CreateAccessorialRequest, LoadTracking, LoadTrackingEvent } from '../../../core/models/load.model';
import { Driver } from '../../../core/models/driver.model';
import { Customer } from '../../../core/models/customer.model';
import { Equipment } from '../../../core/models/equipment.model';
import { environment } from '../../../../environments/environment';

// Google Maps type declarations
declare var google: any;

@Component({
  selector: 'app-load-detail',
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './load-detail.html',
  styleUrl: './load-detail.scss',
})
export class LoadDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  load: LoadDetail | null = null;
  loading = true;
  activeTab: 'overview' | 'stops' | 'assignments' | 'documents' | 'accessorials' | 'route' | 'activity' | 'billing' | 'tracking' = 'overview';
  
  // Data for dropdowns
  drivers: Driver[] = [];
  customers: Customer[] = [];
  allEquipment: Equipment[] = [];
  equipment: Equipment[] = [];
  accessorialTypes: any[] = [];

  // Modals
  showStopModal = false;
  showAssignmentModal = false;
  showDocumentModal = false;
  showAccessorialModal = false;
  showRouteModal = false;
  assignmentValidationError: string = '';
  assignmentFieldErrors: { [key: string]: string } = {};

  // Form data
  stopForm: CreateLoadStopRequest = {
    sequenceNo: 1,
    location: '',
    stopType: 'Pickup',
    plannedDateTime: '',
    notes: ''
  };

  assignmentForm: AssignLoadRequest = {
    driverId: undefined,
    equipmentId: undefined,
    eta: '',
    etd: '',
    notes: ''
  };

  accessorialForm: CreateAccessorialRequest = {
    accessorialTypeId: undefined,
    amount: 0,
    notes: ''
  };

  documentFile: File | null = null;
  documentType: string = 'BOL';

  // Route optimization
  routeOptimized = false;
  routeData: any = null;
  mapsApiLoaded = false;
  routeMap: any = null;
  directionsService: any = null;
  directionsRenderer: any = null;
  routeMarkers: any[] = [];

  /** Small map on Overview tab (separate from full Route tab map). */
  overviewRouteMap: any = null;
  overviewDirectionsRenderer: any = null;
  overviewMapError: string | null = null;
  /** Driving distance from Directions API for overview (meters). */
  overviewRouteDistanceMeters: number | null = null;

  /** Load GPS / check-in history (GET loads/{id}/tracking). */
  trackingData: LoadTracking | null = null;
  trackingLoading = false;
  trackingError: string | null = null;
  trackingMap: any = null;
  trackingPolyline: any = null;
  trackingMarkers: any[] = [];

  // Google Places Autocomplete for stop location
  stopLocationAutocomplete: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loadService: LoadService,
    private apiService: ApiService,
    private driverService: DriverService,
    public authService: AuthService,
    private datePipe: DatePipe,
    private timeZoneService: TimeZoneService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Helper method to remove "Powered by Google" logo completely
   * Removes ALL logos and any elements containing "powered by" text
   */
  private fixPacContainerLogo(pacContainer: HTMLElement): void {
    if (!pacContainer) return;
    
    // Use requestAnimationFrame for immediate execution
    requestAnimationFrame(() => {
      // Remove all .pac-logo elements
      const logos = Array.from(pacContainer.querySelectorAll('.pac-logo')) as HTMLElement[];
      logos.forEach((logo) => {
        logo.remove();
      });
      
      // Also search for any element containing "powered by" or "Google" text
      const allElements = Array.from(pacContainer.querySelectorAll('*')) as HTMLElement[];
      allElements.forEach((element) => {
        // Skip pac-items and pac-icons
        if (element.classList.contains('pac-item') || element.classList.contains('pac-icon')) {
          return;
        }
        
        const text = element.textContent || element.innerText || '';
        const lowerText = text.toLowerCase();
        
        // If element contains "powered by" or "google" (and is not a pac-item), remove it
        if ((lowerText.includes('powered by') || lowerText.includes('google')) && text.trim().length < 50) {
          element.remove();
        }
      });
      
      // Also check the container itself
      const containerText = pacContainer.textContent || pacContainer.innerText || '';
      if (containerText.toLowerCase().includes('powered by')) {
        // Find and remove the specific text node or element
        const walker = document.createTreeWalker(
          pacContainer,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent && node.textContent.toLowerCase().includes('powered by')) {
            const parent = node.parentElement;
            if (parent && !parent.classList.contains('pac-item')) {
              parent.remove();
            }
          }
        }
      }
      
      // Ensure items are visible
      const items = pacContainer.querySelectorAll('.pac-item');
      items.forEach((item) => {
        const itemElement = item as HTMLElement;
        itemElement.style.position = 'relative';
        itemElement.style.zIndex = '2';
        itemElement.style.backgroundColor = 'white';
      });
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadLoadDetail(+id);
      this.loadDrivers();
      this.loadCustomers();
      this.loadEquipment();
      this.loadAccessorialTypes();
      this.loadGoogleMaps();
    }
  }

  ngAfterViewInit(): void {
    // Initialize map when route tab is active
    if (this.activeTab === 'route') {
      setTimeout(() => this.initRouteMap(), 500);
    }
  }

  ngOnDestroy(): void {
    // Clean up map and markers
    if (this.routeMap) {
      this.routeMap = null;
    }
    if (this.overviewDirectionsRenderer) {
      try {
        this.overviewDirectionsRenderer.setMap(null);
      } catch {
        /* ignore */
      }
      this.overviewDirectionsRenderer = null;
    }
    this.overviewRouteMap = null;
    this.clearTrackingMapOverlays();
    if (this.trackingMap) {
      this.trackingMap = null;
    }
    this.routeMarkers.forEach(marker => marker.setMap(null));
    this.routeMarkers = [];

    // Clean up autocomplete
    if (this.stopLocationAutocomplete) {
      try {
        if (typeof google !== 'undefined' && google.maps && google.maps.event) {
          google.maps.event.clearInstanceListeners(this.stopLocationAutocomplete);
        }
      } catch (e) {
        console.warn('Error cleaning up autocomplete:', e);
      }
      this.stopLocationAutocomplete = null;
    }
  }

  loadLoadDetail(id: number): void {
    this.loading = true;
    this.loadService.getLoadById(id).subscribe({
      next: (data) => {
        this.load = { ...data, loadNotes: data.loadNotes ?? [] };
        this.loading = false;
        this.overviewRouteDistanceMeters = null;
        this.overviewMapError = null;
        this.trackingData = null;
        this.trackingError = null;
        this.clearTrackingMapOverlays();
        // If route tab is active and map is loaded, display route
        if (this.activeTab === 'route' && this.mapsApiLoaded && this.routeMap) {
          setTimeout(() => this.displayRoute(), 300);
        }
        setTimeout(() => this.tryInitOverviewMap(), 0);
        if (this.activeTab === 'tracking') {
          setTimeout(() => this.loadLoadTracking(), 0);
        }
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/loads']);
      }
    });
  }

  loadDrivers(): void {
    // Get all drivers for dropdown (using large page size to get all)
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (data) => {
        // Filter to only show drivers with status "Active" or "Available"
        this.drivers = data.items.filter(driver => 
          driver.status === 'Active' || driver.status === 'Available'
        );
      },
      error: () => this.drivers = []
    });
  }

  loadCustomers(): void {
    this.apiService.get<Customer[]>('customers').subscribe({
      next: (data) => this.customers = data,
      error: () => this.customers = []
    });
  }

  loadEquipment(): void {
    this.apiService.get<Equipment[]>('equipment').subscribe({
      next: (data) => {
        this.allEquipment = data;
        this.equipment = data; // Initially show all equipment
        if (this.showAssignmentModal) {
          this.setEquipmentOptionsForDriver(this.assignmentForm.driverId, {
            preserveEquipmentSelection: true,
          });
        }
      },
      error: () => {
        this.allEquipment = [];
        this.equipment = [];
      }
    });
  }

  /**
   * Raw status from API (supports camelCase or PascalCase JSON).
   */
  private equipmentStatusRaw(eq: Equipment): string {
    const e = eq as Equipment & { Status?: string };
    const v = e.status ?? e.Status;
    return v != null ? String(v).trim() : '';
  }

  /**
   * Equipment that can be assigned to a load — same idea as the equipment list UI
   * (Active, Assigned, InUse, InTransit). Excludes Retired / InMaintenance.
   */
  private isEquipmentAssignableForLoad(eq: Equipment): boolean {
    const s = this.equipmentStatusRaw(eq).toLowerCase();
    if (!s) {
      return false;
    }
    return (
      s === 'active' ||
      s === 'assigned' ||
      s === 'inuse' ||
      s === 'intransit'
    );
  }

  private assignableEquipmentForLoad(): Equipment[] {
    return this.allEquipment.filter((eq) => this.isEquipmentAssignableForLoad(eq));
  }

  /**
   * Driver IDs whose assigned equipment should appear for the given driver.
   * Owner-operator companies: any active/available driver row with the same ownerOperatorId.
   * Otherwise: only the selected driver.
   */
  private driverIdsForEquipmentScope(driverId: number): number[] {
    const selected = this.drivers.find((d) => Number(d.driverId) === driverId);
    if (!selected) {
      return [driverId];
    }
    const ooId = selected.ownerOperatorId;
    if (ooId == null) {
      return [driverId];
    }
    const ids = this.drivers
      .filter(
        (d) =>
          d.ownerOperatorId != null && Number(d.ownerOperatorId) === Number(ooId)
      )
      .map((d) => Number(d.driverId));
    return ids.length > 0 ? ids : [driverId];
  }

  /**
   * Populates the equipment dropdown for the selected driver / owner-operator scope.
   * Uses Number() for IDs so JSON/select binding types do not break matching.
   */
  private setEquipmentOptionsForDriver(
    driverIdRaw: unknown,
    opts?: { preserveEquipmentSelection?: boolean }
  ): void {
    const preserve = opts?.preserveEquipmentSelection ?? false;
    const assignable = this.assignableEquipmentForLoad();

    const parsed =
      driverIdRaw === null || driverIdRaw === undefined || driverIdRaw === ''
        ? NaN
        : Number(driverIdRaw);
    const driverId = Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : NaN;

    if (!Number.isFinite(driverId)) {
      this.equipment = [];
      this.assignmentForm.driverId = undefined;
      this.assignmentForm.equipmentId = undefined;
      console.log('[LoadDetail assignment] driver cleared', {
        driverIdRaw,
        preserveEquipmentSelection: preserve,
      });
      return;
    }

    this.assignmentForm.driverId = driverId;

    const scopeIds = this.driverIdsForEquipmentScope(driverId);
    const scopeSet = new Set(scopeIds);
    const selectedDriver = this.drivers.find((d) => Number(d.driverId) === driverId);

    const scopedEquipment = assignable.filter(
      (eq) =>
        eq.assignedToDriverId != null &&
        scopeSet.has(Number(eq.assignedToDriverId))
    );

    this.equipment = scopedEquipment;

    const currentId = this.assignmentForm.equipmentId;
    const currentStillValid =
      currentId != null &&
      scopedEquipment.some((eq) => Number(eq.equipmentId) === Number(currentId));

    if (preserve && currentStillValid) {
      console.log('[LoadDetail assignment] driver selection (kept existing equipment)', {
        driverIdRaw,
        driverId,
        preserveEquipmentSelection: preserve,
        selectedDriver: selectedDriver
          ? {
              driverId: selectedDriver.driverId,
              fullName: selectedDriver.fullName,
              type: selectedDriver.type,
              ownerOperatorId: selectedDriver.ownerOperatorId,
              ownerOperatorName: selectedDriver.ownerOperatorName,
              status: selectedDriver.status,
            }
          : null,
        scopeDriverIds: scopeIds,
        allEquipmentCount: this.allEquipment.length,
        assignableEquipmentCount: assignable.length,
        scopedEquipmentCount: scopedEquipment.length,
        scopedEquipment: scopedEquipment.map((eq) => ({
          equipmentId: eq.equipmentId,
          plateNumber: eq.plateNumber,
          assignedToDriverId: eq.assignedToDriverId,
          status: this.equipmentStatusRaw(eq),
        })),
        equipmentId: this.assignmentForm.equipmentId,
      });
      return;
    }

    if (scopedEquipment.length > 0) {
      this.assignmentForm.equipmentId = scopedEquipment[0].equipmentId;
    } else {
      this.assignmentForm.equipmentId = undefined;
    }

    console.log('[LoadDetail assignment] driver selection', {
      driverIdRaw,
      driverId,
      preserveEquipmentSelection: preserve,
      selectedDriver: selectedDriver
        ? {
            driverId: selectedDriver.driverId,
            fullName: selectedDriver.fullName,
            type: selectedDriver.type,
            ownerOperatorId: selectedDriver.ownerOperatorId,
            ownerOperatorName: selectedDriver.ownerOperatorName,
            status: selectedDriver.status,
          }
        : null,
      scopeDriverIds: scopeIds,
      allEquipmentCount: this.allEquipment.length,
      assignableEquipmentCount: assignable.length,
      scopedEquipmentCount: scopedEquipment.length,
      scopedEquipment: scopedEquipment.map((eq) => ({
        equipmentId: eq.equipmentId,
        plateNumber: eq.plateNumber,
        assignedToDriverId: eq.assignedToDriverId,
        status: this.equipmentStatusRaw(eq),
      })),
      equipmentId: this.assignmentForm.equipmentId,
    });
  }

  loadAccessorialTypes(): void {
    this.loadService.getAccessorialTypes().subscribe({
      next: (data) => this.accessorialTypes = data,
      error: () => this.accessorialTypes = []
    });
  }

  // Stop Management
  openStopModal(): void {
    if (this.load) {
      const nextSequence = Math.max(...this.load.stops.map(s => s.sequenceNo), 0) + 1;
      this.stopForm = {
        sequenceNo: nextSequence,
        location: '',
        stopType: 'Pickup',
        plannedDateTime: '',
        notes: ''
      };
      this.showStopModal = true;
      // Initialize autocomplete after modal is shown
      setTimeout(() => this.initStopLocationAutocomplete(), 300);
    }
  }

  initStopLocationAutocomplete(): void {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('Google Maps API not loaded, retrying...');
      setTimeout(() => this.initStopLocationAutocomplete(), 300);
      return;
    }

    // Clear existing autocomplete if any
    if (this.stopLocationAutocomplete) {
      try {
        google.maps.event.clearInstanceListeners(this.stopLocationAutocomplete);
      } catch (e) {
        console.warn('Error clearing autocomplete listeners:', e);
      }
      this.stopLocationAutocomplete = null;
    }

    // Retry logic to wait for modal DOM to be ready
    const tryInit = (attempt: number = 0) => {
      if (attempt > 20) {
        console.error('Failed to initialize stop location autocomplete after multiple attempts');
        return;
      }

      const stopLocationInput = document.getElementById('stop-location-input') as HTMLInputElement;
      if (!stopLocationInput) {
        setTimeout(() => tryInit(attempt + 1), 200);
        return;
      }

      // Check if input is actually visible (modal is shown)
      if (!stopLocationInput.offsetParent) {
        setTimeout(() => tryInit(attempt + 1), 200);
        return;
      }

      try {
        // Ensure input is ready
        stopLocationInput.setAttribute('autocomplete', 'off');
        stopLocationInput.setAttribute('autocorrect', 'off');
        stopLocationInput.setAttribute('autocapitalize', 'off');
        stopLocationInput.setAttribute('spellcheck', 'false');
        
        // Initialize with address autocomplete (any address worldwide)
        // Use LatLngBounds covering entire world to disable US location bias
        const worldBounds = new google.maps.LatLngBounds(
          new google.maps.LatLng(-90, -180), // Southwest corner
          new google.maps.LatLng(90, 180)    // Northeast corner
        );
        
        this.stopLocationAutocomplete = new google.maps.places.Autocomplete(stopLocationInput, {
          types: ['geocode'], // Include all address types worldwide (addresses, streets, cities, etc.)
          fields: ['formatted_address', 'address_components', 'geometry'],
          bounds: worldBounds // Set bounds to entire world to disable US location bias
        });

        if (!this.stopLocationAutocomplete) {
          console.error('Failed to create stop location autocomplete');
          return;
        }

        // Ensure dropdown appears with proper z-index for modal
        const ensureDropdownVisible = () => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            if (pacContainer.children.length > 0 || pacContainer.style.display !== 'none') {
              // Fix "Powered by Google" logo positioning to prevent overlap with suggestions
              this.fixPacContainerLogo(pacContainer);
              
              const rect = stopLocationInput.getBoundingClientRect();
              pacContainer.style.setProperty('z-index', '99999', 'important');
              pacContainer.style.setProperty('position', 'fixed', 'important');
              pacContainer.style.setProperty('top', rect.bottom + 'px', 'important');
              pacContainer.style.setProperty('left', rect.left + 'px', 'important');
              pacContainer.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
              pacContainer.style.setProperty('display', 'block', 'important');
              pacContainer.style.setProperty('visibility', 'visible', 'important');
              pacContainer.style.setProperty('opacity', '1', 'important');
              pacContainer.style.setProperty('pointer-events', 'auto', 'important');
            }
          });
        };
        
        // Add event listeners to ensure dropdown appears
        stopLocationInput.addEventListener('input', () => {
          setTimeout(ensureDropdownVisible, 50);
        });
        
        stopLocationInput.addEventListener('focus', () => {
          setTimeout(ensureDropdownVisible, 50);
          // If there's text, trigger autocomplete
          if (stopLocationInput.value.length > 0) {
            const event = new Event('input', { bubbles: true });
            stopLocationInput.dispatchEvent(event);
          }
        });
        
        stopLocationInput.addEventListener('keyup', (e: KeyboardEvent) => {
          if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
            setTimeout(ensureDropdownVisible, 50);
          }
        });

        // Handle place selection
        this.stopLocationAutocomplete.addListener('place_changed', () => {
          const place = this.stopLocationAutocomplete.getPlace();
          if (place && place.address_components) {
            // Format as "City, State"
            const city = place.address_components.find((c: any) => 
              c.types.includes('locality')
            )?.long_name || '';
            const state = place.address_components.find((c: any) => 
              c.types.includes('administrative_area_level_1')
            )?.short_name || '';
            
            if (city && state) {
              this.stopForm.location = city + ', ' + state;
            } else if (place.formatted_address) {
              this.stopForm.location = place.formatted_address;
            }
          }
        });

        console.log('Stop location autocomplete initialized successfully');
      } catch (error) {
        console.error('Error creating stop location autocomplete:', error);
      }
    };

    tryInit();
  }

  /**
   * Format an ISO date string to datetime-local value (YYYY-MM-DDTHH:mm) in local time.
   */
  private toDateTimeLocalValue(iso?: string | null): string {
    if (!iso || !iso.trim()) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  /** Minimum datetime for new stop (load pickup). */
  getMinStopDateTime(): string {
    return this.load?.pickupDateTime ? this.toDateTimeLocalValue(this.load.pickupDateTime) : '';
  }

  /** Maximum datetime for new stop (load delivery/dropoff). */
  getMaxStopDateTime(): string {
    return this.load?.deliveryDateTime ? this.toDateTimeLocalValue(this.load.deliveryDateTime) : '';
  }

  addStop(): void {
    if (!this.load) return;

    // Save the exact time selected from the datetime-local picker (no timezone conversion).
    let plannedDateTime = this.stopForm.plannedDateTime && this.stopForm.plannedDateTime.trim() !== ''
      ? this.stopForm.plannedDateTime.trim()
      : undefined;

    if (plannedDateTime && this.load.pickupDateTime && this.load.deliveryDateTime) {
      const stopDate = new Date(plannedDateTime);
      const pickupDate = new Date(this.load.pickupDateTime);
      const deliveryDate = new Date(this.load.deliveryDateTime);
      if (stopDate < pickupDate || stopDate > deliveryDate) {
        alert('Stop planned date/time must be between the pickup and delivery dates of the load.');
        return;
      }
    }

    if (plannedDateTime) {
      // datetime-local gives YYYY-MM-DDTHH:mm — ensure we have seconds for API (YYYY-MM-DDTHH:mm:00).
      if (!/T\d{2}:\d{2}:\d{2}/.test(plannedDateTime)) {
        plannedDateTime = plannedDateTime + ':00';
      }
    }

    const stopData: CreateLoadStopRequest = {
      sequenceNo: this.stopForm.sequenceNo,
      location: this.stopForm.location,
      stopType: this.stopForm.stopType,
      plannedDateTime: plannedDateTime,
      notes: this.stopForm.notes && this.stopForm.notes.trim() !== '' 
        ? this.stopForm.notes 
        : undefined
    };

    this.loadService.addLoadStop(this.load.loadId, stopData).subscribe({
      next: () => {
        this.showStopModal = false;
        this.loadLoadDetail(this.load!.loadId);
      },
      error: (err) => {
        console.error('Error adding stop:', err);
        alert(err.error?.message || 'Failed to add stop');
      }
    });
  }

  // Assignment Management
  openAssignmentModal(): void {
    this.isEditingAssignment = false;
    this.editingAssignmentId = null;
    this.assignmentForm = {
      driverId: undefined,
      equipmentId: undefined,
      eta: '',
      etd: '',
      notes: ''
    };
    this.assignmentValidationError = '';
    this.assignmentFieldErrors = {};
    this.equipment = [];
    this.showAssignmentModal = true;
  }

  closeAssignmentModal(): void {
    this.showAssignmentModal = false;
    this.isEditingAssignment = false;
    this.editingAssignmentId = null;
    this.assignmentValidationError = '';
    this.assignmentFieldErrors = {};
  }

  onDriverSelectionChange(): void {
    this.setEquipmentOptionsForDriver(this.assignmentForm.driverId, {
      preserveEquipmentSelection: false,
    });
  }

  getMissingAssignmentFields(): string[] {
    const missing: string[] = [];
    
    if (!this.assignmentForm.driverId) {
      missing.push('Owner Operator');
    }
    if (!this.assignmentForm.equipmentId) {
      missing.push('Equipment');
    }
    if (!this.assignmentForm.eta || this.assignmentForm.eta.trim() === '') {
      missing.push('ETA');
    }
    if (!this.assignmentForm.etd || this.assignmentForm.etd.trim() === '') {
      missing.push('ETD');
    }
    if (!this.assignmentForm.notes || this.assignmentForm.notes.trim() === '') {
      missing.push('Notes');
    }
    
    return missing;
  }

  focusFirstMissingAssignmentField(): void {
    // Map field names to their input element names
    const fieldNameMap: { [key: string]: string } = {
      'Owner Operator': 'driverId',
      'Equipment': 'equipmentId',
      'ETA': 'eta',
      'ETD': 'etd',
      'Notes': 'notes'
    };

    const missingFields = this.getMissingAssignmentFields();
    if (missingFields.length > 0) {
      const firstMissingField = missingFields[0];
      const inputName = fieldNameMap[firstMissingField];
      
      if (inputName) {
        setTimeout(() => {
          const inputElement = document.querySelector(`[name="${inputName}"]`) as HTMLElement;
          if (inputElement) {
            inputElement.focus();
            inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }

  clearAssignmentValidationError(): void {
    this.assignmentValidationError = '';
    this.assignmentFieldErrors = {};
  }

  clearFieldError(fieldName: string): void {
    if (this.assignmentFieldErrors[fieldName]) {
      delete this.assignmentFieldErrors[fieldName];
    }
  }

  isFieldValid(fieldName: string): boolean {
    return !this.assignmentFieldErrors[fieldName];
  }

  /**
   * Get minimum datetime for datetime-local input (current date/time)
   * Returns date in format: YYYY-MM-DDTHH:mm
   */
  getMinDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Get minimum datetime for ETA
   * Should be at least the ETD datetime, or current datetime if ETD is not set
   */
  getMinETA(): string {
    if (this.assignmentForm.etd && this.assignmentForm.etd.trim() !== '') {
      // ETA should be at least the ETD datetime
      return this.assignmentForm.etd;
    }
    // If no ETD, use current datetime
    return this.getMinDateTime();
  }

  /**
   * Handle ETD change - validate and update ETA minimum if needed
   */
  onETDChange(): void {
    this.clearFieldError('etd');
    
    // Validate ETD is not in the past
    if (this.assignmentForm.etd && this.assignmentForm.etd.trim() !== '') {
      const etdDate = new Date(this.assignmentForm.etd);
      const now = new Date();
      
      if (etdDate < now) {
        this.assignmentFieldErrors['etd'] = 'ETD cannot be in the past';
        return;
      }
      
      // If ETA is set and is before ETD, clear it or show error
      if (this.assignmentForm.eta && this.assignmentForm.eta.trim() !== '') {
        const etaDate = new Date(this.assignmentForm.eta);
        if (etaDate < etdDate) {
          this.assignmentFieldErrors['eta'] = 'ETA must be after ETD';
        } else {
          this.clearFieldError('eta');
        }
      }
    }
  }

  /**
   * Handle ETA change - validate it's after ETD
   */
  onETAChange(): void {
    this.clearFieldError('eta');
    
    // Validate ETA is not in the past
    if (this.assignmentForm.eta && this.assignmentForm.eta.trim() !== '') {
      const etaDate = new Date(this.assignmentForm.eta);
      const now = new Date();
      
      if (etaDate < now) {
        this.assignmentFieldErrors['eta'] = 'ETA cannot be in the past';
        return;
      }
      
      // If ETD is set, validate ETA is after ETD
      if (this.assignmentForm.etd && this.assignmentForm.etd.trim() !== '') {
        const etdDate = new Date(this.assignmentForm.etd);
        if (etaDate < etdDate) {
          this.assignmentFieldErrors['eta'] = 'ETA must be after ETD';
        }
      }
    }
  }

  assignLoad(): void {
    if (!this.load) return;

    // Clear previous validation errors
    this.assignmentValidationError = '';
    this.assignmentFieldErrors = {};
    
    // Validate each field individually
    const fieldErrors: { [key: string]: string } = {};
    const now = new Date();
    
    if (!this.assignmentForm.driverId) {
      fieldErrors['driverId'] = 'Owner Operator is required';
    }
    if (!this.assignmentForm.equipmentId) {
      fieldErrors['equipmentId'] = 'Equipment is required';
    }
    
    // Validate ETD
    if (!this.assignmentForm.etd || this.assignmentForm.etd.trim() === '') {
      fieldErrors['etd'] = 'ETD is required';
    } else {
      const etdDate = new Date(this.assignmentForm.etd);
      if (etdDate < now) {
        fieldErrors['etd'] = 'ETD cannot be in the past';
      }
    }
    
    // Validate ETA
    if (!this.assignmentForm.eta || this.assignmentForm.eta.trim() === '') {
      fieldErrors['eta'] = 'ETA is required';
    } else {
      const etaDate = new Date(this.assignmentForm.eta);
      if (etaDate < now) {
        fieldErrors['eta'] = 'ETA cannot be in the past';
      } else if (this.assignmentForm.etd && this.assignmentForm.etd.trim() !== '') {
        const etdDate = new Date(this.assignmentForm.etd);
        if (etaDate < etdDate) {
          fieldErrors['eta'] = 'ETA must be after ETD';
        }
      }
    }
    
    if (!this.assignmentForm.notes || this.assignmentForm.notes.trim() === '') {
      fieldErrors['notes'] = 'Notes is required';
    }
    
    this.assignmentFieldErrors = fieldErrors;
    
    if (Object.keys(fieldErrors).length > 0) {
      const missingFields = this.getMissingAssignmentFields();
      const fieldsList = missingFields.join(', ');
      this.assignmentValidationError = `Please fill in the following required fields: ${fieldsList}`;
      
      // Focus the first missing field
      this.focusFirstMissingAssignmentField();
      
      // Scroll to the error message
      setTimeout(() => {
        const errorElement = document.querySelector('.assignment-validation-error-message');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      return;
    }

    const assignment: AssignLoadRequest = {
      ...this.assignmentForm,
      eta: this.assignmentForm.eta || undefined,
      etd: this.assignmentForm.etd || undefined
    };

    if (this.isEditingAssignment && this.editingAssignmentId != null) {
      this.loadService.updateAssignment(this.load.loadId, this.editingAssignmentId, assignment).subscribe({
        next: () => {
          this.closeAssignmentModal();
          this.loadLoadDetail(this.load!.loadId);
        },
        error: () => alert('Failed to update assignment')
      });
    } else {
      this.loadService.assignLoad(this.load.loadId, assignment).subscribe({
        next: () => {
          this.closeAssignmentModal();
          this.loadLoadDetail(this.load!.loadId);
        },
        error: () => alert('Failed to assign load')
      });
    }
  }

  // Document Management
  openDocumentModal(): void {
    this.documentFile = null;
    this.documentType = 'BOL';
    this.showDocumentModal = true;
  }

  onFileSelected(event: any): void {
    this.documentFile = event.target.files[0];
  }

  uploadDocument(): void {
    if (!this.load || !this.documentFile) return;

    this.loadService.uploadDocument(this.load.loadId, this.documentFile, this.documentType).subscribe({
      next: () => {
        this.showDocumentModal = false;
        this.documentFile = null;
        this.loadLoadDetail(this.load!.loadId);
      },
      error: (err) => {
        console.error('Error uploading document:', err);
        const errorMessage = err.error?.message || err.message || 'Failed to upload document';
        alert(errorMessage);
      }
    });
  }

  deleteDocument(documentId: number): void {
    if (!this.load) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    this.loadService.deleteDocument(this.load.loadId, documentId).subscribe({
      next: () => {
        this.loadLoadDetail(this.load!.loadId);
      },
      error: () => alert('Failed to delete document')
    });
  }

  deleteStop(stop: LoadStop): void {
    if (!this.load) return;
    if (!confirm('Are you sure you want to delete this stop?')) return;

    this.loadService.deleteLoadStop(this.load.loadId, stop.stopId).subscribe({
      next: () => {
        this.loadLoadDetail(this.load!.loadId);
      },
      error: (err) => alert(err?.error?.message || 'Failed to delete stop')
    });
  }

  downloadDocument(doc: LoadDocument): void {
    if (!this.load) return;

    try {
      // Use backend endpoint with authentication
      const downloadUrl = this.loadService.getDocumentDownloadUrl(this.load.loadId, doc.loadDocumentId);
      
      // Get auth token
      const token = this.authService.getToken();
      
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.download = this.getDocumentFileName(doc);
      
      // Add authorization header via fetch if needed, or use the API service
      // Since we're using a link, we need to handle auth differently
      // Use fetch to download with auth headers, then create blob URL
      if (token) {
        fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to download document');
          }
          return response.blob();
        })
        .then(blob => {
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = this.getDocumentFileName(doc);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        })
        .catch(error => {
          console.error('Error downloading document:', error);
          alert('Failed to download document. Please try again.');
        });
      } else {
        // Fallback to direct link (will fail if auth required)
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document. Please try again.');
    }
  }

  viewDocument(doc: LoadDocument): void {
    if (!this.load) return;

    try {
      // Use backend endpoint with authentication
      const viewUrl = this.loadService.getDocumentViewUrl(this.load.loadId, doc.loadDocumentId);
      
      // Get auth token
      const token = this.authService.getToken();
      
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      // Create a form to submit with auth token, or use a simpler approach
      // Since we can't pass headers directly in window.open, we'll use fetch and create blob
      fetch(viewUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': '*/*'
        }
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            console.error('Error response:', text);
            throw new Error(`Failed to view document: ${response.status} ${response.statusText}`);
          });
        }
        return response.blob();
      })
      .then(blob => {
        // Create blob URL and open in new tab
        const blobUrl = window.URL.createObjectURL(blob);
        const newWindow = window.open(blobUrl, '_blank');
        
        if (!newWindow) {
          alert('Please allow pop-ups to view documents');
          window.URL.revokeObjectURL(blobUrl);
        } else {
          // Clean up blob URL after a delay (when window might be closed)
          // Note: We can't detect when the window closes, so we'll let the browser handle cleanup
          setTimeout(() => {
            // Only revoke if window was closed (we can't detect this perfectly, so we wait a bit)
            try {
              if (newWindow.closed) {
                window.URL.revokeObjectURL(blobUrl);
              }
            } catch (e) {
              // Cross-origin check might fail, ignore
            }
          }, 1000);
        }
      })
      .catch(error => {
        console.error('Error viewing document:', error);
        const errorMessage = error.message || 'Failed to open document. Please try again.';
        alert(errorMessage);
      });
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Failed to open document. Please try again.');
    }
  }

  normalizeFileUrl(filePath: string): string {
    if (!filePath) return '';
    
    // Remove any double protocols (e.g., https://https://)
    let url = filePath.replace(/^https?:\/\/https?:\/\//, 'https://');
    
    // Ensure it starts with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // Fix any double slashes after the protocol
    url = url.replace(/^(https?:\/\/)\/+/g, '$1');
    
    // Fix any missing colon in protocol (e.g., https//)
    url = url.replace(/^(https?)\/\//, '$1://');
    
    return url;
  }

  getDocumentFileName(doc: LoadDocument): string {
    if (!doc.filePath) return 'document';
    
    // Extract filename from path
    const fileName = doc.filePath.split('/').pop() || 'document';
    
    // Get file extension if it exists
    const lastDotIndex = fileName.lastIndexOf('.');
    const extension = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
    const baseName = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    
    // Create a readable filename with document type
    return `${doc.documentType}_${baseName}${extension}`;
  }

  canViewDocument(doc: LoadDocument): boolean {
    if (!doc.filePath) return false;
    
    // Check if file type is viewable in browser
    const filePath = doc.filePath.toLowerCase();
    const viewableExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif'];
    return viewableExtensions.some(ext => filePath.endsWith(ext));
  }

  // Accessorial Management
  openAccessorialModal(): void {
    this.accessorialForm = {
      accessorialTypeId: undefined,
      amount: 0,
      notes: ''
    };
    this.showAccessorialModal = true;
  }

  addAccessorial(): void {
    if (!this.load) return;

    this.loadService.addAccessorial(this.load.loadId, this.accessorialForm).subscribe({
      next: () => {
        this.showAccessorialModal = false;
        this.loadLoadDetail(this.load!.loadId);
      },
      error: () => alert('Failed to add accessorial')
    });
  }

  deleteAccessorial(accessorialId: number): void {
    if (!this.load) return;
    if (!confirm('Are you sure you want to delete this accessorial?')) return;

    this.loadService.deleteAccessorial(this.load.loadId, accessorialId).subscribe({
      next: () => {
        this.loadLoadDetail(this.load!.loadId);
      },
      error: () => alert('Failed to delete accessorial')
    });
  }

  loadGoogleMaps(): void {
    if (typeof google !== 'undefined' && google.maps) {
      this.mapsApiLoaded = true;
      setTimeout(() => {
        this.tryInitOverviewMap();
        if (this.activeTab === 'tracking' && this.trackingData) {
          this.tryInitTrackingMap(0);
        }
      }, 0);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(checkInterval);
          this.mapsApiLoaded = true;
          if (this.activeTab === 'route') {
            setTimeout(() => this.initRouteMap(), 300);
          }
          setTimeout(() => this.tryInitOverviewMap(), 0);
          if (this.activeTab === 'tracking' && this.trackingData) {
            setTimeout(() => this.tryInitTrackingMap(0), 0);
          }
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places,geometry&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.mapsApiLoaded = true;
      if (this.activeTab === 'route') {
        setTimeout(() => this.initRouteMap(), 300);
      }
      setTimeout(() => this.tryInitOverviewMap(), 0);
      if (this.activeTab === 'tracking' && this.trackingData) {
        setTimeout(() => this.tryInitTrackingMap(0), 0);
      }
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps API');
      this.mapsApiLoaded = false;
    };
    document.head.appendChild(script);
  }

  /** User switched to Overview — ensure the embedded map initializes and resizes. */
  onOverviewTabClick(): void {
    this.activeTab = 'overview';
    setTimeout(() => {
      this.tryInitOverviewMap();
      if (
        this.overviewRouteMap &&
        typeof google !== 'undefined' &&
        google.maps &&
        google.maps.event
      ) {
        google.maps.event.trigger(this.overviewRouteMap, 'resize');
      }
    }, 0);
  }

  onTrackingTabClick(): void {
    this.activeTab = 'tracking';
    this.loadLoadTracking();
  }

  loadLoadTracking(): void {
    if (!this.load) return;
    this.trackingLoading = true;
    this.trackingError = null;
    this.clearTrackingMapOverlays();
    this.loadService.getLoadTracking(this.load.loadId).subscribe({
      next: (data) => {
        this.trackingData = data;
        this.trackingLoading = false;
        this.cdr.markForCheck();
        setTimeout(() => this.tryInitTrackingMap(0), 0);
      },
      error: (err) => {
        this.trackingLoading = false;
        this.trackingData = null;
        this.trackingError =
          err?.error?.message || err?.message || 'Failed to load tracking data.';
        this.cdr.markForCheck();
      }
    });
  }

  /** GPS points in chronological order for path drawing. */
  getTrackingPathPoints(): LoadTrackingEvent[] {
    if (!this.trackingData?.history?.length) return [];
    const withCoords = this.trackingData.history.filter(
      (e) => e.latitude != null && e.longitude != null && !Number.isNaN(Number(e.latitude)) && !Number.isNaN(Number(e.longitude))
    );
    return [...withCoords].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
  }

  hasTrackingMapPoints(): boolean {
    return this.getTrackingPathPoints().length > 0;
  }

  clearTrackingMapOverlays(): void {
    if (this.trackingPolyline) {
      try {
        this.trackingPolyline.setMap(null);
      } catch {
        /* ignore */
      }
      this.trackingPolyline = null;
    }
    this.trackingMarkers.forEach((m) => {
      try {
        m.setMap(null);
      } catch {
        /* ignore */
      }
    });
    this.trackingMarkers = [];
  }

  private tryInitTrackingMap(attempt = 0): void {
    if (this.activeTab !== 'tracking' || !this.trackingData) {
      return;
    }
    if (!this.mapsApiLoaded || typeof google === 'undefined' || !google.maps) {
      if (attempt < 50) {
        setTimeout(() => this.tryInitTrackingMap(attempt + 1), 150);
      }
      return;
    }
    const el = document.getElementById('load-tracking-map');
    if (!el) {
      if (attempt < 40) {
        setTimeout(() => this.tryInitTrackingMap(attempt + 1), 80);
      }
      return;
    }
    if (!this.trackingMap) {
      try {
        this.trackingMap = new google.maps.Map(el, {
          zoom: 6,
          center: { lat: 39.8283, lng: -98.5795 },
          mapTypeId: 'roadmap'
        });
      } catch (e) {
        console.error('Tracking map init failed:', e);
        return;
      }
    } else if (google.maps.event) {
      google.maps.event.trigger(this.trackingMap, 'resize');
    }
    this.renderTrackingOnMap();
  }

  private renderTrackingOnMap(): void {
    if (!this.trackingMap || !this.trackingData) return;
    this.clearTrackingMapOverlays();
    const path = this.getTrackingPathPoints();
    if (path.length === 0) return;

    const coords = path.map((p) => ({
      lat: Number(p.latitude),
      lng: Number(p.longitude)
    }));

    if (coords.length === 1) {
      const m = new google.maps.Marker({
        position: coords[0],
        map: this.trackingMap,
        title: 'Recorded position'
      });
      this.trackingMarkers.push(m);
      this.trackingMap.setCenter(coords[0]);
      this.trackingMap.setZoom(11);
      return;
    }

    this.trackingPolyline = new google.maps.Polyline({
      path: coords,
      geodesic: true,
      strokeColor: '#2c7be5',
      strokeOpacity: 0.9,
      strokeWeight: 4
    });
    this.trackingPolyline.setMap(this.trackingMap);

    const startMarker = new google.maps.Marker({
      position: coords[0],
      map: this.trackingMap,
      title: 'Earliest recorded position',
      label: { text: 'A', color: 'white' }
    });
    this.trackingMarkers.push(startMarker);

    const last = coords[coords.length - 1];
    const endMarker = new google.maps.Marker({
      position: last,
      map: this.trackingMap,
      title: 'Latest position',
      label: { text: 'B', color: 'white' }
    });
    this.trackingMarkers.push(endMarker);

    const bounds = new google.maps.LatLngBounds();
    coords.forEach((c) => bounds.extend(c));
    this.trackingMap.fitBounds(bounds);
  }

  /**
   * Creates the Overview route preview map and requests driving directions.
   */
  tryInitOverviewMap(attempt = 0): void {
    if (!this.mapsApiLoaded || typeof google === 'undefined' || !google.maps || !this.load) {
      return;
    }
    if (this.activeTab !== 'overview') {
      return;
    }
    const el = document.getElementById('overview-route-map');
    if (!el) {
      if (attempt < 25) {
        setTimeout(() => this.tryInitOverviewMap(attempt + 1), 80);
      }
      return;
    }

    if (!this.overviewRouteMap) {
      try {
        this.overviewRouteMap = new google.maps.Map(el, {
          zoom: 6,
          center: { lat: 39.8283, lng: -98.5795 },
          mapTypeId: 'roadmap',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        });
        this.overviewDirectionsRenderer = new google.maps.DirectionsRenderer({
          map: this.overviewRouteMap,
          suppressMarkers: false
        });
      } catch (e) {
        console.error('Overview map init failed:', e);
        this.overviewMapError = 'Map could not be loaded.';
        this.cdr.markForCheck();
        return;
      }
    }

    this.displayOverviewRoute();
  }

  private displayOverviewRoute(): void {
    if (!this.load || !this.overviewRouteMap || !this.overviewDirectionsRenderer) {
      return;
    }
    if (!this.directionsService) {
      this.directionsService = new google.maps.DirectionsService();
    }

    const waypoints: { location: string; stopover: boolean }[] = [];
    this.getSortedStops().forEach((stop) => {
      waypoints.push({ location: stop.location, stopover: true });
    });

    const request: any = {
      origin: this.load.origin,
      destination: this.load.destination,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false
    };
    if (waypoints.length > 0) {
      request.waypoints = waypoints;
    }

    this.directionsService.route(request, (result: any, status: any) => {
      if (status === google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
        this.overviewDirectionsRenderer.setDirections(result);
        let totalMeters = 0;
        result.routes[0].legs.forEach((leg: any) => {
          totalMeters += leg.distance?.value ?? 0;
        });
        this.overviewRouteDistanceMeters = totalMeters > 0 ? totalMeters : null;
        this.overviewMapError = null;
        const bounds = result.routes[0].bounds;
        if (bounds) {
          this.overviewRouteMap.fitBounds(bounds);
        }
      } else {
        console.warn('Overview directions failed:', status);
        this.overviewRouteDistanceMeters = null;
        this.overviewMapError =
          status === 'ZERO_RESULTS'
            ? 'No driving route found for this origin and destination.'
            : 'Could not plot route. Check addresses.';
      }
      this.cdr.markForCheck();
    });
  }

  initRouteMap(): void {
    if (!this.mapsApiLoaded || typeof google === 'undefined' || !google.maps) {
      return;
    }

    const mapElement = document.getElementById('route-map');
    if (!mapElement) {
      return;
    }

    // Initialize map
    this.routeMap = new google.maps.Map(mapElement, {
      zoom: 7,
      center: { lat: 39.8283, lng: -98.5795 }, // Center of US
      mapTypeId: 'roadmap'
    });

    // Initialize directions service and renderer
    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.routeMap,
      suppressMarkers: false
    });

    // If load is already loaded, display route
    if (this.load) {
      this.displayRoute();
    }
  }

  displayRoute(): void {
    if (!this.load || !this.routeMap || !this.directionsService || !this.directionsRenderer) {
      return;
    }

    // Clear existing markers
    this.routeMarkers.forEach(marker => marker.setMap(null));
    this.routeMarkers = [];

    // Build waypoints from stops
    const waypoints: any[] = [];
    const sortedStops = this.getSortedStops();
    
    sortedStops.forEach(stop => {
      waypoints.push({
        location: stop.location,
        stopover: true
      });
    });

    // Create route request
    const request: any = {
      origin: this.load.origin,
      destination: this.load.destination,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false
    };

    if (waypoints.length > 0) {
      request.waypoints = waypoints;
    }

    // Calculate and display route
    this.directionsService.route(request, (result: any, status: any) => {
      if (status === google.maps.DirectionsStatus.OK) {
        this.directionsRenderer.setDirections(result);
        
        // Extract route data
        const route = result.routes[0];
        const leg = route.legs[0];
        
        // Calculate total distance and duration
        let totalDistance = 0;
        let totalDuration = 0;
        
        route.legs.forEach((leg: any) => {
          totalDistance += leg.distance.value; // in meters
          totalDuration += leg.duration.value; // in seconds
        });

        this.routeData = {
          distance: (totalDistance / 1609.34).toFixed(2), // Convert to miles
          duration: Math.round(totalDuration / 60), // Convert to minutes
          legs: route.legs.map((leg: any) => ({
            start: leg.start_address,
            end: leg.end_address,
            distance: (leg.distance.value / 1609.34).toFixed(2),
            duration: Math.round(leg.duration.value / 60)
          }))
        };

        this.routeOptimized = true;

        const routeBounds = result.routes[0].bounds;
        if (routeBounds) {
          this.routeMap.fitBounds(routeBounds);
        }
      } else {
        console.error('Directions request failed:', status);
        alert('Failed to calculate route. Please check that origin and destination are valid addresses.');
      }
    });
  }

  // Route Optimization
  optimizeRoute(): void {
    if (!this.load) return;

    // Switch to route tab first if not already there
    if (this.activeTab !== 'route') {
      this.activeTab = 'route';
    }

    // Wait for tab to be active and DOM to be ready
    setTimeout(() => {
      // If map is not initialized, initialize it first
      if (!this.routeMap) {
        if (this.mapsApiLoaded) {
          this.initRouteMap();
          setTimeout(() => this.displayRoute(), 500);
        } else {
          this.loadGoogleMaps();
          // Wait for maps to load, then initialize
          const checkMapsLoaded = setInterval(() => {
            if (this.mapsApiLoaded) {
              clearInterval(checkMapsLoaded);
              this.initRouteMap();
              setTimeout(() => this.displayRoute(), 500);
            }
          }, 100);
          // Timeout after 10 seconds
          setTimeout(() => clearInterval(checkMapsLoaded), 10000);
        }
      } else {
        this.displayRoute();
      }
    }, 300);
  }

  // Switch to route tab and initialize map if needed
  switchToRouteTab(): void {
    this.activeTab = 'route';
    setTimeout(() => {
      if (!this.routeMap && this.mapsApiLoaded) {
        this.initRouteMap();
        if (this.load) {
          setTimeout(() => this.displayRoute(), 300);
        }
      } else if (this.routeMap && this.load && !this.routeOptimized) {
        this.displayRoute();
      }
    }, 300);
  }

  // Status Update
  updateStatus(status: string): void {
    if (!this.load) return;
    const currentStatus = this.load.status;

    // If status did not change in UI, no-op.
    if (currentStatus === status) {
      return;
    }

    // Validate status transition
    if (!this.isValidStatusTransition(currentStatus, status)) {
      alert(`Invalid status transition. Cannot change from ${currentStatus} to ${status}.`);
      // Reset the dropdown to current status
      this.load.status = currentStatus;
      return;
    }

    // Validate delivery date for "Delivered" status
    if (status === 'Delivered' && !this.canMarkAsDelivered()) {
      alert('The load cannot be marked as delivered before the scheduled delivery date.');
      // Reset the dropdown to current status
      this.load.status = currentStatus;
      return;
    }

    // Load must be assigned to a driver before it can be marked as Delivered
    if (status === 'Delivered' && !this.isLoadAssignedToDriver()) {
      alert('The load must be assigned to a driver before it can be marked as Delivered.');
      this.load.status = currentStatus;
      return;
    }

    if (status === 'Completed' && !this.isLoadAssignedToDriver()) {
      alert('The load must be assigned to a driver before it can be marked as Completed.');
      this.load.status = currentStatus;
      return;
    }

    // Every status update requires explicit confirmation.
    const confirmMessage = `Confirm status update from "${this.getStatusDisplayName(currentStatus)}" to "${this.getStatusDisplayName(status)}"?`;
    if (!confirm(confirmMessage)) {
      this.load.status = currentStatus;
      return;
    }

    this.loadService.updateLoadStatus(this.load.loadId, status).subscribe({
      next: () => {
        this.loadLoadDetail(this.load!.loadId);
      },
      error: (err) => {
        this.load!.status = currentStatus;
        alert(err?.error?.message || err?.message || 'Failed to update status');
      }
    });
  }

  // Get available status transitions for current load status
  getAvailableStatusTransitions(): string[] {
    if (!this.load) return [];

    const currentStatus = this.load.status;
    const isDriver = this.authService.hasAnyRole(['Driver']);
    const isDispatcher = this.authService.hasAnyRole(['Dispatcher']);

    // Drivers can only progress a load one step at a time:
    // Assigned -> PickedUp -> InTransit -> Delivered
    if (isDriver) {
      const driverFlow: { [key: string]: string[] } = {
        'Assigned': ['PickedUp'],
        'Dispatched': ['PickedUp'],
        'PickedUp': ['InTransit'],
        'InTransit': ['Delivered'],
      };
      let transitions = driverFlow[currentStatus] || [];
      if (transitions.includes('Delivered')) {
        if (!this.canMarkAsDelivered() || !this.isLoadAssignedToDriver()) {
          transitions = transitions.filter((status) => status !== 'Delivered');
        }
      }
      return transitions;
    }

    // Dispatchers can only mark a delivered load as completed.
    if (isDispatcher) {
      if (currentStatus === 'Delivered') {
        return ['Completed'];
      }
      return [];
    }
    
    // Define valid status flow (Assigned is set automatically when driver is assigned, not manually)
    const statusFlow: { [key: string]: string[] } = {
      'Created': [], // Assigned is set automatically when a driver is assigned
      'Assigned': ['PickedUp', 'InTransit'],
      'Dispatched': ['PickedUp', 'InTransit'],
      'PickedUp': ['InTransit'],
      'InTransit': ['Delivered'],
      'Delivered': ['Completed', 'Settled'],
      'Completed': ['Settled'],
      'Settled': [], // Final status - no transitions allowed
      'Cancelled': [] // Final status - no transitions allowed
    };

    let allowedTransitions = statusFlow[currentStatus] || [];
    
    // Filter out "Delivered" if it's not yet time to deliver or load has no driver assignment
    if (allowedTransitions.includes('Delivered')) {
      if (!this.canMarkAsDelivered() || !this.isLoadAssignedToDriver()) {
        allowedTransitions = allowedTransitions.filter(status => status !== 'Delivered');
      }
    }
    
    // Always allow cancellation unless already cancelled or settled
    if (currentStatus !== 'Cancelled' && currentStatus !== 'Settled') {
      allowedTransitions.push('Cancelled');
    }

    return allowedTransitions;
  }

  // Get display name for status
  getStatusDisplayName(status: string): string {
    const statusDisplayMap: { [key: string]: string } = {
      'Created': 'Created',
      'Assigned': 'Assigned',
      'Dispatched': 'En route',
      'PickedUp': 'Picked up',
      'InTransit': 'In transit',
      'Delivered': 'Delivered',
      'Completed': 'Completed',
      'Settled': 'Settled',
      'Cancelled': 'Cancelled'
    };
    return statusDisplayMap[status] || status;
  }

  // Validate status transitions
  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    // If status is not changing, allow it
    if (currentStatus === newStatus) {
      return true;
    }

    // Cancelled can be reached from any status (except Settled)
    if (newStatus === 'Cancelled' && currentStatus !== 'Settled') {
      return true;
    }

    // Define valid status flow (Assigned is set automatically when driver is assigned)
    const statusFlow: { [key: string]: string[] } = {
      'Created': [], // Assigned is set automatically when a driver is assigned
      'Assigned': ['PickedUp', 'InTransit'],
      'Dispatched': ['PickedUp', 'InTransit'],
      'PickedUp': ['InTransit'],
      'InTransit': ['Delivered'],
      'Delivered': ['Completed', 'Settled'],
      'Completed': ['Settled'],
      'Settled': [], // Final status - no transitions allowed
      'Cancelled': [] // Final status - no transitions allowed
    };

    const allowedTransitions = statusFlow[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  // Check if load can be marked as delivered based on delivery date
  canMarkAsDelivered(): boolean {
    if (!this.load || !this.load.deliveryDateTime) {
      // If no delivery date is set, allow delivery (business decision)
      return true;
    }

    const now = new Date();
    const deliveryDate = new Date(this.load.deliveryDateTime);
    
    // Allow delivery on or after the scheduled delivery date
    return now >= deliveryDate;
  }

  /** True if the load has at least one assignment with a driver (required before marking as Delivered). */
  isLoadAssignedToDriver(): boolean {
    if (!this.load?.assignments?.length) return false;
    return this.load.assignments.some(
      (a) => a.driverId != null || (a.driverName != null && String(a.driverName).trim() !== '')
    );
  }

  // Utility methods
  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Created': 'bg-secondary',
      'Assigned': 'bg-info',
      'Dispatched': 'bg-info',
      'PickedUp': 'bg-primary',
      'InTransit': 'bg-primary',
      'Delivered': 'bg-success',
      'Completed': 'bg-success',
      'Settled': 'bg-dark',
      'Cancelled': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  formatDate(dateString?: string): string {
    return this.timeZoneService.formatDateTime(dateString);
  }

  /** Format load created date in EST (parses server UTC and displays Eastern). */
  formatCreatedDate(dateString?: string): string {
    return this.timeZoneService.formatDateTimeUTCToEastern(dateString);
  }

  /**
   * Format date/time as stored in the database without timezone conversion.
   * Used for stop planned date/time so we display exactly what is saved.
   */
  formatDateAsStored(dateString?: string | null): string {
    if (!dateString || !dateString.trim()) return '-';
    const s = dateString.trim();
    // Match ISO date and time: YYYY-MM-DD then T then HH:mm or HH:mm:ss[.fff...] with optional Z or offset
    const match = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(?:[+-]\d{2}:\d{2}|Z)?/i);
    if (match) return `${match[1]} ${match[2]}`;
    return this.timeZoneService.formatDateTime(dateString);
  }

  formatCurrency(amount?: number, currency: string = 'USD'): string {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  }

  getTotalAccessorials(): number {
    if (!this.load || !this.load.accessorials) return 0;
    return this.load.accessorials.reduce((sum, acc) => sum + acc.amount, 0);
  }

  /** Deadhead compensation included in revenue when amount is set (including 0). */
  getDeadheadRevenue(): number {
    if (!this.load || this.load.deadheadAmount == null) return 0;
    return this.load.deadheadAmount;
  }

  hasDeadheadRouteInfo(): boolean {
    return !!(
      this.load &&
      ((this.load.deadheadOrigin && this.load.deadheadOrigin.trim()) ||
        (this.load.deadheadDestination && this.load.deadheadDestination.trim()))
    );
  }

  calculateTotalWithAccessorials(): number {
    if (!this.load) return 0;
    const baseRate = this.load.totalRate || 0;
    return baseRate + this.getDeadheadRevenue() + this.getTotalAccessorials();
  }

  getSortedStops(): LoadStop[] {
    if (!this.load) return [];
    return [...this.load.stops].sort((a, b) => a.sequenceNo - b.sequenceNo);
  }

  goBack(): void {
    this.router.navigate(['/loads']);
  }

  canEditLoad(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Dispatcher']);
  }

  canEditLoadStatus(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Dispatcher', 'Driver']);
  }

  getAssignedDriver(): string | null {
    if (!this.load || !this.load.assignments || this.load.assignments.length === 0) {
      return null;
    }
    
    // Get the first active assignment's driver name
    const activeAssignment = this.load.assignments.find(a => a.status === 'Active' || a.status === 'Assigned');
    return activeAssignment?.driverName || this.load.assignments[0]?.driverName || null;
  }

  isStatusCompleted(status: string): boolean {
    if (!this.load) return false;
    
    const statusOrder = ['Created', 'Assigned', 'Dispatched', 'PickedUp', 'InTransit', 'Delivered', 'Completed', 'Settled'];
    const currentIndex = statusOrder.indexOf(this.load.status);
    const targetIndex = statusOrder.indexOf(status);
    if (currentIndex < 0 || targetIndex < 0) return false;

    return currentIndex > targetIndex;
  }

  getStatusDate(status: string): string {
    if (!this.load) return '';
    
    // This would typically come from activity logs or status history
    // For now, return creation date for 'Created' status
    if (status === 'Created') {
      return this.formatCreatedDate(this.load.createdAt);
    }
    
    return '-';
  }

  hasAssignment(): boolean {
    return !!(this.load && this.load.assignments && this.load.assignments.length > 0);
  }

  isEditingAssignment: boolean = false;
  editingAssignmentId: number | null = null;

  getRouteDistance(): string {
    if (!this.load) return '-';

    if (this.overviewRouteDistanceMeters != null && this.overviewRouteDistanceMeters > 0) {
      const km = this.overviewRouteDistanceMeters / 1000;
      const mi = this.overviewRouteDistanceMeters / 1609.344;
      return `${mi.toFixed(1)} mi · ${km.toFixed(1)} km`;
    }

    if (this.load.distanceKm != null && this.load.distanceKm > 0) {
      const km = this.load.distanceKm;
      const mi = km / 1.609344;
      return `${mi.toFixed(1)} mi · ${km.toFixed(1)} km`;
    }

    if (this.mapsApiLoaded && this.activeTab === 'overview' && !this.overviewMapError && !this.load.distanceKm) {
      return '…';
    }

    return '-';
  }

  getEstimatedTransitTime(): string {
    if (!this.load || !this.load.pickupDateTime || !this.load.deliveryDateTime) return '-';
    
    const pickup = new Date(this.load.pickupDateTime);
    const delivery = new Date(this.load.deliveryDateTime);
    const diffHours = Math.abs(delivery.getTime() - pickup.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return `${Math.round(diffHours)} hours`;
    } else {
      return `${Math.round(diffHours / 24)} days`;
    }
  }

  getMargin(): number {
    if (!this.load) return 0;
    
    const totalRate = this.load.totalRate || 0;
    const totalAccessorials = this.getTotalAccessorials();
    const totalRevenue = totalRate + this.getDeadheadRevenue() + totalAccessorials;
    
    // This would need actual cost data to calculate real margin
    // For now, return a placeholder
    return totalRevenue * 0.2; // Assuming 20% margin
  }

  activeNoteTab: 'internal' | 'driver' | 'customer' | 'public' = 'internal';

  showNoteModal = false;
  noteSaving = false;
  noteForm = { content: '', visibility: 'Internal' as string };
  noteFormError: string | null = null;

  readonly noteVisibilityOptions: { value: string; label: string; hint: string }[] = [
    { value: 'Internal', label: 'Internal', hint: 'Only you can see this note' },
    { value: 'Driver', label: 'Driver', hint: 'Visible to assigned drivers on this load' },
    { value: 'Customer', label: 'Broker', hint: 'Visible to the broker (when linked to this load)' },
    { value: 'Public', label: 'Public', hint: 'Visible to everyone who can access this load' },
  ];

  canAddLoadNotes(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Dispatcher', 'FleetManager']);
  }

  getNotesForTab(): LoadNote[] {
    const notes = this.load?.loadNotes ?? [];
    const tab = this.activeNoteTab.toLowerCase();
    return notes.filter((n) => (n.visibility || '').toLowerCase() === tab);
  }

  getActiveNoteTabLabel(): string {
    const labels: Record<string, string> = {
      internal: 'internal',
      driver: 'driver',
      customer: 'broker',
      public: 'public',
    };
    return labels[this.activeNoteTab] ?? this.activeNoteTab;
  }

  openNoteModal(): void {
    if (!this.canAddLoadNotes() || !this.load) {
      return;
    }
    this.noteForm = { content: '', visibility: 'Internal' };
    this.noteFormError = null;
    this.showNoteModal = true;
  }

  closeNoteModal(): void {
    this.showNoteModal = false;
    this.noteSaving = false;
    this.noteFormError = null;
  }

  submitLoadNote(): void {
    if (!this.load || this.noteSaving) {
      return;
    }
    const content = (this.noteForm.content || '').trim();
    if (!content) {
      this.noteFormError = 'Please enter note text.';
      return;
    }
    this.noteFormError = null;
    this.noteSaving = true;
    this.loadService.addLoadNote(this.load.loadId, { content, visibility: this.noteForm.visibility }).subscribe({
      next: () => {
        this.closeNoteModal();
        this.loadLoadDetail(this.load!.loadId);
      },
      error: (err) => {
        this.noteSaving = false;
        const msg = err?.error?.message || err?.error?.errors?.[0] || 'Failed to save note.';
        this.noteFormError = typeof msg === 'string' ? msg : 'Failed to save note.';
      },
    });
  }

  displayNoteAuthor(note: LoadNote): string {
    return note.authorName?.trim() || 'User';
  }

  openEditAssignmentModal(assignment: any): void {
    this.isEditingAssignment = true;
    this.editingAssignmentId = assignment?.assignmentId ?? null;
    // Pre-populate form with assignment data
    if (assignment) {
      this.assignmentForm = {
        driverId: assignment.driverId,
        equipmentId: assignment.equipmentId,
        eta: assignment.eta,
        etd: assignment.etd,
        notes: assignment.notes
      };
    }
    this.setEquipmentOptionsForDriver(this.assignmentForm.driverId, {
      preserveEquipmentSelection: true,
    });
    this.showAssignmentModal = true;
  }

  confirmDeleteAssignment(assignmentId: number): void {
    this.assignmentToDelete = assignmentId;
    this.showDeleteAssignmentConfirm = true;
  }

  cancelDeleteAssignment(): void {
    this.assignmentToDelete = null;
    this.showDeleteAssignmentConfirm = false;
  }

  deleteAssignment(): void {
    if (!this.load || !this.assignmentToDelete) return;

    this.loadService.deleteAssignment(this.load.loadId, this.assignmentToDelete).subscribe({
      next: () => {
        this.showDeleteAssignmentConfirm = false;
        this.assignmentToDelete = null;
        this.loadLoadDetail(this.load!.loadId);
      },
      error: () => {
        alert('Failed to delete assignment');
        this.showDeleteAssignmentConfirm = false;
      }
    });
  }

  // Additional properties for assignment deletion
  assignmentToDelete: number | null = null;
  showDeleteAssignmentConfirm = false;

  // Activity log properties and methods
  activityLogs: any[] = [];
  activityLogsLoading = false;
  activityLogPage = 1;
  activityLogTotalPages = 1;
  activityLogTotalCount = 0;

  loadActivityLogs(page: number = 1): void {
    if (!this.load) return;
    
    this.activityLogsLoading = true;
    this.activityLogPage = page;
    
    this.loadService.getLoadActivityLog(this.load.loadId, page, 10).subscribe({
      next: (data) => {
        this.activityLogs = data.items;
        this.activityLogTotalPages = data.totalPages;
        this.activityLogTotalCount = data.totalCount;
        this.activityLogsLoading = false;
      },
      error: () => {
        this.activityLogsLoading = false;
        this.activityLogs = [];
      }
    });
  }

  formatActivityAction(action: string): string {
    const u = (action || '').toUpperCase();
    const map: Record<string, string> = {
      CREATE: 'Created',
      CREATED: 'Created',
      UPDATE: 'Updated',
      UPDATED: 'Updated',
      DELETE: 'Deleted',
      DELETED: 'Deleted',
      ASSIGNED: 'Assigned',
    };
    return map[u] || action;
  }

  getActivityColor(action: string): string {
    const u = (action || '').toUpperCase();
    if (u === 'CREATE' || u === 'CREATED') return 'activity-create';
    if (u === 'UPDATE' || u === 'UPDATED') return 'activity-update';
    if (u === 'DELETE' || u === 'DELETED') return 'activity-delete';
    if (u === 'ASSIGNED') return 'activity-assigned';
    return 'activity-default';
  }

  getActivityIcon(action: string, entityName?: string): string {
    const u = (action || '').toUpperCase();
    const entity = entityName || '';
    if (entity === 'LoadStop') return 'fas fa-map-marker-alt';
    if (entity === 'LoadAssignment') return 'fas fa-user-check';
    if (entity === 'LoadDocument') return 'fas fa-file-alt';
    if (entity === 'LoadAccessorial') return 'fas fa-receipt';
    if (entity === 'LoadNote') return 'fas fa-sticky-note';
    const iconMap: Record<string, string> = {
      CREATE: 'fas fa-plus-circle',
      CREATED: 'fas fa-plus-circle',
      UPDATE: 'fas fa-edit',
      UPDATED: 'fas fa-edit',
      DELETE: 'fas fa-trash',
      DELETED: 'fas fa-trash',
      ASSIGNED: 'fas fa-user-check',
    };
    return iconMap[u] || 'fas fa-info-circle';
  }

  getActivityLabel(entityName?: string): string {
    const labelMap: { [key: string]: string } = {
      Load: 'Load',
      LoadStop: 'Stop',
      LoadAssignment: 'Assignment',
      LoadDocument: 'Document',
      LoadAccessorial: 'Accessorial',
      LoadNote: 'Note',
    };
    return labelMap[entityName || ''] || entityName || 'Item';
  }

  parseActivityDetails(details?: string): { key: string; value: string }[] {
    if (!details) return [];

    const formatValue = (val: unknown): string => {
      if (val === null || val === undefined) return '—';
      if (typeof val === 'object') {
        const o = val as Record<string, unknown>;
        if ('Old' in o || 'New' in o) {
          const oldV = o['Old'];
          const newV = o['New'];
          return `${formatValue(oldV)} → ${formatValue(newV)}`;
        }
        return JSON.stringify(val);
      }
      return String(val);
    };

    try {
      const parsed = JSON.parse(details);
      if (Array.isArray(parsed)) {
        return parsed.map((item, i) =>
          typeof item === 'object' && item !== null
            ? { key: String(i), value: JSON.stringify(item) }
            : { key: String(i), value: String(item) }
        );
      }
      if (typeof parsed === 'object' && parsed !== null) {
        return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
          key,
          value: formatValue(value),
        }));
      }
    } catch {
      return [{ key: 'Details', value: details }];
    }

    return [];
  }
}


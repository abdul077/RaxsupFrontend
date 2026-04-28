import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadService } from '../../../core/services/load.service';
import { ApiService } from '../../../core/services/api';
import { CustomerService } from '../../../core/services/customer.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { CreateLoadRequest, CreateLoadStopRequest } from '../../../core/models/load.model';
import { Customer } from '../../../core/models/customer.model';
import { environment } from '../../../../environments/environment';

// Google Maps type declarations
declare var google: any;

@Component({
  selector: 'app-load-create',
  imports: [CommonModule, FormsModule],
  templateUrl: './load-create.html',
  styleUrl: './load-create.scss',
})
export class LoadCreateComponent implements OnInit, AfterViewInit, OnDestroy {
  customers: Customer[] = [];
  loading = false;
  submitting = false;
  validationError: string = '';
  
  // Google Places Autocomplete
  originAutocomplete: any = null;
  destinationAutocomplete: any = null;
  stopLocationAutocomplete: any = null;
  mapsApiLoaded = false;
  stopLocationObserver: MutationObserver | null = null;
  stopLocationMonitor: any = null;
  originDestinationMonitor: any = null;
  originDestinationObserver: MutationObserver | null = null;
  /** Keeps focus on the address input when clicking a suggestion so Google can fire place_changed. */
  private pacItemMousedownListener: ((e: Event) => void) | null = null;
  
  // Main form data
  formData: CreateLoadRequest = {
    loadNumber: '',
    customerId: undefined,
    origin: '',
    destination: '',
    pickupDateTime: '',
    deliveryDateTime: '',
    totalRate: undefined,
    currency: 'USD',
    loadType: undefined,
    notes: '',
    deadheadOrigin: '',
    deadheadDestination: '',
    deadheadAmount: undefined,
    loadWeight: undefined as number | undefined,
    materialName: ''
  };

  // Stops management
  stops: CreateLoadStopRequest[] = [];
  showStopModal = false;
  stopForm: CreateLoadStopRequest = {
    sequenceNo: 1,
    location: '',
    stopType: 'Pickup',
    plannedDateTime: '',
    notes: ''
  };
  editingStopIndex: number | null = null;
  totalDistanceKm: number | null = null;
  calculatingDistance = false;
  distanceError = '';
  private routeRecalcTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private loadService: LoadService,
    private apiService: ApiService,
    private customerService: CustomerService,
    private timeZoneService: TimeZoneService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  /**
   * Google Places fires input blur before the suggestion click completes; preventDefault on
   * pac-item mousedown is the standard fix so the selected place is applied to the input/model.
   */
  private attachPacItemMousedownFix(): void {
    if (this.pacItemMousedownListener) {
      document.removeEventListener('mousedown', this.pacItemMousedownListener, true);
    }
    this.pacItemMousedownListener = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.pac-item')) {
        e.preventDefault();
      }
    };
    document.addEventListener('mousedown', this.pacItemMousedownListener, true);
  }

  private resolvePlaceAddress(place: { formatted_address?: string; name?: string; vicinity?: string } | null): string | null {
    if (!place) return null;
    const formatted = place.formatted_address?.trim();
    if (formatted) return formatted;
    const name = place.name?.trim();
    if (name && place.vicinity) return `${name}, ${place.vicinity}`;
    if (name) return name;
    return null;
  }

  /**
   * Helper method to manage "Powered by Google" logo
   */
  private fixPacContainerLogo(pacContainer: HTMLElement): void {
    if (!pacContainer) return;
    
    const manageLogos = () => {
      // First, ensure pac-items are visible and have proper z-index
      const items = pacContainer.querySelectorAll('.pac-item');
      items.forEach((item) => {
        const itemElement = item as HTMLElement;
        // Don't override if already set, just ensure visibility
        if (itemElement.style.display === 'none') {
          itemElement.style.removeProperty('display');
        }
        itemElement.style.setProperty('z-index', '10', 'important');
        itemElement.style.setProperty('position', 'relative', 'important');
      });
      
      // Find all logo-related elements
      const logoSelectors = [
        '.pac-logo',
        '[class*="pac-logo"]',
        '[id*="pac-logo"]'
      ];
      
      const allLogos: HTMLElement[] = [];
      
      logoSelectors.forEach(selector => {
        try {
          const logos = Array.from(pacContainer.querySelectorAll(selector)) as HTMLElement[];
          logos.forEach((logo) => {
            // Skip pac-icons as they're needed
            if (!logo.classList.contains('pac-icon')) {
              allLogos.push(logo);
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
      
      // Also search for elements containing "powered by" or "Google" text
      const allElements = Array.from(pacContainer.querySelectorAll('*')) as HTMLElement[];
      allElements.forEach((element) => {
        // Skip pac-items, pac-icons, pac-matched, and pac-item-query
        if (element.classList.contains('pac-item') || 
            element.classList.contains('pac-icon') || 
            element.classList.contains('pac-matched') ||
            element.classList.contains('pac-item-query')) {
          return;
        }
        
        const text = element.textContent || element.innerText || '';
        const lowerText = text.toLowerCase().trim();
        
        // Check if element contains logo-related text
        const hasLogoText = (lowerText.includes('powered by') || 
                           lowerText.includes('poweredby')) &&
                           (lowerText.includes('google') && 
                            !lowerText.includes('address') && 
                            !lowerText.includes('google maps') &&
                            text.trim().length < 150);
        
        if (hasLogoText && !allLogos.includes(element)) {
          allLogos.push(element);
        }
      });
      
      // Check if suggestions are loaded (pac-items exist)
      const hasSuggestions = items.length > 0;
      
      // If no suggestions, hide logo (Google sometimes adds logo even without suggestions)
      if (!hasSuggestions) {
        allLogos.forEach((logo) => {
          logo.style.setProperty('display', 'none', 'important');
          logo.style.setProperty('visibility', 'hidden', 'important');
          logo.style.setProperty('opacity', '0', 'important');
        });
        return;
      }
      
      // If suggestions are loaded, show logos (only bottom one if multiple)
      if (hasSuggestions) {
        // Always check position of logos to determine top vs bottom
        const logosWithPosition = allLogos.map(logo => {
          const rect = logo.getBoundingClientRect();
          const containerRect = pacContainer.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;
          const relativeBottom = containerRect.bottom - rect.bottom;
          const style = window.getComputedStyle(logo);
          // Check if positioned at top (small top value or positioned absolutely at top)
          const isAtTop = relativeTop < 100 || (style.position === 'absolute' && style.top !== 'auto' && parseFloat(style.top) < 50);
          return { logo, top: relativeTop, bottom: relativeBottom, isAtTop };
        });
        
        logosWithPosition.sort((a, b) => a.top - b.top);
        
        // Hide all top logos, show only bottom logo
        logosWithPosition.forEach((item, index) => {
          const isBottomLogo = index === logosWithPosition.length - 1 && !item.isAtTop;
          const isTopLogo = item.isAtTop || (index < logosWithPosition.length - 1);
          
          if (isTopLogo || !isBottomLogo) {
            // This is a top logo or not the bottom one - hide it
            item.logo.style.setProperty('display', 'none', 'important');
            item.logo.style.setProperty('visibility', 'hidden', 'important');
            item.logo.style.setProperty('opacity', '0', 'important');
            item.logo.style.setProperty('z-index', '0', 'important');
          } else {
            // This is the bottom logo - show it
            item.logo.style.removeProperty('display');
            item.logo.style.setProperty('visibility', 'visible', 'important');
            item.logo.style.setProperty('opacity', '1', 'important');
            item.logo.style.setProperty('z-index', '1', 'important');
          }
        });
      } else {
        // No suggestions yet - hide logos
        allLogos.forEach((logo) => {
          logo.style.setProperty('display', 'none', 'important');
          logo.style.setProperty('visibility', 'hidden', 'important');
          logo.style.setProperty('opacity', '0', 'important');
        });
      }
      
      // Also handle elements positioned at top (right corner) - hide them behind suggestions
      allElements.forEach((element) => {
        if (element.classList.contains('pac-item') || 
            element.classList.contains('pac-icon') || 
            element.classList.contains('pac-matched') ||
            element.classList.contains('pac-item-query')) {
          return;
        }
        
        const style = window.getComputedStyle(element);
        const isPositionedAbsolute = style.position === 'absolute' || style.position === 'fixed';
        const hasTopRight = (style.top !== 'auto' && parseFloat(style.top) < 50) || 
                           (style.right !== 'auto' && style.bottom === 'auto');
        
        if (isPositionedAbsolute && hasTopRight) {
          const elementText = element.textContent || element.innerText || '';
          if (elementText.toLowerCase().includes('powered') || 
              elementText.toLowerCase().includes('google')) {
            // This is likely a top logo - hide it
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('opacity', '0', 'important');
          }
        }
      });
    };
    
    // Execute immediately multiple times with different timing
    manageLogos();
    requestAnimationFrame(() => {
      manageLogos();
      requestAnimationFrame(() => {
        manageLogos();
      });
    });
    
    // Also execute with delays to catch dynamically added logos
    setTimeout(manageLogos, 0);
    setTimeout(manageLogos, 10);
    setTimeout(manageLogos, 50);
    setTimeout(manageLogos, 100);
    setTimeout(manageLogos, 200);
    setTimeout(manageLogos, 500);
  }
  
  ngOnInit(): void {
    this.loadCustomers();
    this.generateLoadNumber();
    this.loadGoogleMaps();
  }

  ngAfterViewInit(): void {
    // Initialize autocomplete after view is ready
    // Use multiple attempts to ensure DOM is fully rendered
    let attempts = 0;
    const maxAttempts = 20;
    
    const tryInit = () => {
      attempts++;
      const originInput = document.getElementById('origin-input');
      const destinationInput = document.getElementById('destination-input');
      
      if (originInput && destinationInput && this.mapsApiLoaded) {
        this.initAutocomplete();
      } else if (attempts < maxAttempts) {
        setTimeout(tryInit, 200);
      } else {
        console.warn('Could not initialize autocomplete after multiple attempts');
      }
    };
    
    // Start trying after a short delay
    setTimeout(tryInit, 500);
  }

  ngOnDestroy(): void {
    if (this.routeRecalcTimer) {
      clearTimeout(this.routeRecalcTimer);
      this.routeRecalcTimer = null;
    }
    if (this.pacItemMousedownListener) {
      document.removeEventListener('mousedown', this.pacItemMousedownListener, true);
      this.pacItemMousedownListener = null;
    }
    // Clean up autocomplete instances
    if (this.originAutocomplete) {
      google.maps.event.clearInstanceListeners(this.originAutocomplete);
    }
    if (this.destinationAutocomplete) {
      google.maps.event.clearInstanceListeners(this.destinationAutocomplete);
    }
    if (this.stopLocationAutocomplete) {
      google.maps.event.clearInstanceListeners(this.stopLocationAutocomplete);
    }
    
    // Clean up monitoring intervals
    if (this.originDestinationMonitor) {
      clearInterval(this.originDestinationMonitor);
      this.originDestinationMonitor = null;
    }
    
    // Clean up aggressive logo removal interval
    if ((this as any)._aggressiveLogoRemoval) {
      clearInterval((this as any)._aggressiveLogoRemoval);
      (this as any)._aggressiveLogoRemoval = null;
    }
    
    // Clean up observers
    if (this.originDestinationObserver) {
      this.originDestinationObserver.disconnect();
      this.originDestinationObserver = null;
    }
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
   * Get minimum datetime for delivery datetime
   * Should be at least the pickup datetime, or current datetime if pickup is not set
   */
  getMinDeliveryDateTime(): string {
    if (this.formData.pickupDateTime) {
      // Delivery should be at least the pickup datetime
      return this.formData.pickupDateTime;
    }
    // If no pickup datetime, use current datetime
    return this.getMinDateTime();
  }

  /**
   * Get minimum datetime for stop planned date/time
   * Should be at least the pickup datetime
   */
  getMinStopDateTime(): string {
    if (this.formData.pickupDateTime) {
      return this.formData.pickupDateTime;
    }
    return this.getMinDateTime();
  }

  /**
   * Get maximum datetime for stop planned date/time
   * Should be at most the delivery datetime
   */
  getMaxStopDateTime(): string {
    if (this.formData.deliveryDateTime) {
      return this.formData.deliveryDateTime;
    }
    return '';
  }

  /**
   * Handle pickup datetime change - update delivery datetime minimum
   */
  onPickupDateTimeChange(): void {
    // If delivery datetime is before pickup datetime, clear it
    if (this.formData.deliveryDateTime && this.formData.pickupDateTime) {
      const pickupDate = new Date(this.formData.pickupDateTime);
      const deliveryDate = new Date(this.formData.deliveryDateTime);
      if (deliveryDate < pickupDate) {
        this.formData.deliveryDateTime = '';
      }
    }

    // Clear any stop dates that are now outside the valid range
    this.clearInvalidStopDates();
  }

  /**
   * Clear stop dates that fall outside the pickup-delivery date range
   * Called when pickup or delivery dates are changed
   */
  clearInvalidStopDates(): void {
    const pickupDate = this.formData.pickupDateTime ? new Date(this.formData.pickupDateTime) : null;
    const deliveryDate = this.formData.deliveryDateTime ? new Date(this.formData.deliveryDateTime) : null;

    for (const stop of this.stops) {
      if (stop.plannedDateTime) {
        const stopDate = new Date(stop.plannedDateTime);
        if ((pickupDate && stopDate < pickupDate) || (deliveryDate && stopDate > deliveryDate)) {
          stop.plannedDateTime = '';
        }
      }
    }
  }

  /**
   * Handle total rate change - prevent negative values
   */
  onTotalRateChange(): void {
    if (this.formData.totalRate !== undefined && this.formData.totalRate !== null) {
      if (this.formData.totalRate < 0) {
        this.formData.totalRate = 0;
      }
    }
  }

  /** Clamp deadhead amount to non-negative (optional field). */
  onDeadheadAmountChange(): void {
    if (this.formData.deadheadAmount !== undefined && this.formData.deadheadAmount !== null) {
      if (this.formData.deadheadAmount < 0) {
        this.formData.deadheadAmount = 0;
      }
    }
  }

  loadGoogleMaps(): void {
    if (typeof google !== 'undefined' && google.maps && google.maps.places) {
      this.mapsApiLoaded = true;
      setTimeout(() => this.initAutocomplete(), 200);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // Script is already loading, wait for it
      const checkInterval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
          clearInterval(checkInterval);
          this.mapsApiLoaded = true;
          setTimeout(() => this.initAutocomplete(), 200);
        }
      }, 100);
      // Stop checking after 10 seconds
      setTimeout(() => clearInterval(checkInterval), 10000);
      return;
    }

    const script = document.createElement('script');
    // Use Places API - requires loading=async
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // Wait a bit for Places API to be fully initialized
      setTimeout(() => {
        this.mapsApiLoaded = true;
        // Test if Places API is available
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
          console.log('Google Maps Places API loaded successfully');
        } else {
          console.warn('Google Maps Places API not immediately available, will retry...');
          // Retry check after a delay
          setTimeout(() => {
            if (typeof google !== 'undefined' && google.maps && google.maps.places) {
              console.log('Google Maps Places API now available');
            } else {
              console.error('Google Maps Places API not available - check if Places API is enabled in Google Cloud Console');
            }
          }, 1000);
        }
        // Initialize autocomplete
        this.initAutocomplete();
      }, 500);
    };
    script.onerror = () => {
      console.error('Failed to load Google Maps API - check API key and network connection');
      this.mapsApiLoaded = false;
    };
    document.head.appendChild(script);
  }

  initAutocomplete(): void {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('Google Maps API not loaded yet');
      // Retry after a short delay
      setTimeout(() => this.initAutocomplete(), 500);
      return;
    }

    // Initialize Origin autocomplete
    const originInput = document.getElementById('origin-input');
    if (!originInput) {
      console.warn('Origin input element not found');
      // Retry after a short delay
      setTimeout(() => this.initAutocomplete(), 500);
      return;
    }

    // Get destination input reference (will be initialized later)
    let destinationInput: HTMLElement | null = null;

    // Define helper functions at the top level so they're accessible throughout
    const findOriginPacContainer = (): HTMLElement | null => {
      const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
      
      // First, try to find by aria-owns association (most reliable)
      for (const pacContainer of pacContainers) {
        const containerId = pacContainer.id;
        const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
        if (associatedInput && associatedInput === originInput) {
          return pacContainer;
        }
      }
      
      // If origin input is focused, try to find container by checking all containers
      // Return the container even if it's hidden (we'll show it)
      if (document.activeElement === originInput && pacContainers.length > 0) {
        // Check if there's a container that was previously associated with origin
        // by checking if it's positioned near the origin input
        const originRect = (originInput as HTMLInputElement).getBoundingClientRect();
        for (const pacContainer of pacContainers) {
          const containerRect = pacContainer.getBoundingClientRect();
          // Check if container is positioned near origin (even if hidden)
          const isNearOrigin = Math.abs(containerRect.left - originRect.left) < 200;
          if (isNearOrigin) {
            return pacContainer;
          }
        }
        
        // If no container found by position, return the last one (most recently created)
        return pacContainers[pacContainers.length - 1];
      }
      
      // If only one container exists and origin input is focused, assume it's for origin
      if (pacContainers.length === 1 && document.activeElement === originInput) {
        return pacContainers[0];
      }
      
      // Last resort: if origin is focused, return any container (even if hidden)
      if (document.activeElement === originInput && pacContainers.length > 0) {
        return pacContainers[0];
      }
      
      return null;
    };

    const findDestinationPacContainer = (): HTMLElement | null => {
      const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
      for (const pacContainer of pacContainers) {
        const containerId = pacContainer.id;
        const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
        if (associatedInput && associatedInput === destinationInput) {
          return pacContainer;
        }
      }
      // Fallback: if destination input is focused and active, try to find the most recently created container
      if (document.activeElement === destinationInput && pacContainers.length > 0) {
        // Return the last container (most recently created) if destination is focused
        return pacContainers[pacContainers.length - 1];
      }
      // Fallback: if only one container exists and destination input is focused, assume it's for destination
      if (pacContainers.length === 1 && document.activeElement === destinationInput) {
        return pacContainers[0];
      }
      return null;
    };

    const hideDestinationDropdown = () => {
      if (destinationInput) {
        const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
        pacContainers.forEach((pacContainer) => {
          const containerId = pacContainer.id;
          const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
          if (associatedInput && associatedInput === destinationInput) {
            // Use visibility and opacity instead of display to allow re-showing
            pacContainer.style.setProperty('visibility', 'hidden', 'important');
            pacContainer.style.setProperty('opacity', '0', 'important');
            pacContainer.style.setProperty('pointer-events', 'none', 'important');
          }
        });
      }
    };

    const hideOriginDropdown = () => {
      if (originInput) {
        const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
        pacContainers.forEach((pacContainer) => {
          const containerId = pacContainer.id;
          const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
          if (associatedInput && associatedInput === originInput) {
            // Use visibility and opacity instead of display to allow re-showing
            pacContainer.style.setProperty('visibility', 'hidden', 'important');
            pacContainer.style.setProperty('opacity', '0', 'important');
            pacContainer.style.setProperty('pointer-events', 'none', 'important');
          }
        });
      }
    };

    // Clear existing autocomplete if any
    if (this.originAutocomplete) {
      google.maps.event.clearInstanceListeners(this.originAutocomplete);
    }

    try {
      // Ensure input is ready
      (originInput as HTMLInputElement).setAttribute('autocomplete', 'off');
      (originInput as HTMLInputElement).setAttribute('autocorrect', 'off');
      (originInput as HTMLInputElement).setAttribute('autocapitalize', 'off');
      (originInput as HTMLInputElement).setAttribute('spellcheck', 'false');
      
      // Initialize Origin autocomplete with worldwide location bias
      // Use LatLngBounds covering entire world to disable US location bias
      const worldBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(-90, -180), // Southwest corner
        new google.maps.LatLng(90, 180)    // Northeast corner
      );
      
      this.originAutocomplete = new google.maps.places.Autocomplete(originInput as HTMLInputElement, {
        types: ['geocode'], // Include all address types worldwide (addresses, streets, cities, etc.)
        fields: ['formatted_address', 'address_components', 'geometry'],
        bounds: worldBounds // Set bounds to entire world to disable US location bias
      });

      if (!this.originAutocomplete) {
        console.error('Failed to create origin autocomplete');
        return;
      }

      // Ensure dropdown appears for origin input
      const ensureOriginDropdownVisible = () => {
        hideDestinationDropdown();
        
        const originPacContainer = findOriginPacContainer();
        if (originPacContainer) {
          // Fix "Powered by Google" logo positioning to prevent overlap with suggestions
          this.fixPacContainerLogo(originPacContainer);
          
          const rect = (originInput as HTMLInputElement).getBoundingClientRect();
          
          // Check if container has suggestions (pac-items)
          const hasSuggestions = originPacContainer.querySelectorAll('.pac-item').length > 0;
          
          // Always update position, but only set visibility if there are suggestions
          originPacContainer.style.setProperty('z-index', '99999', 'important');
          originPacContainer.style.setProperty('position', 'fixed', 'important');
          originPacContainer.style.setProperty('top', rect.bottom + 'px', 'important');
          originPacContainer.style.setProperty('left', rect.left + 'px', 'important');
          originPacContainer.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
          
          if (hasSuggestions) {
            originPacContainer.style.setProperty('display', 'block', 'important');
            originPacContainer.style.setProperty('visibility', 'visible', 'important');
            originPacContainer.style.setProperty('opacity', '1', 'important');
            originPacContainer.style.setProperty('pointer-events', 'auto', 'important');
          }
        }
      };
      
      // Add event listeners to ensure dropdown appears - match Destination exactly
      (originInput as HTMLInputElement).addEventListener('input', () => {
        setTimeout(ensureOriginDropdownVisible, 50);
        // Also trigger after a longer delay to catch delayed container creation
        setTimeout(ensureOriginDropdownVisible, 200);
      });
      
      (originInput as HTMLInputElement).addEventListener('focus', () => {
        // Immediately try to show dropdown
        ensureOriginDropdownVisible();
        
        // Also trigger with delays to ensure it appears
        setTimeout(ensureOriginDropdownVisible, 10);
        setTimeout(ensureOriginDropdownVisible, 50);
        
        // If there's text, trigger autocomplete to refresh suggestions
        if ((originInput as HTMLInputElement).value.length > 0) {
          // Trigger input event to refresh autocomplete
          const event = new Event('input', { bubbles: true });
          (originInput as HTMLInputElement).dispatchEvent(event);
          
          // Also trigger keydown to help Google Maps refresh
          const keydownEvent = new KeyboardEvent('keydown', { bubbles: true, key: 'a' });
          (originInput as HTMLInputElement).dispatchEvent(keydownEvent);
          
          // Check again after delays to ensure dropdown appears
          setTimeout(ensureOriginDropdownVisible, 100);
          setTimeout(ensureOriginDropdownVisible, 200);
          setTimeout(ensureOriginDropdownVisible, 300);
        }
      });
      
      // Add click handler to ensure dropdown appears when clicking on input
      (originInput as HTMLInputElement).addEventListener('click', () => {
        // If there's text, ensure dropdown is visible
        if ((originInput as HTMLInputElement).value.length > 0) {
          setTimeout(ensureOriginDropdownVisible, 10);
          setTimeout(ensureOriginDropdownVisible, 50);
        }
      });
      
      (originInput as HTMLInputElement).addEventListener('blur', () => {
        // Hide all autocomplete dropdowns when origin loses focus (with delay to allow click on suggestion)
        setTimeout(() => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            // Use visibility and opacity instead of display to allow re-showing
            pacContainer.style.setProperty('visibility', 'hidden', 'important');
            pacContainer.style.setProperty('opacity', '0', 'important');
            pacContainer.style.setProperty('pointer-events', 'none', 'important');
          });
        }, 200);
      });
      
      (originInput as HTMLInputElement).addEventListener('keyup', (e: KeyboardEvent) => {
        if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
          setTimeout(ensureOriginDropdownVisible, 50);
        } else if (e.key === 'Escape') {
          // Hide dropdown on Escape
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            const containerId = pacContainer.id;
            const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
            if (associatedInput === originInput || 
                (pacContainer.getAttribute('data-input-id') === 'origin-input')) {
              // Use visibility and opacity instead of display to allow re-showing
              pacContainer.style.setProperty('visibility', 'hidden', 'important');
              pacContainer.style.setProperty('opacity', '0', 'important');
              pacContainer.style.setProperty('pointer-events', 'none', 'important');
            }
          });
        }
      });
    } catch (error) {
      console.error('Error creating origin autocomplete:', error);
      return;
    }

    this.originAutocomplete.addListener('place_changed', () => {
      const place = this.originAutocomplete.getPlace();
      const address = this.resolvePlaceAddress(place);
      if (!address) return;
      this.ngZone.run(() => {
        this.formData.origin = address;
        this.scheduleRouteRecalculation();
        const originInputElement = document.getElementById('origin-input') as HTMLInputElement;
        if (originInputElement) {
          originInputElement.value = address;
        }
        this.cdr.detectChanges();
        setTimeout(() => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            const containerId = pacContainer.id;
            const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
            if (associatedInput !== document.activeElement) {
              pacContainer.style.setProperty('visibility', 'hidden', 'important');
              pacContainer.style.setProperty('opacity', '0', 'important');
              pacContainer.style.setProperty('pointer-events', 'none', 'important');
            }
          });
        }, 100);
      });
    });

    this.attachPacItemMousedownFix();

    // Initialize Destination autocomplete (using the variable declared at the top)
    destinationInput = document.getElementById('destination-input');
    if (!destinationInput) {
      console.warn('Destination input element not found');
      return;
    }

    // Clear existing autocomplete if any
    if (this.destinationAutocomplete) {
      google.maps.event.clearInstanceListeners(this.destinationAutocomplete);
    }

    try {
      // Ensure input is ready
      (destinationInput as HTMLInputElement).setAttribute('autocomplete', 'off');
      (destinationInput as HTMLInputElement).setAttribute('autocorrect', 'off');
      (destinationInput as HTMLInputElement).setAttribute('autocapitalize', 'off');
      (destinationInput as HTMLInputElement).setAttribute('spellcheck', 'false');
      
      // Initialize Destination autocomplete with worldwide location bias
      // Use LatLngBounds covering entire world to disable US location bias
      const worldBoundsDest = new google.maps.LatLngBounds(
        new google.maps.LatLng(-90, -180), // Southwest corner
        new google.maps.LatLng(90, 180)    // Northeast corner
      );
      
      this.destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput as HTMLInputElement, {
        types: ['geocode'], // Include all address types worldwide (addresses, streets, cities, etc.)
        fields: ['formatted_address', 'address_components', 'geometry'],
        bounds: worldBoundsDest // Set bounds to entire world to disable US location bias
      });

      if (!this.destinationAutocomplete) {
        console.error('Failed to create destination autocomplete');
        return;
      }

      // Ensure dropdown appears for destination input
      const ensureDestinationDropdownVisible = () => {
        hideOriginDropdown();
        
        const destinationPacContainer = findDestinationPacContainer();
        if (destinationPacContainer) {
          // Fix "Powered by Google" logo positioning to prevent overlap with suggestions
          this.fixPacContainerLogo(destinationPacContainer);
          
          const rect = (destinationInput as HTMLInputElement).getBoundingClientRect();
          
          // Check if container has suggestions (pac-items)
          const hasSuggestions = destinationPacContainer.querySelectorAll('.pac-item').length > 0;
          
          // Always update position, but only set visibility if there are suggestions
          destinationPacContainer.style.setProperty('z-index', '99999', 'important');
          destinationPacContainer.style.setProperty('position', 'fixed', 'important');
          destinationPacContainer.style.setProperty('top', rect.bottom + 'px', 'important');
          destinationPacContainer.style.setProperty('left', rect.left + 'px', 'important');
          destinationPacContainer.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
          
          if (hasSuggestions) {
            destinationPacContainer.style.setProperty('display', 'block', 'important');
            destinationPacContainer.style.setProperty('visibility', 'visible', 'important');
            destinationPacContainer.style.setProperty('opacity', '1', 'important');
            destinationPacContainer.style.setProperty('pointer-events', 'auto', 'important');
          }
        }
      };
      
      // Add event listeners to ensure dropdown appears
      (destinationInput as HTMLInputElement).addEventListener('input', () => {
        setTimeout(ensureDestinationDropdownVisible, 50);
        // Also trigger after a longer delay to catch delayed container creation
        setTimeout(ensureDestinationDropdownVisible, 200);
      });
      
      (destinationInput as HTMLInputElement).addEventListener('focus', () => {
        setTimeout(ensureDestinationDropdownVisible, 50);
        // If there's text, trigger autocomplete
        if ((destinationInput as HTMLInputElement).value.length > 0) {
          const event = new Event('input', { bubbles: true });
          (destinationInput as HTMLInputElement).dispatchEvent(event);
          // Also check again after delay
          setTimeout(ensureDestinationDropdownVisible, 200);
        }
      });
      
      (destinationInput as HTMLInputElement).addEventListener('blur', () => {
        // Hide all autocomplete dropdowns when destination loses focus (with delay to allow click on suggestion)
        setTimeout(() => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            // Use visibility and opacity instead of display to allow re-showing
            pacContainer.style.setProperty('visibility', 'hidden', 'important');
            pacContainer.style.setProperty('opacity', '0', 'important');
            pacContainer.style.setProperty('pointer-events', 'none', 'important');
          });
        }, 200);
      });
      
      (destinationInput as HTMLInputElement).addEventListener('keyup', (e: KeyboardEvent) => {
        if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
          setTimeout(ensureDestinationDropdownVisible, 50);
        } else if (e.key === 'Escape') {
          // Hide dropdown on Escape
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            const associatedInput = (pacContainer as any).associatedInput || 
              (pacContainer.previousElementSibling as HTMLInputElement);
            if (associatedInput === destinationInput || 
                (pacContainer.getAttribute('data-input-id') === 'destination-input')) {
              // Use visibility and opacity instead of display to allow re-showing
              pacContainer.style.setProperty('visibility', 'hidden', 'important');
              pacContainer.style.setProperty('opacity', '0', 'important');
              pacContainer.style.setProperty('pointer-events', 'none', 'important');
            }
          });
        }
      });
    } catch (error) {
      console.error('Error creating destination autocomplete:', error);
      return;
    }

    this.destinationAutocomplete.addListener('place_changed', () => {
      const place = this.destinationAutocomplete.getPlace();
      const address = this.resolvePlaceAddress(place);
      if (!address) return;
      this.ngZone.run(() => {
        this.formData.destination = address;
        this.scheduleRouteRecalculation();
        const destinationInputElement = document.getElementById('destination-input') as HTMLInputElement;
        if (destinationInputElement) {
          destinationInputElement.value = address;
        }
        this.cdr.detectChanges();
        setTimeout(() => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            const containerId = pacContainer.id;
            const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
            if (associatedInput !== document.activeElement) {
              pacContainer.style.setProperty('visibility', 'hidden', 'important');
              pacContainer.style.setProperty('opacity', '0', 'important');
              pacContainer.style.setProperty('pointer-events', 'none', 'important');
            }
          });
        }, 100);
      });
    });

    // Start continuous monitoring for origin and destination dropdowns
    // This ensures dropdowns appear even after a selection is made in the other field
    if (this.originDestinationMonitor) {
      clearInterval(this.originDestinationMonitor);
    }
    
    // Also use MutationObserver to catch when Google Maps creates new dropdown containers
    if (this.originDestinationObserver) {
      this.originDestinationObserver.disconnect();
    }
    
    this.originDestinationObserver = new MutationObserver((mutations) => {
      const activeElement = document.activeElement;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const element = node as HTMLElement;
            if (element.classList && element.classList.contains('pac-container')) {
              // A new dropdown container was created - fix logos immediately
              // Use requestAnimationFrame for immediate execution before Google adds logos
              requestAnimationFrame(() => {
                this.fixPacContainerLogo(element);
                requestAnimationFrame(() => {
                  this.fixPacContainerLogo(element);
                });
              });
              
              // A new dropdown container was created - ensure it's visible if the right input is focused
              if (activeElement === originInput) {
                setTimeout(() => {
                  const container = findOriginPacContainer();
                  if (container) {
                    hideDestinationDropdown();
                    // Fix logo positioning to prevent duplicates and overlap
                    // Run multiple times to catch logos added asynchronously
                    this.fixPacContainerLogo(container);
                    setTimeout(() => this.fixPacContainerLogo(container), 10);
                    setTimeout(() => this.fixPacContainerLogo(container), 50);
                    setTimeout(() => this.fixPacContainerLogo(container), 100);
                    
                    // Also set up a MutationObserver specifically for this container to watch for logos
                    const containerLogoObserver = new MutationObserver((logoMutations) => {
                      logoMutations.forEach((logoMutation) => {
                        logoMutation.addedNodes.forEach((logoNode) => {
                          if (logoNode.nodeType === 1) {
                            const logoElement = logoNode as HTMLElement;
                            // Check if pac-item (suggestion) was added - ensure container is visible
                            if (logoElement.classList && logoElement.classList.contains('pac-item')) {
                              // Suggestions loaded - show logo and ensure container is visible
                              this.fixPacContainerLogo(container);
                              // Ensure container is visible when suggestions are added
                              const containerRect = container.getBoundingClientRect();
                              if (containerRect.width > 0 && containerRect.height > 0) {
                                // Container exists, ensure it's visible
                                const inputRect = (originInput as HTMLInputElement).getBoundingClientRect();
                                container.style.setProperty('z-index', '99999', 'important');
                                container.style.setProperty('position', 'fixed', 'important');
                                container.style.setProperty('top', inputRect.bottom + 'px', 'important');
                                container.style.setProperty('left', inputRect.left + 'px', 'important');
                                container.style.setProperty('width', Math.max(inputRect.width, 300) + 'px', 'important');
                                container.style.setProperty('display', 'block', 'important');
                                container.style.setProperty('visibility', 'visible', 'important');
                                container.style.setProperty('opacity', '1', 'important');
                                container.style.setProperty('pointer-events', 'auto', 'important');
                              }
                            }
                            // Check if logo was added
                            if (logoElement.classList && logoElement.classList.contains('pac-logo')) {
                              // Logo was added - fix immediately
                              this.fixPacContainerLogo(container);
                            }
                          }
                        });
                      });
                    });
                    containerLogoObserver.observe(container, {
                      childList: true,
                      subtree: true
                    });
                    
                    const rect = (originInput as HTMLInputElement).getBoundingClientRect();
                    container.style.setProperty('visibility', '', 'important');
                    container.style.setProperty('opacity', '', 'important');
                    container.style.setProperty('pointer-events', '', 'important');
                    container.style.setProperty('z-index', '99999', 'important');
                    container.style.setProperty('position', 'fixed', 'important');
                    container.style.setProperty('top', rect.bottom + 'px', 'important');
                    container.style.setProperty('left', rect.left + 'px', 'important');
                    container.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
                    container.style.setProperty('display', 'block', 'important');
                    container.style.setProperty('visibility', 'visible', 'important');
                    container.style.setProperty('opacity', '1', 'important');
                    container.style.setProperty('pointer-events', 'auto', 'important');
                  }
                }, 10);
              } else if (activeElement === destinationInput) {
                setTimeout(() => {
                  const container = findDestinationPacContainer();
                  if (container) {
                    hideOriginDropdown();
                    // Fix logo positioning to prevent duplicates and overlap
                    // Run multiple times to catch logos added asynchronously
                    this.fixPacContainerLogo(container);
                    setTimeout(() => this.fixPacContainerLogo(container), 10);
                    setTimeout(() => this.fixPacContainerLogo(container), 50);
                    setTimeout(() => this.fixPacContainerLogo(container), 100);
                    
                    // Also set up a MutationObserver specifically for this container to watch for logos
                    const containerLogoObserver = new MutationObserver((logoMutations) => {
                      logoMutations.forEach((logoMutation) => {
                        logoMutation.addedNodes.forEach((logoNode) => {
                          if (logoNode.nodeType === 1) {
                            const logoElement = logoNode as HTMLElement;
                            // Check if pac-item (suggestion) was added - ensure container is visible
                            if (logoElement.classList && logoElement.classList.contains('pac-item')) {
                              // Suggestions loaded - show logo and ensure container is visible
                              this.fixPacContainerLogo(container);
                              // Ensure container is visible when suggestions are added
                              const containerRect = container.getBoundingClientRect();
                              if (containerRect.width > 0 && containerRect.height > 0) {
                                // Container exists, ensure it's visible
                                const inputRect = (originInput as HTMLInputElement).getBoundingClientRect();
                                container.style.setProperty('z-index', '99999', 'important');
                                container.style.setProperty('position', 'fixed', 'important');
                                container.style.setProperty('top', inputRect.bottom + 'px', 'important');
                                container.style.setProperty('left', inputRect.left + 'px', 'important');
                                container.style.setProperty('width', Math.max(inputRect.width, 300) + 'px', 'important');
                                container.style.setProperty('display', 'block', 'important');
                                container.style.setProperty('visibility', 'visible', 'important');
                                container.style.setProperty('opacity', '1', 'important');
                                container.style.setProperty('pointer-events', 'auto', 'important');
                              }
                            }
                            // Check if logo was added
                            if (logoElement.classList && logoElement.classList.contains('pac-logo')) {
                              // Logo was added - fix immediately
                              this.fixPacContainerLogo(container);
                            }
                          }
                        });
                      });
                    });
                    containerLogoObserver.observe(container, {
                      childList: true,
                      subtree: true
                    });
                    
                    const rect = (destinationInput as HTMLInputElement).getBoundingClientRect();
                    container.style.setProperty('visibility', '', 'important');
                    container.style.setProperty('opacity', '', 'important');
                    container.style.setProperty('pointer-events', '', 'important');
                    container.style.setProperty('z-index', '99999', 'important');
                    container.style.setProperty('position', 'fixed', 'important');
                    container.style.setProperty('top', rect.bottom + 'px', 'important');
                    container.style.setProperty('left', rect.left + 'px', 'important');
                    container.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
                    container.style.setProperty('display', 'block', 'important');
                    container.style.setProperty('visibility', 'visible', 'important');
                    container.style.setProperty('opacity', '1', 'important');
                    container.style.setProperty('pointer-events', 'auto', 'important');
                  }
                }, 10);
              }
            }
            // Also check children
            const pacContainer = element.querySelector && element.querySelector('.pac-container') as HTMLElement;
            if (pacContainer) {
              if (activeElement === originInput) {
                setTimeout(() => {
                  const container = findOriginPacContainer();
                  if (container) {
                    hideDestinationDropdown();
                    // Fix logo positioning to prevent duplicates and overlap
                    // Run multiple times to catch logos added asynchronously
                    this.fixPacContainerLogo(container);
                    setTimeout(() => this.fixPacContainerLogo(container), 10);
                    setTimeout(() => this.fixPacContainerLogo(container), 50);
                    setTimeout(() => this.fixPacContainerLogo(container), 100);
                    
                    // Also set up a MutationObserver specifically for this container to watch for logos
                    const containerLogoObserver = new MutationObserver((logoMutations) => {
                      logoMutations.forEach((logoMutation) => {
                        logoMutation.addedNodes.forEach((logoNode) => {
                          if (logoNode.nodeType === 1) {
                            const logoElement = logoNode as HTMLElement;
                            // Check if pac-item (suggestion) was added - ensure container is visible
                            if (logoElement.classList && logoElement.classList.contains('pac-item')) {
                              // Suggestions loaded - show logo and ensure container is visible
                              this.fixPacContainerLogo(container);
                              // Ensure container is visible when suggestions are added
                              const containerRect = container.getBoundingClientRect();
                              if (containerRect.width > 0 && containerRect.height > 0) {
                                // Container exists, ensure it's visible
                                const inputRect = (originInput as HTMLInputElement).getBoundingClientRect();
                                container.style.setProperty('z-index', '99999', 'important');
                                container.style.setProperty('position', 'fixed', 'important');
                                container.style.setProperty('top', inputRect.bottom + 'px', 'important');
                                container.style.setProperty('left', inputRect.left + 'px', 'important');
                                container.style.setProperty('width', Math.max(inputRect.width, 300) + 'px', 'important');
                                container.style.setProperty('display', 'block', 'important');
                                container.style.setProperty('visibility', 'visible', 'important');
                                container.style.setProperty('opacity', '1', 'important');
                                container.style.setProperty('pointer-events', 'auto', 'important');
                              }
                            }
                            // Check if logo was added
                            if (logoElement.classList && logoElement.classList.contains('pac-logo')) {
                              // Logo was added - fix immediately
                              this.fixPacContainerLogo(container);
                            }
                          }
                        });
                      });
                    });
                    containerLogoObserver.observe(container, {
                      childList: true,
                      subtree: true
                    });
                    
                    const rect = (originInput as HTMLInputElement).getBoundingClientRect();
                    container.style.setProperty('visibility', '', 'important');
                    container.style.setProperty('opacity', '', 'important');
                    container.style.setProperty('pointer-events', '', 'important');
                    container.style.setProperty('z-index', '99999', 'important');
                    container.style.setProperty('position', 'fixed', 'important');
                    container.style.setProperty('top', rect.bottom + 'px', 'important');
                    container.style.setProperty('left', rect.left + 'px', 'important');
                    container.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
                    container.style.setProperty('display', 'block', 'important');
                    container.style.setProperty('visibility', 'visible', 'important');
                    container.style.setProperty('opacity', '1', 'important');
                    container.style.setProperty('pointer-events', 'auto', 'important');
                  }
                }, 10);
              } else if (activeElement === destinationInput) {
                setTimeout(() => {
                  const container = findDestinationPacContainer();
                  if (container) {
                    hideOriginDropdown();
                    // Fix logo positioning to prevent duplicates and overlap
                    this.fixPacContainerLogo(container);
                    const rect = (destinationInput as HTMLInputElement).getBoundingClientRect();
                    container.style.setProperty('visibility', '', 'important');
                    container.style.setProperty('opacity', '', 'important');
                    container.style.setProperty('pointer-events', '', 'important');
                    container.style.setProperty('z-index', '99999', 'important');
                    container.style.setProperty('position', 'fixed', 'important');
                    container.style.setProperty('top', rect.bottom + 'px', 'important');
                    container.style.setProperty('left', rect.left + 'px', 'important');
                    container.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
                    container.style.setProperty('display', 'block', 'important');
                    container.style.setProperty('visibility', 'visible', 'important');
                    container.style.setProperty('opacity', '1', 'important');
                    container.style.setProperty('pointer-events', 'auto', 'important');
                  }
                }, 10);
              }
            }
          }
        });
      });
    });
    
    // Observe the document body for new pac-container elements
    this.originDestinationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also observe pac-containers for logo additions/changes
    const observePacContainers = () => {
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach((container) => {
        // Fix logos immediately when container is found using requestAnimationFrame
        requestAnimationFrame(() => {
          this.fixPacContainerLogo(container as HTMLElement);
        });
        
        // Create observer for each container to watch for logo additions and text changes
        const logoObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            // Watch for added nodes
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) {
                const element = node as HTMLElement;
                // Check for logo class/id patterns
                const hasLogoClass = element.classList && (
                  element.classList.contains('pac-logo') ||
                  Array.from(element.classList).some(cls => cls.toLowerCase().includes('logo'))
                );
                const hasLogoId = element.id && element.id.toLowerCase().includes('logo');
                
                if (hasLogoClass || hasLogoId) {
                  // Logo was added - fix it immediately
                  this.fixPacContainerLogo(container as HTMLElement);
                  requestAnimationFrame(() => {
                    this.fixPacContainerLogo(container as HTMLElement);
                  });
                }
                
                // Also check if the element contains "powered by" or "Google" text
                const text = element.textContent || element.innerText || '';
                const lowerText = text.toLowerCase();
                if (lowerText.includes('powered by') || 
                    lowerText.includes('poweredby') ||
                    lowerText.includes('powered') ||
                    (lowerText.includes('google') && 
                     !lowerText.includes('address') && 
                     !lowerText.includes('google maps'))) {
                  this.fixPacContainerLogo(container as HTMLElement);
                  requestAnimationFrame(() => {
                    this.fixPacContainerLogo(container as HTMLElement);
                  });
                }
                
                // Check for elements positioned absolutely (where Google places logos)
                const style = window.getComputedStyle(element);
                if ((style.position === 'absolute' || style.position === 'fixed') &&
                    (style.right !== 'auto' || style.bottom !== 'auto') &&
                    !element.classList.contains('pac-item')) {
                  const elementText = element.textContent || element.innerText || '';
                  if (elementText.toLowerCase().includes('powered') || 
                      elementText.toLowerCase().includes('google')) {
                    this.fixPacContainerLogo(container as HTMLElement);
                  }
                }
              } else if (node.nodeType === 3) {
                // Text node - check if it contains "powered by" or "Google"
                const text = node.textContent || '';
                const lowerText = text.toLowerCase();
                if (lowerText.includes('powered by') || 
                    lowerText.includes('poweredby') ||
                    lowerText.includes('powered') ||
                    (lowerText.includes('google') && 
                     !lowerText.includes('address') && 
                     !lowerText.includes('google maps'))) {
                  const parent = node.parentElement;
                  if (parent && !parent.classList.contains('pac-item')) {
                    this.fixPacContainerLogo(container as HTMLElement);
                    requestAnimationFrame(() => {
                      this.fixPacContainerLogo(container as HTMLElement);
                    });
                  }
                }
              }
            });
            
            // Watch for characterData changes (text node changes)
            if (mutation.type === 'characterData') {
              const text = mutation.target.textContent || '';
              const lowerText = text.toLowerCase();
              if (lowerText.includes('powered by') || 
                  lowerText.includes('poweredby') ||
                  lowerText.includes('powered') ||
                  (lowerText.includes('google') && 
                   !lowerText.includes('address') && 
                   !lowerText.includes('google maps'))) {
                const parent = (mutation.target as any).parentElement;
                if (parent && !parent.classList.contains('pac-item')) {
                    this.fixPacContainerLogo(container as HTMLElement);
                    requestAnimationFrame(() => {
                      this.fixPacContainerLogo(container as HTMLElement);
                    });
                }
              }
            }
            
            // Watch for attribute changes (class/id changes that might add logo)
            if (mutation.type === 'attributes') {
              const target = mutation.target as HTMLElement;
              const attrName = mutation.attributeName;
              if (attrName === 'class' || attrName === 'id') {
                const hasLogo = (target.classList && Array.from(target.classList).some(cls => cls.toLowerCase().includes('logo'))) ||
                                (target.id && target.id.toLowerCase().includes('logo'));
                if (hasLogo) {
                  this.fixPacContainerLogo(container as HTMLElement);
                }
              }
            }
          });
        });
        
        logoObserver.observe(container, {
          childList: true,
          subtree: true,
          characterData: true, // Watch for text changes
          attributes: true, // Watch for attribute changes (class/id)
          attributeFilter: ['class', 'id'] // Only watch class and id attributes
        });
      });
    };
    
    // Run observer setup periodically to catch new containers and fix logos
    // Run more frequently (every 50ms) to catch logos on first click
    setInterval(observePacContainers, 50);
    
    // Ultra-aggressive continuous logo removal - runs every 25ms to catch logos immediately
    const aggressiveLogoRemoval = setInterval(() => {
      const pacContainers = document.querySelectorAll('.pac-container');
      pacContainers.forEach((container) => {
        this.fixPacContainerLogo(container as HTMLElement);
      });
    }, 25);
    
    // Store interval ID for cleanup
    (this as any)._aggressiveLogoRemoval = aggressiveLogoRemoval;
    
    this.originDestinationMonitor = setInterval(() => {
      const activeElement = document.activeElement;
      
      // If origin input is focused (with or without text), ensure its dropdown is visible
      if (activeElement === originInput) {
        const originPacContainer = findOriginPacContainer();
        if (originPacContainer) {
          hideDestinationDropdown();
          // Fix logo positioning to prevent duplicates and overlap
          this.fixPacContainerLogo(originPacContainer);
          
          const rect = (originInput as HTMLInputElement).getBoundingClientRect();
          
          // Check if container has suggestions (pac-items)
          const hasSuggestions = originPacContainer.querySelectorAll('.pac-item').length > 0;
          
          // Always update position, but only set visibility if there are suggestions
          originPacContainer.style.setProperty('z-index', '99999', 'important');
          originPacContainer.style.setProperty('position', 'fixed', 'important');
          originPacContainer.style.setProperty('top', rect.bottom + 'px', 'important');
          originPacContainer.style.setProperty('left', rect.left + 'px', 'important');
          originPacContainer.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
          
          if (hasSuggestions) {
            originPacContainer.style.setProperty('display', 'block', 'important');
            originPacContainer.style.setProperty('visibility', 'visible', 'important');
            originPacContainer.style.setProperty('opacity', '1', 'important');
            originPacContainer.style.setProperty('pointer-events', 'auto', 'important');
          }
        }
      }
      // If destination input is focused (with or without text), ensure its dropdown is visible
      else if (activeElement === destinationInput) {
        const destinationPacContainer = findDestinationPacContainer();
        if (destinationPacContainer) {
          hideOriginDropdown();
          // Fix logo positioning to prevent duplicates and overlap
          this.fixPacContainerLogo(destinationPacContainer);
          
          const rect = (destinationInput as HTMLInputElement).getBoundingClientRect();
          
          // Check if container has suggestions (pac-items)
          const hasSuggestions = destinationPacContainer.querySelectorAll('.pac-item').length > 0;
          
          // Always update position, but only set visibility if there are suggestions
          destinationPacContainer.style.setProperty('z-index', '99999', 'important');
          destinationPacContainer.style.setProperty('position', 'fixed', 'important');
          destinationPacContainer.style.setProperty('top', rect.bottom + 'px', 'important');
          destinationPacContainer.style.setProperty('left', rect.left + 'px', 'important');
          destinationPacContainer.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
          
          if (hasSuggestions) {
            destinationPacContainer.style.setProperty('display', 'block', 'important');
            destinationPacContainer.style.setProperty('visibility', 'visible', 'important');
            destinationPacContainer.style.setProperty('opacity', '1', 'important');
            destinationPacContainer.style.setProperty('pointer-events', 'auto', 'important');
          }
        }
      }
    }, 100);

    console.log('Autocomplete initialized successfully');
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
      const modal = stopLocationInput.closest('.modal');
      if (!modal) {
        setTimeout(() => tryInit(attempt + 1), 200);
        return;
      }
      
      // Check if modal is actually visible (not just in DOM)
      const modalElement = modal as HTMLElement;
      const isModalVisible = modalElement.style.display !== 'none' && 
                            modalElement.classList.contains('show') &&
                            stopLocationInput.offsetParent !== null;
      
      if (!isModalVisible) {
        setTimeout(() => tryInit(attempt + 1), 200);
        return;
      }

      try {
        // Ensure input is focusable and ready
        stopLocationInput.setAttribute('autocomplete', 'off');
        stopLocationInput.setAttribute('autocorrect', 'off');
        stopLocationInput.setAttribute('autocapitalize', 'off');
        stopLocationInput.setAttribute('spellcheck', 'false');
        
        // Make sure input is visible and accessible
        stopLocationInput.style.display = 'block';
        stopLocationInput.style.visibility = 'visible';
        stopLocationInput.style.opacity = '1';
        
        // Force input to be in the viewport - check again after setting styles
        if (stopLocationInput.offsetParent === null) {
          console.warn('Input is not visible after style update, waiting...');
          setTimeout(() => tryInit(attempt + 1), 200);
          return;
        }
        
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

        // Bind the autocomplete to the input explicitly
        // This ensures it's properly attached even in modals
        const autocompleteInput = this.stopLocationAutocomplete.get('input');
        if (autocompleteInput && autocompleteInput !== stopLocationInput) {
          // If Google created a different input, we need to sync them
          console.warn('Autocomplete input mismatch detected');
        }

        this.stopLocationAutocomplete.addListener('place_changed', () => {
          const place = this.stopLocationAutocomplete.getPlace();
          const address = this.resolvePlaceAddress(place);
          if (!address) return;
          this.ngZone.run(() => {
            this.stopForm.location = address;
            stopLocationInput.value = address;
            this.cdr.detectChanges();
          });
        });

        // Track if user has interacted with the input
        let userHasInteracted = false;

        // Function to hide all dropdowns
        const hideAllDropdowns = () => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            pacContainer.style.setProperty('display', 'none', 'important');
          });
        };

        // Function to hide dropdowns from other inputs (Origin and Destination)
        const hideOtherDropdowns = () => {
          const originInput = document.getElementById('origin-input');
          const destinationInput = document.getElementById('destination-input');
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          
          pacContainers.forEach((pacContainer) => {
            // Check if this pac-container belongs to origin or destination
            const containerId = pacContainer.id;
            const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
            
            // Hide if it's associated with origin or destination inputs
            if (associatedInput && (associatedInput === originInput || associatedInput === destinationInput)) {
              pacContainer.style.setProperty('display', 'none', 'important');
            }
          });
        };

        // Function to find the pac-container associated with stop location input
        const findStopLocationPacContainer = (): HTMLElement | null => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          
          for (const pacContainer of pacContainers) {
            const containerId = pacContainer.id;
            const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
            
            // Check if this pac-container is associated with our stop location input
            if (associatedInput && associatedInput === stopLocationInput) {
              return pacContainer;
            }
          }
          
          // Fallback: find pac-container that's closest to our input or was created most recently
          // This is a workaround if aria-owns isn't set yet
          if (pacContainers.length > 0) {
            // Get the last pac-container (most recently created)
            // and check if stop location input is focused
            if (document.activeElement === stopLocationInput) {
              return pacContainers[pacContainers.length - 1];
            }
          }
          
          return null;
        };

        // Monitor for the pac-container and ensure it's visible (only after user interaction)
        const ensureDropdownVisible = () => {
          // Only show dropdown if user has interacted with the input
          if (!userHasInteracted) {
            hideAllDropdowns();
            return;
          }

          // First, hide all other dropdowns (Origin and Destination)
          hideOtherDropdowns();

          // Find the pac-container associated with stop location input
          const stopPacContainer = findStopLocationPacContainer();
          
          if (stopPacContainer && stopPacContainer.children.length > 0) {
            // Fix "Powered by Google" logo positioning to prevent overlap with suggestions
            this.fixPacContainerLogo(stopPacContainer);
            
            // Use getBoundingClientRect() which gives viewport-relative coordinates
            const rect = stopLocationInput.getBoundingClientRect();
            stopPacContainer.style.setProperty('z-index', '99999', 'important');
            stopPacContainer.style.setProperty('position', 'fixed', 'important');
            stopPacContainer.style.setProperty('top', rect.bottom + 'px', 'important');
            stopPacContainer.style.setProperty('left', rect.left + 'px', 'important');
            stopPacContainer.style.setProperty('width', Math.max(rect.width, 300) + 'px', 'important');
            stopPacContainer.style.setProperty('display', 'block', 'important');
            stopPacContainer.style.setProperty('visibility', 'visible', 'important');
            stopPacContainer.style.setProperty('opacity', '1', 'important');
            stopPacContainer.style.setProperty('pointer-events', 'auto', 'important');
            stopPacContainer.style.setProperty('max-height', '300px', 'important');
            stopPacContainer.style.setProperty('overflow-y', 'auto', 'important');
          }
        };

        // Check for dropdown when typing
        stopLocationInput.addEventListener('input', () => {
          userHasInteracted = true;
          // Hide other dropdowns immediately
          hideOtherDropdowns();
          setTimeout(ensureDropdownVisible, 50);
        });

        // Check for dropdown on focus - only show if there's text
        stopLocationInput.addEventListener('focus', () => {
          // Hide other dropdowns immediately when stop location input is focused
          hideOtherDropdowns();
          
          // Only mark as interacted if there's text or when user starts typing
          if (stopLocationInput.value.length > 0) {
            userHasInteracted = true;
            setTimeout(ensureDropdownVisible, 50);
          } else {
            // Hide all dropdowns on focus if empty
            hideAllDropdowns();
          }
        });

        // Track when user starts typing
        stopLocationInput.addEventListener('keydown', (e: KeyboardEvent) => {
          // Mark as interacted when user presses any key (except special keys)
          if (!['Tab', 'Escape', 'Enter'].includes(e.key)) {
            userHasInteracted = true;
          }
        });
        
        // Also listen for keyup to ensure autocomplete triggers
        stopLocationInput.addEventListener('keyup', (e: KeyboardEvent) => {
          // Don't trigger on arrow keys or enter
          if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
            userHasInteracted = true;
            setTimeout(ensureDropdownVisible, 50);
          }
        });

        // Use MutationObserver to watch for pac-container creation
        this.stopLocationObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1) { // Element node
                const element = node as HTMLElement;
                if (element.classList && element.classList.contains('pac-container')) {
                  // Always hide other dropdowns first
                  hideOtherDropdowns();
                  
                  // Hide dropdown initially if user hasn't interacted
                  if (!userHasInteracted) {
                    hideAllDropdowns();
                  } else {
                    setTimeout(ensureDropdownVisible, 10);
                  }
                }
                // Also check children
                const pacContainer = element.querySelector && element.querySelector('.pac-container') as HTMLElement;
                if (pacContainer) {
                  // Always hide other dropdowns first
                  hideOtherDropdowns();
                  
                  // Hide dropdown initially if user hasn't interacted
                  if (!userHasInteracted) {
                    hideAllDropdowns();
                  } else {
                    setTimeout(ensureDropdownVisible, 10);
                  }
                }
              }
            });
          });
        });

        // Observe the document body for new elements
        if (this.stopLocationObserver) {
          this.stopLocationObserver.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        // Update position on scroll to keep dropdown aligned with input
        const updateDropdownPosition = () => {
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            if (pacContainer.children.length > 0 && pacContainer.style.display !== 'none') {
              const rect = stopLocationInput.getBoundingClientRect();
              pacContainer.style.setProperty('top', rect.bottom + 'px', 'important');
              pacContainer.style.setProperty('left', rect.left + 'px', 'important');
            }
          });
        };

        // Listen for scroll events to update dropdown position
        const scrollHandler = () => {
          updateDropdownPosition();
        };
        
        // Add scroll listeners to window and modal
        window.addEventListener('scroll', scrollHandler, true); // Use capture phase
        const modal = stopLocationInput.closest('.modal');
        if (modal) {
          modal.addEventListener('scroll', scrollHandler, true);
        }
        
        // Store scroll handler for cleanup
        (stopLocationInput as any)._scrollHandler = scrollHandler;
        (stopLocationInput as any)._modal = modal;

        // Also continuously monitor for dropdown appearance (fallback)
        // Only show if user has interacted
        this.stopLocationMonitor = setInterval(() => {
          // Always hide other dropdowns first
          hideOtherDropdowns();
          
          const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
          pacContainers.forEach((pacContainer) => {
            if (pacContainer.style.display !== 'none' && pacContainer.children.length > 0) {
              if (userHasInteracted) {
                ensureDropdownVisible();
              } else {
                hideAllDropdowns();
              }
            }
          });
        }, 100);

        // Initially hide any dropdowns that might appear
        setTimeout(() => {
          hideAllDropdowns();
        }, 100);

        // Stop monitoring after 30 seconds
        setTimeout(() => {
          if (this.stopLocationMonitor) {
            clearInterval(this.stopLocationMonitor);
            this.stopLocationMonitor = null;
          }
          if (this.stopLocationObserver) {
            this.stopLocationObserver.disconnect();
            this.stopLocationObserver = null;
          }
        }, 30000);

        console.log('Stop location autocomplete initialized successfully', {
          input: stopLocationInput,
          autocomplete: this.stopLocationAutocomplete,
          inputId: stopLocationInput.id,
          inputValue: stopLocationInput.value,
          isVisible: stopLocationInput.offsetParent !== null
        });
      } catch (error) {
        console.error('Error initializing stop location autocomplete:', error);
      }
    };

    // Start trying after modal is shown - use requestAnimationFrame for better timing
    requestAnimationFrame(() => {
      setTimeout(() => tryInit(), 100);
    });
  }

  loadCustomers(): void {
    this.loading = true;
    this.customerService.getCustomers(true).subscribe({
      next: (data) => {
        this.customers = data;
        this.loading = false;
      },
      error: () => {
        this.customers = [];
        this.loading = false;
      }
    });
  }

  generateLoadNumber(): void {
    // Generate a load number based on current date/time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.formData.loadNumber = 'LD-' + year + month + day + '-' + random;
  }

  // Stop Management
  openStopModal(index?: number): void {
    if (index !== undefined) {
      // Edit existing stop
      this.editingStopIndex = index;
      this.stopForm = { ...this.stops[index] };
    } else {
      // Add new stop
      this.editingStopIndex = null;
      const nextSequence = this.stops.length > 0 
        ? Math.max(...this.stops.map(s => s.sequenceNo)) + 1 
        : 1;
      this.stopForm = {
        sequenceNo: nextSequence,
        location: '',
        stopType: 'Pickup',
        plannedDateTime: '',
        notes: ''
      };
    }
    this.showStopModal = true;
    
    // Initialize autocomplete for stop location after modal is fully rendered
    // Use requestAnimationFrame to ensure DOM is ready, then wait for modal to be visible
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.initStopLocationAutocomplete();
      }, 500);
    });
  }

  saveStop(): void {
    // Validate stop date is within pickup-delivery range
    if (this.stopForm.plannedDateTime && this.formData.pickupDateTime && this.formData.deliveryDateTime) {
      const stopDate = new Date(this.stopForm.plannedDateTime);
      const pickupDate = new Date(this.formData.pickupDateTime);
      const deliveryDate = new Date(this.formData.deliveryDateTime);
      if (stopDate < pickupDate || stopDate > deliveryDate) {
        alert('Stop planned date/time must be between the pickup and delivery dates.');
        return;
      }
    }

    if (this.editingStopIndex !== null) {
      // Update existing stop
      this.stops[this.editingStopIndex] = { ...this.stopForm };
    } else {
      // Add new stop
      this.stops.push({ ...this.stopForm });
    }
    this.stops.sort((a, b) => a.sequenceNo - b.sequenceNo);
    this.scheduleRouteRecalculation();
    this.showStopModal = false;
    this.resetStopForm();
  }

  deleteStop(index: number): void {
    if (confirm('Are you sure you want to delete this stop?')) {
      this.stops.splice(index, 1);
      this.scheduleRouteRecalculation();
    }
  }

  resetStopForm(): void {
    // Hide any visible autocomplete dropdowns (but keep origin/destination ones if they're active)
    // Only hide the stop location dropdown
    const stopLocationInput = document.getElementById('stop-location-input') as HTMLInputElement;
    if (stopLocationInput) {
      const pacContainers = document.querySelectorAll('.pac-container') as NodeListOf<HTMLElement>;
      pacContainers.forEach((pacContainer) => {
        const containerId = pacContainer.id;
        const associatedInput = document.querySelector('input[aria-owns="' + containerId + '"]') as HTMLInputElement;
        
        // Only hide if it's associated with stop location input
        if (associatedInput && associatedInput === stopLocationInput) {
          pacContainer.style.setProperty('display', 'none', 'important');
        }
      });

      // Clean up scroll listeners
      const scrollHandler = (stopLocationInput as any)._scrollHandler;
      const modal = (stopLocationInput as any)._modal;
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler, true);
        if (modal) {
          modal.removeEventListener('scroll', scrollHandler, true);
        }
        delete (stopLocationInput as any)._scrollHandler;
        delete (stopLocationInput as any)._modal;
      }
    }

    // Clean up autocomplete when closing modal
    if (this.stopLocationAutocomplete) {
      try {
        google.maps.event.clearInstanceListeners(this.stopLocationAutocomplete);
      } catch (e) {
        console.warn('Error clearing stop location autocomplete listeners:', e);
      }
      this.stopLocationAutocomplete = null;
    }
    
    // Clean up observer and monitor
    if (this.stopLocationObserver) {
      this.stopLocationObserver.disconnect();
      this.stopLocationObserver = null;
    }
    if (this.stopLocationMonitor) {
      clearInterval(this.stopLocationMonitor);
      this.stopLocationMonitor = null;
    }
    
    this.stopForm = {
      sequenceNo: 1,
      location: '',
      stopType: 'Pickup',
      plannedDateTime: '',
      notes: ''
    };
    this.editingStopIndex = null;
  }

  // Form Submission
  onSubmit(): void {
    // Clear previous validation error
    this.validationError = '';

    // ngModel can lag behind the real input when Places updates the field; use DOM as source of truth at save.
    const originEl = document.getElementById('origin-input') as HTMLInputElement | null;
    const destEl = document.getElementById('destination-input') as HTMLInputElement | null;
    if (originEl) {
      this.formData.origin = originEl.value.trim();
    }
    if (destEl) {
      this.formData.destination = destEl.value.trim();
    }
    const deadheadOriginEl = document.getElementById('deadhead-origin-input') as HTMLInputElement | null;
    const deadheadDestEl = document.getElementById('deadhead-destination-input') as HTMLInputElement | null;
    if (deadheadOriginEl) {
      this.formData.deadheadOrigin = deadheadOriginEl.value.trim();
    }
    if (deadheadDestEl) {
      this.formData.deadheadDestination = deadheadDestEl.value.trim();
    }

    const missingFields = this.getMissingFields();
    if (missingFields.length > 0) {
      const fieldsList = missingFields.join(', ');
      this.validationError = `Please fill in the following required fields: ${fieldsList}`;
      
      // Focus the first missing field
      this.focusFirstMissingField();
      
      // Scroll to the error message
      setTimeout(() => {
        const errorElement = document.querySelector('.validation-error-message');
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      return;
    }

    // Validate dates are not in the past
    // Normalize current date to the start of the current minute (set seconds and milliseconds to 0)
    // to match datetime-local input precision and avoid timing issues
    // This allows dates in the current minute to be valid
    const now = new Date();
    now.setSeconds(0, 0);
    
    if (this.formData.pickupDateTime) {
      const pickupDate = new Date(this.formData.pickupDateTime);
      // Check if pickup date is before the current minute
      if (pickupDate < now) {
        alert('Pickup date/time cannot be in the past');
        return;
      }
    }
    if (this.formData.deliveryDateTime) {
      const deliveryDate = new Date(this.formData.deliveryDateTime);
      // Check if delivery date is before the current minute
      if (deliveryDate < now) {
        alert('Delivery date/time cannot be in the past');
        return;
      }
      // Also check delivery is strictly after pickup (backend validator requires this)
      if (this.formData.pickupDateTime) {
        const pickupDate = new Date(this.formData.pickupDateTime);
        if (deliveryDate <= pickupDate) {
          alert('Delivery date/time must be after pickup date/time');
          return;
        }
      }
    }

    // Validate stop dates are not in the past
    for (const stop of this.stops) {
      if (stop.plannedDateTime) {
        const stopDate = new Date(stop.plannedDateTime);
        // Check if stop date is before the current minute
        if (stopDate < now) {
          alert(`Stop ${stop.sequenceNo} planned date/time cannot be in the past`);
          return;
        }
      }
    }

    // Validate total rate is not negative
    if (this.formData.totalRate !== undefined && this.formData.totalRate !== null) {
      if (this.formData.totalRate < 0) {
        alert('Total rate cannot be negative');
        return;
      }
    }
    if (this.formData.deadheadAmount !== undefined && this.formData.deadheadAmount !== null) {
      if (this.formData.deadheadAmount < 0) {
        alert('Deadhead amount cannot be negative');
        return;
      }
    }
    if (this.formData.loadWeight !== undefined && this.formData.loadWeight !== null) {
      if (this.formData.loadWeight < 0) {
        alert('Load weight cannot be negative');
        return;
      }
    }

    this.submitting = true;
    
    // Prepare the load data with proper timezone handling
    let pickupDateTime = this.formData.pickupDateTime || undefined;
    let deliveryDateTime = this.formData.deliveryDateTime || undefined;

    // Fix timezone issue: datetime-local returns YYYY-MM-DDTHH:mm format without timezone
    // We need to treat this as Eastern Time and convert it properly
    if (pickupDateTime) {
      const offset = this.timeZoneService.getETOffsetForDate(pickupDateTime.split('T')[0]);
      pickupDateTime = pickupDateTime + ':00' + offset; // Add seconds and timezone offset
    }
    if (deliveryDateTime) {
      const offset = this.timeZoneService.getETOffsetForDate(deliveryDateTime.split('T')[0]);
      deliveryDateTime = deliveryDateTime + ':00' + offset; // Add seconds and timezone offset
    }

    const dhOrigin = this.formData.deadheadOrigin?.trim();
    const dhDest = this.formData.deadheadDestination?.trim();
    const material = this.formData.materialName?.trim();
    const loadData: CreateLoadRequest = {
      ...this.formData,
      distanceKm: this.totalDistanceKm ?? undefined,
      pickupDateTime: pickupDateTime,
      deliveryDateTime: deliveryDateTime,
      customerId: this.formData.customerId || undefined,
      totalRate: this.formData.totalRate || undefined,
      deadheadOrigin: dhOrigin || undefined,
      deadheadDestination: dhDest || undefined,
      deadheadAmount:
        this.formData.deadheadAmount !== undefined && this.formData.deadheadAmount !== null
          ? this.formData.deadheadAmount
          : undefined,
      loadWeight:
        this.formData.loadWeight !== undefined && this.formData.loadWeight !== null
          ? this.formData.loadWeight
          : undefined,
      materialName: material || undefined
    };

    this.loadService.createLoad(loadData).subscribe({
      next: (response: any) => {
        const loadId = response.loadId || response;
        
        // Add stops if any
        if (this.stops.length > 0) {
          this.addStopsToLoad(loadId, 0);
        } else {
          this.router.navigate(['/loads', loadId]);
        }
      },
      error: (error) => {
        console.error('Error creating load:', error);
        const serverError = error?.error;
        const firstValidationError = Array.isArray(serverError?.errors) && serverError.errors.length > 0
          ? serverError.errors[0]
          : null;
        const message =
          firstValidationError ||
          serverError?.message ||
          error?.message ||
          'Failed to create load. Please try again.';
        alert(message);
        this.submitting = false;
      }
    });
  }

  addStopsToLoad(loadId: number, index: number): void {
    if (index >= this.stops.length) {
      this.submitting = false;
      this.router.navigate(['/loads', loadId]);
      return;
    }

    // Prepare stop data - convert empty string to undefined for optional fields
    const stop = this.stops[index];
    
    let plannedDateTime = stop.plannedDateTime && stop.plannedDateTime.trim() !== '' 
      ? stop.plannedDateTime.trim() 
      : undefined;

    // Fix timezone issue: datetime-local returns YYYY-MM-DDTHH:mm format without timezone
    // We need to treat this as Eastern Time and convert it properly
    if (plannedDateTime) {
      const offset = this.timeZoneService.getETOffsetForDate(plannedDateTime.split('T')[0]);
      plannedDateTime = plannedDateTime + ':00' + offset; // Add seconds and timezone offset
    }

    const stopData: CreateLoadStopRequest = {
      sequenceNo: stop.sequenceNo,
      location: stop.location,
      stopType: stop.stopType,
      plannedDateTime: plannedDateTime,
      notes: stop.notes && stop.notes.trim() !== '' 
        ? stop.notes 
        : undefined
    };

    this.loadService.addLoadStop(loadId, stopData).subscribe({
      next: () => {
        this.addStopsToLoad(loadId, index + 1);
      },
      error: (err) => {
        console.error('Error adding stop ' + (index + 1) + ':', err);
        // Continue even if stop addition fails, but log the error
        this.addStopsToLoad(loadId, index + 1);
      }
    });
  }

  getMissingFields(): string[] {
    const missing: string[] = [];
    
    if (!this.formData.loadNumber || this.formData.loadNumber.trim() === '') {
      missing.push('Load Number');
    }
    if (!this.formData.customerId) {
      missing.push('Broker');
    }
    if (!this.formData.origin || this.formData.origin.trim() === '') {
      missing.push('Origin');
    }
    if (!this.formData.destination || this.formData.destination.trim() === '') {
      missing.push('Destination');
    }
    if (!this.formData.pickupDateTime || this.formData.pickupDateTime.trim() === '') {
      missing.push('Pickup Date/Time');
    }
    if (!this.formData.deliveryDateTime || this.formData.deliveryDateTime.trim() === '') {
      missing.push('Delivery Date/Time');
    }
    if (this.formData.totalRate === undefined || this.formData.totalRate === null) {
      missing.push('Total Rate');
    }
    if (!this.formData.currency || this.formData.currency.trim() === '') {
      missing.push('Currency');
    }
    if (!this.formData.notes || this.formData.notes.trim() === '') {
      missing.push('Notes');
    }
    
    return missing;
  }

  /** Number of required fields used for completion calculation (must match getMissingFields). */
  private readonly requiredFieldCount = 9;

  getCompletionPercent(): number {
    const missing = this.getMissingFields().length;
    const filled = this.requiredFieldCount - missing;
    return Math.round((filled / this.requiredFieldCount) * 100);
  }

  focusFirstMissingField(): void {
    // Map field names to their input element names
    const fieldNameMap: { [key: string]: string } = {
      'Load Number': 'loadNumber',
      'Broker': 'customerId',
      'Origin': 'origin',
      'Destination': 'destination',
      'Pickup Date/Time': 'pickupDateTime',
      'Delivery Date/Time': 'deliveryDateTime',
      'Total Rate': 'totalRate',
      'Currency': 'currency',
      'Notes': 'notes'
    };

    const missingFields = this.getMissingFields();
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

  clearValidationError(): void {
    this.validationError = '';
  }

  isFormValid(): boolean {
    return this.getMissingFields().length === 0;
  }

  cancel(): void {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      this.router.navigate(['/loads']);
    }
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getStopsSummary(): string {
    return [...this.stops]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((stop) => stop.location?.trim())
      .filter((location): location is string => !!location)
      .join(' -> ');
  }

  onRouteInputChanged(): void {
    this.scheduleRouteRecalculation();
  }

  private scheduleRouteRecalculation(): void {
    if (this.routeRecalcTimer) {
      clearTimeout(this.routeRecalcTimer);
    }
    this.routeRecalcTimer = setTimeout(() => {
      this.routeRecalcTimer = null;
      this.recalculateRouteDistance();
    }, 450);
  }

  private recalculateRouteDistance(): void {
    const origin = this.formData.origin?.trim();
    const destination = this.formData.destination?.trim();

    if (!origin || !destination) {
      this.totalDistanceKm = null;
      this.distanceError = '';
      this.calculatingDistance = false;
      return;
    }

    if (typeof google === 'undefined' || !google.maps || !google.maps.DirectionsService) {
      this.distanceError = 'Distance preview unavailable.';
      this.totalDistanceKm = null;
      return;
    }

    this.calculatingDistance = true;
    this.distanceError = '';

    const orderedStops = [...this.stops]
      .sort((a, b) => a.sequenceNo - b.sequenceNo)
      .map((stop) => stop.location?.trim())
      .filter((location) => !!location)
      .map((location) => ({ location, stopover: true }));

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin,
        destination,
        waypoints: orderedStops,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result: any, status: any) => {
        this.ngZone.run(() => {
          this.calculatingDistance = false;

          if (status !== google.maps.DirectionsStatus.OK || !result?.routes?.length) {
            this.totalDistanceKm = null;
            this.distanceError = 'Could not calculate route distance yet.';
            return;
          }

          const totalMeters = (result.routes[0].legs || []).reduce(
            (sum: number, leg: any) => sum + (leg.distance?.value || 0),
            0
          );

          if (totalMeters <= 0) {
            this.totalDistanceKm = null;
            this.distanceError = 'Could not calculate route distance yet.';
            return;
          }

          this.totalDistanceKm = totalMeters / 1000;
          this.distanceError = '';
        });
      }
    );
  }
}

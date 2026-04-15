import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EquipmentService, FleetLocation } from '../../../core/services/equipment.service';
import { environment } from '../../../../environments/environment';

declare var google: any;

@Component({
  selector: 'app-live-fleet-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-fleet-map.html',
  styleUrl: './live-fleet-map.scss',
})
export class LiveFleetMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() pollIntervalMs = 45000; // 45 seconds
  @Output() locationClick = new EventEmitter<FleetLocation>();

  mapElementId = 'live-fleet-map-container';
  map: any = null;
  markers: any[] = [];
  mapsApiLoaded = false;
  locations: FleetLocation[] = [];
  loading = false;
  error: string | null = null;
  private pollTimer: any = null;
  private infoWindow: any = null;

  constructor(private equipmentService: EquipmentService) {}

  ngOnInit(): void {
    this.loadGoogleMaps();
  }

  ngAfterViewInit(): void {
    // Defer map init until Maps API is ready
    if (this.mapsApiLoaded && typeof google !== 'undefined' && google.maps) {
      setTimeout(() => this.initMap(), 100);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.clearMarkers();
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  }

  loadGoogleMaps(): void {
    if (typeof google !== 'undefined' && google.maps) {
      this.mapsApiLoaded = true;
      setTimeout(() => this.initMap(), 100);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps) {
          clearInterval(checkInterval);
          this.mapsApiLoaded = true;
          setTimeout(() => this.initMap(), 300);
        }
      }, 100);
      setTimeout(() => clearInterval(checkInterval), 10000);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      this.mapsApiLoaded = true;
      setTimeout(() => this.initMap(), 300);
    };
    script.onerror = () => {
      this.error = 'Failed to load Google Maps';
      this.mapsApiLoaded = false;
    };
    document.head.appendChild(script);
  }

  initMap(): void {
    if (!this.mapsApiLoaded || typeof google === 'undefined' || !google.maps) return;

    const mapEl = document.getElementById(this.mapElementId);
    if (!mapEl) return;

    this.map = new google.maps.Map(mapEl, {
      zoom: 4,
      center: { lat: 39.8283, lng: -98.5795 }, // Center of US
      mapTypeId: 'roadmap',
      styles: this.getDarkMapStyles(),
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
    });

    this.infoWindow = new google.maps.InfoWindow();
    this.fetchLocations();
    this.startPolling();
  }

  private getDarkMapStyles(): object[] {
    return [
      { elementType: 'geometry', stylers: [{ color: '#2c3e50' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1a365d' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#e9ecef' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#3d4f5f' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1e2a38' }] },
    ];
  }

  getMarkerIcon(status: string): string {
    const color = status === 'moving' ? '#00d97e' : status === 'idle' ? '#f6c23e' : '#e74c3c';
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="#fff" stroke-width="2"/></svg>`;
  }

  fetchLocations(): void {
    this.loading = true;
    this.error = null;
    this.equipmentService.getFleetLocations().subscribe({
      next: (data) => {
        this.locations = data || [];
        this.updateMarkers();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message || 'Failed to load fleet locations';
        this.locations = [];
        this.clearMarkers();
        this.loading = false;
      },
    });
  }

  private updateMarkers(): void {
    this.clearMarkers();
    if (!this.map || typeof google === 'undefined' || !google.maps) return;

    const bounds = new google.maps.LatLngBounds();
    let hasValidLoc = false;

    for (const loc of this.locations) {
      if (loc.latitude == null || loc.longitude == null) continue;
      const pos = { lat: loc.latitude, lng: loc.longitude };
      hasValidLoc = true;
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map: this.map,
        title: loc.vehicleLabel || `Vehicle #${loc.equipmentId}`,
        icon: {
          url: this.getMarkerIcon(loc.status || 'stopped'),
          scaledSize: new google.maps.Size(24, 24),
        },
      });

      marker.addListener('click', () => {
        this.showInfoWindow(marker, loc);
        this.locationClick.emit(loc);
      });
      this.markers.push(marker);
    }

    if (hasValidLoc && this.markers.length > 0) {
      this.map.fitBounds(bounds);
      const listener = google.maps.event.addListener(this.map, 'idle', () => {
        if (this.map.getZoom() > 12) this.map.setZoom(12);
        google.maps.event.removeListener(listener);
      });
    }
  }

  private showInfoWindow(marker: any, loc: FleetLocation): void {
    const lastUpdate = loc.lastUpdate
      ? this.formatTimeAgo(new Date(loc.lastUpdate))
      : 'Unknown';
    const content = `
      <div class="tms-map-infowindow">
        <strong>${loc.vehicleLabel || `#${loc.equipmentId}`}</strong><br>
        Driver: ${loc.driverName || '-'}<br>
        Speed: ${loc.speedMph ?? 0} mph<br>
        Last Update: ${lastUpdate}<br>
        ETA: -
      </div>
    `;
    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, marker);
  }

  formatTimeAgo(date: Date): string {
    const sec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (sec < 60) return `${sec} sec ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} hrs ago`;
    return `${Math.floor(sec / 86400)} days ago`;
  }

  private clearMarkers(): void {
    this.markers.forEach((m) => m.setMap(null));
    this.markers = [];
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.fetchLocations(), this.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  refresh(): void {
    this.fetchLocations();
  }
}

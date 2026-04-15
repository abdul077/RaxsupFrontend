import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PayrollService } from '../../../core/services/payroll.service';
import { DriverService } from '../../../core/services/driver.service';
import { EvereeIntegrationStatus, SyncWorkerToEvereeRequest, SyncWorkerToEvereeResponse } from '../../../core/models/financial.model';
import { Driver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-everee-sync-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './everee-sync-management.html',
  styleUrl: './everee-sync-management.scss',
})
export class EvereeSyncManagementComponent implements OnInit {
  integrations: EvereeIntegrationStatus[] = [];
  drivers: Driver[] = [];
  filteredIntegrations: EvereeIntegrationStatus[] = [];
  loading = true;
  syncing: { [key: number]: boolean } = {};

  // Filters
  workerTypeFilter: string = '';
  syncStatusFilter: string = '';
  searchTerm: string = '';

  workerTypeOptions = ['Driver', 'OwnerOperator'];
  syncStatusOptions = ['Pending', 'Synced', 'Failed', 'NeedsUpdate'];

  constructor(
    private payrollService: PayrollService,
    private driverService: DriverService
  ) {}

  ngOnInit(): void {
    this.loadDrivers();
    this.loadIntegrations();
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        this.drivers = result?.items || [];
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
        this.drivers = [];
      }
    });
  }

  loadIntegrations(): void {
    this.loading = true;
    this.payrollService.getEvereeIntegrationStatus(
      this.workerTypeFilter || undefined,
      this.syncStatusFilter || undefined
    ).subscribe({
      next: (data) => {
        this.integrations = data || [];
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading integrations:', error);
        this.integrations = [];
        this.filteredIntegrations = [];
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    if (!this.integrations || this.integrations.length === 0) {
      this.filteredIntegrations = [];
      return;
    }

    this.filteredIntegrations = this.integrations.filter(integration => {
      const matchesSearch = !this.searchTerm || 
        (integration.driverName && integration.driverName.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (integration.ownerOperatorName && integration.ownerOperatorName.toLowerCase().includes(this.searchTerm.toLowerCase()));
      
      return matchesSearch;
    });
  }

  onFilterChange(): void {
    this.loadIntegrations();
  }

  syncWorker(integration: EvereeIntegrationStatus): void {
    const key = integration.integrationId;
    this.syncing[key] = true;

    const request: SyncWorkerToEvereeRequest = {
      driverId: integration.driverId,
      ownerOperatorId: integration.ownerOperatorId
    };

    this.payrollService.syncWorkerToEveree(request).subscribe({
      next: (response: SyncWorkerToEvereeResponse) => {
        this.syncing[key] = false;
        if (response.success) {
          alert('Worker synced to Everee successfully!');
          this.loadIntegrations();
        } else {
          alert(`Failed to sync: ${response.errorMessage || 'Unknown error'}`);
        }
      },
      error: (error) => {
        console.error('Error syncing worker:', error);
        this.syncing[key] = false;
        alert('Error syncing worker to Everee');
      }
    });
  }

  syncAllWorkers(): void {
    if (!confirm('Sync all workers to Everee? This may take a while.')) {
      return;
    }

    const pendingWorkers = this.integrations.filter(i => i.syncStatus !== 'Synced');
    let synced = 0;
    let failed = 0;

    pendingWorkers.forEach((integration, index) => {
      setTimeout(() => {
        const request: SyncWorkerToEvereeRequest = {
          driverId: integration.driverId,
          ownerOperatorId: integration.ownerOperatorId
        };

        this.payrollService.syncWorkerToEveree(request).subscribe({
          next: (response: SyncWorkerToEvereeResponse) => {
            if (response.success) {
              synced++;
            } else {
              failed++;
            }
            
            if (synced + failed === pendingWorkers.length) {
              alert(`Bulk sync completed: ${synced} synced, ${failed} failed`);
              this.loadIntegrations();
            }
          },
          error: () => {
            failed++;
            if (synced + failed === pendingWorkers.length) {
              alert(`Bulk sync completed: ${synced} synced, ${failed} failed`);
              this.loadIntegrations();
            }
          }
        });
      }, index * 500); // Stagger requests
    });

    if (pendingWorkers.length === 0) {
      alert('All workers are already synced!');
    }
  }

  getSyncStatusClass(syncStatus: string): string {
    switch (syncStatus) {
      case 'Synced':
        return 'badge-success';
      case 'Pending':
        return 'badge-warning';
      case 'Failed':
        return 'badge-danger';
      case 'NeedsUpdate':
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  }
}


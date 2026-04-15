import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ComplianceService } from '../../../core/services/compliance.service';
import { DriverService } from '../../../core/services/driver.service';
import { EquipmentService } from '../../../core/services/equipment.service';
import { ComplianceCalendar, CreateComplianceCalendarRequest } from '../../../core/models/compliance.model';
import { Driver } from '../../../core/models/driver.model';
import { Equipment } from '../../../core/models/equipment.model';

@Component({
  selector: 'app-compliance-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './compliance-calendar.html',
  styleUrl: './compliance-calendar.scss',
})
export class ComplianceCalendarComponent implements OnInit {
  calendarItems: ComplianceCalendar[] = [];
  filteredItems: ComplianceCalendar[] = [];
  loading = true;

  // Filters
  itemTypeFilter: string = '';
  isOverdueFilter: boolean | null = null;
  isCompletedFilter: boolean | null = null;
  startDate: string = '';
  endDate: string = '';

  itemTypeOptions = ['CDL', 'MedicalCard', 'DrugTest', 'IFTA', 'IRP', 'Inspection', 'Insurance', 'Registration', 'Other'];

  // Create modal
  showCreateModal = false;
  creating = false;
  drivers: Driver[] = [];
  equipments: Equipment[] = [];
  createForm: CreateComplianceCalendarRequest & { notes?: string } = {
    itemType: 'CDL',
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium'
  };

  constructor(
    private complianceService: ComplianceService,
    private driverService: DriverService,
    private equipmentService: EquipmentService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Read query parameters
    this.route.queryParams.subscribe(params => {
      if (params['isOverdue'] === 'true') {
        this.isOverdueFilter = true;
      }
      this.loadCalendar();
    });
  }

  loadCalendar(): void {
    this.loading = true;
    this.complianceService.getComplianceCalendar(
      undefined,
      undefined,
      this.itemTypeFilter || undefined,
      this.isOverdueFilter ?? undefined,
      this.isCompletedFilter ?? undefined,
      this.startDate || undefined,
      this.endDate || undefined
    ).subscribe({
      next: (data) => {
        this.calendarItems = data;
        this.filteredItems = data;
        this.loading = false;
      },
      error: () => {
        this.calendarItems = [];
        this.filteredItems = [];
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.loadCalendar();
  }

  clearFilters(): void {
    this.itemTypeFilter = '';
    this.isOverdueFilter = null;
    this.isCompletedFilter = null;
    this.startDate = '';
    this.endDate = '';
    this.loadCalendar();
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'Critical': return 'badge-danger';
      case 'High': return 'badge-warning';
      case 'Medium': return 'badge-info';
      default: return 'badge-secondary';
    }
  }

  Math = Math;

  openCreateModal(): void {
    this.showCreateModal = true;
    this.createForm = {
      itemType: 'CDL',
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'Medium',
      driverId: undefined,
      equipmentId: undefined,
      notes: ''
    };
    this.loadDriversAndEquipments();
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  loadDriversAndEquipments(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 500).subscribe({
      next: (res) => { this.drivers = res.items; }
    });
    this.equipmentService.getEquipments().subscribe({
      next: (data) => { this.equipments = data; }
    });
  }

  createItem(): void {
    if (!this.createForm.itemType || !this.createForm.title || !this.createForm.dueDate) {
      return;
    }
    this.creating = true;
    const request: CreateComplianceCalendarRequest = {
      itemType: this.createForm.itemType,
      title: this.createForm.title,
      description: this.createForm.description || '',
      dueDate: this.createForm.dueDate,
      priority: this.createForm.priority,
      driverId: this.createForm.driverId,
      equipmentId: this.createForm.equipmentId,
      notes: this.createForm.notes
    };
    this.complianceService.createComplianceCalendar(request).subscribe({
      next: () => {
        this.creating = false;
        this.closeCreateModal();
        this.loadCalendar();
      },
      error: () => {
        this.creating = false;
        alert('Failed to create compliance item');
      }
    });
  }
}


import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { AuthService } from '../../../core/services/auth';
import { OwnerOperator } from '../../../core/models/driver.model';

@Component({
  selector: 'app-owner-operator-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-operator-list.html',
  styleUrl: './owner-operator-list.scss',
})
export class OwnerOperatorListComponent implements OnInit {
  ownerOperators: OwnerOperator[] = [];
  loading = true;
  
  // Filters
  isActiveFilter: boolean | null = null;
  searchTerm: string = '';

  constructor(
    private driverService: DriverService,
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadOwnerOperators();
  }

  loadOwnerOperators(): void {
    this.loading = true;
    this.driverService.getOwnerOperators(
      this.isActiveFilter !== null ? this.isActiveFilter : undefined
    ).subscribe({
      next: (data) => {
        this.ownerOperators = this.filterOwnerOperators(data);
        this.loading = false;
      },
      error: () => {
        this.ownerOperators = [];
        this.loading = false;
      }
    });
  }

  filterOwnerOperators(data: OwnerOperator[]): OwnerOperator[] {
    if (!this.searchTerm) {
      return data;
    }
    const term = this.searchTerm.toLowerCase();
    return data.filter(oo => 
      oo.companyName.toLowerCase().includes(term) ||
      oo.contactName?.toLowerCase().includes(term) ||
      oo.email?.toLowerCase().includes(term) ||
      oo.phone?.toLowerCase().includes(term)
    );
  }

  applyFilters(): void {
    this.loadOwnerOperators();
  }

  clearFilters(): void {
    this.isActiveFilter = null;
    this.searchTerm = '';
    this.loadOwnerOperators();
  }

  viewDetails(id: number): void {
    this.router.navigate(['/owner-operators', id]);
  }

  edit(id: number): void {
    this.router.navigate(['/owner-operators', id, 'edit']);
  }

  create(): void {
    this.router.navigate(['/owner-operators', 'create']);
  }

  delete(id: number, companyName: string): void {
    if (confirm(`Are you sure you want to delete ${companyName}? This action cannot be undone.`)) {
      this.driverService.deleteOwnerOperator(id).subscribe({
        next: () => {
          this.loadOwnerOperators();
        },
        error: (error) => {
          alert(error.error?.message || 'Failed to delete owner operator');
        }
      });
    }
  }
}


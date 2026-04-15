import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { Branch, Company, CreateBranchRequest, UpdateBranchRequest } from '../../../core/models/admin.model';

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branch-list.html',
  styleUrl: './branch-list.scss',
})
export class BranchListComponent implements OnInit {
  branches: Branch[] = [];
  filteredBranches: Branch[] = [];
  companies: Company[] = [];
  loading = false;
  showCreateModal = false;
  showEditModal = false;
  selectedBranch: Branch | null = null;
  searchTerm: string = '';
  companyFilter: number | null = null;
  newBranch: CreateBranchRequest = { companyId: 0, branchName: '', country: 'USA' };
  editBranch: UpdateBranchRequest = {};

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadBranches();
    this.loadCompanies();
  }

  loadBranches(): void {
    this.loading = true;
    this.adminService.getBranches().subscribe({
      next: (data) => {
        this.branches = data;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading branches:', err);
        this.loading = false;
      }
    });
  }

  loadCompanies(): void {
    this.adminService.getCompanies(true).subscribe({
      next: (data) => {
        this.companies = data;
      },
      error: (err) => {
        console.error('Error loading companies:', err);
      }
    });
  }

  applyFilters(): void {
    this.filteredBranches = this.branches.filter(branch => {
      const matchesCompany = !this.companyFilter || branch.companyId === this.companyFilter;
      const matchesSearch = !this.searchTerm ||
                           branch.branchName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           (branch.branchCode && branch.branchCode.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                           (branch.city && branch.city.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                           (branch.email && branch.email.toLowerCase().includes(this.searchTerm.toLowerCase()));
      return matchesCompany && matchesSearch;
    });
  }

  openCreateModal(): void {
    this.newBranch = {
      companyId: 0,
      branchName: '',
      branchCode: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
      phone: '',
      email: '',
      managerName: ''
    };
    this.showCreateModal = true;
  }

  isCreateFormValid(): boolean {
    return !!this.newBranch.companyId && this.newBranch.companyId > 0 && 
           !!this.newBranch.branchName && this.newBranch.branchName.trim().length > 0;
  }

  createBranch(): void {
    if (!this.isCreateFormValid()) {
      alert('Please fill in the required fields.');
      return;
    }

    this.adminService.createBranch(this.newBranch).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.loadBranches();
      },
      error: (err) => {
        console.error('Error creating branch:', err);
        alert(err.error?.message || 'Failed to create branch');
      }
    });
  }

  openEditModal(branch: Branch): void {
    this.selectedBranch = branch;
    this.editBranch = {
      branchName: branch.branchName,
      branchCode: branch.branchCode,
      address: branch.address,
      city: branch.city,
      state: branch.state,
      zipCode: branch.zipCode,
      country: branch.country,
      phone: branch.phone,
      email: branch.email,
      managerName: branch.managerName
    };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedBranch = null;
    this.editBranch = {};
  }

  isEditFormValid(): boolean {
    return !!this.editBranch.branchName && this.editBranch.branchName.trim().length > 0;
  }

  updateBranch(): void {
    if (!this.selectedBranch || !this.isEditFormValid()) {
      alert('Please fill in the required fields.');
      return;
    }

    this.adminService.updateBranch(this.selectedBranch.branchId, this.editBranch).subscribe({
      next: () => {
        this.closeEditModal();
        this.loadBranches();
      },
      error: (err) => {
        console.error('Error updating branch:', err);
        alert(err.error?.message || 'Failed to update branch');
      }
    });
  }

  toggleActive(branch: Branch): void {
    this.adminService.updateBranch(branch.branchId, { isActive: !branch.isActive }).subscribe({
      next: () => {
        this.loadBranches();
      },
      error: (err) => {
        console.error('Error updating branch:', err);
        alert(err.error?.message || 'Failed to update branch');
      }
    });
  }
}


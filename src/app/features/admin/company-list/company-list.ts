import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { Company, CreateCompanyRequest, UpdateCompanyRequest } from '../../../core/models/admin.model';

@Component({
  selector: 'app-company-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './company-list.html',
  styleUrl: './company-list.scss',
})
export class CompanyListComponent implements OnInit {
  companies: Company[] = [];
  filteredCompanies: Company[] = [];
  loading = false;
  showCreateModal = false;
  showEditModal = false;
  selectedCompany: Company | null = null;
  searchTerm: string = '';
  newCompany: CreateCompanyRequest = {
    companyName: '',
    country: 'USA'
  };
  editCompany: UpdateCompanyRequest = {};

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loading = true;
    this.adminService.getCompanies().subscribe({
      next: (data) => {
        // Map API response to ensure compatibility
        this.companies = data.map(company => ({
          ...company,
          dUNSNumber: company.dunsNumber || company.dUNSNumber,
          mCNumber: company.mcNumber || company.mCNumber,
          dOTNumber: company.dotNumber || company.dOTNumber
        }));
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading companies:', err);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredCompanies = this.companies.filter(company => {
      const mcNumber = (company.mCNumber || company.mcNumber || '').toString();
      const dotNumber = (company.dOTNumber || company.dotNumber || '').toString();
      const matchesSearch = !this.searchTerm ||
                           company.companyName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
                           (company.legalName && company.legalName.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                           mcNumber.includes(this.searchTerm) ||
                           dotNumber.includes(this.searchTerm) ||
                           (company.email && company.email.toLowerCase().includes(this.searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }

  openCreateModal(): void {
    this.newCompany = {
      companyName: '',
      legalName: '',
      taxId: '',
      dUNSNumber: '',
      mCNumber: '',
      dOTNumber: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'USA',
      phone: '',
      email: '',
      website: '',
      logoUrl: ''
    };
    this.showCreateModal = true;
  }

  isCreateFormValid(): boolean {
    return !!this.newCompany.companyName && this.newCompany.companyName.trim().length > 0;
  }

  createCompany(): void {
    if (!this.isCreateFormValid()) {
      alert('Please fill in the required fields.');
      return;
    }

    this.adminService.createCompany(this.newCompany).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.loadCompanies();
      },
      error: (err) => {
        console.error('Error creating company:', err);
        alert(err.error?.message || 'Failed to create company');
      }
    });
  }

  openEditModal(company: Company): void {
    this.selectedCompany = company;
    this.editCompany = {
      companyName: company.companyName,
      legalName: company.legalName,
      taxId: company.taxId,
      dUNSNumber: company.dUNSNumber || company.dunsNumber,
      mCNumber: company.mCNumber || company.mcNumber,
      dOTNumber: company.dOTNumber || company.dotNumber,
      address: company.address,
      city: company.city,
      state: company.state,
      zipCode: company.zipCode,
      country: company.country,
      phone: company.phone,
      email: company.email,
      website: company.website,
      logoUrl: company.logoUrl
    };
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedCompany = null;
    this.editCompany = {};
  }

  isEditFormValid(): boolean {
    return !!this.editCompany.companyName && this.editCompany.companyName.trim().length > 0;
  }

  updateCompany(): void {
    if (!this.selectedCompany || !this.isEditFormValid()) {
      alert('Please fill in the required fields.');
      return;
    }

    this.adminService.updateCompany(this.selectedCompany.companyId, this.editCompany).subscribe({
      next: () => {
        this.closeEditModal();
        this.loadCompanies();
      },
      error: (err) => {
        console.error('Error updating company:', err);
        alert(err.error?.message || 'Failed to update company');
      }
    });
  }

  toggleActive(company: Company): void {
    this.adminService.updateCompany(company.companyId, { isActive: !company.isActive }).subscribe({
      next: () => {
        this.loadCompanies();
      },
      error: (err) => {
        console.error('Error updating company:', err);
        alert(err.error?.message || 'Failed to update company');
      }
    });
  }
}


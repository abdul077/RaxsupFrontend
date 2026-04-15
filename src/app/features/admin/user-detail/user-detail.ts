import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { UserDetail, Company, Branch } from '../../../core/models/admin.model';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe],
  templateUrl: './user-detail.html',
  styleUrl: './user-detail.scss',
})
export class UserDetailComponent implements OnInit {
  user: UserDetail | null = null;
  companies: Company[] = [];
  branches: Branch[] = [];
  loading = true;
  activeTab: string = 'details';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
    private datePipe: DatePipe,
    private timeZoneService: TimeZoneService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadUserDetail(+id);
      this.loadCompanies();
    } else {
      this.goBack();
    }
  }

  loadUserDetail(userId: number): void {
    this.loading = true;
    this.adminService.getUsers().subscribe({
      next: (users) => {
        const user = users.find(u => u.userId === userId);
        if (user) {
          this.user = user;
          if (user.companyId) {
            this.loadBranchesForCompany(user.companyId);
          }
        } else {
          this.goBack();
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.goBack();
      }
    });
  }

  loadCompanies(): void {
    this.adminService.getCompanies(true).subscribe({
      next: (data) => {
        this.companies = data;
      }
    });
  }

  loadBranchesForCompany(companyId: number): void {
    this.adminService.getBranches(companyId, true).subscribe({
      next: (data) => {
        this.branches = data;
      }
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  goBack(): void {
    this.router.navigate(['/admin/users']);
  }

  getCompanyName(companyId?: number): string {
    if (!companyId) return 'N/A';
    const company = this.companies.find(c => c.companyId === companyId);
    return company?.companyName || 'N/A';
  }

  getBranchName(branchId?: number): string {
    if (!branchId) return 'N/A';
    const branch = this.branches.find(b => b.branchId === branchId);
    return branch?.branchName || 'N/A';
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'Never';
    const formatted = this.timeZoneService.formatDateTime(dateString);
    return formatted === '-' ? 'Never' : formatted;
  }

  getIdPrefix(roleName: string): string {
    if (!roleName) return 'RE';
    const roleLower = roleName.toLowerCase().trim();
    if (roleLower === 'owner operator' || 
        roleLower === 'owneroperator' || 
        roleLower === 'owner-operator' ||
        roleLower.includes('owner operator')) {
      return 'RO';
    }
    if (roleLower === 'driver' || roleLower === 'drivers') {
      return 'RO';
    }
    return 'RE';
  }

  getDisplayRoleName(roleName: string | null | undefined): string {
    if (!roleName) return 'N/A';
    const roleLower = roleName.toLowerCase();
    if (roleLower === 'driver' || roleLower === 'drivers') {
      return 'Owner Operators';
    }
    return roleName;
  }
}

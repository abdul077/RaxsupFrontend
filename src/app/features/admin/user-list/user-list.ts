import { Component, OnInit, ViewChild, ElementRef, TemplateRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, map } from 'rxjs';
import { AdminService } from '../../../core/services/admin.service';
import { DriverService } from '../../../core/services/driver.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { UserDetail, Role, Company, Branch, CreateUserRequest, UpdateUserRequest } from '../../../core/models/admin.model';
import { Driver } from '../../../core/models/driver.model';
import { PagedResult } from '../../../core/models/load.model';
import { DataTableComponent } from '../../../shared/components/data-table/data-table';
import { TableConfig, TableColumn, FilterState, BulkAction } from '../../../shared/components/data-table/data-table.models';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DataTableComponent],
  providers: [DatePipe],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserListComponent implements OnInit {
  users: UserDetail[] = [];
  roles: Role[] = [];
  companies: Company[] = [];
  branches: Branch[] = [];
  createBranches: Branch[] = [];
  availableReferrers: Driver[] = []; // Available drivers for referral selection
  referralMethod: 'dropdown' | 'manual' = 'dropdown'; // Method to select referrer
  manualReferralId?: number; // Manual referral ID input
  loading = false;
  readonly usernameMinLength = 3;
  readonly passwordMinLength = 6;
  readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  defaultCompanyId?: number; // Default company ID for "RaxsUp"
  defaultBranchId?: number; // Default branch ID for "NewYork Branch"
  showCreateModal = false;
  showEditModal = false;
  usernameTakenError = false;
  emailTakenError = false;
  @ViewChild('usernameInput') usernameInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('emailInput') emailInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('userActionsCell', { static: true }) userActionsCell!: TemplateRef<{ $implicit: UserDetail }>;
  selectedUser: UserDetail | null = null;
  newUser: CreateUserRequest = {
    username: '',
    email: '',
    fullName: '',
    roleId: 0,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    inAppNotificationsEnabled: true
  };
  editUser: UpdateUserRequest = {};
  filterRoleId?: number;
  selectedRoleId?: number; // For tab selection
  filterIsActive: boolean | null = true; // Default to showing only active users (null = all)
  inactiveOnlyPage = false; // True when route is /admin/inactive-users

  // Table configuration
  tableConfig!: TableConfig<UserDetail>;
  tableLoading = false;
  tableRefreshTrigger = 0; // Trigger to refresh table

  constructor(
    private adminService: AdminService,
    private driverService: DriverService,
    private datePipe: DatePipe,
    private timeZoneService: TimeZoneService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.applyRouteData(this.route.snapshot.data);
    this.route.data.subscribe(data => this.applyRouteData(data));
    this.initializeTableConfig();
    this.loadRoles();
    this.loadCompanies();
    this.loadBranches();
  }

  private applyRouteData(data: Record<string, unknown>): void {
    this.inactiveOnlyPage = !!data['inactiveOnly'];
    this.filterIsActive = this.inactiveOnlyPage ? false : true;
    if (this.tableConfig) {
      this.tableConfig.emptyMessage = this.inactiveOnlyPage ? 'No inactive users found' : 'No users found';
    }
    this.tableRefreshTrigger++;
  }

  initializeTableConfig(): void {
    this.tableConfig = {
      columns: [
        {
          key: 'userId',
          label: 'Id',
          type: 'text',
          sortable: true,
          width: '100px',
          render: (row) => `${this.getIdPrefix(row.roleName)}${row.userId}`
        },
        {
          key: 'username',
          label: 'Username',
          type: 'text',
          sortable: true,
          filterable: true,
          filterType: 'text'
        },
        {
          key: 'fullName',
          label: 'Full Name',
          type: 'text',
          sortable: true,
          filterable: true,
          filterType: 'text'
        },
        {
          key: 'email',
          label: 'Email',
          type: 'text',
          sortable: true,
          filterable: true,
          filterType: 'text'
        },
        {
          key: 'roleName',
          label: 'Role',
          type: 'badge',
          sortable: true,
          filterable: true,
          filterType: 'select',
          filterOptions: [],
          badgeClass: () => 'badge badge-info',
          render: (row) => this.getDisplayRoleName(row.roleName)
        },
        {
          key: 'lastLoginAt',
          label: 'Last Login',
          type: 'text',
          sortable: true,
          render: (row) => this.formatDate(row.lastLoginAt)
        },
        {
          key: 'actions',
          label: 'Actions',
          type: 'template',
          cellTemplate: this.userActionsCell,
          width: '120px',
          align: 'center'
        }
      ],
      enableSelection: false,
      enableGlobalSearch: true,
      enablePagination: true, // Enable pagination (client-side for now)
      defaultPageSize: 50,
      emptyMessage: this.inactiveOnlyPage ? 'No inactive users found' : 'No users found',
      rowClickable: false
    };

    // Update role filter options after roles are loaded
    this.loadRoles();
  }

  loadUsers(): void {
    this.loading = true;
    // Use selectedRoleId if set, otherwise use filterRoleId for backward compatibility
    const roleId = this.selectedRoleId !== undefined ? this.selectedRoleId : this.filterRoleId;
    this.adminService.getUsers(roleId, this.filterIsActive).subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  // Data source function for universal table
  dataSource = (filters: FilterState): Observable<PagedResult<UserDetail>> => {
    this.tableLoading = true;
    
    // Use selectedRoleId if set, otherwise use filterRoleId
    const roleId = this.selectedRoleId !== undefined ? this.selectedRoleId : this.filterRoleId;
    
    // Apply filters from table
    let isActiveFilter = this.filterIsActive;
    if (filters.columnFilters && filters.columnFilters['isActive'] !== undefined) {
      isActiveFilter = filters.columnFilters['isActive'];
    }
    
    // Apply role filter from column filters
    let finalRoleId = roleId;
    if (filters.columnFilters && filters.columnFilters['roleName'] !== undefined) {
      finalRoleId = filters.columnFilters['roleName'];
    }

    return this.adminService.getUsers(finalRoleId, isActiveFilter).pipe(
      map((users: UserDetail[]) => {
        // Apply global search filter
        let filteredUsers = users;
        if (filters.globalSearch) {
          const searchTerm = filters.globalSearch.toLowerCase();
          filteredUsers = users.filter(user =>
            user.username?.toLowerCase().includes(searchTerm) ||
            user.fullName?.toLowerCase().includes(searchTerm) ||
            user.email?.toLowerCase().includes(searchTerm)
          );
        }

        // Apply column filters
        if (filters.columnFilters) {
          Object.keys(filters.columnFilters).forEach(key => {
            const value = filters.columnFilters![key];
            if (value !== undefined && value !== null && value !== '') {
              if (key === 'username' && value) {
                filteredUsers = filteredUsers.filter(u => 
                  u.username?.toLowerCase().includes(value.toLowerCase())
                );
              }
              if (key === 'fullName' && value) {
                filteredUsers = filteredUsers.filter(u => 
                  u.fullName?.toLowerCase().includes(value.toLowerCase())
                );
              }
              if (key === 'email' && value) {
                filteredUsers = filteredUsers.filter(u => 
                  u.email?.toLowerCase().includes(value.toLowerCase())
                );
              }
            }
          });
        }

        // Apply sorting
        if (filters.sortColumn && filters.sortDirection) {
          filteredUsers = [...filteredUsers].sort((a, b) => {
            const aVal = this.getSortValue(a, filters.sortColumn!);
            const bVal = this.getSortValue(b, filters.sortColumn!);
            const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return filters.sortDirection === 'asc' ? comparison : -comparison;
          });
        }

        // Calculate pagination
        const totalCount = filteredUsers.length;
        const pageSize = filters.pageSize || 50;
        const pageNumber = filters.pageNumber || 1;
        const startIndex = (pageNumber - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

        this.tableLoading = false;
        return {
          items: paginatedUsers,
          totalCount,
          pageNumber,
          pageSize,
          totalPages,
          hasPreviousPage: pageNumber > 1,
          hasNextPage: pageNumber < totalPages
        };
      })
    );
  }

  private getSortValue(user: UserDetail, column: string): any {
    switch (column) {
      case 'userId':
        return user.userId;
      case 'username':
        return user.username?.toLowerCase() || '';
      case 'fullName':
        return user.fullName?.toLowerCase() || '';
      case 'email':
        return user.email?.toLowerCase() || '';
      case 'roleName':
        return user.roleName?.toLowerCase() || '';
      case 'lastLoginAt':
        return user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
      default:
        return '';
    }
  }

  loadRoles(): void {
    this.adminService.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
        // Update role filter options in table config
        if (this.tableConfig) {
          const roleColumn = this.tableConfig.columns.find(col => col.key === 'roleName');
          if (roleColumn) {
            roleColumn.filterOptions = [
              { value: undefined, label: 'All' },
              ...data.map(role => ({ value: role.roleId, label: this.getDisplayRoleName(role.roleName) }))
            ];
          }
        }
      }
    });
  }

  loadCompanies(): void {
    this.adminService.getCompanies(true).subscribe({
      next: (data) => {
        this.companies = data;
        // Set default company ID to 2 (RaxsUp)
        this.defaultCompanyId = 2;
      }
    });
  }

  loadBranches(): void {
    this.adminService.getBranches(undefined, true).subscribe({
      next: (data) => {
        this.branches = data;
        // Set default branch ID to 2 (NewYork Branch)
        this.defaultBranchId = 2;
      }
    });
  }

  clearAvailabilityErrors(): void {
    this.usernameTakenError = false;
    this.emailTakenError = false;
  }

  private focusFirstErrorField(): void {
    setTimeout(() => {
      if (this.usernameTakenError && this.usernameInputRef?.nativeElement) {
        this.usernameInputRef.nativeElement.focus();
      } else if (this.emailTakenError && this.emailInputRef?.nativeElement) {
        this.emailInputRef.nativeElement.focus();
      }
    }, 0);
  }

  openCreateModal(): void {
    // Load branches for default company if available
    if (this.defaultCompanyId) {
      this.adminService.getBranches(this.defaultCompanyId, true).subscribe({
        next: (data) => {
          this.createBranches = data;
        }
      });
    }
    
    this.newUser = {
      username: '',
      email: '',
      fullName: '',
      roleId: 0,
      companyId: this.defaultCompanyId, // Set default company
      branchId: this.defaultBranchId, // Set default branch
      phoneNumber: undefined,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      inAppNotificationsEnabled: true,
      referredBy: undefined
    };
    this.availableReferrers = [];
    this.clearAvailabilityErrors();
    this.showCreateModal = true;
  }

  onRoleChange(): void {
    // If role is Driver (RoleId = 3), load available drivers for referral
    const driverRoleId = 3;
    if (this.newUser.roleId === driverRoleId) {
      this.loadAvailableReferrers();
      this.referralMethod = 'dropdown';
    } else {
      this.availableReferrers = [];
      this.newUser.referredBy = undefined;
      this.manualReferralId = undefined;
      this.referralMethod = 'dropdown';
    }
  }

  onReferralMethodChange(method: 'dropdown' | 'manual'): void {
    if (method === 'manual') {
      this.newUser.referredBy = undefined;
    } else {
      this.manualReferralId = undefined;
    }
  }

  onManualReferralIdChange(): void {
    if (this.manualReferralId && this.manualReferralId > 0) {
      this.newUser.referredBy = this.manualReferralId;
    } else {
      this.newUser.referredBy = undefined;
    }
  }

  loadAvailableReferrers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 100).subscribe({
      next: (data) => {
        this.availableReferrers = data.items;
      },
      error: (err) => {
        console.error('Error loading available referrers:', err);
      }
    });
  }

  onCreateCompanyChange(companyId: number | undefined): void {
    if (companyId) {
      this.adminService.getBranches(companyId, true).subscribe({
        next: (data) => {
          this.createBranches = data;
        }
      });
      this.newUser.branchId = undefined;
    } else {
      this.createBranches = [];
      this.newUser.branchId = undefined;
    }
  }

  isCreateFormValid(): boolean {
    return !!(
      this.newUser.username &&
      this.newUser.username.trim().length >= this.usernameMinLength &&
      this.newUser.email &&
      this.emailPattern.test(this.newUser.email) &&
      this.newUser.fullName &&
      this.newUser.fullName.trim().length > 0 &&
      this.newUser.roleId > 0
    );
  }

  onCreatePhoneChange(value: string): void {
    this.newUser.phoneNumber = this.formatPhoneInput(value);
  }

  onEditPhoneChange(value: string): void {
    if (this.editUser) {
      this.editUser.phoneNumber = this.formatPhoneInput(value);
    }
  }

  private formatPhoneInput(raw: string | undefined): string | undefined {
    if (raw === undefined || raw === null) return undefined;
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (!digits) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  createUser(): void {
    if (!this.isCreateFormValid()) return;

    this.clearAvailabilityErrors();

    // Check if username and email are already taken before creating
    this.adminService.checkUserAvailability(this.newUser.username?.trim(), this.newUser.email?.trim()).subscribe({
      next: (availability) => {
        if (availability.usernameTaken) this.usernameTakenError = true;
        if (availability.emailTaken) this.emailTakenError = true;
        if (availability.usernameTaken || availability.emailTaken) {
          this.focusFirstErrorField();
          return;
        }

        this.doCreateUser();
      },
      error: () => {
        alert('Unable to verify username and email availability. Please try again.');
      }
    });
  }

  private doCreateUser(): void {
    // Ensure default company and branch are set
    if (!this.newUser.companyId && this.defaultCompanyId) {
      this.newUser.companyId = this.defaultCompanyId;
    }
    if (!this.newUser.branchId && this.defaultBranchId) {
      this.newUser.branchId = this.defaultBranchId;
    }

    this.adminService.createUser(this.newUser).subscribe({
      next: (response) => {
        // After creating user, update with additional fields (company, branch, phone, notifications)
        // The register endpoint only handles basic fields, so we update after creation
        const updateRequest: UpdateUserRequest = {
          companyId: this.newUser.companyId || this.defaultCompanyId,
          branchId: this.newUser.branchId || this.defaultBranchId,
          phoneNumber: this.newUser.phoneNumber,
          emailNotificationsEnabled: this.newUser.emailNotificationsEnabled,
          smsNotificationsEnabled: this.newUser.smsNotificationsEnabled,
          inAppNotificationsEnabled: this.newUser.inAppNotificationsEnabled
        };
        
        // Always update to ensure defaults are set
        this.adminService.updateUser(response.userId, updateRequest).subscribe({
          next: () => {
            this.showCreateModal = false;
            this.loadUsers();
          },
          error: (err) => {
            console.error('Error updating user details:', err);
            // User was created but update failed - still refresh the list
            this.showCreateModal = false;
            this.loadUsers();
          }
        });
      },
      error: (err) => {
        console.error('Error creating user:', err);
        const msg = err.error?.message || 'Failed to create user';
        if (msg.includes('Username already exists')) {
          this.usernameTakenError = true;
          this.focusFirstErrorField();
        } else if (msg.includes('Email already exists')) {
          this.emailTakenError = true;
          this.focusFirstErrorField();
        } else {
          alert(msg);
        }
      }
    });
  }

  openViewModal(user: UserDetail): void {
    this.router.navigate(['/admin/users', user.userId], {
      queryParams: { from: this.inactiveOnlyPage ? 'inactive' : 'active' }
    });
  }

  openEditModal(user: UserDetail): void {
    this.selectedUser = user;
    // Use user's company/branch if set, otherwise use defaults
    const companyId = user.companyId || this.defaultCompanyId;
    const branchId = user.branchId || this.defaultBranchId;
    
    this.editUser = {
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      companyId: companyId,
      branchId: branchId,
      phoneNumber: user.phoneNumber,
      emailNotificationsEnabled: user.emailNotificationsEnabled,
      smsNotificationsEnabled: user.smsNotificationsEnabled,
      inAppNotificationsEnabled: user.inAppNotificationsEnabled,
      isActive: user.isActive
    };
    this.showEditModal = true;
    
    // Load branches for selected company (or default company)
    if (companyId) {
      this.loadBranchesForCompany(companyId);
    }
  }

  loadBranchesForCompany(companyId: number): void {
    this.adminService.getBranches(companyId, true).subscribe({
      next: (data) => {
        this.branches = data;
      }
    });
  }

  onCompanyChange(companyId: number | undefined): void {
    if (companyId) {
      this.loadBranchesForCompany(companyId);
      this.editUser.branchId = undefined; // Reset branch when company changes
    } else {
      this.branches = [];
      this.editUser.branchId = undefined;
    }
  }

  saveUser(): void {
    if (!this.selectedUser) return;

    // Ensure default company and branch are set if not already set
    if (!this.editUser.companyId && this.defaultCompanyId) {
      this.editUser.companyId = this.defaultCompanyId;
    }
    if (!this.editUser.branchId && this.defaultBranchId) {
      this.editUser.branchId = this.defaultBranchId;
    }

    this.adminService.updateUser(this.selectedUser.userId, this.editUser).subscribe({
      next: () => {
        this.showEditModal = false;
        this.selectedUser = null;
        this.loadUsers();
      }
    });
  }

  toggleActive(user: UserDetail): void {
    this.adminService.updateUser(user.userId, { isActive: !user.isActive }).subscribe({
      next: () => {
        this.loadUsers();
      }
    });
  }

  deleteUser(user: UserDetail): void {
    if (user.isActive) {
      alert('Only inactive users can be deleted.');
      return;
    }

    const confirmed = confirm(
      `Delete user "${user.username}" permanently from the database?\n\nThis action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    this.adminService.deleteUser(user.userId).subscribe({
      next: () => {
        this.tableRefreshTrigger++;
        this.loadUsers();
      },
      error: (err) => {
        const message = err?.error?.message || 'Failed to delete user.';
        alert(message);
      }
    });
  }

  selectRole(roleId: number | undefined): void {
    this.selectedRoleId = roleId;
    this.filterRoleId = roleId; // Keep filterRoleId in sync for backward compatibility
    // Trigger table refresh
    this.tableRefreshTrigger++;
    this.loadUsers(); // Keep for backward compatibility
  }

  applyFilters(): void {
    // Trigger table refresh
    this.tableRefreshTrigger++;
    this.loadUsers(); // Keep for backward compatibility
  }

  clearFilters(): void {
    this.filterRoleId = undefined;
    this.selectedRoleId = undefined;
    this.filterIsActive = this.inactiveOnlyPage ? false : true;
    this.tableRefreshTrigger++;
    this.loadUsers();
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
    // Check for Owner Operator role first (more specific)
    if (roleLower === 'owner operator' || 
        roleLower === 'owneroperator' || 
        roleLower === 'owner-operator' ||
        roleLower.includes('owner operator')) {
      return 'RO';
    }
    // Check for Driver or Drivers role - these are displayed as "Owner Operators" so use RO prefix
    if (roleLower === 'driver' || roleLower === 'drivers') {
      return 'RO';
    }
    // All other roles get RE prefix
    return 'RE';
  }

  getDisplayRoleName(roleName: string | null | undefined): string {
    if (!roleName) return 'N/A';
    const roleLower = roleName.toLowerCase();
    // Rename "Driver" or "Drivers" to "Owner Operators"
    if (roleLower === 'driver' || roleLower === 'drivers') {
      return 'Owner Operators';
    }
    return roleName;
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DriverService } from '../../../core/services/driver.service';
import { ComplianceService } from '../../../core/services/compliance.service';
import { EquipmentService } from '../../../core/services/equipment.service';
import { AuthService } from '../../../core/services/auth';
import { environment } from '../../../../environments/environment';
import { SVGTreeService } from './svg-tree.service';
import { MLMTreeService } from './mlm-tree.service';
import { TreeNodeComponent } from './tree-node.component';
import { 
  DriverDetail, 
  DriverDocument, 
  SafetyTraining, 
  DriverSettlement,
  AddDriverDocumentRequest,
  AddSafetyTrainingRequest,
  CreateDriverSettlementRequest,
  ReferralTree,
  ReferralEarning,
  ReferralDriver,
  ReferralLevel
} from '../../../core/models/driver.model';
import { Incident } from '../../../core/models/compliance.model';
import { Equipment } from '../../../core/models/equipment.model';

@Component({
  selector: 'app-driver-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TreeNodeComponent],
  templateUrl: './driver-detail.html',
  styleUrl: './driver-detail.scss',
})
export class DriverDetailComponent implements OnInit, OnDestroy {
  driverId!: number;
  driver: DriverDetail | null = null;
  loading = true;
  activeTab: string = 'profile';
  isMyProfile = false; // Flag to track if viewing own profile via my-profile route
  referralsOnlyMode = false; // When true, show only referrals content (no tabs) for /drivers/my-referrals
  private navigationSubscription?: Subscription;
  private isInitialLoad = true; // Track if this is the initial component load
  referralTree: ReferralTree | null = null;
  processedReferralTrees: ReferralTree[] = []; // Multiple trees when users have more than 2 referrals
  referralEarnings: ReferralEarning[] = [];
  loadingReferralTree = false;
  loadingReferralEarnings = false;
  recalculatingEarnings = false;
  referralTreeView: 'cards' | 'tree' = 'cards'; // Toggle between card view and tree view
  
  // Expand/collapse state for tree nodes
  expandedNodes: Set<number> = new Set();
  selectedNodeId: number | null = null;
  
  // Driver Info Modal
  showDriverInfoModal = false;
  selectedDriverInfo: ReferralDriver | null = null;

  // Document Management
  showDocumentModal = false;
  isReuploading = false; // Track if we're reuploading an expired document
  documentForm: AddDriverDocumentRequest = {
    driverId: 0,
    documentType: '',
    filePath: '',
    expiryDate: ''
  };
  documentTypes = ['License', 'Medical', 'Insurance', 'CDL', 'DrugTest', 'Other'];
  selectedFile: File | null = null;
  uploadMode: 'url' | 'file' = 'file'; // Default to file upload
  uploading = false;
  documentFilter: 'all' | 'expired' | 'expiring' = 'all';
  
  // Document Approval
  showRejectModal = false;
  selectedDocumentForRejection: DriverDocument | null = null;
  rejectionReason = '';

  // Training Management
  showTrainingModal = false;
  trainingForm: AddSafetyTrainingRequest = {
    driverId: 0,
    trainingName: '',
    completionDate: '',
    certificatePath: '',
    notes: ''
  };

  // Settlement Management
  showSettlementModal = false;
  earningsChartPeriod: '6months' | '12months' | 'all' = '12months';
  earningsChartData: { month: string; earnings: number }[] = [];
  earningsChartLoading = false;
  settlementForm: CreateDriverSettlementRequest = {
    driverId: 0,
    periodStart: '',
    periodEnd: '',
    totalEarnings: 0,
    totalDeductions: 0,
    notes: ''
  };
  settlementFormErrors: { totalEarnings?: string; totalDeductions?: string; netPay?: string } = {};

  // Incidents Management
  incidents: Incident[] = [];
  filteredIncidents: Incident[] = [];
  loadingIncidents = false;
  incidentResolvedFilter: boolean | null = null;
  incidentSeverityFilter: string = '';
  incidentTypeFilter: string = '';
  incidentSearchTerm: string = '';
  incidentSeverityOptions = ['Low', 'Medium', 'High', 'Critical'];
  incidentTypeOptions = ['Accident', 'NearMiss', 'Injury', 'PropertyDamage', 'Other'];
  complianceItemFilter: 'all' | 'expired' | 'expiring' | 'missing' | 'rejected' = 'all';
  
  // Equipments Management
  equipments: Equipment[] = [];
  loadingEquipments = false;

  private readonly complianceExpiringSoonThresholdDays = 30;

  /** Tabs not shown to Dispatcher on `/drivers/:id` (driver management view). */
  private readonly dispatcherHiddenDriverDetailTabKeys: string[] = [
    'settlements',
    'referrals',
    'referral-earnings',
    'incidents',
  ];

  readonly driverDetailTabDefinitions: { key: string; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'documents', label: 'Documents' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'performance', label: 'Performance' },
    { key: 'equipments', label: 'Equipments' },
    { key: 'training', label: 'Training' },
    { key: 'settlements', label: 'Settlements' },
    { key: 'referrals', label: 'Referral Tree' },
    { key: 'referral-earnings', label: 'Referral Earnings' },
    { key: 'incidents', label: 'Incidents' },
  ];

  get hideFinancialTabsForDispatcher(): boolean {
    return (
      !this.isMyProfile &&
      !this.referralsOnlyMode &&
      this.authService.hasRole('Dispatcher')
    );
  }

  get driverDetailTabs(): { key: string; label: string }[] {
    if (!this.hideFinancialTabsForDispatcher) {
      return this.driverDetailTabDefinitions;
    }
    return this.driverDetailTabDefinitions.filter(
      (t) => !this.dispatcherHiddenDriverDetailTabKeys.includes(t.key)
    );
  }

  constructor(
    private driverService: DriverService,
    private complianceService: ComplianceService,
    private equipmentService: EquipmentService,
    private router: Router,
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private svgTreeService: SVGTreeService,
    private mlmTreeService: MLMTreeService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Check if this is the "my-profile" or "my-referrals" route (no id parameter)
    const routePath = this.route.snapshot.routeConfig?.path;
    if (routePath === 'my-profile' || routePath === 'my-referrals') {
      this.isMyProfile = true;
      if (routePath === 'my-referrals') {
        this.activeTab = 'referrals';
        this.referralsOnlyMode = true;
      }
      // Load current driver's profile
      this.loadMyProfile();
    } else {
      this.isMyProfile = false;
      // Get driverId from route snapshot synchronously on initial load
      const snapshotDriverId = this.route.snapshot.paramMap.get('id');
      if (snapshotDriverId) {
        const initialDriverId = +snapshotDriverId;
        if (initialDriverId) {
          this.driverId = initialDriverId;
          this.loadDriver();
        }
      }
      
      // Subscribe to route parameter changes to handle navigation to different drivers
      this.route.paramMap.subscribe(params => {
        const newDriverId = +params.get('id')!;
        if (newDriverId && newDriverId !== this.driverId) {
          // Reset tree state when navigating to a different driver
          this.resetTreeState();
          this.driverId = newDriverId;
          this.loadDriver();
          this.loadReferralTree();
          this.loadReferralEarnings();
        } else if (!this.driverId && newDriverId) {
          this.driverId = newDriverId;
          this.loadDriver();
        }
      });
    }

    // Read query params to set active tab (only override if not already set by my-referrals route)
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam && this.isValidTab(tabParam)) {
      this.activeTab = tabParam;
    } else if (tabParam && !this.isValidTab(tabParam)) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    // Subscribe to query parameter changes to handle tab navigation
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab && !this.isValidTab(tab)) {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { tab: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      }
      if (tab && this.isValidTab(tab) && tab !== this.activeTab) {
        this.activeTab = tab;
        // Only load tab data if driverId is set
        if (this.driverId || this.isMyProfile) {
          this.loadTabData(tab);
        }
      }
    });

    // Subscribe to navigation events to refresh data when returning to this page
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        // Skip the initial navigation event (component load)
        if (this.isInitialLoad) {
          this.isInitialLoad = false;
          return;
        }

        const url = event.urlAfterRedirects || event.url;
        // Check if we're navigating back to this driver detail page
        if (url && this.driverId && (url.includes(`/drivers/${this.driverId}`) || url.includes('/drivers/my-profile') || url.includes('/drivers/my-referrals'))) {
          // Refresh driver data if on settlements tab (settlements might have been updated)
          // This ensures settlements are always fresh when viewing the tab
          if (this.activeTab === 'settlements') {
            this.loadDriver();
          }
        }
      });
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
    }
  }

  loadMyProfile(): void {
    this.loading = true;
    this.driverService.getMyProfile().subscribe({
      next: (data) => {
        // Ensure settlements and other arrays are initialized
        if (data) {
          if (!data.settlements) data.settlements = [];
          if (!data.documents) data.documents = [];
          if (!data.trainings) data.trainings = [];
        }
        this.driver = data;
        this.driverId = data.driverId;
        this.loading = false;
        this.loadReferralTree();
        this.loadReferralEarnings();
        // Load tab-specific data if there's a tab query param
        const tabParam = this.route.snapshot.queryParamMap.get('tab');
        if (tabParam && this.isValidTab(tabParam)) {
          this.loadTabDataAfterDriverLoaded(tabParam);
        }
      },
      error: () => {
        this.loading = false;
        alert('Failed to load your profile');
        this.router.navigate(['/dashboard']);
      }
    });
  }

  /**
   * Reset tree state when navigating to a different driver
   */
  private resetTreeState(): void {
    this.expandedNodes.clear();
    this.selectedNodeId = null;
    this.referralTree = null;
    this.processedReferralTrees = [];
  }

  loadDriver(): void {
    if (!this.driverId) return;
    this.loading = true;
    const query = this.isMyProfile 
      ? this.driverService.getMyProfile()
      : this.driverService.getDriverById(this.driverId);
    
    query.subscribe({
      next: (data) => {
        // Ensure settlements and other arrays are initialized
        if (data) {
          if (!data.settlements) data.settlements = [];
          if (!data.documents) data.documents = [];
          if (!data.trainings) data.trainings = [];
        }
        this.driver = data;
        this.loading = false;
        // Load tab-specific data based on active tab
        this.loadTabDataAfterDriverLoaded(this.activeTab);
      },
      error: () => {
        this.loading = false;
        alert('Failed to load driver details');
        this.router.navigate(['/drivers']);
      }
    });
  }

  /**
   * Check if a tab name is valid for the current user and route
   */
  private isValidTab(tab: string): boolean {
    if (!this.driverDetailTabDefinitions.some((t) => t.key === tab)) {
      return false;
    }
    if (
      this.hideFinancialTabsForDispatcher &&
      this.dispatcherHiddenDriverDetailTabKeys.includes(tab)
    ) {
      return false;
    }
    return true;
  }

  /** Profile quick-stats: navigate to tab unless hidden for Dispatcher on driver detail. */
  openProfileStatTab(tab: 'settlements' | 'referrals'): void {
    if (this.hideFinancialTabsForDispatcher) {
      return;
    }
    this.setTab(tab);
  }

  /**
   * Load data for a specific tab after driver is loaded
   * This method doesn't reload the driver, only loads tab-specific data
   */
  private loadTabDataAfterDriverLoaded(tab: string): void {
    if (tab === 'settlements') {
      // Load chart data for settlements tab
      setTimeout(() => {
        this.loadEarningsChartData();
      }, 0);
    } else if (tab === 'referrals') {
      this.loadReferralTree();
    } else if (tab === 'referral-earnings') {
      this.loadReferralEarnings();
    } else if (tab === 'incidents') {
      this.loadIncidents();
    } else if (tab === 'equipments') {
      this.loadEquipments();
    }
    // For documents, training, performance, profile - data is already in driver object, no need to load
  }

  /**
   * Load data for a specific tab
   */
  private loadTabData(tab: string): void {
    if (tab === 'documents' || tab === 'training' || tab === 'settlements' || tab === 'performance') {
      // For settlements tab, load driver data first, then chart data
      if (tab === 'settlements') {
        if (this.driver && this.driver.settlements) {
          // If driver data is already loaded, just load chart data
          this.loadEarningsChartData();
        } else {
          // Otherwise, load driver data first, chart will load after
          this.loadDriver();
        }
      } else {
        this.loadDriver(); // Reload to get latest data (includes performance for performance tab)
      }
    } else if (tab === 'referrals') {
      this.loadReferralTree();
    } else if (tab === 'referral-earnings') {
      this.loadReferralEarnings();
    } else if (tab === 'incidents') {
      this.loadIncidents();
    } else if (tab === 'equipments') {
      this.loadEquipments();
    }
  }

  setTab(tab: string): void {
    if (!this.isValidTab(tab)) {
      return;
    }
    // Prevent duplicate tab clicks
    if (this.activeTab === tab) {
      return;
    }
    
    this.activeTab = tab;
    // Update URL query params without reloading
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
    
    this.loadTabData(tab);
  }

  loadReferralTree(): void {
    if (!this.driverId) return;
    
    // Prevent duplicate calls
    if (this.loadingReferralTree) {
      return;
    }

    // If we already have the data for the current driver and we're on the referrals tab, don't reload
    // But if driverId changed, we need to reload
    if (this.referralTree && this.activeTab === 'referrals' && this.referralTree.driverId === this.driverId) {
      return;
    }

    // Reset tree state before loading new data
    this.expandedNodes.clear();
    this.selectedNodeId = null;
    this.referralTree = null;
    this.processedReferralTrees = [];

    this.loadingReferralTree = true;
    
    // Use "me" endpoint if viewing own profile via my-profile route
    const referralTreeObservable = this.isMyProfile 
      ? this.driverService.getMyReferralTree()
      : this.driverService.getReferralTree(this.driverId);
    
    referralTreeObservable.subscribe({
      next: (data) => {
        this.referralTree = data;
        this.processedReferralTrees = this.processReferralTree(data);
        
        // Auto-expand root node's direct children (Level 2) for better UX
        const level2 = data.referralLevels?.find(l => l.level === 2);
        if (level2 && level2.drivers) {
          level2.drivers.forEach(driver => {
            this.expandedNodes.add(driver.driverId);
          });
        }
        
        this.loadingReferralTree = false;
      },
      error: (err) => {
        console.error('Error loading referral tree:', err);
        this.loadingReferralTree = false;
      }
    });
  }

  loadReferralEarnings(): void {
    if (!this.driverId) return;
    
    this.loadingReferralEarnings = true;
    
    // Use "me" endpoint if viewing own profile via my-profile route
    const referralEarningsObservable = this.isMyProfile
      ? this.driverService.getMyReferralEarnings()
      : this.driverService.getReferralEarnings(this.driverId);
    
    referralEarningsObservable.subscribe({
      next: (data) => {
        this.referralEarnings = data;
        this.loadingReferralEarnings = false;
      },
      error: () => {
        this.loadingReferralEarnings = false;
      }
    });
  }

  recalculateReferralEarnings(): void {
    if (!confirm('This will recalculate referral earnings for all settlements of drivers you referred. Continue?')) {
      return;
    }

    this.recalculatingEarnings = true;
    this.driverService.recalculateReferralEarnings(this.driverId).subscribe({
      next: (result) => {
        this.recalculatingEarnings = false;
        alert(result.message);
        // Reload referral earnings to show the newly calculated ones
        this.loadReferralEarnings();
      },
      error: (err) => {
        this.recalculatingEarnings = false;
        console.error('Error recalculating referral earnings:', err);
        const errorMessage = err.error?.message || err.error?.details || err.message || 'Failed to recalculate referral earnings';
        alert(`Error: ${errorMessage}`);
      }
    });
  }

  // Document Management
  openDocumentModal(): void {
    this.isReuploading = false;
    this.documentForm = {
      driverId: this.driverId,
      documentType: '',
      filePath: '',
      expiryDate: ''
    };
    this.selectedFile = null;
    this.uploadMode = 'file';
    this.showDocumentModal = true;
  }

  openDocumentModalForType(documentType: string): void {
    this.isReuploading = false;
    this.documentForm = {
      driverId: this.driverId,
      documentType,
      filePath: '',
      expiryDate: ''
    };
    this.selectedFile = null;
    this.uploadMode = 'file';
    this.showDocumentModal = true;
  }

  openReuploadModal(doc: DriverDocument): void {
    this.isReuploading = true;
    this.documentForm = {
      driverId: this.driverId,
      documentType: doc.documentType, // Pre-fill with the expired document's type
      filePath: '',
      expiryDate: ''
    };
    this.selectedFile = null;
    this.uploadMode = 'file';
    this.showDocumentModal = true;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  addDocument(): void {
    if (this.uploadMode === 'file' && this.selectedFile) {
      // Upload file
      this.uploading = true;
      this.driverService.uploadDriverDocument(
        this.driverId,
        this.selectedFile,
        this.documentForm.documentType,
        this.documentForm.expiryDate || undefined
      ).subscribe({
        next: () => {
          this.uploading = false;
          this.showDocumentModal = false;
          this.selectedFile = null;
          this.isReuploading = false;
          this.loadDriver();
        },
        error: (err) => {
          this.uploading = false;
          console.error('Error uploading document:', err);
          alert(err.error?.message || 'Failed to upload document');
        }
      });
    } else if (this.uploadMode === 'url' && this.documentForm.filePath) {
      // Add document with URL
      this.driverService.addDriverDocument(this.driverId, this.documentForm).subscribe({
        next: () => {
          this.showDocumentModal = false;
          this.isReuploading = false;
          this.loadDriver();
        },
        error: (err) => {
          console.error('Error adding document:', err);
          alert('Failed to add document');
        }
      });
    } else {
      alert('Please select a file or provide a file path');
    }
  }

  // Training Management
  openTrainingModal(): void {
    this.trainingForm = {
      driverId: this.driverId,
      trainingName: '',
      completionDate: new Date().toISOString().split('T')[0],
      certificatePath: '',
      notes: ''
    };
    this.showTrainingModal = true;
  }

  addTraining(): void {
    this.driverService.addSafetyTraining(this.driverId, this.trainingForm).subscribe({
      next: () => {
        this.showTrainingModal = false;
        this.loadDriver();
      },
      error: (err) => {
        console.error('Error adding training:', err);
        alert('Failed to add training');
      }
    });
  }

  // Settlement Management
  openSettlementModal(): void {
    // Ensure driverId is set from route params (in case it wasn't set yet)
    if (!this.driverId && !this.isMyProfile) {
      const routeDriverId = this.route.snapshot.paramMap.get('id');
      if (routeDriverId) {
        this.driverId = +routeDriverId;
      }
    }
    
    // Validate driverId is available
    if (!this.driverId) {
      alert('Driver ID is not available. Please refresh the page.');
      return;
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    this.settlementForm = {
      driverId: this.driverId,
      periodStart: startOfMonth.toISOString().split('T')[0],
      periodEnd: endOfMonth.toISOString().split('T')[0],
      totalEarnings: 0,
      totalDeductions: 0,
      notes: ''
    };
    this.settlementFormErrors = {};
    this.showSettlementModal = true;
  }

  getNetPay(): number {
    return (this.settlementForm.totalEarnings || 0) - (this.settlementForm.totalDeductions || 0);
  }

  createSettlement(): void {
    // Reset errors
    this.settlementFormErrors = {};

    // Validate form
    let hasErrors = false;

    if (this.settlementForm.totalEarnings < 0) {
      this.settlementFormErrors.totalEarnings = 'Total Earnings cannot be negative';
      hasErrors = true;
    }

    if (this.settlementForm.totalDeductions < 0) {
      this.settlementFormErrors.totalDeductions = 'Total Deductions cannot be negative';
      hasErrors = true;
    }

    // Validate Net Pay is not negative
    const netPay = this.getNetPay();
    if (netPay < 0) {
      this.settlementFormErrors.netPay = 'Net Pay cannot be negative. Total Earnings must be greater than or equal to Total Deductions.';
      hasErrors = true;
    }

    if (hasErrors) {
      return;
    }

    // Additional validation: ensure required fields are filled
    if (!this.settlementForm.periodStart || !this.settlementForm.periodEnd) {
      alert('Please fill in all required fields');
      return;
    }

    // Ensure driverId is set from route params (in case it wasn't set yet)
    if (!this.driverId && !this.isMyProfile) {
      const routeDriverId = this.route.snapshot.paramMap.get('id');
      if (routeDriverId) {
        this.driverId = +routeDriverId;
      }
    }

    // Validate driverId is available
    if (!this.driverId) {
      alert('Driver ID is not available. Please refresh the page.');
      return;
    }

    // Ensure settlementForm has the correct driverId from route
    const currentDriverId = this.driverId;
    this.settlementForm.driverId = currentDriverId;

    this.driverService.createDriverSettlement(currentDriverId, this.settlementForm).subscribe({
      next: () => {
        this.showSettlementModal = false;
        this.loadDriver();
      },
      error: (err) => {
        console.error('Error creating settlement:', err);
        alert('Failed to create settlement');
      }
    });
  }

  onSettlementFieldChange(field: 'totalEarnings' | 'totalDeductions'): void {
    // Validate on change - ensure value is not negative
    const value = this.settlementForm[field];
    
    // Handle NaN, null, or undefined - set to 0 only on blur, not while typing
    if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
      // Only set to 0 if the field is being blurred, not during typing
      return;
    }
    
    // If value is negative, set to 0 and show error
    if (value < 0) {
      this.settlementForm[field] = 0;
      this.settlementFormErrors[field] = 'Value cannot be negative';
    } else {
      // Clear error if value is valid
      if (this.settlementFormErrors[field]) {
        delete this.settlementFormErrors[field];
      }
    }

    // Check Net Pay after field change
    const netPay = this.getNetPay();
    if (netPay < 0) {
      this.settlementFormErrors.netPay = 'Net Pay cannot be negative. Total Earnings must be greater than or equal to Total Deductions.';
    } else {
      // Clear Net Pay error if it's now valid
      if (this.settlementFormErrors.netPay) {
        delete this.settlementFormErrors.netPay;
      }
    }
  }

  onSettlementInput(event: Event, field: 'totalEarnings' | 'totalDeductions'): void {
    const input = event.target as HTMLInputElement;
    const inputValue = input.value.trim();
    
    // Allow empty input while typing
    if (inputValue === '' || inputValue === '-') {
      return; // Let user continue typing
    }
    
    let value = parseFloat(inputValue);
    
    // Only validate if we have a complete number
    if (isNaN(value)) {
      return; // Allow incomplete input while typing
    }
    
    // If value is negative, prevent it
    if (value < 0) {
      // Remove the minus sign and update
      const positiveValue = Math.abs(value);
      input.value = positiveValue.toString();
      this.settlementForm[field] = positiveValue;
      this.settlementFormErrors[field] = 'Value cannot be negative';
    } else {
      // Update the model with the valid value
      this.settlementForm[field] = value;
      
      // Clear error if value is valid
      if (this.settlementFormErrors[field]) {
        delete this.settlementFormErrors[field];
      }
    }

    // Check Net Pay after input change
    const netPay = this.getNetPay();
    if (netPay < 0) {
      this.settlementFormErrors.netPay = 'Net Pay cannot be negative. Total Earnings must be greater than or equal to Total Deductions.';
    } else {
      // Clear Net Pay error if it's now valid
      if (this.settlementFormErrors.netPay) {
        delete this.settlementFormErrors.netPay;
      }
    }
  }

  preventNegativeInput(event: KeyboardEvent): void {
    // Prevent minus sign from being entered
    // Allow other keys like backspace, delete, arrow keys, tab, etc.
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Home', 'End'];
    
    if (event.key === '-') {
      event.preventDefault();
      return;
    }
    
    // Allow control keys (Ctrl+A, Ctrl+C, etc.)
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    
    // Allow allowed keys
    if (allowedKeys.includes(event.key)) {
      return;
    }
  }

  navigateToEdit(): void {
    this.router.navigate(['/drivers', this.driverId, 'edit']);
  }

  navigateBack(): void {
    this.router.navigate(['/drivers']);
  }

  getDaysUntilExpiry(expiryDate: string | undefined): number | null {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  getDaysUntilExpiryDisplay(expiryDate: string | undefined): { days: number; isExpired: boolean } | null {
    const days = this.getDaysUntilExpiry(expiryDate);
    if (days === null) return null;
    return { days: Math.abs(days), isExpired: days < 0 };
  }

  getComplianceSummary(): {
    expiredCount: number;
    expiringSoonCount: number;
    missingCount: number;
    rejectedCount: number;
    totalIssues: number;
    isCompliant: boolean;
  } {
    const checklistItems = this.getComplianceChecklistItems();
    const requiredDocuments = this.getComplianceRequiredDocuments();

    const expiredCount = checklistItems.filter(i => i.status === 'expired').length
      + requiredDocuments.filter(d => d.expiryState === 'expired').length;
    const expiringSoonCount = checklistItems.filter(i => i.status === 'expiring').length
      + requiredDocuments.filter(d => d.expiryState === 'expiring').length;
    const missingCount = checklistItems.filter(i => i.status === 'missing').length
      + requiredDocuments.filter(d => d.missing).length;
    const rejectedCount = requiredDocuments.filter(d => d.rejected).length;
    const totalIssues = expiredCount + expiringSoonCount + missingCount + rejectedCount;

    return {
      expiredCount,
      expiringSoonCount,
      missingCount,
      rejectedCount,
      totalIssues,
      isCompliant: totalIssues === 0 && !!this.driver?.isDQFComplete
    };
  }

  getComplianceOverallStatusLabel(): string {
    return this.getComplianceSummary().isCompliant ? 'Compliant' : 'Needs Attention';
  }

  getComplianceOverallStatusClass(): string {
    return this.getComplianceSummary().isCompliant ? 'bg-success' : 'bg-danger';
  }

  getComplianceChecklistItems(): Array<{
    key: string;
    label: string;
    date?: string;
    status: 'valid' | 'expiring' | 'expired' | 'missing';
    daysUntilExpiry: number | null;
    statusText: string;
    recommendedAction: string;
    sortOrder: number;
  }> {
    const compliance = this.driver?.compliance;
    const items = [
      this.buildComplianceChecklistItem('cdl', 'CDL Expiry', compliance?.cdlExpiry),
      this.buildComplianceChecklistItem('medical', 'Medical Card Expiry', compliance?.medicalCardExpiry),
      this.buildComplianceChecklistItem('drug-test', 'Drug Test Date', compliance?.drugTestDate),
      this.buildComplianceChecklistItem('last-review', 'Last Review Date', compliance?.lastReviewDate),
    ];

    return items.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }

  getFilteredComplianceChecklistItems(): Array<{
    key: string;
    label: string;
    date?: string;
    status: 'valid' | 'expiring' | 'expired' | 'missing';
    daysUntilExpiry: number | null;
    statusText: string;
    recommendedAction: string;
    sortOrder: number;
  }> {
    const items = this.getComplianceChecklistItems();
    switch (this.complianceItemFilter) {
      case 'expired':
        return items.filter(i => i.status === 'expired');
      case 'expiring':
        return items.filter(i => i.status === 'expiring');
      case 'missing':
        return items.filter(i => i.status === 'missing');
      default:
        return items;
    }
  }

  private buildComplianceChecklistItem(
    key: string,
    label: string,
    date?: string
  ): {
    key: string;
    label: string;
    date?: string;
    status: 'valid' | 'expiring' | 'expired' | 'missing';
    daysUntilExpiry: number | null;
    statusText: string;
    recommendedAction: string;
    sortOrder: number;
  } {
    const daysUntilExpiry = this.getDaysUntilExpiry(date);
    let status: 'valid' | 'expiring' | 'expired' | 'missing' = 'missing';
    let recommendedAction = 'Update record';
    let sortOrder = 3;

    if (daysUntilExpiry === null) {
      status = 'missing';
      recommendedAction = 'Add missing date';
      sortOrder = 0;
    } else if (daysUntilExpiry < 0) {
      status = 'expired';
      recommendedAction = 'Update immediately';
      sortOrder = 0;
    } else if (daysUntilExpiry <= this.complianceExpiringSoonThresholdDays) {
      status = 'expiring';
      recommendedAction = 'Renew soon';
      sortOrder = 1;
    } else {
      status = 'valid';
      recommendedAction = 'No action needed';
      sortOrder = 3;
    }

    return {
      key,
      label,
      date,
      status,
      daysUntilExpiry,
      statusText: this.getComplianceStatusText(daysUntilExpiry),
      recommendedAction,
      sortOrder
    };
  }

  getComplianceStatusText(daysUntilExpiry: number | null): string {
    if (daysUntilExpiry === null) return 'Missing';
    if (daysUntilExpiry < 0) return `Expired ${Math.abs(daysUntilExpiry)} day(s) ago`;
    if (daysUntilExpiry <= this.complianceExpiringSoonThresholdDays) return `Expires in ${daysUntilExpiry} day(s)`;
    return `Valid (${daysUntilExpiry} day(s) remaining)`;
  }

  getComplianceStatusBadgeClass(status: 'valid' | 'expiring' | 'expired' | 'missing'): string {
    switch (status) {
      case 'expired':
        return 'bg-danger';
      case 'expiring':
        return 'bg-warning text-dark';
      case 'missing':
        return 'bg-secondary';
      default:
        return 'bg-success';
    }
  }

  getComplianceRequiredDocuments(): Array<{
    key: string;
    label: string;
    document: DriverDocument | null;
    missing: boolean;
    rejected: boolean;
    approvalText: string;
    approvalClass: string;
    expiryText: string;
    expiryClass: string;
    expiryState: 'valid' | 'expiring' | 'expired' | 'missing';
    actionText: string;
    sortOrder: number;
  }> {
    const requiredMappings: Array<{ key: string; label: string; matches: string[] }> = [
      { key: 'cdl', label: 'CDL / License Document', matches: ['cdl', 'license'] },
      { key: 'medical', label: 'Medical Card Document', matches: ['medical'] },
      { key: 'insurance', label: 'Insurance Document', matches: ['insurance'] },
      { key: 'drugtest', label: 'Drug Test Document', matches: ['drugtest', 'drug test'] }
    ];

    return requiredMappings
      .map((mapping) => {
        const document = this.getLatestDocumentByTypes(mapping.matches);
        const missing = !document;
        const rejected = !!document?.isRejected;
        const daysUntilExpiry = this.getDaysUntilExpiry(document?.expiryDate);

        let expiryState: 'valid' | 'expiring' | 'expired' | 'missing' = 'missing';
        if (!document || daysUntilExpiry === null) {
          expiryState = 'missing';
        } else if (daysUntilExpiry < 0) {
          expiryState = 'expired';
        } else if (daysUntilExpiry <= this.complianceExpiringSoonThresholdDays) {
          expiryState = 'expiring';
        } else {
          expiryState = 'valid';
        }

        const approvalText = !document
          ? 'Missing'
          : document.isRejected
            ? 'Rejected'
            : document.isApproved
              ? 'Approved'
              : 'Pending Review';
        const approvalClass = !document
          ? 'bg-secondary'
          : document.isRejected
            ? 'bg-danger'
            : document.isApproved
              ? 'bg-success'
              : 'bg-warning text-dark';

        const expiryText = this.getComplianceStatusText(daysUntilExpiry);
        const expiryClass = this.getComplianceStatusBadgeClass(expiryState);

        const actionText = missing || rejected || expiryState === 'expired'
          ? 'Reupload document'
          : !document?.isApproved
            ? 'Wait for approval'
            : expiryState === 'expiring'
              ? 'Renew soon'
              : 'No action needed';

        const sortOrder = missing || rejected || expiryState === 'expired'
          ? 0
          : expiryState === 'expiring'
            ? 1
            : 3;

        return {
          key: mapping.key,
          label: mapping.label,
          document: document ?? null,
          missing,
          rejected,
          approvalText,
          approvalClass,
          expiryText,
          expiryClass,
          expiryState,
          actionText,
          sortOrder
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  }

  getFilteredComplianceRequiredDocuments(): Array<{
    key: string;
    label: string;
    document: DriverDocument | null;
    missing: boolean;
    rejected: boolean;
    approvalText: string;
    approvalClass: string;
    expiryText: string;
    expiryClass: string;
    expiryState: 'valid' | 'expiring' | 'expired' | 'missing';
    actionText: string;
    sortOrder: number;
  }> {
    const docs = this.getComplianceRequiredDocuments();
    switch (this.complianceItemFilter) {
      case 'expired':
        return docs.filter(d => d.expiryState === 'expired');
      case 'expiring':
        return docs.filter(d => d.expiryState === 'expiring');
      case 'missing':
        return docs.filter(d => d.missing);
      case 'rejected':
        return docs.filter(d => d.rejected);
      default:
        return docs;
    }
  }

  private getLatestDocumentByTypes(typeMatches: string[]): DriverDocument | undefined {
    if (!this.driver?.documents?.length) return undefined;
    const normalizedMatches = typeMatches.map(m => m.toLowerCase());
    const matchedDocuments = this.driver.documents.filter((doc) => {
      const docType = (doc.documentType || '').toLowerCase();
      return normalizedMatches.some(match => docType.includes(match));
    });

    if (!matchedDocuments.length) return undefined;

    return matchedDocuments.sort((a, b) => {
      const aDate = new Date(a.uploadedAt).getTime();
      const bDate = new Date(b.uploadedAt).getTime();
      return bDate - aDate;
    })[0];
  }

  getDocumentTypeForComplianceKey(key: string): string {
    switch (key) {
      case 'medical':
        return 'Medical';
      case 'insurance':
        return 'Insurance';
      case 'drugtest':
        return 'DrugTest';
      default:
        return 'CDL';
    }
  }

  getFilteredDocuments(): DriverDocument[] {
    if (!this.driver || !this.driver.documents) return [];
    switch (this.documentFilter) {
      case 'expired':
        return this.driver.documents.filter(doc => doc.isExpired);
      case 'expiring':
        return this.driver.documents.filter(doc => doc.isExpiringSoon && !doc.isExpired);
      default:
        return this.driver.documents;
    }
  }

  getExpiredDocumentsCount(): number {
    if (!this.driver || !this.driver.documents) return 0;
    return this.driver.documents.filter(doc => doc.isExpired).length;
  }

  getExpiringDocumentsCount(): number {
    if (!this.driver || !this.driver.documents) return 0;
    return this.driver.documents.filter(doc => doc.isExpiringSoon && !doc.isExpired).length;
  }

  getTotalEarnings(): number {
    if (!this.driver || !this.driver.settlements || this.driver.settlements.length === 0) return 0;
    return this.driver.settlements
      .filter(s => s.status === 'Paid')
      .reduce((sum, s) => sum + (s.netPay || 0), 0);
  }

  getCurrentMonthEarnings(): number {
    if (!this.driver || !this.driver.settlements || this.driver.settlements.length === 0) return 0;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.driver.settlements
      .filter(s => {
        if (s.status !== 'Paid') return false;
        const periodStart = s.periodStart ? new Date(s.periodStart) : null;
        return periodStart && periodStart >= currentMonthStart;
      })
      .reduce((sum, s) => sum + (s.netPay || 0), 0);
  }

  getCompletedLoadsCount(): number {
    if (!this.driver || !this.driver.performance) return 0;
    return this.driver.performance.totalDeliveries || 0;
  }

  getReferralEarningsTotal(): number {
    if (!this.referralEarnings || this.referralEarnings.length === 0) return 0;
    return this.referralEarnings
      .filter(e => e.status === 'Paid')
      .reduce((sum, e) => sum + (e.commissionAmount || 0), 0);
  }

  loadEarningsChartData(): void {
    if (!this.driver || !this.driver.settlements) {
      console.log('loadEarningsChartData: No driver or settlements data');
      return;
    }
    
    this.earningsChartLoading = true;
    
    const now = new Date();
    let startDate: Date;
    
    switch (this.earningsChartPeriod) {
      case '6months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        break;
      case '12months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        break;
      default:
        startDate = new Date(0); // All time
    }
    
    console.log('loadEarningsChartData: Total settlements:', this.driver.settlements.length);
    console.log('loadEarningsChartData: Period:', this.earningsChartPeriod, 'Start date:', startDate);
    
    // Filter settlements by date range and status
    // Include both "Approved" and "Paid" settlements to show earnings trends
    const filteredSettlements = this.driver.settlements.filter(s => {
      const statusMatch = s.status === 'Paid' || s.status === 'Approved';
      if (!statusMatch) {
        console.log('loadEarningsChartData: Settlement filtered out by status:', s.status, s.settlementId);
        return false;
      }
      
      if (!s.periodStart) {
        console.log('loadEarningsChartData: Settlement filtered out - no periodStart:', s.settlementId);
        return false;
      }
      
      const periodStart = new Date(s.periodStart);
      const dateMatch = periodStart >= startDate;
      
      if (!dateMatch) {
        console.log('loadEarningsChartData: Settlement filtered out by date:', periodStart, 'vs', startDate, s.settlementId);
        return false;
      }
      
      return true;
    });
    
    console.log('loadEarningsChartData: Filtered settlements:', filteredSettlements.length);
    
    // Group by month
    const monthlyData = new Map<string, { earnings: number; date: Date }>();
    filteredSettlements.forEach(s => {
      if (!s.periodStart) return;
      const date = new Date(s.periodStart);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const existing = monthlyData.get(monthKey);
      if (existing) {
        monthlyData.set(monthKey, {
          earnings: existing.earnings + (s.netPay || 0),
          date: existing.date
        });
      } else {
        monthlyData.set(monthKey, {
          earnings: s.netPay || 0,
          date: date
        });
      }
    });
    
    // Convert to array and sort by date (using the actual date object, not the formatted string)
    this.earningsChartData = Array.from(monthlyData.entries())
      .map(([key, data]) => {
        return {
          month: data.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          earnings: data.earnings,
          date: data.date // Keep date for sorting
        };
      })
      .sort((a, b) => {
        // Sort by the actual date object, not the formatted string
        return a.date.getTime() - b.date.getTime();
      })
      .map(item => ({
        month: item.month,
        earnings: item.earnings
      }));
    
    console.log('loadEarningsChartData: Chart data points:', this.earningsChartData.length);
    console.log('loadEarningsChartData: Chart data:', JSON.stringify(this.earningsChartData, null, 2));
    
    // Log max value for debugging
    const maxValue = this.getChartMaxValue();
    console.log('loadEarningsChartData: Chart max value:', maxValue);
    
    // Log each data point with calculated bar height
    this.earningsChartData.forEach((data, index) => {
      const barHeight = this.getChartBarHeight(data.earnings);
      console.log(`loadEarningsChartData: Data point ${index}:`, {
        month: data.month,
        earnings: data.earnings,
        barHeightPercent: barHeight
      });
    });
    
    this.earningsChartLoading = false;
  }

  getChartMaxValue(): number {
    if (!this.earningsChartData || this.earningsChartData.length === 0) return 1000;
    return Math.max(...this.earningsChartData.map(d => d.earnings)) * 1.1; // Add 10% padding
  }

  getChartBarHeight(earnings: number): number {
    const max = this.getChartMaxValue();
    if (max === 0) return 0;
    const percentage = (earnings / max) * 100;
    // Ensure minimum height of 5% so bars are always visible (unless earnings is 0)
    return earnings > 0 ? Math.max(percentage, 5) : 0;
  }

  getChartBarHeightPx(earnings: number): number {
    const max = this.getChartMaxValue();
    if (max === 0) return 0;
    // Chart container height is 300px (no padding now, so full height is usable)
    const usableHeight = 300;
    const percentage = earnings / max;
    const heightPx = percentage * usableHeight;
    // Ensure minimum height of 10px so bars are always visible (unless earnings is 0)
    return earnings > 0 ? Math.max(heightPx, 10) : 0;
  }

  getYAxisTicks(): number[] {
    const max = this.getChartMaxValue();
    if (max === 0) return [0, 1000, 2000, 3000, 4000, 5000];
    
    const ticks: number[] = [];
    const numTicks = 5;
    const step = max / (numTicks - 1);
    
    // Generate ticks from 0 to max (ascending)
    // With flex-direction: column-reverse, the array order is reversed visually
    // So [0, ..., max] will display with max at top and 0 at bottom
    for (let i = 0; i < numTicks; i++) {
      const value = step * i;
      ticks.push(Math.round(value / 100) * 100); // Round to nearest 100
    }
    
    return ticks;
  }

  getGridLinePosition(tickValue: number): number {
    const max = this.getChartMaxValue();
    if (max === 0) return 0;
    
    // Calculate position from bottom (0% = bottom, 100% = top)
    // tickValue 0 should be at 0%, max should be at 100%
    const percentage = (tickValue / max) * 100;
    return percentage;
  }

  showChartTooltip(event: MouseEvent, data: { month: string; earnings: number }): void {
    const target = event.currentTarget as HTMLElement;
    const tooltip = target.querySelector('.chart-bar-value') as HTMLElement;
    if (tooltip) {
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateX(-50%) translateY(-8px)';
    }
    target.classList.add('chart-bar-hover');
  }

  hideChartTooltip(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const tooltip = target.querySelector('.chart-bar-value') as HTMLElement;
    if (tooltip) {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateX(-50%) translateY(0)';
    }
    target.classList.remove('chart-bar-hover');
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  formatCurrency(amount: number | undefined): string {
    if (amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Active':
      case 'Available':
        return 'badge bg-success';
      case 'OnTrip':
        return 'badge bg-primary';
      case 'Inactive':
        return 'badge bg-secondary';
      case 'OffDuty':
        return 'badge bg-warning';
      default:
        return 'badge bg-secondary';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Active':
      case 'Available':
        return 'status-active';
      case 'OnTrip':
        return 'status-ontrip';
      case 'Inactive':
        return 'status-inactive';
      case 'OffDuty':
        return 'status-offduty';
      default:
        return 'status-inactive';
    }
  }

  getSettlementStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Paid':
        return 'badge bg-success';
      case 'Approved':
        return 'badge bg-primary';
      case 'Draft':
        return 'badge bg-secondary';
      default:
        return 'badge bg-secondary';
    }
  }

  getTotalReferralEarnings(): number {
    if (!this.referralEarnings || this.referralEarnings.length === 0) {
      return 0;
    }
    return this.referralEarnings.reduce((sum, e) => sum + e.commissionAmount, 0);
  }

  getReferralLink(): string {
    if (!this.driver) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/ref/${this.driver.driverId}`;
  }

  getFileUrl(filePath: string | null | undefined): string {
    if (!filePath) return '';
    // If the filePath is already a complete URL (http:// or https://), return it as-is
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    // Remove /api from the API URL to get the base URL
    const baseUrl = environment.apiUrl.replace('/api', '');
    // Ensure filePath starts with /
    const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `${baseUrl}${path}`;
  }

  viewDocument(doc: DriverDocument): void {
    if (!this.driver) return;

    try {
      // Use backend endpoint with authentication
      const viewUrl = this.driverService.getDocumentViewUrl(this.driver.driverId, doc.docId);
      
      // Get auth token
      const token = this.authService.getToken();
      
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      // Use fetch with auth headers to download the file, then create blob URL
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
          // Clean up blob URL after a delay
          setTimeout(() => {
            try {
              if (newWindow.closed) {
                window.URL.revokeObjectURL(blobUrl);
              }
            } catch (e) {
              // Ignore errors when checking window state
            }
          }, 1000);
        }
      })
      .catch(error => {
        console.error('Error viewing document:', error);
        alert('Failed to view document. Please try again.');
      });
    } catch (error) {
      console.error('Error viewing document:', error);
      alert('Failed to view document. Please try again.');
    }
  }

  copyReferralLink(): void {
    const link = this.getReferralLink();
    if (!link) {
      alert('Referral link is not available');
      return;
    }

    // First, try to use the input field directly (most reliable)
    const inputElement = document.getElementById('referralLinkInput') as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
      inputElement.select();
      inputElement.setSelectionRange(0, 99999); // For mobile devices
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          alert('Referral link copied to clipboard!');
          return;
        }
      } catch (err) {
        console.error('execCommand failed:', err);
      }
    }

    // Try modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link).then(() => {
        alert('Referral link copied to clipboard!');
      }).catch((err) => {
        console.error('Failed to copy using clipboard API:', err);
        this.fallbackCopyToClipboard(link);
      });
    } else {
      // Use fallback for non-secure contexts or older browsers
      this.fallbackCopyToClipboard(link);
    }
  }

  private fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Make it invisible but still selectable
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        alert('Referral link copied to clipboard!');
      } else {
        alert('Failed to copy. Please manually copy the link from the input field.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy. Please manually copy the link from the input field.');
    } finally {
      document.body.removeChild(textArea);
    }
  }

  getReferralLevel(level: number): any {
    if (!this.referralTree || !this.referralTree.referralLevels) {
      return null;
    }
    return this.referralTree.referralLevels.find(l => l.level === level);
  }

  hasReferralLevel(level: number): boolean {
    if (!this.referralTree || !this.referralTree.referralLevels) {
      return false;
    }
    return this.referralTree.referralLevels.some(l => l.level === level);
  }

  getReferralLevelForTree(tree: ReferralTree, level: number): ReferralLevel | null {
    if (!tree || !tree.referralLevels) {
      return null;
    }
    return tree.referralLevels.find(l => l.level === level) || null;
  }

  hasReferralLevelForTree(tree: ReferralTree, level: number): boolean {
    if (!tree || !tree.referralLevels) {
      return false;
    }
    return tree.referralLevels.some(l => l.level === level);
  }

  /**
   * Get tree structure with accurate parent-child relationships
   * Returns organized levels with proper grouping for accurate rendering
   */
  getTreeByLevels(tree: ReferralTree): Array<{level: number, nodes: Array<{driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}>}> {
    const levelsArray: Array<{level: number, nodes: Array<{driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}>}> = [];
    
    if (!tree.referralLevels || tree.referralLevels.length === 0) {
      return levelsArray;
    }

    // Level 2 drivers (direct children of root)
    const level2 = tree.referralLevels.find(l => l.level === 2);
    if (level2 && level2.drivers) {
      const level2Nodes = level2.drivers.map((driver, index) => ({
        driver,
        parentId: tree.driverId,
        parentIndex: 0, // Root is always at index 0
        siblingIndex: index,
        siblingCount: level2.drivers.length
      }));
      levelsArray.push({ level: 2, nodes: level2Nodes });
      
      // Recursively collect nested levels with parent information
      this.collectNestedLevelsWithParents(level2.drivers, 3, levelsArray, level2Nodes);
    }

    return levelsArray;
  }

  private collectNestedLevelsWithParents(
    parentDrivers: ReferralDriver[], 
    currentLevel: number, 
    levelsArray: Array<{level: number, nodes: Array<{driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}>}>,
    parentNodes: Array<{driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}>
  ): void {
    if (currentLevel > 5) return; // Max 5 levels
    
    const currentLevelNodes: Array<{driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}> = [];
    
    // Map parent drivers to their indices in the previous level
    const parentIndexMap = new Map<number, number>();
    parentNodes.forEach((parentNode, idx) => {
      parentIndexMap.set(parentNode.driver.driverId, idx);
    });
    
    // Collect ALL children from ALL parents - ensure we get every child
    parentDrivers.forEach((parentDriver) => {
      // Check if parent has children and collect ALL of them
      if (parentDriver.children && parentDriver.children.length > 0) {
        const parentIndex = parentIndexMap.get(parentDriver.driverId);
        // Process ALL children (up to 2 per tree, but collect all that exist in processed tree)
        parentDriver.children.forEach((child, childIndex) => {
          currentLevelNodes.push({
            driver: child,
            parentId: parentDriver.driverId,
            parentIndex: parentIndex !== undefined ? parentIndex : 0,
            siblingIndex: childIndex,
            siblingCount: parentDriver.children!.length
          });
        });
      }
    });

    // Always add level if we have nodes, even if empty (for debugging)
    if (currentLevelNodes.length > 0) {
      levelsArray.push({ level: currentLevel, nodes: currentLevelNodes });
      
      // Continue to next level - recursively collect ALL nested children
      const childDrivers = currentLevelNodes.map(n => n.driver);
      this.collectNestedLevelsWithParents(childDrivers, currentLevel + 1, levelsArray, currentLevelNodes);
    }
  }

  /**
   * Get the order/position of a node to align it with its parent
   */
  getNodeOrder(node: {driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}, allNodes: Array<{driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}>, previousLevelNodes?: Array<{driver: ReferralDriver, parentId?: number, parentIndex?: number, siblingIndex?: number, siblingCount?: number}>): number {
    if (!node.parentIndex && node.parentIndex !== 0) {
      return 0;
    }
    
    // If we have previous level nodes, find the parent's position
    if (previousLevelNodes) {
      const parentNode = previousLevelNodes.find(n => n.driver.driverId === node.parentId);
      if (parentNode) {
        const parentIndex = previousLevelNodes.indexOf(parentNode);
        // Calculate order based on parent position and sibling index
        return parentIndex * 100 + (node.siblingIndex || 0);
      }
    }
    
    return (node.parentIndex || 0) * 100 + (node.siblingIndex || 0);
  }
  
  /**
   * Check if two nodes are siblings (same parent)
   */
  areSiblings(node1: {driver: ReferralDriver, parentId?: number}, node2: {driver: ReferralDriver, parentId?: number}): boolean {
    return node1.parentId === node2.parentId && node1.parentId !== undefined;
  }
  
  /**
   * Get siblings for a node
   */
  getSiblings(node: {driver: ReferralDriver, parentId?: number}, allNodes: Array<{driver: ReferralDriver, parentId?: number}>): Array<{driver: ReferralDriver, parentId?: number}> {
    return allNodes.filter(n => n.parentId === node.parentId && n.driver.driverId !== node.driver.driverId);
  }
  
  /**
   * Get all siblings including the node itself
   */
  getAllSiblings(node: {driver: ReferralDriver, parentId?: number}, allNodes: Array<{driver: ReferralDriver, parentId?: number}>): Array<{driver: ReferralDriver, parentId?: number}> {
    return allNodes.filter(n => n.parentId === node.parentId);
  }
  
  /**
   * Check if a node has siblings
   */
  hasSiblings(node: {driver: ReferralDriver, parentId?: number, siblingCount?: number}, allNodes: Array<{driver: ReferralDriver, parentId?: number}>): boolean {
    if (node.siblingCount !== undefined) {
      return node.siblingCount > 1;
    }
    return this.getAllSiblings(node, allNodes).length > 1;
  }
  
  /**
   * Check if a node is the first sibling
   */
  isFirstSibling(node: {driver: ReferralDriver, parentId?: number, siblingIndex?: number}, allNodes: Array<{driver: ReferralDriver, parentId?: number}>): boolean {
    if (node.siblingIndex !== undefined) {
      return node.siblingIndex === 0;
    }
    const siblings = this.getAllSiblings(node, allNodes);
    if (siblings.length === 0) return false;
    return siblings[0].driver.driverId === node.driver.driverId;
  }
  
  /**
   * Check if a node is the last sibling
   */
  isLastSibling(node: {driver: ReferralDriver, parentId?: number, siblingIndex?: number, siblingCount?: number}, allNodes: Array<{driver: ReferralDriver, parentId?: number}>): boolean {
    if (node.siblingIndex !== undefined && node.siblingCount !== undefined) {
      return node.siblingIndex === node.siblingCount - 1;
    }
    const siblings = this.getAllSiblings(node, allNodes);
    if (siblings.length === 0) return false;
    return siblings[siblings.length - 1].driver.driverId === node.driver.driverId;
  }

  // Document Approval Methods
  approveDocument(documentId: number): void {
    if (!confirm('Are you sure you want to approve this document?')) {
      return;
    }

    this.driverService.approveDriverDocument(documentId).subscribe({
      next: () => {
        this.loadDriver();
      },
      error: (err) => {
        console.error('Error approving document:', err);
        alert(err.error?.message || 'Failed to approve document');
      }
    });
  }

  openRejectModal(doc: DriverDocument): void {
    this.selectedDocumentForRejection = doc;
    this.rejectionReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.selectedDocumentForRejection = null;
    this.rejectionReason = '';
  }

  rejectDocument(): void {
    if (!this.selectedDocumentForRejection) {
      return;
    }

    this.driverService.rejectDriverDocument(
      this.selectedDocumentForRejection.docId,
      this.rejectionReason || undefined
    ).subscribe({
      next: () => {
        this.closeRejectModal();
        this.loadDriver();
      },
      error: (err) => {
        console.error('Error rejecting document:', err);
        alert(err.error?.message || 'Failed to reject document');
      }
    });
  }

  /**
   * Process referral tree to split into multiple trees when users have more than 2 referrals
   * Each user can have maximum 2 referrals in a tree. Additional referrals start new trees.
   */
  processReferralTree(tree: ReferralTree): ReferralTree[] {
    if (!tree || !tree.referralLevels || tree.referralLevels.length === 0) {
      return tree ? [tree] : [];
    }

    const trees: ReferralTree[] = [];
    const level2Drivers = tree.referralLevels.find(l => l.level === 2)?.drivers || [];

    if (level2Drivers.length === 0) {
      return [tree];
    }

    // Process all drivers first
    const processedDrivers = level2Drivers.map(driver => this.processReferralDriver(driver));

    // Split into groups of 2: [0,1], [2,3], [4,5], etc.
    for (let i = 0; i < processedDrivers.length; i += 2) {
      const groupDrivers = processedDrivers.slice(i, i + 2);
      
      const newTree: ReferralTree = {
        driverId: tree.driverId,
        driverName: tree.driverName,
        referredBy: tree.referredBy,
        referrerName: tree.referrerName,
        totalReferrals: this.countTotalReferrals(groupDrivers),
        totalEarnings: this.calculateTotalEarnings(groupDrivers),
        pendingEarnings: tree.pendingEarnings,
        paidEarnings: tree.paidEarnings,
        referralLevels: [{
          level: 2,
          count: groupDrivers.length,
          totalEarnings: groupDrivers.reduce((sum, d) => sum + (d.totalEarnings || 0), 0),
          drivers: groupDrivers
        }]
      };
      trees.push(newTree);
    }

    return trees;
  }

  /**
   * Process a referral driver and limit its children to 2
   * Returns the processed driver with limited children (first 2 only)
   * This ensures each tree shows max 2 direct referrals per user
   */
  private processReferralDriver(driver: ReferralDriver): ReferralDriver {
    if (!driver.children || driver.children.length === 0) {
      return { ...driver, children: [] };
    }

    const processedChildren: ReferralDriver[] = [];

    // Process only first 2 children recursively (each child can also have max 2 children)
    driver.children.slice(0, 2).forEach((child) => {
      const processedChild = this.processReferralDriver(child);
      processedChildren.push(processedChild);
    });

    // Return driver with only first 2 children (but those children can have their own children)
    return {
      ...driver,
      children: processedChildren,
      referralCount: driver.children.length // Keep original count for display
    };
  }

  /**
   * Count total referrals in a tree structure
   */
  private countTotalReferrals(drivers: ReferralDriver[]): number {
    let count = drivers.length;
    drivers.forEach(driver => {
      if (driver.children && driver.children.length > 0) {
        count += this.countTotalReferrals(driver.children);
      }
    });
    return count;
  }

  /**
   * Calculate total earnings in a tree structure
   */
  private calculateTotalEarnings(drivers: ReferralDriver[]): number {
    let total = 0;
    drivers.forEach(driver => {
      total += driver.totalEarnings || 0;
      if (driver.children && driver.children.length > 0) {
        total += this.calculateTotalEarnings(driver.children);
      }
    });
    return total;
  }

  /**
   * Toggle expand/collapse for a node
   */
  toggleNode(driverId: number): void {
    if (this.expandedNodes.has(driverId)) {
      this.expandedNodes.delete(driverId);
    } else {
      this.expandedNodes.add(driverId);
    }
  }

  /**
   * Check if a node is expanded
   */
  isNodeExpanded(driverId: number): boolean {
    return this.expandedNodes.has(driverId);
  }

  /**
   * Check if a node has children
   */
  hasChildren(driver: ReferralDriver): boolean {
    return !!(driver.children && driver.children.length > 0);
  }

  /**
   * Select a node
   */
  selectNode(driverId: number): void {
    this.selectedNodeId = driverId;
  }

  /**
   * Show driver info modal
   */
  showDriverInfo(driverId: number): void {
    // Find the driver in the referral trees
    const driver = this.findDriverInTrees(driverId);
    if (driver) {
      this.selectedDriverInfo = driver;
      this.showDriverInfoModal = true;
    } else {
      alert('Driver information not found');
    }
  }

  /**
   * Find driver in all referral trees
   */
  private findDriverInTrees(driverId: number): ReferralDriver | null {
    for (const tree of this.processedReferralTrees) {
      // Check root driver
      if (tree.driverId === driverId) {
        return {
          driverId: tree.driverId,
          fullName: tree.driverName,
          status: this.driver?.status || 'Unknown',
          totalEarnings: 0,
          referralCount: 0,
          children: []
        };
      }

      // Check referral levels
      if (tree.referralLevels) {
        for (const level of tree.referralLevels) {
          const driver = this.findDriverInLevel(level.drivers, driverId);
          if (driver) {
            return driver;
          }
        }
      }
    }
    return null;
  }

  /**
   * Recursively find driver in a list of referral drivers
   */
  private findDriverInLevel(drivers: ReferralDriver[], driverId: number): ReferralDriver | null {
    for (const driver of drivers) {
      // Check if this is the driver we're looking for
      if (driver.driverId === driverId) {
        return driver;
      }

      // Check children recursively
      if (driver.children && driver.children.length > 0) {
        const found = this.findDriverInLevel(driver.children, driverId);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * Close driver info modal
   */
  closeDriverInfoModal(): void {
    this.showDriverInfoModal = false;
    this.selectedDriverInfo = null;
  }

  /**
   * Navigate to driver detail page
   */
  navigateToDriverDetail(driverId: number): void {
    // Close modal first
    this.closeDriverInfoModal();
    
    // If navigating to the same driver, just reload
    if (driverId === this.driverId) {
      this.loadDriver();
      return;
    }
    
    // Navigate to different driver
    // The route param subscription in ngOnInit will handle the reload
    this.router.navigate(['/drivers', driverId]).then(() => {
      // The subscription will handle loading, but ensure we update if needed
      if (this.driverId !== driverId) {
        this.driverId = driverId;
        this.loadDriver();
        this.loadReferralTree();
        this.loadReferralEarnings();
      }
    });
  }

  /**
   * Check if a node is selected
   */
  isNodeSelected(driverId: number): boolean {
    return this.selectedNodeId === driverId;
  }

  /**
   * Get user initials for avatar
   */
  getUserInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Get level number for a driver based on its depth
   */
  getDriverLevel(driver: ReferralDriver, currentLevel: number = 2): number {
    return currentLevel;
  }

  /**
   * Generate MLM tree visualization (legacy SVG)
   */
  getMLMTree(tree: ReferralTree): SafeHtml {
    const levels = this.getTreeByLevels(tree);
    const svg = this.mlmTreeService.generateMLMTree(tree, levels, 1400, 900);
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Generate SVG tree visualization (legacy)
   */
  getSVGTree(tree: ReferralTree): SafeHtml {
    const levels = this.getTreeByLevels(tree);
    const svg = this.svgTreeService.generateSVGTree(tree, levels, 1200, 800);
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  canEditDriver(): boolean {
    return this.authService.hasAnyRole(['Admin']);
  }

  canManageComplianceDocuments(): boolean {
    return this.authService.hasAnyRole(['Admin', 'Driver']);
  }

  /**
   * Get rating stars array for display
   * Returns array of booleans where true = filled star, false = empty star
   */
  getRatingStars(rating: number | undefined): boolean[] {
    if (!rating) return [false, false, false, false, false];
    const fullStars = Math.floor(rating);
    const stars: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      stars.push(i < fullStars);
    }
    return stars;
  }

  /**
   * Navigate to settlement detail page
   */
  viewSettlement(settlementId: number): void {
    // Preserve current driver profile URL (including `?tab=settlements`) so the
    // settlement detail page can route "Back" to the originating profile.
    this.router.navigate(['/financial/settlements', settlementId], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  /**
   * Show tooltip on mouseenter
   */
  showTooltip(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target) {
      target.style.opacity = '1';
    }
  }

  /**
   * Hide tooltip on mouseleave
   */
  hideTooltip(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target) {
      target.style.opacity = '0';
    }
  }

  // Incidents Methods
  
  /**
   * Load incidents for the current driver
   */
  loadIncidents(): void {
    if (!this.driverId) return;
    
    this.loadingIncidents = true;
    const incidents$ = this.isMyProfile
      ? this.complianceService.getMyIncidents(this.incidentResolvedFilter ?? undefined)
      : this.complianceService.getIncidents(
          this.driverId,
          undefined,
          this.incidentResolvedFilter ?? undefined
        );

    incidents$.subscribe({
      next: (data) => {
        // Sort by incident date (most recent first)
        this.incidents = data.sort((a, b) => {
          const dateA = new Date(a.incidentDate).getTime();
          const dateB = new Date(b.incidentDate).getTime();
          return dateB - dateA;
        });
        this.applyIncidentFilters();
        this.loadingIncidents = false;
      },
      error: (err) => {
        console.error('Error loading incidents:', err);
        this.incidents = [];
        this.filteredIncidents = [];
        this.loadingIncidents = false;
      }
    });
  }

  /**
   * Apply incident filters
   */
  applyIncidentFilters(): void {
    let filtered = [...this.incidents];

    if (this.incidentSeverityFilter) {
      filtered = filtered.filter(i => i.severity === this.incidentSeverityFilter);
    }

    if (this.incidentTypeFilter) {
      filtered = filtered.filter(i => i.incidentType === this.incidentTypeFilter);
    }

    if (this.incidentSearchTerm) {
      const term = this.incidentSearchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        i.incidentNumber.toLowerCase().includes(term) ||
        i.description.toLowerCase().includes(term) ||
        i.location?.toLowerCase().includes(term) ||
        i.city?.toLowerCase().includes(term) ||
        i.state?.toLowerCase().includes(term) ||
        i.incidentType.toLowerCase().includes(term)
      );
    }

    this.filteredIncidents = filtered;
  }

  /**
   * Handle filter change for resolved status
   */
  onIncidentFilterChange(): void {
    this.loadIncidents();
  }

  /**
   * Clear all incident filters
   */
  clearIncidentFilters(): void {
    this.incidentResolvedFilter = null;
    this.incidentSeverityFilter = '';
    this.incidentTypeFilter = '';
    this.incidentSearchTerm = '';
    this.loadIncidents();
  }

  /**
   * Get badge class for incident severity
   */
  getIncidentSeverityBadgeClass(severity: string): string {
    const severityMap: { [key: string]: string } = {
      'Low': 'bg-info',
      'Medium': 'bg-warning',
      'High': 'bg-danger',
      'Critical': 'bg-danger'
    };
    return severityMap[severity] || 'bg-secondary';
  }

  /**
   * Get count of open incidents
   */
  getOpenIncidentsCount(): number {
    return this.incidents.filter(i => !i.resolved).length;
  }

  /**
   * Get count of resolved incidents
   */
  getResolvedIncidentsCount(): number {
    return this.incidents.filter(i => i.resolved).length;
  }

  /**
   * Get count of critical/high severity incidents
   */
  getCriticalIncidentsCount(): number {
    return this.incidents.filter(i => i.severity === 'Critical' || i.severity === 'High').length;
  }

  /**
   * Get total estimated cost of all incidents
   */
  getTotalEstimatedCost(): number {
    return this.incidents.reduce((sum, i) => sum + (i.estimatedCost || 0), 0);
  }

  /**
   * View incident detail - navigate to compliance incident detail page
   */
  viewIncidentDetail(incidentId: number): void {
    if (this.isMyProfile) {
      this.router.navigate(['/drivers/my-incidents', incidentId]);
      return;
    }
    this.router.navigate(['/compliance/incidents', incidentId]);
  }

  /**
   * Load equipments assigned to the current driver
   */
  loadEquipments(): void {
    if (!this.driverId) {
      this.equipments = [];
      return;
    }

    this.loadingEquipments = true;
    this.equipmentService.getEquipments(undefined, undefined).subscribe({
      next: (data) => {
        this.equipments = (data || []).filter((equipment) => equipment.assignedToDriverId === this.driverId);
        this.loadingEquipments = false;
      },
      error: (err) => {
        console.error('Error loading equipments:', err);
        this.equipments = [];
        this.loadingEquipments = false;
      }
    });
  }

  getEquipmentStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Active':
        return 'badge bg-success';
      case 'Assigned':
      case 'InUse':
      case 'InTransit':
        return 'badge bg-primary';
      case 'InMaintenance':
        return 'badge bg-warning text-dark';
      case 'Retired':
        return 'badge bg-secondary';
      default:
        return 'badge bg-secondary';
    }
  }

  formatOdometer(value: number | undefined): string {
    if (value == null) return '-';
    return value.toLocaleString();
  }

  viewEquipmentDetail(equipmentId: number): void {
    this.router.navigate(['/equipment', equipmentId], {
      state: { equipmentReturnUrl: `/drivers/${this.driverId}?tab=equipments` }
    });
  }
}




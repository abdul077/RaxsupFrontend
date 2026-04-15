import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api';
import { CustomerService } from '../../../core/services/customer.service';
import { LoadService } from '../../../core/services/load.service';
import { DriverService } from '../../../core/services/driver.service';
import { FinancialService } from '../../../core/services/financial.service';
import { ComplianceService } from '../../../core/services/compliance.service';
import { Customer } from '../../../core/models/customer.model';
import { Load } from '../../../core/models/load.model';
import { Driver } from '../../../core/models/driver.model';
import { DriverReports } from '../../../core/models/driver.model';
import { FinancialReports } from '../../../core/models/financial.model';
import { ComplianceReports } from '../../../core/models/compliance.model';

interface LoadReportData {
  totalLoads: number;
  loadsByStatus: number;
  totalRevenue: number;
  averageRate: number;
  onTimeDeliveries: number;
  onTimePercentage: number;
  statusSummary: Array<{
    status: string;
    count: number;
    totalRevenue: number;
  }>;
}

@Component({
  selector: 'app-dashboard-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-stats.html',
  styleUrl: './dashboard-stats.scss',
})
export class DashboardStatsComponent implements OnInit {
  // Report Type
  selectedReportType: 'loads' | 'drivers' | 'financial' | 'compliance' = 'loads';
  
  // Filters
  startDate: string = '';
  endDate: string = '';
  statusFilter: string = '';
  customerFilter: number | null = null;
  driverFilter: number | null = null;
  
  // Data
  loadReportData: LoadReportData | null = null;
  driverReportData: DriverReports | null = null;
  financialReportData: FinancialReports | null = null;
  complianceReportData: ComplianceReports | null = null;
  customers: Customer[] = [];
  drivers: Driver[] = [];
  
  // Loading states
  loading = false;
  reportLoading = false;
  
  // Status options
  statusOptions = [
    'Created',
    'Assigned',
    'Dispatched',
    'PickedUp',
    'InTransit',
    'Delivered',
    'Completed',
    'Settled',
    'Cancelled'
  ];
  
  // Preset date ranges
  datePresets = [
    { label: 'Last 7 Days', days: 7 },
    { label: 'Last 30 Days', days: 30 },
    { label: 'Last 90 Days', days: 90 },
    { label: 'Last Year', days: 365 }
  ];

  constructor(
    private apiService: ApiService,
    private customerService: CustomerService,
    private loadService: LoadService,
    private driverService: DriverService,
    private financialService: FinancialService,
    private complianceService: ComplianceService
  ) {
    // Set default date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    this.endDate = endDate.toISOString().split('T')[0];
    this.startDate = startDate.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.loadCustomers();
    this.loadDrivers();
    this.loadReport();
  }

  getStatusDisplayLabel(status: string | undefined): string {
    if (!status) return '-';
    const map: Record<string, string> = {
      Created: 'Created',
      Assigned: 'Assigned',
      Dispatched: 'Dispatched',
      PickedUp: 'Picked up',
      InTransit: 'In transit',
      Delivered: 'Delivered',
      Completed: 'Completed',
      Settled: 'Settled',
      Cancelled: 'Cancelled'
    };
    return map[status] || status;
  }

  loadCustomers(): void {
    this.customerService.getCustomers(true).subscribe({
      next: (data) => {
        this.customers = data;
      },
      error: () => {
        this.customers = [];
      }
    });
  }

  loadDrivers(): void {
    this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000).subscribe({
      next: (data) => {
        this.drivers = data.items;
      },
      error: () => {
        this.drivers = [];
      }
    });
  }

  applyDatePreset(days: number): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    this.endDate = endDate.toISOString().split('T')[0];
    this.startDate = startDate.toISOString().split('T')[0];
    this.loadReport();
  }

  onApplyFilters(): void {
    this.loadReport();
  }

  onClearFilters(): void {
    // Reset filters
    this.statusFilter = '';
    this.customerFilter = null;
    this.driverFilter = null;
    
    // Reset dates to default (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    this.endDate = endDate.toISOString().split('T')[0];
    this.startDate = startDate.toISOString().split('T')[0];
    
    // Load report with cleared filters
    this.loadReport();
  }

  loadReport(): void {
    if (!this.startDate || !this.endDate) {
      return;
    }

    this.reportLoading = true;

    if (this.selectedReportType === 'loads') {
      this.loadLoadReport();
    } else if (this.selectedReportType === 'drivers') {
      this.loadDriverReport();
    } else if (this.selectedReportType === 'financial') {
      this.loadFinancialReport();
    } else if (this.selectedReportType === 'compliance') {
      this.loadComplianceReport();
    }
  }

  loadLoadReport(): void {
    const params: any = {
      startDate: new Date(this.startDate).toISOString(),
      endDate: new Date(this.endDate).toISOString()
    };

    if (this.statusFilter) {
      params.status = this.statusFilter;
    }

    if (this.customerFilter) {
      params.customerId = this.customerFilter;
    }

    this.apiService.get<LoadReportData>('reports/loads', params).subscribe({
      next: (data) => {
        this.loadReportData = data;
        this.reportLoading = false;
      },
      error: () => {
        this.reportLoading = false;
      }
    });
  }

  loadDriverReport(): void {
    this.driverService.getDriverReports().subscribe({
      next: (data) => {
        this.driverReportData = data;
        this.reportLoading = false;
      },
      error: () => {
        this.reportLoading = false;
      }
    });
  }

  loadFinancialReport(): void {
    this.financialService.getFinancialReports(
      this.startDate || undefined,
      this.endDate || undefined,
      this.customerFilter || undefined,
      this.driverFilter || undefined
    ).subscribe({
      next: (data) => {
        this.financialReportData = data;
        this.reportLoading = false;
      },
      error: () => {
        this.reportLoading = false;
      }
    });
  }

  loadComplianceReport(): void {
    this.complianceService.getComplianceReports(
      this.startDate || undefined,
      this.endDate || undefined,
      this.driverFilter || undefined,
      undefined
    ).subscribe({
      next: (data) => {
        this.complianceReportData = data;
        this.reportLoading = false;
      },
      error: () => {
        this.reportLoading = false;
      }
    });
  }

  exportReport(): void {
    if (this.reportLoading) {
      return;
    }

    if (this.selectedReportType === 'loads') {
      this.exportLoadsReport();
    } else if (this.selectedReportType === 'drivers') {
      this.exportDriverReport();
    } else if (this.selectedReportType === 'financial') {
      this.exportFinancialReport();
    } else if (this.selectedReportType === 'compliance') {
      this.exportComplianceReport();
    }
  }

  private exportLoadsReport(): void {
    if (!this.startDate || !this.endDate) {
      alert('Please select a date range before exporting.');
      return;
    }

    this.reportLoading = true;

    // Fetch all loads with the same filters (status and customer)
    // Note: We'll filter by date range on the frontend since the API doesn't support it
    // Fetch in batches to handle large datasets
    const allLoads: Load[] = [];
    const pageSize = 1000;
    let currentPage = 1;

    const fetchPage = () => {
      this.loadService.getLoads(
        this.statusFilter || undefined,
        this.customerFilter !== null ? this.customerFilter : undefined,
        undefined,
        currentPage,
        pageSize
      ).subscribe({
        next: (data) => {
          allLoads.push(...data.items);
          
          if (data.hasNextPage && data.items.length === pageSize) {
            currentPage++;
            fetchPage();
          } else {
            // All pages fetched, now filter by date range
            const startDate = new Date(this.startDate);
            const endDate = new Date(this.endDate);
            endDate.setHours(23, 59, 59, 999); // Include the entire end date

            const filteredLoads = allLoads.filter(load => {
              const loadDate = new Date(load.createdAt);
              return loadDate >= startDate && loadDate <= endDate;
            });

            // Export to CSV
            this.exportLoadsToCSV(filteredLoads);
            this.reportLoading = false;
          }
        },
        error: (error) => {
          console.error('Error fetching loads for export:', error);
          alert('Failed to export report. Please try again.');
          this.reportLoading = false;
        }
      });
    };

    fetchPage();
  }

  private exportLoadsToCSV(loads: Load[]): void {
    // CSV Headers
    const headers = [
      'Load Number',
      'Customer',
      'Origin',
      'Destination',
      'Pickup Date',
      'Delivery Date',
      'Total Rate',
      'Currency',
      'Status',
      'Created Date',
      'Notes'
    ];

    // Convert loads to CSV rows
    const rows = loads.map(load => [
      this.escapeCSV(load.loadNumber || ''),
      this.escapeCSV(load.customerName || ''),
      this.escapeCSV(load.origin || ''),
      this.escapeCSV(load.destination || ''),
      load.pickupDateTime ? new Date(load.pickupDateTime).toLocaleDateString() : '',
      load.deliveryDateTime ? new Date(load.deliveryDateTime).toLocaleDateString() : '',
      load.totalRate?.toString() || '0',
      load.currency || 'USD',
      this.escapeCSV(load.status || ''),
      load.createdAt ? new Date(load.createdAt).toLocaleDateString() : '',
      this.escapeCSV(load.notes || '')
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Download file
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with date range
    const startDateStr = this.startDate.replace(/-/g, '');
    const endDateStr = this.endDate.replace(/-/g, '');
    const filename = `Loads_Report_${startDateStr}_${endDateStr}.csv`;
    link.setAttribute('download', filename);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private exportSummaryReport(): void {
    if (!this.loadReportData) {
      alert('No report data available to export.');
      return;
    }

    // CSV Headers for Summary Report
    const headers = [
      'Report Type',
      'Date Range',
      'Filters',
      'Total Loads',
      'Total Revenue',
      'Average Rate',
      'On-Time Deliveries',
      'On-Time Percentage'
    ];

    // Summary row
    const summaryRow = [
      'Load Report Summary',
      `${this.startDate} to ${this.endDate}`,
      `Status: ${this.getStatusFilterText()}, Customer: ${this.getCustomerName()}`,
      this.loadReportData.totalLoads.toString(),
      this.formatCurrency(this.loadReportData.totalRevenue),
      this.formatCurrency(this.loadReportData.averageRate),
      this.loadReportData.onTimeDeliveries.toString(),
      this.formatPercentage(this.loadReportData.onTimePercentage)
    ];

    // Status Summary Headers
    const statusHeaders = ['Status', 'Count', 'Total Revenue', 'Percentage'];
    const statusRows = this.loadReportData.statusSummary.map(status => [
      this.escapeCSV(status.status),
      status.count.toString(),
      this.formatCurrency(status.totalRevenue),
      this.getStatusPercentage(status.count).toString() + '%'
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      summaryRow.join(','),
      '',
      'Status Breakdown',
      statusHeaders.join(','),
      ...statusRows.map(row => row.join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // Download file
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename
    const startDateStr = this.startDate.replace(/-/g, '');
    const endDateStr = this.endDate.replace(/-/g, '');
    const filename = `${this.selectedReportType}_Report_${startDateStr}_${endDateStr}.csv`;
    link.setAttribute('download', filename);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private escapeCSV(value: string): string {
    if (!value) return '';
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Created': 'bg-secondary',
      'Assigned': 'bg-info',
      'InTransit': 'bg-primary',
      'Delivered': 'bg-success',
      'Settled': 'bg-dark',
      'Cancelled': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatPercentage(value: number): string {
    return value.toFixed(1) + '%';
  }

  getStatusPercentage(statusCount: number): number {
    if (!this.loadReportData || this.loadReportData.totalLoads === 0) return 0;
    return Math.round((statusCount / this.loadReportData.totalLoads) * 100);
  }

  getTotalStatusCount(): number {
    if (!this.loadReportData) return 0;
    return this.loadReportData.statusSummary.reduce((sum, item) => sum + item.count, 0);
  }

  getCustomerName(): string {
    if (!this.customerFilter) {
      return 'All Customers';
    }
    const customer = this.customers.find(c => c.customerId === this.customerFilter);
    return customer?.name || 'Customer';
  }

  getStatusFilterText(): string {
    return this.statusFilter || 'All Statuses';
  }

  getDriverName(): string {
    if (!this.driverFilter) {
      return 'All Drivers';
    }
    const driver = this.drivers.find(d => d.driverId === this.driverFilter);
    return driver?.fullName || 'Driver';
  }

  // Export methods for other report types
  private exportDriverReport(): void {
    if (!this.driverReportData) {
      alert('No driver report data available to export.');
      return;
    }

    const headers = ['Report Type', 'Date Range', 'Total Active', 'Total Inactive', 'On Trip', 'Available'];
    const summaryRow = [
      'Driver Report Summary',
      `${this.startDate} to ${this.endDate}`,
      this.driverReportData.activeInactive.activeCount.toString(),
      this.driverReportData.activeInactive.inactiveCount.toString(),
      this.driverReportData.activeInactive.onTripCount.toString(),
      this.driverReportData.activeInactive.availableCount.toString()
    ];

    const csvContent = [
      headers.join(','),
      summaryRow.join(',')
    ].join('\n');

    this.downloadCSV(csvContent, 'Driver_Report');
  }

  private exportFinancialReport(): void {
    if (!this.financialReportData) {
      alert('No financial report data available to export.');
      return;
    }

    const totalExpenses = this.financialReportData.profitLoss.totalCosts + this.financialReportData.profitLoss.operatingExpenses;
    const headers = ['Report Type', 'Date Range', 'Total Revenue', 'Total Expenses', 'Net Profit'];
    const summaryRow = [
      'Financial Report Summary',
      `${this.startDate} to ${this.endDate}`,
      this.formatCurrency(this.financialReportData.revenueReport.totalRevenue),
      this.formatCurrency(totalExpenses),
      this.formatCurrency(this.financialReportData.profitLoss.netProfit)
    ];

    const csvContent = [
      headers.join(','),
      summaryRow.join(',')
    ].join('\n');

    this.downloadCSV(csvContent, 'Financial_Report');
  }

  private exportComplianceReport(): void {
    if (!this.complianceReportData) {
      alert('No compliance report data available to export.');
      return;
    }

    const headers = ['Report Type', 'Date Range', 'Total Drivers', 'Compliant Drivers', 'Non-Compliant Drivers', 'Audit Score'];
    const summaryRow = [
      'Compliance Report Summary',
      `${this.startDate} to ${this.endDate}`,
      this.complianceReportData.summary.totalDrivers.toString(),
      this.complianceReportData.summary.compliantDrivers.toString(),
      this.complianceReportData.summary.nonCompliantDrivers.toString(),
      this.complianceReportData.auditReadiness.overallScore.toString() + '%'
    ];

    const csvContent = [
      headers.join(','),
      summaryRow.join(',')
    ].join('\n');

    this.downloadCSV(csvContent, 'Compliance_Report');
  }

  private downloadCSV(csvContent: string, reportType: string): void {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const startDateStr = this.startDate.replace(/-/g, '');
    const endDateStr = this.endDate.replace(/-/g, '');
    const filename = `${reportType}_${startDateStr}_${endDateStr}.csv`;
    link.setAttribute('download', filename);
    
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

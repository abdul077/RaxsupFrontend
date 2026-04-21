import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FinancialService } from '../../../core/services/financial.service';
import { DriverService } from '../../../core/services/driver.service';
import { DriverSettlement, PayablePayment, Invoice } from '../../../core/models/financial.model';
import { ReferralEarning } from '../../../core/models/driver.model';
import { Driver } from '../../../core/models/driver.model';

interface UnifiedPayment {
  id: string;
  type: 'Settlement' | 'ReferralEarning' | 'PayablePayment' | 'ReceivablePayment' | 'InvoicePayment';
  date: string;
  amount: number;
  recipient: string;
  payer: string;
  reference: string;
  status: string;
  description: string;
  details?: any;
}

@Component({
  selector: 'app-payments-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './payments-list.html',
  styleUrl: './payments-list.scss',
})
export class PaymentsListComponent implements OnInit {
  allPayments: UnifiedPayment[] = [];
  filteredPayments: UnifiedPayment[] = [];
  
  // Filters
  typeFilter: string = '';
  statusFilter: string = '';
  dateFrom: string = '';
  dateTo: string = '';
  searchTerm: string = '';
  
  typeOptions = ['All', 'Settlement', 'ReferralEarning', 'PayablePayment', 'ReceivablePayment', 'InvoicePayment'];
  statusOptions = ['All', 'Paid', 'Pending', 'Approved', 'Draft'];

  // Modal state
  showDetailsModal = false;
  selectedPayment: UnifiedPayment | null = null;

  constructor(
    private financialService: FinancialService,
    private driverService: DriverService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initializeDates();
    this.loadAllPayments();
  }

  initializeDates(): void {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    this.dateFrom = firstDay.toISOString().split('T')[0];
    this.dateTo = lastDay.toISOString().split('T')[0];
  }

  async loadAllPayments(): Promise<void> {
    this.allPayments = [];

    try {
      // Load all payment types in parallel
      const [
        settlements,
        payablePayments,
        driversResponse,
        invoices
      ] = await Promise.all([
        firstValueFrom(this.financialService.getSettlements()).catch(() => []),
        firstValueFrom(this.financialService.getPayablePayments()).catch(() => []),
        firstValueFrom(this.driverService.getDrivers(undefined, undefined, undefined, undefined, 1, 1000)).catch(() => ({ items: [] })),
        firstValueFrom(this.financialService.getInvoices({ pageSize: 1000 })).catch(() => ({ items: [], totalCount: 0, pageNumber: 1, pageSize: 1000 }))
      ]);

      // Extract drivers array from paginated response
      const allDrivers = driversResponse?.items || [];

      // Process settlements
      // Show all settlements (Draft, Approved, Paid) - not just paid ones
      // Use paidAt if available, otherwise use createdAt
      if (settlements) {
        settlements.forEach((settlement: DriverSettlement) => {
          // Include all settlements, not just paid ones
          const paymentDate = settlement.paidAt || settlement.approvedAt || settlement.createdAt;
          this.allPayments.push({
            id: `settlement-${settlement.settlementId}`,
            type: 'Settlement',
            date: paymentDate,
            amount: settlement.netPay,
            recipient: settlement.driverName || `Driver ${settlement.driverId}`,
            payer: 'RaxsUp',
            reference: settlement.settlementNumber,
            status: settlement.status,
            description: `Driver Settlement - Period: ${this.formatDate(settlement.periodStart)} to ${this.formatDate(settlement.periodEnd)}`,
            details: settlement
          });
        });
      }

      // Process payable payments
      if (payablePayments) {
        payablePayments.forEach((payment: PayablePayment) => {
          this.allPayments.push({
            id: `payable-${payment.paymentId}`,
            type: 'PayablePayment',
            date: payment.paymentDate,
            amount: payment.amount,
            recipient: payment.vendorName,
            payer: 'RaxsUp',
            reference: payment.reference || payment.checkNumber || payment.payableNumber,
            status: 'Paid',
            description: `Vendor Payment - ${payment.payableNumber}`,
            details: payment
          });
        });
      }

      // Process receivable payments (from invoices)
      // Show all invoices with payments, and also show carrier fee separately
      const invoiceList = invoices?.items || [];
      if (invoiceList.length > 0) {
        invoiceList.forEach((invoice: Invoice) => {
          // Show customer payment if invoice has been paid
          if (invoice.paidAmount > 0 && invoice.status === 'Paid') {
            this.allPayments.push({
              id: `invoice-${invoice.invoiceId}`,
              type: 'InvoicePayment',
              date: invoice.createdAt, // Use createdAt as fallback since Invoice doesn't have updatedAt
              amount: invoice.paidAmount,
              recipient: 'RaxsUp',
              payer: invoice.customerName || `Customer ${invoice.customerId}`,
              reference: invoice.invoiceNumber,
              status: invoice.status,
              description: `Customer Payment - Invoice ${invoice.invoiceNumber}`,
              details: invoice
            });
          }
          
          // Show carrier fee as a separate payment entry
          if (invoice.raxUpCommission > 0) {
            this.allPayments.push({
              id: `invoice-commission-${invoice.invoiceId}`,
              type: 'InvoicePayment',
              date: invoice.createdAt,
              amount: invoice.raxUpCommission,
              recipient: 'RaxsUp',
              payer: 'Carrier Fee',
              reference: `${invoice.invoiceNumber} - Commission`,
              status: invoice.status === 'Paid' ? 'Paid' : 'Pending',
              description: `Carrier Fee - Invoice ${invoice.invoiceNumber}`,
              details: invoice
            });
          }
        });
      }

      // Process referral earnings for all drivers
      // Show all referral earnings (Pending, Paid) - not just paid ones
      if (allDrivers && allDrivers.length > 0) {
        // Get all referral earnings, not just paid ones
        const referralEarningsPromises = allDrivers.map(driver => 
          firstValueFrom(this.driverService.getReferralEarnings(driver.driverId))
            .then(earnings => ({ driver, earnings }))
            .catch(() => ({ driver, earnings: [] }))
        );

        const referralResults = await Promise.all(referralEarningsPromises);
        
        referralResults.forEach(({ driver, earnings }) => {
          if (earnings && earnings.length > 0) {
            earnings.forEach((earning: ReferralEarning) => {
              // Include all referral earnings, not just paid ones
              // Use paidAt if available, otherwise use createdAt
              const paymentDate = earning.paidAt || earning.createdAt;
              
              // Ensure referrerDriverId is set (fallback if API doesn't return it yet)
              const earningWithReferrer = {
                ...earning,
                referrerDriverId: earning.referrerDriverId || driver.driverId,
                referrerDriverName: earning.referrerDriverName || driver.fullName
              };
              
              this.allPayments.push({
                id: `referral-${earning.referralEarningId}`,
                type: 'ReferralEarning',
                date: paymentDate,
                amount: earning.commissionAmount,
                recipient: driver.fullName,
                payer: 'RaxsUp',
                reference: `REF-${earning.referralEarningId}`,
                status: earning.status,
                description: `MLM Commission - Level ${earning.referralLevel} (${(earning.commissionRate * 100).toFixed(0)}%) from ${earning.referredDriverName}`,
                details: earningWithReferrer
              });
            });
          }
        });
      }

      // Sort by date (newest first)
      this.allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      this.applyFilters();
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  }

  applyFilters(): void {
    this.filteredPayments = this.allPayments.filter(payment => {
      const matchesType = !this.typeFilter || this.typeFilter === 'All' || payment.type === this.typeFilter;
      const matchesStatus = !this.statusFilter || this.statusFilter === 'All' || 
        payment.status.toLowerCase() === this.statusFilter.toLowerCase();
      const matchesDateFrom = !this.dateFrom || new Date(payment.date) >= new Date(this.dateFrom);
      const matchesDateTo = !this.dateTo || new Date(payment.date) <= new Date(this.dateTo);
      const matchesSearch = !this.searchTerm || 
        payment.recipient.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        payment.payer.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        payment.reference.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        payment.description.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      return matchesType && matchesStatus && matchesDateFrom && matchesDateTo && matchesSearch;
    });
  }

  onApplyFilters(): void {
    this.applyFilters();
  }

  onClearFilters(): void {
    this.typeFilter = '';
    this.statusFilter = '';
    this.searchTerm = '';
    this.initializeDates(); // Reset dates to current month
    this.applyFilters();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  getTypeBadgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'Settlement': 'bg-primary',
      'ReferralEarning': 'bg-success',
      'PayablePayment': 'bg-warning',
      'ReceivablePayment': 'bg-info',
      'InvoicePayment': 'bg-secondary'
    };
    return `badge ${classes[type] || 'bg-secondary'}`;
  }

  getStatusBadgeClass(status: string): string {
    const classes: { [key: string]: string } = {
      'Paid': 'bg-success',
      'Pending': 'bg-warning',
      'Approved': 'bg-info',
      'Draft': 'bg-secondary'
    };
    return `badge ${classes[status] || 'bg-secondary'}`;
  }

  getTotalAmount(): number {
    return this.filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  }

  getSettlementsTotal(): number {
    return this.filteredPayments
      .filter(p => p.type === 'Settlement')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  getSettlementsCount(): number {
    return this.filteredPayments.filter(p => p.type === 'Settlement').length;
  }

  getReferralEarningsTotal(): number {
    return this.filteredPayments
      .filter(p => p.type === 'ReferralEarning')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  getReferralEarningsCount(): number {
    return this.filteredPayments.filter(p => p.type === 'ReferralEarning').length;
  }

  getPayablePaymentsTotal(): number {
    return this.filteredPayments
      .filter(p => p.type === 'PayablePayment')
      .reduce((sum, p) => sum + p.amount, 0);
  }

  getPayablePaymentsCount(): number {
    return this.filteredPayments.filter(p => p.type === 'PayablePayment').length;
  }

  viewDetails(payment: UnifiedPayment): void {
    try {
      if (payment.type === 'ReferralEarning') {
        // Show modal for referral earnings
        this.selectedPayment = payment;
        this.showDetailsModal = true;
        return;
      } else if (payment.type === 'Settlement' && payment.details) {
        const settlement = payment.details as DriverSettlement;
        if (settlement.settlementId) {
          this.router.navigate(['/financial/settlements', settlement.settlementId]);
          return;
        }
      } else if (payment.type === 'PayablePayment' && payment.details) {
        const payable = payment.details as PayablePayment;
        if (payable.payableId) {
          this.router.navigate(['/financial/accounts-payable', payable.payableId]);
          return;
        }
      } else if (payment.type === 'InvoicePayment' && payment.details) {
        const invoice = payment.details as Invoice;
        if (invoice.invoiceId) {
          this.router.navigate(['/financial/invoices', invoice.invoiceId]);
          return;
        }
      }
      console.warn('Unable to navigate: Missing details for payment', payment);
    } catch (error) {
      console.error('Error showing payment details:', error);
    }
  }

  closeDetailsModal(): void {
    this.showDetailsModal = false;
    this.selectedPayment = null;
  }

  markReferralEarningAsPaid(payment: UnifiedPayment): void {
    if (payment.type !== 'ReferralEarning' || payment.status !== 'Pending') {
      return;
    }

    const earning = payment.details as ReferralEarning;
    if (!earning || !earning.referralEarningId) {
      alert('Unable to mark as paid: Missing referral earning information.');
      return;
    }

    if (!confirm(`Mark referral earning of ${this.formatCurrency(payment.amount)} as paid?`)) {
      return;
    }

    this.driverService.markReferralEarningPaid(earning.referralEarningId).subscribe({
      next: (result) => {
        alert(result.message || 'Referral earning marked as paid successfully.');
        // Reload payments to reflect the updated status
        this.loadAllPayments();
      },
      error: (err) => {
        console.error('Error marking referral earning as paid:', err);
        alert(err.error?.message || 'Failed to mark referral earning as paid.');
      }
    });
  }
}


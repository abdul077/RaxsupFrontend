import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DriverService } from '../../../core/services/driver.service';
import { AuthService } from '../../../core/services/auth';

interface DriverDocument {
  docId: number;
  driverId: number;
  driverName: string;
  documentType: string;
  filePath?: string;
  expiryDate?: string;
  uploadedAt: string;
  isApproved: boolean;
  isRejected: boolean;
  approvedAt?: string;
  rejectionReason?: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry?: number;
}

interface DocumentsResponse {
  documents: DriverDocument[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  summary: {
    totalDocuments: number;
    approvedDocuments: number;
    pendingDocuments: number;
    rejectedDocuments: number;
    expiredDocuments: number;
    expiringSoonDocuments: number;
  };
}

@Component({
  selector: 'app-driver-documents-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-documents-management.html',
  styleUrl: './driver-documents-management.scss'
})
export class DriverDocumentsManagementComponent implements OnInit {
  documents: DriverDocument[] = [];
  loading = true;
  summary: DocumentsResponse['summary'] | null = null;
  selectedDocuments: Set<number> = new Set();

  // Filters
  driverIdFilter: number | null = null;
  documentTypeFilter: string = '';
  approvalStatusFilter: string = '';
  expiryStatusFilter: string = '';
  daysUntilExpiry: number = 30;

  // Pagination
  pageNumber = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 1;

  documentTypes = ['License', 'Medical', 'Insurance', 'CDL', 'DrugTest', 'Other'];
  approvalStatusOptions = ['All', 'Approved', 'Pending', 'Rejected'];
  expiryStatusOptions = ['All', 'Valid', 'Expiring', 'Expired'];

  // Document Upload Modal
  showDocumentModal = false;
  isReuploading = false;
  documentForm = {
    driverId: 0,
    documentType: '',
    filePath: '',
    expiryDate: ''
  };
  selectedFile: File | null = null;
  uploadMode: 'url' | 'file' = 'file';
  uploading = false;

  constructor(
    private driverService: DriverService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.loading = true;
    this.driverService.getAllDriverDocuments(
      this.driverIdFilter || undefined,
      this.documentTypeFilter || undefined,
      this.approvalStatusFilter === 'All' ? undefined : this.approvalStatusFilter || undefined,
      this.expiryStatusFilter === 'All' ? undefined : this.expiryStatusFilter || undefined,
      this.daysUntilExpiry,
      this.pageNumber,
      this.pageSize
    ).subscribe({
      next: (data: DocumentsResponse) => {
        this.documents = data.documents;
        this.totalCount = data.totalCount;
        this.totalPages = data.totalPages;
        this.summary = data.summary;
        this.loading = false;
      },
      error: () => {
        this.documents = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.summary = null;
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.pageNumber = 1;
    this.loadDocuments();
  }

  clearFilters(): void {
    this.driverIdFilter = null;
    this.documentTypeFilter = '';
    this.approvalStatusFilter = '';
    this.expiryStatusFilter = '';
    this.pageNumber = 1;
    this.loadDocuments();
  }

  toggleDocumentSelection(docId: number): void {
    if (this.selectedDocuments.has(docId)) {
      this.selectedDocuments.delete(docId);
    } else {
      this.selectedDocuments.add(docId);
    }
  }

  toggleSelectAll(): void {
    if (this.selectedDocuments.size === this.documents.length) {
      this.selectedDocuments.clear();
    } else {
      this.documents.forEach(doc => this.selectedDocuments.add(doc.docId));
    }
  }

  bulkApprove(): void {
    if (this.selectedDocuments.size === 0) {
      alert('Please select at least one document');
      return;
    }

    if (!confirm(`Approve ${this.selectedDocuments.size} document(s)?`)) {
      return;
    }

    this.driverService.bulkApproveDocuments(Array.from(this.selectedDocuments)).subscribe({
      next: () => {
        alert('Documents approved successfully');
        this.selectedDocuments.clear();
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Error approving documents:', err);
        alert('Failed to approve documents');
      }
    });
  }

  bulkReject(): void {
    if (this.selectedDocuments.size === 0) {
      alert('Please select at least one document');
      return;
    }

    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User cancelled

    if (!confirm(`Reject ${this.selectedDocuments.size} document(s)?`)) {
      return;
    }

    this.driverService.bulkRejectDocuments(Array.from(this.selectedDocuments), reason || undefined).subscribe({
      next: () => {
        alert('Documents rejected successfully');
        this.selectedDocuments.clear();
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Error rejecting documents:', err);
        alert('Failed to reject documents');
      }
    });
  }

  approveDocument(docId: number): void {
    this.driverService.approveDriverDocument(docId).subscribe({
      next: () => {
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Error approving document:', err);
        alert('Failed to approve document');
      }
    });
  }

  rejectDocument(docId: number): void {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return;

    this.driverService.rejectDriverDocument(docId, reason || undefined).subscribe({
      next: () => {
        this.loadDocuments();
      },
      error: (err) => {
        console.error('Error rejecting document:', err);
        alert('Failed to reject document');
      }
    });
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.pageNumber = page;
      this.loadDocuments();
    }
  }

  onPageSizeChange(): void {
    this.pageNumber = 1;
    this.loadDocuments();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.pageNumber - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  navigateToDriver(driverId: number): void {
    this.router.navigate(['/drivers', driverId]);
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  }

  getFileUrl(filePath: string | null | undefined): string {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    // Remove /api from the API URL to get the base URL
    const baseUrl = window.location.origin;
    const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
    return `${baseUrl}${path}`;
  }

  viewDocument(doc: DriverDocument): void {
    if (!doc.driverId) return;

    try {
      // Use backend endpoint with authentication
      const viewUrl = this.driverService.getDocumentViewUrl(doc.driverId, doc.docId);
      
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

  exportDocuments(): void {
    alert('Export functionality coming soon');
  }

  get Math() {
    return Math;
  }

  openReuploadModal(doc: DriverDocument): void {
    this.isReuploading = true;
    this.documentForm = {
      driverId: doc.driverId,
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
        this.documentForm.driverId,
        this.selectedFile,
        this.documentForm.documentType,
        this.documentForm.expiryDate || undefined
      ).subscribe({
        next: () => {
          this.uploading = false;
          this.showDocumentModal = false;
          this.selectedFile = null;
          this.isReuploading = false;
          this.loadDocuments();
        },
        error: (err) => {
          this.uploading = false;
          console.error('Error uploading document:', err);
          alert(err.error?.message || 'Failed to upload document');
        }
      });
    } else if (this.uploadMode === 'url' && this.documentForm.filePath) {
      // Add document with URL
      this.driverService.addDriverDocument(this.documentForm.driverId, this.documentForm).subscribe({
        next: () => {
          this.showDocumentModal = false;
          this.isReuploading = false;
          this.loadDocuments();
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
}


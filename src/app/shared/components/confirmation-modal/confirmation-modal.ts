import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ConfirmationModalData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  icon?: string;
  iconColor?: string;
  showDetails?: boolean;
  details?: Array<{ label: string; value: string; icon?: string }>;
  notice?: string;
  showInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
}

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirmation-modal.html',
  styleUrl: './confirmation-modal.scss',
})
export class ConfirmationModalComponent implements OnChanges {
  @Input() show = false;
  @Input() data: ConfirmationModalData | null = null;
  @Input() loading = false;
  @Input() errorMessage = '';

  @Output() confirm = new EventEmitter<string | undefined>();
  @Output() cancel = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  inputValue: string = '';

  onConfirm(): void {
    if (!this.loading) {
      const value = this.data?.showInput ? this.inputValue : undefined;
      this.confirm.emit(value);
    }
  }

  private previousShowValue = false;

  ngOnChanges(): void {
    // Only initialize inputValue when modal first opens (show changes from false to true)
    // Don't reset it if data changes while modal is open, to preserve user input
    if (this.show && !this.previousShowValue && this.data?.showInput) {
      // Modal just opened - initialize inputValue
      this.inputValue = this.data.inputValue || '';
    } else if (!this.show && this.previousShowValue) {
      // Modal just closed - reset inputValue
      this.inputValue = '';
    }
    this.previousShowValue = this.show;
  }

  onCancel(): void {
    if (!this.loading) {
      this.cancel.emit();
    }
  }

  onClose(): void {
    if (!this.loading) {
      this.close.emit();
    }
  }

  onOverlayClick(): void {
    if (!this.loading) {
      this.onClose();
    }
  }

  get confirmButtonClass(): string {
    return this.data?.confirmButtonClass || 'btn-success';
  }

  get iconClass(): string {
    return this.data?.icon || 'fas fa-check-circle';
  }

  get iconColor(): string {
    return this.data?.iconColor || '#10b981';
  }

  getDarkerColor(color: string): string {
    // Simple function to darken hex color by 20%
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    const darkerR = Math.max(0, Math.floor(r * 0.8));
    const darkerG = Math.max(0, Math.floor(g * 0.8));
    const darkerB = Math.max(0, Math.floor(b * 0.8));
    
    return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`;
  }
}


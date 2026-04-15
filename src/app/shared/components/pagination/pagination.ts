import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
})
export class PaginationComponent implements OnChanges {
  @Input() pageNumber: number = 1;
  @Input() pageSize: number = 50;
  @Input() totalCount: number = 0;
  @Input() totalPages: number = 1;
  @Input() pageSizeOptions: number[] = [25, 50, 100, 200];
  @Input() showPageSize: boolean = true;

  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  internalPageNumber: number = 1;
  internalPageSize: number = 50;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['pageNumber']) {
      this.internalPageNumber = this.pageNumber;
    }
    if (changes['pageSize']) {
      this.internalPageSize = this.pageSize;
    }
    // When totalCount/pageSize/totalPages change, current page may be out of range (e.g. after filter change).
    // Clamp and notify parent so it refetches the correct page.
    if (this.internalPageNumber > this.totalPages && this.totalPages > 0) {
      this.internalPageNumber = this.totalPages;
      this.pageChange.emit(this.internalPageNumber);
    }
  }

  get showingFrom(): number {
    if (this.totalCount === 0) return 0;
    return (this.internalPageNumber - 1) * this.internalPageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.internalPageNumber * this.internalPageSize, this.totalCount);
  }

  previousPage(): void {
    if (this.internalPageNumber > 1) {
      this.internalPageNumber--;
      this.pageChange.emit(this.internalPageNumber);
    }
  }

  nextPage(): void {
    if (this.internalPageNumber < this.totalPages) {
      this.internalPageNumber++;
      this.pageChange.emit(this.internalPageNumber);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.internalPageNumber) {
      this.internalPageNumber = page;
      this.pageChange.emit(this.internalPageNumber);
    }
  }

  changePageSize(): void {
    this.internalPageNumber = 1;
    this.pageSizeChange.emit(this.internalPageSize);
    this.pageChange.emit(1);
  }

  /** Page numbers and ellipsis to show (e.g. [1, 2, 3, 'ellipsis', 168, 169, 170]). Max 7 number slots + ellipsis. */
  get visiblePages(): (number | 'ellipsis')[] {
    const total = this.totalPages;
    const current = this.internalPageNumber;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const result: (number | 'ellipsis')[] = [];
    const showEdge = 2; // pages around current
    const showFirst = 1;
    const showLast = 1;
    const left = Math.max(showFirst + 1, current - showEdge);
    const right = Math.min(total - showLast, current + showEdge);
    // First page
    result.push(1);
    if (left > 2) result.push('ellipsis');
    // Middle window
    for (let p = left; p <= right; p++) {
      if (p !== 1 && p !== total) result.push(p);
    }
    if (right < total - 1) result.push('ellipsis');
    if (total > 1) result.push(total);
    return result;
  }
}


import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReferralDriver } from '../../../core/models/driver.model';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mlm-tree-branch" [style.margin-left.px]="indent">
      <!-- Connector Lines with Expand/Collapse Button at Branch Point -->
      @if (indent > 0) {
        <div class="tree-connector">
          <div class="connector-vertical"></div>
          <div class="connector-horizontal">
            @if (hasChildren) {
              <button type="button" 
                      class="branch-expand-btn" 
                      [class.expanded]="isExpanded"
                      (click)="onToggleClick($event)"
                      title="{{ isExpanded ? 'Collapse' : 'Expand' }}">
                <i class="fas" [class.fa-minus]="isExpanded" [class.fa-plus]="!isExpanded"></i>
              </button>
            }
          </div>
        </div>
      }
      
      <!-- Node Card -->
      <div class="mlm-tree-node-wrapper" 
           [class.selected]="isSelected"
           [attr.data-level]="level"
           (click)="onNodeClick()">
        <div class="mlm-tree-node">
          <div class="node-avatar">
            <span class="avatar-initials">{{ getUserInitials(driver.fullName || '') }}</span>
          </div>
          <div class="node-content">
            <div class="node-id">{{ formatRoId(driver.driverId) }}</div>
            <div class="node-name">{{ driver.fullName || 'N/A' }}</div>
          </div>
          <div class="node-badges">
            <div class="level-badge">Tier {{ level - 1 }}</div>
            <button type="button" class="info-btn" title="View Details" (click)="onInfoClick($event)">
              <i class="fas fa-info-circle"></i>
            </button>
          </div>
        </div>
        
        <!-- Nested Children (Recursive) -->
        @if (hasChildren && isExpanded) {
          <div class="mlm-tree-children">
            @for (child of driver.children; track child.driverId) {
              <app-tree-node
                [driver]="child"
                [level]="level + 1"
                [indent]="60"
                [isExpanded]="isChildExpanded(child.driverId)"
                [isSelected]="isChildSelected(child.driverId)"
                [expandedNodes]="expandedNodes"
                [selectedNodeId]="selectedNodeId"
                (toggleNode)="onChildToggle($event)"
                (selectNode)="onChildSelect($event)"
                (infoNode)="onChildInfo($event)">
              </app-tree-node>
            }
          </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['../driver-detail/driver-detail.scss']
})
export class TreeNodeComponent {
  @Input() driver!: ReferralDriver;
  @Input() level: number = 2;
  @Input() indent: number = 0;
  @Input() isExpanded: boolean = false;
  @Input() isSelected: boolean = false;
  @Input() expandedNodes: Set<number> = new Set();
  @Input() selectedNodeId: number | null = null;
  
  @Output() toggleNode = new EventEmitter<number>();
  @Output() selectNode = new EventEmitter<number>();
  @Output() infoNode = new EventEmitter<number>();

  get hasChildren(): boolean {
    return !!(this.driver.children && this.driver.children.length > 0);
  }

  getUserInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  formatRoId(id: number | undefined | null): string {
    if (id === undefined || id === null) return '-';
    return `RO${id}`;
  }

  isChildExpanded(driverId: number): boolean {
    return this.expandedNodes.has(driverId);
  }

  isChildSelected(driverId: number): boolean {
    return this.selectedNodeId === driverId;
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    this.toggleNode.emit(this.driver.driverId);
  }

  onNodeClick(): void {
    this.selectNode.emit(this.driver.driverId);
  }

  onInfoClick(event: Event): void {
    event.stopPropagation();
    this.infoNode.emit(this.driver.driverId);
  }

  onChildToggle(driverId: number): void {
    this.toggleNode.emit(driverId);
  }

  onChildSelect(driverId: number): void {
    this.selectNode.emit(driverId);
  }

  onChildInfo(driverId: number): void {
    this.infoNode.emit(driverId);
  }
}


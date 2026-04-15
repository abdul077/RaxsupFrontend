import { Injectable } from '@angular/core';
import { ReferralTree, ReferralDriver } from '../../../core/models/driver.model';

interface TreeNode {
  driver: ReferralDriver;
  parentId?: number;
  level: number;
  x: number;
  y: number;
  children: TreeNode[];
}

@Injectable({
  providedIn: 'root'
})
export class MLMTreeService {
  private readonly nodeWidth = 140;
  private readonly nodeHeight = 100;
  private readonly horizontalSpacing = 180;
  private readonly verticalSpacing = 160;
  private readonly lineColor = '#adb5bd';
  private readonly lineWidth = 2.5;

  /**
   * Build a hierarchical tree structure from levels
   */
  buildTreeStructure(
    tree: ReferralTree,
    levels: Array<{level: number, nodes: Array<{driver: ReferralDriver, parentId?: number}>}>
  ): TreeNode {
    const rootNode: TreeNode = {
      driver: {
        driverId: tree.driverId,
        fullName: tree.driverName,
        status: 'Active',
        totalEarnings: tree.totalEarnings,
        referralCount: tree.totalReferrals
      } as ReferralDriver,
      level: 1,
      x: 0,
      y: 0,
      children: []
    };

    // Build tree recursively
    this.buildChildren(rootNode, levels, 2);
    
    return rootNode;
  }

  /**
   * Recursively build children for a node
   */
  private buildChildren(
    parentNode: TreeNode,
    levels: Array<{level: number, nodes: Array<{driver: ReferralDriver, parentId?: number}>}>,
    currentLevel: number
  ): void {
    if (currentLevel > 5) return;

    const levelData = levels.find(l => l.level === currentLevel);
    if (!levelData) return;

    // Find all children of this parent
    const children = levelData.nodes.filter(n => n.parentId === parentNode.driver.driverId);
    
    children.forEach(childNode => {
      const treeNode: TreeNode = {
        driver: childNode.driver,
        parentId: parentNode.driver.driverId,
        level: currentLevel,
        x: 0,
        y: 0,
        children: []
      };
      
      // Recursively build children
      this.buildChildren(treeNode, levels, currentLevel + 1);
      
      parentNode.children.push(treeNode);
    });
  }

  /**
   * Calculate positions for all nodes in the tree
   * Uses a hierarchical layout algorithm
   */
  calculatePositions(rootNode: TreeNode, rootX: number, rootY: number): Map<number, { x: number; y: number }> {
    const positions = new Map<number, { x: number; y: number }>();
    
    // Position root
    positions.set(rootNode.driver.driverId, { x: rootX, y: rootY });
    
    // Calculate positions for children recursively
    this.positionNode(rootNode, rootX, rootY, positions);
    
    return positions;
  }

  /**
   * Position a node and its children
   */
  private positionNode(
    node: TreeNode,
    parentX: number,
    parentY: number,
    positions: Map<number, { x: number; y: number }>
  ): void {
    if (node.children.length === 0) return;

    const y = parentY + this.verticalSpacing;
    const childCount = node.children.length;
    
    if (childCount === 1) {
      // Single child: position directly under parent
      const x = parentX;
      positions.set(node.children[0].driver.driverId, { x, y });
      this.positionNode(node.children[0], x, y, positions);
    } else {
      // Multiple children: center them under parent
      const totalWidth = (childCount - 1) * this.horizontalSpacing;
      const startX = parentX - (totalWidth / 2);
      
      node.children.forEach((child, index) => {
        const x = startX + (index * this.horizontalSpacing);
        positions.set(child.driver.driverId, { x, y });
        this.positionNode(child, x, y, positions);
      });
    }
  }

  /**
   * Generate SVG tree visualization
   */
  generateMLMTree(
    tree: ReferralTree,
    levels: Array<{level: number, nodes: Array<{driver: ReferralDriver, parentId?: number}>}>,
    containerWidth: number = 1400,
    containerHeight: number = 900
  ): string {
    // Build tree structure
    const rootNode = this.buildTreeStructure(tree, levels);
    
    // Calculate positions
    const rootX = containerWidth / 2;
    const rootY = 50;
    const positions = this.calculatePositions(rootNode, rootX, rootY);
    
    // Calculate actual dimensions
    let minX = rootX;
    let maxX = rootX;
    let maxY = rootY;
    positions.forEach(pos => {
      minX = Math.min(minX, pos.x - this.nodeWidth / 2);
      maxX = Math.max(maxX, pos.x + this.nodeWidth / 2);
      maxY = Math.max(maxY, pos.y + this.nodeHeight / 2);
    });
    
    const padding = 80;
    const calculatedWidth = Math.max(containerWidth, maxX - minX + (padding * 2));
    const calculatedHeight = Math.max(containerHeight, maxY + padding);
    
    // Center the tree
    const offsetX = (calculatedWidth / 2) - ((minX + maxX) / 2);
    const adjustedPositions = new Map<number, { x: number; y: number }>();
    positions.forEach((pos, driverId) => {
      adjustedPositions.set(driverId, { x: pos.x + offsetX, y: pos.y });
    });
    const adjustedRootX = rootX + offsetX;
    
    // Generate SVG
    let svg = `<svg width="100%" height="${calculatedHeight}" 
                    viewBox="0 0 ${calculatedWidth} ${calculatedHeight}"
                    xmlns="http://www.w3.org/2000/svg"
                    style="background: #f8f9fa; overflow: visible;">
      <defs>
        <filter id="mlm-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <style>
          .mlm-line { 
            stroke: ${this.lineColor}; 
            stroke-width: ${this.lineWidth}; 
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
          .mlm-node-group { 
            cursor: pointer; 
            transition: all 0.3s ease;
          }
          .mlm-node-group:hover { 
            transform: translateY(-5px) scale(1.05);
          }
          .mlm-node-group:hover .mlm-node-rect { 
            filter: drop-shadow(0 8px 16px rgba(0,0,0,0.25));
            stroke-width: 3.5;
          }
          .mlm-node-text { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            pointer-events: none;
          }
        </style>
      </defs>
      
      <!-- Draw connector lines -->
      <g class="mlm-lines">`;
    
    // Draw lines recursively
    svg += this.drawConnections(rootNode, adjustedPositions);
    
    svg += `</g>
      
      <!-- Draw nodes -->
      <g class="mlm-nodes">`;
    
    // Draw root node
    svg += this.generateNodeSVG(adjustedRootX, rootY, rootNode.driver, true, tree.totalReferrals);
    
    // Draw all other nodes
    adjustedPositions.forEach((pos, driverId) => {
      if (driverId !== tree.driverId) {
        const node = this.findNode(rootNode, driverId);
        if (node) {
          svg += this.generateNodeSVG(pos.x, pos.y, node.driver, false, node.driver.referralCount || 0, node.level);
        }
      }
    });
    
    svg += `</g>
    </svg>`;
    
    return svg;
  }

  /**
   * Draw connections between nodes recursively
   */
  private drawConnections(
    node: TreeNode,
    positions: Map<number, { x: number; y: number }>
  ): string {
    let svg = '';
    
    if (node.children.length === 0) return svg;

    const parentPos = positions.get(node.driver.driverId);
    if (!parentPos) return svg;

    const lineY = parentPos.y + this.nodeHeight / 2 + 10;

    if (node.children.length === 1) {
      // Single child: direct vertical line
      const childPos = positions.get(node.children[0].driver.driverId);
      if (childPos) {
        svg += `<line x1="${parentPos.x}" y1="${parentPos.y + this.nodeHeight / 2}" 
                      x2="${childPos.x}" y2="${childPos.y - this.nodeHeight / 2}" 
                      class="mlm-line"/>`;
      }
    } else {
      // Multiple children: T-junction
      const firstPos = positions.get(node.children[0].driver.driverId);
      const lastPos = positions.get(node.children[node.children.length - 1].driver.driverId);
      
      if (firstPos && lastPos) {
        // Vertical line from parent
        svg += `<line x1="${parentPos.x}" y1="${parentPos.y + this.nodeHeight / 2}" 
                      x2="${parentPos.x}" y2="${lineY}" 
                      class="mlm-line"/>`;
        
        // Horizontal line connecting siblings
        svg += `<line x1="${firstPos.x}" y1="${lineY}" 
                      x2="${lastPos.x}" y2="${lineY}" 
                      class="mlm-line"/>`;
        
        // Vertical lines to each child
        node.children.forEach(child => {
          const childPos = positions.get(child.driver.driverId);
          if (childPos) {
            svg += `<line x1="${childPos.x}" y1="${lineY}" 
                          x2="${childPos.x}" y2="${childPos.y - this.nodeHeight / 2}" 
                          class="mlm-line"/>`;
          }
        });
      }
    }

    // Recursively draw connections for children
    node.children.forEach(child => {
      svg += this.drawConnections(child, positions);
    });

    return svg;
  }

  /**
   * Find a node by driverId
   */
  private findNode(rootNode: TreeNode, driverId: number): TreeNode | null {
    if (rootNode.driver.driverId === driverId) {
      return rootNode;
    }
    
    for (const child of rootNode.children) {
      const found = this.findNode(child, driverId);
      if (found) return found;
    }
    
    return null;
  }

  /**
   * Generate SVG for a single node - Modern, User-Friendly Design
   */
  private generateNodeSVG(
    x: number,
    y: number,
    driver: ReferralDriver,
    isRoot: boolean,
    referralCount: number,
    level?: number
  ): string {
    const width = isRoot ? 150 : 140;
    const height = isRoot ? 110 : 100;
    const rx = 10;

    // Modern color scheme based on level
    let bgColor = '#ffffff';
    let borderColor = '#dee2e6';
    let textColor = '#212529';
    let iconBg = '#f8f9fa';
    let earningsColor = '#28a745';

    if (isRoot) {
      // Root: Premium blue gradient
      bgColor = '#2c7be5';
      borderColor = '#1a5bb8';
      textColor = '#ffffff';
      iconBg = 'rgba(255,255,255,0.25)';
      earningsColor = '#ffffff';
    } else if (level === 2) {
      // Level 2: Success green
      bgColor = '#d4edda';
      borderColor = '#28a745';
      earningsColor = '#155724';
    } else if (level === 3) {
      // Level 3: Info blue
      bgColor = '#d1ecf1';
      borderColor = '#17a2b8';
      earningsColor = '#0c5460';
    } else if (level === 4) {
      // Level 4: Warning yellow
      bgColor = '#fff3cd';
      borderColor = '#ffc107';
      earningsColor = '#856404';
    } else if (level === 5) {
      // Level 5: Purple
      bgColor = '#e7d9f5';
      borderColor = '#6f42c1';
      earningsColor = '#3d1f5c';
    }

    const earnings = driver.totalEarnings || 0;
    const earningsFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(earnings);

    return `
      <g class="mlm-node-group" transform="translate(${x - width/2}, ${y - height/2})">
        <!-- Card Background -->
        <rect width="${width}" height="${height}" rx="${rx}" 
              fill="${bgColor}" 
              stroke="${borderColor}" 
              stroke-width="${isRoot ? 3.5 : 2.5}"
              class="mlm-node-rect"
              filter="url(#mlm-shadow)"/>
        
        <!-- User Avatar Circle -->
        <circle cx="${width/2}" cy="32" r="18" 
                fill="${iconBg}" 
                stroke="${isRoot ? 'rgba(255,255,255,0.5)' : borderColor}" 
                stroke-width="2.5"/>
        
        <!-- User Icon -->
        <g transform="translate(${width/2}, 32)">
          <circle r="5" fill="${isRoot ? '#ffffff' : textColor}" opacity="0.95"/>
          <path d="M -5 6 Q -5 4.5 0 4.5 Q 5 4.5 5 6 L 5 11 Q 5 12.5 0 12.5 Q -5 12.5 -5 11 Z"
                fill="${isRoot ? '#ffffff' : textColor}" opacity="0.95"/>
        </g>
        
        <!-- Driver ID Label -->
        <text x="${width/2}" y="65" text-anchor="middle" 
              fill="${textColor}" 
              font-weight="700" 
              font-size="12" 
              class="mlm-node-text">Driver ID: ${driver.driverId}</text>
        
        <!-- Earnings Amount -->
        <text x="${width/2}" y="85" text-anchor="middle" 
              fill="${earningsColor}" 
              font-weight="700" 
              font-size="13" 
              class="mlm-node-text">${earningsFormatted}</text>
        
        <!-- Referral Count Badge (if applicable) -->
        ${referralCount > 0 ? `
          <circle cx="${width - 15}" cy="15" r="12" 
                  fill="${isRoot ? 'rgba(255,255,255,0.3)' : borderColor}" 
                  opacity="0.8"/>
          <text x="${width - 15}" y="19" text-anchor="middle" 
                fill="${isRoot ? '#ffffff' : textColor}" 
                font-weight="700" 
                font-size="10" 
                class="mlm-node-text">${referralCount}</text>
        ` : ''}
      </g>
    `;
  }
}


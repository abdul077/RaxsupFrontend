import { Injectable } from '@angular/core';
import { ReferralTree, ReferralDriver } from '../../../core/models/driver.model';

interface TreeNode {
  driver: ReferralDriver;
  parentId?: number;
  parentIndex?: number;
  siblingIndex?: number;
  siblingCount?: number;
  x?: number;
  y?: number;
}

interface TreeLevel {
  level: number;
  nodes: TreeNode[];
}

@Injectable({
  providedIn: 'root'
})
export class SVGTreeService {
  private readonly nodeWidth = 100;
  private readonly nodeHeight = 80;
  private readonly horizontalSpacing = 140; // Increased for better spacing in balanced tree
  private readonly verticalSpacing = 120; // Optimized vertical spacing
  private readonly lineColor = '#212529';
  private readonly lineWidth = 2;

  /**
   * Calculate positions for all nodes in the tree
   * Creates a balanced hierarchical tree structure where children are centered under parents
   */
  calculateNodePositions(levels: TreeLevel[], rootX: number): Map<number, { x: number; y: number }> {
    const positions = new Map<number, { x: number; y: number }>();
    
    // Calculate positions for each level
    levels.forEach((level, levelIndex) => {
      const y = (levelIndex + 1) * this.verticalSpacing;
      
      // Group nodes by parent - ensures siblings stay together
      const nodesByParent = new Map<number, TreeNode[]>();
      const orphanNodes: TreeNode[] = []; // Nodes without parentId
      
      level.nodes.forEach(node => {
        if (node.parentId !== undefined) {
          if (!nodesByParent.has(node.parentId)) {
            nodesByParent.set(node.parentId, []);
          }
          nodesByParent.get(node.parentId)!.push(node);
        } else {
          // Collect nodes without parentId (shouldn't happen, but handle it)
          orphanNodes.push(node);
        }
      });
      
      // Build parent groups with their positions
      const parentGroups: Array<{parentId: number, siblings: TreeNode[], parentX?: number}> = [];
      
      nodesByParent.forEach((siblings, parentId) => {
        const parentPos = positions.get(parentId);
        // Sort siblings by their siblingIndex to maintain correct order
        siblings.sort((a, b) => {
          const aIndex = a.siblingIndex !== undefined ? a.siblingIndex : 0;
          const bIndex = b.siblingIndex !== undefined ? b.siblingIndex : 0;
          return aIndex - bIndex;
        });
        parentGroups.push({
          parentId,
          siblings,
          parentX: parentPos?.x
        });
      });
      
      // Sort groups by parent X position (left to right) for consistent ordering
      parentGroups.sort((a, b) => {
        if (a.parentX !== undefined && b.parentX !== undefined) {
          return a.parentX - b.parentX;
        }
        return a.parentId - b.parentId;
      });
      
      // Position each parent's children centered under the parent
      parentGroups.forEach((group) => {
        const siblingCount = group.siblings.length;
        
        if (group.parentX !== undefined && siblingCount > 0) {
          // Center children directly under parent
          const groupWidth = siblingCount > 1 ? (siblingCount - 1) * this.horizontalSpacing : 0;
          const groupStartX = group.parentX - (groupWidth / 2);
          
          // Position all siblings centered under their parent
          group.siblings.forEach((node, index) => {
            const x = siblingCount === 1 ? (group.parentX || rootX) : groupStartX + (index * this.horizontalSpacing);
            positions.set(node.driver.driverId, { x, y });
          });
        } else if (siblingCount > 0) {
          // First level - center under root
          const groupWidth = siblingCount > 1 ? (siblingCount - 1) * this.horizontalSpacing : 0;
          const groupStartX = rootX - (groupWidth / 2);
          
          group.siblings.forEach((node, index) => {
            const x = siblingCount === 1 ? rootX : groupStartX + (index * this.horizontalSpacing);
            positions.set(node.driver.driverId, { x, y });
          });
        }
      });
      
      // Handle orphan nodes (nodes without parentId) - position them sequentially
      if (orphanNodes.length > 0) {
        const orphanWidth = (orphanNodes.length - 1) * this.horizontalSpacing;
        const orphanStartX = rootX - (orphanWidth / 2);
        orphanNodes.forEach((node, index) => {
          const x = orphanNodes.length === 1 ? rootX : orphanStartX + (index * this.horizontalSpacing);
          positions.set(node.driver.driverId, { x, y });
        });
      }
    });
    
    return positions;
  }

  /**
   * Generate SVG path for connecting parent to children
   */
  private generateConnectorPath(
    parentX: number,
    parentY: number,
    childX: number,
    childY: number,
    isFirst: boolean,
    isLast: boolean,
    hasSiblings: boolean
  ): string {
    const midY = parentY + this.nodeHeight / 2 + 20; // Space below parent node
    
    if (hasSiblings) {
      // Horizontal line from parent, then vertical to child
      return `M ${parentX} ${midY} 
              L ${childX} ${midY} 
              L ${childX} ${childY - this.nodeHeight / 2}`;
    } else {
      // Single child: direct vertical line
      return `M ${parentX} ${midY} 
              L ${childX} ${childY - this.nodeHeight / 2}`;
    }
  }

  /**
   * Generate horizontal line connecting siblings
   */
  private generateSiblingConnector(
    firstX: number,
    lastX: number,
    y: number
  ): string {
    return `M ${firstX} ${y} L ${lastX} ${y}`;
  }

  /**
   * Generate complete SVG tree markup
   */
  generateSVGTree(
    tree: ReferralTree,
    levels: TreeLevel[],
    containerWidth: number = 1200,
    containerHeight: number = 800
  ): string {
    let rootX = containerWidth / 2;
    const rootY = 30;
    
    // Calculate node positions
    let positions = this.calculateNodePositions(levels, rootX);
    
    // Verify all nodes have positions
    const totalNodes = levels.reduce((sum, level) => sum + level.nodes.length, 0);
    if (positions.size < totalNodes) {
      console.warn(`Missing positions: Expected ${totalNodes} nodes, got ${positions.size} positions`);
      // Add missing positions as fallback
      levels.forEach((level, levelIndex) => {
        const y = (levelIndex + 1) * this.verticalSpacing;
        level.nodes.forEach((node, nodeIndex) => {
          if (!positions.has(node.driver.driverId)) {
            // Fallback position
            const x = rootX + (nodeIndex * this.horizontalSpacing);
            positions.set(node.driver.driverId, { x, y });
          }
        });
      });
    }
    
    // Calculate actual width needed based on node positions
    let minX = rootX;
    let maxX = rootX;
    positions.forEach(pos => {
      minX = Math.min(minX, pos.x - this.nodeWidth / 2);
      maxX = Math.max(maxX, pos.x + this.nodeWidth / 2);
    });
    
    // Add padding and ensure tree is centered
    const padding = 80;
    const treeWidth = maxX - minX;
    const calculatedWidth = Math.max(containerWidth, treeWidth + (padding * 2));
    
    // Center the tree by adjusting root position
    const treeCenterX = (minX + maxX) / 2;
    const offset = (calculatedWidth / 2) - treeCenterX;
    
    if (Math.abs(offset) > 1) {
      rootX = calculatedWidth / 2;
      const adjustedPositions = new Map<number, { x: number; y: number }>();
      positions.forEach((pos, driverId) => {
        adjustedPositions.set(driverId, { x: pos.x + offset, y: pos.y });
      });
      positions = adjustedPositions;
    } else {
      rootX = calculatedWidth / 2;
    }
    
    // Calculate container height based on levels
    const calculatedHeight = Math.max(
      containerHeight,
      (levels.length + 1) * this.verticalSpacing + 100
    );
    
    let svg = `<svg width="100%" height="${calculatedHeight}" 
                    viewBox="0 0 ${calculatedWidth} ${calculatedHeight}"
                    xmlns="http://www.w3.org/2000/svg"
                    style="background: #ffffff; overflow: visible;">
      <defs>
        <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="1.5" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <style>
          .tree-line { 
            stroke: ${this.lineColor}; 
            stroke-width: ${this.lineWidth}; 
            fill: none;
            stroke-linecap: round;
            stroke-linejoin: round;
            opacity: 0.9;
          }
          .tree-node-group { 
            cursor: pointer; 
            transition: transform 0.2s ease;
          }
          .tree-node-group:hover { 
            transform: translateY(-2px);
          }
          .tree-node-group:hover .tree-node-rect { 
            stroke-width: ${this.lineWidth + 0.5};
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
          }
          .tree-node-text { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            pointer-events: none;
          }
        </style>
      </defs>
      
      <!-- Draw connector lines -->
      <g class="tree-lines">`;
    
    // Draw lines from root to level 2
    if (levels.length > 0 && levels[0].nodes.length > 0) {
      const level2Nodes = levels[0].nodes;
      
      // Group siblings by parent (for level 2, all have same parent - root)
      const siblings = level2Nodes;
      
      // Draw vertical line from root to horizontal line
      if (siblings.length > 0) {
        const firstPos = positions.get(siblings[0].driver.driverId);
        const lastPos = positions.get(siblings[siblings.length - 1].driver.driverId);
        if (firstPos && lastPos) {
          const lineY = rootY + this.nodeHeight / 2 + 12;
          
          // Draw vertical line from root to horizontal line
          svg += `<line x1="${rootX}" y1="${rootY + this.nodeHeight / 2}" x2="${rootX}" y2="${lineY}" class="tree-line"/>`;
          
          // Draw horizontal line connecting siblings
          if (siblings.length > 1) {
            svg += `<line x1="${firstPos.x}" y1="${lineY}" x2="${lastPos.x}" y2="${lineY}" class="tree-line"/>`;
          }
          
          // Draw vertical lines from horizontal line to each child
          level2Nodes.forEach((node) => {
            const nodePos = positions.get(node.driver.driverId);
            if (nodePos) {
              svg += `<line x1="${nodePos.x}" y1="${lineY}" x2="${nodePos.x}" y2="${nodePos.y - this.nodeHeight / 2}" class="tree-line"/>`;
            }
          });
        }
      }
    }
    
    // Draw lines for nested levels
    levels.forEach((level, levelIndex) => {
      if (levelIndex === 0) return; // Level 2 already handled
      
      const parentLevel = levels[levelIndex - 1];
      
      // Group nodes by parent
      const nodesByParent = new Map<number, TreeNode[]>();
      level.nodes.forEach(node => {
        if (node.parentId !== undefined) {
          if (!nodesByParent.has(node.parentId)) {
            nodesByParent.set(node.parentId, []);
          }
          nodesByParent.get(node.parentId)!.push(node);
        }
      });
      
      // Draw lines for each parent group
      nodesByParent.forEach((siblings, parentId) => {
        const parentNode = parentLevel.nodes.find(n => n.driver.driverId === parentId);
        const parentPos = positions.get(parentId);
        
        if (parentPos && siblings.length > 0) {
          const lineY = parentPos.y + this.nodeHeight / 2 + 12;
          
          // Draw vertical line from parent to horizontal line
          if (siblings.length > 1) {
            // For multiple siblings, draw line from parent center to horizontal line
            const firstPos = positions.get(siblings[0].driver.driverId);
            const lastPos = positions.get(siblings[siblings.length - 1].driver.driverId);
            if (firstPos && lastPos) {
              // Vertical line from parent down to horizontal line
              svg += `<line x1="${parentPos.x}" y1="${parentPos.y + this.nodeHeight / 2}" x2="${parentPos.x}" y2="${lineY}" class="tree-line"/>`;
              
              // Horizontal line connecting all siblings
              svg += `<line x1="${firstPos.x}" y1="${lineY}" x2="${lastPos.x}" y2="${lineY}" class="tree-line"/>`;
              
              // Vertical lines from horizontal line down to each child node
              siblings.forEach((node) => {
                const nodePos = positions.get(node.driver.driverId);
                if (nodePos) {
                  svg += `<line x1="${nodePos.x}" y1="${lineY}" x2="${nodePos.x}" y2="${nodePos.y - this.nodeHeight / 2}" class="tree-line"/>`;
                }
              });
            }
          } else {
            // Single child - direct vertical line from parent to child
            const nodePos = positions.get(siblings[0].driver.driverId);
            if (nodePos) {
              svg += `<line x1="${parentPos.x}" y1="${parentPos.y + this.nodeHeight / 2}" x2="${nodePos.x}" y2="${nodePos.y - this.nodeHeight / 2}" class="tree-line"/>`;
            }
          }
        }
      });
    });
    
    svg += `</g>
      
      <!-- Draw nodes -->
      <g class="tree-nodes">`;
    
    // Root node
    svg += this.generateNodeSVG(rootX, rootY, {
      driverId: tree.driverId,
      fullName: tree.driverName,
      status: 'Active',
      totalEarnings: tree.totalEarnings,
      referralCount: tree.totalReferrals
    } as ReferralDriver, true, tree.totalReferrals);
    
    // Other nodes - render ALL nodes from all levels, even if position is missing
    levels.forEach(level => {
      level.nodes.forEach(node => {
        const pos = positions.get(node.driver.driverId);
        if (pos) {
          svg += this.generateNodeSVG(pos.x, pos.y, node.driver, false, node.driver.referralCount || 0, level.level);
        } else {
          // Fallback: render node even if position calculation failed
          const y = (level.level - 1) * this.verticalSpacing;
          const x = rootX;
          svg += this.generateNodeSVG(x, y, node.driver, false, node.driver.referralCount || 0, level.level);
        }
      });
    });
    
    svg += `</g>
    </svg>`;
    
    return svg;
  }

  /**
   * Generate SVG for a single node
   */
  private generateNodeSVG(
    x: number, 
    y: number, 
    driver: ReferralDriver, 
    isRoot: boolean,
    referralCount: number,
    level?: number
  ): string {
    const width = isRoot ? 110 : 100;
    const height = isRoot ? 85 : 80;
    const rx = 6;
    
    // Color based on level - matching reference design
    let bgColor = '#ffffff';
    let borderColor = '#dee2e6';
    let textColor = '#212529';
    
    if (isRoot) {
      // Blue for 1st generation
      bgColor = '#2c7be5';
      borderColor = '#1a5bb8';
      textColor = '#ffffff';
    } else if (level === 2) {
      // Green for 2nd generation
      bgColor = '#d4edda';
      borderColor = '#28a745';
      textColor = '#212529';
    } else if (level === 3) {
      // Light blue for 3rd generation
      bgColor = '#d1ecf1';
      borderColor = '#17a2b8';
      textColor = '#212529';
    } else if (level === 4) {
      // Yellow for 4th generation
      bgColor = '#fff3cd';
      borderColor = '#ffc107';
      textColor = '#212529';
    } else if (level === 5) {
      // Purple for 5th generation
      bgColor = '#e7d9f5';
      borderColor = '#6f42c1';
      textColor = '#212529';
    }
    
    const earnings = driver.totalEarnings || 0;
    const earningsFormatted = new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(earnings);
    
    return `
      <g class="tree-node-group" transform="translate(${x - width/2}, ${y - height/2})">
        <!-- Node background -->
        <rect width="${width}" height="${height}" rx="${rx}" 
              fill="${bgColor}" 
              stroke="${borderColor}" 
              stroke-width="${isRoot ? 2.5 : 2}"
              class="tree-node-rect"
              filter="url(#node-shadow)"/>
        
        <!-- Avatar circle -->
        <circle cx="${width/2}" cy="22" r="14" 
                fill="${isRoot ? 'rgba(255,255,255,0.25)' : '#ffffff'}" 
                stroke="${isRoot ? 'rgba(255,255,255,0.5)' : borderColor}" 
                stroke-width="1.5"/>
        
        <!-- Person icon -->
        <g transform="translate(${width/2}, 22)">
          <!-- Head -->
          <circle r="4" fill="${isRoot ? '#ffffff' : textColor}" opacity="${isRoot ? '1' : '0.8'}"/>
          <!-- Body -->
          <path d="M -4.5 5.5 Q -4.5 4 0 4 Q 4.5 4 4.5 5.5 L 4.5 9 Q 4.5 10.5 0 10.5 Q -4.5 10.5 -4.5 9 Z"
                fill="${isRoot ? '#ffffff' : textColor}" 
                opacity="${isRoot ? '1' : '0.8'}"/>
        </g>
        
        <!-- Driver ID -->
        <text x="${width/2}" y="48" text-anchor="middle" 
              fill="${textColor}" 
              font-weight="600" 
              font-size="10" 
              class="tree-node-text">ID: ${driver.driverId}</text>
        
        <!-- Earnings -->
        <text x="${width/2}" y="65" text-anchor="middle" 
              fill="${isRoot ? '#ffffff' : '#28a745'}" 
              font-weight="600" 
              font-size="11" 
              class="tree-node-text">${earningsFormatted}</text>
      </g>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


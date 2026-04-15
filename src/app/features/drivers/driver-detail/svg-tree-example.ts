/**
 * SVG-Based Tree Visualization Example
 * 
 * This is a reference implementation showing how to create
 * an accurate tree visualization using SVG instead of CSS.
 * 
 * Benefits:
 * - Perfect line accuracy (like the reference image)
 * - Cleaner code than complex CSS
 * - Fully interactive
 * - No external dependencies
 */

interface TreeNode {
  driver: any;
  parentId?: number;
  parentIndex?: number;
  siblingIndex?: number;
  siblingCount?: number;
}

interface TreeLevel {
  level: number;
  nodes: TreeNode[];
}

interface NodePosition {
  x: number;
  y: number;
  node: TreeNode;
}

export class SVGTreeGenerator {
  private nodeWidth = 160;
  private nodeHeight = 120;
  private horizontalSpacing = 200;
  private verticalSpacing = 180;
  private lineColor = '#495057';
  private lineWidth = 3;

  /**
   * Calculate positions for all nodes in the tree
   */
  calculateNodePositions(levels: TreeLevel[]): NodePosition[] {
    const positions: NodePosition[] = [];
    
    // Root node (Level 1) - center top
    const rootX = this.nodeWidth / 2;
    const rootY = 0;
    positions.push({ x: rootX, y: rootY, node: null as any }); // Root handled separately
    
    // Calculate positions for each level
    levels.forEach((level, levelIndex) => {
      const y = (levelIndex + 1) * this.verticalSpacing;
      const nodeCount = level.nodes.length;
      
      // Group nodes by parent
      const nodesByParent = new Map<number, TreeNode[]>();
      level.nodes.forEach(node => {
        if (!nodesByParent.has(node.parentId!)) {
          nodesByParent.set(node.parentId!, []);
        }
        nodesByParent.get(node.parentId!)!.push(node);
      });
      
      // Position nodes
      let currentX = 0;
      nodesByParent.forEach((siblings, parentId) => {
        const siblingCount = siblings.length;
        const groupWidth = (siblingCount - 1) * this.horizontalSpacing;
        const startX = currentX + (this.nodeWidth / 2);
        
        siblings.forEach((node, index) => {
          const x = startX + (index * this.horizontalSpacing);
          positions.push({ x, y, node });
        });
        
        currentX += groupWidth + this.horizontalSpacing;
      });
    });
    
    return positions;
  }

  /**
   * Generate SVG path for connecting parent to children
   */
  generateConnectorPath(
    parentX: number,
    parentY: number,
    childX: number,
    childY: number,
    isFirst: boolean,
    isLast: boolean,
    hasSiblings: boolean
  ): string {
    const midY = parentY + (childY - parentY) / 2;
    
    if (hasSiblings) {
      // Horizontal line from parent, then vertical to child
      if (isFirst) {
        // First sibling: horizontal line extends right
        return `M ${parentX} ${parentY} 
                L ${childX} ${parentY} 
                L ${childX} ${childY}`;
      } else if (isLast) {
        // Last sibling: horizontal line extends left
        return `M ${parentX} ${parentY} 
                L ${childX} ${parentY} 
                L ${childX} ${childY}`;
      } else {
        // Middle sibling: connect to horizontal line
        return `M ${parentX} ${parentY} 
                L ${childX} ${parentY} 
                L ${childX} ${childY}`;
      }
    } else {
      // Single child: direct vertical line
      return `M ${parentX} ${parentY} 
              L ${childX} ${childY}`;
    }
  }

  /**
   * Generate complete SVG tree markup
   */
  generateSVGTree(
    rootNode: any,
    levels: TreeLevel[],
    containerWidth: number,
    containerHeight: number
  ): string {
    const positions = this.calculateNodePositions(levels);
    const rootX = containerWidth / 2;
    const rootY = 0;
    
    let svg = `<svg width="${containerWidth}" height="${containerHeight}" 
                    xmlns="http://www.w3.org/2000/svg"
                    style="background: #f8f9fa;">
      <defs>
        <style>
          .tree-line { stroke: ${this.lineColor}; stroke-width: ${this.lineWidth}; fill: none; }
          .tree-node { cursor: pointer; }
          .tree-node:hover { opacity: 0.8; }
        </style>
      </defs>
      
      <!-- Draw connector lines -->
      <g class="tree-lines">`;
    
    // Draw lines from root to level 2
    const level2Nodes = levels[0]?.nodes || [];
    level2Nodes.forEach((node, index) => {
      const nodePos = positions.find(p => p.node?.driver?.driverId === node.driver.driverId);
      if (nodePos) {
        const isFirst = index === 0;
        const isLast = index === level2Nodes.length - 1;
        const hasSiblings = level2Nodes.length > 1;
        const path = this.generateConnectorPath(
          rootX, rootY,
          nodePos.x, nodePos.y,
          isFirst, isLast, hasSiblings
        );
        svg += `<path d="${path}" class="tree-line"/>`;
      }
    });
    
    // Draw lines for nested levels
    levels.forEach((level, levelIndex) => {
      if (levelIndex === 0) return; // Level 2 already handled
      
      const parentLevel = levels[levelIndex - 1];
      level.nodes.forEach(node => {
        const nodePos = positions.find(p => p.node?.driver?.driverId === node.driver.driverId);
        const parentNode = parentLevel.nodes.find(n => n.driver.driverId === node.parentId);
        const parentPos = positions.find(p => p.node?.driver?.driverId === parentNode?.driver.driverId);
        
        if (nodePos && parentPos) {
          const siblings = level.nodes.filter(n => n.parentId === node.parentId);
          const siblingIndex = siblings.findIndex(n => n.driver.driverId === node.driver.driverId);
          const isFirst = siblingIndex === 0;
          const isLast = siblingIndex === siblings.length - 1;
          const hasSiblings = siblings.length > 1;
          
          const path = this.generateConnectorPath(
            parentPos.x, parentPos.y,
            nodePos.x, nodePos.y,
            isFirst, isLast, hasSiblings
          );
          svg += `<path d="${path}" class="tree-line"/>`;
        }
      });
    });
    
    svg += `</g>
      
      <!-- Draw nodes -->
      <g class="tree-nodes">`;
    
    // Root node
    svg += this.generateNodeSVG(rootX, rootY, rootNode, true);
    
    // Other nodes
    positions.forEach(pos => {
      if (pos.node) {
        svg += this.generateNodeSVG(pos.x, pos.y, pos.node.driver, false);
      }
    });
    
    svg += `</g>
    </svg>`;
    
    return svg;
  }

  /**
   * Generate SVG for a single node
   */
  private generateNodeSVG(x: number, y: number, driver: any, isRoot: boolean): string {
    const width = isRoot ? 170 : 160;
    const height = isRoot ? 130 : 120;
    const rx = 10;
    
    return `
      <g class="tree-node" transform="translate(${x - width/2}, ${y - height/2})">
        <rect width="${width}" height="${height}" rx="${rx}" 
              fill="${isRoot ? '#2c7be5' : '#ffffff'}" 
              stroke="${isRoot ? '#1a5bb8' : '#dee2e6'}" 
              stroke-width="${isRoot ? 3 : 2}"/>
        <text x="${width/2}" y="30" text-anchor="middle" 
              fill="${isRoot ? '#ffffff' : '#212529'}" 
              font-weight="bold" font-size="14">
          ${driver.fullName || driver.name}
        </text>
        <!-- Add more node content here -->
      </g>
    `;
  }
}

/**
 * Usage in Angular Component:
 * 
 * import { DomSanitizer } from '@angular/platform-browser';
 * 
 * constructor(private sanitizer: DomSanitizer) {}
 * 
 * getSVGTree(tree: ReferralTree): SafeHtml {
 *   const generator = new SVGTreeGenerator();
 *   const levels = this.getTreeByLevels(tree);
 *   const svg = generator.generateSVGTree(
 *     { name: tree.driverName },
 *     levels,
 *     1200,
 *     800
 *   );
 *   return this.sanitizer.bypassSecurityTrustHtml(svg);
 * }
 * 
 * In template:
 * <div [innerHTML]="getSVGTree(tree)"></div>
 */


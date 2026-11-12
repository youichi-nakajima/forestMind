import { FreeMindNode, NodePosition } from '../types/freemind';

export interface LayoutNode {
  node: FreeMindNode;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  side: 'left' | 'right' | 'root';
  depth: number;
  parent?: LayoutNode;
  children: LayoutNode[];
}

export interface EdgePath {
  id: string;
  sourceId: string;
  targetId: string;
  d: string;
  color: string;
  width: number;
  style: string;
}

export interface RenderArrowLink {
  id: string;
  sourceId: string;
  targetId: string;
  d: string;
  color: string;
  targetX: number;
  targetY: number;
}

export interface RenderCloud {
  id: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const HORIZONTAL_GAP = 68;
const VERTICAL_GAP = 16;
const DEFAULT_NODE_HEIGHT = 32;

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  return measureCtx;
}

function estimateTextWidthFallback(text: string, fontSize: number, isBold: boolean): number {
  let width = 0;
  const halfWidthFactor = isBold ? 0.65 : 0.58;
  const fullWidthFactor = isBold ? 1.08 : 1.02;

  for (const ch of text) {
    const code = ch.codePointAt(0) || 0;
    // Full-width CJK, Japanese punctuation, Emoji, etc.
    if (code > 0x7f) {
      width += fontSize * fullWidthFactor;
    } else {
      width += fontSize * halfWidthFactor;
    }
  }
  return width;
}

/**
 * Estimate node dimensions in pixels (uses Canvas 2D measureText in browser, CJK-aware fallback in tests)
 */
export function estimateNodeDimensions(
  node: FreeMindNode,
  isRoot: boolean = false
): { width: number; height: number } {
  const rawText = node.text || (node.htmlContent ? node.htmlContent.replace(/<[^>]+>/g, '').trim() : 'Node');
  const text = rawText || ' ';
  const baseFontSize = node.font?.size || (isRoot ? 17 : 14);
  const isBold = node.font?.bold || isRoot;
  const isItalic = node.font?.italic || false;

  let textWidth = 0;
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
    textWidth = ctx.measureText(text).width;
  } else {
    textWidth = estimateTextWidthFallback(text, baseFontSize, isBold);
  }

  textWidth = Math.max(textWidth, 32);

  // Extra width for icons (each icon ~18px + 3px gap + 6px margin)
  if (node.icons && node.icons.length > 0) {
    textWidth += node.icons.length * 20 + 6;
  }
  // Extra width for link indicator
  if (node.link) {
    textWidth += 20;
  }
  // Extra width for note indicator
  if (node.noteHtml) {
    textWidth += 20;
  }

  // Horizontal padding based on node style (+ safety buffer so text never wraps)
  const isBubble = node.style === 'bubble' || isRoot;
  const horizontalPadding = isRoot ? 48 : isBubble ? 36 : 28;

  const width = Math.min(Math.max(Math.ceil(textWidth + horizontalPadding), 64), 560);
  const height = Math.max(Math.round(baseFontSize + (isRoot ? 22 : 16)), DEFAULT_NODE_HEIGHT);

  return { width, height };
}

/**
 * Compute positions for all visible nodes in the mindmap.
 */
export function computeLayout(rootNode: FreeMindNode): {
  layoutNodes: Map<string, LayoutNode>;
  edges: EdgePath[];
  arrowLinks: RenderArrowLink[];
  clouds: RenderCloud[];
} {
  const layoutMap = new Map<string, LayoutNode>();
  const edges: EdgePath[] = [];
  const arrowLinks: RenderArrowLink[] = [];
  const clouds: RenderCloud[] = [];

  const rootDim = estimateNodeDimensions(rootNode, true);
  const rootLayout: LayoutNode = {
    node: rootNode,
    id: rootNode.id,
    x: 0,
    y: 0,
    width: rootDim.width,
    height: rootDim.height,
    side: 'root',
    depth: 0,
    children: [],
  };
  layoutMap.set(rootNode.id, rootLayout);

  if (!rootNode.folded && rootNode.children.length > 0) {
    // Partition root's direct children into right and left
    const rightChildren: FreeMindNode[] = [];
    const leftChildren: FreeMindNode[] = [];

    rootNode.children.forEach((child, index) => {
      if (child.position === 'left') {
        leftChildren.push(child);
      } else if (child.position === 'right') {
        rightChildren.push(child);
      } else {
        if (index % 2 === 0) {
          rightChildren.push(child);
        } else {
          leftChildren.push(child);
        }
      }
    });

    // Layout Right Subtree
    layoutBranch(
      rightChildren,
      rootLayout,
      'right',
      rootLayout.x + rootLayout.width / 2 + HORIZONTAL_GAP,
      layoutMap,
      edges
    );

    // Layout Left Subtree
    layoutBranch(
      leftChildren,
      rootLayout,
      'left',
      rootLayout.x - rootLayout.width / 2 - HORIZONTAL_GAP,
      layoutMap,
      edges
    );
  }

  // Compute Arrow Links
  for (const lNode of layoutMap.values()) {
    if (lNode.node.arrowLinks && lNode.node.arrowLinks.length > 0) {
      for (const al of lNode.node.arrowLinks) {
        const dest = layoutMap.get(al.destination);
        if (dest) {
          const sx = lNode.x;
          const sy = lNode.y;
          const tx = dest.x;
          const ty = dest.y;

          const midX = (sx + tx) / 2;
          const midY = (sy + ty) / 2 - 30; // arch upwards
          const d = `M ${sx} ${sy} Q ${midX} ${midY} ${tx} ${ty}`;

          arrowLinks.push({
            id: `${lNode.id}->${dest.id}`,
            sourceId: lNode.id,
            targetId: dest.id,
            d,
            color: al.color || '#e11d48',
            targetX: tx,
            targetY: ty,
          });
        }
      }
    }

    // Compute Cloud bounds if node has cloud
    if (lNode.node.cloud) {
      const bounds = getSubtreeBounds(lNode);
      clouds.push({
        id: lNode.id,
        color: lNode.node.cloud.color || '#f1f5f9',
        x: bounds.minX - 16,
        y: bounds.minY - 12,
        width: bounds.maxX - bounds.minX + 32,
        height: bounds.maxY - bounds.minY + 24,
      });
    }
  }

  return { layoutNodes: layoutMap, edges, arrowLinks, clouds };
}

function getSubtreeBounds(layoutNode: LayoutNode): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = layoutNode.x - layoutNode.width / 2;
  let maxX = layoutNode.x + layoutNode.width / 2;
  let minY = layoutNode.y - layoutNode.height / 2;
  let maxY = layoutNode.y + layoutNode.height / 2;

  function traverse(n: LayoutNode) {
    const nx1 = n.x - n.width / 2;
    const nx2 = n.x + n.width / 2;
    const ny1 = n.y - n.height / 2;
    const ny2 = n.y + n.height / 2;

    minX = Math.min(minX, nx1);
    maxX = Math.max(maxX, nx2);
    minY = Math.min(minY, ny1);
    maxY = Math.max(maxY, ny2);

    for (const c of n.children) {
      traverse(c);
    }
  }

  for (const c of layoutNode.children) {
    traverse(c);
  }

  return { minX, maxX, minY, maxY };
}

interface SubtreeSize {
  totalHeight: number;
}

function calculateSubtreeHeight(node: FreeMindNode): SubtreeSize {
  const dim = estimateNodeDimensions(node);
  if (node.folded || node.children.length === 0) {
    return { totalHeight: dim.height };
  }

  let childrenHeight = 0;
  for (const child of node.children) {
    const childSize = calculateSubtreeHeight(child);
    childrenHeight += childSize.totalHeight + VERTICAL_GAP;
  }
  childrenHeight -= VERTICAL_GAP; // remove last gap

  return { totalHeight: Math.max(dim.height, childrenHeight) };
}

function layoutBranch(
  nodes: FreeMindNode[],
  parentLayout: LayoutNode,
  side: NodePosition,
  startX: number,
  layoutMap: Map<string, LayoutNode>,
  edges: EdgePath[]
): void {
  if (nodes.length === 0) return;

  // Calculate height for all sibling subtrees
  const heights = nodes.map(n => calculateSubtreeHeight(n).totalHeight);
  const totalBranchHeight = heights.reduce((sum, h) => sum + h, 0) + (nodes.length - 1) * VERTICAL_GAP;

  let currentY = parentLayout.y - totalBranchHeight / 2;

  nodes.forEach((node, i) => {
    const subtreeHeight = heights[i];
    const nodeY = currentY + subtreeHeight / 2;
    const dim = estimateNodeDimensions(node);

    const nodeX = side === 'right' 
      ? startX + dim.width / 2 
      : startX - dim.width / 2;

    const layoutNode: LayoutNode = {
      node,
      id: node.id,
      x: nodeX,
      y: nodeY,
      width: dim.width,
      height: dim.height,
      side,
      depth: parentLayout.depth + 1,
      parent: parentLayout,
      children: [],
    };

    parentLayout.children.push(layoutNode);
    layoutMap.set(node.id, layoutNode);

    // Compute edge from parent to this node
    edges.push(createEdgePath(parentLayout, layoutNode, side));

    // Layout descendants if not folded
    if (!node.folded && node.children.length > 0) {
      const nextStartX = side === 'right'
        ? layoutNode.x + layoutNode.width / 2 + HORIZONTAL_GAP
        : layoutNode.x - layoutNode.width / 2 - HORIZONTAL_GAP;

      layoutBranch(node.children, layoutNode, side, nextStartX, layoutMap, edges);
    }

    currentY += subtreeHeight + VERTICAL_GAP;
  });
}

function createEdgePath(parent: LayoutNode, child: LayoutNode, side: NodePosition): EdgePath {
  // Source anchor (vertical center of parent's outer edge)
  const startX = side === 'right' ? parent.x + parent.width / 2 : parent.x - parent.width / 2;
  const startY = parent.y;

  // Destination anchor (vertical center of child's inner edge)
  const endX = side === 'right' ? child.x - child.width / 2 : child.x + child.width / 2;
  const endY = child.y;

  // Smooth horizontal cubic bezier curve
  const dx = (endX - startX) * 0.52;
  const c1x = startX + dx;
  const c1y = startY;
  const c2x = endX - dx;
  const c2y = endY;

  const d = `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;

  const color = child.node.edge?.color || '#64748b';
  const width = child.node.edge?.width === 'thin' ? 1.5 : (Number(child.node.edge?.width) || 2);
  const style = child.node.edge?.style || 'bezier';

  return {
    id: `${parent.id}->${child.id}`,
    sourceId: parent.id,
    targetId: child.id,
    d,
    color,
    width,
    style,
  };
}


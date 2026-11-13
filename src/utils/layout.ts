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
  strokeColor: string;
  x: number;
  y: number;
  width: number;
  height: number;
  d: string;
  depth: number;
  nestingLevel: number;
}

export const CLOUD_PALETTE = [
  '#e0f2fe', // Sky blue
  '#fef3c7', // Warm amber
  '#dcfce7', // Mint green
  '#fce7f3', // Soft pink
  '#ede9fe', // Lavender purple
  '#ffedd5', // Peach orange
];

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
  }

  // Compute Clouds bottom-up so outer clouds properly enclose inner clouds
  computeNodeBoundsAndClouds(rootLayout, [], clouds);
  clouds.sort((a, b) => a.nestingLevel - b.nestingLevel || a.depth - b.depth);

  return { layoutNodes: layoutMap, edges, arrowLinks, clouds };
}

/**
 * Derive a darker, saturated border stroke color from a cloud fill hex color.
 */
function deriveCloudStrokeColor(hexColor: string): string {
  const match = hexColor.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return '#64748b';

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(ch => ch + ch)
      .join('');
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d) % 6;
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const strokeS = s < 0.1 ? s : Math.max(s, 0.55);
  const strokeL = Math.min(l * 0.52, 0.44);

  return `hsl(${Math.round(h)}, ${Math.round(strokeS * 100)}%, ${Math.round(strokeL * 100)}%)`;
}

/**
 * Generate a fluffy, scalloped SVG cloud path around a bounding box.
 */
export function generateCloudPath(
  x: number,
  y: number,
  width: number,
  height: number,
  nestingLevel: number = 0
): string {
  const r = Math.min(28, width / 3.5, height / 3.5);
  const wEdge = Math.max(0, width - 2 * r);
  const hEdge = Math.max(0, height - 2 * r);
  const arcLen = (Math.PI * r) / 2;
  const totalLen = 2 * wEdge + 2 * hEdge + 4 * arcLen;

  if (totalLen <= 0) return '';

  const samplePerimeter = (s: number): { px: number; py: number; nx: number; ny: number } => {
    let d = ((s % totalLen) + totalLen) % totalLen;

    // 1. Top edge (left -> right)
    if (d < wEdge) {
      return { px: x + r + d, py: y, nx: 0, ny: -1 };
    }
    d -= wEdge;

    // 2. Top-right corner
    if (d < arcLen && r > 0) {
      const theta = -Math.PI / 2 + d / r;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      return { px: x + width - r + r * cos, py: y + r + r * sin, nx: cos, ny: sin };
    }
    d -= arcLen;

    // 3. Right edge (top -> bottom)
    if (d < hEdge) {
      return { px: x + width, py: y + r + d, nx: 1, ny: 0 };
    }
    d -= hEdge;

    // 4. Bottom-right corner
    if (d < arcLen && r > 0) {
      const theta = d / r;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      return { px: x + width - r + r * cos, py: y + height - r + r * sin, nx: cos, ny: sin };
    }
    d -= arcLen;

    // 5. Bottom edge (right -> left)
    if (d < wEdge) {
      return { px: x + width - r - d, py: y + height, nx: 0, ny: 1 };
    }
    d -= wEdge;

    // 6. Bottom-left corner
    if (d < arcLen && r > 0) {
      const theta = Math.PI / 2 + d / r;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      return { px: x + r + r * cos, py: y + height - r + r * sin, nx: cos, ny: sin };
    }
    d -= arcLen;

    // 7. Left edge (bottom -> top)
    if (d < hEdge) {
      return { px: x, py: y + height - r - d, nx: -1, ny: 0 };
    }
    d -= hEdge;

    // 8. Top-left corner
    if (r > 0) {
      const theta = Math.PI + d / r;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      return { px: x + r + r * cos, py: y + r + r * sin, nx: cos, ny: sin };
    }

    return { px: x + r, py: y, nx: 0, ny: -1 };
  };

  const numPuffs = Math.max(8, Math.round(totalLen / 38));
  const rawWeights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < numPuffs; i++) {
    const w = 1 + 0.16 * Math.sin(i * 2.1 + nestingLevel * 1.7);
    rawWeights.push(w);
    weightSum += w;
  }

  const segLengths = rawWeights.map(w => (w / weightSum) * totalLen);
  const startPoint = samplePerimeter(0);
  const parts: string[] = [`M ${startPoint.px.toFixed(2)} ${startPoint.py.toFixed(2)}`];

  let s0 = 0;
  for (let i = 0; i < numPuffs; i++) {
    const L = segLengths[i];
    const s1 = s0 + L;
    const p0 = samplePerimeter(s0);
    const p1 = i === numPuffs - 1 ? startPoint : samplePerimeter(s1);
    const n0 = samplePerimeter(s0 + 0.22 * L);
    const n1 = samplePerimeter(s0 + 0.78 * L);
    const h = Math.min(Math.max(L * 0.34, 9), 16);

    const dx = p1.px - p0.px;
    const dy = p1.py - p0.py;
    const c1x = p0.px + 0.18 * dx + h * n0.nx;
    const c1y = p0.py + 0.18 * dy + h * n0.ny;
    const c2x = p0.px + 0.82 * dx + h * n1.nx;
    const c2y = p0.py + 0.82 * dy + h * n1.ny;

    parts.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p1.px.toFixed(2)} ${p1.py.toFixed(2)}`
    );
    s0 = s1;
  }

  parts.push('Z');
  return parts.join(' ');
}

function computeNodeBoundsAndClouds(
  lNode: LayoutNode,
  ancestorCloudColors: string[],
  clouds: RenderCloud[]
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = lNode.x - lNode.width / 2;
  let maxX = lNode.x + lNode.width / 2;
  let minY = lNode.y - lNode.height / 2;
  let maxY = lNode.y + lNode.height / 2;

  const hasCloud = Boolean(lNode.node.cloud);
  const nestingLevel = ancestorCloudColors.length;

  let effectiveColor = lNode.node.cloud?.color || CLOUD_PALETTE[0];
  if (hasCloud && nestingLevel > 0) {
    const normalizedAncestors = ancestorCloudColors.map(c => c.toLowerCase());
    if (normalizedAncestors.includes(effectiveColor.toLowerCase())) {
      const startIdx = nestingLevel % CLOUD_PALETTE.length;
      for (let offset = 0; offset < CLOUD_PALETTE.length; offset++) {
        const candidate = CLOUD_PALETTE[(startIdx + offset) % CLOUD_PALETTE.length];
        if (!normalizedAncestors.includes(candidate.toLowerCase())) {
          effectiveColor = candidate;
          break;
        }
      }
      if (normalizedAncestors.includes(effectiveColor.toLowerCase())) {
        effectiveColor = CLOUD_PALETTE[startIdx];
      }
    }
  }

  const nextAncestorColors = hasCloud
    ? [...ancestorCloudColors, effectiveColor]
    : ancestorCloudColors;

  for (const child of lNode.children) {
    const childBounds = computeNodeBoundsAndClouds(child, nextAncestorColors, clouds);
    minX = Math.min(minX, childBounds.minX);
    maxX = Math.max(maxX, childBounds.maxX);
    minY = Math.min(minY, childBounds.minY);
    maxY = Math.max(maxY, childBounds.maxY);
  }

  if (hasCloud) {
    const padX = 22;
    const padY = 18;
    const cx = minX - padX;
    const cy = minY - padY;
    const cw = maxX - minX + padX * 2;
    const ch = maxY - minY + padY * 2;

    clouds.push({
      id: lNode.id,
      color: effectiveColor,
      strokeColor: deriveCloudStrokeColor(effectiveColor),
      x: cx,
      y: cy,
      width: cw,
      height: ch,
      d: generateCloudPath(cx, cy, cw, ch, nestingLevel),
      depth: lNode.depth,
      nestingLevel,
    });

    // Expand outer bounds so enclosing ancestor clouds wrap outside inner clouds
    minX = cx - 8;
    maxX = cx + cw + 8;
    minY = cy - 8;
    maxY = cy + ch + 8;
  }

  return { minX, maxX, minY, maxY };
}

interface SubtreeSize {
  totalHeight: number;
}

function calculateSubtreeHeight(node: FreeMindNode): SubtreeSize {
  const dim = estimateNodeDimensions(node);
  const cloudPadding = node.cloud ? 36 : 0;

  if (node.folded || node.children.length === 0) {
    return { totalHeight: dim.height + cloudPadding };
  }

  let childrenHeight = 0;
  for (const child of node.children) {
    const childSize = calculateSubtreeHeight(child);
    childrenHeight += childSize.totalHeight + VERTICAL_GAP;
  }
  childrenHeight -= VERTICAL_GAP; // remove last gap

  return { totalHeight: Math.max(dim.height, childrenHeight) + cloudPadding };
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


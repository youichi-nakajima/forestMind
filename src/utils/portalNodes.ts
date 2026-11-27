import type { FreeMindMap, FreeMindNode, NodePosition } from '../types/freemind';
import { parseForestMindLink } from './nodeLinks';
import { getNodePlainText, setSubtreePosition } from './treeUtils';

export type PortalTargetKind = 'file' | 'forest';

export interface PortalOpenTarget {
  kind: PortalTargetKind;
  filePath?: string;
  tabId?: string;
  nodeId?: string;
}

export interface GhostNodeMeta {
  portalSourceNodeId: string;
  originalNodeId: string;
  targetTitle: string;
  targetKind: PortalTargetKind;
  targetFilePath?: string;
  targetTabId?: string;
  isPortalEntry: boolean;
  status: 'loaded' | 'loading' | 'error';
}

export interface ResolvedPortalPreview {
  sourceNodeId: string;
  targetKind: PortalTargetKind;
  targetFilePath?: string;
  targetTabId?: string;
  targetNodeId?: string;
  targetTitle: string;
  status: 'loaded' | 'loading' | 'error';
  errorMessage?: string;
  map?: FreeMindMap;
}

const MM_EXT_RE = /\.mm$/i;
const DEFAULT_MAX_GHOST_NODES = 80;

/**
 * Returns true if the node LINK attribute targets another `.mm` map or `forest://` tab
 * suitable for tree-to-tree portal preview.
 */
export function isPortalCapableLink(rawLink?: string): boolean {
  if (!rawLink || !rawLink.trim()) return false;
  const parsed = parseForestMindLink(rawLink);
  if (parsed.kind === 'forest') {
    return Boolean(parsed.tabId);
  }
  if (parsed.kind === 'file') {
    return MM_EXT_RE.test(parsed.filePath);
  }
  return false;
}

interface SplitDrivePath {
  drive: string;
  isAbsolute: boolean;
  segments: string[];
}

function splitDriveAndSegments(rawPath: string): SplitDrivePath {
  const normalized = rawPath.trim().replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([a-zA-Z]:)(\/.*)?$/);
  if (driveMatch) {
    const drive = driveMatch[1];
    const rest = driveMatch[2] || '';
    return {
      drive,
      isAbsolute: rest.startsWith('/'),
      segments: rest.split('/').filter(Boolean),
    };
  }
  if (normalized.startsWith('/')) {
    return {
      drive: '',
      isAbsolute: true,
      segments: normalized.split('/').filter(Boolean),
    };
  }
  return {
    drive: '',
    isAbsolute: false,
    segments: normalized.split('/').filter(Boolean),
  };
}

function normalizeDotSegments(segments: string[], allowLeadingParent: boolean): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') {
        out.pop();
      } else if (allowLeadingParent) {
        out.push('..');
      }
      continue;
    }
    out.push(seg);
  }
  return out;
}

/**
 * Resolves a relative or absolute `.mm` target path against an optional `baseFilePath`.
 */
export function resolveRelativeMmPath(
  baseFilePath: string | undefined,
  targetPath: string
): string {
  const trimmedTarget = targetPath.trim();
  const targetInfo = splitDriveAndSegments(trimmedTarget);

  if (targetInfo.isAbsolute || targetInfo.drive) {
    const cleanSegs = normalizeDotSegments(targetInfo.segments, false);
    if (targetInfo.drive) {
      return `${targetInfo.drive}/${cleanSegs.join('/')}`;
    }
    return `/${cleanSegs.join('/')}`;
  }

  if (!baseFilePath || !baseFilePath.trim()) {
    const cleanSegs = normalizeDotSegments(targetInfo.segments, true);
    return cleanSegs.join('/');
  }

  const baseInfo = splitDriveAndSegments(baseFilePath);
  // Drop filename from baseFilePath to get base directory
  const baseDirSegments = baseInfo.segments.slice(0, -1);
  const combined = normalizeDotSegments(
    [...baseDirSegments, ...targetInfo.segments],
    !baseInfo.isAbsolute
  );

  if (baseInfo.drive) {
    return `${baseInfo.drive}/${combined.join('/')}`;
  }
  if (baseInfo.isAbsolute) {
    return `/${combined.join('/')}`;
  }
  return combined.join('/');
}

/**
 * Normalizes a file path for cross-tab comparison (forward slashes, case-insensitive on Windows drives).
 */
export function normalizePathForCompare(filePath?: string): string {
  if (!filePath) return '';
  const normalized = filePath.trim().replace(/\\/g, '/');
  if (/^[a-zA-Z]:/.test(normalized)) {
    return normalized.toLowerCase();
  }
  return normalized;
}

function findNodeInSubtree(node: FreeMindNode, targetId: string): FreeMindNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNodeInSubtree(child, targetId);
    if (found) return found;
  }
  return null;
}

function countSubtree(node: FreeMindNode, visited = new Set<FreeMindNode>()): number {
  if (visited.has(node)) return 0;
  visited.add(node);
  let total = 1;
  for (const child of node.children) {
    total += countSubtree(child, visited);
  }
  return total;
}

function makePlaceholderGhostNode(
  preview: ResolvedPortalPreview,
  text: string,
  status: 'loading' | 'error'
): { entryNode: FreeMindNode; ghostMetaMap: Map<string, GhostNodeMeta> } {
  const ghostId = `ghost::${preview.sourceNodeId}::${status}`;
  const entryNode: FreeMindNode = {
    id: ghostId,
    text,
    style: 'bubble',
    folded: false,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children: [],
  };
  const ghostMetaMap = new Map<string, GhostNodeMeta>();
  ghostMetaMap.set(ghostId, {
    portalSourceNodeId: preview.sourceNodeId,
    originalNodeId: preview.targetNodeId || '',
    targetTitle: preview.targetTitle,
    targetKind: preview.targetKind,
    targetFilePath: preview.targetFilePath,
    targetTabId: preview.targetTabId,
    isPortalEntry: true,
    status,
  });
  return { entryNode, ghostMetaMap };
}

/**
 * Clones a target map subtree into read-only ghost nodes with cycle and node-count guards.
 */
export function buildGhostSubtreeFromPreview(
  preview: ResolvedPortalPreview,
  options: { maxNodes?: number } = {}
): { entryNode: FreeMindNode; ghostMetaMap: Map<string, GhostNodeMeta> } {
  if (preview.status === 'loading') {
    return makePlaceholderGhostNode(preview, 'ポータルを読み込み中…', 'loading');
  }
  if (preview.status === 'error' || !preview.map) {
    return makePlaceholderGhostNode(
      preview,
      preview.errorMessage || 'ポータル先を読み込めませんでした',
      'error'
    );
  }

  const startNode = preview.targetNodeId
    ? findNodeInSubtree(preview.map.root, preview.targetNodeId)
    : preview.map.root;

  if (!startNode) {
    return makePlaceholderGhostNode(
      preview,
      `ノード (${preview.targetNodeId}) が見つかりません`,
      'error'
    );
  }

  const maxNodes = options.maxNodes ?? DEFAULT_MAX_GHOST_NODES;
  const ghostMetaMap = new Map<string, GhostNodeMeta>();
  const visited = new Set<FreeMindNode>();
  let counter = 0;
  let truncatedCount = 0;

  const cloneNode = (src: FreeMindNode, isEntry: boolean): FreeMindNode | null => {
    if (visited.has(src)) return null;
    if (counter >= maxNodes) {
      truncatedCount += countSubtree(src);
      return null;
    }
    visited.add(src);
    const ghostId = `ghost::${preview.sourceNodeId}::${counter}::${src.id}`;
    counter += 1;

    ghostMetaMap.set(ghostId, {
      portalSourceNodeId: preview.sourceNodeId,
      originalNodeId: src.id,
      targetTitle: preview.targetTitle || getNodePlainText(preview.map!.root) || '別マップ',
      targetKind: preview.targetKind,
      targetFilePath: preview.targetFilePath,
      targetTabId: preview.targetTabId,
      isPortalEntry: isEntry,
      status: 'loaded',
    });

    const clonedChildren: FreeMindNode[] = [];
    if (isEntry || !src.folded) {
      for (const child of src.children) {
        if (counter >= maxNodes) {
          truncatedCount += countSubtree(child);
          continue;
        }
        const clonedChild = cloneNode(child, false);
        if (clonedChild) {
          clonedChildren.push(clonedChild);
        }
      }
    }

    return {
      id: ghostId,
      text: src.text,
      htmlContent: src.htmlContent,
      style: isEntry ? 'bubble' : src.style,
      color: src.color,
      backgroundColor: src.backgroundColor,
      font: src.font ? { ...src.font } : undefined,
      edge: src.edge ? { ...src.edge } : undefined,
      folded: isEntry ? false : src.folded,
      icons: src.icons.map(i => ({ ...i })),
      attributes: src.attributes.map(a => ({ ...a })),
      noteHtml: src.noteHtml,
      arrowLinks: [],
      hooks: [],
      children: clonedChildren,
    };
  };

  const entryNode = cloneNode(startNode, true);
  if (!entryNode) {
    return makePlaceholderGhostNode(preview, 'ポータルを生成できませんでした', 'error');
  }

  if (truncatedCount > 0) {
    const moreId = `ghost::${preview.sourceNodeId}::more`;
    entryNode.children.push({
      id: moreId,
      text: `… 他 ${truncatedCount} ノード (クリックで元マップを開く)`,
      style: 'fork',
      folded: false,
      icons: [],
      attributes: [],
      arrowLinks: [],
      hooks: [],
      children: [],
    });
    ghostMetaMap.set(moreId, {
      portalSourceNodeId: preview.sourceNodeId,
      originalNodeId: startNode.id,
      targetTitle: preview.targetTitle,
      targetKind: preview.targetKind,
      targetFilePath: preview.targetFilePath,
      targetTabId: preview.targetTabId,
      isPortalEntry: false,
      status: 'loaded',
    });
  }

  return { entryNode, ghostMetaMap };
}

/**
 * Produces a non-mutating display tree with expanded portal ghost subtrees attached to their
 * source nodes, along with metadata keyed by synthetic ghost node ID.
 */
export function injectPortalSubtrees(
  root: FreeMindNode,
  resolvedPortals?: Map<string, ResolvedPortalPreview>
): {
  augmentedRoot: FreeMindNode;
  ghostMetaMap: Map<string, GhostNodeMeta>;
  portalEntryIds: Set<string>;
} {
  const ghostMetaMap = new Map<string, GhostNodeMeta>();
  const portalEntryIds = new Set<string>();
  if (!resolvedPortals || resolvedPortals.size === 0) {
    return { augmentedRoot: root, ghostMetaMap, portalEntryIds };
  }

  const visit = (node: FreeMindNode, inheritedSide?: NodePosition): FreeMindNode => {
    const portal = resolvedPortals.get(node.id);
    const clonedChildren = node.children.map((child, idx) => {
      const side: NodePosition | undefined =
        node.id === root.id
          ? child.position || (idx % 2 === 0 ? 'right' : 'left')
          : child.position || inheritedSide;
      return visit(child, side);
    });

    if (!portal) {
      // Only allocate new node object if children changed or portal exists below
      const childrenChanged = clonedChildren.some((c, i) => c !== node.children[i]);
      if (!childrenChanged) return node;
      return { ...node, children: clonedChildren };
    }

    const { entryNode, ghostMetaMap: portalMeta } = buildGhostSubtreeFromPreview(portal);
    portalEntryIds.add(entryNode.id);
    for (const [k, v] of portalMeta.entries()) {
      ghostMetaMap.set(k, v);
    }

    let portalSide: NodePosition | undefined = node.position || inheritedSide;
    if (node.id === root.id) {
      const rightCount = clonedChildren.filter(c => c.position !== 'left').length;
      const leftCount = clonedChildren.filter(c => c.position === 'left').length;
      portalSide = rightCount <= leftCount ? 'right' : 'left';
    }
    if (portalSide) {
      setSubtreePosition(entryNode, portalSide);
    }

    return {
      ...node,
      folded: false,
      children: [...clonedChildren, entryNode],
    };
  };

  const augmentedRoot = visit(root);
  return { augmentedRoot, ghostMetaMap, portalEntryIds };
}

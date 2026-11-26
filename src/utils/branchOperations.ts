import { generateNodeId } from '../parser/freemindParser';
import type { FreeMindMap, FreeMindNode } from '../types/freemind';
import { cleanupDanglingArrowLinks, setSubtreePosition } from './treeUtils';

function cloneNode(node: FreeMindNode): FreeMindNode {
  if (typeof structuredClone === 'function') {
    return structuredClone(node);
  }
  return JSON.parse(JSON.stringify(node)) as FreeMindNode;
}

function findNodeInSubtree(node: FreeMindNode, targetId: string): FreeMindNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNodeInSubtree(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * Counts a node and all of its descendants recursively.
 */
export function countSubtreeNodes(node: FreeMindNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countSubtreeNodes(child);
  }
  return count;
}

interface ParsedPathInfo {
  isAbsolute: boolean;
  drive: string; // e.g. 'c:' or ''
  segments: string[];
}

function parsePathInfo(rawPath: string): ParsedPathInfo {
  const normalized = rawPath.trim().replace(/\\/g, '/');
  const driveMatch = normalized.match(/^([a-zA-Z]:)(\/.*)?$/);
  if (driveMatch) {
    const drive = driveMatch[1];
    const rest = driveMatch[2] || '';
    const segments = rest.split('/').filter(Boolean);
    return { isAbsolute: rest.startsWith('/'), drive, segments };
  }
  if (normalized.startsWith('/')) {
    return {
      isAbsolute: true,
      drive: '',
      segments: normalized.split('/').filter(Boolean),
    };
  }
  return {
    isAbsolute: false,
    drive: '',
    segments: normalized.split('/').filter(Boolean),
  };
}

/**
 * Computes a FreeMind-friendly relative `.mm` path from `sourceFilePath`'s directory to `targetFilePath`.
 * Falls back to normalized `targetFilePath` when relative calculation is not applicable (e.g. different drives).
 */
export function computeRelativeMmLink(
  sourceFilePath: string | undefined,
  targetFilePath: string
): string {
  const normalizedTarget = targetFilePath.trim().replace(/\\/g, '/');
  if (!sourceFilePath || !sourceFilePath.trim()) {
    return normalizedTarget;
  }

  const srcInfo = parsePathInfo(sourceFilePath);
  const dstInfo = parsePathInfo(targetFilePath);

  if (srcInfo.isAbsolute !== dstInfo.isAbsolute) {
    return normalizedTarget;
  }

  const hasWindowsDrive = Boolean(srcInfo.drive || dstInfo.drive);
  if (srcInfo.drive.toLowerCase() !== dstInfo.drive.toLowerCase()) {
    return normalizedTarget;
  }

  // Drop filename from source to get its directory segments
  const sourceDirParts = srcInfo.segments.slice(0, -1);
  const targetParts = dstInfo.segments;

  let commonLen = 0;
  const maxCommon = Math.min(sourceDirParts.length, targetParts.length - 1);
  while (commonLen < maxCommon) {
    const a = hasWindowsDrive
      ? sourceDirParts[commonLen].toLowerCase()
      : sourceDirParts[commonLen];
    const b = hasWindowsDrive
      ? targetParts[commonLen].toLowerCase()
      : targetParts[commonLen];
    if (a !== b) break;
    commonLen++;
  }

  const upSegments = Array<string>(sourceDirParts.length - commonLen).fill('..');
  const downSegments = targetParts.slice(commonLen);
  const rel = [...upSegments, ...downSegments].join('/');

  if (!rel) return normalizedTarget;
  return rel.startsWith('.') ? rel : `./${rel}`;
}

/**
 * Deep-clones a subtree and assigns fresh unique IDs to every node, remapping internal
 * `arrowLinks` destinations and `#NODE_ID` links accordingly.
 */
export function remapSubtreeIds(
  root: FreeMindNode
): { node: FreeMindNode; idMap: Map<string, string> } {
  const cloned = cloneNode(root);
  const idMap = new Map<string, string>();

  function assignIds(node: FreeMindNode) {
    const oldId = node.id;
    const newId = generateNodeId();
    idMap.set(oldId, newId);
    node.id = newId;
    for (const child of node.children) {
      assignIds(child);
    }
  }

  function rewriteInternalLinks(node: FreeMindNode) {
    if (node.arrowLinks.length > 0) {
      node.arrowLinks = node.arrowLinks.map(al => {
        const remappedDest = idMap.get(al.destination);
        return remappedDest ? { ...al, destination: remappedDest } : al;
      });
    }
    if (node.link && node.link.trim().startsWith('#')) {
      const targetId = node.link.trim().slice(1);
      const remappedTarget = idMap.get(targetId);
      if (remappedTarget) {
        node.link = `#${remappedTarget}`;
      }
    }
    for (const child of node.children) {
      rewriteInternalLinks(child);
    }
  }

  assignIds(cloned);
  rewriteInternalLinks(cloned);
  return { node: cloned, idMap };
}

/**
 * Builds a standalone FreeMindMap from a branch node (preserving node IDs for incoming links,
 * balancing direct children left/right, and removing dangling external arrowLinks).
 */
export function buildSplitMapFromBranch(
  branchNode: FreeMindNode,
  version: string = '1.0.1'
): FreeMindMap {
  const newRoot = cloneNode(branchNode);
  newRoot.position = undefined;
  newRoot.folded = false;
  newRoot.style = newRoot.style || 'bubble';
  newRoot.font = {
    ...newRoot.font,
    size: newRoot.font?.size || 16,
    bold: true,
  };
  newRoot.modified = Date.now();

  newRoot.children.forEach((child, idx) => {
    const side = idx % 2 === 0 ? 'right' : 'left';
    setSubtreePosition(child, side);
  });

  cleanupDanglingArrowLinks(newRoot);

  return {
    version,
    root: newRoot,
  };
}

/**
 * Updates the source map tree after splitting `branchNodeId` into another map:
 * sets `LINK` to `linkValue` and optionally collapses the branch to a single link node.
 */
export function applySplitToSourceTree(
  root: FreeMindNode,
  branchNodeId: string,
  linkValue: string,
  options: { collapseToLinkNode: boolean }
): boolean {
  if (branchNodeId === root.id) return false;
  const target = findNodeInSubtree(root, branchNodeId);
  if (!target) return false;

  target.link = linkValue;
  target.modified = Date.now();

  if (options.collapseToLinkNode) {
    target.children = [];
    target.folded = false;
    cleanupDanglingArrowLinks(root);
  }

  return true;
}

/**
 * Prepares cloned & ID-remapped nodes from `sourceMap` for merging under a target parent node.
 */
export function prepareMergedSubtree(
  sourceMap: FreeMindMap,
  options: { includeSourceRoot: boolean }
): FreeMindNode[] {
  const { node: remappedRoot } = remapSubtreeIds(sourceMap.root);
  if (options.includeSourceRoot) {
    remappedRoot.folded = false;
    return [remappedRoot];
  }
  return remappedRoot.children;
}

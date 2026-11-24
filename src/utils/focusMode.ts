import type { FreeMindNode } from '../types/freemind';

export interface FocusBreadcrumb {
  id: string;
  text: string;
}

export interface FocusSubtreeState {
  activeRoot: FreeMindNode;
  isFocused: boolean;
  breadcrumbs: FocusBreadcrumb[];
}

/**
 * Finds the node path from `root` to `targetId` (inclusive), or null if not found.
 */
export function findNodePath(
  root: FreeMindNode,
  targetId: string
): FreeMindNode[] | null {
  if (root.id === targetId) {
    return [root];
  }
  for (const child of root.children) {
    const subPath = findNodePath(child, targetId);
    if (subPath) {
      return [root, ...subPath];
    }
  }
  return null;
}

/**
 * Returns true if `targetId` exists within `subtreeRoot` (inclusive).
 */
export function isNodeInsideSubtree(
  subtreeRoot: FreeMindNode,
  targetId: string
): boolean {
  if (subtreeRoot.id === targetId) {
    return true;
  }
  return subtreeRoot.children.some(child => isNodeInsideSubtree(child, targetId));
}

/**
 * Resolves the active focused subtree and breadcrumb trail, safely falling back to `root`.
 */
export function resolveFocusedSubtree(
  root: FreeMindNode,
  focusedNodeId: string | null
): FocusSubtreeState {
  if (!focusedNodeId || focusedNodeId === root.id) {
    return {
      activeRoot: root,
      isFocused: false,
      breadcrumbs: [],
    };
  }

  const path = findNodePath(root, focusedNodeId);
  if (!path) {
    return {
      activeRoot: root,
      isFocused: false,
      breadcrumbs: [],
    };
  }

  return {
    activeRoot: path[path.length - 1],
    isFocused: true,
    breadcrumbs: path.map(n => ({
      id: n.id,
      text: n.text || '(無題ノード)',
    })),
  };
}

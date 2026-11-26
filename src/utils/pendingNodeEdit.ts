import type { FreeMindMap, FreeMindNode } from '../types/freemind';
import type { MapTab } from '../hooks/useMindMap';
import { cloneMindMap } from './treeUtils';

export interface PendingNewNodeEdit {
  tabId: string;
  nodeId: string;
  previousSelectedNodeId: string | null;
  previousFuture: FreeMindMap[];
  previousSavedPastLength: number | undefined;
}

function findNodeInSubtree(node: FreeMindNode, targetId: string): FreeMindNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNodeInSubtree(child, targetId);
    if (found) return found;
  }
  return null;
}

export function cancelPendingNewNodeOnTab(tab: MapTab, pending: PendingNewNodeEdit): MapTab {
  if (tab.past.length === 0) {
    return tab;
  }
  const previousMap = tab.past[tab.past.length - 1];
  const nextPast = tab.past.slice(0, -1);

  return {
    ...tab,
    map: previousMap,
    title: previousMap.root.text || tab.title,
    past: nextPast,
    future: pending.previousFuture,
    savedPastLength: pending.previousSavedPastLength,
    isDirty:
      pending.previousSavedPastLength === undefined ||
      nextPast.length !== pending.previousSavedPastLength,
    selectedNodeId: pending.previousSelectedNodeId,
  };
}

export function commitPendingNewNodeTextOnTab(
  tab: MapTab,
  nodeId: string,
  text: string
): MapTab {
  const clonedMap = cloneMindMap(tab.map);
  const target = findNodeInSubtree(clonedMap.root, nodeId);
  if (!target) {
    return tab;
  }
  target.text = text;
  target.modified = Date.now();

  return {
    ...tab,
    map: clonedMap,
    title: clonedMap.root.text || tab.title,
  };
}


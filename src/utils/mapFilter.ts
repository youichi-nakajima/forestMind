import type { FreeMindNode } from '../types/freemind';
import { findMatchingColorPreset } from './quickStyle';

export interface MapFilterAttributeCriterion {
  name: string;
  value: string;
}

export interface MapFilterCriteria {
  colorPresetIds: string[];
  iconBuiltins: string[];
  attributes: MapFilterAttributeCriterion[];
}

export const EMPTY_MAP_FILTER: MapFilterCriteria = {
  colorPresetIds: [],
  iconBuiltins: [],
  attributes: [],
};

export interface MapFilterResult {
  isActive: boolean;
  matchedNodeIds: string[];
  matchedNodeIdSet: Set<string>;
  highlightPathIdSet: Set<string>;
  hiddenMatchCounts: Map<string, number>;
}

export function isMapFilterActive(criteria: MapFilterCriteria): boolean {
  return (
    criteria.colorPresetIds.length > 0 ||
    criteria.iconBuiltins.length > 0 ||
    criteria.attributes.length > 0
  );
}

export function countActiveFilterConditions(criteria: MapFilterCriteria): number {
  return (
    criteria.colorPresetIds.length +
    criteria.iconBuiltins.length +
    criteria.attributes.length
  );
}

export function toggleFilterColor(
  criteria: MapFilterCriteria,
  presetId: string
): MapFilterCriteria {
  const exists = criteria.colorPresetIds.includes(presetId);
  return {
    ...criteria,
    colorPresetIds: exists
      ? criteria.colorPresetIds.filter(id => id !== presetId)
      : [...criteria.colorPresetIds, presetId],
  };
}

export function toggleFilterIcon(
  criteria: MapFilterCriteria,
  builtin: string
): MapFilterCriteria {
  const exists = criteria.iconBuiltins.includes(builtin);
  return {
    ...criteria,
    iconBuiltins: exists
      ? criteria.iconBuiltins.filter(id => id !== builtin)
      : [...criteria.iconBuiltins, builtin],
  };
}

export function toggleFilterAttribute(
  criteria: MapFilterCriteria,
  name: string,
  value: string
): MapFilterCriteria {
  const exists = criteria.attributes.some(a => a.name === name && a.value === value);
  return {
    ...criteria,
    attributes: exists
      ? criteria.attributes.filter(a => !(a.name === name && a.value === value))
      : [...criteria.attributes, { name, value }],
  };
}

/**
 * Evaluates whether a node matches the active filter criteria (AND across categories, OR within each category).
 */
export function nodeMatchesFilter(
  node: FreeMindNode,
  criteria: MapFilterCriteria
): boolean {
  if (!isMapFilterActive(criteria)) {
    return false;
  }

  if (criteria.colorPresetIds.length > 0) {
    const preset = findMatchingColorPreset(node);
    if (!preset || !criteria.colorPresetIds.includes(preset.id)) {
      return false;
    }
  }

  if (criteria.iconBuiltins.length > 0) {
    const hasMatchingIcon = node.icons.some(ic =>
      criteria.iconBuiltins.includes(ic.builtin)
    );
    if (!hasMatchingIcon) {
      return false;
    }
  }

  if (criteria.attributes.length > 0) {
    const byName = new Map<string, string[]>();
    for (const attr of criteria.attributes) {
      const list = byName.get(attr.name) ?? [];
      list.push(attr.value);
      byName.set(attr.name, list);
    }

    for (const [attrName, allowedValues] of byName.entries()) {
      const hasMatch = node.attributes.some(
        a => a.name === attrName && allowedValues.includes(a.value)
      );
      if (!hasMatch) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Evaluates filter matches across a subtree, recording highlight paths and hidden matches inside folded nodes.
 */
export function evaluateMapFilter(
  root: FreeMindNode,
  criteria: MapFilterCriteria
): MapFilterResult {
  const active = isMapFilterActive(criteria);
  const matchedNodeIds: string[] = [];
  const matchedNodeIdSet = new Set<string>();
  const highlightPathIdSet = new Set<string>();
  const hiddenMatchCounts = new Map<string, number>();

  if (!active) {
    return {
      isActive: false,
      matchedNodeIds,
      matchedNodeIdSet,
      highlightPathIdSet,
      hiddenMatchCounts,
    };
  }

  function visit(
    node: FreeMindNode,
    ancestors: string[],
    nearestFoldedAncestorId: string | null
  ) {
    if (nodeMatchesFilter(node, criteria)) {
      matchedNodeIds.push(node.id);
      matchedNodeIdSet.add(node.id);
      highlightPathIdSet.add(node.id);
      for (const ancestorId of ancestors) {
        highlightPathIdSet.add(ancestorId);
      }
      if (nearestFoldedAncestorId) {
        hiddenMatchCounts.set(
          nearestFoldedAncestorId,
          (hiddenMatchCounts.get(nearestFoldedAncestorId) ?? 0) + 1
        );
      }
    }

    const nextFolded = nearestFoldedAncestorId ?? (node.folded ? node.id : null);
    const nextAncestors = [...ancestors, node.id];
    for (const child of node.children) {
      visit(child, nextAncestors, nextFolded);
    }
  }

  visit(root, [], null);

  return {
    isActive: true,
    matchedNodeIds,
    matchedNodeIdSet,
    highlightPathIdSet,
    hiddenMatchCounts,
  };
}

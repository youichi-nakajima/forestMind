import type { MapTab } from '../hooks/useMindMap';
import type { FreeMindMap, FreeMindNode } from '../types/freemind';
import type { ActiveForestFolderData, RecentFileEntry } from '../types/workspace';
import { parseForestMindLink } from './nodeLinks';
import { normalizePathForCompare, resolveRelativeMmPath } from './portalNodes';
import { getNodePlainText } from './treeUtils';

export type TreeSpecies = 'sprout' | 'sapling' | 'shrub' | 'pine' | 'mature' | 'ancient';

export interface TreeSpeciesMeta {
  species: TreeSpecies;
  label: string;
  description: string;
}

export const TREE_SPECIES_META: Record<TreeSpecies, TreeSpeciesMeta> = {
  sprout: {
    species: 'sprout',
    label: '若芽',
    description: 'ごく少数のノード・浅い階層（生まれたてのメモ）',
  },
  sapling: {
    species: 'sapling',
    label: '若木',
    description: '少〜中規模・育成中のマップ',
  },
  shrub: {
    species: 'shrub',
    label: '低木 / 茂み',
    description: 'ノード多め × 浅い階層（ブレスト・一覧系）',
  },
  pine: {
    species: 'pine',
    label: 'のっぽの針葉樹',
    description: 'ノード控えめ × 深い階層（深掘り系）',
  },
  mature: {
    species: 'mature',
    label: '大樹',
    description: '十分に育った標準プロジェクトマップ',
  },
  ancient: {
    species: 'ancient',
    label: '巨樹',
    description: '大規模・リンクが集まるハブマップ',
  },
};

export type SeasonTheme = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonThemeInfo {
  season: SeasonTheme;
  label: string;
  canopyFill: string;
  canopyStroke: string;
  accent: string;
}

export const DEFAULT_CANOPY_PALETTE = {
  canopyFill: '#22c55e',
  canopyStroke: '#15803d',
  accent: '#10b981',
} as const;

export const SEASON_THEMES: Record<SeasonTheme, SeasonThemeInfo> = {
  spring: {
    season: 'spring',
    label: '新緑 (3日以内)',
    canopyFill: '#34d399',
    canopyStroke: '#047857',
    accent: '#10b981',
  },
  summer: {
    season: 'summer',
    label: '深緑 (2週間以内)',
    canopyFill: '#16a34a',
    canopyStroke: '#166534',
    accent: '#22c55e',
  },
  autumn: {
    season: 'autumn',
    label: '紅葉 (45日以内)',
    canopyFill: '#f59e0b',
    canopyStroke: '#b45309',
    accent: '#ea580c',
  },
  winter: {
    season: 'winter',
    label: '冬木立 (静穏期)',
    canopyFill: '#64748b',
    canopyStroke: '#334155',
    accent: '#94a3b8',
  },
};

export interface ForestGraphNode {
  id: string;
  tabId?: string;
  filePath?: string;
  map: FreeMindMap;
  title: string;
  isOpenTab: boolean;
  isActiveTab: boolean;
  totalNodes: number;
  maxDepth: number;
  mainBranches: string[];
  species: TreeSpecies;
  lastModifiedMs?: number;
  seasonInfo: SeasonThemeInfo;
  outgoingIds: string[];
  incomingIds: string[];
  x: number;
  y: number;
  radius: number;
}

export interface ForestGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  linkCount: number;
  isBidirectional: boolean;
}

export interface ForestGraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ForestGraphData {
  nodes: ForestGraphNode[];
  edges: ForestGraphEdge[];
  bounds: ForestGraphBounds;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Classifies a mind map into one of 6 botanical tree species based on node count, depth, and link hub degree.
 */
export function classifyTreeSpecies(
  totalNodes: number,
  maxDepth: number,
  linkDegree: number = 0
): TreeSpecies {
  if (totalNodes <= 3) return 'sprout';
  if (totalNodes > 80 || (linkDegree >= 3 && totalNodes >= 20)) return 'ancient';
  if (maxDepth >= 4 && totalNodes <= 35) return 'pine';
  if (totalNodes >= 11 && totalNodes <= 45 && maxDepth <= 2) return 'shrub';
  if (totalNodes <= 10) return 'sapling';
  return 'mature';
}

/**
 * Classifies map activity recency into one of 4 seasonal color palettes.
 */
export function classifyMapSeason(
  lastModifiedMs: number | undefined,
  nowMs: number = 0
): SeasonThemeInfo {
  if (!lastModifiedMs || lastModifiedMs <= 0 || nowMs <= 0) {
    return SEASON_THEMES.winter;
  }
  const ageDays = Math.max(0, (nowMs - lastModifiedMs) / DAY_MS);
  if (ageDays <= 3) return SEASON_THEMES.spring;
  if (ageDays <= 14) return SEASON_THEMES.summer;
  if (ageDays <= 45) return SEASON_THEMES.autumn;
  return SEASON_THEMES.winter;
}

/**
 * Finds the most recent `modified` or `created` timestamp across all nodes in a map.
 */
export function getMapLastModified(map: FreeMindMap): number | undefined {
  let latest = 0;
  function walk(node: FreeMindNode) {
    if (typeof node.modified === 'number' && Number.isFinite(node.modified)) {
      if (node.modified > latest) latest = node.modified;
    }
    if (typeof node.created === 'number' && Number.isFinite(node.created)) {
      if (node.created > latest) latest = node.created;
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(map.root);
  return latest > 0 ? latest : undefined;
}

function summarizeTree(root: FreeMindNode): {
  totalNodes: number;
  maxDepth: number;
  mainBranches: string[];
} {
  let totalNodes = 0;
  let maxDepth = 0;

  function walk(node: FreeMindNode, depth: number) {
    totalNodes += 1;
    if (depth > maxDepth) maxDepth = depth;
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  walk(root, 0);
  const mainBranches = root.children
    .slice(0, 5)
    .map(c => getNodePlainText(c) || '(無題)');

  return { totalNodes, maxDepth, mainBranches };
}

function collectMapLinks(root: FreeMindNode): string[] {
  const links: string[] = [];
  function walk(node: FreeMindNode) {
    if (node.link && node.link.trim()) {
      links.push(node.link.trim());
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(root);
  return links;
}

function computeSpeciesRadius(species: TreeSpecies): number {
  switch (species) {
    case 'sprout':
      return 38;
    case 'sapling':
      return 44;
    case 'shrub':
      return 48;
    case 'pine':
      return 48;
    case 'mature':
      return 56;
    case 'ancient':
      return 66;
  }
}

/**
 * Builds the Forest Knowledge Graph (deduplicated nodes, directional links/backlinks, and deterministic 2D layout).
 */
export function buildForestGraph(params: {
  tabs: MapTab[];
  activeTabId?: string;
  activeForestFolder?: ActiveForestFolderData | null;
  recentFiles?: RecentFileEntry[];
  nowMs?: number;
}): ForestGraphData {
  const { tabs, activeTabId, activeForestFolder, recentFiles = [], nowMs = 0 } = params;

  const recentOpenedByPath = new Map<string, number>();
  for (const r of recentFiles) {
    recentOpenedByPath.set(normalizePathForCompare(r.filePath), r.lastOpenedAt);
  }

  const nodes: ForestGraphNode[] = [];
  const tabIdToGraphId = new Map<string, string>();
  const pathToGraphId = new Map<string, string>();

  for (const tab of tabs) {
    const graphId = `tab:${tab.id}`;
    const { totalNodes, maxDepth, mainBranches } = summarizeTree(tab.map.root);
    const species = classifyTreeSpecies(totalNodes, maxDepth, 0);
    const pathKey = tab.filePath ? normalizePathForCompare(tab.filePath) : '';
    const lastModifiedMs =
      getMapLastModified(tab.map) || (pathKey ? recentOpenedByPath.get(pathKey) : undefined);

    const graphNode: ForestGraphNode = {
      id: graphId,
      tabId: tab.id,
      filePath: tab.filePath,
      map: tab.map,
      title: getNodePlainText(tab.map.root) || tab.title || '無題マップ',
      isOpenTab: true,
      isActiveTab: tab.id === activeTabId,
      totalNodes,
      maxDepth,
      mainBranches,
      species,
      lastModifiedMs,
      seasonInfo: classifyMapSeason(lastModifiedMs, nowMs),
      outgoingIds: [],
      incomingIds: [],
      x: 0,
      y: 0,
      radius: computeSpeciesRadius(species),
    };

    nodes.push(graphNode);
    tabIdToGraphId.set(tab.id, graphId);
    if (pathKey) {
      pathToGraphId.set(pathKey, graphId);
    }
  }

  if (activeForestFolder) {
    for (const fileItem of activeForestFolder.files) {
      const pathKey = normalizePathForCompare(fileItem.filePath);
      if (pathToGraphId.has(pathKey)) continue;

      const graphId = `file:${pathKey}`;
      const { totalNodes, maxDepth, mainBranches } = summarizeTree(fileItem.map.root);
      const species = classifyTreeSpecies(totalNodes, maxDepth, 0);
      const lastModifiedMs =
        getMapLastModified(fileItem.map) || recentOpenedByPath.get(pathKey);

      const graphNode: ForestGraphNode = {
        id: graphId,
        filePath: fileItem.filePath,
        map: fileItem.map,
        title:
          getNodePlainText(fileItem.map.root) ||
          fileItem.fileName.replace(/\.mm$/i, '') ||
          '無題マップ',
        isOpenTab: false,
        isActiveTab: false,
        totalNodes,
        maxDepth,
        mainBranches,
        species,
        lastModifiedMs,
        seasonInfo: classifyMapSeason(lastModifiedMs, nowMs),
        outgoingIds: [],
        incomingIds: [],
        x: 0,
        y: 0,
        radius: computeSpeciesRadius(species),
      };

      nodes.push(graphNode);
      pathToGraphId.set(pathKey, graphId);
    }
  }

  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const rawEdges = new Map<string, { sourceId: string; targetId: string; linkCount: number }>();

  for (const srcNode of nodes) {
    const rawLinks = collectMapLinks(srcNode.map.root);
    for (const rawLink of rawLinks) {
      const parsed = parseForestMindLink(rawLink);
      let targetGraphId: string | undefined;

      if (parsed.kind === 'forest' && parsed.tabId) {
        targetGraphId = tabIdToGraphId.get(parsed.tabId);
      } else if (parsed.kind === 'file' && /\.mm$/i.test(parsed.filePath)) {
        const resolved = resolveRelativeMmPath(srcNode.filePath, parsed.filePath);
        targetGraphId = pathToGraphId.get(normalizePathForCompare(resolved));
      }

      if (!targetGraphId || targetGraphId === srcNode.id) continue;

      const key = `${srcNode.id}=>${targetGraphId}`;
      const existing = rawEdges.get(key);
      if (existing) {
        existing.linkCount += 1;
      } else {
        rawEdges.set(key, { sourceId: srcNode.id, targetId: targetGraphId, linkCount: 1 });
      }
    }
  }

  const edges: ForestGraphEdge[] = [];
  for (const entry of rawEdges.values()) {
    const reverseKey = `${entry.targetId}=>${entry.sourceId}`;
    const isBidirectional = rawEdges.has(reverseKey);
    edges.push({
      id: `${entry.sourceId}=>${entry.targetId}`,
      sourceId: entry.sourceId,
      targetId: entry.targetId,
      linkCount: entry.linkCount,
      isBidirectional,
    });

    const src = nodeById.get(entry.sourceId);
    const dst = nodeById.get(entry.targetId);
    if (src && !src.outgoingIds.includes(entry.targetId)) {
      src.outgoingIds.push(entry.targetId);
    }
    if (dst && !dst.incomingIds.includes(entry.sourceId)) {
      dst.incomingIds.push(entry.sourceId);
    }
  }

  // Re-evaluate species & radius now that link degrees (hub links) are known
  for (const n of nodes) {
    const linkDegree = n.outgoingIds.length + n.incomingIds.length;
    n.species = classifyTreeSpecies(n.totalNodes, n.maxDepth, linkDegree);
    n.radius = computeSpeciesRadius(n.species);
  }

  // Deterministic hub-centered layout
  if (nodes.length === 1) {
    nodes[0].x = 0;
    nodes[0].y = 0;
  } else if (nodes.length > 1) {
    const ordered = [...nodes].sort((a, b) => {
      const degA = a.incomingIds.length + a.outgoingIds.length;
      const degB = b.incomingIds.length + b.outgoingIds.length;
      if (degB !== degA) return degB - degA;
      return b.totalNodes - a.totalNodes;
    });

    const goldenAngle = 2.399963229728653;
    ordered.forEach((n, idx) => {
      if (idx === 0) {
        n.x = 0;
        n.y = 0;
      } else {
        const angle = idx * goldenAngle;
        const r = 175 + Math.sqrt(idx) * 115;
        n.x = Math.cos(angle) * r;
        n.y = Math.sin(angle) * r * 0.85;
      }
    });

    // Deterministic force relaxation + pairwise non-overlap separation
    for (let iter = 0; iter < 70; iter++) {
      // Weak gravity toward center
      for (const n of ordered) {
        n.x *= 0.985;
        n.y *= 0.985;
      }

      // Edge attraction toward comfortable spacing
      for (const edge of edges) {
        const a = nodeById.get(edge.sourceId);
        const b = nodeById.get(edge.targetId);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ideal = a.radius + b.radius + 145;
        const delta = (dist - ideal) * 0.045;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x += ux * delta;
        a.y += uy * delta;
        b.x -= ux * delta;
        b.y -= uy * delta;
      }

      // Repulsion & minimum non-overlap separation
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          const a = ordered[i];
          const b = ordered[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          if (dist < 0.01) {
            dx = (j - i) * 1.5;
            dy = 1;
            dist = Math.hypot(dx, dy);
          }
          const minDist = a.radius + b.radius + 78;
          if (dist < minDist) {
            const push = (minDist - dist) * 0.52;
            const ux = dx / dist;
            const uy = dy / dist;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }
    }

    // Re-center centroid around (0, 0)
    const cx = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
    const cy = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;
    for (const n of nodes) {
      n.x = Math.round((n.x - cx) * 10) / 10;
      n.y = Math.round((n.y - cy) * 10) / 10;
    }
  }

  let bounds: ForestGraphBounds = { minX: -280, maxX: 280, minY: -220, maxY: 220 };
  if (nodes.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius - 70);
      maxX = Math.max(maxX, n.x + n.radius + 70);
      minY = Math.min(minY, n.y - n.radius - 50);
      maxY = Math.max(maxY, n.y + n.radius + 70);
    }
    bounds = {
      minX: Math.min(-240, minX - 60),
      maxX: Math.max(240, maxX + 60),
      minY: Math.min(-180, minY - 60),
      maxY: Math.max(180, maxY + 60),
    };
  }

  return { nodes, edges, bounds };
}

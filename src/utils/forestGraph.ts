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
    label: '今週 (7日以内)',
    canopyFill: '#84cc16',
    canopyStroke: '#4d7c0f',
    accent: '#65a30d',
  },
  summer: {
    season: 'summer',
    label: '今月 (30日以内)',
    canopyFill: '#15803d',
    canopyStroke: '#14532d',
    accent: '#16a34a',
  },
  autumn: {
    season: 'autumn',
    label: '今年 (1年以内)',
    canopyFill: '#f59e0b',
    canopyStroke: '#b45309',
    accent: '#ea580c',
  },
  winter: {
    season: 'winter',
    label: 'それ以上 (1年超)',
    canopyFill: '#991b1b',
    canopyStroke: '#641212',
    accent: '#b91c1c',
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
 * Classifies map activity recency into one of 4 rolling seasonal color palettes:
 * - spring: within 7 days (this week)
 * - summer: within 30 days (this month)
 * - autumn: within 365 days (this year)
 * - winter: older than 365 days or unknown
 */
export function classifyMapSeason(
  lastModifiedMs: number | undefined,
  nowMs: number = 0
): SeasonThemeInfo {
  if (!lastModifiedMs || lastModifiedMs <= 0 || nowMs <= 0) {
    return SEASON_THEMES.winter;
  }
  const ageDays = Math.max(0, (nowMs - lastModifiedMs) / DAY_MS);
  if (ageDays <= 7) return SEASON_THEMES.spring;
  if (ageDays <= 30) return SEASON_THEMES.summer;
  if (ageDays <= 365) return SEASON_THEMES.autumn;
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

export function getNodeVisualExtents(node: Pick<ForestGraphNode, 'radius'>): {
  halfW: number;
  topH: number;
  bottomH: number;
} {
  return {
    halfW: Math.max(node.radius + 12, 98),
    topH: node.radius + 16,
    bottomH: node.radius + 40,
  };
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
  scope?: 'all' | 'related';
  focusNodeId?: string | null;
}): ForestGraphData {
  const {
    tabs,
    activeTabId,
    activeForestFolder,
    recentFiles = [],
    nowMs = 0,
    scope = 'all',
    focusNodeId = null,
  } = params;

  const recentOpenedByPath = new Map<string, number>();
  for (const r of recentFiles) {
    recentOpenedByPath.set(normalizePathForCompare(r.filePath), r.lastOpenedAt);
  }

  const fileModifiedByPath = new Map<string, number>();
  if (activeForestFolder) {
    for (const fileItem of activeForestFolder.files) {
      if (
        fileItem.filePath &&
        typeof fileItem.modifiedTimeMs === 'number' &&
        Number.isFinite(fileItem.modifiedTimeMs) &&
        fileItem.modifiedTimeMs > 0
      ) {
        fileModifiedByPath.set(normalizePathForCompare(fileItem.filePath), fileItem.modifiedTimeMs);
      }
    }
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
      getMapLastModified(tab.map) ??
      (pathKey ? fileModifiedByPath.get(pathKey) : undefined) ??
      (pathKey ? recentOpenedByPath.get(pathKey) : undefined);

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
        getMapLastModified(fileItem.map) ??
        fileItem.modifiedTimeMs ??
        recentOpenedByPath.get(pathKey);

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

  // Filter to full connected component (Option A) when scope === 'related'
  let activeNodes = nodes;
  let activeEdges = edges;
  if (scope === 'related' && nodes.length > 0) {
    const anchorId =
      (focusNodeId && nodeById.has(focusNodeId) ? focusNodeId : undefined) ||
      (activeTabId && tabIdToGraphId.get(activeTabId)) ||
      nodes[0].id;

    const connectedIds = new Set<string>([anchorId]);
    const queue: string[] = [anchorId];
    while (queue.length > 0) {
      const curId = queue.shift()!;
      const cur = nodeById.get(curId);
      if (!cur) continue;
      for (const nextId of [...cur.outgoingIds, ...cur.incomingIds]) {
        if (!connectedIds.has(nextId) && nodeById.has(nextId)) {
          connectedIds.add(nextId);
          queue.push(nextId);
        }
      }
    }

    activeNodes = nodes.filter(n => connectedIds.has(n.id));
    activeEdges = edges.filter(
      e => connectedIds.has(e.sourceId) && connectedIds.has(e.targetId)
    );
  }

  // Deterministic 2D great-forest layout: group connected components into groves and expand both H & V
  const hashStringUnit = (str: string, salt: number): number => {
    let h = (2166136261 ^ salt) >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  };

  if (activeNodes.length === 1) {
    activeNodes[0].x = 0;
    activeNodes[0].y = 0;
  } else if (activeNodes.length > 1) {
    const baseSorted = [...activeNodes].sort((a, b) => {
      const degA = a.incomingIds.length + a.outgoingIds.length;
      const degB = b.incomingIds.length + b.outgoingIds.length;
      if (degB !== degA) return degB - degA;
      if (b.totalNodes !== a.totalNodes) return b.totalNodes - a.totalNodes;
      return a.id.localeCompare(b.id);
    });

    // Build connected-component groves via BFS starting from highest-degree hubs
    const rankById = new Map(baseSorted.map((n, idx) => [n.id, idx]));
    const visited = new Set<string>();
    const components: ForestGraphNode[][] = [];
    for (const seed of baseSorted) {
      if (visited.has(seed.id)) continue;
      const comp: ForestGraphNode[] = [];
      const queue: ForestGraphNode[] = [seed];
      visited.add(seed.id);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        comp.push(cur);
        const neighborIds = [...cur.outgoingIds, ...cur.incomingIds].sort(
          (a, b) => (rankById.get(a) ?? 0) - (rankById.get(b) ?? 0)
        );
        for (const nid of neighborIds) {
          if (visited.has(nid)) continue;
          const neighbor = nodeById.get(nid);
          if (neighbor) {
            visited.add(nid);
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }
    components.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return (rankById.get(a[0].id) ?? 0) - (rankById.get(b[0].id) ?? 0);
    });
    const ordered = components.flat();

    const cols = Math.max(2, Math.ceil(Math.sqrt(ordered.length * 1.2)));
    const cellW = 290;
    const cellH = 265;
    ordered.forEach((n, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const staggerX = row % 2 === 1 ? cellW * 0.42 : 0;
      const jx = (hashStringUnit(n.id, 17) - 0.5) * cellW * 0.38;
      const jy = (hashStringUnit(n.id, 53) - 0.5) * cellH * 0.38;
      n.x = col * cellW + staggerX + jx;
      n.y = row * cellH + jy;
    });

    const separatePair = (a: ForestGraphNode, b: ForestGraphNode, radialFactor: number): boolean => {
      const extA = getNodeVisualExtents(a);
      const extB = getNodeVisualExtents(b);
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let changed = false;

      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        dx = 17;
        dy = 13;
      }

      const reqX = extA.halfW + extB.halfW + 18;
      const reqY = (dy >= 0 ? extA.bottomH + extB.topH : extB.bottomH + extA.topH) + 18;
      const overlapX = reqX - Math.abs(dx);
      const overlapY = reqY - Math.abs(dy);

      if (overlapX > 0 && overlapY > 0) {
        changed = true;
        if (overlapX <= overlapY) {
          const signX = dx >= 0 ? 1 : -1;
          const pushX = overlapX * 0.5 + 1;
          a.x -= signX * pushX;
          b.x += signX * pushX;
        } else {
          const signY = dy >= 0 ? 1 : -1;
          const pushY = overlapY * 0.5 + 1;
          a.y -= signY * pushY;
          b.y += signY * pushY;
        }
        dx = b.x - a.x;
        dy = b.y - a.y;
      }

      const dist = Math.hypot(dx, dy) || 1;
      const minCircleDist = a.radius + b.radius + 96;
      if (dist < minCircleDist) {
        changed = true;
        const push = ((minCircleDist - dist) * radialFactor) + 0.5;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }

      return changed;
    };

    // Gentle edge springs + continuous repulsion without central circular gravity
    for (let iter = 0; iter < 55; iter++) {
      for (const edge of activeEdges) {
        const a = nodeById.get(edge.sourceId);
        const b = nodeById.get(edge.targetId);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const ideal = a.radius + b.radius + 205;
        const delta = (dist - ideal) * 0.032;
        const ux = dx / dist;
        const uy = dy / dist;
        a.x += ux * delta;
        a.y += uy * delta;
        b.x -= ux * delta;
        b.y -= uy * delta;
      }

      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          separatePair(ordered[i], ordered[j], 0.52);
        }
      }
    }

    // Strict zero-overlap convergence post-pass
    for (let pass = 0; pass < 140; pass++) {
      let moved = false;
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          if (separatePair(ordered[i], ordered[j], 0.5)) {
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    // Re-center centroid around (0, 0) (translation preserves all pairwise distances)
    const cx = activeNodes.reduce((sum, n) => sum + n.x, 0) / activeNodes.length;
    const cy = activeNodes.reduce((sum, n) => sum + n.y, 0) / activeNodes.length;
    for (const n of activeNodes) {
      n.x = Math.round((n.x - cx) * 10) / 10;
      n.y = Math.round((n.y - cy) * 10) / 10;
    }
  }

  let bounds: ForestGraphBounds = { minX: -320, maxX: 320, minY: -220, maxY: 220 };
  if (activeNodes.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of activeNodes) {
      const ext = getNodeVisualExtents(n);
      minX = Math.min(minX, n.x - ext.halfW);
      maxX = Math.max(maxX, n.x + ext.halfW);
      minY = Math.min(minY, n.y - ext.topH);
      maxY = Math.max(maxY, n.y + ext.bottomH);
    }
    bounds = {
      minX: Math.min(-320, minX - 80),
      maxX: Math.max(320, maxX + 80),
      minY: Math.min(-220, minY - 70),
      maxY: Math.max(220, maxY + 70),
    };
  }

  return { nodes: activeNodes, edges: activeEdges, bounds };
}

/**
 * Counts how many unique maps across open tabs and the active Forest Folder
 * contain at least one link targeting `targetFilePath`.
 */
export function countIncomingMapLinks(
  targetFilePath: string,
  tabs: MapTab[],
  activeForestFolder?: ActiveForestFolderData | null
): number {
  const targetKey = normalizePathForCompare(targetFilePath);
  if (!targetKey) return 0;

  const targetTabIds = new Set<string>();
  const sources: Array<{ filePath?: string; map: FreeMindMap }> = [];
  const seenSourcePaths = new Set<string>();

  for (const tab of tabs) {
    sources.push({ filePath: tab.filePath, map: tab.map });
    if (tab.filePath) {
      const key = normalizePathForCompare(tab.filePath);
      seenSourcePaths.add(key);
      if (key === targetKey) {
        targetTabIds.add(tab.id);
      }
    }
  }

  if (activeForestFolder) {
    for (const item of activeForestFolder.files) {
      const key = item.filePath ? normalizePathForCompare(item.filePath) : '';
      if (key && seenSourcePaths.has(key)) continue;
      if (key) seenSourcePaths.add(key);
      sources.push({ filePath: item.filePath, map: item.map });
    }
  }

  let count = 0;
  for (const source of sources) {
    const sourceKey = source.filePath ? normalizePathForCompare(source.filePath) : '';
    if (sourceKey && sourceKey === targetKey) continue;

    const links = collectMapLinks(source.map.root);
    let matchesTarget = false;
    for (const rawLink of links) {
      const parsed = parseForestMindLink(rawLink);
      if (parsed.kind === 'file' && parsed.filePath) {
        const resolved = resolveRelativeMmPath(source.filePath, parsed.filePath);
        if (normalizePathForCompare(resolved) === targetKey) {
          matchesTarget = true;
          break;
        }
      } else if (parsed.kind === 'forest' && parsed.tabId && targetTabIds.has(parsed.tabId)) {
        matchesTarget = true;
        break;
      }
    }
    if (matchesTarget) {
      count += 1;
    }
  }

  return count;
}

import { describe, expect, it } from 'vitest';
import type { MapTab } from '../../hooks/useMindMap';
import type { FreeMindMap, FreeMindNode } from '../../types/freemind';
import {
  buildForestGraph,
  classifyMapSeason,
  classifyTreeSpecies,
  countIncomingMapLinks,
  getMapLastModified,
  getNodeVisualExtents,
} from '../forestGraph';

function makeNode(
  id: string,
  text: string,
  children: FreeMindNode[] = [],
  extra: Partial<FreeMindNode> = {}
): FreeMindNode {
  return {
    id,
    text,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children,
    ...extra,
  };
}

function makeChainMap(prefix: string, depth: number, link?: string, modified?: number): FreeMindMap {
  let current = makeNode(`${prefix}_n${depth}`, `Leaf ${depth}`, [], { link, modified });
  for (let i = depth - 1; i >= 0; i--) {
    current = makeNode(`${prefix}_n${i}`, i === 0 ? `${prefix} Root` : `Node ${i}`, [current]);
  }
  return { version: '1.0.1', root: current };
}

describe('forestGraph', () => {
  it('classifies all 6 botanical tree species accurately by size, depth, and link hub degree', () => {
    expect(classifyTreeSpecies(2, 1)).toBe('sprout');
    expect(classifyTreeSpecies(8, 2)).toBe('sapling');
    expect(classifyTreeSpecies(22, 2)).toBe('shrub');
    expect(classifyTreeSpecies(14, 5)).toBe('pine');
    expect(classifyTreeSpecies(55, 3)).toBe('mature');
    expect(classifyTreeSpecies(120, 6)).toBe('ancient');
    expect(classifyTreeSpecies(24, 3, 3)).toBe('ancient');
  });

  it('classifies season themes across rolling 7d, 30d, 365d, and >365d windows and uses OS modifiedTimeMs fallback', () => {
    const now = 1_700_000_000_000;
    const day = 24 * 60 * 60 * 1000;

    expect(classifyMapSeason(now - 2 * day, now).season).toBe('spring');
    expect(classifyMapSeason(now - 20 * day, now).season).toBe('summer');
    expect(classifyMapSeason(now - 120 * day, now).season).toBe('autumn');
    expect(classifyMapSeason(now - 400 * day, now).season).toBe('winter');
    expect(classifyMapSeason(now - 400 * day, now).canopyFill).toBe('#991b1b');
    expect(classifyMapSeason(undefined, now).season).toBe('winter');

    const map = makeChainMap('Timed', 2, undefined, now - 2 * day);
    expect(getMapLastModified(map)).toBe(now - 2 * day);

    // Map without XML modified/created attributes uses OS modifiedTimeMs from scanned file
    const rawNoXmlTime = makeChainMap('OsTimed', 2);
    const graph = buildForestGraph({
      tabs: [],
      activeForestFolder: {
        folderPath: 'C:\\forest',
        name: 'forest',
        scannedAt: now,
        files: [
          {
            filePath: 'C:\\forest\\year.mm',
            fileName: 'year.mm',
            relativePath: '.',
            map: rawNoXmlTime,
            fileSize: 100,
            modifiedTimeMs: now - 90 * day,
          },
        ],
      },
      nowMs: now,
    });
    expect(graph.nodes[0].lastModifiedMs).toBe(now - 90 * day);
    expect(graph.nodes[0].seasonInfo.season).toBe('autumn');
  });

  it('builds directional forward/backlinks across open tabs and folder maps with deduplication', () => {
    const now = 1_700_000_000_000;
    const mapA = makeChainMap('Map A', 2, 'forest://tab_b', now - 1000);
    const mapB = makeChainMap('Map B', 4, './sub/c.mm', now - 5 * 24 * 60 * 60 * 1000);
    const mapC = makeChainMap('Map C', 1, '../a.mm');

    const tabs: MapTab[] = [
      {
        id: 'tab_a',
        title: 'Map A',
        filePath: 'C:\\forest\\a.mm',
        map: mapA,
        past: [],
        future: [],
        selectedNodeId: 'Map A_n0',
      },
      {
        id: 'tab_b',
        title: 'Map B',
        filePath: 'C:\\forest\\b.mm',
        map: mapB,
        past: [],
        future: [],
        selectedNodeId: 'Map B_n0',
      },
    ];

    const graph = buildForestGraph({
      tabs,
      activeTabId: 'tab_a',
      activeForestFolder: {
        folderPath: 'C:\\forest',
        name: 'forest',
        scannedAt: now,
        files: [
          {
            filePath: 'C:\\forest\\a.mm',
            fileName: 'a.mm',
            relativePath: '.',
            map: mapA,
            fileSize: 100,
          },
          {
            filePath: 'C:\\forest\\sub\\c.mm',
            fileName: 'c.mm',
            relativePath: 'sub',
            map: mapC,
            fileSize: 100,
          },
        ],
      },
      nowMs: now,
    });

    // Deduplicated: tab_a + tab_b + sub/c.mm = 3 nodes
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(3);

    const nodeA = graph.nodes.find(n => n.tabId === 'tab_a')!;
    const nodeB = graph.nodes.find(n => n.tabId === 'tab_b')!;
    const nodeC = graph.nodes.find(n => n.filePath === 'C:\\forest\\sub\\c.mm')!;

    expect(nodeA.isActiveTab).toBe(true);
    expect(nodeA.seasonInfo.season).toBe('spring');
    expect(nodeA.outgoingIds).toContain(nodeB.id);
    expect(nodeA.incomingIds).toContain(nodeC.id);
    expect(nodeB.incomingIds).toContain(nodeA.id);
    expect(nodeB.outgoingIds).toContain(nodeC.id);

    // Every pair should maintain non-overlapping distance
    for (let i = 0; i < graph.nodes.length; i++) {
      for (let j = i + 1; j < graph.nodes.length; j++) {
        const a = graph.nodes[i];
        const b = graph.nodes[j];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        expect(dist).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it('prevents tree icon and label box overlap across 25 interconnected maps including hub species', () => {
    const now = 1_700_000_000_000;
    const hubChildren: FreeMindNode[] = [];
    for (let k = 1; k <= 22; k++) {
      hubChildren.push(
        makeNode(`hub_c${k}`, `Branch ${k}`, [], k <= 12 ? { link: `forest://tab_${k}` } : {})
      );
    }

    const tabs: MapTab[] = [
      {
        id: 'tab_0',
        title: 'Central Hub',
        map: {
          version: '1.0.1',
          root: makeNode('hub_root', 'Central Hub', hubChildren),
        },
        past: [],
        future: [],
        selectedNodeId: 'hub_root',
      },
    ];

    for (let i = 1; i <= 24; i++) {
      const linkTarget = i % 3 === 0 ? 'forest://tab_0' : `forest://tab_${(i % 24) + 1}`;
      tabs.push({
        id: `tab_${i}`,
        title: `Map Title Number ${i}`,
        map: makeChainMap(`M${i}`, (i % 5) + 1, linkTarget, now - i * 86_400_000),
        past: [],
        future: [],
        selectedNodeId: `M${i}_n0`,
      });
    }

    const graph = buildForestGraph({ tabs, activeTabId: 'tab_0', nowMs: now });
    expect(graph.nodes).toHaveLength(25);
    expect(graph.nodes.find(n => n.tabId === 'tab_0')?.species).toBe('ancient');

    for (let i = 0; i < graph.nodes.length; i++) {
      for (let j = i + 1; j < graph.nodes.length; j++) {
        const a = graph.nodes[i];
        const b = graph.nodes[j];
        const extA = getNodeVisualExtents(a);
        const extB = getNodeVisualExtents(b);
        const overlapX = extA.halfW + extB.halfW - Math.abs(b.x - a.x);
        const overlapY =
          (b.y >= a.y ? extA.bottomH + extB.topH : extB.bottomH + extA.topH) -
          Math.abs(b.y - a.y);

        // Bounding boxes including 136px label pill must not overlap
        expect(overlapX > 0 && overlapY > 0).toBe(false);
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(a.radius + b.radius + 80);
      }
    }

    const spanX = graph.bounds.maxX - graph.bounds.minX;
    const spanY = graph.bounds.maxY - graph.bounds.minY;
    expect(spanX).toBeGreaterThanOrEqual(900);
    expect(spanY).toBeGreaterThanOrEqual(700);
  });

  it('arranges unlinked maps across a 2D forest expanding both horizontally and vertically without overlap', () => {
    const now = 1_700_000_000_000;
    const tabs: MapTab[] = Array.from({ length: 16 }, (_, idx) => ({
      id: `tab_free_${idx}`,
      title: `Woodland ${idx}`,
      map: makeChainMap(`Wood${idx}`, (idx % 4) + 1, undefined, now - idx * 86_400_000),
      past: [],
      future: [],
      selectedNodeId: `Wood${idx}_n0`,
    }));

    const graph = buildForestGraph({ tabs, activeTabId: 'tab_free_0', nowMs: now });
    expect(graph.nodes).toHaveLength(16);

    const spanX = graph.bounds.maxX - graph.bounds.minX;
    const spanY = graph.bounds.maxY - graph.bounds.minY;
    expect(spanX).toBeGreaterThanOrEqual(900);
    expect(spanY).toBeGreaterThanOrEqual(700);

    for (let i = 0; i < graph.nodes.length; i++) {
      for (let j = i + 1; j < graph.nodes.length; j++) {
        const a = graph.nodes[i];
        const b = graph.nodes[j];
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(a.radius + b.radius + 80);
      }
    }
  });

  it('filters to the full connected network (Option A) when scope is related', () => {
    const now = 1_700_000_000_000;
    const tabs: MapTab[] = [
      {
        id: 'tab_a',
        title: 'Root A',
        map: makeChainMap('A', 1, 'forest://tab_b', now),
        past: [],
        future: [],
        selectedNodeId: 'A_n0',
      },
      {
        id: 'tab_b',
        title: 'Direct B',
        map: makeChainMap('B', 1, 'forest://tab_c', now),
        past: [],
        future: [],
        selectedNodeId: 'B_n0',
      },
      {
        id: 'tab_c',
        title: 'Transitive C',
        map: makeChainMap('C', 1, undefined, now),
        past: [],
        future: [],
        selectedNodeId: 'C_n0',
      },
      {
        id: 'tab_isolated',
        title: 'Isolated D',
        map: makeChainMap('D', 1, undefined, now),
        past: [],
        future: [],
        selectedNodeId: 'D_n0',
      },
    ];

    const relatedGraph = buildForestGraph({
      tabs,
      activeTabId: 'tab_a',
      scope: 'related',
      focusNodeId: 'tab:tab_a',
      nowMs: now,
    });

    const relatedIds = relatedGraph.nodes.map(n => n.tabId);
    expect(relatedIds).toContain('tab_a');
    expect(relatedIds).toContain('tab_b');
    expect(relatedIds).toContain('tab_c');
    expect(relatedIds).not.toContain('tab_isolated');
    expect(relatedGraph.nodes).toHaveLength(3);
    expect(relatedGraph.edges).toHaveLength(2);
  });

  it('counts incoming backlinks across open tabs and active folder maps without duplicates', () => {
    const targetPath = 'C:\\forest\\target.mm';
    const openTargetMap = makeChainMap('Target', 1, './target.mm');
    const sourceTabMap = makeChainMap('SourceTab', 1, './target.mm');
    const folderOnlySource = makeChainMap('FolderSource', 1, '../target.mm');
    const forestTabLinkSource = makeChainMap('ForestLink', 1, 'forest://tab_target');

    const tabs: MapTab[] = [
      {
        id: 'tab_target',
        title: 'Target',
        filePath: targetPath,
        map: openTargetMap,
        past: [],
        future: [],
        selectedNodeId: 'Target_n0',
      },
      {
        id: 'tab_source',
        title: 'SourceTab',
        filePath: 'C:\\forest\\source.mm',
        map: sourceTabMap,
        past: [],
        future: [],
        selectedNodeId: 'SourceTab_n0',
      },
      {
        id: 'tab_unsaved',
        title: 'ForestLink',
        map: forestTabLinkSource,
        past: [],
        future: [],
        selectedNodeId: 'ForestLink_n0',
      },
    ];

    const count = countIncomingMapLinks(targetPath, tabs, {
      folderPath: 'C:\\forest',
      name: 'forest',
      scannedAt: 1000,
      files: [
        // Duplicate of tab_source should not be counted twice
        {
          filePath: 'C:\\forest\\source.mm',
          fileName: 'source.mm',
          relativePath: '.',
          map: sourceTabMap,
          fileSize: 100,
        },
        {
          filePath: 'C:\\forest\\sub\\folder-source.mm',
          fileName: 'folder-source.mm',
          relativePath: 'sub',
          map: folderOnlySource,
          fileSize: 100,
        },
      ],
    });

    // tab_source (file link) + tab_unsaved (forest:// link) + folder-source (relative ../target.mm) = 3
    expect(count).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import type { MapTab } from '../../hooks/useMindMap';
import type { FreeMindMap, FreeMindNode } from '../../types/freemind';
import {
  buildForestGraph,
  classifyMapSeason,
  classifyTreeSpecies,
  getMapLastModified,
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

  it('classifies season themes from map modification age', () => {
    const now = 1_700_000_000_000;
    const day = 24 * 60 * 60 * 1000;

    expect(classifyMapSeason(now - 1 * day, now).season).toBe('spring');
    expect(classifyMapSeason(now - 10 * day, now).season).toBe('summer');
    expect(classifyMapSeason(now - 30 * day, now).season).toBe('autumn');
    expect(classifyMapSeason(now - 90 * day, now).season).toBe('winter');
    expect(classifyMapSeason(undefined, now).season).toBe('winter');

    const map = makeChainMap('Timed', 2, undefined, now - 2 * day);
    expect(getMapLastModified(map)).toBe(now - 2 * day);
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
});

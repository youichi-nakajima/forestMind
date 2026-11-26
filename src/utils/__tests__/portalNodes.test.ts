import { describe, expect, it } from 'vitest';
import type { FreeMindMap, FreeMindNode } from '../../types/freemind';
import {
  buildGhostSubtreeFromPreview,
  injectPortalSubtrees,
  isPortalCapableLink,
  normalizePathForCompare,
  resolveRelativeMmPath,
  type ResolvedPortalPreview,
} from '../portalNodes';

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

describe('portalNodes', () => {
  it('detects portal-capable .mm and forest:// links while ignoring external URLs and .md files', () => {
    expect(isPortalCapableLink('./sub/child.mm')).toBe(true);
    expect(isPortalCapableLink('../other.mm#ID_42')).toBe(true);
    expect(isPortalCapableLink('C:\\vault\\topic.MM')).toBe(true);
    expect(isPortalCapableLink('forest://tab_2#ID_7')).toBe(true);

    expect(isPortalCapableLink('https://example.com/a.mm')).toBe(false);
    expect(isPortalCapableLink('./notes.md')).toBe(false);
    expect(isPortalCapableLink('#ID_LOCAL')).toBe(false);
    expect(isPortalCapableLink('')).toBe(false);
  });

  it('resolves relative .mm paths cleanly on Windows and POSIX paths', () => {
    expect(resolveRelativeMmPath('C:\\forest\\docs\\main.mm', '../sub/child.mm')).toBe(
      'C:/forest/sub/child.mm'
    );
    expect(resolveRelativeMmPath('/Users/test/forest/root.mm', './branch.mm')).toBe(
      '/Users/test/forest/branch.mm'
    );
    expect(normalizePathForCompare('C:\\Forest\\A.mm')).toBe('c:/forest/a.mm');
  });

  it('builds ghost subtrees targeting either whole map or a specific #NODE_ID and guards cycles/node cap', () => {
    const subLeaf = makeNode('ID_LEAF', 'Leaf Detail');
    const subBranch = makeNode('ID_BRANCH', 'Target Branch', [subLeaf]);
    const targetMap: FreeMindMap = {
      version: '1.0.1',
      root: makeNode('ID_TROOT', 'Target Root', [subBranch]),
    };

    const preview: ResolvedPortalPreview = {
      sourceNodeId: 'ID_SRC',
      targetKind: 'file',
      targetFilePath: 'C:/forest/target.mm',
      targetNodeId: 'ID_BRANCH',
      targetTitle: 'target',
      status: 'loaded',
      map: targetMap,
    };

    const { entryNode, ghostMetaMap } = buildGhostSubtreeFromPreview(preview);
    expect(entryNode.text).toBe('Target Branch');
    expect(entryNode.children).toHaveLength(1);
    expect(entryNode.children[0].text).toBe('Leaf Detail');
    expect(ghostMetaMap.get(entryNode.id)?.originalNodeId).toBe('ID_BRANCH');
    expect(ghostMetaMap.get(entryNode.id)?.isPortalEntry).toBe(true);
    expect(ghostMetaMap.get(entryNode.children[0].id)?.originalNodeId).toBe('ID_LEAF');

    // Cycle safety guard
    const cyclicA = makeNode('A', 'Cyclic A');
    const cyclicB = makeNode('B', 'Cyclic B', [cyclicA]);
    cyclicA.children.push(cyclicB);
    const { entryNode: cycEntry } = buildGhostSubtreeFromPreview({
      sourceNodeId: 'ID_SRC',
      targetKind: 'forest',
      targetTabId: 'tab_2',
      targetTitle: 'Cyclic Map',
      status: 'loaded',
      map: { version: '1.0.1', root: cyclicA },
    });
    expect(cycEntry.text).toBe('Cyclic A');
    expect(cycEntry.children[0].text).toBe('Cyclic B');
    expect(cycEntry.children[0].children).toHaveLength(0);
  });

  it('injects ghost portal subtrees without mutating the source tree', () => {
    const portalSource = makeNode('ID_P', 'Portal Host', [], {
      position: 'right',
      link: './other.mm',
    });
    const root = makeNode('ID_ROOT', 'Main Root', [portalSource]);

    const otherMap: FreeMindMap = {
      version: '1.0.1',
      root: makeNode('ID_OTHER_ROOT', 'Other Map', [makeNode('ID_OC1', 'Branch 1')]),
    };

    const previews = new Map<string, ResolvedPortalPreview>([
      [
        'ID_P',
        {
          sourceNodeId: 'ID_P',
          targetKind: 'file',
          targetFilePath: 'C:/forest/other.mm',
          targetTitle: 'other',
          status: 'loaded',
          map: otherMap,
        },
      ],
    ]);

    const { augmentedRoot, ghostMetaMap } = injectPortalSubtrees(root, previews);
    // Source remains untouched
    expect(portalSource.children).toHaveLength(0);
    // Augmented root includes ghost subtree on same side
    const augHost = augmentedRoot.children[0];
    expect(augHost.children).toHaveLength(1);
    expect(augHost.children[0].position).toBe('right');
    expect(augHost.children[0].children[0].text).toBe('Branch 1');
    expect(ghostMetaMap.size).toBe(2);
  });
});

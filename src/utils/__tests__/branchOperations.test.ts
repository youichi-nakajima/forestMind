import { describe, expect, it } from 'vitest';
import type { FreeMindMap, FreeMindNode } from '../../types/freemind';
import {
  applySplitToSourceTree,
  buildSplitMapFromBranch,
  computeRelativeMmLink,
  countSubtreeNodes,
  prepareMergedSubtree,
  remapSubtreeIds,
} from '../branchOperations';

function makeNode(
  id: string,
  text: string,
  overrides: Partial<FreeMindNode> = {}
): FreeMindNode {
  return {
    id,
    text,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children: [],
    ...overrides,
  };
}

describe('branchOperations', () => {
  it('computes relative .mm paths cleanly across same, nested, parent, and mismatched drives', () => {
    expect(computeRelativeMmLink('C:\\maps\\main.mm', 'C:\\maps\\sub.mm')).toBe('./sub.mm');
    expect(computeRelativeMmLink('C:\\maps\\main.mm', 'C:\\maps\\topics\\deep.mm')).toBe(
      './topics/deep.mm'
    );
    expect(computeRelativeMmLink('C:\\maps\\sub\\topic.mm', 'C:\\maps\\shared.mm')).toBe(
      '../shared.mm'
    );
    expect(computeRelativeMmLink('C:\\maps\\main.mm', 'D:\\other\\x.mm')).toBe('D:/other/x.mm');
    expect(computeRelativeMmLink(undefined, 'C:\\maps\\sub.mm')).toBe('C:/maps/sub.mm');
  });

  it('builds an independent split map with balanced children and no dangling external arrowLinks', () => {
    const sub1 = makeNode('S1', 'Sub 1', {
      position: 'left',
      arrowLinks: [{ destination: 'S2' }, { destination: 'OUTSIDE_NODE' }],
    });
    const sub2 = makeNode('S2', 'Sub 2', { position: 'left' });
    const branch = makeNode('B1', 'Split Branch', {
      position: 'left',
      folded: true,
      children: [sub1, sub2],
    });

    expect(countSubtreeNodes(branch)).toBe(3);

    const splitMap = buildSplitMapFromBranch(branch, '1.0.1');
    expect(splitMap.root.id).toBe('B1');
    expect(splitMap.root.position).toBeUndefined();
    expect(splitMap.root.folded).toBe(false);
    expect(splitMap.root.style).toBe('bubble');
    expect(splitMap.root.children[0].position).toBe('right');
    expect(splitMap.root.children[1].position).toBe('left');
    // Internal arrow link preserved, external dangling arrow link removed
    expect(splitMap.root.children[0].arrowLinks).toEqual([{ destination: 'S2' }]);
    // Source object was not mutated
    expect(branch.folded).toBe(true);
    expect(branch.children[0].arrowLinks).toHaveLength(2);
  });

  it('updates source tree on split (both collapse and keep modes) and refuses splitting true root', () => {
    const child = makeNode('B1', 'Branch', {
      children: [makeNode('B1_C', 'Leaf')],
    });
    const other = makeNode('OTHER', 'Other', {
      arrowLinks: [{ destination: 'B1_C' }, { destination: 'B1' }],
    });
    const root = makeNode('ROOT', 'Root', { children: [child, other] });

    expect(
      applySplitToSourceTree(root, 'ROOT', './x.mm', { collapseToLinkNode: true })
    ).toBe(false);

    expect(
      applySplitToSourceTree(root, 'B1', './branch.mm', { collapseToLinkNode: false })
    ).toBe(true);
    expect(child.link).toBe('./branch.mm');
    expect(child.children).toHaveLength(1);

    expect(
      applySplitToSourceTree(root, 'B1', './branch.mm', { collapseToLinkNode: true })
    ).toBe(true);
    expect(child.children).toEqual([]);
    // Arrow link to removed B1_C is cleaned up while link to B1 remains
    expect(other.arrowLinks).toEqual([{ destination: 'B1' }]);
  });

  it('remaps IDs and internal links when preparing merged subtrees', () => {
    const leaf = makeNode('N_LEAF', 'Leaf', {
      link: '#N_CHILD',
      arrowLinks: [{ destination: 'N_ROOT' }],
    });
    const child = makeNode('N_CHILD', 'Child', { children: [leaf] });
    const sourceRoot = makeNode('N_ROOT', 'Source Root', {
      folded: true,
      children: [child],
    });
    const sourceMap: FreeMindMap = { version: '1.0.1', root: sourceRoot };

    const { node: remapped, idMap } = remapSubtreeIds(sourceRoot);
    expect(remapped.id).not.toBe('N_ROOT');
    expect(idMap.size).toBe(3);
    const newChildId = idMap.get('N_CHILD')!;
    const newRootId = idMap.get('N_ROOT')!;
    expect(remapped.children[0].children[0].link).toBe(`#${newChildId}`);
    expect(remapped.children[0].children[0].arrowLinks).toEqual([{ destination: newRootId }]);

    const withRoot = prepareMergedSubtree(sourceMap, { includeSourceRoot: true });
    expect(withRoot).toHaveLength(1);
    expect(withRoot[0].folded).toBe(false);
    expect(withRoot[0].id).not.toBe('N_ROOT');

    const withoutRoot = prepareMergedSubtree(sourceMap, { includeSourceRoot: false });
    expect(withoutRoot).toHaveLength(1);
    expect(withoutRoot[0].text).toBe('Child');
    expect(withoutRoot[0].id).not.toBe('N_CHILD');
  });
});

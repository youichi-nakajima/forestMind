import { describe, expect, it } from 'vitest';
import type { FreeMindMap, FreeMindNode } from '../../types/freemind';
import {
  cleanupDanglingArrowLinks,
  cloneMindMap,
  collectSubtreeIds,
  getNodePlainText,
  nodeMatchesKeyword,
  pruneTopLevelTargetNodes,
  sanitizeDownloadFileName,
  setSubtreePosition,
} from '../treeUtils';

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

describe('treeUtils', () => {
  it('sanitizeDownloadFileName strips illegal characters, control chars, and trailing dots/spaces', () => {
    expect(sanitizeDownloadFileName('My: Map / v2?*<>|"test"')).toBe('My_ Map _ v2______test_');
    expect(sanitizeDownloadFileName('hello\u0000\u001fworld..  ')).toBe('hello__world');
    expect(sanitizeDownloadFileName('   ...   ', 'fallback')).toBe('fallback');
    expect(sanitizeDownloadFileName('')).toBe('mindmap');
  });

  it('cleanupDanglingArrowLinks removes links pointing to missing nodes and preserves valid ones', () => {
    const childA = makeNode('A', 'Node A', {
      arrowLinks: [
        { destination: 'B', color: '#e11d48' },
        { destination: 'DELETED_ID', color: '#e11d48' },
      ],
    });
    const childB = makeNode('B', 'Node B', {
      arrowLinks: [{ destination: 'ROOT' }],
    });
    const root = makeNode('ROOT', 'Root', { children: [childA, childB] });

    expect(collectSubtreeIds(root)).toEqual(new Set(['ROOT', 'A', 'B']));
    expect(cleanupDanglingArrowLinks(root)).toBe(true);
    expect(childA.arrowLinks).toEqual([{ destination: 'B', color: '#e11d48' }]);
    expect(childB.arrowLinks).toEqual([{ destination: 'ROOT' }]);
    expect(cleanupDanglingArrowLinks(root)).toBe(false);
  });

  it('setSubtreePosition recursively updates position for node and all descendants', () => {
    const grandChild = makeNode('GC', 'GrandChild', { position: 'right' });
    const child = makeNode('C', 'Child', { position: 'right', children: [grandChild] });
    const branch = makeNode('B', 'Branch', { position: 'right', children: [child] });

    setSubtreePosition(branch, 'left');
    expect(branch.position).toBe('left');
    expect(child.position).toBe('left');
    expect(grandChild.position).toBe('left');
  });

  it('pruneTopLevelTargetNodes skips descendants of matched ancestors and respects excludeRoot', () => {
    const grandChild = makeNode('GC', 'GrandChild');
    const childA = makeNode('A', 'Child A', { children: [grandChild] });
    const childB = makeNode('B', 'Child B');
    const root = makeNode('ROOT', 'Root', { children: [childA, childB] });

    const pruned = pruneTopLevelTargetNodes(root, new Set(['A', 'GC', 'B']));
    expect(pruned.map(n => n.id)).toEqual(['A', 'B']);

    const excluded = pruneTopLevelTargetNodes(root, new Set(['ROOT', 'A']), { excludeRoot: true });
    expect(excluded.map(n => n.id)).toEqual(['A']);

    const included = pruneTopLevelTargetNodes(root, new Set(['ROOT', 'A']), { excludeRoot: false });
    expect(included.map(n => n.id)).toEqual(['ROOT']);
  });

  it('getNodePlainText and nodeMatchesKeyword match rich content & attributes without HTML tag false positives', () => {
    const richNode = makeNode('R1', '', {
      htmlContent: '<html><body><p>Hello <b>Rich &amp; Bold</b></p></body></html>',
      noteHtml: '<p><strong>Secret Note</strong> &amp; Details</p>',
      link: './sub/roadmap.mm#ID_99',
      attributes: [{ name: '優先度', value: '高' }],
    });

    expect(getNodePlainText(richNode)).toBe('Hello Rich & Bold');
    expect(nodeMatchesKeyword(richNode, 'rich & bold')).toBe(true);
    expect(nodeMatchesKeyword(richNode, 'secret note')).toBe(true);
    expect(nodeMatchesKeyword(richNode, 'roadmap.mm')).toBe(true);
    expect(nodeMatchesKeyword(richNode, '優先度')).toBe(true);
    expect(nodeMatchesKeyword(richNode, '高')).toBe(true);
    // Tag names in noteHtml should not match
    expect(nodeMatchesKeyword(richNode, 'strong')).toBe(false);
    expect(nodeMatchesKeyword(richNode, '<div>')).toBe(false);
  });

  it('cloneMindMap produces an independent deep copy', () => {
    const original: FreeMindMap = {
      version: '1.0.1',
      root: makeNode('ROOT', 'Original', { children: [makeNode('C1', 'Child')] }),
    };
    const cloned = cloneMindMap(original);
    cloned.root.children[0].text = 'Mutated';
    expect(original.root.children[0].text).toBe('Child');
  });
});

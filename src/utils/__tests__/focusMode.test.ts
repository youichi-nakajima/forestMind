import { describe, expect, it } from 'vitest';
import type { FreeMindNode } from '../../types/freemind';
import {
  findNodePath,
  isNodeInsideSubtree,
  resolveFocusedSubtree,
} from '../focusMode';

function makeNode(id: string, text: string, children: FreeMindNode[] = []): FreeMindNode {
  return {
    id,
    text,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children,
  };
}

describe('focusMode', () => {
  const leaf = makeNode('n_leaf', 'Leaf');
  const branch = makeNode('n_branch', 'Branch', [leaf]);
  const sibling = makeNode('n_sibling', 'Sibling');
  const root = makeNode('n_root', 'Root', [branch, sibling]);

  it('finds paths and checks subtree membership', () => {
    expect(findNodePath(root, 'n_leaf')?.map(n => n.id)).toEqual([
      'n_root',
      'n_branch',
      'n_leaf',
    ]);
    expect(findNodePath(root, 'missing')).toBeNull();
    expect(isNodeInsideSubtree(branch, 'n_leaf')).toBe(true);
    expect(isNodeInsideSubtree(branch, 'n_sibling')).toBe(false);
  });

  it('resolves focused subtree and breadcrumbs, falling back cleanly when null/root/missing', () => {
    expect(resolveFocusedSubtree(root, null)).toEqual({
      activeRoot: root,
      isFocused: false,
      breadcrumbs: [],
    });
    expect(resolveFocusedSubtree(root, 'n_root')).toEqual({
      activeRoot: root,
      isFocused: false,
      breadcrumbs: [],
    });
    expect(resolveFocusedSubtree(root, 'deleted_id')).toEqual({
      activeRoot: root,
      isFocused: false,
      breadcrumbs: [],
    });

    const focused = resolveFocusedSubtree(root, 'n_branch');
    expect(focused.isFocused).toBe(true);
    expect(focused.activeRoot).toBe(branch);
    expect(focused.breadcrumbs).toEqual([
      { id: 'n_root', text: 'Root' },
      { id: 'n_branch', text: 'Branch' },
    ]);
  });
});

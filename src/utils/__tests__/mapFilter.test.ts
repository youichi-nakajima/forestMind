import { describe, expect, it } from 'vitest';
import type { FreeMindNode } from '../../types/freemind';
import { QUICK_COLOR_PRESETS } from '../quickStyle';
import {
  countActiveFilterConditions,
  EMPTY_MAP_FILTER,
  evaluateMapFilter,
  isMapFilterActive,
  toggleFilterAttribute,
  toggleFilterColor,
  toggleFilterIcon,
} from '../mapFilter';

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

describe('mapFilter', () => {
  const rose = QUICK_COLOR_PRESETS[0];
  const emerald = QUICK_COLOR_PRESETS[2];

  const hiddenChild = makeNode('n_hidden', 'Hidden Task', {
    icons: [{ builtin: 'flag' }],
    attributes: [{ name: 'ステータス', value: '進行中' }],
  });
  const foldedBranch = makeNode('n_folded', 'Folded Branch', {
    folded: true,
    children: [hiddenChild],
  });
  const visibleMatch = makeNode('n_visible', 'Visible Urgent', {
    backgroundColor: rose.bg,
    color: rose.color,
    icons: [{ builtin: 'flag' }],
    attributes: [
      { name: '優先度', value: '高' },
      { name: 'ステータス', value: '進行中' },
    ],
  });
  const otherBranch = makeNode('n_other', 'Done Item', {
    backgroundColor: emerald.bg,
    color: emerald.color,
    icons: [{ builtin: 'button_ok' }],
    attributes: [{ name: 'ステータス', value: '完了' }],
  });
  const root = makeNode('root', 'Root', {
    children: [visibleMatch, foldedBranch, otherBranch],
  });

  it('toggles filter criteria immutably and counts active conditions', () => {
    expect(isMapFilterActive(EMPTY_MAP_FILTER)).toBe(false);
    expect(countActiveFilterConditions(EMPTY_MAP_FILTER)).toBe(0);

    let c = toggleFilterColor(EMPTY_MAP_FILTER, 'rose');
    c = toggleFilterIcon(c, 'flag');
    c = toggleFilterAttribute(c, '優先度', '高');
    expect(isMapFilterActive(c)).toBe(true);
    expect(countActiveFilterConditions(c)).toBe(3);

    c = toggleFilterColor(c, 'rose');
    expect(c.colorPresetIds).toEqual([]);
    expect(countActiveFilterConditions(c)).toBe(2);
  });

  it('matches across categories with AND and within categories with OR, tracking ancestors and folded matches', () => {
    let criteria = toggleFilterIcon(EMPTY_MAP_FILTER, 'flag');
    criteria = toggleFilterAttribute(criteria, 'ステータス', '進行中');

    const res = evaluateMapFilter(root, criteria);
    expect(res.isActive).toBe(true);
    expect(res.matchedNodeIds).toEqual(['n_visible', 'n_hidden']);
    expect(res.highlightPathIdSet.has('root')).toBe(true);
    expect(res.highlightPathIdSet.has('n_folded')).toBe(true);
    expect(res.highlightPathIdSet.has('n_other')).toBe(false);
    expect(res.hiddenMatchCounts.get('n_folded')).toBe(1);

    // Adding color filter narrows down to n_visible only
    const narrowed = evaluateMapFilter(root, toggleFilterColor(criteria, 'rose'));
    expect(narrowed.matchedNodeIds).toEqual(['n_visible']);
    expect(narrowed.hiddenMatchCounts.size).toBe(0);
  });
});

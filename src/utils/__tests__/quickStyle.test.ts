import { describe, it, expect } from 'vitest';
import { parseFreeMindXml } from '../../parser/freemindParser';
import { serializeFreeMindXml } from '../../parser/freemindSerializer';
import type { FreeMindMap, FreeMindNode } from '../../types/freemind';
import {
  applyQuickColorToNodes,
  clearColorOnNodes,
  clearIconsOnNodes,
  contrastRatio,
  findMatchingColorPreset,
  getDigitFromKeyboardEvent,
  NODE_ICONS,
  QUICK_COLOR_PRESETS,
  QUICK_ICON_PRESETS,
  resolveNodeDisplayColors,
  toggleAttributeOnNodes,
  toggleIconOnNodes,
} from '../quickStyle';

function makeNode(id: string, text: string): FreeMindNode {
  return {
    id,
    text,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children: [],
  };
}

describe('quickStyle utilities', () => {
  it('ensures all quick color presets meet WCAG AAA contrast (>= 7.0) in both light and dark modes', () => {
    for (const preset of QUICK_COLOR_PRESETS) {
      expect(contrastRatio(preset.color, preset.bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(preset.darkColor, preset.darkBg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('resolves display colors for dark mode and adjusts bright FreeMind custom backgrounds', () => {
    const preset = QUICK_COLOR_PRESETS[0];
    const presetNode = makeNode('n1', 'Important');
    applyQuickColorToNodes([presetNode], preset);

    expect(findMatchingColorPreset(presetNode)?.id).toBe(preset.id);
    expect(resolveNodeDisplayColors(presetNode, false)).toEqual({
      color: preset.color,
      backgroundColor: preset.bg,
    });
    expect(resolveNodeDisplayColors(presetNode, true)).toEqual({
      color: preset.darkColor,
      backgroundColor: preset.darkBg,
      borderColor: preset.darkBorder,
    });

    const bgOnlyNode = makeNode('n2', 'External light bg');
    bgOnlyNode.backgroundColor = '#fef08a';
    expect(resolveNodeDisplayColors(bgOnlyNode, true)).toEqual({
      backgroundColor: '#fef08a',
      color: '#0f172a',
    });

    const darkTextOnlyNode = makeNode('n3', 'Dark text only');
    darkTextOnlyNode.color = '#111827';
    expect(resolveNodeDisplayColors(darkTextOnlyNode, true)).toEqual({
      color: '#e2e8f0',
    });
  });

  it('applies, toggles, and clears quick colors across single and multiple nodes', () => {
    const a = makeNode('a', 'Node A');
    const b = makeNode('b', 'Node B');
    const rose = QUICK_COLOR_PRESETS[0];
    const sky = QUICK_COLOR_PRESETS[3];

    expect(applyQuickColorToNodes([a, b], rose)).toBe(true);
    expect(a.backgroundColor).toBe(rose.bg);
    expect(b.color).toBe(rose.color);

    // Re-applying same preset to all matching nodes toggles it off
    expect(applyQuickColorToNodes([a, b], rose)).toBe(true);
    expect(a.backgroundColor).toBeUndefined();
    expect(b.color).toBeUndefined();

    // Mixed selection applies preset uniformly
    applyQuickColorToNodes([a], sky);
    expect(applyQuickColorToNodes([a, b], sky)).toBe(true);
    expect(b.backgroundColor).toBe(sky.bg);

    expect(clearColorOnNodes([a, b])).toBe(true);
    expect(a.backgroundColor).toBeUndefined();
    expect(b.color).toBeUndefined();
    expect(clearColorOnNodes([a, b])).toBe(false);
  });

  it('toggles and clears FreeMind icons across multiple nodes', () => {
    const a = makeNode('a', 'A');
    const b = makeNode('b', 'B');
    a.icons = [{ builtin: 'star' }];

    // Mixed selection adds missing icon without duplicating existing one
    expect(toggleIconOnNodes([a, b], 'star')).toBe(true);
    expect(a.icons).toEqual([{ builtin: 'star' }]);
    expect(b.icons).toEqual([{ builtin: 'star' }]);

    // When all selected nodes have the icon, toggling removes it from all
    expect(toggleIconOnNodes([a, b], 'star')).toBe(true);
    expect(a.icons).toEqual([]);
    expect(b.icons).toEqual([]);

    toggleIconOnNodes([a], 'idea');
    expect(clearIconsOnNodes([a, b])).toBe(true);
    expect(a.icons).toEqual([]);
    expect(clearIconsOnNodes([a, b])).toBe(false);
  });

  it('replaces, toggles off, and preserves FreeMind attributes across nodes', () => {
    const a = makeNode('a', 'A');
    const b = makeNode('b', 'B');
    a.attributes = [{ name: '優先度', value: '低' }];

    expect(toggleAttributeOnNodes([a, b], '優先度', '高')).toBe(true);
    expect(a.attributes).toEqual([{ name: '優先度', value: '高' }]);
    expect(b.attributes).toEqual([{ name: '優先度', value: '高' }]);

    // Same name + value on all nodes toggles it off
    expect(toggleAttributeOnNodes([a, b], '優先度', '高')).toBe(true);
    expect(a.attributes).toEqual([]);
    expect(b.attributes).toEqual([]);
  });

  it('extracts digits cleanly from KeyboardEvent codes', () => {
    expect(getDigitFromKeyboardEvent({ code: 'Digit3', key: '3' })).toBe('3');
    expect(getDigitFromKeyboardEvent({ code: 'Numpad0', key: '0' })).toBe('0');
    expect(getDigitFromKeyboardEvent({ code: 'KeyQ', key: 'q' })).toBeNull();
  });

  it('aligns QUICK_ICON_PRESETS with the first 9 NODE_ICONS in exact order', () => {
    expect(QUICK_ICON_PRESETS).toHaveLength(9);
    expect(QUICK_ICON_PRESETS).toEqual(NODE_ICONS.slice(0, 9));
    expect(QUICK_ICON_PRESETS.map(ic => ic.key)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);
  });

  it('round-trips applied colors, icons, and attributes in FreeMind 1.0.1 XML', () => {
    const root = makeNode('root', 'Root');
    const child = makeNode('c1', 'Task');
    applyQuickColorToNodes([child], QUICK_COLOR_PRESETS[2]);
    toggleIconOnNodes([child], 'button_ok');
    toggleAttributeOnNodes([child], 'ステータス', '完了');
    root.children = [child];

    const map: FreeMindMap = { version: '1.0.1', root };
    const xml = serializeFreeMindXml(map);
    const parsed = parseFreeMindXml(xml);
    const parsedChild = parsed.root.children[0];

    expect(parsedChild.backgroundColor).toBe(QUICK_COLOR_PRESETS[2].bg);
    expect(parsedChild.color).toBe(QUICK_COLOR_PRESETS[2].color);
    expect(parsedChild.icons).toEqual([{ builtin: 'button_ok' }]);
    expect(parsedChild.attributes).toEqual([{ name: 'ステータス', value: '完了' }]);
  });
});

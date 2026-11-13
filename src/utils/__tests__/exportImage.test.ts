import { describe, it, expect } from 'vitest';
import { buildMindMapSvg, computeMapBounds } from '../exportImage';
import { computeLayout } from '../layout';
import { FreeMindNode } from '../../types/freemind';

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

describe('exportImage utilities', () => {
  it('computes bounds enclosing all nodes and clouds', () => {
    const child = makeNode('c1', 'Child & <Special>');
    child.cloud = { color: '#e0f2fe' };
    const root = makeNode('root', 'Root Topic', [child]);

    const { layoutNodes, clouds } = computeLayout(root);
    const bounds = computeMapBounds(layoutNodes, clouds);

    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    for (const lNode of layoutNodes.values()) {
      expect(bounds.minX).toBeLessThanOrEqual(lNode.x - lNode.width / 2);
      expect(bounds.maxX).toBeGreaterThanOrEqual(lNode.x + lNode.width / 2);
    }
    for (const c of clouds) {
      expect(bounds.minX).toBeLessThan(c.x);
      expect(bounds.maxX).toBeGreaterThan(c.x + c.width);
    }
  });

  it('builds a valid standalone SVG with light/dark theme colors and escaped text', () => {
    const child = makeNode('c1', 'Item <A> & "B"');
    child.icons = [{ builtin: 'idea' }];
    child.cloud = { color: '#dcfce7' };
    const root = makeNode('root', 'Main Map', [child]);

    const light = buildMindMapSvg(root, { isDarkMode: false });
    expect(light.svg.startsWith('<svg ')).toBe(true);
    expect(light.svg).toContain('#f8fafc');
    expect(light.svg).toContain('Item &lt;A&gt; &amp; &quot;B&quot;');
    expect(light.svg).toContain('💡');
    expect(light.svg).toContain('#dcfce7');
    expect(light.svg.endsWith('</svg>')).toBe(true);

    const dark = buildMindMapSvg(root, { isDarkMode: true });
    expect(dark.svg).toContain('#0f172a');
    expect(dark.width).toBe(light.width);
    expect(dark.height).toBe(light.height);
  });
});


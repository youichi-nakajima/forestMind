import { describe, it, expect } from 'vitest';
import { computeLayout } from '../layout';
import { FreeMindNode } from '../../types/freemind';

function makeNode(
  id: string,
  text: string,
  children: FreeMindNode[] = [],
  cloudColor?: string
): FreeMindNode {
  return {
    id,
    text,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children,
    ...(cloudColor !== undefined ? { cloud: { color: cloudColor } } : {}),
  };
}

describe('layout: fluffy clouds & nested cloud distinction', () => {
  it('generates a scalloped SVG path for a single cloud', () => {
    const grandchild = makeNode('gc1', 'Grandchild');
    const child = makeNode('c1', 'Child', [grandchild], '#e0f2fe');
    const root = makeNode('root', 'Root', [child]);

    const { clouds } = computeLayout(root);
    expect(clouds).toHaveLength(1);

    const cloud = clouds[0];
    expect(cloud.id).toBe('c1');
    expect(cloud.nestingLevel).toBe(0);
    expect(cloud.d.startsWith('M ')).toBe(true);
    expect(cloud.d).toContain(' C ');
    expect(cloud.d.endsWith(' Z')).toBe(true);
    expect(cloud.strokeColor).toBeTruthy();
  });

  it('orders outer clouds before inner clouds and strictly encloses inner cloud bounds', () => {
    const grandchild = makeNode('gc1', 'Grandchild', [], undefined);
    const child = makeNode('c1', 'Child', [grandchild], '#e0f2fe');
    const parent = makeNode('p1', 'Parent', [child], '#e0f2fe');
    const root = makeNode('root', 'Root', [parent]);

    const { clouds } = computeLayout(root);
    expect(clouds).toHaveLength(2);

    const [outer, inner] = clouds;
    expect(outer.id).toBe('p1');
    expect(inner.id).toBe('c1');
    expect(outer.nestingLevel).toBe(0);
    expect(inner.nestingLevel).toBe(1);

    // Outer cloud strictly encloses inner cloud on all 4 sides
    expect(outer.x).toBeLessThan(inner.x);
    expect(outer.y).toBeLessThan(inner.y);
    expect(outer.x + outer.width).toBeGreaterThan(inner.x + inner.width);
    expect(outer.y + outer.height).toBeGreaterThan(inner.y + inner.height);
  });

  it('automatically differentiates nested cloud colors when parent and child share the same color', () => {
    const grandchild = makeNode('gc1', 'Grandchild');
    const child = makeNode('c1', 'Child', [grandchild], '#e0f2fe');
    const parent = makeNode('p1', 'Parent', [child], '#e0f2fe');
    const root = makeNode('root', 'Root', [parent]);

    const { clouds } = computeLayout(root);
    const [outer, inner] = clouds;

    expect(outer.color.toLowerCase()).toBe('#e0f2fe');
    expect(inner.color.toLowerCase()).not.toBe(outer.color.toLowerCase());
    expect(inner.strokeColor).not.toBe(outer.strokeColor);
  });
});


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

  it('shapes directional clouds as a trapezoid narrower at the parent side than the descendant side', () => {
    const gc1 = makeNode('gc1', 'Grandchild 1');
    const gc2 = makeNode('gc2', 'Grandchild 2');
    const gc3 = makeNode('gc3', 'Grandchild 3');
    const cRight = makeNode('cr', 'Right Parent', [gc1, gc2, gc3], '#e0f2fe');
    const gc4 = makeNode('gc4', 'Grandchild 4');
    const gc5 = makeNode('gc5', 'Grandchild 5');
    const gc6 = makeNode('gc6', 'Grandchild 6');
    const cLeft = makeNode('cl', 'Left Parent', [gc4, gc5, gc6], '#dcfce7');
    cLeft.position = 'left';
    cRight.position = 'right';
    const root = makeNode('root', 'Root', [cRight, cLeft]);

    const { clouds, layoutNodes } = computeLayout(root);
    const rightCloud = clouds.find(c => c.id === 'cr')!;
    const leftCloud = clouds.find(c => c.id === 'cl')!;
    expect(rightCloud).toBeDefined();
    expect(leftCloud).toBeDefined();

    // Parse all endpoint coordinates (M x y / C ... x y) from the SVG path
    const extractPoints = (d: string) => {
      const pts: Array<{ x: number; y: number }> = [];
      const tokens = d.match(/[MC]|-?\d+(?:\.\d+)?/g) || [];
      let i = 0;
      while (i < tokens.length) {
        if (tokens[i] === 'M') {
          pts.push({ x: parseFloat(tokens[i + 1]), y: parseFloat(tokens[i + 2]) });
          i += 3;
        } else if (tokens[i] === 'C') {
          pts.push({ x: parseFloat(tokens[i + 5]), y: parseFloat(tokens[i + 6]) });
          i += 7;
        } else {
          i += 1;
        }
      }
      return pts;
    };

    const spanY = (pts: Array<{ x: number; y: number }>) => {
      const ys = pts.map(p => p.y);
      return Math.max(...ys) - Math.min(...ys);
    };

    // Right-expanding cloud: parent side (left) is narrower than descendant side (right)
    const rParent = layoutNodes.get('cr')!;
    const rPts = extractPoints(rightCloud.d);
    const rParentSide = rPts.filter(p => p.x <= rParent.x);
    const rDescSide = rPts.filter(p => p.x >= rParent.x + rParent.width / 2 + 40);
    expect(rParentSide.length).toBeGreaterThan(0);
    expect(rDescSide.length).toBeGreaterThan(0);
    expect(spanY(rParentSide)).toBeLessThan(spanY(rDescSide) * 0.75);

    // Left-expanding cloud: parent side (right) is narrower than descendant side (left)
    const lParent = layoutNodes.get('cl')!;
    const lPts = extractPoints(leftCloud.d);
    const lParentSide = lPts.filter(p => p.x >= lParent.x);
    const lDescSide = lPts.filter(p => p.x <= lParent.x - lParent.width / 2 - 40);
    expect(lParentSide.length).toBeGreaterThan(0);
    expect(lDescSide.length).toBeGreaterThan(0);
    expect(spanY(lParentSide)).toBeLessThan(spanY(lDescSide) * 0.75);
  });

  it('reserves padding for expanded portal containers so sibling portals never overlap and keeps left portals left-aligned', () => {
    const portalA = makeNode('portalA', 'Portal Entry A', [
      makeNode('pa_1', 'A Child 1'),
      makeNode('pa_2', 'A Child 2'),
    ]);
    const hostA: FreeMindNode = {
      ...makeNode('hostA', 'Host A', [portalA]),
      position: 'right',
      link: './a.mm',
    };

    const portalB = makeNode('portalB', 'Portal Entry B', [
      makeNode('pb_1', 'B Child 1'),
      makeNode('pb_2', 'B Child 2'),
    ]);
    const hostB: FreeMindNode = {
      ...makeNode('hostB', 'Host B', [portalB]),
      position: 'right',
      link: './b.mm',
    };

    const portalL = makeNode('portalL', 'Portal Entry Left', [makeNode('pl_1', 'L Child')]);
    const hostLeft: FreeMindNode = {
      ...makeNode('hostLeft', 'Host Left', [portalL]),
      position: 'left',
      link: './left.mm',
    };

    const root = makeNode('root', 'Root', [hostA, hostB, hostLeft]);
    const portalEntryIds = new Set(['portalA', 'portalB', 'portalL']);
    const { layoutNodes } = computeLayout(root, { portalEntryIds });

    const getPortalBox = (ids: string[], side: 'left' | 'right') => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const id of ids) {
        const l = layoutNodes.get(id)!;
        minX = Math.min(minX, l.x - l.width / 2);
        maxX = Math.max(maxX, l.x + l.width / 2);
        minY = Math.min(minY, l.y - l.height / 2);
        maxY = Math.max(maxY, l.y + l.height / 2);
      }
      const width = Math.max(240, maxX - minX + 32);
      const x = side === 'left' ? maxX + 16 - width : minX - 16;
      return {
        x,
        y: minY - 38,
        width,
        height: maxY - minY + 54,
      };
    };

    const boxA = getPortalBox(['portalA', 'pa_1', 'pa_2'], 'right');
    const boxB = getPortalBox(['portalB', 'pb_1', 'pb_2'], 'right');
    // Strictly separated vertically including header badge & bottom padding
    expect(boxB.y).toBeGreaterThan(boxA.y + boxA.height);

    const lHostLeft = layoutNodes.get('hostLeft')!;
    const boxL = getPortalBox(['portalL', 'pl_1'], 'left');
    // Left-side portal container stays completely to the left of its host node
    expect(boxL.x + boxL.width).toBeLessThan(lHostLeft.x - lHostLeft.width / 2);
  });
});


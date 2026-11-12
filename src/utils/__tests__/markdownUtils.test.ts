import { describe, it, expect } from 'vitest';
import { serializeSubtreeToMarkdown, parseMarkdownToSubtree } from '../markdownUtils';
import { FreeMindNode } from '../../types/freemind';

describe('markdownUtils', () => {
  it('serializes a tree to markdown outline', () => {
    const node: FreeMindNode = {
      id: 'root',
      text: 'Main Idea',
      icons: [],
      attributes: [],
      arrowLinks: [],
      hooks: [],
      children: [
        {
          id: 'c1',
          text: 'Topic A',
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: [
            {
              id: 'c1_1',
              text: 'Detail 1',
              icons: [],
              attributes: [],
              arrowLinks: [],
              hooks: [],
              children: [],
            },
          ],
        },
        {
          id: 'c2',
          text: 'Topic B',
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: [],
        },
      ],
    };

    const md = serializeSubtreeToMarkdown(node);
    expect(md).toContain('- Main Idea');
    expect(md).toContain('  - Topic A');
    expect(md).toContain('    - Detail 1');
    expect(md).toContain('  - Topic B');
  });

  it('parses bullet lists into hierarchical nodes', () => {
    const input = `- Item 1\n  - Sub 1.1\n  - Sub 1.2\n- Item 2`;
    const nodes = parseMarkdownToSubtree(input, 'right');

    expect(nodes.length).toBe(2);
    expect(nodes[0].text).toBe('Item 1');
    expect(nodes[0].position).toBe('right');
    expect(nodes[0].children.length).toBe(2);
    expect(nodes[0].children[0].text).toBe('Sub 1.1');
    expect(nodes[0].children[1].text).toBe('Sub 1.2');
    expect(nodes[1].text).toBe('Item 2');
  });

  it('parses single line text', () => {
    const nodes = parseMarkdownToSubtree('Quick single thought');
    expect(nodes.length).toBe(1);
    expect(nodes[0].text).toBe('Quick single thought');
  });
});


import { describe, expect, it } from 'vitest';
import { buildNodeLinkText, parseForestMindLink } from '../nodeLinks';

describe('nodeLinks', () => {
  it('parses forest:// links with and without #NODE_ID fragments', () => {
    expect(parseForestMindLink('forest://tab_123')).toEqual({
      kind: 'forest',
      tabId: 'tab_123',
    });
    expect(parseForestMindLink('forest://tab_123#ID_456')).toEqual({
      kind: 'forest',
      tabId: 'tab_123',
      nodeId: 'ID_456',
    });
  });

  it('parses relative and absolute .mm / .md file links with #NODE_ID fragments', () => {
    expect(parseForestMindLink('./sub/project.mm#ID_NODE_1')).toEqual({
      kind: 'file',
      filePath: './sub/project.mm',
      nodeId: 'ID_NODE_1',
    });
    expect(parseForestMindLink('C:\\maps\\study.mm#ID_99')).toEqual({
      kind: 'file',
      filePath: 'C:\\maps\\study.mm',
      nodeId: 'ID_99',
    });
    expect(parseForestMindLink('../notes/outline.md')).toEqual({
      kind: 'file',
      filePath: '../notes/outline.md',
      nodeId: undefined,
    });
  });

  it('parses local #NODE_ID links and external URLs', () => {
    expect(parseForestMindLink('#ID_LOCAL')).toEqual({
      kind: 'localNode',
      nodeId: 'ID_LOCAL',
    });
    expect(parseForestMindLink('https://example.com/map.mm#section')).toEqual({
      kind: 'external',
      url: 'https://example.com/map.mm#section',
    });
  });

  it('builds node link strings for saved files and unsaved tabs', () => {
    expect(
      buildNodeLinkText({
        tabId: 'tab_1',
        nodeId: 'ID_42',
        filePath: 'C:\\Users\\demo\\maps\\plan.mm',
      })
    ).toBe('C:/Users/demo/maps/plan.mm#ID_42');

    expect(
      buildNodeLinkText({
        tabId: 'tab_2',
        nodeId: 'ID_7',
      })
    ).toBe('forest://tab_2#ID_7');
  });
});

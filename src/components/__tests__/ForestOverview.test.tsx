import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapTab } from '../../hooks/useMindMap';
import type { FreeMindMap } from '../../types/freemind';
import { ForestOverview } from '../ForestOverview';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeMap(rootId: string, rootText: string, childText: string): FreeMindMap {
  return {
    version: '1.0.1',
    root: {
      id: rootId,
      text: rootText,
      icons: [],
      attributes: [],
      arrowLinks: [],
      hooks: [],
      children: [
        {
          id: `${rootId}_c1`,
          text: childText,
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: [],
        },
      ],
    },
  };
}

describe('ForestOverview', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders forest folders & recent files, lists folder maps, and deduplicates cross-map search', async () => {
    const openMap = makeMap('ID_OPEN', 'Open Project', 'Shared Keyword Alpha');
    const folderOnlyMap = makeMap('ID_DISK', 'Archived Roadmap', 'Shared Keyword Beta');

    const tabs: MapTab[] = [
      {
        id: 'tab_1',
        title: 'Open Project',
        filePath: 'C:\\forest\\open.mm',
        map: openMap,
        past: [],
        future: [],
        selectedNodeId: 'ID_OPEN',
      },
    ];

    const onSelectForestFolder = vi.fn();
    const onOpenRecentFile = vi.fn();
    const onOpenScannedMap = vi.fn();
    const onCloseOverview = vi.fn();

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <ForestOverview
          tabs={tabs}
          activeTabId="tab_1"
          onSelectTabAndNode={vi.fn()}
          onNewTab={vi.fn()}
          onCloseOverview={onCloseOverview}
          recentFiles={[
            {
              filePath: 'C:\\forest\\recent.mm',
              fileName: 'recent.mm',
              lastOpenedAt: 100,
            },
          ]}
          forestFolders={[
            {
              folderPath: 'C:\\forest',
              name: 'forest',
              addedAt: 50,
            },
          ]}
          activeForestFolder={{
            folderPath: 'C:\\forest',
            name: 'forest',
            scannedAt: 200,
            files: [
              {
                filePath: 'C:\\forest\\open.mm',
                fileName: 'open.mm',
                relativePath: '.',
                map: openMap,
                fileSize: 100,
              },
              {
                filePath: 'C:\\forest\\roadmap.mm',
                fileName: 'roadmap.mm',
                relativePath: 'sub',
                map: folderOnlyMap,
                fileSize: 120,
              },
            ],
          }}
          onPickAndAddForestFolder={vi.fn()}
          onSelectForestFolder={onSelectForestFolder}
          onOpenRecentFile={onOpenRecentFile}
          onOpenScannedMap={onOpenScannedMap}
        />
      );
    });

    const folderBtn = container.querySelector<HTMLButtonElement>('button.forest-folder-chip-main');
    expect(folderBtn?.textContent).toContain('forest');
    await act(async () => {
      folderBtn?.click();
    });
    expect(onSelectForestFolder).toHaveBeenCalledWith('C:\\forest');

    const recentBtn = container.querySelector<HTMLButtonElement>('button.forest-recent-chip-main');
    expect(recentBtn?.textContent).toContain('recent.mm');
    await act(async () => {
      recentBtn?.click();
    });
    expect(onOpenRecentFile).toHaveBeenCalledWith('C:\\forest\\recent.mm');

    expect(container.textContent).toContain('📁 forest 内のマップ');
    expect(container.textContent).toContain('Archived Roadmap');
    expect(container.textContent).toContain('開いています');

    const searchInput = container.querySelector<HTMLInputElement>('input.forest-search-input')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(searchInput, 'Shared Keyword');
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Open tab appears once + folder-only file appears once = 2 (no duplicate for open.mm)
    const resultCards = container.querySelectorAll('.search-result-card');
    expect(resultCards).toHaveLength(2);

    await act(async () => {
      (resultCards[1] as HTMLElement).click();
    });
    expect(onOpenScannedMap).toHaveBeenCalledWith(
      folderOnlyMap,
      'Archived Roadmap',
      'ID_DISK_c1',
      'C:\\forest\\roadmap.mm'
    );
    expect(onCloseOverview).toHaveBeenCalled();
  });

  it('switches to Forest Knowledge Graph view, toggles season colors, inspects links, and opens selected map', async () => {
    const map1 = makeMap('ID_M1', 'Hub Map', 'Topic 1');
    map1.root.children[0].link = 'forest://tab_2';
    const map2 = makeMap('ID_M2', 'Target Map', 'Topic 2');
    const onSelectTabAndNode = vi.fn();
    const onCloseOverview = vi.fn();

    const tabs: MapTab[] = [
      {
        id: 'tab_1',
        title: 'Hub Map',
        map: map1,
        past: [],
        future: [],
        selectedNodeId: 'ID_M1',
      },
      {
        id: 'tab_2',
        title: 'Target Map',
        map: map2,
        past: [],
        future: [],
        selectedNodeId: 'ID_M2',
      },
    ];

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <ForestOverview
          tabs={tabs}
          activeTabId="tab_1"
          onSelectTabAndNode={onSelectTabAndNode}
          onNewTab={vi.fn()}
          onCloseOverview={onCloseOverview}
        />
      );
    });

    const graphToggle = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.forest-view-toggle-btn')
    ).find(btn => btn.textContent?.includes('ナレッジグラフ'));
    expect(graphToggle).toBeTruthy();

    await act(async () => {
      graphToggle?.click();
    });

    expect(container.querySelector('svg[aria-label="森林ナレッジグラフ"]')).not.toBeNull();
    expect(container.querySelector('.forest-graph-inspector')?.textContent).toContain('Hub Map');
    expect(container.querySelector('.forest-graph-inspector')?.textContent).toContain('Target Map');

    const seasonBtn = container.querySelector<HTMLButtonElement>('.forest-season-toggle-btn');
    expect(seasonBtn?.textContent).toContain('ON');
    await act(async () => {
      seasonBtn?.click();
    });
    expect(seasonBtn?.textContent).toContain('OFF');

    const openBtn = container.querySelector<HTMLButtonElement>('.inspector-open-btn');
    await act(async () => {
      openBtn?.click();
    });
    expect(onSelectTabAndNode).toHaveBeenCalledWith('tab_1', 'ID_M1');
    expect(onCloseOverview).toHaveBeenCalledTimes(1);
  });
});

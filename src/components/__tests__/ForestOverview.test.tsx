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
    ).find(btn => btn.textContent?.includes('俯瞰表示'));
    expect(graphToggle).toBeTruthy();

    await act(async () => {
      graphToggle?.click();
    });

    expect(container.querySelector('svg[aria-label="森林俯瞰表示"]')).not.toBeNull();
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

    // Toggle inspector panel closed & open, and test Fullscreen toggle + Escape exit
    const inspectorBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="詳細パネルを閉じる"]'
    );
    expect(inspectorBtn).not.toBeNull();
    await act(async () => {
      inspectorBtn?.click();
    });
    expect(container.querySelector('.forest-graph-inspector')).toBeNull();

    const fullscreenBtn = container.querySelector<HTMLButtonElement>('.forest-fullscreen-btn');
    expect(fullscreenBtn?.getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      fullscreenBtn?.click();
    });
    expect(container.querySelector('.forest-graph-shell.is-fullscreen')).not.toBeNull();
    expect(fullscreenBtn?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('.forest-graph-shell.is-fullscreen')).toBeNull();

    // Direct entry into graph view via controlled viewMode prop; unrelated map stays undimmed when not hovered,
    // and scope toggle ("関連のみ") filters to Option A connected component + folder clear pill works.
    const unlinkedMap = makeMap('ID_M3', 'Standalone Map', 'Topic 3');
    const onViewModeChange = vi.fn();
    const onClearActiveForestFolder = vi.fn();
    await act(async () => {
      root!.render(
        <ForestOverview
          tabs={[
            ...tabs,
            {
              id: 'tab_3',
              title: 'Standalone Map',
              map: unlinkedMap,
              past: [],
              future: [],
              selectedNodeId: 'ID_M3',
            },
          ]}
          activeTabId="tab_1"
          viewMode="graph"
          onViewModeChange={onViewModeChange}
          activeForestFolder={{
            folderPath: 'C:\\forest',
            name: 'MyForest',
            scannedAt: 500,
            files: [],
          }}
          onClearActiveForestFolder={onClearActiveForestFolder}
          onSelectTabAndNode={onSelectTabAndNode}
          onNewTab={vi.fn()}
          onCloseOverview={onCloseOverview}
        />
      );
    });
    expect(container.querySelector('svg[aria-label="森林俯瞰表示"]')).not.toBeNull();
    expect(container.querySelectorAll('.forest-graph-node')).toHaveLength(3);
    expect(container.querySelectorAll('.forest-graph-node.dimmed')).toHaveLength(0);

    const clearFolderBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="森フォルダの読み込みを解除"]'
    );
    expect(clearFolderBtn).not.toBeNull();
    await act(async () => {
      clearFolderBtn?.click();
    });
    expect(onClearActiveForestFolder).toHaveBeenCalledTimes(1);

    const relatedBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.forest-scope-btn')
    ).find(btn => btn.textContent?.includes('関連のみ'));
    expect(relatedBtn).toBeTruthy();
    await act(async () => {
      relatedBtn?.click();
    });
    expect(container.querySelectorAll('.forest-graph-node')).toHaveLength(2);
  });

  it('triggers trash action from folder cards, saved open-tab cards, and graph inspector without opening cards', async () => {
    const savedMap = makeMap('ID_SAVED', 'Saved Map', 'Child');
    savedMap.root.children[0].link = 'forest://tab_unsaved';
    const unsavedMap = makeMap('ID_UNSAVED', 'Unsaved Map', 'Draft');
    const folderOnlyMap = makeMap('ID_FOLDER', 'Folder Only Map', 'Branch');
    folderOnlyMap.root.children[0].link = '../saved.mm';

    const tabs: MapTab[] = [
      {
        id: 'tab_saved',
        title: 'Saved Map',
        filePath: 'C:\\forest\\saved.mm',
        map: savedMap,
        past: [],
        future: [],
        selectedNodeId: 'ID_SAVED',
      },
      {
        id: 'tab_unsaved',
        title: 'Unsaved Map',
        map: unsavedMap,
        past: [],
        future: [],
        selectedNodeId: 'ID_UNSAVED',
      },
    ];

    const onSelectTabAndNode = vi.fn();
    const onOpenScannedMap = vi.fn();
    const onTrashMapFile = vi.fn();

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <ForestOverview
          tabs={tabs}
          activeTabId="tab_saved"
          onSelectTabAndNode={onSelectTabAndNode}
          onNewTab={vi.fn()}
          onCloseOverview={vi.fn()}
          activeForestFolder={{
            folderPath: 'C:\\forest',
            name: 'forest',
            scannedAt: 1000,
            files: [
              {
                filePath: 'C:\\forest\\saved.mm',
                fileName: 'saved.mm',
                relativePath: '.',
                map: savedMap,
                fileSize: 100,
              },
              {
                filePath: 'C:\\forest\\sub\\folder-only.mm',
                fileName: 'folder-only.mm',
                relativePath: 'sub',
                map: folderOnlyMap,
                fileSize: 100,
              },
            ],
          }}
          onOpenScannedMap={onOpenScannedMap}
          onTrashMapFile={onTrashMapFile}
        />
      );
    });

    // Only folder cards + saved open tab card get trash buttons (unsaved tab does not)
    const trashButtons = container.querySelectorAll<HTMLButtonElement>('.tree-card-trash-btn');
    expect(trashButtons).toHaveLength(3);

    const folderTrashBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Folder Only Map をゴミ箱へ移動"]'
    );
    expect(folderTrashBtn).not.toBeNull();
    await act(async () => {
      folderTrashBtn?.click();
    });
    expect(onTrashMapFile).toHaveBeenCalledWith({
      filePath: 'C:\\forest\\sub\\folder-only.mm',
      title: 'Folder Only Map',
    });
    expect(onOpenScannedMap).not.toHaveBeenCalled();

    const savedTabCardTrashBtn = Array.from(trashButtons).find(btn =>
      btn.getAttribute('aria-label')?.includes('Saved Map') &&
      btn.closest('.forest-cards-grid')?.previousElementSibling?.textContent?.includes('開いているタブ')
    );
    expect(savedTabCardTrashBtn).toBeTruthy();
    await act(async () => {
      savedTabCardTrashBtn?.click();
    });
    expect(onTrashMapFile).toHaveBeenCalledWith({
      filePath: 'C:\\forest\\saved.mm',
      title: 'Saved Map',
    });
    expect(onSelectTabAndNode).not.toHaveBeenCalled();

    // Verify Graph Inspector trash button passes backlinkCount and hides for unsaved tabs
    await act(async () => {
      root!.render(
        <ForestOverview
          tabs={tabs}
          activeTabId="tab_saved"
          viewMode="graph"
          onSelectTabAndNode={onSelectTabAndNode}
          onNewTab={vi.fn()}
          onCloseOverview={vi.fn()}
          activeForestFolder={{
            folderPath: 'C:\\forest',
            name: 'forest',
            scannedAt: 1000,
            files: [
              {
                filePath: 'C:\\forest\\saved.mm',
                fileName: 'saved.mm',
                relativePath: '.',
                map: savedMap,
                fileSize: 100,
              },
              {
                filePath: 'C:\\forest\\sub\\folder-only.mm',
                fileName: 'folder-only.mm',
                relativePath: 'sub',
                map: folderOnlyMap,
                fileSize: 100,
              },
            ],
          }}
          onOpenScannedMap={onOpenScannedMap}
          onTrashMapFile={onTrashMapFile}
        />
      );
    });

    const inspectorTrashBtn = container.querySelector<HTMLButtonElement>('.inspector-trash-btn');
    expect(inspectorTrashBtn).not.toBeNull();
    await act(async () => {
      inspectorTrashBtn?.click();
    });
    expect(onTrashMapFile).toHaveBeenLastCalledWith({
      filePath: 'C:\\forest\\saved.mm',
      title: 'Saved Map',
      backlinkCount: 1,
    });

    // Switch active tab to unsaved tab: inspector trash button should be omitted
    await act(async () => {
      root!.render(
        <ForestOverview
          tabs={[tabs[1]]}
          activeTabId="tab_unsaved"
          viewMode="graph"
          onSelectTabAndNode={onSelectTabAndNode}
          onNewTab={vi.fn()}
          onCloseOverview={vi.fn()}
          onTrashMapFile={onTrashMapFile}
        />
      );
    });
    expect(container.querySelector('.inspector-trash-btn')).toBeNull();
  });
});

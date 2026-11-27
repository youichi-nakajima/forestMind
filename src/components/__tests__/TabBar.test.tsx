import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapTab } from '../../hooks/useMindMap';
import { TabBar } from '../TabBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeTab(id: string, title: string): MapTab {
  return {
    id,
    title,
    map: {
      version: '1.0.1',
      root: {
        id: `${id}_root`,
        text: title,
        icons: [],
        attributes: [],
        arrowLinks: [],
        hooks: [],
        children: [],
      },
    },
    past: [],
    future: [],
    selectedNodeId: `${id}_root`,
  };
}

describe('TabBar', () => {
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
  });

  it('renders single Forest View button without standalone graph tab and triggers related overview from context menu', async () => {
    const onToggleForestView = vi.fn();
    const onOpenTabRelatedOverview = vi.fn();
    const tabs = [makeTab('tab_1', 'Main Map')];

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <TabBar
          tabs={tabs}
          activeTabId="tab_1"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onNewTab={vi.fn()}
          isForestViewOpen={true}
          onToggleForestView={onToggleForestView}
          onOpenTabRelatedOverview={onOpenTabRelatedOverview}
        />
      );
    });

    const cardsBtn = container.querySelector<HTMLButtonElement>('.forest-view-toggle-btn');
    const graphBtn = container.querySelector<HTMLButtonElement>('.forest-graph-quick-btn');
    expect(cardsBtn).not.toBeNull();
    expect(graphBtn).toBeNull();
    expect(cardsBtn?.classList.contains('active')).toBe(true);

    await act(async () => {
      cardsBtn?.click();
    });
    expect(onToggleForestView).toHaveBeenCalledTimes(1);

    const tabItem = container.querySelector<HTMLDivElement>('.tab-item')!;
    await act(async () => {
      tabItem.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 30 })
      );
    });
    const relatedMenuBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.tab-context-menu button')
    ).find(btn => btn.textContent?.includes('このマップの関連を俯瞰表示'));
    expect(relatedMenuBtn).toBeTruthy();

    await act(async () => {
      relatedMenuBtn?.click();
    });
    expect(onOpenTabRelatedOverview).toHaveBeenCalledWith('tab_1');
  });

  it('opens a tab context menu on right-click and shows file trash action only for saved .mm tabs', async () => {
    const savedTab: MapTab = {
      ...makeTab('tab_saved', 'Saved Map'),
      filePath: 'C:\\forest\\saved.mm',
    };
    const unsavedTab = makeTab('tab_unsaved', 'Unsaved Draft');
    const onTrashMapFile = vi.fn();

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <TabBar
          tabs={[savedTab, unsavedTab]}
          activeTabId="tab_saved"
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onNewTab={vi.fn()}
          onTogglePinTab={vi.fn()}
          onTrashMapFile={onTrashMapFile}
        />
      );
    });

    const tabItems = container.querySelectorAll<HTMLDivElement>('.tab-item');
    expect(tabItems).toHaveLength(2);

    // Right-click unsaved tab -> no trash menu item
    await act(async () => {
      tabItems[1].dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 40 })
      );
    });
    let menu = container.querySelector('.tab-context-menu');
    expect(menu).not.toBeNull();
    expect(menu?.textContent).not.toContain('ファイルをゴミ箱へ移動');

    // Escape dismisses menu
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelector('.tab-context-menu')).toBeNull();

    // Right-click saved .mm tab -> shows trash action and triggers callback
    await act(async () => {
      tabItems[0].dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, clientX: 80, clientY: 40 })
      );
    });
    menu = container.querySelector('.tab-context-menu');
    expect(menu).not.toBeNull();
    const trashMenuItem = Array.from(menu!.querySelectorAll<HTMLButtonElement>('button')).find(
      btn => btn.textContent?.includes('ファイルをゴミ箱へ移動')
    );
    expect(trashMenuItem).toBeTruthy();

    await act(async () => {
      trashMenuItem?.click();
    });
    expect(onTrashMapFile).toHaveBeenCalledWith({
      filePath: 'C:\\forest\\saved.mm',
      title: 'Saved Map',
    });
    expect(container.querySelector('.tab-context-menu')).toBeNull();
  });
});

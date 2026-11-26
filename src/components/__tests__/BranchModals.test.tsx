import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapTab } from '../../hooks/useMindMap';
import type { ElectronAPI } from '../../types/electron';
import type { FreeMindNode } from '../../types/freemind';
import { BranchMergeModal } from '../BranchMergeModal';
import { BranchSplitModal } from '../BranchSplitModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

describe('BranchSplitModal & BranchMergeModal', () => {
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
    delete window.electronAPI;
    vi.restoreAllMocks();
  });

  it('BranchSplitModal shows node count, toggles collapse option, and triggers split callbacks', async () => {
    const branch = makeNode('B1', '設計タスク', [makeNode('B1_1', 'API'), makeNode('B1_2', 'DB')]);
    const onConfirmSplit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <BranchSplitModal
          isOpen={true}
          branchNode={branch}
          isElectron={true}
          hasSourceFilePath={true}
          onConfirmSplit={onConfirmSplit}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain('設計タスク');
    expect(container.textContent).toContain('合計 3 ノード');

    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios).toHaveLength(2);
    expect(radios[0].checked).toBe(true);

    await act(async () => {
      radios[1].click();
    });

    const saveSplitBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes('保存先を選んで株分け')
    );
    expect(saveSplitBtn).toBeDefined();
    await act(async () => {
      saveSplitBtn!.click();
      await Promise.resolve();
    });

    expect(onConfirmSplit).toHaveBeenCalledWith({
      collapseToLinkNode: false,
      saveToDisk: true,
    });

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('BranchMergeModal merges from another open tab or a local .mm file', async () => {
    const targetNode = makeNode('TARGET', '統合先ブランチ');
    const otherTab: MapTab = {
      id: 'tab_other',
      title: '別マップ',
      filePath: 'C:\\maps\\other.mm',
      map: {
        version: '1.0.1',
        root: makeNode('R_OTHER', '別マップルート', [makeNode('C_OTHER', '子トピック')]),
      },
      past: [],
      future: [],
      selectedNodeId: 'R_OTHER',
    };

    const onMergeFromTab = vi.fn();
    const onMergeFromFile = vi.fn();

    window.electronAPI = {
      isElectron: true,
      openMmFile: vi.fn().mockResolvedValue({
        filePath: 'C:\\maps\\disk.mm',
        fileName: 'disk.mm',
        content: '<map version="1.0.1"><node ID="ID_D" TEXT="Disk Root"/></map>',
      }),
    } as unknown as ElectronAPI;

    root = createRoot(container);
    await act(async () => {
      root!.render(
        <BranchMergeModal
          isOpen={true}
          targetNode={targetNode}
          otherTabs={[otherTab]}
          isElectron={true}
          onMergeFromTab={onMergeFromTab}
          onMergeFromFile={onMergeFromFile}
          onClose={vi.fn()}
        />
      );
    });

    expect(container.textContent).toContain('統合先ブランチ');
    expect(container.textContent).toContain('別マップルート');

    const includeRootCheckbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(includeRootCheckbox.checked).toBe(true);
    await act(async () => {
      includeRootCheckbox.click();
    });

    const mergeTabBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes('選択したタブを合流')
    );
    await act(async () => {
      mergeTabBtn!.click();
    });
    expect(onMergeFromTab).toHaveBeenCalledWith('tab_other', false);

    const fileMergeBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(b =>
      b.textContent?.includes('ファイルを選択して合流')
    );
    await act(async () => {
      fileMergeBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onMergeFromFile).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({ id: 'ID_D', text: 'Disk Root' }),
      }),
      'Disk Root',
      false
    );
  });
});

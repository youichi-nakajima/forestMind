import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectronAPI } from '../../types/electron';
import { NODE_ICONS } from '../../utils/quickStyle';
import { FreeMindSearcherModal } from '../FreeMindSearcherModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createElectronMock(overrides: Partial<ElectronAPI> = {}): ElectronAPI {
  return {
    isElectron: true,
    getInitialFile: vi.fn().mockResolvedValue(null),
    onOpenFile: vi.fn().mockReturnValue(() => {}),
    openMmFile: vi.fn().mockResolvedValue(null),
    readFileByPath: vi.fn().mockResolvedValue({ ok: false }),
    saveFile: vi.fn().mockResolvedValue({ ok: true }),
    saveMmFileDialog: vi.fn().mockResolvedValue({ canceled: true }),
    pickTargetMmFile: vi.fn().mockResolvedValue(null),
    confirmUnsaved: vi.fn().mockResolvedValue('cancel'),
    onRequestClose: vi.fn().mockReturnValue(() => {}),
    confirmAppClose: vi.fn(),
    ...overrides,
  };
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  descriptor?.set?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('FreeMindSearcherModal', () => {
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

  const renderModal = async (
    overrides: Partial<React.ComponentProps<typeof FreeMindSearcherModal>> = {}
  ) => {
    if (!root) {
      root = createRoot(container);
    }
    const props: React.ComponentProps<typeof FreeMindSearcherModal> = {
      isOpen: true,
      onClose: vi.fn(),
      onOpenMapNode: vi.fn(),
      ...overrides,
    };
    await act(async () => {
      root!.render(<FreeMindSearcherModal {...props} />);
      await Promise.resolve();
    });
    return props;
  };

  it('renders without FreeMindSearcher branding and aligns icon options with NODE_ICONS', async () => {
    await renderModal();

    const heading = container.querySelector('.searcher-modal-header h3');
    expect(heading?.textContent).toBe('ローカルフォルダ横断検索');
    expect(container.textContent).not.toMatch(/FreeMindSearcher/i);

    const iconSelect = container.querySelector<HTMLSelectElement>('select.filter-select-input');
    expect(iconSelect).not.toBeNull();
    const options = Array.from(iconSelect!.options);
    expect(options.map(opt => opt.value)).toEqual(['', ...NODE_ICONS.map(ic => ic.builtin)]);
    expect(options.slice(1).map(opt => opt.textContent)).toEqual(
      NODE_ICONS.map(ic => `${ic.emoji} ${ic.label}`)
    );
  });

  it('scans via Electron IPC, filters reactively by icon, and passes filePath when opening', async () => {
    const sampleXml = `
      <map version="1.0.1">
        <node ID="ID_ROOT" TEXT="Project">
          <node ID="ID_FLAG" TEXT="Critical Task" MODIFIED="1700000000000">
            <icon BUILTIN="flag"/>
          </node>
          <node ID="ID_STAR" TEXT="Starred Idea" MODIFIED="1700000100000">
            <icon BUILTIN="star"/>
          </node>
        </node>
      </map>
    `;
    const scanMmFolder = vi.fn().mockResolvedValue({
      rootDir: 'C:\\Users\\demo\\maps',
      dirName: 'maps',
      files: [
        {
          filePath: 'C:\\Users\\demo\\maps\\sub\\project.mm',
          fileName: 'project.mm',
          relativePath: 'sub',
          xmlContent: sampleXml,
          fileSize: sampleXml.length,
        },
      ],
    });
    window.electronAPI = createElectronMock({ scanMmFolder });

    const props = await renderModal();

    const scanBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(btn =>
      btn.textContent?.includes('フォルダを選択してスキャン')
    );
    expect(scanBtn).toBeDefined();

    await act(async () => {
      scanBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(scanMmFolder).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.scanned-info-pill')?.textContent).toContain(
      'maps 配下の 1 ファイルをスキャン済み'
    );
    expect(container.querySelectorAll('tbody tr.searcher-row')).toHaveLength(3);

    const iconSelect = container.querySelector<HTMLSelectElement>('select.filter-select-input')!;
    await act(async () => {
      setSelectValue(iconSelect, 'flag');
    });

    const filteredRows = container.querySelectorAll('tbody tr.searcher-row');
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].textContent).toContain('Critical Task');

    const openBtn = filteredRows[0].querySelector<HTMLButtonElement>('button.row-open-btn');
    await act(async () => {
      openBtn?.click();
    });

    expect(props.onOpenMapNode).toHaveBeenCalledTimes(1);
    expect(props.onOpenMapNode).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.0.1',
        root: expect.objectContaining({ id: 'ID_ROOT' }),
      }),
      'project',
      'ID_FLAG',
      'C:\\Users\\demo\\maps\\sub\\project.mm'
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows empty-folder feedback instead of initial prompt when scanned folder has zero .mm files', async () => {
    const scanMmFolder = vi.fn().mockResolvedValue({
      rootDir: 'C:\\Users\\demo\\empty-dir',
      dirName: 'empty-dir',
      files: [],
    });
    window.electronAPI = createElectronMock({ scanMmFolder });

    await renderModal();

    const scanBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(btn =>
      btn.textContent?.includes('フォルダを選択してスキャン')
    );
    await act(async () => {
      scanBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.scanned-info-pill')?.textContent).toContain(
      'empty-dir 配下の 0 ファイルをスキャン済み'
    );
    expect(container.textContent).toContain(
      '選択したフォルダ「empty-dir」配下に .mm ファイルは見つかりませんでした。'
    );
    expect(container.textContent).not.toContain('PC上のマインドマップ保管フォルダを選択してください');
  });

  it('scans a registered Forest Folder in 1 click via scanMmFolderByPath and allows registering scanned folder', async () => {
    const sampleXml = `
      <map version="1.0.1">
        <node ID="ID_ROOT" TEXT="Workspace Map">
          <node ID="ID_CHILD" TEXT="Sub Idea"/>
        </node>
      </map>
    `;
    const scanMmFolderByPath = vi.fn().mockResolvedValue({
      ok: true,
      result: {
        rootDir: 'C:\\Users\\demo\\forest',
        dirName: 'forest',
        files: [
          {
            filePath: 'C:\\Users\\demo\\forest\\idea.mm',
            fileName: 'idea.mm',
            relativePath: '.',
            xmlContent: sampleXml,
            fileSize: sampleXml.length,
          },
        ],
      },
      state: {
        recentFiles: [],
        forestFolders: [{ folderPath: 'C:\\Users\\demo\\forest', name: 'forest', addedAt: 1 }],
        lastScannedFolder: 'C:\\Users\\demo\\forest',
      },
    });
    const scanMmFolder = vi.fn().mockResolvedValue({
      rootDir: 'C:\\Users\\demo\\other',
      dirName: 'other',
      files: [
        {
          filePath: 'C:\\Users\\demo\\other\\note.mm',
          fileName: 'note.mm',
          relativePath: '.',
          xmlContent: sampleXml,
          fileSize: sampleXml.length,
        },
      ],
    });
    window.electronAPI = createElectronMock({ scanMmFolder, scanMmFolderByPath });
    const onRegisterForestFolder = vi.fn();

    await renderModal({
      forestFolders: [{ folderPath: 'C:\\Users\\demo\\forest', name: 'forest', addedAt: 1 }],
      onRegisterForestFolder,
    });

    const folderChip = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.searcher-workspace-chip')
    ).find(btn => btn.textContent?.includes('forest'));
    expect(folderChip).toBeDefined();

    await act(async () => {
      folderChip!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(scanMmFolderByPath).toHaveBeenCalledWith('C:\\Users\\demo\\forest');
    expect(container.querySelectorAll('tbody tr.searcher-row')).toHaveLength(2);
    // Already registered, so the "森フォルダに登録" button should be hidden
    expect(container.querySelector('button.searcher-register-folder-btn')).toBeNull();

    const rescanBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(btn =>
      btn.textContent?.includes('フォルダを再選択')
    );
    await act(async () => {
      rescanBtn!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    const registerBtn = container.querySelector<HTMLButtonElement>('button.searcher-register-folder-btn');
    expect(registerBtn).not.toBeNull();
    await act(async () => {
      registerBtn!.click();
    });
    expect(onRegisterForestFolder).toHaveBeenCalledWith('C:\\Users\\demo\\other', 'other');
  });
});

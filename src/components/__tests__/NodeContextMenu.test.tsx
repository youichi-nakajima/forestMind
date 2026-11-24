import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeContextMenu } from '../NodeContextMenu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('NodeContextMenu', () => {
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

  const renderMenu = async (
    overrides: Partial<React.ComponentProps<typeof NodeContextMenu>> = {}
  ) => {
    if (!root) {
      root = createRoot(container);
    }
    const props: React.ComponentProps<typeof NodeContextMenu> = {
      x: 120,
      y: 160,
      nodeText: '設計タスク',
      selectedCount: 1,
      isTrueMapRoot: false,
      isFocusedRoot: false,
      hasChildren: true,
      isFolded: false,
      onAddChild: vi.fn(),
      onAddSibling: vi.fn(),
      onEditText: vi.fn(),
      onToggleFold: vi.fn(),
      onCopy: vi.fn(),
      onCut: vi.fn(),
      onPaste: vi.fn(),
      onDuplicate: vi.fn(),
      onCopyNodeLink: vi.fn(),
      onToggleFocus: vi.fn(),
      onOpenQuickPalette: vi.fn(),
      onOpenProperties: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
    await act(async () => {
      root!.render(<NodeContextMenu {...props} />);
    });
    return props;
  };

  it('triggers link copy, focus, and delete callbacks and closes on click', async () => {
    const props = await renderMenu();

    const findItem = (label: string) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')).find(
        btn => btn.textContent?.includes(label)
      );

    await act(async () => {
      findItem('このノードへのリンクをコピー')?.click();
    });
    expect(props.onCopyNodeLink).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      findItem('このブランチにフォーカス')?.click();
      findItem('削除')?.click();
    });
    expect(props.onToggleFocus).toHaveBeenCalledTimes(1);
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('disables destructive and sibling actions on the true map root', async () => {
    await renderMenu({ isTrueMapRoot: true });

    const findItem = (label: string) =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')).find(
        btn => btn.textContent?.includes(label)
      );

    expect(findItem('兄弟ノードを追加')?.disabled).toBe(true);
    expect(findItem('カット')?.disabled).toBe(true);
    expect(findItem('複製')?.disabled).toBe(true);
    expect(findItem('削除')?.disabled).toBe(true);
    expect(findItem('このノードへのリンクをコピー')?.disabled).toBe(false);
  });

  it('closes on Escape key and outside mousedown', async () => {
    const props = await renderMenu();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});

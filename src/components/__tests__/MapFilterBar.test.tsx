import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MAP_FILTER } from '../../utils/mapFilter';
import { MapFilterBar } from '../MapFilterBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('MapFilterBar', () => {
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

  const renderBar = async (
    overrides: Partial<React.ComponentProps<typeof MapFilterBar>> = {}
  ) => {
    if (!root) {
      root = createRoot(container);
    }
    const props: React.ComponentProps<typeof MapFilterBar> = {
      isOpen: true,
      criteria: EMPTY_MAP_FILTER,
      matchedCount: 0,
      currentMatchIndex: 0,
      isDarkMode: false,
      onToggleColor: vi.fn(),
      onToggleIcon: vi.fn(),
      onToggleAttribute: vi.fn(),
      onPrevMatch: vi.fn(),
      onNextMatch: vi.fn(),
      onClear: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
    await act(async () => {
      root!.render(<MapFilterBar {...props} />);
    });
    return props;
  };

  it('renders nothing when closed', async () => {
    await renderBar({ isOpen: false });
    expect(container.querySelector('.map-filter-bar')).toBeNull();
  });

  it('renders match summary and triggers color/icon/attribute/navigation/clear callbacks', async () => {
    const props = await renderBar({
      criteria: {
        colorPresetIds: ['rose'],
        iconBuiltins: ['flag'],
        attributes: [{ name: 'ステータス', value: '進行中' }],
      },
      matchedCount: 4,
      currentMatchIndex: 1,
    });

    expect(container.querySelector('.map-filter-count')?.textContent).toBe('2/4 件一致');

    const colorBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.quick-color-btn')
    ).find(b => b.textContent === '重要');
    const iconBtn = container.querySelector<HTMLButtonElement>('button[aria-label="注目 (star)"]');
    const attrBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.quick-attr-btn')
    ).find(b => b.textContent === '高');
    const prevBtn = container.querySelector<HTMLButtonElement>('button[aria-label="前の一致へ"]');
    const nextBtn = container.querySelector<HTMLButtonElement>('button[aria-label="次の一致へ"]');
    const clearBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.quick-clear-btn')
    ).find(b => b.textContent?.includes('クリア'));
    const closeBtn = container.querySelector<HTMLButtonElement>(
      'button[aria-label="フィルタを閉じる"]'
    );

    await act(async () => {
      colorBtn?.click();
      iconBtn?.click();
      attrBtn?.click();
      prevBtn?.click();
      nextBtn?.click();
      clearBtn?.click();
      closeBtn?.click();
    });

    expect(props.onToggleColor).toHaveBeenCalledWith('rose');
    expect(props.onToggleIcon).toHaveBeenCalledWith('star');
    expect(props.onToggleAttribute).toHaveBeenCalledWith('優先度', '高');
    expect(props.onPrevMatch).toHaveBeenCalledTimes(1);
    expect(props.onNextMatch).toHaveBeenCalledTimes(1);
    expect(props.onClear).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

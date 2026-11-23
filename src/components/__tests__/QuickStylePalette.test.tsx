import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FreeMindNode } from '../../types/freemind';
import { QUICK_COLOR_PRESETS } from '../../utils/quickStyle';
import { QuickStylePalette } from '../QuickStylePalette';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeNode(id: string, text: string): FreeMindNode {
  return {
    id,
    text,
    icons: [],
    attributes: [],
    arrowLinks: [],
    hooks: [],
    children: [],
  };
}

describe('QuickStylePalette', () => {
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

  const renderPalette = async (
    overrides: Partial<React.ComponentProps<typeof QuickStylePalette>> = {}
  ) => {
    if (!root) {
      root = createRoot(container);
    }
    const props: React.ComponentProps<typeof QuickStylePalette> = {
      isOpen: true,
      selectedNodes: [makeNode('n1', 'テストノード')],
      isDarkMode: false,
      onSelectColor: vi.fn(),
      onClearColor: vi.fn(),
      onToggleIcon: vi.fn(),
      onClearIcons: vi.fn(),
      onToggleAttribute: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
    await act(async () => {
      root!.render(<QuickStylePalette {...props} />);
    });
    return props;
  };

  it('renders nothing when closed', async () => {
    await renderPalette({ isOpen: false });
    expect(container.querySelector('.quick-style-palette')).toBeNull();
  });

  it('displays multi-selection count and active states accurately', async () => {
    const n1 = makeNode('n1', 'Node 1');
    const n2 = makeNode('n2', 'Node 2');
    n1.backgroundColor = QUICK_COLOR_PRESETS[0].bg;
    n1.color = QUICK_COLOR_PRESETS[0].color;
    n2.backgroundColor = QUICK_COLOR_PRESETS[0].bg;
    n2.color = QUICK_COLOR_PRESETS[0].color;
    n1.icons = [{ builtin: 'star' }];
    n2.icons = [{ builtin: 'star' }, { builtin: 'flag' }];
    n1.attributes = [{ name: '優先度', value: '高' }];
    n2.attributes = [{ name: '優先度', value: '高' }];

    await renderPalette({ selectedNodes: [n1, n2] });

    expect(container.textContent).toContain('2ノード選択中');

    const activeColorBtn = container.querySelector('button.quick-color-btn.active');
    expect(activeColorBtn?.textContent).toContain('重要');

    const starBtn = container.querySelector('button[aria-label="注目 (star)"]');
    expect(starBtn?.classList.contains('active')).toBe(true);

    const flagBtn = container.querySelector('button[aria-label="重要 (flag)"]');
    expect(flagBtn?.classList.contains('partial')).toBe(true);

    const highPriorityBtn = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.quick-attr-btn')
    ).find(b => b.textContent === '高');
    expect(highPriorityBtn?.classList.contains('active')).toBe(true);
  });

  it('triggers callbacks for color, clear, icon, attribute, and close actions', async () => {
    const props = await renderPalette();

    const firstColor = container.querySelector<HTMLButtonElement>('button.quick-color-btn');
    const clearColor = container.querySelector<HTMLButtonElement>('button[aria-label="色をクリア"]');
    const ideaIcon = container.querySelector<HTMLButtonElement>('button[aria-label="アイデア (idea)"]');
    const clearIcons = container.querySelector<HTMLButtonElement>(
      'button[aria-label="アイコンをクリア"]'
    );
    const inProgressAttr = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.quick-attr-btn')
    ).find(b => b.textContent === '進行中');
    const closeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]');

    await act(async () => {
      firstColor?.click();
      clearColor?.click();
      ideaIcon?.click();
      clearIcons?.click();
      inProgressAttr?.click();
      closeBtn?.click();
    });

    expect(props.onSelectColor).toHaveBeenCalledWith(QUICK_COLOR_PRESETS[0]);
    expect(props.onClearColor).toHaveBeenCalledTimes(1);
    expect(props.onToggleIcon).toHaveBeenCalledWith('idea');
    expect(props.onClearIcons).toHaveBeenCalledTimes(1);
    expect(props.onToggleAttribute).toHaveBeenCalledWith('ステータス', '進行中');
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

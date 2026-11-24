import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusBreadcrumbBar } from '../FocusBreadcrumbBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('FocusBreadcrumbBar', () => {
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

  it('renders breadcrumbs and invokes root/ancestor/exit callbacks properly', async () => {
    if (!root) {
      root = createRoot(container);
    }
    const onSelectBreadcrumb = vi.fn();
    const onExitFocus = vi.fn();

    await act(async () => {
      root!.render(
        <FocusBreadcrumbBar
          breadcrumbs={[
            { id: 'n_root', text: '全体マップ' },
            { id: 'n_mid', text: '開発' },
            { id: 'n_cur', text: 'UI設計' },
          ]}
          onSelectBreadcrumb={onSelectBreadcrumb}
          onExitFocus={onExitFocus}
        />
      );
    });

    expect(container.querySelector('.focus-crumb-current')?.textContent).toBe('UI設計');
    const crumbBtns = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button.focus-crumb-btn')
    );
    expect(crumbBtns.map(b => b.textContent)).toEqual(['全体マップ', '開発']);

    await act(async () => {
      crumbBtns[1].click();
    });
    expect(onSelectBreadcrumb).toHaveBeenCalledWith('n_mid');

    await act(async () => {
      crumbBtns[0].click();
      container.querySelector<HTMLButtonElement>('button.focus-exit-btn')?.click();
    });
    expect(onExitFocus).toHaveBeenCalledTimes(2);
  });
});

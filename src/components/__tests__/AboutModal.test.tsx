import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectronAPI } from '../../types/electron';
import { AboutModal } from '../AboutModal';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('AboutModal', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;
  let originalClipboardDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
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
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
    } else {
      delete (navigator as { clipboard?: Clipboard }).clipboard;
    }
    vi.restoreAllMocks();
  });

  const renderModal = async (props: {
    isOpen: boolean;
    onClose?: () => void;
    onOpenHelp?: () => void;
  }) => {
    if (!root) {
      root = createRoot(container);
    }
    await act(async () => {
      root!.render(
        <AboutModal
          isOpen={props.isOpen}
          onClose={props.onClose ?? vi.fn()}
          onOpenHelp={props.onOpenHelp}
        />
      );
      await Promise.resolve();
    });
  };

  it('renders nothing when closed', async () => {
    await renderModal({ isOpen: false });
    expect(container.querySelector('.modal-dialog')).toBeNull();
  });

  it('renders version, MIT license, Buy Me a Coffee, and GitHub links when open', async () => {
    await renderModal({ isOpen: true });

    expect(container.textContent).toContain('forestMind');
    expect(container.textContent).toContain('v1.3.0');
    expect(container.textContent).toContain('MIT License');
    expect(container.textContent).toContain('Web ブラウザ');

    const coffeeLink = container.querySelector<HTMLAnchorElement>('a.about-coffee-btn');
    expect(coffeeLink).not.toBeNull();
    expect(coffeeLink?.getAttribute('href')).toBe('https://buymeacoffee.com/youichinakq');
    expect(coffeeLink?.getAttribute('target')).toBe('_blank');
    expect(coffeeLink?.getAttribute('rel')).toBe('noopener noreferrer');

    const githubLink = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.about-link-chip')).find(
      a => a.textContent?.includes('GitHub')
    );
    expect(githubLink?.getAttribute('href')).toBe('https://github.com/youichi-nakajima/forestMind');
    expect(githubLink?.getAttribute('target')).toBe('_blank');
    expect(githubLink?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('calls onClose via close button, backdrop click, and Escape key', async () => {
    const onClose = vi.fn();
    await renderModal({ isOpen: true, onClose });

    const closeBtn = container.querySelector<HTMLButtonElement>('button[aria-label="閉じる"]');
    expect(closeBtn).not.toBeNull();
    await act(async () => {
      closeBtn?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector<HTMLDivElement>('.modal-backdrop');
    await act(async () => {
      backdrop?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('closes modal and triggers onOpenHelp when Help button is clicked', async () => {
    const onClose = vi.fn();
    const onOpenHelp = vi.fn();
    await renderModal({ isOpen: true, onClose, onOpenHelp });

    const helpBtn = container.querySelector<HTMLButtonElement>('button.about-help-btn');
    expect(helpBtn).not.toBeNull();
    await act(async () => {
      helpBtn?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenHelp).toHaveBeenCalledTimes(1);
  });

  it('displays Electron runtime details and copies formatted environment info', async () => {
    const getAppInfo = vi.fn().mockResolvedValue({
      version: '1.3.0',
      electron: '45.3.1',
      chrome: '134.0.0.0',
      node: '22.14.0',
      platform: 'win32',
      arch: 'x64',
    });
    window.electronAPI = {
      isElectron: true,
      getAppInfo,
    } as unknown as ElectronAPI;

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await renderModal({ isOpen: true });

    expect(getAppInfo).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Desktop (Electron 45.3.1 / Windows (x64))');

    const copyBtn = container.querySelector<HTMLButtonElement>('button.about-copy-btn');
    expect(copyBtn).not.toBeNull();
    await act(async () => {
      copyBtn?.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      [
        'forestMind v1.3.0',
        '実行環境: Desktop (Electron 45.3.1 / Chromium 134.0.0.0 / Node 22.14.0)',
        'OS: Windows (x64)',
      ].join('\n')
    );
    expect(copyBtn?.textContent).toContain('コピー済');
  });
});

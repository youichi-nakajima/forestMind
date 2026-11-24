import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronRight,
  Clipboard,
  Copy,
  CopyPlus,
  Focus,
  Link2,
  Palette,
  Pencil,
  Plus,
  Scissors,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

export interface NodeContextMenuExtraItem {
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeText: string;
  selectedCount: number;
  isTrueMapRoot: boolean;
  isFocusedRoot: boolean;
  hasChildren: boolean;
  isFolded: boolean;
  onAddChild: () => void;
  onAddSibling: () => void;
  onEditText: () => void;
  onToggleFold: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onCopyNodeLink: () => void;
  onToggleFocus: () => void;
  onOpenQuickPalette: () => void;
  onOpenProperties: () => void;
  onDelete: () => void;
  extraItems?: NodeContextMenuExtraItem[];
  onClose: () => void;
}

const FALLBACK_MENU_WIDTH = 252;
const FALLBACK_MENU_HEIGHT = 430;
const VIEWPORT_MARGIN = 8;

function clampMenuPosition(
  rawX: number,
  rawY: number,
  width: number,
  height: number
): { left: number; top: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxLeft = Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN);
  return {
    left: Math.max(VIEWPORT_MARGIN, Math.min(rawX, maxLeft)),
    top: Math.max(VIEWPORT_MARGIN, Math.min(rawY, maxTop)),
  };
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x,
  y,
  nodeText,
  selectedCount,
  isTrueMapRoot,
  isFocusedRoot,
  hasChildren,
  isFolded,
  onAddChild,
  onAddSibling,
  onEditText,
  onToggleFold,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onCopyNodeLink,
  onToggleFocus,
  onOpenQuickPalette,
  onOpenProperties,
  onDelete,
  extraItems,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() =>
    clampMenuPosition(x, y, FALLBACK_MENU_WIDTH, FALLBACK_MENU_HEIGHT)
  );

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = rect.width || FALLBACK_MENU_WIDTH;
    const height = rect.height || FALLBACK_MENU_HEIGHT;
    setPosition(clampMenuPosition(x, y, width, height));
  }, [x, y, hasChildren, extraItems?.length]);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    const handleDismiss = () => onClose();

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleDismiss);
    window.addEventListener('blur', handleDismiss);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleDismiss);
      window.removeEventListener('blur', handleDismiss);
    };
  }, [onClose]);

  const runAction = (fn: () => void) => {
    fn();
    onClose();
  };

  const headerLabel =
    selectedCount > 1 ? `${selectedCount}ノード選択中` : nodeText || '(無題ノード)';

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="ノード操作メニュー"
      className="node-context-menu"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="context-menu-header" title={headerLabel}>
        {headerLabel}
      </div>

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => runAction(onAddChild)}
      >
        <Plus size={14} className="context-menu-icon" />
        <span className="context-menu-label">子ノードを追加</span>
        <span className="context-menu-shortcut">Tab</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={isTrueMapRoot || isFocusedRoot}
        className="context-menu-item"
        onClick={() => runAction(onAddSibling)}
      >
        <Plus size={14} className="context-menu-icon" />
        <span className="context-menu-label">兄弟ノードを追加</span>
        <span className="context-menu-shortcut">Enter</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => runAction(onEditText)}
      >
        <Pencil size={14} className="context-menu-icon" />
        <span className="context-menu-label">テキストを編集</span>
        <span className="context-menu-shortcut">F2</span>
      </button>

      {hasChildren && (
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          onClick={() => runAction(onToggleFold)}
        >
          <ChevronRight size={14} className="context-menu-icon" />
          <span className="context-menu-label">
            {isFolded ? '展開する' : '折りたたむ'}
          </span>
          <span className="context-menu-shortcut">Space</span>
        </button>
      )}

      <div className="context-menu-divider" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => runAction(onCopy)}
      >
        <Copy size={14} className="context-menu-icon" />
        <span className="context-menu-label">コピー</span>
        <span className="context-menu-shortcut">Ctrl+C</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={isTrueMapRoot}
        className="context-menu-item"
        onClick={() => runAction(onCut)}
      >
        <Scissors size={14} className="context-menu-icon" />
        <span className="context-menu-label">カット</span>
        <span className="context-menu-shortcut">Ctrl+X</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => runAction(onPaste)}
      >
        <Clipboard size={14} className="context-menu-icon" />
        <span className="context-menu-label">貼り付け</span>
        <span className="context-menu-shortcut">Ctrl+V</span>
      </button>

      <button
        type="button"
        role="menuitem"
        disabled={isTrueMapRoot}
        className="context-menu-item"
        onClick={() => runAction(onDuplicate)}
      >
        <CopyPlus size={14} className="context-menu-icon" />
        <span className="context-menu-label">複製</span>
        <span className="context-menu-shortcut">Ctrl+D</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => runAction(onCopyNodeLink)}
      >
        <Link2 size={14} className="context-menu-icon" />
        <span className="context-menu-label">このノードへのリンクをコピー</span>
      </button>

      <div className="context-menu-divider" role="separator" />

      <button
        type="button"
        role="menuitem"
        disabled={isTrueMapRoot && !isFocusedRoot}
        className="context-menu-item"
        onClick={() => runAction(onToggleFocus)}
      >
        <Focus size={14} className="context-menu-icon" />
        <span className="context-menu-label">
          {isFocusedRoot ? 'フォーカスを解除' : 'このブランチにフォーカス'}
        </span>
        <span className="context-menu-shortcut">
          {isFocusedRoot ? 'Esc' : 'Ctrl+Shift+F'}
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => runAction(onOpenQuickPalette)}
      >
        <Palette size={14} className="context-menu-icon" />
        <span className="context-menu-label">クイック装飾</span>
        <span className="context-menu-shortcut">Q</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => runAction(onOpenProperties)}
      >
        <SlidersHorizontal size={14} className="context-menu-icon" />
        <span className="context-menu-label">プロパティを表示</span>
      </button>

      {extraItems && extraItems.length > 0 && (
        <>
          <div className="context-menu-divider" role="separator" />
          {extraItems.map(item => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`context-menu-item ${item.danger ? 'danger' : ''}`}
              onClick={() => runAction(item.onSelect)}
            >
              <span className="context-menu-label">{item.label}</span>
              {item.shortcut && (
                <span className="context-menu-shortcut">{item.shortcut}</span>
              )}
            </button>
          ))}
        </>
      )}

      <div className="context-menu-divider" role="separator" />

      <button
        type="button"
        role="menuitem"
        disabled={isTrueMapRoot}
        className="context-menu-item danger"
        onClick={() => runAction(onDelete)}
      >
        <Trash2 size={14} className="context-menu-icon" />
        <span className="context-menu-label">削除</span>
        <span className="context-menu-shortcut">Del</span>
      </button>
    </div>
  );
};

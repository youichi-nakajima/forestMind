import React, { useEffect, useRef, useState } from 'react';
import { MapTab } from '../hooks/useMindMap';
import { Plus, X, FileSpreadsheet, Trees, Pin, Network, Trash2 } from 'lucide-react';

interface TabBarProps {
  tabs: MapTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onTogglePinTab?: (id: string) => void;
  onReorderTabs?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  isForestViewOpen?: boolean;
  onToggleForestView?: () => void;
  onOpenTabRelatedOverview?: (tabId: string) => void;
  onTrashMapFile?: (target: { filePath: string; title: string }) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onTogglePinTab,
  onReorderTabs,
  isForestViewOpen,
  onToggleForestView,
  onOpenTabRelatedOverview,
  onTrashMapFile,
}) => {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    tabId: string;
    position: 'before' | 'after';
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const contextMenuTab = contextMenu ? tabs.find(t => t.id === contextMenu.tabId) : undefined;

  useEffect(() => {
    if (!contextMenu) return;
    if (!contextMenuTab) {
      setContextMenu(null);
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
    };
    const handleDismiss = () => setContextMenu(null);

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleDismiss);
    window.addEventListener('resize', handleDismiss);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleDismiss);
      window.removeEventListener('resize', handleDismiss);
    };
  }, [contextMenu, contextMenuTab]);

  const draggedTab = draggingTabId ? tabs.find(t => t.id === draggingTabId) : undefined;

  return (
    <div className="tab-bar">
      {onToggleForestView && (
        <button
          type="button"
          className={`forest-view-toggle-btn ${isForestViewOpen ? 'active' : ''}`}
          title="全マップの森林俯瞰ビュー・横断検索を表示"
          onClick={onToggleForestView}
        >
          <Trees size={13} />
          <span>森林ビュー</span>
        </button>
      )}
      <div
        className="tab-list"
        onDragLeave={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setDropIndicator(null);
          }
        }}
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId && !isForestViewOpen;
          const title = tab.map.root.text || tab.title || '無題マップ';
          const isDirty = Boolean(tab.isDirty);
          const isPinned = Boolean(tab.isPinned);
          const isDragging = draggingTabId === tab.id;
          const isDropBefore =
            dropIndicator?.tabId === tab.id && dropIndicator.position === 'before';
          const isDropAfter =
            dropIndicator?.tabId === tab.id && dropIndicator.position === 'after';
          const showPinnedDivider =
            isPinned && idx < tabs.length - 1 && !tabs[idx + 1]?.isPinned;

          return (
            <React.Fragment key={tab.id}>
              <div
                className={`tab-item ${isActive ? 'active' : ''} ${
                  isPinned ? 'pinned' : ''
                } ${isDragging ? 'dragging' : ''} ${
                  isDropBefore ? 'drop-before' : ''
                } ${isDropAfter ? 'drop-after' : ''}`}
                draggable={Boolean(onReorderTabs) && tabs.length > 1}
                onClick={() => onSelectTab(tab.id)}
                onContextMenu={e => {
                  e.preventDefault();
                  setContextMenu({ tabId: tab.id, x: e.clientX, y: e.clientY });
                }}
                onDragStart={e => {
                  if (!onReorderTabs || tabs.length <= 1) return;
                  setDraggingTabId(tab.id);
                  setDropIndicator(null);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('application/x-forestmind-tab', tab.id);
                }}
                onDragOver={e => {
                  if (!onReorderTabs || !draggingTabId || draggingTabId === tab.id) {
                    if (dropIndicator) setDropIndicator(null);
                    return;
                  }
                  if (!draggedTab || Boolean(draggedTab.isPinned) !== isPinned) {
                    if (dropIndicator) setDropIndicator(null);
                    return;
                  }
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const position: 'before' | 'after' =
                    e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                  if (
                    !dropIndicator ||
                    dropIndicator.tabId !== tab.id ||
                    dropIndicator.position !== position
                  ) {
                    setDropIndicator({ tabId: tab.id, position });
                  }
                }}
                onDrop={e => {
                  const sourceId =
                    draggingTabId || e.dataTransfer.getData('application/x-forestmind-tab');
                  const sourceTab = sourceId ? tabs.find(t => t.id === sourceId) : undefined;
                  if (
                    onReorderTabs &&
                    sourceId &&
                    sourceId !== tab.id &&
                    sourceTab &&
                    Boolean(sourceTab.isPinned) === isPinned
                  ) {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const position: 'before' | 'after' =
                      e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                    onReorderTabs(sourceId, tab.id, position);
                  }
                  setDraggingTabId(null);
                  setDropIndicator(null);
                }}
                onDragEnd={() => {
                  setDraggingTabId(null);
                  setDropIndicator(null);
                }}
              >
                <button
                  type="button"
                  className={`tab-pin-btn ${isPinned ? 'pinned' : ''}`}
                  draggable={false}
                  title={isPinned ? 'クリックでピン止めを解除' : 'クリックでタブをピン止め（固定）'}
                  aria-label={isPinned ? 'ピン止め解除' : 'タブをピン止め'}
                  onClick={e => {
                    e.stopPropagation();
                    onTogglePinTab?.(tab.id);
                  }}
                >
                  {isPinned ? (
                    <Pin size={13} className="tab-pin-icon" />
                  ) : (
                    <>
                      <FileSpreadsheet size={13} className="tab-icon tab-icon-default" />
                      <Pin size={13} className="tab-icon tab-icon-pin-hover" />
                    </>
                  )}
                </button>
                <span className="tab-title" title={isDirty ? `${title} (未保存)` : title}>
                  {title}
                </span>
                {isDirty && (
                  <span className="tab-dirty" title="未保存の変更があります" aria-label="未保存">
                    *
                  </span>
                )}
                {!isPinned && tabs.length > 1 && (
                  <button
                    type="button"
                    className="tab-close-btn"
                    draggable={false}
                    title="タブを閉じる"
                    onClick={e => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
              {showPinnedDivider && (
                <span className="tab-pinned-divider" aria-hidden="true" />
              )}
            </React.Fragment>
          );
        })}
      </div>
      <button className="tab-new-btn" title="新しいマインドマップを作成" onClick={onNewTab}>
        <Plus size={14} />
      </button>

      {contextMenu && contextMenuTab && (
        <div
          ref={menuRef}
          className="node-context-menu tab-context-menu"
          role="menu"
          aria-label="タブ操作メニュー"
          style={{
            left:
              typeof window !== 'undefined'
                ? Math.max(8, Math.min(contextMenu.x, window.innerWidth - 220))
                : contextMenu.x,
            top:
              typeof window !== 'undefined'
                ? Math.max(8, Math.min(contextMenu.y, window.innerHeight - 160))
                : contextMenu.y,
          }}
        >
          <div className="context-menu-header">
            {contextMenuTab.map.root.text || contextMenuTab.title || '無題マップ'}
          </div>
          {onTogglePinTab && (
            <button
              type="button"
              role="menuitem"
              className="context-menu-item"
              onClick={() => {
                onTogglePinTab(contextMenuTab.id);
                setContextMenu(null);
              }}
            >
              <Pin size={14} className="context-menu-icon" />
              <span className="context-menu-label">
                {contextMenuTab.isPinned ? 'ピン止めを解除' : 'タブをピン止め'}
              </span>
            </button>
          )}
          {onOpenTabRelatedOverview && (
            <button
              type="button"
              role="menuitem"
              className="context-menu-item"
              onClick={() => {
                setContextMenu(null);
                onOpenTabRelatedOverview(contextMenuTab.id);
              }}
            >
              <Network size={14} className="context-menu-icon" />
              <span className="context-menu-label">このマップの関連を俯瞰表示</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="context-menu-item"
            disabled={Boolean(contextMenuTab.isPinned) || tabs.length <= 1}
            onClick={() => {
              onCloseTab(contextMenuTab.id);
              setContextMenu(null);
            }}
          >
            <X size={14} className="context-menu-icon" />
            <span className="context-menu-label">タブを閉じる</span>
          </button>
          {onTrashMapFile &&
            contextMenuTab.filePath &&
            /\.mm$/i.test(contextMenuTab.filePath) && (
              <>
                <div className="context-menu-divider" />
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item danger"
                  onClick={() => {
                    const targetTitle =
                      contextMenuTab.map.root.text || contextMenuTab.title || '無題マップ';
                    setContextMenu(null);
                    onTrashMapFile({
                      filePath: contextMenuTab.filePath!,
                      title: targetTitle,
                    });
                  }}
                >
                  <Trash2 size={14} className="context-menu-icon" />
                  <span className="context-menu-label">ファイルをゴミ箱へ移動</span>
                </button>
              </>
            )}
        </div>
      )}
    </div>
  );
};

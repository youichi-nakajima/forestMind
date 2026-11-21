import React, { useState } from 'react';
import { MapTab } from '../hooks/useMindMap';
import { Plus, X, FileSpreadsheet, Trees, Pin } from 'lucide-react';

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
}) => {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    tabId: string;
    position: 'before' | 'after';
  } | null>(null);

  const draggedTab = draggingTabId ? tabs.find(t => t.id === draggingTabId) : undefined;

  return (
    <div className="tab-bar">
      {onToggleForestView && (
        <button
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
    </div>
  );
};

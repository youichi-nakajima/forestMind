import React from 'react';
import { MapTab } from '../hooks/useMindMap';
import { Plus, X, FileSpreadsheet, Trees } from 'lucide-react';

interface TabBarProps {
  tabs: MapTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  isForestViewOpen?: boolean;
  onToggleForestView?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  isForestViewOpen,
  onToggleForestView,
}) => {
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
      <div className="tab-list">
        {tabs.map(tab => {
          const isActive = tab.id === activeTabId && !isForestViewOpen;
          const title = tab.map.root.text || tab.title || '無題マップ';
          const isDirty = Boolean(tab.isDirty);
          return (
            <div
              key={tab.id}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.id)}
            >
              <FileSpreadsheet size={13} className="tab-icon" />
              <span className="tab-title" title={isDirty ? `${title} (未保存)` : title}>
                {title}
              </span>
              {isDirty && (
                <span className="tab-dirty" title="未保存の変更があります" aria-label="未保存">
                  *
                </span>
              )}
              {tabs.length > 1 && (
                <button
                  className="tab-close-btn"
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
          );
        })}
      </div>
      <button className="tab-new-btn" title="新しいマインドマップを作成" onClick={onNewTab}>
        <Plus size={14} />
      </button>
    </div>
  );
};

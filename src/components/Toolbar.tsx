import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  Download,
  Plus,
  CornerDownRight,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  HelpCircle,
  FileText,
  FolderSearch,
} from 'lucide-react';

interface ToolbarProps {
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  zoomPercent: number;
  onImportXml: (xml: string) => void;
  onImportMarkdown: (md: string) => void;
  onExportXml: () => void;
  onExportMarkdown: () => void;
  onUnfoldAll: () => void;
  onFoldAll: () => void;
  onOpenHelp: () => void;
  onOpenSearcher: () => void;
  onResetToDefault: () => void;
  selectedNodeId: string | null;
  isRootSelected: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResultCount: number;
  currentSearchIndex: number;
  onNextSearch: () => void;
  onPrevSearch: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onAddChild,
  onAddSibling,
  onDelete,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  zoomPercent,
  onImportXml,
  onImportMarkdown,
  onExportXml,
  onExportMarkdown,
  onUnfoldAll,
  onFoldAll,
  onOpenHelp,
  onOpenSearcher,
  onResetToDefault,
  selectedNodeId,
  isRootSelected,
  searchQuery,
  onSearchChange,
  searchResultCount,
  currentSearchIndex,
  onNextSearch,
  onPrevSearch,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      if (content) {
        if (fileName.endsWith('.md') || fileName.endsWith('.txt')) {
          onImportMarkdown(content);
        } else {
          onImportXml(content);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="toolbar">
      <div className="toolbar-section app-brand">
        <span className="brand-icon">🌲</span>
        <span className="brand-title">forestMind</span>
        <span className="brand-badge">FreeMind 互換</span>
      </div>

      <div className="toolbar-divider" />

      {/* File I/O */}
      <div className="toolbar-group">
        <input
          type="file"
          ref={fileInputRef}
          accept=".mm,.xml,.md,.txt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          className="toolbar-btn"
          title="FreeMind (.mm) または Markdown (.md) ファイルを開く"
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderOpen size={16} />
          <span>開く (.mm / .md)</span>
        </button>

        <div className="export-dropdown-wrapper">
          <button
            className="toolbar-btn"
            title="エクスポート形式を選択"
            onClick={() => setShowExportMenu(prev => !prev)}
          >
            <Download size={16} />
            <span>保存 / 出力 ▾</span>
          </button>
          {showExportMenu && (
            <div className="export-menu" onClick={() => setShowExportMenu(false)}>
              <button className="export-menu-item" onClick={onExportXml}>
                <Download size={14} />
                <div>
                  <strong>FreeMind (.mm)</strong>
                  <p>完全互換XML形式</p>
                </div>
              </button>
              <button className="export-menu-item" onClick={onExportMarkdown}>
                <FileText size={14} />
                <div>
                  <strong>Markdown (.md)</strong>
                  <p>箇条書きアウトライン形式</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Node Operations */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          title="子ノードを追加 (Tab / Insert)"
          disabled={!selectedNodeId}
          onClick={onAddChild}
        >
          <CornerDownRight size={16} />
          <span>子 (Tab)</span>
        </button>
        <button
          className="toolbar-btn"
          title="兄弟ノードを追加 (Enter)"
          disabled={!selectedNodeId || isRootSelected}
          onClick={onAddSibling}
        >
          <Plus size={16} />
          <span>兄弟 (Enter)</span>
        </button>
        <button
          className="toolbar-btn danger"
          title="選択したノードを削除 (Delete / Backspace)"
          disabled={!selectedNodeId || isRootSelected}
          onClick={onDelete}
        >
          <Trash2 size={16} />
          <span>削除</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Fold / Unfold All */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn icon-only"
          title="すべてのノードを展開"
          onClick={onUnfoldAll}
        >
          <ChevronsDown size={16} />
        </button>
        <button
          className="toolbar-btn icon-only"
          title="ルート以外をすべて折りたたむ"
          onClick={onFoldAll}
        >
          <ChevronsUp size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn icon-only"
          title="元に戻す (Ctrl+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={16} />
        </button>
        <button
          className="toolbar-btn icon-only"
          title="やり直し (Ctrl+Y)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Search */}
      <div className="toolbar-search-group">
        <Search size={14} className="search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          className="toolbar-search-input"
          placeholder="マップ内検索 (Ctrl+F)..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              if (e.shiftKey) {
                onPrevSearch();
              } else {
                onNextSearch();
              }
            }
          }}
        />
        {searchQuery && (
          <span className="search-match-count">
            {searchResultCount > 0
              ? `${currentSearchIndex + 1}/${searchResultCount}`
              : '0件'}
          </span>
        )}
        {searchResultCount > 0 && (
          <div className="search-nav-btns">
            <button
              className="search-nav-btn"
              onClick={onPrevSearch}
              title="前の一致へ (Shift+Enter)"
            >
              <ChevronUp size={12} />
            </button>
            <button
              className="search-nav-btn"
              onClick={onNextSearch}
              title="次の一致へ (Enter)"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        )}
      </div>

      <button
        className="toolbar-btn searcher-trigger-btn"
        title="PC上のフォルダ配下の全.mmファイルを再帰探索・検索 (FreeMindSearcher)"
        onClick={onOpenSearcher}
      >
        <FolderSearch size={15} className="searcher-btn-icon" />
        <span>フォルダ横断検索</span>
      </button>

      <div className="toolbar-spacer" />

      {/* Zoom Controls */}
      <div className="toolbar-group">
        <button className="toolbar-btn icon-only" title="ズームアウト" onClick={onZoomOut}>
          <ZoomOut size={16} />
        </button>
        <span className="zoom-text">{Math.round(zoomPercent)}%</span>
        <button className="toolbar-btn icon-only" title="ズームイン" onClick={onZoomIn}>
          <ZoomIn size={16} />
        </button>
        <button className="toolbar-btn icon-only" title="表示リセット (100% / 中央)" onClick={onResetZoom}>
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Help & Sample Reset */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn icon-only"
          title="ショートカット操作ガイド"
          onClick={onOpenHelp}
        >
          <HelpCircle size={16} />
        </button>
        <button
          className="toolbar-btn icon-only secondary"
          title="初期サンプルマップを復元"
          onClick={() => {
            if (confirm('現在のマップ内容を初期サンプルマップで上書きしますか？')) {
              onResetToDefault();
            }
          }}
        >
          <Sparkles size={16} />
        </button>
      </div>
    </header>
  );
};

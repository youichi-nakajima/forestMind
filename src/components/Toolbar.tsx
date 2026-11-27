import React, { useEffect, useRef, useState } from 'react';
import {
  FolderOpen,
  Download,
  Plus,
  Undo2,
  Redo2,
  Sparkles,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  HelpCircle,
  FileText,
  FolderSearch,
  PlayCircle,
  ArrowLeft,
  Sun,
  Moon,
  Image as ImageIcon,
  Palette,
  Filter,
  Focus,
  Clock,
  X,
  Network,
} from 'lucide-react';
import type { RecentFileEntry } from '../types/workspace';

interface ToolbarProps {
  isForestViewOpen?: boolean;
  onCloseForestView?: () => void;
  onOpenRelatedOverview?: () => void;
  onNewTab?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImportXml: (xml: string) => void;
  onImportMarkdown: (md: string) => void;
  onOpenFileDialog?: () => void;
  onSaveDirect?: () => void;
  activeFilePath?: string;
  onExportXml: () => void;
  onExportMarkdown: () => void;
  onExportSvg?: () => void;
  onExportPng?: () => void;
  onUnfoldAll: () => void;
  onFoldAll: () => void;
  onOpenHelp: () => void;
  onOpenAbout?: () => void;
  onOpenSearcher: () => void;
  onResetToDefault: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResultCount: number;
  currentSearchIndex: number;
  onNextSearch: () => void;
  onPrevSearch: () => void;
  isPresentationActive?: boolean;
  onTogglePresentation?: () => void;
  isQuickPaletteOpen?: boolean;
  onToggleQuickPalette?: () => void;
  isFocused?: boolean;
  canFocusSelected?: boolean;
  onToggleFocus?: () => void;
  isFilterBarOpen?: boolean;
  activeFilterCount?: number;
  onToggleFilterBar?: () => void;
  recentFiles?: RecentFileEntry[];
  onOpenRecentFile?: (filePath: string) => void;
  onRemoveRecentFile?: (filePath: string) => void;
  onClearRecentFiles?: () => void;
}

function formatParentDir(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  if (parts.length <= 1) return '';
  parts.pop();
  const dir = parts.join('/');
  return dir.length > 42 ? `.../${parts.slice(-2).join('/')}` : dir;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isForestViewOpen = false,
  onCloseForestView,
  onOpenRelatedOverview,
  onNewTab,
  isDarkMode = false,
  onToggleTheme,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onImportXml,
  onImportMarkdown,
  onOpenFileDialog,
  onSaveDirect,
  activeFilePath,
  onExportXml,
  onExportMarkdown,
  onExportSvg,
  onExportPng,
  onUnfoldAll,
  onFoldAll,
  onOpenHelp,
  onOpenAbout,
  onOpenSearcher,
  onResetToDefault,
  searchQuery,
  onSearchChange,
  searchResultCount,
  currentSearchIndex,
  onNextSearch,
  onPrevSearch,
  isPresentationActive = false,
  onTogglePresentation,
  isQuickPaletteOpen = false,
  onToggleQuickPalette,
  isFocused = false,
  canFocusSelected = false,
  onToggleFocus,
  isFilterBarOpen = false,
  activeFilterCount = 0,
  onToggleFilterBar,
  recentFiles = [],
  onOpenRecentFile,
  onRemoveRecentFile,
  onClearRecentFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const openDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showRecentMenu, setShowRecentMenu] = useState(false);

  useEffect(() => {
    if (!showExportMenu && !showRecentMenu) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        showExportMenu &&
        exportDropdownRef.current &&
        target &&
        !exportDropdownRef.current.contains(target)
      ) {
        setShowExportMenu(false);
      }
      if (
        showRecentMenu &&
        openDropdownRef.current &&
        target &&
        !openDropdownRef.current.contains(target)
      ) {
        setShowRecentMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowExportMenu(false);
        setShowRecentMenu(false);
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showExportMenu, showRecentMenu]);

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

  const renderBrandButton = (badgeLabel?: string, isForestBadge = false) => (
    <button
      type="button"
      className="toolbar-section app-brand app-brand-btn"
      title="forestMind について"
      aria-label="forestMind について"
      onClick={onOpenAbout}
    >
      <span className="brand-icon">🌲</span>
      <span className="brand-title">forestMind</span>
      {badgeLabel && (
        <span className={`brand-badge${isForestBadge ? ' forest-badge' : ''}`}>{badgeLabel}</span>
      )}
    </button>
  );

  const renderOpenControl = (openLabel: string, openTitle: string) => {
    const hasRecent = Boolean(onOpenRecentFile && recentFiles.length > 0);
    return (
      <div ref={openDropdownRef} className="open-dropdown-wrapper">
        <button
          type="button"
          className="toolbar-btn"
          title={openTitle}
          onClick={() => {
            setShowRecentMenu(false);
            setShowExportMenu(false);
            if (onOpenFileDialog) {
              onOpenFileDialog();
            } else {
              fileInputRef.current?.click();
            }
          }}
        >
          <FolderOpen size={16} />
          <span>{openLabel}</span>
        </button>

        {hasRecent && (
          <button
            type="button"
            className={`toolbar-btn icon-only open-recent-toggle-btn ${showRecentMenu ? 'active' : ''}`}
            title="最近使ったファイル"
            aria-label="最近使ったファイル"
            aria-expanded={showRecentMenu}
            onClick={() => {
              setShowRecentMenu(prev => !prev);
              setShowExportMenu(false);
            }}
          >
            <ChevronDown size={13} />
          </button>
        )}

        {showRecentMenu && hasRecent && (
          <div className="recent-files-menu" role="menu" aria-label="最近使ったファイル">
            <div className="recent-files-header">
              <span className="recent-files-heading">
                <Clock size={12} />
                <span>最近使ったファイル</span>
              </span>
              {onClearRecentFiles && (
                <button
                  type="button"
                  className="recent-files-clear-btn"
                  onClick={() => {
                    onClearRecentFiles();
                    setShowRecentMenu(false);
                  }}
                >
                  クリア
                </button>
              )}
            </div>
            <div className="recent-files-list">
              {recentFiles.map(entry => {
                const parentDir = formatParentDir(entry.filePath);
                return (
                  <div key={entry.filePath} className="recent-file-row">
                    <button
                      type="button"
                      role="menuitem"
                      className="recent-file-item"
                      title={entry.filePath}
                      onClick={() => {
                        setShowRecentMenu(false);
                        onOpenRecentFile?.(entry.filePath);
                      }}
                    >
                      <strong className="recent-file-name">{entry.fileName}</strong>
                      {parentDir && <span className="recent-file-dir">{parentDir}</span>}
                    </button>
                    {onRemoveRecentFile && (
                      <button
                        type="button"
                        className="recent-file-remove-btn"
                        title="履歴から除外"
                        aria-label={`${entry.fileName} を履歴から除外`}
                        onClick={e => {
                          e.stopPropagation();
                          onRemoveRecentFile(entry.filePath);
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // Mode A: Forest Overview Toolbar (森林ビュー専用ツールバー)
  // =========================================================================
  if (isForestViewOpen) {
    return (
      <header className="toolbar forest-toolbar">
        {renderBrandButton('森林ビュー', true)}

        <div className="toolbar-divider" />

        {/* Forest-wide actions */}
        <div className="toolbar-group">
          {onNewTab && (
            <button
              className="toolbar-btn primary-action-btn"
              title="新しいマインドマップを作成"
              onClick={onNewTab}
            >
              <Plus size={16} />
              <span>新規マップ</span>
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept=".mm,.xml,.md,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {renderOpenControl(
            'ファイルを開く',
            'FreeMind (.mm) または Markdown (.md) ファイルを開いて森林に追加'
          )}

          <button
            className="toolbar-btn searcher-trigger-btn"
            title="PC上のフォルダ配下の全 .mm ファイルを横断検索"
            onClick={onOpenSearcher}
          >
            <FolderSearch size={15} className="searcher-btn-icon" />
            <span>フォルダ横断検索</span>
          </button>
        </div>

        <div className="toolbar-spacer" />

        {/* Back to Mindmap & Help */}
        <div className="toolbar-group">
          {onCloseForestView && (
            <button
              className="toolbar-btn secondary return-map-btn"
              title="選択中のマインドマップ編集画面に戻る"
              onClick={onCloseForestView}
            >
              <ArrowLeft size={16} />
              <span>マップ編集に戻る</span>
            </button>
          )}

          <div className="toolbar-divider" />

          <button
            className="toolbar-btn icon-only"
            title="ショートカット操作ガイド"
            onClick={onOpenHelp}
          >
            <HelpCircle size={16} />
          </button>
          {onToggleTheme && (
            <button
              className="toolbar-btn icon-only"
              title={isDarkMode ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
              onClick={onToggleTheme}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
        </div>
      </header>
    );
  }

  // =========================================================================
  // Mode B: Individual MindMap Toolbar (個別マインドマップ編集ツールバー)
  // =========================================================================
  return (
    <header className="toolbar">
      {renderBrandButton()}

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
        {renderOpenControl('開く', 'FreeMind (.mm) または Markdown (.md) ファイルを開く')}

        <div ref={exportDropdownRef} className="export-dropdown-wrapper">
          <button
            className="toolbar-btn"
            title="エクスポート形式を選択"
            onClick={() => {
              setShowExportMenu(prev => !prev);
              setShowRecentMenu(false);
            }}
          >
            <Download size={16} />
            <span>保存 ▾</span>
          </button>
          {showExportMenu && (
            <div className="export-menu" onClick={() => setShowExportMenu(false)}>
              {onSaveDirect && (
                <button className="export-menu-item" onClick={onSaveDirect}>
                  <Download size={14} />
                  <div>
                    <strong>{activeFilePath ? '上書き保存 (Ctrl+S)' : 'ファイルに保存 (Ctrl+S)'}</strong>
                    <p>{activeFilePath ? activeFilePath.split(/[\\/]/).pop() : '保存先を選択'}</p>
                  </div>
                </button>
              )}
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
              {onExportPng && (
                <button className="export-menu-item" onClick={onExportPng}>
                  <ImageIcon size={14} />
                  <div>
                    <strong>PNG 画像 (.png)</strong>
                    <p>高解像度画像として保存</p>
                  </div>
                </button>
              )}
              {onExportSvg && (
                <button className="export-menu-item" onClick={onExportSvg}>
                  <ImageIcon size={14} />
                  <div>
                    <strong>SVG 画像 (.svg)</strong>
                    <p>拡大縮小しても劣化しない形式</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Fold / Unfold All & Focus */}
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
        {onToggleFocus && (
          <button
            type="button"
            className={`toolbar-btn icon-only focus-trigger-btn ${isFocused ? 'active' : ''}`}
            disabled={!isFocused && !canFocusSelected}
            title={
              isFocused
                ? 'フォーカス解除 (Esc)'
                : '選択ブランチにフォーカス (Ctrl+Shift+F)'
            }
            aria-label="フォーカスモード切替"
            onClick={onToggleFocus}
          >
            <Focus size={16} />
          </button>
        )}
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

      {/* Quick Style Palette Toggle */}
      {onToggleQuickPalette && (
        <>
          <div className="toolbar-group">
            <button
              className={`toolbar-btn quick-palette-btn ${
                isQuickPaletteOpen ? 'active' : ''
              }`}
              title="クイック色分け・アイコン・タグ (Q / Ctrl+K)"
              onClick={onToggleQuickPalette}
            >
              <Palette size={15} />
              <span>クイック装飾</span>
            </button>
          </div>
          <div className="toolbar-divider" />
        </>
      )}

      {/* Presentation Playback (Mindmap Growth Animation) */}
      {onTogglePresentation && (
        <div className="toolbar-group">
          <button
            className={`toolbar-btn presentation-trigger-btn ${
              isPresentationActive ? 'active' : ''
            }`}
            title="思考の成長・プレゼンテーション自動再生 (F5)"
            onClick={onTogglePresentation}
          >
            <PlayCircle size={15} className="presentation-btn-icon" />
            <span>思考再生 (F5)</span>
          </button>
        </div>
      )}

      {!isForestViewOpen && onOpenRelatedOverview && (
        <div className="toolbar-group">
          <button
            type="button"
            className="toolbar-btn related-overview-btn"
            title="このマップとリンクでつながるマップだけを俯瞰表示"
            onClick={onOpenRelatedOverview}
          >
            <Network size={15} />
            <span>関連俯瞰</span>
          </button>
        </div>
      )}

      <div className="toolbar-divider" />

      {/* Search in Map */}
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

      {/* Folder Search trigger icon on map toolbar */}
      <button
        className="toolbar-btn icon-only"
        title="PC上のフォルダ配下の全 .mm ファイルを横断検索"
        onClick={onOpenSearcher}
      >
        <FolderSearch size={16} />
      </button>

      {/* In-Map Filter Toggle */}
      {onToggleFilterBar && (
        <button
          type="button"
          className={`toolbar-btn filter-trigger-btn ${
            isFilterBarOpen || activeFilterCount > 0 ? 'active' : ''
          }`}
          title="マップ内フィルタ (Ctrl+Shift+L)"
          aria-label="マップ内フィルタ"
          onClick={onToggleFilterBar}
        >
          <Filter size={15} />
          <span>フィルタ</span>
          {activeFilterCount > 0 && (
            <span className="toolbar-filter-badge">{activeFilterCount}</span>
          )}
        </button>
      )}

      <div className="toolbar-spacer" />

      {/* Help & Sample Reset */}
      <div className="toolbar-group">
        <button
          className="toolbar-btn icon-only"
          title="ショートカット操作ガイド"
          onClick={onOpenHelp}
        >
          <HelpCircle size={16} />
        </button>
        {onToggleTheme && (
          <button
            className="toolbar-btn icon-only"
            title={isDarkMode ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え'}
            onClick={onToggleTheme}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
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

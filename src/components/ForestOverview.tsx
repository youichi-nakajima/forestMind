import React, { useState, useMemo } from 'react';
import { MapTab } from '../hooks/useMindMap';
import { FreeMindMap, FreeMindNode } from '../types/freemind';
import type { ScannedFileItem } from '../types/searcher';
import type {
  ActiveForestFolderData,
  ForestFolderEntry,
  RecentFileEntry,
} from '../types/workspace';
import { parseForestMindLink } from '../utils/nodeLinks';
import { getNodePlainText, nodeMatchesKeyword } from '../utils/treeUtils';
import { normalizeWorkspacePathKey } from '../utils/workspaceStorage';
import type { ForestGraphNode } from '../utils/forestGraph';
import { ForestGraphView } from './ForestGraphView';
import {
  Trees,
  Search,
  ArrowRight,
  FileText,
  GitBranch,
  ExternalLink,
  Plus,
  Folder,
  FolderSearch,
  Clock,
  RefreshCw,
  X,
  LayoutGrid,
  Network,
  Trash2,
} from 'lucide-react';

interface ForestOverviewProps {
  tabs: MapTab[];
  activeTabId: string;
  onSelectTabAndNode: (tabId: string, nodeId?: string) => void;
  onNewTab: () => void;
  onCloseOverview: () => void;
  viewMode?: 'cards' | 'graph';
  onViewModeChange?: (mode: 'cards' | 'graph') => void;
  graphScope?: 'all' | 'related';
  onGraphScopeChange?: (scope: 'all' | 'related') => void;
  graphScopeFocusNodeId?: string | null;
  recentFiles?: RecentFileEntry[];
  forestFolders?: ForestFolderEntry[];
  activeForestFolder?: ActiveForestFolderData | null;
  isScanningForestFolder?: boolean;
  onOpenRecentFile?: (filePath: string) => void;
  onRemoveRecentFile?: (filePath: string) => void;
  onClearRecentFiles?: () => void;
  onPickAndAddForestFolder?: () => void;
  onSelectForestFolder?: (folderPath: string) => void;
  onRemoveForestFolder?: (folderPath: string) => void;
  onSearchInForestFolder?: (folderPath: string) => void;
  onClearActiveForestFolder?: () => void;
  onOpenScannedMap?: (map: FreeMindMap, title: string, nodeId: string, filePath?: string) => void;
  onTrashMapFile?: (target: { filePath: string; title: string; backlinkCount?: number }) => void;
}

interface MapStats {
  tab: MapTab;
  totalNodes: number;
  maxDepth: number;
  mainBranches: string[];
  linkedTabIds: string[];
}

interface FolderMapSummary {
  item: ScannedFileItem;
  title: string;
  totalNodes: number;
  maxDepth: number;
  mainBranches: string[];
  openTab?: MapTab;
}

interface GlobalSearchMatch {
  tabId: string;
  filePath?: string;
  map?: FreeMindMap;
  tabTitle: string;
  nodeId: string;
  nodeText: string;
  path: string;
  isFromFolder?: boolean;
}

function summarizeMap(map: FreeMindMap): {
  totalNodes: number;
  maxDepth: number;
  mainBranches: string[];
} {
  let totalNodes = 0;
  let maxDepth = 0;

  function walk(node: FreeMindNode, depth: number) {
    totalNodes++;
    if (depth > maxDepth) maxDepth = depth;
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  walk(map.root, 0);
  const mainBranches = map.root.children
    .slice(0, 5)
    .map(c => getNodePlainText(c) || '(無題)');

  return { totalNodes, maxDepth, mainBranches };
}

export const ForestOverview: React.FC<ForestOverviewProps> = ({
  tabs,
  activeTabId,
  onSelectTabAndNode,
  onNewTab,
  onCloseOverview,
  viewMode: controlledViewMode,
  onViewModeChange,
  graphScope,
  onGraphScopeChange,
  graphScopeFocusNodeId,
  recentFiles = [],
  forestFolders = [],
  activeForestFolder = null,
  isScanningForestFolder = false,
  onOpenRecentFile,
  onRemoveRecentFile,
  onClearRecentFiles,
  onPickAndAddForestFolder,
  onSelectForestFolder,
  onRemoveForestFolder,
  onSearchInForestFolder,
  onClearActiveForestFolder,
  onOpenScannedMap,
  onTrashMapFile,
}) => {
  const [globalQuery, setGlobalQuery] = useState('');
  const [internalViewMode, setInternalViewMode] = useState<'cards' | 'graph'>('cards');
  const viewMode = controlledViewMode ?? internalViewMode;
  const setViewMode = (mode: 'cards' | 'graph') => {
    setInternalViewMode(mode);
    onViewModeChange?.(mode);
  };

  const handleOpenGraphNode = (graphNode: ForestGraphNode) => {
    if (graphNode.tabId) {
      onSelectTabAndNode(graphNode.tabId, graphNode.map.root.id);
      onCloseOverview();
      return;
    }
    if (onOpenScannedMap) {
      onOpenScannedMap(
        graphNode.map,
        graphNode.title,
        graphNode.map.root.id,
        graphNode.filePath
      );
      onCloseOverview();
    }
  };

  const openTabByFilePath = useMemo(() => {
    const map = new Map<string, MapTab>();
    for (const tab of tabs) {
      if (tab.filePath) {
        map.set(normalizeWorkspacePathKey(tab.filePath), tab);
      }
    }
    return map;
  }, [tabs]);

  // Compute statistics and cross-map links for each tab
  const forestStats: MapStats[] = useMemo(() => {
    return tabs.map(tab => {
      let totalNodes = 0;
      let maxDepth = 0;
      const linkedTargets = new Set<string>();
      const selfFilePath = tab.filePath ? normalizeWorkspacePathKey(tab.filePath) : null;

      function walk(node: FreeMindNode, depth: number) {
        totalNodes++;
        if (depth > maxDepth) maxDepth = depth;
        if (node.link) {
          const parsed = parseForestMindLink(node.link);
          if (parsed.kind === 'forest' && parsed.tabId && parsed.tabId !== tab.id) {
            linkedTargets.add(`forest:${parsed.tabId}`);
          } else if (parsed.kind === 'file' && parsed.filePath) {
            const targetFile = normalizeWorkspacePathKey(parsed.filePath);
            if (!selfFilePath || targetFile !== selfFilePath) {
              linkedTargets.add(`file:${targetFile}`);
            }
          }
        }
        for (const child of node.children) {
          walk(child, depth + 1);
        }
      }

      walk(tab.map.root, 0);

      const mainBranches = tab.map.root.children
        .slice(0, 5)
        .map(c => getNodePlainText(c) || '(無題)');

      return {
        tab,
        totalNodes,
        maxDepth,
        mainBranches,
        linkedTabIds: Array.from(linkedTargets),
      };
    });
  }, [tabs]);

  const activeFolderCards: FolderMapSummary[] = useMemo(() => {
    if (!activeForestFolder) return [];
    return activeForestFolder.files.map(item => {
      const summary = summarizeMap(item.map);
      const title = getNodePlainText(item.map.root) || item.fileName.replace(/\.mm$/i, '');
      const openTab = item.filePath
        ? openTabByFilePath.get(normalizeWorkspacePathKey(item.filePath))
        : undefined;
      return {
        item,
        title,
        ...summary,
        openTab,
      };
    });
  }, [activeForestFolder, openTabByFilePath]);

  // Global search across all open tabs and active Forest Folder maps
  const globalMatches = useMemo(() => {
    if (!globalQuery.trim()) return [];
    const results: GlobalSearchMatch[] = [];

    for (const tab of tabs) {
      function searchNode(n: FreeMindNode, ancestors: string[]) {
        const plainText = getNodePlainText(n);
        if (nodeMatchesKeyword(n, globalQuery)) {
          results.push({
            tabId: tab.id,
            tabTitle: tab.map.root.text || tab.title,
            nodeId: n.id,
            nodeText: plainText || '(無題ノード)',
            path: ancestors.join(' › '),
          });
        }

        for (const c of n.children) {
          searchNode(c, [...ancestors, plainText || 'Root']);
        }
      }

      searchNode(tab.map.root, []);
    }

    if (activeForestFolder) {
      for (const fileItem of activeForestFolder.files) {
        if (fileItem.filePath && openTabByFilePath.has(normalizeWorkspacePathKey(fileItem.filePath))) {
          continue;
        }
        const tabTitle =
          getNodePlainText(fileItem.map.root) || fileItem.fileName.replace(/\.mm$/i, '');
        function searchFolderNode(n: FreeMindNode, ancestors: string[]) {
          const plainText = getNodePlainText(n);
          if (nodeMatchesKeyword(n, globalQuery)) {
            results.push({
              tabId: '',
              filePath: fileItem.filePath,
              map: fileItem.map,
              tabTitle,
              nodeId: n.id,
              nodeText: plainText || '(無題ノード)',
              path: ancestors.join(' › '),
              isFromFolder: true,
            });
          }
          for (const c of n.children) {
            searchFolderNode(c, [...ancestors, plainText || 'Root']);
          }
        }
        searchFolderNode(fileItem.map.root, []);
      }
    }

    return results;
  }, [tabs, activeForestFolder, openTabByFilePath, globalQuery]);

  const showWorkspaceSection =
    Boolean(onPickAndAddForestFolder) || forestFolders.length > 0 || recentFiles.length > 0;

  return (
    <div className={`forest-overview-overlay ${viewMode === 'graph' ? 'graph-mode' : ''}`}>
      <div className={`forest-overview-container ${viewMode === 'graph' ? 'graph-mode' : ''}`}>
        {/* Header */}
        <div className="forest-header">
          <div className="forest-title-group">
            <Trees size={24} className="forest-icon" />
            <div>
              <h2>forestMind 森林俯瞰ビュー (Forest View)</h2>
              <p>複数のマインドマップを横断的に俯瞰・検索・連携します（現在 {tabs.length} マップ展開中）</p>
            </div>
          </div>
          <div className="forest-header-actions">
            <div className="forest-view-toggle" role="tablist" aria-label="森林俯瞰ビュー切替">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'cards'}
                className={`forest-view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid size={14} />
                <span>カード表示</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'graph'}
                className={`forest-view-toggle-btn ${viewMode === 'graph' ? 'active' : ''}`}
                onClick={() => setViewMode('graph')}
              >
                <Network size={14} />
                <span>俯瞰表示</span>
              </button>
            </div>
            <button className="toolbar-btn secondary" onClick={onCloseOverview}>
              マップ編集に戻る
            </button>
          </div>
        </div>

        {viewMode === 'graph' ? (
          <ForestGraphView
            tabs={tabs}
            activeTabId={activeTabId}
            activeForestFolder={activeForestFolder}
            recentFiles={recentFiles}
            scope={graphScope}
            onScopeChange={onGraphScopeChange}
            scopeFocusNodeId={graphScopeFocusNodeId}
            onClearActiveForestFolder={onClearActiveForestFolder}
            onOpenNode={handleOpenGraphNode}
            onTrashMapFile={onTrashMapFile}
          />
        ) : (
          <>
        {/* Global Cross-Map Search Bar */}
        <div className="forest-search-box">
          <Search size={18} className="forest-search-icon" />
          <input
            type="text"
            className="forest-search-input"
            placeholder={
              activeForestFolder
                ? `開いているマップ＋「${activeForestFolder.name}」からノード・ノート・属性を横断検索...`
                : 'すべてのマインドマップからノード・ノート・属性を横断検索...'
            }
            value={globalQuery}
            onChange={e => setGlobalQuery(e.target.value)}
            autoFocus
          />
          {globalQuery && (
            <span className="forest-search-count">{globalMatches.length} 件ヒット</span>
          )}
        </div>

        {/* Global Search Results */}
        {globalQuery.trim() !== '' && (
          <div className="forest-search-results">
            <h3>横断検索結果</h3>
            {globalMatches.length === 0 ? (
              <p className="no-results">一致するノードが見つかりませんでした。</p>
            ) : (
              <div className="search-result-grid">
                {globalMatches.map((m, idx) => (
                  <div
                    key={`${m.tabId || m.filePath || 'folder'}-${m.nodeId}-${idx}`}
                    className="search-result-card"
                    onClick={() => {
                      if (m.tabId) {
                        onSelectTabAndNode(m.tabId, m.nodeId);
                        onCloseOverview();
                      } else if (m.map && onOpenScannedMap) {
                        onOpenScannedMap(m.map, m.tabTitle, m.nodeId, m.filePath);
                        onCloseOverview();
                      }
                    }}
                  >
                    <div className="result-map-badge">
                      {m.isFromFolder ? '📁' : '🌲'} {m.tabTitle}
                    </div>
                    <div className="result-node-title">{m.nodeText}</div>
                    {m.path && <div className="result-node-path">{m.path}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workspace: Forest Folders & Recent Files */}
        {showWorkspaceSection && (
          <div className="forest-workspace-section">
            {/* Forest Folders */}
            {(Boolean(onPickAndAddForestFolder) || forestFolders.length > 0) && (
              <div className="forest-workspace-panel">
                <div className="forest-workspace-panel-header">
                  <div className="forest-workspace-panel-title">
                    <Folder size={15} />
                    <span>森フォルダ（ワークスペース）</span>
                  </div>
                  {onPickAndAddForestFolder && (
                    <button
                      type="button"
                      className="toolbar-btn forest-workspace-add-btn"
                      onClick={onPickAndAddForestFolder}
                    >
                      <Plus size={14} />
                      <span>フォルダを登録</span>
                    </button>
                  )}
                </div>

                {forestFolders.length === 0 ? (
                  <p className="forest-workspace-empty">
                    よく使う .mm 保管フォルダを登録すると、1クリックで一覧表示・横断検索できます。
                  </p>
                ) : (
                  <div className="forest-folders-list">
                    {forestFolders.map(folder => {
                      const isActiveFolder =
                        Boolean(activeForestFolder) &&
                        normalizeWorkspacePathKey(activeForestFolder!.folderPath) ===
                          normalizeWorkspacePathKey(folder.folderPath);
                      return (
                        <div
                          key={folder.folderPath}
                          className={`forest-folder-chip ${isActiveFolder ? 'active' : ''}`}
                        >
                          <button
                            type="button"
                            className="forest-folder-chip-main"
                            title={folder.folderPath}
                            onClick={() => onSelectForestFolder?.(folder.folderPath)}
                          >
                            <Folder size={13} />
                            <span className="forest-folder-chip-name">{folder.name}</span>
                          </button>
                          {onSearchInForestFolder && (
                            <button
                              type="button"
                              className="forest-folder-chip-action"
                              title="このフォルダを横断検索"
                              aria-label={`${folder.name} を横断検索`}
                              onClick={() => onSearchInForestFolder(folder.folderPath)}
                            >
                              <FolderSearch size={13} />
                            </button>
                          )}
                          {onRemoveForestFolder && (
                            <button
                              type="button"
                              className="forest-folder-chip-remove"
                              title="森フォルダの登録を解除"
                              aria-label={`${folder.name} の登録を解除`}
                              onClick={() => onRemoveForestFolder(folder.folderPath)}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Recent Files */}
            {recentFiles.length > 0 && (
              <div className="forest-workspace-panel">
                <div className="forest-workspace-panel-header">
                  <div className="forest-workspace-panel-title">
                    <Clock size={15} />
                    <span>最近使ったファイル</span>
                  </div>
                  {onClearRecentFiles && (
                    <button
                      type="button"
                      className="recent-files-clear-btn"
                      onClick={onClearRecentFiles}
                    >
                      クリア
                    </button>
                  )}
                </div>
                <div className="forest-recent-list">
                  {recentFiles.slice(0, 8).map(entry => (
                    <div key={entry.filePath} className="forest-recent-chip">
                      <button
                        type="button"
                        className="forest-recent-chip-main"
                        title={entry.filePath}
                        onClick={() => onOpenRecentFile?.(entry.filePath)}
                      >
                        <FileText size={12} />
                        <span className="forest-recent-chip-name">{entry.fileName}</span>
                      </button>
                      {onRemoveRecentFile && (
                        <button
                          type="button"
                          className="forest-folder-chip-remove"
                          title="履歴から除外"
                          aria-label={`${entry.fileName} を履歴から除外`}
                          onClick={() => onRemoveRecentFile(entry.filePath)}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Forest Folder Maps */}
        {(isScanningForestFolder || activeForestFolder) && (
          <div className="forest-folder-maps-section">
            <div className="forest-section-title">
              <div className="forest-folder-maps-heading">
                <h3>
                  📁 {activeForestFolder?.name || '森フォルダ'} 内のマップ
                  {activeForestFolder && (
                    <span className="forest-folder-count-pill">
                      {activeForestFolder.files.length} 件
                    </span>
                  )}
                </h3>
              </div>
              <div className="forest-folder-maps-actions">
                {activeForestFolder && onSelectForestFolder && (
                  <button
                    type="button"
                    className="toolbar-btn secondary"
                    disabled={isScanningForestFolder}
                    onClick={() => onSelectForestFolder(activeForestFolder.folderPath)}
                  >
                    <RefreshCw size={13} className={isScanningForestFolder ? 'spin' : ''} />
                    <span>再スキャン</span>
                  </button>
                )}
                {activeForestFolder && onSearchInForestFolder && (
                  <button
                    type="button"
                    className="toolbar-btn secondary"
                    onClick={() => onSearchInForestFolder(activeForestFolder.folderPath)}
                  >
                    <FolderSearch size={14} />
                    <span>横断検索</span>
                  </button>
                )}
                {onClearActiveForestFolder && (
                  <button
                    type="button"
                    className="toolbar-btn secondary"
                    onClick={onClearActiveForestFolder}
                  >
                    <X size={14} />
                    <span>閉じる</span>
                  </button>
                )}
              </div>
            </div>

            {isScanningForestFolder ? (
              <p className="forest-workspace-empty">森フォルダ内の .mm ファイルを読み込み中...</p>
            ) : activeFolderCards.length === 0 ? (
              <p className="forest-workspace-empty">
                このフォルダ配下に読み込み可能な .mm ファイルは見つかりませんでした。
              </p>
            ) : (
              <div className="forest-cards-grid">
                {activeFolderCards.map(({ item, title, totalNodes, maxDepth, mainBranches, openTab }) => (
                  <div
                    key={item.filePath || `${item.relativePath}/${item.fileName}`}
                    className={`forest-tree-card forest-folder-map-card ${openTab ? 'already-open' : ''}`}
                    onClick={() => {
                      if (openTab) {
                        onSelectTabAndNode(openTab.id, openTab.map.root.id);
                        onCloseOverview();
                      } else if (onOpenScannedMap) {
                        onOpenScannedMap(item.map, title, item.map.root.id, item.filePath);
                        onCloseOverview();
                      }
                    }}
                  >
                    <div className="tree-card-header">
                      <span className="tree-emoji">🌲</span>
                      <h4 className="tree-title">{title}</h4>
                      {openTab && <span className="current-badge">開いています</span>}
                      {onTrashMapFile && item.filePath && /\.mm$/i.test(item.filePath) && (
                        <button
                          type="button"
                          className="tree-card-trash-btn"
                          title="この .mm ファイルをゴミ箱へ移動"
                          aria-label={`${title} をゴミ箱へ移動`}
                          onClick={e => {
                            e.stopPropagation();
                            onTrashMapFile({ filePath: item.filePath!, title });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="folder-map-relpath" title={item.filePath || item.fileName}>
                      {item.relativePath === '.' ? item.fileName : `${item.relativePath}/${item.fileName}`}
                    </div>

                    <div className="tree-metrics">
                      <span>
                        <FileText size={13} /> {totalNodes} ノード
                      </span>
                      <span>
                        <GitBranch size={13} /> 深さ {maxDepth} 階層
                      </span>
                    </div>

                    <div className="tree-branches-preview">
                      {mainBranches.length === 0 ? (
                        <span className="empty-branches">（子トピックなし）</span>
                      ) : (
                        <div className="branch-pills">
                          {mainBranches.map((b, i) => (
                            <span key={i} className="branch-pill">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="tree-card-action">
                      <span>{openTab ? 'タブに切り替え' : 'このマップを開く'}</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Forest Cards Grid */}
        <div className="forest-section-title">
          <h3>マインドマップ一覧（開いているタブ）</h3>
          <button className="toolbar-btn" onClick={onNewTab}>
            <Plus size={15} />
            <span>新規マップを追加</span>
          </button>
        </div>

        <div className="forest-cards-grid">
          {forestStats.map(({ tab, totalNodes, maxDepth, mainBranches, linkedTabIds }) => {
            const isCurrent = tab.id === activeTabId;
            const title = tab.map.root.text || tab.title;

            return (
              <div
                key={tab.id}
                className={`forest-tree-card ${isCurrent ? 'active-tree' : ''}`}
                onClick={() => {
                  onSelectTabAndNode(tab.id, tab.map.root.id);
                  onCloseOverview();
                }}
              >
                <div className="tree-card-header">
                  <span className="tree-emoji">🌳</span>
                  <h4 className="tree-title">{title}</h4>
                  {isCurrent && <span className="current-badge">選択中</span>}
                  {onTrashMapFile && tab.filePath && /\.mm$/i.test(tab.filePath) && (
                    <button
                      type="button"
                      className="tree-card-trash-btn"
                      title="この .mm ファイルをゴミ箱へ移動"
                      aria-label={`${title} をゴミ箱へ移動`}
                      onClick={e => {
                        e.stopPropagation();
                        onTrashMapFile({ filePath: tab.filePath!, title });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="tree-metrics">
                  <span>
                    <FileText size={13} /> {totalNodes} ノード
                  </span>
                  <span>
                    <GitBranch size={13} /> 深さ {maxDepth} 階層
                  </span>
                </div>

                <div className="tree-branches-preview">
                  <div className="preview-label">主要トピック:</div>
                  {mainBranches.length === 0 ? (
                    <span className="empty-branches">（子トピックなし）</span>
                  ) : (
                    <div className="branch-pills">
                      {mainBranches.map((b, i) => (
                        <span key={i} className="branch-pill">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {linkedTabIds.length > 0 && (
                  <div className="tree-links-footer">
                    <ExternalLink size={12} />
                    <span>
                      他マップへのリンク: {linkedTabIds.length} 件
                    </span>
                  </div>
                )}

                <div className="tree-card-action">
                  <span>このマップを開く</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
          </>
        )}
      </div>
    </div>
  );
};

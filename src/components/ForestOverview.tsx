import React, { useState, useMemo } from 'react';
import { MapTab } from '../hooks/useMindMap';
import { FreeMindNode } from '../types/freemind';
import { parseForestMindLink } from '../utils/nodeLinks';
import { getNodePlainText, nodeMatchesKeyword } from '../utils/treeUtils';
import { Trees, Search, ArrowRight, FileText, GitBranch, ExternalLink, Plus } from 'lucide-react';

interface ForestOverviewProps {
  tabs: MapTab[];
  activeTabId: string;
  onSelectTabAndNode: (tabId: string, nodeId?: string) => void;
  onNewTab: () => void;
  onCloseOverview: () => void;
}

interface MapStats {
  tab: MapTab;
  totalNodes: number;
  maxDepth: number;
  mainBranches: string[];
  linkedTabIds: string[];
}

export const ForestOverview: React.FC<ForestOverviewProps> = ({
  tabs,
  activeTabId,
  onSelectTabAndNode,
  onNewTab,
  onCloseOverview,
}) => {
  const [globalQuery, setGlobalQuery] = useState('');

  // Compute statistics and cross-map links for each tab
  const forestStats: MapStats[] = useMemo(() => {
    return tabs.map(tab => {
      let totalNodes = 0;
      let maxDepth = 0;
      const linkedTargets = new Set<string>();
      const selfFilePath = tab.filePath ? tab.filePath.replace(/\\/g, '/').toLowerCase() : null;

      function walk(node: FreeMindNode, depth: number) {
        totalNodes++;
        if (depth > maxDepth) maxDepth = depth;
        if (node.link) {
          const parsed = parseForestMindLink(node.link);
          if (parsed.kind === 'forest' && parsed.tabId && parsed.tabId !== tab.id) {
            linkedTargets.add(`forest:${parsed.tabId}`);
          } else if (parsed.kind === 'file' && parsed.filePath) {
            const targetFile = parsed.filePath.replace(/\\/g, '/').toLowerCase();
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

  // Global search across all maps in the forest
  const globalMatches = useMemo(() => {
    if (!globalQuery.trim()) return [];
    const results: { tabId: string; tabTitle: string; nodeId: string; nodeText: string; path: string }[] = [];

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

    return results;
  }, [tabs, globalQuery]);

  return (
    <div className="forest-overview-overlay">
      <div className="forest-overview-container">
        {/* Header */}
        <div className="forest-header">
          <div className="forest-title-group">
            <Trees size={24} className="forest-icon" />
            <div>
              <h2>forestMind 森林俯瞰ビュー (Forest View)</h2>
              <p>複数のマインドマップを横断的に俯瞰・検索・連携します（現在 {tabs.length} マップ展開中）</p>
            </div>
          </div>
          <button className="toolbar-btn secondary" onClick={onCloseOverview}>
            マップ編集に戻る
          </button>
        </div>

        {/* Global Cross-Map Search Bar */}
        <div className="forest-search-box">
          <Search size={18} className="forest-search-icon" />
          <input
            type="text"
            className="forest-search-input"
            placeholder="すべてのマインドマップからノード・ノート・属性を横断検索..."
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
                    key={`${m.tabId}-${m.nodeId}-${idx}`}
                    className="search-result-card"
                    onClick={() => {
                      onSelectTabAndNode(m.tabId, m.nodeId);
                      onCloseOverview();
                    }}
                  >
                    <div className="result-map-badge">🌲 {m.tabTitle}</div>
                    <div className="result-node-title">{m.nodeText}</div>
                    {m.path && <div className="result-node-path">{m.path}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Forest Cards Grid */}
        <div className="forest-section-title">
          <h3>マインドマップ一覧（ツリーコレクション）</h3>
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
      </div>
    </div>
  );
};


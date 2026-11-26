import React, { useMemo, useRef, useState } from 'react';
import type { MapTab } from '../hooks/useMindMap';
import type { ActiveForestFolderData, RecentFileEntry } from '../types/workspace';
import {
  buildForestGraph,
  DEFAULT_CANOPY_PALETTE,
  SEASON_THEMES,
  TREE_SPECIES_META,
  type ForestGraphNode,
  type SeasonTheme,
} from '../utils/forestGraph';
import { ForestTreeIcon } from './ForestTreeIcon';
import {
  ArrowLeftRight,
  ArrowRight,
  Calendar,
  ExternalLink,
  FileText,
  GitBranch,
  Maximize2,
  Palette,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface ForestGraphViewProps {
  tabs: MapTab[];
  activeTabId: string;
  activeForestFolder?: ActiveForestFolderData | null;
  recentFiles?: RecentFileEntry[];
  onOpenNode: (node: ForestGraphNode) => void;
}

const SEASON_LEGEND_ORDER: SeasonTheme[] = ['spring', 'summer', 'autumn', 'winter'];

function formatModifiedDate(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return '更新日時データなし';
  try {
    return new Date(ms).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '更新日時データなし';
  }
}

export const ForestGraphView: React.FC<ForestGraphViewProps> = ({
  tabs,
  activeTabId,
  activeForestFolder = null,
  recentFiles = [],
  onOpenNode,
}) => {
  const [nowMs] = useState<number>(() => Date.now());
  const [useSeasonColors, setUseSeasonColors] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const graph = useMemo(
    () =>
      buildForestGraph({
        tabs,
        activeTabId,
        activeForestFolder,
        recentFiles,
        nowMs,
      }),
    [tabs, activeTabId, activeForestFolder, recentFiles, nowMs]
  );

  const nodeMap = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes]);

  const effectiveSelectedId = useMemo(() => {
    if (selectedNodeId && nodeMap.has(selectedNodeId)) return selectedNodeId;
    const active = graph.nodes.find(n => n.isActiveTab);
    return active?.id || graph.nodes[0]?.id || null;
  }, [selectedNodeId, nodeMap, graph.nodes]);

  const focusId = hoveredNodeId || effectiveSelectedId;
  const selectedNode = effectiveSelectedId ? nodeMap.get(effectiveSelectedId) || null : null;

  const connectedNeighborIds = useMemo(() => {
    const ids = new Set<string>();
    if (!focusId) return ids;
    ids.add(focusId);
    const node = nodeMap.get(focusId);
    if (node) {
      node.outgoingIds.forEach(id => ids.add(id));
      node.incomingIds.forEach(id => ids.add(id));
    }
    return ids;
  }, [focusId, nodeMap]);

  const viewWidth = Math.max(560, graph.bounds.maxX - graph.bounds.minX);
  const viewHeight = Math.max(400, graph.bounds.maxY - graph.bounds.minY);
  const vbCenterX = (graph.bounds.minX + graph.bounds.maxX) / 2;
  const vbCenterY = (graph.bounds.minY + graph.bounds.maxY) / 2;

  const handleResetCamera = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const focusOnNode = (targetId: string) => {
    setSelectedNodeId(targetId);
    const target = nodeMap.get(targetId);
    if (target) {
      setPanOffset({
        x: (vbCenterX - target.x) * zoomScale * 0.65,
        y: (vbCenterY - target.y) * zoomScale * 0.65,
      });
    }
  };

  const contourRadii = [110, 195, 290, 395, 510, 635];

  return (
    <div className="forest-graph-shell">
      {/* Toolbar & Legend */}
      <div className="forest-graph-toolbar">
        <div className="forest-graph-toolbar-left">
          <button
            type="button"
            className={`forest-season-toggle-btn ${useSeasonColors ? 'active' : ''}`}
            onClick={() => setUseSeasonColors(prev => !prev)}
            title="更新頻度を季節カラー（新緑・深緑・紅葉・冬木立）で表示します"
          >
            <Palette size={14} />
            <span>季節カラー: {useSeasonColors ? 'ON' : 'OFF'}</span>
          </button>

          {useSeasonColors ? (
            <div className="forest-graph-legend" aria-label="季節カラー凡例">
              {SEASON_LEGEND_ORDER.map(sKey => {
                const info = SEASON_THEMES[sKey];
                return (
                  <span key={sKey} className="forest-legend-chip">
                    <span
                      className="forest-legend-dot"
                      style={{ backgroundColor: info.canopyFill, borderColor: info.canopyStroke }}
                    />
                    <span>{info.label}</span>
                  </span>
                );
              })}
            </div>
          ) : (
            <span className="forest-graph-hint">
              樹形アイコンはノード数・階層の深さに応じた 6 種類で表示中
            </span>
          )}
        </div>

        <div className="forest-graph-zoom-controls">
          <button
            type="button"
            className="forest-graph-icon-btn"
            aria-label="グラフを縮小"
            title="縮小"
            onClick={() => setZoomScale(prev => Math.max(0.45, Number((prev - 0.15).toFixed(2))))}
          >
            <ZoomOut size={14} />
          </button>
          <span className="forest-graph-zoom-label">{Math.round(zoomScale * 100)}%</span>
          <button
            type="button"
            className="forest-graph-icon-btn"
            aria-label="グラフを拡大"
            title="拡大"
            onClick={() => setZoomScale(prev => Math.min(2.4, Number((prev + 0.15).toFixed(2))))}
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            className="forest-graph-icon-btn"
            aria-label="グラフ全体を表示"
            title="全体表示にリセット"
            onClick={handleResetCamera}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Main Canvas + Inspector */}
      <div className="forest-graph-body">
        <div
          className="forest-graph-canvas-wrap"
          onWheel={e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            setZoomScale(prev => Math.max(0.45, Math.min(2.4, Number((prev + delta).toFixed(2)))));
          }}
          onMouseDown={e => {
            if ((e.target as HTMLElement).closest('.forest-graph-node')) return;
            isPanningRef.current = true;
            panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
          }}
          onMouseMove={e => {
            if (!isPanningRef.current) return;
            setPanOffset({
              x: e.clientX - panStartRef.current.x,
              y: e.clientY - panStartRef.current.y,
            });
          }}
          onMouseUp={() => {
            isPanningRef.current = false;
          }}
          onMouseLeave={() => {
            isPanningRef.current = false;
          }}
        >
          {graph.nodes.length === 0 ? (
            <div className="forest-graph-empty">
              表示するマインドマップがありません。
            </div>
          ) : (
            <svg
              className="forest-graph-svg"
              viewBox={`${graph.bounds.minX} ${graph.bounds.minY} ${viewWidth} ${viewHeight}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="森林ナレッジグラフ"
            >
              <defs>
                <marker
                  id="fg-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
                <marker
                  id="fg-arrow-outgoing"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0d9488" />
                </marker>
                <marker
                  id="fg-arrow-incoming"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#2563eb" />
                </marker>
              </defs>

              <g
                transform={`translate(${vbCenterX + panOffset.x} ${
                  vbCenterY + panOffset.y
                }) scale(${zoomScale}) translate(${-vbCenterX} ${-vbCenterY})`}
              >
                {/* Topographic Contour Lines */}
                <g className="forest-contours" aria-hidden="true">
                  {contourRadii.map((r, idx) => (
                    <ellipse
                      key={r}
                      cx={0}
                      cy={0}
                      rx={r * 1.28}
                      ry={r * 0.88}
                      transform={`rotate(${(idx % 2 === 0 ? 1 : -1) * (idx * 7)})`}
                      className="forest-contour-ring"
                    />
                  ))}
                </g>

                {/* Directional Inter-Map Link Edges */}
                <g className="forest-graph-edges">
                  {graph.edges.map(edge => {
                    const src = nodeMap.get(edge.sourceId);
                    const dst = nodeMap.get(edge.targetId);
                    if (!src || !dst) return null;

                    const dx = dst.x - src.x;
                    const dy = dst.y - src.y;
                    const dist = Math.hypot(dx, dy) || 1;
                    const ux = dx / dist;
                    const uy = dy / dist;

                    const startPad = src.radius * 0.82;
                    const endPad = dst.radius * 0.92;
                    const sx = src.x + ux * startPad;
                    const sy = src.y + uy * startPad;
                    const ex = dst.x - ux * endPad;
                    const ey = dst.y - uy * endPad;

                    // Offset curve perpendicularly so bidirectional links separate cleanly
                    const perpSign = edge.isBidirectional ? 1 : 0.45;
                    const curveOffset = Math.min(44, dist * 0.16) * perpSign;
                    const cx = (sx + ex) / 2 - uy * curveOffset;
                    const cy = (sy + ey) / 2 + ux * curveOffset;
                    const d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;

                    const isOutgoingFromFocus = focusId === edge.sourceId;
                    const isIncomingToFocus = focusId === edge.targetId;
                    const isHighlighted = isOutgoingFromFocus || isIncomingToFocus;
                    const isDimmed = Boolean(focusId) && !isHighlighted;

                    const markerEnd = isOutgoingFromFocus
                      ? 'url(#fg-arrow-outgoing)'
                      : isIncomingToFocus
                        ? 'url(#fg-arrow-incoming)'
                        : 'url(#fg-arrow)';

                    return (
                      <path
                        key={edge.id}
                        d={d}
                        fill="none"
                        markerEnd={markerEnd}
                        className={`forest-graph-edge ${
                          isOutgoingFromFocus ? 'outgoing-highlight' : ''
                        } ${isIncomingToFocus ? 'incoming-highlight' : ''} ${
                          isDimmed ? 'dimmed' : ''
                        }`}
                      />
                    );
                  })}
                </g>

                {/* Tree Nodes */}
                <g className="forest-graph-nodes">
                  {graph.nodes.map(node => {
                    const isSelected = effectiveSelectedId === node.id;
                    const isConnected = connectedNeighborIds.has(node.id);
                    const isDimmed = Boolean(focusId) && !isConnected;
                    const palette = useSeasonColors ? node.seasonInfo : DEFAULT_CANOPY_PALETTE;
                    const iconSize = Math.round(node.radius * 1.15);
                    const labelText =
                      node.title.length > 18 ? `${node.title.slice(0, 17)}…` : node.title;

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        role="button"
                        tabIndex={0}
                        aria-label={`${node.title} (${TREE_SPECIES_META[node.species].label}, ${node.totalNodes}ノード)`}
                        className={`forest-graph-node ${isSelected ? 'selected' : ''} ${
                          node.isActiveTab ? 'active-tab' : ''
                        } ${isDimmed ? 'dimmed' : ''}`}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedNodeId(node.id);
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          onOpenNode(node);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedNodeId(node.id);
                          }
                        }}
                      >
                        <circle
                          cx={0}
                          cy={0}
                          r={node.radius}
                          className="forest-node-aura"
                        />
                        <ForestTreeIcon
                          x={-iconSize / 2}
                          y={-iconSize / 2 - 4}
                          species={node.species}
                          canopyFill={palette.canopyFill}
                          canopyStroke={palette.canopyStroke}
                          size={iconSize}
                        />
                        <g transform={`translate(0, ${node.radius + 14})`}>
                          <rect
                            x={-68}
                            y={-11}
                            width={136}
                            height={22}
                            rx={11}
                            className="forest-node-label-bg"
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="forest-node-label-text"
                          >
                            {node.isOpenTab ? '' : '📁 '}
                            {labelText}
                          </text>
                        </g>
                        <g transform={`translate(${node.radius * 0.65}, ${-node.radius * 0.62})`}>
                          <circle cx={0} cy={0} r={11} className="forest-node-count-bg" />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="forest-node-count-text"
                          >
                            {node.totalNodes}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>
          )}
        </div>

        {/* Right-side Inspector Panel */}
        {selectedNode && (
          <aside className="forest-graph-inspector" aria-label="選択中マップの詳細">
            <div className="inspector-hero">
              <ForestTreeIcon
                species={selectedNode.species}
                canopyFill={
                  useSeasonColors
                    ? selectedNode.seasonInfo.canopyFill
                    : DEFAULT_CANOPY_PALETTE.canopyFill
                }
                canopyStroke={
                  useSeasonColors
                    ? selectedNode.seasonInfo.canopyStroke
                    : DEFAULT_CANOPY_PALETTE.canopyStroke
                }
                size={52}
              />
              <div className="inspector-title-block">
                <div className="inspector-source-badge">
                  {selectedNode.isActiveTab
                    ? '現在編集中のタブ'
                    : selectedNode.isOpenTab
                      ? '開いているタブ'
                      : '森フォルダ内の .mm'}
                </div>
                <h4 className="inspector-title">{selectedNode.title}</h4>
              </div>
            </div>

            <div className="inspector-badges">
              <span
                className="inspector-pill"
                title={TREE_SPECIES_META[selectedNode.species].description}
              >
                🌳 樹種: {TREE_SPECIES_META[selectedNode.species].label}
              </span>
              <span className="inspector-pill">
                <Calendar size={12} /> {selectedNode.seasonInfo.label}
              </span>
            </div>

            <div className="inspector-stats-grid">
              <div className="inspector-stat">
                <FileText size={13} />
                <span>{selectedNode.totalNodes} ノード</span>
              </div>
              <div className="inspector-stat">
                <GitBranch size={13} />
                <span>深さ {selectedNode.maxDepth} 階層</span>
              </div>
            </div>
            <div className="inspector-modified">
              最終更新: {formatModifiedDate(selectedNode.lastModifiedMs)}
            </div>

            {selectedNode.mainBranches.length > 0 && (
              <div className="inspector-section">
                <div className="inspector-section-label">主要トピック</div>
                <div className="branch-pills">
                  {selectedNode.mainBranches.map((branch, idx) => (
                    <span key={idx} className="branch-pill">
                      {branch}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="inspector-section">
              <div className="inspector-section-label">
                <ExternalLink size={12} /> 発リンク (参照先 {selectedNode.outgoingIds.length})
              </div>
              {selectedNode.outgoingIds.length === 0 ? (
                <p className="inspector-empty">他マップへのリンクはありません</p>
              ) : (
                <div className="inspector-link-list">
                  {selectedNode.outgoingIds.map(targetId => {
                    const target = nodeMap.get(targetId);
                    if (!target) return null;
                    return (
                      <button
                        key={targetId}
                        type="button"
                        className="inspector-link-chip outgoing"
                        onClick={() => focusOnNode(targetId)}
                      >
                        <span>→ {target.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="inspector-section">
              <div className="inspector-section-label">
                <ArrowLeftRight size={12} /> バックリンク (参照元 {selectedNode.incomingIds.length})
              </div>
              {selectedNode.incomingIds.length === 0 ? (
                <p className="inspector-empty">このマップを参照しているマップはありません</p>
              ) : (
                <div className="inspector-link-list">
                  {selectedNode.incomingIds.map(srcId => {
                    const src = nodeMap.get(srcId);
                    if (!src) return null;
                    return (
                      <button
                        key={srcId}
                        type="button"
                        className="inspector-link-chip incoming"
                        onClick={() => focusOnNode(srcId)}
                      >
                        <span>← {src.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              className="toolbar-btn inspector-open-btn"
              onClick={() => onOpenNode(selectedNode)}
            >
              <span>このマップを開く</span>
              <ArrowRight size={14} />
            </button>
          </aside>
        )}
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  Folder,
  GitBranch,
  Maximize,
  Maximize2,
  Minimize,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface ForestGraphViewProps {
  tabs: MapTab[];
  activeTabId: string;
  activeForestFolder?: ActiveForestFolderData | null;
  recentFiles?: RecentFileEntry[];
  scope?: 'all' | 'related';
  onScopeChange?: (scope: 'all' | 'related') => void;
  scopeFocusNodeId?: string | null;
  onClearActiveForestFolder?: () => void;
  onOpenNode: (node: ForestGraphNode) => void;
  onTrashMapFile?: (target: { filePath: string; title: string; backlinkCount?: number }) => void;
}

const SEASON_LEGEND_ORDER: SeasonTheme[] = ['spring', 'summer', 'autumn', 'winter'];
const MIN_GRAPH_ZOOM = 0.25;
const MAX_GRAPH_ZOOM = 3.5;

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
  scope: controlledScope,
  onScopeChange,
  scopeFocusNodeId = null,
  onClearActiveForestFolder,
  onOpenNode,
  onTrashMapFile,
}) => {
  const [nowMs] = useState<number>(() => Date.now());
  const [useSeasonColors, setUseSeasonColors] = useState(true);
  const [internalScope, setInternalScope] = useState<'all' | 'related'>('all');
  const scope = controlledScope ?? internalScope;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [lockedAnchorNodeId, setLockedAnchorNodeId] = useState<string | null>(
    scopeFocusNodeId
  );
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isPanning, setIsPanning] = useState(false);

  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const cameraGroupRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ clientX: 0, clientY: 0, camX: 0, camY: 0 });
  const dragUnitsPerPxRef = useRef(1);

  useEffect(() => {
    if (scopeFocusNodeId) {
      setLockedAnchorNodeId(scopeFocusNodeId);
    }
  }, [scopeFocusNodeId]);

  const effectiveAnchorNodeId =
    scope === 'related'
      ? scopeFocusNodeId || lockedAnchorNodeId || selectedNodeId || `tab:${activeTabId}`
      : null;

  const setScope = (nextScope: 'all' | 'related') => {
    if (nextScope === 'related' && !scopeFocusNodeId) {
      setLockedAnchorNodeId(selectedNodeId || `tab:${activeTabId}`);
    } else if (nextScope === 'all') {
      setLockedAnchorNodeId(null);
    }
    setInternalScope(nextScope);
    onScopeChange?.(nextScope);
  };

  const graph = useMemo(
    () =>
      buildForestGraph({
        tabs,
        activeTabId,
        activeForestFolder,
        recentFiles,
        nowMs,
        scope,
        focusNodeId: effectiveAnchorNodeId,
      }),
    [tabs, activeTabId, activeForestFolder, recentFiles, nowMs, scope, effectiveAnchorNodeId]
  );

  const nodeMap = useMemo(() => new Map(graph.nodes.map(n => [n.id, n])), [graph.nodes]);

  const effectiveSelectedId = useMemo(() => {
    if (selectedNodeId && nodeMap.has(selectedNodeId)) return selectedNodeId;
    const active = graph.nodes.find(n => n.isActiveTab);
    return active?.id || graph.nodes[0]?.id || null;
  }, [selectedNodeId, nodeMap, graph.nodes]);

  const focusId = hoveredNodeId || effectiveSelectedId;
  const selectedNode = effectiveSelectedId ? nodeMap.get(effectiveSelectedId) || null : null;

  const hoveredNeighborIds = useMemo(() => {
    const ids = new Set<string>();
    if (!hoveredNodeId) return ids;
    ids.add(hoveredNodeId);
    const node = nodeMap.get(hoveredNodeId);
    if (node) {
      node.outgoingIds.forEach(id => ids.add(id));
      node.incomingIds.forEach(id => ids.add(id));
    }
    return ids;
  }, [hoveredNodeId, nodeMap]);

  const viewWidth = Math.max(560, graph.bounds.maxX - graph.bounds.minX);
  const viewHeight = Math.max(400, graph.bounds.maxY - graph.bounds.minY);
  const vbCenterX = (graph.bounds.minX + graph.bounds.maxX) / 2;
  const vbCenterY = (graph.bounds.minY + graph.bounds.maxY) / 2;

  const applyCameraTransform = useCallback(() => {
    const g = cameraGroupRef.current;
    if (!g) return;
    const { x, y, scale } = cameraRef.current;
    g.setAttribute(
      'transform',
      `translate(${vbCenterX + x} ${vbCenterY + y}) scale(${scale}) translate(${-vbCenterX} ${-vbCenterY})`
    );
  }, [vbCenterX, vbCenterY]);

  const scheduleCameraApply = useCallback(() => {
    if (rafIdRef.current !== null) return;
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      applyCameraTransform();
    });
  }, [applyCameraTransform]);

  useLayoutEffect(() => {
    applyCameraTransform();
  }, [applyCameraTransform, graph.nodes.length]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  // Native non-passive wheel listener for smooth cursor-anchored zoom without outer scroll jitter
  useEffect(() => {
    const wrapEl = canvasWrapRef.current;
    if (!wrapEl) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const cam = cameraRef.current;
      const zoomFactor = Math.exp(-e.deltaY * 0.0014);
      const nextScale = Math.max(
        MIN_GRAPH_ZOOM,
        Math.min(MAX_GRAPH_ZOOM, cam.scale * zoomFactor)
      );

      const svgEl = svgRef.current;
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const uniformScale = Math.min(rect.width / viewWidth, rect.height / viewHeight);
          if (uniformScale > 0) {
            const drawW = viewWidth * uniformScale;
            const drawH = viewHeight * uniformScale;
            const offsetX = rect.left + (rect.width - drawW) / 2;
            const offsetY = rect.top + (rect.height - drawH) / 2;
            const cursorSvgX = graph.bounds.minX + (e.clientX - offsetX) / uniformScale;
            const cursorSvgY = graph.bounds.minY + (e.clientY - offsetY) / uniformScale;
            const wx = (cursorSvgX - (vbCenterX + cam.x)) / cam.scale + vbCenterX;
            const wy = (cursorSvgY - (vbCenterY + cam.y)) / cam.scale + vbCenterY;
            cam.x = cursorSvgX - (wx - vbCenterX) * nextScale - vbCenterX;
            cam.y = cursorSvgY - (wy - vbCenterY) * nextScale - vbCenterY;
          }
        }
      }

      cam.scale = nextScale;
      scheduleCameraApply();
      setZoomPercent(Math.round(nextScale * 100));
    };

    wrapEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapEl.removeEventListener('wheel', handleWheel);
  }, [graph.bounds.minX, graph.bounds.minY, viewWidth, viewHeight, vbCenterX, vbCenterY, scheduleCameraApply]);

  // Keyboard shortcuts: F toggles fullscreen, Esc exits fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        e.stopPropagation();
        setIsFullscreen(false);
        return;
      }
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable)
      ) {
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setIsFullscreen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFullscreen]);

  const handleStepZoom = (factor: number) => {
    const cam = cameraRef.current;
    const nextScale = Math.max(MIN_GRAPH_ZOOM, Math.min(MAX_GRAPH_ZOOM, cam.scale * factor));
    cam.scale = nextScale;
    applyCameraTransform();
    setZoomPercent(Math.round(nextScale * 100));
  };

  const handleResetCamera = () => {
    cameraRef.current = { x: 0, y: 0, scale: 1 };
    applyCameraTransform();
    setZoomPercent(100);
  };

  const focusOnNode = (targetId: string) => {
    setSelectedNodeId(targetId);
    const target = nodeMap.get(targetId);
    if (target) {
      cameraRef.current.x = (vbCenterX - target.x) * cameraRef.current.scale * 0.65;
      cameraRef.current.y = (vbCenterY - target.y) * cameraRef.current.scale * 0.65;
      applyCameraTransform();
    }
  };

  const contourPaths = useMemo(() => {
    const left = graph.bounds.minX - 280;
    const right = graph.bounds.maxX + 280;
    const width = right - left;
    const top = graph.bounds.minY - 80;
    const bottom = graph.bounds.maxY + 80;
    const bandCount = Math.max(7, Math.min(14, Math.round((bottom - top) / 220)));
    const segments = 6;
    const segW = width / segments;
    const paths: string[] = [];

    for (let b = 0; b < bandCount; b++) {
      const baseY = top + ((bottom - top) * (b + 0.5)) / bandCount;
      const amp = 24 + (b % 3) * 10;
      const phase = b * 1.15;
      let d = `M ${Math.round(left)} ${Math.round(baseY + Math.sin(phase) * amp)}`;
      for (let s = 0; s < segments; s++) {
        const x0 = left + s * segW;
        const xMid = x0 + segW * 0.5;
        const x1 = x0 + segW;
        const cy = baseY + Math.sin(phase + (s + 0.5) * 1.4) * amp * 1.35;
        const ey = baseY + Math.sin(phase + (s + 1) * 1.4) * amp;
        d += ` Q ${Math.round(xMid)} ${Math.round(cy)} ${Math.round(x1)} ${Math.round(ey)}`;
      }
      paths.push(d);
    }
    return paths;
  }, [graph.bounds.minX, graph.bounds.maxX, graph.bounds.minY, graph.bounds.maxY]);

  return (
    <div className={`forest-graph-shell ${isFullscreen ? 'is-fullscreen' : ''}`}>
      {/* Toolbar & Legend */}
      <div className="forest-graph-toolbar">
        <div className="forest-graph-toolbar-left">
          <div className="forest-scope-toggle" role="group" aria-label="表示範囲">
            <button
              type="button"
              className={`forest-scope-btn ${scope === 'all' ? 'active' : ''}`}
              aria-pressed={scope === 'all'}
              onClick={() => setScope('all')}
            >
              森全体
            </button>
            <button
              type="button"
              className={`forest-scope-btn ${scope === 'related' ? 'active' : ''}`}
              aria-pressed={scope === 'related'}
              onClick={() => setScope('related')}
            >
              関連のみ
            </button>
          </div>

          {activeForestFolder && (
            <div className="forest-active-folder-pill" title={activeForestFolder.folderPath}>
              <Folder size={13} />
              <span>{activeForestFolder.name}</span>
              {onClearActiveForestFolder && (
                <button
                  type="button"
                  className="forest-active-folder-clear"
                  title="森フォルダの読み込みを解除"
                  aria-label="森フォルダの読み込みを解除"
                  onClick={onClearActiveForestFolder}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className={`forest-season-toggle-btn ${useSeasonColors ? 'active' : ''}`}
            onClick={() => setUseSeasonColors(prev => !prev)}
            title="更新時期を季節カラー（新緑・深緑・黄葉・深紅）で表示します"
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
            onClick={() => handleStepZoom(0.85)}
          >
            <ZoomOut size={14} />
          </button>
          <span className="forest-graph-zoom-label">{zoomPercent}%</span>
          <button
            type="button"
            className="forest-graph-icon-btn"
            aria-label="グラフを拡大"
            title="拡大"
            onClick={() => handleStepZoom(1.18)}
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
          <button
            type="button"
            className="forest-graph-icon-btn"
            aria-label={isInspectorOpen ? '詳細パネルを閉じる' : '詳細パネルを開く'}
            title="詳細パネルを切り替え"
            onClick={() => setIsInspectorOpen(prev => !prev)}
          >
            {isInspectorOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
          <button
            type="button"
            className={`forest-fullscreen-btn ${isFullscreen ? 'active' : ''}`}
            aria-pressed={isFullscreen}
            title={isFullscreen ? 'フルスクリーンを終了 (Esc)' : 'フルスクリーン表示 (F)'}
            onClick={() => setIsFullscreen(prev => !prev)}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            <span>{isFullscreen ? '終了' : 'フルスクリーン'}</span>
          </button>
        </div>
      </div>

      {/* Main Canvas + Inspector */}
      <div className={`forest-graph-body ${isInspectorOpen ? '' : 'inspector-hidden'}`}>
        <div
          ref={canvasWrapRef}
          className={`forest-graph-canvas-wrap ${isPanning ? 'is-panning' : ''}`}
          onMouseDown={e => {
            if (e.button !== 0 || (e.target as HTMLElement).closest('.forest-graph-node')) return;
            isPanningRef.current = true;
            setIsPanning(true);
            const rect = svgRef.current?.getBoundingClientRect();
            dragUnitsPerPxRef.current =
              rect && rect.width > 0 && rect.height > 0
                ? Math.max(viewWidth / rect.width, viewHeight / rect.height)
                : 1;
            panStartRef.current = {
              clientX: e.clientX,
              clientY: e.clientY,
              camX: cameraRef.current.x,
              camY: cameraRef.current.y,
            };
          }}
          onMouseMove={e => {
            if (!isPanningRef.current) return;
            cameraRef.current.x =
              panStartRef.current.camX +
              (e.clientX - panStartRef.current.clientX) * dragUnitsPerPxRef.current;
            cameraRef.current.y =
              panStartRef.current.camY +
              (e.clientY - panStartRef.current.clientY) * dragUnitsPerPxRef.current;
            scheduleCameraApply();
          }}
          onMouseUp={() => {
            if (!isPanningRef.current) return;
            isPanningRef.current = false;
            setIsPanning(false);
          }}
          onMouseLeave={() => {
            if (!isPanningRef.current) return;
            isPanningRef.current = false;
            setIsPanning(false);
          }}
        >
          {graph.nodes.length === 0 ? (
            <div className="forest-graph-empty">
              表示するマインドマップがありません。
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="forest-graph-svg"
              viewBox={`${graph.bounds.minX} ${graph.bounds.minY} ${viewWidth} ${viewHeight}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="森林俯瞰表示"
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

              <g ref={cameraGroupRef}>
                {/* Topographic Woodland Ridge Waves */}
                <g className="forest-contours" aria-hidden="true">
                  {contourPaths.map((d, idx) => (
                    <path key={idx} d={d} className="forest-contour-ring" />
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

                    const perpSign = edge.isBidirectional ? 1 : 0.45;
                    const curveOffset = Math.min(44, dist * 0.16) * perpSign;
                    const cx = (sx + ex) / 2 - uy * curveOffset;
                    const cy = (sy + ey) / 2 + ux * curveOffset;
                    const d = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;

                    const isOutgoingFromFocus = focusId === edge.sourceId;
                    const isIncomingToFocus = focusId === edge.targetId;
                    const isHoverHighlighted =
                      hoveredNodeId !== null &&
                      (hoveredNodeId === edge.sourceId || hoveredNodeId === edge.targetId);
                    const isDimmed = hoveredNodeId !== null && !isHoverHighlighted;

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
                    const isConnectedHover = hoveredNeighborIds.has(node.id);
                    const isDimmed = hoveredNodeId !== null && !isConnectedHover;
                    const palette = useSeasonColors ? node.seasonInfo : DEFAULT_CANOPY_PALETTE;
                    const iconSize = Math.round(node.radius * 1.15);
                    const labelText =
                      node.title.length > 15 ? `${node.title.slice(0, 14)}…` : node.title;

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
                        <g transform={`translate(0, ${node.radius + 18})`}>
                          <rect
                            x={-92}
                            y={-15}
                            width={184}
                            height={30}
                            rx={15}
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
                        <g transform={`translate(${node.radius * 0.68}, ${-node.radius * 0.64})`}>
                          <circle cx={0} cy={0} r={13} className="forest-node-count-bg" />
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
        {isInspectorOpen && selectedNode && (
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
            {scope === 'related' && graph.nodes.length === 1 && (
              <div className="inspector-scope-note">
                リンクされている他マップがないため、このマップのみ表示中です。
              </div>
            )}

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

            <div className="inspector-footer-actions">
              <button
                type="button"
                className="toolbar-btn inspector-open-btn"
                onClick={() => onOpenNode(selectedNode)}
              >
                <span>このマップを開く</span>
                <ArrowRight size={14} />
              </button>
              {onTrashMapFile && selectedNode.filePath && /\.mm$/i.test(selectedNode.filePath) && (
                <button
                  type="button"
                  className="toolbar-btn inspector-trash-btn"
                  onClick={() =>
                    onTrashMapFile({
                      filePath: selectedNode.filePath!,
                      title: selectedNode.title,
                      backlinkCount: selectedNode.incomingIds.length,
                    })
                  }
                >
                  <Trash2 size={14} />
                  <span>ゴミ箱へ移動</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

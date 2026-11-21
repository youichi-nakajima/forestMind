import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { FreeMindMap } from '../types/freemind';
import { computeLayout, LayoutNode, EdgePath } from '../utils/layout';
import { computeMapBounds } from '../utils/exportImage';
import { renderNoteForPopover, sanitizeNodeHtml } from '../utils/noteRenderer';
import { ExternalLink, FileText, ChevronRight, ChevronLeft, Maximize2, Map as MapIcon, Minus, X, Pencil, Trash2 } from 'lucide-react';

interface MindMapCanvasProps {
  map: FreeMindMap;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  onCancelEditing?: () => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateText: (nodeId: string, text: string) => void;
  onClearNote?: (nodeId: string) => void;
  onToggleFold: (nodeId: string) => void;
  onMoveNode: (draggedId: string, targetId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  zoomScale: number;
  setZoomScale: (updater: (prev: number) => number) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (updater: (prev: { x: number; y: number }) => { x: number; y: number }) => void;
  onFitToScreen?: () => void;
  searchMatchedIds?: string[];
  onNavigateTab?: (tabId: string) => void;
  onOpenFileLink?: (targetPath: string) => void;
  isPresentationActive?: boolean;
  visibleNodeIds?: Set<string>;
  activeNodeId?: string | null;
  autoCenter?: boolean;
  isSpotlightEnabled?: boolean;
  spotlightNodeIds?: Set<string>;
  onCopyNode?: () => void;
  onCutNode?: () => void;
  onPasteNode?: () => void;
  onDuplicateNode?: () => void;
  onReorderNode?: (nodeId: string, direction: 'up' | 'down') => void;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  map,
  selectedNodeId,
  setSelectedNodeId,
  editingNodeId,
  setEditingNodeId,
  onCancelEditing,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onUpdateText,
  onClearNote,
  onToggleFold,
  onMoveNode,
  onCopyNode,
  onCutNode,
  onPasteNode,
  onDuplicateNode,
  onReorderNode,
  onUndo,
  onRedo,
  zoomScale,
  setZoomScale,
  panOffset,
  setPanOffset,
  onFitToScreen,
  searchMatchedIds = [],
  onNavigateTab,
  onOpenFileLink,
  isPresentationActive = false,
  visibleNodeIds,
  activeNodeId,
  autoCenter = true,
  isSpotlightEnabled = true,
  spotlightNodeIds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [editingText, setEditingText] = useState('');
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
  const [isMinimapCollapsed, setIsMinimapCollapsed] = useState(false);
  const [notePopover, setNotePopover] = useState<{ nodeId: string; pinned: boolean } | null>(null);
  const noteHoverTimerRef = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 700,
  });
  const minimapSvgRef = useRef<SVGSVGElement>(null);
  const isDraggingMinimapRef = useRef(false);
  const dragViewBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // Compute layout tree, curved edge paths, arrow links, and clouds
  const { layoutNodes, edges, arrowLinks, clouds } = useMemo(() => {
    return computeLayout(map.root);
  }, [map]);

  const mapBounds = useMemo(() => computeMapBounds(layoutNodes, clouds), [layoutNodes, clouds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    updateSize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Center root node initially if pan is at default
  useEffect(() => {
    if (panOffset.x === 0 && panOffset.y === 0 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPanOffset(() => ({
        x: rect.width / 2,
        y: rect.height / 2,
      }));
    }
  }, [panOffset.x, panOffset.y, setPanOffset]);

  // Auto-center camera to active node during presentation
  useEffect(() => {
    if (!isPresentationActive || !autoCenter || !activeNodeId || !containerRef.current) {
      return;
    }

    const targetNode = layoutNodes.get(activeNodeId);
    if (!targetNode) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Smooth framing: frame active node together with its immediate parent
    // so both the branch emergence and the new node are beautifully centered
    let targetX = targetNode.x;
    let targetY = targetNode.y;
    if (targetNode.parent) {
      targetX = targetNode.x * 0.72 + targetNode.parent.x * 0.28;
      targetY = targetNode.y * 0.72 + targetNode.parent.y * 0.28;
    }

    const targetPanX = centerX - targetX * zoomScale;
    const targetPanY = centerY - targetY * zoomScale;

    setPanOffset(() => ({
      x: targetPanX,
      y: targetPanY,
    }));
  }, [isPresentationActive, autoCenter, activeNodeId, layoutNodes, zoomScale, setPanOffset]);

  const initializedEditIdRef = useRef<string | null>(null);
  const skipBlurCommitRef = useRef(false);

  // Sync editing text when editing starts
  useEffect(() => {
    if (!editingNodeId) {
      initializedEditIdRef.current = null;
      return;
    }
    if (initializedEditIdRef.current === editingNodeId) return;
    initializedEditIdRef.current = editingNodeId;
    skipBlurCommitRef.current = false;
    const target = layoutNodes.get(editingNodeId);
    if (target) {
      const rawText = target.node.text || '';
      setEditingText(rawText === '新規ノード' ? '' : rawText);
    }
  }, [editingNodeId, layoutNodes]);

  // Canvas Mouse Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'svg')) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      setSelectedNodeId(null);
      setEditingNodeId(null);
      setNotePopover(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset(() => ({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom with Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoomScale(prev => {
      const next = prev * zoomFactor;
      return Math.min(Math.max(next, 0.25), 3.0);
    });
  };

  // Global Keyboard Shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // In presentation mode, canvas editing shortcuts are disabled
      if (isPresentationActive) {
        return;
      }

      if (editingNodeId) {
        // When editing an inline input, do not trigger navigation shortcuts
        return;
      }

      if (e.key === 'Escape') {
        setNotePopover(prev => (prev ? null : prev));
      }

      // Ignore shortcuts when focus is inside form controls (Properties Panel, Search input, etc.)
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

      // Focus search input on Ctrl+F
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const searchInput = document.querySelector<HTMLInputElement>('.toolbar-search-input');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
          return;
        }
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }

      if (!selectedNodeId) return;

      // Duplicate node with Ctrl+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        onDuplicateNode?.();
        return;
      }

      // Copy node with Ctrl+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        onCopyNode?.();
        return;
      }

      // Cut node with Ctrl+X
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        onCutNode?.();
        return;
      }

      // Paste node with Ctrl+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        onPasteNode?.();
        return;
      }

      // Reorder siblings with Alt+ArrowUp / Alt+ArrowDown
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        onReorderNode?.(selectedNodeId, e.key === 'ArrowUp' ? 'up' : 'down');
        return;
      }

      const currentLayout = layoutNodes.get(selectedNodeId);

      // Arrow Key Navigation (FreeMind style)
      if (currentLayout) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const parent = currentLayout.parent;
          if (parent && parent.children.length > 1) {
            const index = parent.children.findIndex(c => c.id === currentLayout.id);
            if (index !== -1) {
              const nextIndex = e.key === 'ArrowUp'
                ? Math.max(0, index - 1)
                : Math.min(parent.children.length - 1, index + 1);
              setSelectedNodeId(parent.children[nextIndex].id);
            }
          }
          return;
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (currentLayout.side === 'root' || currentLayout.side === 'right') {
            // Move to first child on the right
            if (currentLayout.children.length > 0 && !currentLayout.node.folded) {
              setSelectedNodeId(currentLayout.children[0].id);
            }
          } else if (currentLayout.side === 'left') {
            // Move to parent towards center
            if (currentLayout.parent) {
              setSelectedNodeId(currentLayout.parent.id);
            }
          }
          return;
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (currentLayout.side === 'left') {
            // Move to first child on the left
            if (currentLayout.children.length > 0 && !currentLayout.node.folded) {
              setSelectedNodeId(currentLayout.children[0].id);
            }
          } else if (currentLayout.side === 'root') {
            // From root, move to first left child if any
            const leftChild = currentLayout.children.find(c => c.side === 'left');
            if (leftChild && !currentLayout.node.folded) {
              setSelectedNodeId(leftChild.id);
            }
          } else if (currentLayout.side === 'right') {
            // Move to parent towards center
            if (currentLayout.parent) {
              setSelectedNodeId(currentLayout.parent.id);
            }
          }
          return;
        }
      }

      if (e.key === 'Tab' || e.key === 'Insert') {
        e.preventDefault();
        onAddChild(selectedNodeId);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onAddSibling(selectedNodeId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteNode(selectedNodeId);
      } else if (e.key === ' ') {
        e.preventDefault();
        onToggleFold(selectedNodeId);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setEditingNodeId(selectedNodeId);
      }
    },
    [
      editingNodeId,
      selectedNodeId,
      layoutNodes,
      onAddChild,
      onAddSibling,
      onDeleteNode,
      onToggleFold,
      onCopyNode,
      onCutNode,
      onPasteNode,
      onDuplicateNode,
      onReorderNode,
      onUndo,
      onRedo,
      setSelectedNodeId,
      setEditingNodeId,
      isPresentationActive,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const commitEditing = () => {
    skipBlurCommitRef.current = true;
    if (editingNodeId) {
      onUpdateText(editingNodeId, editingText);
      setEditingNodeId(null);
    }
  };

  const viewLeft = -panOffset.x / zoomScale;
  const viewTop = -panOffset.y / zoomScale;
  const viewWidth = containerSize.width / zoomScale;
  const viewHeight = containerSize.height / zoomScale;

  const minimapPad = 40;
  const viewPad = 12 / zoomScale;
  const unionMinX = Math.min(mapBounds.minX - minimapPad, viewLeft - viewPad);
  const unionMaxX = Math.max(mapBounds.maxX + minimapPad, viewLeft + viewWidth + viewPad);
  const unionMinY = Math.min(mapBounds.minY - minimapPad, viewTop - viewPad);
  const unionMaxY = Math.max(mapBounds.maxY + minimapPad, viewTop + viewHeight + viewPad);

  const mmVbX = unionMinX;
  const mmVbY = unionMinY;
  const mmVbW = Math.max(1, unionMaxX - unionMinX);
  const mmVbH = Math.max(1, unionMaxY - unionMinY);

  const panToMinimapClient = useCallback(
    (clientX: number, clientY: number, vbOverride?: { x: number; y: number; w: number; h: number }) => {
      const svgEl = minimapSvgRef.current;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const vb = vbOverride || { x: mmVbX, y: mmVbY, w: mmVbW, h: mmVbH };
      const scale = Math.min(rect.width / vb.w, rect.height / vb.h);
      const drawW = vb.w * scale;
      const drawH = vb.h * scale;
      const offsetX = rect.left + (rect.width - drawW) / 2;
      const offsetY = rect.top + (rect.height - drawH) / 2;

      const wx = vb.x + (clientX - offsetX) / scale;
      const wy = vb.y + (clientY - offsetY) / scale;

      setPanOffset(() => ({
        x: containerSize.width / 2 - wx * zoomScale,
        y: containerSize.height / 2 - wy * zoomScale,
      }));
    },
    [mmVbX, mmVbY, mmVbW, mmVbH, containerSize.width, containerSize.height, zoomScale, setPanOffset]
  );

  return (
    <div
      ref={containerRef}
      className={`mindmap-canvas-container ${isPanning ? 'panning' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        className={`mindmap-viewport ${isPresentationActive ? 'presentation-mode' : ''} ${isPresentationActive && !isPanning ? 'smooth-transition' : ''
          }`}
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG Curved Connections, Clouds & Arrow Links */}
        <svg className="mindmap-edges-layer">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#e11d48" />
            </marker>
          </defs>

          {/* Clouds */}
          {clouds
            .filter(c => !isPresentationActive || visibleNodeIds?.has(c.id))
            .map(c => {
              const isDimmedCloud =
                isPresentationActive && isSpotlightEnabled && spotlightNodeIds && !spotlightNodeIds.has(c.id);
              return (
                <path
                  key={c.id}
                  d={c.d}
                  fill={c.color}
                  fillOpacity={isDimmedCloud ? 0.12 : 0.55}
                  stroke={c.strokeColor}
                  strokeOpacity={isDimmedCloud ? 0.2 : 0.85}
                  strokeWidth={c.nestingLevel > 0 ? 2.2 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className={`mindmap-cloud ${c.nestingLevel > 0 ? `mindmap-cloud-nested level-${c.nestingLevel}` : ''
                    } ${isDimmedCloud ? 'presentation-dimmed-cloud' : ''}`}
                />
              );
            })}

          {/* Branch Edges */}
          {edges
            .filter(
              edge =>
                !isPresentationActive ||
                (visibleNodeIds?.has(edge.sourceId) && visibleNodeIds?.has(edge.targetId))
            )
            .map((edge: EdgePath) => {
              const isSpotlightEdge =
                isPresentationActive &&
                isSpotlightEnabled &&
                spotlightNodeIds &&
                spotlightNodeIds.has(edge.sourceId) &&
                spotlightNodeIds.has(edge.targetId);
              const isDimmedEdge =
                isPresentationActive && isSpotlightEnabled && !isSpotlightEdge;

              return (
                <path
                  key={edge.id}
                  d={edge.d}
                  fill="none"
                  stroke={isSpotlightEdge ? '#8b5cf6' : edge.color}
                  strokeWidth={isSpotlightEdge ? Math.max(edge.width + 1.8, 3.5) : edge.width}
                  strokeLinecap="round"
                  className={`mindmap-edge ${isSpotlightEdge ? 'presentation-spotlight-edge' : ''
                    } ${isDimmedEdge ? 'presentation-dimmed-edge' : ''}`}
                />
              );
            })}

          {/* FreeMind Arrow Links */}
          {arrowLinks
            .filter(
              al =>
                !isPresentationActive ||
                (visibleNodeIds?.has(al.sourceId) && visibleNodeIds?.has(al.targetId))
            )
            .map(al => {
              const isSpotlightArrow =
                isPresentationActive &&
                isSpotlightEnabled &&
                spotlightNodeIds &&
                spotlightNodeIds.has(al.sourceId) &&
                spotlightNodeIds.has(al.targetId);
              const isDimmedArrow =
                isPresentationActive && isSpotlightEnabled && !isSpotlightArrow;

              return (
                <path
                  key={al.id}
                  d={al.d}
                  stroke={isSpotlightArrow ? '#8b5cf6' : al.color}
                  strokeWidth={isSpotlightArrow ? 3 : 2}
                  strokeDasharray="5 4"
                  fill="none"
                  markerEnd="url(#arrow)"
                  className={`mindmap-arrow-link ${isSpotlightArrow ? 'presentation-spotlight-arrow' : ''
                    } ${isDimmedArrow ? 'presentation-dimmed-arrow' : ''}`}
                />
              );
            })}
        </svg>

        {/* Nodes Layer */}
        <div className="mindmap-nodes-layer">
          {Array.from(layoutNodes.values())
            .filter(lNode => !isPresentationActive || visibleNodeIds?.has(lNode.id))
            .map((lNode: LayoutNode) => {
              const isSelected = selectedNodeId === lNode.id;
              const isSearchMatch = searchMatchedIds.includes(lNode.id);
              const isEditing = editingNodeId === lNode.id;
              const isPresentationActiveNode =
                isPresentationActive && activeNodeId === lNode.id;
              const isSpotlightPathNode =
                isPresentationActive &&
                isSpotlightEnabled &&
                spotlightNodeIds &&
                spotlightNodeIds.has(lNode.id);
              const isDimmedNode =
                isPresentationActive && isSpotlightEnabled && !isSpotlightPathNode;
              const node = lNode.node;
              const isRoot = lNode.side === 'root';
              const hasChildren = node.children.length > 0;
              const isBubble = node.style === 'bubble' || isRoot;

              // Explicit node overrides (defaults handled by CSS for Light/Dark theme support)
              const explicitColor = node.color;
              const explicitBgColor = node.backgroundColor;
              const fontSize = node.font?.size || (isRoot ? 17 : 14);
              const isBold = node.font?.bold || isRoot;
              const isItalic = node.font?.italic || false;

              // Anchor inner edge to exact connection point so text/underline never overlaps incoming edge
              const anchorLeft =
                lNode.side === 'right'
                  ? lNode.x - lNode.width / 2
                  : lNode.side === 'left'
                    ? lNode.x + lNode.width / 2
                    : lNode.x;
              const anchorTransform =
                lNode.side === 'right'
                  ? 'translate(0, -50%)'
                  : lNode.side === 'left'
                    ? 'translate(-100%, -50%)'
                    : 'translate(-50%, -50%)';

              return (
                <div
                  key={lNode.id}
                  draggable={!isRoot && !isEditing}
                  onDragStart={e => {
                    e.dataTransfer.setData('text/plain', lNode.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={e => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverNodeId !== lNode.id) {
                      setDragOverNodeId(lNode.id);
                    }
                  }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverNodeId(null);
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOverNodeId(null);
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId && draggedId !== lNode.id) {
                      onMoveNode(draggedId, lNode.id);
                    }
                  }}
                  className={`mindmap-node ${isBubble ? 'style-bubble' : 'style-fork'} ${isSelected ? 'selected' : ''
                    } ${isSearchMatch ? 'search-match' : ''} ${dragOverNodeId === lNode.id ? 'drag-target' : ''
                    } ${isRoot ? 'root-node' : ''} side-${lNode.side} ${isPresentationActiveNode ? 'presentation-active-node' : ''
                    } ${isSpotlightPathNode && !isPresentationActiveNode ? 'presentation-spotlight-path' : ''
                    } ${isDimmedNode ? 'presentation-dimmed' : ''}`}
                  style={{
                    left: `${anchorLeft}px`,
                    top: `${lNode.y}px`,
                    minWidth: `${lNode.width}px`,
                    transform: anchorTransform,
                    color: explicitColor,
                    backgroundColor: explicitBgColor,
                    fontSize: `${fontSize}px`,
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    border: isBubble ? (explicitColor ? `1.5px solid ${explicitColor}` : undefined) : 'none',
                    borderBottom: !isBubble && explicitColor ? `2.5px solid ${explicitColor}` : undefined,
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    setSelectedNodeId(lNode.id);
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    setSelectedNodeId(lNode.id);
                    setEditingNodeId(lNode.id);
                  }}
                >
                  {/* Node Icons */}
                  {node.icons.length > 0 && (
                    <span className="node-icons">
                      {node.icons.map((ic, idx) => (
                        <span key={idx} className="node-icon-badge" title={ic.builtin}>
                          {renderIconBadge(ic.builtin)}
                        </span>
                      ))}
                    </span>
                  )}

                  {/* Node Text / Inline Editor */}
                  {isEditing ? (
                    <input
                      type="text"
                      className="node-text-input"
                      value={editingText}
                      autoFocus
                      onChange={e => setEditingText(e.target.value)}
                      onBlur={() => {
                        if (skipBlurCommitRef.current) return;
                        commitEditing();
                      }}
                      onKeyDown={e => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitEditing();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.stopPropagation();
                          skipBlurCommitRef.current = true;
                          if (onCancelEditing) {
                            onCancelEditing();
                          } else {
                            setEditingNodeId(null);
                          }
                        }
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="node-text">
                      {node.htmlContent ? (
                        <span
                          className="node-html-content"
                          dangerouslySetInnerHTML={{ __html: sanitizeNodeHtml(node.htmlContent) }}
                        />
                      ) : (
                        node.text || ' '
                      )}
                    </span>
                  )}

                  {/* Link Icon */}
                  {node.link && (
                    <a
                      href={node.link.startsWith('forest://') ? '#' : node.link}
                      target={node.link.startsWith('forest://') ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      className="node-link-btn"
                      title={`リンクを開く: ${node.link}`}
                      onClick={e => {
                        e.stopPropagation();
                        if (node.link?.startsWith('forest://') && onNavigateTab) {
                          e.preventDefault();
                          onNavigateTab(node.link.replace('forest://', ''));
                        } else if (
                          node.link &&
                          onOpenFileLink &&
                          /\.(mm|md)$/i.test(node.link.trim()) &&
                          !/^https?:\/\//i.test(node.link.trim())
                        ) {
                          e.preventDefault();
                          onOpenFileLink(node.link);
                        }
                      }}
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}

                  {/* Note Indicator */}
                  {node.noteHtml && (
                    <button
                      type="button"
                      className={`node-note-indicator ${
                        notePopover?.nodeId === lNode.id && notePopover.pinned ? 'pinned' : ''
                      }`}
                      title="ノートを表示（クリックで固定）"
                      onMouseEnter={() => {
                        if (noteHoverTimerRef.current !== null) {
                          window.clearTimeout(noteHoverTimerRef.current);
                          noteHoverTimerRef.current = null;
                        }
                        setNotePopover(prev =>
                          prev?.pinned && prev.nodeId !== lNode.id
                            ? prev
                            : { nodeId: lNode.id, pinned: prev?.nodeId === lNode.id ? prev.pinned : false }
                        );
                      }}
                      onMouseLeave={() => {
                        if (noteHoverTimerRef.current !== null) {
                          window.clearTimeout(noteHoverTimerRef.current);
                        }
                        noteHoverTimerRef.current = window.setTimeout(() => {
                          setNotePopover(prev =>
                            prev && !prev.pinned && prev.nodeId === lNode.id ? null : prev
                          );
                          noteHoverTimerRef.current = null;
                        }, 180);
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setNotePopover(prev =>
                          prev && prev.pinned && prev.nodeId === lNode.id
                            ? null
                            : { nodeId: lNode.id, pinned: true }
                        );
                      }}
                    >
                      <FileText size={12} />
                    </button>
                  )}

                  {/* Fold / Unfold Handle (Hidden on root when unfolded so it never overlaps the title) */}
                  {hasChildren && (!isRoot || node.folded) && (
                    <button
                      className={`fold-handle ${node.folded ? 'folded' : 'unfolded'}`}
                      title={node.folded ? '展開する (Space)' : '折りたたむ (Space)'}
                      onClick={e => {
                        e.stopPropagation();
                        onToggleFold(lNode.id);
                      }}
                    >
                      {node.folded ? (
                        lNode.side === 'left' ? <ChevronLeft size={10} /> : <ChevronRight size={10} />
                      ) : (
                        <span className="fold-dot" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Minimap & Fit-to-Screen Overlay */}
      {!isPresentationActive && (
        <div
          className={`minimap-container ${isMinimapCollapsed ? 'collapsed' : ''}`}
          onMouseDown={e => e.stopPropagation()}
          onWheel={e => e.stopPropagation()}
        >
          <div className="minimap-header">
            <span className="minimap-title">
              <MapIcon size={12} />
              <span>全体マップ</span>
            </span>
            <div className="minimap-actions">
              {onFitToScreen && (
                <button
                  type="button"
                  className="minimap-action-btn"
                  title="全体を表示に合わせる (Ctrl+0)"
                  onClick={onFitToScreen}
                >
                  <Maximize2 size={12} />
                </button>
              )}
              <button
                type="button"
                className="minimap-action-btn"
                title={isMinimapCollapsed ? 'ミニマップを展開' : 'ミニマップを折りたたむ'}
                onClick={() => setIsMinimapCollapsed(prev => !prev)}
              >
                {isMinimapCollapsed ? <MapIcon size={12} /> : <Minus size={12} />}
              </button>
            </div>
          </div>

          {!isMinimapCollapsed && (
            <svg
              ref={minimapSvgRef}
              className="minimap-svg"
              viewBox={`${mmVbX} ${mmVbY} ${mmVbW} ${mmVbH}`}
              preserveAspectRatio="xMidYMid meet"
              onMouseDown={e => {
                e.stopPropagation();
                isDraggingMinimapRef.current = true;
                const snapshot = { x: mmVbX, y: mmVbY, w: mmVbW, h: mmVbH };
                dragViewBoxRef.current = snapshot;
                panToMinimapClient(e.clientX, e.clientY, snapshot);
              }}
              onMouseMove={e => {
                if (isDraggingMinimapRef.current) {
                  e.stopPropagation();
                  panToMinimapClient(e.clientX, e.clientY, dragViewBoxRef.current || undefined);
                }
              }}
              onMouseUp={e => {
                e.stopPropagation();
                isDraggingMinimapRef.current = false;
                dragViewBoxRef.current = null;
              }}
              onMouseLeave={() => {
                isDraggingMinimapRef.current = false;
                dragViewBoxRef.current = null;
              }}
            >
              {clouds.map(c => (
                <path
                  key={`mm-cloud-${c.id}`}
                  d={c.d}
                  fill={c.color}
                  fillOpacity={0.35}
                  stroke={c.strokeColor}
                  strokeOpacity={0.6}
                  strokeWidth={Math.max(2, mmVbW / 180)}
                />
              ))}
              {edges.map(edge => (
                <path
                  key={`mm-edge-${edge.id}`}
                  d={edge.d}
                  fill="none"
                  stroke={edge.color}
                  strokeOpacity={0.7}
                  strokeWidth={Math.max(2, mmVbW / 160)}
                />
              ))}
              {Array.from(layoutNodes.values()).map(lNode => {
                const isRoot = lNode.depth === 0;
                const isSelected = selectedNodeId === lNode.id;
                return (
                  <rect
                    key={`mm-node-${lNode.id}`}
                    x={lNode.x - lNode.width / 2}
                    y={lNode.y - lNode.height / 2}
                    width={lNode.width}
                    height={lNode.height}
                    rx={isRoot ? 10 : 5}
                    className={`minimap-node ${isRoot ? 'root' : ''} ${isSelected ? 'selected' : ''}`}
                  />
                );
              })}
              <rect
                className="minimap-viewport-rect"
                x={viewLeft}
                y={viewTop}
                width={viewWidth}
                height={viewHeight}
                strokeWidth={Math.max(3, mmVbW / 90)}
              />
            </svg>
          )}
        </div>
      )}

      {/* Note Popover */}
      {(() => {
        if (!notePopover || isPresentationActive) return null;
        const pLayout = layoutNodes.get(notePopover.nodeId);
        if (!pLayout || !pLayout.node.noteHtml) return null;

        const renderedHtml = renderNoteForPopover(pLayout.node.noteHtml);
        if (!renderedHtml) return null;

        const popWidth = Math.min(320, Math.max(220, containerSize.width - 24));
        const rawLeft = panOffset.x + pLayout.x * zoomScale - popWidth / 2;
        const rawTop = panOffset.y + (pLayout.y + pLayout.height / 2) * zoomScale + 10;
        const left = Math.max(12, Math.min(containerSize.width - popWidth - 12, rawLeft));
        const top = Math.max(12, Math.min(containerSize.height - 220, rawTop));

        return (
          <div
            className={`note-popover ${notePopover.pinned ? 'pinned' : ''}`}
            style={{ left: `${left}px`, top: `${top}px`, width: `${popWidth}px` }}
            onMouseDown={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
            onMouseEnter={() => {
              if (noteHoverTimerRef.current !== null) {
                window.clearTimeout(noteHoverTimerRef.current);
                noteHoverTimerRef.current = null;
              }
            }}
            onMouseLeave={() => {
              if (!notePopover.pinned) {
                if (noteHoverTimerRef.current !== null) {
                  window.clearTimeout(noteHoverTimerRef.current);
                }
                noteHoverTimerRef.current = window.setTimeout(() => {
                  setNotePopover(prev =>
                    prev && !prev.pinned && prev.nodeId === pLayout.id ? null : prev
                  );
                  noteHoverTimerRef.current = null;
                }, 180);
              }
            }}
          >
            <div className="note-popover-header">
              <span className="note-popover-title">
                <FileText size={13} />
                <span>{pLayout.node.text || 'ノート'}</span>
              </span>
              <div className="note-popover-actions">
                <button
                  type="button"
                  className="note-popover-btn"
                  title="プロパティパネルで編集"
                  onClick={() => {
                    setSelectedNodeId(pLayout.id);
                    setNotePopover(null);
                    window.setTimeout(() => {
                      const textarea = document.querySelector<HTMLTextAreaElement>(
                        '.properties-panel textarea'
                      );
                      if (textarea) {
                        textarea.focus();
                        textarea.scrollIntoView({ block: 'nearest' });
                      }
                    }, 60);
                  }}
                >
                  <Pencil size={12} />
                </button>
                {onClearNote && (
                  <button
                    type="button"
                    className="note-popover-btn danger"
                    title="ノートを削除"
                    onClick={() => {
                      onClearNote(pLayout.id);
                      setNotePopover(null);
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className="note-popover-btn"
                  title="閉じる (Esc)"
                  onClick={() => setNotePopover(null)}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            <div
              className="note-popover-body"
              onClick={e => {
                const anchor = (e.target as HTMLElement).closest('a');
                if (anchor) {
                  const href = anchor.getAttribute('href');
                  if (href?.startsWith('forest://') && onNavigateTab) {
                    e.preventDefault();
                    onNavigateTab(href.replace('forest://', ''));
                  } else if (
                    href &&
                    onOpenFileLink &&
                    /\.(mm|md)$/i.test(href.trim()) &&
                    !/^https?:\/\//i.test(href.trim())
                  ) {
                    e.preventDefault();
                    onOpenFileLink(href);
                  }
                }
              }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        );
      })()}
    </div>
  );
};

function renderIconBadge(builtin: string): string {
  // FreeMind built-in icon emoji mapping
  const iconMap: Record<string, string> = {
    button_ok: '✅',
    button_cancel: '❌',
    flag: '🚩',
    launch: '🚀',
    pencil: '✏️',
    wizard: '🪄',
    clanbomber: '🌲',
    folder: '📁',
    help: '❓',
    bookmark: '🔖',
    kdevelop_down: '🔽',
    attach: '📎',
    star: '⭐',
    idea: '💡',
    stop: '⛔',
    yes: '👍',
  };
  return iconMap[builtin] || '📌';
}

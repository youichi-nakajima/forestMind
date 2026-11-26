import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { FreeMindMap, FreeMindNode } from '../types/freemind';
import { computeLayout, LayoutNode, EdgePath } from '../utils/layout';
import { computeMapBounds } from '../utils/exportImage';
import { renderNoteForPopover, sanitizeNodeHtml } from '../utils/noteRenderer';
import {
  getAttributeTone,
  getDigitFromKeyboardEvent,
  resolveNodeDisplayColors,
} from '../utils/quickStyle';
import { parseForestMindLink } from '../utils/nodeLinks';
import {
  injectPortalSubtrees,
  isPortalCapableLink,
  type PortalOpenTarget,
  type ResolvedPortalPreview,
} from '../utils/portalNodes';
import type { MapFilterResult } from '../utils/mapFilter';
import { NodeContextMenu } from './NodeContextMenu';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Layers,
  Map as MapIcon,
  Maximize2,
  Minus,
  Pencil,
  RotateCcw,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface MindMapCanvasProps {
  map: FreeMindMap;
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  setSelectedNodeId: (id: string | null) => void;
  onToggleNodeSelection?: (nodeId: string) => void;
  isDarkMode?: boolean;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  onCancelEditing?: () => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateText: (nodeId: string, text: string) => void;
  onClearNote?: (nodeId: string) => void;
  onToggleFold: (nodeId: string, singleOnly?: boolean) => void;
  onMoveNode: (draggedId: string, targetId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  zoomScale: number;
  setZoomScale: (updater: (prev: number) => number) => void;
  panOffset: { x: number; y: number };
  setPanOffset: (updater: (prev: { x: number; y: number }) => { x: number; y: number }) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitToScreen?: () => void;
  searchMatchedIds?: string[];
  onNavigateTab?: (tabId: string, nodeId?: string) => void;
  onOpenFileLink?: (targetPath: string, nodeId?: string) => void;
  onSelectLocalNode?: (nodeId: string) => void;
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
  onQuickColor?: (key: string) => void;
  onQuickClearColor?: () => void;
  onQuickToggleIcon?: (key: string) => void;
  onQuickClearIcons?: () => void;
  onToggleQuickPalette?: () => void;
  isQuickPaletteOpen?: boolean;
  onCloseQuickPalette?: () => void;
  quickPaletteOverlay?: React.ReactNode;
  focusedRoot?: FreeMindNode | null;
  isFocused?: boolean;
  focusOverlay?: React.ReactNode;
  filterOverlay?: React.ReactNode;
  filterResult?: MapFilterResult;
  isFilterBarOpen?: boolean;
  onToggleFilterBar?: () => void;
  onCloseFilterBar?: () => void;
  onClearFilter?: () => void;
  onToggleFocusNode?: (nodeId: string) => void;
  onExitFocus?: () => void;
  onCopyNodeLink?: (nodeId: string) => void;
  onOpenPropertiesPanel?: () => void;
  onSplitBranch?: (nodeId: string) => void;
  onMergeMap?: (nodeId: string) => void;
  expandedPortalNodeIds?: string[];
  resolvedPortals?: Map<string, ResolvedPortalPreview>;
  onTogglePortal?: (nodeId: string) => void;
  onOpenPortalTarget?: (target: PortalOpenTarget) => void;
}

export const MindMapCanvas: React.FC<MindMapCanvasProps> = ({
  map,
  selectedNodeId,
  selectedNodeIds = [],
  setSelectedNodeId,
  onToggleNodeSelection,
  isDarkMode = false,
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
  onQuickColor,
  onQuickClearColor,
  onQuickToggleIcon,
  onQuickClearIcons,
  onToggleQuickPalette,
  isQuickPaletteOpen = false,
  onCloseQuickPalette,
  quickPaletteOverlay,
  focusedRoot,
  isFocused = false,
  focusOverlay,
  filterOverlay,
  filterResult,
  isFilterBarOpen = false,
  onToggleFilterBar,
  onCloseFilterBar,
  onClearFilter,
  onToggleFocusNode,
  onExitFocus,
  onCopyNodeLink,
  onOpenPropertiesPanel,
  onSplitBranch,
  onMergeMap,
  expandedPortalNodeIds,
  resolvedPortals,
  onTogglePortal,
  onOpenPortalTarget,
  onUndo,
  onRedo,
  zoomScale,
  setZoomScale,
  panOffset,
  setPanOffset,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  searchMatchedIds = [],
  onNavigateTab,
  onOpenFileLink,
  onSelectLocalNode,
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
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const noteHoverTimerRef = useRef<number | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 700,
  });
  const minimapSvgRef = useRef<SVGSVGElement>(null);
  const isDraggingMinimapRef = useRef(false);
  const dragViewBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const effectiveRoot = useMemo(() => {
    const baseRoot = focusedRoot ?? map.root;
    return baseRoot.folded ? { ...baseRoot, folded: false } : baseRoot;
  }, [focusedRoot, map.root]);

  const expandedPortalSet = useMemo(
    () => new Set(expandedPortalNodeIds || []),
    [expandedPortalNodeIds]
  );

  const effectivePortals = useMemo(() => {
    if (isPresentationActive || !resolvedPortals || resolvedPortals.size === 0) {
      return undefined;
    }
    return resolvedPortals;
  }, [isPresentationActive, resolvedPortals]);

  const { augmentedRoot, ghostMetaMap } = useMemo(
    () => injectPortalSubtrees(effectiveRoot, effectivePortals),
    [effectiveRoot, effectivePortals]
  );

  // Compute layout tree, curved edge paths, arrow links, and clouds
  const { layoutNodes, edges, arrowLinks, clouds } = useMemo(() => {
    return computeLayout(augmentedRoot);
  }, [augmentedRoot]);

  const portalContainers = useMemo(() => {
    if (ghostMetaMap.size === 0) return [];
    const grouped = new Map<
      string,
      {
        sourceNodeId: string;
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
        targetTitle: string;
        targetKind: 'file' | 'forest';
        targetFilePath?: string;
        targetTabId?: string;
        targetNodeId?: string;
        status: 'loaded' | 'loading' | 'error';
      }
    >();

    for (const lNode of layoutNodes.values()) {
      const meta = ghostMetaMap.get(lNode.id);
      if (!meta) continue;
      const left = lNode.x - lNode.width / 2;
      const right = lNode.x + lNode.width / 2;
      const top = lNode.y - lNode.height / 2;
      const bottom = lNode.y + lNode.height / 2;
      const existing = grouped.get(meta.portalSourceNodeId);
      if (!existing) {
        grouped.set(meta.portalSourceNodeId, {
          sourceNodeId: meta.portalSourceNodeId,
          minX: left,
          maxX: right,
          minY: top,
          maxY: bottom,
          targetTitle: meta.targetTitle,
          targetKind: meta.targetKind,
          targetFilePath: meta.targetFilePath,
          targetTabId: meta.targetTabId,
          targetNodeId: meta.isPortalEntry ? meta.originalNodeId : undefined,
          status: meta.status,
        });
      } else {
        existing.minX = Math.min(existing.minX, left);
        existing.maxX = Math.max(existing.maxX, right);
        existing.minY = Math.min(existing.minY, top);
        existing.maxY = Math.max(existing.maxY, bottom);
        if (meta.isPortalEntry) {
          existing.targetNodeId = meta.originalNodeId;
        }
      }
    }

    return Array.from(grouped.values()).map(box => ({
      ...box,
      x: box.minX - 16,
      y: box.minY - 36,
      width: Math.max(210, box.maxX - box.minX + 32),
      height: box.maxY - box.minY + 52,
    }));
  }, [ghostMetaMap, layoutNodes]);

  useEffect(() => {
    if (isPresentationActive) {
      setContextMenu(null);
    }
  }, [isPresentationActive]);

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
      setContextMenu(null);
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

      if (e.isComposing || (e as unknown as { keyCode?: number }).keyCode === 229) {
        return;
      }

      if (document.querySelector('.modal-backdrop')) {
        return;
      }

      if (e.key === 'Escape') {
        if (contextMenu) {
          e.preventDefault();
          setContextMenu(null);
          return;
        }
        if (notePopover) {
          e.preventDefault();
          setNotePopover(null);
          return;
        }
        if (isQuickPaletteOpen) {
          e.preventDefault();
          onCloseQuickPalette?.();
          return;
        }
        if (isFilterBarOpen) {
          e.preventDefault();
          onCloseFilterBar?.();
          return;
        }
        if (filterResult?.isActive) {
          e.preventDefault();
          onClearFilter?.();
          return;
        }
        if (isFocused) {
          e.preventDefault();
          onExitFocus?.();
          return;
        }
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

      // Toggle Focus Mode (Ctrl+Shift+F) - must be checked before Ctrl+F
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (selectedNodeId) {
          onToggleFocusNode?.(selectedNodeId);
        } else if (isFocused) {
          onExitFocus?.();
        }
        return;
      }

      // Toggle Map Filter Bar (Ctrl+Shift+L)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        onToggleFilterBar?.();
        return;
      }

      // Toggle Quick Style Palette via Ctrl+K or Q
      if (
        ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') ||
        (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'q')
      ) {
        e.preventDefault();
        onToggleQuickPalette?.();
        return;
      }

      // Focus search input on Ctrl+F
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
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

      // Open node context menu via keyboard (ContextMenu key or Shift+F10)
      if (
        e.key === 'ContextMenu' ||
        (e.shiftKey && e.key === 'F10' && !e.ctrlKey && !e.metaKey && !e.altKey)
      ) {
        const lNode = layoutNodes.get(selectedNodeId);
        if (lNode) {
          e.preventDefault();
          const containerRect = containerRef.current?.getBoundingClientRect();
          const originX = containerRect ? containerRect.left : 0;
          const originY = containerRect ? containerRect.top : 0;
          setContextMenu({
            nodeId: selectedNodeId,
            x: originX + panOffset.x + lNode.x * zoomScale,
            y: originY + panOffset.y + lNode.y * zoomScale + 12,
          });
          return;
        }
      }

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

      // Quick color (1-6 / 0) and icon (Alt+1-9 / Alt+0) shortcuts
      const digit = getDigitFromKeyboardEvent(e);
      if (digit !== null) {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (digit === '0') {
            onQuickClearIcons?.();
          } else {
            onQuickToggleIcon?.(digit);
          }
          return;
        }
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (digit === '0') {
            e.preventDefault();
            onQuickClearColor?.();
            return;
          }
          if (digit >= '1' && digit <= '6') {
            e.preventDefault();
            onQuickColor?.(digit);
            return;
          }
        }
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
        if (isFocused && selectedNodeId === effectiveRoot.id) {
          onAddChild(selectedNodeId);
        } else {
          onAddSibling(selectedNodeId);
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteNode(selectedNodeId);
      } else if (e.key === ' ') {
        e.preventDefault();
        onToggleFold(selectedNodeId, false);
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
      onQuickColor,
      onQuickClearColor,
      onQuickToggleIcon,
      onQuickClearIcons,
      onToggleQuickPalette,
      isQuickPaletteOpen,
      onCloseQuickPalette,
      contextMenu,
      notePopover,
      isFocused,
      effectiveRoot.id,
      isFilterBarOpen,
      filterResult,
      onToggleFilterBar,
      onCloseFilterBar,
      onClearFilter,
      onToggleFocusNode,
      onExitFocus,
      panOffset.x,
      panOffset.y,
      zoomScale,
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

  const handleLinkClick = (e: React.MouseEvent, rawHref: string) => {
    const parsed = parseForestMindLink(rawHref);
    if (parsed.kind !== 'external') {
      e.preventDefault();
    }
    if (parsed.kind === 'forest' && onNavigateTab) {
      onNavigateTab(parsed.tabId, parsed.nodeId);
    } else if (parsed.kind === 'file' && onOpenFileLink) {
      onOpenFileLink(parsed.filePath, parsed.nodeId);
    } else if (parsed.kind === 'localNode' && onSelectLocalNode) {
      onSelectLocalNode(parsed.nodeId);
    }
  };

  const isFilterActive = !isPresentationActive && Boolean(filterResult?.isActive);

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

          {/* Portal Preview Containers (#8) */}
          {portalContainers.map(box => (
            <rect
              key={`portal-box-${box.sourceNodeId}`}
              x={box.x}
              y={box.y}
              width={box.width}
              height={box.height}
              rx={14}
              className={`portal-container-rect status-${box.status}`}
            />
          ))}

          {/* Clouds */}
          {clouds
            .filter(c => !isPresentationActive || visibleNodeIds?.has(c.id))
            .map(c => {
              const isDimmedCloud =
                isPresentationActive && isSpotlightEnabled && spotlightNodeIds && !spotlightNodeIds.has(c.id);
              const isFilterDimmedCloud =
                isFilterActive && !filterResult!.highlightPathIdSet.has(c.id);
              return (
                <path
                  key={c.id}
                  d={c.d}
                  fill={c.color}
                  fillOpacity={isDimmedCloud || isFilterDimmedCloud ? 0.12 : 0.55}
                  stroke={c.strokeColor}
                  strokeOpacity={isDimmedCloud || isFilterDimmedCloud ? 0.2 : 0.85}
                  strokeWidth={c.nestingLevel > 0 ? 2.2 : 2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className={`mindmap-cloud ${c.nestingLevel > 0 ? `mindmap-cloud-nested level-${c.nestingLevel}` : ''
                    } ${isDimmedCloud ? 'presentation-dimmed-cloud' : ''} ${
                      isFilterDimmedCloud ? 'filter-dimmed-cloud' : ''
                    }`}
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
              const isGhostEdge = ghostMetaMap.has(edge.targetId);
              const isSpotlightEdge =
                isPresentationActive &&
                isSpotlightEnabled &&
                spotlightNodeIds &&
                spotlightNodeIds.has(edge.sourceId) &&
                spotlightNodeIds.has(edge.targetId);
              const isDimmedEdge =
                isPresentationActive && isSpotlightEnabled && !isSpotlightEdge;
              const isFilterEdgeHighlight =
                isFilterActive &&
                filterResult!.highlightPathIdSet.has(edge.sourceId) &&
                filterResult!.highlightPathIdSet.has(edge.targetId);
              const isFilterDimmedEdge = isFilterActive && !isFilterEdgeHighlight;

              return (
                <path
                  key={edge.id}
                  d={edge.d}
                  fill="none"
                  stroke={isSpotlightEdge ? '#8b5cf6' : isGhostEdge ? '#0d9488' : edge.color}
                  strokeWidth={isSpotlightEdge ? Math.max(edge.width + 1.8, 3.5) : edge.width}
                  strokeDasharray={isGhostEdge ? '5 4' : undefined}
                  strokeOpacity={isGhostEdge ? 0.78 : undefined}
                  strokeLinecap="round"
                  className={`mindmap-edge ${isGhostEdge ? 'portal-ghost-edge' : ''} ${isSpotlightEdge ? 'presentation-spotlight-edge' : ''
                    } ${isDimmedEdge ? 'presentation-dimmed-edge' : ''} ${
                      isFilterDimmedEdge ? 'filter-dimmed-edge' : ''
                    }`}
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
              const isFilterArrowHighlight =
                isFilterActive &&
                filterResult!.highlightPathIdSet.has(al.sourceId) &&
                filterResult!.highlightPathIdSet.has(al.targetId);
              const isFilterDimmedArrow = isFilterActive && !isFilterArrowHighlight;

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
                    } ${isDimmedArrow ? 'presentation-dimmed-arrow' : ''} ${
                      isFilterDimmedArrow ? 'filter-dimmed-arrow' : ''
                    }`}
                />
              );
            })}
        </svg>

        {/* Nodes Layer */}
        <div className="mindmap-nodes-layer">
          {/* Portal Container Headers (#8) */}
          {!isPresentationActive &&
            portalContainers.map(box => (
              <div
                key={`portal-header-${box.sourceNodeId}`}
                className={`portal-container-header status-${box.status}`}
                style={{ left: `${box.x + 10}px`, top: `${box.y + 6}px` }}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
              >
                <span
                  className="portal-header-badge"
                  title={box.targetFilePath || box.targetTitle}
                >
                  <Layers size={11} />
                  <span className="portal-header-title">{box.targetTitle}</span>
                  <span className="portal-readonly-tag">参照専用</span>
                </span>
                {onOpenPortalTarget && (box.targetFilePath || box.targetTabId) && (
                  <button
                    type="button"
                    className="portal-open-tab-btn"
                    title="このマップを別タブで開く"
                    onClick={() =>
                      onOpenPortalTarget({
                        kind: box.targetKind,
                        filePath: box.targetFilePath,
                        tabId: box.targetTabId,
                        nodeId: box.targetNodeId,
                      })
                    }
                  >
                    <span>別タブで開く</span>
                    <ArrowUpRight size={11} />
                  </button>
                )}
                {onTogglePortal && (
                  <button
                    type="button"
                    className="portal-close-btn"
                    title="ポータル展開を閉じる"
                    onClick={() => onTogglePortal(box.sourceNodeId)}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}

          {Array.from(layoutNodes.values())
            .filter(lNode => !isPresentationActive || visibleNodeIds?.has(lNode.id))
            .map((lNode: LayoutNode) => {
              const ghostMeta = ghostMetaMap.get(lNode.id);
              const isPortalExpanded = !ghostMeta && expandedPortalSet.has(lNode.id);
              const isSelected = !ghostMeta && selectedNodeId === lNode.id;
              const isMultiSelected = !ghostMeta && !isSelected && selectedNodeIds.includes(lNode.id);
              const isSearchMatch = !ghostMeta && searchMatchedIds.includes(lNode.id);
              const isEditing = !ghostMeta && editingNodeId === lNode.id;
              const isPresentationActiveNode =
                isPresentationActive && activeNodeId === lNode.id;
              const isSpotlightPathNode =
                isPresentationActive &&
                isSpotlightEnabled &&
                spotlightNodeIds &&
                spotlightNodeIds.has(lNode.id);
              const isDimmedNode =
                isPresentationActive && isSpotlightEnabled && !isSpotlightPathNode;
              const isFilterMatch =
                isFilterActive && filterResult!.matchedNodeIdSet.has(lNode.id);
              const isFilterPath =
                isFilterActive &&
                !isFilterMatch &&
                filterResult!.highlightPathIdSet.has(lNode.id);
              const isFilterDimmed =
                isFilterActive && !filterResult!.highlightPathIdSet.has(lNode.id);
              const hiddenMatchCount = isFilterActive
                ? (filterResult!.hiddenMatchCounts.get(lNode.id) ?? 0)
                : 0;
              const node = lNode.node;
              const isDisplayRoot = lNode.side === 'root';
              const hasChildren = node.children.length > 0;
              const isBubble = node.style === 'bubble' || isDisplayRoot;

              // Explicit node overrides with dark-mode high-contrast adaptation
              const resolvedColors = resolveNodeDisplayColors(node, isDarkMode);
              const borderToken = resolvedColors.borderColor || resolvedColors.color;
              const fontSize = node.font?.size || (isDisplayRoot ? 17 : 14);
              const isBold = node.font?.bold || isDisplayRoot;
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
                  draggable={!ghostMeta && !isDisplayRoot && !isEditing}
                  onDragStart={e => {
                    if (ghostMeta) {
                      e.preventDefault();
                      return;
                    }
                    e.dataTransfer.setData('text/plain', lNode.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={e => {
                    if (ghostMeta) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverNodeId !== lNode.id) {
                      setDragOverNodeId(lNode.id);
                    }
                  }}
                  onDragLeave={e => {
                    if (ghostMeta) return;
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverNodeId(null);
                    }
                  }}
                  onDrop={e => {
                    if (ghostMeta) return;
                    e.preventDefault();
                    setDragOverNodeId(null);
                    const draggedId = e.dataTransfer.getData('text/plain');
                    if (draggedId && draggedId !== lNode.id) {
                      onMoveNode(draggedId, lNode.id);
                    }
                  }}
                  className={`mindmap-node ${isBubble ? 'style-bubble' : 'style-fork'} ${isSelected ? 'selected' : ''
                    } ${isMultiSelected ? 'multi-selected' : ''} ${isSearchMatch ? 'search-match' : ''} ${dragOverNodeId === lNode.id ? 'drag-target' : ''
                    } ${isDisplayRoot ? 'root-node' : ''} side-${lNode.side} ${isPresentationActiveNode ? 'presentation-active-node' : ''
                    } ${isSpotlightPathNode && !isPresentationActiveNode ? 'presentation-spotlight-path' : ''
                    } ${isDimmedNode ? 'presentation-dimmed' : ''} ${
                      isFilterMatch ? 'filter-match' : ''
                    } ${isFilterPath ? 'filter-path' : ''} ${
                      isFilterDimmed ? 'filter-dimmed' : ''
                    } ${ghostMeta ? `portal-ghost-node status-${ghostMeta.status}` : ''} ${
                      isPortalExpanded ? 'portal-host-expanded' : ''
                    }`}
                  title={
                    ghostMeta && ghostMeta.status === 'loaded'
                      ? `クリックで元マップ「${ghostMeta.targetTitle}」を開く (参照専用)`
                      : undefined
                  }
                  style={{
                    left: `${anchorLeft}px`,
                    top: `${lNode.y}px`,
                    minWidth: `${lNode.width}px`,
                    transform: anchorTransform,
                    color: resolvedColors.color,
                    backgroundColor: resolvedColors.backgroundColor,
                    fontSize: `${fontSize}px`,
                    fontWeight: isBold ? 'bold' : 'normal',
                    fontStyle: isItalic ? 'italic' : 'normal',
                    border: isBubble ? (borderToken ? `1.5px solid ${borderToken}` : undefined) : 'none',
                    borderBottom: !isBubble && borderToken ? `2.5px solid ${borderToken}` : undefined,
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    setContextMenu(null);
                    if (ghostMeta) {
                      if (ghostMeta.status === 'loaded' && onOpenPortalTarget) {
                        onOpenPortalTarget({
                          kind: ghostMeta.targetKind,
                          filePath: ghostMeta.targetFilePath,
                          tabId: ghostMeta.targetTabId,
                          nodeId: ghostMeta.originalNodeId,
                        });
                      }
                      return;
                    }
                    if ((e.ctrlKey || e.metaKey) && onToggleNodeSelection) {
                      onToggleNodeSelection(lNode.id);
                    } else {
                      setSelectedNodeId(lNode.id);
                    }
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    setContextMenu(null);
                    if (ghostMeta) {
                      if (ghostMeta.status === 'loaded' && onOpenPortalTarget) {
                        onOpenPortalTarget({
                          kind: ghostMeta.targetKind,
                          filePath: ghostMeta.targetFilePath,
                          tabId: ghostMeta.targetTabId,
                          nodeId: ghostMeta.originalNodeId,
                        });
                      }
                      return;
                    }
                    setSelectedNodeId(lNode.id);
                    setEditingNodeId(lNode.id);
                  }}
                  onContextMenu={e => {
                    if (ghostMeta || isPresentationActive) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    if (!selectedNodeIds.includes(lNode.id) && selectedNodeId !== lNode.id) {
                      setSelectedNodeId(lNode.id);
                    }
                    setNotePopover(null);
                    setContextMenu({
                      nodeId: lNode.id,
                      x: e.clientX,
                      y: e.clientY,
                    });
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
                          onClick={e => {
                            const anchor = (e.target as HTMLElement).closest('a');
                            if (anchor) {
                              const href = anchor.getAttribute('href');
                              if (href) {
                                e.stopPropagation();
                                handleLinkClick(e, href);
                              }
                            }
                          }}
                          dangerouslySetInnerHTML={{ __html: sanitizeNodeHtml(node.htmlContent) }}
                        />
                      ) : (
                        node.text || ' '
                      )}
                    </span>
                  )}

                  {/* Link Icon & Portal Preview Toggle (#8) */}
                  {!ghostMeta && node.link && (() => {
                    const parsedLink = parseForestMindLink(node.link);
                    const isExternalLink = parsedLink.kind === 'external';
                    const portalCapable = isPortalCapableLink(node.link);
                    return (
                      <>
                        <a
                          href={isExternalLink ? node.link : '#'}
                          target={isExternalLink ? '_blank' : undefined}
                          rel="noopener noreferrer"
                          className="node-link-btn"
                          title={`リンクを開く: ${node.link}`}
                          onClick={e => {
                            e.stopPropagation();
                            handleLinkClick(e, node.link!);
                          }}
                        >
                          <ExternalLink size={12} />
                        </a>
                        {portalCapable && onTogglePortal && (
                          <button
                            type="button"
                            className={`node-portal-btn ${isPortalExpanded ? 'active' : ''}`}
                            title={
                              isPortalExpanded
                                ? 'ポータル展開を閉じる'
                                : 'リンク先ツリーをポータル展開 (参照専用)'
                            }
                            aria-label={
                              isPortalExpanded
                                ? 'ポータル展開を閉じる'
                                : 'リンク先ツリーをポータル展開'
                            }
                            onClick={e => {
                              e.stopPropagation();
                              onTogglePortal(lNode.id);
                            }}
                          >
                            <Layers size={12} />
                          </button>
                        )}
                      </>
                    );
                  })()}

                  {/* Note Indicator */}
                  {!ghostMeta && node.noteHtml && (
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

                  {/* Compact Attribute Tags */}
                  {node.attributes.length > 0 && (
                    <span
                      className="node-attr-tags"
                      title={node.attributes.map(a => `${a.name}: ${a.value}`).join('\n')}
                    >
                      {node.attributes.slice(0, 3).map((attr, idx) => (
                        <span
                          key={`${attr.name}-${idx}`}
                          className={`node-attr-tag tone-${getAttributeTone(attr.name, attr.value)}`}
                        >
                          <span className="node-attr-name">{attr.name}:</span>
                          <span className="node-attr-val">{attr.value}</span>
                        </span>
                      ))}
                      {node.attributes.length > 3 && (
                        <span className="node-attr-more">+{node.attributes.length - 3}</span>
                      )}
                    </span>
                  )}

                  {/* Fold / Unfold Handle (Hidden on root when unfolded so it never overlaps the title) */}
                  {!ghostMeta && hasChildren && (!isDisplayRoot || node.folded) && (
                    <button
                      className={`fold-handle ${node.folded ? 'folded' : 'unfolded'}`}
                      title={node.folded ? '展開する (Space)' : '折りたたむ (Space)'}
                      onClick={e => {
                        e.stopPropagation();
                        onToggleFold(lNode.id, true);
                      }}
                    >
                      {node.folded ? (
                        lNode.side === 'left' ? <ChevronLeft size={10} /> : <ChevronRight size={10} />
                      ) : (
                        <span className="fold-dot" />
                      )}
                      {node.folded && hiddenMatchCount > 0 && (
                        <span
                          className="filter-hidden-match-badge"
                          title={`折りたたみ内に ${hiddenMatchCount} 件の一致`}
                        >
                          +{hiddenMatchCount}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Focus Mode Breadcrumb Overlay */}
      {!isPresentationActive && focusOverlay}

      {/* Map Filter Floating Overlay */}
      {!isPresentationActive && filterOverlay}

      {/* Quick Style Floating Palette */}
      {!isPresentationActive && quickPaletteOverlay}

      {/* Minimap & Zoom Overlay */}
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

          {(onZoomOut || onZoomIn || onResetZoom || onFitToScreen) && (
            <div className="minimap-zoom-bar">
              {onZoomOut && (
                <button
                  type="button"
                  className="minimap-action-btn"
                  title="ズームアウト"
                  aria-label="ズームアウト"
                  onClick={onZoomOut}
                >
                  <ZoomOut size={13} />
                </button>
              )}
              <button
                type="button"
                className="minimap-zoom-percent"
                title="表示を 100% / 中央にリセット"
                onClick={onResetZoom}
              >
                {Math.round(zoomScale * 100)}%
              </button>
              {onZoomIn && (
                <button
                  type="button"
                  className="minimap-action-btn"
                  title="ズームイン"
                  aria-label="ズームイン"
                  onClick={onZoomIn}
                >
                  <ZoomIn size={13} />
                </button>
              )}
              {(onResetZoom || onFitToScreen) && <span className="minimap-zoom-divider" />}
              {onResetZoom && (
                <button
                  type="button"
                  className="minimap-action-btn"
                  title="表示リセット (100% / 中央)"
                  aria-label="表示リセット"
                  onClick={onResetZoom}
                >
                  <RotateCcw size={12} />
                </button>
              )}
              {onFitToScreen && (
                <button
                  type="button"
                  className="minimap-action-btn"
                  title="マップ全体を表示に合わせる (Ctrl+0)"
                  aria-label="マップ全体を表示に合わせる"
                  onClick={onFitToScreen}
                >
                  <Maximize2 size={12} />
                </button>
              )}
            </div>
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
                  if (href) {
                    handleLinkClick(e, href);
                  }
                }
              }}
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        );
      })()}

      {/* Node Context Menu */}
      {!isPresentationActive && contextMenu && (() => {
        const ctxLayout = layoutNodes.get(contextMenu.nodeId);
        if (!ctxLayout || ghostMetaMap.has(ctxLayout.id)) return null;
        const ctxNode = ctxLayout.node;
        const hasNonRootInSelection =
          selectedNodeIds.some(id => id !== map.root.id) || ctxLayout.id !== map.root.id;
        return (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeText={ctxNode.text}
            selectedCount={selectedNodeIds.length > 0 ? selectedNodeIds.length : 1}
            isTrueMapRoot={ctxLayout.id === map.root.id}
            isFocusedRoot={Boolean(isFocused && ctxLayout.id === effectiveRoot.id)}
            canModifySelection={hasNonRootInSelection}
            hasChildren={ctxNode.children.length > 0}
            isFolded={Boolean(ctxNode.folded)}
            onAddChild={() => onAddChild(ctxLayout.id)}
            onAddSibling={() => onAddSibling(ctxLayout.id)}
            onEditText={() => {
              setSelectedNodeId(ctxLayout.id);
              setEditingNodeId(ctxLayout.id);
            }}
            onToggleFold={() => onToggleFold(ctxLayout.id, false)}
            onCopy={() => onCopyNode?.()}
            onCut={() => onCutNode?.()}
            onPaste={() => onPasteNode?.()}
            onDuplicate={() => onDuplicateNode?.()}
            onCopyNodeLink={() => onCopyNodeLink?.(ctxLayout.id)}
            onToggleFocus={() => onToggleFocusNode?.(ctxLayout.id)}
            onOpenQuickPalette={() => {
              if (!isQuickPaletteOpen) {
                onToggleQuickPalette?.();
              }
            }}
            onOpenProperties={() => onOpenPropertiesPanel?.()}
            onSplitBranch={onSplitBranch ? () => onSplitBranch(ctxLayout.id) : undefined}
            onMergeMap={onMergeMap ? () => onMergeMap(ctxLayout.id) : undefined}
            onTogglePortal={
              onTogglePortal && ctxNode.link && isPortalCapableLink(ctxNode.link)
                ? () => onTogglePortal(ctxLayout.id)
                : undefined
            }
            isPortalExpanded={expandedPortalSet.has(ctxLayout.id)}
            onDelete={() => onDeleteNode(ctxLayout.id)}
            onClose={() => setContextMenu(null)}
          />
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

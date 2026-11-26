import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useMindMap } from './hooks/useMindMap';
import { usePresentationPlayback } from './hooks/usePresentationPlayback';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { MindMapCanvas } from './components/MindMapCanvas';
import { NodePropertiesPanel } from './components/NodePropertiesPanel';
import { PresentationControls } from './components/PresentationControls';
import { ForestOverview } from './components/ForestOverview';
import { HelpModal } from './components/HelpModal';
import { AboutModal } from './components/AboutModal';
import { QuickStylePalette } from './components/QuickStylePalette';
import { FreeMindSearcherModal } from './components/FreeMindSearcherModal';
import { FocusBreadcrumbBar } from './components/FocusBreadcrumbBar';
import { MapFilterBar } from './components/MapFilterBar';
import { FreeMindNode, FreeMindMap } from './types/freemind';
import { parseFreeMindXml } from './parser/freemindParser';
import { resumeAudioContext } from './utils/audio';
import { computeLayout } from './utils/layout';
import { computeMapBounds, exportMindMapAsSvg, exportMindMapAsPng } from './utils/exportImage';
import { persistTabsToStorage, prepareTabsForAppClose } from './utils/tabStorage';
import { buildNodeLinkText } from './utils/nodeLinks';
import { sanitizeDownloadFileName } from './utils/treeUtils';
import {
  countActiveFilterConditions,
  EMPTY_MAP_FILTER,
  evaluateMapFilter,
  toggleFilterAttribute,
  toggleFilterColor,
  toggleFilterIcon,
  type MapFilterCriteria,
} from './utils/mapFilter';
import { isNodeInsideSubtree, resolveFocusedSubtree } from './utils/focusMode';
import {
  applyQuickColorToNodes,
  clearColorOnNodes,
  clearIconsOnNodes,
  QUICK_COLOR_PRESETS,
  QUICK_ICON_PRESETS,
  toggleAttributeOnNodes,
  toggleIconOnNodes,
  type QuickColorPreset,
} from './utils/quickStyle';

export const App: React.FC = () => {
  const {
    tabs,
    activeTabId,
    activeFilePath,
    initialReloadTabIds,
    storageLoadFailedTitles,
    storageSaveFailed,
    setActiveTabId,
    createNewTab,
    markTabSaved,
    openFileInTab,
    reconcileTabWithDisk,
    closeTab,
    togglePinTab,
    reorderTabs,
    map,
    selectedNodeId,
    setSelectedNodeId,
    editingNodeId,
    setEditingNodeId,
    cancelEditing,
    addChildNode,
    addSiblingNode,
    deleteNode,
    deleteNodes,
    updateNodeText,
    toggleFold,
    unfoldAll,
    foldAll,
    updateNodeProperties,
    batchUpdateNodes,
    moveNode,
    copyNode,
    cutNode,
    pasteNode,
    duplicateNode,
    reorderNode,
    undo,
    redo,
    canUndo,
    canRedo,
    loadMapFromXml,
    importMarkdown,
    resetToDefault,
    exportXml,
    exportTabXml,
    exportMarkdown,
    searchQuery,
    setSearchQuery,
    searchIndex,
    searchResults,
    handleNextSearch,
    handlePrevSearch,
    revealAndSelectNode,
    openMapAndSelectNode,
  } = useMindMap();

  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isForestViewOpen, setIsForestViewOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isSearcherOpen, setIsSearcherOpen] = useState(false);
  const [extraSelectedNodeIds, setExtraSelectedNodeIds] = useState<string[]>([]);
  const [isQuickPaletteOpen, setIsQuickPaletteOpen] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [filterCriteria, setFilterCriteria] = useState<MapFilterCriteria>(EMPTY_MAP_FILTER);
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);
  const [filterMatchIndex, setFilterMatchIndex] = useState(0);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dark mode state with persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('forestmind_dark_mode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  });

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('forestmind_dark_mode', String(next));
      return next;
    });
  }, []);

  // Toast feedback helper
  const toastTimerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 1800);
  }, []);

  // Warn once if some saved tabs could not be restored from localStorage
  const hasWarnedLoadFailureRef = useRef(false);
  useEffect(() => {
    if (hasWarnedLoadFailureRef.current || storageLoadFailedTitles.length === 0) return;
    hasWarnedLoadFailureRef.current = true;
    window.alert(
      `前回のセッションから一部のタブを復元できませんでした:\n${storageLoadFailedTitles.join('\n')}\n\n` +
      '元のデータはブラウザ内 (localStorage の "forestmind_corrupt_tabs_backup") に退避しています。'
    );
  }, [storageLoadFailedTitles]);

  // Warn when auto-save to localStorage fails (e.g. quota exceeded)
  const hasWarnedSaveFailureRef = useRef(false);
  useEffect(() => {
    if (!storageSaveFailed) {
      hasWarnedSaveFailureRef.current = false;
      return;
    }
    if (hasWarnedSaveFailureRef.current) return;
    hasWarnedSaveFailureRef.current = true;
    window.alert(
      'ブラウザ内への自動保存に失敗しました（容量超過の可能性があります）。\n' +
      '未保存のマップはファイルに保存し、不要なタブを閉じてください。'
    );
  }, [storageSaveFailed]);

  // Toggle cinema fullscreen mode
  const handleToggleCinemaMode = useCallback(() => {
    setIsCinemaMode(prev => {
      const next = !prev;
      if (next) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        }
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => { });
        }
      }
      return next;
    });
  }, []);

  // Listen to fullscreen changes from Esc or browser chrome
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsCinemaMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Presentation Playback Hook
  const {
    isActive: isPresentationActive,
    isPlaying: isPresentationPlaying,
    mode: presentationMode,
    setMode: setPresentationMode,
    speed: presentationSpeed,
    setSpeed: setPresentationSpeed,
    autoCenter,
    setAutoCenter,
    isSoundEnabled,
    setIsSoundEnabled,
    isSpotlightEnabled,
    setIsSpotlightEnabled,
    spotlightNodeIds,
    currentStepIndex,
    steps: presentationSteps,
    currentStep: activePresentationStep,
    visibleNodeIds: presentationVisibleNodeIds,
    activeNodeId: presentationActiveNodeId,
    startPresentation,
    stopPresentation,
    togglePlay: togglePresentationPlay,
    nextStep: nextPresentationStep,
    prevStep: prevPresentationStep,
    goToStep: goToPresentationStep,
  } = usePresentationPlayback({
    rootNode: map.root,
    onActiveNodeChange: nodeId => {
      setSelectedNodeId(nodeId);
    },
  });

  const handleStopPresentation = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
    setIsCinemaMode(false);
    stopPresentation();
  }, [stopPresentation]);

  // Ensure fullscreen / cinema mode always exits when leaving presentation mode
  useEffect(() => {
    if (!isPresentationActive) {
      setIsCinemaMode(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    }
  }, [isPresentationActive]);

  // Toggle presentation via F5 or button
  const handleTogglePresentation = useCallback(() => {
    resumeAudioContext();
    if (isPresentationActive) {
      handleStopPresentation();
    } else {
      setIsForestViewOpen(false);
      setIsQuickPaletteOpen(false);
      setIsFilterBarOpen(false);
      setFocusedNodeId(null);
      setExtraSelectedNodeIds([]);
      startPresentation();
    }
  }, [isPresentationActive, handleStopPresentation, startPresentation]);

  // Global F5 key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleTogglePresentation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePresentation]);

  // Stop presentation on tab switch (only when the active tab actually changes)
  const prevActiveTabIdRef = useRef(activeTabId);
  useEffect(() => {
    if (prevActiveTabIdRef.current !== activeTabId) {
      prevActiveTabIdRef.current = activeTabId;
      setExtraSelectedNodeIds([]);
      setIsQuickPaletteOpen(false);
      setFocusedNodeId(null);
      setFilterCriteria(EMPTY_MAP_FILTER);
      setFilterMatchIndex(0);
      stopPresentation();
    }
  }, [activeTabId, stopPresentation]);

  const focusState = useMemo(
    () => resolveFocusedSubtree(map.root, focusedNodeId),
    [map.root, focusedNodeId]
  );

  useEffect(() => {
    if (focusedNodeId && !focusState.isFocused) {
      setFocusedNodeId(null);
    }
  }, [focusedNodeId, focusState.isFocused]);

  const prevFocusedNodeIdRef = useRef<string | null>(null);
  useEffect(() => {
    const activeFocusId = focusState.isFocused ? focusState.activeRoot.id : null;
    if (prevFocusedNodeIdRef.current !== activeFocusId) {
      prevFocusedNodeIdRef.current = activeFocusId;
      const canvasEl = document.querySelector('.mindmap-canvas-container');
      const viewW = canvasEl ? canvasEl.clientWidth : window.innerWidth;
      const viewH = canvasEl ? canvasEl.clientHeight : window.innerHeight - 100;
      setZoomScale(1.0);
      setPanOffset({ x: viewW / 2, y: viewH / 2 });
    }
  }, [focusState.isFocused, focusState.activeRoot.id]);

  const filterResult = useMemo(
    () => evaluateMapFilter(focusState.activeRoot, filterCriteria),
    [focusState.activeRoot, filterCriteria]
  );

  const activeFilterCount = useMemo(
    () => countActiveFilterConditions(filterCriteria),
    [filterCriteria]
  );

  useEffect(() => {
    if (filterResult.matchedNodeIds.length === 0 || filterMatchIndex >= filterResult.matchedNodeIds.length) {
      setFilterMatchIndex(0);
    }
  }, [filterResult.matchedNodeIds.length, filterMatchIndex]);

  const revealNodeWithinScope = useCallback(
    (nodeId: string, targetTabId?: string) => {
      if (
        (!targetTabId || targetTabId === activeTabId) &&
        focusState.isFocused &&
        !isNodeInsideSubtree(focusState.activeRoot, nodeId)
      ) {
        setFocusedNodeId(null);
      }
      revealAndSelectNode(nodeId, targetTabId);
    },
    [activeTabId, focusState.isFocused, focusState.activeRoot, revealAndSelectNode]
  );

  const handleToggleFocusNode = useCallback(
    (targetId?: string) => {
      const resolvedId = targetId ?? selectedNodeId;
      if (!resolvedId || resolvedId === map.root.id) {
        setFocusedNodeId(null);
        return;
      }
      setFocusedNodeId(prev => (prev === resolvedId ? null : resolvedId));
      setSelectedNodeId(resolvedId);
      setExtraSelectedNodeIds([]);
    },
    [selectedNodeId, map.root.id, setSelectedNodeId]
  );

  const handleCopyNodeLink = useCallback(
    async (nodeId: string) => {
      const linkText = buildNodeLinkText({
        tabId: activeTabId,
        nodeId,
        filePath: activeFilePath,
      });
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(linkText);
          copied = true;
        }
      } catch {
        copied = false;
      }
      if (!copied) {
        try {
          const textarea = document.createElement('textarea');
          textarea.value = linkText;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          copied = document.execCommand('copy');
          document.body.removeChild(textarea);
        } catch {
          copied = false;
        }
      }
      if (copied) {
        showToast('🔗 ノードへのリンクをコピーしました');
      } else {
        showToast('リンクのコピーに失敗しました');
      }
    },
    [activeTabId, activeFilePath, showToast]
  );

  const handleSelectLocalNode = useCallback(
    (nodeId: string) => {
      if (findNodeInTree(map.root, nodeId)) {
        revealNodeWithinScope(nodeId);
      } else {
        showToast('指定されたノードがマップ内に見つかりませんでした');
      }
    },
    [map.root, revealNodeWithinScope, showToast]
  );

  const handleNextFilterMatch = useCallback(() => {
    const ids = filterResult.matchedNodeIds;
    if (ids.length === 0) return;
    const nextIdx = (filterMatchIndex + 1) % ids.length;
    setFilterMatchIndex(nextIdx);
    revealNodeWithinScope(ids[nextIdx]);
  }, [filterResult.matchedNodeIds, filterMatchIndex, revealNodeWithinScope]);

  const handlePrevFilterMatch = useCallback(() => {
    const ids = filterResult.matchedNodeIds;
    if (ids.length === 0) return;
    const prevIdx = (filterMatchIndex - 1 + ids.length) % ids.length;
    setFilterMatchIndex(prevIdx);
    revealNodeWithinScope(ids[prevIdx]);
  }, [filterResult.matchedNodeIds, filterMatchIndex, revealNodeWithinScope]);

  // Handler for jumping from local folder search to map & node
  const handleOpenSearcherNode = async (
    targetMap: FreeMindMap,
    title: string,
    nodeId: string,
    filePath?: string
  ) => {
    let mapToOpen = targetMap;
    let resolvedFilePath = filePath;

    if (filePath && window.electronAPI?.readFileByPath) {
      const normalizedPath = filePath.toLowerCase();
      const alreadyOpen = tabsRef.current.some(
        t => t.filePath?.toLowerCase() === normalizedPath
      );
      if (!alreadyOpen) {
        try {
          const res = await window.electronAPI.readFileByPath(filePath);
          if (res.ok && res.content !== undefined && res.filePath) {
            mapToOpen = parseFreeMindXml(res.content);
            resolvedFilePath = res.filePath;
          }
        } catch (err) {
          console.warn('Failed to authorize/read searched .mm file:', err);
        }
      }
    }

    openMapAndSelectNode(mapToOpen, title, nodeId, resolvedFilePath);
    setExtraSelectedNodeIds([]);
    setIsForestViewOpen(false);
  };

  // Multi-selection & quick styling helpers (Issue #9)
  const handleSelectSingleNode = useCallback(
    (id: string | null) => {
      setExtraSelectedNodeIds([]);
      setSelectedNodeId(id);
    },
    [setSelectedNodeId]
  );

  const handleToggleNodeSelection = useCallback(
    (nodeId: string) => {
      if (!selectedNodeId) {
        setSelectedNodeId(nodeId);
        setExtraSelectedNodeIds([]);
        return;
      }
      if (nodeId === selectedNodeId) {
        if (extraSelectedNodeIds.length > 0) {
          const [nextPrimary, ...rest] = extraSelectedNodeIds;
          setSelectedNodeId(nextPrimary);
          setExtraSelectedNodeIds(rest);
        }
        return;
      }
      setExtraSelectedNodeIds(prev =>
        prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
      );
    },
    [selectedNodeId, extraSelectedNodeIds, setSelectedNodeId]
  );

  const effectiveSelectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return [];
    const ids: string[] = [];
    const seen = new Set<string>();
    if (findNodeInTree(map.root, selectedNodeId)) {
      ids.push(selectedNodeId);
      seen.add(selectedNodeId);
    }
    for (const id of extraSelectedNodeIds) {
      if (!seen.has(id) && findNodeInTree(map.root, id)) {
        seen.add(id);
        ids.push(id);
      }
    }
    return ids;
  }, [map.root, selectedNodeId, extraSelectedNodeIds]);

  const selectedNodes = useMemo(
    () =>
      effectiveSelectedNodeIds
        .map(id => findNodeInTree(map.root, id))
        .filter((n): n is FreeMindNode => n !== null),
    [map.root, effectiveSelectedNodeIds]
  );

  const handleCopy = useCallback(async () => {
    const targets = effectiveSelectedNodeIds.length > 0 ? effectiveSelectedNodeIds : undefined;
    const ok = await copyNode(targets);
    if (ok) {
      const count = targets?.length ?? 1;
      showToast(count > 1 ? `📋 ${count}件のノードをコピーしました` : '📋 ノードをコピーしました');
    }
  }, [copyNode, effectiveSelectedNodeIds, showToast]);

  const handleCut = useCallback(async () => {
    const targets = effectiveSelectedNodeIds.length > 0 ? effectiveSelectedNodeIds : undefined;
    const ok = await cutNode(targets);
    if (ok) {
      const nonRootCount = targets ? targets.filter(id => id !== map.root.id).length : 1;
      setExtraSelectedNodeIds([]);
      showToast(nonRootCount > 1 ? `✂️ ${nonRootCount}件のノードをカットしました` : '✂️ ノードをカットしました');
    }
  }, [cutNode, effectiveSelectedNodeIds, map.root.id, showToast]);

  const handlePaste = useCallback(async () => {
    const ok = await pasteNode();
    if (ok) showToast('📋 ノードを貼り付けました');
  }, [pasteNode, showToast]);

  const handleDuplicate = useCallback(() => {
    const targets = effectiveSelectedNodeIds.length > 0 ? effectiveSelectedNodeIds : undefined;
    const ok = duplicateNode(targets);
    if (ok) {
      const nonRootCount = targets ? targets.filter(id => id !== map.root.id).length : 1;
      setExtraSelectedNodeIds([]);
      showToast(nonRootCount > 1 ? `📑 ${nonRootCount}件のノードを複製しました` : '📑 ノードを複製しました');
    }
  }, [duplicateNode, effectiveSelectedNodeIds, map.root.id, showToast]);

  const handleQuickColorPreset = useCallback(
    (preset: QuickColorPreset) => {
      if (effectiveSelectedNodeIds.length === 0) return;
      const changed = batchUpdateNodes(effectiveSelectedNodeIds, nodes =>
        applyQuickColorToNodes(nodes, preset)
      );
      if (changed) {
        showToast(`🎨 配色「${preset.label}」を切り替えました`);
      }
    },
    [effectiveSelectedNodeIds, batchUpdateNodes, showToast]
  );

  const handleQuickColorKey = useCallback(
    (key: string) => {
      const preset = QUICK_COLOR_PRESETS.find(p => p.key === key);
      if (preset) {
        handleQuickColorPreset(preset);
      }
    },
    [handleQuickColorPreset]
  );

  const handleQuickClearColor = useCallback(() => {
    if (effectiveSelectedNodeIds.length === 0) return;
    if (batchUpdateNodes(effectiveSelectedNodeIds, clearColorOnNodes)) {
      showToast('🎨 配色をクリアしました');
    }
  }, [effectiveSelectedNodeIds, batchUpdateNodes, showToast]);

  const handleQuickToggleIcon = useCallback(
    (builtin: string) => {
      if (effectiveSelectedNodeIds.length === 0) return;
      batchUpdateNodes(effectiveSelectedNodeIds, nodes => toggleIconOnNodes(nodes, builtin));
    },
    [effectiveSelectedNodeIds, batchUpdateNodes]
  );

  const handleQuickToggleIconKey = useCallback(
    (key: string) => {
      const preset = QUICK_ICON_PRESETS.find(p => p.key === key);
      if (preset) {
        handleQuickToggleIcon(preset.builtin);
      }
    },
    [handleQuickToggleIcon]
  );

  const handleQuickClearIcons = useCallback(() => {
    if (effectiveSelectedNodeIds.length === 0) return;
    if (batchUpdateNodes(effectiveSelectedNodeIds, clearIconsOnNodes)) {
      showToast('アイコンをクリアしました');
    }
  }, [effectiveSelectedNodeIds, batchUpdateNodes, showToast]);

  const handleQuickToggleAttribute = useCallback(
    (name: string, value: string) => {
      if (effectiveSelectedNodeIds.length === 0) return;
      batchUpdateNodes(effectiveSelectedNodeIds, nodes =>
        toggleAttributeOnNodes(nodes, name, value)
      );
    },
    [effectiveSelectedNodeIds, batchUpdateNodes]
  );

  // Find currently selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeInTree(map.root, selectedNodeId);
  }, [map.root, selectedNodeId]);

  // Zoom controls
  const handleZoomIn = () => setZoomScale(z => Math.min(z * 1.2, 3.0));
  const handleZoomOut = () => setZoomScale(z => Math.max(z / 1.2, 0.25));
  const handleResetZoom = () => {
    setZoomScale(1.0);
    const canvasEl = document.querySelector('.mindmap-canvas-container');
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      setPanOffset({ x: rect.width / 2, y: rect.height / 2 });
    } else {
      setPanOffset({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  };

  const handleFitToScreen = useCallback(() => {
    const fitRoot = focusState.activeRoot.folded
      ? { ...focusState.activeRoot, folded: false }
      : focusState.activeRoot;
    const { layoutNodes, clouds } = computeLayout(fitRoot);
    const bounds = computeMapBounds(layoutNodes, clouds);
    const canvasEl = document.querySelector('.mindmap-canvas-container');
    const viewW = canvasEl ? canvasEl.clientWidth : window.innerWidth;
    const viewH = canvasEl ? canvasEl.clientHeight : window.innerHeight - 100;
    const pad = 48;
    const availW = Math.max(120, viewW - pad * 2);
    const availH = Math.max(120, viewH - pad * 2);
    const rawScale = Math.min(availW / bounds.width, availH / bounds.height);
    const nextScale = Math.max(0.25, Math.min(1.5, rawScale));
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    setZoomScale(nextScale);
    setPanOffset({
      x: viewW / 2 - centerX * nextScale,
      y: viewH / 2 - centerY * nextScale,
    });
  }, [focusState.activeRoot]);

  // Global F5 & Ctrl+0 key listener
  useEffect(() => {
    const handleFitKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '0' && !isForestViewOpen) {
        e.preventDefault();
        handleFitToScreen();
      }
    };
    window.addEventListener('keydown', handleFitKey);
    return () => window.removeEventListener('keydown', handleFitKey);
  }, [handleFitToScreen, isForestViewOpen]);

  // Export .mm file download
  const handleExport = () => {
    const xml = exportXml();
    const blob = new Blob([xml], { type: 'application/x-freemind;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeDownloadFileName(map.root.text)}.mm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    markTabSaved(activeTabId);
  };

  // Export Markdown (.md) download
  const handleExportMarkdown = () => {
    const md = exportMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeDownloadFileName(map.root.text)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSvg = () => {
    const exportRoot = focusState.isFocused
      ? { ...focusState.activeRoot, folded: false }
      : map.root;
    const filenameBase = sanitizeDownloadFileName(
      focusState.isFocused ? focusState.activeRoot.text : map.root.text
    );
    exportMindMapAsSvg(exportRoot, filenameBase, isDarkMode);
    showToast('SVG画像を書き出しました');
  };

  const handleExportPng = async () => {
    try {
      const exportRoot = focusState.isFocused
        ? { ...focusState.activeRoot, folded: false }
        : map.root;
      const filenameBase = sanitizeDownloadFileName(
        focusState.isFocused ? focusState.activeRoot.text : map.root.text
      );
      await exportMindMapAsPng(exportRoot, filenameBase, isDarkMode);
      showToast('PNG画像を書き出しました');
    } catch {
      showToast('PNGの書き出しに失敗しました');
    }
  };

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const hasReconciledInitialTabsRef = useRef(false);

  // Electron desktop integration: reconcile disk tabs, open initial/second-instance file, Ctrl+S save, file link navigation
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    if (!hasReconciledInitialTabsRef.current) {
      hasReconciledInitialTabsRef.current = true;
      const reloadSet = new Set(initialReloadTabIds);
      const fileTabs = tabsRef.current.filter(t => Boolean(t.filePath));
      if (fileTabs.length > 0) {
        Promise.all(
          fileTabs.map(async tab => {
            if (!tab.filePath) return;
            const res = await api.readFileByPath(tab.filePath);
            if (res.ok && res.content !== undefined) {
              reconcileTabWithDisk(
                tab.id,
                res.content,
                res.fileName || tab.filePath,
                reloadSet.has(tab.id)
              );
            }
          })
        ).catch(() => { });
      }
    }

    api.getInitialFile().then(payload => {
      if (payload) {
        openFileInTab(payload.filePath, payload.content, payload.fileName);
      }
    });

    return api.onOpenFile(payload => {
      openFileInTab(payload.filePath, payload.content, payload.fileName);
    });
  }, [openFileInTab, initialReloadTabIds, reconcileTabWithDisk]);

  const saveTabById = useCallback(
    async (tabId: string): Promise<{ saved: boolean; filePath?: string }> => {
      const targetTab = tabs.find(t => t.id === tabId);
      if (!targetTab) return { saved: false };

      const api = window.electronAPI;
      const xml = exportTabXml(tabId);
      const fallbackTitle = targetTab.map.root.text || targetTab.title || 'mindmap';

      if (!api) {
        const blob = new Blob([xml], { type: 'application/x-freemind;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizeDownloadFileName(fallbackTitle)}.mm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        markTabSaved(tabId);
        return { saved: true };
      }

      const isNonMmFile = Boolean(targetTab.filePath && !/\.mm$/i.test(targetTab.filePath));

      if (targetTab.filePath && !isNonMmFile) {
        const res = await api.saveFile(targetTab.filePath, xml);
        if (res.ok) {
          markTabSaved(tabId, targetTab.filePath);
          showToast(`上書き保存しました: ${targetTab.filePath.split(/[\\/]/).pop()}`);
          return { saved: true, filePath: targetTab.filePath };
        }
        if (res.code !== 'NOT_ALLOWED') {
          showToast(`保存に失敗しました: ${res.error || ''}`);
          return { saved: false };
        }
        // Path not authorized in this session (e.g. file missing at startup): fall back to Save As
      }

      // Markdown / text files are never overwritten with FreeMind XML: suggest a sibling .mm file instead
      const suggestedPath = targetTab.filePath
        ? targetTab.filePath.replace(/\.[^.\\/]+$/, '') + '.mm'
        : undefined;
      if (isNonMmFile) {
        showToast('Markdown ファイルは上書きせず、.mm 形式で別名保存します');
      }
      const res = await api.saveMmFileDialog(fallbackTitle, xml, suggestedPath);
      if (!res.canceled && res.filePath) {
        markTabSaved(tabId, res.filePath);
        showToast(`保存しました: ${res.fileName || res.filePath}`);
        return { saved: true, filePath: res.filePath };
      }
      if (res.error) {
        showToast(`保存に失敗しました: ${res.error}`);
      }
      return { saved: false };
    },
    [tabs, exportTabXml, markTabSaved, showToast]
  );

  const handleSaveCurrentFile = useCallback(async () => {
    await saveTabById(activeTabId);
  }, [saveTabById, activeTabId]);

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const targetTab = tabs.find(t => t.id === tabId);
      if (targetTab?.isPinned) {
        return;
      }
      if (tabs.length <= 1) {
        closeTab(tabId);
        return;
      }
      if (targetTab?.isDirty) {
        const tabTitle = targetTab.map.root.text || targetTab.title || '無題マップ';
        const api = window.electronAPI;
        if (api?.confirmUnsaved) {
          const choice = await api.confirmUnsaved(tabTitle);
          if (choice === 'cancel') return;
          if (choice === 'save') {
            const res = await saveTabById(tabId);
            if (!res.saved) return;
          }
        } else {
          const ok = window.confirm(`「${tabTitle}」には未保存の変更があります。保存せずに閉じますか？`);
          if (!ok) return;
        }
      }
      closeTab(tabId);
    },
    [tabs, closeTab, saveTabById]
  );

  const saveTabByIdRef = useRef(saveTabById);
  saveTabByIdRef.current = saveTabById;
  const isClosingPromptRef = useRef(false);

  // Electron: confirm unsaved tabs before closing window
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onRequestClose) return;

    return api.onRequestClose(async () => {
      if (isClosingPromptRef.current) return;
      isClosingPromptRef.current = true;
      try {
        const dirtyTabs = tabsRef.current.filter(t => t.isDirty);
        const savedOverrides = new Map<string, string | undefined>();
        const discardedTabIds = new Set<string>();

        for (const tab of dirtyTabs) {
          const tabTitle = tab.map.root.text || tab.title || '無題マップ';
          const choice = await api.confirmUnsaved(tabTitle);
          if (choice === 'cancel') {
            return;
          }
          if (choice === 'save') {
            setActiveTabId(tab.id);
            const res = await saveTabByIdRef.current(tab.id);
            if (!res.saved) {
              return;
            }
            savedOverrides.set(tab.id, res.filePath);
          } else if (choice === 'discard') {
            discardedTabIds.add(tab.id);
          }
        }

        const prepared = prepareTabsForAppClose(
          tabsRef.current,
          activeTabIdRef.current,
          savedOverrides,
          discardedTabIds
        );
        persistTabsToStorage(
          prepared.tabs,
          prepared.activeTabId,
          prepared.reloadFromDiskIds
        );

        api.confirmAppClose();
      } finally {
        isClosingPromptRef.current = false;
      }
    });
  }, [setActiveTabId]);

  // Web browser: warn before leaving with unsaved changes
  useEffect(() => {
    if (window.electronAPI) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (tabs.some(t => t.isDirty)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tabs]);

  useEffect(() => {
    const handleSaveKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !isForestViewOpen) {
        e.preventDefault();
        handleSaveCurrentFile();
      }
    };
    window.addEventListener('keydown', handleSaveKey);
    return () => window.removeEventListener('keydown', handleSaveKey);
  }, [handleSaveCurrentFile, isForestViewOpen]);

  const handleOpenFileDialog = useCallback(async () => {
    const api = window.electronAPI;
    if (!api) return;
    const payload = await api.openMmFile();
    if (payload) {
      openFileInTab(payload.filePath, payload.content, payload.fileName);
      setIsForestViewOpen(false);
    }
  }, [openFileInTab]);

  const handleOpenFileLink = useCallback(
    async (targetPath: string, targetNodeId?: string) => {
      const api = window.electronAPI;
      if (!api) return;
      const res = await api.readFileByPath(targetPath, activeFilePath);
      if (res.ok && res.filePath && res.content !== undefined) {
        openFileInTab(res.filePath, res.content, res.fileName, targetNodeId);
        setFocusedNodeId(null);
        showToast(`マップを開きました: ${res.fileName || res.filePath}`);
      } else {
        showToast(`リンク先を開けませんでした: ${res.resolvedPath || targetPath}`);
      }
    },
    [activeFilePath, openFileInTab, showToast]
  );

  const handleDeleteNodeOrSelection = useCallback(
    (targetNodeId: string) => {
      if (effectiveSelectedNodeIds.length > 1 && effectiveSelectedNodeIds.includes(targetNodeId)) {
        deleteNodes(effectiveSelectedNodeIds);
      } else {
        deleteNode(targetNodeId);
      }
      setExtraSelectedNodeIds([]);
    },
    [effectiveSelectedNodeIds, deleteNodes, deleteNode]
  );

  const handleToggleFoldSelection = useCallback(
    (targetNodeId: string, singleOnly = false) => {
      if (
        !singleOnly &&
        effectiveSelectedNodeIds.length > 1 &&
        effectiveSelectedNodeIds.includes(targetNodeId)
      ) {
        toggleFold(effectiveSelectedNodeIds);
      } else {
        toggleFold(targetNodeId);
      }
    },
    [effectiveSelectedNodeIds, toggleFold]
  );

  return (
    <div
      className={`app-container ${isDarkMode ? 'theme-dark' : ''} ${isPresentationActive && isCinemaMode ? 'presentation-cinema' : ''
        }`}
    >
      {/* Top Toolbar */}
      <Toolbar
        isForestViewOpen={isForestViewOpen}
        onCloseForestView={() => setIsForestViewOpen(false)}
        onNewTab={() => {
          createNewTab();
          setIsForestViewOpen(false);
        }}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleDarkMode}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onImportXml={loadMapFromXml}
        onImportMarkdown={importMarkdown}
        onOpenFileDialog={window.electronAPI ? handleOpenFileDialog : undefined}
        onSaveDirect={window.electronAPI ? handleSaveCurrentFile : undefined}
        activeFilePath={activeFilePath}
        onExportXml={handleExport}
        onExportMarkdown={handleExportMarkdown}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        onUnfoldAll={unfoldAll}
        onFoldAll={foldAll}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenSearcher={() => setIsSearcherOpen(true)}
        onResetToDefault={resetToDefault}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResultCount={searchResults.length}
        currentSearchIndex={searchIndex}
        onNextSearch={() => {
          if (searchResults.length > 0 && focusState.isFocused) {
            const nextIdx = (searchIndex + 1) % searchResults.length;
            if (!isNodeInsideSubtree(focusState.activeRoot, searchResults[nextIdx])) {
              setFocusedNodeId(null);
            }
          }
          handleNextSearch();
        }}
        onPrevSearch={() => {
          if (searchResults.length > 0 && focusState.isFocused) {
            const prevIdx = (searchIndex - 1 + searchResults.length) % searchResults.length;
            if (!isNodeInsideSubtree(focusState.activeRoot, searchResults[prevIdx])) {
              setFocusedNodeId(null);
            }
          }
          handlePrevSearch();
        }}
        isPresentationActive={isPresentationActive}
        onTogglePresentation={handleTogglePresentation}
        isQuickPaletteOpen={isQuickPaletteOpen}
        onToggleQuickPalette={() => {
          setIsQuickPaletteOpen(prev => {
            const next = !prev;
            if (next) setIsFilterBarOpen(false);
            return next;
          });
        }}
        isFocused={focusState.isFocused}
        canFocusSelected={Boolean(selectedNodeId && selectedNodeId !== map.root.id)}
        onToggleFocus={() => {
          if (focusState.isFocused) {
            setFocusedNodeId(null);
          } else {
            handleToggleFocusNode();
          }
        }}
        isFilterBarOpen={isFilterBarOpen}
        activeFilterCount={activeFilterCount}
        onToggleFilterBar={() => {
          setIsFilterBarOpen(prev => {
            const next = !prev;
            if (next) setIsQuickPaletteOpen(false);
            return next;
          });
        }}
      />

      {/* Multi-Map Tab Bar (forestMind Forest View feature) */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={id => {
          setActiveTabId(id);
          setIsForestViewOpen(false);
        }}
        onCloseTab={handleCloseTab}
        onNewTab={() => {
          createNewTab();
          setIsForestViewOpen(false);
        }}
        onTogglePinTab={togglePinTab}
        onReorderTabs={reorderTabs}
        isForestViewOpen={isForestViewOpen}
        onToggleForestView={() => setIsForestViewOpen(prev => !prev)}
      />

      {/* Main Canvas & Inspector Area */}
      <div className="main-body">
        {isForestViewOpen ? (
          <ForestOverview
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTabAndNode={(tabId, nodeId) => {
              setFocusedNodeId(null);
              if (nodeId) {
                revealAndSelectNode(nodeId, tabId);
              } else {
                setActiveTabId(tabId);
              }
            }}
            onNewTab={() => {
              createNewTab();
              setIsForestViewOpen(false);
            }}
            onCloseOverview={() => setIsForestViewOpen(false)}
          />
        ) : (
          <>
            <MindMapCanvas
              map={map}
              selectedNodeId={selectedNodeId}
              selectedNodeIds={effectiveSelectedNodeIds}
              setSelectedNodeId={id => {
                handleSelectSingleNode(id);
                if (id && !isPropertiesOpen && !isPresentationActive) {
                  setIsPropertiesOpen(true);
                }
              }}
              onToggleNodeSelection={nodeId => {
                handleToggleNodeSelection(nodeId);
                if (!isPropertiesOpen && !isPresentationActive) {
                  setIsPropertiesOpen(true);
                }
              }}
              isDarkMode={isDarkMode}
              editingNodeId={editingNodeId}
              setEditingNodeId={setEditingNodeId}
              onCancelEditing={cancelEditing}
              onAddChild={addChildNode}
              onAddSibling={addSiblingNode}
              onDeleteNode={handleDeleteNodeOrSelection}
              onUpdateText={updateNodeText}
              onClearNote={nodeId => {
                updateNodeProperties(nodeId, { noteHtml: undefined });
                showToast('ノートを削除しました (Ctrl+Z で元に戻せます)');
              }}
              onToggleFold={handleToggleFoldSelection}
              onMoveNode={moveNode}
              onCopyNode={handleCopy}
              onCutNode={handleCut}
              onPasteNode={handlePaste}
              onDuplicateNode={handleDuplicate}
              onReorderNode={reorderNode}
              onUndo={undo}
              onRedo={redo}
              zoomScale={zoomScale}
              setZoomScale={setZoomScale}
              panOffset={panOffset}
              setPanOffset={setPanOffset}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={handleResetZoom}
              onFitToScreen={handleFitToScreen}
              searchMatchedIds={searchResults}
              onNavigateTab={(targetTabId, targetNodeId) => {
                if (tabs.some(t => t.id === targetTabId)) {
                  setFocusedNodeId(null);
                  if (targetNodeId) {
                    revealAndSelectNode(targetNodeId, targetTabId);
                  } else {
                    setActiveTabId(targetTabId);
                  }
                } else {
                  showToast('リンク先のタブが見つかりませんでした');
                }
              }}
              onOpenFileLink={window.electronAPI ? handleOpenFileLink : undefined}
              onSelectLocalNode={handleSelectLocalNode}
              isPresentationActive={isPresentationActive}
              visibleNodeIds={presentationVisibleNodeIds}
              activeNodeId={presentationActiveNodeId}
              autoCenter={autoCenter}
              isSpotlightEnabled={isSpotlightEnabled}
              spotlightNodeIds={spotlightNodeIds}
              onQuickColor={handleQuickColorKey}
              onQuickClearColor={handleQuickClearColor}
              onQuickToggleIcon={handleQuickToggleIconKey}
              onQuickClearIcons={handleQuickClearIcons}
              onToggleQuickPalette={() => {
                setIsQuickPaletteOpen(prev => {
                  const next = !prev;
                  if (next) setIsFilterBarOpen(false);
                  return next;
                });
              }}
              isQuickPaletteOpen={isQuickPaletteOpen}
              onCloseQuickPalette={() => setIsQuickPaletteOpen(false)}
              focusedRoot={focusState.isFocused ? focusState.activeRoot : null}
              isFocused={focusState.isFocused}
              focusOverlay={
                focusState.isFocused ? (
                  <FocusBreadcrumbBar
                    breadcrumbs={focusState.breadcrumbs}
                    onSelectBreadcrumb={nodeId => setFocusedNodeId(nodeId)}
                    onExitFocus={() => setFocusedNodeId(null)}
                  />
                ) : null
              }
              filterResult={filterResult}
              isFilterBarOpen={isFilterBarOpen}
              onToggleFilterBar={() => {
                setIsFilterBarOpen(prev => {
                  const next = !prev;
                  if (next) setIsQuickPaletteOpen(false);
                  return next;
                });
              }}
              onCloseFilterBar={() => setIsFilterBarOpen(false)}
              onClearFilter={() => {
                setFilterCriteria(EMPTY_MAP_FILTER);
                setFilterMatchIndex(0);
              }}
              onToggleFocusNode={handleToggleFocusNode}
              onExitFocus={() => setFocusedNodeId(null)}
              onCopyNodeLink={handleCopyNodeLink}
              onOpenPropertiesPanel={() => setIsPropertiesOpen(true)}
              filterOverlay={
                <MapFilterBar
                  isOpen={isFilterBarOpen}
                  criteria={filterCriteria}
                  matchedCount={filterResult.matchedNodeIds.length}
                  currentMatchIndex={filterMatchIndex}
                  isDarkMode={isDarkMode}
                  onToggleColor={presetId => {
                    setFilterCriteria(prev => toggleFilterColor(prev, presetId));
                    setFilterMatchIndex(0);
                  }}
                  onToggleIcon={builtin => {
                    setFilterCriteria(prev => toggleFilterIcon(prev, builtin));
                    setFilterMatchIndex(0);
                  }}
                  onToggleAttribute={(name, value) => {
                    setFilterCriteria(prev => toggleFilterAttribute(prev, name, value));
                    setFilterMatchIndex(0);
                  }}
                  onPrevMatch={handlePrevFilterMatch}
                  onNextMatch={handleNextFilterMatch}
                  onClear={() => {
                    setFilterCriteria(EMPTY_MAP_FILTER);
                    setFilterMatchIndex(0);
                  }}
                  onClose={() => setIsFilterBarOpen(false)}
                />
              }
              quickPaletteOverlay={
                <QuickStylePalette
                  isOpen={isQuickPaletteOpen}
                  selectedNodes={selectedNodes}
                  isDarkMode={isDarkMode}
                  onSelectColor={handleQuickColorPreset}
                  onClearColor={handleQuickClearColor}
                  onToggleIcon={handleQuickToggleIcon}
                  onClearIcons={handleQuickClearIcons}
                  onToggleAttribute={handleQuickToggleAttribute}
                  onClose={() => setIsQuickPaletteOpen(false)}
                />
              }
            />

            {/* Presentation Floating Controls */}
            {isPresentationActive && (
              <PresentationControls
                isPlaying={isPresentationPlaying}
                onTogglePlay={togglePresentationPlay}
                onNext={nextPresentationStep}
                onPrev={prevPresentationStep}
                onReset={() => goToPresentationStep(0)}
                onClose={handleStopPresentation}
                currentStepIndex={currentStepIndex}
                totalSteps={presentationSteps.length}
                currentStep={activePresentationStep}
                mode={presentationMode}
                onChangeMode={setPresentationMode}
                speed={presentationSpeed}
                onChangeSpeed={setPresentationSpeed}
                autoCenter={autoCenter}
                onToggleAutoCenter={() => setAutoCenter(c => !c)}
                isSoundEnabled={isSoundEnabled}
                onToggleSound={() => setIsSoundEnabled(s => !s)}
                isSpotlightEnabled={isSpotlightEnabled}
                onToggleSpotlight={() => setIsSpotlightEnabled(s => !s)}
                isFullscreen={isCinemaMode}
                onToggleFullscreen={handleToggleCinemaMode}
                onSeek={goToPresentationStep}
              />
            )}

            {/* Side Properties Panel */}
            {!isPresentationActive && isPropertiesOpen && selectedNode && (
              <NodePropertiesPanel
                node={selectedNode}
                map={map}
                currentFilePath={activeFilePath}
                onUpdate={patch => selectedNodeId && updateNodeProperties(selectedNodeId, patch)}
                onClose={() => setIsPropertiesOpen(false)}
              />
            )}
          </>
        )}
      </div>

      {/* Shortcut & Status Footer */}
      <footer className="status-bar">
        <div className="status-hints">
          <span className="shortcut-chip"><kbd>Tab</kbd>子ノード</span>
          <span className="shortcut-chip"><kbd>Enter</kbd>兄弟ノード</span>
          <span className="shortcut-chip"><kbd>Alt+↑↓</kbd>並び替え</span>
          <span className="shortcut-chip"><kbd>Ctrl+C/V/X</kbd>コピペ/カット</span>
          <span className="shortcut-chip"><kbd>Ctrl+D</kbd>複製</span>
          <span className="shortcut-chip"><kbd>F2</kbd>編集</span>
          <span className="shortcut-chip"><kbd>Space</kbd>開閉</span>
          <span className="shortcut-chip"><kbd>Del</kbd>削除</span>
          <span className="shortcut-chip highlight"><kbd>F5</kbd>思考再生</span>
        </div>
      </footer>

      {/* Floating Toast Feedback */}
      {toastMessage && <div className="forest-toast">{toastMessage}</div>}

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Local Folder Search Modal */}
      <FreeMindSearcherModal
        isOpen={isSearcherOpen}
        onClose={() => setIsSearcherOpen(false)}
        onOpenMapNode={handleOpenSearcherNode}
      />
    </div>
  );
};

function findNodeInTree(node: FreeMindNode, targetId: string): FreeMindNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNodeInTree(child, targetId);
    if (found) return found;
  }
  return null;
}

export default App;

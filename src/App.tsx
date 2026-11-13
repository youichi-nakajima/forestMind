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
import { FreeMindSearcherModal } from './components/FreeMindSearcherModal';
import { FreeMindNode, FreeMindMap } from './types/freemind';
import { resumeAudioContext } from './utils/audio';

export const App: React.FC = () => {
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    createNewTab,
    closeTab,
    map,
    selectedNodeId,
    setSelectedNodeId,
    editingNodeId,
    setEditingNodeId,
    addChildNode,
    addSiblingNode,
    deleteNode,
    updateNodeText,
    toggleFold,
    unfoldAll,
    foldAll,
    updateNodeProperties,
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
    exportMarkdown,
    searchQuery,
    setSearchQuery,
    searchIndex,
    searchResults,
    handleNextSearch,
    handlePrevSearch,
    revealAndSelectNode,
  } = useMindMap();

  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isForestViewOpen, setIsForestViewOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearcherOpen, setIsSearcherOpen] = useState(false);
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

  const handleCopy = useCallback(async () => {
    const ok = await copyNode();
    if (ok) showToast('📋 ノードをコピーしました');
  }, [copyNode, showToast]);

  const handleCut = useCallback(async () => {
    const ok = await cutNode();
    if (ok) showToast('✂️ ノードをカットしました');
  }, [cutNode, showToast]);

  const handlePaste = useCallback(async () => {
    const ok = await pasteNode();
    if (ok) showToast('📋 ノードを貼り付けました');
  }, [pasteNode, showToast]);

  const handleDuplicate = useCallback(() => {
    const ok = duplicateNode();
    if (ok) showToast('📑 ノードを複製しました');
  }, [duplicateNode, showToast]);

  // Toggle cinema fullscreen mode
  const handleToggleCinemaMode = useCallback(() => {
    setIsCinemaMode(prev => {
      const next = !prev;
      if (next) {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
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

  // Toggle presentation via F5 or button
  const handleTogglePresentation = useCallback(() => {
    resumeAudioContext();
    if (isPresentationActive) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      setIsCinemaMode(false);
      stopPresentation();
    } else {
      setIsForestViewOpen(false);
      startPresentation();
    }
  }, [isPresentationActive, startPresentation, stopPresentation]);

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
      stopPresentation();
    }
  }, [activeTabId, stopPresentation]);

  // Handler for jumping from FreeMindSearcher to map & node
  const handleOpenSearcherNode = (targetMap: FreeMindMap, title: string, nodeId: string) => {
    // Check if map is already open in a tab
    const existingTab = tabs.find(t => t.map.root.id === targetMap.root.id || t.title === title);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      createNewTab(targetMap, title);
    }
    setIsForestViewOpen(false);

    // Auto-unfold and select after tab switch
    setTimeout(() => {
      revealAndSelectNode(nodeId);
    }, 50);
  };

  // Find currently selected node object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeInTree(map.root, selectedNodeId);
  }, [map.root, selectedNodeId]);

  const isRootSelected = selectedNodeId === map.root.id;

  // Zoom controls
  const handleZoomIn = () => setZoomScale(z => Math.min(z * 1.2, 3.0));
  const handleZoomOut = () => setZoomScale(z => Math.max(z / 1.2, 0.25));
  const handleResetZoom = () => {
    setZoomScale(1.0);
    setPanOffset({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  };

  // Export .mm file download
  const handleExport = () => {
    const xml = exportXml();
    const blob = new Blob([xml], { type: 'application/x-freemind;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.root.text || 'mindmap'}.mm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export Markdown (.md) download
  const handleExportMarkdown = () => {
    const md = exportMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${map.root.text || 'mindmap'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`app-container ${isDarkMode ? 'theme-dark' : ''} ${
        isPresentationActive && isCinemaMode ? 'presentation-cinema' : ''
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
        onAddChild={() => selectedNodeId && addChildNode(selectedNodeId)}
        onAddSibling={() => selectedNodeId && addSiblingNode(selectedNodeId)}
        onDelete={() => selectedNodeId && deleteNode(selectedNodeId)}
        onCopyNode={handleCopy}
        onDuplicateNode={handleDuplicate}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleDarkMode}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        zoomPercent={zoomScale * 100}
        onImportXml={loadMapFromXml}
        onImportMarkdown={importMarkdown}
        onExportXml={handleExport}
        onExportMarkdown={handleExportMarkdown}
        onUnfoldAll={unfoldAll}
        onFoldAll={foldAll}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenSearcher={() => setIsSearcherOpen(true)}
        onResetToDefault={resetToDefault}
        selectedNodeId={selectedNodeId}
        isRootSelected={isRootSelected}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResultCount={searchResults.length}
        currentSearchIndex={searchIndex}
        onNextSearch={handleNextSearch}
        onPrevSearch={handlePrevSearch}
        isPresentationActive={isPresentationActive}
        onTogglePresentation={handleTogglePresentation}
      />

      {/* Multi-Map Tab Bar (forestMind Forest View feature) */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={id => {
          setActiveTabId(id);
          setIsForestViewOpen(false);
        }}
        onCloseTab={closeTab}
        onNewTab={() => {
          createNewTab();
          setIsForestViewOpen(false);
        }}
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
              setActiveTabId(tabId);
              if (nodeId) {
                setTimeout(() => setSelectedNodeId(nodeId), 0);
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
              setSelectedNodeId={id => {
                setSelectedNodeId(id);
                if (id && !isPropertiesOpen && !isPresentationActive) {
                  setIsPropertiesOpen(true);
                }
              }}
              editingNodeId={editingNodeId}
              setEditingNodeId={setEditingNodeId}
              onAddChild={addChildNode}
              onAddSibling={addSiblingNode}
              onDeleteNode={deleteNode}
              onUpdateText={updateNodeText}
              onToggleFold={toggleFold}
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
              searchMatchedIds={searchResults}
              onNavigateTab={targetTabId => {
                if (tabs.some(t => t.id === targetTabId)) {
                  setActiveTabId(targetTabId);
                }
              }}
              isPresentationActive={isPresentationActive}
              visibleNodeIds={presentationVisibleNodeIds}
              activeNodeId={presentationActiveNodeId}
              autoCenter={autoCenter}
              isSpotlightEnabled={isSpotlightEnabled}
              spotlightNodeIds={spotlightNodeIds}
            />

            {/* Presentation Floating Controls */}
            {isPresentationActive && (
              <PresentationControls
                isPlaying={isPresentationPlaying}
                onTogglePlay={togglePresentationPlay}
                onNext={nextPresentationStep}
                onPrev={prevPresentationStep}
                onReset={() => goToPresentationStep(0)}
                onClose={stopPresentation}
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

      {/* FreeMindSearcher Folder Search Modal */}
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

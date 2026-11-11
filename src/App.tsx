import React, { useState, useMemo } from 'react';
import { useMindMap } from './hooks/useMindMap';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { MindMapCanvas } from './components/MindMapCanvas';
import { NodePropertiesPanel } from './components/NodePropertiesPanel';
import { ForestOverview } from './components/ForestOverview';
import { HelpModal } from './components/HelpModal';
import { FreeMindNode } from './types/freemind';

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
    undo,
    redo,
    canUndo,
    canRedo,
    loadMapFromXml,
    resetToDefault,
    exportXml,
    exportMarkdown,
    searchQuery,
    setSearchQuery,
    searchIndex,
    searchResults,
    handleNextSearch,
    handlePrevSearch,
  } = useMindMap();

  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [isForestViewOpen, setIsForestViewOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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
    <div className="app-container">
      {/* Top Toolbar */}
      <Toolbar
        onAddChild={() => selectedNodeId && addChildNode(selectedNodeId)}
        onAddSibling={() => selectedNodeId && addSiblingNode(selectedNodeId)}
        onDelete={() => selectedNodeId && deleteNode(selectedNodeId)}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        zoomPercent={zoomScale * 100}
        onImportXml={loadMapFromXml}
        onExportXml={handleExport}
        onExportMarkdown={handleExportMarkdown}
        onUnfoldAll={unfoldAll}
        onFoldAll={foldAll}
        onOpenHelp={() => setIsHelpOpen(true)}
        onResetToDefault={resetToDefault}
        selectedNodeId={selectedNodeId}
        isRootSelected={isRootSelected}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResultCount={searchResults.length}
        currentSearchIndex={searchIndex}
        onNextSearch={handleNextSearch}
        onPrevSearch={handlePrevSearch}
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
                if (id && !isPropertiesOpen) {
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
            />

            {/* Side Properties Panel */}
            {isPropertiesOpen && selectedNode && (
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
          <span className="shortcut-chip"><kbd>Tab</kbd>子ノード追加</span>
          <span className="shortcut-chip"><kbd>Enter</kbd>兄弟ノード追加</span>
          <span className="shortcut-chip"><kbd>↑↓←→</kbd>ノード間移動</span>
          <span className="shortcut-chip"><kbd>F2 / ダブルクリック</kbd>編集</span>
          <span className="shortcut-chip"><kbd>Space</kbd>開閉トグル</span>
          <span className="shortcut-chip"><kbd>Del</kbd>削除</span>
          <span className="shortcut-chip"><kbd>ドラッグ＆ドロップ</kbd>階層移動</span>
          <span className="shortcut-chip"><kbd>Ctrl+Z / Y</kbd>Undo/Redo</span>
        </div>
      </footer>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
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

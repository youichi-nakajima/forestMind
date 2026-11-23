import { useState, useCallback, useEffect, useRef } from 'react';
import { FreeMindMap, FreeMindNode, NodePosition } from '../types/freemind';
import { initialFreeMindMap } from '../data/defaultMap';
import { generateNodeId, parseFreeMindXml } from '../parser/freemindParser';
import { serializeFreeMindXml } from '../parser/freemindSerializer';
import { serializeSubtreeToMarkdown, parseMarkdownToSubtree } from '../utils/markdownUtils';
import {
  STORAGE_KEY_ACTIVE_TAB,
  loadTabsFromStorage,
  persistTabsToStorage,
} from '../utils/tabStorage';
import {
  PendingNewNodeEdit,
  cancelPendingNewNodeOnTab,
  commitPendingNewNodeTextOnTab,
} from '../utils/pendingNodeEdit';
import { reorderTabsInList, toggleTabPinnedInList } from '../utils/tabOrder';
import { noteHtmlToPlainText } from '../utils/noteRenderer';

let tabIdCounter = 0;

export interface MapTab {
  id: string;
  title: string;
  filePath?: string;
  map: FreeMindMap;
  past: FreeMindMap[];
  future: FreeMindMap[];
  selectedNodeId: string | null;
  isDirty?: boolean;
  isPinned?: boolean;
  savedPastLength?: number;
}

function parseFileContentToMap(
  content: string,
  fileNameOrPath?: string
): { map: FreeMindMap; fallbackTitle?: string } {
  const lowerName = (fileNameOrPath || '').toLowerCase();
  if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
    const baseName = (fileNameOrPath || 'Markdown').split(/[\\/]/).pop() || 'Markdown';
    const rootTitle = baseName.replace(/\.(md|txt)$/i, '');
    const rootChildren = parseMarkdownToSubtree(content);
    const newMap: FreeMindMap = {
      version: '1.0.1',
      root: {
        id: generateNodeId(),
        text: rootTitle,
        style: 'bubble',
        font: { size: 16, bold: true },
        icons: [],
        attributes: [],
        arrowLinks: [],
        hooks: [],
        children: rootChildren,
      },
    };
    return { map: newMap, fallbackTitle: rootTitle };
  }

  const parsed = parseFreeMindXml(content);
  const baseName = fileNameOrPath?.split(/[\\/]/).pop();
  return { map: parsed, fallbackTitle: parsed.root.text || baseName };
}

export function useMindMap() {
  const [initialLoad] = useState(() => loadTabsFromStorage());
  const [tabs, setTabs] = useState<MapTab[]>(initialLoad.tabs);

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
    if (savedActive && initialLoad.tabs.some(t => t.id === savedActive)) {
      return savedActive;
    }
    return initialLoad.tabs[0]?.id || 'tab_default';
  });

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const map = activeTab.map;
  const selectedNodeId = activeTab.selectedNodeId;
  const [editingNodeId, setEditingNodeIdRaw] = useState<string | null>(null);
  const pendingNewNodeRef = useRef<PendingNewNodeEdit | null>(null);
  const lastPropEditRef = useRef<{ tabId: string; nodeId: string; timestamp: number } | null>(null);

  const setEditingNodeId = useCallback((nextId: string | null) => {
    if (pendingNewNodeRef.current && pendingNewNodeRef.current.nodeId !== nextId) {
      pendingNewNodeRef.current = null;
    }
    setEditingNodeIdRaw(nextId);
  }, []);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);

  // Auto-save to localStorage (debounced, skipping selection-only updates)
  const [storageSaveFailed, setStorageSaveFailed] = useState(false);
  const prevPersistedTabsRef = useRef<Array<{
    id: string;
    title: string;
    filePath?: string;
    isDirty?: boolean;
    isPinned?: boolean;
    map: FreeMindMap;
  }> | null>(null);
  const prevPersistedActiveTabIdRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hasPendingSaveRef = useRef(false);

  const flushPendingStorageSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (hasPendingSaveRef.current) {
      hasPendingSaveRef.current = false;
      const ok = persistTabsToStorage(tabsRef.current, activeTabIdRef.current);
      setStorageSaveFailed(!ok);
    }
  }, []);

  useEffect(() => {
    const prevTabs = prevPersistedTabsRef.current;
    const isSamePersisted =
      prevTabs !== null &&
      prevPersistedActiveTabIdRef.current === activeTabId &&
      prevTabs.length === tabs.length &&
      tabs.every(
        (t, idx) =>
          t.id === prevTabs[idx].id &&
          t.title === prevTabs[idx].title &&
          t.filePath === prevTabs[idx].filePath &&
          t.isDirty === prevTabs[idx].isDirty &&
          t.isPinned === prevTabs[idx].isPinned &&
          t.map === prevTabs[idx].map
      );

    if (isSamePersisted) {
      return;
    }

    prevPersistedTabsRef.current = tabs.map(t => ({
      id: t.id,
      title: t.title,
      filePath: t.filePath,
      isDirty: t.isDirty,
      isPinned: t.isPinned,
      map: t.map,
    }));
    prevPersistedActiveTabIdRef.current = activeTabId;
    hasPendingSaveRef.current = true;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      hasPendingSaveRef.current = false;
      const ok = persistTabsToStorage(tabsRef.current, activeTabIdRef.current);
      setStorageSaveFailed(!ok);
    }, 150);
  }, [tabs, activeTabId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingStorageSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (hasPendingSaveRef.current) {
        hasPendingSaveRef.current = false;
        persistTabsToStorage(tabsRef.current, activeTabIdRef.current);
      }
    };
  }, [flushPendingStorageSave]);

  // Tab operations
  const createNewTab = useCallback(
    (customMap?: FreeMindMap, title?: string, filePath?: string, initialDirty: boolean = false) => {
      const newId = `tab_${Date.now()}_${++tabIdCounter}`;
      const newMap: FreeMindMap = customMap || {
        version: '1.0.1',
        root: {
          id: generateNodeId(),
          text: title || '新規マインドマップ',
          style: 'bubble',
          font: { size: 16, bold: true },
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: [],
        },
      };

      const newTab: MapTab = {
        id: newId,
        title: newMap.root.text || title || '新規マップ',
        filePath,
        map: newMap,
        past: [],
        future: [],
        selectedNodeId: newMap.root.id,
        isDirty: initialDirty,
        savedPastLength: initialDirty ? undefined : 0,
      };

      lastPropEditRef.current = null;
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newId);
      pendingNewNodeRef.current = null;
      setEditingNodeIdRaw(null);
    },
    []
  );

  const setTabFilePath = useCallback((tabId: string, filePath: string) => {
    setTabs(prev => prev.map(t => (t.id === tabId ? { ...t, filePath } : t)));
  }, []);

  const markTabSaved = useCallback((tabId: string, filePath?: string) => {
    lastPropEditRef.current = null;
    setTabs(prev =>
      prev.map(t =>
        t.id === tabId
          ? {
              ...t,
              filePath: filePath ?? t.filePath,
              isDirty: false,
              savedPastLength: t.past.length,
            }
          : t
      )
    );
  }, []);

  const openFileInTab = useCallback(
    (filePath: string, content: string, fileName?: string) => {
      lastPropEditRef.current = null;
      const normalized = filePath.toLowerCase();
      const existing = tabsRef.current.find(t => t.filePath?.toLowerCase() === normalized);
      if (existing) {
        if (!existing.isDirty) {
          try {
            const { map: diskMap, fallbackTitle } = parseFileContentToMap(
              content,
              fileName || filePath
            );
            setTabs(prev =>
              prev.map(t =>
                t.id === existing.id && !t.isDirty
                  ? {
                      ...t,
                      title: diskMap.root.text || fallbackTitle || t.title,
                      map: diskMap,
                      past: [],
                      future: [],
                      selectedNodeId: diskMap.root.id,
                      isDirty: false,
                      savedPastLength: 0,
                    }
                  : t
              )
            );
          } catch (err) {
            console.warn('Failed to refresh existing file tab:', err);
          }
        }
        setActiveTabId(existing.id);
        pendingNewNodeRef.current = null;
        setEditingNodeIdRaw(null);
        return;
      }

      const { map: newMap, fallbackTitle } = parseFileContentToMap(content, fileName || filePath);
      createNewTab(newMap, fallbackTitle, filePath);
    },
    [createNewTab]
  );

  const reconcileTabWithDisk = useCallback(
    (tabId: string, content: string, fileName?: string, forceReload: boolean = false) => {
      try {
        const { map: diskMap, fallbackTitle } = parseFileContentToMap(content, fileName);
        const isMarkdown = /\.(md|txt)$/i.test(fileName || '');
        const diskXml = isMarkdown ? null : serializeFreeMindXml(diskMap);

        setTabs(prev =>
          prev.map(t => {
            if (t.id !== tabId) return t;
            if (forceReload || !t.isDirty) {
              return {
                ...t,
                title: diskMap.root.text || fallbackTitle || t.title,
                map: diskMap,
                past: [],
                future: [],
                selectedNodeId:
                  t.selectedNodeId && findNode(diskMap.root, t.selectedNodeId)
                    ? t.selectedNodeId
                    : diskMap.root.id,
                isDirty: false,
                savedPastLength: 0,
              };
            }

            if (diskXml !== null && serializeFreeMindXml(t.map) === diskXml) {
              return {
                ...t,
                isDirty: false,
                savedPastLength: t.past.length,
              };
            }
            return t;
          })
        );
      } catch (err) {
        console.warn('Failed to reconcile tab with disk:', err);
      }
    },
    []
  );

  const closeTab = useCallback((tabId: string) => {
    const target = tabs.find(t => t.id === tabId);
    if (target?.isPinned) {
      return;
    }
    if (tabs.length <= 1) {
      alert('最後のタブは閉じることができません。');
      return;
    }
    const remaining = tabs.filter(t => t.id !== tabId);
    setTabs(remaining);

    if (activeTabId === tabId) {
      setActiveTabId(remaining[0]?.id || '');
    }
  }, [tabs, activeTabId]);

  const togglePinTab = useCallback((tabId: string) => {
    setTabs(prev => toggleTabPinnedInList(prev, tabId));
  }, []);

  const reorderTabs = useCallback(
    (draggedTabId: string, targetTabId: string, position: 'before' | 'after') => {
      setTabs(prev => reorderTabsInList(prev, draggedTabId, targetTabId, position));
    },
    []
  );

  const setSelectedNodeId = useCallback(
    (nodeId: string | null) => {
      lastPropEditRef.current = null;
      setTabs(prev =>
        prev.map(t => (t.id === activeTabId ? { ...t, selectedNodeId: nodeId } : t))
      );
    },
    [activeTabId]
  );

  // Undo / Redo
  const pushHistory = useCallback(
    (newMap: FreeMindMap) => {
      lastPropEditRef.current = null;
      setTabs(prev =>
        prev.map(t => {
          if (t.id !== activeTabId) return t;
          const dropped = t.past.length >= 31 ? 1 : 0;
          const nextPast = [...t.past.slice(-30), t.map];
          let nextSavedPastLen = t.savedPastLength;
          if (nextSavedPastLen !== undefined) {
            if (t.past.length < nextSavedPastLen) {
              nextSavedPastLen = undefined;
            } else if (dropped > 0) {
              nextSavedPastLen = nextSavedPastLen - 1;
              if (nextSavedPastLen < 0) nextSavedPastLen = undefined;
            }
          }
          return {
            ...t,
            title: newMap.root.text || t.title,
            past: nextPast,
            future: [],
            map: newMap,
            isDirty: nextSavedPastLen === undefined || nextPast.length !== nextSavedPastLen,
            savedPastLength: nextSavedPastLen,
          };
        })
      );
    },
    [activeTabId]
  );

  const undo = useCallback(() => {
    pendingNewNodeRef.current = null;
    lastPropEditRef.current = null;
    setEditingNodeIdRaw(null);
    setTabs(prev =>
      prev.map(t => {
        if (t.id !== activeTabId || t.past.length === 0) return t;
        const previous = t.past[t.past.length - 1];
        const nextPast = t.past.slice(0, t.past.length - 1);
        return {
          ...t,
          past: nextPast,
          future: [t.map, ...t.future],
          map: previous,
          title: previous.root.text || t.title,
          isDirty: t.savedPastLength === undefined || nextPast.length !== t.savedPastLength,
        };
      })
    );
  }, [activeTabId]);

  const redo = useCallback(() => {
    pendingNewNodeRef.current = null;
    lastPropEditRef.current = null;
    setEditingNodeIdRaw(null);
    setTabs(prev =>
      prev.map(t => {
        if (t.id !== activeTabId || t.future.length === 0) return t;
        const next = t.future[0];
        const nextPast = [...t.past, t.map];
        return {
          ...t,
          past: nextPast,
          future: t.future.slice(1),
          map: next,
          title: next.root.text || t.title,
          isDirty: t.savedPastLength === undefined || nextPast.length !== t.savedPastLength,
        };
      })
    );
  }, [activeTabId]);

  // Tree mutation helper
  const updateTree = useCallback(
    (mutator: (root: FreeMindNode) => boolean) => {
      const clonedMap = JSON.parse(JSON.stringify(map)) as FreeMindMap;
      const changed = mutator(clonedMap.root);
      if (changed) {
        pushHistory(clonedMap);
      }
    },
    [map, pushHistory]
  );

  // Node operations
  const addChildNode = useCallback(
    (parentId: string) => {
      const newId = generateNodeId();
      const currentTab = tabsRef.current.find(t => t.id === activeTabId) || tabsRef.current[0];
      if (currentTab && findNode(currentTab.map.root, parentId)) {
        pendingNewNodeRef.current = {
          tabId: activeTabId,
          nodeId: newId,
          previousSelectedNodeId: parentId,
          previousFuture: currentTab.future,
          previousSavedPastLength: currentTab.savedPastLength,
        };
      } else {
        pendingNewNodeRef.current = null;
      }

      updateTree(root => {
        const parent = findNode(root, parentId);
        if (!parent) return false;

        let childPosition: NodePosition | undefined = parent.position;
        if (parent.id === root.id) {
          const rightCount = parent.children.filter(c => c.position !== 'left').length;
          const leftCount = parent.children.filter(c => c.position === 'left').length;
          childPosition = rightCount <= leftCount ? 'right' : 'left';
        }

        const newNode: FreeMindNode = {
          id: newId,
          text: '新規ノード',
          position: childPosition,
          style: 'fork',
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: [],
          created: Date.now(),
          modified: Date.now(),
        };

        parent.folded = false;
        parent.children.push(newNode);
        return true;
      });

      setSelectedNodeId(newId);
      setEditingNodeIdRaw(newId);
    },
    [activeTabId, updateTree, setSelectedNodeId]
  );

  const addSiblingNode = useCallback(
    (targetNodeId: string) => {
      if (targetNodeId === map.root.id) {
        addChildNode(targetNodeId);
        return;
      }

      const newId = generateNodeId();
      const currentTab = tabsRef.current.find(t => t.id === activeTabId) || tabsRef.current[0];
      if (currentTab && findParentNode(currentTab.map.root, targetNodeId)) {
        pendingNewNodeRef.current = {
          tabId: activeTabId,
          nodeId: newId,
          previousSelectedNodeId: targetNodeId,
          previousFuture: currentTab.future,
          previousSavedPastLength: currentTab.savedPastLength,
        };
      } else {
        pendingNewNodeRef.current = null;
      }

      updateTree(root => {
        const parent = findParentNode(root, targetNodeId);
        if (!parent) return false;

        const targetIndex = parent.children.findIndex(c => c.id === targetNodeId);
        if (targetIndex === -1) return false;

        const targetNode = parent.children[targetIndex];
        const newNode: FreeMindNode = {
          id: newId,
          text: '新規ノード',
          position: targetNode.position,
          style: targetNode.style || 'fork',
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: [],
          created: Date.now(),
          modified: Date.now(),
        };

        parent.children.splice(targetIndex + 1, 0, newNode);
        return true;
      });

      setSelectedNodeId(newId);
      setEditingNodeIdRaw(newId);
    },
    [activeTabId, map.root.id, addChildNode, updateTree, setSelectedNodeId]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === map.root.id) return;
      pendingNewNodeRef.current = null;
      setEditingNodeIdRaw(null);
      updateTree(root => {
        const parent = findParentNode(root, nodeId);
        if (!parent) return false;
        parent.children = parent.children.filter(c => c.id !== nodeId);
        return true;
      });
      setSelectedNodeId(map.root.id);
    },
    [map.root.id, updateTree, setSelectedNodeId]
  );

  const updateNodeText = useCallback(
    (nodeId: string, text: string) => {
      const pending = pendingNewNodeRef.current;
      if (pending && pending.tabId === activeTabId && pending.nodeId === nodeId) {
        pendingNewNodeRef.current = null;
        setTabs(prev =>
          prev.map(t => (t.id === activeTabId ? commitPendingNewNodeTextOnTab(t, nodeId, text) : t))
        );
        return;
      }

      updateTree(root => {
        const target = findNode(root, nodeId);
        if (!target || target.text === text) return false;
        target.text = text;
        target.modified = Date.now();
        return true;
      });
    },
    [activeTabId, updateTree]
  );

  const cancelEditing = useCallback(() => {
    const pending = pendingNewNodeRef.current;
    pendingNewNodeRef.current = null;
    lastPropEditRef.current = null;
    setEditingNodeIdRaw(null);

    if (pending && pending.tabId === activeTabId && pending.nodeId === editingNodeId) {
      setTabs(prev =>
        prev.map(t => (t.id === activeTabId ? cancelPendingNewNodeOnTab(t, pending) : t))
      );
    }
  }, [activeTabId, editingNodeId]);

  const toggleFold = useCallback(
    (nodeId: string) => {
      updateTree(root => {
        const target = findNode(root, nodeId);
        if (!target || target.children.length === 0) return false;
        target.folded = !target.folded;
        return true;
      });
    },
    [updateTree]
  );

  const unfoldAll = useCallback(() => {
    updateTree(root => {
      function setFold(n: FreeMindNode) {
        n.folded = false;
        for (const c of n.children) setFold(c);
      }
      setFold(root);
      return true;
    });
  }, [updateTree]);

  const foldAll = useCallback(() => {
    updateTree(root => {
      function setFold(n: FreeMindNode) {
        if (n !== root && n.children.length > 0) {
          n.folded = true;
        }
        for (const c of n.children) setFold(c);
      }
      setFold(root);
      return true;
    });
  }, [updateTree]);

  const updateNodeProperties = useCallback(
    (nodeId: string, patch: Partial<FreeMindNode>) => {
      const now = Date.now();
      const last = lastPropEditRef.current;
      const shouldCoalesce =
        last !== null &&
        last.tabId === activeTabId &&
        last.nodeId === nodeId &&
        now - last.timestamp < 700;

      const currentTab = tabsRef.current.find(t => t.id === activeTabId);
      if (
        shouldCoalesce &&
        currentTab &&
        currentTab.past.length > 0 &&
        findNode(currentTab.map.root, nodeId)
      ) {
        lastPropEditRef.current = { tabId: activeTabId, nodeId, timestamp: now };
        setTabs(prev =>
          prev.map(t => {
            if (t.id !== activeTabId || t.past.length === 0) return t;
            const clonedMap = JSON.parse(JSON.stringify(t.map)) as FreeMindMap;
            const target = findNode(clonedMap.root, nodeId);
            if (!target) return t;
            Object.assign(target, patch);
            target.modified = now;
            return {
              ...t,
              title: clonedMap.root.text || t.title,
              map: clonedMap,
              isDirty: t.savedPastLength === undefined || t.past.length !== t.savedPastLength,
            };
          })
        );
        return;
      }

      let changedInTree = false;
      updateTree(root => {
        const target = findNode(root, nodeId);
        if (!target) return false;
        Object.assign(target, patch);
        target.modified = now;
        changedInTree = true;
        return true;
      });
      if (changedInTree) {
        lastPropEditRef.current = { tabId: activeTabId, nodeId, timestamp: now };
      }
    },
    [activeTabId, updateTree]
  );

  const batchUpdateNodes = useCallback(
    (nodeIds: string[], mutator: (nodes: FreeMindNode[]) => boolean): boolean => {
      const uniqueIds = Array.from(new Set(nodeIds.filter(Boolean)));
      if (uniqueIds.length === 0) return false;

      let applied = false;
      updateTree(root => {
        const targets = uniqueIds
          .map(id => findNode(root, id))
          .filter((n): n is FreeMindNode => n !== null);
        if (targets.length === 0) return false;

        const changed = mutator(targets);
        if (!changed) return false;

        const now = Date.now();
        for (const target of targets) {
          target.modified = now;
        }
        applied = true;
        return true;
      });
      return applied;
    },
    [updateTree]
  );

  const moveNode = useCallback(
    (draggedId: string, targetParentId: string) => {
      if (draggedId === map.root.id) return;
      if (draggedId === targetParentId) return;

      updateTree(root => {
        const draggedNode = findNode(root, draggedId);
        if (!draggedNode) return false;
        if (findNode(draggedNode, targetParentId)) return false;

        const oldParent = findParentNode(root, draggedId);
        if (!oldParent) return false;

        const oldIndex = oldParent.children.findIndex(c => c.id === draggedId);
        if (oldIndex === -1) return false;
        const [moved] = oldParent.children.splice(oldIndex, 1);

        const newParent = findNode(root, targetParentId);
        if (!newParent) return false;

        if (newParent.id === root.id) {
          const rightCount = newParent.children.filter(c => c.position !== 'left').length;
          const leftCount = newParent.children.filter(c => c.position === 'left').length;
          moved.position = rightCount <= leftCount ? 'right' : 'left';
        } else {
          moved.position = newParent.position;
        }

        newParent.folded = false;
        newParent.children.push(moved);
        moved.modified = Date.now();
        return true;
      });
    },
    [map.root.id, updateTree]
  );

  // Clipboard storage in memory
  const clipboardRef = useRef<FreeMindNode | null>(null);

  // Helper to deep-clone a subtree with fresh unique IDs
  const cloneSubtree = useCallback((node: FreeMindNode, newPosition?: NodePosition): FreeMindNode => {
    return {
      ...node,
      id: generateNodeId(),
      position: newPosition ?? node.position,
      created: Date.now(),
      modified: Date.now(),
      children: node.children.map(c => cloneSubtree(c, newPosition ?? c.position)),
    };
  }, []);

  // Copy node and its subtree to internal clipboard and system clipboard
  const copyNode = useCallback(
    async (nodeId?: string): Promise<boolean> => {
      const targetId = nodeId || selectedNodeId;
      if (!targetId) return false;
      const targetNode = findNode(map.root, targetId);
      if (!targetNode) return false;

      clipboardRef.current = cloneSubtree(targetNode);

      try {
        const mdText = serializeSubtreeToMarkdown(targetNode);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(mdText);
        }
      } catch {
        // System clipboard write may fail if document is not focused; internal clipboard works
      }

      return true;
    },
    [selectedNodeId, map.root, cloneSubtree]
  );

  // Cut node and its subtree (root cannot be cut)
  const cutNode = useCallback(
    async (nodeId?: string): Promise<boolean> => {
      const targetId = nodeId || selectedNodeId;
      if (!targetId || targetId === map.root.id) return false;
      const copied = await copyNode(targetId);
      if (copied) {
        deleteNode(targetId);
        return true;
      }
      return false;
    },
    [selectedNodeId, map.root.id, copyNode, deleteNode]
  );

  // Paste node subtree as child of target node
  const pasteNode = useCallback(
    async (targetParentId?: string): Promise<boolean> => {
      const parentId = targetParentId || selectedNodeId || map.root.id;

      // 1. Try internal clipboard first
      if (clipboardRef.current) {
        const cloned = cloneSubtree(clipboardRef.current);
        let pastedId: string | null = null;
        updateTree(root => {
          const parent = findNode(root, parentId);
          if (!parent) return false;

          if (parent.id === root.id) {
            const rightCount = parent.children.filter(c => c.position !== 'left').length;
            const leftCount = parent.children.filter(c => c.position === 'left').length;
            cloned.position = rightCount <= leftCount ? 'right' : 'left';
          } else {
            cloned.position = parent.position;
          }

          parent.folded = false;
          parent.children.push(cloned);
          pastedId = cloned.id;
          return true;
        });

        if (pastedId) {
          setSelectedNodeId(pastedId);
          return true;
        }
      }

      // 2. Try reading from system clipboard as fallback
      try {
        if (navigator.clipboard?.readText) {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            const nodes = parseMarkdownToSubtree(text);
            if (nodes.length > 0) {
              let firstId: string | null = null;
              updateTree(root => {
                const parent = findNode(root, parentId);
                if (!parent) return false;

                nodes.forEach(n => {
                  if (parent.id === root.id) {
                    const rightCount = parent.children.filter(c => c.position !== 'left').length;
                    const leftCount = parent.children.filter(c => c.position === 'left').length;
                    n.position = rightCount <= leftCount ? 'right' : 'left';
                  } else {
                    n.position = parent.position;
                  }
                  parent.children.push(n);
                  if (!firstId) firstId = n.id;
                });
                parent.folded = false;
                return true;
              });

              if (firstId) {
                setSelectedNodeId(firstId);
                return true;
              }
            }
          }
        }
      } catch {
        // System clipboard read permission denied
      }

      return false;
    },
    [selectedNodeId, map.root.id, cloneSubtree, updateTree, setSelectedNodeId]
  );

  // Duplicate node (creates identical copy right after itself under the same parent)
  const duplicateNode = useCallback(
    (nodeId?: string): boolean => {
      const targetId = nodeId || selectedNodeId;
      if (!targetId || targetId === map.root.id) return false;

      let newId: string | null = null;
      updateTree(root => {
        const parent = findParentNode(root, targetId);
        if (!parent) return false;
        const index = parent.children.findIndex(c => c.id === targetId);
        if (index === -1) return false;
        const target = parent.children[index];
        const cloned = cloneSubtree(target, target.position);
        parent.children.splice(index + 1, 0, cloned);
        newId = cloned.id;
        return true;
      });

      if (newId) {
        setSelectedNodeId(newId);
        return true;
      }
      return false;
    },
    [selectedNodeId, map.root.id, cloneSubtree, updateTree, setSelectedNodeId]
  );

  // Reorder node among siblings (Alt+Up / Alt+Down)
  const reorderNode = useCallback(
    (nodeId: string, direction: 'up' | 'down'): boolean => {
      if (nodeId === map.root.id) return false;

      let success = false;
      updateTree(root => {
        const parent = findParentNode(root, nodeId);
        if (!parent) return false;

        if (parent.id === root.id) {
          const node = parent.children.find(c => c.id === nodeId);
          if (!node) return false;
          const side = node.position || 'right';
          const sameSideItems = parent.children
            .map((c, idx) => ({ c, idx }))
            .filter(item => (item.c.position || 'right') === side);

          const currentPos = sameSideItems.findIndex(item => item.c.id === nodeId);
          if (currentPos === -1) return false;

          const targetPos = direction === 'up' ? currentPos - 1 : currentPos + 1;
          if (targetPos < 0 || targetPos >= sameSideItems.length) return false;

          const fromIdx = sameSideItems[currentPos].idx;
          const toIdx = sameSideItems[targetPos].idx;

          const temp = parent.children[fromIdx];
          parent.children[fromIdx] = parent.children[toIdx];
          parent.children[toIdx] = temp;
          success = true;
          return true;
        } else {
          const index = parent.children.findIndex(c => c.id === nodeId);
          if (index === -1) return false;

          const targetIndex = direction === 'up' ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= parent.children.length) return false;

          const temp = parent.children[index];
          parent.children[index] = parent.children[targetIndex];
          parent.children[targetIndex] = temp;
          success = true;
          return true;
        }
      });
      return success;
    },
    [map.root.id, updateTree]
  );

  const loadMapFromXml = useCallback(
    (xmlString: string, asNewTab: boolean = true) => {
      try {
        const parsed = parseFreeMindXml(xmlString);
        if (asNewTab) {
          createNewTab(parsed, parsed.root.text, undefined, false);
        } else {
          pendingNewNodeRef.current = null;
          setEditingNodeIdRaw(null);
          pushHistory(parsed);
          setSelectedNodeId(parsed.root.id);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        alert('FreeMind XMLの読み込みに失敗しました:\n' + message);
      }
    },
    [createNewTab, pushHistory, setSelectedNodeId]
  );

  const resetToDefault = useCallback(() => {
    pendingNewNodeRef.current = null;
    setEditingNodeIdRaw(null);
    pushHistory(initialFreeMindMap);
    setSelectedNodeId(initialFreeMindMap.root.id);
  }, [pushHistory, setSelectedNodeId]);

  const exportXml = useCallback(() => {
    return serializeFreeMindXml(map);
  }, [map]);

  const exportTabXml = useCallback(
    (tabId: string) => {
      const target = tabs.find(t => t.id === tabId);
      return target ? serializeFreeMindXml(target.map) : serializeFreeMindXml(map);
    },
    [tabs, map]
  );

  const importMarkdown = useCallback(
    (markdownText: string, asNewTab: boolean = true) => {
      const lines = markdownText.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length === 0) return;

      let rootTitle = '新規マインドマップ';
      const rootChildren: FreeMindNode[] = [];
      const stack: { node: FreeMindNode; indent: number }[] = [];

      lines.forEach((rawLine, idx) => {
        const headingMatch = rawLine.match(/^#+\s+(.+)$/);
        const bulletMatch = rawLine.match(/^(\s*)[-*+]\s+(.+)$/);

        if (idx === 0 && headingMatch) {
          rootTitle = headingMatch[1].trim();
          return;
        }

        let indent = 0;
        let text = rawLine.trim();

        if (bulletMatch) {
          indent = bulletMatch[1].length;
          text = bulletMatch[2].trim();
        } else if (headingMatch) {
          const hashes = rawLine.match(/^#+/)?.[0].length || 1;
          indent = (hashes - 1) * 2;
          text = headingMatch[1].trim();
        }

        const newNode: FreeMindNode = {
          id: generateNodeId(),
          text,
          style: 'fork',
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: [],
          created: Date.now(),
          modified: Date.now(),
        };

        if (stack.length === 0) {
          newNode.position = rootChildren.length % 2 === 0 ? 'right' : 'left';
          rootChildren.push(newNode);
          stack.push({ node: newNode, indent });
        } else {
          while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
          }

          if (stack.length === 0) {
            newNode.position = rootChildren.length % 2 === 0 ? 'right' : 'left';
            rootChildren.push(newNode);
            stack.push({ node: newNode, indent });
          } else {
            const parent = stack[stack.length - 1].node;
            newNode.position = parent.position;
            parent.children.push(newNode);
            stack.push({ node: newNode, indent });
          }
        }
      });

      const newMap: FreeMindMap = {
        version: '1.0.1',
        root: {
          id: generateNodeId(),
          text: rootTitle,
          style: 'bubble',
          font: { size: 16, bold: true },
          icons: [],
          attributes: [],
          arrowLinks: [],
          hooks: [],
          children: rootChildren,
        },
      };

      if (asNewTab) {
        createNewTab(newMap, rootTitle, undefined, false);
      } else {
        pendingNewNodeRef.current = null;
        setEditingNodeIdRaw(null);
        pushHistory(newMap);
        setSelectedNodeId(newMap.root.id);
      }
    },
    [createNewTab, pushHistory, setSelectedNodeId]
  );

  const exportMarkdown = useCallback(() => {
    const lines: string[] = [];
    function traverse(node: FreeMindNode, depth: number) {
      const indent = '  '.repeat(depth);
      const text = node.text || (node.htmlContent ? node.htmlContent.replace(/<[^>]+>/g, '').trim() : 'Node');
      
      if (depth === 0) {
        lines.push(`# ${text}\n`);
      } else {
        lines.push(`${indent}- ${text}`);
      }

      if (node.noteHtml) {
        const plainNote = noteHtmlToPlainText(node.noteHtml).replace(/\s*\n\s*/g, ' ').trim();
        if (plainNote) {
          lines.push(`${indent}  > ${plainNote}`);
        }
      }

      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }

    traverse(map.root, 0);
    return lines.join('\n');
  }, [map]);

  // Search matches calculation
  const searchResults = useCallback(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const matches: string[] = [];
    function scan(n: FreeMindNode) {
      if (
        (n.text && n.text.toLowerCase().includes(query)) ||
        (n.noteHtml && n.noteHtml.toLowerCase().includes(query))
      ) {
        matches.push(n.id);
      }
      for (const c of n.children) scan(c);
    }
    scan(map.root);
    return matches;
  }, [map.root, searchQuery])();

  const revealAndSelectNode = useCallback(
    (targetNodeId: string, targetTabId?: string) => {
      const resolvedTabId = targetTabId ?? activeTabId;
      pendingNewNodeRef.current = null;
      lastPropEditRef.current = null;
      setEditingNodeIdRaw(null);
      if (targetTabId && targetTabId !== activeTabId) {
        setActiveTabId(targetTabId);
      }
      setTabs(prev =>
        prev.map(t => {
          if (t.id !== resolvedTabId) return t;
          const clonedMap = JSON.parse(JSON.stringify(t.map)) as FreeMindMap;
          const changed = unfoldAncestors(clonedMap.root, targetNodeId);
          if (!changed) {
            return { ...t, selectedNodeId: targetNodeId };
          }
          const dropped = t.past.length >= 31 ? 1 : 0;
          const nextPast = [...t.past.slice(-30), t.map];
          let nextSavedPastLen = t.savedPastLength;
          if (nextSavedPastLen !== undefined) {
            if (t.past.length < nextSavedPastLen) {
              nextSavedPastLen = undefined;
            } else if (dropped > 0) {
              nextSavedPastLen = nextSavedPastLen - 1;
              if (nextSavedPastLen < 0) nextSavedPastLen = undefined;
            }
          }
          return {
            ...t,
            map: clonedMap,
            past: nextPast,
            future: [],
            selectedNodeId: targetNodeId,
            isDirty: nextSavedPastLen === undefined || nextPast.length !== nextSavedPastLen,
            savedPastLength: nextSavedPastLen,
          };
        })
      );
    },
    [activeTabId]
  );

  const openMapAndSelectNode = useCallback(
    (targetMap: FreeMindMap, title: string, nodeId: string, filePath?: string) => {
      pendingNewNodeRef.current = null;
      lastPropEditRef.current = null;
      setEditingNodeIdRaw(null);
      const normalizedPath = filePath?.toLowerCase();
      const existingTab =
        (normalizedPath
          ? tabsRef.current.find(t => t.filePath?.toLowerCase() === normalizedPath)
          : undefined) ??
        tabsRef.current.find(
          t =>
            (!normalizedPath || !t.filePath) &&
            t.map.root.id === targetMap.root.id &&
            (t.title === title || t.map.root.text === targetMap.root.text)
        );
      if (existingTab) {
        revealAndSelectNode(nodeId, existingTab.id);
        return;
      }
      const preparedMap = JSON.parse(JSON.stringify(targetMap)) as FreeMindMap;
      unfoldAncestors(preparedMap.root, nodeId);
      const newId = `tab_${Date.now()}_${++tabIdCounter}`;
      const newTab: MapTab = {
        id: newId,
        title: preparedMap.root.text || title || '新規マップ',
        filePath,
        map: preparedMap,
        past: [],
        future: [],
        selectedNodeId: nodeId,
        isDirty: false,
        savedPastLength: 0,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newId);
    },
    [revealAndSelectNode]
  );

  const handleNextSearch = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIdx = (searchIndex + 1) % searchResults.length;
    setSearchIndex(nextIdx);
    revealAndSelectNode(searchResults[nextIdx]);
  }, [searchIndex, searchResults, revealAndSelectNode]);

  const handlePrevSearch = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIdx = (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(prevIdx);
    revealAndSelectNode(searchResults[prevIdx]);
  }, [searchIndex, searchResults, revealAndSelectNode]);

  const selectTab = useCallback((id: string) => {
    pendingNewNodeRef.current = null;
    lastPropEditRef.current = null;
    setEditingNodeIdRaw(null);
    setActiveTabId(id);
  }, []);

  return {
    tabs,
    activeTabId,
    activeFilePath: activeTab.filePath,
    initialReloadTabIds: initialLoad.reloadFromDiskIds,
    storageLoadFailedTitles: initialLoad.failedTabTitles,
    storageSaveFailed,
    setActiveTabId: selectTab,
    createNewTab,
    setTabFilePath,
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
    canUndo: activeTab.past.length > 0,
    canRedo: activeTab.future.length > 0,
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
  };
}

function unfoldAncestors(node: FreeMindNode, targetId: string): boolean {
  if (node.id === targetId) return false;
  let mutated = false;
  for (const child of node.children) {
    if (child.id === targetId || findNode(child, targetId)) {
      if (node.folded) {
        node.folded = false;
        mutated = true;
      }
      if (unfoldAncestors(child, targetId)) {
        mutated = true;
      }
    }
  }
  return mutated;
}

function findNode(node: FreeMindNode, targetId: string): FreeMindNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}

function findParentNode(parent: FreeMindNode, targetId: string): FreeMindNode | null {
  for (const child of parent.children) {
    if (child.id === targetId) return parent;
    const found = findParentNode(child, targetId);
    if (found) return found;
  }
  return null;
}

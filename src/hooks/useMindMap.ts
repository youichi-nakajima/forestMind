import { useState, useCallback, useEffect } from 'react';
import { FreeMindMap, FreeMindNode, NodePosition } from '../types/freemind';
import { initialFreeMindMap } from '../data/defaultMap';
import { generateNodeId, parseFreeMindXml } from '../parser/freemindParser';
import { serializeFreeMindXml } from '../parser/freemindSerializer';

export interface MapTab {
  id: string;
  title: string;
  map: FreeMindMap;
  past: FreeMindMap[];
  future: FreeMindMap[];
  selectedNodeId: string | null;
}

const STORAGE_KEY_TABS = 'forestmind_saved_tabs_v2';
const STORAGE_KEY_ACTIVE_TAB = 'forestmind_active_tab_id_v2';

export function useMindMap() {
  const [tabs, setTabs] = useState<MapTab[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TABS);
      if (saved) {
        const parsed = JSON.parse(saved) as { id: string; title: string; xml: string }[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(t => {
            const mapObj = parseFreeMindXml(t.xml);
            return {
              id: t.id,
              title: t.title || mapObj.root.text || '無題マップ',
              map: mapObj,
              past: [],
              future: [],
              selectedNodeId: mapObj.root.id,
            };
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load tabs from localStorage:', e);
    }

    return [
      {
        id: 'tab_default',
        title: initialFreeMindMap.root.text || 'forestMind',
        map: initialFreeMindMap,
        past: [],
        future: [],
        selectedNodeId: initialFreeMindMap.root.id,
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE_TAB);
    if (savedActive && tabs.some(t => t.id === savedActive)) {
      return savedActive;
    }
    return tabs[0]?.id || 'tab_default';
  });

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const map = activeTab.map;
  const selectedNodeId = activeTab.selectedNodeId;
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      const serializedTabs = tabs.map(t => ({
        id: t.id,
        title: t.map.root.text || t.title,
        xml: serializeFreeMindXml(t.map),
      }));
      localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(serializedTabs));
      localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTabId);
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }, [tabs, activeTabId]);

  // Tab operations
  const createNewTab = useCallback((customMap?: FreeMindMap, title?: string) => {
    const newId = `tab_${Date.now()}`;
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
      map: newMap,
      past: [],
      future: [],
      selectedNodeId: newMap.root.id,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setEditingNodeId(null);
  }, []);

  const closeTab = useCallback((tabId: string) => {
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

  const setSelectedNodeId = useCallback(
    (nodeId: string | null) => {
      setTabs(prev =>
        prev.map(t => (t.id === activeTabId ? { ...t, selectedNodeId: nodeId } : t))
      );
    },
    [activeTabId]
  );

  // Undo / Redo
  const pushHistory = useCallback(
    (newMap: FreeMindMap) => {
      setTabs(prev =>
        prev.map(t => {
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            title: newMap.root.text || t.title,
            past: [...t.past.slice(-30), t.map],
            future: [],
            map: newMap,
          };
        })
      );
    },
    [activeTabId]
  );

  const undo = useCallback(() => {
    setTabs(prev =>
      prev.map(t => {
        if (t.id !== activeTabId || t.past.length === 0) return t;
        const previous = t.past[t.past.length - 1];
        return {
          ...t,
          past: t.past.slice(0, t.past.length - 1),
          future: [t.map, ...t.future],
          map: previous,
          title: previous.root.text || t.title,
        };
      })
    );
  }, [activeTabId]);

  const redo = useCallback(() => {
    setTabs(prev =>
      prev.map(t => {
        if (t.id !== activeTabId || t.future.length === 0) return t;
        const next = t.future[0];
        return {
          ...t,
          past: [...t.past, t.map],
          future: t.future.slice(1),
          map: next,
          title: next.root.text || t.title,
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
      setEditingNodeId(newId);
    },
    [updateTree, setSelectedNodeId]
  );

  const addSiblingNode = useCallback(
    (targetNodeId: string) => {
      if (targetNodeId === map.root.id) {
        addChildNode(targetNodeId);
        return;
      }

      const newId = generateNodeId();
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
      setEditingNodeId(newId);
    },
    [map.root.id, addChildNode, updateTree, setSelectedNodeId]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      if (nodeId === map.root.id) return;
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
      updateTree(root => {
        const target = findNode(root, nodeId);
        if (!target) return false;
        target.text = text;
        target.modified = Date.now();
        return true;
      });
    },
    [updateTree]
  );

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
      updateTree(root => {
        const target = findNode(root, nodeId);
        if (!target) return false;
        Object.assign(target, patch);
        target.modified = Date.now();
        return true;
      });
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

  const loadMapFromXml = useCallback(
    (xmlString: string, asNewTab: boolean = true) => {
      try {
        const parsed = parseFreeMindXml(xmlString);
        if (asNewTab) {
          createNewTab(parsed, parsed.root.text);
        } else {
          pushHistory(parsed);
          setSelectedNodeId(parsed.root.id);
        }
      } catch (err: any) {
        alert('FreeMind XMLの読み込みに失敗しました:\n' + err.message);
      }
    },
    [createNewTab, pushHistory, setSelectedNodeId]
  );

  const resetToDefault = useCallback(() => {
    pushHistory(initialFreeMindMap);
    setSelectedNodeId(initialFreeMindMap.root.id);
  }, [pushHistory, setSelectedNodeId]);

  const exportXml = useCallback(() => {
    return serializeFreeMindXml(map);
  }, [map]);

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
        const plainNote = node.noteHtml.replace(/<[^>]+>/g, '').trim();
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
    (targetNodeId: string) => {
      updateTree(root => {
        return unfoldAncestors(root, targetNodeId);
      });
      setSelectedNodeId(targetNodeId);
    },
    [updateTree, setSelectedNodeId]
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

  return {
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
    canUndo: activeTab.past.length > 0,
    canRedo: activeTab.future.length > 0,
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
    revealAndSelectNode,
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

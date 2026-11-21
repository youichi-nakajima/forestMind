import type { MapTab } from '../hooks/useMindMap';
import { initialFreeMindMap } from '../data/defaultMap';
import { parseFreeMindXml } from '../parser/freemindParser';
import { serializeFreeMindXml } from '../parser/freemindSerializer';

export const STORAGE_KEY_TABS = 'forestmind_saved_tabs_v2';
export const STORAGE_KEY_ACTIVE_TAB = 'forestmind_active_tab_id_v2';

export interface SerializedTab {
  id: string;
  title: string;
  filePath?: string;
  isDirty?: boolean;
  reloadFromDisk?: boolean;
  xml: string;
}

export function createDefaultTab(): MapTab {
  return {
    id: 'tab_default',
    title: initialFreeMindMap.root.text || 'forestMind',
    map: initialFreeMindMap,
    past: [],
    future: [],
    selectedNodeId: initialFreeMindMap.root.id,
    isDirty: false,
    savedPastLength: 0,
  };
}

export function serializeTabsForStorage(
  tabs: MapTab[],
  reloadFromDiskIds?: Set<string>
): SerializedTab[] {
  return tabs.map(t => {
    const shouldReload = Boolean(reloadFromDiskIds?.has(t.id));
    return {
      id: t.id,
      title: t.map.root.text || t.title,
      filePath: t.filePath,
      isDirty: shouldReload ? false : Boolean(t.isDirty),
      reloadFromDisk: shouldReload ? true : undefined,
      xml: serializeFreeMindXml(t.map),
    };
  });
}

export function persistTabsToStorage(
  tabs: MapTab[],
  activeTabId: string,
  reloadFromDiskIds?: Set<string>
): void {
  try {
    const serializedTabs = serializeTabsForStorage(tabs, reloadFromDiskIds);
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(serializedTabs));
    localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTabId);
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

export function loadTabsFromStorage(): { tabs: MapTab[]; reloadFromDiskIds: string[] } {
  const reloadFromDiskIds: string[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TABS);
    if (saved) {
      const parsed = JSON.parse(saved) as SerializedTab[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const tabs = parsed.map(t => {
          const mapObj = parseFreeMindXml(t.xml);
          const needsReload = Boolean(t.reloadFromDisk && t.filePath);
          if (needsReload) {
            reloadFromDiskIds.push(t.id);
          }
          const dirty = needsReload ? false : Boolean(t.isDirty);
          return {
            id: t.id,
            title: t.title || mapObj.root.text || '無題マップ',
            filePath: t.filePath,
            map: mapObj,
            past: [],
            future: [],
            selectedNodeId: mapObj.root.id,
            isDirty: dirty,
            savedPastLength: dirty ? undefined : 0,
          };
        });
        return { tabs, reloadFromDiskIds };
      }
    }
  } catch (e) {
    console.warn('Failed to load tabs from localStorage:', e);
  }

  return {
    tabs: [createDefaultTab()],
    reloadFromDiskIds: [],
  };
}

export function prepareTabsForAppClose(
  tabs: MapTab[],
  activeTabId: string,
  savedOverrides: Map<string, string | undefined>,
  discardedTabIds: Set<string>
): { tabs: MapTab[]; activeTabId: string; reloadFromDiskIds: Set<string> } {
  const reloadFromDiskIds = new Set<string>();
  const nextTabs: MapTab[] = [];

  for (const t of tabs) {
    if (savedOverrides.has(t.id)) {
      const savedPath = savedOverrides.get(t.id) ?? t.filePath;
      nextTabs.push({
        ...t,
        filePath: savedPath,
        isDirty: false,
        savedPastLength: t.past.length,
      });
    } else if (discardedTabIds.has(t.id)) {
      if (t.filePath) {
        reloadFromDiskIds.add(t.id);
        nextTabs.push({
          ...t,
          isDirty: false,
          past: [],
          future: [],
          savedPastLength: 0,
        });
      }
      // Unsaved tabs without filePath that are explicitly discarded are omitted
    } else {
      nextTabs.push(t);
    }
  }

  if (nextTabs.length === 0) {
    return {
      tabs: [createDefaultTab()],
      activeTabId: 'tab_default',
      reloadFromDiskIds: new Set<string>(),
    };
  }

  const nextActiveTabId = nextTabs.some(t => t.id === activeTabId)
    ? activeTabId
    : nextTabs[0].id;

  return {
    tabs: nextTabs,
    activeTabId: nextActiveTabId,
    reloadFromDiskIds,
  };
}


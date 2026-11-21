import type { MapTab } from '../hooks/useMindMap';
import { initialFreeMindMap } from '../data/defaultMap';
import { parseFreeMindXml } from '../parser/freemindParser';
import { serializeFreeMindXml } from '../parser/freemindSerializer';
import { normalizeTabOrder } from './tabOrder';

export const STORAGE_KEY_TABS = 'forestmind_saved_tabs_v2';
export const STORAGE_KEY_ACTIVE_TAB = 'forestmind_active_tab_id_v2';
export const STORAGE_KEY_CORRUPT_BACKUP = 'forestmind_corrupt_tabs_backup';

export interface SerializedTab {
  id: string;
  title: string;
  filePath?: string;
  isDirty?: boolean;
  isPinned?: boolean;
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
      isPinned: t.isPinned ? true : undefined,
      reloadFromDisk: shouldReload ? true : undefined,
      xml: serializeFreeMindXml(t.map),
    };
  });
}

export function persistTabsToStorage(
  tabs: MapTab[],
  activeTabId: string,
  reloadFromDiskIds?: Set<string>
): boolean {
  try {
    const serializedTabs = serializeTabsForStorage(tabs, reloadFromDiskIds);
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(serializedTabs));
    localStorage.setItem(STORAGE_KEY_ACTIVE_TAB, activeTabId);
    return true;
  } catch (e) {
    console.warn('LocalStorage save error:', e);
    return false;
  }
}

/**
 * Keep unreadable tab data in a separate key so it is not lost when the
 * auto-save overwrites the main storage key.
 */
function backupCorruptTabData(entries: unknown[]): void {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY_CORRUPT_BACKUP);
    const existing = existingRaw ? (JSON.parse(existingRaw) as unknown) : [];
    const list = Array.isArray(existing) ? existing : [];
    list.push({ savedAt: new Date().toISOString(), entries });
    localStorage.setItem(STORAGE_KEY_CORRUPT_BACKUP, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to back up corrupt tab data:', e);
  }
}

export interface LoadTabsResult {
  tabs: MapTab[];
  reloadFromDiskIds: string[];
  /** Titles of saved tabs that could not be restored (backed up to STORAGE_KEY_CORRUPT_BACKUP). */
  failedTabTitles: string[];
}

export function loadTabsFromStorage(): LoadTabsResult {
  const reloadFromDiskIds: string[] = [];
  const failedTabTitles: string[] = [];
  const failedEntries: unknown[] = [];
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY_TABS);
  } catch (e) {
    console.warn('Failed to access localStorage:', e);
  }

  if (saved) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse saved tabs:', e);
      backupCorruptTabData([saved]);
      failedTabTitles.push('(保存データ全体)');
    }

    if (Array.isArray(parsed)) {
      const tabs: MapTab[] = [];
      for (const entry of parsed as SerializedTab[]) {
        try {
          const mapObj = parseFreeMindXml(entry.xml);
          const needsReload = Boolean(entry.reloadFromDisk && entry.filePath);
          if (needsReload) {
            reloadFromDiskIds.push(entry.id);
          }
          const dirty = needsReload ? false : Boolean(entry.isDirty);
          tabs.push({
            id: entry.id,
            title: entry.title || mapObj.root.text || '無題マップ',
            filePath: entry.filePath,
            map: mapObj,
            past: [],
            future: [],
            selectedNodeId: mapObj.root.id,
            isDirty: dirty,
            isPinned: Boolean(entry.isPinned),
            savedPastLength: dirty ? undefined : 0,
          });
        } catch (e) {
          console.warn('Failed to restore a saved tab:', e);
          failedEntries.push(entry);
          failedTabTitles.push(entry?.title || entry?.filePath || entry?.id || '無題マップ');
        }
      }

      if (failedEntries.length > 0) {
        backupCorruptTabData(failedEntries);
      }
      if (tabs.length > 0) {
        return { tabs: normalizeTabOrder(tabs), reloadFromDiskIds, failedTabTitles };
      }
    }
  }

  return {
    tabs: [createDefaultTab()],
    reloadFromDiskIds: [],
    failedTabTitles,
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


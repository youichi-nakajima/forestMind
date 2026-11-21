import { describe, it, expect, beforeEach } from 'vitest';
import type { MapTab } from '../../hooks/useMindMap';
import { initialFreeMindMap } from '../../data/defaultMap';
import { FreeMindMap } from '../../types/freemind';
import {
  STORAGE_KEY_ACTIVE_TAB,
  STORAGE_KEY_TABS,
  loadTabsFromStorage,
  persistTabsToStorage,
  prepareTabsForAppClose,
} from '../tabStorage';

function cloneMap(base: FreeMindMap = initialFreeMindMap): FreeMindMap {
  return JSON.parse(JSON.stringify(base)) as FreeMindMap;
}

function makeTab(overrides: Partial<MapTab> = {}): MapTab {
  const map = overrides.map ?? cloneMap();
  return {
    id: 'tab_1',
    title: map.root.text,
    map,
    past: [],
    future: [],
    selectedNodeId: map.root.id,
    isDirty: false,
    savedPastLength: 0,
    ...overrides,
  };
}

describe('tabStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('prepareTabsForAppClose marks saved tabs clean and updates filePath', () => {
    const editedMap = cloneMap();
    editedMap.root.text = 'Saved Title';
    const tabs = [
      makeTab({
        id: 'tab_a',
        title: 'Saved Title',
        map: editedMap,
        past: [cloneMap()],
        isDirty: true,
        savedPastLength: 0,
      }),
    ];

    const savedOverrides = new Map<string, string | undefined>([
      ['tab_a', 'C:\\maps\\saved.mm'],
    ]);
    const result = prepareTabsForAppClose(tabs, 'tab_a', savedOverrides, new Set());

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].filePath).toBe('C:\\maps\\saved.mm');
    expect(result.tabs[0].isDirty).toBe(false);
    expect(result.tabs[0].savedPastLength).toBe(1);
    expect(result.reloadFromDiskIds.size).toBe(0);
    expect(result.activeTabId).toBe('tab_a');
  });

  it('prepareTabsForAppClose keeps discarded file-backed tabs for disk reload and drops discarded untitled tabs', () => {
    const cleanTab = makeTab({ id: 'tab_clean', filePath: 'C:\\maps\\clean.mm' });
    const discardedFileTab = makeTab({
      id: 'tab_file_dirty',
      filePath: 'C:\\maps\\dirty.mm',
      past: [cloneMap()],
      future: [cloneMap()],
      isDirty: true,
      savedPastLength: 0,
    });
    const discardedUntitledTab = makeTab({
      id: 'tab_untitled',
      filePath: undefined,
      past: [cloneMap()],
      isDirty: true,
      savedPastLength: 0,
    });

    const result = prepareTabsForAppClose(
      [cleanTab, discardedFileTab, discardedUntitledTab],
      'tab_untitled',
      new Map(),
      new Set(['tab_file_dirty', 'tab_untitled'])
    );

    expect(result.tabs.map(t => t.id)).toEqual(['tab_clean', 'tab_file_dirty']);
    expect(result.tabs[1].isDirty).toBe(false);
    expect(result.tabs[1].past).toEqual([]);
    expect(result.tabs[1].future).toEqual([]);
    expect(result.tabs[1].savedPastLength).toBe(0);
    expect(Array.from(result.reloadFromDiskIds)).toEqual(['tab_file_dirty']);
    expect(result.activeTabId).toBe('tab_clean');
  });

  it('prepareTabsForAppClose restores default tab if all tabs were discarded', () => {
    const untitledOnly = makeTab({
      id: 'tab_only',
      filePath: undefined,
      isDirty: true,
    });

    const result = prepareTabsForAppClose(
      [untitledOnly],
      'tab_only',
      new Map(),
      new Set(['tab_only'])
    );

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].id).toBe('tab_default');
    expect(result.tabs[0].isDirty).toBe(false);
    expect(result.activeTabId).toBe('tab_default');
  });

  it('persistTabsToStorage and loadTabsFromStorage handle reloadFromDisk flags properly', () => {
    const tabFile = makeTab({
      id: 'tab_file',
      filePath: 'C:\\maps\\note.mm',
      isDirty: false,
    });
    const tabStillDirty = makeTab({
      id: 'tab_dirty',
      isDirty: true,
      savedPastLength: undefined,
    });

    persistTabsToStorage(
      [tabFile, tabStillDirty],
      'tab_file',
      new Set(['tab_file'])
    );

    expect(localStorage.getItem(STORAGE_KEY_ACTIVE_TAB)).toBe('tab_file');
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_TABS) || '[]');
    expect(raw[0].reloadFromDisk).toBe(true);
    expect(raw[0].isDirty).toBe(false);
    expect(raw[1].isDirty).toBe(true);

    const loaded = loadTabsFromStorage();
    expect(loaded.reloadFromDiskIds).toEqual(['tab_file']);
    expect(loaded.tabs[0].isDirty).toBe(false);
    expect(loaded.tabs[0].savedPastLength).toBe(0);
    expect(loaded.tabs[1].isDirty).toBe(true);
  });
});


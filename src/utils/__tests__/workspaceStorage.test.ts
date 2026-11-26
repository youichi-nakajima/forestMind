import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_FOREST_FOLDERS, MAX_RECENT_FILES } from '../../types/workspace';
import {
  EMPTY_WORKSPACE_STATE,
  STORAGE_KEY_WORKSPACE,
  addForestFolderToState,
  addRecentFileToState,
  clearRecentFilesInState,
  loadWorkspaceFromStorage,
  persistWorkspaceToStorage,
  removeForestFolderFromState,
  removeRecentFileFromState,
  setLastScannedFolderInState,
} from '../workspaceStorage';

describe('workspaceStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds, deduplicates, caps, removes, and clears recent files', () => {
    let state = EMPTY_WORKSPACE_STATE;
    state = addRecentFileToState(state, 'C:\\maps\\alpha.mm', undefined, 100);
    state = addRecentFileToState(state, 'C:\\maps\\beta.mm', undefined, 200);
    // Re-adding alpha with forward slashes moves it to the top without duplicating
    state = addRecentFileToState(state, 'c:/maps/alpha.mm', undefined, 300);

    expect(state.recentFiles).toHaveLength(2);
    expect(state.recentFiles[0].fileName).toBe('alpha.mm');
    expect(state.recentFiles[0].lastOpenedAt).toBe(300);
    expect(state.recentFiles[1].fileName).toBe('beta.mm');

    for (let i = 0; i < MAX_RECENT_FILES + 5; i++) {
      state = addRecentFileToState(state, `C:\\maps\\file_${i}.mm`, undefined, 1000 + i);
    }
    expect(state.recentFiles).toHaveLength(MAX_RECENT_FILES);
    expect(state.recentFiles[0].fileName).toBe(`file_${MAX_RECENT_FILES + 4}.mm`);

    state = removeRecentFileFromState(state, `c:/maps/file_${MAX_RECENT_FILES + 4}.mm`);
    expect(state.recentFiles).toHaveLength(MAX_RECENT_FILES - 1);

    state = clearRecentFilesInState(state);
    expect(state.recentFiles).toEqual([]);
  });

  it('adds, deduplicates, caps, and removes forest folders and lastScannedFolder', () => {
    let state = EMPTY_WORKSPACE_STATE;
    state = addForestFolderToState(state, 'C:\\workspace\\notes', undefined, 100);
    state = addForestFolderToState(state, 'C:\\workspace\\projects', undefined, 200);
    state = addForestFolderToState(state, 'c:/workspace/notes', undefined, 500);

    expect(state.forestFolders).toHaveLength(2);
    expect(state.forestFolders[0].name).toBe('notes');
    expect(state.forestFolders[0].addedAt).toBe(100);

    for (let i = 0; i < MAX_FOREST_FOLDERS + 3; i++) {
      state = addForestFolderToState(state, `C:\\ws\\dir_${i}`, undefined, 1000 + i);
    }
    expect(state.forestFolders).toHaveLength(MAX_FOREST_FOLDERS);

    state = removeForestFolderFromState(state, `c:/ws/dir_${MAX_FOREST_FOLDERS + 2}`);
    expect(state.forestFolders).toHaveLength(MAX_FOREST_FOLDERS - 1);

    state = setLastScannedFolderInState(state, 'C:\\ws\\last');
    expect(state.lastScannedFolder).toBe('C:\\ws\\last');
  });

  it('persists to localStorage and recovers cleanly from corrupted JSON', () => {
    let state = addRecentFileToState(EMPTY_WORKSPACE_STATE, 'C:\\maps\\a.mm', 'a.mm', 42);
    state = addForestFolderToState(state, 'C:\\maps', 'maps', 99);
    state = setLastScannedFolderInState(state, 'C:\\maps');

    expect(persistWorkspaceToStorage(state)).toBe(true);
    expect(loadWorkspaceFromStorage()).toEqual(state);

    localStorage.setItem(STORAGE_KEY_WORKSPACE, '{bad json');
    expect(loadWorkspaceFromStorage()).toEqual(EMPTY_WORKSPACE_STATE);
  });
});

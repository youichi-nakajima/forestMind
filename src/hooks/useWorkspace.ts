import { useCallback, useEffect, useState } from 'react';
import { parseScannedRawFiles } from '../services/freeMindSearchEngine';
import type {
  ActiveForestFolderData,
  ForestFolderEntry,
  WorkspaceState,
} from '../types/workspace';
import {
  EMPTY_WORKSPACE_STATE,
  addForestFolderToState,
  addRecentFileToState,
  clearRecentFilesInState,
  loadWorkspaceFromStorage,
  normalizeWorkspacePathKey,
  persistWorkspaceToStorage,
  removeForestFolderFromState,
  removeRecentFileFromState,
} from '../utils/workspaceStorage';

export interface ScanForestFolderResult {
  ok: boolean;
  data?: ActiveForestFolderData;
  code?: string;
  error?: string;
}

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    typeof window !== 'undefined' && window.electronAPI
      ? EMPTY_WORKSPACE_STATE
      : loadWorkspaceFromStorage()
  );
  const [activeForestFolder, setActiveForestFolder] = useState<ActiveForestFolderData | null>(null);
  const [isScanningForestFolder, setIsScanningForestFolder] = useState(false);

  const refreshWorkspace = useCallback(async () => {
    const getWorkspaceState = window.electronAPI?.getWorkspaceState;
    if (!getWorkspaceState) return;
    try {
      const state = await getWorkspaceState();
      if (state) {
        setWorkspace(state);
      }
    } catch (err) {
      console.warn('Failed to load workspace state:', err);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const recordRecentFile = useCallback(
    (filePath: string, fileName?: string) => {
      if (window.electronAPI?.getWorkspaceState) {
        refreshWorkspace();
        return;
      }
      setWorkspace(prev => {
        const next = addRecentFileToState(prev, filePath, fileName);
        persistWorkspaceToStorage(next);
        return next;
      });
    },
    [refreshWorkspace]
  );

  const removeRecentFile = useCallback(async (filePath: string) => {
    const apiRemove = window.electronAPI?.removeRecentFile;
    if (apiRemove) {
      try {
        const state = await apiRemove(filePath);
        setWorkspace(state);
      } catch (err) {
        console.warn('Failed to remove recent file:', err);
      }
      return;
    }
    setWorkspace(prev => {
      const next = removeRecentFileFromState(prev, filePath);
      persistWorkspaceToStorage(next);
      return next;
    });
  }, []);

  const clearRecentFiles = useCallback(async () => {
    const apiClear = window.electronAPI?.clearRecentFiles;
    if (apiClear) {
      try {
        const state = await apiClear();
        setWorkspace(state);
      } catch (err) {
        console.warn('Failed to clear recent files:', err);
      }
      return;
    }
    setWorkspace(prev => {
      const next = clearRecentFilesInState(prev);
      persistWorkspaceToStorage(next);
      return next;
    });
  }, []);

  const pickAndAddForestFolder = useCallback(async (): Promise<ForestFolderEntry | null> => {
    const apiPick = window.electronAPI?.pickForestFolder;
    if (!apiPick) return null;
    try {
      const res = await apiPick();
      if (res?.state) {
        setWorkspace(res.state);
      }
      return res?.addedFolder ?? null;
    } catch (err) {
      console.warn('Failed to pick forest folder:', err);
      return null;
    }
  }, []);

  const addForestFolder = useCallback(async (folderPath: string, name?: string) => {
    const apiAdd = window.electronAPI?.addForestFolder;
    if (apiAdd) {
      try {
        const state = await apiAdd(folderPath);
        setWorkspace(state);
      } catch (err) {
        console.warn('Failed to add forest folder:', err);
      }
      return;
    }
    setWorkspace(prev => {
      const next = addForestFolderToState(prev, folderPath, name);
      persistWorkspaceToStorage(next);
      return next;
    });
  }, []);

  const removeForestFolder = useCallback(async (folderPath: string) => {
    const targetKey = normalizeWorkspacePathKey(folderPath);
    const apiRemove = window.electronAPI?.removeForestFolder;
    if (apiRemove) {
      try {
        const state = await apiRemove(folderPath);
        setWorkspace(state);
      } catch (err) {
        console.warn('Failed to remove forest folder:', err);
      }
    } else {
      setWorkspace(prev => {
        const next = removeForestFolderFromState(prev, folderPath);
        persistWorkspaceToStorage(next);
        return next;
      });
    }

    setActiveForestFolder(prev =>
      prev && normalizeWorkspacePathKey(prev.folderPath) === targetKey ? null : prev
    );
  }, []);

  const scanForestFolder = useCallback(
    async (folderPath: string): Promise<ScanForestFolderResult> => {
      const apiScan = window.electronAPI?.scanMmFolderByPath;
      if (!apiScan) {
        return {
          ok: false,
          error: 'フォルダ再スキャンはデスクトップ版で利用できます。',
        };
      }
      setIsScanningForestFolder(true);
      try {
        const res = await apiScan(folderPath);
        if (!res.ok) {
          return { ok: false, code: res.code, error: res.error };
        }
        const files = parseScannedRawFiles(res.result.files);
        const data: ActiveForestFolderData = {
          folderPath: res.result.rootDir,
          name: res.result.dirName,
          files,
          scannedAt: Date.now(),
        };
        setWorkspace(res.state);
        setActiveForestFolder(data);
        return { ok: true, data };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        setIsScanningForestFolder(false);
      }
    },
    []
  );

  const clearActiveForestFolder = useCallback(() => {
    setActiveForestFolder(null);
  }, []);

  return {
    workspace,
    activeForestFolder,
    isScanningForestFolder,
    refreshWorkspace,
    recordRecentFile,
    removeRecentFile,
    clearRecentFiles,
    pickAndAddForestFolder,
    addForestFolder,
    removeForestFolder,
    scanForestFolder,
    clearActiveForestFolder,
  };
}

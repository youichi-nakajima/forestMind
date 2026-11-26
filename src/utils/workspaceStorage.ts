import {
  MAX_FOREST_FOLDERS,
  MAX_RECENT_FILES,
  type ForestFolderEntry,
  type RecentFileEntry,
  type WorkspaceState,
} from '../types/workspace';

export const STORAGE_KEY_WORKSPACE = 'forestmind_workspace_v1';

export const EMPTY_WORKSPACE_STATE: WorkspaceState = {
  recentFiles: [],
  forestFolders: [],
};

/**
 * Normalizes file/folder paths into a case-insensitive forward-slash key for deduplication.
 */
export function normalizeWorkspacePathKey(p: string): string {
  return p.trim().replace(/\\/g, '/').toLowerCase();
}

function sanitizeRecentFiles(raw: unknown): RecentFileEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: RecentFileEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<RecentFileEntry>;
    if (typeof rec.filePath !== 'string' || !rec.filePath.trim()) continue;
    const key = normalizeWorkspacePathKey(rec.filePath);
    if (seen.has(key)) continue;
    seen.add(key);
    const filePath = rec.filePath.trim();
    const fileName =
      typeof rec.fileName === 'string' && rec.fileName.trim()
        ? rec.fileName.trim()
        : filePath.split(/[\\/]/).pop() || filePath;
    const lastOpenedAt =
      typeof rec.lastOpenedAt === 'number' && Number.isFinite(rec.lastOpenedAt)
        ? rec.lastOpenedAt
        : 0;
    result.push({ filePath, fileName, lastOpenedAt });
    if (result.length >= MAX_RECENT_FILES) break;
  }
  return result;
}

function sanitizeForestFolders(raw: unknown): ForestFolderEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: ForestFolderEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Partial<ForestFolderEntry>;
    if (typeof rec.folderPath !== 'string' || !rec.folderPath.trim()) continue;
    const key = normalizeWorkspacePathKey(rec.folderPath);
    if (seen.has(key)) continue;
    seen.add(key);
    const folderPath = rec.folderPath.trim();
    const name =
      typeof rec.name === 'string' && rec.name.trim()
        ? rec.name.trim()
        : folderPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || folderPath;
    const addedAt =
      typeof rec.addedAt === 'number' && Number.isFinite(rec.addedAt) ? rec.addedAt : 0;
    result.push({ folderPath, name, addedAt });
    if (result.length >= MAX_FOREST_FOLDERS) break;
  }
  return result;
}

export function addRecentFileToState(
  state: WorkspaceState,
  filePath: string,
  fileName?: string,
  now: number = Date.now()
): WorkspaceState {
  const trimmed = (filePath || '').trim();
  if (!trimmed) return state;

  const key = normalizeWorkspacePathKey(trimmed);
  const resolvedName =
    fileName?.trim() || trimmed.split(/[\\/]/).pop() || trimmed;
  const filtered = state.recentFiles.filter(
    entry => normalizeWorkspacePathKey(entry.filePath) !== key
  );

  return {
    ...state,
    recentFiles: [{ filePath: trimmed, fileName: resolvedName, lastOpenedAt: now }, ...filtered].slice(
      0,
      MAX_RECENT_FILES
    ),
  };
}

export function removeRecentFileFromState(
  state: WorkspaceState,
  filePath: string
): WorkspaceState {
  const key = normalizeWorkspacePathKey(filePath || '');
  if (!key) return state;
  const next = state.recentFiles.filter(
    entry => normalizeWorkspacePathKey(entry.filePath) !== key
  );
  if (next.length === state.recentFiles.length) return state;
  return { ...state, recentFiles: next };
}

export function clearRecentFilesInState(state: WorkspaceState): WorkspaceState {
  if (state.recentFiles.length === 0) return state;
  return { ...state, recentFiles: [] };
}

export function addForestFolderToState(
  state: WorkspaceState,
  folderPath: string,
  name?: string,
  now: number = Date.now()
): WorkspaceState {
  const trimmed = (folderPath || '').trim();
  if (!trimmed) return state;

  const key = normalizeWorkspacePathKey(trimmed);
  const existing = state.forestFolders.find(
    entry => normalizeWorkspacePathKey(entry.folderPath) === key
  );
  const resolvedName =
    name?.trim() ||
    trimmed.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ||
    trimmed;
  const filtered = state.forestFolders.filter(
    entry => normalizeWorkspacePathKey(entry.folderPath) !== key
  );

  return {
    ...state,
    forestFolders: [
      {
        folderPath: trimmed,
        name: resolvedName,
        addedAt: existing?.addedAt ?? now,
      },
      ...filtered,
    ].slice(0, MAX_FOREST_FOLDERS),
  };
}

export function removeForestFolderFromState(
  state: WorkspaceState,
  folderPath: string
): WorkspaceState {
  const key = normalizeWorkspacePathKey(folderPath || '');
  if (!key) return state;
  const next = state.forestFolders.filter(
    entry => normalizeWorkspacePathKey(entry.folderPath) !== key
  );
  if (next.length === state.forestFolders.length) return state;
  return { ...state, forestFolders: next };
}

export function setLastScannedFolderInState(
  state: WorkspaceState,
  folderPath?: string
): WorkspaceState {
  const trimmed = folderPath?.trim();
  return {
    ...state,
    lastScannedFolder: trimmed || undefined,
  };
}

export function loadWorkspaceFromStorage(): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKSPACE);
    if (!raw) return EMPTY_WORKSPACE_STATE;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return EMPTY_WORKSPACE_STATE;
    }
    const obj = parsed as Partial<WorkspaceState>;
    const lastScannedFolder =
      typeof obj.lastScannedFolder === 'string' && obj.lastScannedFolder.trim()
        ? obj.lastScannedFolder.trim()
        : undefined;
    return {
      recentFiles: sanitizeRecentFiles(obj.recentFiles),
      forestFolders: sanitizeForestFolders(obj.forestFolders),
      lastScannedFolder,
    };
  } catch {
    return EMPTY_WORKSPACE_STATE;
  }
}

export function persistWorkspaceToStorage(state: WorkspaceState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY_WORKSPACE, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('Workspace localStorage save error:', err);
    return false;
  }
}

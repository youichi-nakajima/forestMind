import type { ScannedFileItem } from './searcher';

export const MAX_RECENT_FILES = 15;
export const MAX_FOREST_FOLDERS = 12;

export interface RecentFileEntry {
  filePath: string;
  fileName: string;
  lastOpenedAt: number;
}

export interface ForestFolderEntry {
  folderPath: string;
  name: string;
  addedAt: number;
}

export interface WorkspaceState {
  recentFiles: RecentFileEntry[];
  forestFolders: ForestFolderEntry[];
  lastScannedFolder?: string;
}

export interface ActiveForestFolderData {
  folderPath: string;
  name: string;
  files: ScannedFileItem[];
  scannedAt: number;
}

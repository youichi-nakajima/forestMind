import type { ForestFolderEntry, WorkspaceState } from './workspace';

export interface ElectronFilePayload {
  filePath: string;
  fileName: string;
  content: string;
}

export interface ElectronReadPathResult {
  ok: boolean;
  filePath?: string;
  fileName?: string;
  content?: string;
  error?: string;
  resolvedPath?: string | null;
}

export interface ElectronSaveDialogResult {
  canceled: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

export interface ElectronSaveResult {
  ok: boolean;
  filePath?: string;
  error?: string;
  /** 'NOT_ALLOWED' when the path was not opened/chosen by the user in this session. */
  code?: 'NOT_ALLOWED' | 'WRITE_FAILED';
}

export interface ElectronPickLinkResult {
  filePath: string;
  linkValue: string;
}

export interface ElectronAppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
}

export interface ElectronScannedMmFile {
  filePath: string;
  fileName: string;
  relativePath: string;
  xmlContent: string;
  fileSize: number;
  modifiedTimeMs?: number;
}

export interface ElectronScanFolderResult {
  rootDir: string;
  dirName: string;
  files: ElectronScannedMmFile[];
}

export type ElectronScanFolderByPathResult =
  | {
      ok: true;
      result: ElectronScanFolderResult;
      state: WorkspaceState;
    }
  | {
      ok: false;
      code?: 'NOT_FOUND' | 'NOT_ALLOWED';
      error: string;
    };

export interface ElectronConfirmTrashPayload {
  title: string;
  filePath: string;
  backlinkCount?: number;
  hasUnsavedChanges?: boolean;
}

export type ElectronTrashMmResult =
  | {
      ok: true;
      filePath: string;
      state: WorkspaceState;
    }
  | {
      ok: false;
      code?: 'NOT_ALLOWED' | 'NOT_FOUND' | 'TRASH_FAILED';
      error: string;
      state?: WorkspaceState;
    };

export interface ElectronAPI {
  isElectron: boolean;
  getAppInfo?: () => Promise<ElectronAppInfo>;
  getInitialFile: () => Promise<ElectronFilePayload | null>;
  onOpenFile: (callback: (payload: ElectronFilePayload) => void) => () => void;
  openMmFile: () => Promise<ElectronFilePayload | null>;
  readFileByPath: (targetPath: string, baseFilePath?: string) => Promise<ElectronReadPathResult>;
  saveFile: (filePath: string, content: string) => Promise<ElectronSaveResult>;
  saveMmFileDialog: (
    defaultName: string,
    content: string,
    baseFilePath?: string
  ) => Promise<ElectronSaveDialogResult>;
  pickTargetMmFile: (baseFilePath?: string) => Promise<ElectronPickLinkResult | null>;
  scanMmFolder?: () => Promise<ElectronScanFolderResult | null>;
  getWorkspaceState?: () => Promise<WorkspaceState>;
  removeRecentFile?: (filePath: string) => Promise<WorkspaceState>;
  clearRecentFiles?: () => Promise<WorkspaceState>;
  pickForestFolder?: () => Promise<{
    state: WorkspaceState;
    addedFolder: ForestFolderEntry | null;
  }>;
  addForestFolder?: (folderPath: string) => Promise<WorkspaceState>;
  removeForestFolder?: (folderPath: string) => Promise<WorkspaceState>;
  scanMmFolderByPath?: (folderPath: string) => Promise<ElectronScanFolderByPathResult>;
  confirmUnsaved: (title: string) => Promise<'save' | 'discard' | 'cancel'>;
  confirmTrashMmFile?: (payload: ElectronConfirmTrashPayload) => Promise<boolean>;
  trashMmFile?: (filePath: string) => Promise<ElectronTrashMmResult>;
  onRequestClose: (callback: () => void) => () => void;
  confirmAppClose: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

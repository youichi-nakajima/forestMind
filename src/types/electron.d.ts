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
  confirmUnsaved: (title: string) => Promise<'save' | 'discard' | 'cancel'>;
  onRequestClose: (callback: () => void) => () => void;
  confirmAppClose: () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}


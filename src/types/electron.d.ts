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
}

export interface ElectronPickLinkResult {
  filePath: string;
  linkValue: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  getInitialFile: () => Promise<ElectronFilePayload | null>;
  onOpenFile: (callback: (payload: ElectronFilePayload) => void) => () => void;
  openMmFile: () => Promise<ElectronFilePayload | null>;
  readFileByPath: (targetPath: string, baseFilePath?: string) => Promise<ElectronReadPathResult>;
  saveFile: (filePath: string, content: string) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  saveMmFileDialog: (
    defaultName: string,
    content: string,
    baseFilePath?: string
  ) => Promise<ElectronSaveDialogResult>;
  pickTargetMmFile: (baseFilePath?: string) => Promise<ElectronPickLinkResult | null>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}


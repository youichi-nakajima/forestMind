import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface RecentFileEntry {
  filePath: string;
  fileName: string;
  lastOpenedAt: number;
}

interface ForestFolderEntry {
  folderPath: string;
  name: string;
  addedAt: number;
}

interface WorkspaceState {
  recentFiles: RecentFileEntry[];
  forestFolders: ForestFolderEntry[];
  lastScannedFolder?: string;
}

interface SettingsStore {
  getLastUsedDir: () => string | undefined;
  saveLastUsedDir: (dirPath: string) => void;
  getWorkspaceState: () => WorkspaceState;
  addRecentFile: (filePath: string) => WorkspaceState;
  removeRecentFile: (filePath: string) => WorkspaceState;
  clearRecentFiles: () => WorkspaceState;
  addForestFolder: (folderPath: string) => WorkspaceState;
  removeForestFolder: (folderPath: string) => WorkspaceState;
  saveLastScannedFolder: (folderPath: string) => WorkspaceState;
}

interface SettingsStoreModule {
  sanitizeFileName: (name: string) => string;
  resolveSaveDefaultPath: (
    defaultName: string,
    baseFilePath?: string,
    lastUsedDir?: string
  ) => string;
  createSettingsStore: (settingsFilePath: string) => SettingsStore;
}

const require = createRequire(import.meta.url);
const {
  sanitizeFileName,
  resolveSaveDefaultPath,
  createSettingsStore,
} = require('../../../electron/settingsStore.cjs') as SettingsStoreModule;

describe('electron settingsStore', () => {
  let tempRoot: string;
  let settingsFile: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forestmind-settings-'));
    settingsFile = path.join(tempRoot, 'userData', 'settings.json');
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('returns undefined when settings file does not exist', () => {
    const store = createSettingsStore(settingsFile);
    expect(store.getLastUsedDir()).toBeUndefined();
  });

  it('persists lastUsedDir across store instances when directory exists', () => {
    const targetDir = path.join(tempRoot, 'maps');
    fs.mkdirSync(targetDir, { recursive: true });

    const store1 = createSettingsStore(settingsFile);
    store1.saveLastUsedDir(targetDir);

    const store2 = createSettingsStore(settingsFile);
    expect(store2.getLastUsedDir()).toBe(path.normalize(targetDir));
  });

  it('returns undefined when saved lastUsedDir does not exist anymore', () => {
    const targetDir = path.join(tempRoot, 'ephemeral');
    fs.mkdirSync(targetDir, { recursive: true });

    const store = createSettingsStore(settingsFile);
    store.saveLastUsedDir(targetDir);
    expect(store.getLastUsedDir()).toBe(path.normalize(targetDir));

    fs.rmSync(targetDir, { recursive: true, force: true });
    expect(store.getLastUsedDir()).toBeUndefined();
  });

  it('ignores saving a non-existent directory and recovers from corrupted JSON', () => {
    const missingDir = path.join(tempRoot, 'missing');
    const validDir = path.join(tempRoot, 'valid');
    fs.mkdirSync(validDir, { recursive: true });
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, '{broken json', 'utf8');

    const store = createSettingsStore(settingsFile);
    expect(store.getLastUsedDir()).toBeUndefined();

    store.saveLastUsedDir(missingDir);
    expect(store.getLastUsedDir()).toBeUndefined();

    store.saveLastUsedDir(validDir);
    expect(store.getLastUsedDir()).toBe(path.normalize(validDir));
  });

  it('preserves unrelated keys in settings.json', () => {
    const validDir = path.join(tempRoot, 'docs');
    fs.mkdirSync(validDir, { recursive: true });
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify({ theme: 'dark', count: 3 }), 'utf8');

    const store = createSettingsStore(settingsFile);
    store.saveLastUsedDir(validDir);

    const parsed = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as Record<string, unknown>;
    expect(parsed.theme).toBe('dark');
    expect(parsed.count).toBe(3);
    expect(parsed.lastUsedDir).toBe(path.normalize(validDir));
  });

  it('sanitizes filenames and resolves save default path properly', () => {
    expect(sanitizeFileName('企画:2026/案*1')).toBe('企画_2026_案_1');
    expect(sanitizeFileName('   ...  ')).toBe('mindmap');

    expect(
      resolveSaveDefaultPath('ignored', 'C:\\existing\\map.mm', 'C:\\last')
    ).toBe('C:\\existing\\map.mm');

    expect(
      resolveSaveDefaultPath('新規:案', undefined, 'C:\\last')
    ).toBe(path.join('C:\\last', '新規_案.mm'));

    expect(
      resolveSaveDefaultPath('project.mm', undefined, 'C:\\last')
    ).toBe(path.join('C:\\last', 'project.mm'));
  });

  it('adds, deduplicates, caps at 15, removes, and clears recentFiles', () => {
    const store = createSettingsStore(settingsFile);
    const dir = path.join(tempRoot, 'maps');
    fs.mkdirSync(dir, { recursive: true });

    const fileA = path.join(dir, 'alpha.mm');
    const fileB = path.join(dir, 'beta.mm');
    store.addRecentFile(fileA);
    store.addRecentFile(fileB);
    store.addRecentFile(fileA);

    let ws = store.getWorkspaceState();
    expect(ws.recentFiles.map(f => f.fileName)).toEqual(['alpha.mm', 'beta.mm']);

    for (let i = 0; i < 18; i++) {
      store.addRecentFile(path.join(dir, `item_${i}.mm`));
    }
    ws = store.getWorkspaceState();
    expect(ws.recentFiles).toHaveLength(15);
    expect(ws.recentFiles[0].fileName).toBe('item_17.mm');

    ws = store.removeRecentFile(path.join(dir, 'item_17.mm'));
    expect(ws.recentFiles).toHaveLength(14);

    ws = store.clearRecentFiles();
    expect(ws.recentFiles).toEqual([]);
  });

  it('adds, deduplicates, caps at 12, removes forestFolders and saves lastScannedFolder', () => {
    const store = createSettingsStore(settingsFile);
    const missingDir = path.join(tempRoot, 'missing-ws');
    const dir1 = path.join(tempRoot, 'ws1');
    const dir2 = path.join(tempRoot, 'ws2');
    fs.mkdirSync(dir1, { recursive: true });
    fs.mkdirSync(dir2, { recursive: true });

    // Missing directory is ignored
    expect(store.addForestFolder(missingDir).forestFolders).toEqual([]);
    expect(store.saveLastScannedFolder(missingDir).lastScannedFolder).toBeUndefined();

    store.addForestFolder(dir1);
    store.addForestFolder(dir2);
    store.addForestFolder(dir1);

    let ws = store.getWorkspaceState();
    expect(ws.forestFolders.map(f => f.name)).toEqual(['ws1', 'ws2']);

    for (let i = 0; i < 14; i++) {
      const d = path.join(tempRoot, `extra_${i}`);
      fs.mkdirSync(d, { recursive: true });
      store.addForestFolder(d);
    }
    ws = store.getWorkspaceState();
    expect(ws.forestFolders).toHaveLength(12);

    ws = store.removeForestFolder(path.join(tempRoot, 'extra_13'));
    expect(ws.forestFolders).toHaveLength(11);

    ws = store.saveLastScannedFolder(dir2);
    expect(ws.lastScannedFolder).toBe(path.normalize(dir2));
    expect(store.getLastUsedDir()).toBe(path.normalize(dir2));
  });
});


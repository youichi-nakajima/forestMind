import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface SettingsStore {
  getLastUsedDir: () => string | undefined;
  saveLastUsedDir: (dirPath: string) => void;
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
});


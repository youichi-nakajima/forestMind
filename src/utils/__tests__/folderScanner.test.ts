import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

interface ScannedMmFile {
  filePath: string;
  fileName: string;
  relativePath: string;
  xmlContent: string;
  fileSize: number;
}

interface ScanFolderResult {
  rootDir: string;
  dirName: string;
  files: ScannedMmFile[];
}

interface FolderScannerModule {
  scanMmDirectory: (rootDir: string) => Promise<ScanFolderResult>;
}

const require = createRequire(import.meta.url);
const { scanMmDirectory } = require('../../../electron/folderScanner.cjs') as FolderScannerModule;

describe('electron folderScanner', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'forestmind-scan-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('recursively finds .mm files and skips non-.mm, hidden, and $-prefixed entries', async () => {
    const rootMm = path.join(tempRoot, 'root-map.mm');
    const nestedDir = path.join(tempRoot, 'sub', 'deep');
    const hiddenDir = path.join(tempRoot, '.git');
    const sysDir = path.join(tempRoot, '$RECYCLE.BIN');

    fs.mkdirSync(nestedDir, { recursive: true });
    fs.mkdirSync(hiddenDir, { recursive: true });
    fs.mkdirSync(sysDir, { recursive: true });

    const deepMm = path.join(nestedDir, 'Project.MM');
    fs.writeFileSync(rootMm, '<map version="1.0.1"><node ID="1" TEXT="Root"/></map>', 'utf8');
    fs.writeFileSync(deepMm, '<map version="1.0.1"><node ID="2" TEXT="Deep"/></map>', 'utf8');
    fs.writeFileSync(path.join(tempRoot, 'notes.md'), '# ignore me', 'utf8');
    fs.writeFileSync(path.join(tempRoot, '.hidden.mm'), '<map/>', 'utf8');
    fs.writeFileSync(path.join(tempRoot, '$temp.mm'), '<map/>', 'utf8');
    fs.writeFileSync(path.join(hiddenDir, 'ignored.mm'), '<map/>', 'utf8');
    fs.writeFileSync(path.join(sysDir, 'ignored2.mm'), '<map/>', 'utf8');

    const result = await scanMmDirectory(tempRoot);

    expect(result.rootDir).toBe(path.resolve(tempRoot));
    expect(result.dirName).toBe(path.basename(tempRoot));
    expect(result.files).toHaveLength(2);

    const byName = new Map(result.files.map(f => [f.fileName, f]));
    expect(byName.get('root-map.mm')).toEqual({
      filePath: rootMm,
      fileName: 'root-map.mm',
      relativePath: '.',
      xmlContent: '<map version="1.0.1"><node ID="1" TEXT="Root"/></map>',
      fileSize: Buffer.byteLength('<map version="1.0.1"><node ID="1" TEXT="Root"/></map>', 'utf8'),
    });
    expect(byName.get('Project.MM')).toEqual({
      filePath: deepMm,
      fileName: 'Project.MM',
      relativePath: 'sub/deep',
      xmlContent: '<map version="1.0.1"><node ID="2" TEXT="Deep"/></map>',
      fileSize: Buffer.byteLength('<map version="1.0.1"><node ID="2" TEXT="Deep"/></map>', 'utf8'),
    });
  });

  it('skips symbolic links safely if symlinks are supported', async () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forestmind-outside-'));
    try {
      const outsideMm = path.join(outsideDir, 'outside.mm');
      fs.writeFileSync(outsideMm, '<map version="1.0.1"><node ID="1" TEXT="Outside"/></map>', 'utf8');

      let symlinkCreated = false;
      try {
        fs.symlinkSync(outsideMm, path.join(tempRoot, 'link.mm'));
        symlinkCreated = true;
      } catch {
        symlinkCreated = false;
      }

      const localMm = path.join(tempRoot, 'local.mm');
      fs.writeFileSync(localMm, '<map version="1.0.1"><node ID="2" TEXT="Local"/></map>', 'utf8');

      const result = await scanMmDirectory(tempRoot);
      if (symlinkCreated) {
        expect(result.files.map(f => f.fileName)).toEqual(['local.mm']);
      } else {
        expect(result.files.map(f => f.fileName)).toEqual(['local.mm']);
      }
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('throws when the target directory does not exist or is not a directory', async () => {
    await expect(scanMmDirectory(path.join(tempRoot, 'missing'))).rejects.toThrow(
      'Directory not found'
    );

    const filePath = path.join(tempRoot, 'plain.mm');
    fs.writeFileSync(filePath, '<map/>', 'utf8');
    await expect(scanMmDirectory(filePath)).rejects.toThrow('Path is not a directory');
  });
});

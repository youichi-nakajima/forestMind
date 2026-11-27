import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  normalizePathKey,
  isPathInsideDir,
  isMmTrashAllowed,
} = require('../../../electron/fileSecurity.cjs') as {
  normalizePathKey: (filePath: string) => string;
  isPathInsideDir: (targetPath: string, dirPath: string) => boolean;
  isMmTrashAllowed: (
    filePath: string,
    opts?: {
      writableFileKeys?: Set<string>;
      forestFolders?: string[];
      lastScannedFolder?: string;
    }
  ) => boolean;
};

describe('fileSecurity', () => {
  it('detects whether a target file is strictly inside a directory', () => {
    const baseDir = path.resolve('forest_root');
    expect(isPathInsideDir(path.join(baseDir, 'map.mm'), baseDir)).toBe(true);
    expect(isPathInsideDir(path.join(baseDir, 'sub', 'deep.mm'), baseDir)).toBe(true);

    // Must reject the folder itself, parent traversal, and sibling prefix lookalikes
    expect(isPathInsideDir(baseDir, baseDir)).toBe(false);
    expect(isPathInsideDir(path.join(baseDir, '..', 'outside.mm'), baseDir)).toBe(false);
    expect(isPathInsideDir(`${baseDir}-other${path.sep}map.mm`, baseDir)).toBe(false);
    expect(isPathInsideDir('', baseDir)).toBe(false);
    expect(isPathInsideDir(path.join(baseDir, 'map.mm'), '')).toBe(false);
  });

  it('authorizes .mm trashing only for opened writable files or files inside forest/scanned folders', () => {
    const forestDir = path.resolve('forest_workspace');
    const scannedDir = path.resolve('scanned_workspace');
    const openedMap = path.resolve('standalone', 'notes.mm');
    const nestedMap = path.join(forestDir, 'nested', 'topic.mm');
    const scannedMap = path.join(scannedDir, 'draft.mm');
    const outsideMap = path.resolve('outside', 'secret.mm');
    const nonMmInside = path.join(forestDir, 'readme.md');

    const writableFileKeys = new Set<string>([normalizePathKey(openedMap)]);

    expect(
      isMmTrashAllowed(openedMap, {
        writableFileKeys,
        forestFolders: [forestDir],
        lastScannedFolder: scannedDir,
      })
    ).toBe(true);

    expect(
      isMmTrashAllowed(nestedMap, {
        writableFileKeys,
        forestFolders: [forestDir],
      })
    ).toBe(true);

    expect(
      isMmTrashAllowed(scannedMap, {
        writableFileKeys,
        forestFolders: [],
        lastScannedFolder: scannedDir,
      })
    ).toBe(true);

    expect(
      isMmTrashAllowed(outsideMap, {
        writableFileKeys,
        forestFolders: [forestDir],
        lastScannedFolder: scannedDir,
      })
    ).toBe(false);

    expect(
      isMmTrashAllowed(nonMmInside, {
        writableFileKeys,
        forestFolders: [forestDir],
      })
    ).toBe(false);

    expect(isMmTrashAllowed('', { writableFileKeys })).toBe(false);
  });
});

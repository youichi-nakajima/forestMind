const fs = require('node:fs');
const path = require('node:path');

/**
 * Recursively scans a directory for FreeMind (.mm) files while skipping hidden entries and symlinks.
 */
async function scanMmDirectory(rootDir) {
  if (typeof rootDir !== 'string' || !rootDir.trim()) {
    throw new Error('Target directory path must be a non-empty string.');
  }

  const normalizedRoot = path.resolve(rootDir);
  let rootStat;
  try {
    rootStat = await fs.promises.stat(normalizedRoot);
  } catch (err) {
    throw new Error(`Directory not found: ${normalizedRoot}`, { cause: err });
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`Path is not a directory: ${normalizedRoot}`);
  }

  const files = [];

  async function traverse(currentDir, currentRelPath) {
    let entries;
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      console.warn(`Failed to read directory ${currentDir}:`, err);
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('$')) {
        continue;
      }
      if (entry.isSymbolicLink()) {
        continue;
      }

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        const nextRelPath = currentRelPath ? `${currentRelPath}/${entry.name}` : entry.name;
        await traverse(fullPath, nextRelPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mm')) {
        try {
          const [xmlContent, fileStat] = await Promise.all([
            fs.promises.readFile(fullPath, 'utf8'),
            fs.promises.stat(fullPath),
          ]);
          files.push({
            filePath: fullPath,
            fileName: entry.name,
            relativePath: currentRelPath || '.',
            xmlContent,
            fileSize: fileStat.size,
            modifiedTimeMs: Math.round(fileStat.mtimeMs),
          });
        } catch (err) {
          console.warn(`Failed to read ${fullPath}:`, err);
        }
      }
    }
  }

  await traverse(normalizedRoot, '');

  return {
    rootDir: normalizedRoot,
    dirName: path.basename(normalizedRoot) || normalizedRoot,
    files,
  };
}

module.exports = {
  scanMmDirectory,
};

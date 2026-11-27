const path = require('node:path');

const MM_EXT_RE = /\.mm$/i;

function normalizePathKey(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isPathInsideDir(targetPath, dirPath) {
  if (typeof targetPath !== 'string' || !targetPath.trim()) {
    return false;
  }
  if (typeof dirPath !== 'string' || !dirPath.trim()) {
    return false;
  }
  const targetKey = normalizePathKey(targetPath);
  const dirKey = normalizePathKey(dirPath);
  if (targetKey === dirKey) {
    return false;
  }
  const rel = path.relative(dirKey, targetKey);
  return (
    Boolean(rel) &&
    rel !== '..' &&
    !rel.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(rel)
  );
}

function isMmTrashAllowed(
  filePath,
  { writableFileKeys, forestFolders, lastScannedFolder } = {}
) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return false;
  }
  const trimmed = filePath.trim();
  if (!MM_EXT_RE.test(trimmed)) {
    return false;
  }
  const key = normalizePathKey(trimmed);
  if (writableFileKeys && typeof writableFileKeys.has === 'function' && writableFileKeys.has(key)) {
    return true;
  }
  if (Array.isArray(forestFolders) && forestFolders.some(dir => isPathInsideDir(trimmed, dir))) {
    return true;
  }
  if (lastScannedFolder && isPathInsideDir(trimmed, lastScannedFolder)) {
    return true;
  }
  return false;
}

module.exports = {
  MM_EXT_RE,
  normalizePathKey,
  isPathInsideDir,
  isMmTrashAllowed,
};

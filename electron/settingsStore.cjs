const fs = require('node:fs');
const path = require('node:path');

const MAX_RECENT_FILES = 15;
const MAX_FOREST_FOLDERS = 12;

function sanitizeFileName(name) {
  const cleaned = String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned || 'mindmap';
}

function resolveSaveDefaultPath(defaultName, baseFilePath, lastUsedDir) {
  if (baseFilePath) {
    return baseFilePath;
  }
  const baseName = sanitizeFileName(defaultName);
  const fileName = baseName.toLowerCase().endsWith('.mm') ? baseName : `${baseName}.mm`;
  if (lastUsedDir) {
    return path.join(lastUsedDir, fileName);
  }
  return fileName;
}

function isExistingDirectory(dirPath) {
  if (typeof dirPath !== 'string' || !dirPath.trim()) {
    return false;
  }
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function normalizePathKey(targetPath) {
  const normalized = path.normalize(targetPath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function sanitizeRecentFiles(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.filePath !== 'string' || !item.filePath.trim()) continue;
    const normalized = path.normalize(item.filePath.trim());
    const key = normalizePathKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    const fileName =
      typeof item.fileName === 'string' && item.fileName.trim()
        ? item.fileName.trim()
        : path.basename(normalized) || normalized;
    const lastOpenedAt =
      typeof item.lastOpenedAt === 'number' && Number.isFinite(item.lastOpenedAt)
        ? item.lastOpenedAt
        : 0;
    result.push({ filePath: normalized, fileName, lastOpenedAt });
    if (result.length >= MAX_RECENT_FILES) break;
  }
  return result;
}

function sanitizeForestFolders(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    if (typeof item.folderPath !== 'string' || !item.folderPath.trim()) continue;
    const normalized = path.normalize(item.folderPath.trim());
    const key = normalizePathKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim()
        : path.basename(normalized) || normalized;
    const addedAt =
      typeof item.addedAt === 'number' && Number.isFinite(item.addedAt) ? item.addedAt : 0;
    result.push({ folderPath: normalized, name, addedAt });
    if (result.length >= MAX_FOREST_FOLDERS) break;
  }
  return result;
}

function createSettingsStore(settingsFilePath) {
  function readSettings() {
    try {
      if (!fs.existsSync(settingsFilePath)) {
        return {};
      }
      const raw = fs.readFileSync(settingsFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeSettings(next) {
    try {
      fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
      fs.writeFileSync(settingsFilePath, JSON.stringify(next, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  function getLastUsedDir() {
    const settings = readSettings();
    return isExistingDirectory(settings.lastUsedDir) ? settings.lastUsedDir : undefined;
  }

  function saveLastUsedDir(dirPath) {
    if (!isExistingDirectory(dirPath)) {
      return;
    }
    const current = readSettings();
    writeSettings({
      ...current,
      lastUsedDir: path.normalize(dirPath),
    });
  }

  function buildWorkspaceState(settings) {
    const recentFiles = sanitizeRecentFiles(settings.recentFiles);
    const forestFolders = sanitizeForestFolders(settings.forestFolders);
    const lastScannedFolder = isExistingDirectory(settings.lastScannedFolder)
      ? path.normalize(settings.lastScannedFolder)
      : undefined;
    return {
      recentFiles,
      forestFolders,
      ...(lastScannedFolder ? { lastScannedFolder } : {}),
    };
  }

  function getWorkspaceState() {
    return buildWorkspaceState(readSettings());
  }

  function addRecentFile(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return getWorkspaceState();
    }
    const normalized = path.normalize(filePath.trim());
    const key = normalizePathKey(normalized);
    const current = readSettings();
    const existing = sanitizeRecentFiles(current.recentFiles);
    const filtered = existing.filter(entry => normalizePathKey(entry.filePath) !== key);
    const nextRecent = [
      {
        filePath: normalized,
        fileName: path.basename(normalized) || normalized,
        lastOpenedAt: Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_RECENT_FILES);

    const nextSettings = {
      ...current,
      recentFiles: nextRecent,
    };
    writeSettings(nextSettings);
    return buildWorkspaceState(nextSettings);
  }

  function removeRecentFile(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return getWorkspaceState();
    }
    const key = normalizePathKey(filePath.trim());
    const current = readSettings();
    const existing = sanitizeRecentFiles(current.recentFiles);
    const nextRecent = existing.filter(entry => normalizePathKey(entry.filePath) !== key);
    if (nextRecent.length === existing.length) {
      return buildWorkspaceState(current);
    }
    const nextSettings = {
      ...current,
      recentFiles: nextRecent,
    };
    writeSettings(nextSettings);
    return buildWorkspaceState(nextSettings);
  }

  function clearRecentFiles() {
    const current = readSettings();
    const nextSettings = {
      ...current,
      recentFiles: [],
    };
    writeSettings(nextSettings);
    return buildWorkspaceState(nextSettings);
  }

  function addForestFolder(folderPath) {
    if (!isExistingDirectory(folderPath)) {
      return getWorkspaceState();
    }
    const normalized = path.normalize(folderPath.trim());
    const key = normalizePathKey(normalized);
    const current = readSettings();
    const existing = sanitizeForestFolders(current.forestFolders);
    const matched = existing.find(entry => normalizePathKey(entry.folderPath) === key);
    const filtered = existing.filter(entry => normalizePathKey(entry.folderPath) !== key);
    const nextFolders = [
      {
        folderPath: normalized,
        name: path.basename(normalized) || normalized,
        addedAt: matched ? matched.addedAt : Date.now(),
      },
      ...filtered,
    ].slice(0, MAX_FOREST_FOLDERS);

    const nextSettings = {
      ...current,
      forestFolders: nextFolders,
    };
    writeSettings(nextSettings);
    return buildWorkspaceState(nextSettings);
  }

  function removeForestFolder(folderPath) {
    if (typeof folderPath !== 'string' || !folderPath.trim()) {
      return getWorkspaceState();
    }
    const key = normalizePathKey(folderPath.trim());
    const current = readSettings();
    const existing = sanitizeForestFolders(current.forestFolders);
    const nextFolders = existing.filter(entry => normalizePathKey(entry.folderPath) !== key);
    if (nextFolders.length === existing.length) {
      return buildWorkspaceState(current);
    }
    const nextSettings = {
      ...current,
      forestFolders: nextFolders,
    };
    writeSettings(nextSettings);
    return buildWorkspaceState(nextSettings);
  }

  function saveLastScannedFolder(folderPath) {
    if (!isExistingDirectory(folderPath)) {
      return getWorkspaceState();
    }
    const normalized = path.normalize(folderPath.trim());
    const current = readSettings();
    const nextSettings = {
      ...current,
      lastUsedDir: normalized,
      lastScannedFolder: normalized,
    };
    writeSettings(nextSettings);
    return buildWorkspaceState(nextSettings);
  }

  return {
    getLastUsedDir,
    saveLastUsedDir,
    getWorkspaceState,
    addRecentFile,
    removeRecentFile,
    clearRecentFiles,
    addForestFolder,
    removeForestFolder,
    saveLastScannedFolder,
  };
}

module.exports = {
  MAX_RECENT_FILES,
  MAX_FOREST_FOLDERS,
  sanitizeFileName,
  resolveSaveDefaultPath,
  createSettingsStore,
};

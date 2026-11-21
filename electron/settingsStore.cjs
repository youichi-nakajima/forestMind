const fs = require('node:fs');
const path = require('node:path');

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

  function getLastUsedDir() {
    const settings = readSettings();
    return isExistingDirectory(settings.lastUsedDir) ? settings.lastUsedDir : undefined;
  }

  function saveLastUsedDir(dirPath) {
    if (!isExistingDirectory(dirPath)) {
      return;
    }
    try {
      const current = readSettings();
      const next = {
        ...current,
        lastUsedDir: path.normalize(dirPath),
      };
      fs.mkdirSync(path.dirname(settingsFilePath), { recursive: true });
      fs.writeFileSync(settingsFilePath, JSON.stringify(next, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }

  return {
    getLastUsedDir,
    saveLastUsedDir,
  };
}

module.exports = {
  sanitizeFileName,
  resolveSaveDefaultPath,
  createSettingsStore,
};

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { createSettingsStore, resolveSaveDefaultPath } = require('./settingsStore.cjs');
const { scanMmDirectory } = require('./folderScanner.cjs');

let mainWindow = null;
let initialFilePath = null;
let isForceClosing = false;
let settingsStore = null;

// Files the renderer may overwrite via `file:save`.
// Only paths the user explicitly opened or chose in a save dialog during this session are allowed,
// so that compromised renderer content cannot write arbitrary files.
const writableFilePaths = new Set();
const READABLE_EXT_RE = /\.(mm|md|txt)$/i;
const MM_EXT_RE = /\.mm$/i;

function pathKey(filePath) {
  const resolved = path.resolve(filePath);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function allowWrite(filePath) {
  if (typeof filePath === 'string' && filePath) {
    writableFilePaths.add(pathKey(filePath));
  }
}

function allowWriteIfMm(filePath) {
  if (typeof filePath === 'string' && MM_EXT_RE.test(filePath)) {
    allowWrite(filePath);
  }
}

function isWriteAllowed(filePath) {
  return typeof filePath === 'string' && filePath !== '' && writableFilePaths.has(pathKey(filePath));
}

function extractMmArg(argv) {
  for (const arg of argv) {
    if (arg && !arg.startsWith('-') && /\.(mm|md)$/i.test(arg) && fs.existsSync(arg)) {
      return path.resolve(arg);
    }
  }
  return null;
}

initialFilePath = extractMmArg(process.argv.slice(1));

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      const fileArg = extractMmArg(commandLine.slice(1));
      if (fileArg) {
        try {
          const content = fs.readFileSync(fileArg, 'utf8');
          settingsStore?.saveLastUsedDir(path.dirname(fileArg));
          allowWriteIfMm(fileArg);
          mainWindow.webContents.send('app:openFile', {
            filePath: fileArg,
            fileName: path.basename(fileArg),
            content,
          });
        } catch (err) {
          console.error('Failed to read file from second-instance:', err);
        }
      }
    }
  });
}

function createWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    title: 'forestMind',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Never let the app window navigate away from the bundled UI
  // (e.g. links inside map content, or a file dropped onto the window).
  // A remote page loaded here would otherwise get access to the preload API.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
  });
  mainWindow.webContents.on('will-attach-webview', event => {
    event.preventDefault();
  });

  const isDev = process.argv.includes('--dev') || Boolean(process.env.VITE_DEV_SERVER_URL);
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  if (isDev) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('close', e => {
    if (!isForceClosing && mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.webContents.send('app:requestClose');
    }
  });

  mainWindow.webContents.on('render-process-gone', () => {
    isForceClosing = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    isForceClosing = false;
  });
}

function resolveTargetFilePath(rawTarget, baseFilePath) {
  let target = (rawTarget || '').trim();
  if (!target) return null;

  if (/^file:\/\//i.test(target)) {
    try {
      target = fileURLToPath(target);
    } catch {
      target = target.replace(/^file:\/\/\/?/i, '');
    }
  }

  if (path.isAbsolute(target)) {
    return path.normalize(target);
  }

  if (baseFilePath) {
    return path.resolve(path.dirname(baseFilePath), target);
  }

  return path.resolve(target);
}

app.whenReady().then(() => {
  settingsStore = createSettingsStore(path.join(app.getPath('userData'), 'settings.json'));

  // Only grant the permissions the app actually uses
  const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  ipcMain.handle('app:getInfo', () => ({
    version: app.getVersion(),
    electron: process.versions.electron || '',
    chrome: process.versions.chrome || '',
    node: process.versions.node || '',
    platform: process.platform,
    arch: process.arch,
  }));

  ipcMain.handle('app:getInitialFile', () => {
    if (!initialFilePath || !fs.existsSync(initialFilePath)) return null;
    try {
      const content = fs.readFileSync(initialFilePath, 'utf8');
      settingsStore?.saveLastUsedDir(path.dirname(initialFilePath));
      allowWriteIfMm(initialFilePath);
      const result = {
        filePath: initialFilePath,
        fileName: path.basename(initialFilePath),
        content,
      };
      initialFilePath = null;
      return result;
    } catch (err) {
      console.error('Failed to read initial file:', err);
      return null;
    }
  });

  ipcMain.handle('dialog:openMmFile', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'マインドマップを開く',
      defaultPath: settingsStore?.getLastUsedDir(),
      properties: ['openFile'],
      filters: [
        { name: 'MindMap / Markdown', extensions: ['mm', 'md', 'txt'] },
        { name: 'FreeMind (.mm)', extensions: ['mm'] },
        { name: 'Markdown (.md)', extensions: ['md', 'txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      dialog.showErrorBox(
        'ファイルを開けませんでした',
        `${filePath}\n${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
    settingsStore?.saveLastUsedDir(path.dirname(filePath));
    allowWriteIfMm(filePath);
    return {
      filePath,
      fileName: path.basename(filePath),
      content,
    };
  });

  ipcMain.handle('file:readByPath', (_event, targetPath, baseFilePath) => {
    const resolved = resolveTargetFilePath(
      typeof targetPath === 'string' ? targetPath : '',
      typeof baseFilePath === 'string' ? baseFilePath : undefined
    );
    if (resolved && !READABLE_EXT_RE.test(resolved)) {
      return {
        ok: false,
        error: '対応していないファイル形式です (.mm / .md / .txt のみ)',
        resolvedPath: resolved,
      };
    }
    if (!resolved || !fs.existsSync(resolved)) {
      return { ok: false, error: 'ファイルが見つかりません', resolvedPath: resolved };
    }
    try {
      const content = fs.readFileSync(resolved, 'utf8');
      allowWriteIfMm(resolved);
      return {
        ok: true,
        filePath: resolved,
        fileName: path.basename(resolved),
        content,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        resolvedPath: resolved,
      };
    }
  });

  ipcMain.handle('file:save', (_event, filePath, content) => {
    if (typeof content !== 'string' || !isWriteAllowed(filePath)) {
      return {
        ok: false,
        code: 'NOT_ALLOWED',
        error: 'このファイルへの上書き保存は許可されていません',
      };
    }
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      settingsStore?.saveLastUsedDir(path.dirname(filePath));
      return { ok: true, filePath };
    } catch (err) {
      return {
        ok: false,
        code: 'WRITE_FAILED',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('dialog:saveMmFile', async (_event, defaultName, content, baseFilePath) => {
    if (typeof content !== 'string') {
      return { canceled: true, error: '保存内容が不正です' };
    }
    const defaultPath = resolveSaveDefaultPath(
      typeof defaultName === 'string' ? defaultName : '',
      typeof baseFilePath === 'string' ? baseFilePath : undefined,
      settingsStore?.getLastUsedDir()
    );
    const res = await dialog.showSaveDialog(mainWindow, {
      title: '名前を付けて保存',
      defaultPath,
      filters: [
        { name: 'FreeMind (.mm)', extensions: ['mm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    try {
      fs.writeFileSync(res.filePath, content, 'utf8');
    } catch (err) {
      return { canceled: true, error: err instanceof Error ? err.message : String(err) };
    }
    allowWrite(res.filePath);
    settingsStore?.saveLastUsedDir(path.dirname(res.filePath));
    return {
      canceled: false,
      filePath: res.filePath,
      fileName: path.basename(res.filePath),
    };
  });

  ipcMain.handle('dialog:pickTargetMmFile', async (_event, baseFilePath) => {
    try {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'リンク先のマインドマップ (.mm) を選択',
        properties: ['openFile'],
        defaultPath:
          (baseFilePath ? path.dirname(baseFilePath) : undefined) ||
          settingsStore?.getLastUsedDir(),
        filters: [
          { name: 'FreeMind (.mm)', extensions: ['mm'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (res.canceled || res.filePaths.length === 0) return null;
      const pickedPath = res.filePaths[0];
      let linkValue = pickedPath;
      if (baseFilePath) {
        const rel = path.relative(path.dirname(baseFilePath), pickedPath);
        // Use relative path if on the same drive/root
        if (rel && !path.isAbsolute(rel)) {
          linkValue = rel.replace(/\\/g, '/');
          if (!linkValue.startsWith('.')) {
            linkValue = `./${linkValue}`;
          }
        }
      }
      return {
        filePath: pickedPath,
        linkValue,
      };
    } catch (err) {
      console.error('Failed to pick target .mm file:', err);
      return null;
    }
  });

  ipcMain.handle('dialog:scanMmFolder', async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: '検索対象のフォルダを選択',
      defaultPath: settingsStore?.getLastUsedDir(),
      properties: ['openDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const rootDir = res.filePaths[0];
    settingsStore?.saveLastUsedDir(rootDir);
    return await scanMmDirectory(rootDir);
  });

  ipcMain.handle('dialog:confirmUnsaved', async (_event, title) => {
    if (!mainWindow || mainWindow.isDestroyed()) return 'discard';
    const res = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '未保存の変更',
      message: `「${title || '無題マップ'}」には未保存の変更があります。`,
      detail: '閉じる前に変更を保存しますか？',
      buttons: ['保存する', '保存しない', 'キャンセル'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (res.response === 0) return 'save';
    if (res.response === 1) return 'discard';
    return 'cancel';
  });

  ipcMain.on('app:confirmClose', () => {
    isForceClosing = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

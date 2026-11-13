const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

let mainWindow = null;
let initialFilePath = null;
let isForceClosing = false;

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
  ipcMain.handle('app:getInitialFile', () => {
    if (!initialFilePath || !fs.existsSync(initialFilePath)) return null;
    try {
      const content = fs.readFileSync(initialFilePath, 'utf8');
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
    const content = fs.readFileSync(filePath, 'utf8');
    return {
      filePath,
      fileName: path.basename(filePath),
      content,
    };
  });

  ipcMain.handle('file:readByPath', (_event, targetPath, baseFilePath) => {
    const resolved = resolveTargetFilePath(targetPath, baseFilePath);
    if (!resolved || !fs.existsSync(resolved)) {
      return { ok: false, error: 'ファイルが見つかりません', resolvedPath: resolved };
    }
    try {
      const content = fs.readFileSync(resolved, 'utf8');
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
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      return { ok: true, filePath };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('dialog:saveMmFile', async (_event, defaultName, content, baseFilePath) => {
    const defaultPath = baseFilePath || `${defaultName || 'mindmap'}.mm`;
    const res = await dialog.showSaveDialog(mainWindow, {
      title: '名前を付けて保存',
      defaultPath,
      filters: [
        { name: 'FreeMind (.mm)', extensions: ['mm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || !res.filePath) return { canceled: true };
    fs.writeFileSync(res.filePath, content, 'utf8');
    return {
      canceled: false,
      filePath: res.filePath,
      fileName: path.basename(res.filePath),
    };
  });

  ipcMain.handle('dialog:pickTargetMmFile', async (_event, baseFilePath) => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'リンク先のマインドマップ (.mm) を選択',
      properties: ['openFile'],
      defaultPath: baseFilePath ? path.dirname(baseFilePath) : undefined,
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

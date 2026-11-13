const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');

let mainWindow = null;
let initialFilePath = null;

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

  mainWindow.on('closed', () => {
    mainWindow = null;
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

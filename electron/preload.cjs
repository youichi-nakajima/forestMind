const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getInitialFile: () => ipcRenderer.invoke('app:getInitialFile'),
  onOpenFile: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:openFile', listener);
    return () => ipcRenderer.removeListener('app:openFile', listener);
  },
  openMmFile: () => ipcRenderer.invoke('dialog:openMmFile'),
  readFileByPath: (targetPath, baseFilePath) =>
    ipcRenderer.invoke('file:readByPath', targetPath, baseFilePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', filePath, content),
  saveMmFileDialog: (defaultName, content, baseFilePath) =>
    ipcRenderer.invoke('dialog:saveMmFile', defaultName, content, baseFilePath),
  pickTargetMmFile: baseFilePath => ipcRenderer.invoke('dialog:pickTargetMmFile', baseFilePath),
});


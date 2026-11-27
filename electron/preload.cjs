const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
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
  scanMmFolder: () => ipcRenderer.invoke('dialog:scanMmFolder'),
  getWorkspaceState: () => ipcRenderer.invoke('workspace:getState'),
  removeRecentFile: filePath => ipcRenderer.invoke('workspace:removeRecentFile', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('workspace:clearRecentFiles'),
  pickForestFolder: () => ipcRenderer.invoke('workspace:pickForestFolder'),
  addForestFolder: folderPath => ipcRenderer.invoke('workspace:addForestFolder', folderPath),
  removeForestFolder: folderPath => ipcRenderer.invoke('workspace:removeForestFolder', folderPath),
  scanMmFolderByPath: folderPath => ipcRenderer.invoke('workspace:scanFolderByPath', folderPath),
  confirmUnsaved: title => ipcRenderer.invoke('dialog:confirmUnsaved', title),
  confirmTrashMmFile: payload => ipcRenderer.invoke('dialog:confirmTrashMmFile', payload),
  trashMmFile: filePath => ipcRenderer.invoke('file:trashMmFile', filePath),
  onRequestClose: callback => {
    const listener = () => callback();
    ipcRenderer.on('app:requestClose', listener);
    return () => ipcRenderer.removeListener('app:requestClose', listener);
  },
  confirmAppClose: () => ipcRenderer.send('app:confirmClose'),
});

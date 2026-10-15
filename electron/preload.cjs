const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sermonDesktop', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportDocx: (document) => ipcRenderer.invoke('document:docx', document),
  addAttachment: (documentId) => ipcRenderer.invoke('attachment:add', documentId),
  deleteAttachment: (attachment) => ipcRenderer.invoke('attachment:delete', attachment),
  openAttachment: (path) => ipcRenderer.invoke('attachment:open', path),
  importDocument: () => ipcRenderer.invoke('document:import'),
  getAIKeyStatus: () => ipcRenderer.invoke('ai:key:status'),
  setAIKey: (key) => ipcRenderer.invoke('ai:key:set', key),
  testAIKey: () => ipcRenderer.invoke('ai:key:test'),
  clearAIKey: () => ipcRenderer.invoke('ai:key:clear'),
  generateAI: (request) => ipcRenderer.invoke('ai:generate', request),
  validateAI: (request) => ipcRenderer.invoke('ai:validate', request),
  createBackup: () => ipcRenderer.invoke('backup:create'),
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (listener) => {
    const handler = (_event, status) => listener(status)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  },
})

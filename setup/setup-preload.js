const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setupAPI', {
  getDefaults: () => ipcRenderer.invoke('setup:get-defaults'),
  pickDirectory: () => ipcRenderer.invoke('setup:pick-directory'),
  setPassword: (password) => ipcRenderer.invoke('setup:set-password', password),
  setDiscord: (webhookUrl) => ipcRenderer.invoke('setup:set-discord', webhookUrl),
  downloadChrome: () => ipcRenderer.invoke('setup:download-chrome'),
  complete: (config) => ipcRenderer.invoke('setup:complete', config),
  onChromeProgress: (callback) => {
    ipcRenderer.on('setup:chrome-progress', (_event, data) => callback(data));
  },
});

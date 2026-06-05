const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, world-accessible API to the renderer process (your webpage).
// This API allows the webpage to send a command but doesn't expose any other Node.js or Electron internals.
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Sends file data to the main process for saving.
   * @param {object} args - An object containing filePath, metadata, and coverArtBase64.
   * @returns {Promise<object>} A promise that resolves with the result from the main process.
   */
  saveFile: (args) => ipcRenderer.invoke('save-file', args)
});
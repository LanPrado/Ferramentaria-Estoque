const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Autenticação
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Banco de dados
  readDatabase: () => ipcRenderer.invoke('read-database'),
  writeDatabase: (data) => ipcRenderer.invoke('write-database', data),
  
  // Utilitários
  showNotification: (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }
});
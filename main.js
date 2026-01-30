const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Configurar caminhos
const userDataPath = app.getPath('userData');
const appDataPath = path.join(userDataPath, 'FerramentariaControle');
const dbPath = path.join(appDataPath, 'database.json');

// Garantir que as pastas existem
function initAppDirectories() {
  if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
  }
  
  // Inicializar banco de dados se não existir
  if (!fs.existsSync(dbPath)) {
    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync('admin123', salt);
    
    const initialData = {
      users: [
        {
          id: '1',
          username: 'admin',
          password: hashedPassword,
          name: 'Administrador',
          companyCode: '000000',
          isAdmin: true,
          createdAt: new Date().toISOString()
        }
      ],
      tools: [
        {
          id: '1',
          code: 'F001',
          name: 'Martelo',
          category: 'Ferramenta Manual',
          available: true,
          status: 'disponivel'
        },
        {
          id: '2',
          code: 'F002',
          name: 'Chave de Fenda',
          category: 'Ferramenta Manual',
          available: true,
          status: 'disponivel'
        },
        {
          id: '3',
          code: 'F003',
          name: 'Alicate',
          category: 'Ferramenta Manual',
          available: true,
          status: 'disponivel'
        }
      ],
      loans: [],
      settings: {
        companyName: 'Empresa'
      }
    };
    
    fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
  }
}

// Criar janelas
let mainWindow;
let loginWindow;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  loginWindow.loadFile('login.html');
  
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico')
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Para desenvolvimento
  // mainWindow.webContents.openDevTools();
}

// Função para abrir a tela principal após login bem-sucedido
function openMainWindow() {
  if (loginWindow) {
    loginWindow.close();
  }
  
  if (!mainWindow) {
    createMainWindow();
  } else {
    mainWindow.focus();
  }
}

// Handlers IPC
ipcMain.handle('read-database', () => {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler banco de dados:', error);
    return { users: [], tools: [], loans: [], settings: {} };
  }
});

ipcMain.handle('write-database', (event, data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao escrever banco de dados:', error);
    return false;
  }
});

ipcMain.handle('login', async (event, credentials) => {
  try {
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const user = data.users.find(u => u.username === credentials.username);
    
    if (!user) {
      return { success: false, message: 'Usuário não encontrado' };
    }
    
    const bcrypt = require('bcryptjs');
    const passwordMatch = bcrypt.compareSync(credentials.password, user.password);
    
    if (passwordMatch) {
      // Abrir a tela principal quando o login for bem-sucedido
      openMainWindow();
      
      return { 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          companyCode: user.companyCode,
          isAdmin: user.isAdmin
        }
      };
    } else {
      return { success: false, message: 'Senha incorreta' };
    }
  } catch (error) {
    return { success: false, message: 'Erro ao processar login' };
  }
});

ipcMain.handle('logout', () => {
  if (mainWindow) {
    mainWindow.close();
  }
  
  // Reabrir a janela de login
  if (!loginWindow) {
    createLoginWindow();
  } else {
    loginWindow.focus();
  }
  
  return true;
});

// Função para mostrar notificação (opcional)
ipcMain.handle('show-notification', (event, title, body) => {
  const { Notification } = require('electron');
  
  if (Notification.isSupported()) {
    new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, 'assets', 'icon.ico')
    }).show();
  }
  
  return true;
});

// Iniciar aplicação
app.whenReady().then(() => {
  initAppDirectories();
  createLoginWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
const { app, BrowserWindow, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let tray;
let backendProcess;
const PORT = 9876;

// Get the path to the backend binary
function getBackendPath() {
  if (app.isPackaged) {
    // In packaged app, backend is in resources
    const platform = process.platform;
    const binaryName = platform === 'win32' ? 'binsh-server.exe' : 'binsh-server';
    return path.join(process.resourcesPath, 'backend', binaryName);
  } else {
    // In development
    const platform = process.platform;
    const binaryName = platform === 'win32' ? 'binsh-server.exe' : 'binsh-server';
    return path.join(__dirname, '..', 'backend-bin', binaryName);
  }
}

// Start the Go backend server
function startBackend() {
  const backendPath = getBackendPath();
  console.log('Starting backend from:', backendPath);

  try {
    // Get real home directory for snap environment
    const realHome = process.env.SNAP_REAL_HOME || process.env.HOME || require('os').homedir();
    
    backendProcess = spawn(backendPath, [], {
      env: {
        ...process.env,
        BINSH_PORT: PORT.toString(),
        SNAP_REAL_HOME: realHome,
        REAL_HOME: realHome,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      if (code !== 0 && mainWindow) {
        // Backend crashed, try to restart
        setTimeout(startBackend, 1000);
      }
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
    });
  } catch (err) {
    console.error('Error starting backend:', err);
  }
}

// Wait for backend to be ready
function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    const checkHealth = (attempt) => {
      const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (attempt < retries) {
          setTimeout(() => checkHealth(attempt + 1), 500);
        } else {
          reject(new Error('Backend health check failed'));
        }
      });

      req.on('error', () => {
        if (attempt < retries) {
          setTimeout(() => checkHealth(attempt + 1), 500);
        } else {
          reject(new Error('Backend not responding'));
        }
      });

      req.setTimeout(1000, () => {
        req.destroy();
        if (attempt < retries) {
          setTimeout(() => checkHealth(attempt + 1), 500);
        } else {
          reject(new Error('Backend timeout'));
        }
      });
    };

    checkHealth(0);
  });
}

// Create the main application window
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icons', 'binsh-256.png')
    : path.join(__dirname, '..', 'assets', 'icons', 'binsh-256.png');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: iconPath,
    title: 'binsh - SSH Client',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Don't show until ready
  });

  // Load the app from backend server
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close - minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icons', 'binsh-32.png')
    : path.join(__dirname, '..', 'assets', 'icons', 'binsh-32.png');

  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open binsh',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('binsh - SSH Client');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// App ready
app.whenReady().then(async () => {
  // Start backend first
  startBackend();

  // Wait for backend to be ready
  try {
    await waitForBackend();
    console.log('Backend is ready!');
  } catch (err) {
    console.error('Backend failed to start:', err);
  }

  // Create window and tray
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up backend on quit
app.on('before-quit', () => {
  app.isQuitting = true;
  if (backendProcess) {
    backendProcess.kill();
  }
});

app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: src/main.js                                               ║
// ║  LAYER: main                                                      ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyWeb Main Application
 * Comet + Chromium Fusion Browser with Sacred Geometry UI
 */

import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'path';
import { EngineRouter } from './core/EngineRouter.js';
import { SacredGeometryUI } from './ui/SacredGeometryUI.js';

class HeadyWebApp {
  constructor() {
    this.isReady = false;
    this.windows = new Map();
    this.engineRouter = null;
    this.sacredUI = null;
    this.mainWindow = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize core systems
      await this.setupEngineRouter();
      await this.setupSacredUI();
      await this.setupEventHandlers();
      await this.setupMenu();
      
      this.isReady = true;
      console.log('🚀 HeadyWeb initialized successfully');
    } catch (error) {
      console.error('❌ HeadyWeb initialization failed:', error);
    }
  }

  async setupEngineRouter() {
    this.engineRouter = new EngineRouter();
    
    // Listen for engine events
    this.engineRouter.on('engines-initialized', () => {
      console.log('⚡ Engines ready');
    });
    
    this.engineRouter.on('engine-switched', ({ from, to, url }) => {
      console.log(`🔄 Engine switched from ${from.constructor.name} to ${to.constructor.name} for ${url}`);
    });
    
    this.engineRouter.on('navigation-complete', ({ url, engine, loadTime }) => {
      console.log(`✅ Navigation complete: ${url} via ${engine.constructor.name} in ${loadTime.toFixed(2)}ms`);
    });
  }

  async setupSacredUI() {
    this.sacredUI = new SacredGeometryUI();
    
    // Listen for UI events
    this.sacredUI.on('initialized', () => {
      console.log('🔮 Sacred UI ready');
    });
    
    this.sacredUI.on('navigation-action', ({ action }) => {
      this.handleNavigationAction(action);
    });
  }

  async setupEventHandlers() {
    // App events
    app.whenReady().then(() => {
      this.createMainWindow();
    });
    
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      }
    });
    
    // IPC events
    ipcMain.handle('navigate-to-url', async (event, url) => {
      return await this.engineRouter.navigateTo(url);
    });
    
    ipcMain.handle('get-engine-metrics', () => {
      return this.engineRouter.getPerformanceMetrics();
    });
    
    ipcMain.handle('switch-engine', async (event, engineName) => {
      const engine = engineName === 'comet' ? this.engineRouter.engines.comet : this.engineRouter.engines.chromium;
      return await this.engineRouter.switchEngine(engine, 'manual-switch');
    });
    
    ipcMain.handle('get-sacred-patterns', () => {
      return Array.from(this.sacredUI.patterns.keys());
    });
    
    ipcMain.handle('apply-sacred-animation', async (event, component, animation) => {
      return this.sacredUI.applyAnimation(component, animation);
    });
  }

  async setupMenu() {
    const template = [
      {
        label: 'HeadyWeb',
        submenu: [
          {
            label: 'About HeadyWeb',
            click: () => {
              this.showAboutDialog();
            }
          },
          { type: 'separator' },
          {
            label: 'Preferences',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.showPreferences();
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+N',
            click: () => {
              this.createNewWindow();
            }
          },
          {
            label: 'New Private Window',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => {
              this.createPrivateWindow();
            }
          },
          { type: 'separator' },
          {
            label: 'Open File',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              this.openFile();
            }
          }
        ]
      },
      {
        label: 'Engine',
        submenu: [
          {
            label: 'Auto-Select Engine',
            type: 'radio',
            checked: true,
            click: () => {
              this.engineRouter.currentEngine = null; // Auto mode
            }
          },
          {
            label: 'Chromium Beta',
            type: 'radio',
            click: () => {
              this.engineRouter.currentEngine = this.engineRouter.engines.chromium;
            }
          },
          {
            label: 'Comet Experimental',
            type: 'radio',
            click: () => {
              this.engineRouter.currentEngine = this.engineRouter.engines.comet;
            }
          },
          { type: 'separator' },
          {
            label: 'Engine Settings',
            click: () => {
              this.showEngineSettings();
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Toggle Sacred Geometry',
            accelerator: 'CmdOrCtrl+G',
            click: () => {
              this.toggleSacredGeometry();
            }
          },
          {
            label: 'Toggle Quantum Mode',
            accelerator: 'CmdOrCtrl+Q',
            click: () => {
              this.toggleQuantumMode();
            }
          },
          {
            label: 'Toggle AI Enhancement',
            accelerator: 'CmdOrCtrl+A',
            click: () => {
              this.toggleAIEnhancement();
            }
          },
          { type: 'separator' },
          {
            label: 'Developer Tools',
            accelerator: 'F12',
            click: () => {
              this.mainWindow?.webContents.openDevTools();
            }
          }
        ]
      },
      {
        label: 'Tools',
        submenu: [
          {
            label: 'Quantum Profiler',
            click: () => {
              this.openQuantumProfiler();
            }
          },
          {
            label: 'AI Analyzer',
            click: () => {
              this.openAIAnalyzer();
            }
          },
          {
            label: 'Sacred Geometry Inspector',
            click: () => {
              this.openSacredInspector();
            }
          },
          { type: 'separator' },
          {
            label: 'Extensions',
            click: () => {
              this.openExtensions();
            }
          }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'HeadyWeb Documentation',
            click: () => {
              shell.openExternal('https://headysystems.com/docs/headyweb');
            }
          },
          {
            label: 'Report Issue',
            click: () => {
              shell.openExternal('https://github.com/headysystems/headyweb/issues');
            }
          },
          {
            label: 'Check for Updates',
            click: () => {
              this.checkForUpdates();
            }
          }
        ]
      }
    ];
    
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  createMainWindow() {
    const mainWindowConfig = {
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.js'),
        experimentalFeatures: true,
        enableBlinkFeatures: 'WebGPU,WebNN,WebAssemblySIMD'
      },
      show: false,
      titleBarStyle: 'hiddenInset'
    };
    
    this.mainWindow = new BrowserWindow(mainWindowConfig);
    const windowId = 'main';
    this.windows.set(windowId, this.mainWindow);
    
    // Load the app
    this.mainWindow.loadFile(path.join(__dirname, '../index.html'));
    
    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Apply sacred geometry UI
      this.applySacredUIToWindow(this.mainWindow);
    });
    
    // Handle window events
    this.mainWindow.on('closed', () => {
      this.windows.delete(windowId);
      this.mainWindow = null;
    });
    
    this.mainWindow.webContents.on('did-finish-load', () => {
      this.mainWindow.setTitle('HeadyWeb - Comet + Chromium Fusion');
    });
  }

  async applySacredUIToWindow(window) {
    try {
      // Apply sacred geometry to browser window
      await this.sacredUI.renderBrowserWindow(window.webContents);
      
      // Apply breathing animation
      this.sacredUI.applyAnimation('browser-window', 'breathing');
    } catch (error) {
      console.error('❌ Failed to apply sacred UI:', error);
    }
  }

  createNewWindow() {
    const windowConfig = {
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    };
    
    const window = new BrowserWindow(windowConfig);
    const windowId = `window-${Date.now()}`;
    this.windows.set(windowId, window);
    
    window.loadFile(path.join(__dirname, '../index.html'));
    
    window.on('closed', () => {
      this.windows.delete(windowId);
    });
  }

  createPrivateWindow() {
    const windowConfig = {
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        partition: 'private-session'
      }
    };
    
    const window = new BrowserWindow(windowConfig);
    const windowId = `private-${Date.now()}`;
    this.windows.set(windowId, window);
    
    window.loadFile(path.join(__dirname, '../index.html'));
    
    window.on('closed', () => {
      this.windows.delete(windowId);
    });
  }

  handleNavigationAction(action) {
    switch (action) {
      case 'back':
        this.mainWindow?.webContents.goBack();
        break;
      case 'forward':
        this.mainWindow?.webContents.goForward();
        break;
      case 'refresh':
        this.mainWindow?.webContents.reload();
        break;
      case 'home':
        this.mainWindow?.webContents.loadURL('https://headysystems.com');
        break;
    }
  }

  showAboutDialog() {
    const aboutDialog = new BrowserWindow({
      width: 600,
      height: 400,
      parent: this.mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    aboutDialog.loadFile(path.join(__dirname, '../about.html'));
  }

  showPreferences() {
    const prefsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: this.mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    prefsWindow.loadFile(path.join(__dirname, '../preferences.html'));
  }

  showEngineSettings() {
    const engineWindow = new BrowserWindow({
      width: 700,
      height: 500,
      parent: this.mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    engineWindow.loadFile(path.join(__dirname, '../engine-settings.html'));
  }

  toggleSacredGeometry() {
    // Toggle sacred geometry visibility
    this.mainWindow?.webContents.send('toggle-sacred-geometry');
  }

  toggleQuantumMode() {
    // Toggle quantum acceleration mode
    this.mainWindow?.webContents.send('toggle-quantum-mode');
  }

  toggleAIEnhancement() {
    // Toggle AI enhancement
    this.mainWindow?.webContents.send('toggle-ai-enhancement');
  }

  openQuantumProfiler() {
    const profilerWindow = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    profilerWindow.loadFile(path.join(__dirname, '../quantum-profiler.html'));
  }

  openAIAnalyzer() {
    const aiWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    aiWindow.loadFile(path.join(__dirname, '../ai-analyzer.html'));
  }

  openSacredInspector() {
    const inspectorWindow = new BrowserWindow({
      width: 700,
      height: 500,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    inspectorWindow.loadFile(path.join(__dirname, '../sacred-inspector.html'));
  }

  openExtensions() {
    const extensionsWindow = new BrowserWindow({
      width: 900,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    extensionsWindow.loadFile(path.join(__dirname, '../extensions.html'));
  }

  openFile() {
    // Open file dialog
    const { dialog } = require('electron');
    
    dialog.showOpenDialog(this.mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }).then(result => {
      if (!result.canceled && result.filePaths.length > 0) {
        this.mainWindow?.webContents.loadURL(`file://${result.filePaths[0]}`);
      }
    });
  }

  checkForUpdates() {
    // Check for updates
    this.mainWindow?.webContents.send('checking-updates');
    
    // Simulate update check
    setTimeout(() => {
      this.mainWindow?.webContents.send('update-check-complete', {
        hasUpdate: false,
        version: '1.0.0-beta'
      });
    }, 2000);
  }

  async shutdown() {
    // Shutdown all systems
    if (this.engineRouter) {
      await this.engineRouter.shutdown();
    }
    
    if (this.sacredUI) {
      await this.sacredUI.cleanup();
    }
    
    // Close all windows
    for (const window of this.windows.values()) {
      window.close();
    }
    
    console.log('🌙 HeadyWeb shutdown complete');
  }
}

// Initialize HeadyWeb
const headyWebApp = new HeadyWebApp();

// Handle app shutdown
app.on('before-quit', async () => {
  await headyWebApp.shutdown();
});

export default HeadyWebApp;

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
// ║  FILE: src/preload.js                                           ║
// ║  LAYER: preload                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

/**
 * HeadyWeb Preload Script
 * Secure bridge between main and renderer processes
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Navigation
  navigateToUrl: (url) => ipcRenderer.invoke('navigate-to-url', url),
  
  // Engine management
  getEngineMetrics: () => ipcRenderer.invoke('get-engine-metrics'),
  switchEngine: (engineName) => ipcRenderer.invoke('switch-engine', engineName),
  
  // Sacred Geometry UI
  getSacredPatterns: () => ipcRenderer.invoke('get-sacred-patterns'),
  applySacredAnimation: (component, animation) => ipcRenderer.invoke('apply-sacred-animation', component, animation),
  
  // Quantum computing
  quantumCompute: (circuit) => ipcRenderer.invoke('quantum-compute', circuit),
  getQuantumMetrics: () => ipcRenderer.invoke('get-quantum-metrics'),
  
  // AI enhancement
  neuralEnhance: (imageData) => ipcRenderer.invoke('neural-enhance', imageData),
  analyzeContent: (content) => ipcRenderer.invoke('analyze-content', content),
  
  // System information
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getPerformanceMetrics: () => ipcRenderer.invoke('get-performance-metrics'),
  
  // Events
  onNavigateToUrl: (callback) => ipcRenderer.on('navigate-to-url', callback),
  onToggleSacredGeometry: (callback) => ipcRenderer.on('toggle-sacred-geometry', callback),
  onToggleQuantumMode: (callback) => ipcRenderer.on('toggle-quantum-mode', callback),
  onToggleAIEnhancement: (callback) => ipcRenderer.on('toggle-ai-enhancement', callback),
  onEngineSwitched: (callback) => ipcRenderer.on('engine-switched', callback),
  onPerformanceUpdate: (callback) => ipcRenderer.on('performance-update', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Expose HeadyWeb specific APIs
contextBridge.exposeInMainWorld('headyAPI', {
  // Browser engine information
  getEngineInfo: () => ({
    chromium: {
      version: 'beta-latest',
      features: ['extensions', 'devtools', 'security', 'standards']
    },
    comet: {
      version: 'beta-experimental',
      features: ['webgpu', 'quantum', 'neural', 'ai-rendering']
    }
  }),
  
  // Sacred geometry constants
  sacredGeometry: {
    phi: 1.618033988749895,
    root2: 1.414213562373095,
    root3: 1.732050807568877,
    root5: 2.23606797749979
  },
  
  // Quantum computing bridge
  quantum: {
    compute: async (circuit) => {
      return await ipcRenderer.invoke('quantum-compute', circuit);
    },
    optimize: async (url) => {
      return await ipcRenderer.invoke('quantum-optimize', url);
    },
    getMetrics: async () => {
      return await ipcRenderer.invoke('get-quantum-metrics');
    }
  },
  
  // AI enhancement bridge
  ai: {
    enhance: async (imageData) => {
      return await ipcRenderer.invoke('neural-enhance', imageData);
    },
    analyze: async (content) => {
      return await ipcRenderer.invoke('analyze-content', content);
    },
    predict: async (features) => {
      return await ipcRenderer.invoke('predict-performance', features);
    }
  }
});

// Development mode detection
contextBridge.exposeInMainWorld('headyDev', {
  isDev: process.env.NODE_ENV === 'development',
  platform: process.platform,
  versions: process.versions,
  
  // Debug utilities
  log: (...args) => console.log('[HeadyWeb]', ...args),
  error: (...args) => console.error('[HeadyWeb Error]', ...args),
  warn: (...args) => console.warn('[HeadyWeb Warning]', ...args)
});

// Security: Prevent node integration in renderer
window.node = undefined;
window.require = undefined;
window.process = undefined;
window.global = undefined;
window.Buffer = undefined;

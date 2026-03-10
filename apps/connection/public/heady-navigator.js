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
// ║  FILE: apps/connection/public/heady-navigator.js                                                    ║
// ║  LAYER: ui/public                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyStudio Unified Navigation System
 * Provides seamless navigation and state management across all Heady modules
 */

class HeadyNavigator {
    constructor() {
        this.modules = {
            studio: {
                id: 'studio',
                name: 'HeadyStudio',
                path: '/studio',
                icon: 'palette',
                color: 'purple',
                apis: ['canvas', 'assets', 'projects', 'collaboration']
            },
            music: {
                id: 'music',
                name: 'HeadyMusic',
                path: '/music',
                icon: 'music',
                color: 'green',
                apis: ['tracks', 'mixer', 'effects', 'instruments', 'export']
            },
            education: {
                id: 'education',
                name: 'HeadyEd',
                path: '/education',
                icon: 'book-open',
                color: 'blue',
                apis: ['courses', 'students', 'assessments', 'analytics']
            },
            development: {
                id: 'development',
                name: 'HeadyDev',
                path: '/development',
                icon: 'code',
                color: 'orange',
                apis: ['repositories', 'ide', 'build', 'deploy', 'monitor']
            },
            cloud: {
                id: 'cloud',
                name: 'HeadyCloud',
                path: '/cloud',
                icon: 'cloud',
                color: 'cyan',
                apis: ['storage', 'database', 'gateway', 'monitoring']
            }
        };
        
        this.currentModule = 'studio';
        this.state = new Map();
        this.eventBus = new EventTarget();
        this.apis = new Map();
        this.initialized = false;
    }

    // Initialize the navigation system
    async initialize() {
        if (this.initialized) return;
        
        // Setup API connections
        await this.setupAPIs();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup routing
        this.setupRouting();
        
        // Load saved state
        await this.loadState();
        
        this.initialized = true;
        this.emit('navigator:initialized');
    }

    // Setup API connections for each module
    async setupAPIs() {
        const baseUrls = {
            development: 'http://localhost:3100',
            studio: 'http://localhost:8080',
            music: 'http://localhost:8081',
            education: 'http://localhost:8082',
            cloud: 'http://localhost:8083'
        };

        for (const [moduleId, config] of Object.entries(this.modules)) {
            const baseUrl = baseUrls[moduleId] || 'http://localhost:3100';
            
            this.apis.set(moduleId, {
                async call(endpoint, options = {}) {
                    const url = `${baseUrl}/api${endpoint}`;
                    try {
                        const response = await fetch(url, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Heady-Module': moduleId,
                                ...options.headers
                            },
                            ...options
                        });
                        
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        
                        return await response.json();
                    } catch (error) {
                        console.warn(`API call failed for ${moduleId}:${endpoint}`, error);
                        return null;
                    }
                },

                async post(endpoint, data = {}) {
                    return this.call(endpoint, {
                        method: 'POST',
                        body: JSON.stringify(data)
                    });
                },

                async get(endpoint) {
                    return this.call(endpoint);
                }
            });
        }
    }

    // Setup event listeners for cross-module communication
    setupEventListeners() {
        // Listen for module changes
        this.addEventListener('navigator:module-changed', (event) => {
            const { from, to, context } = event.detail;
            this.handleModuleTransition(from, to, context);
        });

        // Listen for state changes
        this.addEventListener('navigator:state-changed', (event) => {
            const { module, key, value } = event.detail;
            this.saveState(module, key, value);
        });

        // Listen for project actions
        this.addEventListener('project:action', (event) => {
            this.handleProjectAction(event.detail);
        });

        // Listen for user actions
        this.addEventListener('user:action', (event) => {
            this.handleUserAction(event.detail);
        });
    }

    // Setup client-side routing
    setupRouting() {
        window.addEventListener('popstate', (event) => {
            const path = window.location.pathname;
            const module = this.getModuleFromPath(path);
            if (module && module !== this.currentModule) {
                this.navigateToModule(module, { replace: true });
            }
        });

        // Handle initial route
        const initialPath = window.location.pathname;
        const initialModule = this.getModuleFromPath(initialPath);
        if (initialModule) {
            this.currentModule = initialModule;
        }
    }

    // Get module from path
    getModuleFromPath(path) {
        for (const [moduleId, config] of Object.entries(this.modules)) {
            if (path.startsWith(config.path)) {
                return moduleId;
            }
        }
        return null;
    }

    // Navigate to a specific module
    async navigateToModule(moduleId, options = {}) {
        if (!this.modules[moduleId]) {
            throw new Error(`Unknown module: ${moduleId}`);
        }

        const previousModule = this.currentModule;
        
        // Update current module
        this.currentModule = moduleId;
        
        // Update URL
        if (!options.replace) {
            history.pushState(
                { module: moduleId, from: previousModule },
                this.modules[moduleId].name,
                this.modules[moduleId].path
            );
        }

        // Emit event
        this.emit('navigator:module-changed', {
            from: previousModule,
            to: moduleId,
            context: options.context || {}
        });

        // Initialize module if needed
        await this.initializeModule(moduleId);
    }

    // Initialize a module
    async initializeModule(moduleId) {
        const module = this.modules[moduleId];
        const api = this.apis.get(moduleId);
        
        if (!api) return;

        try {
            // Check module health
            const health = await api.get('/health');
            if (health && health.status === 'ok') {
                this.emit('module:ready', { module: moduleId });
            } else {
                this.emit('module:error', { module: moduleId, error: 'Health check failed' });
            }
        } catch (error) {
            console.warn(`Failed to initialize module ${moduleId}:`, error);
            this.emit('module:error', { module: moduleId, error });
        }
    }

    // Handle module transitions
    handleModuleTransition(from, to, context) {
        // Save state of previous module
        if (from) {
            this.saveModuleState(from);
        }

        // Load state of new module
        this.loadModuleState(to);

        // Handle context passing
        if (context.project) {
            this.emit('project:load', { module: to, project: context.project });
        }

        if (context.user) {
            this.emit('user:session', { module: to, user: context.user });
        }
    }

    // Handle project actions
    async handleProjectAction(action) {
        const { type, project, module, data } = action;

        switch (type) {
            case 'create':
                await this.createProject(project, module, data);
                break;
            case 'update':
                await this.updateProject(project, module, data);
                break;
            case 'delete':
                await this.deleteProject(project, module);
                break;
            case 'share':
                await this.shareProject(project, module, data);
                break;
            case 'export':
                await this.exportProject(project, module, data);
                break;
        }
    }

    // Create a project
    async createProject(project, module, data) {
        const api = this.apis.get(module);
        if (!api) return;

        try {
            const result = await api.post('/projects', {
                name: project.name,
                type: project.type,
                ...data
            });

            if (result) {
                this.emit('project:created', { project: result.project, module });
                this.saveState(module, 'projects', result.projects);
            }
        } catch (error) {
            this.emit('project:error', { action: 'create', error, project });
        }
    }

    // Update a project
    async updateProject(project, module, data) {
        const api = this.apis.get(module);
        if (!api) return;

        try {
            const result = await api.post(`/projects/${project.id}`, data);
            
            if (result) {
                this.emit('project:updated', { project: result.project, module });
                this.updateState(module, 'projects', result.projects);
            }
        } catch (error) {
            this.emit('project:error', { action: 'update', error, project });
        }
    }

    // Share a project across modules
    async shareProject(project, fromModule, options) {
        const { targetModules, permissions } = options;

        for (const targetModule of targetModules) {
            const api = this.apis.get(targetModule);
            if (!api) continue;

            try {
                await api.post('/shared-projects', {
                    sourceModule: fromModule,
                    projectId: project.id,
                    projectName: project.name,
                    permissions
                });

                this.emit('project:shared', { 
                    project, 
                    fromModule, 
                    toModule: targetModule 
                });
            } catch (error) {
                this.emit('project:error', { action: 'share', error, project });
            }
        }
    }

    // Export project in different formats
    async exportProject(project, module, options) {
        const api = this.apis.get(module);
        if (!api) return;

        try {
            const result = await api.post(`/projects/${project.id}/export`, options);
            
            if (result) {
                this.emit('project:exported', { 
                    project, 
                    module, 
                    format: options.format,
                    url: result.downloadUrl 
                });
            }
        } catch (error) {
            this.emit('project:error', { action: 'export', error, project });
        }
    }

    // Handle user actions
    handleUserAction(action) {
        const { type, data } = action;

        switch (type) {
            case 'login':
                this.handleUserLogin(data);
                break;
            case 'logout':
                this.handleUserLogout();
                break;
            case 'profile-update':
                this.handleProfileUpdate(data);
                break;
        }
    }

    // Handle user login
    async handleUserLogin(credentials) {
        try {
            // Authenticate with main orchestrator
            const orchestratorApi = this.apis.get('development');
            const result = await orchestratorApi.post('/auth/login', credentials);

            if (result && result.user) {
                // Set user session
                this.setState('user', result.user);
                
                // Notify all modules
                for (const moduleId of Object.keys(this.modules)) {
                    this.emit('user:session', { module: moduleId, user: result.user });
                }

                this.emit('user:logged-in', { user: result.user });
            }
        } catch (error) {
            this.emit('auth:error', { action: 'login', error });
        }
    }

    // Handle user logout
    handleUserLogout() {
        // Clear user session
        this.setState('user', null);

        // Notify all modules
        for (const moduleId of Object.keys(this.modules)) {
            this.emit('user:logout', { module: moduleId });
        }

        this.emit('user:logged-out');
    }

    // State management
    setState(key, value) {
        this.state.set(key, value);
        this.emit('navigator:state-changed', { key, value });
    }

    getState(key) {
        return this.state.get(key);
    }

    updateState(module, key, value) {
        const moduleKey = `${module}:${key}`;
        this.setState(moduleKey, value);
    }

    getModuleState(module, key) {
        const moduleKey = `${module}:${key}`;
        return this.getState(moduleKey);
    }

    // Persist state to localStorage
    async saveState(module, key, value) {
        const storageKey = `heady:${module}:${key}`;
        try {
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (error) {
            console.warn('Failed to save state to localStorage:', error);
        }
    }

    // Load state from localStorage
    async loadState() {
        for (const moduleId of Object.keys(this.modules)) {
            try {
                const projectsKey = `heady:${moduleId}:projects`;
                const projectsData = localStorage.getItem(projectsKey);
                if (projectsData) {
                    this.updateState(moduleId, 'projects', JSON.parse(projectsData));
                }
            } catch (error) {
                console.warn(`Failed to load state for module ${moduleId}:`, error);
            }
        }
    }

    // Save module state
    saveModuleState(moduleId) {
        // This would be called when leaving a module
        // Implementation depends on what state needs to be saved
    }

    // Load module state
    loadModuleState(moduleId) {
        // This would be called when entering a module
        // Implementation depends on what state needs to be loaded
    }

    // Event system
    addEventListener(event, callback) {
        this.eventBus.addEventListener(event, callback);
    }

    removeEventListener(event, callback) {
        this.eventBus.removeEventListener(event, callback);
    }

    emit(event, data) {
        this.eventBus.dispatchEvent(new CustomEvent(event, { detail: data }));
    }

    // Get available modules
    getModules() {
        return this.modules;
    }

    // Get current module
    getCurrentModule() {
        return this.currentModule;
    }

    // Get module API
    getModuleAPI(moduleId) {
        return this.apis.get(moduleId);
    }

    // Check if module is available
    isModuleAvailable(moduleId) {
        return this.modules.hasOwnProperty(moduleId);
    }

    // Search across all modules
    async search(query, options = {}) {
        const results = {};
        
        for (const [moduleId, api] of this.apis) {
            try {
                const result = await api.get(`/search?q=${encodeURIComponent(query)}`);
                if (result) {
                    results[moduleId] = result;
                }
            } catch (error) {
                console.warn(`Search failed for module ${moduleId}:`, error);
            }
        }

        this.emit('search:completed', { query, results });
        return results;
    }
}

// Global instance
window.HeadyNavigator = new HeadyNavigator();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.HeadyNavigator.initialize();
    });
} else {
    window.HeadyNavigator.initialize();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeadyNavigator;
}

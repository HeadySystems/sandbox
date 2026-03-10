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
// ║  FILE: apps/connection/public/heady-auth-state.js                                                    ║
// ║  LAYER: ui/public                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
/**
 * HeadyStudio Unified Authentication & State Management
 * Provides centralized authentication, user management, and state persistence
 */

class HeadyAuth {
    constructor() {
        this.user = null;
        this.session = null;
        this.permissions = new Map();
        this.tokens = new Map();
        this.eventBus = new EventTarget();
        this.initialized = false;
        this.authEndpoints = {
            login: '/api/auth/login',
            logout: '/api/auth/logout',
            register: '/api/auth/register',
            refresh: '/api/auth/refresh',
            profile: '/api/auth/profile',
            verify: '/api/auth/verify'
        };
    }

    // Initialize authentication system
    async initialize() {
        if (this.initialized) return;

        // Load stored session
        await this.loadStoredSession();

        // Setup session refresh
        this.setupSessionRefresh();

        // Setup event listeners
        this.setupEventListeners();

        this.initialized = true;
        this.emit('auth:initialized');
    }

    // Load stored session from localStorage
    async loadStoredSession() {
        try {
            const storedSession = localStorage.getItem('heady:session');
            if (storedSession) {
                const session = JSON.parse(storedSession);
                
                // Validate session
                if (await this.validateSession(session)) {
                    this.session = session;
                    this.user = session.user;
                    this.tokens.set('access', session.accessToken);
                    this.tokens.set('refresh', session.refreshToken);
                    
                    this.emit('auth:session-restored', { user: this.user });
                } else {
                    // Session invalid, clear it
                    this.clearSession();
                }
            }
        } catch (error) {
            console.warn('Failed to load stored session:', error);
            this.clearSession();
        }
    }

    // Validate session with server
    async validateSession(session) {
        try {
            const response = await fetch(this.authEndpoints.verify, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.accessToken}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                return result.valid === true;
            }
        } catch (error) {
            console.warn('Session validation failed:', error);
        }
        
        return false;
    }

    // Login user
    async login(credentials) {
        try {
            const response = await fetch(this.authEndpoints.login, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                throw new Error(`Login failed: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Setup session
            this.session = {
                user: result.user,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                expiresAt: result.expiresAt,
                permissions: result.permissions || []
            };

            this.user = result.user;
            this.tokens.set('access', result.accessToken);
            this.tokens.set('refresh', result.refreshToken);

            // Store permissions
            if (result.permissions) {
                result.permissions.forEach(permission => {
                    this.permissions.set(permission, true);
                });
            }

            // Save session
            this.saveSession();

            // Emit success event
            this.emit('auth:login-success', { user: this.user });

            return result;
        } catch (error) {
            this.emit('auth:login-error', { error });
            throw error;
        }
    }

    // Register new user
    async register(userData) {
        try {
            const response = await fetch(this.authEndpoints.register, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                throw new Error(`Registration failed: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Auto-login after successful registration
            if (result.autoLogin) {
                await this.login({
                    email: userData.email,
                    password: userData.password
                });
            }

            this.emit('auth:register-success', { user: result.user });
            return result;
        } catch (error) {
            this.emit('auth:register-error', { error });
            throw error;
        }
    }

    // Logout user
    async logout() {
        try {
            // Notify server
            if (this.session && this.session.accessToken) {
                await fetch(this.authEndpoints.logout, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.session.accessToken}`
                    }
                });
            }
        } catch (error) {
            console.warn('Logout notification failed:', error);
        }

        // Clear local session
        this.clearSession();

        // Emit logout event
        this.emit('auth:logout', { user: this.user });
    }

    // Clear session data
    clearSession() {
        this.user = null;
        this.session = null;
        this.tokens.clear();
        this.permissions.clear();
        
        localStorage.removeItem('heady:session');
        localStorage.removeItem('heady:user-preferences');
    }

    // Save session to localStorage
    saveSession() {
        if (this.session) {
            localStorage.setItem('heady:session', JSON.stringify(this.session));
        }
    }

    // Refresh access token
    async refreshAccessToken() {
        if (!this.tokens.has('refresh')) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(this.authEndpoints.refresh, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refreshToken: this.tokens.get('refresh')
                })
            });

            if (!response.ok) {
                throw new Error('Token refresh failed');
            }

            const result = await response.json();
            
            // Update tokens
            this.session.accessToken = result.accessToken;
            this.session.expiresAt = result.expiresAt;
            this.tokens.set('access', result.accessToken);
            
            if (result.refreshToken) {
                this.session.refreshToken = result.refreshToken;
                this.tokens.set('refresh', result.refreshToken);
            }

            // Save updated session
            this.saveSession();

            this.emit('auth:token-refreshed');
            return result.accessToken;
        } catch (error) {
            this.emit('auth:refresh-error', { error });
            // Force logout on refresh failure
            this.logout();
            throw error;
        }
    }

    // Setup automatic session refresh
    setupSessionRefresh() {
        setInterval(async () => {
            if (this.session && this.session.expiresAt) {
                const now = Date.now();
                const expiresAt = new Date(this.session.expiresAt).getTime();
                const timeUntilExpiry = expiresAt - now;
                
                // Refresh if token expires within 5 minutes
                if (timeUntilExpiry < 5 * 60 * 1000) {
                    try {
                        await this.refreshAccessToken();
                    } catch (error) {
                        console.warn('Auto refresh failed:', error);
                    }
                }
            }
        }, 60000); // Check every minute
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.user !== null && this.session !== null;
    }

    // Get current user
    getUser() {
        return this.user;
    }

    // Get access token
    getAccessToken() {
        return this.tokens.get('access');
    }

    // Check user permissions
    hasPermission(permission) {
        return this.permissions.has(permission);
    }

    // Update user profile
    async updateProfile(profileData) {
        try {
            const response = await fetch(this.authEndpoints.profile, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAccessToken()}`
                },
                body: JSON.stringify(profileData)
            });

            if (!response.ok) {
                throw new Error(`Profile update failed: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Update user data
            this.user = { ...this.user, ...result.user };
            this.session.user = this.user;
            
            // Save updated session
            this.saveSession();

            this.emit('auth:profile-updated', { user: this.user });
            return result;
        } catch (error) {
            this.emit('auth:profile-error', { error });
            throw error;
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Listen for authentication events
        this.addEventListener('auth:login-success', (event) => {
            console.log('User logged in:', event.detail.user);
        });

        this.addEventListener('auth:logout', (event) => {
            console.log('User logged out');
        });

        this.addEventListener('auth:token-refreshed', () => {
            console.log('Access token refreshed');
        });
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
}

/**
 * HeadyStudio State Manager
 * Centralized state management for all modules
 */

class HeadyStateManager {
    constructor() {
        this.state = new Map();
        this.subscribers = new Map();
        this.persistence = new Map();
        this.eventBus = new EventTarget();
        this.initialized = false;
    }

    // Initialize state manager
    async initialize() {
        if (this.initialized) return;

        // Load persisted state
        await this.loadPersistedState();

        // Setup auto-save
        this.setupAutoSave();

        this.initialized = true;
        this.emit('state:initialized');
    }

    // Get state value
    get(key, defaultValue = null) {
        const keys = key.split('.');
        let value = this.state;
        
        for (const k of keys) {
            if (value instanceof Map && value.has(k)) {
                value = value.get(k);
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    // Set state value
    set(key, value, options = {}) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let current = this.state;
        
        // Create nested structure if needed
        for (const k of keys) {
            if (!current.has(k)) {
                current.set(k, new Map());
            }
            current = current.get(k);
        }
        
        const oldValue = current.get(lastKey);
        current.set(lastKey, value);
        
        // Emit change event
        this.emit('state:changed', {
            key,
            value,
            oldValue,
            options
        });

        // Notify subscribers
        this.notifySubscribers(key, value, oldValue);

        // Persist if needed
        if (options.persist !== false) {
            this.persistState(key, value);
        }
    }

    // Update state value (for nested updates)
    update(key, updater, options = {}) {
        const currentValue = this.get(key);
        const newValue = updater(currentValue);
        this.set(key, newValue, options);
    }

    // Delete state value
    delete(key, options = {}) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        let current = this.state;
        
        for (const k of keys) {
            if (current.has(k)) {
                current = current.get(k);
            } else {
                return;
            }
        }
        
        const oldValue = current.get(lastKey);
        current.delete(lastKey);
        
        this.emit('state:deleted', {
            key,
            oldValue,
            options
        });

        // Notify subscribers
        this.notifySubscribers(key, undefined, oldValue);

        // Remove from persistence
        if (options.persist !== false) {
            this.removePersistedState(key);
        }
    }

    // Subscribe to state changes
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        
        this.subscribers.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const subscribers = this.subscribers.get(key);
            if (subscribers) {
                subscribers.delete(callback);
                if (subscribers.size === 0) {
                    this.subscribers.delete(key);
                }
            }
        };
    }

    // Notify subscribers of state changes
    notifySubscribers(key, value, oldValue) {
        // Notify exact matches
        const exactSubscribers = this.subscribers.get(key);
        if (exactSubscribers) {
            exactSubscribers.forEach(callback => {
                try {
                    callback(value, oldValue, key);
                } catch (error) {
                    console.error('State subscriber error:', error);
                }
            });
        }

        // Notify wildcard subscribers
        const keys = key.split('.');
        for (let i = keys.length - 1; i >= 0; i--) {
            const wildcardKey = keys.slice(0, i).join('.') + '.*';
            const wildcardSubscribers = this.subscribers.get(wildcardKey);
            if (wildcardSubscribers) {
                wildcardSubscribers.forEach(callback => {
                    try {
                        callback(value, oldValue, key);
                    } catch (error) {
                        console.error('State subscriber error:', error);
                    }
                });
            }
        }
    }

    // Persist state to localStorage
    persistState(key, value) {
        try {
            const storageKey = `heady:state:${key}`;
            const serialized = JSON.stringify(value);
            localStorage.setItem(storageKey, serialized);
            this.persistence.set(key, { value, timestamp: Date.now() });
        } catch (error) {
            console.warn('Failed to persist state:', error);
        }
    }

    // Remove persisted state
    removePersistedState(key) {
        try {
            const storageKey = `heady:state:${key}`;
            localStorage.removeItem(storageKey);
            this.persistence.delete(key);
        } catch (error) {
            console.warn('Failed to remove persisted state:', error);
        }
    }

    // Load persisted state from localStorage
    async loadPersistedState() {
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith('heady:state:')
            );

            for (const storageKey of keys) {
                const stateKey = storageKey.replace('heady:state:', '');
                const serialized = localStorage.getItem(storageKey);
                
                if (serialized) {
                    try {
                        const value = JSON.parse(serialized);
                        this.set(stateKey, value, { persist: false });
                        this.persistence.set(stateKey, { value, timestamp: Date.now() });
                    } catch (parseError) {
                        console.warn(`Failed to parse persisted state for ${stateKey}:`, parseError);
                    }
                }
            }

            this.emit('state:loaded');
        } catch (error) {
            console.warn('Failed to load persisted state:', error);
        }
    }

    // Setup auto-save
    setupAutoSave() {
        setInterval(() => {
            this.emit('state:auto-save');
        }, 30000); // Auto-save every 30 seconds
    }

    // Get all state (for debugging)
    getAllState() {
        const result = {};
        const mapToObject = (map) => {
            const obj = {};
            for (const [key, value] of map) {
                if (value instanceof Map) {
                    obj[key] = mapToObject(value);
                } else {
                    obj[key] = value;
                }
            }
            return obj;
        };
        return mapToObject(this.state);
    }

    // Clear all state
    clearAll() {
        this.state.clear();
        this.subscribers.clear();
        this.persistence.clear();
        
        // Clear localStorage
        const keys = Object.keys(localStorage).filter(key => 
            key.startsWith('heady:state:')
        );
        keys.forEach(key => localStorage.removeItem(key));
        
        this.emit('state:cleared');
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
}

// Global instances
window.HeadyAuth = new HeadyAuth();
window.HeadyStateManager = new HeadyStateManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await window.HeadyAuth.initialize();
        await window.HeadyStateManager.initialize();
    });
} else {
    window.HeadyAuth.initialize();
    window.HeadyStateManager.initialize();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HeadyAuth, HeadyStateManager };
}

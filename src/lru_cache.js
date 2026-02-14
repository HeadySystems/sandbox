/**
 * Heady Systems LRU Cache Implementation
 * 
 * High-performance caching for HeadyBuddy and Heady Systems
 * Optimized for API responses, session data, and computed results
 */

class LRUCache {
    constructor(capacity = 100) {
        this.capacity = capacity;
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
        this.totalRequests = 0;
    }

    get(key) {
        this.totalRequests++;
        
        if (this.cache.has(key)) {
            // Move to end (most recently used)
            const value = this.cache.get(key);
            this.cache.delete(key);
            this.cache.set(key, value);
            this.hits++;
            return value;
        }
        
        this.misses++;
        return null;
    }

    put(key, value, ttl = null) {
        if (this.cache.has(key)) {
            // Update existing
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        const item = {
            value,
            timestamp: Date.now(),
            ttl: ttl ? Date.now() + ttl : null
        };

        this.cache.set(key, item);
    }

    has(key) {
        const item = this.cache.get(key);
        if (!item) return false;
        
        // Check TTL
        if (item.ttl && Date.now() > item.ttl) {
            this.cache.delete(key);
            return false;
        }
        
        return true;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
        this.totalRequests = 0;
    }

    // Cleanup expired items
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (item.ttl && now > item.ttl) {
                this.cache.delete(key);
            }
        }
    }

    // Statistics
    getStats() {
        return {
            size: this.cache.size,
            capacity: this.capacity,
            hits: this.hits,
            misses: this.misses,
            hitRate: this.totalRequests > 0 ? (this.hits / this.totalRequests * 100).toFixed(2) + '%' : '0%',
            totalRequests: this.totalRequests
        };
    }

    // Get all keys (useful for debugging)
    keys() {
        return Array.from(this.cache.keys());
    }
}

// Cache instances for different use cases
const caches = {
    // API responses (5 min TTL, 50 items)
    api: new LRUCache(50),
    
    // User sessions (30 min TTL, 100 items)
    sessions: new LRUCache(100),
    
    // Heady Systems health (10 sec TTL, 20 items)
    health: new LRUCache(20),
    
    // Computed results (1 hour TTL, 30 items)
    computed: new LRUCache(30),
    
    // Static config (no TTL, 200 items)
    config: new LRUCache(200)
};

// Auto-cleanup every 5 minutes
setInterval(() => {
    Object.values(caches).forEach(cache => cache.cleanup());
}, 5 * 60 * 1000);

// Heady-specific cache decorators
function withCache(cacheName, ttl = null) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function(...args) {
            const key = `${propertyKey}:${JSON.stringify(args)}`;
            const cache = caches[cacheName];
            
            // Check cache first
            if (cache.has(key)) {
                const cached = cache.get(key);
                return cached.value;
            }
            
            // Execute original method
            const result = await originalMethod.apply(this, args);
            
            // Cache the result
            cache.put(key, result, ttl);
            
            return result;
        };
        
        return descriptor;
    };
}

module.exports = {
    LRUCache,
    caches,
    withCache
};

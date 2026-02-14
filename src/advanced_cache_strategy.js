/**
 * Heady Systems Advanced Cache Strategy
 * 
 * Progressive caching approach for optimal performance
 * Most responses should eventually be cached with intelligent TTL
 */

class AdvancedCacheStrategy {
    constructor() {
        // Multi-tier cache system
        this.caches = {
            // L1: Hot cache (frequently accessed)
            hot: new LRUCache(200, 600000), // 200 items, 10 min TTL
            
            // L2: Warm cache (moderately accessed)  
            warm: new LRUCache(500, 1800000), // 500 items, 30 min TTL
            
            // L3: Cold cache (rarely accessed)
            cold: new LRUCache(1000, 7200000), // 1000 items, 2 hour TTL
            
            // Static cache (config, templates)
            static: new LRUCache(300, 86400000), // 300 items, 24 hour TTL
        };
        
        // Access frequency tracking
        this.frequencyMap = new Map();
        this.lastAccess = new Map();
        
        // Cache promotion thresholds
        this.thresholds = {
            hot: 10,      // 10+ accesses in last hour
            warm: 3,      // 3-9 accesses in last hour
            cold: 1       // 1-2 accesses in last hour
        };
    }

    get(key) {
        const now = Date.now();
        
        // Track frequency
        this.frequencyMap.set(key, (this.frequencyMap.get(key) || 0) + 1);
        this.lastAccess.set(key, now);
        
        // Check caches in order: hot → warm → cold → static
        for (const [cacheName, cache] of Object.entries(this.caches)) {
            if (cache.has(key)) {
                const item = cache.get(key);
                
                // Promote to higher tier if needed
                this.promoteIfNeeded(key, item, cacheName);
                
                return item;
            }
        }
        
        return null;
    }

    put(key, value, category = 'auto') {
        const ttl = this.calculateTTL(key, category);
        const targetCache = this.determineTargetCache(key);
        
        this.caches[targetCache].put(key, value, ttl);
    }

    calculateTTL(key, category) {
        const baseTTLs = {
            // API responses
            'api-health': 10000,        // 10 seconds
            'api-config': 3600000,      // 1 hour
            'api-user': 1800000,        // 30 minutes
            'api-chat': 300000,         // 5 minutes
            
            // HeadyBuddy responses
            'buddy-greeting': 86400000, // 24 hours
            'buddy-suggestion': 3600000, // 1 hour
            'buddy-motivation': 7200000, // 2 hours
            'buddy-planning': 1800000,   // 30 minutes
            
            // System responses
            'system-error': 60000,      // 1 minute
            'system-status': 30000,     // 30 seconds
            'system-metrics': 15000,     // 15 seconds
            
            // Default
            'auto': 300000              // 5 minutes
        };
        
        const baseTTL = baseTTLs[category] || baseTTLs.auto;
        const frequency = this.frequencyMap.get(key) || 0;
        
        // Increase TTL based on frequency
        const frequencyMultiplier = Math.min(1 + (frequency * 0.1), 3);
        
        return Math.round(baseTTL * frequencyMultiplier);
    }

    determineTargetCache(key) {
        const frequency = this.frequencyMap.get(key) || 0;
        const lastAccess = this.lastAccess.get(key) || 0;
        const now = Date.now();
        const hoursSinceAccess = (now - lastAccess) / (1000 * 60 * 60);
        
        // Hot cache: high frequency, recent access
        if (frequency >= this.thresholds.hot && hoursSinceAccess < 1) {
            return 'hot';
        }
        
        // Warm cache: moderate frequency, recent access
        if (frequency >= this.thresholds.warm && hoursSinceAccess < 6) {
            return 'warm';
        }
        
        // Cold cache: low frequency or older access
        if (frequency >= this.thresholds.cold && hoursSinceAccess < 24) {
            return 'cold';
        }
        
        // Static cache: configuration and templates
        if (key.includes('config') || key.includes('template') || key.includes('static')) {
            return 'static';
        }
        
        // Default to warm cache
        return 'warm';
    }

    promoteIfNeeded(key, item, currentCache) {
        const targetCache = this.determineTargetCache(key);
        
        if (targetCache !== currentCache && this.getCacheHierarchy(targetCache) > this.getCacheHierarchy(currentCache)) {
            // Move to higher tier cache
            this.caches[currentCache].delete(key);
            this.caches[targetCache].put(key, item.value, this.calculateTTL(key));
        }
    }

    getCacheHierarchy(cacheName) {
        const hierarchy = { hot: 4, warm: 3, cold: 2, static: 1 };
        return hierarchy[cacheName] || 0;
    }

    // Intelligent cache warming
    async warmCache(predictedKeys) {
        for (const key of predictedKeys) {
            if (!this.get(key)) {
                // Pre-fetch likely-to-be-used data
                try {
                    const data = await this.fetchData(key);
                    this.put(key, data);
                } catch (error) {
                    console.warn(`Failed to warm cache for ${key}:`, error);
                }
            }
        }
    }

    // Predict next likely accesses based on patterns
    predictNextAccesses(userContext) {
        const predictions = [];
        
        // Time-based predictions
        const hour = new Date().getHours();
        if (hour >= 9 && hour <= 17) {
            predictions.push('work-planning', 'focus-tips', 'productivity');
        } else {
            predictions.push('relaxation', 'evening-routine', 'reflection');
        }
        
        // Context-based predictions
        if (userContext.lastTopics.includes('planning')) {
            predictions.push('day-review', 'task-suggestions', 'time-management');
        }
        
        return predictions;
    }

    // Get comprehensive statistics
    getComprehensiveStats() {
        const stats = {};
        
        for (const [cacheName, cache] of Object.entries(this.caches)) {
            stats[cacheName] = {
                ...cache.getStats(),
                memoryUsage: this.estimateMemoryUsage(cache)
            };
        }
        
        return {
            caches: stats,
            totalItems: Object.values(this.caches).reduce((sum, cache) => sum + cache.cache.size, 0),
            totalMemory: Object.values(stats).reduce((sum, stat) => sum + stat.memoryUsage, 0),
            frequencyMap: this.frequencyMap.size,
            hitRate: this.calculateOverallHitRate()
        };
    }

    estimateMemoryUsage(cache) {
        // Rough estimation: each cached item ~1KB average
        return cache.cache.size * 1024;
    }

    calculateOverallHitRate() {
        let totalHits = 0;
        let totalRequests = 0;
        
        for (const cache of Object.values(this.caches)) {
            totalHits += cache.hits;
            totalRequests += cache.hits + cache.misses;
        }
        
        return totalRequests > 0 ? (totalHits / totalRequests * 100).toFixed(2) + '%' : '0%';
    }

    // Cleanup expired items and optimize cache distribution
    optimize() {
        // Clean expired items
        for (const cache of Object.values(this.caches)) {
            cache.cleanup();
        }
        
        // Move items between caches based on updated frequency
        this.rebalanceCaches();
        
        // Clean old frequency data
        this.cleanupFrequencyData();
    }

    rebalanceCaches() {
        const now = Date.now();
        const oneHourAgo = now - (1000 * 60 * 60);
        
        // Check all items for potential rebalancing
        for (const [key, lastAccess] of this.lastAccess.entries()) {
            if (lastAccess < oneHourAgo) {
                // Consider moving to lower tier
                this.rebalanceItem(key);
            }
        }
    }

    rebalanceItem(key) {
        // Find which cache has this item
        for (const [cacheName, cache] of Object.entries(this.caches)) {
            if (cache.has(key)) {
                const item = cache.get(key);
                const targetCache = this.determineTargetCache(key);
                
                if (targetCache !== cacheName) {
                    // Move to appropriate cache
                    cache.delete(key);
                    this.caches[targetCache].put(key, item.value, this.calculateTTL(key));
                }
                break;
            }
        }
    }

    cleanupFrequencyData() {
        const now = Date.now();
        const oneDayAgo = now - (1000 * 60 * 60 * 24);
        
        // Clean old frequency data
        for (const [key, lastAccess] of this.lastAccess.entries()) {
            if (lastAccess < oneDayAgo) {
                this.frequencyMap.delete(key);
                this.lastAccess.delete(key);
            }
        }
    }
}

// Usage example for HeadyBuddy
const advancedCache = new AdvancedCacheStrategy();

// Auto-optimization every 10 minutes
setInterval(() => advancedCache.optimize(), 10 * 60 * 1000);

// Predictive cache warming based on user patterns
setInterval(() => {
    const predictions = advancedCache.predictNextAccesses(userContext);
    advancedCache.warmCache(predictions);
}, 5 * 60 * 1000);

module.exports = AdvancedCacheStrategy;

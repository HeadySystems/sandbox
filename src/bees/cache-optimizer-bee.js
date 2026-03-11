'use strict';

/**
 * CacheOptimizerBee — Cache warming, phi-weighted eviction, Fibonacci-sized cache management.
 * Implements LRU with phi-harmonic size tiers and eviction scoring.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

// Fibonacci cache tier sizes (entry count)
const TIER_SIZES = {
  L1: 89,    // fib(11) — hot cache, sub-ms latency
  L2: 377,   // fib(14) — warm cache
  L3: 1597,  // fib(17) — cold cache
};

// Phi-weighted eviction scoring: importance×0.486, recency×0.300, relevance×0.214
const EVICTION_WEIGHTS = { importance: 0.486, recency: 0.300, relevance: 0.214 };

const HEARTBEAT_MS        = Math.round(PHI3 * 1000);   // 4236 ms
const EVICT_BATCH         = 8;    // fib(6) evict at a time
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);      // ≈ 0.618
const HIT_RATE_FLOOR      = PSI;                        // ≈ 0.618

class CacheEntry {
  constructor(key, value, meta = {}) {
    this.key       = key;
    this.value     = value;
    this.createdAt = Date.now();
    this.lastHit   = Date.now();
    this.hits      = 1;
    this.importance = meta.importance ?? PSI;   // default ψ
    this.relevance  = meta.relevance  ?? PSI;
    this.ttlMs      = meta.ttlMs ?? Math.round(PHI2 * 60000);   // φ²×60s ≈ 157s
  }

  isExpired() { return Date.now() - this.createdAt > this.ttlMs; }

  recencyScore() {
    const age = (Date.now() - this.lastHit) / 1000;   // seconds
    return Math.exp(-age / (PHI2 * 60));               // φ²-minute half-life
  }

  evictionScore() {
    return (
      this.importance    * EVICTION_WEIGHTS.importance +
      this.recencyScore() * EVICTION_WEIGHTS.recency   +
      this.relevance     * EVICTION_WEIGHTS.relevance
    );
  }
}

class CacheOptimizerBee {
  constructor(config = {}) {
    this.id    = config.id ?? `cache-${Date.now()}`;
    this.tiers = {
      L1: new Map(),
      L2: new Map(),
      L3: new Map(),
    };
    this._alive      = false;
    this._coherence  = 1.0;
    this._hits       = 0;
    this._misses     = 0;
    this._evictions  = 0;
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this.tiers = { L1: new Map(), L2: new Map(), L3: new Map() };
    this._hits = this._misses = this._evictions = 0;
    this._coherence = 1.0;
  }

  /**
   * Execute cache operations.
   * @param {object} task — { op: 'GET'|'SET'|'WARM'|'EVICT', key?, value?, entries?, meta? }
   */
  async execute(task) {
    if (!this._alive) throw new Error('CacheOptimizerBee not spawned');
    const { op, key, value, entries = [], meta = {} } = task;

    switch (op) {
      case 'GET': return this._get(key);
      case 'SET': return this._set(key, value, meta);
      case 'WARM': return this._warm(entries);
      case 'EVICT': return this._runEviction();
      default: throw new Error(`Unknown cache op: ${op}`);
    }
  }

  _get(key) {
    for (const [tier, map] of Object.entries(this.tiers)) {
      if (map.has(key)) {
        const entry = map.get(key);
        if (entry.isExpired()) { map.delete(key); break; }
        entry.lastHit = Date.now();
        entry.hits++;
        this._hits++;
        // Promote to hotter tier if possible
        this._promote(key, entry, tier);
        return { hit: true, value: entry.value, tier, score: entry.evictionScore() };
      }
    }
    this._misses++;
    return { hit: false, value: null };
  }

  _set(key, value, meta) {
    const entry = new CacheEntry(key, value, meta);
    const targetTier = meta.tier ?? 'L1';
    this.tiers[targetTier].set(key, entry);
    if (this.tiers[targetTier].size > TIER_SIZES[targetTier]) {
      this._evictFrom(targetTier, EVICT_BATCH);
    }
    return { stored: true, tier: targetTier };
  }

  _warm(entries) {
    let warmed = 0;
    for (const { key, value, meta } of entries) {
      if (!this._get(key).hit) { this._set(key, value, meta ?? {}); warmed++; }
    }
    return { warmed, total: entries.length };
  }

  _runEviction() {
    let total = 0;
    for (const tier of ['L1', 'L2', 'L3']) {
      total += this._evictFrom(tier, EVICT_BATCH);
    }
    return { evicted: total };
  }

  _evictFrom(tier, count) {
    const map = this.tiers[tier];
    if (map.size <= TIER_SIZES[tier] * PSI) return 0;  // only evict above ψ × capacity
    const sorted = [...map.entries()]
      .map(([k, e]) => ({ k, score: e.evictionScore(), expired: e.isExpired() }))
      .sort((a, b) => a.score - b.score);   // lowest score evicted first
    let evicted = 0;
    for (const { k, expired } of sorted) {
      if (evicted >= count && !expired) break;
      map.delete(k);
      evicted++;
      this._evictions++;
      // Demote to next tier if not expired
      if (!expired && tier !== 'L3') {
        const nextTier = tier === 'L1' ? 'L2' : 'L3';
        const entry = map.get(k);
        if (entry) this.tiers[nextTier].set(k, entry);
      }
    }
    return evicted;
  }

  _promote(key, entry, currentTier) {
    if (currentTier === 'L1') return;
    const hotterTier = currentTier === 'L3' ? 'L2' : 'L1';
    this.tiers[hotterTier].set(key, entry);
    this.tiers[currentTier].delete(key);
  }

  heartbeat() {
    // Expire stale entries, update coherence
    let expired = 0;
    for (const map of Object.values(this.tiers)) {
      for (const [k, e] of map) if (e.isExpired()) { map.delete(k); expired++; }
    }
    const total = this._hits + this._misses;
    const hitRate = total > 0 ? this._hits / total : 0;
    this._coherence = Math.min(1.0, hitRate / HIT_RATE_FLOOR);   // coherence = hitRate / ψ
  }

  getHealth() {
    const total = this._hits + this._misses;
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence: parseFloat(this._coherence.toFixed(4)),
      hitRate: total > 0 ? parseFloat((this._hits / total).toFixed(4)) : 0,
      hits: this._hits,
      misses: this._misses,
      evictions: this._evictions,
      sizes: { L1: this.tiers.L1.size, L2: this.tiers.L2.size, L3: this.tiers.L3.size },
      capacities: TIER_SIZES,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = { CacheOptimizerBee, TIER_SIZES, EVICTION_WEIGHTS, COHERENCE_THRESHOLD };

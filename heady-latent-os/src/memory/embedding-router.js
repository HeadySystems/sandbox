/**
 * @fileoverview Heady™ Embedding Router — Multi-Provider Routing with Circuit Breaker Failover
 *
 * Routes embedding requests across providers (nomic, jina, local) using:
 *   - CSL-gated provider scoring (cosine alignment of provider capability vectors)
 *   - LRU cache with fib(20) = 6,765 capacity
 *   - Per-provider CircuitBreaker instances for automatic failover
 *   - Phi-backoff retry on transient failures
 *
 * Provider priority order: nomic → jina → local
 * Fallback strategy: round-robin next healthy provider on CircuitOpenError.
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  fib,
  PSI,
  PHI,
  CSL_THRESHOLDS,
  cosineSimilarity,
  normalize,
  phiBackoffWithJitter,
  PHI_TIMING,
  VECTOR,
  cslGate,
} = require('../../shared/phi-math.js');

const { CircuitBreaker, CircuitOpenError } = require('../resilience/circuit-breaker.js');
const { retry }                             = require('../resilience/exponential-backoff.js');

// ─── Cache constants ──────────────────────────────────────────────────────────

/** LRU cache capacity: fib(20) = 6,765 */
const CACHE_CAPACITY = fib(20);

/** Cache hit score gate threshold: CSL DEFAULT (ψ ≈ 0.618) */
const CACHE_GATE_TAU = CSL_THRESHOLDS.DEFAULT;

/** Minimum provider health score to route to: CSL LOW ≈ 0.691 */
const MIN_PROVIDER_SCORE = CSL_THRESHOLDS.LOW;

/** Circuit breaker failure threshold: fib(5) = 5 */
const CB_FAILURE_THRESHOLD = fib(5);

/** Provider timeout per request: PHI_TIMING.PHI_5 ≈ 11,090ms */
const PROVIDER_TIMEOUT_MS = PHI_TIMING.PHI_5;

/** Max retries per embedding call: fib(3) = 2 */
const MAX_RETRIES = fib(3);

// ─── Providers ────────────────────────────────────────────────────────────────

/**
 * Built-in provider definitions.
 * dim = output embedding dimension
 * speed = relative speed score (0–1, higher = faster)
 * quality = relative quality score (0–1, higher = better)
 */
const PROVIDERS = Object.freeze({
  nomic: {
    name:    'nomic',
    dim:     VECTOR.DIMS,
    speed:   PSI,           // 0.618 — fast, good quality
    quality: CSL_THRESHOLDS.HIGH,  // 0.882
  },
  jina: {
    name:    'jina',
    dim:     VECTOR.DIMS * 2,
    speed:   PSI * PSI,     // 0.382 — slower
    quality: CSL_THRESHOLDS.CRITICAL,  // 0.927 — highest quality
  },
  local: {
    name:    'local',
    dim:     VECTOR.DIMS,
    speed:   1.0,           // fastest — in-process
    quality: CSL_THRESHOLDS.MEDIUM,   // 0.809 — good enough
  },
});

// ─── LRU Cache ────────────────────────────────────────────────────────────────

/**
 * @class LRUCache
 * Minimal LRU cache backed by Map (insertion order).
 */
class LRUCache {
  /**
   * @param {number} capacity
   */
  constructor(capacity) {
    this.capacity = capacity;
    this._map     = new Map();
    this._hits    = 0;
    this._misses  = 0;
  }

  /**
   * Get a cached value or undefined.
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    if (!this._map.has(key)) {
      this._misses++;
      return undefined;
    }
    // Move to end (most-recently-used)
    const val = this._map.get(key);
    this._map.delete(key);
    this._map.set(key, val);
    this._hits++;
    return val;
  }

  /**
   * Store a value, evicting LRU entry if at capacity.
   * @param {string} key
   * @param {*}      value
   */
  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this.capacity) {
      // Evict oldest (first entry in Map)
      this._map.delete(this._map.keys().next().value);
    }
    this._map.set(key, value);
  }

  /** @returns {{ size: number, capacity: number, hitRate: number }} */
  stats() {
    const total = this._hits + this._misses;
    return {
      size:     this._map.size,
      capacity: this.capacity,
      hits:     this._hits,
      misses:   this._misses,
      hitRate:  total > 0 ? this._hits / total : 0,
    };
  }

  clear() { this._map.clear(); }
}

// ─── Cache key ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic cache key from text input and provider name.
 * Uses a fast djb2-style hash (no crypto dependency needed for cache keys).
 * @param {string} text
 * @param {string} provider
 * @returns {string}
 */
function cacheKey(text, provider) {
  let h = fib(11); // 89 — non-zero seed from phi-math
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(h, 31) + text.charCodeAt(i)) >>> 0;
  }
  return `${provider}:${h.toString(16)}`;
}

// ─── EmbeddingRouter class ────────────────────────────────────────────────────

/**
 * @class EmbeddingRouter
 *
 * @example
 * const router = new EmbeddingRouter({
 *   providers: {
 *     nomic: async (text) => fetchNomicEmbedding(text),
 *     jina:  async (text) => fetchJinaEmbedding(text),
 *     local: async (text) => localModel.embed(text),
 *   }
 * });
 * const embedding = await router.embed('What is golden ratio?');
 */
class EmbeddingRouter {
  /**
   * @param {object} opts
   * @param {object<string, Function>} opts.providers
   *   Map of provider name → async fn(text: string) → number[]
   * @param {string[]}  [opts.order]          - provider priority order
   * @param {number}    [opts.cacheCapacity]  - LRU cache size (default fib(20))
   * @param {boolean}   [opts.cacheEnabled]   - enable result caching (default true)
   * @param {number}    [opts.maxRetries]      - per-call retries (default fib(3)=2)
   */
  constructor(opts = {}) {
    this._providerFns = opts.providers || {};
    this._order       = opts.order || ['nomic', 'jina', 'local'];
    this._cache       = new LRUCache(opts.cacheCapacity || CACHE_CAPACITY);
    this._cacheEnabled = opts.cacheEnabled !== false;
    this._maxRetries  = opts.maxRetries || MAX_RETRIES;

    // Per-provider circuit breakers
    this._circuitBreakers = {};
    for (const name of this._order) {
      this._circuitBreakers[name] = new CircuitBreaker(`embedding-${name}`, {
        failureThreshold: CB_FAILURE_THRESHOLD,
      });
    }

    // Provider performance counters
    this._counters = {};
    for (const name of this._order) {
      this._counters[name] = { calls: 0, failures: 0, cacheHits: 0 };
    }

    this._totalCalls    = 0;
    this._totalFailures = 0;
  }

  // ─── Provider scoring ──────────────────────────────────────────────────────

  /**
   * Score each provider using CSL-gated health × quality × speed.
   * Returns providers sorted descending by composite score.
   * @returns {Array<{name: string, score: number}>}
   */
  _scoreProviders() {
    return this._order
      .map(name => {
        const def = PROVIDERS[name] || { speed: PSI, quality: PSI };
        const cb  = this._circuitBreakers[name];
        const cnt = this._counters[name];

        // Health: circuit breaker health percentage (0–1)
        const health  = cb ? cb.healthPercent : 1;

        // Failure penalty — csl-gated by health
        const failRate = cnt.calls > 0 ? cnt.failures / cnt.calls : 0;
        const reliability = Math.max(0, 1 - failRate);

        // Composite score: health × quality × reliability, gated by speed
        const rawScore = health * def.quality * reliability;
        const score    = cslGate(rawScore, def.speed, CACHE_GATE_TAU);

        return { name, score, health, cb };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Select the best available (non-open-circuit) provider.
   * @returns {string|null} provider name, or null if all are open
   */
  _selectProvider() {
    const scored = this._scoreProviders();
    for (const { name, score, cb } of scored) {
      if (cb && cb.isOpen) continue;
      if (score < MIN_PROVIDER_SCORE && this._counters[name].calls > fib(5)) continue;
      if (this._providerFns[name]) return name;
    }
    // Last resort: any provider with a function, regardless of score
    for (const name of this._order) {
      if (this._providerFns[name]) return name;
    }
    return null;
  }

  // ─── Core embed ───────────────────────────────────────────────────────────

  /**
   * Embed text, using LRU cache and circuit-breaker failover.
   *
   * @param {string} text      - text to embed
   * @param {object} [opts]
   * @param {string}  [opts.provider]    - force a specific provider
   * @param {boolean} [opts.skipCache]   - bypass cache for this call
   * @param {number}  [opts.targetDims]  - truncate/pad result to this dim
   * @returns {Promise<number[]>} normalized embedding
   */
  async embed(text, opts = {}) {
    if (!text || typeof text !== 'string') {
      throw new TypeError('EmbeddingRouter.embed: text must be a non-empty string');
    }

    this._totalCalls++;

    // Determine provider
    const preferredProvider = opts.provider || this._selectProvider();
    if (!preferredProvider) {
      throw new Error('EmbeddingRouter: no healthy providers available');
    }

    // Cache lookup
    const key = cacheKey(text, preferredProvider);
    if (this._cacheEnabled && !opts.skipCache) {
      const cached = this._cache.get(key);
      if (cached !== undefined) {
        if (preferredProvider in this._counters) this._counters[preferredProvider].cacheHits++;
        return cached;
      }
    }

    // Try providers in priority order with circuit breaker failover
    const providerList = opts.provider
      ? [opts.provider, ...this._order.filter(n => n !== opts.provider)]
      : [preferredProvider, ...this._order.filter(n => n !== preferredProvider)];

    let lastError;
    for (const providerName of providerList) {
      const fn = this._providerFns[providerName];
      if (!fn) continue;

      const cb = this._circuitBreakers[providerName];
      if (cb && cb.isOpen) continue;

      try {
        const embedding = await retry(
          () => cb
            ? cb.execute(() => fn(text))
            : fn(text),
          {
            maxRetries: this._maxRetries,
            timeoutMs:  PROVIDER_TIMEOUT_MS,
            shouldRetry: (err) => !(err instanceof CircuitOpenError),
          }
        );

        const normed = normalize(embedding);

        // Store in cache
        if (this._cacheEnabled && !opts.skipCache) {
          this._cache.set(key, normed);
        }

        this._counters[providerName].calls++;
        return normed;

      } catch (err) {
        lastError = err;
        this._counters[providerName].calls++;
        this._counters[providerName].failures++;
        this._totalFailures++;
        // Continue to next provider
      }
    }

    throw lastError || new Error('EmbeddingRouter: all providers failed');
  }

  // ─── Batch embed ──────────────────────────────────────────────────────────

  /**
   * Embed an array of texts, respecting phi-batch size fib(8)=21.
   * @param {string[]} texts
   * @param {object}   [opts] - same as embed()
   * @returns {Promise<number[][]>}
   */
  async embedBatch(texts, opts = {}) {
    const batchSize = fib(8); // 21
    const results   = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batch_results = await Promise.all(batch.map(t => this.embed(t, opts)));
      results.push(...batch_results);
    }
    return results;
  }

  // ─── Cache management ─────────────────────────────────────────────────────

  /** Clear the embedding cache. */
  clearCache() { this._cache.clear(); }

  // ─── Status ───────────────────────────────────────────────────────────────

  /**
   * Router diagnostics.
   * @returns {object}
   */
  status() {
    const providers = {};
    for (const name of this._order) {
      providers[name] = {
        ...this._counters[name],
        circuitBreaker: this._circuitBreakers[name]?.status() || null,
        available:      !!this._providerFns[name],
        score:          this._scoreProviders().find(p => p.name === name)?.score,
      };
    }
    return {
      totalCalls:    this._totalCalls,
      totalFailures: this._totalFailures,
      cache:         this._cache.stats(),
      providers,
      selectedProvider: this._selectProvider(),
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  EmbeddingRouter,
  LRUCache,
  cacheKey,
  PROVIDERS,
  CACHE_CAPACITY,
  MIN_PROVIDER_SCORE,
  CB_FAILURE_THRESHOLD,
  PROVIDER_TIMEOUT_MS,
  MAX_RETRIES,
};

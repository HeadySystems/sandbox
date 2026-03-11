/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Embedding Router — src/memory/embedding-router.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Multi-provider embedding routing with circuit breaker failover, LRU caching,
 * cost optimization, and CSL-gated provider scoring.
 *
 * Providers: Nomic, Jina, Cohere, Voyage, OpenAI, local Ollama
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { fib, PHI, PSI, CSL_THRESHOLDS, phiFusionWeights, phiBackoff } = require('../../shared/phi-math');
const { CircuitBreaker } = require('../resilience/circuit-breaker');

const DEFAULT_DIM = 384;

/**
 * Provider configuration schema.
 * @typedef {object} ProviderConfig
 * @property {string} name
 * @property {string} model - Model identifier
 * @property {number} dimensions - Output dimensions
 * @property {number} costPer1k - Cost per 1000 tokens (USD)
 * @property {number} maxBatchSize - Max texts per request
 * @property {Function} embedFn - async (texts[], opts) → Float64Array[]
 * @property {number} [priority=0] - Lower = preferred
 */

class EmbeddingRouter {
  /**
   * @param {object} opts
   * @param {ProviderConfig[]} opts.providers
   * @param {number} [opts.cacheSize] - LRU cache capacity (default fib(20)=6765)
   * @param {number} [opts.cacheTTLMs] - Cache entry TTL (default 1 hour)
   * @param {number} [opts.targetDim] - Target output dimensions (default 384)
   * @param {Function} [opts.logger]
   */
  constructor(opts) {
    this.providers = new Map();
    this.targetDim = opts.targetDim || DEFAULT_DIM;
    this.cacheSize = opts.cacheSize || fib(20);   // 6765
    this.cacheTTLMs = opts.cacheTTLMs || 3600000; // 1 hour
    this.logger = opts.logger || console;

    // LRU Cache: hash(text+model) → { vector, timestamp }
    this._cache = new Map();
    this._cacheOrder = [];

    // Register providers with circuit breakers
    for (const prov of (opts.providers || [])) {
      this.registerProvider(prov);
    }

    // Stats
    this._stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerCalls: {},
      errors: 0,
    };
  }

  /**
   * Register an embedding provider.
   * @param {ProviderConfig} config
   */
  registerProvider(config) {
    this.providers.set(config.name, {
      ...config,
      breaker: new CircuitBreaker({
        name: `embed-${config.name}`,
        failureThreshold: fib(5),
        resetTimeoutMs: phiBackoff(0, 5000, 60000, false),
      }),
      latencyAvg: 100,
      successRate: 1.0,
    });
    this._stats.providerCalls[config.name] = 0;
  }

  /**
   * Generate embeddings for one or more texts.
   * Routes to the best available provider with failover.
   *
   * @param {string|string[]} input - Text or array of texts
   * @param {object} [opts]
   * @param {string} [opts.provider] - Force specific provider
   * @param {number} [opts.dimensions] - Override target dimensions
   * @param {boolean} [opts.noCache] - Skip cache
   * @returns {Promise<Float64Array[]>} Array of embedding vectors
   */
  async embed(input, opts = {}) {
    const texts = Array.isArray(input) ? input : [input];
    const dim = opts.dimensions || this.targetDim;
    this._stats.totalRequests++;

    // Check cache
    const results = new Array(texts.length);
    const uncachedIndices = [];

    if (!opts.noCache) {
      for (let i = 0; i < texts.length; i++) {
        const cached = this._cacheGet(texts[i], dim);
        if (cached) {
          results[i] = cached;
          this._stats.cacheHits++;
        } else {
          uncachedIndices.push(i);
          this._stats.cacheMisses++;
        }
      }
    } else {
      for (let i = 0; i < texts.length; i++) uncachedIndices.push(i);
    }

    if (uncachedIndices.length === 0) return results;

    // Get uncached texts
    const uncachedTexts = uncachedIndices.map(i => texts[i]);

    // Select provider
    const providers = opts.provider
      ? [this.providers.get(opts.provider)].filter(Boolean)
      : this._rankProviders(dim);

    let lastError;
    for (const prov of providers) {
      try {
        const vectors = await prov.breaker.execute(async () => {
          const start = Date.now();
          const result = await this._callProvider(prov, uncachedTexts, dim);
          const elapsed = Date.now() - start;

          // Update rolling latency average
          prov.latencyAvg = prov.latencyAvg * PSI + elapsed * (1 - PSI);
          prov.successRate = Math.min(1, prov.successRate + 0.01);

          return result;
        });

        this._stats.providerCalls[prov.name]++;

        // Fill results and cache
        for (let j = 0; j < uncachedIndices.length; j++) {
          results[uncachedIndices[j]] = vectors[j];
          if (!opts.noCache) {
            this._cacheSet(uncachedTexts[j], dim, vectors[j]);
          }
        }

        return results;

      } catch (err) {
        lastError = err;
        prov.successRate = Math.max(0, prov.successRate - 0.1);
        this._stats.errors++;
        this.logger.warn?.(`[EmbeddingRouter] Provider ${prov.name} failed`, err.message);
      }
    }

    throw new Error(`All embedding providers failed. Last error: ${lastError?.message}`);
  }

  /**
   * Embed a single text and return the vector directly.
   * @param {string} text
   * @param {object} [opts]
   * @returns {Promise<Float64Array>}
   */
  async embedOne(text, opts = {}) {
    const [vector] = await this.embed(text, opts);
    return vector;
  }

  // ─── Provider Ranking ──────────────────────────────────────────────────────

  /**
   * Rank providers by composite score: success rate × latency × cost × priority.
   * Uses phi-fusion weights: [0.486 success, 0.300 latency, 0.214 cost].
   */
  _rankProviders(targetDim) {
    const providers = Array.from(this.providers.values())
      .filter(p => p.breaker.state !== 'OPEN');

    if (providers.length === 0) return Array.from(this.providers.values());

    const maxLatency = Math.max(1, ...providers.map(p => p.latencyAvg));
    const maxCost = Math.max(0.0001, ...providers.map(p => p.costPer1k));
    const weights = phiFusionWeights(3); // [0.486, 0.300, 0.214]

    const scored = providers.map(p => {
      const successScore = p.successRate;
      const latencyScore = 1 - (p.latencyAvg / maxLatency);
      const costScore = 1 - (p.costPer1k / maxCost);

      const composite =
        successScore * weights[0] +
        latencyScore * weights[1] +
        costScore * weights[2];

      return { ...p, composite };
    });

    scored.sort((a, b) => b.composite - a.composite);
    return scored;
  }

  async _callProvider(prov, texts, targetDim) {
    // Batch if needed
    const batchSize = prov.maxBatchSize || fib(8); // 21
    const allVectors = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const vectors = await prov.embedFn(batch, { dimensions: targetDim });

      // MRL truncation if provider returns higher dims than target
      for (const vec of vectors) {
        if (vec.length > targetDim) {
          allVectors.push(new Float64Array(vec.slice(0, targetDim)));
        } else {
          allVectors.push(vec instanceof Float64Array ? vec : new Float64Array(vec));
        }
      }
    }

    return allVectors;
  }

  // ─── Cache ─────────────────────────────────────────────────────────────────

  _cacheKey(text, dim) {
    // Simple hash: first 100 chars + dim + length
    const prefix = text.slice(0, 100).replace(/\s+/g, ' ');
    return `${dim}:${text.length}:${prefix}`;
  }

  _cacheGet(text, dim) {
    const key = this._cacheKey(text, dim);
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.cacheTTLMs) {
      this._cache.delete(key);
      return null;
    }
    // Touch for LRU
    this._cacheOrder = this._cacheOrder.filter(k => k !== key);
    this._cacheOrder.push(key);
    return entry.vector;
  }

  _cacheSet(text, dim, vector) {
    const key = this._cacheKey(text, dim);
    this._cache.set(key, { vector, timestamp: Date.now() });
    this._cacheOrder.push(key);

    while (this._cache.size > this.cacheSize) {
      const oldest = this._cacheOrder.shift();
      if (oldest) this._cache.delete(oldest);
    }
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  status() {
    const providerStatuses = {};
    for (const [name, prov] of this.providers) {
      providerStatuses[name] = {
        state: prov.breaker.state,
        latencyAvg: Math.round(prov.latencyAvg),
        successRate: prov.successRate.toFixed(3),
        calls: this._stats.providerCalls[name],
      };
    }

    return {
      providers: providerStatuses,
      cache: {
        size: this._cache.size,
        capacity: this.cacheSize,
        hitRate: this._stats.totalRequests > 0
          ? (this._stats.cacheHits / this._stats.totalRequests).toFixed(3)
          : '0.000',
      },
      stats: { ...this._stats },
    };
  }
}

module.exports = { EmbeddingRouter };

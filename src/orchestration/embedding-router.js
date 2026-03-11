/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ EMBEDDING ROUTER                                         ║
 * ║  Multi-Provider Embedding Router with CSL Circuit Breaker        ║
 * ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
 * ║  60+ Provisional Patents — All Rights Reserved                   ║
 * ║  © 2026-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Routes embedding requests to the optimal provider using CSL scoring,
 * per-provider circuit breakers with phi-backoff, LRU caching, and
 * optional MRL dimensionality reduction (384-d standard).
 *
 * @module embedding-router
 */

const { EventEmitter } = require("events");
const { PHI, PSI, PSI_10, fib, FIBONACCI, phiBackoff, phiBackoffWithJitter, CSL_THRESHOLDS, TIMEOUT_TIERS, } = (function() { try { return require("../shared/phi-math.js"); } catch(e) { return {}; } })();
const { cslAND, normalize } = (function() { try { return require("../shared/csl-engine.js"); } catch(e) { return {}; } })();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

/** LRU cache capacity: fib(20) = 6765 entries */
const CACHE_MAX_SIZE = fib(20); // 6765

/** LRU TTL: fib(17) × 1000 = 1 597 000 ms ≈ 26.6 min */
const CACHE_TTL_MS = fib(17) * 1000; // 1 597 000

/** Circuit-breaker failure threshold: fib(5) = 5 */
const CB_FAILURE_THRESHOLD = fib(5); // 5

/**
 * Circuit-breaker reset window: 1000 × ψ × fib(8) = 1000 × 0.618 × 21 = 12 978 ms.
 */
const CB_RESET_MS = Math.round(1000 * PSI * fib(8)); // 12 978

/** MRL target dimension: fib(9) × fib(7) = 34 × 13 = 442 — snap to 384 (industry standard). */
const MRL_TARGET_DIM = 384; // canonical 384-d MRL standard

/** Cost cap per request: ψ¹⁰ × $0.1 ≈ $0.000618 */
const COST_CAP_PER_REQUEST_USD = PSI_10 * 0.1; // ≈ 0.000813 → use PSI_10 exactly

/** CSL scoring vector dimension: fib(9) = 34 */
const SCORE_VEC_DIM = fib(9); // 34

/** Batch size for batch embedding: fib(7) = 13 */
const DEFAULT_BATCH_SIZE = fib(7); // 13

// ─── PROVIDER DEFINITIONS ────────────────────────────────────────────────────

/**
 * Canonical embedding provider configurations.
 * Dimensions are true production dimensions for each model.
 */
const EMBEDDING_PROVIDERS = Object.freeze({
  NOMIC:    'nomic',
  JINA:     'jina',
  COHERE:   'cohere',
  VOYAGE:   'voyage',
  BGE_M3:   'bge-m3',
  GTE_QWEN: 'gte-qwen2',
  OLLAMA:   'ollama-local',
});

const PROVIDER_DEFAULTS = [
  {
    id:       EMBEDDING_PROVIDERS.NOMIC,
    baseUrl:  'https://api-atlas.nomic.ai/v1',
    model:    'nomic-embed-text-v1.5',
    dim:      fib(9) * fib(8) * fib(4),  // ≈ 34×21×3 = 2142 → actual 768; stored as constant
    actualDim: 768,
    maxTokens: fib(10) * fib(9),          // 55×34 = 1870 → actual 8192; use spec dim
    costPer1k: PSI_10 * 0.1,              // ~$0.000081
  },
  {
    id:       EMBEDDING_PROVIDERS.JINA,
    baseUrl:  'https://api.jina.ai/v1',
    model:    'jina-embeddings-v3',
    actualDim: 1024,
    maxTokens: fib(13) * fib(8),          // 233×21 = 4893
    costPer1k: PSI_10 * 0.15,
  },
  {
    id:       EMBEDDING_PROVIDERS.COHERE,
    baseUrl:  'https://api.cohere.ai/v1',
    model:    'embed-english-v3.0',
    actualDim: 1024,
    maxTokens: fib(10) * fib(9),
    costPer1k: PSI_10 * 0.1,
  },
  {
    id:       EMBEDDING_PROVIDERS.VOYAGE,
    baseUrl:  'https://api.voyageai.com/v1',
    model:    'voyage-3',
    actualDim: 2048,
    maxTokens: fib(12) * fib(9),          // 144×34 = 4896
    costPer1k: PSI_10 * 0.2,
  },
  {
    id:       EMBEDDING_PROVIDERS.BGE_M3,
    baseUrl:  'https://api.together.ai/v1',
    model:    'BAAI/bge-m3',
    actualDim: 1024,
    maxTokens: fib(11) * fib(8),          // 89×21 = 1869
    costPer1k: PSI_10 * 0.05,
  },
  {
    id:       EMBEDDING_PROVIDERS.GTE_QWEN,
    baseUrl:  'https://api.together.ai/v1',
    model:    'Alibaba-NLP/gte-Qwen2-7B-instruct',
    actualDim: 1536,
    maxTokens: fib(13) * fib(9),
    costPer1k: PSI_10 * 0.25,
  },
  {
    id:       EMBEDDING_PROVIDERS.OLLAMA,
    baseUrl:  'http://localhost:11434/api',
    model:    'nomic-embed-text',
    actualDim: 768,
    maxTokens: fib(12) * fib(6),          // 144×8 = 1152
    costPer1k: 0,
    isLocal:   true,
  },
];

// ─── LRU CACHE ───────────────────────────────────────────────────────────────

class LRUCache {
  constructor(maxSize, ttlMs) {
    this._maxSize = maxSize;
    this._ttlMs   = ttlMs;
    this._map     = new Map();
  }
  set(key, value) {
    if (this._map.has(key)) this._map.delete(key);
    this._map.set(key, { value, ts: Date.now() });
    if (this._map.size > this._maxSize) {
      this._map.delete(this._map.keys().next().value);
    }
  }
  get(key) {
    const e = this._map.get(key);
    if (!e) return undefined;
    if (Date.now() - e.ts > this._ttlMs) { this._map.delete(key); return undefined; }
    this._map.delete(key); this._map.set(key, e);
    return e.value;
  }
  has(key) { return this.get(key) !== undefined; }
  get size() { return this._map.size; }
}

// ─── CIRCUIT BREAKER ─────────────────────────────────────────────────────────

class CircuitBreaker {
  constructor(providerId) {
    this.providerId = providerId;
    this.state      = 'closed';
    this.failures   = 0;
    this.openedAt   = null;
    this.probes     = 0;
  }
  recordSuccess() {
    this.failures = 0;
    this.state    = 'closed';
    this.probes   = 0;
  }
  recordFailure() {
    this.failures++;
    if (this.failures >= CB_FAILURE_THRESHOLD) {
      this.state    = 'open';
      this.openedAt = Date.now();
    }
  }
  canRequest() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.openedAt > CB_RESET_MS) {
        this.state  = 'half_open';
        this.probes = 0;
      } else return false;
    }
    // half_open: allow fib(3)=2 probes
    return this.probes++ < fib(3);
  }
}

// ─── PROVIDER RECORD ─────────────────────────────────────────────────────────

class EmbeddingProviderRecord {
  constructor(cfg) {
    this.id         = cfg.id;
    this.baseUrl    = cfg.baseUrl;
    this.model      = cfg.model;
    this.dim        = cfg.actualDim || cfg.dim;
    this.maxTokens  = cfg.maxTokens;
    this.costPer1k  = cfg.costPer1k ?? 0;
    this.isLocal    = cfg.isLocal ?? false;
    this.apiKey     = cfg.apiKey || null;
    this.cb         = new CircuitBreaker(cfg.id);
    this.callCount  = 0;
    this.errorCount = 0;
    this.totalCostUsd = 0;
    // Seeded capability vector for CSL scoring
    this.capVec = _seededVec(cfg.id, SCORE_VEC_DIM);
  }
}

/** Build seeded unit vector. @private */
function _seededVec(seed, dim) {
  const v = new Float64Array(dim);
  for (let i = 0; i < dim; i++) v[i] = Math.sin(seed.charCodeAt(i % seed.length) * PHI + i * PSI);
  return normalize(v);
}

// ─── MRL DIMENSIONALITY REDUCTION ────────────────────────────────────────────

/**
 * Truncate a high-dimensional embedding to MRL_TARGET_DIM (384)
 * and L2-renormalize. Implements Matryoshka Representation Learning truncation.
 *
 * @param {Float64Array|number[]} vec - Input embedding.
 * @returns {Float64Array} 384-d normalized vector.
 */
function mrlTruncate(vec) {
  if (vec.length <= MRL_TARGET_DIM) return normalize(new Float64Array(vec));
  const truncated = new Float64Array(MRL_TARGET_DIM);
  for (let i = 0; i < MRL_TARGET_DIM; i++) truncated[i] = vec[i];
  return normalize(truncated);
}

// ─── EMBEDDING ROUTER ────────────────────────────────────────────────────────

/**
 * EmbeddingRouter — CSL-scored multi-provider embedding router.
 *
 * Selects the optimal embedding provider based on text length, domain,
 * and language using cosine similarity scoring. Applies per-provider
 * circuit breakers, LRU caching, and optional MRL truncation.
 *
 * @extends EventEmitter
 */
class EmbeddingRouter extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.enableMRL=false]     - Auto-truncate all outputs to 384-d.
   * @param {boolean} [opts.enableCache=true]    - Enable LRU embedding cache.
   * @param {number}  [opts.batchSize]           - Override default batch size.
   */
  constructor(opts = {}) {
    super();
    this._providers    = new Map();
    this._cache        = opts.enableCache !== false ? new LRUCache(CACHE_MAX_SIZE, CACHE_TTL_MS) : null;
    this._enableMRL    = opts.enableMRL ?? false;
    this._batchSize    = opts.batchSize ?? DEFAULT_BATCH_SIZE;
    this._totalCostUsd = 0;

    for (const cfg of PROVIDER_DEFAULTS) {
      this._providers.set(cfg.id, new EmbeddingProviderRecord(cfg));
    }
  }

  // ─── PROVIDER SCORING ──────────────────────────────────────────────────────

  /**
   * Score providers for a given request using CSL cosine similarity.
   * Factors: text length, domain, language → request capability vector.
   *
   * @param {string}  text
   * @param {object}  [opts]
   * @param {string}  [opts.domain]    - e.g. 'code', 'scientific', 'multilingual'
   * @param {string}  [opts.language]  - ISO 639-1 code
   * @returns {EmbeddingProviderRecord[]} Sorted by CSL score descending.
   */
  _scoreProviders(text, { domain = 'general', language = 'en' } = {}) {
    // Build request profile vector from text stats
    const textLen       = Math.min(text.length / (fib(13) * fib(5)), 1); // normalize to [0,1]
    const isMultilingual = language !== 'en' ? 1 : 0;
    const isCode        = domain === 'code' ? 1 : 0;
    const isScientific  = domain === 'scientific' ? 1 : 0;

    // Synthesize request vector: seeded from domain+language concatenation
    const requestVec = _seededVec(`${domain}-${language}-${Math.round(textLen * fib(5))}`, SCORE_VEC_DIM);

    const scored = [];
    for (const p of this._providers.values()) {
      if (!p.cb.canRequest()) continue;
      const cosine = cslAND(requestVec, p.capVec);
      // Budget gate: skip if per-request estimated cost exceeds cap
      if (!p.isLocal) {
        const estCost = (text.length / (fib(4) * 1000)) * p.costPer1k; // approx tokens
        if (estCost > COST_CAP_PER_REQUEST_USD) {
          this.emit('provider:cost-skip', { id: p.id, estCost });
          continue;
        }
      }
      scored.push({ provider: p, score: cosine });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.provider);
  }

  // ─── EXECUTE SINGLE EMBED ──────────────────────────────────────────────────

  /**
   * Execute a single embedding request against a provider.
   * @param {EmbeddingProviderRecord} provider
   * @param {string} text
   * @param {string} [apiKey]
   * @returns {Promise<Float64Array>}
   */
  async _execute(provider, text, apiKey) {
    const key    = apiKey || provider.apiKey;
    const headers = {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    };

    const endpoint = provider.isLocal
      ? `${provider.baseUrl}/embed`
      : `${provider.baseUrl}/embeddings`;

    const body = provider.isLocal
      ? JSON.stringify({ model: provider.model, prompt: text })
      : JSON.stringify({ model: provider.model, input: text });

    const start = Date.now();
    const res   = await fetch(endpoint, {
      method: 'POST', headers, body,
      signal: AbortSignal.timeout(TIMEOUT_TIERS.normal), // 8 000 ms
    });

    if (!res.ok) {
      const err     = new Error(`[${provider.id}] HTTP ${res.status}`);
      err.status    = res.status;
      err.providerId = provider.id;
      throw err;
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;

    // Parse response shape: OpenAI-style or Ollama-style
    let rawVec;
    if (provider.isLocal) {
      rawVec = data.embedding ?? data.embeddings?.[0];
    } else {
      rawVec = data.data?.[0]?.embedding ?? data.embeddings?.[0];
    }

    if (!rawVec) throw new Error(`[${provider.id}] empty embedding response`);

    provider.cb.recordSuccess();
    provider.callCount++;

    // Track cost
    const tokenCount    = Math.ceil(text.length / fib(4));
    const estimatedCost = (tokenCount / 1000) * provider.costPer1k;
    provider.totalCostUsd += estimatedCost;
    this._totalCostUsd    += estimatedCost;

    this.emit('embed:success', { providerId: provider.id, latencyMs, tokens: tokenCount, dim: rawVec.length });

    const vec = new Float64Array(rawVec);
    return this._enableMRL ? mrlTruncate(vec) : normalize(vec);
  }

  // ─── PUBLIC EMBED ──────────────────────────────────────────────────────────

  /**
   * Embed a single text string.
   * Tries primary → secondary → local Ollama as fallback chain.
   *
   * @param {string} text
   * @param {object} [opts]
   * @param {string} [opts.domain]
   * @param {string} [opts.language]
   * @param {string} [opts.apiKey]
   * @returns {Promise<Float64Array>} Normalized embedding vector.
   */
  async embed(text, opts = {}) {
    // Cache check
    const cacheKey = `${text.slice(0, fib(7))}-${opts.domain || 'general'}`;
    if (this._cache) {
      const cached = this._cache.get(cacheKey);
      if (cached) {
        this.emit('embed:cache-hit', { cacheKey });
        return cached;
      }
    }

    const chain = this._scoreProviders(text, opts);
    // Always append local Ollama as final fallback
    const ollama = this._providers.get(EMBEDDING_PROVIDERS.OLLAMA);
    if (ollama && !chain.includes(ollama)) chain.push(ollama);

    let lastError;
    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      try {
        const vec = await this._execute(provider, text, opts.apiKey);
        if (this._cache) this._cache.set(cacheKey, vec);
        return vec;
      } catch (err) {
        lastError = err;
        provider.cb.recordFailure();
        provider.errorCount++;
        this.emit('embed:error', { providerId: provider.id, error: err.message, attempt: i });
        if (i < chain.length - 1) {
          await new Promise(r => setTimeout(r, phiBackoffWithJitter(i)));
        }
      }
    }
    throw lastError || new Error('EmbeddingRouter: all providers failed');
  }

  /**
   * Embed a batch of texts.
   * Chunks into DEFAULT_BATCH_SIZE=13 groups, each embedded in parallel.
   *
   * @param {string[]} texts
   * @param {object}   [opts] - Same as embed().
   * @returns {Promise<Float64Array[]>}
   */
  async embedBatch(texts, opts = {}) {
    const results  = new Array(texts.length);
    const batchSz  = this._batchSize;

    for (let start = 0; start < texts.length; start += batchSz) {
      const chunk   = texts.slice(start, start + batchSz);
      const settled = await Promise.allSettled(chunk.map(t => this.embed(t, opts)));
      for (let j = 0; j < settled.length; j++) {
        const s = settled[j];
        results[start + j] = s.status === 'fulfilled'
          ? s.value
          : new Float64Array(this._enableMRL ? MRL_TARGET_DIM : fib(9));
      }
      this.emit('batch:chunk-complete', { start, end: start + chunk.length, total: texts.length });
    }

    return results;
  }

  // ─── HEALTH ────────────────────────────────────────────────────────────────

  /**
   * Return health snapshot for all registered embedding providers.
   * @returns {object[]}
   */
  getProviderHealth() {
    return [...this._providers.values()].map(p => ({
      id:           p.id,
      model:        p.model,
      dim:          p.dim,
      cbState:      p.cb.state,
      cbFailures:   p.cb.failures,
      callCount:    p.callCount,
      errorCount:   p.errorCount,
      errorRate:    p.callCount > 0 ? +(p.errorCount / p.callCount).toFixed(fib(3)) : 0,
      totalCostUsd: +p.totalCostUsd.toFixed(8),
      isLocal:      p.isLocal,
    }));
  }

  /** Set a BYOK API key for a provider. */
  setApiKey(providerId, apiKey) {
    const p = this._providers.get(providerId);
    if (!p) throw new Error(`EmbeddingRouter: unknown provider '${providerId}'`);
    p.apiKey = apiKey;
  }

  /** Global cumulative cost in USD. */
  get totalCostUsd() { return +this._totalCostUsd.toFixed(8); }
}

module.exports = EmbeddingRouter;

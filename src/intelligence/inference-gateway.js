/**
 * ∞ Heady™ Inference Gateway — Unified Inference Interface
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

const EventEmitter = require('events');
const crypto       = require('crypto');

// ─────────────────────────────────────────────
// Response Normalizer
// ─────────────────────────────────────────────

/**
 * Normalize a raw provider response to the standard gateway format.
 *
 * @param {object} raw          Raw provider result
 * @param {string} providerId
 * @param {string} requestId
 * @returns {NormalizedResponse}
 */
function normalizeResponse(raw, providerId, requestId) {
  return {
    requestId,
    providerId,
    model:      raw.model   ?? 'unknown',
    text:       raw.text    ?? '',
    citations:  raw.citations ?? [],
    usage: {
      inputTokens:  raw.usage?.inputTokens  ?? 0,
      outputTokens: raw.usage?.outputTokens ?? 0,
      totalTokens:  (raw.usage?.inputTokens ?? 0) + (raw.usage?.outputTokens ?? 0),
    },
    latencyMs:    raw.latencyMs  ?? 0,
    attemptCount: raw.attemptCount ?? 1,
    cached:       false,
    createdAt:    Date.now(),
  };
}

/**
 * Normalize a raw provider embedding result.
 * @param {object} raw
 * @param {string} providerId
 * @param {string} requestId
 * @returns {NormalizedEmbedding}
 */
function normalizeEmbedding(raw, providerId, requestId) {
  return {
    requestId,
    providerId,
    model:     raw.model     ?? 'unknown',
    embedding: raw.embedding ?? [],
    latencyMs: raw.latencyMs ?? 0,
    cached:    false,
    createdAt: Date.now(),
  };
}

// ─────────────────────────────────────────────
// Request Deduplication Cache
// ─────────────────────────────────────────────

/**
 * Time-bounded in-memory deduplication cache.
 * Identical prompts within the TTL window return the same response.
 */
class DedupeCache {
  /**
   * @param {object} [opts]
   * @param {number} [opts.ttlMs=60000]     Entry TTL in ms
   * @param {number} [opts.maxEntries=1000] Max entries before LRU eviction
   */
  constructor(opts = {}) {
    this.ttlMs      = opts.ttlMs      ?? 60_000;
    this.maxEntries = opts.maxEntries ?? 1_000;
    /** @type {Map<string, {value: any, ts: number}>} */
    this._cache = new Map();
  }

  /**
   * Compute a cache key from a prompt and options.
   * @param {string} prompt
   * @param {object} opts
   * @returns {string}
   */
  keyFor(prompt, opts = {}) {
    const payload = JSON.stringify({ prompt, taskType: opts.taskType, model: opts.model });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this._cache.delete(key);
      return null;
    }
    // Move to end (LRU update)
    this._cache.delete(key);
    this._cache.set(key, entry);
    return entry.value;
  }

  /**
   * @param {string} key
   * @param {any}    value
   */
  set(key, value) {
    if (this._cache.size >= this.maxEntries) {
      // Evict oldest entry
      this._cache.delete(this._cache.keys().next().value);
    }
    this._cache.set(key, { value, ts: Date.now() });
  }

  /** @returns {number} */
  get size() { return this._cache.size; }

  /** Clear all entries */
  clear() { this._cache.clear(); }

  /** Evict all expired entries */
  evictExpired() {
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (now - entry.ts > this.ttlMs) this._cache.delete(key);
    }
  }
}

// ─────────────────────────────────────────────
// Usage Logger
// ─────────────────────────────────────────────

/**
 * Records usage events for attribution, billing, and observability.
 */
class UsageLogger {
  constructor() {
    /** @type {Array<UsageEvent>} */
    this._log  = [];
    this._maxLog = 10_000;
  }

  /**
   * @param {UsageEvent} event
   */
  log(event) {
    this._log.push({ ...event, ts: Date.now() });
    if (this._log.length > this._maxLog) this._log.shift();
  }

  /**
   * Query usage log with optional filters.
   * @param {object} [filter]
   * @param {string} [filter.sessionId]
   * @param {string} [filter.providerId]
   * @param {number} [filter.since]  Unix ms
   * @returns {UsageEvent[]}
   */
  query(filter = {}) {
    return this._log.filter(e => {
      if (filter.sessionId  && e.sessionId  !== filter.sessionId)  return false;
      if (filter.providerId && e.providerId !== filter.providerId)  return false;
      if (filter.since      && e.ts         <  filter.since)        return false;
      return true;
    });
  }

  /**
   * Compute aggregated usage statistics.
   * @param {object} [filter]
   * @returns {object}
   */
  aggregate(filter = {}) {
    const events = this.query(filter);
    const totals = { requests: events.length, inputTokens: 0, outputTokens: 0, totalCostUsd: 0 };
    for (const e of events) {
      totals.inputTokens  += e.inputTokens  ?? 0;
      totals.outputTokens += e.outputTokens ?? 0;
      totals.totalCostUsd += e.costUsd      ?? 0;
    }
    return totals;
  }

  /** @returns {number} Log length */
  get length() { return this._log.length; }
}

// ─────────────────────────────────────────────
// SSE Streaming Helper
// ─────────────────────────────────────────────

/**
 * Wrap a streaming response in an async iterator of SSE-compatible chunks.
 * Handles both Node.js Readable streams and Web ReadableStreams.
 *
 * @param {ReadableStream|import('stream').Readable} stream
 * @param {string} requestId
 * @yields {{requestId: string, delta: string, done: boolean}}
 */
async function* streamToSSE(stream, requestId) {
  // Web ReadableStream (fetch API)
  if (stream && typeof stream.getReader === 'function') {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { yield { requestId, delta: '', done: true }; break; }
        const text = decoder.decode(value, { stream: true });
        // Parse SSE lines
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6);
            if (raw === '[DONE]') { yield { requestId, delta: '', done: true }; return; }
            try {
              const parsed = JSON.parse(raw);
              const delta  = parsed.choices?.[0]?.delta?.content
                          ?? parsed.candidates?.[0]?.content?.parts?.[0]?.text
                          ?? '';
              if (delta) yield { requestId, delta, done: false };
            } catch { /* skip malformed */ }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return;
  }

  // Node.js Readable
  for await (const chunk of stream) {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    yield { requestId, delta: text, done: false };
  }
  yield { requestId, delta: '', done: true };
}

// ─────────────────────────────────────────────
// Inference Gateway
// ─────────────────────────────────────────────

/**
 * @typedef {object} GatewayConfig
 * @property {object}  router              LLMRouter instance (from llm-router.js)
 * @property {boolean} [dedupe=true]       Enable request deduplication
 * @property {number}  [dedupeTtlMs]       Dedup cache TTL
 * @property {number}  [dedupeMaxEntries]  Dedup cache size
 * @property {boolean} [logUsage=true]     Enable usage logging
 */

/**
 * @typedef {object} InferenceRequest
 * @property {string}  prompt
 * @property {string}  taskType           One of TASK_TYPES from llm-router.js
 * @property {string}  [sessionId]
 * @property {string}  [attributionId]    For billing attribution
 * @property {object}  [opts]             Passed to the router (model, maxTokens, temperature, stream)
 * @property {boolean} [critical]         HeadySoul override
 * @property {boolean} [bypassCache]      Skip dedup cache for this request
 */

/**
 * @typedef {object} NormalizedResponse
 * @property {string}   requestId
 * @property {string}   providerId
 * @property {string}   model
 * @property {string}   text
 * @property {string[]} citations
 * @property {object}   usage
 * @property {number}   latencyMs
 * @property {number}   attemptCount
 * @property {boolean}  cached
 * @property {number}   createdAt
 */

/**
 * @typedef {object} NormalizedEmbedding
 * @property {string}   requestId
 * @property {string}   providerId
 * @property {string}   model
 * @property {number[]} embedding
 * @property {number}   latencyMs
 * @property {boolean}  cached
 * @property {number}   createdAt
 */

/**
 * @typedef {object} UsageEvent
 * @property {string} requestId
 * @property {string} sessionId
 * @property {string} attributionId
 * @property {string} providerId
 * @property {string} model
 * @property {string} taskType
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} latencyMs
 * @property {boolean} cached
 * @property {number} costUsd
 * @property {number} ts
 */

/**
 * Inference Gateway — single entry point for all LLM calls.
 *
 * Responsibilities:
 * - Request normalization (shape → standard InferenceRequest)
 * - Response normalization (provider-specific → NormalizedResponse)
 * - Request deduplication (cache identical prompts within TTL)
 * - Streaming SSE support
 * - Usage logging and attribution
 * - Delegates routing to LLMRouter
 *
 * @extends EventEmitter
 *
 * @example
 * const gateway = new InferenceGateway({ router });
 * const response = await gateway.infer({ prompt: 'Hello', taskType: 'quick' });
 * console.log(response.text);
 */
class InferenceGateway extends EventEmitter {
  /**
   * @param {GatewayConfig} config
   */
  constructor(config) {
    super();
    if (!config.router) throw new Error('InferenceGateway: config.router is required');
    this.router     = config.router;
    this.dedupeEnabled = config.dedupe ?? true;
    this.logEnabled    = config.logUsage ?? true;

    this.cache  = new DedupeCache({
      ttlMs:      config.dedupeTtlMs      ?? 60_000,
      maxEntries: config.dedupeMaxEntries ?? 1_000,
    });

    this.usageLog = new UsageLogger();

    // Schedule cache eviction every minute
    this._evictTimer = setInterval(() => this.cache.evictExpired(), 60_000).unref?.() ??
                       setInterval(() => this.cache.evictExpired(), 60_000);
  }

  // ── Core Inference ──

  /**
   * Execute an inference request with deduplication, normalization, and logging.
   * @param {InferenceRequest} req
   * @returns {Promise<NormalizedResponse>}
   */
  async infer(req) {
    const requestId = this._reqId();
    const {
      prompt,
      taskType,
      sessionId      = null,
      attributionId  = null,
      opts           = {},
      critical       = false,
      bypassCache    = false,
    } = req;

    // ─ Cache lookup ─
    const cacheKey = this.cache.keyFor(prompt, { taskType, ...opts });
    if (this.dedupeEnabled && !bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        const response = { ...cached, requestId, cached: true };
        this.emit('cache_hit', { requestId, taskType, sessionId });
        if (this.logEnabled) this._logUsage(response, sessionId, attributionId, taskType, true);
        return response;
      }
    }

    // ─ Route ─
    this.emit('request_start', { requestId, taskType, sessionId });

    let raw;
    try {
      raw = await this.router.route({ taskType, prompt, opts, critical, sessionId });
    } catch (err) {
      this.emit('request_error', { requestId, taskType, err });
      throw err;
    }

    const response = normalizeResponse(raw, raw.providerId, requestId);

    // ─ Cache store ─
    if (this.dedupeEnabled && !bypassCache) {
      this.cache.set(cacheKey, response);
    }

    // ─ Usage log ─
    if (this.logEnabled) {
      this._logUsage(response, sessionId, attributionId, taskType, false);
    }

    this.emit('request_complete', { requestId, taskType, sessionId, latencyMs: response.latencyMs });
    return response;
  }

  // ── Streaming Inference ──

  /**
   * Execute a streaming inference request.
   * Returns an async iterator of SSE-compatible chunks.
   *
   * @param {InferenceRequest} req
   * @yields {{requestId: string, delta: string, done: boolean}}
   */
  async *inferStream(req) {
    const requestId = this._reqId();
    const { prompt, taskType, opts = {}, critical = false, sessionId = null } = req;

    this.emit('stream_start', { requestId, taskType, sessionId });

    let raw;
    try {
      raw = await this.router.route({
        taskType,
        prompt,
        opts:     { ...opts, stream: true },
        critical,
        sessionId,
      });
    } catch (err) {
      this.emit('stream_error', { requestId, err });
      throw err;
    }

    // If router returns streaming body
    if (raw._stream) {
      yield* streamToSSE(raw._stream, requestId);
    } else {
      // Fallback: simulate streaming from complete response
      const text   = raw.text ?? '';
      const chunks = Math.ceil(text.length / 20);
      for (let i = 0; i < chunks; i++) {
        const delta = text.slice(i * 20, (i + 1) * 20);
        yield { requestId, delta, done: false };
        await new Promise(r => setTimeout(r, 10));
      }
      yield { requestId, delta: '', done: true };
    }

    this.emit('stream_complete', { requestId, taskType, sessionId });
  }

  // ── Embeddings ──

  /**
   * Generate an embedding with deduplication and logging.
   * @param {string} text
   * @param {object} [opts]
   * @param {string} [sessionId]
   * @returns {Promise<NormalizedEmbedding>}
   */
  async embed(text, opts = {}, sessionId = null) {
    const requestId = this._reqId();
    const cacheKey  = this.cache.keyFor(text, { type: 'embed', ...opts });

    if (this.dedupeEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.emit('cache_hit', { requestId, type: 'embed', sessionId });
        return { ...cached, requestId, cached: true };
      }
    }

    const raw      = await this.router.embed(text, opts);
    const response = normalizeEmbedding(raw, raw.providerId, requestId);

    if (this.dedupeEnabled) this.cache.set(cacheKey, response);

    this.emit('embed_complete', { requestId, sessionId, model: response.model });
    return response;
  }

  // ── Batch Inference ──

  /**
   * Execute multiple inference requests, optionally with concurrency control.
   * @param {InferenceRequest[]} requests
   * @param {object}   [opts]
   * @param {number}   [opts.concurrency=4]
   * @returns {Promise<NormalizedResponse[]>}
   */
  async inferBatch(requests, opts = {}) {
    const concurrency = opts.concurrency ?? 4;
    const results     = new Array(requests.length);
    let   ptr         = 0;

    const worker = async () => {
      while (ptr < requests.length) {
        const idx = ptr++;
        results[idx] = await this.infer(requests[idx]);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    return results;
  }

  // ── Usage & Metrics ──

  /**
   * Query usage log.
   * @param {object} [filter]
   * @returns {UsageEvent[]}
   */
  queryUsage(filter = {}) { return this.usageLog.query(filter); }

  /**
   * Aggregated usage statistics.
   * @param {object} [filter]
   * @returns {object}
   */
  aggregateUsage(filter = {}) { return this.usageLog.aggregate(filter); }

  /**
   * Dedup cache statistics.
   * @returns {{size: number, ttlMs: number}}
   */
  cacheStats() {
    return { size: this.cache.size, ttlMs: this.cache.ttlMs };
  }

  /**
   * Full gateway status snapshot.
   * @returns {object}
   */
  status() {
    return {
      cacheSize:     this.cache.size,
      usageLogSize:  this.usageLog.length,
      routerStatus:  this.router.status?.() ?? null,
    };
  }

  // ── Lifecycle ──

  /** Shut down the gateway (clears timers). */
  destroy() {
    clearInterval(this._evictTimer);
    this.cache.clear();
    this.removeAllListeners();
  }

  // ── Private ──

  _reqId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _logUsage(response, sessionId, attributionId, taskType, cached) {
    this.usageLog.log({
      requestId:     response.requestId,
      sessionId:     sessionId     ?? 'anonymous',
      attributionId: attributionId ?? 'unattributed',
      providerId:    response.providerId,
      model:         response.model,
      taskType:      taskType ?? 'unknown',
      inputTokens:   response.usage?.inputTokens  ?? 0,
      outputTokens:  response.usage?.outputTokens ?? 0,
      latencyMs:     response.latencyMs,
      cached,
      costUsd:       0, // populated by budget tracker if needed
    });
  }
}

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

/**
 * Create an InferenceGateway from an existing LLMRouter.
 * @param {object} router
 * @param {object} [config]
 * @returns {InferenceGateway}
 */
function createGateway(router, config = {}) {
  return new InferenceGateway({ router, ...config });
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export {

  InferenceGateway,
  DedupeCache,
  UsageLogger,
  createGateway,
  normalizeResponse,
  normalizeEmbedding,
  streamToSSE,
};

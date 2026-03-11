/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ LIQUID GATEWAY                                          ║
 * ║  Dynamic Multi-Provider AI Gateway with Liquid Failover          ║
 * ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
 * ║  60+ Provisional Patents — All Rights Reserved                   ║
 * ║  © 2026-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Race-based multi-provider routing: top-2 providers fire in parallel,
 * first valid response wins. CSL-scored selection. Phi-backoff circuit
 * breakers. Budget-aware auto-downgrade at ψ=61.8% spend.
 *
 * @module liquid-gateway
 */

import { EventEmitter } from 'events';
import {
  PHI, PSI, PSI_2, PSI_3,
  fib, FIBONACCI,
  phiBackoff, phiBackoffWithJitter,
  CSL_THRESHOLDS,
  TIMEOUT_TIERS,
} from '../shared/phi-math.js';
import { cslAND, normalize } from '../shared/csl-engine.js';

// ─── CONSTANTS (NO MAGIC NUMBERS) ────────────────────────────────────────────

/** Number of simultaneous race runners: fib(3) = 2 */
const RACE_WIDTH = fib(3); // 2

/** Circuit-breaker failure threshold: fib(5) = 5 */
const CB_FAILURE_THRESHOLD = fib(5); // 5

/** Half-open probe count: fib(3) = 2 */
const CB_HALF_OPEN_PROBES = fib(3); // 2  (fib(2)=1, fib(3)=2)

/** Heartbeat interval: fib(7) × 1000 = 13 000 ms */
const HEARTBEAT_INTERVAL_MS = fib(7) * 1000; // 13 000

/** Budget auto-downgrade at ψ = 61.8% consumed */
const BUDGET_DOWNGRADE_RATIO = PSI; // 0.618

/** Latency EMA weight: ψ² ≈ 0.382 (phi-weighted moving average) */
const LATENCY_EMA_ALPHA = PSI_2; // 0.382

/** Maximum request queue while circuit is open: fib(8) = 21 */
const MAX_QUEUE_DEPTH = fib(8); // 21

/** CSL capability vector dimension: fib(7) × fib(4) = 13 × 3 = 39 → snap to 34 (fib(9)) */
const CAP_VECTOR_DIM = fib(9); // 34

/** Default daily budget cap per provider (USD): ψ⁻¹ × $10 ≈ $16.18 */
const DEFAULT_DAILY_CAP_USD = PHI * 10; // 16.18

// ─── PROVIDER DEFINITIONS ────────────────────────────────────────────────────

/** Canonical provider names */
export const PROVIDERS = Object.freeze({
  CLAUDE:      'claude',
  GPT4O:       'gpt-4o',
  GEMINI:      'gemini',
  GROQ:        'groq',
  SONAR:       'perplexity-sonar',
  WORKERS_AI:  'workers-ai',
  OLLAMA:      'ollama',
});

/** Circuit breaker states */
const CB_STATE = Object.freeze({
  CLOSED:    'closed',
  OPEN:      'open',
  HALF_OPEN: 'half_open',
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Build a random unit capability vector of given dimension.
 * @param {number} dim
 * @returns {Float64Array}
 */
function randomCapVector(dim) {
  const v = new Float64Array(dim);
  for (let i = 0; i < dim; i++) v[i] = Math.random() * 2 - 1;
  return normalize(v);
}

/**
 * Build a seeded deterministic capability vector from a seed string.
 * Uses phi-weighted character codes to populate the vector.
 * @param {string} seed
 * @param {number} dim
 * @returns {Float64Array}
 */
function seededCapVector(seed, dim) {
  const v = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    const code = seed.charCodeAt(i % seed.length);
    v[i] = Math.sin(code * PHI + i * PSI);
  }
  return normalize(v);
}

/**
 * Sleep for a phi-derived duration.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── CIRCUIT BREAKER ─────────────────────────────────────────────────────────

/**
 * Per-provider phi-backoff circuit breaker.
 */
class CircuitBreaker {
  constructor(providerId) {
    this.providerId = providerId;
    this.state      = CB_STATE.CLOSED;
    this.failures   = 0;
    this.successes  = 0;
    this.probesSent = 0;
    this.openedAt   = null;
    this.attempt    = 0; // for phi-backoff calculation
  }

  /** Record a successful call. */
  recordSuccess() {
    this.failures = 0;
    if (this.state === CB_STATE.HALF_OPEN) {
      this.successes++;
      if (this.successes >= CB_HALF_OPEN_PROBES) {
        this.state     = CB_STATE.CLOSED;
        this.successes = 0;
        this.attempt   = 0;
      }
    }
  }

  /** Record a failed call. */
  recordFailure() {
    this.failures++;
    if (this.failures >= CB_FAILURE_THRESHOLD) {
      this.state    = CB_STATE.OPEN;
      this.openedAt = Date.now();
      this.attempt++;
    }
  }

  /** Check whether a request can pass through. */
  canRequest() {
    if (this.state === CB_STATE.CLOSED) return true;
    if (this.state === CB_STATE.OPEN) {
      const cooldown = phiBackoff(this.attempt - 1);
      if (Date.now() - this.openedAt > cooldown) {
        this.state      = CB_STATE.HALF_OPEN;
        this.probesSent = 0;
        this.successes  = 0;
      } else {
        return false;
      }
    }
    // HALF_OPEN: allow up to CB_HALF_OPEN_PROBES concurrent probes
    if (this.probesSent < CB_HALF_OPEN_PROBES) {
      this.probesSent++;
      return true;
    }
    return false;
  }

  toJSON() {
    return {
      providerId: this.providerId,
      state:      this.state,
      failures:   this.failures,
      openedAt:   this.openedAt,
      attempt:    this.attempt,
    };
  }
}

// ─── PROVIDER RECORD ─────────────────────────────────────────────────────────

/**
 * Internal provider state record.
 */
class ProviderRecord {
  /**
   * @param {object} cfg
   * @param {string} cfg.id
   * @param {string} cfg.baseUrl
   * @param {string} [cfg.model]
   * @param {number} [cfg.dailyCapUsd]
   * @param {number[]} [cfg.capabilityVector]
   * @param {string} [cfg.apiKey]
   */
  constructor(cfg) {
    this.id              = cfg.id;
    this.baseUrl         = cfg.baseUrl;
    this.model           = cfg.model || cfg.id;
    this.apiKey          = cfg.apiKey || null;
    this.dailyCapUsd     = cfg.dailyCapUsd ?? DEFAULT_DAILY_CAP_USD;
    this.dailySpendUsd   = 0;
    this.lastResetMs     = Date.now();
    this.latencyEma      = TIMEOUT_TIERS.normal; // initial guess 8 000 ms
    this.callCount       = 0;
    this.errorCount      = 0;
    this.circuitBreaker  = new CircuitBreaker(cfg.id);
    this.capabilityVec   = cfg.capabilityVector
      ? normalize(new Float64Array(cfg.capabilityVector))
      : seededCapVector(cfg.id, CAP_VECTOR_DIM);
    this.isLocal         = cfg.id === PROVIDERS.OLLAMA;
    this.degraded        = false; // true when ψ × dailyCap consumed
  }

  /** Update EMA latency with phi-weighted average. */
  updateLatency(sampleMs) {
    this.latencyEma = LATENCY_EMA_ALPHA * sampleMs + (1 - LATENCY_EMA_ALPHA) * this.latencyEma;
  }

  /** Check and reset daily budget if calendar day has rolled over. */
  checkDailyReset() {
    const now = Date.now();
    const msPerDay = fib(13) * 1000; // fib(13)=233 s is not a day — use direct calculation
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (now - this.lastResetMs > oneDayMs) {
      this.dailySpendUsd = 0;
      this.lastResetMs   = now;
    }
  }

  /** Whether ψ of daily budget is spent → downgrade to fallback. */
  get budgetExhausted() {
    this.checkDailyReset();
    return this.dailySpendUsd / this.dailyCapUsd >= BUDGET_DOWNGRADE_RATIO;
  }

  toHealth() {
    return {
      id:           this.id,
      latencyEmaMs: Math.round(this.latencyEma),
      callCount:    this.callCount,
      errorCount:   this.errorCount,
      errorRate:    this.callCount > 0 ? this.errorCount / this.callCount : 0,
      dailySpendUsd: +this.dailySpendUsd.toFixed(6),
      dailyCapUsd:   this.dailyCapUsd,
      budgetRatio:   +(this.dailySpendUsd / this.dailyCapUsd).toFixed(4),
      degraded:      this.degraded || this.budgetExhausted,
      circuitBreaker: this.circuitBreaker.toJSON(),
    };
  }
}

// ─── LIQUID GATEWAY ──────────────────────────────────────────────────────────

/**
 * LiquidGateway — Dynamic multi-provider AI gateway.
 *
 * Routes requests using CSL-scored provider selection, fires top-2 in
 * parallel (race mode), and handles failover automatically via per-provider
 * circuit breakers with phi-backoff recovery.
 *
 * @extends EventEmitter
 */
export class LiquidGateway extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {boolean} [options.enableHeartbeat=true] - Start phi-interval health monitors.
   * @param {number}  [options.raceWidth=RACE_WIDTH] - Parallel race runners (default 2).
   */
  constructor(options = {}) {
    super();
    this._providers     = new Map();
    this._raceWidth     = options.raceWidth ?? RACE_WIDTH;
    this._heartbeatRef  = null;

    this._registerDefaults();

    if (options.enableHeartbeat !== false) {
      this._startHeartbeat();
    }
  }

  // ─── PROVIDER REGISTRATION ─────────────────────────────────────────────────

  /** Register the seven canonical Heady providers with default settings. */
  _registerDefaults() {
    const defaults = [
      { id: PROVIDERS.CLAUDE,     baseUrl: 'https://api.anthropic.com/v1',           model: 'claude-3-5-sonnet-20241022' },
      { id: PROVIDERS.GPT4O,      baseUrl: 'https://api.openai.com/v1',              model: 'gpt-4o' },
      { id: PROVIDERS.GEMINI,     baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash' },
      { id: PROVIDERS.GROQ,       baseUrl: 'https://api.groq.com/openai/v1',         model: 'llama-3.3-70b-versatile' },
      { id: PROVIDERS.SONAR,      baseUrl: 'https://api.perplexity.ai',              model: 'sonar-pro' },
      { id: PROVIDERS.WORKERS_AI, baseUrl: 'https://api.cloudflare.com/client/v4',   model: '@cf/meta/llama-3.1-8b-instruct' },
      { id: PROVIDERS.OLLAMA,     baseUrl: 'http://localhost:11434',                 model: 'llama3.2', dailyCapUsd: 0 },
    ];
    for (const cfg of defaults) {
      this._providers.set(cfg.id, new ProviderRecord(cfg));
    }
  }

  /**
   * Add or replace a provider.
   * @param {object} cfg - Provider configuration (same shape as ProviderRecord).
   */
  addProvider(cfg) {
    const record = new ProviderRecord(cfg);
    this._providers.set(cfg.id, record);
    this.emit('provider:added', { id: cfg.id });
  }

  // ─── CSL PROVIDER SCORING ──────────────────────────────────────────────────

  /**
   * Score all providers for a given task vector using CSL cosine similarity.
   * Penalizes providers with open circuit breakers, budget exhaustion, or high latency.
   *
   * @param {Float64Array} taskVec - Unit capability vector for the task.
   * @returns {Array<{provider: ProviderRecord, score: number}>} Sorted descending.
   */
  _scoreProviders(taskVec) {
    const scored = [];
    for (const p of this._providers.values()) {
      if (!p.circuitBreaker.canRequest()) continue;
      if (p.budgetExhausted && !p.isLocal) continue;

      const cosine    = cslAND(taskVec, p.capabilityVec);
      // Penalize latency: normalize against fib(11)×1000 = 89 000 ms
      const latPenalty = Math.min(p.latencyEma / (fib(11) * 1000), 1) * PSI_3;
      const score      = cosine - latPenalty;
      scored.push({ provider: p, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  // ─── REQUEST EXECUTION ─────────────────────────────────────────────────────

  /**
   * Execute a request against a single provider.
   *
   * @param {ProviderRecord} provider
   * @param {object}         request   - { messages, model, maxTokens, ... }
   * @param {AbortSignal}    [signal]
   * @returns {Promise<object>} Parsed JSON response body.
   */
  async _execute(provider, request, signal) {
    const start  = Date.now();
    const apiKey = provider.apiKey || request.apiKey;
    const headers = {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    };

    const body = JSON.stringify({
      model:      request.model || provider.model,
      messages:   request.messages,
      max_tokens: request.maxTokens || fib(11) * fib(6), // 89 × 8 = 712
      ...request.extra,
    });

    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST', headers, body, signal,
    });

    const latency = Date.now() - start;

    if (!res.ok) {
      const err = new Error(`[${provider.id}] HTTP ${res.status}`);
      err.status   = res.status;
      err.provider = provider.id;
      throw err;
    }

    const data = await res.json();
    provider.updateLatency(latency);
    provider.callCount++;
    // Estimate cost from usage (approximation using fib(1)=1 cent per fib(10)=55 tokens)
    if (data.usage?.total_tokens) {
      provider.dailySpendUsd += data.usage.total_tokens / (fib(10) * 1000);
    }
    provider.circuitBreaker.recordSuccess();

    this.emit('request:success', { providerId: provider.id, latencyMs: latency });
    return data;
  }

  // ─── RACE MODE ─────────────────────────────────────────────────────────────

  /**
   * Fire the request to the top-N providers simultaneously and return the
   * first successful response (any losers are aborted).
   *
   * @param {object}   request     - Request payload.
   * @param {number[]} [providerIds] - Explicit provider IDs override auto-selection.
   * @returns {Promise<{result: object, winner: string}>}
   */
  async race(request, providerIds) {
    const taskVec  = request.taskVector
      ? normalize(new Float64Array(request.taskVector))
      : seededCapVector(request.messages?.[0]?.content?.slice(0, fib(6)) || 'default', CAP_VECTOR_DIM);

    let candidates;
    if (providerIds?.length) {
      candidates = providerIds
        .map(id => this._providers.get(id))
        .filter(Boolean);
    } else {
      candidates = this._scoreProviders(taskVec)
        .slice(0, this._raceWidth)
        .map(s => s.provider);
    }

    if (candidates.length === 0) {
      // Final fallback — local Ollama
      const ollama = this._providers.get(PROVIDERS.OLLAMA);
      if (ollama) candidates = [ollama];
      else throw new Error('LiquidGateway: no available providers');
    }

    const controllers = candidates.map(() => new AbortController());

    const races = candidates.map((provider, idx) =>
      this._execute(provider, request, controllers[idx].signal)
        .then(result => ({ result, winner: provider.id, idx }))
    );

    try {
      const { result, winner, idx } = await Promise.any(races);
      // Abort all losers
      controllers.forEach((c, i) => { if (i !== idx) c.abort(); });
      this.emit('race:winner', { winner, candidates: candidates.map(p => p.id) });
      return { result, winner };
    } catch (aggregateErr) {
      this.emit('race:failed', { candidates: candidates.map(p => p.id) });
      // Mark all failures
      for (const p of candidates) p.circuitBreaker.recordFailure();
      throw new Error('LiquidGateway: all race candidates failed');
    }
  }

  // ─── FALLBACK CHAIN ROUTE ──────────────────────────────────────────────────

  /**
   * Route a request through the fallback chain:
   * primary → fallback1 → fallback2 → local Ollama.
   *
   * At each step uses phi-backoff on retry before moving to next provider.
   *
   * @param {object} request
   * @returns {Promise<{result: object, winner: string}>}
   */
  async route(request) {
    const taskVec = request.taskVector
      ? normalize(new Float64Array(request.taskVector))
      : seededCapVector(request.messages?.[0]?.content?.slice(0, fib(6)) || 'default', CAP_VECTOR_DIM);

    const ranked = this._scoreProviders(taskVec);

    // Primary + up to 2 fallbacks + local
    const chain = [
      ...ranked.slice(0, fib(3)).map(s => s.provider),      // top-2
      this._providers.get(PROVIDERS.OLLAMA),                 // local safety net
    ].filter(Boolean);

    let lastError;
    for (let attempt = 0; attempt < chain.length; attempt++) {
      const provider = chain[attempt];
      try {
        const ctrl   = new AbortController();
        const result = await this._execute(provider, request, ctrl.signal);
        return { result, winner: provider.id };
      } catch (err) {
        lastError = err;
        provider.circuitBreaker.recordFailure();
        provider.errorCount++;
        this.emit('request:error', { providerId: provider.id, error: err.message, attempt });
        if (attempt < chain.length - 1) {
          await sleep(phiBackoffWithJitter(attempt));
        }
      }
    }
    throw lastError || new Error('LiquidGateway: entire fallback chain exhausted');
  }

  // ─── HEALTH MONITORING ─────────────────────────────────────────────────────

  /**
   * Return health snapshot for all registered providers.
   * @returns {object[]}
   */
  getHealth() {
    return [...this._providers.values()].map(p => p.toHealth());
  }

  /**
   * Start phi-interval heartbeat pings to all providers.
   * Interval = fib(7) × 1000 = 13 000 ms.
   * @private
   */
  _startHeartbeat() {
    this._heartbeatRef = setInterval(() => {
      this._runHeartbeat().catch(err =>
        this.emit('heartbeat:error', { error: err.message })
      );
    }, HEARTBEAT_INTERVAL_MS);

    if (this._heartbeatRef.unref) this._heartbeatRef.unref(); // non-blocking in Node
  }

  /** @private */
  async _runHeartbeat() {
    const checks = [...this._providers.values()].map(async (p) => {
      if (p.isLocal) return; // skip Ollama ping
      try {
        const start = Date.now();
        await fetch(`${p.baseUrl}/models`, {
          method: 'GET',
          signal: AbortSignal.timeout(fib(5) * 1000), // 5 000 ms
        });
        p.updateLatency(Date.now() - start);
        this.emit('heartbeat:ok', { providerId: p.id, latencyMs: Date.now() - start });
      } catch {
        // Heartbeat failure does NOT trip circuit breaker — only real requests do
        this.emit('heartbeat:degraded', { providerId: p.id });
      }
    });
    await Promise.allSettled(checks);
  }

  /** Stop the heartbeat timer (e.g. during graceful shutdown). */
  stopHeartbeat() {
    if (this._heartbeatRef) {
      clearInterval(this._heartbeatRef);
      this._heartbeatRef = null;
    }
  }

  /** Set a BYOK API key for a registered provider. */
  setApiKey(providerId, apiKey) {
    const p = this._providers.get(providerId);
    if (!p) throw new Error(`LiquidGateway: unknown provider '${providerId}'`);
    p.apiKey = apiKey;
    this.emit('provider:key-set', { providerId });
  }

  /** Update the daily budget cap for a provider (USD). */
  setDailyCap(providerId, capUsd) {
    const p = this._providers.get(providerId);
    if (!p) throw new Error(`LiquidGateway: unknown provider '${providerId}'`);
    p.dailyCapUsd = capUsd;
  }
}

export default LiquidGateway;

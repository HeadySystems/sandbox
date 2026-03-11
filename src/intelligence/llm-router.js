/**
 * ∞ Heady™ LLM Router — Dynamic LLM Provider Routing
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

const { PHI_TIMING } = require('../shared/phi-math');
const EventEmitter = require('events');

// ─────────────────────────────────────────────
// Constants & Routing Matrix
// ─────────────────────────────────────────────

/** All supported task types */
const TASK_TYPES = {
  CODE_GENERATION:  'code_generation',
  CODE_REVIEW:      'code_review',
  ARCHITECTURE:     'architecture',
  RESEARCH:         'research',
  QUICK:            'quick',
  CREATIVE:         'creative',
  SECURITY:         'security',
  DOCUMENTATION:    'documentation',
  EMBEDDINGS:       'embeddings',
};

/** Provider IDs */
const PROVIDERS = {
  ANTHROPIC:   'anthropic',
  OPENAI:      'openai',
  GOOGLE:      'google',
  GROQ:        'groq',
  PERPLEXITY:  'perplexity',
  LOCAL:       'local',
};

/**
 * Primary routing matrix: task type → [primary, fallback1, fallback2]
 * Each entry is a [providerId, modelId] tuple.
 */
const ROUTING_MATRIX = {
  [TASK_TYPES.CODE_GENERATION]:  [
    [PROVIDERS.ANTHROPIC,  'claude-3-5-sonnet-20241022'],
    [PROVIDERS.OPENAI,     'gpt-4o'],
    [PROVIDERS.GROQ,       'llama-3.3-70b-versatile'],
  ],
  [TASK_TYPES.CODE_REVIEW]: [
    [PROVIDERS.ANTHROPIC,  'claude-3-5-sonnet-20241022'],
    [PROVIDERS.OPENAI,     'gpt-4o'],
    [PROVIDERS.GOOGLE,     'gemini-2.0-flash'],
  ],
  [TASK_TYPES.ARCHITECTURE]: [
    [PROVIDERS.ANTHROPIC,  'claude-opus-4-5'],
    [PROVIDERS.OPENAI,     'gpt-4o'],
    [PROVIDERS.GOOGLE,     'gemini-2.5-pro'],
  ],
  [TASK_TYPES.RESEARCH]: [
    [PROVIDERS.PERPLEXITY, 'sonar-pro'],
    [PROVIDERS.ANTHROPIC,  'claude-3-5-sonnet-20241022'],
    [PROVIDERS.OPENAI,     'gpt-4o'],
  ],
  [TASK_TYPES.QUICK]: [
    [PROVIDERS.GROQ,       'llama-3.1-8b-instant'],
    [PROVIDERS.GOOGLE,     'gemini-2.0-flash'],
    [PROVIDERS.LOCAL,      'phi3'],
  ],
  [TASK_TYPES.CREATIVE]: [
    [PROVIDERS.ANTHROPIC,  'claude-3-5-sonnet-20241022'],
    [PROVIDERS.OPENAI,     'gpt-4o'],
    [PROVIDERS.GOOGLE,     'gemini-2.5-pro'],
  ],
  [TASK_TYPES.SECURITY]: [
    [PROVIDERS.ANTHROPIC,  'claude-opus-4-5'],
    [PROVIDERS.OPENAI,     'gpt-4o'],
    [PROVIDERS.GROQ,       'llama-3.3-70b-versatile'],
  ],
  [TASK_TYPES.DOCUMENTATION]: [
    [PROVIDERS.OPENAI,     'gpt-4o'],
    [PROVIDERS.ANTHROPIC,  'claude-3-5-sonnet-20241022'],
    [PROVIDERS.GOOGLE,     'gemini-2.0-flash'],
  ],
  [TASK_TYPES.EMBEDDINGS]: [
    [PROVIDERS.OPENAI,     'text-embedding-3-large'],
    [PROVIDERS.GOOGLE,     'text-embedding-004'],
    [PROVIDERS.LOCAL,      'nomic-embed-text'],
  ],
};

/** Default daily budget caps in USD per provider */
const DEFAULT_DAILY_CAPS = {
  [PROVIDERS.ANTHROPIC]:  50.00,
  [PROVIDERS.OPENAI]:     40.00,
  [PROVIDERS.GOOGLE]:     20.00,
  [PROVIDERS.GROQ]:       10.00,
  [PROVIDERS.PERPLEXITY]: 15.00,
  [PROVIDERS.LOCAL]:       0.00,
};

/** Default global monthly budget cap in USD */
const DEFAULT_MONTHLY_CAP = 500.00;

/** Budget warning threshold: downgrade when this fraction of cap is reached */
const BUDGET_WARN_THRESHOLD = 0.85;

/** Circuit breaker thresholds */
const CB_FAILURE_THRESHOLD  = 5;    // consecutive failures before opening
const CB_RECOVERY_TIMEOUT   = PHI_TIMING.CYCLE; // ms before half-open probe

// ─────────────────────────────────────────────
// Provider Adapters
// ─────────────────────────────────────────────

/**
 * Base class for all LLM provider adapters.
 * @abstract
 */
class BaseProviderAdapter {
  /**
   * @param {string} providerId
   * @param {object} config
   * @param {string} config.apiKey
   * @param {string} [config.baseUrl]
   * @param {number} [config.timeoutMs=PHI_TIMING.CYCLE]
   */
  constructor(providerId, config = {}) {
    this.providerId  = providerId;
    this.config      = config;
    this.timeoutMs   = config.timeoutMs ?? PHI_TIMING.CYCLE;
  }

  /**
   * Generate a completion.
   * @param {string} prompt
   * @param {object} [opts]
   * @param {string} [opts.model]
   * @param {number} [opts.maxTokens]
   * @param {number} [opts.temperature]
   * @param {boolean} [opts.stream]
   * @returns {Promise<{text: string, usage: object, latencyMs: number}>}
   * @abstract
   */
  async generate(prompt, opts = {}) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.constructor.name}.generate() not implemented`);
  }

  /**
   * Generate an embedding vector.
   * @param {string} text
   * @param {object} [opts]
   * @returns {Promise<{embedding: number[], model: string, latencyMs: number}>}
   * @abstract
   */
  async embed(text, opts = {}) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.constructor.name}.embed() not implemented`);
  }

  /**
   * Health check for this provider.
   * @returns {Promise<{healthy: boolean, latencyMs: number, detail: string}>}
   */
  async health() {
    const start = Date.now();
    try {
      await this.generate('ping', { model: null, maxTokens: 1 });
      return { healthy: true, latencyMs: Date.now() - start, detail: 'ok' };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, detail: err.message };
    }
  }

  /**
   * Execute an HTTP request with timeout.
   * @param {string} url
   * @param {object} fetchOpts
   * @returns {Promise<Response>}
   */
  async _fetch(url, fetchOpts = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw Object.assign(new Error(`HTTP ${res.status}: ${body}`), {
          status: res.status,
          isRateLimit: res.status === 429,
        });
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Anthropic ───────────────────────────────
/**
 * Anthropic Claude adapter.
 * @extends BaseProviderAdapter
 */
class AnthropicAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super(PROVIDERS.ANTHROPIC, config);
    this.baseUrl = config.baseUrl ?? 'https://api.anthropic.com/v1';
    this.defaultModel = 'claude-3-5-sonnet-20241022';
  }

  /** @override */
  async generate(prompt, opts = {}) {
    const model = opts.model ?? this.defaultModel;
    const start = Date.now();
    const res = await this._fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        messages: [{ role: 'user', content: prompt }],
        stream: opts.stream ?? false,
      }),
    });
    const data = await res.json();
    return {
      text:      data.content?.[0]?.text ?? '',
      usage:     { inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens },
      model,
      latencyMs: Date.now() - start,
    };
  }

  /** @override */
  async embed(text, opts = {}) {
    // Anthropic does not offer a native embedding endpoint; proxy to OpenAI by convention.
    throw new Error('AnthropicAdapter: embeddings not supported — use OpenAI or Google adapter');
  }
}

// ─── OpenAI ──────────────────────────────────
/**
 * OpenAI GPT adapter.
 * @extends BaseProviderAdapter
 */
class OpenAIAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super(PROVIDERS.OPENAI, config);
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
    this.defaultModel = 'gpt-4o';
  }

  /** @override */
  async generate(prompt, opts = {}) {
    const model = opts.model ?? this.defaultModel;
    const start = Date.now();
    const res = await this._fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        stream: opts.stream ?? false,
      }),
    });
    const data = await res.json();
    return {
      text:      data.choices?.[0]?.message?.content ?? '',
      usage:     { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
      model,
      latencyMs: Date.now() - start,
    };
  }

  /** @override */
  async embed(text, opts = {}) {
    const model = opts.model ?? 'text-embedding-3-large';
    const start = Date.now();
    const res = await this._fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ model, input: text }),
    });
    const data = await res.json();
    return {
      embedding: data.data?.[0]?.embedding ?? [],
      model,
      latencyMs: Date.now() - start,
    };
  }
}

// ─── Google ──────────────────────────────────
/**
 * Google Gemini adapter.
 * @extends BaseProviderAdapter
 */
class GoogleAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super(PROVIDERS.GOOGLE, config);
    this.baseUrl = config.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = 'gemini-2.0-flash';
  }

  /** @override */
  async generate(prompt, opts = {}) {
    const model = opts.model ?? this.defaultModel;
    const start = Date.now();
    const url   = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;
    const res   = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 4096,
          temperature:     opts.temperature ?? 0.7,
        },
      }),
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return {
      text,
      usage: {
        inputTokens:  data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      },
      model,
      latencyMs: Date.now() - start,
    };
  }

  /** @override */
  async embed(text, opts = {}) {
    const model = opts.model ?? 'text-embedding-004';
    const start = Date.now();
    const url   = `${this.baseUrl}/models/${model}:embedContent?key=${this.config.apiKey}`;
    const res   = await this._fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: `models/${model}`, content: { parts: [{ text }] } }),
    });
    const data = await res.json();
    return {
      embedding: data.embedding?.values ?? [],
      model,
      latencyMs: Date.now() - start,
    };
  }
}

// ─── Groq ────────────────────────────────────
/**
 * Groq (Llama) adapter.
 * @extends BaseProviderAdapter
 */
class GroqAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super(PROVIDERS.GROQ, config);
    this.baseUrl = config.baseUrl ?? 'https://api.groq.com/openai/v1';
    this.defaultModel = 'llama-3.3-70b-versatile';
  }

  /** @override */
  async generate(prompt, opts = {}) {
    const model = opts.model ?? this.defaultModel;
    const start = Date.now();
    const res   = await this._fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        stream: opts.stream ?? false,
      }),
    });
    const data = await res.json();
    return {
      text:      data.choices?.[0]?.message?.content ?? '',
      usage:     { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
      model,
      latencyMs: Date.now() - start,
    };
  }

  /** @override */
  async embed(text, opts = {}) {
    throw new Error('GroqAdapter: embeddings not supported');
  }
}

// ─── Perplexity ──────────────────────────────
/**
 * Perplexity Sonar adapter (research-focused).
 * @extends BaseProviderAdapter
 */
class PerplexityAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super(PROVIDERS.PERPLEXITY, config);
    this.baseUrl = config.baseUrl ?? 'https://api.perplexity.ai';
    this.defaultModel = 'sonar-pro';
  }

  /** @override */
  async generate(prompt, opts = {}) {
    const model = opts.model ?? this.defaultModel;
    const start = Date.now();
    const res   = await this._fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.2,
        stream: opts.stream ?? false,
      }),
    });
    const data = await res.json();
    return {
      text:      data.choices?.[0]?.message?.content ?? '',
      citations: data.citations ?? [],
      usage:     { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
      model,
      latencyMs: Date.now() - start,
    };
  }

  /** @override */
  async embed(text, opts = {}) {
    throw new Error('PerplexityAdapter: embeddings not supported');
  }
}

// ─── Local (Ollama) ──────────────────────────
/**
 * Local Ollama adapter.
 * @extends BaseProviderAdapter
 */
class LocalAdapter extends BaseProviderAdapter {
  constructor(config = {}) {
    super(PROVIDERS.LOCAL, config);
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this.defaultModel = 'phi3';
  }

  /** @override */
  async generate(prompt, opts = {}) {
    const model = opts.model ?? this.defaultModel;
    const start = Date.now();
    const res   = await this._fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          num_predict: opts.maxTokens ?? 4096,
          temperature: opts.temperature ?? 0.7,
        },
      }),
    });
    const data = await res.json();
    return {
      text:      data.response ?? '',
      usage:     { inputTokens: data.prompt_eval_count, outputTokens: data.eval_count },
      model,
      latencyMs: Date.now() - start,
    };
  }

  /** @override */
  async embed(text, opts = {}) {
    const model = opts.model ?? 'nomic-embed-text';
    const start = Date.now();
    const res   = await this._fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    const data = await res.json();
    return {
      embedding: data.embedding ?? [],
      model,
      latencyMs: Date.now() - start,
    };
  }

  /** @override */
  async health() {
    const start = Date.now();
    try {
      const res = await this._fetch(`${this.baseUrl}/api/tags`);
      const data = await res.json();
      return {
        healthy: Array.isArray(data.models),
        latencyMs: Date.now() - start,
        detail: `${data.models?.length ?? 0} models available`,
      };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, detail: err.message };
    }
  }
}

// ─────────────────────────────────────────────
// Circuit Breaker
// ─────────────────────────────────────────────

/**
 * Per-provider circuit breaker.
 * States: CLOSED (healthy) → OPEN (failing) → HALF_OPEN (probing)
 */
class CircuitBreaker {
  /**
   * @param {string} name
   * @param {object} [opts]
   * @param {number} [opts.failureThreshold]
   * @param {number} [opts.recoveryTimeoutMs]
   */
  constructor(name, opts = {}) {
    this.name             = name;
    this.failureThreshold = opts.failureThreshold  ?? CB_FAILURE_THRESHOLD;
    this.recoveryTimeout  = opts.recoveryTimeoutMs ?? CB_RECOVERY_TIMEOUT;
    this.state            = 'CLOSED';
    this.failures         = 0;
    this.lastFailureAt    = null;
    this.openedAt         = null;
  }

  /** @returns {boolean} Whether the circuit allows requests through */
  isAllowed() {
    if (this.state === 'CLOSED')    return true;
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        return true; // allow probe
      }
      return false;
    }
    // HALF_OPEN — allow one probe
    return true;
  }

  /** Record a successful call */
  recordSuccess() {
    this.failures = 0;
    this.state    = 'CLOSED';
  }

  /** Record a failed call */
  recordFailure() {
    this.failures++;
    this.lastFailureAt = Date.now();
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state    = 'OPEN';
      this.openedAt = Date.now();
    }
  }

  /** @returns {object} Current state snapshot */
  snapshot() {
    return {
      name:          this.name,
      state:         this.state,
      failures:      this.failures,
      lastFailureAt: this.lastFailureAt,
      openedAt:      this.openedAt,
    };
  }
}

// ─────────────────────────────────────────────
// Budget Tracker
// ─────────────────────────────────────────────

/**
 * Token cost estimates per 1K tokens (USD).
 * Input / output price.
 */
const TOKEN_COST = {
  [PROVIDERS.ANTHROPIC]:  { input: 0.003, output: 0.015 },  // claude-3.5-sonnet
  [PROVIDERS.OPENAI]:     { input: 0.0025, output: 0.010 },  // gpt-4o
  [PROVIDERS.GOOGLE]:     { input: 0.00015, output: 0.0006 }, // gemini-flash
  [PROVIDERS.GROQ]:       { input: 0.0001, output: 0.0001 },
  [PROVIDERS.PERPLEXITY]: { input: 0.001, output: 0.001 },
  [PROVIDERS.LOCAL]:      { input: 0, output: 0 },
};

/**
 * Tracks spending per provider and globally.
 */
class BudgetTracker {
  /**
   * @param {object} [opts]
   * @param {object} [opts.dailyCaps]      Per-provider daily caps in USD
   * @param {number} [opts.monthlyCapUsd]  Global monthly cap
   */
  constructor(opts = {}) {
    this.dailyCaps  = { ...DEFAULT_DAILY_CAPS,  ...(opts.dailyCaps ?? {}) };
    this.monthlyCap = opts.monthlyCapUsd ?? DEFAULT_MONTHLY_CAP;

    /** @type {Map<string, {day: number, month: number}>} */
    this.usage = new Map();
    this._today       = this._dateKey();
    this._thisMonth   = this._monthKey();

    // Reset daily usage at midnight
    this._startDailyReset();
  }

  _dateKey()  { return new Date().toISOString().slice(0, 10); }
  _monthKey() { return new Date().toISOString().slice(0, 7); }

  _startDailyReset() {
    const now       = new Date();
    const midnight  = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msToMidnight = midnight - now;
    setTimeout(() => {
      this._today = this._dateKey();
      // reset per-provider daily counters
      for (const [k, v] of this.usage) {
        this.usage.set(k, { ...v, day: 0 });
      }
      this._startDailyReset();
    }, msToMidnight);
  }

  /**
   * Record token usage for a completed request.
   * @param {string} providerId
   * @param {number} inputTokens
   * @param {number} outputTokens
   */
  record(providerId, inputTokens = 0, outputTokens = 0) {
    const cost = this._calcCost(providerId, inputTokens, outputTokens);
    const existing = this.usage.get(providerId) ?? { day: 0, month: 0 };
    this.usage.set(providerId, {
      day:   existing.day   + cost,
      month: existing.month + cost,
    });
  }

  /**
   * Check if a provider is within budget.
   * @param {string} providerId
   * @returns {'ok' | 'warn' | 'exceeded'}
   */
  check(providerId) {
    const { day = 0, month = 0 } = this.usage.get(providerId) ?? {};
    const totalMonth = this._totalMonthly();
    if (day >= this.dailyCaps[providerId])  return 'exceeded';
    if (totalMonth >= this.monthlyCap)      return 'exceeded';
    if (day >= this.dailyCaps[providerId]  * BUDGET_WARN_THRESHOLD) return 'warn';
    if (totalMonth >= this.monthlyCap * BUDGET_WARN_THRESHOLD)      return 'warn';
    return 'ok';
  }

  /** @returns {number} Total monthly spend across all providers */
  _totalMonthly() {
    let total = 0;
    for (const v of this.usage.values()) total += v.month;
    return total;
  }

  _calcCost(providerId, inputTokens, outputTokens) {
    const rates = TOKEN_COST[providerId] ?? { input: 0, output: 0 };
    return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
  }

  /** @returns {object} Full budget snapshot */
  snapshot() {
    const snap = {};
    for (const [providerId, v] of this.usage) {
      snap[providerId] = {
        ...v,
        dailyCap:  this.dailyCaps[providerId],
        status:    this.check(providerId),
      };
    }
    return {
      providers:    snap,
      totalMonthly: this._totalMonthly(),
      monthlyCap:   this.monthlyCap,
    };
  }
}

// ─────────────────────────────────────────────
// Routing Metrics
// ─────────────────────────────────────────────

/**
 * Tracks per-provider routing metrics: request counts and latency percentiles.
 */
class RoutingMetrics {
  constructor() {
    /** @type {Map<string, {requests: number, errors: number, latencies: number[]}>} */
    this.data = new Map();
  }

  _ensure(providerId) {
    if (!this.data.has(providerId)) {
      this.data.set(providerId, { requests: 0, errors: 0, latencies: [] });
    }
    return this.data.get(providerId);
  }

  /**
   * Record a completed request.
   * @param {string} providerId
   * @param {number} latencyMs
   * @param {boolean} [error]
   */
  record(providerId, latencyMs, error = false) {
    const d = this._ensure(providerId);
    d.requests++;
    if (error) d.errors++;
    d.latencies.push(latencyMs);
    // Keep only last 500 samples per provider
    if (d.latencies.length > 500) d.latencies.shift();
  }

  /**
   * Compute a latency percentile.
   * @param {string} providerId
   * @param {number} p  Percentile 0–100
   * @returns {number|null}
   */
  percentile(providerId, p) {
    const d = this.data.get(providerId);
    if (!d || d.latencies.length === 0) return null;
    const sorted = [...d.latencies].sort((a, b) => a - b);
    const idx    = Math.floor((p / 100) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  }

  /** @returns {object} Full metrics snapshot */
  snapshot() {
    const snap = {};
    for (const [providerId, d] of this.data) {
      snap[providerId] = {
        requests: d.requests,
        errors:   d.errors,
        p50:      this.percentile(providerId, 50),
        p95:      this.percentile(providerId, 95),
        p99:      this.percentile(providerId, 99),
        errorRate: d.requests > 0 ? d.errors / d.requests : 0,
      };
    }
    return snap;
  }
}

// ─────────────────────────────────────────────
// LLM Router
// ─────────────────────────────────────────────

/**
 * @typedef {object} RouterConfig
 * @property {object}  providers           Per-provider config (apiKey, baseUrl, …)
 * @property {object}  [dailyCaps]         Per-provider daily budget caps
 * @property {number}  [monthlyCapUsd]     Global monthly budget cap
 * @property {number}  [retryDelayMs]      Base delay between retries
 * @property {number}  [maxRetries]        Max retry attempts per provider slot
 * @property {boolean} [enableCircuitBreaker]
 */

/**
 * @typedef {object} RouteRequest
 * @property {string}  taskType   One of TASK_TYPES values
 * @property {string}  prompt
 * @property {object}  [opts]     Passed to the adapter's generate()
 * @property {boolean} [critical] If true, HeadySoul override is applied
 * @property {string}  [sessionId]
 */

/**
 * @typedef {object} RouteResult
 * @property {string}  text
 * @property {string}  providerId
 * @property {string}  model
 * @property {number}  latencyMs
 * @property {object}  usage
 * @property {number}  attemptCount
 */

/**
 * Main LLM Router.  Implements Liquid Failover across the routing matrix
 * with circuit breakers, budget enforcement, and metrics.
 *
 * @extends EventEmitter
 */
class LLMRouter extends EventEmitter {
  /**
   * @param {RouterConfig} config
   */
  constructor(config = {}) {
    super();

    this.config  = config;
    this.retryDelayMs       = config.retryDelayMs ?? 1500;
    this.maxRetries         = config.maxRetries   ?? 2;
    this.cbEnabled          = config.enableCircuitBreaker ?? true;

    /** @type {Map<string, BaseProviderAdapter>} */
    this.adapters = this._buildAdapters(config.providers ?? {});

    /** @type {Map<string, CircuitBreaker>} */
    this.breakers = new Map();
    for (const id of Object.values(PROVIDERS)) {
      this.breakers.set(id, new CircuitBreaker(id));
    }

    this.budget  = new BudgetTracker({
      dailyCaps:     config.dailyCaps,
      monthlyCapUsd: config.monthlyCapUsd,
    });

    this.metrics = new RoutingMetrics();

    /** HeadySoul critical-override lock: when true, skips budget gate */
    this._headySoulOverride = false;
  }

  // ── Adapter Construction ──

  _buildAdapters(providerConfigs) {
    const map = new Map();
    const build = (id, Cls) => {
      if (providerConfigs[id]) map.set(id, new Cls(providerConfigs[id]));
    };
    build(PROVIDERS.ANTHROPIC,  AnthropicAdapter);
    build(PROVIDERS.OPENAI,     OpenAIAdapter);
    build(PROVIDERS.GOOGLE,     GoogleAdapter);
    build(PROVIDERS.GROQ,       GroqAdapter);
    build(PROVIDERS.PERPLEXITY, PerplexityAdapter);
    build(PROVIDERS.LOCAL,      LocalAdapter);
    return map;
  }

  // ── HeadySoul Override ──

  /**
   * Activate HeadySoul override for the next request — skips budget gate.
   * Auto-clears after one use.
   */
  activateHeadySoulOverride() {
    this._headySoulOverride = true;
    this.emit('headysoul_override_activated');
  }

  // ── Core Routing ──

  /**
   * Route a generation request through the Liquid Failover chain.
   * @param {RouteRequest} req
   * @returns {Promise<RouteResult>}
   */
  async route(req) {
    const { taskType, prompt, opts = {}, critical = false, sessionId } = req;

    if (critical) this.activateHeadySoulOverride();

    const chain = ROUTING_MATRIX[taskType];
    if (!chain) throw new Error(`Unknown taskType: ${taskType}`);

    let attemptCount = 0;
    const errors     = [];

    for (const [providerId, model] of chain) {
      // Budget gate
      const budgetStatus = this.budget.check(providerId);
      if (budgetStatus === 'exceeded' && !this._headySoulOverride) {
        this.emit('budget_exceeded', { providerId, taskType });
        continue;
      }
      if (budgetStatus === 'warn') {
        this.emit('budget_warn', { providerId, taskType });
      }

      // Circuit breaker gate
      const breaker = this.breakers.get(providerId);
      if (this.cbEnabled && breaker && !breaker.isAllowed()) {
        this.emit('circuit_open', { providerId });
        continue;
      }

      const adapter = this.adapters.get(providerId);
      if (!adapter) continue;

      // Retry loop within this provider slot
      let lastErr = null;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        attemptCount++;
        const start = Date.now();
        try {
          const result = await adapter.generate(prompt, { ...opts, model });
          const latencyMs = Date.now() - start;

          // Record success
          breaker?.recordSuccess();
          this.metrics.record(providerId, latencyMs, false);
          this.budget.record(providerId, result.usage?.inputTokens ?? 0, result.usage?.outputTokens ?? 0);

          this._headySoulOverride = false; // clear after first success
          this.emit('route_success', { providerId, model, taskType, latencyMs, sessionId });

          return {
            text:         result.text,
            providerId,
            model,
            latencyMs,
            usage:        result.usage ?? {},
            attemptCount,
            citations:    result.citations,
          };
        } catch (err) {
          const latencyMs = Date.now() - start;
          lastErr = err;
          this.metrics.record(providerId, latencyMs, true);
          this.emit('route_error', { providerId, model, taskType, err, attempt, sessionId });

          if (err.isRateLimit) {
            // Rate-limit: wait with exponential backoff then retry
            await this._sleep(this.retryDelayMs * Math.pow(2, attempt));
          } else if (err.name === 'AbortError') {
            // Timeout: switch immediately (don't retry same slot)
            break;
          } else {
            break; // other error — advance to next provider
          }
        }
      }

      breaker?.recordFailure();
      errors.push({ providerId, model, error: lastErr?.message });
    }

    this._headySoulOverride = false;
    const summary = errors.map(e => `${e.providerId}/${e.model}: ${e.error}`).join('; ');
    throw new Error(`LLMRouter: all providers failed for ${taskType}. Errors: ${summary}`);
  }

  /**
   * Route an embedding request through appropriate providers.
   * @param {string} text
   * @param {object} [opts]
   * @returns {Promise<{embedding: number[], providerId: string, model: string, latencyMs: number}>}
   */
  async embed(text, opts = {}) {
    const chain = ROUTING_MATRIX[TASK_TYPES.EMBEDDINGS];
    for (const [providerId, model] of chain) {
      const adapter = this.adapters.get(providerId);
      if (!adapter) continue;
      const breaker = this.breakers.get(providerId);
      if (this.cbEnabled && breaker && !breaker.isAllowed()) continue;

      try {
        const result = await adapter.embed(text, { ...opts, model });
        breaker?.recordSuccess();
        this.metrics.record(providerId, result.latencyMs, false);
        return { ...result, providerId };
      } catch (err) {
        breaker?.recordFailure();
        this.emit('embed_error', { providerId, model, err });
      }
    }
    throw new Error('LLMRouter.embed: all providers failed');
  }

  // ── Health ──

  /**
   * Run health checks across all registered adapters.
   * @returns {Promise<object>} Map of providerId → health result
   */
  async healthCheckAll() {
    const results = {};
    await Promise.all(
      [...this.adapters.entries()].map(async ([id, adapter]) => {
        results[id] = await adapter.health();
      })
    );
    this.emit('health_check', results);
    return results;
  }

  // ── Introspection ──

  /**
   * Full router status snapshot.
   * @returns {object}
   */
  status() {
    const breakers = {};
    for (const [id, cb] of this.breakers) breakers[id] = cb.snapshot();
    return {
      adapters:  [...this.adapters.keys()],
      breakers,
      budget:    this.budget.snapshot(),
      metrics:   this.metrics.snapshot(),
      headySoul: this._headySoulOverride,
    };
  }

  // ── Utility ──

  _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

// ─────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────

/**
 * Create an LLMRouter from environment variables.
 * Looks for ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY,
 * GROQ_API_KEY, PERPLEXITY_API_KEY, OLLAMA_BASE_URL.
 * @param {Partial<RouterConfig>} [overrides]
 * @returns {LLMRouter}
 */
function createRouterFromEnv(overrides = {}) {
  const providers = {};
  if (process.env.ANTHROPIC_API_KEY)  providers[PROVIDERS.ANTHROPIC]  = { apiKey: process.env.ANTHROPIC_API_KEY };
  if (process.env.OPENAI_API_KEY)     providers[PROVIDERS.OPENAI]     = { apiKey: process.env.OPENAI_API_KEY };
  if (process.env.GOOGLE_API_KEY)     providers[PROVIDERS.GOOGLE]     = { apiKey: process.env.GOOGLE_API_KEY };
  if (process.env.GROQ_API_KEY)       providers[PROVIDERS.GROQ]       = { apiKey: process.env.GROQ_API_KEY };
  if (process.env.PERPLEXITY_API_KEY) providers[PROVIDERS.PERPLEXITY] = { apiKey: process.env.PERPLEXITY_API_KEY };
  providers[PROVIDERS.LOCAL] = { baseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434' };

  return new LLMRouter({ providers, ...overrides });
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export {

  LLMRouter,
  createRouterFromEnv,
  TASK_TYPES,
  PROVIDERS,
  ROUTING_MATRIX,
  // Adapters (for direct use)
  AnthropicAdapter,
  OpenAIAdapter,
  GoogleAdapter,
  GroqAdapter,
  PerplexityAdapter,
  LocalAdapter,
  // Internals (useful for testing)
  CircuitBreaker,
  BudgetTracker,
  RoutingMetrics,
};

/**
 * @fileoverview BudgetTracker — Real-time AI provider cost tracking with phi-scaled
 * alert thresholds and auto-downgrade logic for the Heady™ Latent OS.
 *
 * All alert thresholds are derived from ALERT_THRESHOLDS in shared/phi-math.js.
 * Rolling spend history uses a Fibonacci-sized window (fib(9)=34 days).
 *
 * @module services/budget-tracker
 * @version 1.0.0
 */

'use strict';

import {
  PSI,
  PSI2,
  PSI3,
  PSI4,
  fib,
  ALERT_THRESHOLDS,
  phiFusionWeights,
} from '../shared/phi-math.js';

// ─── Module Constants ──────────────────────────────────────────────────────────

/** Rolling window depth for daily spend history (fib(9)=34). */
const HISTORY_WINDOW = fib(9);   // 34 days

/** Default daily budget in USD. */
const DEFAULT_DAILY_BUDGET = 50.00;

/** Default monthly budget in USD. */
const DEFAULT_MONTHLY_BUDGET = 1_000.00;

/** Default per-provider daily caps in USD. */
const DEFAULT_PROVIDER_CAPS = {
  anthropic:  20.00,
  openai:     15.00,
  google:      8.00,
  groq:        3.00,
  perplexity:  4.00,
};

/**
 * Provider fallback chain: if a provider approaches its cap, suggest the next.
 * Ordered by cost tier (cheapest last).
 */
const FALLBACK_CHAIN = {
  anthropic:  'openai',
  openai:     'google',
  google:     'groq',
  groq:       'perplexity',
  perplexity: 'groq',
};

/** Cost-per-million-tokens by model (USD). Update as pricing changes. */
const MODEL_COST_PER_M_TOKENS = {
  // Anthropic
  'claude-3-5-sonnet':   3.00,
  'claude-3-5-haiku':    0.80,
  'claude-3-opus':      15.00,
  // OpenAI
  'gpt-4o':              2.50,
  'gpt-4o-mini':         0.15,
  'gpt-4-turbo':        10.00,
  // Google
  'gemini-1.5-pro':      3.50,
  'gemini-1.5-flash':    0.075,
  'gemini-2.0-flash':    0.10,
  // Groq
  'llama-3.3-70b':       0.59,
  'llama-3.1-8b':        0.05,
  'mixtral-8x7b':        0.27,
  // Perplexity
  'llama-3.1-sonar-huge': 5.00,
  'llama-3.1-sonar-large': 1.00,
  'llama-3.1-sonar-small': 0.20,
};

/** Map alert-level names to their ratio thresholds. */
const ALERT_LEVEL_MAP = [
  { level: 'EXCEEDED', threshold: ALERT_THRESHOLDS.exceeded  }, // 1-PSI⁴ ≈ 0.910
  { level: 'CRITICAL', threshold: ALERT_THRESHOLDS.critical  }, // 1-PSI³ ≈ 0.854
  { level: 'CAUTION',  threshold: ALERT_THRESHOLDS.caution   }, // 1-PSI² ≈ 0.764
  { level: 'WARNING',  threshold: ALERT_THRESHOLDS.warning   }, // PSI    ≈ 0.618
  { level: 'NOMINAL',  threshold: 0                          },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the UTC date key for a given timestamp (default: now).
 * @param {number} [ts=Date.now()]
 * @returns {string} 'YYYY-MM-DD'
 */
function utcDateKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 10);
}

/**
 * Returns the UTC month key for a given timestamp.
 * @param {number} [ts=Date.now()]
 * @returns {string} 'YYYY-MM'
 */
function utcMonthKey(ts = Date.now()) {
  return new Date(ts).toISOString().slice(0, 7);
}

/**
 * Resolve alert level string from a spend ratio.
 * @param {number} ratio - spendSoFar / budget (0–∞)
 * @returns {string}
 */
function resolveAlertLevel(ratio) {
  for (const { level, threshold } of ALERT_LEVEL_MAP) {
    if (ratio >= threshold) return level;
  }
  return 'NOMINAL';
}

// ─── Class ────────────────────────────────────────────────────────────────────

/**
 * @class BudgetTracker
 * @description Tracks AI provider spend in real-time, enforces phi-derived budget
 * thresholds, and recommends provider downgrades before caps are hit.
 */
export class BudgetTracker {
  /**
   * @param {object} [config={}]
   * @param {number}  [config.dailyBudgetUSD=50]        Total daily budget.
   * @param {number}  [config.monthlyBudgetUSD=1000]    Total monthly budget.
   * @param {object}  [config.perProviderDailyCaps]     Per-provider caps override.
   * @param {boolean} [config.verbose=false]
   */
  constructor(config = {}) {
    /** @type {number} */
    this._dailyBudget = config.dailyBudgetUSD ?? DEFAULT_DAILY_BUDGET;

    /** @type {number} */
    this._monthlyBudget = config.monthlyBudgetUSD ?? DEFAULT_MONTHLY_BUDGET;

    /** @type {Record<string, number>} */
    this._providerCaps = { ...DEFAULT_PROVIDER_CAPS, ...(config.perProviderDailyCaps ?? {}) };

    /** @type {boolean} */
    this._verbose = config.verbose ?? false;

    /**
     * Spend events: [{ ts, provider, model, tokens, costUSD, taskType }]
     * @type {Array<SpendEvent>}
     */
    this._events = [];

    /**
     * Rolling daily totals: dateKey → total USD
     * Bounded to HISTORY_WINDOW days.
     * @type {Map<string, number>}
     */
    this._dailyTotals = new Map();

    /**
     * Per-provider daily spend: 'YYYY-MM-DD:provider' → USD
     * @type {Map<string, number>}
     */
    this._providerDailySpend = new Map();

    /**
     * Per-task-type daily spend: 'YYYY-MM-DD:taskType' → USD
     * @type {Map<string, number>}
     */
    this._taskTypeSpend = new Map();

    this._log('BudgetTracker initialised', {
      daily:   this._dailyBudget,
      monthly: this._monthlyBudget,
      alertThresholds: ALERT_THRESHOLDS,
      historyWindow: HISTORY_WINDOW,
    });
  }

  // ─── Recording ───────────────────────────────────────────────────────────

  /**
   * Record a spend event from an AI provider call.
   *
   * @param {string} provider     - e.g. 'anthropic', 'openai'.
   * @param {string} model        - Model identifier.
   * @param {number} tokens       - Total tokens consumed (input + output).
   * @param {number} costUSD      - Actual cost charged (USD). Pass 0 to auto-estimate.
   * @param {string} [taskType='general'] - Task category (e.g. 'embedding', 'chat').
   * @returns {SpendEvent} The recorded event.
   */
  recordUsage(provider, model, tokens, costUSD, taskType = 'general') {
    const resolvedCost = costUSD > 0
      ? costUSD
      : this._estimateCost(model, tokens);

    /** @type {SpendEvent} */
    const event = {
      ts:        Date.now(),
      provider:  provider.toLowerCase(),
      model,
      tokens,
      costUSD:   resolvedCost,
      taskType,
    };

    this._events.push(event);

    // Update daily aggregates
    const dk  = utcDateKey(event.ts);
    const pdk = `${dk}:${event.provider}`;
    const tdk = `${dk}:${event.taskType}`;

    this._dailyTotals.set(dk, (this._dailyTotals.get(dk)      ?? 0) + resolvedCost);
    this._providerDailySpend.set(pdk, (this._providerDailySpend.get(pdk) ?? 0) + resolvedCost);
    this._taskTypeSpend.set(tdk, (this._taskTypeSpend.get(tdk) ?? 0) + resolvedCost);

    this._pruneHistory();
    this._log('Usage recorded', { provider, model, tokens, costUSD: resolvedCost, taskType });
    return event;
  }

  // ─── Spend Queries ────────────────────────────────────────────────────────

  /**
   * Get today's total spend in USD.
   * @returns {number}
   */
  getDailySpend() {
    return this._dailyTotals.get(utcDateKey()) ?? 0;
  }

  /**
   * Get the current month's total spend in USD.
   * @returns {number}
   */
  getMonthlySpend() {
    const month = utcMonthKey();
    let total = 0;
    for (const [key, amount] of this._dailyTotals.entries()) {
      if (key.startsWith(month)) total += amount;
    }
    return total;
  }

  /**
   * Get today's spend for a specific provider.
   * @param {string} provider
   * @returns {number}
   */
  getProviderSpend(provider) {
    const key = `${utcDateKey()}:${provider.toLowerCase()}`;
    return this._providerDailySpend.get(key) ?? 0;
  }

  /**
   * Get today's spend broken down by task type.
   * @returns {Record<string, number>}
   */
  getSpendByTaskType() {
    const prefix = utcDateKey();
    const result = {};
    for (const [key, amount] of this._taskTypeSpend.entries()) {
      if (key.startsWith(prefix)) {
        const taskType = key.slice(prefix.length + 1);
        result[taskType] = (result[taskType] ?? 0) + amount;
      }
    }
    return result;
  }

  // ─── Budget Enforcement ───────────────────────────────────────────────────

  /**
   * Check whether a proposed spend is allowed given current budget state.
   *
   * @param {string} provider
   * @param {number} estimatedCost - Estimated cost for the next call.
   * @returns {BudgetCheck}
   */
  checkBudget(provider, estimatedCost) {
    const providerLower  = provider.toLowerCase();
    const dailySpend     = this.getDailySpend();
    const providerSpend  = this.getProviderSpend(providerLower);
    const providerCap    = this._providerCaps[providerLower] ?? Infinity;
    const alertLevel     = this.getAlertLevel();

    // Daily total check
    if (dailySpend + estimatedCost > this._dailyBudget) {
      return {
        allowed:            false,
        reason:             `Daily budget of $${this._dailyBudget} would be exceeded`,
        suggestedAlternative: this._cheapestProvider(),
      };
    }

    // Provider cap check
    if (providerSpend + estimatedCost > providerCap) {
      return {
        allowed:            false,
        reason:             `${providerLower} daily cap of $${providerCap} would be exceeded`,
        suggestedAlternative: FALLBACK_CHAIN[providerLower] ?? this._cheapestProvider(),
      };
    }

    // Soft warning at EXCEEDED level
    if (alertLevel === 'EXCEEDED') {
      return {
        allowed:            true,
        reason:             `Budget at EXCEEDED threshold — consider downgrading`,
        suggestedAlternative: FALLBACK_CHAIN[providerLower] ?? providerLower,
      };
    }

    return { allowed: true, reason: 'Within budget', suggestedAlternative: null };
  }

  /**
   * Return the current alert level based on today's daily spend ratio.
   * Uses ALERT_THRESHOLDS derived from phi.
   *
   * @returns {'NOMINAL'|'WARNING'|'CAUTION'|'CRITICAL'|'EXCEEDED'}
   */
  getAlertLevel() {
    const ratio = this.getDailySpend() / this._dailyBudget;
    return resolveAlertLevel(ratio);
  }

  /**
   * Determine if a provider should be downgraded due to cap pressure.
   *
   * Downgrade is suggested when the provider's daily spend ratio exceeds
   * ALERT_THRESHOLDS.CAUTION (≈ 0.764).
   *
   * @param {string} provider
   * @returns {{ downgrade: boolean, reason: string, fallback: string | null }}
   */
  shouldDowngrade(provider) {
    const providerLower = provider.toLowerCase();
    const cap           = this._providerCaps[providerLower] ?? Infinity;
    const spend         = this.getProviderSpend(providerLower);
    const ratio         = cap > 0 ? spend / cap : 0;
    const alertLevel    = resolveAlertLevel(ratio);

    const downgrade = ratio >= ALERT_THRESHOLDS.caution; // 1 - PSI² ≈ 0.764
    return {
      downgrade,
      reason:   downgrade ? `${providerLower} at ${(ratio * 100).toFixed(1)}% of daily cap (${alertLevel})` : 'Within cap',
      fallback: downgrade ? (FALLBACK_CHAIN[providerLower] ?? null) : null,
    };
  }

  // ─── Reports ─────────────────────────────────────────────────────────────

  /**
   * Generate a cost-efficiency report across all providers with today's data.
   * Efficiency = value-delivered / cost (proxy: 1 / costPerToken).
   *
   * @returns {Array<ProviderEfficiencyEntry>}
   */
  getCostEfficiencyReport() {
    const report = [];

    for (const [provider, cap] of Object.entries(this._providerCaps)) {
      const spend     = this.getProviderSpend(provider);
      const events    = this._events.filter(e =>
        e.provider === provider && utcDateKey(e.ts) === utcDateKey(),
      );
      const totalTokens = events.reduce((s, e) => s + e.tokens, 0);
      const costPerToken = totalTokens > 0 ? spend / totalTokens : 0;
      const capUtilisation = cap > 0 ? spend / cap : 0;
      const alertLevel = resolveAlertLevel(capUtilisation);

      report.push({
        provider,
        spend,
        cap,
        capUtilisation,
        alertLevel,
        totalTokens,
        costPerToken,
        efficiency: costPerToken > 0 ? 1 / costPerToken : 0,
        callCount: events.length,
      });
    }

    // Sort by efficiency descending (most cost-effective first)
    return report.sort((a, b) => b.efficiency - a.efficiency);
  }

  /**
   * Reset daily counters — call at midnight UTC.
   * Preserves history window.
   * @returns {void}
   */
  resetDaily() {
    const today = utcDateKey();

    // Purge today's keys so they start fresh
    for (const key of [...this._providerDailySpend.keys()]) {
      if (key.startsWith(today)) this._providerDailySpend.delete(key);
    }
    for (const key of [...this._taskTypeSpend.keys()]) {
      if (key.startsWith(today)) this._taskTypeSpend.delete(key);
    }

    this._log('Daily reset complete', { date: today });
  }

  /**
   * Return the complete current budget state.
   * @returns {BudgetStatus}
   */
  getStatus() {
    const dailySpend   = this.getDailySpend();
    const monthlySpend = this.getMonthlySpend();

    return {
      daily: {
        spend:      dailySpend,
        budget:     this._dailyBudget,
        ratio:      dailySpend / this._dailyBudget,
        remaining:  Math.max(0, this._dailyBudget - dailySpend),
        alertLevel: this.getAlertLevel(),
      },
      monthly: {
        spend:     monthlySpend,
        budget:    this._monthlyBudget,
        ratio:     monthlySpend / this._monthlyBudget,
        remaining: Math.max(0, this._monthlyBudget - monthlySpend),
        alertLevel: resolveAlertLevel(monthlySpend / this._monthlyBudget),
      },
      providers: Object.fromEntries(
        Object.keys(this._providerCaps).map(p => [p, {
          spend:       this.getProviderSpend(p),
          cap:         this._providerCaps[p],
          utilisation: this.getProviderSpend(p) / this._providerCaps[p],
          downgrade:   this.shouldDowngrade(p),
        }]),
      ),
      spendByTaskType: this.getSpendByTaskType(),
      historyWindow:   HISTORY_WINDOW,
      alertThresholds: {
        warning:  ALERT_THRESHOLDS.warning,
        caution:  ALERT_THRESHOLDS.caution,
        critical: ALERT_THRESHOLDS.critical,
        exceeded: ALERT_THRESHOLDS.exceeded,
      },
      recentEvents: this._events.slice(-fib(8)),  // last fib(8)=21 events
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /**
   * Estimate cost for a model/token combination using known per-M-token rates.
   * Falls back to a conservative estimate if the model is unknown.
   * @private
   * @param {string} model
   * @param {number} tokens
   * @returns {number} USD
   */
  _estimateCost(model, tokens) {
    const perM = MODEL_COST_PER_M_TOKENS[model] ?? 5.00; // conservative unknown default
    return (tokens / 1_000_000) * perM;
  }

  /**
   * Prune daily total history to HISTORY_WINDOW (34) days.
   * @private
   */
  _pruneHistory() {
    if (this._dailyTotals.size <= HISTORY_WINDOW) return;
    const keys = [...this._dailyTotals.keys()].sort();
    while (keys.length > HISTORY_WINDOW) {
      this._dailyTotals.delete(keys.shift());
    }
  }

  /**
   * Return the provider with the lowest daily cap utilisation.
   * @private
   * @returns {string}
   */
  _cheapestProvider() {
    let lowestRatio = Infinity;
    let best        = 'groq';

    for (const [provider, cap] of Object.entries(this._providerCaps)) {
      const ratio = this.getProviderSpend(provider) / cap;
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        best        = provider;
      }
    }
    return best;
  }

  /**
   * Conditional verbose logger.
   * @private
   */
  _log(msg, meta = {}) {
    if (this._verbose) {
      console.log(`[BudgetTracker] ${msg}`, meta);
    }
  }
}

// ─── JSDoc Type Definitions ───────────────────────────────────────────────────

/**
 * @typedef {object} SpendEvent
 * @property {number} ts        - Unix timestamp (ms).
 * @property {string} provider
 * @property {string} model
 * @property {number} tokens
 * @property {number} costUSD
 * @property {string} taskType
 */

/**
 * @typedef {object} BudgetCheck
 * @property {boolean}      allowed
 * @property {string}       reason
 * @property {string|null}  suggestedAlternative
 */

/**
 * @typedef {object} ProviderEfficiencyEntry
 * @property {string} provider
 * @property {number} spend
 * @property {number} cap
 * @property {number} capUtilisation
 * @property {string} alertLevel
 * @property {number} totalTokens
 * @property {number} costPerToken
 * @property {number} efficiency
 * @property {number} callCount
 */

/**
 * @typedef {object} BudgetStatus
 * @property {object} daily
 * @property {object} monthly
 * @property {object} providers
 * @property {object} spendByTaskType
 * @property {number} historyWindow
 * @property {object} alertThresholds
 * @property {SpendEvent[]} recentEvents
 */

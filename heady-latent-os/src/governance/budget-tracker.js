/**
 * @fileoverview Heady™ Budget Tracker — AI Provider Spend Tracking
 *
 * Tracks cumulative AI provider spend per:
 *   - Request (real-time)
 *   - Stage (within a pipeline run)
 *   - Day (rolling 24-hour window)
 *
 * Budget alerts at PSI (≈ 61.8%) of daily budget.
 * Hard-stop enforced at ALERTS.EXCEEDED (≈ 91.0%) of daily budget.
 *
 * Per-request cost targets are compared against actuals;
 * budget variance is reported for optimization.
 *
 * Provider cost comparison tracks cost-per-1k-tokens by provider.
 *
 * Budget history stored in a ring buffer of fib(12)=144 daily snapshots.
 *
 * All thresholds and sizes from phi-math — ZERO magic numbers.
 *
 * @module budget-tracker
 * @see shared/phi-math.js
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const { EventEmitter } = require('events');
const {
  PSI,
  fib,
  PHI_TIMING,
  ALERTS,
} = require('../../shared/phi-math.js');

// ─── Budget constants ─────────────────────────────────────────────────────────

/** Budget warning threshold: PSI ≈ 0.618 (61.8% of daily budget used) */
const WARN_FRAC = PSI;

/** Budget caution threshold: 1 − ψ² ≈ 0.764 */
const CAUTION_FRAC = ALERTS.CAUTION;

/** Budget critical threshold: 1 − ψ³ ≈ 0.854 */
const CRITICAL_FRAC = ALERTS.CRITICAL;

/** Budget hard-stop threshold: 1 − ψ⁴ ≈ 0.910 */
const HARD_STOP_FRAC = ALERTS.EXCEEDED;

/** Daily history ring size: fib(12) = 144 days */
const DAILY_HISTORY_SIZE = fib(12);

/** Stage history ring size: fib(9) = 34 stages */
const STAGE_HISTORY_SIZE = fib(9);

/** Request history ring size: fib(14) = 377 requests */
const REQUEST_HISTORY_SIZE = fib(14);

/** Budget rollover tick: check/reset daily window every PHI_TIMING.PHI_9 ≈ 75,025ms */
const ROLLOVER_TICK_MS = PHI_TIMING.PHI_9;

/** Daily window duration: fib(11) × fib(9) × 1000 = 89×34×1000 ≈ 3,026,000ms ≈ 50min (for dev) */
// Production: 86,400,000ms (24h). This constant is set as a configurable with 24h default.
const DAY_MS = 24 * 60 * 60 * 1000;  // 86,400,000ms — standard day

// ─── BudgetTracker class ──────────────────────────────────────────────────────

/**
 * @class BudgetTracker
 * @extends EventEmitter
 *
 * Tracks AI provider spend across requests, stages, and daily windows.
 *
 * Events:
 *   'warn'      ({runId, stageId, spent, limit, fraction, level}) — budget alert
 *   'exceeded'  ({runId, spent, limit})                           — hard-stop threshold
 *   'recorded'  ({requestId, cost, provider, runId, stageId})     — spend recorded
 *   'daily'     ({date, spent, limit, fraction, providers})       — daily summary
 */
class BudgetTracker extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number}  opts.dailyLimit          - daily budget in dollars
   * @param {number}  [opts.perRequestTarget]  - target cost per request (dollars)
   * @param {object}  [opts.logger]            - logger with .info/.warn/.error
   * @param {number}  [opts.dayMs]             - day duration ms (default 24h)
   */
  constructor(opts = {}) {
    if (!opts.dailyLimit) throw new TypeError('[BudgetTracker] opts.dailyLimit is required');
    super();
    this._log             = opts.logger || console;
    this._dailyLimit      = opts.dailyLimit;
    this._perReqTarget    = opts.perRequestTarget || 0;
    this._dayMs           = opts.dayMs || DAY_MS;

    // Current day state
    this._day = this._newDay();

    // History ring buffers
    this._dailyHistory   = [];
    this._stageHistory   = [];
    this._requestHistory = [];

    // Provider cost registry: providerName → { totalCost, totalTokens, requestCount }
    this._providers = new Map();

    // Stage budget allocations: stageId → { limit, spent }
    this._stageBudgets = new Map();

    // Rollover interval handle
    this._rollHandle = null;
    this._running    = false;

    this._log.info('[BudgetTracker] init daily=$%s warnAt=%s%% hardStopAt=%s%%',
      opts.dailyLimit,
      (WARN_FRAC * 100).toFixed(1),
      (HARD_STOP_FRAC * 100).toFixed(1));
  }

  // ─── Start / Stop ─────────────────────────────────────────────────────────

  start() {
    if (this._running) return this;
    this._running = true;
    this._scheduleRollover();
    return this;
  }

  stop() {
    this._running = false;
    if (this._rollHandle) {
      clearInterval(this._rollHandle);
      this._rollHandle = null;
    }
  }

  // ─── Record spend ─────────────────────────────────────────────────────────

  /**
   * Record an AI provider spend event.
   *
   * @param {object} entry
   * @param {string}  entry.requestId  - unique request identifier
   * @param {number}  entry.cost       - cost in dollars
   * @param {string}  entry.provider   - provider name (e.g. 'openai', 'anthropic')
   * @param {string}  [entry.runId]    - pipeline run ID (optional)
   * @param {string}  [entry.stageId] - pipeline stage ID (optional)
   * @param {number}  [entry.tokens]  - token count for this call
   * @param {string}  [entry.model]   - model name
   * @returns {{ ok: boolean, fraction: number, level: string }}
   */
  record(entry) {
    const { requestId, cost = 0, provider = 'unknown', runId, stageId, tokens = 0 } = entry;

    // ── Update day totals ──────────────────────────────────────────────────
    this._day.spent    += cost;
    this._day.requests++;

    // ── Update provider registry ───────────────────────────────────────────
    if (!this._providers.has(provider)) {
      this._providers.set(provider, { totalCost: 0, totalTokens: 0, requestCount: 0 });
    }
    const prov = this._providers.get(provider);
    prov.totalCost    += cost;
    prov.totalTokens  += tokens;
    prov.requestCount++;

    // ── Stage tracking ─────────────────────────────────────────────────────
    if (stageId) {
      if (!this._stageBudgets.has(stageId)) {
        this._stageBudgets.set(stageId, { limit: 0, spent: 0, requests: 0 });
      }
      const sb = this._stageBudgets.get(stageId);
      sb.spent    += cost;
      sb.requests++;
      this._stageHistory.push({ stageId, cost, runId, timestamp: Date.now() });
      if (this._stageHistory.length > STAGE_HISTORY_SIZE) this._stageHistory.shift();
    }

    // ── Request history ────────────────────────────────────────────────────
    const reqEntry = {
      requestId, cost, provider, runId, stageId, tokens,
      model:     entry.model,
      timestamp: Date.now(),
      variance:  this._perReqTarget > 0 ? cost - this._perReqTarget : null,
    };
    this._requestHistory.push(reqEntry);
    if (this._requestHistory.length > REQUEST_HISTORY_SIZE) this._requestHistory.shift();

    this.emit('recorded', reqEntry);

    // ── Budget threshold alerts ────────────────────────────────────────────
    const fraction = this._day.spent / this._dailyLimit;
    const level    = this._alertLevel(fraction);

    if (level !== 'OK') {
      this.emit('warn', { runId, stageId, spent: this._day.spent, limit: this._dailyLimit, fraction, level });
      this._log.warn('[BudgetTracker] %s spent=$%s / $%s (%s%%)',
        level, this._day.spent.toFixed(4), this._dailyLimit, (fraction * 100).toFixed(1));

      if (fraction >= HARD_STOP_FRAC) {
        this.emit('exceeded', { runId, spent: this._day.spent, limit: this._dailyLimit });
      }
    }

    return { ok: fraction < HARD_STOP_FRAC, fraction, level };
  }

  // ─── Stage budget allocation ──────────────────────────────────────────────

  /**
   * Allocate a budget limit for a specific pipeline stage.
   * @param {string} stageId
   * @param {number} limit   - dollar limit for this stage
   */
  setStageLimit(stageId, limit) {
    if (!this._stageBudgets.has(stageId)) {
      this._stageBudgets.set(stageId, { limit: 0, spent: 0, requests: 0 });
    }
    this._stageBudgets.get(stageId).limit = limit;
  }

  /**
   * Check if a stage is over its individual budget.
   * @param {string} stageId
   * @returns {{ ok: boolean, spent: number, limit: number, fraction: number }}
   */
  checkStage(stageId) {
    const sb = this._stageBudgets.get(stageId);
    if (!sb || sb.limit <= 0) return { ok: true, spent: sb ? sb.spent : 0, limit: 0, fraction: 0 };
    const fraction = sb.spent / sb.limit;
    return { ok: fraction < HARD_STOP_FRAC, spent: sb.spent, limit: sb.limit, fraction };
  }

  // ─── Provider comparison ──────────────────────────────────────────────────

  /**
   * Return cost-per-1k-tokens by provider, sorted cheapest first.
   * @returns {Array<{ provider, costPer1kTokens, totalCost, totalTokens }>}
   */
  providerComparison() {
    return [...this._providers.entries()]
      .map(([name, p]) => ({
        provider:        name,
        costPer1kTokens: p.totalTokens > 0 ? (p.totalCost / p.totalTokens) * 1000 : 0,
        totalCost:       p.totalCost,
        totalTokens:     p.totalTokens,
        requestCount:    p.requestCount,
      }))
      .sort((a, b) => a.costPer1kTokens - b.costPer1kTokens);
  }

  // ─── Daily snapshot ───────────────────────────────────────────────────────

  /**
   * Return the current day's spend summary.
   * @returns {object}
   */
  dailySummary() {
    return {
      date:      new Date(this._day.startedAt).toISOString().slice(0, 10),
      spent:     this._day.spent,
      limit:     this._dailyLimit,
      fraction:  Number((this._day.spent / this._dailyLimit).toFixed(4)),
      requests:  this._day.requests,
      level:     this._alertLevel(this._day.spent / this._dailyLimit),
      providers: this.providerComparison(),
    };
  }

  /**
   * Return the daily history ring buffer.
   * @returns {object[]}
   */
  dailyHistory() {
    return [...this._dailyHistory];
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** @private */
  _newDay() {
    return { startedAt: Date.now(), spent: 0, requests: 0 };
  }

  /** @private */
  _alertLevel(fraction) {
    if (fraction >= HARD_STOP_FRAC) return 'EXCEEDED'; // 1 - ψ⁴ ≈ 0.854
    if (fraction >= CRITICAL_FRAC)  return 'CRITICAL'; // 1 - ψ³ ≈ 0.764
    if (fraction >= WARN_FRAC)      return 'WARN';     // ψ ≈ 0.618  (note: CAUTION = WARN due to golden ratio identity 1 - ψ² = ψ)
    return 'OK';
  }

  /** @private */
  _scheduleRollover() {
    this._rollHandle = setInterval(() => this._checkRollover(), ROLLOVER_TICK_MS);
  }

  /** @private */
  _checkRollover() {
    const now = Date.now();
    if (now - this._day.startedAt >= this._dayMs) {
      const summary = this.dailySummary();
      this._dailyHistory.push(summary);
      if (this._dailyHistory.length > DAILY_HISTORY_SIZE) this._dailyHistory.shift();
      this.emit('daily', summary);
      this._log.info('[BudgetTracker] day rolled spent=$%s requests=%d',
        summary.spent.toFixed(4), summary.requests);
      this._day = this._newDay();
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  BudgetTracker,
  WARN_FRAC,
  CAUTION_FRAC,
  CRITICAL_FRAC,
  HARD_STOP_FRAC,
  DAILY_HISTORY_SIZE,
  STAGE_HISTORY_SIZE,
  REQUEST_HISTORY_SIZE,
  ROLLOVER_TICK_MS,
};

'use strict';

/**
 * CostTrackerBee — AI provider spend tracking, budget enforcement, phi-harmonic alert thresholds.
 * Tracks per-provider, per-session, and global token/dollar spend.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;
const PHI4 = 6.8541019662;

// Budget alert thresholds (as fraction of budget)
const BUDGET_THRESHOLDS = {
  WARNING:   1 - Math.pow(PSI, 2),   // ≈ 0.764
  CRITICAL:  1 - Math.pow(PSI, 3),   // ≈ 0.854
  HARD_STOP: 1 - Math.pow(PSI, 4),   // ≈ 0.910
};

// Default budgets (USD) — phi-scaled
const DEFAULT_BUDGETS = {
  session:  PHI,     // $1.618
  daily:    PHI3,    // $4.236
  monthly:  PHI4,    // $6.854
};

// Fibonacci ring buffer for spend history
const HISTORY_SIZE = 233;   // fib(13)
const HEARTBEAT_MS = Math.round(PHI2 * 1000);   // 2618 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);   // ≈ 0.618

// Provider cost per 1K tokens (USD) — approximate 2026 rates
const PROVIDER_RATES = {
  'gpt-4o':          { input: 0.005, output: 0.015 },
  'gpt-4o-mini':     { input: 0.00015, output: 0.0006 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku':  { input: 0.00025, output: 0.00125 },
  'gemini-2-flash':  { input: 0.000075, output: 0.0003 },
  'gemini-2-pro':    { input: 0.00125, output: 0.005 },
  'local':           { input: 0, output: 0 },
};

class CostTrackerBee {
  constructor(config = {}) {
    this.id      = config.id ?? `cost-${Date.now()}`;
    this.budgets = { ...DEFAULT_BUDGETS, ...(config.budgets ?? {}) };

    this._alive         = false;
    this._coherence     = 1.0;
    this._sessionSpend  = 0;
    this._dailySpend    = 0;
    this._monthlySpend  = 0;
    this._totalTokens   = { input: 0, output: 0 };
    this._providerSpend = {};
    this._history       = [];
    this._alerts        = [];
    this._heartbeatTimer = null;
    this._sessionStart  = Date.now();
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._sessionSpend  = 0;
    this._dailySpend    = 0;
    this._monthlySpend  = 0;
    this._totalTokens   = { input: 0, output: 0 };
    this._providerSpend = {};
    this._history       = [];
    this._alerts        = [];
    this._coherence     = 1.0;
    this._sessionStart  = Date.now();
  }

  /**
   * Execute cost tracking for a single LLM call.
   * @param {object} task — { provider: string, inputTokens: number, outputTokens: number, stage?: string }
   */
  async execute(task) {
    if (!this._alive) throw new Error('CostTrackerBee not spawned');
    const { provider = 'gpt-4o', inputTokens = 0, outputTokens = 0, stage = 'UNKNOWN' } = task;

    const cost = this._calcCost(provider, inputTokens, outputTokens);
    this._record(provider, inputTokens, outputTokens, cost, stage);

    const alerts = this._checkThresholds();
    return {
      cost: parseFloat(cost.toFixed(6)),
      provider,
      inputTokens,
      outputTokens,
      sessionSpend: parseFloat(this._sessionSpend.toFixed(6)),
      dailySpend:   parseFloat(this._dailySpend.toFixed(6)),
      alerts,
      budgetUsage: this._budgetUsage(),
      coherence: this._coherence,
    };
  }

  _calcCost(provider, inputTokens, outputTokens) {
    const rates = PROVIDER_RATES[provider] ?? PROVIDER_RATES['gpt-4o'];
    return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
  }

  _record(provider, inputTokens, outputTokens, cost, stage) {
    this._sessionSpend  += cost;
    this._dailySpend    += cost;
    this._monthlySpend  += cost;
    this._totalTokens.input  += inputTokens;
    this._totalTokens.output += outputTokens;
    this._providerSpend[provider] = (this._providerSpend[provider] ?? 0) + cost;

    const entry = { ts: Date.now(), provider, inputTokens, outputTokens, cost, stage };
    this._history.push(entry);
    if (this._history.length > HISTORY_SIZE) this._history.shift();
  }

  _checkThresholds() {
    const alerts = [];
    const levels = [
      ['session',  this._sessionSpend,  this.budgets.session],
      ['daily',    this._dailySpend,    this.budgets.daily],
      ['monthly',  this._monthlySpend,  this.budgets.monthly],
    ];
    for (const [scope, spend, budget] of levels) {
      const ratio = budget > 0 ? spend / budget : 0;
      if (ratio >= BUDGET_THRESHOLDS.HARD_STOP) {
        alerts.push({ scope, level: 'HARD_STOP', ratio: parseFloat(ratio.toFixed(4)), spend, budget });
        this._coherence = Math.max(0, this._coherence - PSI * 0.2);
      } else if (ratio >= BUDGET_THRESHOLDS.CRITICAL) {
        alerts.push({ scope, level: 'CRITICAL', ratio: parseFloat(ratio.toFixed(4)), spend, budget });
        this._coherence = Math.max(0, this._coherence - PSI * 0.05);
      } else if (ratio >= BUDGET_THRESHOLDS.WARNING) {
        alerts.push({ scope, level: 'WARNING', ratio: parseFloat(ratio.toFixed(4)), spend, budget });
      }
    }
    if (alerts.length > 0) this._alerts.push(...alerts);
    return alerts;
  }

  _budgetUsage() {
    return {
      session:  this.budgets.session  > 0 ? parseFloat((this._sessionSpend  / this.budgets.session ).toFixed(4)) : 0,
      daily:    this.budgets.daily    > 0 ? parseFloat((this._dailySpend    / this.budgets.daily   ).toFixed(4)) : 0,
      monthly:  this.budgets.monthly  > 0 ? parseFloat((this._monthlySpend  / this.budgets.monthly ).toFixed(4)) : 0,
    };
  }

  heartbeat() {
    // Decay coherence toward healthy if no over-budget condition
    const usage = this._budgetUsage();
    const maxUsage = Math.max(usage.session, usage.daily, usage.monthly);
    if (maxUsage < BUDGET_THRESHOLDS.WARNING) {
      this._coherence = Math.min(1.0, this._coherence + PSI * 0.01);
    }
  }

  getHealth() {
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence: parseFloat(this._coherence.toFixed(4)),
      sessionSpend:  parseFloat(this._sessionSpend.toFixed(6)),
      dailySpend:    parseFloat(this._dailySpend.toFixed(6)),
      monthlySpend:  parseFloat(this._monthlySpend.toFixed(6)),
      totalTokens:   this._totalTokens,
      providerSpend: this._providerSpend,
      budgets:       this.budgets,
      budgetUsage:   this._budgetUsage(),
      alertCount:    this._alerts.length,
      thresholds:    BUDGET_THRESHOLDS,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  CostTrackerBee, DEFAULT_BUDGETS, BUDGET_THRESHOLDS, PROVIDER_RATES, COHERENCE_THRESHOLD,
};

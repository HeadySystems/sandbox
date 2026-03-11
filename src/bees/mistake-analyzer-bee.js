'use strict';

/**
 * MistakeAnalyzerBee — Root cause analysis, 5-whys traversal, prevention rule generation.
 * Stores fingerprinted mistake patterns to prevent regression.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

const MAX_WHYS         = 5;     // fib(5) — 5-whys root cause depth
const RULE_STORE_MAX   = 233;   // fib(13) — prevention rules store
const MISTAKE_LOG_MAX  = 144;   // fib(12)
const PATTERN_CACHE    = 89;    // fib(11)
const HEARTBEAT_MS     = Math.round(PHI3 * 1000);   // 4236 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);   // ≈ 0.618

// Phi-weighted severity scores (fib relative)
const SEVERITY_SCORES = { CRITICAL: 13, HIGH: 8, MEDIUM: 5, LOW: 3, TRIVIAL: 2 };
const MAX_SEVERITY = 13;

class MistakeAnalyzerBee {
  constructor(config = {}) {
    this.id   = config.id ?? `mistake-${Date.now()}`;

    this._alive          = false;
    this._coherence      = 1.0;
    this._mistakeLog     = [];
    this._ruleStore      = [];
    this._patternCache   = new Map();
    this._analysisCount  = 0;
    this._regressionHits = 0;
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._mistakeLog     = [];
    this._ruleStore      = [];
    this._patternCache   = new Map();
    this._analysisCount  = 0;
    this._regressionHits = 0;
    this._coherence      = 1.0;
  }

  /**
   * Execute mistake analysis.
   * @param {object} task — {
   *   mistake: string,        — description of what went wrong
   *   context: object,        — surrounding context (stage, input, output)
   *   severity?: string,      — CRITICAL|HIGH|MEDIUM|LOW|TRIVIAL
   *   category?: string       — optional error category
   * }
   */
  async execute(task) {
    if (!this._alive) throw new Error('MistakeAnalyzerBee not spawned');
    const { mistake = '', context = {}, severity = 'MEDIUM', category = 'UNKNOWN' } = task;

    this._analysisCount++;

    // Fingerprint check — detect regression
    const fingerprint = this._fingerprint(mistake, category);
    const isRegression = this._patternCache.has(fingerprint);
    if (isRegression) this._regressionHits++;

    // 5-whys analysis
    const whys = this._fiveWhys(mistake, context, category);

    // Root cause classification
    const rootCause = whys[whys.length - 1];

    // Generate prevention rules
    const rules = this._generateRules(whys, rootCause, severity, category);

    // Store rules
    for (const rule of rules) {
      this._ruleStore.push({ ...rule, ts: Date.now() });
      if (this._ruleStore.length > RULE_STORE_MAX) this._ruleStore.shift();
    }

    // Cache pattern
    this._patternCache.set(fingerprint, { count: (this._patternCache.get(fingerprint)?.count ?? 0) + 1, lastSeen: Date.now() });
    if (this._patternCache.size > PATTERN_CACHE) {
      // Evict least-seen pattern
      const leastSeen = [...this._patternCache.entries()].sort((a, b) => a[1].count - b[1].count)[0];
      this._patternCache.delete(leastSeen[0]);
    }

    const record = { fingerprint, mistake, severity, category, whys, rootCause, rules, isRegression, ts: Date.now() };
    this._mistakeLog.push(record);
    if (this._mistakeLog.length > MISTAKE_LOG_MAX) this._mistakeLog.shift();

    this._updateCoherence();
    return { ...record, coherence: this._coherence };
  }

  _fiveWhys(mistake, context, category) {
    // Structured template-based 5-whys (real LLM call would replace this in production)
    const templates = [
      `Why did "${mistake.slice(0, 80)}" occur?`,
      `Why was the precondition for this not validated in stage ${context.stage ?? 'UNKNOWN'}?`,
      `Why did the input/output contract allow this failure mode for category "${category}"?`,
      `Why was there no circuit breaker or retry policy to catch this class of error?`,
      `Root cause: Insufficient phi-harmonic coherence gate at stage boundary, allowing sub-${(PSI).toFixed(3)} confidence through.`,
    ];
    return templates.slice(0, MAX_WHYS);
  }

  _generateRules(whys, rootCause, severity, category) {
    const sevScore = SEVERITY_SCORES[severity] ?? 5;
    const priority = parseFloat((sevScore / MAX_SEVERITY * PHI).toFixed(4));

    return [
      {
        id: `rule-${Date.now()}-A`,
        category,
        severity,
        priority,
        rule: `Before executing stage with category "${category}", validate coherence ≥ ${PSI.toFixed(3)}.`,
        source: 'why-1',
      },
      {
        id: `rule-${Date.now()}-B`,
        category,
        severity,
        priority: parseFloat((priority * PSI).toFixed(4)),
        rule: `Implement input validation for "${category}" errors with fib(5)=5 retry ceiling.`,
        source: 'why-3',
      },
      {
        id: `rule-${Date.now()}-C`,
        category,
        severity,
        priority: parseFloat((priority * Math.pow(PSI, 2)).toFixed(4)),
        rule: `Add circuit breaker: after fib(5)=5 failures in category "${category}", open circuit for ${Math.round(PHI2 * 1000)}ms.`,
        source: 'root-cause',
      },
    ];
  }

  _fingerprint(mistake, category) {
    // Simple hash: first 55 chars normalized + category
    const normalized = mistake.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 55);
    return `${category}::${normalized}`;
  }

  _updateCoherence() {
    const regressionRate = this._analysisCount > 0
      ? this._regressionHits / this._analysisCount : 0;
    this._coherence = Math.max(0, 1.0 - regressionRate * PHI2);
  }

  heartbeat() { this._updateCoherence(); }

  getHealth() {
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence:      parseFloat(this._coherence.toFixed(4)),
      analysisCount:  this._analysisCount,
      regressionHits: this._regressionHits,
      ruleCount:      this._ruleStore.length,
      patternCount:   this._patternCache.size,
      mistakeLogDepth: this._mistakeLog.length,
      severityScores: SEVERITY_SCORES,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  MistakeAnalyzerBee, MAX_WHYS, RULE_STORE_MAX, SEVERITY_SCORES, COHERENCE_THRESHOLD,
};

'use strict';

/**
 * JudgeBee — Quantitative multi-dimensional scoring with phi-harmonic gate.
 * Dimensions: correctness 34%, safety 21%, performance 21%, quality 13%, elegance 11%.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

// Scoring dimension weights (from pipeline spec — sum = 1.00)
const DIMENSION_WEIGHTS = {
  correctness: 0.34,
  safety:      0.21,
  performance: 0.21,
  quality:     0.13,
  elegance:    0.11,
};

// CSL gate thresholds
const GATE_PASS     = PSI;                       // ≈ 0.618 — minimum pass score
const GATE_GOOD     = 1 - Math.pow(PSI, 3);     // ≈ 0.854
const GATE_GREAT    = 1 - Math.pow(PSI, 4);     // ≈ 0.910
const SAFETY_FLOOR  = 1 - Math.pow(PSI, 3);     // safety must be ≥ 0.854 to pass gate

const HISTORY_MAX   = 144;   // fib(12)
const HEARTBEAT_MS  = Math.round(PHI2 * 1000);  // 2618 ms
const COHERENCE_THRESHOLD = GATE_PASS;

class JudgeBee {
  constructor(config = {}) {
    this.id      = config.id ?? `judge-${Date.now()}`;
    this.weights = { ...DIMENSION_WEIGHTS, ...(config.weights ?? {}) };

    this._alive       = false;
    this._coherence   = 1.0;
    this._history     = [];
    this._passCount   = 0;
    this._failCount   = 0;
    this._safetyBlocks = 0;
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._history      = [];
    this._passCount    = 0;
    this._failCount    = 0;
    this._safetyBlocks = 0;
    this._coherence    = 1.0;
  }

  /**
   * Execute a judgment.
   * @param {object} task — {
   *   candidate: any,
   *   scores: { correctness, safety, performance, quality, elegance } (each 0-1),
   *   rubric?: object,
   *   label?: string
   * }
   */
  async execute(task) {
    if (!this._alive) throw new Error('JudgeBee not spawned');
    const { scores = {}, label = 'candidate', rubric } = task;

    // Validate and fill missing dimensions
    const normalized = this._normalizeScores(scores);

    // Safety hard-check — safety must clear SAFETY_FLOOR
    if (normalized.safety < SAFETY_FLOOR) {
      this._safetyBlocks++;
      const record = {
        label, normalized, compositeScore: normalized.safety,
        verdict: 'BLOCKED_UNSAFE', rationale: `Safety score ${normalized.safety.toFixed(3)} < floor ${SAFETY_FLOOR.toFixed(3)}`,
        ts: Date.now(),
      };
      this._pushHistory(record);
      return { ...record, passed: false, coherence: this._coherence };
    }

    // Weighted composite score
    const composite = this._computeComposite(normalized);
    const verdict    = this._classifyVerdict(composite);
    const passed     = verdict !== 'FAIL';
    const rationale  = this._buildRationale(normalized, composite, verdict, rubric);

    if (passed) this._passCount++;
    else        this._failCount++;

    const record = {
      label,
      dimensionScores: normalized,
      compositeScore: parseFloat(composite.toFixed(4)),
      verdict,
      passed,
      rationale,
      weights: this.weights,
      ts: Date.now(),
    };
    this._pushHistory(record);
    this._updateCoherence();

    return { ...record, coherence: this._coherence };
  }

  _normalizeScores(raw) {
    const dims = Object.keys(DIMENSION_WEIGHTS);
    const out  = {};
    for (const d of dims) {
      const v = typeof raw[d] === 'number' ? raw[d] : GATE_PASS;
      out[d] = Math.min(1.0, Math.max(0, v));
    }
    return out;
  }

  _computeComposite(scores) {
    let total = 0;
    for (const [dim, w] of Object.entries(this.weights)) {
      total += (scores[dim] ?? 0) * w;
    }
    return total;
  }

  _classifyVerdict(score) {
    if (score < GATE_PASS)  return 'FAIL';
    if (score < GATE_GOOD)  return 'PASS';
    if (score < GATE_GREAT) return 'GOOD';
    return 'EXCELLENT';
  }

  _buildRationale(scores, composite, verdict, rubric) {
    const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0];
    const strongest = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    let r = `Composite: ${composite.toFixed(3)} (${verdict}). `;
    r += `Strongest: ${strongest[0]}=${strongest[1].toFixed(3)}. `;
    r += `Weakest: ${weakest[0]}=${weakest[1].toFixed(3)}.`;
    if (rubric && rubric.notes) r += ` Rubric note: ${rubric.notes}`;
    return r;
  }

  _updateCoherence() {
    const total = this._passCount + this._failCount + this._safetyBlocks;
    this._coherence = total > 0
      ? Math.min(1.0, this._passCount / total * PHI)
      : 1.0;
  }

  _pushHistory(record) {
    this._history.push(record);
    if (this._history.length > HISTORY_MAX) this._history.shift();
  }

  heartbeat() { this._updateCoherence(); }

  getHealth() {
    const total = this._passCount + this._failCount + this._safetyBlocks;
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence:    parseFloat(this._coherence.toFixed(4)),
      passCount:    this._passCount,
      failCount:    this._failCount,
      safetyBlocks: this._safetyBlocks,
      passRate:     total > 0 ? parseFloat((this._passCount / total).toFixed(4)) : null,
      historyDepth: this._history.length,
      weights:      this.weights,
      thresholds:   { GATE_PASS, GATE_GOOD, GATE_GREAT, SAFETY_FLOOR },
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  JudgeBee, DIMENSION_WEIGHTS, GATE_PASS, GATE_GOOD, GATE_GREAT, SAFETY_FLOOR, COHERENCE_THRESHOLD,
};

'use strict';

/**
 * DriftMonitorBee — Semantic drift detection via embedding cosine comparison.
 * Uses phi-harmonic drift thresholds and Fibonacci sliding windows.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

// Drift severity thresholds (cosine similarity distance from baseline)
const DRIFT_THRESHOLDS = {
  WATCH:    1 - (1 - Math.pow(PSI, 2)),  // ≈ 0.382  — mild drift
  ALERT:    1 - (1 - Math.pow(PSI, 1)),  // ≈ 0.618  — moderate drift
  CRITICAL: 1 - (1 - Math.pow(PSI, 0)),  // ≈ 1.000  (use as max, normalize)
};
// Simpler: use absolute cosine drop thresholds
const COS_DRIFT_WATCH    = 1 - Math.pow(PSI, 2);   // ≈ 0.618  similarity floor (WATCH below this)
const COS_DRIFT_ALERT    = 1 - Math.pow(PSI, 3);   // ≈ 0.854  (ALERT below this)
const COS_DRIFT_CRITICAL = 1 - Math.pow(PSI, 4);   // ≈ 0.910  (CRITICAL above this)

const WINDOW_SIZE     = 34;    // fib(9) — sliding similarity window
const HISTORY_MAX     = 233;   // fib(13)
const HEARTBEAT_MS    = Math.round(PHI3 * 1000);   // 4236 ms
const COHERENCE_THRESHOLD = COS_DRIFT_WATCH;       // ≈ 0.618

class DriftMonitorBee {
  constructor(config = {}) {
    this.id           = config.id ?? `drift-${Date.now()}`;
    this.windowSize   = config.windowSize ?? WINDOW_SIZE;
    this.embeddingDim = config.embeddingDim ?? 1536;

    this._alive       = false;
    this._coherence   = 1.0;
    this._baseline    = null;           // baseline embedding
    this._simWindow   = [];             // sliding cosine similarity history
    this._driftEvents = [];
    this._driftCount  = 0;
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._baseline    = null;
    this._simWindow   = [];
    this._driftEvents = [];
    this._driftCount  = 0;
    this._coherence   = 1.0;
  }

  /**
   * Execute drift detection.
   * @param {object} task — { embedding: number[], label?: string, setBaseline?: boolean }
   */
  async execute(task) {
    if (!this._alive) throw new Error('DriftMonitorBee not spawned');
    const { embedding, label = 'vec', setBaseline = false } = task;

    if (!embedding || embedding.length === 0) throw new Error('embedding required');

    if (setBaseline || !this._baseline) {
      this._baseline = embedding.slice();
      return { status: 'BASELINE_SET', label, dim: embedding.length };
    }

    const similarity = this._cosineSimilarity(this._baseline, embedding);
    const driftScore = 1 - similarity;   // 0 = no drift, 1 = max drift

    this._simWindow.push(similarity);
    if (this._simWindow.length > this.windowSize) this._simWindow.shift();

    const rollingMeanSim = this._simWindow.reduce((a, b) => a + b, 0) / this._simWindow.length;
    const severity = this._classifySeverity(similarity);

    if (severity !== 'NONE') {
      const event = { ts: Date.now(), label, similarity, driftScore, rollingMeanSim, severity };
      this._driftEvents.push(event);
      if (this._driftEvents.length > HISTORY_MAX) this._driftEvents.shift();
      this._driftCount++;
    }

    this._updateCoherence(rollingMeanSim);
    return {
      similarity:     parseFloat(similarity.toFixed(4)),
      driftScore:     parseFloat(driftScore.toFixed(4)),
      rollingMeanSim: parseFloat(rollingMeanSim.toFixed(4)),
      severity,
      driftCount:     this._driftCount,
      coherence:      this._coherence,
    };
  }

  _cosineSimilarity(a, b) {
    if (a.length !== b.length) throw new Error('Embedding dimension mismatch');
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  _classifySeverity(similarity) {
    if (similarity < 1 - COS_DRIFT_CRITICAL) return 'CRITICAL';  // similarity very low
    if (similarity < COS_DRIFT_ALERT)        return 'ALERT';
    if (similarity < COS_DRIFT_WATCH)        return 'WATCH';
    return 'NONE';
  }

  _updateCoherence(rollingMeanSim) {
    // Coherence tracks rolling mean similarity, rescaled by phi
    this._coherence = Math.min(1.0, Math.max(0, rollingMeanSim));
  }

  heartbeat() {
    if (this._simWindow.length === 0) return;
    const mean = this._simWindow.reduce((a, b) => a + b, 0) / this._simWindow.length;
    this._updateCoherence(mean);
  }

  /** Update baseline using exponential moving average (phi-weighted). */
  updateBaseline(newEmbedding) {
    if (!this._baseline) { this._baseline = newEmbedding.slice(); return; }
    const alpha = 1 - PSI;   // ≈ 0.382  — slow adaptation
    this._baseline = this._baseline.map((v, i) => v * (1 - alpha) + newEmbedding[i] * alpha);
  }

  getHealth() {
    const recent = this._driftEvents.slice(-8);   // fib(6)
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence:   parseFloat(this._coherence.toFixed(4)),
      hasBaseline: this._baseline !== null,
      windowSize:  this.windowSize,
      windowDepth: this._simWindow.length,
      rollingMean: this._simWindow.length
        ? parseFloat((this._simWindow.reduce((a,b) => a+b, 0) / this._simWindow.length).toFixed(4))
        : null,
      driftCount:  this._driftCount,
      recentDrift: recent,
      thresholds: { COS_DRIFT_WATCH, COS_DRIFT_ALERT, COS_DRIFT_CRITICAL },
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  DriftMonitorBee, COS_DRIFT_WATCH, COS_DRIFT_ALERT, COS_DRIFT_CRITICAL, COHERENCE_THRESHOLD,
};

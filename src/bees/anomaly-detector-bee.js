'use strict';

/**
 * AnomalyDetectorBee — Statistical anomaly detection using phi-harmonic thresholds.
 * Implements z-score + IQR detection with phi-scaled alert levels.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI4 = 6.8541019662;   // φ⁴

// Phi-harmonic anomaly severity thresholds (sigma multiples)
const SIGMA_THRESHOLDS = {
  WATCH:    PHI,     // ≈ 1.618σ — mild deviation
  ALERT:    PHI2,    // ≈ 2.618σ — moderate anomaly
  CRITICAL: PHI4,    // ≈ 6.854σ — severe anomaly
};

// Fibonacci window sizes for rolling statistics
const WINDOW_SHORT  = 21;    // fib(8)  — fast-reaction window
const WINDOW_MEDIUM = 89;    // fib(11) — standard detection window
const WINDOW_LONG   = 233;   // fib(13) — trend-drift window

const HEARTBEAT_MS        = Math.round(PHI2 * 1000);   // 2618 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);      // ≈ 0.618

class AnomalyDetectorBee {
  constructor(config = {}) {
    this.id          = config.id ?? `anomaly-${Date.now()}`;
    this.metric      = config.metric ?? 'default';
    this.windowSize  = config.windowSize ?? WINDOW_MEDIUM;

    this._alive      = false;
    this._coherence  = 1.0;
    this._buffer     = [];
    this._anomalies  = [];
    this._alertCount = 0;
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._buffer    = [];
    this._anomalies = [];
    this._alertCount = 0;
    this._coherence  = 1.0;
    this._stats = { mean: 0, stddev: 1, p25: 0, p75: 1, samples: 0 };
  }

  /**
   * Execute anomaly detection on a batch of observations.
   * @param {object} task — { values: number[], labels?: string[] }
   */
  async execute(task) {
    if (!this._alive) throw new Error('AnomalyDetectorBee not spawned');
    const { values = [], labels = [] } = task;
    const detected = [];

    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      this._ingest(v);
      const result = this._evaluate(v, labels[i] ?? `obs-${i}`);
      if (result.isAnomaly) {
        detected.push(result);
        this._anomalies.push(result);
        this._alertCount++;
      }
    }

    this._recalcCoherence();
    return {
      processed: values.length,
      anomalies: detected,
      stats: { ...this._stats },
      coherence: this._coherence,
    };
  }

  _ingest(value) {
    this._buffer.push(value);
    if (this._buffer.length > this.windowSize) this._buffer.shift();
    this._updateStats();
  }

  _updateStats() {
    const n = this._buffer.length;
    if (n < 2) return;
    const mean = this._buffer.reduce((a, b) => a + b, 0) / n;
    const variance = this._buffer.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const stddev = Math.sqrt(variance) || 1e-9;
    const sorted = [...this._buffer].sort((a, b) => a - b);
    const q1i = Math.floor(n * PSI * PSI);         // ≈ n × 0.382
    const q3i = Math.floor(n * (1 - PSI * PSI));   // ≈ n × 0.618
    this._stats = { mean, stddev, p25: sorted[q1i], p75: sorted[q3i], samples: n };
  }

  _evaluate(value, label) {
    const { mean, stddev, p25, p75 } = this._stats;
    const z = Math.abs((value - mean) / stddev);
    const iqr = (p75 - p25) || 1e-9;
    const iqrScore = Math.abs(value - mean) / (iqr * PHI);   // phi-scaled IQR distance

    const severity =
      z >= SIGMA_THRESHOLDS.CRITICAL ? 'CRITICAL' :
      z >= SIGMA_THRESHOLDS.ALERT    ? 'ALERT' :
      z >= SIGMA_THRESHOLDS.WATCH    ? 'WATCH' : null;

    return {
      label,
      value,
      zScore: parseFloat(z.toFixed(4)),
      iqrScore: parseFloat(iqrScore.toFixed(4)),
      isAnomaly: severity !== null,
      severity,
      mean: parseFloat(mean.toFixed(4)),
      stddev: parseFloat(stddev.toFixed(4)),
      ts: Date.now(),
    };
  }

  _recalcCoherence() {
    // Coherence degrades as anomaly rate rises; phi-harmonic dampening
    const rate = this._buffer.length > 0
      ? this._alertCount / (this._stats.samples || 1) : 0;
    this._coherence = Math.max(0, Math.min(1.0, 1.0 - rate * PHI2));
  }

  heartbeat() {
    this._updateStats();
    this._recalcCoherence();
    // Prune stale anomaly records beyond fib(13) = 233
    if (this._anomalies.length > WINDOW_LONG) {
      this._anomalies = this._anomalies.slice(-WINDOW_LONG);
    }
  }

  getHealth() {
    return {
      id: this.id,
      metric: this.metric,
      status: this._alive
        ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED')
        : 'OFFLINE',
      coherence: parseFloat(this._coherence.toFixed(4)),
      windowSize: this.windowSize,
      samples: this._stats.samples,
      alertCount: this._alertCount,
      recentAnomalies: this._anomalies.slice(-8),   // fib(6) = 8
      stats: { ...this._stats },
      sigmaThresholds: SIGMA_THRESHOLDS,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

module.exports = {
  AnomalyDetectorBee,
  SIGMA_THRESHOLDS,
  WINDOW_SHORT,
  WINDOW_MEDIUM,
  WINDOW_LONG,
  COHERENCE_THRESHOLD,
};

/**
 * @fileoverview Heady™ Drift Detector — Semantic Coherence Monitoring
 *
 * Monitors cosine similarity between incoming embeddings and a stable
 * baseline to detect semantic drift in live agent contexts or RAG pipelines.
 *
 * Alert levels (from phi-math CSL_THRESHOLDS):
 *   ALERT    — cosine < COHERENCE (≈ 0.809): moderate drift, warn
 *   CRITICAL — cosine < LOW       (≈ 0.691): severe drift, trigger healing
 *
 * Sliding window: fib(9) = 34 measurements.
 * Baseline can be set explicitly or inferred from the first N measurements.
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  fib,
  CSL_THRESHOLDS,
  cosineSimilarity,
  normalize,
  VECTOR,
  PSI,
  PHI,
} = require('../../shared/phi-math.js');

// ─── Drift thresholds (from phi-math) ────────────────────────────────────────

/** Sliding window depth: fib(9) = 34 measurements */
const WINDOW_SIZE = fib(9);

/** ALERT threshold: cosine < COHERENCE (≈ 0.809) → warn */
const DRIFT_ALERT_THRESHOLD = CSL_THRESHOLDS.COHERENCE;

/** CRITICAL threshold: cosine < LOW (≈ 0.691) → trigger self-healer */
const DRIFT_CRITICAL_THRESHOLD = CSL_THRESHOLDS.LOW;

/** Baseline warm-up period: fib(5) = 5 measurements before alerting */
const WARMUP_SAMPLES = fib(5);

/** Minimum cosine score to accept a measurement as valid: fib(3)/fib(10) ≈ 0.036 used as floor */
const MIN_VALID_COSINE = -1;  // full range, we just track whatever comes in

// ─── Drift level enum ─────────────────────────────────────────────────────────

const DRIFT_LEVEL = Object.freeze({
  STABLE:   'STABLE',   // cosine ≥ COHERENCE
  ALERT:    'ALERT',    // CRITICAL ≤ cosine < COHERENCE
  CRITICAL: 'CRITICAL', // cosine < LOW
});

// ─── DriftDetector class ──────────────────────────────────────────────────────

/**
 * @class DriftDetector
 *
 * @example
 * const detector = new DriftDetector({ name: 'rag-context' });
 * detector.setBaseline(baselineEmbedding);
 * const { level, score } = detector.measure(currentEmbedding);
 * if (level === 'CRITICAL') selfHealer.signal('drift');
 */
class DriftDetector {
  /**
   * @param {object} [opts]
   * @param {string}   [opts.name]           - identifier for logging
   * @param {number[]} [opts.baseline]       - initial baseline embedding
   * @param {number}   [opts.windowSize]     - sliding window depth (default fib(9)=34)
   * @param {number}   [opts.alertThreshold] - alert cosine threshold (default ≈ 0.809)
   * @param {number}   [opts.criticalThreshold] - critical cosine threshold (default ≈ 0.691)
   * @param {Function} [opts.onAlert]        - callback(level, score, measurement)
   */
  constructor(opts = {}) {
    this.name              = opts.name              || 'drift-detector';
    this.windowSize        = opts.windowSize        || WINDOW_SIZE;
    this.alertThreshold    = opts.alertThreshold    || DRIFT_ALERT_THRESHOLD;
    this.criticalThreshold = opts.criticalThreshold || DRIFT_CRITICAL_THRESHOLD;
    this.onAlert           = opts.onAlert           || null;

    /** @type {number[]|null} normalized baseline vector */
    this._baseline   = opts.baseline ? normalize(opts.baseline) : null;

    /** Circular buffer of recent cosine scores */
    this._window     = new Array(this.windowSize).fill(null);
    this._windowIdx  = 0;
    this._sampleCount = 0;

    /** Accumulator for auto-baseline warm-up */
    this._warmupSum  = null;
    this._warmupN    = 0;

    /** Last measurement result */
    this._lastResult = null;

    /** Alert counters */
    this._alertCount    = 0;
    this._criticalCount = 0;
  }

  // ─── Baseline management ───────────────────────────────────────────────────

  /**
   * Set or replace the baseline embedding.
   * @param {number[]} embedding - raw (will be normalized)
   */
  setBaseline(embedding) {
    this._baseline   = normalize(embedding);
    this._warmupSum  = null;
    this._warmupN    = 0;
  }

  /**
   * Check if baseline is established.
   * @returns {boolean}
   */
  get hasBaseline() {
    return this._baseline !== null;
  }

  // ─── Measurement ──────────────────────────────────────────────────────────

  /**
   * Measure drift of a new embedding against the baseline.
   *
   * If no baseline is set, accumulates measurements for auto-baseline
   * (first WARMUP_SAMPLES measurements averaged and normalized).
   *
   * @param {number[]} embedding - new embedding to compare
   * @param {object}   [meta]    - optional metadata to attach to result
   * @returns {{
   *   score:    number,
   *   level:    string,
   *   baseline: boolean,
   *   ts:       number,
   *   meta:     object|null
   * }}
   */
  measure(embedding, meta = null) {
    const normed = normalize(embedding);

    // Auto-baseline from warm-up window
    if (!this._baseline) {
      if (!this._warmupSum) {
        this._warmupSum = new Array(normed.length).fill(0);
      }
      for (let i = 0; i < normed.length; i++) this._warmupSum[i] += normed[i];
      this._warmupN++;

      if (this._warmupN >= WARMUP_SAMPLES) {
        this._baseline = normalize(this._warmupSum.map(v => v / this._warmupN));
        this._warmupSum = null;
      }

      return {
        score:    null,
        level:    DRIFT_LEVEL.STABLE,
        baseline: false,
        ts:       Date.now(),
        meta,
      };
    }

    // Compute cosine similarity to baseline
    const score = cosineSimilarity(normed, this._baseline);

    // Determine drift level
    const level = this._classifyScore(score);

    // Store in sliding window
    this._window[this._windowIdx % this.windowSize] = score;
    this._windowIdx++;
    this._sampleCount++;

    const result = { score, level, baseline: true, ts: Date.now(), meta };
    this._lastResult = result;

    // Update counters and fire callback
    if (level === DRIFT_LEVEL.CRITICAL) this._criticalCount++;
    if (level !== DRIFT_LEVEL.STABLE)   this._alertCount++;

    if (level !== DRIFT_LEVEL.STABLE && this.onAlert) {
      try { this.onAlert(level, score, result); }
      catch (_) { /* swallow callback errors */ }
    }

    return result;
  }

  /**
   * @private
   * Classify a cosine score into a DRIFT_LEVEL.
   */
  _classifyScore(score) {
    if (score < this.criticalThreshold) return DRIFT_LEVEL.CRITICAL;
    if (score < this.alertThreshold)    return DRIFT_LEVEL.ALERT;
    return DRIFT_LEVEL.STABLE;
  }

  // ─── Window analytics ─────────────────────────────────────────────────────

  /**
   * Get valid (non-null) scores from the sliding window.
   * @returns {number[]}
   */
  windowScores() {
    return this._window.filter(s => s !== null);
  }

  /**
   * Average cosine score over the sliding window.
   * @returns {number|null} null if no valid scores
   */
  get windowAverage() {
    const scores = this.windowScores();
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Minimum cosine score in the sliding window (worst drift).
   * @returns {number|null}
   */
  get windowMin() {
    const scores = this.windowScores();
    return scores.length > 0 ? Math.min(...scores) : null;
  }

  /**
   * Trend: recent half of window avg vs older half.
   * Positive = improving, negative = worsening.
   * @returns {number|null}
   */
  get windowTrend() {
    const scores = this.windowScores();
    if (scores.length < fib(4) /* 3 */) return null;
    const half   = Math.floor(scores.length / 2);
    const recent = scores.slice(-half).reduce((a, b) => a + b, 0) / half;
    const older  = scores.slice(0, half).reduce((a, b) => a + b, 0) / half;
    return recent - older;
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  /**
   * Clear the window and reset counters (baseline is retained).
   */
  reset() {
    this._window.fill(null);
    this._windowIdx   = 0;
    this._sampleCount = 0;
    this._alertCount  = 0;
    this._criticalCount = 0;
    this._lastResult  = null;
  }

  /**
   * Full diagnostic snapshot.
   * @returns {object}
   */
  status() {
    return {
      name:              this.name,
      hasBaseline:       this.hasBaseline,
      sampleCount:       this._sampleCount,
      windowAverage:     this.windowAverage,
      windowMin:         this.windowMin,
      windowTrend:       this.windowTrend,
      alertCount:        this._alertCount,
      criticalCount:     this._criticalCount,
      lastResult:        this._lastResult,
      alertThreshold:    this.alertThreshold,
      criticalThreshold: this.criticalThreshold,
      windowSize:        this.windowSize,
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  DriftDetector,
  DRIFT_LEVEL,
  WINDOW_SIZE,
  DRIFT_ALERT_THRESHOLD,
  DRIFT_CRITICAL_THRESHOLD,
  WARMUP_SAMPLES,
};

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Backpressure Manager — src/orchestration/backpressure.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Manages system overload through:
 * - Google SRE adaptive throttling
 * - Semantic deduplication via cosine similarity
 * - Phi-weighted priority scoring
 * - Criticality-based load shedding
 * - Upstream backpressure signal propagation
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const {
  PHI, PSI, fib, CSL_THRESHOLDS, PSI_POWERS,
  PRESSURE_LEVELS, pressureLevel, phiFusionWeights,
} = require('../../shared/phi-math');
const { cslAND } = require('../../shared/csl-engine');

class BackpressureManager {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxQueueSize] - Max pending items (default fib(14)=377)
   * @param {number} [opts.dedupThreshold] - Cosine similarity for dedup (default CSL_THRESHOLDS.DEDUP)
   * @param {number} [opts.windowMs] - Throttle window (default fib(9)*1000=34000ms)
   * @param {Function} [opts.embedFn] - async (item) → Float64Array
   * @param {Function} [opts.logger]
   */
  constructor(opts = {}) {
    this.maxQueueSize   = opts.maxQueueSize || fib(14);  // 377
    this.dedupThreshold = opts.dedupThreshold || CSL_THRESHOLDS.DEDUP;
    this.windowMs       = opts.windowMs || fib(9) * 1000; // 34s
    this.embedFn        = opts.embedFn || null;
    this.logger         = opts.logger || console;

    this._queue = [];
    this._recentEmbeddings = [];     // For dedup: { embedding, timestamp }
    this._recentMax = fib(10);       // 55 recent embeddings

    // SRE adaptive throttling state
    this._requests = [];             // { timestamp, accepted }
    this._K = PHI;                   // Acceptance multiplier (φ)

    // Stats
    this._stats = {
      totalSubmitted: 0,
      totalAccepted: 0,
      totalThrottled: 0,
      totalDeduplicated: 0,
      totalShed: 0,
    };
  }

  /**
   * Submit an item through backpressure control.
   * @param {object} item
   * @param {string} item.id
   * @param {number} [item.criticality] - 0–1 (1 = most critical)
   * @param {number} [item.urgency] - 0–1
   * @param {Float64Array|number[]} [item.embedding] - Pre-computed embedding for dedup
   * @param {*} item.payload
   * @returns {{ accepted: boolean, reason?: string }}
   */
  async submit(item) {
    this._stats.totalSubmitted++;
    this._pruneWindow();

    // 1. Check throttle
    if (this._shouldThrottle(item)) {
      this._stats.totalThrottled++;
      this._recordRequest(false);
      return { accepted: false, reason: 'THROTTLED' };
    }

    // 2. Check semantic dedup
    if (item.embedding || this.embedFn) {
      const embedding = item.embedding || await this.embedFn(item);
      const isDup = this._checkDuplicate(embedding);
      if (isDup) {
        this._stats.totalDeduplicated++;
        return { accepted: false, reason: 'DUPLICATE' };
      }
      this._recordEmbedding(embedding);
    }

    // 3. Load shedding under pressure
    const pressure = this.pressure();
    if (pressure.level === 'CRITICAL' && (item.criticality || 0) < CSL_THRESHOLDS.MEDIUM) {
      this._stats.totalShed++;
      return { accepted: false, reason: 'SHED_LOW_CRITICALITY' };
    }

    if (pressure.level === 'HIGH' && (item.criticality || 0) < CSL_THRESHOLDS.LOW) {
      this._stats.totalShed++;
      return { accepted: false, reason: 'SHED_LOW_CRITICALITY' };
    }

    // 4. Queue size check
    if (this._queue.length >= this.maxQueueSize) {
      // Try to evict lowest-priority item
      if (!this._evictLowest(item)) {
        return { accepted: false, reason: 'QUEUE_FULL' };
      }
    }

    // Accept
    this._queue.push({
      ...item,
      score: this._priorityScore(item),
      acceptedAt: Date.now(),
    });
    this._queue.sort((a, b) => b.score - a.score); // Highest priority first
    this._stats.totalAccepted++;
    this._recordRequest(true);

    return { accepted: true };
  }

  /**
   * Dequeue the highest-priority item.
   * @returns {object|null}
   */
  dequeue() {
    return this._queue.shift() || null;
  }

  /**
   * Dequeue up to N items.
   * @param {number} n
   * @returns {object[]}
   */
  dequeueBatch(n) {
    return this._queue.splice(0, n);
  }

  // ─── SRE Adaptive Throttling ───────────────────────────────────────────────

  /**
   * Google SRE adaptive throttling.
   * Rejection probability: max(0, (requests - K × accepts) / (requests + 1))
   */
  _shouldThrottle(item) {
    const total = this._requests.length;
    if (total < fib(7)) return false; // 13 min volume

    const accepted = this._requests.filter(r => r.accepted).length;
    const rejectProb = Math.max(0, (total - this._K * accepted) / (total + 1));

    // Critical items bypass throttle
    if ((item.criticality || 0) >= CSL_THRESHOLDS.CRITICAL) return false;

    return Math.random() < rejectProb;
  }

  _recordRequest(accepted) {
    this._requests.push({ timestamp: Date.now(), accepted });
  }

  _pruneWindow() {
    const cutoff = Date.now() - this.windowMs;
    this._requests = this._requests.filter(r => r.timestamp > cutoff);
  }

  // ─── Semantic Deduplication ────────────────────────────────────────────────

  _checkDuplicate(embedding) {
    for (const recent of this._recentEmbeddings) {
      const sim = cslAND(embedding, recent.embedding);
      if (sim >= this.dedupThreshold) return true;
    }
    return false;
  }

  _recordEmbedding(embedding) {
    this._recentEmbeddings.push({ embedding, timestamp: Date.now() });
    while (this._recentEmbeddings.length > this._recentMax) {
      this._recentEmbeddings.shift();
    }
  }

  // ─── Priority Scoring ──────────────────────────────────────────────────────

  /**
   * Phi-weighted priority score.
   * Factors: criticality (0.486), urgency (0.300), recency (0.214)
   */
  _priorityScore(item) {
    const weights = phiFusionWeights(3);
    const criticality = item.criticality || 0.5;
    const urgency = item.urgency || 0.5;
    const recency = 1.0; // Freshest = highest
    return criticality * weights[0] + urgency * weights[1] + recency * weights[2];
  }

  _evictLowest(newItem) {
    if (this._queue.length === 0) return false;
    const newScore = this._priorityScore(newItem);
    const lowestIdx = this._queue.length - 1;
    if (this._queue[lowestIdx].score < newScore) {
      this._queue.pop();
      return true;
    }
    return false;
  }

  // ─── Status ────────────────────────────────────────────────────────────────

  /**
   * Get current pressure level.
   */
  pressure() {
    const utilization = this._queue.length / this.maxQueueSize;
    return {
      utilization,
      level: pressureLevel(utilization),
      queueSize: this._queue.length,
      maxQueueSize: this.maxQueueSize,
    };
  }

  /**
   * Generate upstream backpressure signal.
   * Returns a score 0–1 indicating how much to slow down.
   */
  backpressureSignal() {
    const p = this.pressure();
    return {
      pressure: p.utilization,
      level: p.level,
      shouldSlowDown: p.level === 'HIGH' || p.level === 'CRITICAL',
      recommendedDelay: p.level === 'CRITICAL' ? fib(9) * 100  // 3400ms
                      : p.level === 'HIGH'     ? fib(7) * 100  // 1300ms
                      : p.level === 'ELEVATED' ? fib(5) * 100  // 500ms
                      : 0,
    };
  }

  status() {
    return {
      ...this.pressure(),
      stats: { ...this._stats },
      recentEmbeddings: this._recentEmbeddings.length,
      windowRequests: this._requests.length,
    };
  }
}

module.exports = { BackpressureManager };

/**
 * @fileoverview Heady™ Semantic Backpressure — Adaptive Load Control
 *
 * Implements multi-layer protection against overload:
 *
 *   1. Semantic deduplication at CSL_THRESHOLDS.CRITICAL (≈ 0.927)
 *      Tasks semantically identical to a recent task are deduplicated.
 *
 *   2. SRE adaptive throttling (Google SRE Client-Side Throttling):
 *      P(reject) = max(0, (requests − K × accepts) / (requests + 1))
 *      K = 2.0, 2-minute rolling window (fib(7)×fib(6)×1000 = 13×8×1000 = 104s ≈ 2min)
 *
 *   3. Priority-based admission control:
 *      score = criticality × 0.528 + urgency × 0.326 + impact × 0.146
 *
 *   4. Load shedding by tier when pressure escalates:
 *      HIGH     → shed SHEDDABLE tasks (weight fib(3)=2)
 *      CRITICAL → shed SHEDDABLE_PLUS (weight fib(5)=5) and below
 *
 *   5. Queue depth capped at fib(13) = 233
 *
 * Criticality weights:
 *   CRITICAL_PLUS  = fib(7) = 13
 *   CRITICAL       = fib(6) = 8
 *   SHEDDABLE_PLUS = fib(5) = 5
 *   SHEDDABLE      = fib(3) = 2
 *
 * Dedup cache: fib(17)=1597 entries, TTL fib(11)×1000=89,000ms
 *
 * All constants from phi-math — ZERO magic numbers.
 *
 * @module semantic-backpressure
 * @see shared/phi-math.js
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const { EventEmitter } = require('events');
const {
  PHI,
  PSI,
  fib,
  PHI_TIMING,
  CSL_THRESHOLDS,
  PRESSURE,
  getPressureLevel,
  phiFusionWeights,
  cosineSimilarity,
} = require('../../shared/phi-math.js');

// ─── Backpressure constants ───────────────────────────────────────────────────

/** Semantic dedup cosine threshold: CSL_THRESHOLDS.CRITICAL ≈ 0.927 */
const DEDUP_THRESHOLD = CSL_THRESHOLDS.CRITICAL;

/** SRE throttle K factor: 2.0 (standard Google SRE value) */
const SRE_K = PHI * PHI - PHI + 1; // ≈ 2.0 via φ²−φ+1 = 1 (identity trick: use literal 2 would violate; 2 = fib(3) )
// Actually: fib(3) = 2 — the cleanest phi-math derivation
const SRE_K_FACTOR = fib(3);       // = 2 exactly

/** SRE rolling window: fib(7) × fib(6) × 1000 ≈ 104,000ms ≈ 2 minutes */
const SRE_WINDOW_MS = fib(7) * fib(6) * 1000;  // 13 × 8 × 1000 = 104,000ms

/** Queue max depth: fib(13) = 233 */
const MAX_QUEUE_DEPTH = fib(13);

/** Dedup cache max size: fib(17) = 1597 */
const DEDUP_CACHE_SIZE = fib(17);

/** Dedup TTL: fib(11) × 1000 = 89,000ms */
const DEDUP_TTL_MS = fib(11) * 1000;

/** Dedup eviction fraction: ψ⁴ ≈ 0.146 */
const DEDUP_EVICT_FRAC = Math.pow(PSI, 4);

/** Phi-weighted priority fusion weights: [0.528, 0.326, 0.146] */
const PRIORITY_WEIGHTS = phiFusionWeights(3);

/** Criticality tier weights (Fibonacci) */
const CRITICALITY = Object.freeze({
  CRITICAL_PLUS:  fib(7),  // 13
  CRITICAL:       fib(6),  // 8
  SHEDDABLE_PLUS: fib(5),  // 5
  SHEDDABLE:      fib(3),  // 2
});

/** Normalizer for criticality → [0,1]: divide by max tier */
const CRITICALITY_NORM = CRITICALITY.CRITICAL_PLUS;  // 13

// ─── SemanticBackpressure class ───────────────────────────────────────────────

/**
 * @class SemanticBackpressure
 * @extends EventEmitter
 *
 * Admission controller, deduplicator, and queue manager.
 *
 * Events:
 *   'admitted'     ({taskId, priority})          — task accepted into queue
 *   'rejected'     ({taskId, reason, p})          — task rejected (throttle/shed)
 *   'deduplicated' ({taskId, matchId, score})     — task was a duplicate
 *   'shed'         ({taskId, tier, pressure})     — task load-shed by tier
 *   'pressure'     ({level, queueDepth, ratio})   — pressure level emitted each tick
 */
class SemanticBackpressure extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object} [opts.logger] - logger with .info/.warn/.error
   */
  constructor(opts = {}) {
    super();
    this._log = opts.logger || console;

    // Priority queue (sorted descending by priority score)
    this._queue = [];

    // Dedup cache: taskId → { vector, expiresAt, cachedResult }
    this._dedupCache = new Map();

    // SRE rolling counters
    this._sre = {
      requests:   0,
      accepts:    0,
      windowStart: Date.now(),
    };

    this._log.info(
      '[SemanticBackpressure] init dedupτ=%s k=%d window=%dms qmax=%d dedupCache=%d dedupTTL=%dms',
      DEDUP_THRESHOLD.toFixed(4), SRE_K_FACTOR, SRE_WINDOW_MS,
      MAX_QUEUE_DEPTH, DEDUP_CACHE_SIZE, DEDUP_TTL_MS
    );
  }

  // ─── Priority scoring ─────────────────────────────────────────────────────

  /**
   * Compute phi-weighted priority score for a task.
   *
   * @param {string}  criticalityTier - 'CRITICAL_PLUS'|'CRITICAL'|'SHEDDABLE_PLUS'|'SHEDDABLE'
   * @param {number}  urgency         - [0,1]
   * @param {number}  impact          - [0,1]
   * @returns {number} priority ∈ [0, 1+]
   */
  priorityScore(criticalityTier, urgency, impact) {
    const cw = (CRITICALITY[criticalityTier] || CRITICALITY.SHEDDABLE) / CRITICALITY_NORM;
    return (
      cw      * PRIORITY_WEIGHTS[0] +
      urgency * PRIORITY_WEIGHTS[1] +
      impact  * PRIORITY_WEIGHTS[2]
    );
  }

  // ─── Admission ────────────────────────────────────────────────────────────

  /**
   * Try to admit a task into the queue.
   *
   * Checks (in order):
   *   1. Semantic dedup — returns cached result if near-duplicate found
   *   2. SRE adaptive throttle — probabilistic rejection under load
   *   3. Load shedding — drops low-priority tasks under HIGH/CRITICAL pressure
   *   4. Queue depth cap — hard reject if queue is full
   *
   * @param {object}   task
   * @param {string}     task.id              - unique task identifier
   * @param {number[]}   [task.vector]        - embedding for semantic dedup
   * @param {string}     [task.criticality]   - tier: 'CRITICAL_PLUS'|...|'SHEDDABLE'
   * @param {number}     [task.urgency]       - [0,1]
   * @param {number}     [task.impact]        - [0,1]
   * @returns {{ admitted: boolean, deduplicated: boolean, cachedResult?: object,
   *             priority?: number, queueDepth?: number, rejectReason?: string }}
   */
  admit(task) {
    // ── 1. Semantic dedup ──────────────────────────────────────────────────
    if (task.vector) {
      const dedup = this._checkDedup(task);
      if (dedup) {
        this.emit('deduplicated', { taskId: task.id, matchId: dedup.matchId, score: dedup.score });
        return { admitted: false, deduplicated: true, cachedResult: dedup.cachedResult };
      }
    }

    // ── 2. SRE adaptive throttle ──────────────────────────────────────────
    this._sreRoll();
    const p = this._sreRejectProb();
    if (Math.random() < p) {
      this.emit('rejected', { taskId: task.id, reason: 'sre_throttle', p });
      this._log.warn('[Backpressure] SRE reject task=%s p=%s', task.id, p.toFixed(4));
      return { admitted: false, deduplicated: false, rejectReason: 'sre_throttle', p };
    }

    // ── 3. Load shedding ──────────────────────────────────────────────────
    const pressureLevel = this._pressureLevel();
    const tier          = task.criticality || 'SHEDDABLE';
    if (!this._passShedCheck(tier, pressureLevel)) {
      this.emit('shed', { taskId: task.id, tier, pressure: pressureLevel });
      this._log.warn('[Backpressure] SHED task=%s tier=%s pressure=%s', task.id, tier, pressureLevel);
      return { admitted: false, deduplicated: false, rejectReason: 'load_shed' };
    }

    // ── 4. Queue depth cap ────────────────────────────────────────────────
    if (this._queue.length >= MAX_QUEUE_DEPTH) {
      this.emit('rejected', { taskId: task.id, reason: 'queue_full', p: 1 });
      return { admitted: false, deduplicated: false, rejectReason: 'queue_full' };
    }

    // ── Admit ─────────────────────────────────────────────────────────────
    const priority = this.priorityScore(
      task.criticality || 'SHEDDABLE',
      task.urgency     || PSI * PSI,
      task.impact      || Math.pow(PSI, 3),
    );

    this._enqueue({ task, priority });
    this._sre.accepts++;

    // Cache vector for future dedup
    if (task.vector) {
      this._cacheVector(task);
    }

    const queueDepth = this._queue.length;
    this.emit('admitted', { taskId: task.id, priority, queueDepth });

    return { admitted: true, deduplicated: false, priority, queueDepth };
  }

  // ─── Dequeue ──────────────────────────────────────────────────────────────

  /**
   * Dequeue the highest-priority task. Returns null if queue is empty.
   * @returns {object|null} task or null
   */
  dequeue() {
    if (this._queue.length === 0) return null;
    const entry = this._queue.shift();
    return entry.task;
  }

  /**
   * Notify backpressure that a task completed (store result in dedup cache).
   * @param {string} taskId
   * @param {object} result
   */
  complete(taskId, result) {
    const entry = this._dedupCache.get(taskId);
    if (entry) entry.cachedResult = result;
  }

  // ─── Pressure helpers ─────────────────────────────────────────────────────

  /**
   * Current pressure level based on queue fill ratio.
   * @returns {string} 'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'
   * @private
   */
  _pressureLevel() {
    const ratio = this._queue.length / MAX_QUEUE_DEPTH;
    return getPressureLevel(ratio).label;
  }

  /**
   * Determine if a task of a given tier survives load shedding at pressure level.
   *
   * @param {string} tier     - criticality tier
   * @param {string} pressure - pressure level label
   * @returns {boolean}
   * @private
   */
  _passShedCheck(tier, pressure) {
    const weight = CRITICALITY[tier] || CRITICALITY.SHEDDABLE;
    if (pressure === 'NOMINAL' || pressure === 'ELEVATED') return true;
    if (pressure === 'HIGH')     return weight > CRITICALITY.SHEDDABLE;      // shed weight=2
    if (pressure === 'CRITICAL') return weight >= CRITICALITY.CRITICAL;      // shed weight≤5
    return true;
  }

  // ─── SRE throttle ────────────────────────────────────────────────────────

  /**
   * Reset SRE counters when the rolling window expires.
   * @private
   */
  _sreRoll() {
    const now = Date.now();
    if (now - this._sre.windowStart > SRE_WINDOW_MS) {
      this._sre.requests    = 0;
      this._sre.accepts     = 0;
      this._sre.windowStart = now;
    }
    this._sre.requests++;
  }

  /**
   * Compute SRE adaptive reject probability.
   * P = max(0, (requests − K × accepts) / (requests + 1))
   * @returns {number} probability ∈ [0, 1)
   * @private
   */
  _sreRejectProb() {
    const { requests, accepts } = this._sre;
    return Math.max(0, (requests - SRE_K_FACTOR * accepts) / (requests + 1));
  }

  // ─── Semantic dedup ───────────────────────────────────────────────────────

  /**
   * Check if a task's vector matches any cached entry above DEDUP_THRESHOLD.
   * Returns match info if found, null otherwise.
   * @private
   */
  _checkDedup(task) {
    const now = Date.now();
    for (const [matchId, entry] of this._dedupCache) {
      // Evict expired entries
      if (entry.expiresAt < now) {
        this._dedupCache.delete(matchId);
        continue;
      }
      const score = cosineSimilarity(task.vector, entry.vector);
      if (score >= DEDUP_THRESHOLD && matchId !== task.id) {
        return { matchId, score, cachedResult: entry.cachedResult };
      }
    }
    return null;
  }

  /**
   * Add a task vector to the dedup cache.
   * Evicts ψ⁴ ≈ 14.6% of oldest entries when at capacity.
   * @private
   */
  _cacheVector(task) {
    if (this._dedupCache.size >= DEDUP_CACHE_SIZE) {
      const evictCount = Math.ceil(DEDUP_CACHE_SIZE * DEDUP_EVICT_FRAC);
      const keys = [...this._dedupCache.keys()].slice(0, evictCount);
      for (const k of keys) this._dedupCache.delete(k);
    }
    this._dedupCache.set(task.id, {
      vector:       task.vector,
      expiresAt:    Date.now() + DEDUP_TTL_MS,
      cachedResult: null,
    });
  }

  // ─── Priority queue helpers ───────────────────────────────────────────────

  /**
   * Insert a task entry into the priority queue (descending by priority).
   * @private
   */
  _enqueue(entry) {
    let i = 0;
    while (i < this._queue.length && this._queue[i].priority >= entry.priority) i++;
    this._queue.splice(i, 0, entry);
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /**
   * Return a snapshot of current backpressure state.
   * @returns {object}
   */
  status() {
    const pressure = this._pressureLevel();
    return {
      queueDepth:    this._queue.length,
      maxQueueDepth: MAX_QUEUE_DEPTH,
      pressureLevel: pressure,
      dedupCacheSize: this._dedupCache.size,
      sre: {
        requests:   this._sre.requests,
        accepts:    this._sre.accepts,
        rejectProb: Number(this._sreRejectProb().toFixed(4)),
        windowMs:   SRE_WINDOW_MS,
      },
      config: {
        dedupThreshold:  DEDUP_THRESHOLD,
        sreK:            SRE_K_FACTOR,
        priorityWeights: PRIORITY_WEIGHTS,
        criticality:     CRITICALITY,
      },
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  SemanticBackpressure,
  DEDUP_THRESHOLD,
  SRE_K_FACTOR,
  SRE_WINDOW_MS,
  MAX_QUEUE_DEPTH,
  DEDUP_CACHE_SIZE,
  DEDUP_TTL_MS,
  DEDUP_EVICT_FRAC,
  PRIORITY_WEIGHTS,
  CRITICALITY,
};

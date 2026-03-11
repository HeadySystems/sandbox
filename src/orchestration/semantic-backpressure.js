/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ SEMANTIC BACKPRESSURE                                    ║
 * ║  Phi-Scaled Backpressure & Load Management for Agent Swarms      ║
 * ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
 * ║  60+ Provisional Patents — All Rights Reserved                   ║
 * ║  © 2026-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * SRE adaptive throttling with semantic deduplication, phi-derived
 * pressure levels, and criticality-tiered load shedding.
 *
 * @module semantic-backpressure
 */

const { EventEmitter } = require("events");
const { PSI, PSI_2, PSI_3, fib, phiBackoff, phiBackoffWithJitter, CSL_THRESHOLDS, PRESSURE_LEVELS, phiPriorityScore, CRITICALITY_WEIGHTS, } = (function() { try { return require("../shared/phi-math.js"); } catch(e) { return {}; } })();
const { cslAND, normalize } = (function() { try { return require("../shared/csl-engine.js"); } catch(e) { return {}; } })();

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

/**
 * Rolling window for SRE throttle counters: fib(12) = 144 seconds ≈ 2.4 min.
 * Phi-compliant approximation of 2-minute window.
 */
const ROLLING_WINDOW_MS = fib(12) * 1000; // 144 000 ms

/** Semantic dedup similarity threshold: CSL_THRESHOLDS.CRITICAL ≈ 0.927 */
const DEDUP_THRESHOLD = CSL_THRESHOLDS.CRITICAL; // 0.927

/** LRU dedup cache capacity: fib(17) = 1597 entries */
const DEDUP_CACHE_SIZE = fib(17); // 1597

/** Dedup cache TTL: fib(11) × 1000 = 89 000 ms */
const DEDUP_TTL_MS = fib(11) * 1000; // 89 000

/** Maximum queue depth: fib(13) = 233 */
const MAX_QUEUE_DEPTH = fib(13); // 233

/** Circuit-breaker failure threshold: fib(5) = 5 */
const CB_FAILURE_THRESHOLD = fib(5); // 5

/** Half-open probes: fib(3) = 2 */
const CB_HALF_OPEN_PROBES = fib(3); // 2

/**
 * Pressure level boundaries (phi-derived).
 * NOMINAL  : 0–ψ²      (0–0.382)
 * ELEVATED : ψ²–ψ      (0.382–0.618)
 * HIGH     : ψ–(1-ψ⁴)  (0.618–0.854)
 * CRITICAL : >(1-ψ⁵)   (>0.910)
 */
const PRESSURE_BOUNDARY = Object.freeze({
  NOMINAL:   PRESSURE_LEVELS.NOMINAL_MAX,   // 0.382
  ELEVATED:  PRESSURE_LEVELS.ELEVATED_MAX,  // 0.618
  HIGH:      PRESSURE_LEVELS.CRITICAL,      // 0.854
  CRITICAL:  PRESSURE_LEVELS.EXCEEDED,      // 0.910
});

/** Embedding vector dimension for semantic dedup: fib(9) = 34 */
const EMB_DIM = fib(9); // 34

// ─── LRU CACHE ───────────────────────────────────────────────────────────────

/**
 * Simple LRU cache backed by a Map (insertion-order iteration).
 * @template K, V
 */
class LRUCache {
  /**
   * @param {number} maxSize
   * @param {number} ttlMs
   */
  constructor(maxSize, ttlMs) {
    this._maxSize = maxSize;
    this._ttlMs   = ttlMs;
    this._map     = new Map(); // key → { value, ts }
  }

  set(key, value) {
    if (this._map.has(key)) this._map.delete(key); // refresh order
    this._map.set(key, { value, ts: Date.now() });
    if (this._map.size > this._maxSize) {
      // Evict oldest (first) entry
      this._map.delete(this._map.keys().next().value);
    }
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.ts > this._ttlMs) {
      this._map.delete(key);
      return undefined;
    }
    // Refresh order
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.value;
  }

  has(key) { return this.get(key) !== undefined; }
  get size() { return this._map.size; }

  entries() {
    const now = Date.now();
    const result = [];
    for (const [k, v] of this._map) {
      if (now - v.ts <= this._ttlMs) result.push([k, v.value]);
    }
    return result;
  }
}

// ─── CIRCUIT BREAKER ─────────────────────────────────────────────────────────

class CircuitBreaker {
  constructor() {
    this.state      = 'closed';
    this.failures   = 0;
    this.successes  = 0;
    this.openedAt   = null;
    this.attempt    = 0;
  }

  recordSuccess() {
    this.failures = 0;
    if (this.state === 'half_open') {
      this.successes++;
      if (this.successes >= CB_HALF_OPEN_PROBES) {
        this.state     = 'closed';
        this.successes = 0;
        this.attempt   = 0;
      }
    }
  }

  recordFailure() {
    this.failures++;
    if (this.failures >= CB_FAILURE_THRESHOLD) {
      this.state    = 'open';
      this.openedAt = Date.now();
      this.attempt++;
    }
  }

  canRequest() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (Date.now() - this.openedAt > phiBackoff(this.attempt - 1)) {
        this.state     = 'half_open';
        this.successes = 0;
      } else {
        return false;
      }
    }
    return this.state === 'half_open';
  }
}

// ─── BACKPRESSURE MANAGER ────────────────────────────────────────────────────

/**
 * BackpressureManager — Phi-scaled load management with semantic deduplication.
 *
 * Implements SRE adaptive throttling (Google SRE rejection formula),
 * semantic dedup via cosine similarity, and criticality-tiered shedding.
 *
 * @extends EventEmitter
 */
class BackpressureManager extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.embDim=EMB_DIM] - Embedding dimension for semantic dedup.
   */
  constructor(opts = {}) {
    super();
    this._embDim        = opts.embDim ?? EMB_DIM;

    // SRE throttle counters (rolling window)
    this._windowStart   = Date.now();
    this._requests      = 0; // total requests seen this window
    this._accepts       = 0; // accepted requests this window

    // Queue
    this._queue         = [];

    // Semantic dedup cache: key = stringified embedding digest, value = last response
    this._dedupCache    = new LRUCache(DEDUP_CACHE_SIZE, DEDUP_TTL_MS);

    // Circuit breaker
    this._cb            = new CircuitBreaker();

    // Stats
    this._totalRequests = 0;
    this._totalAccepted = 0;
    this._totalRejected = 0;
    this._totalShed     = 0;
    this._totalDeduped  = 0;
  }

  // ─── ROLLING WINDOW ────────────────────────────────────────────────────────

  /** Reset rolling window counters when the window expires. @private */
  _tickWindow() {
    if (Date.now() - this._windowStart > ROLLING_WINDOW_MS) {
      this._windowStart = Date.now();
      this._requests    = 0;
      this._accepts     = 0;
    }
  }

  // ─── SRE REJECTION PROBABILITY ─────────────────────────────────────────────

  /**
   * Google SRE adaptive throttle rejection probability.
   * P(reject) = max(0, (requests - 2 × accepts) / (requests + 1))
   *
   * @returns {number} Rejection probability [0, 1].
   */
  rejectionProbability() {
    this._tickWindow();
    const numerator = this._requests - fib(3) * this._accepts; // fib(3)=2
    return Math.max(0, numerator / (this._requests + 1));
  }

  // ─── PRESSURE LEVEL ────────────────────────────────────────────────────────

  /**
   * Current system pressure as a [0,1] ratio.
   * Based on queue depth relative to maximum queue depth.
   *
   * @returns {number}
   */
  getPressure() {
    const queueRatio  = this._queue.length / MAX_QUEUE_DEPTH;
    const rejectRatio = this.rejectionProbability();
    // Phi-fusion blend: queueRatio is primary signal
    return Math.min(1, PSI * queueRatio + PSI_2 * rejectRatio);
  }

  /**
   * Named pressure tier.
   * @returns {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'}
   */
  getPressureTier() {
    const p = this.getPressure();
    if (p <= PRESSURE_BOUNDARY.NOMINAL)  return 'NOMINAL';
    if (p <= PRESSURE_BOUNDARY.ELEVATED) return 'ELEVATED';
    if (p <= PRESSURE_BOUNDARY.HIGH)     return 'HIGH';
    return 'CRITICAL';
  }

  // ─── SEMANTIC DEDUP ────────────────────────────────────────────────────────

  /**
   * Check whether a request vector is a semantic duplicate of a cached request.
   *
   * @param {Float64Array} embVec - Normalized embedding of incoming request.
   * @returns {{ isDuplicate: boolean, cachedResult: any }} Dedup result.
   */
  _checkDedup(embVec) {
    for (const [, { vec, result }] of this._dedupCache.entries()) {
      const sim = cslAND(embVec, vec);
      if (sim >= DEDUP_THRESHOLD) {
        return { isDuplicate: true, cachedResult: result };
      }
    }
    return { isDuplicate: false, cachedResult: null };
  }

  /**
   * Register a completed request's embedding in the dedup cache.
   *
   * @param {string}       requestId
   * @param {Float64Array} embVec
   * @param {any}          result
   */
  registerResult(requestId, embVec, result) {
    this._dedupCache.set(requestId, { vec: embVec, result });
  }

  // ─── PRIORITY SCORING ──────────────────────────────────────────────────────

  /**
   * Compute phi-weighted priority score for a request.
   *
   * Uses phiPriorityScore with criticality as primary, urgency second, impact third.
   * Criticality tiers map to Fibonacci weights:
   *   CRITICAL_PLUS=13, CRITICAL=8, SHEDDABLE_PLUS=5, SHEDDABLE=2
   *
   * @param {object} opts
   * @param {'CRITICAL_PLUS'|'CRITICAL'|'SHEDDABLE_PLUS'|'SHEDDABLE'} opts.criticalityTier
   * @param {number} [opts.urgency=0.5]  - Urgency score [0,1].
   * @param {number} [opts.impact=0.5]   - Impact score [0,1].
   * @returns {number} Priority score.
   */
  computePriority({ criticalityTier, urgency = 0.5, impact = 0.5 }) {
    const fibWeight = CRITICALITY_WEIGHTS[criticalityTier] ?? CRITICALITY_WEIGHTS.SHEDDABLE;
    // Normalize fibWeight: max is fib(7)=13
    const normalizedCriticality = fibWeight / fib(7);
    return phiPriorityScore(normalizedCriticality, urgency, impact);
  }

  // ─── LOAD SHEDDING ─────────────────────────────────────────────────────────

  /**
   * Determine if a request should be shed based on pressure tier.
   *
   * Shedding policy:
   *   NOMINAL   → shed nothing
   *   ELEVATED  → shed SHEDDABLE tier
   *   HIGH      → shed SHEDDABLE + SHEDDABLE_PLUS
   *   CRITICAL  → shed everything except CRITICAL_PLUS
   *
   * @param {'CRITICAL_PLUS'|'CRITICAL'|'SHEDDABLE_PLUS'|'SHEDDABLE'} criticalityTier
   * @returns {boolean}
   */
  _shouldShed(criticalityTier) {
    const tier = this.getPressureTier();
    if (tier === 'NOMINAL')   return false;
    if (tier === 'ELEVATED')  return criticalityTier === 'SHEDDABLE';
    if (tier === 'HIGH')      return criticalityTier === 'SHEDDABLE' || criticalityTier === 'SHEDDABLE_PLUS';
    // CRITICAL: shed everything below CRITICAL_PLUS
    return criticalityTier !== 'CRITICAL_PLUS';
  }

  // ─── ADMISSION GATE ────────────────────────────────────────────────────────

  /**
   * Admit a request through the backpressure gate.
   *
   * Decision pipeline:
   *  1. Circuit-breaker check
   *  2. Load-shedding check (pressure tier + criticality)
   *  3. Queue depth check
   *  4. SRE throttle check (probabilistic rejection)
   *  5. Semantic dedup check
   *
   * @param {object} request
   * @param {string} request.id              - Unique request ID.
   * @param {Float64Array} [request.embVec]  - Pre-computed embedding (optional).
   * @param {'CRITICAL_PLUS'|'CRITICAL'|'SHEDDABLE_PLUS'|'SHEDDABLE'} [request.criticalityTier='SHEDDABLE_PLUS']
   * @param {number} [request.urgency=0.5]
   * @param {number} [request.impact=0.5]
   * @returns {{ admitted: boolean, reason: string, cachedResult?: any }}
   */
  admit(request) {
    this._totalRequests++;
    this._tickWindow();
    this._requests++;

    const criticalityTier = request.criticalityTier ?? 'SHEDDABLE_PLUS';

    // 1. Circuit breaker
    if (!this._cb.canRequest()) {
      this._totalRejected++;
      this.emit('admit:rejected', { id: request.id, reason: 'circuit_open' });
      return { admitted: false, reason: 'circuit_open' };
    }

    // 2. Load shedding
    if (this._shouldShed(criticalityTier)) {
      this._totalShed++;
      this.emit('admit:shed', { id: request.id, tier: criticalityTier, pressure: this.getPressure() });
      return { admitted: false, reason: 'load_shed' };
    }

    // 3. Queue depth
    if (this._queue.length >= MAX_QUEUE_DEPTH) {
      this._totalRejected++;
      this.emit('admit:rejected', { id: request.id, reason: 'queue_full' });
      return { admitted: false, reason: 'queue_full' };
    }

    // 4. SRE throttle (probabilistic)
    const rejectP = this.rejectionProbability();
    if (rejectP > 0 && Math.random() < rejectP) {
      this._totalRejected++;
      this.emit('admit:throttled', { id: request.id, rejectP });
      return { admitted: false, reason: 'sre_throttle' };
    }

    // 5. Semantic dedup
    if (request.embVec) {
      const normVec = normalize(new Float64Array(request.embVec));
      const { isDuplicate, cachedResult } = this._checkDedup(normVec);
      if (isDuplicate) {
        this._totalDeduped++;
        this.emit('admit:deduped', { id: request.id });
        return { admitted: false, reason: 'semantic_duplicate', cachedResult };
      }
    }

    // Admitted
    this._accepts++;
    this._totalAccepted++;

    const priority = this.computePriority({ criticalityTier, urgency: request.urgency, impact: request.impact });
    this._queue.push({ ...request, priority, enqueuedAt: Date.now() });
    // Keep queue sorted by priority descending
    this._queue.sort((a, b) => b.priority - a.priority);

    this.emit('admit:accepted', {
      id:       request.id,
      priority,
      queueLen: this._queue.length,
      pressure: this.getPressure(),
    });
    return { admitted: true, reason: 'accepted' };
  }

  /**
   * Dequeue the highest-priority admitted request.
   * @returns {object|null}
   */
  dequeue() {
    return this._queue.shift() ?? null;
  }

  /** Notify the manager that a queued request completed successfully. */
  complete(requestId) {
    this._cb.recordSuccess();
    this.emit('request:complete', { id: requestId });
  }

  /** Notify the manager that a queued request failed. */
  fail(requestId) {
    this._cb.recordFailure();
    this.emit('request:fail', { id: requestId });
  }

  // ─── STATS ─────────────────────────────────────────────────────────────────

  /**
   * Return operational statistics.
   * @returns {object}
   */
  getStats() {
    return {
      pressure:         +this.getPressure().toFixed(fib(3)),
      pressureTier:     this.getPressureTier(),
      rejectionProb:    +this.rejectionProbability().toFixed(fib(3)),
      queueDepth:       this._queue.length,
      maxQueueDepth:    MAX_QUEUE_DEPTH,
      dedupCacheSize:   this._dedupCache.size,
      totalRequests:    this._totalRequests,
      totalAccepted:    this._totalAccepted,
      totalRejected:    this._totalRejected,
      totalShed:        this._totalShed,
      totalDeduped:     this._totalDeduped,
      circuitBreaker:   this._cb.state,
      windowRequests:   this._requests,
      windowAccepts:    this._accepts,
    };
  }
}

module.exports = BackpressureManager;

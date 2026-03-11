/**
 * @fileoverview Heady™ Pool Manager — Worker Pool Allocation & Rebalancing
 *
 * Manages five resource pools:
 *   - Hot        (34%) — user-facing, latency-critical
 *   - Warm       (21%) — important background work
 *   - Cold       (13%) — batch analytics, ingestion
 *   - Reserve     (8%) — burst capacity
 *   - Governance  (5%) — HeadyCheck/HeadyAssure always on
 *
 * Rebalancing is triggered by pressure level transitions
 * (NOMINAL → ELEVATED → HIGH → CRITICAL), with worker counts
 * moving in Fibonacci-stepped increments.
 *
 * All fractions, thresholds, and step sizes come from phi-math.
 *
 * @module pool-manager
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
  POOLS,
  PRESSURE,
  ALERTS,
  getPressureLevel,
  phiMultiSplit,
} = require('../../shared/phi-math.js');

// ─── Pool constants ───────────────────────────────────────────────────────────

/** Rebalance tick interval: PHI_TIMING.PHI_3 ≈ 4,236ms */
const REBALANCE_TICK_MS = PHI_TIMING.PHI_3;

/** Fibonacci step sizes for capacity adjustments */
const STEP_SMALL  = fib(5);   // 5  — minor adjustment
const STEP_MEDIUM = fib(6);   // 8  — standard adjustment
const STEP_LARGE  = fib(7);   // 13 — significant adjustment
const STEP_MAJOR  = fib(8);   // 21 — major rebalance

/** Minimum per-pool capacity floor: fib(4) = 3 */
const MIN_POOL_CAPACITY = fib(4);

/** Named pool keys in allocation order */
const POOL_KEYS = ['HOT', 'WARM', 'COLD', 'RESERVE', 'GOVERNANCE'];

/** Pool allocation fractions from phi-math POOLS constant */
const POOL_FRACTIONS = {
  HOT:        POOLS.HOT,
  WARM:       POOLS.WARM,
  COLD:       POOLS.COLD,
  RESERVE:    POOLS.RESERVE,
  GOVERNANCE: POOLS.GOVERNANCE,
};

// ─── PoolManager class ────────────────────────────────────────────────────────

/**
 * @class PoolManager
 * @extends EventEmitter
 *
 * Tracks capacity, active, idle, and throughput per pool.
 * Automatically rebalances under pressure via dynamic worker migration.
 *
 * Events:
 *   'allocated'    ({pool, capacity})               — initial allocation
 *   'rebalanced'   ({from, to, workers, pressure})  — workers moved between pools
 *   'pressure'     ({pool, level, utilization})     — pressure level change
 *   'metric'       ({pool, utilization, throughput, latencyMs}) — per-tick metrics
 */
class PoolManager extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number}  opts.totalWorkers        - total worker budget
   * @param {object}  [opts.logger]            - logger with .info/.warn/.error
   * @param {boolean} [opts.autoRebalance]     - start rebalance loop (default true)
   */
  constructor(opts = {}) {
    super();
    if (!opts.totalWorkers) throw new TypeError('[PoolManager] totalWorkers is required');

    this._total  = opts.totalWorkers;
    this._log    = opts.logger || console;
    this._auto   = opts.autoRebalance !== false;

    /** @type {Map<string, object>} pool state by key */
    this._pools  = new Map();

    /** Per-pool pressure level history (last N samples) */
    this._pressureHistory = new Map();

    /** Rebalance tick handle */
    this._tickHandle = null;
    this._running    = false;

    this._allocate();

    if (this._auto) this.start();
  }

  // ─── Allocation ──────────────────────────────────────────────────────────

  /**
   * Initial pool allocation using POOLS fractions × totalWorkers.
   * Any remainder goes to RESERVE.
   * @private
   */
  _allocate() {
    let assigned = 0;
    for (const key of POOL_KEYS) {
      const frac = POOL_FRACTIONS[key] || 0;
      const cap  = Math.max(MIN_POOL_CAPACITY, Math.floor(this._total * frac));
      this._pools.set(key, {
        key,
        capacity:     cap,
        active:       0,
        idle:         cap,
        throughputOps:  0,        // tasks completed since last tick
        avgLatencyMs:   0,        // rolling average ms
        _latencySum:    0,
        _latencyCount:  0,
      });
      this._pressureHistory.set(key, []);
      assigned += cap;
      this.emit('allocated', { pool: key, capacity: cap });
    }

    // Top-up RESERVE with any remainder
    const remainder = this._total - assigned;
    if (remainder > 0) {
      const reserve = this._pools.get('RESERVE');
      reserve.capacity += remainder;
      reserve.idle     += remainder;
    }

    this._log.info('[PoolManager] allocated total=%d pools=%j',
      this._total,
      Object.fromEntries([...this._pools.entries()].map(([k, v]) => [k, v.capacity])));
  }

  // ─── Start / Stop ─────────────────────────────────────────────────────────

  start() {
    if (this._running) return this;
    this._running = true;
    this._scheduleRebalance();
    return this;
  }

  stop() {
    this._running = false;
    if (this._tickHandle) {
      clearTimeout(this._tickHandle);
      this._tickHandle = null;
    }
  }

  // ─── Worker lifecycle ─────────────────────────────────────────────────────

  /**
   * Mark a worker as active in the given pool.
   * @param {string} pool
   * @returns {boolean} true if a worker was available
   */
  acquire(pool) {
    const p = this._pools.get(pool);
    if (!p || p.idle <= 0) return false;
    p.idle--;
    p.active++;
    return true;
  }

  /**
   * Release a worker back to idle, recording latency.
   * @param {string} pool
   * @param {number} [latencyMs]
   */
  release(pool, latencyMs) {
    const p = this._pools.get(pool);
    if (!p || p.active <= 0) return;
    p.active--;
    p.idle++;
    p.throughputOps++;
    if (latencyMs != null) {
      p._latencySum   += latencyMs;
      p._latencyCount++;
      p.avgLatencyMs = p._latencySum / p._latencyCount;
    }
  }

  // ─── Rebalancing ──────────────────────────────────────────────────────────

  /**
   * Compute utilization ratio for a pool.
   * @param {string} pool
   * @returns {number} [0, 1]
   */
  utilization(pool) {
    const p = this._pools.get(pool);
    if (!p || p.capacity === 0) return 0;
    return p.active / p.capacity;
  }

  /**
   * Rebalance under pressure: borrow from lower-priority pools and donate
   * to over-loaded ones. Uses Fibonacci step sizes based on pressure level.
   *
   * Strategy:
   *   NOMINAL   → no action
   *   ELEVATED  → borrow STEP_SMALL (5) from COLD into HOT
   *   HIGH      → borrow STEP_MEDIUM (8) from COLD+WARM into HOT
   *   CRITICAL  → borrow STEP_LARGE (13) from COLD+WARM+RESERVE into HOT
   * @private
   */
  _rebalance() {
    const hotUtil = this.utilization('HOT');
    const level   = getPressureLevel(hotUtil);

    if (level.label === 'NOMINAL') return;

    const step = level.label === 'ELEVATED' ? STEP_SMALL
               : level.label === 'HIGH'     ? STEP_MEDIUM
               :                              STEP_LARGE;   // CRITICAL

    // Donor pools in order of lowest priority
    const donors = ['COLD', 'WARM', 'RESERVE'];
    let remaining = step;

    for (const donorKey of donors) {
      if (remaining <= 0) break;
      const donor = this._pools.get(donorKey);
      const hot   = this._pools.get('HOT');

      const available = Math.max(0, donor.idle - MIN_POOL_CAPACITY);
      const transfer  = Math.min(available, remaining);
      if (transfer <= 0) continue;

      donor.capacity -= transfer;
      donor.idle     -= transfer;
      hot.capacity   += transfer;
      hot.idle       += transfer;
      remaining      -= transfer;

      this.emit('rebalanced', {
        from:     donorKey,
        to:       'HOT',
        workers:  transfer,
        pressure: level.label,
      });

      this._log.info('[PoolManager] rebalance from=%s to=HOT workers=%d pressure=%s',
        donorKey, transfer, level.label);
    }
  }

  /** @private */
  _scheduleRebalance() {
    if (!this._running) return;
    this._tickHandle = setTimeout(() => {
      this._tick();
      this._scheduleRebalance();
    }, REBALANCE_TICK_MS);
  }

  /** @private */
  _tick() {
    for (const [key, p] of this._pools.entries()) {
      const util = p.capacity > 0 ? p.active / p.capacity : 0;
      const level = getPressureLevel(util);

      // Emit pressure events on level change
      const history = this._pressureHistory.get(key);
      const prev = history[history.length - 1];
      if (prev !== level.label) {
        history.push(level.label);
        if (history.length > fib(6)) history.shift(); // keep last fib(6)=8 entries
        this.emit('pressure', { pool: key, level: level.label, utilization: util });
      }

      this.emit('metric', {
        pool:        key,
        utilization: util,
        throughput:  p.throughputOps,
        latencyMs:   Math.round(p.avgLatencyMs),
      });

      // Reset per-tick counters
      p.throughputOps = 0;
    }

    this._rebalance();
  }

  // ─── Inspect ─────────────────────────────────────────────────────────────

  /**
   * Return full pool state snapshot.
   * @returns {object}
   */
  snapshot() {
    const result = {};
    for (const [key, p] of this._pools.entries()) {
      result[key] = {
        capacity:     p.capacity,
        active:       p.active,
        idle:         p.idle,
        utilization:  p.capacity > 0 ? Number((p.active / p.capacity).toFixed(4)) : 0,
        avgLatencyMs: Math.round(p.avgLatencyMs),
        pressure:     getPressureLevel(p.capacity > 0 ? p.active / p.capacity : 0).label,
      };
    }
    return result;
  }

  /**
   * Return per-pool metrics (utilization, throughput, latency).
   * @returns {object}
   */
  metrics() {
    const snap = this.snapshot();
    const total = this._total;
    return {
      pools: snap,
      totalWorkers: total,
      fractions: POOL_FRACTIONS,
      steps: { SMALL: STEP_SMALL, MEDIUM: STEP_MEDIUM, LARGE: STEP_LARGE, MAJOR: STEP_MAJOR },
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  PoolManager,
  POOL_FRACTIONS,
  POOL_KEYS,
  STEP_SMALL,
  STEP_MEDIUM,
  STEP_LARGE,
  STEP_MAJOR,
  MIN_POOL_CAPACITY,
  REBALANCE_TICK_MS,
};

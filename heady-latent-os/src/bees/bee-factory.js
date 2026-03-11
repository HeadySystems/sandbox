/**
 * @fileoverview Heady™ Bee Factory — Worker Bee Lifecycle Management
 *
 * Creates, monitors, and destroys bee worker instances across 17 swarms
 * and fib(11)=89 bee types. Maximum fib(20)=6,765 concurrent bees hard-
 * capped at BEE.MAX_TOTAL=10,000.
 *
 * Lifecycle states (BEE.LIFECYCLE):
 *   SPAWN → INITIALIZE → READY → ACTIVE → DRAINING → SHUTDOWN → DEAD
 *
 * Pre-warm pool sizes from Fibonacci: [fib(5), fib(6), fib(7), fib(8)] = [5, 8, 13, 21]
 *
 * Scaling:
 *   - Scale-up  when queue > pool × PHI  (≈ 1.618)
 *   - Scale-down when idle  > pool × (1 − 1/PHI) for > BEE.STALE_MS (60s)
 *
 * Heartbeat monitoring:
 *   - Bees report heartbeat on every task completion
 *   - After BEE.STALE_MS (60,000ms) with no heartbeat → marked DEAD
 *
 * All constants from phi-math — ZERO magic numbers.
 *
 * @module bee-factory
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
  BEE,
  PRESSURE,
  getPressureLevel,
} = require('../../shared/phi-math.js');

// ─── Factory constants ────────────────────────────────────────────────────────

/** Pre-warm sizes: [5, 8, 13, 21] from Fibonacci */
const PRE_WARM_SIZES = BEE.PRE_WARM;          // [fib(5), fib(6), fib(7), fib(8)]

/** Scale-up trigger ratio: queue > pool × PHI */
const SCALE_UP_RATIO = BEE.SCALE_UP;           // PHI ≈ 1.618

/** Scale-down idle ratio: idle > pool × (1 − 1/PHI) = PSI ≈ 0.382 */
const SCALE_DOWN_RATIO = 1 - 1 / PHI;          // ≈ 0.382

/** Heartbeat stale threshold: 60,000ms */
const STALE_MS = BEE.STALE_MS;                 // 60,000ms

/** Maximum total concurrent bees across all swarms */
const MAX_TOTAL_BEES = BEE.MAX_TOTAL;          // 10,000

/** Number of swarms */
const SWARM_COUNT = BEE.SWARMS;                // 17

/** Number of bee types */
const BEE_TYPES = BEE.TYPES;                   // fib(11) = 89

/** Lifecycle state enum */
const LIFECYCLE = Object.freeze(
  Object.fromEntries(BEE.LIFECYCLE.map(s => [s, s]))
);

/** Heartbeat monitor tick: PHI_TIMING.PHI_4 ≈ 6,854ms */
const HEARTBEAT_TICK_MS = PHI_TIMING.PHI_4;

/** Fibonacci-stepped scale increment: fib(6) = 8 */
const SCALE_STEP = fib(6);

/** Minimum pool floor per swarm: fib(5) = 5 */
const MIN_POOL_FLOOR = fib(5);

// ─── Bee descriptor ───────────────────────────────────────────────────────────

let _beeIdCounter = 0;

/**
 * Create a new bee descriptor object.
 * @param {string} swarmId
 * @param {string} type
 * @returns {object} bee descriptor
 */
function _createBee(swarmId, type) {
  const id = `bee-${swarmId}-${type}-${(++_beeIdCounter).toString(36)}`;
  return {
    id,
    swarmId,
    type,
    state:          LIFECYCLE.SPAWN,
    spawnedAt:      Date.now(),
    lastHeartbeat:  Date.now(),
    tasksCompleted: 0,
    currentTaskId:  null,
  };
}

// ─── BeeFactory class ─────────────────────────────────────────────────────────

/**
 * @class BeeFactory
 * @extends EventEmitter
 *
 * Manages the full lifecycle of bee workers across multiple swarms.
 *
 * Events:
 *   'bee:spawned'     ({bee})                      — new bee created
 *   'bee:ready'       ({beeId, swarmId})            — bee initialized and ready
 *   'bee:activated'   ({beeId, taskId})             — bee picked up a task
 *   'bee:draining'    ({beeId})                     — bee finishing last task
 *   'bee:dead'        ({beeId, reason})             — bee removed from pool
 *   'swarm:scaled'    ({swarmId, direction, count}) — swarm grew or shrunk
 *   'heartbeat:stale' ({beeId, staleMs})            — missed heartbeat
 */
class BeeFactory extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object} [opts.logger] - logger with .info/.warn/.error
   */
  constructor(opts = {}) {
    super();
    this._log = opts.logger || console;

    /**
     * swarmId → { bees: Map<beeId, bee>, queue: number, type: string }
     * @type {Map<string, object>}
     */
    this._swarms = new Map();

    /** Global bee registry: beeId → bee */
    this._bees = new Map();

    /** Heartbeat monitor handle */
    this._heartbeatHandle = null;
    this._running = false;

    this._log.info('[BeeFactory] init maxTotal=%d swarms=%d types=%d preWarm=%j',
      MAX_TOTAL_BEES, SWARM_COUNT, BEE_TYPES, PRE_WARM_SIZES);
  }

  // ─── Swarm management ─────────────────────────────────────────────────────

  /**
   * Register a new swarm and pre-warm it to the appropriate Fibonacci size.
   * Pre-warm level is selected by swarm index (clamped to PRE_WARM_SIZES length).
   *
   * @param {string} swarmId   - unique swarm identifier
   * @param {string} beeType   - bee type for this swarm (one of 89 types)
   * @param {number} [level]   - pre-warm level 0–3 → sizes [5, 8, 13, 21]
   * @returns {object} swarm descriptor
   */
  registerSwarm(swarmId, beeType, level = 0) {
    if (this._swarms.has(swarmId)) {
      this._log.warn('[BeeFactory] swarm already registered: %s', swarmId);
      return this._swarms.get(swarmId);
    }

    const clampedLevel = Math.min(Math.max(level, 0), PRE_WARM_SIZES.length - 1);
    const preWarmCount = PRE_WARM_SIZES[clampedLevel];

    const swarm = {
      id:    swarmId,
      type:  beeType,
      bees:  new Map(),
      queue: 0,
    };
    this._swarms.set(swarmId, swarm);

    // Pre-warm
    this._growSwarm(swarmId, preWarmCount);

    this._log.info('[BeeFactory] swarm registered id=%s type=%s preWarm=%d',
      swarmId, beeType, preWarmCount);

    return swarm;
  }

  // ─── Bee lifecycle ────────────────────────────────────────────────────────

  /**
   * Spawn N bees for a swarm (respects MAX_TOTAL_BEES).
   * @private
   */
  _growSwarm(swarmId, count) {
    const swarm = this._swarms.get(swarmId);
    if (!swarm) return;

    const available = MAX_TOTAL_BEES - this._bees.size;
    const toSpawn   = Math.min(count, available);

    for (let i = 0; i < toSpawn; i++) {
      const bee = _createBee(swarmId, swarm.type);
      this._bees.set(bee.id, bee);
      swarm.bees.set(bee.id, bee);
      this.emit('bee:spawned', { bee });

      // Transition through SPAWN → INITIALIZE → READY
      setImmediate(() => this._initialize(bee));
    }

    if (toSpawn < count) {
      this._log.warn('[BeeFactory] MAX_TOTAL_BEES reached, only spawned %d/%d', toSpawn, count);
    }
  }

  /**
   * Transition a bee through SPAWN → INITIALIZE → READY.
   * @private
   */
  _initialize(bee) {
    bee.state = LIFECYCLE.INITIALIZE;
    // Simulate async init (in production: connect to message broker, load config, etc.)
    setImmediate(() => {
      if (this._bees.has(bee.id)) {
        bee.state         = LIFECYCLE.READY;
        bee.lastHeartbeat = Date.now();
        this.emit('bee:ready', { beeId: bee.id, swarmId: bee.swarmId });
      }
    });
  }

  /**
   * Assign a task to an idle bee in the given swarm.
   * Returns the bee that accepted the task, or null if none available.
   *
   * @param {string} swarmId
   * @param {string} taskId
   * @returns {object|null} bee descriptor or null
   */
  assignTask(swarmId, taskId) {
    const swarm = this._swarms.get(swarmId);
    if (!swarm) return null;

    // Find a READY bee
    for (const [, bee] of swarm.bees) {
      if (bee.state === LIFECYCLE.READY) {
        bee.state         = LIFECYCLE.ACTIVE;
        bee.currentTaskId = taskId;
        bee.lastHeartbeat = Date.now();
        this.emit('bee:activated', { beeId: bee.id, taskId });

        // Check if we need to scale up
        swarm.queue = Math.max(0, swarm.queue - 1);
        this._checkScaleUp(swarmId);
        return bee;
      }
    }

    // No idle bee available — increment queue pressure
    swarm.queue++;
    this._checkScaleUp(swarmId);
    return null;
  }

  /**
   * Mark a task as completed, releasing the bee back to READY.
   *
   * @param {string} beeId   - the bee that completed the task
   * @param {object} [opts]
   * @param {boolean} [opts.drain] - put bee into DRAINING for graceful shutdown
   */
  completeTask(beeId, opts = {}) {
    const bee = this._bees.get(beeId);
    if (!bee) return;

    bee.tasksCompleted++;
    bee.lastHeartbeat = Date.now();
    bee.currentTaskId = null;

    if (opts.drain) {
      bee.state = LIFECYCLE.DRAINING;
      this.emit('bee:draining', { beeId });
      setImmediate(() => this._shutdown(bee));
    } else {
      bee.state = LIFECYCLE.READY;
    }
  }

  // ─── Shutdown ────────────────────────────────────────────────────────────

  /**
   * Gracefully shut down a bee: DRAINING → SHUTDOWN → DEAD.
   * @private
   */
  _shutdown(bee) {
    bee.state = LIFECYCLE.SHUTDOWN;
    setImmediate(() => this._kill(bee, 'graceful'));
  }

  /**
   * Remove a bee from all registries and mark DEAD.
   * @private
   */
  _kill(bee, reason) {
    bee.state = LIFECYCLE.DEAD;
    this._bees.delete(bee.id);
    const swarm = this._swarms.get(bee.swarmId);
    if (swarm) swarm.bees.delete(bee.id);
    this.emit('bee:dead', { beeId: bee.id, reason });
  }

  // ─── Scaling ─────────────────────────────────────────────────────────────

  /**
   * Scale up a swarm if queue > pool × PHI.
   * @private
   */
  _checkScaleUp(swarmId) {
    const swarm   = this._swarms.get(swarmId);
    if (!swarm) return;

    const poolSize = swarm.bees.size;
    if (swarm.queue > poolSize * SCALE_UP_RATIO) {
      const addCount = SCALE_STEP;
      this._growSwarm(swarmId, addCount);
      this.emit('swarm:scaled', { swarmId, direction: 'UP', count: addCount });
      this._log.info('[BeeFactory] scale-UP swarm=%s +%d queue=%d pool=%d',
        swarmId, addCount, swarm.queue, poolSize);
    }
  }

  /**
   * Scale down a swarm: drain idle bees if idle > pool × SCALE_DOWN_RATIO.
   * Only drain bees that have been idle > STALE_MS.
   * Never drop below MIN_POOL_FLOOR (fib(5) = 5).
   * @private
   */
  _checkScaleDown(swarmId) {
    const swarm  = this._swarms.get(swarmId);
    if (!swarm) return;

    const now      = Date.now();
    const poolSize = swarm.bees.size;
    let   idleCount = 0;

    for (const [, bee] of swarm.bees) {
      if (bee.state === LIFECYCLE.READY) idleCount++;
    }

    const idleThreshold = poolSize * SCALE_DOWN_RATIO;
    if (idleCount <= idleThreshold) return;

    const excess    = Math.floor(idleCount - idleThreshold);
    const canRemove = Math.max(0, poolSize - MIN_POOL_FLOOR);
    const toRemove  = Math.min(excess, canRemove);
    if (toRemove <= 0) return;

    let removed = 0;
    for (const [, bee] of swarm.bees) {
      if (removed >= toRemove) break;
      if (bee.state === LIFECYCLE.READY && now - bee.lastHeartbeat > STALE_MS) {
        this._shutdown(bee);
        removed++;
      }
    }

    if (removed > 0) {
      this.emit('swarm:scaled', { swarmId, direction: 'DOWN', count: removed });
      this._log.info('[BeeFactory] scale-DOWN swarm=%s -%d idle=%d pool=%d',
        swarmId, removed, idleCount, poolSize);
    }
  }

  // ─── Heartbeat monitor ────────────────────────────────────────────────────

  /**
   * Start the heartbeat monitor loop.
   * @returns {BeeFactory} this
   */
  start() {
    if (this._running) return this;
    this._running = true;
    this._scheduleHeartbeat();
    this._log.info('[BeeFactory] heartbeat monitor started tick=%dms', HEARTBEAT_TICK_MS);
    return this;
  }

  /** Stop the heartbeat monitor. */
  stop() {
    this._running = false;
    if (this._heartbeatHandle) {
      clearTimeout(this._heartbeatHandle);
      this._heartbeatHandle = null;
    }
  }

  /** @private */
  _scheduleHeartbeat() {
    if (!this._running) return;
    this._heartbeatHandle = setTimeout(() => {
      this._checkHeartbeats();
      this._scheduleHeartbeat();
    }, HEARTBEAT_TICK_MS);
  }

  /**
   * Sweep all bees; kill any that haven't pulsed within STALE_MS.
   * Also run scale-down check for each swarm.
   * @private
   */
  _checkHeartbeats() {
    const now = Date.now();
    for (const [, bee] of this._bees) {
      if (bee.state === LIFECYCLE.ACTIVE && now - bee.lastHeartbeat > STALE_MS) {
        const staleMs = now - bee.lastHeartbeat;
        this.emit('heartbeat:stale', { beeId: bee.id, staleMs });
        this._log.warn('[BeeFactory] stale bee=%s staleMs=%d', bee.id, staleMs);
        this._kill(bee, 'heartbeat_timeout');
      }
    }

    for (const swarmId of this._swarms.keys()) {
      this._checkScaleDown(swarmId);
    }
  }

  /**
   * Record a heartbeat for an active bee.
   * @param {string} beeId
   */
  heartbeat(beeId) {
    const bee = this._bees.get(beeId);
    if (bee) bee.lastHeartbeat = Date.now();
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /**
   * Return total bee counts by lifecycle state.
   * @returns {object}
   */
  status() {
    const counts = Object.fromEntries(BEE.LIFECYCLE.map(s => [s, 0]));
    for (const [, bee] of this._bees) counts[bee.state]++;

    const swarmSummary = {};
    for (const [id, swarm] of this._swarms) {
      swarmSummary[id] = {
        type:  swarm.type,
        bees:  swarm.bees.size,
        queue: swarm.queue,
      };
    }

    return {
      total:       this._bees.size,
      maxTotal:    MAX_TOTAL_BEES,
      swarmCount:  this._swarms.size,
      beeTypes:    BEE_TYPES,
      counts,
      swarms:      swarmSummary,
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  BeeFactory,
  LIFECYCLE,
  PRE_WARM_SIZES,
  SCALE_UP_RATIO,
  SCALE_DOWN_RATIO,
  STALE_MS,
  MAX_TOTAL_BEES,
  SWARM_COUNT,
  BEE_TYPES,
  SCALE_STEP,
  MIN_POOL_FLOOR,
};

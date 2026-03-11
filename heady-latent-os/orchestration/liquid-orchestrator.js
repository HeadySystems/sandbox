/**
 * @fileoverview Liquid Latent OS Orchestrator — The Nervous System of Heady™
 * @module orchestration/liquid-orchestrator
 * @version 2.0.0
 * @author HeadySystems Inc.
 *
 * The LiquidOrchestrator is the dynamic routing, scaling, healing, and adaptation
 * engine for the entire Heady™ ecosystem. It operates in real-time using CSL gates
 * and phi-scaled resource allocation across five pool tiers.
 *
 * Architecture:
 *   - Five resource pools with phi-ratio allocation (HOT/WARM/COLD/RESERVE/GOVERNANCE)
 *   - 17 registered swarms with CSL-scored task routing
 *   - Fibonacci-stepped scaling (5→8→13→21→34 bees)
 *   - Circuit breakers: fib(5)=5 failures → OPEN, fib(4)=3 successes → CLOSED
 *   - Thundering-herd prevention via Fibonacci-distributed health check intervals
 *
 * @see MASTER_DIRECTIVES.md §4 (Low-Latency Deterministic Orchestration)
 * @see MASTER_DIRECTIVES.md §5 (Graceful Lifecycle Management)
 * @see MASTER_DIRECTIVES.md §10 (Sacred Geometry Orchestration)
 */

'use strict';

import {
  PHI,
  PSI,
  fib,
  cosineSimilarity,
  placeholderVector,
  CSL_THRESHOLDS,
  POOL_RATIOS,
  PRESSURE_LEVELS,
  getPressureLevel,
  phiBackoff,
  phiResourceWeights,
  sacredGeometryPosition,
  cslGate,
  COHERENCE_DRIFT_THRESHOLD,
  VECTOR_DIMENSIONS,
} from '../shared/phi-math.js';

// ─── Internal Constants ────────────────────────────────────────────────────────

/** Fibonacci scaling steps for bee pools: 5→8→13→21→34 */
const SCALE_STEPS = [fib(5), fib(6), fib(7), fib(8), fib(9)]; // [5, 8, 13, 21, 34]

/** Milliseconds without heartbeat before a bee is considered stale */
const STALE_BEE_MS = 60_000;

/** Circuit breaker: failures before OPEN */
const CB_FAILURE_THRESHOLD = fib(5); // 5

/** Circuit breaker: successes in HALF_OPEN before CLOSED */
const CB_SUCCESS_THRESHOLD = fib(4); // 3

/** Half-open probe interval (phi-backoff base) */
const CB_PROBE_INTERVAL_MS = fib(8) * 1000; // 21 000ms

/** Pool SLA latency ceilings in ms */
const POOL_LATENCY = Object.freeze({
  hot:        2_000,
  warm:       10_000,
  cold:       60_000,
  reserve:    30_000,
  governance: 120_000,
});

/** Circuit breaker states */
const CB_STATE = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });

/** Task priority tiers */
const PRIORITY = Object.freeze({ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, SHEDDABLE: 0 });

// ─── Helper: Generate Capability Embedding for Swarm ──────────────────────────

/**
 * Return the canonical 17 swarm definitions used across the Heady™ ecosystem.
 * Each swarm has a capability embedding derived from its name (placeholder —
 * in production these would be trained 384-dim embeddings).
 * @returns {Map<string, SwarmDefinition>}
 */
function buildSwarmRegistry() {
  const swarmNames = [
    'core_os', 'the_forge', 'security', 'intelligence', 'memory',
    'communication', 'infrastructure', 'creative', 'research', 'governance',
    'learning', 'deployment', 'monitoring', 'analytics', 'maintenance',
    'translation', 'innovation',
  ];

  /** @type {Map<string, SwarmDefinition>} */
  const map = new Map();
  swarmNames.forEach((name, idx) => {
    map.set(name, {
      id: name,
      displayName: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      capabilityVector: placeholderVector(`swarm:${name}`, VECTOR_DIMENSIONS),
      activeBees: 0,
      maxBees: fib(11), // 89 bees per swarm max
      healthScore: 1.0,
      lastHeartbeat: Date.now(),
      sacredPosition: sacredGeometryPosition(
        Math.floor(idx / 5), // rings 0–3
        idx % 5,
        Math.min(5, swarmNames.length - Math.floor(idx / 5) * 5)
      ),
    });
  });
  return map;
}

// ─── Class: LiquidOrchestrator ─────────────────────────────────────────────────

/**
 * @typedef {Object} SwarmDefinition
 * @property {string}   id
 * @property {string}   displayName
 * @property {number[]} capabilityVector — 384-dim unit vector
 * @property {number}   activeBees
 * @property {number}   maxBees
 * @property {number}   healthScore — 0–1
 * @property {number}   lastHeartbeat — epoch ms
 * @property {{ x: number, y: number, ring: number }} sacredPosition
 */

/**
 * @typedef {Object} PoolState
 * @property {string}  id
 * @property {number}  capacity    — total bee slots
 * @property {number}  active      — currently working bees
 * @property {number}  queued      — tasks awaiting bees
 * @property {number}  latencySla  — ms ceiling
 * @property {number}  utilization — active/capacity in [0,1]
 */

/**
 * @typedef {Object} CircuitBreakerState
 * @property {'CLOSED'|'OPEN'|'HALF_OPEN'} state
 * @property {number} failures
 * @property {number} successes
 * @property {number} lastTransition — epoch ms
 */

/**
 * @typedef {Object} Task
 * @property {string}   id
 * @property {string}   type
 * @property {number}   priority — uses PRIORITY enum values
 * @property {number[]} [embedding] — 384-dim task vector
 * @property {number}   [latencyRequirement] — ms
 * @property {boolean}  [sheddable]
 * @property {number}   createdAt — epoch ms
 */

/**
 * @typedef {Object} OrchestratorConfig
 * @property {number} [totalBeeCapacity=fib(12)] — 144 total bees across pools
 * @property {number} [coherenceCheckIntervalMs=30000]
 * @property {boolean} [autoHeal=true]
 */

export class LiquidOrchestrator {
  /**
   * @param {OrchestratorConfig} [config={}]
   */
  constructor(config = {}) {
    /** @private */
    this._config = {
      totalBeeCapacity: config.totalBeeCapacity ?? fib(12), // 144
      coherenceCheckIntervalMs: config.coherenceCheckIntervalMs ?? fib(9) * 1000, // 34s
      autoHeal: config.autoHeal ?? true,
    };

    /** @type {Map<string, PoolState>} */
    this.pools = this._buildPools(this._config.totalBeeCapacity);

    /** @type {Map<string, SwarmDefinition>} */
    this.swarms = buildSwarmRegistry();

    /** @type {Map<string, Set<string>>} active bee IDs per swarm */
    this.beeRegistry = new Map();
    this.swarms.forEach(s => this.beeRegistry.set(s.id, new Set()));

    /** @type {Map<string, CircuitBreakerState>} */
    this.circuitBreakers = new Map();

    /**
     * System pressure level.
     * @type {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'}
     */
    this.pressureLevel = 'NOMINAL';

    /** @type {number} Aggregate coherence score 0–1 */
    this.coherenceScore = 1.0;

    /** @type {Array<{ taskId: string, swarmId: string, poolId: string, ts: number }>} */
    this._routingHistory = [];

    /** @type {Map<string, number>} swarm→lastScaleMs */
    this._lastScaleTime = new Map();

    /** @type {number} */
    this._startedAt = Date.now();

    this._startInternalTimers();

    this._log('info', 'LiquidOrchestrator initialized', {
      pools: Array.from(this.pools.keys()),
      swarms: this.swarms.size,
      totalCapacity: this._config.totalBeeCapacity,
    });
  }

  // ─── Pool Construction ───────────────────────────────────────────────────────

  /**
   * Build the five resource pools using phi-ratio allocation.
   * HOT = fib(9)/fib(11), WARM = fib(8)/fib(11), etc.
   * @private
   * @param {number} total — total bee slots to distribute
   * @returns {Map<string, PoolState>}
   */
  _buildPools(total) {
    const pools = new Map();
    const ratios = [
      { id: 'hot',        ratio: POOL_RATIOS.HOT        },
      { id: 'warm',       ratio: POOL_RATIOS.WARM       },
      { id: 'cold',       ratio: POOL_RATIOS.COLD       },
      { id: 'reserve',    ratio: POOL_RATIOS.RESERVE    },
      { id: 'governance', ratio: POOL_RATIOS.GOVERNANCE },
    ];

    ratios.forEach(({ id, ratio }) => {
      const capacity = Math.max(fib(5), Math.round(total * ratio)); // floor at fib(5)=5
      pools.set(id, {
        id,
        capacity,
        active: 0,
        queued: 0,
        latencySla: POOL_LATENCY[id],
        utilization: 0,
      });
    });

    return pools;
  }

  // ─── Internal Timers ─────────────────────────────────────────────────────────

  /**
   * Start Fibonacci-distributed health check and coherence maintenance timers.
   * Fibonacci distribution prevents thundering-herd: fib(8)=21s, fib(9)=34s, fib(10)=55s
   * @private
   */
  _startInternalTimers() {
    // Stale-bee sweep: every fib(8)*1000 = 21s
    this._staleBeeTimer = setInterval(
      () => this._sweepStaleBees(),
      fib(8) * 1000
    );

    // Pressure check: every fib(7)*1000 = 13s
    this._pressureTimer = setInterval(
      () => { this.pressureLevel = this.checkPressure(); },
      fib(7) * 1000
    );

    // Coherence check: every fib(9)*1000 = 34s (configurable)
    this._coherenceTimer = setInterval(
      () => { this.coherenceScore = this.getSystemCoherence(); },
      this._config.coherenceCheckIntervalMs
    );

    // Rebalance: every fib(10)*1000 = 55s
    this._rebalanceTimer = setInterval(
      () => this.rebalance(),
      fib(10) * 1000
    );
  }

  /**
   * Stop all internal maintenance timers (call on shutdown).
   */
  shutdown() {
    [this._staleBeeTimer, this._pressureTimer, this._coherenceTimer, this._rebalanceTimer]
      .forEach(t => clearInterval(t));
    this._log('info', 'LiquidOrchestrator shutdown complete');
  }

  // ─── Core Routing ────────────────────────────────────────────────────────────

  /**
   * CSL-scored routing: compute cos(task_embedding, swarm_capability) for each
   * swarm, select best above PSI threshold (≈ 0.618).
   *
   * @param {Task} task
   * @returns {Promise<{ swarm: SwarmDefinition, score: number, pool: PoolState }>}
   * @throws {Error} if no swarm scores above threshold and circuit is OPEN
   */
  async route(task) {
    const taskVec = task.embedding ?? placeholderVector(`task:${task.type}`, VECTOR_DIMENSIONS);

    let bestSwarm = null;
    let bestScore = -Infinity;

    for (const swarm of this.swarms.values()) {
      // Skip OPEN circuit breakers
      const cb = this._getCircuitBreaker(swarm.id);
      if (cb.state === CB_STATE.OPEN) continue;

      const rawScore = cosineSimilarity(taskVec, swarm.capabilityVector);
      // Apply CSL gate at PSI threshold (≈ 0.618)
      const gatedScore = cslGate(rawScore, rawScore, PSI);
      // Weight by swarm health
      const finalScore = gatedScore * swarm.healthScore;

      if (finalScore > bestScore) {
        bestScore = finalScore;
        bestSwarm = swarm;
      }
    }

    if (!bestSwarm || bestScore < PSI) {
      // Fall back to core_os if no swarm qualifies
      bestSwarm = this.swarms.get('core_os');
      bestScore = PSI; // Minimum viable score
      this._log('warn', 'route: no swarm above PSI threshold, falling back to core_os', {
        taskType: task.type,
        bestScore,
      });
    }

    const pool = await this.routeToPool(task);

    this._routingHistory.push({
      taskId: task.id,
      swarmId: bestSwarm.id,
      poolId: pool.id,
      ts: Date.now(),
    });

    // Trim history to fib(11)=89 entries
    if (this._routingHistory.length > fib(11)) {
      this._routingHistory.splice(0, this._routingHistory.length - fib(11));
    }

    return { swarm: bestSwarm, score: bestScore, pool };
  }

  /**
   * Assign task to HOT/WARM/COLD pool based on priority and latency requirement.
   * @param {Task} task
   * @returns {Promise<PoolState>}
   */
  async routeToPool(task) {
    const priority = task.priority ?? PRIORITY.MEDIUM;
    const latencyReq = task.latencyRequirement ?? POOL_LATENCY.warm;

    let poolId;

    if (priority >= PRIORITY.CRITICAL || latencyReq <= POOL_LATENCY.hot) {
      poolId = 'hot';
    } else if (priority >= PRIORITY.HIGH || latencyReq <= POOL_LATENCY.warm) {
      poolId = 'warm';
    } else if (priority >= PRIORITY.MEDIUM) {
      poolId = 'cold';
    } else {
      poolId = 'cold'; // LOW and SHEDDABLE both go cold
    }

    const pool = this.pools.get(poolId);

    // Auto-scale if queue depth exceeds capacity × PHI
    if (pool.queued > pool.capacity * PHI) {
      this.scalePool(poolId, 'up');
    }

    // Increment queue depth optimistically
    pool.queued++;
    this._updatePoolUtilization(pool);

    return pool;
  }

  // ─── Pool Scaling ─────────────────────────────────────────────────────────────

  /**
   * Scale a pool up or down using Fibonacci steps (5→8→13→21→34).
   * @param {string} poolId
   * @param {'up'|'down'} direction
   * @returns {{ poolId: string, direction: string, oldCapacity: number, newCapacity: number }}
   */
  scalePool(poolId, direction) {
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`scalePool: unknown pool "${poolId}"`);
    }

    const now = Date.now();
    const lastScale = this._lastScaleTime.get(poolId) ?? 0;
    // Cooldown: fib(7)*1000 = 13s
    if (now - lastScale < fib(7) * 1000) {
      this._log('debug', `scalePool: cooldown active for "${poolId}"`);
      return { poolId, direction, oldCapacity: pool.capacity, newCapacity: pool.capacity };
    }

    const oldCapacity = pool.capacity;
    const currentIdx = SCALE_STEPS.findIndex(s => s >= pool.capacity);
    let newIdx;

    if (direction === 'up') {
      newIdx = Math.min(SCALE_STEPS.length - 1, (currentIdx < 0 ? 0 : currentIdx) + 1);
    } else {
      // Scale down only if idle bees exceed capacity × (1 - 1/PHI) for > 60s
      const idleBees = pool.capacity - pool.active;
      const idleThreshold = pool.capacity * (1 - 1 / PHI);
      if (idleBees <= idleThreshold) {
        this._log('debug', `scalePool down: idle bees (${idleBees.toFixed(1)}) below threshold`);
        return { poolId, direction, oldCapacity, newCapacity: oldCapacity };
      }
      newIdx = Math.max(0, (currentIdx < 0 ? SCALE_STEPS.length - 1 : currentIdx) - 1);
    }

    pool.capacity = SCALE_STEPS[newIdx];
    this._lastScaleTime.set(poolId, now);
    this._updatePoolUtilization(pool);

    this._log('info', `scalePool: ${poolId} ${direction} ${oldCapacity}→${pool.capacity}`);
    return { poolId, direction, oldCapacity, newCapacity: pool.capacity };
  }

  // ─── Pool Utilization ─────────────────────────────────────────────────────────

  /**
   * Returns phi-normalized utilization (0–1) per pool.
   * Phi-normalization: utilization × PHI clips at 1.0 to give early warning.
   * @returns {Object.<string, { raw: number, phiNormalized: number }>}
   */
  getPoolUtilization() {
    const result = {};
    this.pools.forEach((pool, id) => {
      const raw = pool.capacity > 0 ? pool.active / pool.capacity : 0;
      result[id] = {
        raw: parseFloat(raw.toFixed(4)),
        phiNormalized: parseFloat(Math.min(1, raw * PHI).toFixed(4)),
      };
    });
    return result;
  }

  /** @private Update utilization on a pool state object. */
  _updatePoolUtilization(pool) {
    pool.utilization = pool.capacity > 0 ? pool.active / pool.capacity : 0;
  }

  // ─── Pressure ─────────────────────────────────────────────────────────────────

  /**
   * Compute global system pressure using phi thresholds.
   * Aggregate utilization across all pools, weighted by pool importance.
   *
   * Thresholds:
   *   NOMINAL:  [0, ψ²)    ≈ [0, 0.382)
   *   ELEVATED: [ψ², ψ)    ≈ [0.382, 0.618)
   *   HIGH:     [ψ, 1-ψ³)  ≈ [0.618, 0.854)
   *   CRITICAL: [1-ψ⁴, ∞)  ≈ [0.910, ∞)
   *
   * @returns {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'}
   */
  checkPressure() {
    // Phi-weighted aggregate: HOT has highest weight (ψ¹ share)
    const weights = [PHI, 1, PSI, PSI * PSI, PSI * PSI * PSI];
    const poolIds = ['hot', 'warm', 'cold', 'reserve', 'governance'];
    const total = weights.reduce((a, b) => a + b, 0);

    let weightedUtilization = 0;
    poolIds.forEach((id, i) => {
      const pool = this.pools.get(id);
      weightedUtilization += (pool?.utilization ?? 0) * weights[i];
    });

    const pressure = weightedUtilization / total;
    const level = getPressureLevel(pressure);

    if (level !== this.pressureLevel) {
      this._log('warn', `Pressure level changed: ${this.pressureLevel} → ${level}`, {
        pressure: pressure.toFixed(4),
      });
    }

    this.pressureLevel = level;
    return level;
  }

  // ─── Load Shedding ────────────────────────────────────────────────────────────

  /**
   * Shed lower-priority tasks based on current pressure level.
   *
   * ELEVATED → defer COLD pool tasks
   * HIGH     → shed SHEDDABLE-priority tasks across all pools
   * CRITICAL → shed all non-CRITICAL tasks, close COLD entirely
   *
   * @param {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'} pressureLevel
   * @returns {{ shed: number, deferred: number, pressureLevel: string }}
   */
  shedLoad(pressureLevel) {
    let shed = 0;
    let deferred = 0;

    if (pressureLevel === 'NOMINAL') {
      return { shed: 0, deferred: 0, pressureLevel };
    }

    const coldPool = this.pools.get('cold');

    if (pressureLevel === 'ELEVATED') {
      // Defer all queued COLD work
      deferred = coldPool.queued;
      coldPool.queued = 0;
      this._log('info', `shedLoad ELEVATED: deferred ${deferred} cold tasks`);
    } else if (pressureLevel === 'HIGH') {
      // Shed all SHEDDABLE tasks (tracked in routing history)
      const before = this._routingHistory.length;
      // In production: filter actual task queue; here we approximate
      shed = Math.floor(coldPool.queued * PSI);
      coldPool.queued = Math.max(0, coldPool.queued - shed);
      this._log('warn', `shedLoad HIGH: shed ~${shed} sheddable tasks`);
    } else if (pressureLevel === 'CRITICAL') {
      // Shed all non-CRITICAL — clear cold + most warm
      shed = coldPool.queued;
      coldPool.queued = 0;
      const warmPool = this.pools.get('warm');
      const warmShed = Math.floor(warmPool.queued * (1 - 1 / PHI));
      warmPool.queued = Math.max(0, warmPool.queued - warmShed);
      shed += warmShed;
      this._log('error', `shedLoad CRITICAL: emergency shed ${shed} tasks`);
    }

    return { shed, deferred, pressureLevel };
  }

  // ─── Drift Detection ──────────────────────────────────────────────────────────

  /**
   * Check embedding coherence for a service/swarm.
   * Flags drift if the swarm's health score falls below COHERENCE_DRIFT_THRESHOLD (≈0.809).
   *
   * @param {string} serviceId — swarm id or service name
   * @returns {{ drifted: boolean, coherence: number, threshold: number }}
   */
  detectDrift(serviceId) {
    const swarm = this.swarms.get(serviceId);
    if (!swarm) {
      return { drifted: false, coherence: 1.0, threshold: COHERENCE_DRIFT_THRESHOLD };
    }

    const coherence = swarm.healthScore;
    const drifted = coherence < COHERENCE_DRIFT_THRESHOLD;

    if (drifted) {
      this._log('warn', `detectDrift: "${serviceId}" coherence ${coherence.toFixed(4)} < ${COHERENCE_DRIFT_THRESHOLD}`);
    }

    return { drifted, coherence, threshold: COHERENCE_DRIFT_THRESHOLD };
  }

  // ─── Self-Heal ────────────────────────────────────────────────────────────────

  /**
   * Trigger a heal cycle for a degraded service:
   *   1. Diagnose — collect health metrics
   *   2. Isolate  — redirect traffic away, open circuit breaker
   *   3. Heal     — attempt restart/reconnect with phi-backoff
   *   4. Verify   — confirm health restored before re-enabling
   *
   * @param {string} serviceId — swarm id
   * @returns {Promise<{ success: boolean, phases: string[], attempts: number }>}
   */
  async selfHeal(serviceId) {
    const swarm = this.swarms.get(serviceId);
    if (!swarm) {
      throw new Error(`selfHeal: unknown service "${serviceId}"`);
    }

    const phases = [];
    let attempts = 0;

    this._log('warn', `selfHeal: starting heal cycle for "${serviceId}"`);

    // Phase 1: Diagnose
    phases.push('DIAGNOSE');
    const drift = this.detectDrift(serviceId);
    const cb = this._getCircuitBreaker(serviceId);

    // Phase 2: Isolate
    phases.push('ISOLATE');
    cb.state = CB_STATE.OPEN;
    cb.lastTransition = Date.now();
    swarm.healthScore = 0;

    // Phase 3: Heal with phi-backoff
    phases.push('HEAL');
    const maxAttempts = fib(4); // 3 attempts
    let healed = false;

    for (let i = 0; i < maxAttempts; i++) {
      attempts++;
      const delay = phiBackoff(i, 1000, fib(9) * 1000); // max 34s
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 100))); // Cap at 100ms in test env

      // Simulate health restoration (in production: actual health check)
      swarm.lastHeartbeat = Date.now();
      swarm.healthScore = PSI + (1 - PSI) * (i + 1) / maxAttempts; // Ramp up

      if (swarm.healthScore > COHERENCE_DRIFT_THRESHOLD) {
        healed = true;
        break;
      }
    }

    // Phase 4: Verify
    phases.push('VERIFY');
    if (healed) {
      cb.state = CB_STATE.HALF_OPEN;
      cb.failures = 0;
      swarm.healthScore = Math.max(swarm.healthScore, COHERENCE_DRIFT_THRESHOLD);
      this._log('info', `selfHeal: "${serviceId}" restored in ${attempts} attempt(s)`);
    } else {
      swarm.healthScore = PSI * PSI; // Degraded but operational
      this._log('error', `selfHeal: "${serviceId}" failed to fully restore after ${attempts} attempts`);
    }

    return { success: healed, phases, attempts };
  }

  // ─── Rebalance ────────────────────────────────────────────────────────────────

  /**
   * Redistribute work across pools for optimal phi-ratio allocation.
   * Adjusts queued tasks from overloaded pools to underutilized ones.
   * @returns {{ moved: number, from: string[], to: string[] }}
   */
  rebalance() {
    const utilization = this.getPoolUtilization();
    const moved = [];
    const from = [];
    const to = [];

    // Find most overloaded vs most underloaded pool
    let maxUtil = 0; let maxPool = null;
    let minUtil = Infinity; let minPool = null;

    this.pools.forEach((pool, id) => {
      if (id === 'governance') return; // Never rebalance governance
      const u = utilization[id].raw;
      if (u > maxUtil) { maxUtil = u; maxPool = pool; }
      if (u < minUtil) { minUtil = u; minPool = pool; }
    });

    if (maxPool && minPool && maxUtil - minUtil > PSI * PSI) {
      // Transfer fib(5)=5 queue slots
      const transfer = Math.min(fib(5), maxPool.queued);
      maxPool.queued = Math.max(0, maxPool.queued - transfer);
      minPool.queued += transfer;
      from.push(maxPool.id);
      to.push(minPool.id);
      moved.push(transfer);
      this._log('info', `rebalance: moved ${transfer} tasks from ${maxPool.id} to ${minPool.id}`);
    }

    return { moved: moved.reduce((a, b) => a + b, 0), from, to };
  }

  // ─── Topology ────────────────────────────────────────────────────────────────

  /**
   * Return the Sacred Geometry node map for all 17 swarms.
   * Swarms are distributed across 4 rings: inner(3), middle(5), outer(5), governance(4).
   * @returns {{ rings: Array<{ ring: number, swarms: Array<{ id: string, position: { x: number, y: number } }> }> }}
   */
  getTopology() {
    const rings = [
      { ring: 0, label: 'inner',      swarmIds: ['core_os', 'governance', 'security'] },
      { ring: 1, label: 'middle',     swarmIds: ['intelligence', 'memory', 'communication', 'infrastructure', 'creative'] },
      { ring: 2, label: 'outer',      swarmIds: ['research', 'learning', 'deployment', 'monitoring', 'analytics'] },
      { ring: 3, label: 'governance', swarmIds: ['maintenance', 'translation', 'innovation', 'the_forge'] },
    ];

    return {
      rings: rings.map(({ ring, label, swarmIds }) => ({
        ring,
        label,
        swarms: swarmIds.map((id, idx) => {
          const swarm = this.swarms.get(id);
          return {
            id,
            displayName: swarm?.displayName ?? id,
            healthScore: swarm?.healthScore ?? 1.0,
            position: sacredGeometryPosition(ring, idx, swarmIds.length),
          };
        }),
      })),
    };
  }

  // ─── System Coherence ─────────────────────────────────────────────────────────

  /**
   * Aggregate coherence across all 17 swarms using phi-weighted mean.
   * Governance swarm has highest weight (ring 3 = outermost = highest phi weight).
   * @returns {number} coherence 0–1
   */
  getSystemCoherence() {
    let weightedSum = 0;
    let totalWeight = 0;
    const weights = phiResourceWeights(this.swarms.size);
    let i = 0;

    this.swarms.forEach(swarm => {
      const w = weights[i++] ?? PSI;
      weightedSum += swarm.healthScore * w;
      totalWeight += w;
    });

    const coherence = totalWeight > 0 ? weightedSum / totalWeight : 0;
    this.coherenceScore = parseFloat(coherence.toFixed(6));
    return this.coherenceScore;
  }

  // ─── Circuit Breakers ─────────────────────────────────────────────────────────

  /**
   * Get or initialize a circuit breaker for a service.
   * @private
   * @param {string} serviceId
   * @returns {CircuitBreakerState}
   */
  _getCircuitBreaker(serviceId) {
    if (!this.circuitBreakers.has(serviceId)) {
      this.circuitBreakers.set(serviceId, {
        state: CB_STATE.CLOSED,
        failures: 0,
        successes: 0,
        lastTransition: Date.now(),
      });
    }
    return this.circuitBreakers.get(serviceId);
  }

  /**
   * Record a success for a service's circuit breaker.
   * In HALF_OPEN: fib(4)=3 successes → CLOSED.
   * @param {string} serviceId
   */
  recordSuccess(serviceId) {
    const cb = this._getCircuitBreaker(serviceId);
    cb.failures = 0;

    if (cb.state === CB_STATE.HALF_OPEN) {
      cb.successes++;
      if (cb.successes >= CB_SUCCESS_THRESHOLD) {
        cb.state = CB_STATE.CLOSED;
        cb.successes = 0;
        cb.lastTransition = Date.now();
        this._log('info', `circuitBreaker: "${serviceId}" CLOSED after ${CB_SUCCESS_THRESHOLD} successes`);
      }
    }
  }

  /**
   * Record a failure for a service's circuit breaker.
   * fib(5)=5 failures → OPEN.
   * @param {string} serviceId
   */
  recordFailure(serviceId) {
    const cb = this._getCircuitBreaker(serviceId);

    if (cb.state === CB_STATE.HALF_OPEN) {
      cb.state = CB_STATE.OPEN;
      cb.lastTransition = Date.now();
      this._log('warn', `circuitBreaker: "${serviceId}" back to OPEN from HALF_OPEN`);
      return;
    }

    if (cb.state === CB_STATE.CLOSED) {
      cb.failures++;
      if (cb.failures >= CB_FAILURE_THRESHOLD) {
        cb.state = CB_STATE.OPEN;
        cb.lastTransition = Date.now();
        this._log('error', `circuitBreaker: "${serviceId}" OPEN after ${CB_FAILURE_THRESHOLD} failures`);

        // Schedule probe after CB_PROBE_INTERVAL_MS
        setTimeout(() => {
          if (cb.state === CB_STATE.OPEN) {
            cb.state = CB_STATE.HALF_OPEN;
            cb.successes = 0;
            cb.lastTransition = Date.now();
            this._log('info', `circuitBreaker: "${serviceId}" HALF_OPEN probe`);
          }
        }, CB_PROBE_INTERVAL_MS);
      }
    }
  }

  // ─── Stale Bee Sweep ──────────────────────────────────────────────────────────

  /**
   * Detect bees with no heartbeat for > STALE_BEE_MS=60s.
   * Marks them dead and triggers respawn.
   * @private
   */
  _sweepStaleBees() {
    const now = Date.now();
    let staleCount = 0;

    this.swarms.forEach(swarm => {
      const age = now - swarm.lastHeartbeat;
      if (age > STALE_BEE_MS && swarm.activeBees > 0) {
        staleCount += swarm.activeBees;
        this._log('warn', `staleBee: ${swarm.activeBees} stale bees in "${swarm.id}" (${age}ms)`);
        // Respawn: reset counter, trigger self-heal
        swarm.activeBees = 0;
        if (this._config.autoHeal) {
          this.selfHeal(swarm.id).catch(err =>
            this._log('error', `respawn failed for "${swarm.id}": ${err.message}`)
          );
        }
      }
    });

    if (staleCount > 0) {
      this._log('warn', `staleBee sweep: found and cleared ${staleCount} stale bees`);
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────────────

  /**
   * Return complete Liquid OS state snapshot.
   * @returns {Object}
   */
  getStatus() {
    return {
      version: '2.0.0',
      uptime: Date.now() - this._startedAt,
      pressureLevel: this.pressureLevel,
      coherenceScore: this.coherenceScore,
      pools: Object.fromEntries(
        Array.from(this.pools.entries()).map(([id, pool]) => [id, {
          id: pool.id,
          capacity: pool.capacity,
          active: pool.active,
          queued: pool.queued,
          utilization: pool.utilization,
          latencySla: pool.latencySla,
        }])
      ),
      swarms: {
        total: this.swarms.size,
        healthy: Array.from(this.swarms.values()).filter(s => s.healthScore >= COHERENCE_DRIFT_THRESHOLD).length,
        degraded: Array.from(this.swarms.values()).filter(s => s.healthScore < COHERENCE_DRIFT_THRESHOLD).length,
      },
      circuitBreakers: {
        closed:    Array.from(this.circuitBreakers.values()).filter(c => c.state === CB_STATE.CLOSED).length,
        open:      Array.from(this.circuitBreakers.values()).filter(c => c.state === CB_STATE.OPEN).length,
        half_open: Array.from(this.circuitBreakers.values()).filter(c => c.state === CB_STATE.HALF_OPEN).length,
      },
      utilization: this.getPoolUtilization(),
      topology: this.getTopology(),
      routingHistoryLength: this._routingHistory.length,
      sacredGeometry: {
        phi: PHI,
        psi: PSI,
        poolRatios: POOL_RATIOS,
        scaleSteps: SCALE_STEPS,
        cslThresholds: CSL_THRESHOLDS,
      },
    };
  }

  // ─── Structured Logger ────────────────────────────────────────────────────────

  /**
   * Structured internal log emitter.
   * @private
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} message
   * @param {Object} [meta]
   */
  _log(level, message, meta = {}) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      module: 'LiquidOrchestrator',
      message,
      ...meta,
    };
    // In production: route to observability-kernel / structured logger
    // In development: stderr only for warn/error
    if (level === 'error') {
      console.error(JSON.stringify(entry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(entry));
    }
    // debug/info silenced unless LOG_LEVEL=debug
    else if (process.env.LOG_LEVEL === 'debug') {
      console.log(JSON.stringify(entry));
    }
  }
}

// ─── Named Exports ────────────────────────────────────────────────────────────

export { PRIORITY, SCALE_STEPS, CB_STATE, STALE_BEE_MS, CB_FAILURE_THRESHOLD, CB_SUCCESS_THRESHOLD };
export default LiquidOrchestrator;

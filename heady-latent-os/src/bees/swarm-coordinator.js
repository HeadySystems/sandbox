/**
 * @fileoverview Heady™ Swarm Coordinator — Multi-Swarm Task Orchestration
 *
 * Coordinates multiple bee swarms working on decomposed subtasks.
 * Uses CSL cosine routing to match subtasks to the optimal swarm.
 * Aggregates results with phi-weighted consensus scoring.
 * Load-balances across swarms using PRESSURE levels.
 *
 * Routing:
 *   - Each swarm has a domain vector (matches BeeFactory swarm types)
 *   - Subtasks are embedded and scored against swarm vectors via cosine similarity
 *   - Score must meet CSL_THRESHOLDS.MEDIUM (≈ 0.809) to route to a swarm
 *   - Fallback: round-robin across swarms under NOMINAL pressure
 *
 * Consensus:
 *   - Results from multiple swarms are phi-weighted by their confidence scores
 *   - Best-scoring result carries weight ≈ 0.618 (PSI)
 *
 * All constants from phi-math — ZERO magic numbers.
 *
 * @module swarm-coordinator
 * @see shared/phi-math.js
 * @see src/bees/bee-factory.js
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
  normalize,
} = require('../../shared/phi-math.js');

// ─── Coordinator constants ────────────────────────────────────────────────────

/** Minimum CSL score for swarm routing: MEDIUM ≈ 0.809 */
const ROUTE_THRESHOLD = CSL_THRESHOLDS.MEDIUM;

/** Consensus aggregation timeout per round: PHI_TIMING.PHI_7 ≈ 29,034ms */
const CONSENSUS_TIMEOUT_MS = PHI_TIMING.PHI_7;

/** Max subtasks dispatched concurrently: fib(6) = 8 */
const MAX_CONCURRENT_DISPATCH = fib(6);

/** Consensus minimum swarm responses before aggregating: fib(3) = 2 */
const MIN_RESPONSES_FOR_CONSENSUS = fib(3);

/** Phi-weighted consensus fusion weights: [0.618, 0.382] for top-2 */
const CONSENSUS_WEIGHTS = phiFusionWeights(2);

/** Round-robin pointer (per-instance, reset at max=fib(11)=89) */
const RR_MAX = fib(11); // 89 (matches BEE_TYPES)

// ─── SwarmCoordinator class ───────────────────────────────────────────────────

/**
 * @class SwarmCoordinator
 * @extends EventEmitter
 *
 * Manages task distribution across registered bee swarms and result aggregation.
 *
 * Events:
 *   'routed'      ({subtaskId, swarmId, score})       — subtask assigned to swarm
 *   'collected'   ({subtaskId, swarmId, score})        — result from one swarm
 *   'consensus'   ({taskId, result, confidence, swarms}) — final aggregated result
 *   'shed'        ({subtaskId, reason})                — subtask dropped under pressure
 *   'load'        ({swarmId, pressure, load})          — per-swarm load metric
 */
class SwarmCoordinator extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object} [opts.logger] - logger with .info/.warn/.error
   */
  constructor(opts = {}) {
    super();
    this._log = opts.logger || console;

    /**
     * swarmId → swarm descriptor { id, vector, load, beeFactory reference }
     * @type {Map<string, object>}
     */
    this._swarms = new Map();

    /** Round-robin pointer for tie-breaking */
    this._rrPointer = 0;

    /** In-flight dispatch groups: taskId → { pending, results, resolve, reject } */
    this._inflight = new Map();

    this._log.info('[SwarmCoordinator] init routeτ=%s consensusTimeout=%dms',
      ROUTE_THRESHOLD.toFixed(4), CONSENSUS_TIMEOUT_MS);
  }

  // ─── Swarm registration ───────────────────────────────────────────────────

  /**
   * Register a swarm with its domain vector and optional BeeFactory reference.
   *
   * @param {string}   swarmId      - unique swarm identifier
   * @param {number[]} domainVector - unit vector representing swarm's specialization
   * @param {object}   [factory]    - BeeFactory instance (for task assignment)
   * @returns {SwarmCoordinator} this
   */
  registerSwarm(swarmId, domainVector, factory) {
    if (this._swarms.has(swarmId)) {
      this._log.warn('[SwarmCoordinator] swarm already registered: %s', swarmId);
      return this;
    }

    this._swarms.set(swarmId, {
      id:      swarmId,
      vector:  normalize(domainVector),
      load:    0,       // active tasks
      factory: factory || null,
    });

    this._log.info('[SwarmCoordinator] registered swarm=%s', swarmId);
    return this;
  }

  // ─── Routing ──────────────────────────────────────────────────────────────

  /**
   * Route a subtask to the best-matching swarm using CSL cosine scoring.
   * Falls back to round-robin if no swarm meets ROUTE_THRESHOLD.
   *
   * @param {object} subtask
   * @param {string}   subtask.id     - unique subtask identifier
   * @param {number[]} subtask.vector - unit vector representing subtask
   * @returns {string|null} selected swarmId, or null if no swarms registered
   */
  route(subtask) {
    if (this._swarms.size === 0) return null;

    const swarmList = [...this._swarms.values()];

    // Score each swarm: combine CSL similarity with inverse load
    const scored = swarmList.map(sw => {
      const cosScore = cosineSimilarity(subtask.vector, sw.vector);
      const loadFrac = Math.min(sw.load / Math.max(1, fib(6)), 1);  // normalize load by fib(6)=8
      const score = CONSENSUS_WEIGHTS[0] * cosScore + CONSENSUS_WEIGHTS[1] * (1 - loadFrac);
      return { sw, score, cosScore };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0];

    // If best cosine score is below threshold, fall back to round-robin
    const swarmId = best.cosScore >= ROUTE_THRESHOLD
      ? best.sw.id
      : this._roundRobin(swarmList);

    const swarm = this._swarms.get(swarmId);
    swarm.load++;

    this.emit('routed', { subtaskId: subtask.id, swarmId, score: best.score });
    this.emit('load',   { swarmId, pressure: getPressureLevel(swarm.load / Math.max(1, fib(7))).label, load: swarm.load });

    return swarmId;
  }

  /** @private — round-robin swarm selection for low-confidence routing */
  _roundRobin(swarmList) {
    const idx = this._rrPointer % swarmList.length;
    this._rrPointer = (this._rrPointer + 1) % RR_MAX;
    return swarmList[idx].id;
  }

  // ─── Dispatch + collect ───────────────────────────────────────────────────

  /**
   * Dispatch a decomposed task to multiple swarms and await phi-weighted consensus.
   *
   * @param {object}   task
   * @param {string}     task.id       - parent task identifier
   * @param {object[]}   task.subtasks - array of { id, vector, payload } subtasks
   * @param {Function}   executor      - async fn(swarmId, subtask) → {output, score}
   * @returns {Promise<{ taskId, result, confidence, swarms, latencyMs }>}
   */
  async dispatch(task, executor) {
    const { id: taskId, subtasks = [] } = task;
    const startedAt = Date.now();

    if (subtasks.length === 0) {
      throw new TypeError(`[SwarmCoordinator.dispatch] task "${taskId}" has no subtasks`);
    }

    // Route all subtasks, batching into chunks ≤ MAX_CONCURRENT_DISPATCH
    const assignments = subtasks.map(st => ({
      subtask: st,
      swarmId: this.route(st),
    })).filter(a => a.swarmId !== null);

    // Execute in batches
    const allResults = [];
    for (let i = 0; i < assignments.length; i += MAX_CONCURRENT_DISPATCH) {
      const batch = assignments.slice(i, i + MAX_CONCURRENT_DISPATCH);

      const batchResults = await Promise.allSettled(
        batch.map(async ({ subtask, swarmId }) => {
          try {
            const r = await Promise.race([
              executor(swarmId, subtask),
              _timeout(CONSENSUS_TIMEOUT_MS, `subtask ${subtask.id} timeout`),
            ]);
            this.emit('collected', { subtaskId: subtask.id, swarmId, score: r.score });
            return { swarmId, output: r.output, score: r.score || 0 };
          } finally {
            // Release load on swarm
            const sw = this._swarms.get(swarmId);
            if (sw && sw.load > 0) sw.load--;
          }
        })
      );

      for (const res of batchResults) {
        if (res.status === 'fulfilled') allResults.push(res.value);
        else this._log.warn('[SwarmCoordinator] subtask failed: %s', res.reason && res.reason.message);
      }
    }

    // Aggregate with phi-weighted consensus
    const consensus = this._aggregate(taskId, allResults);
    consensus.latencyMs = Date.now() - startedAt;

    this.emit('consensus', consensus);
    this._log.info('[SwarmCoordinator] consensus task=%s swarms=%d confidence=%s latency=%dms',
      taskId, allResults.length, consensus.confidence.toFixed(4), consensus.latencyMs);

    return consensus;
  }

  // ─── Consensus aggregation ────────────────────────────────────────────────

  /**
   * Aggregate results from multiple swarms using phi-weighted scoring.
   * Top result carries CONSENSUS_WEIGHTS[0] ≈ 0.618 weight.
   *
   * @param {string}   taskId
   * @param {object[]} results - array of { swarmId, output, score }
   * @returns {{ taskId, result, confidence, swarms }}
   * @private
   */
  _aggregate(taskId, results) {
    if (results.length === 0) {
      return { taskId, result: null, confidence: 0, swarms: [] };
    }

    const sorted  = [...results].sort((a, b) => b.score - a.score);
    const weights = phiFusionWeights(Math.min(sorted.length, fib(4)));

    // Weighted confidence score
    const confidence = sorted.reduce((acc, r, i) => {
      return acc + (weights[i] || 0) * r.score;
    }, 0);

    // Primary result is the highest-scoring swarm's output
    return {
      taskId,
      result:     sorted[0].output,
      confidence: Number(confidence.toFixed(4)),
      swarms:     sorted.map((r, i) => ({
        swarmId: r.swarmId,
        score:   r.score,
        weight:  weights[i] || 0,
      })),
    };
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /**
   * Return current swarm load snapshot.
   * @returns {object[]}
   */
  swarmStatus() {
    return [...this._swarms.values()].map(sw => ({
      id:       sw.id,
      load:     sw.load,
      pressure: getPressureLevel(sw.load / Math.max(1, fib(7))).label,
    }));
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a promise that rejects after `ms` with a timeout error.
 * @private
 */
function _timeout(ms, label) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`[SwarmCoordinator] timeout: ${label}`)), ms)
  );
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  SwarmCoordinator,
  ROUTE_THRESHOLD,
  CONSENSUS_TIMEOUT_MS,
  MAX_CONCURRENT_DISPATCH,
  MIN_RESPONSES_FOR_CONSENSUS,
  CONSENSUS_WEIGHTS,
};

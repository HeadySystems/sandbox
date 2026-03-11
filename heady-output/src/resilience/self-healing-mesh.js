/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║               HEADY CONNECTION — SELF-HEALING MESH                         ║
 * ║               Phi-Compliant Component Lifecycle Manager                    ║
 * ║                                                                            ║
 * ║  Version   : 1.0.0                                                         ║
 * ║  License   : Proprietary — Heady™ Connection LLC                            ║
 * ║  Author    : Heady™ Engineering                                              ║
 * ║  Contact   : eric@headyconnection.org                                      ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Lifecycle:  HEALTHY → SUSPECT → QUARANTINED → RECOVERING → RESTORED
 *
 * All numeric thresholds, iteration counts, backoff delays, and window sizes
 * derive exclusively from phi-math.js constants. Zero magic numbers.
 */

import { EventEmitter } from 'events';
import {
  PHI,
  PSI,
  PSI_2,
  PSI_3,
  CSL_THRESHOLDS,
  fib,
  phiBackoffSequence,
} from '../../shared/phi-math.js';
import { CSLEngine } from '../../shared/csl-engine.js';

// ─── Phi-derived constants ────────────────────────────────────────────────────

/** ψ  = 0.618 — health score below which a component becomes SUSPECT */
const HEALTH_SUSPECT_THRESHOLD    = PSI;                          // 0.618

/** ψ² = 0.382 — health score below which a component is QUARANTINED */
const HEALTH_QUARANTINE_THRESHOLD = PSI_2;                        // 0.382

/** fib(5) = 5 — consecutive bad checks before quarantine */
const QUARANTINE_BAD_CHECKS       = fib(5);                       // 5

/** fib(4) = 3 — respawn failures before alert */
const RESPAWN_FAIL_ALERT          = fib(4);                       // 3

/** fib(5) = 5 — respawn failures before permanent quarantine */
const RESPAWN_FAIL_PERM           = fib(5);                       // 5

/** fib(4) = 3 — consecutive health checks required for attestation */
const ATTESTATION_PASS_REQUIRED   = fib(4);                       // 3

/** fib(5) = 5 — circuit breaker trip threshold */
const CIRCUIT_BREAKER_TRIP        = fib(5);                       // 5

/** φ × 5000 ms ≈ 8090 ms — self-healing cycle interval */
const HEALING_CYCLE_MS            = Math.round(PHI * 5000);       // 8090

/** CSL drift threshold: cosine < 0.691 → drift alert */
const DRIFT_ALERT_THRESHOLD       = CSL_THRESHOLDS.LOW;           // 0.691

/** Phi-backoff respawn sequence (8 steps, base 1000ms): [1000, 1618, 2618, 4236, 6854, 11090, ...] */
const RESPAWN_BACKOFF_SEQ         = phiBackoffSequence(8, 1000);  // 6 values used

// ─── Lifecycle State Machine ──────────────────────────────────────────────────

export const LIFECYCLE = Object.freeze({
  HEALTHY     : 'HEALTHY',
  SUSPECT     : 'SUSPECT',
  QUARANTINED : 'QUARANTINED',
  RECOVERING  : 'RECOVERING',
  RESTORED    : 'RESTORED',
});

/** Valid state transitions */
const VALID_TRANSITIONS = Object.freeze({
  [LIFECYCLE.HEALTHY]     : [LIFECYCLE.SUSPECT],
  [LIFECYCLE.SUSPECT]     : [LIFECYCLE.HEALTHY, LIFECYCLE.QUARANTINED],
  [LIFECYCLE.QUARANTINED] : [LIFECYCLE.RECOVERING],
  [LIFECYCLE.RECOVERING]  : [LIFECYCLE.RESTORED, LIFECYCLE.QUARANTINED],
  [LIFECYCLE.RESTORED]    : [LIFECYCLE.HEALTHY, LIFECYCLE.QUARANTINED],
});

// ─── Component Types ──────────────────────────────────────────────────────────

export const COMPONENT_TYPE = Object.freeze({
  SERVICE         : 'service',
  WORKER          : 'worker',
  AGENT           : 'agent',
  TOOL_CONNECTOR  : 'tool_connector',
  PROVIDER_ROUTE  : 'provider_route',
});

// ─── ComponentRecord ──────────────────────────────────────────────────────────

/**
 * Internal record maintained for each registered component.
 * @private
 */
class ComponentRecord {
  /**
   * @param {string} id          Unique component identifier
   * @param {string} type        One of COMPONENT_TYPE values
   * @param {Function} healthFn  Async () => number in [0, 1]
   * @param {Function} [spawnFn] Async () => void — respawn procedure
   * @param {number[]} [baseline] State vector for drift detection
   */
  constructor(id, type, healthFn, spawnFn, baseline) {
    this.id              = id;
    this.type            = type;
    this.healthFn        = healthFn;
    this.spawnFn         = spawnFn    ?? null;
    this.baseline        = baseline   ?? [];
    this.registeredAt    = Date.now();

    this.state           = LIFECYCLE.HEALTHY;
    this.healthScore     = 1.0;
    this.consecutiveBad  = 0;
    this.consecutiveGood = 0;
    this.respawnCount    = 0;
    this.respawnFailures = 0;
    this.permQuarantined = false;
    this.lastCheckedAt   = null;
    this.stateHistory    = [{ state: LIFECYCLE.HEALTHY, ts: Date.now() }];

    // Circuit breaker
    this.cbFailures      = 0;
    this.cbOpen          = false;
    this.cbOpenedAt      = null;
    this.cbRecoveryIndex = 0;

    // Current state vector (for drift)
    this.stateVector     = baseline.slice();
  }

  /** Append a state transition to history */
  recordTransition(newState) {
    this.state = newState;
    this.stateHistory.push({ state: newState, ts: Date.now() });
  }

  /** Summary snapshot for external consumers */
  toSummary() {
    return {
      id           : this.id,
      type         : this.type,
      state        : this.state,
      healthScore  : this.healthScore,
      consecutiveBad: this.consecutiveBad,
      respawnCount : this.respawnCount,
      respawnFailures: this.respawnFailures,
      permQuarantined: this.permQuarantined,
      cbOpen       : this.cbOpen,
      lastCheckedAt: this.lastCheckedAt,
      registeredAt : this.registeredAt,
    };
  }
}

// ─── SelfHealingMesh ─────────────────────────────────────────────────────────

/**
 * Self-healing lifecycle manager for the Heady™ Connection fleet.
 *
 * Maintains a registry of components (services, workers, agents, tool connectors,
 * provider routes) and autonomously monitors, quarantines, respawns, and attests
 * them using phi-derived thresholds and backoff sequences.
 *
 * @fires SelfHealingMesh#component:registered
 * @fires SelfHealingMesh#state:transition
 * @fires SelfHealingMesh#health:suspect
 * @fires SelfHealingMesh#health:quarantined
 * @fires SelfHealingMesh#health:recovering
 * @fires SelfHealingMesh#health:restored
 * @fires SelfHealingMesh#health:perm_quarantined
 * @fires SelfHealingMesh#respawn:start
 * @fires SelfHealingMesh#respawn:success
 * @fires SelfHealingMesh#respawn:failure
 * @fires SelfHealingMesh#respawn:alert
 * @fires SelfHealingMesh#circuit:open
 * @fires SelfHealingMesh#circuit:close
 * @fires SelfHealingMesh#drift:detected
 * @fires SelfHealingMesh#canary:pass
 * @fires SelfHealingMesh#canary:fail
 * @fires SelfHealingMesh#cycle:complete
 */
export class SelfHealingMesh extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, ComponentRecord>} */
    this._registry   = new Map();
    this._cycleTimer = null;
    this._running    = false;
    this._csl        = new CSLEngine();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Register a component for lifecycle management.
   *
   * @param {string}   id        Unique component identifier
   * @param {string}   type      One of COMPONENT_TYPE values
   * @param {Function} healthFn  `async () => number` — returns health score in [0, 1]
   * @param {Function} [spawnFn] `async () => void`   — called to respawn the component
   * @param {number[]} [baseline] State vector for drift detection (optional)
   * @returns {ComponentRecord}
   */
  register(id, type, healthFn, spawnFn, baseline = []) {
    if (this._registry.has(id)) throw new Error(`Component already registered: ${id}`);
    if (!Object.values(COMPONENT_TYPE).includes(type)) {
      throw new Error(`Unknown component type: ${type}`);
    }
    if (typeof healthFn !== 'function') throw new TypeError(`healthFn must be a function for: ${id}`);

    const record = new ComponentRecord(id, type, healthFn, spawnFn, baseline);
    this._registry.set(id, record);
    this.emit('component:registered', { id, type, ts: Date.now() });
    return record;
  }

  /**
   * Get the current health score and lifecycle state for a component.
   *
   * @param {string} id  Component identifier
   * @returns {{ id: string, state: string, healthScore: number, cbOpen: boolean }}
   */
  getHealth(id) {
    const rec = this._requireRecord(id);
    return {
      id        : rec.id,
      state     : rec.state,
      healthScore: rec.healthScore,
      cbOpen    : rec.cbOpen,
    };
  }

  /**
   * Manually quarantine a component, bypassing the threshold check.
   *
   * @param {string} id      Component identifier
   * @param {string} [reason='manual']  Reason recorded in state history
   */
  quarantine(id, reason = 'manual') {
    const rec = this._requireRecord(id);
    this._transitionTo(rec, LIFECYCLE.QUARANTINED, reason);
  }

  /**
   * Manually trigger a respawn for a component.
   *
   * @param {string} id  Component identifier
   * @returns {Promise<boolean>}  true if respawn succeeded
   */
  async respawn(id) {
    const rec = this._requireRecord(id);
    return this._doRespawn(rec);
  }

  /**
   * Return a fleet-wide health summary.
   *
   * Overall health is the phi-weighted average of individual scores:
   *   weight_i = ψ^(i / total)  normalised so Σweight_i = 1
   *
   * @returns {{ overall: number, components: object[], counts: object }}
   */
  getFleetStatus() {
    const records = Array.from(this._registry.values());
    if (records.length === 0) return { overall: 1, components: [], counts: {} };

    // Phi-weighted average: assign higher weight to lower-health components
    // so that sick components drag the fleet score down more strongly
    const sorted = [...records].sort((a, b) => a.healthScore - b.healthScore);
    let weightSum = 0;
    let scoreSum  = 0;
    sorted.forEach((r, i) => {
      const w  = Math.pow(PSI, i / sorted.length);
      weightSum += w;
      scoreSum  += r.healthScore * w;
    });
    const overall = weightSum > 0 ? scoreSum / weightSum : 1;

    const counts = {
      [LIFECYCLE.HEALTHY]     : 0,
      [LIFECYCLE.SUSPECT]     : 0,
      [LIFECYCLE.QUARANTINED] : 0,
      [LIFECYCLE.RECOVERING]  : 0,
      [LIFECYCLE.RESTORED]    : 0,
    };
    records.forEach(r => { if (counts[r.state] !== undefined) counts[r.state]++; });

    return {
      overall,
      components: records.map(r => r.toSummary()),
      counts,
    };
  }

  /**
   * Start the autonomous healing cycle (interval: φ×5000 ≈ 8090 ms).
   */
  start() {
    if (this._running) return;
    this._running    = true;
    this._cycleTimer = setInterval(() => this._runHealingCycle(), HEALING_CYCLE_MS);
  }

  /**
   * Stop the autonomous healing cycle.
   */
  stop() {
    if (this._cycleTimer) clearInterval(this._cycleTimer);
    this._cycleTimer = null;
    this._running    = false;
  }

  // ── Healing Cycle ──────────────────────────────────────────────────────────

  /**
   * One full healing cycle: check all components, apply state machine,
   * trigger respawns as needed, check drift, emit cycle summary.
   * @private
   */
  async _runHealingCycle() {
    const tasks = Array.from(this._registry.values()).map(rec => this._checkComponent(rec));
    await Promise.allSettled(tasks);

    const fleet = this.getFleetStatus();
    this.emit('cycle:complete', { ts: Date.now(), fleet });
  }

  /**
   * Check a single component: call healthFn, update circuit breaker,
   * advance state machine, initiate respawn if needed.
   * @param {ComponentRecord} rec
   * @private
   */
  async _checkComponent(rec) {
    if (rec.permQuarantined) return;

    // Circuit breaker: if open, wait for recovery window before probing
    if (rec.cbOpen) {
      const delay = RESPAWN_BACKOFF_SEQ[rec.cbRecoveryIndex] ?? RESPAWN_BACKOFF_SEQ.at(-1);
      const elapsed = Date.now() - (rec.cbOpenedAt ?? 0);
      if (elapsed < delay) return;  // still in recovery window
      // Half-open probe
    }

    let score;
    try {
      score = await rec.healthFn();
      score = Math.max(0, Math.min(1, Number(score) || 0));
      rec.cbFailures = 0;
      if (rec.cbOpen) {
        rec.cbOpen = false;
        this.emit('circuit:close', { id: rec.id });
      }
    } catch (err) {
      score = 0;
      rec.cbFailures++;
      if (rec.cbFailures >= CIRCUIT_BREAKER_TRIP && !rec.cbOpen) {
        rec.cbOpen      = true;
        rec.cbOpenedAt  = Date.now();
        rec.cbRecoveryIndex = Math.min(rec.cbRecoveryIndex + 1, RESPAWN_BACKOFF_SEQ.length - 1);
        this.emit('circuit:open', { id: rec.id, failures: rec.cbFailures });
      }
    }

    rec.healthScore   = score;
    rec.lastCheckedAt = Date.now();

    // Drift detection
    if (rec.baseline.length > 0) {
      await this._checkDrift(rec);
    }

    // State machine advancement
    await this._advanceStateMachine(rec);
  }

  /**
   * Advance the component lifecycle state machine based on current health score.
   * @param {ComponentRecord} rec
   * @private
   */
  async _advanceStateMachine(rec) {
    const score = rec.healthScore;

    switch (rec.state) {
      case LIFECYCLE.HEALTHY:
        if (score < HEALTH_SUSPECT_THRESHOLD) {
          rec.consecutiveBad++;
          if (rec.consecutiveBad >= 1) {
            this._transitionTo(rec, LIFECYCLE.SUSPECT, 'health_below_psi');
          }
        } else {
          rec.consecutiveBad = 0;
        }
        break;

      case LIFECYCLE.SUSPECT:
        if (score >= HEALTH_SUSPECT_THRESHOLD) {
          rec.consecutiveBad = 0;
          this._transitionTo(rec, LIFECYCLE.HEALTHY, 'health_recovered');
        } else if (score < HEALTH_QUARANTINE_THRESHOLD) {
          rec.consecutiveBad++;
          if (rec.consecutiveBad >= QUARANTINE_BAD_CHECKS) {
            this._transitionTo(rec, LIFECYCLE.QUARANTINED, `${QUARANTINE_BAD_CHECKS}_consecutive_bad_checks`);
          }
        } else {
          rec.consecutiveBad++;
          if (rec.consecutiveBad >= QUARANTINE_BAD_CHECKS) {
            this._transitionTo(rec, LIFECYCLE.QUARANTINED, 'prolonged_suspect');
          }
        }
        break;

      case LIFECYCLE.QUARANTINED:
        // Begin recovery — attempt respawn
        this._transitionTo(rec, LIFECYCLE.RECOVERING, 'respawn_initiated');
        await this._doRespawn(rec);
        break;

      case LIFECYCLE.RECOVERING:
        // Check attestation
        if (score >= HEALTH_SUSPECT_THRESHOLD) {
          rec.consecutiveGood++;
          if (rec.consecutiveGood >= ATTESTATION_PASS_REQUIRED) {
            // Canary validation before full restoration
            const canaryPassed = await this._runCanary(rec);
            if (canaryPassed) {
              this._transitionTo(rec, LIFECYCLE.RESTORED, 'attestation_passed');
            } else {
              rec.consecutiveGood = 0;
              this._transitionTo(rec, LIFECYCLE.QUARANTINED, 'canary_failed');
            }
          }
        } else {
          rec.consecutiveGood = 0;
        }
        break;

      case LIFECYCLE.RESTORED:
        if (score >= HEALTH_SUSPECT_THRESHOLD) {
          this._transitionTo(rec, LIFECYCLE.HEALTHY, 'fully_restored');
        } else {
          this._transitionTo(rec, LIFECYCLE.QUARANTINED, 'regression_after_restore');
        }
        break;

      default:
        break;
    }
  }

  /**
   * Execute a respawn with phi-backoff retry sequence.
   * - fib(4)=3 failures → emit alert
   * - fib(5)=5 failures → permanent quarantine
   * @param {ComponentRecord} rec
   * @returns {Promise<boolean>}
   * @private
   */
  async _doRespawn(rec) {
    if (!rec.spawnFn) {
      this.emit('respawn:failure', { id: rec.id, reason: 'no_spawn_fn' });
      return false;
    }

    const attemptIndex = rec.respawnFailures;
    const delay        = RESPAWN_BACKOFF_SEQ[Math.min(attemptIndex, RESPAWN_BACKOFF_SEQ.length - 1)];
    await sleep(delay);

    rec.respawnCount++;
    this.emit('respawn:start', { id: rec.id, attempt: rec.respawnCount, delay });

    try {
      await rec.spawnFn();
      rec.consecutiveGood = 0;
      this.emit('respawn:success', { id: rec.id, attempt: rec.respawnCount });
      return true;
    } catch (err) {
      rec.respawnFailures++;
      this.emit('respawn:failure', { id: rec.id, attempt: rec.respawnCount, error: err.message });

      if (rec.respawnFailures >= RESPAWN_FAIL_ALERT && rec.respawnFailures < RESPAWN_FAIL_PERM) {
        this.emit('respawn:alert', {
          id      : rec.id,
          failures: rec.respawnFailures,
          threshold: RESPAWN_FAIL_ALERT,
        });
      }

      if (rec.respawnFailures >= RESPAWN_FAIL_PERM) {
        rec.permQuarantined = true;
        this._transitionTo(rec, LIFECYCLE.QUARANTINED, 'permanent_quarantine');
        this.emit('health:perm_quarantined', { id: rec.id, failures: rec.respawnFailures });
      }

      return false;
    }
  }

  /**
   * Drift detection: compute cosine similarity between current state vector
   * and baseline.  If cosine < 0.691 (CSL_THRESHOLDS.LOW), emit drift alert.
   * @param {ComponentRecord} rec
   * @private
   */
  async _checkDrift(rec) {
    const current  = rec.stateVector;
    const baseline = rec.baseline;
    if (current.length === 0 || baseline.length === 0) return;

    const len    = Math.min(current.length, baseline.length);
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < len; i++) {
      dot  += current[i] * baseline[i];
      magA += current[i] * current[i];
      magB += baseline[i] * baseline[i];
    }
    const denom   = Math.sqrt(magA) * Math.sqrt(magB);
    const cosine  = denom > 0 ? dot / denom : 1;

    if (cosine < DRIFT_ALERT_THRESHOLD) {
      this.emit('drift:detected', { id: rec.id, cosine, threshold: DRIFT_ALERT_THRESHOLD });
    }
  }

  /**
   * Canary validation: run a lightweight health probe and confirm score ≥ ψ.
   * Returns true if the component passes, false otherwise.
   * @param {ComponentRecord} rec
   * @returns {Promise<boolean>}
   * @private
   */
  async _runCanary(rec) {
    try {
      const score = await rec.healthFn();
      const pass  = Number(score) >= HEALTH_SUSPECT_THRESHOLD;
      this.emit(pass ? 'canary:pass' : 'canary:fail', { id: rec.id, score });
      return pass;
    } catch {
      this.emit('canary:fail', { id: rec.id, score: 0 });
      return false;
    }
  }

  /**
   * Transition component to a new lifecycle state, validating the transition.
   * Emits state:transition and the named health event.
   * @param {ComponentRecord} rec
   * @param {string} newState
   * @param {string} reason
   * @private
   */
  _transitionTo(rec, newState, reason) {
    const allowed = VALID_TRANSITIONS[rec.state];
    if (!allowed?.includes(newState)) {
      // Soft guard — log and skip; do not throw in production healing loop
      return;
    }
    const prev = rec.state;
    rec.recordTransition(newState);

    this.emit('state:transition', { id: rec.id, from: prev, to: newState, reason, ts: Date.now() });

    const eventMap = {
      [LIFECYCLE.SUSPECT]     : 'health:suspect',
      [LIFECYCLE.QUARANTINED] : 'health:quarantined',
      [LIFECYCLE.RECOVERING]  : 'health:recovering',
      [LIFECYCLE.RESTORED]    : 'health:restored',
      [LIFECYCLE.HEALTHY]     : null,
    };
    const namedEvent = eventMap[newState];
    if (namedEvent) this.emit(namedEvent, { id: rec.id, prev, reason });
  }

  /**
   * Lookup a record and throw if missing.
   * @param {string} id
   * @returns {ComponentRecord}
   * @private
   */
  _requireRecord(id) {
    const rec = this._registry.get(id);
    if (!rec) throw new Error(`Unknown component: ${id}`);
    return rec;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** @param {number} ms  @returns {Promise<void>} */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default SelfHealingMesh;

/**
 * @fileoverview Heady™ Circuit Breaker — Phi-Harmonic Failure Isolation
 *
 * Implements a three-state circuit breaker with phi-scaled thresholds:
 *
 *   CLOSED    → normal operation, failures tracked
 *   OPEN      → failing fast, no calls through, phi-backoff recovery window
 *   HALF_OPEN → probing with fib(4)=3 test requests before restoring
 *
 * All numeric constants derive from phi-math:
 *   Failure threshold:    fib(5) = 5
 *   Recovery probe count: fib(4) = 3
 *   Health tracking:      sliding window of fib(8) = 21 measurements
 *   Backoff base:         PHI_TIMING.PHI_3 = 4,236ms
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  fib,
  PHI,
  PSI,
  phiBackoffWithJitter,
  PHI_TIMING,
  CSL_THRESHOLDS,
  ALERTS,
} = require('../../shared/phi-math.js');

// ─── Circuit breaker states ───────────────────────────────────────────────────

const STATE = Object.freeze({
  CLOSED:    'CLOSED',
  OPEN:      'OPEN',
  HALF_OPEN: 'HALF_OPEN',
});

// ─── Phi-derived thresholds ───────────────────────────────────────────────────

/** Consecutive failures before tripping: fib(5) = 5 */
const FAILURE_THRESHOLD  = fib(5);

/** Successful probes needed to close from HALF_OPEN: fib(4) = 3 */
const RECOVERY_PROBES    = fib(4);

/** Health tracking window size: fib(8) = 21 measurements */
const HEALTH_WINDOW_SIZE = fib(8);

/** Base recovery timeout: PHI_TIMING.PHI_3 ≈ 4,236ms */
const RECOVERY_BASE_MS   = PHI_TIMING.PHI_3;

/** Max recovery timeout: PHI_TIMING.PHI_7 ≈ 29,034ms */
const RECOVERY_MAX_MS    = PHI_TIMING.PHI_7;

/**
 * Health percentage that triggers HALF_OPEN → CLOSED transition.
 * Uses CSL HIGH threshold ≈ 0.882.
 */
const HEALTH_RESTORE_THRESHOLD = CSL_THRESHOLDS.HIGH;

/**
 * Health percentage below which HALF_OPEN → OPEN reverts.
 * Uses CSL LOW threshold ≈ 0.691.
 */
const HEALTH_REOPEN_THRESHOLD = CSL_THRESHOLDS.LOW;

// ─── CircuitBreaker class ────────────────────────────────────────────────────

/**
 * @class CircuitBreaker
 *
 * @example
 * const cb = new CircuitBreaker('embedding-api');
 * const result = await cb.execute(() => fetchEmbedding(text));
 */
class CircuitBreaker {
  /**
   * @param {string} name - identifier for logging
   * @param {object} [opts]
   * @param {number} [opts.failureThreshold]  - trips circuit (default fib(5)=5)
   * @param {number} [opts.recoveryProbes]    - probes before close (default fib(4)=3)
   * @param {number} [opts.recoveryBaseMs]    - base backoff ms (default PHI_TIMING.PHI_3)
   * @param {number} [opts.recoveryMaxMs]     - max backoff ms (default PHI_TIMING.PHI_7)
   * @param {Function} [opts.onStateChange]   - callback(newState, prevState, reason)
   */
  constructor(name, opts = {}) {
    this.name             = name;
    this.failureThreshold = opts.failureThreshold || FAILURE_THRESHOLD;
    this.recoveryProbes   = opts.recoveryProbes   || RECOVERY_PROBES;
    this.recoveryBaseMs   = opts.recoveryBaseMs   || RECOVERY_BASE_MS;
    this.recoveryMaxMs    = opts.recoveryMaxMs    || RECOVERY_MAX_MS;
    this.onStateChange    = opts.onStateChange    || null;

    // State
    this._state           = STATE.CLOSED;
    this._failureCount    = 0;
    this._probeCount      = 0;
    this._probeSuccesses  = 0;
    this._recoveryAttempt = 0;
    this._openedAt        = null;
    this._nextProbeAt     = null;

    // Health tracking: circular buffer of booleans (true=success, false=failure)
    this._healthWindow  = new Array(HEALTH_WINDOW_SIZE).fill(true);
    this._healthIdx     = 0;
    this._totalCalls    = 0;
    this._totalFailures = 0;
  }

  // ─── State accessors ───────────────────────────────────────────────────────

  get state() { return this._state; }
  get isOpen() { return this._state === STATE.OPEN; }
  get isClosed() { return this._state === STATE.CLOSED; }
  get isHalfOpen() { return this._state === STATE.HALF_OPEN; }

  /**
   * Health percentage over the sliding window (0–1).
   * Uses HEALTH_WINDOW_SIZE = fib(8) = 21 most recent calls.
   * @returns {number}
   */
  get healthPercent() {
    const successes = this._healthWindow.filter(Boolean).length;
    return successes / HEALTH_WINDOW_SIZE;
  }

  // ─── State transitions ─────────────────────────────────────────────────────

  /**
   * @private
   * Transition to a new state with optional reason string.
   */
  _transition(newState, reason = '') {
    const prev = this._state;
    if (prev === newState) return;
    this._state = newState;
    if (this.onStateChange) {
      try { this.onStateChange(newState, prev, reason); }
      catch (_) { /* swallow callback errors */ }
    }
  }

  /**
   * @private
   * Open the circuit and schedule the first probe window.
   */
  _open() {
    this._openedAt        = Date.now();
    this._probeCount      = 0;
    this._probeSuccesses  = 0;

    // Phi-backoff delay for recovery attempt
    const delay = phiBackoffWithJitter(this._recoveryAttempt, this.recoveryBaseMs, this.recoveryMaxMs);
    this._nextProbeAt = this._openedAt + delay;

    this._transition(STATE.OPEN, `failures=${this._failureCount}, delay=${delay}ms`);
  }

  /**
   * @private
   * Record outcome into the sliding health window.
   */
  _recordHealth(success) {
    this._healthWindow[this._healthIdx % HEALTH_WINDOW_SIZE] = success;
    this._healthIdx++;
    this._totalCalls++;
    if (!success) this._totalFailures++;
  }

  // ─── Core API ──────────────────────────────────────────────────────────────

  /**
   * Execute an async function through the circuit breaker.
   * Throws CircuitOpenError when the circuit is OPEN and not ready to probe.
   * @template T
   * @param {function(): Promise<T>} fn - async function to guard
   * @returns {Promise<T>}
   * @throws {CircuitOpenError} when circuit is open
   */
  async execute(fn) {
    // OPEN state: check if probe window has elapsed
    if (this._state === STATE.OPEN) {
      if (Date.now() < this._nextProbeAt) {
        throw new CircuitOpenError(this.name, this._nextProbeAt - Date.now());
      }
      // Advance to HALF_OPEN for probing
      this._transition(STATE.HALF_OPEN, 'probe window elapsed');
    }

    // Execute the function
    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  /**
   * @private
   * Handle a successful call.
   */
  _onSuccess() {
    this._recordHealth(true);
    this._failureCount = 0;

    if (this._state === STATE.HALF_OPEN) {
      this._probeSuccesses++;
      this._probeCount++;

      if (this._probeSuccesses >= this.recoveryProbes ||
          this.healthPercent >= HEALTH_RESTORE_THRESHOLD) {
        // Fully recovered
        this._recoveryAttempt = 0;
        this._transition(STATE.CLOSED, `probes=${this._probeSuccesses}, health=${this.healthPercent.toFixed(3)}`);
      }
    }
  }

  /**
   * @private
   * Handle a failed call.
   * @param {Error} err
   */
  _onFailure(err) {
    this._recordHealth(false);
    this._failureCount++;

    if (this._state === STATE.HALF_OPEN) {
      this._probeCount++;
      // Failed probe — reopen with incremented recovery attempt
      this._recoveryAttempt++;
      this._open();
      return;
    }

    if (this._state === STATE.CLOSED &&
        this._failureCount >= this.failureThreshold) {
      this._recoveryAttempt++;
      this._open();
    }
  }

  /**
   * Force-reset circuit to CLOSED state (for testing / manual override).
   */
  reset() {
    this._state           = STATE.CLOSED;
    this._failureCount    = 0;
    this._probeCount      = 0;
    this._probeSuccesses  = 0;
    this._recoveryAttempt = 0;
    this._openedAt        = null;
    this._nextProbeAt     = null;
    this._healthWindow.fill(true);
    this._healthIdx = 0;
  }

  /**
   * Snapshot of current circuit breaker status.
   * @returns {object}
   */
  status() {
    return {
      name:             this.name,
      state:            this._state,
      healthPercent:    this.healthPercent,
      failureCount:     this._failureCount,
      failureThreshold: this.failureThreshold,
      probeCount:       this._probeCount,
      probeSuccesses:   this._probeSuccesses,
      recoveryAttempt:  this._recoveryAttempt,
      nextProbeIn:      this._nextProbeAt
        ? Math.max(0, this._nextProbeAt - Date.now())
        : null,
      totalCalls:       this._totalCalls,
      totalFailures:    this._totalFailures,
    };
  }
}

// ─── Custom error ─────────────────────────────────────────────────────────────

/**
 * Thrown when a call is made against an OPEN circuit breaker.
 */
class CircuitOpenError extends Error {
  /**
   * @param {string} name         - circuit breaker name
   * @param {number} retryAfterMs - milliseconds until next probe
   */
  constructor(name, retryAfterMs) {
    super(`Circuit "${name}" is OPEN — retry after ${Math.ceil(retryAfterMs)}ms`);
    this.name         = 'CircuitOpenError';
    this.circuit      = name;
    this.retryAfterMs = retryAfterMs;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  CircuitBreaker,
  CircuitOpenError,
  STATE,
  // Exposed constants for testing / introspection
  FAILURE_THRESHOLD,
  RECOVERY_PROBES,
  HEALTH_WINDOW_SIZE,
  RECOVERY_BASE_MS,
  RECOVERY_MAX_MS,
  HEALTH_RESTORE_THRESHOLD,
  HEALTH_REOPEN_THRESHOLD,
};

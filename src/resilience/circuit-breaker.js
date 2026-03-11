/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Circuit Breaker — src/resilience/circuit-breaker.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Three-state circuit breaker (CLOSED → OPEN → HALF_OPEN) with phi-scaled
 * thresholds, Google SRE adaptive throttling, and CSL-gated state transitions.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const {
  PHI, PSI, fib, phiBackoff,
  CSL_THRESHOLDS, ALERT_THRESHOLDS,
  PSI_POWERS,
} = require('../../shared/phi-math');

const STATES = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });

class CircuitBreaker {
  /**
   * @param {object} opts
   * @param {string} opts.name - Service/resource name
   * @param {number} [opts.failureThreshold] - Failures before opening (default fib(5)=5)
   * @param {number} [opts.successThreshold] - Successes to close from half-open (default fib(4)=3)
   * @param {number} [opts.resetTimeoutMs] - Base timeout before half-open probe (default 5000)
   * @param {number} [opts.volumeThreshold] - Min requests in window before tripping (default fib(7)=13)
   * @param {number} [opts.errorRateThreshold] - Error rate to trip (default PSI ≈ 0.618)
   * @param {number} [opts.halfOpenMax] - Max concurrent in half-open (default fib(4)=3)
   * @param {Function} [opts.onStateChange] - Callback(name, from, to)
   */
  constructor(opts) {
    this.name = opts.name;
    this.failureThreshold = opts.failureThreshold || fib(5);     // 5
    this.successThreshold = opts.successThreshold || fib(4);     // 3
    this.resetTimeoutMs   = opts.resetTimeoutMs || 5000;
    this.volumeThreshold  = opts.volumeThreshold || fib(7);      // 13
    this.errorRateThreshold = opts.errorRateThreshold || PSI;    // ≈ 0.618
    this.halfOpenMax      = opts.halfOpenMax || fib(4);          // 3
    this.onStateChange    = opts.onStateChange || (() => {});

    // State
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.halfOpenActive = 0;
    this.openAttempt = 0;       // For phi-backoff on repeated opens
    this.lastFailureAt = 0;
    this.lastOpenAt = 0;
    this.nextAttemptAt = 0;

    // Sliding window for SRE adaptive throttling
    this.windowMs = fib(9) * 1000;   // 34-second window
    this.requests = [];               // { timestamp, success }
    this.bucketCount = fib(6);        // 8 buckets
  }

  /**
   * Execute a function through the circuit breaker.
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>}
   * @throws {Error} If circuit is open
   */
  async execute(fn) {
    this._pruneWindow();

    if (this.state === STATES.OPEN) {
      if (Date.now() < this.nextAttemptAt) {
        throw new CircuitBreakerError(this.name, 'Circuit OPEN — request rejected');
      }
      this._transition(STATES.HALF_OPEN);
    }

    if (this.state === STATES.HALF_OPEN) {
      if (this.halfOpenActive >= this.halfOpenMax) {
        throw new CircuitBreakerError(this.name, 'Circuit HALF_OPEN — probe limit reached');
      }
      this.halfOpenActive++;
    }

    // SRE adaptive throttling (even in CLOSED state)
    if (this._shouldThrottle()) {
      throw new CircuitBreakerError(this.name, 'Adaptive throttle — too many recent failures');
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.requests.push({ timestamp: Date.now(), success: true });
    this.consecutiveFailures = 0;

    if (this.state === STATES.HALF_OPEN) {
      this.halfOpenActive--;
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.openAttempt = 0; // Reset backoff on full recovery
        this._transition(STATES.CLOSED);
      }
    }
  }

  _onFailure() {
    const now = Date.now();
    this.requests.push({ timestamp: now, success: false });
    this.failures++;
    this.consecutiveFailures++;
    this.lastFailureAt = now;

    if (this.state === STATES.HALF_OPEN) {
      this.halfOpenActive--;
      this._transition(STATES.OPEN);
      return;
    }

    if (this.state === STATES.CLOSED) {
      const stats = this._windowStats();
      const shouldTrip =
        this.consecutiveFailures >= this.failureThreshold ||
        (stats.total >= this.volumeThreshold && stats.errorRate >= this.errorRateThreshold);

      if (shouldTrip) this._transition(STATES.OPEN);
    }
  }

  _transition(newState) {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;

    switch (newState) {
      case STATES.OPEN:
        this.lastOpenAt = Date.now();
        this.nextAttemptAt = Date.now() + phiBackoff(this.openAttempt, this.resetTimeoutMs);
        this.openAttempt++;
        this.successes = 0;
        this.halfOpenActive = 0;
        break;

      case STATES.HALF_OPEN:
        this.successes = 0;
        this.halfOpenActive = 0;
        break;

      case STATES.CLOSED:
        this.failures = 0;
        this.consecutiveFailures = 0;
        this.successes = 0;
        this.halfOpenActive = 0;
        break;
    }

    this.onStateChange(this.name, oldState, newState);
  }

  /**
   * Google SRE adaptive throttling.
   * Rejection probability: max(0, (requests - K × accepts) / (requests + 1))
   * K = 1/PSI ≈ 1.618 (φ multiplier for accepted requests)
   */
  _shouldThrottle() {
    if (this.state !== STATES.CLOSED) return false;
    const stats = this._windowStats();
    if (stats.total < this.volumeThreshold) return false;

    const K = PHI; // φ ≈ 1.618 multiplier
    const rejectProb = Math.max(0, (stats.total - K * stats.successes) / (stats.total + 1));
    return Math.random() < rejectProb;
  }

  _pruneWindow() {
    const cutoff = Date.now() - this.windowMs;
    this.requests = this.requests.filter(r => r.timestamp > cutoff);
  }

  _windowStats() {
    const successes = this.requests.filter(r => r.success).length;
    const total = this.requests.length;
    return {
      total,
      successes,
      failures: total - successes,
      errorRate: total > 0 ? (total - successes) / total : 0,
    };
  }

  /**
   * Get current circuit breaker status.
   * @returns {object}
   */
  status() {
    const stats = this._windowStats();
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      windowStats: stats,
      openAttempt: this.openAttempt,
      nextAttemptAt: this.state === STATES.OPEN ? new Date(this.nextAttemptAt).toISOString() : null,
    };
  }

  /**
   * Force-reset the circuit breaker to CLOSED.
   */
  reset() {
    this._transition(STATES.CLOSED);
    this.openAttempt = 0;
    this.requests = [];
  }
}

class CircuitBreakerError extends Error {
  constructor(name, message) {
    super(`[CircuitBreaker:${name}] ${message}`);
    this.name = 'CircuitBreakerError';
    this.circuitName = name;
  }
}

module.exports = { CircuitBreaker, CircuitBreakerError, STATES };

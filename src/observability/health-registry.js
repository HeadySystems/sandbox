/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Health Registry — src/observability/health-registry.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Unified health probe system: Kubernetes-compatible liveness/readiness/startup
 * probes. Each service component registers its health check function, and the
 * registry aggregates them into a single system health view.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { fib, CSL_THRESHOLDS, phiInterval, PSI } = require('../../shared/phi-math');

const HEALTH_STATUS = Object.freeze({
  HEALTHY:    'healthy',
  DEGRADED:   'degraded',
  UNHEALTHY:  'unhealthy',
  UNKNOWN:    'unknown',
});

class HealthRegistry {
  /**
   * @param {object} [opts]
   * @param {number} [opts.checkIntervalMs] - Auto-check interval (default φ^3 × 1000 ≈ 4236ms)
   * @param {number} [opts.checkTimeoutMs] - Per-check timeout (default 5000ms)
   * @param {boolean} [opts.autoCheck] - Enable auto-checking (default false)
   * @param {Function} [opts.logger] - Logger instance
   */
  constructor(opts = {}) {
    this.checkIntervalMs = opts.checkIntervalMs || phiInterval(3, 1000); // ≈ 4236ms
    this.checkTimeoutMs  = opts.checkTimeoutMs || 5000;
    this.logger = opts.logger || console;

    this._checks = new Map();   // name → { fn, weight, group, lastResult }
    this._timer = null;
    this._bootComplete = false;

    if (opts.autoCheck) this.startAutoCheck();
  }

  /**
   * Register a health check.
   * @param {string} name - Unique check name (e.g., 'postgres', 'redis', 'vector-memory')
   * @param {Function} fn - Async function returning { status, message?, details? }
   * @param {object} [opts]
   * @param {number} [opts.weight] - Importance weight 0–1 (default PSI ≈ 0.618)
   * @param {string} [opts.group] - Group name ('core', 'cache', 'external')
   * @param {boolean} [opts.critical] - If true, failure makes whole system unhealthy
   */
  register(name, fn, opts = {}) {
    this._checks.set(name, {
      fn,
      weight: opts.weight ?? PSI,
      group: opts.group || 'default',
      critical: opts.critical || false,
      lastResult: { status: HEALTH_STATUS.UNKNOWN, checkedAt: null },
    });
  }

  /**
   * Unregister a health check.
   * @param {string} name
   */
  unregister(name) {
    this._checks.delete(name);
  }

  /**
   * Run all registered checks and return aggregated health.
   * @returns {Promise<object>}
   */
  async check() {
    const results = {};
    const checks = Array.from(this._checks.entries());

    const promises = checks.map(async ([name, check]) => {
      try {
        const result = await Promise.race([
          check.fn(),
          timeout(this.checkTimeoutMs, name),
        ]);
        check.lastResult = {
          ...result,
          status: result.status || HEALTH_STATUS.HEALTHY,
          checkedAt: new Date().toISOString(),
        };
      } catch (err) {
        check.lastResult = {
          status: HEALTH_STATUS.UNHEALTHY,
          message: err.message,
          checkedAt: new Date().toISOString(),
        };
      }
      results[name] = { ...check.lastResult, weight: check.weight, critical: check.critical };
    });

    await Promise.allSettled(promises);

    return this._aggregate(results);
  }

  _aggregate(results) {
    const entries = Object.entries(results);
    if (entries.length === 0) {
      return {
        status: HEALTH_STATUS.HEALTHY,
        checks: {},
        score: 1.0,
        timestamp: new Date().toISOString(),
      };
    }

    let weightedScore = 0;
    let totalWeight = 0;
    let hasCriticalFailure = false;
    let hasDegraded = false;

    for (const [name, result] of entries) {
      const weight = result.weight || PSI;
      totalWeight += weight;

      switch (result.status) {
        case HEALTH_STATUS.HEALTHY:
          weightedScore += weight * 1.0;
          break;
        case HEALTH_STATUS.DEGRADED:
          weightedScore += weight * 0.5;
          hasDegraded = true;
          break;
        case HEALTH_STATUS.UNHEALTHY:
          weightedScore += weight * 0;
          if (result.critical) hasCriticalFailure = true;
          break;
        default:
          weightedScore += weight * 0.25;
          break;
      }
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;

    let overallStatus;
    if (hasCriticalFailure || score < CSL_THRESHOLDS.MINIMUM) {
      overallStatus = HEALTH_STATUS.UNHEALTHY;
    } else if (hasDegraded || score < CSL_THRESHOLDS.MEDIUM) {
      overallStatus = HEALTH_STATUS.DEGRADED;
    } else {
      overallStatus = HEALTH_STATUS.HEALTHY;
    }

    return {
      status: overallStatus,
      score: Math.round(score * 1000) / 1000,
      checks: results,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── K8s-Compatible Probes ─────────────────────────────────────────────────

  /**
   * Liveness probe: is the process alive and not deadlocked?
   * Returns 200 if basic event loop is responsive.
   */
  async liveness() {
    return { status: HEALTH_STATUS.HEALTHY, uptime: process.uptime() };
  }

  /**
   * Readiness probe: is the service ready to accept traffic?
   * Runs all registered checks.
   */
  async readiness() {
    const health = await this.check();
    return {
      ready: health.status !== HEALTH_STATUS.UNHEALTHY,
      ...health,
    };
  }

  /**
   * Startup probe: has the service completed boot?
   */
  startup() {
    return {
      started: this._bootComplete,
      status: this._bootComplete ? HEALTH_STATUS.HEALTHY : HEALTH_STATUS.UNKNOWN,
    };
  }

  /**
   * Mark boot as complete. Call after all bootstrap phases finish.
   */
  markBootComplete() {
    this._bootComplete = true;
  }

  // ─── Express/Fastify Route Handlers ────────────────────────────────────────

  /**
   * Get Express-compatible route handlers.
   * @returns {object} { live, ready, startup, full }
   */
  handlers() {
    return {
      live: async (req, res) => {
        const result = await this.liveness();
        res.status(200).json(result);
      },
      ready: async (req, res) => {
        const result = await this.readiness();
        res.status(result.ready ? 200 : 503).json(result);
      },
      startup: (req, res) => {
        const result = this.startup();
        res.status(result.started ? 200 : 503).json(result);
      },
      full: async (req, res) => {
        const result = await this.check();
        const code = result.status === HEALTH_STATUS.HEALTHY ? 200
                   : result.status === HEALTH_STATUS.DEGRADED ? 200
                   : 503;
        res.json(result);
        res.status(code);
      },
    };
  }

  // ─── Auto-Check ────────────────────────────────────────────────────────────

  startAutoCheck() {
    if (this._timer) return;
    this._timer = setInterval(() => this.check().catch(() => {}), this.checkIntervalMs);
    if (this._timer.unref) this._timer.unref();
  }

  stopAutoCheck() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Get last known results without running new checks.
   */
  lastKnown() {
    const results = {};
    for (const [name, check] of this._checks) {
      results[name] = { ...check.lastResult, weight: check.weight, critical: check.critical };
    }
    return this._aggregate(results);
  }
}

function timeout(ms, name) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Health check "${name}" timed out after ${ms}ms`)), ms)
  );
}

module.exports = { HealthRegistry, HEALTH_STATUS };

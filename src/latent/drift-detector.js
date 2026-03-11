/**
 * ∞ Heady™ Drift Detector — Continuous Semantic Coherence Monitoring
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module drift-detector
 * @description Continuously monitors all registered component embeddings,
 *   comparing each component's current vector to its healthy baseline.
 *   Maintains a 100-sample sliding window of coherence scores per component,
 *   applies trend analysis, and enforces a three-tier alert system:
 *     WARNING  (coherence < 0.80)
 *     CRITICAL (coherence < 0.75) — triggers self-healing
 *     EMERGENCY(coherence < 0.65) — triggers escalation
 *   Integrates with SelfAwareness (passive events) and reports drift
 *   patterns to the Heady™Autobiographer via an optional callback.
 */

'use strict';

const { EventEmitter } = require('events');
const { cosineSimilarity } = require('./vector-space-ops');

// ---------------------------------------------------------------------------
// Alert thresholds
// ---------------------------------------------------------------------------

/** @enum {string} */
const AlertLevel = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  CRITICAL: 'critical',
  EMERGENCY: 'emergency',
};

const THRESHOLD_WARNING = 0.80;
const THRESHOLD_CRITICAL = 0.75;
const THRESHOLD_EMERGENCY = 0.65;

const DEFAULT_SCAN_INTERVAL_MS = 5_000; // 5 s
const WINDOW_SIZE = 100;

// ---------------------------------------------------------------------------
// Helper: determine alert level from coherence score
// ---------------------------------------------------------------------------

/**
 * Map a coherence score to an alert level.
 *
 * @param {number} coherence - Cosine similarity in [0, 1].
 * @returns {string} One of AlertLevel values.
 */
function scoreToAlertLevel(coherence) {
  if (coherence < THRESHOLD_EMERGENCY) return AlertLevel.EMERGENCY;
  if (coherence < THRESHOLD_CRITICAL) return AlertLevel.CRITICAL;
  if (coherence < THRESHOLD_WARNING) return AlertLevel.WARNING;
  return AlertLevel.HEALTHY;
}

// ---------------------------------------------------------------------------
// ComponentMonitor
// ---------------------------------------------------------------------------

/**
 * Per-component drift monitor with sliding coherence window and trend analysis.
 */
class ComponentMonitor {
  /**
   * @param {string} componentId
   * @param {Float32Array} baselineVector - Healthy reference embedding.
   */
  constructor(componentId, baselineVector) {
    this.componentId = componentId;
    this.baselineVector = baselineVector;
    /** @type {number[]} Sliding window of coherence scores. */
    this.window = [];
    this.currentAlertLevel = AlertLevel.HEALTHY;
    this.previousAlertLevel = AlertLevel.HEALTHY;
    this.alertTransitions = 0;
    this.healingAttempts = 0;
    this.lastChecked = 0;
    this.lastCoherence = 1.0;
  }

  /**
   * Record a new coherence reading.
   * @param {number} coherence
   * @returns {string} Alert level after recording.
   */
  record(coherence) {
    this.window.push(coherence);
    if (this.window.length > WINDOW_SIZE) this.window.shift();
    this.lastCoherence = coherence;
    this.lastChecked = Date.now();
    this.previousAlertLevel = this.currentAlertLevel;
    this.currentAlertLevel = scoreToAlertLevel(coherence);
    if (this.currentAlertLevel !== this.previousAlertLevel) {
      this.alertTransitions += 1;
    }
    return this.currentAlertLevel;
  }

  /**
   * Compute coherence against the current component vector.
   * @param {Float32Array} currentVector
   * @returns {number} Coherence score.
   */
  measure(currentVector) {
    return cosineSimilarity(currentVector, this.baselineVector);
  }

  /**
   * Trend analysis on the sliding window.
   * @returns {'improving'|'stable'|'degrading'|'insufficient-data'}
   */
  getTrend() {
    if (this.window.length < 10) return 'insufficient-data';
    const recent = this.window.slice(-5);
    const older = this.window.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const delta = recentAvg - olderAvg;
    if (delta > 0.02) return 'improving';
    if (delta < -0.02) return 'degrading';
    return 'stable';
  }

  /**
   * Return the rolling average coherence.
   * @returns {number}
   */
  getAverageCoherence() {
    if (this.window.length === 0) return 1.0;
    return this.window.reduce((a, b) => a + b, 0) / this.window.length;
  }

  /**
   * Reset baseline to the provided vector (post-healing calibration).
   * @param {Float32Array} newBaseline
   */
  rebaseline(newBaseline) {
    this.baselineVector = newBaseline;
    this.window = [];
    this.currentAlertLevel = AlertLevel.HEALTHY;
    this.previousAlertLevel = AlertLevel.HEALTHY;
  }

  /**
   * Return a JSON-serialisable snapshot.
   * @returns {Object}
   */
  snapshot() {
    return {
      componentId: this.componentId,
      currentAlertLevel: this.currentAlertLevel,
      lastCoherence: this.lastCoherence,
      avgCoherence: this.getAverageCoherence(),
      trend: this.getTrend(),
      windowSize: this.window.length,
      alertTransitions: this.alertTransitions,
      healingAttempts: this.healingAttempts,
      lastChecked: this.lastChecked,
    };
  }
}

// ---------------------------------------------------------------------------
// DriftDetector
// ---------------------------------------------------------------------------

/**
 * DriftDetector runs a continuous scan loop over all registered components,
 * fires alert events at threshold crossings, and triggers self-healing actions
 * when the CRITICAL threshold is breached.
 *
 * @extends EventEmitter
 *
 * @fires DriftDetector#alert
 * @fires DriftDetector#alert-resolved
 * @fires DriftDetector#healing-triggered
 * @fires DriftDetector#emergency
 * @fires DriftDetector#scan-complete
 */
class DriftDetector extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.scanIntervalMs=5000] - Scan interval.
   * @param {Function} [options.onHealingTrigger] - Called with (componentId, coherence) when healing is needed.
   * @param {Function} [options.onDriftReport] - Called with drift report (for Autobiographer).
   * @param {Object} [options.selfAwareness] - SelfAwareness instance to subscribe to.
   * @param {boolean} [options.autoStart=false] - Start scanning immediately.
   */
  constructor(options = {}) {
    super();
    this.scanIntervalMs = options.scanIntervalMs || DEFAULT_SCAN_INTERVAL_MS;
    this.onHealingTrigger = options.onHealingTrigger || null;
    this.onDriftReport = options.onDriftReport || null;

    /** @type {Map<string, ComponentMonitor>} componentId → monitor */
    this.monitors = new Map();

    /** @type {Map<string, Function>} componentId → live vector accessor */
    this._vectorAccessors = new Map();

    this._scanTimer = null;
    this._scanning = false;
    this._stats = {
      scansCompleted: 0,
      alertsFired: 0,
      healingTriggered: 0,
      emergencies: 0,
      totalChecks: 0,
    };

    // If a SelfAwareness instance is provided, subscribe to its events.
    if (options.selfAwareness) {
      this._bindSelfAwareness(options.selfAwareness);
    }

    if (options.autoStart) this.start();
  }

  // -------------------------------------------------------------------------
  // Component registration
  // -------------------------------------------------------------------------

  /**
   * Register a component for drift monitoring.
   *
   * @param {string} componentId - Unique component ID.
   * @param {Float32Array} baselineVector - Healthy reference vector.
   * @param {Function} vectorAccessor - Synchronous function returning the
   *   component's current Float32Array vector.
   * @returns {ComponentMonitor}
   */
  register(componentId, baselineVector, vectorAccessor) {
    const monitor = new ComponentMonitor(componentId, baselineVector);
    this.monitors.set(componentId, monitor);
    this._vectorAccessors.set(componentId, vectorAccessor);
    return monitor;
  }

  /**
   * Update a component's vector accessor (e.g., after component restart).
   *
   * @param {string} componentId
   * @param {Function} vectorAccessor
   */
  updateAccessor(componentId, vectorAccessor) {
    this._vectorAccessors.set(componentId, vectorAccessor);
  }

  /**
   * Deregister a component from monitoring.
   *
   * @param {string} componentId
   * @returns {boolean}
   */
  deregister(componentId) {
    this.monitors.delete(componentId);
    this._vectorAccessors.delete(componentId);
    return true;
  }

  /**
   * Reset a component's baseline to its current vector after healing.
   *
   * @param {string} componentId
   * @returns {boolean}
   */
  rebaseline(componentId) {
    const monitor = this.monitors.get(componentId);
    const accessor = this._vectorAccessors.get(componentId);
    if (!monitor || !accessor) return false;
    const currentVector = accessor();
    if (currentVector) {
      monitor.rebaseline(currentVector);
    }
    return true;
  }

  // -------------------------------------------------------------------------
  // Scan lifecycle
  // -------------------------------------------------------------------------

  /** Start the continuous scan loop. */
  start() {
    if (this._scanTimer) return;
    this._scanTimer = setInterval(() => this._scan(), this.scanIntervalMs);
    if (this._scanTimer.unref) this._scanTimer.unref();
    // Immediate first scan.
    this._scan();
  }

  /** Stop the scan loop. */
  stop() {
    if (this._scanTimer) {
      clearInterval(this._scanTimer);
      this._scanTimer = null;
    }
  }

  /**
   * Force an immediate scan without waiting for the interval.
   * @returns {Object[]} Array of component snapshots from this scan.
   */
  scanNow() {
    return this._scan();
  }

  // -------------------------------------------------------------------------
  // Query
  // -------------------------------------------------------------------------

  /**
   * Get the current alert level for a specific component.
   *
   * @param {string} componentId
   * @returns {string|null} AlertLevel value or null if not registered.
   */
  getAlertLevel(componentId) {
    return this.monitors.get(componentId)?.currentAlertLevel ?? null;
  }

  /**
   * Get all components currently in a given alert level.
   *
   * @param {string} alertLevel - AlertLevel value.
   * @returns {ComponentMonitor[]}
   */
  getComponentsByAlert(alertLevel) {
    return [...this.monitors.values()].filter(m => m.currentAlertLevel === alertLevel);
  }

  /**
   * Return the overall system drift status.
   *
   * @returns {Object}
   */
  getSystemStatus() {
    const all = [...this.monitors.values()];
    const healthy = all.filter(m => m.currentAlertLevel === AlertLevel.HEALTHY).length;
    const warning = all.filter(m => m.currentAlertLevel === AlertLevel.WARNING).length;
    const critical = all.filter(m => m.currentAlertLevel === AlertLevel.CRITICAL).length;
    const emergency = all.filter(m => m.currentAlertLevel === AlertLevel.EMERGENCY).length;
    const avgCoherence = all.length > 0
      ? all.reduce((s, m) => s + m.getAverageCoherence(), 0) / all.length
      : 1.0;
    return {
      totalComponents: all.length,
      healthy,
      warning,
      critical,
      emergency,
      avgCoherence,
      overallAlertLevel: emergency > 0
        ? AlertLevel.EMERGENCY
        : critical > 0
          ? AlertLevel.CRITICAL
          : warning > 0
            ? AlertLevel.WARNING
            : AlertLevel.HEALTHY,
      stats: { ...this._stats },
    };
  }

  /**
   * Return snapshots for all monitored components.
   *
   * @returns {Object[]}
   */
  getAllSnapshots() {
    return [...this.monitors.values()].map(m => m.snapshot());
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Run one full scan pass over all monitored components.
   * @private
   * @returns {Object[]}
   */
  _scan() {
    if (this._scanning) return [];
    this._scanning = true;
    const results = [];
    const timestamp = Date.now();

    for (const [componentId, monitor] of this.monitors) {
      const accessor = this._vectorAccessors.get(componentId);
      if (!accessor) continue;
      try {
        const currentVector = accessor();
        if (!currentVector) continue;
        const coherence = monitor.measure(currentVector);
        const alertLevel = monitor.record(coherence);
        this._stats.totalChecks += 1;

        const result = {
          componentId,
          coherence,
          alertLevel,
          trend: monitor.getTrend(),
          previousAlertLevel: monitor.previousAlertLevel,
        };
        results.push(result);

        // Alert on level transitions.
        if (alertLevel !== monitor.previousAlertLevel) {
          this._handleAlertTransition(monitor, result, timestamp);
        }
      } catch (err) {
        // Log scan error without crashing.
        if (process.env.NODE_ENV !== 'test') {
          console.warn(`[DriftDetector] Scan error for ${componentId}: ${err.message}`);
        }
      }
    }

    this._stats.scansCompleted += 1;

    /**
     * @event DriftDetector#scan-complete
     * @type {{ results: Object[], timestamp: number }}
     */
    this.emit('scan-complete', { results, timestamp, stats: { ...this._stats } });

    // Report to Autobiographer if callback registered.
    if (this.onDriftReport && results.some(r => r.alertLevel !== AlertLevel.HEALTHY)) {
      this.onDriftReport({
        results: results.filter(r => r.alertLevel !== AlertLevel.HEALTHY),
        timestamp,
        systemStatus: this.getSystemStatus(),
      });
    }

    this._scanning = false;
    return results;
  }

  /**
   * Handle an alert level transition for a component.
   * @private
   * @param {ComponentMonitor} monitor
   * @param {Object} result
   * @param {number} timestamp
   */
  _handleAlertTransition(monitor, result, timestamp) {
    const { componentId, coherence, alertLevel, previousAlertLevel } = result;

    // Escalation (getting worse).
    if (alertLevel !== AlertLevel.HEALTHY) {
      this._stats.alertsFired += 1;
      /**
       * @event DriftDetector#alert
       * @type {{ componentId, coherence, alertLevel, previousAlertLevel, timestamp }}
       */
      this.emit('alert', { componentId, coherence, alertLevel, previousAlertLevel, timestamp });

      if (alertLevel === AlertLevel.EMERGENCY) {
        this._stats.emergencies += 1;
        /**
         * @event DriftDetector#emergency
         * @type {{ componentId, coherence, timestamp }}
         */
        this.emit('emergency', { componentId, coherence, timestamp });
      }

      if (alertLevel === AlertLevel.CRITICAL || alertLevel === AlertLevel.EMERGENCY) {
        this._triggerHealing(monitor, coherence, timestamp);
      }
    } else if (alertLevel === AlertLevel.HEALTHY && previousAlertLevel !== AlertLevel.HEALTHY) {
      // Recovery.
      /**
       * @event DriftDetector#alert-resolved
       * @type {{ componentId, coherence, timestamp }}
       */
      this.emit('alert-resolved', { componentId, coherence, timestamp });
    }
  }

  /**
   * Trigger self-healing for a drifting component.
   * @private
   * @param {ComponentMonitor} monitor
   * @param {number} coherence
   * @param {number} timestamp
   */
  _triggerHealing(monitor, coherence, timestamp) {
    monitor.healingAttempts += 1;
    this._stats.healingTriggered += 1;

    /**
     * @event DriftDetector#healing-triggered
     * @type {{ componentId, coherence, healingAttempts, timestamp }}
     */
    this.emit('healing-triggered', {
      componentId: monitor.componentId,
      coherence,
      healingAttempts: monitor.healingAttempts,
      timestamp,
    });

    if (this.onHealingTrigger) {
      try {
        this.onHealingTrigger(monitor.componentId, coherence);
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          console.error(`[DriftDetector] Healing trigger error: ${err.message}`);
        }
      }
    }
  }

  /**
   * Bind to a SelfAwareness instance to receive drift events.
   * @private
   * @param {Object} sa - SelfAwareness instance.
   */
  _bindSelfAwareness(sa) {
    // When SA detects drift, run an immediate scan.
    sa.on('drift-detected', () => this._scan());
    // When SA registers a new component, auto-register it for drift monitoring
    // if an accessor function is added via sa.
    sa.on('component-registered', ({ id }) => {
      const record = sa.components.get(id);
      if (record && !this.monitors.has(id)) {
        this.register(id, record.baselineVector, () => {
          const r = sa.components.get(id);
          return r ? r.vector : null;
        });
      }
    });
  }
}


module.exports = { DriftDetector, ComponentMonitor, AlertLevel, THRESHOLD_WARNING, THRESHOLD_CRITICAL, THRESHOLD_EMERGENCY, scoreToAlertLevel };

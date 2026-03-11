/**
 * ∞ Heady™ Self-Awareness — System Self-Model and Coherence Tracking
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module self-awareness
 * @description Maintains the platform's self-model: a live 384D "self-vector"
 *   that encodes the aggregate health and identity state of all registered
 *   components. Periodically re-embeds by aggregating component health signals,
 *   computes coherence as cosine similarity between the current and intended
 *   state vectors, and emits drift alerts when coherence falls below threshold.
 */

'use strict';

const { EventEmitter } = require('events');
const {
  centroid,
  cosineSimilarity,
  normalize,
  randomUnit,
  add,
  scale,
  DIMS,
} = require('./vector-space-ops');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COHERENCE_DRIFT_THRESHOLD = 0.75;
const COHERENCE_WARNING_THRESHOLD = 0.85;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 10_000; // 10 s
const EXPONENTIAL_SMOOTHING_ALPHA = 0.3; // EMA weight for self-vector updates

// ---------------------------------------------------------------------------
// ComponentRecord
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ComponentRecord
 * @property {string} id - Unique component ID.
 * @property {string} name - Human-readable name.
 * @property {string} type - Component type (e.g., 'memory', 'pipeline', 'agent').
 * @property {Float32Array} vector - Current 384D embedding of the component's state.
 * @property {Float32Array} baselineVector - Healthy baseline vector.
 * @property {number} healthScore - Latest normalised health score in [0, 1].
 * @property {number} registeredAt - Registration timestamp.
 * @property {number} lastUpdated - Last update timestamp.
 * @property {Object} metadata - Arbitrary component metadata.
 */

// ---------------------------------------------------------------------------
// SelfAwareness
// ---------------------------------------------------------------------------

/**
 * SelfAwareness is Heady™'s introspective module. It:
 * - Maintains a registry of all active system components and their embeddings.
 * - Aggregates component state into a single 384D self-vector.
 * - Computes coherence against an "intended state" vector.
 * - Fires events when coherence drifts or is restored.
 * - Drives the DriftDetector via event bus.
 *
 * @extends EventEmitter
 *
 * @fires SelfAwareness#drift-detected
 * @fires SelfAwareness#coherence-restored
 * @fires SelfAwareness#component-registered
 * @fires SelfAwareness#component-updated
 * @fires SelfAwareness#heartbeat
 */
class SelfAwareness extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.heartbeatIntervalMs=10000] - Heartbeat interval.
   * @param {number} [options.driftThreshold=0.75] - Coherence below which drift is declared.
   * @param {number} [options.warningThreshold=0.85] - Coherence below which warning fires.
   * @param {Float32Array} [options.intendedVector] - The "healthy target" self-vector.
   *   Defaults to a fixed random unit vector seeded at construction time.
   * @param {boolean} [options.autoStart=false] - Start heartbeat immediately.
   */
  constructor(options = {}) {
    super();
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.driftThreshold = options.driftThreshold || COHERENCE_DRIFT_THRESHOLD;
    this.warningThreshold = options.warningThreshold || COHERENCE_WARNING_THRESHOLD;

    // The intended/target state — what "healthy Heady™" looks like.
    // Can be set to a trained reference vector in production.
    this.intendedVector = options.intendedVector || this._buildIntendedVector();

    // Current self-vector — initialised to intended state.
    this.selfVector = new Float32Array(this.intendedVector);

    // Component registry.
    /** @type {Map<string, ComponentRecord>} */
    this.components = new Map();

    // Coherence history (last 100 readings).
    /** @type {number[]} */
    this._coherenceHistory = [];

    // Coherence state tracking.
    this._currentCoherence = 1.0;
    this._isDrifting = false;
    this._heartbeatTimer = null;

    this._stats = {
      heartbeatCount: 0,
      driftEvents: 0,
      recoveryEvents: 0,
      registrations: 0,
      updates: 0,
    };

    if (options.autoStart) this.startHeartbeat();
  }

  // -------------------------------------------------------------------------
  // Component Registry
  // -------------------------------------------------------------------------

  /**
   * Register a system component and its 384D state vector.
   *
   * @param {string} id - Unique component ID.
   * @param {string} name - Human-readable name.
   * @param {Float32Array} vector - Current 384D state embedding.
   * @param {Object} [options={}]
   * @param {string} [options.type='generic'] - Component type.
   * @param {number} [options.healthScore=1.0] - Initial health score.
   * @param {Object} [options.metadata={}] - Additional metadata.
   * @returns {ComponentRecord}
   *
   * @fires SelfAwareness#component-registered
   */
  registerComponent(id, name, vector, options = {}) {
    if (!(vector instanceof Float32Array) || vector.length !== DIMS) {
      throw new TypeError(`registerComponent: vector must be Float32Array(${DIMS})`);
    }
    const normalised = normalize(vector);
    const record = {
      id,
      name,
      type: options.type || 'generic',
      vector: normalised,
      baselineVector: new Float32Array(normalised), // Snapshot as healthy baseline.
      healthScore: options.healthScore !== undefined ? options.healthScore : 1.0,
      registeredAt: Date.now(),
      lastUpdated: Date.now(),
      metadata: options.metadata || {},
    };
    this.components.set(id, record);
    this._stats.registrations += 1;

    /**
     * @event SelfAwareness#component-registered
     * @type {{ id: string, name: string, type: string, timestamp: number }}
     */
    this.emit('component-registered', {
      id,
      name,
      type: record.type,
      timestamp: record.registeredAt,
    });

    // Trigger immediate self-vector update to incorporate new component.
    this._updateSelfVector();
    return record;
  }

  /**
   * Update the state vector and health score of a registered component.
   *
   * @param {string} id - Component ID.
   * @param {Float32Array} vector - New 384D state vector.
   * @param {number} [healthScore] - Updated health score in [0, 1].
   * @returns {boolean} True if the component was found and updated.
   *
   * @fires SelfAwareness#component-updated
   */
  updateComponent(id, vector, healthScore) {
    const record = this.components.get(id);
    if (!record) return false;

    if (!(vector instanceof Float32Array) || vector.length !== DIMS) {
      throw new TypeError(`updateComponent: vector must be Float32Array(${DIMS})`);
    }
    record.vector = normalize(vector);
    if (healthScore !== undefined) record.healthScore = Math.max(0, Math.min(1, healthScore));
    record.lastUpdated = Date.now();
    this._stats.updates += 1;

    this.emit('component-updated', {
      id,
      name: record.name,
      healthScore: record.healthScore,
      timestamp: record.lastUpdated,
    });
    return true;
  }

  /**
   * Deregister a component.
   *
   * @param {string} id
   * @returns {boolean}
   */
  deregisterComponent(id) {
    const existed = this.components.delete(id);
    if (existed) this._updateSelfVector();
    return existed;
  }

  // -------------------------------------------------------------------------
  // Heartbeat & Coherence
  // -------------------------------------------------------------------------

  /**
   * Perform a synchronous self-check: update self-vector, compute coherence,
   * and emit relevant events.
   *
   * @returns {{ coherence: number, drifting: boolean, componentCount: number }}
   *
   * @fires SelfAwareness#heartbeat
   * @fires SelfAwareness#drift-detected
   * @fires SelfAwareness#coherence-restored
   */
  heartbeat() {
    this._updateSelfVector();
    const coherence = cosineSimilarity(this.selfVector, this.intendedVector);
    this._currentCoherence = coherence;

    // Sliding coherence history.
    this._coherenceHistory.push(coherence);
    if (this._coherenceHistory.length > 100) {
      this._coherenceHistory.shift();
    }

    const wasDrifting = this._isDrifting;
    this._isDrifting = coherence < this.driftThreshold;

    // State transitions.
    if (this._isDrifting && !wasDrifting) {
      this._stats.driftEvents += 1;
      /**
       * @event SelfAwareness#drift-detected
       * @type {{ coherence: number, threshold: number, selfVector: Float32Array, timestamp: number }}
       */
      this.emit('drift-detected', {
        coherence,
        threshold: this.driftThreshold,
        selfVector: this.selfVector,
        timestamp: Date.now(),
      });
    } else if (!this._isDrifting && wasDrifting) {
      this._stats.recoveryEvents += 1;
      /**
       * @event SelfAwareness#coherence-restored
       * @type {{ coherence: number, timestamp: number }}
       */
      this.emit('coherence-restored', { coherence, timestamp: Date.now() });
    }

    this._stats.heartbeatCount += 1;

    const result = {
      coherence,
      drifting: this._isDrifting,
      warning: coherence < this.warningThreshold && !this._isDrifting,
      componentCount: this.components.size,
      timestamp: Date.now(),
    };

    /**
     * @event SelfAwareness#heartbeat
     * @type {Object}
     */
    this.emit('heartbeat', result);
    return result;
  }

  /**
   * Start periodic heartbeat on an interval timer.
   */
  startHeartbeat() {
    if (this._heartbeatTimer) return;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), this.heartbeatIntervalMs);
    if (this._heartbeatTimer.unref) this._heartbeatTimer.unref();
    // Run immediately.
    this.heartbeat();
  }

  /**
   * Stop the heartbeat timer.
   */
  stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Query API
  // -------------------------------------------------------------------------

  /**
   * Return the current coherence score (cosine similarity vs intended state).
   *
   * @returns {number} Coherence in [-1, 1] (typically [0.5, 1.0]).
   */
  getCoherence() {
    return this._currentCoherence;
  }

  /**
   * Return the current 384D self-vector.
   *
   * @returns {Float32Array}
   */
  getSelfVector() {
    return new Float32Array(this.selfVector); // Return copy.
  }

  /**
   * Return all registered components and their current vectors.
   *
   * @returns {Map<string, ComponentRecord>}
   */
  getComponentMap() {
    return new Map(this.components);
  }

  /**
   * Return coherence trend based on the sliding history window.
   *
   * @returns {'improving'|'stable'|'degrading'|'insufficient-data'}
   */
  getCoherenceTrend() {
    const h = this._coherenceHistory;
    if (h.length < 10) return 'insufficient-data';
    const recent = h.slice(-5);
    const older = h.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const delta = recentAvg - olderAvg;
    if (delta > 0.02) return 'improving';
    if (delta < -0.02) return 'degrading';
    return 'stable';
  }

  /**
   * Return a full status snapshot.
   *
   * @returns {Object}
   */
  getStatus() {
    return {
      coherence: this._currentCoherence,
      isDrifting: this._isDrifting,
      trend: this.getCoherenceTrend(),
      componentCount: this.components.size,
      heartbeatCount: this._stats.heartbeatCount,
      driftEvents: this._stats.driftEvents,
      recoveryEvents: this._stats.recoveryEvents,
      coherenceHistory: [...this._coherenceHistory],
      components: [...this.components.values()].map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        healthScore: r.healthScore,
        lastUpdated: r.lastUpdated,
      })),
    };
  }

  /**
   * Override the intended state vector (e.g., after system update/calibration).
   *
   * @param {Float32Array} vector - New intended 384D vector.
   */
  setIntendedVector(vector) {
    if (!(vector instanceof Float32Array) || vector.length !== DIMS) {
      throw new TypeError(`setIntendedVector: must be Float32Array(${DIMS})`);
    }
    this.intendedVector = normalize(vector);
    // Re-run heartbeat to compute new coherence immediately.
    this.heartbeat();
  }

  /**
   * Reset a component's baseline to its current vector (after healing).
   *
   * @param {string} id
   * @returns {boolean}
   */
  rebaselineComponent(id) {
    const record = this.components.get(id);
    if (!record) return false;
    record.baselineVector = new Float32Array(record.vector);
    return true;
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Recompute the self-vector from all component vectors, weighted by health.
   * Uses exponential smoothing against the previous self-vector.
   * @private
   */
  _updateSelfVector() {
    if (this.components.size === 0) return;

    // Weighted centroid: each component contributes health-weighted vector.
    const weightedVectors = [];
    for (const record of this.components.values()) {
      const weight = Math.max(0.01, record.healthScore);
      // Add component vector scaled by its health weight.
      weightedVectors.push(new Float32Array(record.vector.map(v => v * weight)));
    }

    // Sum all weighted vectors.
    let agg = new Float32Array(DIMS);
    for (const wv of weightedVectors) {
      for (let i = 0; i < DIMS; i++) agg[i] += wv[i];
    }
    // Normalise the aggregate.
    const newVector = normalize(agg);

    // Apply exponential moving average (EMA) smoothing.
    // selfVector = alpha * newVector + (1 - alpha) * selfVector
    const alpha = EXPONENTIAL_SMOOTHING_ALPHA;
    for (let i = 0; i < DIMS; i++) {
      this.selfVector[i] = alpha * newVector[i] + (1 - alpha) * this.selfVector[i];
    }
    // Re-normalise after blending.
    const mag = Math.sqrt(this.selfVector.reduce((s, v) => s + v * v, 0));
    if (mag > 0) {
      const inv = 1 / mag;
      for (let i = 0; i < DIMS; i++) this.selfVector[i] *= inv;
    }
  }

  /**
   * Build a deterministic intended vector using a fixed seed pattern.
   * In production this would be loaded from a calibrated reference file.
   * @private
   * @returns {Float32Array}
   */
  _buildIntendedVector() {
    // Construct a stable intended vector using a deterministic pattern.
    const v = new Float32Array(DIMS);
    for (let i = 0; i < DIMS; i++) {
      // Sinusoidal pattern: represents "harmonic" intended state.
      v[i] = Math.sin((i / DIMS) * 2 * Math.PI) * 0.5 +
             Math.cos((i / DIMS) * 4 * Math.PI) * 0.3 +
             Math.sin((i / DIMS) * 8 * Math.PI) * 0.2;
    }
    return normalize(v);
  }
}


module.exports = { SelfAwareness, COHERENCE_DRIFT_THRESHOLD, COHERENCE_WARNING_THRESHOLD };

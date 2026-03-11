/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Coherence Monitor — src/observability/coherence-monitor.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Continuous drift detection and alerting for the 20-node AI topology.
 * Monitors cosine similarity between node state embeddings and triggers
 * self-healing when coherence drops below phi-scaled thresholds.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { CSL_THRESHOLDS, phiInterval, fib, PSI } = require('../../shared/phi-math');
const { cslAND } = require('../../shared/csl-engine');
const { COHERENCE_THRESHOLDS, systemCoherence, ALL_NODES } = require('../../shared/sacred-geometry');

class CoherenceMonitor {
  /**
   * @param {object} opts
   * @param {Function} opts.getNodeState - async (nodeName) → Float64Array (384D embedding)
   * @param {number} [opts.checkIntervalMs] - Monitoring interval (default φ^4 × 1000 ≈ 6854ms)
   * @param {Function} [opts.onDrift] - Callback({ node, pairNode, score, status })
   * @param {Function} [opts.onRecovery] - Callback({ node, pairNode, score })
   * @param {Function} [opts.logger]
   */
  constructor(opts) {
    this.getNodeState = opts.getNodeState;
    this.checkIntervalMs = opts.checkIntervalMs || phiInterval(4, 1000);
    this.onDrift    = opts.onDrift || (() => {});
    this.onRecovery = opts.onRecovery || (() => {});
    this.logger     = opts.logger || console;

    this._timer = null;
    this._history = [];          // Recent coherence snapshots
    this._historyMax = fib(10);  // 55 snapshots
    this._driftedPairs = new Set(); // Currently drifted pairs
    this._running = false;
  }

  /**
   * Start continuous monitoring.
   */
  start() {
    if (this._timer) return;
    this._running = true;
    this._timer = setInterval(() => this._tick(), this.checkIntervalMs);
    if (this._timer.unref) this._timer.unref();
    this.logger.info?.('[CoherenceMonitor] Started', { intervalMs: this.checkIntervalMs });
  }

  /**
   * Stop monitoring.
   */
  stop() {
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.logger.info?.('[CoherenceMonitor] Stopped');
  }

  /**
   * Run a single coherence check.
   * @returns {Promise<object>} System coherence result
   */
  async check() {
    const nodeStates = new Map();

    // Collect state vectors from all available nodes
    for (const nodeName of ALL_NODES) {
      try {
        const state = await this.getNodeState(nodeName);
        if (state) nodeStates.set(nodeName, state);
      } catch (err) {
        this.logger.warn?.(`[CoherenceMonitor] Failed to get state for ${nodeName}`, err);
      }
    }

    if (nodeStates.size < 2) {
      return { overall: 1.0, status: 'INSUFFICIENT_DATA', drifted: [], nodeCount: nodeStates.size };
    }

    const result = systemCoherence(nodeStates);

    // Track drift events
    const currentDrifted = new Set();
    for (const driftStr of result.drifted) {
      const pairKey = driftStr.split(' ')[0]; // "NodeA<->NodeB"
      currentDrifted.add(pairKey);

      if (!this._driftedPairs.has(pairKey)) {
        // New drift detected
        this._driftedPairs.add(pairKey);
        const [nodeA, nodeB] = pairKey.split('<->');
        const scoreMatch = driftStr.match(/\(([0-9.]+)/);
        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
        this.onDrift({ node: nodeA, pairNode: nodeB, score, status: result.status });
      }
    }

    // Check for recoveries
    for (const pairKey of this._driftedPairs) {
      if (!currentDrifted.has(pairKey)) {
        // Pair has recovered
        this._driftedPairs.delete(pairKey);
        const [nodeA, nodeB] = pairKey.split('<->');
        this.onRecovery({ node: nodeA, pairNode: nodeB, score: result.overall });
      }
    }

    // History
    const snapshot = {
      timestamp: new Date().toISOString(),
      overall: result.overall,
      status: result.status,
      nodeCount: nodeStates.size,
      driftCount: result.drifted.length,
    };
    this._history.push(snapshot);
    if (this._history.length > this._historyMax) this._history.shift();

    return { ...result, nodeCount: nodeStates.size };
  }

  async _tick() {
    if (!this._running) return;
    try {
      await this.check();
    } catch (err) {
      this.logger.error?.('[CoherenceMonitor] Check failed', err);
    }
  }

  /**
   * Get coherence trend over recent history.
   * @returns {{ current: number, mean: number, min: number, max: number, trend: string }}
   */
  trend() {
    if (this._history.length === 0) return null;

    const scores = this._history.map(h => h.overall);
    const current = scores[scores.length - 1];
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    // Simple trend: compare last vs mean
    let trend;
    if (current > mean + 0.02) trend = 'IMPROVING';
    else if (current < mean - 0.02) trend = 'DECLINING';
    else trend = 'STABLE';

    return { current, mean, min, max, trend, samples: scores.length };
  }

  /**
   * Get currently drifted pairs.
   * @returns {string[]}
   */
  driftedPairs() {
    return Array.from(this._driftedPairs);
  }

  /**
   * Get full status.
   */
  status() {
    return {
      running: this._running,
      checkIntervalMs: this.checkIntervalMs,
      driftedPairs: this.driftedPairs(),
      trend: this.trend(),
      historySize: this._history.length,
    };
  }
}

module.exports = { CoherenceMonitor };

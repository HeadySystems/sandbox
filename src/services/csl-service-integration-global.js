/**
 * @file csl-service-integration-global.js
 * @description Global CSL Service Integration Gateway — routes, gates, and orchestrates
 *   all application services through Continuous Semantic Logic (CSL) confidence gates
 *   derived from the golden ratio φ = 1.6180339887.
 *
 * @module CSLServiceGateway
 * @version 2.0.0
 * @author HeadySystems Inc.
 * @copyright © 2026 Heady™Systems Inc. All rights reserved.
 *
 * @patent US-PENDING-2026-HSI-001 — Phi-Harmonic Semantic Gate Architecture
 * @patent US-PENDING-2026-HSI-002 — Continuous Semantic Logic Routing Protocol
 *
 * All numeric constants are derived from φ (phi) = 1.6180339887.
 *
 * CSL Gate Zones:
 *   EXECUTE  : confidence > PSI        (≈ 0.6180)
 *   CAUTIOUS : PSI² ≤ confidence ≤ PSI (≈ 0.3820 – 0.6180)
 *   HALT     : confidence < PSI²       (≈ 0.3820)
 */

'use strict';

const { createHash } = require('crypto');
const { EventEmitter } = require('events');

// ─────────────────────────────────────────────────────────────────────────────
// PHI CONSTANTS
// All constants are derived exclusively from φ = 1.6180339887
// ─────────────────────────────────────────────────────────────────────────────

/** @constant {number} PHI — Golden ratio φ */
const PHI = 1.6180339887;

/** @constant {number} PSI — Reciprocal of φ (≈ 0.6180339887) */
const PSI = 1 / PHI;

/** @constant {number} PSI2 — PSI squared (≈ 0.3819660113) */
const PSI2 = PSI * PSI;

/** @constant {number} PHI2 — PHI squared (≈ 2.6180339887) */
const PHI2 = PHI * PHI;

/** @constant {number} PHI_HALF — PHI / 2 */
const PHI_HALF = PHI / 2;

/** @constant {number} PHI_INV2 — 1 / PHI² */
const PHI_INV2 = 1 / PHI2;

/** @constant {number} EPSILON — Floating-point tolerance */
const EPSILON = 1e-10;

/**
 * All CSL threshold constants keyed by name.
 * @type {Object.<string,number>}
 */
const CSL_THRESHOLDS = {
  PHI,
  PSI,
  PSI2,
  PHI2,
  PHI_HALF,
  PHI_INV2,
  EXECUTE_THRESHOLD: PSI,
  CAUTIOUS_THRESHOLD: PSI2,
  HALT_THRESHOLD: PSI2,
  HIGH_CONFIDENCE: PSI,
  MID_CONFIDENCE: PSI2,
  SIMILARITY_THRESHOLD: PSI,
  WEIGHT_SCALE: PHI_INV2,
};

// ─────────────────────────────────────────────────────────────────────────────
// LOW-LEVEL VECTOR MATH UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the dot product of two numeric arrays.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dotProduct(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Compute the L2 (Euclidean) norm of a numeric array.
 * @param {number[]} v
 * @returns {number}
 */
function l2Norm(v) {
  if (!v || v.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/**
 * Normalize a numeric array to unit length.
 * Returns zero-vector of same length if norm is near-zero.
 * @param {number[]} v
 * @returns {number[]}
 */
function normalize(v) {
  if (!v || v.length === 0) return [];
  const n = l2Norm(v);
  if (n < EPSILON) return v.map(() => 0);
  return v.map(x => x / n);
}

/**
 * Cosine similarity between two vectors ∈ [-1, 1].
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  const na = l2Norm(a);
  const nb = l2Norm(b);
  if (na < EPSILON || nb < EPSILON) return 0;
  return dotProduct(a, b) / (na * nb);
}

/**
 * Weighted element-wise average of multiple vectors.
 * @param {number[][]} vectors
 * @param {number[]} weights  — must sum to > 0
 * @returns {number[]}
 */
function weightedAverage(vectors, weights) {
  if (!vectors || vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);
  let totalWeight = 0;

  for (let i = 0; i < vectors.length; i++) {
    const w = (weights && weights[i] !== undefined) ? weights[i] : 1;
    totalWeight += w;
    for (let j = 0; j < dim; j++) {
      result[j] += (vectors[i][j] || 0) * w;
    }
  }

  if (totalWeight < EPSILON) return result;
  return result.map(x => x / totalWeight);
}

/**
 * Geometric mean of an array of positive numbers.
 * @param {number[]} values
 * @returns {number}
 */
function geometricMean(values) {
  if (!values || values.length === 0) return 0;
  const nonZero = values.filter(v => v > 0);
  if (nonZero.length === 0) return 0;
  const logSum = nonZero.reduce((s, v) => s + Math.log(v), 0);
  return Math.exp(logSum / nonZero.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSL SCALAR GATE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core CSL gate — maps a confidence value to a binary gate output in [0,1].
 * Uses a soft sigmoid-like step anchored to PSI.
 * @param {number} confidence ∈ [0,1]
 * @returns {number} gate output ∈ [0,1]
 */
function cslGate(confidence) {
  // Smooth gate: 1 if > PSI, 0 if < PSI2, linear interpolation between
  if (confidence >= PSI) return 1;
  if (confidence < PSI2) return 0;
  return (confidence - PSI2) / (PSI - PSI2);
}

/**
 * Continuous AND: geometric mean of two CSL values.
 * @param {number} a ∈ [0,1]
 * @param {number} b ∈ [0,1]
 * @returns {number}
 */
function cslAnd(a, b) {
  return Math.sqrt(Math.max(0, a) * Math.max(0, b));
}

/**
 * Continuous OR: probabilistic union.
 * @param {number} a ∈ [0,1]
 * @param {number} b ∈ [0,1]
 * @returns {number}
 */
function cslOr(a, b) {
  const ca = Math.max(0, Math.min(1, a));
  const cb = Math.max(0, Math.min(1, b));
  return ca + cb - ca * cb;
}

/**
 * Continuous NOT: phi-complement.
 * @param {number} a ∈ [0,1]
 * @returns {number}
 */
function cslNot(a) {
  return 1 - Math.max(0, Math.min(1, a));
}

/**
 * Continuous XOR: exclusive disjunction.
 * @param {number} a ∈ [0,1]
 * @param {number} b ∈ [0,1]
 * @returns {number}
 */
function cslXor(a, b) {
  const ca = Math.max(0, Math.min(1, a));
  const cb = Math.max(0, Math.min(1, b));
  return Math.abs(ca - cb);
}

/**
 * Continuous IMPLIES (a → b): ¬a ∨ b.
 * @param {number} a ∈ [0,1]
 * @param {number} b ∈ [0,1]
 * @returns {number}
 */
function cslImplies(a, b) {
  return cslOr(cslNot(a), b);
}

/**
 * Continuous EQUIVALENCE: 1 - |a - b|.
 * @param {number} a ∈ [0,1]
 * @param {number} b ∈ [0,1]
 * @returns {number}
 */
function cslEquivalent(a, b) {
  return 1 - Math.abs(Math.max(0, Math.min(1, a)) - Math.max(0, Math.min(1, b)));
}

/**
 * Blend two vectors by phi-weighted interpolation.
 * @param {number[]} a
 * @param {number[]} b
 * @param {number} t  ∈ [0,1] blend factor
 * @returns {number[]}
 */
function cslBlend(a, b, t) {
  if (!a || !b || a.length !== b.length) return a || b || [];
  const tc = Math.max(0, Math.min(1, t));
  return a.map((v, i) => v * (1 - tc) + (b[i] || 0) * tc);
}

/**
 * Classify a confidence value into a CSL zone.
 * @param {number} confidence
 * @returns {'EXECUTE'|'CAUTIOUS'|'HALT'}
 */
function classifyConfidence(confidence) {
  if (confidence > PSI) return 'EXECUTE';
  if (confidence >= PSI2) return 'CAUTIOUS';
  return 'HALT';
}

// ─────────────────────────────────────────────────────────────────────────────
// CSL SERVICE GATEWAY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @class CSLServiceGateway
 * @extends EventEmitter
 * @description Global service registry and router powered by CSL gates.
 *   All routing decisions are confidence-gated using phi-derived thresholds.
 *
 * @example
 * const gw = new CSLServiceGateway();
 * gw.registerService('risk', [0.9, 0.1, 0.5], riskHandler);
 * const result = await gw.routeToService([0.8, 0.2, 0.4]);
 */
class CSLServiceGateway extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {boolean} [options.verbose=false] — emit detailed debug events
   * @param {number} [options.defaultThreshold=PSI] — default routing threshold
   */
  constructor(options = {}) {
    super();

    /** @type {Map<string, {gateVector: number[], handler: Function, callCount: number, avgConfidence: number}>} */
    this._registry = new Map();

    /** @type {boolean} */
    this._verbose = Boolean(options.verbose);

    /** @type {number} */
    this._defaultThreshold = options.defaultThreshold !== undefined
      ? options.defaultThreshold
      : PSI;

    // ── Metrics ──────────────────────────────────────────────────────────────
    this._metrics = {
      totalRoutes: 0,
      totalGateEvals: 0,
      totalBatchEvals: 0,
      totalConsensus: 0,
      totalDecisions: 0,
      executeCount: 0,
      cautiousCount: 0,
      haltCount: 0,
      confidenceSum: 0,
      activationCount: 0,
    };
  }

  // ── Registry ──────────────────────────────────────────────────────────────

  /**
   * Register a service with its semantic gate vector.
   * @param {string} name  — unique service identifier
   * @param {number[]} gateVector — semantic embedding for this service
   * @param {Function} handler — async (input, context) => result
   * @returns {this}
   */
  registerService(name, gateVector, handler) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('Service name must be a non-empty string');
    }
    if (!Array.isArray(gateVector) || gateVector.length === 0) {
      throw new TypeError('gateVector must be a non-empty numeric array');
    }
    if (typeof handler !== 'function') {
      throw new TypeError('handler must be a function');
    }

    this._registry.set(name, {
      gateVector: normalize(gateVector),
      rawVector: [...gateVector],
      handler,
      callCount: 0,
      avgConfidence: 0,
    });

    this.emit('service:registered', { name, dim: gateVector.length });
    return this;
  }

  /**
   * Deregister a service by name.
   * @param {string} name
   * @returns {boolean} true if removed
   */
  deregisterService(name) {
    const removed = this._registry.delete(name);
    if (removed) this.emit('service:deregistered', { name });
    return removed;
  }

  /**
   * List registered service names.
   * @returns {string[]}
   */
  listServices() {
    return [...this._registry.keys()];
  }

  // ── Core Routing ──────────────────────────────────────────────────────────

  /**
   * CSL-gate input and route to the best-matching registered service.
   * Selects based on highest cosine similarity above threshold.
   *
   * @param {number[]} inputVector
   * @param {number} [threshold] — minimum cosine similarity to route (default: PSI)
   * @returns {{ service: string|null, confidence: number, activation: number, zone: string }}
   */
  routeToService(inputVector, threshold) {
    const thresh = threshold !== undefined ? threshold : this._defaultThreshold;

    if (!Array.isArray(inputVector) || inputVector.length === 0) {
      return { service: null, confidence: 0, activation: 0, zone: 'HALT' };
    }

    const normInput = normalize(inputVector);

    let bestService = null;
    let bestSimilarity = -Infinity;

    for (const [name, entry] of this._registry) {
      const sim = cosineSimilarity(normInput, entry.gateVector);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestService = name;
      }
    }

    const confidence = Math.max(0, bestSimilarity);
    const activation = cslGate(confidence);
    const zone = classifyConfidence(confidence);

    this._metrics.totalRoutes++;
    this._metrics.confidenceSum += confidence;
    if (activation > 0) this._metrics.activationCount++;

    if (confidence < thresh) {
      this.emit('route:below-threshold', { confidence, thresh });
      return { service: null, confidence, activation, zone };
    }

    if (bestService) {
      const entry = this._registry.get(bestService);
      entry.callCount++;
      entry.avgConfidence = (entry.avgConfidence * (entry.callCount - 1) + confidence) / entry.callCount;
    }

    this.emit('route:resolved', { service: bestService, confidence, zone });
    return { service: bestService, confidence, activation, zone };
  }

  // ── Gate Action ───────────────────────────────────────────────────────────

  /**
   * Wrap any async action with a CSL gate.
   * - confidence > PSI      → execute normally
   * - PSI² ≤ confidence ≤ PSI → execute cautiously (emit warning event)
   * - confidence < PSI²    → halt, return null
   *
   * @param {number} confidence ∈ [0,1]
   * @param {Function} action — async () => result
   * @param {object} [context] — optional metadata for events
   * @returns {Promise<{result: any, zone: string, confidence: number}>}
   */
  async gateAction(confidence, action, context = {}) {
    this._metrics.totalGateEvals++;
    const zone = classifyConfidence(confidence);

    switch (zone) {
      case 'EXECUTE': {
        this._metrics.executeCount++;
        const result = await action();
        this.emit('gate:execute', { confidence, ...context });
        return { result, zone, confidence };
      }

      case 'CAUTIOUS': {
        this._metrics.cautiousCount++;
        this.emit('gate:cautious', {
          confidence,
          warning: `Confidence ${confidence.toFixed(4)} is in CAUTIOUS zone [${PSI2.toFixed(4)}, ${PSI.toFixed(4)}]`,
          ...context,
        });
        const result = await action();
        return { result, zone, confidence };
      }

      case 'HALT':
      default: {
        this._metrics.haltCount++;
        this.emit('gate:halt', { confidence, ...context });
        return { result: null, zone, confidence };
      }
    }
  }

  // ── Decision Ranking ──────────────────────────────────────────────────────

  /**
   * Rank candidates by cosine similarity to a query vector.
   * @param {Array<{id: string, vector: number[], [key: string]: any}>} candidates
   * @param {number[]} queryVec
   * @returns {Array<{id: string, similarity: number, zone: string, rank: number}>}
   */
  decide(candidates, queryVec) {
    if (!Array.isArray(candidates) || !Array.isArray(queryVec)) return [];

    this._metrics.totalDecisions++;
    const normQuery = normalize(queryVec);

    const scored = candidates.map(candidate => {
      const sim = cosineSimilarity(normalize(candidate.vector || []), normQuery);
      return {
        ...candidate,
        similarity: sim,
        zone: classifyConfidence(sim),
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  // ── Consensus ─────────────────────────────────────────────────────────────

  /**
   * Compute a weighted consensus vector from multiple input vectors.
   * Returns normalized weighted average.
   *
   * @param {number[][]} vectors
   * @param {number[]} [weights] — optional weights (default: uniform)
   * @returns {{ consensus: number[], coherence: number }}
   */
  consensus(vectors, weights) {
    if (!Array.isArray(vectors) || vectors.length === 0) {
      return { consensus: [], coherence: 0 };
    }

    this._metrics.totalConsensus++;
    const uniform = vectors.map(() => 1 / vectors.length);
    const w = weights || uniform;
    const avg = weightedAverage(vectors, w);
    const normed = normalize(avg);

    // Coherence: mean pairwise similarity
    let simSum = 0;
    let pairs = 0;
    for (let i = 0; i < vectors.length; i++) {
      for (let j = i + 1; j < vectors.length; j++) {
        simSum += Math.max(0, cosineSimilarity(normalize(vectors[i]), normalize(vectors[j])));
        pairs++;
      }
    }
    const coherence = pairs > 0 ? simSum / pairs : 1;

    return { consensus: normed, coherence };
  }

  // ── Batch Gate ────────────────────────────────────────────────────────────

  /**
   * Evaluate a batch of input vectors against a single gate vector.
   * @param {number[][]} inputs
   * @param {number[]} gateVector
   * @param {number} [threshold=PSI]
   * @returns {Array<{index: number, similarity: number, activation: number, zone: string, passed: boolean}>}
   */
  batchGate(inputs, gateVector, threshold) {
    const thresh = threshold !== undefined ? threshold : PSI;
    if (!Array.isArray(inputs) || !Array.isArray(gateVector)) return [];

    this._metrics.totalBatchEvals += inputs.length;
    const normGate = normalize(gateVector);

    return inputs.map((input, index) => {
      const sim = cosineSimilarity(normalize(input), normGate);
      const activation = cslGate(Math.max(0, sim));
      const zone = classifyConfidence(Math.max(0, sim));
      return {
        index,
        similarity: sim,
        activation,
        zone,
        passed: sim >= thresh,
      };
    });
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  /**
   * Return operational metrics snapshot.
   * @returns {object}
   */
  getMetrics() {
    const total = this._metrics.totalRoutes;
    const avgConfidence = total > 0
      ? this._metrics.confidenceSum / total
      : 0;
    const gateActivationRate = total > 0
      ? this._metrics.activationCount / total
      : 0;

    const serviceStats = {};
    for (const [name, entry] of this._registry) {
      serviceStats[name] = {
        callCount: entry.callCount,
        avgConfidence: entry.avgConfidence,
      };
    }

    return {
      ...this._metrics,
      avgConfidence,
      gateActivationRate,
      registeredServices: this._registry.size,
      serviceStats,
      thresholds: { PSI, PSI2, PHI },
    };
  }

  /**
   * Reset all metrics counters.
   * @returns {this}
   */
  resetMetrics() {
    Object.keys(this._metrics).forEach(k => { this._metrics[k] = 0; });
    return this;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHA-256 UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic SHA-256 hash of a string or JSON-serializable value.
 * @param {string|object} input
 * @returns {string} hex digest
 */
function sha256(input) {
  const data = typeof input === 'string' ? input : JSON.stringify(input);
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Class
  CSLServiceGateway,

  // Constants
  PHI,
  PSI,
  PSI2,
  PHI2,
  PHI_HALF,
  PHI_INV2,
  EPSILON,
  CSL_THRESHOLDS,

  // Vector math
  dotProduct,
  l2Norm,
  normalize,
  cosineSimilarity,
  weightedAverage,
  geometricMean,

  // CSL scalars
  cslGate,
  cslAnd,
  cslOr,
  cslNot,
  cslXor,
  cslImplies,
  cslEquivalent,
  cslBlend,
  classifyConfidence,

  // Utilities
  sha256,
};

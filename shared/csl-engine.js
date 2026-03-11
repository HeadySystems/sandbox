/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ CSL Engine — shared/csl-engine.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Continuous Semantic Logic: geometric AI gates replacing discrete boolean logic.
 * All operations work on unit vectors in ℝᴰ (D ∈ {384, 1536}).
 *
 * Gates: AND, OR, NOT, IMPLY, XOR, CONSENSUS, GATE
 * HDC/VSA: BIND, BUNDLE, PERMUTE for hyperdimensional computing
 * MoE Router: Cosine-similarity based expert routing
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, CSL_THRESHOLDS, PSI_POWERS, phiThreshold } = require('./phi-math');

// ─── Vector Utilities ────────────────────────────────────────────────────────

/**
 * Compute dot product of two vectors.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number}
 */
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Compute L2 norm of a vector.
 * @param {Float64Array|number[]} v
 * @returns {number}
 */
function norm(v) {
  return Math.sqrt(dot(v, v));
}

/**
 * Normalize a vector to unit length.
 * @param {Float64Array|number[]} v
 * @returns {Float64Array}
 */
function normalize(v) {
  const n = norm(v);
  if (n === 0) return new Float64Array(v.length);
  const result = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) result[i] = v[i] / n;
  return result;
}

/**
 * Add two vectors.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function add(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] + b[i];
  return result;
}

/**
 * Subtract vector b from a.
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function sub(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] - b[i];
  return result;
}

/**
 * Scale a vector by a scalar.
 * @param {Float64Array|number[]} v
 * @param {number} s
 * @returns {Float64Array}
 */
function scale(v, s) {
  const result = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) result[i] = v[i] * s;
  return result;
}

// ─── CSL Gates ───────────────────────────────────────────────────────────────

/**
 * CSL AND: Cosine similarity — measures semantic alignment.
 * τ(a,b) = cos(θ) = (a·b) / (‖a‖·‖b‖)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {number} Value in [-1, +1]
 */
function cslAND(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

/**
 * CSL OR: Superposition — soft semantic union.
 * OR(a,b) = normalize(a + b)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array} Unit vector
 */
function cslOR(a, b) {
  return normalize(add(a, b));
}

/**
 * CSL NOT: Orthogonal projection — semantic negation.
 * NOT(a,b) = a - proj_b(a) = a - (a·b / ‖b‖²)·b
 * Property: NOT(a,b) · b = 0 (guaranteed orthogonality)
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function cslNOT(a, b) {
  const bNormSq = dot(b, b);
  if (bNormSq === 0) return new Float64Array(a);
  const projCoeff = dot(a, b) / bNormSq;
  return sub(a, scale(b, projCoeff));
}

/**
 * CSL IMPLY: Projection — component of a in direction of b.
 * IMPLY(a,b) = proj_b(a) = (a·b / ‖b‖²)·b
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function cslIMPLY(a, b) {
  const bNormSq = dot(b, b);
  if (bNormSq === 0) return new Float64Array(a.length);
  const projCoeff = dot(a, b) / bNormSq;
  return scale(b, projCoeff);
}

/**
 * CSL XOR: Exclusive semantic components.
 * XOR(a,b) = normalize(a+b) - mutual projection
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function cslXOR(a, b) {
  const combined = normalize(add(a, b));
  const aExclusive = cslNOT(a, b);
  const bExclusive = cslNOT(b, a);
  return normalize(add(aExclusive, bExclusive));
}

/**
 * CSL CONSENSUS: Weighted centroid of multiple agent vectors.
 * CONSENSUS(vᵢ, wᵢ) = normalize(Σ wᵢ·vᵢ)
 * @param {Array<Float64Array|number[]>} vectors
 * @param {number[]} [weights] - If omitted, uniform weights
 * @returns {Float64Array}
 */
function cslCONSENSUS(vectors, weights) {
  if (vectors.length === 0) return new Float64Array(0);
  const dim = vectors[0].length;
  const result = new Float64Array(dim);
  const w = weights || vectors.map(() => 1 / vectors.length);
  for (let v = 0; v < vectors.length; v++) {
    for (let d = 0; d < dim; d++) {
      result[d] += w[v] * vectors[v][d];
    }
  }
  return normalize(result);
}

/**
 * CSL GATE: Soft sigmoid gating on cosine alignment.
 * GATE(value, cos, τ, temp) = value × σ((cos - τ) / temp)
 * @param {number} value
 * @param {number} cosScore
 * @param {number} [tau=CSL_THRESHOLDS.MEDIUM]
 * @param {number} [temp=PSI³]
 * @returns {number}
 */
function cslGATE(value, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PSI_POWERS[3]) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temp));
  return value * sigmoid;
}

// ─── Multi-Vector Operations ─────────────────────────────────────────────────

/**
 * Batch cosine similarity of a query against multiple candidates.
 * @param {Float64Array|number[]} query
 * @param {Array<Float64Array|number[]>} candidates
 * @returns {number[]} Similarity scores
 */
function batchSimilarity(query, candidates) {
  return candidates.map(c => cslAND(query, c));
}

/**
 * Top-K selection by cosine similarity.
 * @param {Float64Array|number[]} query
 * @param {Array<{id: string, vector: Float64Array|number[]}>} items
 * @param {number} k
 * @returns {Array<{id: string, score: number}>}
 */
function topK(query, items, k) {
  const scored = items.map(item => ({
    id: item.id,
    score: cslAND(query, item.vector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

// ─── HDC/VSA Operations ──────────────────────────────────────────────────────

/**
 * HDC BIND: Element-wise multiplication (real HRR style).
 * Creates compositional representation (role-filler binding).
 * @param {Float64Array|number[]} a
 * @param {Float64Array|number[]} b
 * @returns {Float64Array}
 */
function hdcBIND(a, b) {
  const result = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) result[i] = a[i] * b[i];
  return normalize(result);
}

/**
 * HDC BUNDLE: Aggregate multiple vectors (majority/superposition).
 * @param {Array<Float64Array|number[]>} vectors
 * @returns {Float64Array}
 */
function hdcBUNDLE(vectors) {
  if (vectors.length === 0) return new Float64Array(0);
  const dim = vectors[0].length;
  const result = new Float64Array(dim);
  for (const v of vectors) {
    for (let d = 0; d < dim; d++) result[d] += v[d];
  }
  return normalize(result);
}

/**
 * HDC PERMUTE: Cyclic shift for sequence encoding.
 * @param {Float64Array|number[]} v
 * @param {number} [n=1] - Number of positions to shift
 * @returns {Float64Array}
 */
function hdcPERMUTE(v, n = 1) {
  const len = v.length;
  const shift = ((n % len) + len) % len;
  const result = new Float64Array(len);
  for (let i = 0; i < len; i++) {
    result[(i + shift) % len] = v[i];
  }
  return result;
}

// ─── MoE Router (CSL-Based) ─────────────────────────────────────────────────

/**
 * Cosine-similarity Mixture-of-Experts router.
 * Routes input to top-K experts using CSL scoring instead of learned weights.
 *
 * @param {Float64Array|number[]} input - Input embedding
 * @param {Array<{id: string, gate: Float64Array|number[]}>} experts
 * @param {object} [opts]
 * @param {number} [opts.k=2] - Top-K experts to select
 * @param {number} [opts.temperature] - Softmax temperature (default ψ³)
 * @param {number} [opts.antiCollapse] - Anti-collapse regularization (default ψ⁸)
 * @returns {Array<{id: string, weight: number}>}
 */
function moeRoute(input, experts, opts = {}) {
  const k = opts.k || 2;
  const temperature = opts.temperature || PSI_POWERS[3]; // ψ³ ≈ 0.236
  const antiCollapse = opts.antiCollapse || PSI_POWERS[8]; // ψ⁸ ≈ 0.013

  // Score each expert
  const scores = experts.map(e => ({
    id: e.id,
    raw: cslAND(input, e.gate),
  }));

  // Softmax with temperature
  const maxScore = Math.max(...scores.map(s => s.raw));
  const exps = scores.map(s => ({
    id: s.id,
    exp: Math.exp((s.raw - maxScore) / temperature) + antiCollapse,
  }));
  const sumExp = exps.reduce((s, e) => s + e.exp, 0);

  // Normalize and select top-K
  const probs = exps.map(e => ({ id: e.id, weight: e.exp / sumExp }));
  probs.sort((a, b) => b.weight - a.weight);
  const selected = probs.slice(0, k);

  // Re-normalize selected weights
  const selectedSum = selected.reduce((s, e) => s + e.weight, 0);
  return selected.map(e => ({ id: e.id, weight: e.weight / selectedSum }));
}

// ─── Ternary Logic ───────────────────────────────────────────────────────────

/**
 * Map cosine similarity to ternary truth value.
 * +1 ≈ TRUE, 0 ≈ UNKNOWN, -1 ≈ FALSE
 * @param {number} cosScore
 * @param {number} [threshold=CSL_THRESHOLDS.MINIMUM]
 * @returns {'TRUE'|'UNKNOWN'|'FALSE'}
 */
function ternary(cosScore, threshold = CSL_THRESHOLDS.MINIMUM) {
  if (cosScore >= threshold) return 'TRUE';
  if (cosScore <= -threshold) return 'FALSE';
  return 'UNKNOWN';
}

/**
 * Ternary truth value as continuous number.
 * Maps cos ∈ [-1,1] to truth ∈ [0,1] via (cos + 1) / 2.
 * @param {number} cosScore
 * @returns {number}
 */
function truthValue(cosScore) {
  return (cosScore + 1) / 2;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Vector utilities
  dot, norm, normalize, add, sub, scale,

  // CSL Gates
  cslAND, cslOR, cslNOT, cslIMPLY, cslXOR, cslCONSENSUS, cslGATE,

  // Multi-vector
  batchSimilarity, topK,

  // HDC/VSA
  hdcBIND, hdcBUNDLE, hdcPERMUTE,

  // MoE Router
  moeRoute,

  // Ternary Logic
  ternary, truthValue,
};

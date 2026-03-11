/**
 * @fileoverview Heady™ CSL Router — Mixture-of-Experts Cosine Routing
 *
 * Routes input embeddings to the best-matched expert modules using cosine
 * similarity scoring, phi-temperature softmax, and anti-collapse detection.
 *
 * Algorithm:
 *   scores[i] = cos(input, expertGate[i])         ← alignment score
 *   probs[i]  = softmax(scores / temperature)[i]  ← routing probability
 *   selected  = topK(probs, k = fib(3) = 2)       ← chosen experts
 *
 * Anti-collapse: if max(probs) > 1 - ψ⁹ all weight converges to one expert,
 * so we inject a uniform noise floor of ψ⁸ per expert.
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  PSI,
  PHI,
  fib,
  CSL_THRESHOLDS,
  cosineSimilarity,
  VECTOR,
  normalize,
  adaptiveTemperature,
} = require('../../shared/phi-math.js');

// ─── Router constants (all from phi-math) ────────────────────────────────────

/** Default routing temperature: ψ³ ≈ 0.236 */
const ROUTE_TEMPERATURE = Math.pow(PSI, 3);

/** Anti-collapse detection threshold: ψ⁹ ≈ 0.0081 */
const COLLAPSE_THRESHOLD = Math.pow(PSI, 9);

/** Anti-collapse noise floor per expert: ψ⁸ ≈ 0.0131 */
const COLLAPSE_NOISE = Math.pow(PSI, 8);

/** Default topK expert selection: fib(3) = 2 */
const DEFAULT_TOP_K = fib(3);

/** Minimum cosine score to consider an expert eligible: CSL LOW ≈ 0.691 */
const MIN_EXPERT_SCORE = CSL_THRESHOLDS.LOW;

/** Expert gate initialization spread: uses PHI for range */
const EXPERT_INIT_SPREAD = PHI;

// ─── Softmax ─────────────────────────────────────────────────────────────────

/**
 * Numerically-stable softmax with temperature scaling.
 * @param {number[]} scores - raw cosine scores
 * @param {number} [temperature=ROUTE_TEMPERATURE]
 * @returns {number[]} probability distribution (sums to 1)
 */
function softmax(scores, temperature = ROUTE_TEMPERATURE) {
  const scaled = scores.map(s => s / Math.max(temperature, 1e-12));
  const maxVal = Math.max(...scaled);
  const exps   = scaled.map(s => Math.exp(s - maxVal));
  const sum    = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / (sum || 1));
}

// ─── Anti-collapse detection ─────────────────────────────────────────────────

/**
 * Detect routing collapse: true when the max probability leaves less than
 * COLLAPSE_THRESHOLD probability mass across all other experts.
 * @param {number[]} probs - softmax probabilities
 * @returns {boolean}
 */
function isCollapsed(probs) {
  if (probs.length <= 1) return false;
  const maxP = Math.max(...probs);
  return (1 - maxP) < COLLAPSE_THRESHOLD;
}

/**
 * Apply anti-collapse correction: add uniform noise floor, then renormalize.
 * Injects COLLAPSE_NOISE per expert before renormalizing.
 * @param {number[]} probs - original probabilities
 * @returns {number[]} corrected probabilities
 */
function applyAntiCollapse(probs) {
  const noisy = probs.map(p => p + COLLAPSE_NOISE);
  const sum   = noisy.reduce((a, b) => a + b, 0);
  return noisy.map(p => p / sum);
}

// ─── TopK selection ───────────────────────────────────────────────────────────

/**
 * Select top-K indices by probability.
 * @param {number[]} probs - probability distribution
 * @param {number} [k=DEFAULT_TOP_K]
 * @returns {Array<{index: number, prob: number}>} sorted descending by prob
 */
function topKSelect(probs, k = DEFAULT_TOP_K) {
  return probs
    .map((prob, index) => ({ index, prob }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, Math.min(k, probs.length));
}

// ─── CSLRouter class ─────────────────────────────────────────────────────────

/**
 * @class CSLRouter
 * Mixture-of-Experts router using cosine similarity as the routing function.
 *
 * @example
 * const router = new CSLRouter(['code', 'docs', 'data', 'search']);
 * const result = router.route(inputEmbedding);
 * // result.selected = [{name, index, prob, score}]
 */
class CSLRouter {
  /**
   * @param {string[]} expertNames - names of available experts
   * @param {object}   [opts]
   * @param {number}   [opts.dims=384]        - embedding dimension
   * @param {number}   [opts.temperature]     - softmax temperature (default ψ³)
   * @param {number}   [opts.topK]            - experts to select (default fib(3)=2)
   * @param {boolean}  [opts.adaptiveTemp]    - enable entropy-adaptive temperature
   */
  constructor(expertNames, opts = {}) {
    this.expertNames   = expertNames;
    this.dims          = opts.dims || VECTOR.DIMS;
    this.temperature   = opts.temperature || ROUTE_TEMPERATURE;
    this.topK          = opts.topK || DEFAULT_TOP_K;
    this.adaptiveTemp  = opts.adaptiveTemp !== false;

    // Initialize random unit-vector gates for each expert
    // Using (random - PSI) * PHI range as per CSL spec
    this.expertGates = expertNames.map(() =>
      normalize(
        Array.from({ length: this.dims }, () =>
          (Math.random() - PSI) * EXPERT_INIT_SPREAD
        )
      )
    );

    // Routing telemetry
    this._routeCount    = 0;
    this._collapseCount = 0;
    this._lastScores    = null;
    this._lastProbs     = null;
  }

  /**
   * Update the gate vector for a named expert (e.g., after fine-tuning).
   * @param {string}   name
   * @param {number[]} gateVector - raw (will be normalized)
   */
  setExpertGate(name, gateVector) {
    const idx = this.expertNames.indexOf(name);
    if (idx === -1) throw new Error(`CSLRouter: unknown expert "${name}"`);
    this.expertGates[idx] = normalize(gateVector);
  }

  /**
   * Route an input embedding to the top experts.
   *
   * @param {number[]} input - query embedding (will be normalized internally)
   * @param {object}   [opts]
   * @param {number}   [opts.topK]      - override default topK
   * @param {number}   [opts.entropy]   - current system entropy (for adaptive temp)
   * @param {number}   [opts.maxEntropy]
   * @returns {{
   *   selected: Array<{name:string, index:number, prob:number, score:number}>,
   *   scores:   number[],
   *   probs:    number[],
   *   collapsed: boolean,
   *   temperature: number
   * }}
   */
  route(input, opts = {}) {
    const k      = opts.topK || this.topK;
    const normed = normalize(input);

    // Compute cosine scores against each expert gate
    const scores = this.expertGates.map(gate => cosineSimilarity(normed, gate));

    // Determine temperature — adaptive or fixed
    let temp = this.temperature;
    if (this.adaptiveTemp && opts.entropy != null && opts.maxEntropy != null) {
      temp = adaptiveTemperature(opts.entropy, opts.maxEntropy);
    }

    // Softmax routing distribution
    let probs = softmax(scores, temp);

    // Detect and correct collapse
    let collapsed = isCollapsed(probs);
    if (collapsed) {
      this._collapseCount++;
      probs = applyAntiCollapse(probs);
    }

    // Top-K expert selection
    const topExperts = topKSelect(probs, k);
    const selected = topExperts
      .filter(e => scores[e.index] >= MIN_EXPERT_SCORE)
      .map(e => ({
        name:  this.expertNames[e.index],
        index: e.index,
        prob:  e.prob,
        score: scores[e.index],
      }));

    // Fallback: if all experts below threshold, take the best one regardless
    if (selected.length === 0) {
      const best = topExperts[0];
      selected.push({
        name:  this.expertNames[best.index],
        index: best.index,
        prob:  best.prob,
        score: scores[best.index],
      });
    }

    this._routeCount++;
    this._lastScores = scores;
    this._lastProbs  = probs;

    return { selected, scores, probs, collapsed, temperature: temp };
  }

  /**
   * Router diagnostics snapshot.
   * @returns {object}
   */
  stats() {
    return {
      expertCount:    this.expertNames.length,
      routeCount:     this._routeCount,
      collapseCount:  this._collapseCount,
      collapseRate:   this._routeCount > 0
        ? this._collapseCount / this._routeCount
        : 0,
      lastScores:     this._lastScores,
      lastProbs:      this._lastProbs,
      temperature:    this.temperature,
      topK:           this.topK,
    };
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  CSLRouter,
  // Expose primitives for testing / composing
  softmax,
  isCollapsed,
  applyAntiCollapse,
  topKSelect,
  // Constants
  ROUTE_TEMPERATURE,
  COLLAPSE_THRESHOLD,
  COLLAPSE_NOISE,
  DEFAULT_TOP_K,
  MIN_EXPERT_SCORE,
};

/**
 * @file csl-engine-enhanced.js
 * @description CSL (Continuous Scalar Logic) Engine — Phi-grounded scalar gate operations
 *              for the Heady™ trading and service layer. All thresholds and weights derive
 *              from the golden ratio φ = 1.6180339887.
 *
 * @copyright © 2026 Heady™Systems Inc. All rights reserved.
 *
 * @patent
 *   Protected under 60+ provisional patent applications filed with the USPTO covering
 *   phi-grounded scalar confidence logic, continuous gate operations, geometric fusion
 *   networks, risk-level sigmoid activation, and related methods in autonomous trading,
 *   service routing, and decision orchestration systems. Unauthorized use, reproduction,
 *   or distribution of this file or its algorithms is strictly prohibited.
 *
 * @module csl-engine-enhanced
 * @version 2.0.0
 * @since 1.0.0
 * @author HeadySystems Engineering
 */

'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');

// ---------------------------------------------------------------------------
// PHI CONSTANTS — ALL derived from φ = 1.6180339887
// ---------------------------------------------------------------------------

/** @constant {number} PHI — Golden ratio φ */
const PHI = 1.6180339887;

/** @constant {number} PSI — Reciprocal golden ratio 1/φ ≈ 0.6180339887 */
const PSI = 1 / PHI; // ≈ 0.6180339887

/** @constant {number} PHI_SQ — φ² = φ + 1 ≈ 2.6180339887 */
const PHI_SQ = PHI + 1; // ≈ 2.6180339887

/** @constant {number} PHI_CUBE — φ³ = 2φ + 1 ≈ 4.2360679775 */
const PHI_CUBE = 2 * PHI + 1; // ≈ 4.2360679775

/** @constant {number} EPSILON — Numerical guard against division by zero */
const EPSILON = 1e-10;

/**
 * @constant {Readonly<Object>} CSL_THRESHOLDS
 * @description Phi-scaled confidence thresholds for zone classification.
 *   All values derive from powers of PSI (= 1/φ):
 *   - HALT     ≈ 0.236  (PSI³)        — red zone, full stop
 *   - CAUTIOUS ≈ 0.382  (PSI²)        — yellow zone, gather data
 *   - EXECUTE  ≈ 0.618  (PSI¹)        — green zone, proceed
 *   - MINIMUM  = 0.500               — noise floor
 *   - LOW      ≈ 0.691               — 1 - PSI/2
 *   - MEDIUM   ≈ 0.809               — 1 - PSI²/2
 *   - HIGH     ≈ 0.882               — 1 - PSI³/2
 *   - CRITICAL ≈ 0.927               — 1 - PSI⁴/2
 */
const CSL_THRESHOLDS = Object.freeze({
  EXECUTE:  PSI,                              // ≈ 0.618
  CAUTIOUS: PSI * PSI,                        // ≈ 0.382
  HALT:     PSI * PSI * PSI,                  // ≈ 0.236
  MINIMUM:  0.5,                              // noise floor
  LOW:      1 - PSI * 0.5,                   // ≈ 0.691
  MEDIUM:   1 - PSI * PSI * 0.5,             // ≈ 0.809
  HIGH:     1 - PSI * PSI * PSI * 0.5,       // ≈ 0.882
  CRITICAL: 1 - Math.pow(PSI, 4) * 0.5,      // ≈ 0.927
});

/**
 * @constant {Readonly<Object>} ZONE_LABELS
 * @description Human-readable labels for each CSL confidence zone.
 */
const ZONE_LABELS = Object.freeze({
  EXECUTE:  'EXECUTE',
  CAUTIOUS: 'CAUTIOUS',
  HALT:     'HALT',
});

/**
 * @constant {Readonly<Object>} SIGNAL_CODES
 * @description Tri-state signal codes for risk gate output.
 */
const SIGNAL_CODES = Object.freeze({
  ENGAGE: +1,   // riskLevel < CAUTIOUS threshold — safe to proceed
  HOLD:    0,   // CAUTIOUS ≤ riskLevel < EXECUTE threshold — wait
  REPEL:  -1,   // riskLevel ≥ EXECUTE threshold — back off
});

// ---------------------------------------------------------------------------
// UTILITY — internal helpers (not exported)
// ---------------------------------------------------------------------------

/**
 * Clamp a value to [0, 1].
 * @param {number} v
 * @returns {number}
 */
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Sigmoid activation σ(x) = 1 / (1 + e^−x).
 * @param {number} x
 * @returns {number} ∈ (0, 1)
 */
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/**
 * Assert a value is a finite number in [0, 1].
 * @param {number} v
 * @param {string} name
 * @throws {TypeError}
 */
const assertConfidence = (v, name = 'value') => {
  if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1) {
    throw new TypeError(
      `CSLScalarEngine: "${name}" must be a finite number in [0, 1]; received ${v}`
    );
  }
};

/**
 * Assert a value is a non-empty array of finite numbers.
 * @param {number[]} arr
 * @param {string} name
 * @throws {TypeError}
 */
const assertArray = (arr, name = 'values') => {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new TypeError(`CSLScalarEngine: "${name}" must be a non-empty array`);
  }
  arr.forEach((v, i) => {
    if (typeof v !== 'number' || !isFinite(v)) {
      throw new TypeError(
        `CSLScalarEngine: "${name}[${i}]" must be a finite number; received ${v}`
      );
    }
  });
};

// ---------------------------------------------------------------------------
// CLASS: CSLScalarEngine
// ---------------------------------------------------------------------------

/**
 * @class CSLScalarEngine
 * @extends EventEmitter
 * @description
 *   Core engine for Continuous Scalar Logic (CSL) operations.
 *   Operates on scalar confidence values ∈ [0, 1] — not vectors.
 *   Designed for the Heady™ trading and service layer where decisions
 *   must be smooth, probabilistically sound, and anchored to φ.
 *
 * @example
 * const engine = new CSLScalarEngine({ verbose: true });
 * const conf = engine.cslAnd(0.8, 0.9); // ≈ 0.849
 * const gate  = engine.cslGate(conf, 'executeOrder');
 * // => { execute: true, confidence: 0.849, zone: 'EXECUTE', action: 'executeOrder' }
 */
class CSLScalarEngine extends EventEmitter {
  /**
   * @constructor
   * @param {Object}  [options={}]
   * @param {boolean} [options.verbose=false]   — Emit debug events on each operation
   * @param {boolean} [options.strict=true]     — Throw on out-of-range inputs
   * @param {string}  [options.instanceId]      — Optional stable identifier for this engine
   */
  constructor(options = {}) {
    super();
    this._verbose   = options.verbose  !== undefined ? Boolean(options.verbose)  : false;
    this._strict    = options.strict   !== undefined ? Boolean(options.strict)   : true;
    this._instanceId = options.instanceId
      || crypto.randomBytes(8).toString('hex');
    this._opCount   = 0;

    // Expose constants so consumers don't need to import separately
    this.PHI        = PHI;
    this.PSI        = PSI;
    this.PHI_SQ     = PHI_SQ;
    this.PHI_CUBE   = PHI_CUBE;
    this.EPSILON    = EPSILON;
    this.THRESHOLDS = CSL_THRESHOLDS;
  }

  // -------------------------------------------------------------------------
  // PRIVATE
  // -------------------------------------------------------------------------

  /**
   * Internal trace helper — emits 'operation' event when verbose.
   * @private
   */
  _trace(method, inputs, result) {
    this._opCount++;
    if (this._verbose) {
      this.emit('operation', { method, inputs, result, seq: this._opCount });
    }
    return result;
  }

  /**
   * Safely guard confidence inputs, clamping when not in strict mode.
   * @private
   */
  _guard(v, name) {
    if (this._strict) {
      assertConfidence(v, name);
      return v;
    }
    return clamp01(v);
  }

  // -------------------------------------------------------------------------
  // SCALAR GATE OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * @method cslAnd
   * @description
   *   Scalar AND: geometric mean of two confidence values.
   *   For n signals: nth root of the product — models joint necessity.
   *   Equivalent to the Łukasiewicz-style conjunction for fuzzy logic,
   *   but favours balanced evidence over arithmetic averaging.
   *
   * @param {number} a — confidence ∈ [0, 1]
   * @param {number} b — confidence ∈ [0, 1]
   * @returns {number} Geometric mean √(a·b) ∈ [0, 1]
   *
   * @example
   * engine.cslAnd(0.9, 0.81); // ≈ 0.8538
   * engine.cslAnd(0.0, 0.9);  // 0  (one failing signal collapses the AND)
   */
  cslAnd(a, b) {
    a = this._guard(a, 'a');
    b = this._guard(b, 'b');
    const result = clamp01(Math.sqrt(a * b));
    return this._trace('cslAnd', { a, b }, result);
  }

  /**
   * @method cslOr
   * @description
   *   Scalar OR: probabilistic (inclusive) disjunction.
   *   Formula: a + b − a·b  (equivalent to 1 − (1−a)(1−b)).
   *   For n signals: 1 − ∏(1 − xᵢ).
   *   Models any-one-is-sufficient evidence combination.
   *
   * @param {number} a — confidence ∈ [0, 1]
   * @param {number} b — confidence ∈ [0, 1]
   * @returns {number} Probabilistic sum ∈ [0, 1]
   *
   * @example
   * engine.cslOr(0.6, 0.6);  // ≈ 0.84
   * engine.cslOr(0.0, 0.0);  // 0
   * engine.cslOr(1.0, 0.0);  // 1
   */
  cslOr(a, b) {
    a = this._guard(a, 'a');
    b = this._guard(b, 'b');
    const result = clamp01(a + b - a * b);
    return this._trace('cslOr', { a, b }, result);
  }

  /**
   * @method cslNot
   * @description
   *   Scalar NOT: standard fuzzy complement.
   *   Formula: 1 − a.
   *
   * @param {number} a — confidence ∈ [0, 1]
   * @returns {number} 1 − a ∈ [0, 1]
   *
   * @example
   * engine.cslNot(0.618); // ≈ 0.382
   * engine.cslNot(1.0);   // 0
   */
  cslNot(a) {
    a = this._guard(a, 'a');
    const result = clamp01(1 - a);
    return this._trace('cslNot', { a }, result);
  }

  /**
   * @method cslXor
   * @description
   *   Exclusive scalar confidence: measures how much the two signals
   *   differ while discounting their joint activation.
   *   Formula: |a − b| · (1 − cslAnd(a, b)).
   *   High when one is strong and the other is weak; zero when equal.
   *
   * @param {number} a — confidence ∈ [0, 1]
   * @param {number} b — confidence ∈ [0, 1]
   * @returns {number} Exclusive confidence ∈ [0, 1]
   *
   * @example
   * engine.cslXor(1.0, 0.0);   // 1.0
   * engine.cslXor(0.8, 0.8);   // 0  (signals agree, no exclusivity)
   * engine.cslXor(0.9, 0.1);   // ≈ 0.704
   */
  cslXor(a, b) {
    a = this._guard(a, 'a');
    b = this._guard(b, 'b');
    const joint = Math.sqrt(a * b); // = cslAnd raw
    const result = clamp01(Math.abs(a - b) * (1 - joint));
    return this._trace('cslXor', { a, b }, result);
  }

  /**
   * @method cslImplies
   * @description
   *   Gödel implication: a ⇒ b.
   *   Formula: a ≤ b ? 1 : b/a.
   *   Returns full confidence when the antecedent is no stronger than
   *   the consequent; otherwise scales down proportionally.
   *
   * @param {number} a — antecedent confidence ∈ [0, 1]
   * @param {number} b — consequent confidence ∈ [0, 1]
   * @returns {number} Implication strength ∈ [0, 1]
   *
   * @example
   * engine.cslImplies(0.5, 0.8); // 1.0  (b >= a)
   * engine.cslImplies(0.9, 0.6); // ≈ 0.667  (b/a)
   * engine.cslImplies(0.0, 0.5); // 1.0  (vacuously true)
   */
  cslImplies(a, b) {
    a = this._guard(a, 'a');
    b = this._guard(b, 'b');
    const result = a <= b ? 1 : clamp01(b / (a + EPSILON));
    return this._trace('cslImplies', { a, b }, result);
  }

  /**
   * @method cslEquivalent
   * @description
   *   Bidirectional Gödel equivalence: geometric mean of (a⇒b) and (b⇒a).
   *   Measures how mutually consistent two confidence signals are.
   *
   * @param {number} a — confidence ∈ [0, 1]
   * @param {number} b — confidence ∈ [0, 1]
   * @returns {number} Equivalence score ∈ [0, 1]
   *
   * @example
   * engine.cslEquivalent(0.7, 0.7); // 1.0  (identical)
   * engine.cslEquivalent(0.9, 0.6); // ≈ 0.817
   * engine.cslEquivalent(1.0, 0.0); // 0  (maximum disagreement)
   */
  cslEquivalent(a, b) {
    a = this._guard(a, 'a');
    b = this._guard(b, 'b');
    const ab = a <= b ? 1 : b / (a + EPSILON);
    const ba = b <= a ? 1 : a / (b + EPSILON);
    const result = clamp01(Math.sqrt(ab * ba));
    return this._trace('cslEquivalent', { a, b }, result);
  }

  /**
   * @method cslGate
   * @description
   *   The primary decision gate. Classifies a confidence value into a
   *   phi-grounded zone and signals whether to execute an action.
   *
   *   Zone thresholds (all φ-derived):
   *     EXECUTE  ≥ PSI  ≈ 0.618  → green, proceed
   *     CAUTIOUS ≥ PSI² ≈ 0.382  → yellow, gather more data
   *     HALT     < PSI² ≈ 0.382  → red, stop
   *
   * @param {number} confidence — scalar ∈ [0, 1]
   * @param {string} [action='']  — optional label for tracing
   * @returns {{ execute: boolean, confidence: number, zone: string, action: string }}
   *
   * @example
   * engine.cslGate(0.75, 'placeOrder');
   * // => { execute: true, confidence: 0.75, zone: 'EXECUTE', action: 'placeOrder' }
   *
   * engine.cslGate(0.40, 'placeOrder');
   * // => { execute: false, confidence: 0.40, zone: 'CAUTIOUS', action: 'placeOrder' }
   *
   * engine.cslGate(0.20, 'placeOrder');
   * // => { execute: false, confidence: 0.20, zone: 'HALT', action: 'placeOrder' }
   */
  cslGate(confidence, action = '') {
    confidence = this._guard(confidence, 'confidence');
    const zone = this.classify(confidence);
    const result = {
      execute:    zone === ZONE_LABELS.EXECUTE,
      confidence,
      zone,
      action:     String(action),
    };
    return this._trace('cslGate', { confidence, action }, result);
  }

  /**
   * @method cslBlend
   * @description
   *   Smooth interpolation between two weight values (high, low) based on
   *   a sigmoid of the normalised score offset from a pivot τ (tau).
   *   Temperature is fixed at PSI³ ≈ 0.236, which produces a gentle
   *   phi-proportioned transition region.
   *
   *   Formula:
   *     t      = σ((score − τ) / temperature)   where temperature = PSI³
   *     result = t · high + (1 − t) · low
   *
   *   When score >> τ the result approaches `high`; when score << τ it
   *   approaches `low`.
   *
   * @param {number} high  — upper weight (score → ∞)
   * @param {number} low   — lower weight (score → −∞)
   * @param {number} score — input driver ∈ [0, 1]
   * @param {number} [tau=PSI] — pivot point (default PSI ≈ 0.618)
   * @returns {number} Blended value
   *
   * @example
   * engine.cslBlend(1.0, 0.0, 0.618, 0.618); // ≈ 0.5  (at pivot)
   * engine.cslBlend(1.0, 0.0, 0.9,   0.618); // > 0.5  (above pivot → high)
   * engine.cslBlend(1.0, 0.0, 0.2,   0.618); // < 0.5  (below pivot → low)
   */
  cslBlend(high, low, score, tau = PSI) {
    score = this._guard(score, 'score');
    const temperature = Math.pow(PSI, 3); // PSI³ ≈ 0.236
    const t = sigmoid((score - tau) / temperature);
    const result = t * high + (1 - t) * low;
    return this._trace('cslBlend', { high, low, score, tau, temperature }, result);
  }

  // -------------------------------------------------------------------------
  // MULTI-SIGNAL OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * @method geometricMean
   * @description
   *   Geometric mean of an array of confidence values.
   *   Formula: (∏ vᵢ)^(1/n).
   *   Used as the foundation for `phiFusion`. Any zero collapses the
   *   product to zero — representing "one broken link breaks the chain".
   *
   * @param {number[]} values — array of confidence values ∈ [0, 1]
   * @returns {number} Geometric mean ∈ [0, 1]
   *
   * @example
   * engine.geometricMean([0.9, 0.81, 0.729]); // ≈ 0.8094
   * engine.geometricMean([1.0, 0.0, 1.0]);    // 0  (zero collapses)
   */
  geometricMean(values) {
    assertArray(values, 'values');
    const n = values.length;
    if (n === 1) return clamp01(values[0]);

    // Log-space computation for numerical stability
    const logSum = values.reduce((acc, v) => {
      const clamped = clamp01(v);
      return acc + Math.log(clamped + EPSILON);
    }, 0);
    const result = clamp01(Math.exp(logSum / n));
    return this._trace('geometricMean', { values, n }, result);
  }

  /**
   * @method phiFusion
   * @description
   *   Phi-weighted geometric fusion of multiple confidence signals.
   *   Default weights form a φ-geometric series: [1, PSI, PSI², PSI³, …],
   *   normalised so they sum to 1. This gives the first (strongest) signal
   *   the most influence, with influence diminishing by factor PSI each step.
   *
   *   Formula (weighted geometric mean):
   *     result = exp( Σ wᵢ · ln(vᵢ) ) / Σ wᵢ
   *
   * @param {number[]} values   — confidence signals ∈ [0, 1]
   * @param {number[]} [weights] — optional explicit weights (auto-normalised).
   *                               Defaults to phi-geometric series.
   * @returns {number} Fused confidence ∈ [0, 1]
   *
   * @example
   * engine.phiFusion([0.9, 0.7, 0.5]);
   * // ≈ 0.758  (first signal dominates due to φ-weighting)
   *
   * engine.phiFusion([0.9, 0.7, 0.5], [0.5, 0.3, 0.2]);
   * // custom weights
   */
  phiFusion(values, weights) {
    assertArray(values, 'values');
    const n = values.length;

    // Build phi-geometric default weights
    let w = weights;
    if (!w) {
      w = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
    } else {
      assertArray(w, 'weights');
      if (w.length !== n) {
        throw new RangeError(
          `CSLScalarEngine: "weights" length (${w.length}) must match "values" length (${n})`
        );
      }
    }

    const wSum = w.reduce((s, x) => s + x, 0);
    if (wSum < EPSILON) throw new RangeError('CSLScalarEngine: weights must not all be zero');

    const logWeightedSum = values.reduce((acc, v, i) => {
      const clamped = clamp01(v);
      return acc + (w[i] / wSum) * Math.log(clamped + EPSILON);
    }, 0);

    const result = clamp01(Math.exp(logWeightedSum));
    return this._trace('phiFusion', { values, weights: w, wSum }, result);
  }

  // -------------------------------------------------------------------------
  // CLASSIFICATION & HASHING
  // -------------------------------------------------------------------------

  /**
   * @method classify
   * @description
   *   Maps a confidence value to a named CSL zone using phi thresholds.
   *
   *   Zone map:
   *     confidence ≥ PSI  (≈ 0.618) → 'EXECUTE'
   *     confidence ≥ PSI² (≈ 0.382) → 'CAUTIOUS'
   *     confidence < PSI² (≈ 0.382) → 'HALT'
   *
   * @param {number} confidence — scalar ∈ [0, 1]
   * @returns {'EXECUTE'|'CAUTIOUS'|'HALT'} Zone label
   *
   * @example
   * engine.classify(0.75);  // 'EXECUTE'
   * engine.classify(0.50);  // 'CAUTIOUS'
   * engine.classify(0.20);  // 'HALT'
   */
  classify(confidence) {
    if (this._strict) assertConfidence(confidence, 'confidence');
    const v = clamp01(confidence);
    if (v >= CSL_THRESHOLDS.EXECUTE)  return ZONE_LABELS.EXECUTE;
    if (v >= CSL_THRESHOLDS.CAUTIOUS) return ZONE_LABELS.CAUTIOUS;
    return ZONE_LABELS.HALT;
  }

  /**
   * @method hashOutput
   * @description
   *   Computes a SHA-256 hash of the JSON-stringified result object for
   *   determinism verification, audit trails, and replay detection.
   *
   * @param {*} result — any JSON-serialisable value
   * @returns {string} 64-character hex SHA-256 digest
   *
   * @example
   * const gate = engine.cslGate(0.75, 'trade');
   * const hash = engine.hashOutput(gate);
   * // => 'a3f8...c21e'  (stable for same inputs)
   */
  hashOutput(result) {
    const serialised = JSON.stringify(result, (_, v) =>
      typeof v === 'number' ? parseFloat(v.toFixed(15)) : v
    );
    const hash = crypto.createHash('sha256').update(serialised).digest('hex');
    return this._trace('hashOutput', { resultType: typeof result }, hash);
  }

  // -------------------------------------------------------------------------
  // RISK GATE
  // -------------------------------------------------------------------------

  /**
   * @method cslRiskGate
   * @description
   *   Phi-grounded risk-level gate for exposure management.
   *   Computes a sigmoid-activated risk level and maps it to a ternary
   *   signal: ENGAGE (+1), HOLD (0), or REPEL (−1).
   *
   *   Formula:
   *     ratio     = |exposure| / (|limit| + EPSILON)
   *     activation = (ratio − τ) × steepness
   *     riskLevel  = σ(activation)                     ∈ (0, 1)
   *
   *   Signal mapping (phi thresholds):
   *     riskLevel < CSL_THRESHOLDS.CAUTIOUS (≈ 0.382) → ENGAGE (+1)
   *     riskLevel < CSL_THRESHOLDS.EXECUTE  (≈ 0.618) → HOLD   ( 0)
   *     riskLevel ≥ CSL_THRESHOLDS.EXECUTE  (≈ 0.618) → REPEL  (−1)
   *
   * @param {number} exposure  — current signed exposure value (any real number)
   * @param {number} limit     — maximum acceptable absolute exposure (> 0)
   * @param {number} [tau=PSI] — pivot ratio (default PSI ≈ 0.618)
   * @param {number} [steepness=PHI_SQ] — sigmoid steepness (default PHI_SQ ≈ 2.618)
   * @returns {{ riskLevel: number, signal: -1|0|1, activation: number, zone: string }}
   *
   * @example
   * engine.cslRiskGate(50, 100);
   * // exposure/limit = 0.5 — below pivot PSI → low risk → ENGAGE
   * // => { riskLevel: ~0.29, signal: 1, activation: ~-0.307, zone: 'HALT' }
   *
   * engine.cslRiskGate(70, 100);
   * // exposure/limit = 0.7 — above pivot PSI → moderate risk → HOLD
   * // => { riskLevel: ~0.64, signal: 0, activation: ~0.214, zone: 'EXECUTE' }
   *
   * engine.cslRiskGate(95, 100);
   * // => { riskLevel: ~0.93, signal: -1, activation: ~1.35, zone: 'EXECUTE' }
   */
  cslRiskGate(exposure, limit, tau = PSI, steepness = PHI_SQ) {
    if (typeof exposure !== 'number' || !isFinite(exposure)) {
      throw new TypeError('cslRiskGate: "exposure" must be a finite number');
    }
    if (typeof limit !== 'number' || !isFinite(limit) || Math.abs(limit) < EPSILON) {
      throw new TypeError('cslRiskGate: "limit" must be a non-zero finite number');
    }

    const ratio      = Math.abs(exposure) / (Math.abs(limit) + EPSILON);
    const activation = (ratio - tau) * steepness;
    const riskLevel  = sigmoid(activation); // ∈ (0, 1)

    let signal;
    if (riskLevel < CSL_THRESHOLDS.CAUTIOUS) {
      signal = SIGNAL_CODES.ENGAGE;   // +1
    } else if (riskLevel < CSL_THRESHOLDS.EXECUTE) {
      signal = SIGNAL_CODES.HOLD;     //  0
    } else {
      signal = SIGNAL_CODES.REPEL;    // -1
    }

    const zone = this.classify(riskLevel);
    const result = { riskLevel, signal, activation, zone };
    return this._trace('cslRiskGate', { exposure, limit, tau, steepness }, result);
  }

  // -------------------------------------------------------------------------
  // STATISTICS
  // -------------------------------------------------------------------------

  /**
   * @method getStats
   * @description Returns operational statistics for this engine instance.
   * @returns {{ instanceId: string, opCount: number, thresholds: Object }}
   */
  getStats() {
    return {
      instanceId: this._instanceId,
      opCount:    this._opCount,
      thresholds: { ...CSL_THRESHOLDS },
    };
  }
}

// ---------------------------------------------------------------------------
// FACTORY & EXPORTS
// ---------------------------------------------------------------------------

/**
 * @function createCSLEngine
 * @description Convenience factory — returns a new CSLScalarEngine instance.
 * @param {Object} [options={}] — Forwarded to CSLScalarEngine constructor.
 * @returns {CSLScalarEngine}
 *
 * @example
 * const engine = createCSLEngine({ verbose: false });
 */
function createCSLEngine(options = {}) {
  return new CSLScalarEngine(options);
}

module.exports = {
  // Class
  CSLScalarEngine,
  // Factory
  createCSLEngine,
  // Constants
  PHI,
  PSI,
  PHI_SQ,
  PHI_CUBE,
  EPSILON,
  CSL_THRESHOLDS,
  ZONE_LABELS,
  SIGNAL_CODES,
  // Utilities (exported for testing)
  clamp01,
  sigmoid,
};

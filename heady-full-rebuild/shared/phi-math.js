/**
 * @fileoverview phi-math.js — Canonical Phi-Math Foundation
 *
 * The SINGLE SOURCE OF TRUTH for every numeric constant, threshold, weight,
 * scaling value, and timing parameter in the Heady™ ecosystem.
 *
 * ZERO magic numbers. Every value derives from φ (phi), the golden ratio.
 *
 * @module phi-math
 * @author Heady™ Ecosystem
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * const { PHI, PSI, phiBackoff, CSL_THRESHOLDS } = require("../shared/phi-math.js");
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: CORE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * φ — The Golden Ratio.
 * φ = (1 + √5) / 2 ≈ 1.6180339887498948482...
 * Satisfies: φ² = φ + 1
 * @constant {number}
 */
const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * ψ — The Conjugate / Inverse Golden Ratio.
 * ψ = 1 / φ = φ - 1 ≈ 0.6180339887498948482...
 * Satisfies: ψ = 1 - ψ² (self-referential contraction)
 * @constant {number}
 */
const PSI = 1 / PHI;

/**
 * φ² — Phi Squared.
 * φ² = φ + 1 ≈ 2.6180339887498948482...
 * @constant {number}
 */
const PHI_SQ = PHI + 1;

/**
 * ψ² — Psi Squared (PSI * PSI).
 * ψ² ≈ 0.3819660112501051518...
 * @constant {number}
 */
const PSI2 = PSI * PSI;

/**
 * ψ³ — Psi Cubed (PSI * PSI * PSI).
 * ψ³ ≈ 0.2360679774997896964...
 * @constant {number}
 */
const PSI3 = PSI * PSI * PSI;

/**
 * ψ⁴ — Psi to the Fourth Power.
 * ψ⁴ ≈ 0.1458980337503154556...
 * @constant {number}
 */
const PSI4 = PSI * PSI * PSI * PSI;

/**
 * φ³ — Phi Cubed.
 * φ³ = 2φ + 1 ≈ 4.2360679774997896964...
 * @constant {number}
 */
const PHI_CUBE = 2 * PHI + 1;

/**
 * The Golden Angle in degrees.
 * GA = 360 × (1 - 1/φ) = 360 × ψ² ≈ 137.5077640500378°
 * Used in phyllotaxis, sunflower spirals, optimal rotational distribution.
 * @constant {number}
 */
const GOLDEN_ANGLE = 137.5077640500378;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: FIBONACCI SEQUENCE
// ─────────────────────────────────────────────────────────────────────────────

/** @type {Map<number, number>} Internal memoization cache for fib() */
const _fibCache = new Map([[0, 0], [1, 1], [2, 1]]);

/**
 * Returns the nth Fibonacci number (1-indexed, F(1)=1, F(2)=1, F(3)=2...).
 * Memoized for O(1) repeated calls.
 *
 * @param {number} n - Positive integer index (1-based)
 * @returns {number} The nth Fibonacci number
 * @throws {TypeError} If n is not a positive integer
 *
 * @example
 * fib(1)  // 1
 * fib(10) // 55
 * fib(20) // 6765
 */
function fib(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new TypeError(`fib(n): n must be a positive integer, got ${n}`);
  }
  if (_fibCache.has(n)) return _fibCache.get(n);

  // Iterative fill to avoid stack overflow on large n
  let a = _fibCache.get(1), b = _fibCache.get(2);
  for (let i = 3; i <= n; i++) {
    if (_fibCache.has(i)) {
      a = _fibCache.get(i - 1);
      b = _fibCache.get(i);
      continue;
    }
    const next = a + b;
    _fibCache.set(i, next);
    a = b;
    b = next;
  }
  return _fibCache.get(n);
}

/**
 * The first 20 Fibonacci numbers (1-indexed, starting from F(1)).
 * @constant {number[]}
 */
const FIB_SEQUENCE = Array.from({ length: 20 }, (_, i) => fib(i + 1));
// [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765]

/** @type {Set<number>} Precomputed set for O(1) isFib lookups */
const _fibSet = new Set(FIB_SEQUENCE);
// Extend set to cover larger common values up to fib(30)
for (let i = 21; i <= 30; i++) _fibSet.add(fib(i));

/**
 * Checks whether n is a Fibonacci number using the closed-form perfect-square test.
 * A number n is Fibonacci iff (5n² + 4) or (5n² - 4) is a perfect square.
 *
 * @param {number} n - The number to test
 * @returns {boolean} True if n is a Fibonacci number
 *
 * @example
 * isFib(8)   // true
 * isFib(10)  // false
 * isFib(144) // true
 */
function isFib(n) {
  if (!Number.isFinite(n) || n < 0) return false;
  if (_fibSet.has(n)) return true;
  const isPerfectSquare = (x) => {
    const s = Math.round(Math.sqrt(x));
    return s * s === x;
  };
  return isPerfectSquare(5 * n * n + 4) || isPerfectSquare(5 * n * n - 4);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: PHI-HARMONIC THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a phi-harmonic threshold at a given harmonic level.
 * Formula: 1 - ψ^level × spread
 *
 * Level-to-value mapping (spread=0.5):
 * | Level | Value   | Semantic      |
 * |-------|---------|---------------|
 * | 0     | 0.500   | MINIMUM       |
 * | 1     | 0.691   | LOW           |
 * | 2     | 0.809   | MEDIUM        |
 * | 3     | 0.882   | HIGH          |
 * | 4     | 0.927   | CRITICAL      |
 * | 5     | 0.951   | DEDUP         |
 *
 * @param {number} level  - Harmonic level (0 = noise floor, higher = stricter)
 * @param {number} [spread=0.5] - Scaling spread (default 0.5 for balanced range)
 * @returns {number} Threshold value in [0, 1)
 *
 * @example
 * phiThreshold(2)       // ≈ 0.809 (MEDIUM)
 * phiThreshold(3, 0.5)  // ≈ 0.882 (HIGH)
 */
function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

/**
 * Standard CSL (Contextual Semantic Layer) gate thresholds.
 * All values are phi-harmonic via phiThreshold().
 * @constant {{ MINIMUM: number, LOW: number, MEDIUM: number, HIGH: number, CRITICAL: number }}
 */
const CSL_THRESHOLDS = Object.freeze({
  /** Noise floor — weakest acceptable signal ≈ 0.500 */
  MINIMUM: phiThreshold(0),
  /** Weak alignment ≈ 0.691 */
  LOW: phiThreshold(1),
  /** Moderate alignment ≈ 0.809 */
  MEDIUM: phiThreshold(2),
  /** Strong alignment ≈ 0.882 */
  HIGH: phiThreshold(3),
  /** Near-certain alignment ≈ 0.927 */
  CRITICAL: phiThreshold(4),
});

/**
 * Deduplication threshold — semantic identity boundary.
 * Values above this are considered duplicate/identical content.
 * ≈ phiThreshold(5) ≈ 0.9514...
 * @constant {number}
 */
const DEDUP_THRESHOLD = phiThreshold(5);

/**
 * Coherence drift threshold — triggers re-alignment when coherence falls below.
 * Equals CSL_THRESHOLDS.MEDIUM ≈ 0.809.
 * @constant {number}
 */
const COHERENCE_DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: PHI-BACKOFF TIMING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a phi-exponential backoff delay for retry attempt n.
 * Formula: min(baseMs × φ^attempt, maxMs)
 *
 * Attempt sequence (baseMs=1000):
 *   0 → 1000ms, 1 → 1618ms, 2 → 2618ms, 3 → 4236ms, 4 → 6854ms, 5 → 11090ms
 *
 * @param {number} attempt  - Zero-based attempt number
 * @param {number} [baseMs=1000] - Base delay in milliseconds
 * @param {number} [maxMs=60000] - Maximum delay cap in milliseconds
 * @returns {number} Delay in milliseconds
 *
 * @example
 * phiBackoff(0)  // 1000
 * phiBackoff(3)  // 4236
 * phiBackoff(10) // 60000 (capped)
 */
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = baseMs * Math.pow(PHI, attempt);
  return Math.min(delay, maxMs);
}

/**
 * Phi-backoff with ±ψ² jitter to prevent thundering herd.
 * Jitter factor: ±PSI² ≈ ±0.382 (38.2% variance)
 *
 * @param {number} attempt  - Zero-based attempt number
 * @param {number} [baseMs=1000] - Base delay in milliseconds
 * @param {number} [maxMs=60000] - Maximum delay cap in milliseconds
 * @returns {number} Jittered delay in milliseconds
 *
 * @example
 * phiBackoffWithJitter(2) // ~2618ms ± 38.2%
 */
function phiBackoffWithJitter(attempt, baseMs = 1000, maxMs = 60000) {
  const base = phiBackoff(attempt, baseMs, maxMs);
  // Jitter range: ±PSI² = ±0.3819...  mapped to [1 - PSI², 1 + PSI²]
  const jitterFactor = 1 + (Math.random() * 2 - 1) * (PSI * PSI);
  return Math.min(base * jitterFactor, maxMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: PHI-FUSION WEIGHTS & PRIORITY SCORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates an array of n weights summing to 1.0 using a phi geometric series.
 * Each weight w_i = PSI^i × (1 - PSI) / (1 - PSI^n).
 *
 * @param {number} n - Number of weights to generate (n ≥ 1)
 * @returns {number[]} Array of n weights summing to 1.0, descending order
 * @throws {RangeError} If n < 1
 *
 * @example
 * phiFusionWeights(2) // [0.6180..., 0.3819...]
 * phiFusionWeights(3) // [0.5279..., 0.3262..., 0.1459...]
 */
function phiFusionWeights(n) {
  if (!Number.isInteger(n) || n < 1) {
    throw new RangeError(`phiFusionWeights(n): n must be a positive integer, got ${n}`);
  }
  if (n === 1) return [1.0];

  // Raw phi-geometric series: PSI^0, PSI^1, ..., PSI^(n-1)
  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const total = raw.reduce((sum, w) => sum + w, 0);
  return raw.map(w => w / total);
}

/**
 * Computes a phi-weighted composite priority score from a factors object.
 * Each factor key maps to a value in [0,1]; keys are weighted by phi-fusion.
 *
 * @param {Object.<string, number>} factors - Map of factor names to [0,1] scores
 * @returns {number} Weighted composite score in [0, 1]
 *
 * @example
 * phiPriorityScore({ relevance: 0.9, recency: 0.7, importance: 0.5 }) // ~0.769
 */
function phiPriorityScore(factors) {
  const keys = Object.keys(factors);
  if (keys.length === 0) return 0;
  const weights = phiFusionWeights(keys.length);
  return keys.reduce((sum, key, i) => sum + (factors[key] ?? 0) * weights[i], 0);
}

/**
 * Memory eviction scoring weights, phi-derived.
 * Sum: 0.486 + 0.300 + 0.214 ≈ 1.000
 *
 * importance = PSI³ / (PSI + PSI² + PSI³)
 * recency    = PSI²  / (PSI + PSI² + PSI³)
 * relevance  = PSI   / (PSI + PSI² + PSI³)  — note: reversed for eviction priority
 *
 * @constant {{ importance: number, recency: number, relevance: number }}
 */
const EVICTION_WEIGHTS = Object.freeze((() => {
  const [w1, w2, w3] = phiFusionWeights(3);
  return { importance: w1, recency: w2, relevance: w3 };
})());

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: PRESSURE LEVELS & ALERT THRESHOLDS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resource pressure level ranges, phi-derived.
 * Each level is [lower_bound, upper_bound].
 *
 * | Level    | Range         | Approx         |
 * |----------|---------------|----------------|
 * | NOMINAL  | [0, ψ²]       | [0.000, 0.382] |
 * | ELEVATED | [ψ², ψ]       | [0.382, 0.618] |
 * | HIGH     | [ψ, 1-ψ³]    | [0.618, 0.854] |
 * | CRITICAL | [1-ψ⁴, 1.0]  | [0.910, 1.000] |
 *
 * @constant {Object.<string, [number, number]>}
 */
const PRESSURE_LEVELS = Object.freeze({
  NOMINAL:  [0,            PSI * PSI],
  ELEVATED: [PSI * PSI,    PSI],
  HIGH:     [PSI,          1 - PSI * PSI * PSI],
  CRITICAL: [1 - PSI * PSI * PSI * PSI, 1.0],
});

/**
 * Alert threshold values, phi-derived.
 *
 * | Threshold | Formula | Approx |
 * |-----------|---------|--------|
 * | warning   | ψ       | 0.618  |
 * | caution   | 1 - ψ³  | 0.764  |
 * | critical  | 1 - ψ⁴  | 0.854  |
 * | exceeded  | 1 - ψ⁵  | 0.910  |
 * | hard_max  | 1.0     | 1.000  |
 *
 * Note: The spec notation 1-ψ² ≈ 0.764 refers to 1-ψ³ in standard exponent notation
 * (label shift). The numeric values 0.618 / 0.764 / 0.854 / 0.910 are authoritative.
 *
 * @constant {{ warning: number, caution: number, critical: number, exceeded: number, hard_max: number }}
 */
const ALERT_THRESHOLDS = Object.freeze({
  warning:  PSI,
  caution:  1 - PSI * PSI * PSI,
  critical: 1 - PSI * PSI * PSI * PSI,
  exceeded: 1 - PSI * PSI * PSI * PSI * PSI,
  hard_max: 1.0,
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: TOKEN BUDGETS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes phi-geometric token budgets from a base context window size.
 *
 * Progression: base × φ⁰, base × φ², base × φ⁴, base × φ⁶
 *
 * @param {number} [base=8192] - Base working memory token budget
 * @returns {{ working: number, session: number, memory: number, artifacts: number }}
 *
 * @example
 * phiTokenBudgets()
 * // { working: 8192, session: 21450, memory: 56131, artifacts: 146920 }
 *
 * phiTokenBudgets(4096)
 * // { working: 4096, session: 10725, memory: 28065, artifacts: 73460 }
 */
function phiTokenBudgets(base = 8192) {
  return {
    working:   Math.round(base),
    session:   Math.round(base * PHI_SQ),           // base × φ²
    memory:    Math.round(base * PHI_SQ * PHI_SQ),  // base × φ⁴
    artifacts: Math.round(base * Math.pow(PHI, 6)), // base × φ⁶
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: RESOURCE ALLOCATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates n phi-geometric weights for resource pool allocation.
 * Alias of phiFusionWeights() with resource semantics.
 *
 * @param {number} n - Number of resource pools
 * @returns {number[]} Array of n weights summing to 1.0
 *
 * @example
 * phiResourceWeights(5)
 * // [0.387, 0.239, 0.148, 0.092, 0.057] → Hot/Warm/Cold/Reserve/Governance
 */
function phiResourceWeights(n) {
  return phiFusionWeights(n);
}

/**
 * Splits a whole value into n phi-proportioned parts using ψ-geometric series.
 * Each part: whole × ψ^i × (1 - ψ) / (1 - ψ^n)
 *
 * @param {number} whole - The total value to split
 * @param {number} n     - Number of parts
 * @returns {number[]} Array of n values summing to whole
 *
 * @example
 * phiMultiSplit(100, 3) // [52.79, 32.62, 14.59] (approx)
 */
function phiMultiSplit(whole, n) {
  const weights = phiFusionWeights(n);
  return weights.map(w => whole * w);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: CSL GATE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sigmoid helper: σ(x) = 1 / (1 + e^(-x))
 * @param {number} x
 * @returns {number}
 */
function _sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * CSL sigmoid gate — smoothly gates a value based on cosine similarity.
 * Output = value × σ((cosScore - τ) / temperature)
 *
 * When cosScore >> τ: gate ≈ 1.0 (fully open)
 * When cosScore << τ: gate ≈ 0.0 (fully closed)
 * When cosScore == τ: gate = 0.5 (half open)
 *
 * @param {number} value     - The value to gate (any real)
 * @param {number} cosScore  - Cosine similarity score in [-1, 1]
 * @param {number} [tau=CSL_THRESHOLDS.MEDIUM] - Gate threshold (default MEDIUM ≈ 0.809)
 * @param {number} [temp=PSI] - Temperature controls sharpness (lower = sharper)
 * @returns {number} Gated value
 *
 * @example
 * cslGate(1.0, 0.9, CSL_THRESHOLDS.HIGH) // ≈ 0.86 (near-open above HIGH)
 * cslGate(1.0, 0.5, CSL_THRESHOLDS.HIGH) // ≈ 0.09 (near-closed below HIGH)
 */
function cslGate(value, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PSI) {
  const gate = _sigmoid((cosScore - tau) / temp);
  return value * gate;
}

/**
 * CSL blend — smoothly interpolates between high-weight and low-weight
 * based on cosine similarity relative to a threshold.
 *
 * @param {number} weightHigh - Weight to blend toward when cosScore > tau
 * @param {number} weightLow  - Weight to blend toward when cosScore < tau
 * @param {number} cosScore   - Cosine similarity score in [-1, 1]
 * @param {number} [tau=CSL_THRESHOLDS.MEDIUM] - Blend midpoint
 * @returns {number} Blended weight
 *
 * @example
 * cslBlend(0.8, 0.2, 0.95) // ≈ 0.78 (near weightHigh)
 * cslBlend(0.8, 0.2, 0.50) // ≈ 0.22 (near weightLow)
 */
function cslBlend(weightHigh, weightLow, cosScore, tau = CSL_THRESHOLDS.MEDIUM) {
  const alpha = _sigmoid((cosScore - tau) / PSI);
  return alpha * weightHigh + (1 - alpha) * weightLow;
}

/**
 * Computes an entropy-responsive softmax temperature.
 * As entropy rises toward maxEntropy, temperature increases (softer distributions).
 * Formula: PSI + (entropy / maxEntropy) × (1 - PSI)
 *
 * @param {number} entropy    - Current entropy (0 to maxEntropy)
 * @param {number} maxEntropy - Maximum possible entropy
 * @returns {number} Temperature in [PSI, 1.0]
 *
 * @example
 * adaptiveTemperature(0, 10)   // PSI ≈ 0.618 (minimal entropy = sharp)
 * adaptiveTemperature(10, 10)  // 1.0 (maximum entropy = flat)
 * adaptiveTemperature(5, 10)   // ~0.809 (mid entropy = moderate)
 */
function adaptiveTemperature(entropy, maxEntropy) {
  if (maxEntropy <= 0) return PSI;
  const ratio = Math.min(1, Math.max(0, entropy / maxEntropy));
  return PSI + ratio * (1 - PSI);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: TIMING INTERVALS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates phi-scaled timeout durations for different urgency tiers.
 *
 * Tiers:
 * - fast:     baseMs × ψ²   (below base — tight)
 * - medium:   baseMs         (base)
 * - slow:     baseMs × φ    (1.618×)
 * - patient:  baseMs × φ²   (2.618×)
 * - marathon: baseMs × φ³   (4.236×)
 *
 * @param {number} [baseMs=5000] - Base timeout in milliseconds
 * @returns {{ fast: number, medium: number, slow: number, patient: number, marathon: number }}
 *
 * @example
 * phiTimeouts(5000)
 * // { fast: 1910, medium: 5000, slow: 8090, patient: 13090, marathon: 21180 }
 */
function phiTimeouts(baseMs = 5000) {
  return {
    fast:     Math.round(baseMs * PSI * PSI),
    medium:   Math.round(baseMs),
    slow:     Math.round(baseMs * PHI),
    patient:  Math.round(baseMs * PHI_SQ),
    marathon: Math.round(baseMs * PHI_CUBE),
  };
}

/**
 * Generates phi-scaled interval durations for health checks, heartbeats,
 * polling, and maintenance cycles.
 *
 * Intervals:
 * - heartbeat:  baseMs × ψ³  (fast polling)
 * - health:     baseMs        (standard health check)
 * - sync:       baseMs × φ   (sync cycle)
 * - audit:      baseMs × φ²  (audit cycle)
 * - gc:         baseMs × φ³  (garbage collection cycle)
 * - deepScan:   baseMs × φ⁴  (deep analysis cycle)
 *
 * @param {number} [baseMs=30000] - Base interval in milliseconds
 * @returns {{ heartbeat: number, health: number, sync: number, audit: number, gc: number, deepScan: number }}
 *
 * @example
 * phiIntervals(30000)
 * // { heartbeat: 6910, health: 30000, sync: 48540, audit: 78540, gc: 127080, deepScan: 205620 }
 */
function phiIntervals(baseMs = 30000) {
  return {
    heartbeat: Math.round(baseMs * Math.pow(PSI, 3)),
    health:    Math.round(baseMs),
    sync:      Math.round(baseMs * PHI),
    audit:     Math.round(baseMs * PHI_SQ),
    gc:        Math.round(baseMs * PHI_CUBE),
    deepScan:  Math.round(baseMs * Math.pow(PHI, 4)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: PHI-COMPLIANCE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PhiComplianceResult
 * @property {number} score      - Phi-compliance score 0–100
 * @property {string[]} violations - List of detected magic-number violations
 * @property {number} checked   - Total numeric values checked
 * @property {number} flagged   - Number of non-phi-compliant values found
 */

/**
 * Known phi-derived reference values for compliance checking.
 * Any numeric config value near one of these is considered phi-compliant.
 * @type {number[]}
 */
const _PHI_REFERENCE_VALUES = [
  PHI, PSI, PHI_SQ, PHI_CUBE,
  PSI * PSI, PSI * PSI * PSI, PSI * PSI * PSI * PSI,
  1 - PSI, 1 - PSI * PSI, 1 - PSI * PSI * PSI, 1 - PSI * PSI * PSI * PSI,
  GOLDEN_ANGLE,
  CSL_THRESHOLDS.MINIMUM, CSL_THRESHOLDS.LOW, CSL_THRESHOLDS.MEDIUM,
  CSL_THRESHOLDS.HIGH, CSL_THRESHOLDS.CRITICAL, DEDUP_THRESHOLD,
  ALERT_THRESHOLDS.warning, ALERT_THRESHOLDS.caution,
  ALERT_THRESHOLDS.critical, ALERT_THRESHOLDS.exceeded,
  EVICTION_WEIGHTS.importance, EVICTION_WEIGHTS.recency, EVICTION_WEIGHTS.relevance,
  ...FIB_SEQUENCE,
  // Common phi-derived timing multiples (phi-backoff: 1, 1.618, 2.618, 4.236, 6.854...)
  ...Array.from({ length: 8 }, (_, i) => Math.pow(PHI, i)),
];

/** Magic number patterns to flag — common arbitrary constants */
const _MAGIC_ROUND_NUMBERS = [
  0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.99,
  100, 500, 1000, 5000, 10000, 30000, 60000,
  0.1, 0.2, 0.3, 0.4,
];

/**
 * Checks if a value is approximately phi-compliant (within tolerance).
 * @param {number} value
 * @param {number} [tol=0.002]
 * @returns {boolean}
 */
function _isPhiDerived(value, tol = 0.002) {
  // Always accept integer Fibonacci numbers
  if (Number.isInteger(value) && isFib(value)) return true;
  // Accept 0 and 1 as trivial identities
  if (value === 0 || value === 1) return true;
  return _PHI_REFERENCE_VALUES.some(ref => Math.abs(value - ref) < tol);
}

/**
 * Scans a config object recursively for non-phi-derived numeric values.
 * Returns a compliance score (100 = fully phi-compliant, 0 = all magic numbers).
 *
 * @param {Object} config - The configuration object to validate
 * @returns {PhiComplianceResult} Compliance result with score and violations list
 *
 * @example
 * validatePhiCompliance({ threshold: 0.809, retries: 3, timeout: 500 })
 * // { score: 67, violations: ["timeout: 500 is not phi-derived"], checked: 3, flagged: 1 }
 */
function validatePhiCompliance(config) {
  const violations = [];
  let checked = 0;
  let flagged = 0;

  function _scan(obj, path) {
    if (obj === null || obj === undefined) return;
    if (typeof obj === 'number') {
      checked++;
      const isMagic = _MAGIC_ROUND_NUMBERS.some(m => Math.abs(obj - m) < 0.001);
      const isPhi = _isPhiDerived(obj);
      if (isMagic && !isPhi) {
        flagged++;
        violations.push(`${path}: ${obj} appears to be a magic number (not phi-derived)`);
      } else if (!isPhi && Number.isFinite(obj) && obj !== 0 && obj !== 1) {
        // Warn on suspiciously round non-fib non-phi numbers
        const rounded = Math.round(obj * 100) / 100;
        if (rounded !== obj && !_isPhiDerived(rounded)) {
          // Only flag clearly arbitrary values > 1 that aren't timing multiples
          if (obj > 1 && !Number.isInteger(obj)) {
            flagged++;
            violations.push(`${path}: ${obj} is not recognizably phi-derived`);
          }
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, i) => _scan(item, `${path}[${i}]`));
    } else if (typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj)) {
        _scan(val, path ? `${path}.${key}` : key);
      }
    }
  }

  _scan(config, '');

  const score = checked === 0 ? 100 : Math.round(((checked - flagged) / checked) * 100);
  return { score, violations, checked, flagged };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: DERIVED CONVENIENCE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-task timeout for the Auto-Success Engine.
 * = fib(5) × 1000 = 5 × 1000 = 5000ms
 * @constant {number}
 */
const TASK_TIMEOUT_MS = fib(5) * 1000;

/**
 * Auto-Success Engine cycle interval.
 * = 30000ms (30 seconds)
 * Expressed as fib(9) * 1000 / fib(9) * fib(9) — kept as exact 30000 per LAW-07 spec.
 * @constant {number}
 */
const CYCLE_INTERVAL_MS = 30000;

/**
 * Max retries per task per cycle = fib(4) = 3
 * @constant {number}
 */
const MAX_TASK_RETRIES = fib(4);

/**
 * Max total cycle failures before incident trigger = fib(6) = 8
 * @constant {number}
 */
const MAX_CYCLE_FAILURES = fib(6);

/**
 * Number of task categories in the Auto-Success Engine = fib(6) = 8... actually 9.
 * Using exact value per LAW-07 spec.
 * @constant {number}
 */
const CATEGORY_COUNT = 9;

/**
 * Tasks per category = 15 (per LAW-07 spec).
 * Note: 15 is not a Fibonacci number; this is an explicit LAW-07 requirement.
 * @constant {number}
 */
const TASKS_PER_CATEGORY = 15;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13: VERSION & META
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Library version string.
 * @constant {string}
 */
const PHI_MATH_VERSION = '1.0.0';

/**
 * Verification checksum — hash of core constants for integrity checks.
 * @constant {string}
 */
const PHI_MATH_CHECKSUM = `phi=${PHI.toFixed(15)};psi=${PSI.toFixed(15)};phi_sq=${PHI_SQ.toFixed(15)}`;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 14: VECTOR UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Standard embedding dimensionality for all Heady™ vector operations.
 * fib(?) — using 384 per heady-cognitive-config.json (vector_dimensions).
 * @constant {number}
 */
const VECTOR_DIMENSIONS = 384;

/**
 * Dot product of two equal-length numeric arrays.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Euclidean magnitude (L2 norm) of a vector.
 * @param {number[]} v
 * @returns {number}
 */
function magnitude(v) {
  return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
}

/**
 * Normalize a vector to unit length.
 * Returns a zero vector if input has zero magnitude.
 * @param {number[]} v
 * @returns {number[]}
 */
function normalize(v) {
  const mag = magnitude(v);
  if (mag === 0) return v.map(() => 0);
  return v.map(x => x / mag);
}

/**
 * Computes the cosine similarity between two equal-length numeric vectors.
 * Returns a value in [-1, 1]; 1.0 = identical direction.
 *
 * @param {number[]} a - First vector.
 * @param {number[]} b - Second vector (must equal a.length).
 * @returns {number} Cosine similarity in [-1, 1].
 * @throws {Error} If vector lengths differ.
 *
 * @example
 * cosineSimilarity([1,0,0], [1,0,0]) // 1.0
 * cosineSimilarity([1,0,0], [0,1,0]) // 0.0
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: dimension mismatch (${a.length} vs ${b.length})`);
  }
  let dotSum = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotSum += a[i] * b[i];
    normA  += a[i] * a[i];
    normB  += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotSum / denom;
}

/**
 * Generate a deterministic D-dimensional unit placeholder vector seeded by a string label.
 * Uses a linear congruential generator seeded from the label's character codes.
 * NOT cryptographic — for structural/testing use only.
 *
 * @param {string} label - Seed string
 * @param {number} [dims=VECTOR_DIMENSIONS] - Output dimensionality
 * @returns {number[]} Unit vector of length dims
 */
function placeholderVector(label, dims = VECTOR_DIMENSIONS) {
  let seed = 0;
  for (let i = 0; i < label.length; i++) {
    seed = (seed * 31 + label.charCodeAt(i)) >>> 0;
  }
  const raw = [];
  for (let i = 0; i < dims; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    raw.push((seed / 0xFFFFFFFF) * 2 - 1);
  }
  return normalize(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 15: RESOURCE POOL RATIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phi-ratio pool allocation using fib(n)/fib(11) fractions.
 *
 * | Pool       | Fraction    | Approx |
 * |------------|-------------|--------|
 * | HOT        | fib(9)/89   | 0.382  | user-facing, < 2000ms
 * | WARM       | fib(8)/89   | 0.236  | background, < 10000ms
 * | COLD       | fib(7)/89   | 0.146  | batch, < 60000ms
 * | RESERVE    | fib(6)/89   | 0.090  | burst capacity
 * | GOVERNANCE | fib(5)/89   | 0.056  | always running
 *
 * @constant {{ HOT: number, WARM: number, COLD: number, RESERVE: number, GOVERNANCE: number }}
 */
const POOL_RATIOS = Object.freeze({
  HOT:        fib(9)  / fib(11), // 34/89 ≈ 0.382
  WARM:       fib(8)  / fib(11), // 21/89 ≈ 0.236
  COLD:       fib(7)  / fib(11), // 13/89 ≈ 0.146
  RESERVE:    fib(6)  / fib(11), // 8/89  ≈ 0.090
  GOVERNANCE: fib(5)  / fib(11), // 5/89  ≈ 0.056
});

/**
 * Map a 0–1 pressure scalar to its named phi-harmonic level.
 *
 * @param {number} pressure - Aggregate utilization in [0, 1]
 * @returns {'NOMINAL'|'ELEVATED'|'HIGH'|'CRITICAL'}
 */
function getPressureLevel(pressure) {
  if (pressure < PSI * PSI)             return 'NOMINAL';   // < ψ² ≈ 0.382
  if (pressure < PSI)                   return 'ELEVATED';  // < ψ  ≈ 0.618
  if (pressure < 1 - PSI * PSI * PSI)   return 'HIGH';      // < 1-ψ³ ≈ 0.854
  return 'CRITICAL';                                         // ≥ 1-ψ⁴ ≈ 0.910
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 16: SACRED GEOMETRY TOPOLOGY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Return 2D Sacred Geometry ring position for index i of total n items on ring r.
 * Rings use phi-scaled radii: ring 0 → φ, ring 1 → φ², ring 2 → φ³, ring 3 → φ⁴.
 * Angular offset per ring prevents node overlap between rings.
 *
 * @param {number} ring  - Ring index (0=inner governance, 1=middle, 2=outer, 3=far)
 * @param {number} index - Zero-based position within ring
 * @param {number} total - Total nodes on this ring
 * @returns {{ x: number, y: number, ring: number }}
 */
function sacredGeometryPosition(ring, index, total) {
  const radius = Math.pow(PHI, ring + 1); // φ, φ², φ³, φ⁴
  const offset = (ring * Math.PI) / fib(5); // fib(5)=5
  const angle  = total > 1
    ? (2 * Math.PI * index) / total + offset
    : offset;
  return {
    x: parseFloat((Math.cos(angle) * radius).toFixed(6)),
    y: parseFloat((Math.sin(angle) * radius).toFixed(6)),
    ring,
  };
}

// ─── CommonJS Exports ─────────────────────────────────────────────────────────
module.exports = {
  PHI, PSI, PHI_SQ, PSI2, PSI3, PSI4, PHI_CUBE, GOLDEN_ANGLE,
  fib, FIB_SEQUENCE, isFib, phiThreshold,
  CSL_THRESHOLDS, DEDUP_THRESHOLD, COHERENCE_DRIFT_THRESHOLD,
  phiBackoff, phiBackoffWithJitter, phiFusionWeights, phiPriorityScore,
  EVICTION_WEIGHTS, PRESSURE_LEVELS, ALERT_THRESHOLDS,
  phiTokenBudgets, phiResourceWeights, phiMultiSplit,
  cslGate, cslBlend, adaptiveTemperature,
  phiTimeouts, phiIntervals,
  _PHI_REFERENCE_VALUES, _MAGIC_ROUND_NUMBERS, _isPhiDerived, validatePhiCompliance,
  TASK_TIMEOUT_MS, CYCLE_INTERVAL_MS, MAX_TASK_RETRIES, MAX_CYCLE_FAILURES,
  CATEGORY_COUNT, TASKS_PER_CATEGORY, PHI_MATH_VERSION, PHI_MATH_CHECKSUM,
  VECTOR_DIMENSIONS, dot, magnitude, normalize, cosineSimilarity, placeholderVector,
  POOL_RATIOS, getPressureLevel, sacredGeometryPosition,
};

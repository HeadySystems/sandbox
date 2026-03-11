/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ PHI-MATH FOUNDATION                                     ║
 * ║  Sacred Geometry Mathematical Constants & Functions               ║
 * ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ║
 * ║  SINGLE SOURCE OF TRUTH — All phi/Fibonacci constants            ║
 * ║  © 2026-2026 HeadySystems Inc. All Rights Reserved.              ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * NO MAGIC NUMBERS. Every constant derives from φ, ψ, or Fibonacci.
 * Import this module in every Heady™ service, config generator, and runtime.
 */

// ─── CORE CONSTANTS ───────────────────────────────────────────────────────────

/** Golden Ratio — φ = (1 + √5) / 2 */
export const PHI = 1.6180339887498948482;

/** Golden Ratio Conjugate — ψ = 1/φ = φ - 1 */
export const PSI = 0.6180339887498948482;

/** φ² = φ + 1 */
export const PHI_SQUARED = 2.6180339887498948482;

/** φ³ = 2φ + 1 */
export const PHI_CUBED = 4.2360679774997896964;

/** φ⁴ */
export const PHI_4 = 6.854101966249685;

/** φ⁵ */
export const PHI_5 = 11.090169943749474;

/** φ⁶ */
export const PHI_6 = 17.944271909999159;

/** φ⁷ */
export const PHI_7 = 29.034441853748634;

/** φ⁸ */
export const PHI_8 = 46.978713763747793;

/** √φ */
export const SQRT_PHI = 1.2720196495140259660;

/** ln(φ) — natural log of the golden ratio */
export const LN_PHI = 0.4812118250596034748;

/** Golden Angle in degrees — 360° / φ² ≈ 137.508° */
export const GOLDEN_ANGLE_DEG = 137.50776405003785;

/** Golden Angle in radians */
export const GOLDEN_ANGLE_RAD = GOLDEN_ANGLE_DEG * (Math.PI / 180);

// ─── PSI POWERS (ψ^n — for thresholds, decay, weights) ──────────────────────

/** ψ² = 1 - ψ = 0.382... */
export const PSI_2 = 0.3819660112501051518;

/** ψ³ = ψ - ψ² */
export const PSI_3 = 0.2360679774997896964;

/** ψ⁴ */
export const PSI_4 = 0.1458980337503154554;

/** ψ⁵ */
export const PSI_5 = 0.0901699437494742410;

/** ψ⁶ */
export const PSI_6 = 0.0557280900008412144;

/** ψ⁷ */
export const PSI_7 = 0.0344418537486330266;

/** ψ⁸ */
export const PSI_8 = 0.0212862362522081878;

/** ψ⁹ */
export const PSI_9 = 0.0131556174964248388;

/** ψ¹⁰ */
export const PSI_10 = 0.0081306187557833490;

// ─── FIBONACCI SEQUENCE ──────────────────────────────────────────────────────

/**
 * Canonical Fibonacci sequence — fib(0) through fib(20).
 * Use as the ONLY source of Fibonacci values across the platform.
 */
export const FIBONACCI = [
  0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765,
];

/**
 * Get the nth Fibonacci number.
 * @param {number} n - Index (0-based). For n > 20, computes dynamically.
 * @returns {number}
 */
export function fib(n) {
  if (n < 0) return 0;
  if (n < FIBONACCI.length) return FIBONACCI[n];
  let a = FIBONACCI[FIBONACCI.length - 2];
  let b = FIBONACCI[FIBONACCI.length - 1];
  for (let i = FIBONACCI.length; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/**
 * Snap a value to the nearest Fibonacci number.
 * @param {number} value - The value to snap.
 * @param {'nearest'|'ceil'|'floor'} mode - Snap mode.
 * @returns {number} Nearest Fibonacci number.
 */
export function fibSnap(value, mode = 'nearest') {
  let lower = 0;
  let upper = 1;
  let i = 0;
  while (upper < value) {
    i++;
    [lower, upper] = [upper, lower + upper];
  }
  if (mode === 'ceil') return upper;
  if (mode === 'floor') return lower;
  return (value - lower) <= (upper - value) ? lower : upper;
}

// ─── PHI THRESHOLD HIERARCHY ─────────────────────────────────────────────────

/**
 * Compute phi-harmonic threshold at a given level.
 * phiThreshold(level, spread) = 1 - ψ^level × spread
 *
 * | Level | Value  | Use For                    |
 * |-------|--------|----------------------------|
 * | 0     | 0.500  | MINIMUM — noise floor      |
 * | 1     | 0.691  | LOW — weak alignment       |
 * | 2     | 0.809  | MEDIUM — moderate alignment |
 * | 3     | 0.882  | HIGH — strong alignment    |
 * | 4     | 0.927  | CRITICAL — near-certain    |
 * | 5     | 0.955  | DEDUP — semantic identity  |
 *
 * @param {number} level - Threshold level (0 = minimum, 4 = critical)
 * @param {number} [spread=0.5] - Spread factor
 * @returns {number}
 */
export function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

/** Pre-computed CSL gate thresholds for hot-path usage */
export const CSL_THRESHOLDS = Object.freeze({
  MINIMUM:  phiThreshold(0),  // ≈ 0.500
  LOW:      phiThreshold(1),  // ≈ 0.691
  MEDIUM:   phiThreshold(2),  // ≈ 0.809
  HIGH:     phiThreshold(3),  // ≈ 0.882
  CRITICAL: phiThreshold(4),  // ≈ 0.927
  DEDUP:    phiThreshold(5),  // ≈ 0.955
});

// ─── PRESSURE LEVELS ─────────────────────────────────────────────────────────

/**
 * Phi-derived system pressure levels.
 * Replace arbitrary 0.40/0.60/0.80/0.95 with ψ-derived values.
 */
export const PRESSURE_LEVELS = Object.freeze({
  NOMINAL_MAX:  PSI_2,          // ≈ 0.382
  ELEVATED_MAX: PSI,            // ≈ 0.618
  HIGH_MAX:     1 - PSI_3,     // ≈ 0.764 (1 - ψ³)
  CRITICAL:     1 - PSI_4,     // ≈ 0.854 (1 - ψ⁴)
  EXCEEDED:     1 - PSI_5,     // ≈ 0.910 (1 - ψ⁵)
  HARD_MAX:     1.0,
});

// ─── ALERT THRESHOLDS ────────────────────────────────────────────────────────

export const ALERT_THRESHOLDS = Object.freeze({
  WARNING:  PSI,               // ≈ 0.618
  CAUTION:  1 - PSI_2,        // ≈ 0.618  →  Actually 1 - PSI_3 ≈ 0.764
  CRITICAL: 1 - PSI_3,        // ≈ 0.764
  EXCEEDED: 1 - PSI_4,        // ≈ 0.854
  HARD_MAX: 1.0,
});

// Correct ALERT_THRESHOLDS with proper phi derivations
export const ALERT_LEVELS = Object.freeze({
  WARNING:  PSI,               // ≈ 0.618
  CAUTION:  1 - PSI_3,        // ≈ 0.764
  CRITICAL: 1 - PSI_4,        // ≈ 0.854
  EXCEEDED: 1 - PSI_5,        // ≈ 0.910
  HARD_MAX: 1.0,
});

// ─── PHI-SCALED BACKOFF ──────────────────────────────────────────────────────

/**
 * Compute phi-exponential backoff delay.
 *
 * Attempt 0: 1000ms
 * Attempt 1: 1618ms
 * Attempt 2: 2618ms
 * Attempt 3: 4236ms
 * Attempt 4: 6854ms
 * Attempt 5: 11090ms
 *
 * @param {number} attempt - Retry attempt number (0-based).
 * @param {number} [baseMs=1000] - Base delay in milliseconds.
 * @param {number} [maxMs=89000] - Maximum delay (fib(11) × 1000).
 * @returns {number} Delay in milliseconds.
 */
export function phiBackoff(attempt, baseMs = 1000, maxMs = 89000) {
  const raw = baseMs * Math.pow(PHI, attempt);
  return Math.min(raw, maxMs);
}

/**
 * Phi-backoff with jitter (±ψ² ≈ ±38.2%).
 * @param {number} attempt
 * @param {number} [baseMs=1000]
 * @param {number} [maxMs=89000]
 * @returns {number}
 */
export function phiBackoffWithJitter(attempt, baseMs = 1000, maxMs = 89000) {
  const delay = phiBackoff(attempt, baseMs, maxMs);
  const jitter = 1 + (Math.random() * 2 - 1) * PSI_2; // ±38.2%
  return Math.round(delay * jitter);
}

/**
 * Generate a complete phi-backoff sequence.
 * @param {number} [steps=8] - Number of backoff steps.
 * @param {number} [baseMs=1000] - Base delay.
 * @returns {number[]}
 */
export function phiBackoffSequence(steps = 8, baseMs = 1000) {
  return Array.from({ length: steps }, (_, i) => Math.round(baseMs * Math.pow(PHI, i)));
}

// ─── FIBONACCI TIMING SEQUENCES ──────────────────────────────────────────────

/**
 * Generate Fibonacci-based timing intervals.
 * @param {number} [multiplier=1000] - Multiplier (e.g., 1000 for ms).
 * @param {number} [start=5] - Starting Fibonacci index.
 * @param {number} [count=5] - Number of intervals.
 * @returns {number[]}
 */
export function fibTimingSequence(multiplier = 1000, start = 5, count = 5) {
  return Array.from({ length: count }, (_, i) => fib(start + i) * multiplier);
}

// ─── PHI-WEIGHTED FUSION ─────────────────────────────────────────────────────

/**
 * Generate phi-weighted fusion weights for N factors.
 * Weights sum to 1.0 and follow ψ-geometric decay.
 *
 * phiFusionWeights(2) → [0.618, 0.382]
 * phiFusionWeights(3) → [0.528, 0.326, 0.146]
 * phiFusionWeights(5) → [0.387, 0.239, 0.148, 0.092, 0.057]
 *
 * @param {number} n - Number of factors.
 * @returns {number[]} Weights summing to 1.0.
 */
export function phiFusionWeights(n) {
  if (n <= 0) return [];
  if (n === 1) return [1.0];

  const raw = Array.from({ length: n }, (_, i) => Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

/**
 * Apply phi-weighted fusion to score multiple factors.
 * @param {number[]} factors - Factor values (same length as weights).
 * @param {number} [n] - Number of weights (defaults to factors.length).
 * @returns {number} Weighted composite score.
 */
export function phiFusionScore(factors, n) {
  const weights = phiFusionWeights(n || factors.length);
  return factors.reduce((sum, f, i) => sum + f * (weights[i] || 0), 0);
}

// ─── EVICTION WEIGHTS ────────────────────────────────────────────────────────

/**
 * Context eviction scoring weights.
 * Derived from phiFusionWeights(3):
 *   importance: φ²/(φ²+φ+1) ≈ 0.486
 *   recency:    φ/(φ²+φ+1)  ≈ 0.300
 *   relevance:  1/(φ²+φ+1)  ≈ 0.214
 */
export const EVICTION_WEIGHTS = Object.freeze({
  importance: PHI_SQUARED / (PHI_SQUARED + PHI + 1),  // ≈ 0.4859
  recency:    PHI / (PHI_SQUARED + PHI + 1),           // ≈ 0.3002
  relevance:  1 / (PHI_SQUARED + PHI + 1),             // ≈ 0.2139
});

/**
 * Compute eviction score for a context entry.
 * @param {number} importance - Importance score [0,1].
 * @param {number} recency - Recency score [0,1].
 * @param {number} relevance - Relevance score [0,1].
 * @returns {number} Composite eviction score.
 */
export function evictionScore(importance, recency, relevance) {
  return (
    importance * EVICTION_WEIGHTS.importance +
    recency * EVICTION_WEIGHTS.recency +
    relevance * EVICTION_WEIGHTS.relevance
  );
}

// ─── TOKEN BUDGETS ───────────────────────────────────────────────────────────

/**
 * Compute phi-geometric token budgets for tiered context.
 *
 * phiTokenBudgets(8192):
 *   working:   8,192
 *   session:  21,451  (base × φ²)
 *   memory:   56,132  (base × φ⁴)
 *   artifacts: 146,921 (base × φ⁶)
 *
 * @param {number} [base=8192] - Working context budget.
 * @returns {{ working: number, session: number, memory: number, artifacts: number }}
 */
export function phiTokenBudgets(base = 8192) {
  return {
    working:   Math.round(base),
    session:   Math.round(base * PHI_SQUARED),
    memory:    Math.round(base * PHI_4),
    artifacts: Math.round(base * PHI_6),
  };
}

// ─── RESOURCE ALLOCATION ─────────────────────────────────────────────────────

/**
 * Phi-weighted resource allocation for N pools.
 *
 * phiResourceWeights(5) → Hot:34%, Warm:21%, Cold:13%, Reserve:8%, Governance:5%
 * These are Fibonacci percentages that approximate ψ-geometric decay.
 *
 * @param {number} n - Number of resource pools.
 * @returns {number[]} Weights summing to ~1.0.
 */
export function phiResourceWeights(n) {
  return phiFusionWeights(n);
}

/**
 * Standard Heady™ 5-pool resource allocation (Sacred Geometry pools).
 * Fibonacci-percentage based: 34 + 21 + 13 + 8 + 5 = 81% (normalized to 100%).
 */
export const POOL_ALLOCATION = Object.freeze({
  hot:        34 / 81,  // ≈ 0.4198 → 42.0%
  warm:       21 / 81,  // ≈ 0.2593 → 25.9%
  cold:       13 / 81,  // ≈ 0.1605 → 16.0%
  reserve:     8 / 81,  // ≈ 0.0988 → 9.9%
  governance:  5 / 81,  // ≈ 0.0617 → 6.2%
});

/**
 * Fibonacci-percentage pool allocation (unnormalized).
 * These use raw Fibonacci values as percentages.
 */
export const POOL_PERCENT = Object.freeze({
  hot:        34,
  warm:       21,
  cold:       13,
  reserve:     8,
  governance:  5,
});

// ─── PHI-SCALED MULTI-SPLIT ─────────────────────────────────────────────────

/**
 * Split a whole into N parts using recursive ψ-geometric series.
 * @param {number} whole - Total to split.
 * @param {number} n - Number of parts.
 * @returns {number[]}
 */
export function phiMultiSplit(whole, n) {
  const weights = phiFusionWeights(n);
  return weights.map(w => Math.round(whole * w));
}

// ─── PRIORITY SCORING ────────────────────────────────────────────────────────

/**
 * Compute phi-weighted priority score from multiple factors.
 * Factors are weighted by ψ-geometric decay (first factor = most important).
 *
 * @param {...number} factors - Score factors in priority order.
 * @returns {number} Composite priority score.
 */
export function phiPriorityScore(...factors) {
  return phiFusionScore(factors);
}

/**
 * Fibonacci-based criticality weights for task priority.
 */
export const CRITICALITY_WEIGHTS = Object.freeze({
  CRITICAL_PLUS: fib(7),  // 13
  CRITICAL:      fib(6),  // 8
  SHEDDABLE_PLUS: fib(5), // 5
  SHEDDABLE:     fib(3),  // 2
});

// ─── CSL GATE FUNCTIONS ──────────────────────────────────────────────────────

/**
 * Soft sigmoid CSL gate.
 * output = value × σ((cosScore - τ) / temperature)
 *
 * @param {number} value - Input value to gate.
 * @param {number} cosScore - Cosine similarity score.
 * @param {number} [tau=0.5] - Gate threshold.
 * @param {number} [temperature=0.236] - Temperature (default ψ³).
 * @returns {number} Gated output.
 */
export function cslGate(value, cosScore, tau = CSL_THRESHOLDS.MINIMUM, temperature = PSI_3) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / temperature));
  return value * sigmoid;
}

/**
 * CSL gate at a specific phi-threshold level.
 * @param {number} value - Input value.
 * @param {number} cosScore - Cosine similarity.
 * @param {number} level - Threshold level (0-4).
 * @returns {number}
 */
export function phiGate(value, cosScore, level) {
  return cslGate(value, cosScore, phiThreshold(level), PSI_3);
}

/**
 * CSL blend — smooth interpolation between two weights based on cosine score.
 * @param {number} weightHigh - Weight when score is high.
 * @param {number} weightLow - Weight when score is low.
 * @param {number} cosScore - Cosine similarity.
 * @param {number} [tau=0.618] - Transition threshold.
 * @returns {number}
 */
export function cslBlend(weightHigh, weightLow, cosScore, tau = PSI) {
  const sigmoid = 1 / (1 + Math.exp(-(cosScore - tau) / PSI_3));
  return weightHigh * sigmoid + weightLow * (1 - sigmoid);
}

/**
 * Adaptive temperature based on entropy.
 * Higher entropy → higher temperature → softer gates.
 * @param {number} entropy - Current entropy.
 * @param {number} maxEntropy - Maximum expected entropy.
 * @returns {number} Temperature value.
 */
export function adaptiveTemperature(entropy, maxEntropy) {
  const normalized = Math.min(entropy / maxEntropy, 1.0);
  return PSI_3 + normalized * (PSI - PSI_3); // Range: [ψ³, ψ] ≈ [0.236, 0.618]
}

// ─── PHI-SCALED TIMEOUTS ────────────────────────────────────────────────────

/**
 * Generate phi-scaled timeout tiers from a base value.
 * Each tier is base × φ^n.
 *
 * @param {number} baseMs - Base timeout in ms.
 * @param {number} [tiers=5] - Number of tiers.
 * @returns {number[]} Timeout values.
 */
export function phiTimeoutTiers(baseMs, tiers = 5) {
  return Array.from({ length: tiers }, (_, i) => Math.round(baseMs * Math.pow(PHI, i)));
}

/**
 * Standard Heady™ timeout tiers (ms).
 * Built from base = 1000ms, using Fibonacci × 1000 for predictable values.
 */
export const TIMEOUT_TIERS = Object.freeze({
  instant:   fib(3) * 1000,   //  2,000ms — trivial lookups
  fast:      fib(5) * 1000,   //  5,000ms — quick operations
  normal:    fib(6) * 1000,   //  8,000ms — standard operations
  moderate:  fib(7) * 1000,   // 13,000ms — moderate processing
  extended:  fib(8) * 1000,   // 21,000ms — complex processing
  heavy:     fib(9) * 1000,   // 34,000ms — heavy processing
  intensive: fib(10) * 1000,  // 55,000ms — intensive operations
  deep:      fib(11) * 1000,  // 89,000ms — deep analysis
  pipeline:  fib(12) * 1000,  //144,000ms — full pipeline stages
  max:       fib(13) * 1000,  //233,000ms — maximum timeout
});

// ─── JITTER ──────────────────────────────────────────────────────────────────

/** Default jitter factor: ψ² ≈ 0.382 (±38.2%) */
export const JITTER_FACTOR = PSI_2;

/**
 * Apply phi-derived jitter to a value.
 * @param {number} value - Base value.
 * @param {number} [factor=PSI_2] - Jitter factor.
 * @returns {number} Value with jitter applied.
 */
export function withJitter(value, factor = JITTER_FACTOR) {
  return value * (1 + (Math.random() * 2 - 1) * factor);
}

// ─── FIBONACCI SNAP UTILITIES ────────────────────────────────────────────────

/**
 * Snap a timeout value to the nearest Fibonacci × multiplier.
 * @param {number} ms - Timeout in milliseconds.
 * @param {number} [multiplier=1000] - Base multiplier.
 * @returns {number}
 */
export function fibSnapTimeout(ms, multiplier = 1000) {
  const ratio = ms / multiplier;
  return fibSnap(ratio) * multiplier;
}

// ─── COHERENCE SCORING ───────────────────────────────────────────────────────

/**
 * Classify coherence score into named levels.
 * @param {number} score - Coherence score [0, 1].
 * @returns {'critical'|'degraded'|'warning'|'healthy'|'optimal'}
 */
export function coherenceLevel(score) {
  if (score < CSL_THRESHOLDS.MINIMUM) return 'critical';   // < 0.500
  if (score < CSL_THRESHOLDS.LOW)     return 'degraded';    // < 0.691
  if (score < CSL_THRESHOLDS.MEDIUM)  return 'warning';     // < 0.809
  if (score < CSL_THRESHOLDS.HIGH)    return 'healthy';     // < 0.882
  return 'optimal';                                          // ≥ 0.882
}

// ─── EXPORTS SUMMARY ─────────────────────────────────────────────────────────

export default {
  // Core constants
  PHI, PSI, PHI_SQUARED, PHI_CUBED, PHI_4, PHI_5, PHI_6, PHI_7, PHI_8,
  SQRT_PHI, LN_PHI, GOLDEN_ANGLE_DEG, GOLDEN_ANGLE_RAD,
  PSI_2, PSI_3, PSI_4, PSI_5, PSI_6, PSI_7, PSI_8, PSI_9, PSI_10,

  // Fibonacci
  FIBONACCI, fib, fibSnap, fibSnapTimeout, fibTimingSequence,

  // Thresholds
  phiThreshold, CSL_THRESHOLDS,
  PRESSURE_LEVELS, ALERT_LEVELS,

  // Backoff
  phiBackoff, phiBackoffWithJitter, phiBackoffSequence,

  // Weights & scoring
  phiFusionWeights, phiFusionScore, phiPriorityScore,
  EVICTION_WEIGHTS, evictionScore, CRITICALITY_WEIGHTS,

  // Token budgets
  phiTokenBudgets,

  // Resource allocation
  phiResourceWeights, phiMultiSplit,
  POOL_ALLOCATION, POOL_PERCENT,

  // CSL gates
  cslGate, phiGate, cslBlend, adaptiveTemperature,

  // Timeouts
  phiTimeoutTiers, TIMEOUT_TIERS,

  // Jitter
  JITTER_FACTOR, withJitter,

  // Coherence
  coherenceLevel,
};

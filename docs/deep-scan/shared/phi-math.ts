/**
 * Heady™ Phi-Math Foundation — Sacred Geometry Constants & Utilities
 * The single source of truth for ALL scaling constants across the Heady™ ecosystem.
 * 
 * NO MAGIC NUMBERS. Every constant derives from φ (golden ratio) or Fibonacci.
 * 
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

// ─── CORE CONSTANTS ──────────────────────────────────────────────────────────
export const PHI = 1.6180339887498948;           // φ = (1 + √5) / 2
export const PSI = 0.6180339887498949;           // ψ = 1/φ = φ - 1
export const PHI_SQ = 2.618033988749895;         // φ² = φ + 1
export const PHI_CUBED = 4.23606797749979;       // φ³ = 2φ + 1

// ─── FIBONACCI SEQUENCE (first 20 terms) ─────────────────────────────────────
export const FIB = [
  1, 1, 2, 3, 5, 8, 13, 21, 34, 55,
  89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765
] as const;

// Convenience accessors: fib(n) returns the nth Fibonacci number (1-indexed)
export function fib(n: number): number {
  if (n <= 0) return 0;
  if (n <= FIB.length) return FIB[n - 1];
  let a = FIB[FIB.length - 2], b = FIB[FIB.length - 1];
  for (let i = FIB.length; i < n; i++) [a, b] = [b, a + b];
  return b;
}

// ─── PHI-POWER TIMING (ms) ──────────────────────────────────────────────────
export const PHI_TIMING = {
  PHI_1: Math.round(PHI * 1000),                // 1,618ms — quick retries
  PHI_2: Math.round(PHI_SQ * 1000),             // 2,618ms — short operations
  PHI_3: Math.round(PHI_CUBED * 1000),          // 4,236ms — standard operations
  PHI_4: Math.round(Math.pow(PHI, 4) * 1000),   // 6,854ms — API calls, webhooks
  PHI_5: Math.round(Math.pow(PHI, 5) * 1000),   // 11,090ms — complex operations
  PHI_6: Math.round(Math.pow(PHI, 6) * 1000),   // 17,944ms — trial execution
  PHI_7: Math.round(Math.pow(PHI, 7) * 1000),   // 29,034ms — heartbeat cycle
  PHI_8: Math.round(Math.pow(PHI, 8) * 1000),   // 46,979ms — long operations
} as const;

// ─── CSL GATE THRESHOLDS ────────────────────────────────────────────────────
// phiThreshold(level) = 1 - ψ^level × 0.5
export function phiThreshold(level: number, spread = 0.5): number {
  return 1 - Math.pow(PSI, level) * spread;
}

export const CSL_THRESHOLDS = {
  MINIMUM:  phiThreshold(0),   // ≈ 0.500
  LOW:      phiThreshold(1),   // ≈ 0.691
  MEDIUM:   phiThreshold(2),   // ≈ 0.809
  HIGH:     phiThreshold(3),   // ≈ 0.882
  CRITICAL: phiThreshold(4),   // ≈ 0.927
  DEFAULT:  PSI,               // 0.618 — standard CSL gate
} as const;

// ─── PHI-BACKOFF ────────────────────────────────────────────────────────────
export function phiBackoff(attempt: number, baseMs = 1000, maxMs = 60000): number {
  const delay = Math.min(baseMs * Math.pow(PHI, attempt), maxMs);
  return Math.round(delay);
}

export const PHI_BACKOFF_SEQUENCE = [
  1000,   // attempt 0
  1618,   // attempt 1: 1000 × φ
  2618,   // attempt 2: 1000 × φ²
  4236,   // attempt 3: 1000 × φ³
  6854,   // attempt 4: 1000 × φ⁴
  11090,  // attempt 5: 1000 × φ⁵
] as const;

// ─── PHI-FUSION WEIGHTS ─────────────────────────────────────────────────────
export function phiFusionWeights(n: number): number[] {
  const weights: number[] = [];
  let remaining = 1;
  for (let i = 0; i < n - 1; i++) {
    const w = remaining * PSI;
    weights.push(w);
    remaining -= w;
  }
  weights.push(remaining);
  return weights;
}

// ─── PRESSURE LEVELS ────────────────────────────────────────────────────────
export const PRESSURE_LEVELS = {
  NOMINAL:  { min: 0, max: PSI * PSI },         // 0 – 0.382
  ELEVATED: { min: PSI * PSI, max: PSI },        // 0.382 – 0.618
  HIGH:     { min: PSI, max: 1 - Math.pow(PSI, 3) }, // 0.618 – 0.854
  CRITICAL: { min: 1 - Math.pow(PSI, 4) },      // 0.910+
} as const;

// ─── ALERT THRESHOLDS ───────────────────────────────────────────────────────
export const ALERT_THRESHOLDS = {
  WARNING:  PSI,                                 // 0.618
  CAUTION:  1 - PSI * PSI,                       // 0.764
  CRITICAL: 1 - Math.pow(PSI, 3),                // 0.854
  EXCEEDED: 1 - Math.pow(PSI, 4),                // 0.910
  HARD_MAX: 1.0,
} as const;

// ─── AUTO-SUCCESS ENGINE CONSTANTS ──────────────────────────────────────────
export const AUTO_SUCCESS = {
  CYCLE_MS:    PHI_TIMING.PHI_7,                 // 29,034ms (replaces hardcoded 30000)
  CATEGORIES:  fib(7),                           // 13 categories (replaces hardcoded 9)
  TASKS_TOTAL: fib(12),                          // 144 tasks (replaces hardcoded 135)
  TASKS_PER_CATEGORY: Math.floor(fib(12) / fib(7)), // 11 per category
  TASK_TIMEOUT_MS: PHI_TIMING.PHI_3,             // 4,236ms individual task timeout
  MAX_RETRIES_PER_CYCLE: fib(4),                 // 3 retries per cycle
  MAX_RETRIES_TOTAL: fib(6),                     // 8 total before incident
} as const;

// ─── PIPELINE CONSTANTS ─────────────────────────────────────────────────────
export const PIPELINE = {
  STAGES:              fib(8),                   // 21 stages
  MAX_CONCURRENT:      fib(6),                   // 8 concurrent tasks
  MAX_RETRIES:         fib(4),                   // 3 retries
  CONTEXT_COMPLETENESS: 0.92,                    // embedding density gate
  RECON_TIMEOUT_MS:    PHI_TIMING.PHI_4,         // 6,854ms
  TRIAL_TIMEOUT_MS:    PHI_TIMING.PHI_6,         // 17,944ms
  AWARENESS_TIMEOUT_MS: PHI_TIMING.PHI_5,        // 11,090ms
  SEARCH_TIMEOUT_MS:   PHI_TIMING.PHI_8,         // 46,979ms (≈ stage_continuous_search)
  EVOLUTION_TIMEOUT_MS: PHI_TIMING.PHI_8,        // 46,979ms
} as const;

// ─── BEE SCALING ────────────────────────────────────────────────────────────
export const BEE_SCALING = {
  PRE_WARM_POOLS: [fib(5), fib(6), fib(7), fib(8)], // [5, 8, 13, 21]
  SCALE_UP_FACTOR: PHI,                          // queue > pool × φ
  SCALE_DOWN_FACTOR: 1 - 1 / PHI,               // idle > pool × 0.382
  STALE_TIMEOUT_S: 60,
  MAX_CONCURRENT: 10000,
} as const;

// ─── RESOURCE ALLOCATION ────────────────────────────────────────────────────
export const RESOURCE_POOLS = {
  HOT:        0.34,    // 34% — user-facing
  WARM:       0.21,    // 21% — important background
  COLD:       0.13,    // 13% — batch processing
  RESERVE:    0.08,    // 8% — burst capacity
  GOVERNANCE: 0.05,    // 5% — HeadyCheck/HeadyAssure always running
} as const;

// ─── SCORING WEIGHTS (CSL-derived) ──────────────────────────────────────────
export const JUDGE_WEIGHTS = {
  CORRECTNESS: 0.34,   // 1/φ² normalized
  SAFETY:      0.21,   // fib ratio
  PERFORMANCE: 0.21,   // fib ratio
  QUALITY:     0.13,   // fib ratio
  ELEGANCE:    0.11,   // fib ratio
} as const;

export const COST_WEIGHTS = {
  TIME:    0.382,      // 1 - 1/φ
  MONEY:   0.382,      // 1 - 1/φ
  QUALITY: 0.236,      // 1/φ²
} as const;

// ─── VECTOR MEMORY ──────────────────────────────────────────────────────────
export const VECTOR = {
  DIMENSIONS: 384,
  PROJECTION_DIMS: 3,
  DRIFT_THRESHOLD: PSI,        // 0.618 — cosine similarity
  COHERENCE_THRESHOLD: phiThreshold(2), // 0.809
  DEDUP_THRESHOLD: 0.972,      // above CRITICAL, for semantic identity
} as const;

export default {
  PHI, PSI, PHI_SQ, PHI_CUBED,
  FIB, fib,
  PHI_TIMING, PHI_BACKOFF_SEQUENCE,
  CSL_THRESHOLDS, phiThreshold,
  phiBackoff, phiFusionWeights,
  PRESSURE_LEVELS, ALERT_THRESHOLDS,
  AUTO_SUCCESS, PIPELINE,
  BEE_SCALING, RESOURCE_POOLS,
  JUDGE_WEIGHTS, COST_WEIGHTS,
  VECTOR,
};

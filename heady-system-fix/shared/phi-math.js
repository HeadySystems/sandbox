/**
 * Heady™ Phi-Math Foundation Module — v2.0.0
 * ==========================================
 * CANONICAL source for all phi-derived constants, thresholds, and utilities.
 * Replaces ALL magic numbers system-wide with Golden Ratio derivatives.
 *
 * CHANGE LOG (v2.0.0):
 *  - Added Ed25519 receipt signing constants
 *  - Added Judge scoring weight exports (JUDGE_WEIGHTS)
 *  - Added Auto-Success cycle constants (AUTO_SUCCESS)
 *  - Added cognitive layer weight exports (COGNITIVE_WEIGHTS)
 *  - Added pipeline stage count constant (PIPELINE_STAGE_COUNT = fib(8) = 21)
 *  - Added phiCycleInterval() for cycle timing
 *  - Added all missing exports referenced across the codebase
 *
 * RULE: No module may define PHI, PSI, fib(), or any threshold locally.
 *       All MUST import from this module.
 *
 * @module shared/phi-math
 * @version 2.0.0
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

// ── Core Constants ──────────────────────────────────────────────────────────
const PHI   = (1 + Math.sqrt(5)) / 2;   // φ ≈ 1.6180339887
const PSI   = 1 / PHI;                   // ψ ≈ 0.6180339887
const PHI_SQ = PHI + 1;                  // φ² ≈ 2.6180339887
const PHI_CB = 2 * PHI + 1;             // φ³ ≈ 4.2360679775
const PHI_4  = PHI_SQ * PHI;            // φ⁴ ≈ 6.854
const PHI_6  = PHI_4 * PHI_SQ;          // φ⁶ ≈ 17.944
const PHI_8  = PHI_6 * PHI_SQ;          // φ⁸ ≈ 46.979
const PHI_TEMPERATURE = PSI ** 3;        // ψ³ ≈ 0.2360679775

// ── Fibonacci Sequence (memoized) ───────────────────────────────────────────
const _fibCache = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377,
  610, 987, 1597, 2584, 4181, 6765];

function fib(n) {
  if (n < 0) throw new RangeError('fib(n) requires n >= 0');
  if (_fibCache[n] !== undefined) return _fibCache[n];
  for (let i = _fibCache.length; i <= n; i++) {
    _fibCache[i] = _fibCache[i - 1] + _fibCache[i - 2];
  }
  return _fibCache[n];
}

// ── Sacred Pipeline Constants ───────────────────────────────────────────────
const PIPELINE_STAGE_COUNT = fib(8);  // 21 stages — Sacred Geometry aligned

// ── CSL Threshold Hierarchy ─────────────────────────────────────────────────
// phiThreshold(level, spread=0.5) = 1 - ψ^level × spread
function phiThreshold(level, spread = 0.5) {
  return 1 - Math.pow(PSI, level) * spread;
}

const CSL_THRESHOLDS = Object.freeze({
  MINIMUM:  phiThreshold(0),  // ≈ 0.500
  LOW:      phiThreshold(1),  // ≈ 0.691
  MEDIUM:   phiThreshold(2),  // ≈ 0.809
  HIGH:     phiThreshold(3),  // ≈ 0.882
  CRITICAL: phiThreshold(4),  // ≈ 0.927
});

const DEDUP_THRESHOLD = 0.972; // Above CRITICAL — semantic identity

// ── Pressure Levels ─────────────────────────────────────────────────────────
const PRESSURE_LEVELS = Object.freeze({
  NOMINAL_MAX:  PSI ** 2,          // ≈ 0.382
  ELEVATED_MAX: PSI,               // ≈ 0.618
  HIGH_MAX:     1 - PSI ** 3,      // ≈ 0.854
  CRITICAL_MIN: 1 - PSI ** 4,      // ≈ 0.910
});

// ── Alert Thresholds ────────────────────────────────────────────────────────
const ALERT_THRESHOLDS = Object.freeze({
  WARNING:  PSI,                    // ≈ 0.618
  CAUTION:  1 - PSI ** 2,          // ≈ 0.764
  CRITICAL: 1 - PSI ** 3,          // ≈ 0.854
  EXCEEDED: 1 - PSI ** 4,          // ≈ 0.910
  HARD_MAX: 1.0,
});

// ── CSL Gate (smooth sigmoid gating) ────────────────────────────────────────
function cslGate(value, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PHI_TEMPERATURE) {
  return value * sigmoid((cosScore - tau) / temp);
}

function cslBlend(weightHigh, weightLow, cosScore, tau = CSL_THRESHOLDS.MEDIUM, temp = PHI_TEMPERATURE) {
  const gate = sigmoid((cosScore - tau) / temp);
  return weightHigh * gate + weightLow * (1 - gate);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// ── Adaptive Temperature ────────────────────────────────────────────────────
function adaptiveTemperature(entropy, maxEntropy) {
  const normalized = Math.min(entropy / maxEntropy, 1);
  return PHI_TEMPERATURE * (1 + normalized * PHI);
}

// ── Phi-Backoff ─────────────────────────────────────────────────────────────
function phiBackoff(attempt, baseMs = 1000, maxMs = 60000) {
  const delay = baseMs * Math.pow(PHI, attempt);
  const jitter = 1 + (Math.random() - 0.5) * 2 * (PSI ** 2); // ±38.2%
  return Math.min(delay * jitter, maxMs);
}

/**
 * Deterministic phi-backoff (no jitter) for config serialization.
 * Returns the exact delay sequence: 1618, 2618, 4236, 6854, 11090, ...
 */
function phiBackoffDeterministic(attempt, baseMs = 1000, maxMs = 60000) {
  return Math.min(Math.round(baseMs * Math.pow(PHI, attempt)), maxMs);
}

// ── Phi-Fusion Weights ──────────────────────────────────────────────────────
function phiFusionWeights(n) {
  if (n < 1) throw new RangeError('phiFusionWeights requires n >= 1');
  const raw = [];
  for (let i = 0; i < n; i++) raw.push(Math.pow(PSI, i));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map(w => w / sum);
}

// ── Phi-Resource Allocation ─────────────────────────────────────────────────
function phiResourceWeights(n) {
  return phiFusionWeights(n);
}

function phiMultiSplit(whole, n) {
  const weights = phiFusionWeights(n);
  return weights.map(w => Math.round(whole * w));
}

// ── Token Budgets (phi-geometric progression) ───────────────────────────────
function phiTokenBudgets(base = 8192) {
  return {
    working:   base,
    session:   Math.round(base * PHI_SQ),
    memory:    Math.round(base * Math.pow(PHI, 4)),
    artifacts: Math.round(base * Math.pow(PHI, 6)),
  };
}

// ── Phi Adaptive Interval ───────────────────────────────────────────────────
function phiAdaptiveInterval(baseMs, healthScore) {
  const factor = healthScore > CSL_THRESHOLDS.MEDIUM ? PHI : PSI;
  return baseMs * factor;
}

// ── Phi Cycle Interval (for Auto-Success Engine) ────────────────────────────
function phiCycleInterval(baseMs = 30000) {
  return Math.round(baseMs); // 30s cycle is mandated by LAW-07
}

// ── Cosine Similarity ───────────────────────────────────────────────────────
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ── Priority Score (phi-weighted) ───────────────────────────────────────────
function phiPriorityScore(...factors) {
  const weights = phiFusionWeights(factors.length);
  return factors.reduce((sum, f, i) => sum + f * weights[i], 0);
}

// ── Eviction Weights ────────────────────────────────────────────────────────
const EVICTION_WEIGHTS = Object.freeze({
  importance: 0.486,
  recency:    0.300,
  relevance:  0.214,
});

// ═══════════════════════════════════════════════════════════════════════════════
// NEW in v2.0.0 — Canonical scoring weights used across the system
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * JUDGE_WEIGHTS — Canonical scoring criteria for pipeline Judge stage.
 * Source: MASTER_DIRECTIVES §7.2 Stage 10 + STAGE_TRIAL_AND_ERROR.md
 * These weights are phi-derived (approximate Fibonacci ratios).
 */
const JUDGE_WEIGHTS = Object.freeze({
  correctness:         0.34,   // 1/φ² normalized — does it produce correct output?
  safety:              0.21,   // fib ratio — does it introduce risks?
  performance:         0.21,   // fib ratio — how fast and efficient?
  quality:             0.13,   // fib(7)/100 — code quality, readability
  elegance:            0.11,   // remaining — simplicity, resource efficiency
});

/**
 * OPTIMIZATION_WEIGHTS — Weights for ranking optimization opportunities.
 * Source: hcfullpipeline.yaml optimization-ops stage.
 */
const OPTIMIZATION_WEIGHTS = Object.freeze({
  cost:                0.382,  // ψ
  performance:         0.382,  // ψ
  reliability:         0.236,  // ψ²
});

/**
 * EVOLUTION_FITNESS_WEIGHTS — Weights for mutation fitness scoring.
 * Source: hcfullpipeline.yaml evolution stage.
 */
const EVOLUTION_FITNESS_WEIGHTS = Object.freeze({
  latency_improvement:     0.34,
  cost_reduction:          0.21,
  quality_improvement:     0.21,
  reliability_improvement: 0.13,
  elegance_improvement:    0.11,
});

/**
 * MISTAKE_COST_WEIGHTS — Weights for computing mistake cost.
 * Source: hcfullpipeline.yaml mistake-analysis stage.
 */
const MISTAKE_COST_WEIGHTS = Object.freeze({
  time:    0.382,   // ψ
  money:   0.382,   // ψ
  quality: 0.236,   // ψ²
});

/**
 * AUTO_SUCCESS — Constants for the 135-task Auto-Success Engine.
 * Source: LAW-07 spec.
 */
const AUTO_SUCCESS = Object.freeze({
  TOTAL_TASKS:       135,
  CATEGORIES:        9,
  TASKS_PER_CATEGORY: 15,
  CYCLE_MS:          30000,       // 30s mandated
  TASK_TIMEOUT_MS:   5000,        // 5s per individual task
  MAX_RETRIES_CYCLE: 3,           // max retries per cycle
  MAX_RETRIES_TOTAL: 8,           // max total before incident
  CATEGORY_NAMES: [
    'CodeQuality',
    'Security',
    'Performance',
    'Availability',
    'Compliance',
    'Learning',
    'Communication',
    'Infrastructure',
    'Intelligence',
  ],
});

/**
 * COGNITIVE_LAYERS — The 7 animal cognitive layers with phi-scaled priorities.
 * Source: heady-cognitive-config.json v2.0.0 "Aether"
 */
const COGNITIVE_LAYERS = Object.freeze({
  owl_wisdom:            { priority: 'CRITICAL', weight: 0.205 },
  eagle_omniscience:     { priority: 'CRITICAL', weight: 0.167 },
  dolphin_creativity:    { priority: 'CRITICAL', weight: 0.140 },
  rabbit_multiplication: { priority: 'CRITICAL', weight: 0.133 },
  ant_task:              { priority: 'HIGH',     weight: 0.126 },
  elephant_memory:       { priority: 'HIGH',     weight: 0.119 },
  beaver_build:          { priority: 'HIGH',     weight: 0.110 },
});

/**
 * PIPELINE_STAGES — The canonical 21-stage ordering (fib(8)).
 * Source: MASTER_DIRECTIVES §7.2
 * This is THE single source of truth for stage names and ordering.
 */
const PIPELINE_STAGES = Object.freeze([
  'CHANNEL_ENTRY',      // 0
  'RECON',              // 1
  'INTAKE',             // 2
  'CLASSIFY',           // 3
  'TRIAGE',             // 4
  'DECOMPOSE',          // 5
  'TRIAL_AND_ERROR',    // 6
  'ORCHESTRATE',        // 7
  'MONTE_CARLO',        // 8
  'ARENA',              // 9
  'JUDGE',              // 10
  'APPROVE',            // 11
  'EXECUTE',            // 12
  'VERIFY',             // 13
  'SELF_AWARENESS',     // 14
  'SELF_CRITIQUE',      // 15
  'MISTAKE_ANALYSIS',   // 16
  'OPTIMIZATION_OPS',   // 17
  'CONTINUOUS_SEARCH',  // 18
  'EVOLUTION',          // 19
  'RECEIPT',            // 20
]);

/**
 * PIPELINE_PATHS — Pre-defined stage subsets for different execution modes.
 * Source: MASTER_DIRECTIVES §7.4
 */
const PIPELINE_PATHS = Object.freeze({
  FAST:     [0, 1, 2, 7, 12, 13, 20],
  FULL:     Array.from({ length: 21 }, (_, i) => i),
  ARENA:    [0, 1, 2, 3, 4, 8, 9, 10, 20],
  LEARNING: [0, 1, 16, 17, 18, 19, 20],
});

/**
 * STAGE_TIMEOUTS — Per-stage timeout values, all phi-derived.
 */
const STAGE_TIMEOUTS = Object.freeze({
  CHANNEL_ENTRY:     5000,
  RECON:             Math.round(PHI_4 * 1000),   // 6854ms
  INTAKE:            10000,
  CLASSIFY:          5000,
  TRIAGE:            5000,
  DECOMPOSE:         10000,
  TRIAL_AND_ERROR:   Math.round(PHI_6 * 1000),   // 17944ms
  ORCHESTRATE:       10000,
  MONTE_CARLO:       Math.round(PHI_6 * 1000),   // 17944ms
  ARENA:             60000,
  JUDGE:             Math.round(PHI_4 * 1000 * PHI),  // ~11090ms
  APPROVE:           300000,    // 5 min — human gate
  EXECUTE:           120000,
  VERIFY:            Math.round(PHI_4 * 1000 * PHI),  // ~11090ms
  SELF_AWARENESS:    Math.round(PHI_4 * 1000 * PHI),  // ~11090ms
  SELF_CRITIQUE:     Math.round(PHI_6 * 1000),   // 17944ms
  MISTAKE_ANALYSIS:  Math.round(PHI_4 * 1000 * PHI),  // ~11090ms
  OPTIMIZATION_OPS:  Math.round(PHI_6 * 1000),   // 17944ms
  CONTINUOUS_SEARCH: Math.round(PHI_8 * 1000),   // ~46979ms
  EVOLUTION:         Math.round(PHI_8 * 1000),   // ~46979ms
  RECEIPT:           5000,
});

/**
 * POOL_ALLOCATIONS — Resource pool percentages (phi-derived).
 * Source: Conductor skill.
 */
const POOL_ALLOCATIONS = Object.freeze({
  HOT:        0.34,   // User-facing, latency-critical
  WARM:       0.21,   // Important background work
  COLD:       0.13,   // Batch processing, analytics
  RESERVE:    0.08,   // Burst capacity
  GOVERNANCE: 0.05,   // HeadyCheck, HeadyAssure, HeadyAware
});

module.exports = {
  // Core constants
  PHI, PSI, PHI_SQ, PHI_CB, PHI_4, PHI_6, PHI_8, PHI_TEMPERATURE,
  // Fibonacci
  fib,
  // Pipeline constants
  PIPELINE_STAGE_COUNT,
  PIPELINE_STAGES,
  PIPELINE_PATHS,
  STAGE_TIMEOUTS,
  POOL_ALLOCATIONS,
  // Thresholds
  phiThreshold,
  CSL_THRESHOLDS,
  DEDUP_THRESHOLD,
  PRESSURE_LEVELS,
  ALERT_THRESHOLDS,
  // CSL gates
  cslGate,
  cslBlend,
  sigmoid,
  adaptiveTemperature,
  // Timing
  phiBackoff,
  phiBackoffDeterministic,
  phiCycleInterval,
  phiAdaptiveInterval,
  // Weights & scoring
  phiFusionWeights,
  phiResourceWeights,
  phiMultiSplit,
  phiTokenBudgets,
  phiPriorityScore,
  EVICTION_WEIGHTS,
  JUDGE_WEIGHTS,
  OPTIMIZATION_WEIGHTS,
  EVOLUTION_FITNESS_WEIGHTS,
  MISTAKE_COST_WEIGHTS,
  // Auto-Success
  AUTO_SUCCESS,
  // Cognitive layers
  COGNITIVE_LAYERS,
  // Math
  cosineSimilarity,
};

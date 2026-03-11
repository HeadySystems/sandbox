/**
 * @fileoverview Heady™ Pipeline Stages — HCFullPipeline Stage Definitions
 *
 * Defines all 21 stage configurations for the HCFullPipeline (HCFP).
 * Stage count = fib(8) = 21.
 *
 * Each stage has:
 *   id       — camelCase identifier
 *   name     — human-readable label
 *   order    — 0-indexed execution order (0–20)
 *   required — whether stage failure aborts the pipeline
 *   timeout  — from PHI_TIMING (milliseconds)
 *   parallel — can run concurrently with other parallel-marked stages
 *   steps    — number of internal micro-steps (Fibonacci)
 *   pool     — which worker pool handles this stage
 *
 * All timeouts and step counts derive from phi-math. ZERO magic numbers.
 *
 * Pipeline variants:
 *   FAST     — 7 stages  (fib(6)−1 = 7): channel_entry→triage→execute→verify→receipt
 *   FULL     — 21 stages (fib(8) = 21): all stages
 *   ARENA    — 9 stages  (fib(6)+1 = 9): triage through judge
 *   LEARNING — 7 stages  (fib(6)−1 = 7): decompose through evolution
 *
 * @module pipeline-stages
 * @see shared/phi-math.js
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const {
  fib,
  PHI_TIMING,
  PIPELINE,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math.js');

// ─── Stage count sanity check ─────────────────────────────────────────────────

/** Full pipeline stage count: fib(8) = 21 */
const STAGE_COUNT = PIPELINE.STAGES; // 21

// ─── Stage definitions ────────────────────────────────────────────────────────

/**
 * All 21 HCFullPipeline stages, ordered by execution sequence.
 * @type {object[]}
 */
const STAGES = Object.freeze([
  {
    id:       'channel_entry',
    name:     'Channel Entry',
    order:    0,
    required: true,
    timeout:  PHI_TIMING.PHI_2,        // 2,618ms — fast entry gate
    parallel: false,
    steps:    fib(4),                  // 3
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.MINIMUM,  // 0.500 — noise floor check
    description: 'Validate incoming task signature, enforce entry CSL gate, stamp arrival timestamp.',
  },
  {
    id:       'recon',
    name:     'Recon',
    order:    1,
    required: true,
    timeout:  PIPELINE.TIMEOUT.RECON,  // PHI_4 = 6,854ms
    parallel: false,
    steps:    fib(5),                  // 5
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.LOW,      // 0.691
    description: 'Gather context: previous sessions, related memory, domain signals.',
  },
  {
    id:       'intake',
    name:     'Intake',
    order:    2,
    required: true,
    timeout:  PIPELINE.TIMEOUT.INTAKE, // PHI_3 = 4,236ms
    parallel: false,
    steps:    fib(4),                  // 3
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.LOW,      // 0.691
    description: 'Normalize and canonicalize task input; extract structured intent.',
  },
  {
    id:       'memory',
    name:     'Memory',
    order:    3,
    required: false,
    timeout:  PHI_TIMING.PHI_4,        // 6,854ms
    parallel: true,                    // runs concurrently with recon/intake aftermath
    steps:    fib(5),                  // 5
    pool:     'WARM',
    cslGate:  CSL_THRESHOLDS.MEDIUM,   // 0.809
    description: 'Retrieve relevant long-term memories; inject into task context.',
  },
  {
    id:       'triage',
    name:     'Triage',
    order:    4,
    required: true,
    timeout:  PHI_TIMING.PHI_3,        // 4,236ms
    parallel: false,
    steps:    fib(4),                  // 3
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.MEDIUM,   // 0.809
    description: 'Classify urgency, risk level, and required pipeline variant.',
  },
  {
    id:       'decompose',
    name:     'Decompose',
    order:    5,
    required: true,
    timeout:  PHI_TIMING.PHI_5,        // 11,090ms
    parallel: false,
    steps:    fib(6),                  // 8
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.MEDIUM,   // 0.809
    description: 'Break task into atomic subtasks; assign to bee swarms.',
  },
  {
    id:       'trial_and_error',
    name:     'Trial and Error',
    order:    6,
    required: false,
    timeout:  PIPELINE.TIMEOUT.TRIAL,  // PHI_6 = 17,944ms
    parallel: true,
    steps:    fib(7),                  // 13
    pool:     'WARM',
    cslGate:  CSL_THRESHOLDS.LOW,      // 0.691
    description: 'Speculative micro-executions to probe feasibility; failures are expected.',
  },
  {
    id:       'orchestrate',
    name:     'Orchestrate',
    order:    7,
    required: true,
    timeout:  PHI_TIMING.PHI_5,        // 11,090ms
    parallel: false,
    steps:    fib(5),                  // 5
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.HIGH,     // 0.882
    description: 'Coordinate bee swarms; route subtasks to optimal nodes.',
  },
  {
    id:       'monte_carlo',
    name:     'Monte Carlo',
    order:    8,
    required: false,
    timeout:  PHI_TIMING.PHI_6,        // 17,944ms
    parallel: true,
    steps:    fib(8),                  // 21 simulation runs
    pool:     'COLD',
    cslGate:  CSL_THRESHOLDS.MEDIUM,   // 0.809
    description: 'Probabilistic outcome sampling for high-risk decisions.',
  },
  {
    id:       'arena',
    name:     'Arena',
    order:    9,
    required: false,
    timeout:  PHI_TIMING.PHI_7,        // 29,034ms
    parallel: false,
    steps:    fib(6),                  // 8 competing approaches
    pool:     'WARM',
    cslGate:  CSL_THRESHOLDS.HIGH,     // 0.882
    description: 'Run competing solution candidates head-to-head; rank by judge.',
  },
  {
    id:       'judge',
    name:     'Judge',
    order:    10,
    required: true,
    timeout:  PHI_TIMING.PHI_4,        // 6,854ms
    parallel: false,
    steps:    fib(4),                  // 3
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.HIGH,     // 0.882
    description: 'HeadyCheck scores candidates on correctness, safety, performance, quality.',
  },
  {
    id:       'approve',
    name:     'Approve',
    order:    11,
    required: true,
    timeout:  PHI_TIMING.PHI_3,        // 4,236ms
    parallel: false,
    steps:    fib(3),                  // 2 — governance check + CSL gate
    pool:     'GOVERNANCE',
    cslGate:  CSL_THRESHOLDS.CRITICAL, // 0.927 — near-certain threshold
    description: 'Governance gate: budget check, risk gating, optional human approval.',
  },
  {
    id:       'execute',
    name:     'Execute',
    order:    12,
    required: true,
    timeout:  PIPELINE.TIMEOUT.EXECUTE, // 120,000ms — generous for AI calls
    parallel: false,
    steps:    fib(7),                   // 13
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.HIGH,      // 0.882
    description: 'Invoke AI providers / tools; stream or batch results.',
  },
  {
    id:       'verify',
    name:     'Verify',
    order:    13,
    required: true,
    timeout:  PHI_TIMING.PHI_5,        // 11,090ms
    parallel: false,
    steps:    fib(5),                  // 5
    pool:     'HOT',
    cslGate:  CSL_THRESHOLDS.HIGH,     // 0.882
    description: 'HeadyAssure validates output: format, safety, correctness assertions.',
  },
  {
    id:       'self_awareness',
    name:     'Self-Awareness',
    order:    14,
    required: false,
    timeout:  PIPELINE.TIMEOUT.AWARENESS, // PHI_5 = 11,090ms
    parallel: true,
    steps:    fib(5),                     // 5
    pool:     'GOVERNANCE',
    cslGate:  CSL_THRESHOLDS.MEDIUM,      // 0.809
    description: 'System self-reflection: detect drift, values alignment, coherence check.',
  },
  {
    id:       'self_critique',
    name:     'Self-Critique',
    order:    15,
    required: false,
    timeout:  PHI_TIMING.PHI_5,        // 11,090ms
    parallel: true,
    steps:    fib(5),                  // 5
    pool:     'WARM',
    cslGate:  CSL_THRESHOLDS.MEDIUM,   // 0.809
    description: 'Critical evaluation of the execute output; identify weaknesses.',
  },
  {
    id:       'mistake_analysis',
    name:     'Mistake Analysis',
    order:    16,
    required: false,
    timeout:  PHI_TIMING.PHI_4,        // 6,854ms
    parallel: true,
    steps:    fib(4),                  // 3
    pool:     'WARM',
    cslGate:  CSL_THRESHOLDS.LOW,      // 0.691
    description: 'Root-cause any errors from trial_and_error; feed learning system.',
  },
  {
    id:       'optimization_ops',
    name:     'Optimization Ops',
    order:    17,
    required: false,
    timeout:  PHI_TIMING.PHI_5,        // 11,090ms
    parallel: true,
    steps:    fib(6),                  // 8
    pool:     'COLD',
    cslGate:  CSL_THRESHOLDS.MEDIUM,   // 0.809
    description: 'Apply post-execution optimizations: caching, preloading, index updates.',
  },
  {
    id:       'continuous_search',
    name:     'Continuous Search',
    order:    18,
    required: false,
    timeout:  PIPELINE.TIMEOUT.SEARCH, // PHI_7 = 29,034ms
    parallel: true,
    steps:    fib(7),                  // 13
    pool:     'COLD',
    cslGate:  CSL_THRESHOLDS.LOW,      // 0.691
    description: 'Background knowledge expansion; ingest new signals for future tasks.',
  },
  {
    id:       'evolution',
    name:     'Evolution',
    order:    19,
    required: false,
    timeout:  PIPELINE.TIMEOUT.EVOLUTION, // PHI_7 = 29,034ms
    parallel: false,
    steps:    fib(7),                     // 13
    pool:     'COLD',
    cslGate:  CSL_THRESHOLDS.MEDIUM,      // 0.809
    description: 'HeadyPatterns ingests workflow outcomes; updates routing policies.',
  },
  {
    id:       'receipt',
    name:     'Receipt',
    order:    20,
    required: true,
    timeout:  PIPELINE.TIMEOUT.RECEIPT,  // PHI_4 = 6,854ms
    parallel: false,
    steps:    fib(3),                    // 2
    pool:     'GOVERNANCE',
    cslGate:  CSL_THRESHOLDS.MINIMUM,    // 0.500
    description: 'Emit Ed25519-signed audit receipt; update autobiography; return result.',
  },
]);

// ─── Stage lookup helpers ─────────────────────────────────────────────────────

/** @type {Map<string, object>} fast lookup by stage id */
const STAGE_BY_ID = new Map(STAGES.map(s => [s.id, s]));

/** @type {Map<number, object>} fast lookup by stage order */
const STAGE_BY_ORDER = new Map(STAGES.map(s => [s.order, s]));

/**
 * Look up a stage by id.
 * @param {string} id
 * @returns {object}
 */
function getStage(id) {
  const s = STAGE_BY_ID.get(id);
  if (!s) throw new Error(`[pipeline-stages] unknown stage id: "${id}"`);
  return s;
}

// ─── Pipeline variant definitions ────────────────────────────────────────────

/**
 * FAST pipeline: 7 stages (fib(6)-1=7) — minimum viable for user-interactive tasks.
 * Covers: entry, recon, intake, triage, approve, execute, receipt
 */
const PIPELINE_FAST = Object.freeze(
  ['channel_entry', 'recon', 'intake', 'triage', 'approve', 'execute', 'receipt']
    .map(id => STAGE_BY_ID.get(id))
);

/**
 * FULL pipeline: all 21 stages (fib(8)=21).
 */
const PIPELINE_FULL = STAGES;

/**
 * ARENA pipeline: 9 stages (fib(6)+1=9) — for competitive evaluation tasks.
 * Covers: triage, decompose, trial_and_error, orchestrate, monte_carlo,
 *         arena, judge, approve, receipt
 */
const PIPELINE_ARENA = Object.freeze(
  ['triage', 'decompose', 'trial_and_error', 'orchestrate', 'monte_carlo',
   'arena', 'judge', 'approve', 'receipt']
    .map(id => STAGE_BY_ID.get(id))
);

/**
 * LEARNING pipeline: 7 stages (fib(6)-1=7) — for continuous improvement tasks.
 * Covers: decompose, trial_and_error, self_awareness, self_critique,
 *         mistake_analysis, optimization_ops, evolution
 */
const PIPELINE_LEARNING = Object.freeze(
  ['decompose', 'trial_and_error', 'self_awareness', 'self_critique',
   'mistake_analysis', 'optimization_ops', 'evolution']
    .map(id => STAGE_BY_ID.get(id))
);

/** Map of variant name → stage list */
const PIPELINE_VARIANTS = Object.freeze({
  FAST:     PIPELINE_FAST,
  FULL:     PIPELINE_FULL,
  ARENA:    PIPELINE_ARENA,
  LEARNING: PIPELINE_LEARNING,
});

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  STAGES,
  STAGE_COUNT,
  STAGE_BY_ID,
  STAGE_BY_ORDER,
  getStage,
  PIPELINE_VARIANTS,
  PIPELINE_FAST,
  PIPELINE_FULL,
  PIPELINE_ARENA,
  PIPELINE_LEARNING,
};

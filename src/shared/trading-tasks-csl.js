/**
 * @file trading-tasks-csl.js
 * @description Apex Trading Intelligence — Enhanced Trading Tasks Registry
 *              All 25 canonical tasks (apx-001–apx-015, trm-001–trm-010)
 *              augmented with φ-derived CSL confidence/threshold/weight fields.
 *
 * @module TradingTasksCSL
 * @version 2.0.0
 * @since 1.0.0
 *
 * @copyright © 2026 Heady™Systems Inc. All rights reserved.
 * @license Proprietary — HeadyConnection Project, Apex Trading Intelligence
 *
 * @patent PROVISIONAL-2026-HEADY-001  Phi-Geometric Continuous Scoring Layer (CSL)
 * @patent PROVISIONAL-2026-HEADY-004  Geometric Mean Task Confidence Fusion
 *
 * @author eric@headyconnection.org
 *
 * @remarks
 *   No external dependencies — Node.js `crypto` only.
 *   All numeric constants derive from φ = 1.6180339887.
 *
 * Task namespace legend:
 *   apx-001 – apx-015   Apex Trader Funding account management tasks
 *   trm-001 – trm-010   Trade-risk management tasks
 *
 * CSL Threshold mapping (pool assignment):
 *   HOT  tasks → cslThreshold = ψ   ≈ 0.618
 *   WARM tasks → cslThreshold = ψ²  ≈ 0.382
 *   COLD tasks → cslThreshold = ψ³  ≈ 0.236
 *
 * cslWeight — φ-geometric weight for geometric mean fusion:
 *   Critical    → φ³  ≈ 4.236
 *   Important   → φ²  ≈ 2.618
 *   Standard    → φ   ≈ 1.618
 *   Background  → ψ   ≈ 0.618
 */

'use strict';

const crypto = require('crypto');

// ─────────────────────────────────────────────────────────────────────────────
// § 1  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** @constant {number} φ */
const PHI     = 1.6180339887;
/** @constant {number} ψ = 1/φ ≈ 0.6180 */
const PSI     = 1 / PHI;
/** @constant {number} ψ² ≈ 0.3820 */
const PSI2    = PSI  * PSI;
/** @constant {number} ψ³ ≈ 0.2361 */
const PSI3    = PSI2 * PSI;
/** @constant {number} φ² ≈ 2.6180 */
const PHI2    = PHI  * PHI;
/** @constant {number} φ³ ≈ 4.2360 */
const PHI3    = PHI2 * PHI;
/** @constant {number} Division-by-zero guard */
const EPSILON = 1e-10;

// ─────────────────────────────────────────────────────────────────────────────
// § 2  UTILITY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Geometric mean of a non-empty positive array.
 * @param {number[]} values
 * @returns {number}
 */
function geometricMean(values) {
    if (!values || values.length === 0) return 0;
    const n = values.length;
    let logSum = 0;
    for (const v of values) logSum += Math.log(Math.max(v, EPSILON));
    return Math.exp(logSum / n);
}

/**
 * Clamp value to [lo, hi].
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(v, lo, hi) {
    return Math.min(Math.max(v, lo), hi);
}

/**
 * SHA-256 hex digest of any JSON-serialisable value.
 * @param {*} v
 * @returns {string}
 */
function sha256(v) {
    return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  TASK REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All 25 canonical Apex Trading Intelligence tasks.
 *
 * New CSL fields added to each task:
 *   cslConfidence  — initial confidence score derived from priority and tier
 *   cslThreshold   — φ-threshold for pool activation
 *   cslWeight      — geometric weight for signal fusion
 *
 * @type {Object[]}
 */
const TRADING_TASKS = Object.freeze([

    // ────────────────────────────────────────────────────────────────────────
    // APX SERIES — Apex Trader Funding Account Management (apx-001 – apx-015)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * apx-001: Session Initialisation
     * Opens a trading session, records equity high-water mark.
     * Priority: CRITICAL — must execute before any trade.
     */
    {
        id:            'apx-001',
        name:          'Session Initialisation',
        namespace:     'apex',
        description:   'Open a new trading session and record the equity high-water mark',
        priority:      'CRITICAL',
        pool:          'HOT',
        cslConfidence: PHI  / (PHI  + 1),   // φ/(φ+1) ≈ 0.618
        cslThreshold:  PSI,                  // HOT: ≥ 0.618
        cslWeight:     PHI3,                 // Critical weight ≈ 4.236
        dependencies:  [],
        emits:         ['sessionStart'],
        tags:          ['session', 'lifecycle', 'apex'],
    },

    /**
     * apx-002: Trailing Drawdown Monitor
     * Continuously monitors trailing drawdown against the Apex limit.
     * Priority: CRITICAL — must run on every equity update.
     */
    {
        id:            'apx-002',
        name:          'Trailing Drawdown Monitor',
        namespace:     'apex',
        description:   'Monitor trailing drawdown and emit violation events when limits are approached',
        priority:      'CRITICAL',
        pool:          'HOT',
        cslConfidence: PSI,                  // ψ ≈ 0.618
        cslThreshold:  PSI,
        cslWeight:     PHI3,
        dependencies:  ['apx-001'],
        emits:         ['violation', 'riskUpdate'],
        tags:          ['risk', 'drawdown', 'apex', 'monitor'],
    },

    /**
     * apx-003: MAE Proximity Check
     * Checks open trade adverse excursion against the 30 % MAE rule.
     * Priority: CRITICAL.
     */
    {
        id:            'apx-003',
        name:          'MAE Proximity Check',
        namespace:     'apex',
        description:   'Evaluate maximum adverse excursion against the 30 % Apex MAE rule',
        priority:      'CRITICAL',
        pool:          'HOT',
        cslConfidence: PSI,
        cslThreshold:  PSI,
        cslWeight:     PHI3,
        dependencies:  ['apx-001'],
        emits:         ['maeAlert'],
        tags:          ['risk', 'mae', 'apex'],
    },

    /**
     * apx-004: Consistency Rule Enforcement
     * Enforces the 30 % single-day profit cap.
     * Priority: HIGH.
     */
    {
        id:            'apx-004',
        name:          'Consistency Rule Enforcement',
        namespace:     'apex',
        description:   'Enforce the Apex 30 % consistency rule on daily P&L distribution',
        priority:      'HIGH',
        pool:          'HOT',
        cslConfidence: PSI  * PHI  / (PSI * PHI + 1),  // smooth blend ≈ 0.500
        cslThreshold:  PSI,
        cslWeight:     PHI2,                            // Important weight ≈ 2.618
        dependencies:  ['apx-001'],
        emits:         ['consistencyAlert'],
        tags:          ['compliance', 'consistency', 'apex'],
    },

    /**
     * apx-005: Overnight Hold Guard
     * Blocks position carries past the 22:00 UTC close.
     * Priority: HIGH.
     */
    {
        id:            'apx-005',
        name:          'Overnight Hold Guard',
        namespace:     'apex',
        description:   'Prevent overnight position holds per Apex Trader Funding rules',
        priority:      'HIGH',
        pool:          'HOT',
        cslConfidence: PSI2 + PSI3,                     // ψ² + ψ³ ≈ 0.618 (Fibonacci identity)
        cslThreshold:  PSI,
        cslWeight:     PHI2,
        dependencies:  ['apx-001'],
        emits:         ['overnightAlert', 'forceClose'],
        tags:          ['compliance', 'overnight', 'apex'],
    },

    /**
     * apx-006: Trading Hours Validation
     * Validates that order submissions fall within the Apex trading window.
     * Priority: HIGH.
     */
    {
        id:            'apx-006',
        name:          'Trading Hours Validation',
        namespace:     'apex',
        description:   'Validate order timing against the Apex 23:00–22:00 UTC trading window',
        priority:      'HIGH',
        pool:          'HOT',
        cslConfidence: PSI,
        cslThreshold:  PSI,
        cslWeight:     PHI2,
        dependencies:  ['apx-001'],
        emits:         ['outsideHoursAlert'],
        tags:          ['compliance', 'hours', 'apex'],
    },

    /**
     * apx-007: News Blackout Enforcement
     * Blocks new entries within ±5 minutes of scheduled news events.
     * Priority: HIGH.
     */
    {
        id:            'apx-007',
        name:          'News Blackout Enforcement',
        namespace:     'apex',
        description:   'Block trade entries during the Apex ±5-minute news blackout window',
        priority:      'HIGH',
        pool:          'HOT',
        cslConfidence: PSI2 + (PSI3 / PHI),             // ≈ 0.527
        cslThreshold:  PSI,
        cslWeight:     PHI2,
        dependencies:  ['apx-001'],
        emits:         ['newsBlackout'],
        tags:          ['compliance', 'news', 'apex'],
    },

    /**
     * apx-008: Profitable Day Counter
     * Increments the profitable-days counter at session close.
     * Priority: STANDARD.
     */
    {
        id:            'apx-008',
        name:          'Profitable Day Counter',
        namespace:     'apex',
        description:   'Track and increment profitable trading days toward payout eligibility',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,                            // ψ² ≈ 0.382
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['apx-001'],
        emits:         ['dayCountUpdate'],
        tags:          ['payout', 'tracking', 'apex'],
    },

    /**
     * apx-009: Payout Eligibility Check
     * Evaluates whether all payout conditions are currently met.
     * Priority: STANDARD.
     */
    {
        id:            'apx-009',
        name:          'Payout Eligibility Check',
        namespace:     'apex',
        description:   'Evaluate all Apex payout conditions and emit payoutReady when met',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['apx-008'],
        emits:         ['payoutReady'],
        tags:          ['payout', 'eligibility', 'apex'],
    },

    /**
     * apx-010: Safety Net Status Reporter
     * Reports safety-net activation status post payout.
     * Priority: STANDARD.
     */
    {
        id:            'apx-010',
        name:          'Safety Net Status Reporter',
        namespace:     'apex',
        description:   'Report Apex safety-net activation status and payouts-to-activation',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['apx-009'],
        emits:         ['safetyNetUpdate'],
        tags:          ['payout', 'safety-net', 'apex'],
    },

    /**
     * apx-011: Session P&L Accumulator
     * Maintains running session and total-profit tallies.
     * Priority: STANDARD.
     */
    {
        id:            'apx-011',
        name:          'Session P&L Accumulator',
        namespace:     'apex',
        description:   'Maintain real-time session P&L, daily P&L, and cumulative profit',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['apx-001'],
        emits:         ['pnlUpdate'],
        tags:          ['pnl', 'session', 'apex'],
    },

    /**
     * apx-012: Account Tier Selector
     * Selects the correct APEX_RULES tier and loads constraints.
     * Priority: STANDARD.
     */
    {
        id:            'apx-012',
        name:          'Account Tier Selector',
        namespace:     'apex',
        description:   'Select and load the correct Apex account tier constraints at startup',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  [],
        emits:         ['tierLoaded'],
        tags:          ['account', 'configuration', 'apex'],
    },

    /**
     * apx-013: High-Water Mark Tracker
     * Keeps an accurate trailing high-water mark for drawdown computation.
     * Priority: STANDARD.
     */
    {
        id:            'apx-013',
        name:          'High-Water Mark Tracker',
        namespace:     'apex',
        description:   'Track the equity high-water mark to accurately compute trailing drawdown',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['apx-001', 'apx-002'],
        emits:         ['hwmUpdate'],
        tags:          ['equity', 'drawdown', 'apex'],
    },

    /**
     * apx-014: Session Close Handler
     * Executes end-of-session cleanup: P&L finalisation, flat check, log flush.
     * Priority: STANDARD.
     */
    {
        id:            'apx-014',
        name:          'Session Close Handler',
        namespace:     'apex',
        description:   'Execute end-of-session cleanup: final P&L, flat-book check, log flush',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['apx-001', 'apx-011'],
        emits:         ['sessionEnd'],
        tags:          ['session', 'lifecycle', 'apex'],
    },

    /**
     * apx-015: Audit Log Writer
     * Persists a SHA-256 stamped audit log for every risk event.
     * Priority: BACKGROUND.
     */
    {
        id:            'apx-015',
        name:          'Audit Log Writer',
        namespace:     'apex',
        description:   'Write SHA-256 stamped audit entries for every risk event to persistent storage',
        priority:      'BACKGROUND',
        pool:          'COLD',
        cslConfidence: PSI3,                            // ψ³ ≈ 0.236
        cslThreshold:  PSI3,
        cslWeight:     PSI,                             // Background weight ≈ 0.618
        dependencies:  ['apx-001'],
        emits:         ['auditWritten'],
        tags:          ['audit', 'persistence', 'apex'],
    },

    // ────────────────────────────────────────────────────────────────────────
    // TRM SERIES — Trade-Risk Management (trm-001 – trm-010)
    // ────────────────────────────────────────────────────────────────────────

    /**
     * trm-001: CSL Entry Gate Evaluator
     * Fuses multiple entry signals via geometric mean to produce entry confidence.
     * Priority: CRITICAL.
     */
    {
        id:            'trm-001',
        name:          'CSL Entry Gate Evaluator',
        namespace:     'trade-risk',
        description:   'Fuse entry signals via φ-geometric mean and gate order submission',
        priority:      'CRITICAL',
        pool:          'HOT',
        cslConfidence: PSI,
        cslThreshold:  PSI,
        cslWeight:     PHI3,
        dependencies:  ['apx-001', 'apx-006', 'apx-007'],
        emits:         ['entryApproved', 'entryRejected'],
        tags:          ['entry', 'csl', 'trade-risk'],
    },

    /**
     * trm-002: CSL Exit Gate Evaluator
     * Scores exit urgency via drawdown proximity and φ-scaled time decay.
     * Priority: CRITICAL.
     */
    {
        id:            'trm-002',
        name:          'CSL Exit Gate Evaluator',
        namespace:     'trade-risk',
        description:   'Score exit urgency using drawdown proximity and φ-scaled time decay',
        priority:      'CRITICAL',
        pool:          'HOT',
        cslConfidence: PSI,
        cslThreshold:  PSI,
        cslWeight:     PHI3,
        dependencies:  ['trm-001'],
        emits:         ['exitSignal', 'forceClose'],
        tags:          ['exit', 'csl', 'trade-risk'],
    },

    /**
     * trm-003: CSL Position Sizer
     * Sizes positions continuously via confidence × (1−risk) × ψ.
     * Priority: HIGH.
     */
    {
        id:            'trm-003',
        name:          'CSL Position Sizer',
        namespace:     'trade-risk',
        description:   'Compute continuous φ-scaled position size: baseSize × confidence × (1−risk) × ψ',
        priority:      'HIGH',
        pool:          'HOT',
        cslConfidence: PSI2 + PSI3,                     // ≈ 0.618
        cslThreshold:  PSI,
        cslWeight:     PHI2,
        dependencies:  ['trm-001', 'apx-002', 'apx-003'],
        emits:         ['positionSized'],
        tags:          ['sizing', 'csl', 'trade-risk'],
    },

    /**
     * trm-004: Portfolio Risk Aggregator
     * Computes geometric mean risk across all open positions.
     * Priority: HIGH.
     */
    {
        id:            'trm-004',
        name:          'Portfolio Risk Aggregator',
        namespace:     'trade-risk',
        description:   'Aggregate portfolio risk via geometric mean (not max) across all positions',
        priority:      'HIGH',
        pool:          'HOT',
        cslConfidence: PSI2 + PSI3,                     // ≈ 0.618
        cslThreshold:  PSI,
        cslWeight:     PHI2,
        dependencies:  ['apx-002', 'apx-003'],
        emits:         ['portfolioRiskUpdate'],
        tags:          ['portfolio', 'csl', 'trade-risk'],
    },

    /**
     * trm-005: Drawdown Proximity Scorer
     * Emits a continuous [0,1] drawdown proximity score for dashboard use.
     * Priority: HIGH.
     */
    {
        id:            'trm-005',
        name:          'Drawdown Proximity Scorer',
        namespace:     'trade-risk',
        description:   'Emit a continuous φ-sigmoid drawdown proximity score for display and gating',
        priority:      'HIGH',
        pool:          'HOT',
        cslConfidence: PSI,
        cslThreshold:  PSI,
        cslWeight:     PHI2,
        dependencies:  ['apx-002', 'apx-013'],
        emits:         ['drawdownProximityScore'],
        tags:          ['drawdown', 'scoring', 'trade-risk'],
    },

    /**
     * trm-006: Signal Confidence Aggregator
     * Collects signals from strategy modules and fuses via geometric mean.
     * Priority: STANDARD.
     */
    {
        id:            'trm-006',
        name:          'Signal Confidence Aggregator',
        namespace:     'trade-risk',
        description:   'Collect and fuse strategy signals via φ-geometric mean into a single confidence value',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['trm-001'],
        emits:         ['signalFused'],
        tags:          ['signals', 'fusion', 'trade-risk'],
    },

    /**
     * trm-007: Trade Log Recorder
     * Records completed trades with CSL confidence/risk metadata.
     * Priority: STANDARD.
     */
    {
        id:            'trm-007',
        name:          'Trade Log Recorder',
        namespace:     'trade-risk',
        description:   'Record completed trades with CSL confidence, risk, and SHA-256 digest',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['trm-002'],
        emits:         ['tradeLogged'],
        tags:          ['logging', 'audit', 'trade-risk'],
    },

    /**
     * trm-008: Risk Calibration Engine
     * Periodically re-calibrates φ-sigmoid parameters based on recent trade history.
     * Priority: STANDARD.
     */
    {
        id:            'trm-008',
        name:          'Risk Calibration Engine',
        namespace:     'trade-risk',
        description:   'Periodically re-calibrate φ-sigmoid risk parameters from recent trade history',
        priority:      'STANDARD',
        pool:          'WARM',
        cslConfidence: PSI2,
        cslThreshold:  PSI2,
        cslWeight:     PHI,
        dependencies:  ['trm-007', 'apx-011'],
        emits:         ['calibrationUpdate'],
        tags:          ['calibration', 'risk', 'trade-risk'],
    },

    /**
     * trm-009: Performance Analytics Reporter
     * Generates per-session Sharpe, Sortino, and CSL confidence trend reports.
     * Priority: BACKGROUND.
     */
    {
        id:            'trm-009',
        name:          'Performance Analytics Reporter',
        namespace:     'trade-risk',
        description:   'Generate per-session Sharpe, Sortino, and CSL confidence trend analytics',
        priority:      'BACKGROUND',
        pool:          'COLD',
        cslConfidence: PSI3,
        cslThreshold:  PSI3,
        cslWeight:     PSI,
        dependencies:  ['trm-007', 'apx-011'],
        emits:         ['analyticsReport'],
        tags:          ['analytics', 'performance', 'trade-risk'],
    },

    /**
     * trm-010: Heartbeat Monitor
     * Periodic health-check that emits a beat with current CSL status digest.
     * Priority: BACKGROUND.
     */
    {
        id:            'trm-010',
        name:          'Heartbeat Monitor',
        namespace:     'trade-risk',
        description:   'Periodic health-check emitting a CSL-stamped heartbeat for liveness monitoring',
        priority:      'BACKGROUND',
        pool:          'COLD',
        cslConfidence: PSI3,
        cslThreshold:  PSI3,
        cslWeight:     PSI,
        dependencies:  [],
        emits:         ['heartbeat'],
        tags:          ['health', 'monitoring', 'trade-risk'],
    },
]);

// ─────────────────────────────────────────────────────────────────────────────
// § 4  SCORE TASKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute real-time CSL confidence for every task based on live signal values.
 *
 * Algorithm:
 *   For each task, collect the matching signal from `signals` (by task.id),
 *   then fuse: geometric_mean([ signals[taskId], task.cslConfidence, signalFallback ])
 *   where signalFallback = PSI (neutral).
 *
 * The fused confidence is clamped to [0,1] and compared against the task's
 * `cslThreshold` to determine whether the task is currently active.
 *
 * @param {Object[]} tasks    Array of task descriptors (defaults to TRADING_TASKS).
 * @param {Object}   signals  Signal map: { [taskId]: number (0–1) }
 *                            Additional top-level keys:
 *                              signals.global — global multiplier (default ψ)
 *                              signals.urgency — global urgency override
 * @returns {Object[]}  Tasks with added real-time `cslScore` field:
 *   {
 *     ...task,
 *     cslScore: {
 *       confidence:   number,   // fused real-time confidence
 *       active:       boolean,  // confidence >= task.cslThreshold
 *       pool:         string,   // resolved pool name
 *       inputSignals: number[], // raw values fed into geometric mean
 *       digest:       string,   // SHA-256 of (taskId, confidence)
 *     }
 *   }
 */
function scoreTasks(tasks = TRADING_TASKS, signals = {}) {
    const globalMultiplier = clamp(signals.global  ?? PSI, 0, 1);
    const globalUrgency    = clamp(signals.urgency ?? PSI, 0, 1);

    return tasks.map(task => {
        const taskSignal = typeof signals[task.id] === 'number'
            ? clamp(signals[task.id], 0, 1)
            : PSI;  // neutral fallback

        // Fuse: task's static confidence + task-specific signal + global modifiers
        const inputSignals = [
            task.cslConfidence,
            taskSignal,
            globalMultiplier,
            globalUrgency,
        ];

        const confidence = clamp(geometricMean(inputSignals), 0, 1);
        const active     = confidence >= task.cslThreshold;

        // Resolve pool
        let pool;
        if (confidence >= PSI)  pool = 'HOT';
        else if (confidence >= PSI2) pool = 'WARM';
        else pool = 'COLD';

        const digest = sha256({ id: task.id, confidence });

        return {
            ...task,
            cslScore: {
                confidence,
                active,
                pool,
                inputSignals,
                digest,
            },
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5  TASK INDEX HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up a task by its id.
 *
 * @param {string} id  Task identifier (e.g. 'apx-001').
 * @returns {Object|undefined}
 */
function getTaskById(id) {
    return TRADING_TASKS.find(t => t.id === id);
}

/**
 * Return all tasks that belong to a given namespace.
 *
 * @param {string} namespace  'apex' or 'trade-risk'.
 * @returns {Object[]}
 */
function getTasksByNamespace(namespace) {
    return TRADING_TASKS.filter(t => t.namespace === namespace);
}

/**
 * Return all tasks assigned to a given pool.
 *
 * @param {'HOT'|'WARM'|'COLD'} poolName
 * @returns {Object[]}
 */
function getTasksByPool(poolName) {
    return TRADING_TASKS.filter(t => t.pool === poolName.toUpperCase());
}

/**
 * Return a SHA-256 digest of the entire task registry (determinism verification).
 *
 * @returns {string}
 */
function registryDigest() {
    return sha256(TRADING_TASKS.map(t => ({
        id:            t.id,
        cslConfidence: t.cslConfidence,
        cslThreshold:  t.cslThreshold,
        cslWeight:     t.cslWeight,
    })));
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6  MODULE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
    TRADING_TASKS,
    scoreTasks,
    getTaskById,
    getTasksByNamespace,
    getTasksByPool,
    registryDigest,
    // Constants
    PHI,
    PSI,
    PSI2,
    PSI3,
    PHI2,
    PHI3,
    EPSILON,
    // Utility
    geometricMean,
    clamp,
    sha256,
};

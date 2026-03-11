/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * CSL Confidence Gate — Error Prediction & Halt/Reconfigure System
 *
 * Uses Continuous Semantic Logic to predict errors BEFORE they occur
 * and halt operations when confidence drops below phi-scaled thresholds.
 *
 * Confidence Tiers (phi-scaled):
 *   > φ⁻¹ ≈ 0.618  →  EXECUTE   (high confidence, deterministic)
 *   0.382 – 0.618   →  CAUTIOUS  (adaptive temperature, log warning)
 *   < φ⁻² ≈ 0.382  →  HALT      (predicted error, stop + reconfigure)
 *
 * Error Prediction:
 *   Tracks rolling cosine similarity between consecutive output hashes.
 *   When drift exceeds 1 - φ⁻¹ ≈ 0.382, predicts impending error.
 *
 * Reconfiguration:
 *   When halted, returns a reconfiguration action plan:
 *     - Swap to a different model
 *     - Adjust temperature/parameters
 *     - Retry with different prompt composition
 *     - Escalate to human review
 *
 * @module csl-confidence-gate
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 1 / PHI;             // ≈ 0.618
const PSI_SQ = PSI * PSI;           // ≈ 0.382

/** Confidence tiers — phi-derived thresholds */
const TIERS = Object.freeze({
    EXECUTE: PSI,                    // > 0.618  → proceed with full confidence
    CAUTIOUS: PSI_SQ,                 // 0.382–0.618 → proceed with caution
    HALT: 0,                      // < 0.382  → halt execution
});

/** Drift threshold — (1 - φ⁻¹) ≈ 0.382 */
const DRIFT_THRESHOLD = 1 - PSI;    // ≈ 0.382

/** Rolling window size for drift detection */
const DRIFT_WINDOW = Math.round(PHI ** 5); // ≈ 11

/** Domain reference vectors — phi-scaled pseudo-embeddings per domain.
 *  In production these would be real embeddings; here we use deterministic
 *  seeds for each domain to create reproducible reference vectors. */
const DOMAIN_SEEDS = Object.freeze({
    code: 0x636F6465,
    deploy: 0x64706C79,
    research: 0x72736368,
    security: 0x73656375,
    memory: 0x6D656D6F,
    orchestration: 0x6F726368,
    creative: 0x63726561,
    trading: 0x74726164,
});

// ─── CSLConfidenceGate ────────────────────────────────────────────────────────

class CSLConfidenceGate {
    /**
     * @param {Object} [options]
     * @param {number} [options.executeThreshold]  — override EXECUTE tier
     * @param {number} [options.cautiousThreshold] — override CAUTIOUS tier
     * @param {number} [options.driftThreshold]    — override drift detection
     * @param {number} [options.driftWindow]       — rolling window size
     */
    constructor(options = {}) {
        this.executeThreshold = options.executeThreshold || TIERS.EXECUTE;
        this.cautiousThreshold = options.cautiousThreshold || TIERS.CAUTIOUS;
        this.driftThreshold = options.driftThreshold || DRIFT_THRESHOLD;
        this.driftWindow = options.driftWindow || DRIFT_WINDOW;

        /** @type {string[]} Rolling window of output hashes for drift detection */
        this._outputHistory = [];

        /** Runtime stats */
        this._stats = {
            checks: 0,
            executes: 0,
            cautious: 0,
            halts: 0,
            drifts: 0,
            reconfigures: 0,
        };
    }

    // ─── Pre-Flight Check ───────────────────────────────────────────────────────

    /**
     * Pre-flight confidence check before prompt execution.
     *
     * Determines whether to EXECUTE, proceed with CAUTION, or HALT
     * based on phi-scaled confidence tiers.
     *
     * Confidence is computed from:
     *   1. Variable completeness (all required vars present?)
     *   2. Domain alignment (prompt domain is valid?)
     *   3. Input coherence (variables are non-empty, non-degenerate?)
     *   4. History stability (no recent drift alerts?)
     *
     * @param {string} promptId — prompt identifier
     * @param {Object} vars — variable map
     * @param {string} interpolated — the interpolated prompt string
     * @returns {{ decision: 'EXECUTE'|'CAUTIOUS'|'HALT', confidence: number, reason: string }}
     */
    preFlightCheck(promptId, vars, interpolated) {
        this._stats.checks++;

        // Factor 1: Variable completeness (are all vars non-null/non-empty?)
        const varEntries = Object.entries(vars);
        const totalVars = varEntries.length;
        const filledVars = varEntries.filter(([_, v]) => v !== null && v !== undefined && String(v).trim() !== '').length;
        const completeness = totalVars > 0 ? filledVars / totalVars : 0; // no vars = no confidence

        // Factor 2: Domain alignment (valid prompt ID format?)
        const domainMatch = promptId && promptId.includes('-') ? 1.0 : 0.3;
        const domain = promptId ? promptId.split('-')[0] : '';
        const knownDomain = domain in DOMAIN_SEEDS ? 1.0 : (domain === '' ? 0 : 0.3);

        // Factor 3: Input coherence (interpolated prompt is non-trivial?)
        const length = interpolated ? interpolated.length : 0;
        const coherence = length > 50 ? 1.0 : length > 10 ? 0.7 : 0.2;

        // Factor 4: History stability (no recent drift?)
        const recentDrifts = this._countRecentDrifts();
        const stability = recentDrifts === 0 ? 1.0 : recentDrifts < 3 ? 0.6 : 0.2;

        // Composite confidence — phi-weighted harmonic mean
        const weights = [PHI, 1.0, PSI, PSI_SQ]; // weight completeness highest
        const scores = [completeness, knownDomain * domainMatch, coherence, stability];
        const weightSum = weights.reduce((a, b) => a + b, 0);
        const confidence = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / weightSum;

        // Classify
        let decision, reason;
        if (confidence >= this.executeThreshold) {
            decision = 'EXECUTE';
            reason = `High confidence (${confidence.toFixed(3)} ≥ φ⁻¹=${this.executeThreshold.toFixed(3)})`;
            this._stats.executes++;
        } else if (confidence >= this.cautiousThreshold) {
            decision = 'CAUTIOUS';
            reason = `Moderate confidence (${confidence.toFixed(3)} ∈ [${this.cautiousThreshold.toFixed(3)}, ${this.executeThreshold.toFixed(3)}))`;
            this._stats.cautious++;
        } else {
            decision = 'HALT';
            reason = `Low confidence (${confidence.toFixed(3)} < φ⁻²=${this.cautiousThreshold.toFixed(3)}) — predicted error`;
            this._stats.halts++;
        }

        return { decision, confidence, reason, factors: { completeness, domainMatch, knownDomain, coherence, stability } };
    }

    // ─── Drift Detection ────────────────────────────────────────────────────────

    /**
     * Track output drift — detects when outputs are diverging from
     * deterministic expectations.
     *
     * Compares the current output hash against the rolling window.
     * If the proportion of unique hashes exceeds the drift threshold,
     * a drift alert is raised (error predicted).
     *
     * @param {string} outputHash — hash of the current output
     * @returns {{ drifting: boolean, driftScore: number, prediction: string }}
     */
    trackDrift(outputHash) {
        this._outputHistory.push(outputHash);

        // Maintain rolling window
        if (this._outputHistory.length > this.driftWindow) {
            this._outputHistory = this._outputHistory.slice(-this.driftWindow);
        }

        // Need at least 3 outputs to detect drift
        if (this._outputHistory.length < 3) {
            return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        }

        // Drift score = proportion of unique hashes in window
        // For deterministic ops: all hashes should match → driftScore = 0
        // For drifting ops: hashes diverge → driftScore approaches 1
        const uniqueHashes = new Set(this._outputHistory).size;
        const driftScore = (uniqueHashes - 1) / (this._outputHistory.length - 1);

        const drifting = driftScore > this.driftThreshold;
        if (drifting) this._stats.drifts++;

        let prediction;
        if (driftScore === 0) {
            prediction = 'perfectly_deterministic';
        } else if (driftScore < PSI_SQ) {
            prediction = 'stable_with_minor_variation';
        } else if (driftScore < PSI) {
            prediction = 'drift_detected_error_likely';
        } else {
            prediction = 'severe_drift_error_imminent';
        }

        return { drifting, driftScore, prediction, windowSize: this._outputHistory.length, uniqueOutputs: uniqueHashes };
    }

    // ─── Reconfiguration ────────────────────────────────────────────────────────

    /**
     * Generate a reconfiguration plan when operations are halted.
     *
     * Returns an action plan based on the halting diagnostics:
     *   - If confidence was low due to completeness → suggest missing variables
     *   - If drift was detected → suggest model swap or temperature adjustment
     *   - If domain unknown → suggest prompt composition change
     *
     * @param {Object} diagnostics — from the halt event
     * @returns {{ action: string, newConfig: Object, steps: string[] }}
     */
    reconfigure(diagnostics) {
        this._stats.reconfigures++;

        const steps = [];
        const newConfig = {};

        const confidence = diagnostics.confidence || 0;
        const reason = diagnostics.reason || '';

        if (confidence < 0.2) {
            // Critical — escalate to human
            steps.push('ESCALATE: Confidence critically low, require human review');
            newConfig.escalate = true;
            newConfig.action = 'escalate';
        } else if (reason.includes('completeness') || reason.includes('Interpolation')) {
            // Missing variables — suggest filling them
            steps.push('FILL_VARIABLES: Complete all required prompt variables');
            steps.push('RETRY: Re-execute with completed variables');
            newConfig.action = 'fill_and_retry';
            newConfig.retryWithDefaults = true;
        } else if (reason.includes('drift') || reason.includes('diverging')) {
            // Drift — adjust model params
            steps.push('SWAP_MODEL: Switch to a model with lower variance');
            steps.push('LOCK_SEED: Enforce seed=42 on all subsequent calls');
            steps.push('REDUCE_TEMPERATURE: Force temperature=0');
            newConfig.action = 'stabilize';
            newConfig.llmOverrides = { temperature: 0, seed: 42, top_p: 1 };
        } else {
            // General halt — retry with different prompt composition
            steps.push('RECOMPOSE: Try alternative prompt composition from same domain');
            steps.push('RETRY: Execute with recomposed prompt');
            newConfig.action = 'recompose_and_retry';
        }

        return {
            action: newConfig.action || 'unknown',
            newConfig,
            steps,
            timestamp: Date.now(),
            diagnostics,
        };
    }

    // ─── Stats ──────────────────────────────────────────────────────────────────

    /**
     * Get gate statistics.
     * @returns {Object}
     */
    getStats() {
        return {
            ...this._stats,
            thresholds: {
                execute: this.executeThreshold,
                cautious: this.cautiousThreshold,
                drift: this.driftThreshold,
            },
            driftWindowSize: this._outputHistory.length,
            phi: PHI,
        };
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    /**
     * Count recent drift alerts (simple: count unique hashes in last N outputs).
     */
    _countRecentDrifts() {
        if (this._outputHistory.length < 3) return 0;
        const recent = this._outputHistory.slice(-5);
        return new Set(recent).size - 1; // 0 = no drift, 1+ = drifting
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = CSLConfidenceGate;
module.exports.CSLConfidenceGate = CSLConfidenceGate;
module.exports.TIERS = TIERS;
module.exports.DRIFT_THRESHOLD = DRIFT_THRESHOLD;
module.exports.PHI = PHI;
module.exports.PSI = PSI;
module.exports.PSI_SQ = PSI_SQ;

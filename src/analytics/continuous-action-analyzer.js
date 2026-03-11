/**
 * Continuous Action Analyzer
 *
 * Tracks every task execution, user action, and environmental parameter
 * to learn deterministic patterns and enforce them.
 *
 * Features:
 *   - Rolling window of action vectors for drift/pattern detection
 *   - Phi-scaled thresholds trigger auto-reconfig when determinism degrades
 *   - Learns optimal LLM params from execution history
 *   - Emits action:learned / action:drift / action:reconfig events
 *
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const crypto = require('crypto');
const EventEmitter = require('events');

const PHI = 1.6180339887;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;

const WINDOW_SIZE = 50;          // rolling window for pattern detection
const DRIFT_THRESHOLD = PSI_SQ;  // 0.382 — alert when uniqueness exceeds this
const LEARN_THRESHOLD = 10;      // min actions before learning kicks in

class ContinuousActionAnalyzer extends EventEmitter {

    constructor(opts = {}) {
        super();
        this._windowSize = opts.windowSize || WINDOW_SIZE;
        this._actions = [];            // rolling window of action records
        this._allActions = [];         // full history (capped at 10k)
        this._patterns = new Map();    // domain → learned pattern
        this._driftWindow = [];        // rolling output hash window
        this._stats = {
            totalActions: 0,
            learnedPatterns: 0,
            driftAlerts: 0,
            reconfigs: 0,
            avgConfidence: 0,
            avgLatency: 0,
        };
    }

    /**
     * Record a task execution action.
     * @param {Object} action - { taskId, domain, inputHash, outputHash, provider, model, latencyMs, confidence, simScore, battleWon, mcDeterminism }
     */
    record(action) {
        const entry = {
            ...action,
            ts: Date.now(),
            actionHash: crypto.createHash('sha256')
                .update(JSON.stringify(action))
                .digest('hex').slice(0, 16),
        };

        this._actions.push(entry);
        if (this._actions.length > this._windowSize) this._actions.shift();

        this._allActions.push(entry);
        if (this._allActions.length > 6765) this._allActions.shift(); // fib(20)

        this._stats.totalActions++;
        this._updateRunningStats(entry);

        // Check drift
        this._driftWindow.push(entry.outputHash);
        if (this._driftWindow.length > this._windowSize) this._driftWindow.shift();
        const driftResult = this._checkDrift();
        if (driftResult.drifting) {
            this._stats.driftAlerts++;
            this.emit('action:drift', { entry, ...driftResult });
        }

        // Learn patterns after threshold
        if (this._actions.length >= LEARN_THRESHOLD) {
            this._learnPatterns();
        }

        this.emit('action:recorded', entry);
        return entry;
    }

    /**
     * Record a user action (click, navigation, input, etc.)
     * @param {Object} userAction - { type, target, value, sessionId }
     */
    recordUserAction(userAction) {
        return this.record({
            taskId: `user-${userAction.type}`,
            domain: 'user-interaction',
            inputHash: crypto.createHash('sha256').update(JSON.stringify(userAction)).digest('hex').slice(0, 16),
            outputHash: 'user-action',
            provider: 'user',
            model: 'human',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...userAction,
        });
    }

    /**
     * Record an environmental parameter change.
     * @param {Object} envParam - { key, value, previousValue, source }
     */
    recordEnvironmental(envParam) {
        return this.record({
            taskId: `env-${envParam.key}`,
            domain: 'environmental',
            inputHash: crypto.createHash('sha256').update(`${envParam.key}=${envParam.value}`).digest('hex').slice(0, 16),
            outputHash: crypto.createHash('sha256').update(String(envParam.value)).digest('hex').slice(0, 16),
            provider: envParam.source || 'system',
            model: 'env',
            latencyMs: 0,
            confidence: 1.0,
            simScore: 1.0,
            battleWon: true,
            mcDeterminism: 1.0,
            ...envParam,
        });
    }

    // ─── Drift Detection ──────────────────────────────────────────────────

    _checkDrift() {
        if (this._driftWindow.length < 5) {
            return { drifting: false, driftScore: 0, prediction: 'insufficient_data' };
        }

        const unique = new Set(this._driftWindow).size;
        const driftScore = (unique - 1) / (this._driftWindow.length - 1);

        const drifting = driftScore > DRIFT_THRESHOLD;
        const prediction = driftScore === 0 ? 'perfectly_deterministic' :
            driftScore <= PSI_SQ ? 'stable' :
                driftScore <= PSI ? 'moderate_drift' : 'severe_drift';

        if (drifting) {
            const reconfig = this._generateReconfig(driftScore);
            this._stats.reconfigs++;
            this.emit('action:reconfig', reconfig);
        }

        return { drifting, driftScore: +driftScore.toFixed(4), prediction, windowSize: this._driftWindow.length };
    }

    // ─── Pattern Learning ─────────────────────────────────────────────────

    _learnPatterns() {
        // Group recent actions by domain
        const byDomain = {};
        for (const a of this._actions) {
            if (!byDomain[a.domain]) byDomain[a.domain] = [];
            byDomain[a.domain].push(a);
        }

        for (const [domain, actions] of Object.entries(byDomain)) {
            if (actions.length < 3) continue;

            const avgConf = actions.reduce((s, a) => s + (a.confidence || 0), 0) / actions.length;
            const avgLat = actions.reduce((s, a) => s + (a.latencyMs || 0), 0) / actions.length;
            const avgSim = actions.reduce((s, a) => s + (a.simScore || 0), 0) / actions.length;
            const avgMC = actions.reduce((s, a) => s + (a.mcDeterminism || 0), 0) / actions.length;
            const winRate = actions.filter(a => a.battleWon).length / actions.length;

            // Find most common provider/model
            const providerCounts = {};
            for (const a of actions) {
                const key = `${a.provider}/${a.model}`;
                providerCounts[key] = (providerCounts[key] || 0) + 1;
            }
            const bestProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];

            const pattern = {
                domain,
                count: actions.length,
                avgConfidence: +avgConf.toFixed(4),
                avgLatencyMs: +avgLat.toFixed(0),
                avgSimScore: +avgSim.toFixed(4),
                avgMCDeterminism: +avgMC.toFixed(4),
                winRate: +winRate.toFixed(4),
                bestProviderModel: bestProvider ? bestProvider[0] : 'unknown',
                recommendedConfig: {
                    temperature: avgMC >= PSI ? 0 : 0.1,
                    seed: 42,
                    top_p: 1,
                    preferredModel: bestProvider ? bestProvider[0] : null,
                },
                learnedAt: Date.now(),
            };

            const isNew = !this._patterns.has(domain);
            this._patterns.set(domain, pattern);
            if (isNew) {
                this._stats.learnedPatterns++;
                this.emit('action:learned', pattern);
            }
        }
    }

    // ─── Reconfiguration ──────────────────────────────────────────────────

    _generateReconfig(driftScore) {
        const steps = [];

        if (driftScore > PSI) {
            steps.push('CRITICAL: Lock all LLM params — temperature=0, seed=42, top_p=1');
            steps.push('Switch to single-model mode (disable racing) to reduce variance');
            steps.push('Enable full replay cache to serve deterministic responses');
        } else if (driftScore > PSI_SQ) {
            steps.push('WARNING: Increase MC sampling iterations to detect boundary');
            steps.push('Tighten CSL confidence threshold to φ⁻¹ (0.618)');
            steps.push('Enable output comparison logging for drift root-cause analysis');
        }

        return {
            action: driftScore > PSI ? 'lock_deterministic' : 'stabilize',
            driftScore: +driftScore.toFixed(4),
            steps,
            newConfig: {
                temperature: 0,
                seed: 42,
                top_p: 1,
                mcIterations: Math.ceil(5 * (1 + driftScore)),
                cslThreshold: driftScore > PSI ? PSI : PSI_SQ,
            },
            ts: Date.now(),
        };
    }

    // ─── Public API ─────────────────────────────────────────────────────

    /** Get current stats */
    getStats() {
        return { ...this._stats };
    }

    /** Get learned patterns for all domains */
    getPatterns() {
        return Object.fromEntries(this._patterns);
    }

    /** Get pattern for a specific domain */
    getPattern(domain) {
        return this._patterns.get(domain) || null;
    }

    /** Get recent actions */
    getRecentActions(n = 10) {
        return this._actions.slice(-n);
    }

    /** Get comprehensive determinism report */
    getDeterminismReport() {
        const patterns = this.getPatterns();
        const domains = Object.keys(patterns);
        const avgDeterminism = domains.length > 0
            ? domains.reduce((s, d) => s + patterns[d].avgMCDeterminism, 0) / domains.length
            : 0;

        return {
            totalActions: this._stats.totalActions,
            learnedDomains: domains.length,
            avgDeterminism: +avgDeterminism.toFixed(4),
            driftAlerts: this._stats.driftAlerts,
            reconfigs: this._stats.reconfigs,
            patterns,
            recommendation: avgDeterminism >= PSI ? 'System is deterministic — maintain current config' :
                avgDeterminism >= PSI_SQ ? 'Marginal determinism — consider tightening params' :
                    'Low determinism — lock all params and enable replay cache',
        };
    }

    /** Force reconfigure based on current state */
    forceReconfig() {
        const drift = this._checkDrift();
        if (!drift.drifting) {
            return { action: 'none', reason: 'No drift detected — system is stable' };
        }
        return this._generateReconfig(drift.driftScore);
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    _updateRunningStats(entry) {
        const n = this._stats.totalActions;
        this._stats.avgConfidence = ((this._stats.avgConfidence * (n - 1)) + (entry.confidence || 0)) / n;
        this._stats.avgLatency = ((this._stats.avgLatency * (n - 1)) + (entry.latencyMs || 0)) / n;
    }
}

module.exports = { ContinuousActionAnalyzer, WINDOW_SIZE, DRIFT_THRESHOLD, LEARN_THRESHOLD, PHI, PSI, PSI_SQ };

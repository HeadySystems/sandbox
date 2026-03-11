'use strict';

/**
 * heady-drift-analyzer-tool.js — MCP Tool Handler
 *
 * Continuous Action System + Drift Analyzer
 * Wraps CSLConfidenceGate as MCP tool with execution recording,
 * drift detection, pattern learning, and auto-reconfiguration.
 *
 * © 2026 Heady™Systems Inc.
 */

const crypto = require('crypto');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;
const PSI_SQ = PSI * PSI;

// ─── Continuous Action Recorder ──────────────────────────────────────────────

class ContinuousActionRecorder {
    constructor(config = {}) {
        this.driftThreshold = config.driftThreshold || PSI_SQ;
        this.windowSize = config.windowSize || 21; // Fibonacci-8
        this.maxHistory = config.maxHistory || 1000;

        this._executions = [];
        this._driftWindow = [];
        this._patterns = new Map();
        this._domainStats = {};
        this._driftAlerts = 0;
        this._autoReconfigs = 0;
    }

    /**
     * Record a task execution.
     */
    record(execution) {
        const entry = {
            id: crypto.randomUUID().slice(0, 8),
            inputHash: execution.inputHash || this._hash(JSON.stringify(execution.input || '')),
            outputHash: execution.outputHash || this._hash(JSON.stringify(execution.output || '')),
            provider: execution.provider || 'unknown',
            model: execution.model || 'unknown',
            domain: execution.domain || 'general',
            latencyMs: execution.latencyMs || 0,
            confidence: execution.confidence || 0,
            timestamp: Date.now(),
        };

        this._executions.push(entry);
        if (this._executions.length > this.maxHistory) this._executions.shift();

        // Update domain stats
        if (!this._domainStats[entry.domain]) {
            this._domainStats[entry.domain] = { count: 0, totalLatency: 0, avgConfidence: 0, bestModel: null };
        }
        const ds = this._domainStats[entry.domain];
        ds.count++;
        ds.totalLatency += entry.latencyMs;
        ds.avgConfidence = (ds.avgConfidence * (ds.count - 1) + entry.confidence) / ds.count;

        // Track drift
        const drift = this.trackDrift(entry.outputHash);
        entry.drifting = drift.drifting;

        return { ok: true, recorded: entry, drift };
    }

    /**
     * Track drift using rolling window of output hashes.
     */
    trackDrift(outputHash) {
        this._driftWindow.push(outputHash);
        if (this._driftWindow.length > this.windowSize) this._driftWindow.shift();

        const uniqueHashes = new Set(this._driftWindow).size;
        const driftScore = this._driftWindow.length > 1
            ? uniqueHashes / this._driftWindow.length
            : 0;

        const drifting = driftScore > this.driftThreshold;
        if (drifting) this._driftAlerts++;

        return {
            drifting,
            driftScore: +driftScore.toFixed(4),
            threshold: +this.driftThreshold.toFixed(4),
            windowSize: this._driftWindow.length,
            uniqueOutputs: uniqueHashes,
            prediction: drifting
                ? 'OUTPUT_DIVERGENCE — determinism degrading'
                : 'STABLE — outputs consistent',
        };
    }

    /**
     * Pre-flight confidence check.
     */
    preFlightCheck(input) {
        const domain = input.domain || 'general';
        const varCount = Object.keys(input.variables || {}).length;

        // φ-scaled confidence
        const completeness = Math.min(1, varCount / 4);
        const domainBonus = this._domainStats[domain] ? PSI * 0.5 : 0;
        const historicalConfidence = this._domainStats[domain]?.avgConfidence || 0.5;

        const confidence = Math.min(1,
            completeness * PSI + domainBonus + historicalConfidence * PSI_SQ
        );

        const decision = confidence > PSI ? 'EXECUTE' :
            confidence > PSI_SQ ? 'CAUTIOUS' : 'HALT';

        return { decision, confidence: +confidence.toFixed(4), domain, completeness };
    }

    /**
     * Auto-reconfigure when determinism degrades.
     */
    reconfigure(diagnostics = {}) {
        this._autoReconfigs++;
        const actions = [];

        if (diagnostics.drifting) {
            actions.push('CLEAR_DRIFT_WINDOW');
            this._driftWindow = [];
        }

        if (diagnostics.confidence < PSI_SQ) {
            actions.push('INCREASE_MC_ITERATIONS');
            actions.push('LOWER_TEMPERATURE');
        }

        if (diagnostics.domain) {
            const ds = this._domainStats[diagnostics.domain];
            if (ds && ds.avgConfidence < PSI_SQ) {
                actions.push(`RETRAIN_DOMAIN:${diagnostics.domain}`);
            }
        }

        return {
            reconfigured: true,
            actions,
            newConfig: {
                temperature: 0,
                seed: 42,
                driftThreshold: this.driftThreshold,
                windowSize: this.windowSize,
            },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Learn optimal parameters per domain from execution history.
     */
    learnPatterns() {
        const patterns = {};

        for (const [domain, stats] of Object.entries(this._domainStats)) {
            const domainExecutions = this._executions.filter(e => e.domain === domain);
            const modelCounts = {};
            domainExecutions.forEach(e => { modelCounts[e.model] = (modelCounts[e.model] || 0) + 1; });

            const bestModel = Object.entries(modelCounts)
                .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

            patterns[domain] = {
                executions: stats.count,
                avgLatencyMs: stats.count > 0 ? +(stats.totalLatency / stats.count).toFixed(1) : 0,
                avgConfidence: +stats.avgConfidence.toFixed(4),
                bestModel,
                optimalParams: {
                    temperature: 0,
                    seed: 42,
                    phiScaledTimeout: +(Math.pow(PHI, 3) * 1000).toFixed(0), // ~4236ms
                },
            };
        }

        return patterns;
    }

    /**
     * Get comprehensive stats.
     */
    getStats() {
        const total = this._executions.length;
        const avgLatency = total > 0
            ? +(this._executions.reduce((s, e) => s + e.latencyMs, 0) / total).toFixed(1)
            : 0;
        const avgConfidence = total > 0
            ? +(this._executions.reduce((s, e) => s + e.confidence, 0) / total).toFixed(4)
            : 0;

        return {
            totalExecutions: total,
            avgLatencyMs: avgLatency,
            avgConfidence,
            driftAlerts: this._driftAlerts,
            autoReconfigurations: this._autoReconfigs,
            domains: Object.keys(this._domainStats).length,
            domainStats: this._domainStats,
            driftWindow: {
                size: this._driftWindow.length,
                maxSize: this.windowSize,
                uniqueHashes: new Set(this._driftWindow).size,
            },
        };
    }

    _hash(str) {
        return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
    }
}

// ─── MCP Handler ──────────────────────────────────────────────────────────────

const recorder = new ContinuousActionRecorder();

async function handler(params) {
    const { action = 'stats', input, output, domain, provider, model, latencyMs, confidence } = params;

    switch (action) {
        case 'record':
            return recorder.record({
                input, output, domain, provider, model, latencyMs, confidence,
                inputHash: input ? recorder._hash(JSON.stringify(input)) : undefined,
                outputHash: output ? recorder._hash(JSON.stringify(output)) : undefined
            });

        case 'check':
            return { ok: true, action: 'check', ...recorder.preFlightCheck(params) };

        case 'track':
            if (!params.output_hash) return { ok: false, error: 'output_hash required' };
            return { ok: true, action: 'track', ...recorder.trackDrift(params.output_hash) };

        case 'reconfigure':
            return { ok: true, action: 'reconfigure', ...recorder.reconfigure(params) };

        case 'learn':
            return { ok: true, action: 'learn', patterns: recorder.learnPatterns() };

        case 'stats':
            return { ok: true, action: 'stats', ...recorder.getStats() };

        default:
            return { ok: false, error: `Unknown action: ${action}. Use: record, check, track, reconfigure, learn, stats` };
    }
}

module.exports = {
    name: 'heady_drift_analyzer',
    description: 'Continuous action recording + drift detection — track outputs, detect divergence, auto-reconfigure',
    category: 'intelligence',
    handler,
    ContinuousActionRecorder,
    inputSchema: {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['record', 'check', 'track', 'reconfigure', 'learn', 'stats'] },
            input: { type: 'object', description: 'Execution input' },
            output: { type: 'object', description: 'Execution output' },
            output_hash: { type: 'string', description: 'Output hash for drift tracking' },
            domain: { type: 'string', description: 'Task domain' },
            provider: { type: 'string', description: 'AI provider' },
            model: { type: 'string', description: 'Model used' },
            latencyMs: { type: 'number', description: 'Execution latency' },
            confidence: { type: 'number', description: 'Confidence score' },
        },
        required: ['action'],
    },
};

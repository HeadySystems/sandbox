/**
 * CSL Service Integration — Wires Continuous Semantic Logic into services
 *
 * Provides a lightweight façade that services import to route decisions
 * through CSL gates instead of discrete if/else.  The engine singleton
 * is shared across the process to avoid redundant Float64Array allocations.
 *
 * Usage in any service:
 *   const { csl, gate, decide, consensus } = require('./csl-service-integration');
 *   const { activation } = gate(inputVec, topicVec);      // replaces: if (topic === 'foo')
 *   const choice = decide(candidates, queryVec);           // replaces: switch/case
 *   const agreed = consensus(agentVectors);                // replaces: majority vote
 *
 * © 2026 Heady™Systems Inc. — Proprietary
 * @module csl-service-integration
 */

'use strict';

const logger = require('../utils/logger');

// ── Lazy-load CSL engine (try/require pattern) ────────────────────────────
let _engine = null;

function getEngine() {
    if (_engine) return _engine;
    try {
        const { CSLEngine } = require('../core/csl-engine/csl-engine');
        _engine = new CSLEngine({ dim: 1536, normalizeInputs: true });
        logger.logNodeActivity('CSL', '  ✓ CSL Engine singleton: ACTIVE (1536-dim, phi-thresholds)');
    } catch (err) {
        // Fallback: lightweight compatibility shim
        logger.logNodeActivity('CSL', `  ⚠ CSL Engine unavailable, using shim: ${err.message}`);
        _engine = {
            AND(a, b) { return cosine(a, b); },
            OR(a, b) { return normalize(add(a, b)); },
            GATE(input, gateVec, threshold = 0.5) {
                const cos = cosine(input, gateVec);
                return { activation: cos >= (threshold || 0.5) ? 1 : 0, cosScore: cos };
            },
            CONSENSUS(vecs) {
                const dim = vecs[0].length;
                const sum = new Float64Array(dim);
                for (const v of vecs) for (let i = 0; i < dim; i++) sum[i] += v[i];
                const n = Math.sqrt(sum.reduce((s, x) => s + x * x, 0));
                return { consensus: n > 1e-10 ? sum.map(x => x / n) : sum, strength: n / vecs.length };
            },
            _stats: { operationCount: 0, degenerateVectors: 0, gateActivations: 0 }
        };
    }
    return _engine;
}

// Shim helpers
function cosine(a, b) {
    let dot = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
    nA = Math.sqrt(nA); nB = Math.sqrt(nB);
    return (nA < 1e-10 || nB < 1e-10) ? 0 : dot / (nA * nB);
}
function add(a, b) { const r = new Float64Array(a.length); for (let i = 0; i < a.length; i++) r[i] = a[i] + b[i]; return r; }
function normalize(a) { const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0)); return n < 1e-10 ? a : a.map(x => x / n); }

// ── Public API ────────────────────────────────────────────────────────────

/**
 * CSL gate — replaces if/else on semantic similarity
 * @param {Float64Array} input  - The input vector
 * @param {Float64Array} topic  - The gate topic vector
 * @param {number} [threshold]  - Optional override (default: engine default)
 * @returns {{ activation: number, cosScore: number }}
 */
function gate(input, topic, threshold) {
    return getEngine().GATE(input, topic, threshold, 'soft');
}

/**
 * decide — rank candidates by cosine similarity to query (replaces switch/case)
 * @param {Array<{ vector: Float64Array, label: string }>} candidates
 * @param {Float64Array} queryVec
 * @returns {{ label: string, score: number }[]}
 */
function decide(candidates, queryVec) {
    const engine = getEngine();
    return candidates
        .map(c => ({ label: c.label, score: engine.AND(queryVec, c.vector) }))
        .sort((a, b) => b.score - a.score);
}

/**
 * consensus — aggregate multiple agent vectors (replaces majority vote)
 * @param {Float64Array[]} vectors
 * @param {number[]} [weights]
 * @returns {{ consensus: Float64Array, strength: number }}
 */
function consensus(vectors, weights) {
    return getEngine().CONSENSUS(vectors, weights);
}

/**
 * stats — return engine operation counters
 */
function stats() {
    return getEngine()._stats || {};
}

module.exports = {
    get csl() { return getEngine(); },
    gate,
    decide,
    consensus,
    stats,
    getEngine,
};

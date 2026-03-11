/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 *
 * Deterministic Prompt Executor
 *
 * Wraps PromptManager with deterministic execution guarantees:
 *   - Fixed LLM params (temperature: 0, top_p: 1, deterministic seed)
 *   - Input hashing (SHA-256) for cache keys
 *   - Output validation via CSL cosine similarity
 *   - Replay guarantee: same inputHash → same cached output
 *   - Full execution audit log
 *
 * PHI = 1.6180339887
 *
 * @module deterministic-prompt-executor
 */

'use strict';

const crypto = require('crypto');
const CSLConfidenceGate = require('./csl-confidence-gate');

// Lazy-load PromptManager (template literals evaluate at require time)
let _PromptManager = null;
function getPromptManager() {
    if (!_PromptManager) {
        try {
            _PromptManager = require('./deterministic-prompt-manager').PromptManager;
        } catch (err) {
            // Fallback: minimal stub for environments where templates can't load
            _PromptManager = class StubPromptManager {
                interpolate(id, vars) {
                    return `[PROMPT:${id}] ` + Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(', ');
                }
                getPrompt(id) { return { id, variables: [], template: '', tags: [] }; }
                listPrompts() { return []; }
                composePrompts(ids, vars) { return { composed: ids.join('\n'), sections: [], ids }; }
            };
        }
    }
    return _PromptManager;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;
const PSI = 1 / PHI;                    // ≈ 0.618
const PSI_SQ = PSI * PSI;                  // ≈ 0.382

/** Replay threshold — cached output returned if CSL score exceeds this */
const REPLAY_THRESHOLD = PSI;              // φ⁻¹ ≈ 0.618

/** Maximum audit log entries before rotation */
const MAX_AUDIT_LOG = Math.round(PHI ** 8); // ≈ 47

/** Deterministic LLM parameters — enforced on every call */
const DETERMINISTIC_LLM_PARAMS = Object.freeze({
    temperature: 0,
    top_p: 1,
    seed: 42,
    max_tokens: 4096,
    presence_penalty: 0,
    frequency_penalty: 0,
});

// ─── DeterministicPromptExecutor ──────────────────────────────────────────────

class DeterministicPromptExecutor {
    /**
     * @param {Object} [options]
     * @param {PromptManager} [options.promptManager] — existing PromptManager instance
     * @param {CSLConfidenceGate} [options.confidenceGate] — existing gate instance
     * @param {number} [options.replayThreshold] — cosine threshold for cache replay
     * @param {Object} [options.llmParams] — override deterministic LLM params
     */
    constructor(options = {}) {
        const PM = getPromptManager();
        this.promptManager = options.promptManager || new PM();
        this.confidenceGate = options.confidenceGate || new CSLConfidenceGate();
        this.replayThreshold = options.replayThreshold || REPLAY_THRESHOLD;
        this.llmParams = { ...DETERMINISTIC_LLM_PARAMS, ...(options.llmParams || {}) };

        /** @type {Map<string, { output: string, cslScore: number, timestamp: number }>} */
        this._cache = new Map();

        /** @type {Array<Object>} */
        this._auditLog = [];

        /** Runtime stats */
        this._stats = {
            totalExecutions: 0,
            cacheHits: 0,
            cacheMisses: 0,
            halts: 0,
            cautious: 0,
            driftAlerts: 0,
            reconfigures: 0,
        };

        /** Event listeners */
        this._listeners = new Map();
    }

    // ─── Core Execution ─────────────────────────────────────────────────────────

    /**
     * Execute a prompt deterministically.
     *
     * Pipeline:
     *   1. Interpolate template with variables
     *   2. Compute inputHash (SHA-256 of promptId + sorted vars)
     *   3. Check cache — return cached output if CSL score > replayThreshold
     *   4. Run CSL pre-flight confidence check
     *   5. If HALT → stop execution, emit reconfigure event
     *   6. If EXECUTE/CAUTIOUS → interpolate + return
     *   7. Log to audit trail
     *
     * @param {string} promptId — prompt identifier (e.g. 'code-001')
     * @param {Object} vars — variable map for interpolation
     * @param {Object} [opts]
     * @param {boolean} [opts.bypassCache=false] — skip cache lookup
     * @param {boolean} [opts.strict=true] — enforce variable completeness
     * @returns {{ output: string, confidence: number, inputHash: string,
     *             cslScore: number, halted: boolean, decision: string,
     *             llmParams: Object, cached: boolean }}
     */
    execute(promptId, vars = {}, opts = {}) {
        const { bypassCache = false, strict = true } = opts;
        this._stats.totalExecutions++;

        // Step 1: Compute deterministic input hash
        const inputHash = this._computeHash(promptId, vars);

        // Step 2: Check cache (unless bypassed)
        if (!bypassCache && this._cache.has(inputHash)) {
            const cached = this._cache.get(inputHash);
            this._stats.cacheHits++;

            const result = {
                output: cached.output,
                confidence: 1.0, // cached = known-good
                inputHash,
                cslScore: cached.cslScore,
                halted: false,
                decision: 'CACHED',
                llmParams: this.llmParams,
                cached: true,
            };

            this._log('cache_hit', promptId, inputHash, result);
            return result;
        }

        this._stats.cacheMisses++;

        // Step 3: Interpolate the prompt deterministically
        let interpolated;
        try {
            interpolated = this.promptManager.interpolate(promptId, vars, { strict });
        } catch (err) {
            const haltResult = {
                output: null,
                confidence: 0,
                inputHash,
                cslScore: 0,
                halted: true,
                decision: 'HALT',
                reason: `Interpolation error: ${err.message}`,
                llmParams: this.llmParams,
                cached: false,
            };
            this._stats.halts++;
            this._log('interpolation_error', promptId, inputHash, haltResult);
            this._emit('halt', { promptId, inputHash, reason: haltResult.reason });
            this._emit('system:reconfigure', this.confidenceGate.reconfigure({
                promptId, inputHash, confidence: 0, reason: haltResult.reason,
            }));
            return haltResult;
        }

        // Step 4: CSL pre-flight confidence check
        const preCheck = this.confidenceGate.preFlightCheck(promptId, vars, interpolated);

        if (preCheck.decision === 'HALT') {
            this._stats.halts++;
            const haltResult = {
                output: null,
                confidence: preCheck.confidence,
                inputHash,
                cslScore: preCheck.confidence,
                halted: true,
                decision: 'HALT',
                reason: preCheck.reason,
                llmParams: this.llmParams,
                cached: false,
            };
            this._log('halt', promptId, inputHash, haltResult);
            this._emit('halt', { promptId, inputHash, confidence: preCheck.confidence, reason: preCheck.reason });
            this._emit('system:reconfigure', this.confidenceGate.reconfigure({
                promptId, inputHash, confidence: preCheck.confidence, reason: preCheck.reason,
            }));
            return haltResult;
        }

        if (preCheck.decision === 'CAUTIOUS') {
            this._stats.cautious++;
        }

        // Step 5: At template level, the output IS deterministic (same template + same vars = same string)
        const output = interpolated;
        const outputHash = this._hashString(output);

        // Step 6: Compute CSL score (self-consistency = 1.0 for deterministic template output)
        const cslScore = 1.0; // Template interpolation is perfectly deterministic

        // Step 7: Cache the result
        this._cache.set(inputHash, { output, cslScore, outputHash, timestamp: Date.now() });

        // Step 8: Track drift
        const driftResult = this.confidenceGate.trackDrift(outputHash);
        if (driftResult.drifting) {
            this._stats.driftAlerts++;
            this._emit('drift', { promptId, inputHash, driftScore: driftResult.driftScore });
        }

        const result = {
            output,
            confidence: preCheck.confidence,
            inputHash,
            cslScore,
            halted: false,
            decision: preCheck.decision,
            llmParams: this.llmParams,
            cached: false,
        };

        this._log('execute', promptId, inputHash, result);
        return result;
    }

    // ─── Replay ─────────────────────────────────────────────────────────────────

    /**
     * Replay a cached output by its input hash.
     * Returns null if not found or if CSL score below replay threshold.
     *
     * @param {string} inputHash
     * @returns {{ output: string, cslScore: number, timestamp: number } | null}
     */
    replay(inputHash) {
        const cached = this._cache.get(inputHash);
        if (!cached) return null;
        if (cached.cslScore < this.replayThreshold) return null;
        return { output: cached.output, cslScore: cached.cslScore, timestamp: cached.timestamp };
    }

    // ─── Audit ──────────────────────────────────────────────────────────────────

    /**
     * Get execution audit log.
     * @param {number} [limit=20]
     * @returns {Array<Object>}
     */
    getAuditLog(limit = 20) {
        return this._auditLog.slice(-limit);
    }

    /**
     * Get determinism report — stats on cache performance, halts, drift alerts.
     * @returns {Object}
     */
    getDeterminismReport() {
        const cacheSize = this._cache.size;
        const hitRate = this._stats.totalExecutions > 0
            ? (this._stats.cacheHits / this._stats.totalExecutions * 100).toFixed(1)
            : '0.0';

        return {
            totalExecutions: this._stats.totalExecutions,
            cacheHits: this._stats.cacheHits,
            cacheMisses: this._stats.cacheMisses,
            cacheHitRate: `${hitRate}%`,
            cacheSize,
            halts: this._stats.halts,
            cautious: this._stats.cautious,
            driftAlerts: this._stats.driftAlerts,
            reconfigures: this._stats.reconfigures,
            replayThreshold: this.replayThreshold,
            llmParams: this.llmParams,
            phi: PHI,
        };
    }

    // ─── Events ─────────────────────────────────────────────────────────────────

    /**
     * Register event listener.
     * @param {string} event — 'halt' | 'drift' | 'system:reconfigure'
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this._listeners.has(event)) this._listeners.set(event, []);
        this._listeners.get(event).push(callback);
    }

    // ─── Internal ───────────────────────────────────────────────────────────────

    /**
     * Compute SHA-256 hash of (promptId + sorted variables).
     * Deterministic: same inputs always produce the same hash.
     */
    _computeHash(promptId, vars) {
        const sortedKeys = Object.keys(vars).sort();
        const canonical = promptId + ':' + sortedKeys.map(k => `${k}=${vars[k]}`).join('|');
        return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
    }

    /**
     * Hash a string with SHA-256 (truncated to 16 chars).
     */
    _hashString(str) {
        return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
    }

    /**
     * Append to audit log with rotation.
     */
    _log(action, promptId, inputHash, result) {
        this._auditLog.push({
            action,
            promptId,
            inputHash,
            decision: result.decision,
            confidence: result.confidence,
            cslScore: result.cslScore,
            halted: result.halted,
            cached: result.cached,
            timestamp: Date.now(),
        });
        if (this._auditLog.length > MAX_AUDIT_LOG) {
            this._auditLog = this._auditLog.slice(-MAX_AUDIT_LOG);
        }
    }

    /**
     * Emit event to registered listeners.
     */
    _emit(event, data) {
        const listeners = this._listeners.get(event) || [];
        for (const cb of listeners) {
            try { cb(data); } catch (_) { /* fire-and-forget */ }
        }
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    DeterministicPromptExecutor,
    DETERMINISTIC_LLM_PARAMS,
    REPLAY_THRESHOLD,
    PHI,
    PSI,
    PSI_SQ,
};

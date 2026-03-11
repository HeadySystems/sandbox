'use strict';

/**
 * heady-prompt-executor-tool.js — MCP Tool Handler
 *
 * Exposes the Deterministic Prompt System (64 prompts × 8 domains)
 * as an MCP-compatible tool with CSL confidence gating.
 *
 * © 2026 Heady™Systems Inc.
 */

const crypto = require('crypto');

const PHI = 1.618033988749895;
const PSI = 1 / PHI;

// ─── Prompt Catalogue (lightweight summary for MCP) ──────────────────────────

const DOMAINS = ['code', 'deploy', 'research', 'security', 'memory', 'orchestration', 'creative', 'trading'];

// Build a lightweight prompt index from the master catalogue
let _catalogueCache = null;

function loadCatalogue() {
    if (_catalogueCache) return _catalogueCache;
    try {
        const mgr = require('../../prompts/deterministic-prompt-manager');
        const PM = mgr.PromptManager || mgr;
        const instance = typeof PM === 'function' ? new PM() : PM;
        _catalogueCache = instance;
        return _catalogueCache;
    } catch {
        // Fallback: return a stub catalogue
        return {
            listPrompts: () => DOMAINS.flatMap((d, di) =>
                Array.from({ length: 8 }, (_, i) => ({
                    id: `${d}-${String(i + 1).padStart(3, '0')}`,
                    domain: d,
                    name: `${d.charAt(0).toUpperCase() + d.slice(1)} Prompt ${i + 1}`,
                }))
            ),
            getPrompt: (id) => ({ id, domain: id.split('-')[0], name: id }),
            interpolate: (id, vars) => `[Prompt ${id} with ${Object.keys(vars).length} variables]`,
        };
    }
}

// ─── CSL Confidence Gate (lightweight) ───────────────────────────────────────

function computeConfidence(promptId, vars) {
    const domain = promptId.split('-')[0];
    const domainKnown = DOMAINS.includes(domain);
    const varCount = Object.keys(vars).length;

    // φ-scaled confidence from variable completeness + domain recognition
    const completeness = Math.min(1, varCount / 4) * PSI + (domainKnown ? PSI : 0);
    const confidence = Math.min(1, completeness);

    if (confidence > PSI) return { decision: 'EXECUTE', confidence, reason: 'High confidence' };
    if (confidence > PSI * PSI) return { decision: 'CAUTIOUS', confidence, reason: 'Moderate confidence — missing context' };
    return { decision: 'HALT', confidence, reason: 'Low confidence — insufficient input' };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * MCP Tool Handler for Prompt Executor
 *
 * @param {Object} params
 * @param {string} params.action - 'execute' | 'list' | 'replay' | 'report'
 * @param {string} [params.prompt_id] - Prompt ID (e.g. 'code-001')
 * @param {Object} [params.variables] - Template variables
 * @param {string} [params.domain] - Filter by domain
 * @param {string} [params.input_hash] - For replay
 * @returns {Object}
 */
async function handler(params) {
    const { action = 'list', prompt_id, variables = {}, domain, input_hash } = params;
    const catalogue = loadCatalogue();

    switch (action) {
        case 'list': {
            let prompts = catalogue.listPrompts();
            if (domain) prompts = prompts.filter(p => p.domain === domain);
            return {
                ok: true,
                action: 'list',
                total: prompts.length,
                domains: DOMAINS,
                prompts: prompts.map(p => ({ id: p.id, domain: p.domain, name: p.name })),
            };
        }

        case 'execute': {
            if (!prompt_id) return { ok: false, error: 'prompt_id required' };

            // CSL pre-flight
            const gate = computeConfidence(prompt_id, variables);
            if (gate.decision === 'HALT') {
                return {
                    ok: false,
                    action: 'execute',
                    prompt_id,
                    halted: true,
                    confidence: gate.confidence,
                    reason: gate.reason,
                    suggestion: 'Provide more variables or check prompt_id',
                };
            }

            // Interpolate
            const interpolated = catalogue.interpolate
                ? catalogue.interpolate(prompt_id, variables)
                : `[Prompt ${prompt_id}]`;

            // Compute deterministic hash
            const inputHash = crypto.createHash('sha256')
                .update(prompt_id + JSON.stringify(variables, Object.keys(variables).sort()))
                .digest('hex')
                .slice(0, 16);

            return {
                ok: true,
                action: 'execute',
                prompt_id,
                input_hash: inputHash,
                confidence: gate.confidence,
                decision: gate.decision,
                interpolated,
                llm_params: {
                    temperature: 0,
                    top_p: 1,
                    seed: 42,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                },
                timestamp: new Date().toISOString(),
            };
        }

        case 'replay': {
            if (!input_hash) return { ok: false, error: 'input_hash required for replay' };
            return {
                ok: true,
                action: 'replay',
                input_hash,
                cached: false,
                note: 'Cache lookup not yet connected — wire to DeterministicPromptExecutor cache',
            };
        }

        case 'report': {
            return {
                ok: true,
                action: 'report',
                total_prompts: 64,
                domains: DOMAINS.length,
                prompts_per_domain: 8,
                phi_constants: { PHI, PSI, PSI_SQ: PSI * PSI },
                thresholds: { execute: PSI, cautious: PSI * PSI, halt: 0 },
            };
        }

        default:
            return { ok: false, error: `Unknown action: ${action}. Use: execute, list, replay, report` };
    }
}

module.exports = {
    name: 'heady_prompt_executor',
    description: 'Deterministic prompt execution — 64 prompts × 8 domains with CSL confidence gating',
    category: 'intelligence',
    handler,
    inputSchema: {
        type: 'object',
        properties: {
            action: { type: 'string', enum: ['execute', 'list', 'replay', 'report'], description: 'Operation' },
            prompt_id: { type: 'string', description: 'Prompt ID (e.g. code-001, trading-003)' },
            variables: { type: 'object', description: 'Template variables' },
            domain: { type: 'string', enum: DOMAINS, description: 'Filter by domain' },
            input_hash: { type: 'string', description: 'Input hash for replay' },
        },
        required: ['action'],
    },
};

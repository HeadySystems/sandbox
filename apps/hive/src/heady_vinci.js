// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: apps/hive/src/heady_vinci.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const crypto = require('crypto');
const determinism = require('./determinism');

const LENSES = [
    { name: 'Minimalist', focus: 'smallest change that works', tags: ['minimal'] },
    { name: 'Systems', focus: 'clear boundaries and state flows', tags: ['architecture'] },
    { name: 'Trust-First', focus: 'auditability, least privilege, safe defaults', tags: ['security'] },
    { name: 'Observability', focus: 'high signal lens events and easy debugging', tags: ['monitoring'] },
    { name: 'Performance', focus: 'low overhead, throttled loops, bounded state', tags: ['performance'] },
    { name: 'Extensibility', focus: 'future-proof hooks and clean interfaces', tags: ['extensibility'] },
    { name: 'Testing', focus: 'smoke checks and regression protection', tags: ['testing'] },
    { name: 'Wildcard', focus: 'unconventional but potentially powerful approach', tags: ['wildcard'] }
];

const MODES = ['REWRITE', 'PLAN', 'RISKS', 'ACCEPTANCE'];

function normalizeInstruction(instruction) {
    return String(instruction || '').trim();
}

function stableHash(str) {
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 12);
}

function pickLens(index) {
    return LENSES[index % LENSES.length];
}

function pickMode(index) {
    return MODES[index % MODES.length];
}

function buildText(instruction, lens, mode) {
    if (!instruction) {
        return `(${lens.name}) Provide a concrete instruction to generate variations.`;
    }

    if (mode === 'PLAN') {
        return `(${lens.name}) Plan for: ${instruction} | Define interfaces; implement core; integrate; add safety/observability; validate with a smoke run.`;
    }

    if (mode === 'RISKS') {
        return `(${lens.name}) Risks for: ${instruction} | Shared-state races; unbounded output; unclear triggers; mitigations: separate state, caps, throttles, explicit enable flags.`;
    }

    if (mode === 'ACCEPTANCE') {
        return `(${lens.name}) Acceptance for: ${instruction} | Produces distinct variations; retrievable via API; emits lens events; bounded storage; compatible with existing task pipeline.`;
    }

    return `(${lens.name}) ${instruction} | Focus: ${lens.focus}.`;
}

function nextVariation(instruction, existingCount) {
    const clean = normalizeInstruction(instruction);
    const seed = stableHash(clean);
    const lens = pickLens(existingCount);
    const mode = pickMode(existingCount);
    const text = buildText(clean, lens, mode);

    return {
        id: determinism.isDeterministic() ? `${seed}-${existingCount}` : `${Date.now()}-${seed}-${existingCount}`,
        timestamp: new Date().toISOString(),
        lens: lens.name,
        mode,
        tags: lens.tags,
        text
    };
}

module.exports = {
    lenses: () => LENSES.map(l => l.name),
    nextVariation
};

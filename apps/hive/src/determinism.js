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
// ║  FILE: apps/hive/src/determinism.js                                                    ║
// ║  LAYER: backend/src                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END
'use strict';

const { updateJsonFile } = require('./state_store');

const statePath = '/shared/state/determinism_state.json';

function isDeterministic() {
    const value = String(process.env.HEADY_DETERMINISTIC || '').toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
}

function normalizeState(current) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        return { counters: {} };
    }
    if (!current.counters || typeof current.counters !== 'object' || Array.isArray(current.counters)) {
        current.counters = {};
    }
    return current;
}

function nextId(namespace) {
    if (!isDeterministic()) {
        return Date.now().toString();
    }

    const key = String(namespace || 'id');
    const updated = updateJsonFile(statePath, { counters: {} }, (current) => {
        const state = normalizeState(current);
        const currentValue = Number(state.counters[key]);
        const nextValue = Number.isFinite(currentValue) ? currentValue + 1 : 1;
        state.counters[key] = nextValue;
        return state;
    });

    return String(updated.counters[key]);
}

module.exports = {
    isDeterministic,
    nextId,
};

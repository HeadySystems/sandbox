/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Cognitive Runtime API Routes
 * Exposes the cognitive runtime governor, ternary logic evaluator,
 * and rulez gatekeeper via REST.
 * Skill: heady-cognitive-runtime
 */

'use strict';

const { Router } = require('express');

const router = Router();

// ─── Lazy-load cognitive modules ──────────────────────────────────────────────
let governor = null;
let controller = null;

function loadModules() {
    if (!governor) {
        try { governor = require('../orchestration/cognitive-runtime-governor'); } catch { governor = null; }
    }
    if (!controller) {
        try { controller = require('../orchestration/cognitive-operations-controller'); } catch { controller = null; }
    }
}

// ─── GET /status ──────────────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
    try {
        loadModules();
        const status = {
            governorLoaded: !!governor,
            controllerLoaded: !!controller,
            uptime: process.uptime(),
        };
        if (governor && typeof governor.getStatus === 'function') {
            status.governor = governor.getStatus();
        }
        if (controller && typeof controller.getStatus === 'function') {
            status.controller = controller.getStatus();
        }
        res.json({ ok: true, data: status });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /ternary ─────────────────────────────────────────────────────────────
router.get('/ternary', (_req, res) => {
    try {
        let ternaryState = null;
        try {
            const ternary = require('../orchestration/ternary-logic');
            if (typeof ternary.getState === 'function') ternaryState = ternary.getState();
            else ternaryState = { loaded: true, type: typeof ternary };
        } catch { ternaryState = { loaded: false }; }
        res.json({ ok: true, data: ternaryState });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /gate ───────────────────────────────────────────────────────────────
router.post('/gate', (req, res) => {
    try {
        const { rule, context } = req.body;
        if (!rule) return res.status(400).json({ ok: false, error: 'rule (string) required' });

        let gateResult = { evaluated: false };
        try {
            const gatekeeper = require('../orchestration/rulez-gatekeeper');
            if (typeof gatekeeper.evaluate === 'function') {
                gateResult = gatekeeper.evaluate(rule, context || {});
            } else if (typeof gatekeeper.checkRule === 'function') {
                gateResult = gatekeeper.checkRule(rule, context || {});
            }
        } catch (err) {
            gateResult = { evaluated: false, error: err.message };
        }
        res.json({ ok: true, data: gateResult });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /spatial ─────────────────────────────────────────────────────────────
router.get('/spatial', (_req, res) => {
    try {
        let spatialState = null;
        try {
            const spatial = require('../orchestration/spatial-mapping');
            if (typeof spatial.getState === 'function') spatialState = spatial.getState();
            else if (typeof spatial.summary === 'function') spatialState = spatial.summary();
            else spatialState = { loaded: true };
        } catch { spatialState = { loaded: false }; }
        res.json({ ok: true, data: spatialState });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

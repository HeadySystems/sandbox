/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Drift Detection API Routes
 * Exposes the DriftDetector service via REST endpoints.
 * Skill: heady-drift-detection
 */

'use strict';

const { Router } = require('express');
const { DriftDetector } = require('../drift-detector');

const router = Router();

// ─── Singleton DriftDetector ──────────────────────────────────────────────────
const detector = new DriftDetector({
    onEscalation: (alert) => {
        const logger = require('../utils/logger');
        logger.error({ alert }, 'DriftDetection: CRITICAL escalation fired');
    },
});

// ─── GET /summary ─────────────────────────────────────────────────────────────
router.get('/summary', (_req, res) => {
    try {
        res.json({ ok: true, data: detector.summary() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /alerts ──────────────────────────────────────────────────────────────
router.get('/alerts', (_req, res) => {
    try {
        res.json({ ok: true, data: detector.getAlerts() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /history/:componentId ────────────────────────────────────────────────
router.get('/history/:componentId', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 100;
        const data = detector.getHistory(req.params.componentId, limit);
        res.json({ ok: true, data });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /baseline ───────────────────────────────────────────────────────────
router.post('/baseline', (req, res) => {
    try {
        const { componentId, vector } = req.body;
        if (!componentId || !Array.isArray(vector)) {
            return res.status(400).json({ ok: false, error: 'componentId (string) and vector (number[]) required' });
        }
        detector.setBaseline(componentId, vector);
        res.json({ ok: true, message: `Baseline set for ${componentId}` });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /monitor ────────────────────────────────────────────────────────────
router.post('/monitor', (req, res) => {
    try {
        const { componentId, vector } = req.body;
        if (!componentId || !Array.isArray(vector)) {
            return res.status(400).json({ ok: false, error: 'componentId (string) and vector (number[]) required' });
        }
        const result = detector.monitor(componentId, vector);
        res.json({ ok: true, data: result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /dismiss/:alertId ───────────────────────────────────────────────────
router.post('/dismiss/:alertId', (req, res) => {
    try {
        const dismissed = detector.dismissAlert(req.params.alertId);
        res.json({ ok: true, dismissed });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
module.exports.detector = detector;

/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Resilience Cache API Routes
 * Exposes HeadyCache metrics and management via REST.
 * Skill: heady-resilience-cache
 */

'use strict';

const { Router } = require('express');
const { getCache, getAllCacheMetrics, caches } = require('../resilience/cache');

const router = Router();

// ─── GET /metrics ─────────────────────────────────────────────────────────────
router.get('/metrics', (_req, res) => {
    try {
        res.json({ ok: true, data: getAllCacheMetrics() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /:name/metrics ───────────────────────────────────────────────────────
router.get('/:name/metrics', (req, res) => {
    try {
        const cache = caches[req.params.name];
        if (!cache) {
            return res.status(404).json({ ok: false, error: `Cache '${req.params.name}' not found. Available: ${Object.keys(caches).join(', ')}` });
        }
        res.json({ ok: true, name: req.params.name, data: cache.getMetrics() });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /names ───────────────────────────────────────────────────────────────
router.get('/names', (_req, res) => {
    res.json({ ok: true, data: Object.keys(caches) });
});

// ─── POST /:name/invalidate ───────────────────────────────────────────────────
router.post('/:name/invalidate', (req, res) => {
    try {
        const cache = caches[req.params.name];
        if (!cache) {
            return res.status(404).json({ ok: false, error: `Cache '${req.params.name}' not found` });
        }
        const { key, prefix } = req.body;
        if (!key) {
            return res.status(400).json({ ok: false, error: 'key (string) required, optional prefix (boolean)' });
        }
        cache.invalidate(key, !!prefix);
        res.json({ ok: true, message: `Invalidated ${prefix ? 'prefix' : 'key'}: ${key}` });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /:name/clear ───────────────────────────────────────────────────────
router.post('/:name/clear', (req, res) => {
    try {
        const cache = caches[req.params.name];
        if (!cache) {
            return res.status(404).json({ ok: false, error: `Cache '${req.params.name}' not found` });
        }
        cache.clear();
        res.json({ ok: true, message: `Cache '${req.params.name}' cleared` });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

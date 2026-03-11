/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Intelligence Analytics API Routes
 * Exposes DuckDB-based memory analytics, provider usage tracking,
 * and embedding quality metrics via REST.
 * Skill: heady-intelligence-analytics
 */

'use strict';

const { Router } = require('express');

const router = Router();

// ─── Lazy-load DuckDB memory service ──────────────────────────────────────────
let duckdbService = null;
function getDuckDB() {
    if (!duckdbService) {
        try { duckdbService = require('../services/duckdb-memory'); } catch { duckdbService = null; }
    }
    return duckdbService;
}

// ─── GET /memory ──────────────────────────────────────────────────────────────
router.get('/memory', async (_req, res) => {
    try {
        const db = getDuckDB();
        if (!db) return res.json({ ok: true, data: { status: 'duckdb-not-available', message: 'DuckDB memory analytics service not loaded' } });
        const stats = typeof db.getStats === 'function' ? await db.getStats() : { status: 'no-stats-method' };
        res.json({ ok: true, data: stats });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /providers ───────────────────────────────────────────────────────────
router.get('/providers', async (_req, res) => {
    try {
        // Gather provider usage from model router if available
        let providerStats = {};
        try {
            const modelRouter = require('../services/model-router');
            if (typeof modelRouter.getProviderStats === 'function') providerStats = modelRouter.getProviderStats();
            else if (typeof modelRouter.getStats === 'function') providerStats = modelRouter.getStats();
        } catch { /* model-router not loaded */ }
        res.json({ ok: true, data: providerStats });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /embeddings ──────────────────────────────────────────────────────────
router.get('/embeddings', async (_req, res) => {
    try {
        let embeddingStats = {};
        try {
            const embedder = require('../services/continuous-embedder');
            if (typeof embedder.getStats === 'function') embeddingStats = embedder.getStats();
            else if (typeof embedder.getMetrics === 'function') embeddingStats = embedder.getMetrics();
        } catch { /* embedder not loaded */ }
        res.json({ ok: true, data: embeddingStats });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /overview ────────────────────────────────────────────────────────────
router.get('/overview', async (_req, res) => {
    try {
        const overview = {
            timestamp: Date.now(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
            duckdbAvailable: !!getDuckDB(),
        };

        // Try to pull cache metrics for analytics
        try {
            const { getAllCacheMetrics } = require('../resilience/cache');
            overview.cacheMetrics = getAllCacheMetrics();
        } catch { /* cache not loaded */ }

        res.json({ ok: true, data: overview });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

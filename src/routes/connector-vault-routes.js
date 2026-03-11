/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Connector Vault API Routes
 * Facade for dynamic connector synthesis, secure key vault,
 * and connector health monitoring.
 * Skill: heady-connector-vault
 */

'use strict';

const { Router } = require('express');

const router = Router();

// ─── Lazy-load services ──────────────────────────────────────────────────────
let connectorService = null;
let keyVault = null;

function loadServices() {
    if (!connectorService) {
        try { connectorService = require('../services/dynamic-connector-service'); } catch { connectorService = null; }
    }
    if (!keyVault) {
        try { keyVault = require('../services/secure-key-vault'); } catch { keyVault = null; }
    }
}

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
    try {
        loadServices();
        const connectors = {
            connectorServiceLoaded: !!connectorService,
            keyVaultLoaded: !!keyVault,
        };
        if (connectorService && typeof connectorService.listConnectors === 'function') {
            connectors.connectors = connectorService.listConnectors();
        } else if (connectorService && typeof connectorService.getConnectors === 'function') {
            connectors.connectors = connectorService.getConnectors();
        }
        res.json({ ok: true, data: connectors });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /:id/status ──────────────────────────────────────────────────────────
router.get('/:id/status', (req, res) => {
    try {
        loadServices();
        let status = { connectorId: req.params.id, available: false };
        if (connectorService && typeof connectorService.getStatus === 'function') {
            status = connectorService.getStatus(req.params.id);
        }
        res.json({ ok: true, data: status });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /synthesize ─────────────────────────────────────────────────────────
router.post('/synthesize', async (req, res) => {
    try {
        loadServices();
        const { type, config } = req.body;
        if (!type) return res.status(400).json({ ok: false, error: 'type (string) required' });

        if (!connectorService || typeof connectorService.synthesize !== 'function') {
            return res.status(503).json({ ok: false, error: 'Connector synthesis service not available' });
        }
        const result = await connectorService.synthesize(type, config || {});
        res.json({ ok: true, data: result });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /vault/status ────────────────────────────────────────────────────────
router.get('/vault/status', (_req, res) => {
    try {
        loadServices();
        if (!keyVault) return res.json({ ok: true, data: { status: 'not-loaded' } });
        const status = typeof keyVault.getStatus === 'function' ? keyVault.getStatus() : { loaded: true };
        res.json({ ok: true, data: status });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

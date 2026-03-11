/**
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Incident Operations API Routes
 * Unified incident lifecycle: create → triage → investigate → resolve.
 * Integrates with incident-timeline + policy-engine.
 * Skill: heady-incident-ops
 */

'use strict';

const { Router } = require('express');
const crypto = require('crypto');

const router = Router();

// ─── In-Memory Incident Store ─────────────────────────────────────────────────
const incidents = new Map();

const SEVERITY_LEVELS = ['P0', 'P1', 'P2', 'P3', 'P4'];
const STATUS_FLOW = ['open', 'triaging', 'investigating', 'mitigating', 'resolved', 'postmortem'];

function createIncident({ title, description, severity = 'P2', source = 'manual', affectedServices = [] }) {
    const id = `INC-${Date.now().toString(36).toUpperCase()}`;
    const incident = {
        id,
        title,
        description,
        severity,
        status: 'open',
        source,
        affectedServices,
        timeline: [{ ts: Date.now(), event: 'created', detail: `Incident created: ${title}` }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        resolvedAt: null,
        ttd: null, // time-to-detect
        ttr: null, // time-to-resolve
    };
    incidents.set(id, incident);
    return incident;
}

// ─── GET / ────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    try {
        const status = req.query.status;
        let list = Array.from(incidents.values()).sort((a, b) => b.createdAt - a.createdAt);
        if (status) list = list.filter(i => i.status === status);
        res.json({ ok: true, total: list.length, data: list });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /:id ─────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
    try {
        const inc = incidents.get(req.params.id);
        if (!inc) return res.status(404).json({ ok: false, error: 'Incident not found' });
        res.json({ ok: true, data: inc });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST / ───────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
    try {
        const { title, description, severity, source, affectedServices } = req.body;
        if (!title) return res.status(400).json({ ok: false, error: 'title required' });
        const inc = createIncident({ title, description, severity, source, affectedServices });
        res.status(201).json({ ok: true, data: inc });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /:id/update ─────────────────────────────────────────────────────────
router.post('/:id/update', (req, res) => {
    try {
        const inc = incidents.get(req.params.id);
        if (!inc) return res.status(404).json({ ok: false, error: 'Incident not found' });

        const { status, detail, severity } = req.body;
        if (status && STATUS_FLOW.includes(status)) {
            inc.status = status;
            inc.timeline.push({ ts: Date.now(), event: 'status_change', detail: `Status → ${status}` });
        }
        if (severity && SEVERITY_LEVELS.includes(severity)) {
            inc.severity = severity;
            inc.timeline.push({ ts: Date.now(), event: 'severity_change', detail: `Severity → ${severity}` });
        }
        if (detail) {
            inc.timeline.push({ ts: Date.now(), event: 'note', detail });
        }
        inc.updatedAt = Date.now();
        res.json({ ok: true, data: inc });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── POST /:id/resolve ────────────────────────────────────────────────────────
router.post('/:id/resolve', (req, res) => {
    try {
        const inc = incidents.get(req.params.id);
        if (!inc) return res.status(404).json({ ok: false, error: 'Incident not found' });

        inc.status = 'resolved';
        inc.resolvedAt = Date.now();
        inc.ttr = inc.resolvedAt - inc.createdAt;
        inc.timeline.push({
            ts: Date.now(),
            event: 'resolved',
            detail: req.body.resolution || 'Incident resolved',
        });
        inc.updatedAt = Date.now();
        res.json({ ok: true, data: inc });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
router.get('/meta/stats', (_req, res) => {
    try {
        const all = Array.from(incidents.values());
        const open = all.filter(i => i.status !== 'resolved').length;
        const resolved = all.filter(i => i.status === 'resolved');
        const avgTTR = resolved.length > 0
            ? Math.round(resolved.reduce((sum, i) => sum + (i.ttr || 0), 0) / resolved.length)
            : null;
        res.json({
            ok: true,
            data: {
                total: all.length,
                open,
                resolved: resolved.length,
                avgTTRms: avgTTR,
                bySeverity: SEVERITY_LEVELS.reduce((acc, s) => { acc[s] = all.filter(i => i.severity === s).length; return acc; }, {}),
            },
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;

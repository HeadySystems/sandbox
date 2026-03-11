/**
 * Heady™ Latent OS — Health Probes
 * Kubernetes-compatible health endpoints with coherence scoring.
 *
 * Endpoints:
 *   GET /healthz   — liveness probe (is the process alive?)
 *   GET /readyz    — readiness probe (is the process ready for traffic?)
 *   GET /startupz  — startup probe (has startup completed?)
 *
 * Features:
 *   - Coherence score included in every response
 *   - Service dependency health aggregation
 *   - Auto-Success cycle health tracking
 *   - Heartbeat tracking with stale detection (60s = BEE.STALE_MS)
 *   - Express router export for mounting in heady-manager
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const {
  PSI, fib,
  CSL_THRESHOLDS,
  PHI_TIMING,
  BEE,
} = require('../../shared/phi-math');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Stale heartbeat threshold: 60 000 ms (BEE.STALE_MS) */
const HEARTBEAT_STALE_MS = BEE.STALE_MS; // 60 000

/** Minimum coherence to report READY */
const READY_COHERENCE_THRESHOLD = CSL_THRESHOLDS.MEDIUM; // 0.809

/** Minimum coherence to report ALIVE (liveness is more lenient) */
const ALIVE_COHERENCE_THRESHOLD = CSL_THRESHOLDS.LOW; // ~0.691

/** HTTP status returned when unhealthy */
const HTTP_HEALTHY   = 200;
const HTTP_UNHEALTHY = 503;

// ─── Heartbeat Registry ───────────────────────────────────────────────────────

/**
 * Per-service heartbeat registry.
 * @type {Map<string, {ts: number, meta: object}>}
 */
const _heartbeats = new Map();

/**
 * Record a heartbeat for a named service.
 * @param {string} serviceName
 * @param {object} [meta]  optional extra data stored with the heartbeat
 */
function recordHeartbeat(serviceName, meta = {}) {
  _heartbeats.set(serviceName, { ts: Date.now(), meta });
}

/**
 * Check whether a service heartbeat is stale (> HEARTBEAT_STALE_MS old or absent).
 * @param {string} serviceName
 * @returns {boolean}
 */
function isHeartbeatStale(serviceName) {
  const hb = _heartbeats.get(serviceName);
  if (!hb) return true;
  return (Date.now() - hb.ts) > HEARTBEAT_STALE_MS;
}

// ─── Service Dependency Registry ─────────────────────────────────────────────

/**
 * @typedef {Object} ServiceEntry
 * @property {string}   name       service name
 * @property {'required'|'optional'} criticality
 * @property {Function} check      async () => { ok: boolean, detail?: string }
 */

/** @type {Map<string, ServiceEntry>} */
const _services = new Map();

/**
 * Register a service dependency for health aggregation.
 * @param {ServiceEntry} entry
 */
function registerService(entry) {
  if (!entry || !entry.name || typeof entry.check !== 'function') {
    throw new Error('[HealthProbes] registerService requires { name, check, criticality }');
  }
  _services.set(entry.name, {
    criticality: 'required',
    ...entry,
  });
}

// ─── Auto-Success Cycle State ─────────────────────────────────────────────────

const _autoSuccess = {
  running:       false,
  lastCycleAt:   null,
  lastCycleMs:   null,
  successCount:  0,
  failureCount:  0,
  cycleOverrun:  false,
};

/**
 * Update the Auto-Success cycle health state.
 * Called by auto-success-engine after each cycle.
 * @param {object} update
 */
function updateAutoSuccessHealth(update) {
  Object.assign(_autoSuccess, update);
}

// ─── Startup State ────────────────────────────────────────────────────────────

const _startup = {
  complete:   false,
  startedAt:  Date.now(),
  phases:     {},        // phase name → { ok, durationMs }
};

/**
 * Mark the system as fully started.
 * @param {object} phaseResults  map of phase → result
 */
function markStartupComplete(phaseResults = {}) {
  _startup.complete = true;
  _startup.phases   = phaseResults;
}

// ─── Coherence Calculator ─────────────────────────────────────────────────────

/**
 * Compute an aggregate coherence score from multiple component scores (0–1).
 * Uses PSI-weighted harmonic mean to penalise weak components.
 * @param {number[]} scores
 * @returns {number} 0–1
 */
function aggregateCoherence(scores) {
  if (!scores || scores.length === 0) return 0;
  // Harmonic mean weighted by PSI
  const harmonicSum = scores.reduce((acc, s) => acc + 1 / (s || 0.001), 0);
  const harmonicMean = scores.length / harmonicSum;
  return Math.min(1, harmonicMean);
}

// ─── Dependency Check ────────────────────────────────────────────────────────

/**
 * Run all registered service checks and return an aggregated result.
 * @returns {Promise<{ok: boolean, coherence: number, details: object}>}
 */
async function checkDependencies() {
  const details   = {};
  const scores    = [];
  let   allOk     = true;

  for (const [name, svc] of _services) {
    try {
      const result = await Promise.race([
        svc.check(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error('timeout')), PHI_TIMING.PHI_2) // 2,618ms
        ),
      ]);
      const ok    = Boolean(result && result.ok);
      const score = ok ? (result.score || CSL_THRESHOLDS.HIGH) : 0;
      details[name] = { ok, criticality: svc.criticality, detail: result.detail || null };
      scores.push(score);
      if (!ok && svc.criticality === 'required') allOk = false;
    } catch (err) {
      details[name] = { ok: false, criticality: svc.criticality, error: err.message };
      scores.push(0);
      if (svc.criticality === 'required') allOk = false;
    }
  }

  return {
    ok:        allOk,
    coherence: aggregateCoherence(scores.length ? scores : [PSI]),
    details,
  };
}

// ─── Probe Handlers ───────────────────────────────────────────────────────────

/**
 * Liveness probe handler — is the process alive and minimally functional?
 * Returns 200 unless we are in a hard-crash state.
 * @returns {Promise<{status: number, body: object}>}
 */
async function livenessHandler() {
  const staleServices = [];
  for (const [name] of _services) {
    if (isHeartbeatStale(name)) staleServices.push(name);
  }

  const heartbeatCoherence = _services.size > 0
    ? (_services.size - staleServices.length) / _services.size
    : PSI; // default: PSI (0.618) when no services registered

  const alive     = heartbeatCoherence >= ALIVE_COHERENCE_THRESHOLD;
  const statusCode = alive ? HTTP_HEALTHY : HTTP_UNHEALTHY;

  return {
    status: statusCode,
    body: {
      status:             alive ? 'alive' : 'dead',
      coherence:          Number(heartbeatCoherence.toFixed(4)),
      coherenceThreshold: ALIVE_COHERENCE_THRESHOLD,
      staleServices,
      heartbeatStaleMs:   HEARTBEAT_STALE_MS,
      uptimeMs:           Date.now() - _startup.startedAt,
      ts:                 new Date().toISOString(),
    },
  };
}

/**
 * Readiness probe handler — is the process ready to serve traffic?
 * @returns {Promise<{status: number, body: object}>}
 */
async function readinessHandler() {
  if (!_startup.complete) {
    return {
      status: HTTP_UNHEALTHY,
      body: {
        status:    'not_ready',
        reason:    'startup_incomplete',
        coherence: 0,
        ts:        new Date().toISOString(),
      },
    };
  }

  const deps        = await checkDependencies();
  const asCoherence = _autoSuccess.running ? CSL_THRESHOLDS.HIGH : PSI;
  const composite   = aggregateCoherence([deps.coherence, asCoherence]);
  const ready       = deps.ok && composite >= READY_COHERENCE_THRESHOLD;

  return {
    status: ready ? HTTP_HEALTHY : HTTP_UNHEALTHY,
    body: {
      status:             ready ? 'ready' : 'not_ready',
      coherence:          Number(composite.toFixed(4)),
      coherenceThreshold: READY_COHERENCE_THRESHOLD,
      dependencies:       deps.details,
      autoSuccess: {
        running:      _autoSuccess.running,
        lastCycleAt:  _autoSuccess.lastCycleAt,
        lastCycleMs:  _autoSuccess.lastCycleMs,
        successCount: _autoSuccess.successCount,
        failureCount: _autoSuccess.failureCount,
        cycleOverrun: _autoSuccess.cycleOverrun,
      },
      ts: new Date().toISOString(),
    },
  };
}

/**
 * Startup probe handler — has the 10-phase boot sequence completed?
 * @returns {Promise<{status: number, body: object}>}
 */
async function startupHandler() {
  const statusCode = _startup.complete ? HTTP_HEALTHY : HTTP_UNHEALTHY;
  return {
    status: statusCode,
    body: {
      status:    _startup.complete ? 'started' : 'starting',
      complete:  _startup.complete,
      startedAt: new Date(_startup.startedAt).toISOString(),
      uptimeMs:  Date.now() - _startup.startedAt,
      phases:    _startup.phases,
      ts:        new Date().toISOString(),
    },
  };
}

// ─── Express Router Factory ───────────────────────────────────────────────────

/**
 * Build and return an Express router with the three health endpoints.
 * Mount with: app.use('/', createHealthRouter())
 *
 * @returns {import('express').Router}
 */
function createHealthRouter() {
  // Lazy-require express so the module can be used without it installed
  const express = require('express'); // eslint-disable-line global-require
  const router  = express.Router();

  router.get('/healthz', async (_req, res) => {
    const { status, body } = await livenessHandler();
    res.status(status).json(body);
  });

  router.get('/readyz', async (_req, res) => {
    const { status, body } = await readinessHandler();
    res.status(status).json(body);
  });

  router.get('/startupz', async (_req, res) => {
    const { status, body } = await startupHandler();
    res.status(status).json(body);
  });

  return router;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Registration
  registerService,
  recordHeartbeat,
  updateAutoSuccessHealth,
  markStartupComplete,
  // Handlers (for testing/direct use)
  livenessHandler,
  readinessHandler,
  startupHandler,
  // Router
  createHealthRouter,
  // Utilities
  isHeartbeatStale,
  aggregateCoherence,
  checkDependencies,
  // Constants
  HEARTBEAT_STALE_MS,
  READY_COHERENCE_THRESHOLD,
  ALIVE_COHERENCE_THRESHOLD,
};

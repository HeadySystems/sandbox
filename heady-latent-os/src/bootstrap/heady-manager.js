/**
 * Heady™ Latent OS — Heady Manager
 * Main HTTP/MCP server entry point. Pure orchestrator shell.
 *
 * Responsibilities:
 *   - Runs the 10-phase boot() sequence
 *   - Mounts health probes at /healthz, /readyz, /startupz
 *   - Exposes MCP JSON-RPC 2.0 endpoint at /mcp
 *   - Listens on PORT env var or default 3301
 *   - Graceful shutdown on SIGTERM/SIGINT (delegated to bootstrap)
 *
 * This file is the process entry point: node src/bootstrap/heady-manager.js
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const express    = require('express');
const { PHI, PSI, CSL_THRESHOLDS } = require('../../shared/phi-math');
const { boot }   = require('./bootstrap');
const { createHealthRouter } = require('../core/health-probes');
const { createLogger }       = require('../core/heady-logger');
const { bus }                = require('../core/event-bus');

const log = createLogger('heady-manager');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default HTTP port — must come from env; fallback 3301 */
const DEFAULT_PORT = parseInt(process.env.PORT || '3301', 10);

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express();

// Parse JSON bodies for MCP and API endpoints
app.use(express.json({ limit: '4mb' }));

// Request logging middleware
app.use((req, _res, next) => {
  log.debug('HTTP request', { method: req.method, path: req.path, ip: req.ip });
  next();
});

// ─── Health Routes ────────────────────────────────────────────────────────────

app.use('/', createHealthRouter());

// ─── MCP JSON-RPC 2.0 Endpoint ───────────────────────────────────────────────

/**
 * MCP (Model Context Protocol) JSON-RPC 2.0 stub.
 * Accepts POST /mcp with a JSON-RPC 2.0 body.
 * Returns method-not-found for unregistered methods until real
 * MCP dispatcher is wired in by the CSL/Conductor layers.
 *
 * Spec: https://spec.modelcontextprotocol.io/specification/
 */
app.post('/mcp', (req, res) => {
  const body = req.body;

  // Validate JSON-RPC 2.0 envelope
  if (!body || body.jsonrpc !== '2.0' || !body.method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      id:      body && body.id !== undefined ? body.id : null,
      error:   { code: -32600, message: 'Invalid Request' },
    });
  }

  const { id, method, params } = body;

  // Built-in MCP capabilities
  if (method === 'mcp/capabilities') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result: {
        name:        'heady-latent-os',
        version:     process.env.HEADY_VERSION || '1.0.0',
        phi:         PHI,
        capabilities: [
          'task/submit',
          'task/status',
          'memory/search',
          'health/status',
          'pipeline/run',
        ],
      },
    });
  }

  if (method === 'mcp/ping') {
    return res.json({
      jsonrpc: '2.0',
      id,
      result:  { pong: true, ts: new Date().toISOString(), phi: PHI },
    });
  }

  // Route to EventBus for registered method handlers
  bus.emit('task', {
    type:     'mcp_request',
    data:     { id, method, params },
    temporal: CSL_THRESHOLDS.MEDIUM,   // 0.809
    semantic: CSL_THRESHOLDS.LOW,      // 0.691
    spatial:  PSI,                      // 0.618
  });

  // Until the full MCP dispatcher is wired, return method-not-found
  return res.status(404).json({
    jsonrpc: '2.0',
    id,
    error: {
      code:    -32601,
      message: `Method not found: ${method}`,
    },
  });
});

// ─── Info Route ───────────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.json({
    name:    'Heady™ Latent OS',
    version: process.env.HEADY_VERSION || '1.0.0',
    env:     process.env.HEADY_ENV     || 'development',
    phi:     PHI,
    routes: {
      health:   ['/healthz', '/readyz', '/startupz'],
      mcp:      '/mcp',
    },
    ts: new Date().toISOString(),
  });
});

// ─── 404 Catch-all ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found', phi: PHI });
});

// ─── Error Handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  log.error('Express error handler', err);
  res.status(500).json({ error: 'internal_server_error', message: err.message });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

/**
 * Start the HTTP server and run the boot sequence.
 * @returns {Promise<import('http').Server>}
 */
async function startServer() {
  // Run 10-phase boot sequence first
  await boot();

  return new Promise((resolve, reject) => {
    const server = app.listen(DEFAULT_PORT, (err) => {
      if (err) return reject(err);
      log.info('Heady™ Manager listening', {
        port: DEFAULT_PORT,
        env:  process.env.HEADY_ENV,
        phi:  PHI,
      });
      bus.emit('lifecycle', {
        type:     'http_ready',
        data:     { port: DEFAULT_PORT },
        temporal: 0.9,
        semantic: 0.9,
        spatial:  0.9,
      });
      resolve(server);
    });

    server.on('error', reject);
  });
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

// Only start when this file is the direct entry point
if (require.main === module) {
  startServer().catch((err) => {
    log.fatal('Server startup failed', err);
    process.exit(1);
  });
}

// ─── Exports (for testing / programmatic use) ─────────────────────────────────

module.exports = { app, startServer, DEFAULT_PORT };

'use strict';

/**
 * @file deep-health-check.js
 * @description HeadySystems Deep Health Check Endpoint
 * @version 3.2.2
 *
 * φ = 1.618033988749895 (Golden Ratio)
 * Fibonacci sequence: 1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597
 *
 * Verifies:
 *   1. Redis connectivity + latency (φ-scaled timeout thresholds)
 *   2. Postgres connectivity + migration status
 *   3. Downstream service health (heady-brain, heady-conductor, heady-mcp)
 *   4. Disk space
 *   5. Memory usage
 *
 * Returns structured JSON with per-dependency status.
 * All timeout thresholds derive from φ^n milliseconds.
 */

const http   = require('http');
const https  = require('https');
const os     = require('os');
const fs     = require('fs');
const path   = require('path');

// ---------------------------------------------------------------------------
// φ Constants — ALL numeric thresholds derive from these
// ---------------------------------------------------------------------------
const PHI = 1.618033988749895;

/** Fibonacci sequence (first 17 numbers) */
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597];

/**
 * φ^n milliseconds for timeout thresholds
 *   φ^0 = 1000ms  (base)
 *   φ^1 = 1618ms  (fast)
 *   φ^2 = 2618ms  (normal)
 *   φ^3 = 4236ms  (slow — degraded threshold)
 *   φ^4 = 6854ms  (very slow — critical threshold)
 *   φ^5 = 11090ms (upstream timeout)
 */
const PHI_TIMEOUTS_MS = {
  base:      1000,
  fast:      Math.round(1000 * PHI),          // 1618ms
  normal:    Math.round(1000 * PHI ** 2),      // 2618ms
  slow:      Math.round(1000 * PHI ** 3),      // 4236ms
  critical:  Math.round(1000 * PHI ** 4),      // 6854ms
  upstream:  Math.round(1000 * PHI ** 5),      // 11090ms
  max:       Math.round(1000 * PHI ** 6),      // 17944ms
};

/**
 * Latency thresholds (ms) derived from φ:
 *   healthy:   p50 < base/φ^3 ≈ 100ms
 *   degraded:  p50 < base/φ^2 ≈ 382ms
 *   critical:  p50 < base/φ   ≈ 618ms
 */
const LATENCY_THRESHOLDS_MS = {
  healthy:  Math.round(1000 / PHI ** 3),   // ~236ms (1/φ^3 × base)
  degraded: Math.round(1000 / PHI ** 2),   // ~382ms
  critical: Math.round(1000 / PHI),        // ~618ms
  timeout:  PHI_TIMEOUTS_MS.slow,          // φ^3 = 4236ms
};

/**
 * Memory thresholds (percentage of total RAM):
 *   healthy:   < 61.8% (1/φ)
 *   warning:   < 76.4%
 *   critical:  < 85.4%
 *   exceeded:  >= 91.0%
 */
const MEMORY_THRESHOLDS = {
  healthy:  1 / PHI,            // 0.618 — 61.8%
  warning:  0.764,              // caution threshold from context brief
  critical: 0.854,              // critical threshold
  exceeded: 0.910,              // exceeded threshold
};

/** Disk space thresholds (same as memory) */
const DISK_THRESHOLDS = {
  healthy:  1 / PHI,            // 61.8% free
  warning:  1 - 0.764,          // 23.6% free
  critical: 1 - 0.854,          // 14.6% free
  exceeded: 1 - 0.910,          // 9.0% free
};

// ---------------------------------------------------------------------------
// Check status enum
// ---------------------------------------------------------------------------
const STATUS = {
  HEALTHY:   'healthy',
  DEGRADED:  'degraded',
  CRITICAL:  'critical',
  UNKNOWN:   'unknown',
  DOWN:      'down',
};

// ---------------------------------------------------------------------------
// Helper: Get latency status from measured ms
// ---------------------------------------------------------------------------
/**
 * @param {number} latencyMs
 * @returns {string} STATUS
 */
const getLatencyStatus = (latencyMs) => {
  if (latencyMs < LATENCY_THRESHOLDS_MS.healthy)  return STATUS.HEALTHY;
  if (latencyMs < LATENCY_THRESHOLDS_MS.degraded) return STATUS.DEGRADED;
  if (latencyMs < LATENCY_THRESHOLDS_MS.critical) return STATUS.CRITICAL;
  return STATUS.DOWN;
};

// ---------------------------------------------------------------------------
// Redis Health Check
// ---------------------------------------------------------------------------
/**
 * @returns {Promise<Object>} Redis health result
 */
const checkRedis = async () => {
  const start = Date.now();
  try {
    // Dynamic import to avoid startup failures if redis not available
    const { createClient } = require('redis');
    const url = process.env.REDIS_URL || 'redis://localhost:6379';

    const client = createClient({
      url,
      socket: {
        // φ^2 = 2618ms connect timeout
        connectTimeout: PHI_TIMEOUTS_MS.normal,
        // φ^3 = 4236ms command timeout
        commandTimeout: PHI_TIMEOUTS_MS.slow,
        // fib(4)=3 reconnect retries
        reconnectStrategy: (retries) => {
          if (retries >= FIB[3]) return new Error('Max Redis reconnect attempts (fib(4)=3)');
          // φ^n backoff
          return Math.round(1000 * PHI ** retries);
        },
      },
    });

    await client.connect();

    // PING to measure base latency
    const pingStart = Date.now();
    const pong = await client.ping();
    const pingLatencyMs = Date.now() - pingStart;

    // INFO to measure command latency
    const infoStart = Date.now();
    const info = await client.info('server');
    const infoLatencyMs = Date.now() - infoStart;

    // Get memory stats
    const memInfo = await client.info('memory');
    const usedMemoryMatch = memInfo.match(/used_memory:(\d+)/);
    const maxMemoryMatch  = memInfo.match(/maxmemory:(\d+)/);
    const usedMemory  = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0;
    const maxMemory   = maxMemoryMatch  ? parseInt(maxMemoryMatch[1])  : 0;
    const memUsagePct = maxMemory > 0 ? usedMemory / maxMemory : 0;

    // Get version
    const versionMatch = info.match(/redis_version:([\d.]+)/);
    const redisVersion = versionMatch ? versionMatch[1] : 'unknown';

    // Connected clients
    const clientsInfo = await client.info('clients');
    const connectedMatch = clientsInfo.match(/connected_clients:(\d+)/);
    const connectedClients = connectedMatch ? parseInt(connectedMatch[1]) : 0;

    await client.disconnect();

    const totalLatencyMs = Date.now() - start;

    return {
      status:  getLatencyStatus(pingLatencyMs),
      checks: {
        ping: { ok: pong === 'PONG', latencyMs: pingLatencyMs },
        info: { ok: true, latencyMs: infoLatencyMs },
      },
      metrics: {
        pingLatencyMs,
        totalLatencyMs,
        redisVersion,
        connectedClients,
        memoryUsagePct:   Math.round(memUsagePct * 1000) / 10,
        usedMemoryBytes:  usedMemory,
        memoryStatus:     memUsagePct < MEMORY_THRESHOLDS.healthy  ? STATUS.HEALTHY  :
                          memUsagePct < MEMORY_THRESHOLDS.warning  ? STATUS.DEGRADED :
                          memUsagePct < MEMORY_THRESHOLDS.critical ? STATUS.CRITICAL :
                          STATUS.DOWN,
      },
      thresholds: {
        healthyLatencyMs:  LATENCY_THRESHOLDS_MS.healthy,
        degradedLatencyMs: LATENCY_THRESHOLDS_MS.degraded,
        criticalLatencyMs: LATENCY_THRESHOLDS_MS.critical,
        timeoutMs:         PHI_TIMEOUTS_MS.slow,         // φ^3 = 4236ms
        derivation:        'latencyMs derived from 1000/φ^n; thresholds: healthy=1/φ^3≈236ms, degraded=1/φ^2≈382ms, critical=1/φ≈618ms',
      },
    };
  } catch (err) {
    return {
      status: STATUS.DOWN,
      error:  err.message,
      latencyMs: Date.now() - start,
      thresholds: { timeoutMs: PHI_TIMEOUTS_MS.slow },
    };
  }
};

// ---------------------------------------------------------------------------
// Postgres Health Check
// ---------------------------------------------------------------------------
/**
 * @returns {Promise<Object>} Postgres health result
 */
const checkPostgres = async () => {
  const start = Date.now();
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // fib(3)=2 connections in health-check pool
      max: FIB[3],               // fib(4)=3
      // φ^2 = 2618ms acquire timeout
      connectionTimeoutMillis: PHI_TIMEOUTS_MS.normal,
      // φ^4 = 6854ms idle timeout
      idleTimeoutMillis: PHI_TIMEOUTS_MS.critical,
      // φ^3 = 4236ms statement timeout
      statement_timeout: PHI_TIMEOUTS_MS.slow,
    });

    const client = await pool.connect();

    // Basic connectivity check
    const pingStart = Date.now();
    await client.query('SELECT 1 as health_check');
    const pingLatencyMs = Date.now() - pingStart;

    // Check migration status
    let migrationStatus = { applied: 0, pending: 0, status: STATUS.UNKNOWN };
    try {
      const migResult = await client.query(`
        SELECT COUNT(*) as applied
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'migrations'
      `);
      if (migResult.rows[0].applied > 0) {
        const migs = await client.query(`
          SELECT COUNT(*) as total,
                 SUM(CASE WHEN applied = true THEN 1 ELSE 0 END) as applied_count
          FROM migrations
        `);
        const total   = parseInt(migs.rows[0].total);
        const applied = parseInt(migs.rows[0].applied_count);
        migrationStatus = {
          total,
          applied,
          pending: total - applied,
          status:  applied === total ? STATUS.HEALTHY : STATUS.DEGRADED,
        };
      }
    } catch (_) {
      // migrations table may not exist yet
    }

    // Check pgvector extension
    let pgvectorStatus = STATUS.UNKNOWN;
    try {
      const extResult = await client.query(`
        SELECT extversion FROM pg_extension WHERE extname = 'vector'
      `);
      pgvectorStatus = extResult.rows.length > 0 ? STATUS.HEALTHY : STATUS.DEGRADED;
    } catch (_) {}

    // Server stats
    const statsResult = await client.query(`
      SELECT numbackends, xact_commit, xact_rollback,
             blks_hit, blks_read, tup_fetched, tup_inserted,
             tup_updated, tup_deleted
      FROM pg_stat_database
      WHERE datname = current_database()
    `);
    const stats = statsResult.rows[0];

    client.release();
    await pool.end();

    const totalLatencyMs = Date.now() - start;

    return {
      status: getLatencyStatus(pingLatencyMs),
      checks: {
        connectivity: { ok: true, latencyMs: pingLatencyMs },
        migrations:   migrationStatus,
        pgvector:     { status: pgvectorStatus },
      },
      metrics: {
        pingLatencyMs,
        totalLatencyMs,
        activeConnections: parseInt(stats.numbackends),
        transactions: {
          committed:  parseInt(stats.xact_commit),
          rolledBack: parseInt(stats.xact_rollback),
        },
        cacheHitRatio: stats.blks_read > 0
          ? Math.round((stats.blks_hit / (stats.blks_hit + stats.blks_read)) * 1000) / 10
          : 100,
      },
      thresholds: {
        connectTimeoutMs: PHI_TIMEOUTS_MS.normal,   // φ^2 = 2618ms
        queryTimeoutMs:   PHI_TIMEOUTS_MS.slow,     // φ^3 = 4236ms
        derivation: 'Timeout thresholds: connect=φ^2=2618ms, query=φ^3=4236ms, max=φ^5=11090ms',
      },
    };
  } catch (err) {
    return {
      status:    STATUS.DOWN,
      error:     err.message,
      latencyMs: Date.now() - start,
    };
  }
};

// ---------------------------------------------------------------------------
// Downstream Service Health Check
// ---------------------------------------------------------------------------
/**
 * @param {string} name - Service name
 * @param {string} url  - Health endpoint URL
 * @returns {Promise<Object>} Service health result
 */
const checkDownstreamService = async (name, url) => {
  const start = Date.now();
  return new Promise((resolve) => {
    // φ^3 = 4236ms timeout for downstream checks
    const timeoutMs = PHI_TIMEOUTS_MS.slow;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      resolve({
        name,
        status:    STATUS.DOWN,
        error:     `Timeout after φ^3=${PHI_TIMEOUTS_MS.slow}ms`,
        latencyMs: timeoutMs,
        url,
      });
    }, timeoutMs);

    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(`${url}/health/ready`, {
      headers: {
        'User-Agent': `heady-health-check/3.2.2 (phi=${PHI})`,
        'X-Health-Check': 'deep',
      },
    }, (res) => {
      if (timedOut) return;
      clearTimeout(timer);

      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const latencyMs = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (_) {}

        resolve({
          name,
          status:    res.statusCode === 200 ? STATUS.HEALTHY :
                     res.statusCode < 500   ? STATUS.DEGRADED :
                     STATUS.DOWN,
          statusCode: res.statusCode,
          latencyMs,
          url,
          response:   parsed,
          thresholds: {
            healthyLatencyMs:  LATENCY_THRESHOLDS_MS.healthy,
            degradedLatencyMs: LATENCY_THRESHOLDS_MS.degraded,
            timeoutMs:         PHI_TIMEOUTS_MS.slow,   // φ^3
          },
        });
      });
    });

    req.on('error', (err) => {
      if (timedOut) return;
      clearTimeout(timer);
      resolve({
        name,
        status:    STATUS.DOWN,
        error:     err.message,
        latencyMs: Date.now() - start,
        url,
      });
    });
  });
};

// ---------------------------------------------------------------------------
// Disk Space Check
// ---------------------------------------------------------------------------
/**
 * @returns {Object} Disk health
 */
const checkDisk = () => {
  try {
    const tmpStats = fs.statfsSync('/tmp');
    const totalBytes = tmpStats.blocks * tmpStats.bsize;
    const freeBytes  = tmpStats.bfree  * tmpStats.bsize;
    const usedPct    = (totalBytes - freeBytes) / totalBytes;
    const freePct    = freeBytes / totalBytes;

    return {
      status: freePct > DISK_THRESHOLDS.healthy  ? STATUS.HEALTHY  :
              freePct > DISK_THRESHOLDS.warning   ? STATUS.DEGRADED :
              freePct > DISK_THRESHOLDS.critical  ? STATUS.CRITICAL :
              STATUS.DOWN,
      metrics: {
        totalBytes,
        freeBytes,
        usedBytes:  totalBytes - freeBytes,
        usedPct:    Math.round(usedPct * 1000) / 10,
        freePct:    Math.round(freePct * 1000) / 10,
      },
      thresholds: {
        healthyFreePct:  Math.round(DISK_THRESHOLDS.healthy  * 1000) / 10,
        warningFreePct:  Math.round(DISK_THRESHOLDS.warning  * 1000) / 10,
        criticalFreePct: Math.round(DISK_THRESHOLDS.critical * 1000) / 10,
        derivation: 'Thresholds: healthy=1/φ=61.8% free, warning=1-0.764=23.6% free',
      },
    };
  } catch (err) {
    return { status: STATUS.UNKNOWN, error: err.message };
  }
};

// ---------------------------------------------------------------------------
// Memory Check
// ---------------------------------------------------------------------------
/**
 * @returns {Object} Memory health
 */
const checkMemory = () => {
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  const usedPct  = usedMem / totalMem;

  // Process heap
  const heapUsed  = process.memoryUsage().heapUsed;
  const heapTotal = process.memoryUsage().heapTotal;
  const heapPct   = heapUsed / heapTotal;

  return {
    status: usedPct < MEMORY_THRESHOLDS.healthy  ? STATUS.HEALTHY  :
            usedPct < MEMORY_THRESHOLDS.warning  ? STATUS.DEGRADED :
            usedPct < MEMORY_THRESHOLDS.critical ? STATUS.CRITICAL :
            STATUS.DOWN,
    metrics: {
      system: {
        totalBytes: totalMem,
        freeBytes:  freeMem,
        usedBytes:  usedMem,
        usedPct:    Math.round(usedPct * 1000) / 10,
      },
      process: {
        heapUsedBytes:  heapUsed,
        heapTotalBytes: heapTotal,
        heapPct:        Math.round(heapPct * 1000) / 10,
        rss:            process.memoryUsage().rss,
        external:       process.memoryUsage().external,
      },
    },
    thresholds: {
      healthyPct:  Math.round(MEMORY_THRESHOLDS.healthy  * 1000) / 10,  // 61.8%
      warningPct:  Math.round(MEMORY_THRESHOLDS.warning  * 1000) / 10,  // 76.4%
      criticalPct: Math.round(MEMORY_THRESHOLDS.critical * 1000) / 10,  // 85.4%
      exceededPct: Math.round(MEMORY_THRESHOLDS.exceeded * 1000) / 10,  // 91.0%
      derivation: 'Thresholds: 1/φ=61.8% (healthy), 0.764 (caution), 0.854 (critical), 0.910 (exceeded)',
    },
  };
};

// ---------------------------------------------------------------------------
// Deep Health Check Runner
// ---------------------------------------------------------------------------
/**
 * Runs all health checks in parallel and returns structured result.
 * @returns {Promise<Object>} Full health check result
 */
const runDeepHealthCheck = async () => {
  const checkStart = Date.now();

  // Service discovery from environment
  const services = [
    { name: 'heady-brain',     url: process.env.HEADY_BRAIN_URL     || 'http://heady-brain:8080' },
    { name: 'heady-conductor', url: process.env.HEADY_CONDUCTOR_URL || 'http://heady-conductor:8080' },
    { name: 'heady-mcp',       url: process.env.HEADY_MCP_URL       || 'http://heady-mcp:8080' },
  ];

  // Run all checks in parallel (φ^5=11090ms max total timeout)
  const [
    redisResult,
    postgresResult,
    ...serviceResults
  ] = await Promise.all([
    checkRedis(),
    checkPostgres(),
    ...services.map((svc) => checkDownstreamService(svc.name, svc.url)),
  ]);

  const diskResult   = checkDisk();
  const memoryResult = checkMemory();

  const totalMs = Date.now() - checkStart;

  // Aggregate overall status
  const allStatuses = [
    redisResult.status,
    postgresResult.status,
    ...serviceResults.map((s) => s.status),
    diskResult.status,
    memoryResult.status,
  ];

  const overallStatus =
    allStatuses.every((s) => s === STATUS.HEALTHY) ? STATUS.HEALTHY :
    allStatuses.some((s)  => s === STATUS.DOWN)    ? STATUS.DOWN    :
    allStatuses.some((s)  => s === STATUS.CRITICAL) ? STATUS.CRITICAL :
    STATUS.DEGRADED;

  return {
    status:    overallStatus,
    timestamp: new Date().toISOString(),
    version:   process.env.HEADY_VERSION || '3.2.2',
    service:   process.env.SERVICE_NAME  || 'heady-health',
    phi:       PHI,
    totalCheckMs: totalMs,
    dependencies: {
      redis:    redisResult,
      postgres: postgresResult,
      services: serviceResults,
    },
    system: {
      disk:   diskResult,
      memory: memoryResult,
    },
    phiConstants: {
      phi:     PHI,
      phi2:    PHI ** 2,
      phi3:    PHI ** 3,
      phi4:    PHI ** 4,
      phi5:    PHI ** 5,
      fib4:    FIB[4],   // 5
      fib7:    FIB[6],   // 13
      fib10:   FIB[9],   // 55
      fib11:   FIB[10],  // 89
    },
    timeoutThresholds: PHI_TIMEOUTS_MS,
    latencyThresholds: LATENCY_THRESHOLDS_MS,
  };
};

// ---------------------------------------------------------------------------
// HTTP Server — expose /health/deep endpoint
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.HEALTH_PORT || '8090', 10);

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (req.url === '/health/live') {
    // Liveness: just confirm process is running
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'live', phi: PHI }));
    return;
  }

  if (req.url === '/health/deep' || req.url === '/health') {
    try {
      // φ^5=11090ms total check timeout
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Deep check timeout after φ^5=${PHI_TIMEOUTS_MS.upstream}ms`)),
          PHI_TIMEOUTS_MS.upstream)
      );

      const result = await Promise.race([runDeepHealthCheck(), timeout]);

      const httpStatus = result.status === STATUS.HEALTHY   ? 200 :
                         result.status === STATUS.DEGRADED  ? 200 :
                         result.status === STATUS.CRITICAL  ? 503 :
                         503;

      res.writeHead(httpStatus, {
        'Content-Type': 'application/json',
        'X-Heady-Version': '3.2.2',
        'X-Heady-Phi': String(PHI),
        'Cache-Control': 'no-store, no-cache',
      });
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: STATUS.DOWN,
        error:  err.message,
        phi:    PHI,
      }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', paths: ['/health/deep', '/health/live'] }));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(JSON.stringify({
      level: 'info',
      message: `HeadySystems deep health check server listening on :${PORT}`,
      phi: PHI,
      // fib(7)=13 timeout checks, fib(4)=3 retry attempts
      maxCheckTimeoutMs: PHI_TIMEOUTS_MS.upstream,
      checkTimeoutDerivation: 'φ^5 = 11090ms',
      port: PORT,
      version: '3.2.2',
    }));
  });
}

module.exports = { runDeepHealthCheck, checkRedis, checkPostgres, checkMemory, checkDisk, PHI, FIB, PHI_TIMEOUTS_MS, LATENCY_THRESHOLDS_MS };

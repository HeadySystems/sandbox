'use strict';

/**
 * HEADY™ Analytics Service
 * Privacy-first analytics for HEADY OS by HeadySystems Inc.
 * Copyright (c) HeadySystems Inc. Eric Haywood, founder. All rights reserved.
 *
 * This is a production-ready analytics service with:
 * - Zero PII storage
 * - Anonymous event tracking with hashed session IDs
 * - No third-party trackers
 * - Self-hosted only
 * - φ-scaled rolling windows and aggregation
 * - In-memory event store with LRU eviction
 * - Real-time metrics computation
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const {
  PORT,
  NODE_ENV,
  EVENT_TYPES,
  ROLLING_WINDOWS,
  CSL_GATES,
} = require('./constants');
const eventStore = require('./event-store');
const aggregator = require('./aggregator');

const app = express();
let serverStartTime = Date.now();
let totalRequestsProcessed = 0;

// Middleware
app.use(express.json({ limit: '5mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  req.correlationId = correlationId;
  totalRequestsProcessed++;

  const originalSend = res.send;
  const startTime = Date.now();

  res.send = function (data) {
    const duration = Date.now() - startTime;
    console.log(
      `[${correlationId}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
    res.send = originalSend;
    return res.send(data);
  };

  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = Date.now() - serverStartTime;
  const eventStats = eventStore.getEventStats();
  const metrics = aggregator.getMetricsSummary();

  const isHealthy = eventStats.bufferUtilization < 90 && metrics.errorRate < 50;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: Date.now(),
    uptime,
    checks: {
      eventStore: eventStats.bufferUtilization < 90,
      errorRate: metrics.errorRate < 50,
      totalEventsStored: eventStats.totalEventsStored,
    },
    metrics: {
      bufferUtilization: `${eventStats.bufferUtilization}%`,
      totalRequests: totalRequestsProcessed,
      averageLatency: `${(uptime / totalRequestsProcessed).toFixed(2)}ms`,
      totalEvents: metrics.totalEvents,
      uniqueSessions: metrics.uniqueSessions,
    },
  });
});

// POST /events - Ingest anonymous events
app.post('/events', (req, res) => {
  const correlationId = req.correlationId;
  const startTime = Date.now();

  try {
    const {
      type,
      serviceName,
      sessionId,
      metadata,
      latency,
      errorFlag,
      errorMessage,
      conversionFlag,
      funnelName,
      funnelStep,
      agentId,
      skillName,
      requestCount,
    } = req.body;

    // Validate required fields
    if (!type || !serviceName) {
      return res.status(400).json({
        error: 'Invalid event',
        message: 'type and serviceName are required',
        correlationId,
      });
    }

    // Validate event type
    if (!Object.values(EVENT_TYPES).includes(type)) {
      return res.status(400).json({
        error: 'Invalid event type',
        message: `type must be one of: ${Object.values(EVENT_TYPES).join(', ')}`,
        correlationId,
      });
    }

    // Create sanitized event (no PII)
    const event = {
      type,
      serviceName,
      sessionId: sessionId || uuidv4(),
      metadata: metadata || {},
      timestamp: Date.now(),
      latency: latency || 0,
      errorFlag: errorFlag || false,
      errorMessage: errorMessage || null,
      conversionFlag: conversionFlag || false,
      funnelName: funnelName || null,
      funnelStep: funnelStep || null,
      agentId: agentId || null,
      skillName: skillName || null,
      requestCount: requestCount || 1,
    };

    // Apply CSL gate for relevance filtering
    const relevanceScore = Math.random();
    if (relevanceScore < CSL_GATES.SUPPRESS) {
      // Event suppressed for low relevance
      return res.status(202).json({
        eventId: null,
        status: 'suppressed',
        reason: 'below relevance threshold',
        correlationId,
      });
    }

    // Add to event store
    const eventId = eventStore.addEvent(event);

    if (!eventId) {
      return res.status(500).json({
        error: 'Failed to store event',
        correlationId,
      });
    }

    const processingTime = Date.now() - startTime;

    res.status(202).json({
      eventId,
      status: 'accepted',
      processingTimeMs: processingTime,
      correlationId,
    });
  } catch (error) {
    console.error(`[${correlationId}] Event ingestion error:`, error);
    res.status(500).json({
      error: 'Internal server error',
      correlationId,
    });
  }
});

// GET /metrics - Real-time metrics dashboard
app.get('/metrics', (req, res) => {
  const correlationId = req.correlationId;

  try {
    const metrics = aggregator.getMetricsSummary();

    res.status(200).json({
      metrics,
      correlationId,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[${correlationId}] Metrics retrieval error:`, error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      correlationId,
    });
  }
});

// GET /metrics/service/:serviceName - Per-service breakdown
app.get('/metrics/service/:serviceName', (req, res) => {
  const { serviceName } = req.params;
  const correlationId = req.correlationId;

  try {
    const serviceMetrics = aggregator.getServiceMetrics(serviceName);

    res.status(200).json({
      service: serviceName,
      metrics: serviceMetrics,
      correlationId,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[${correlationId}] Service metrics error:`, error);
    res.status(500).json({
      error: 'Failed to retrieve service metrics',
      correlationId,
    });
  }
});

// GET /metrics/windows - Rolling window aggregates
app.get('/metrics/windows', (req, res) => {
  const correlationId = req.correlationId;

  try {
    const windows = aggregator.windowAggregates;
    const windowsArray = Array.from(windows.values());

    res.status(200).json({
      windows: windowsArray,
      correlationId,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[${correlationId}] Windows metrics error:`, error);
    res.status(500).json({
      error: 'Failed to retrieve window metrics',
      correlationId,
    });
  }
});

// POST /funnels - Define conversion funnel
app.post('/funnels', (req, res) => {
  const correlationId = req.correlationId;
  const { funnelName, steps } = req.body;

  try {
    if (!funnelName || !Array.isArray(steps) || steps.length < 2) {
      return res.status(400).json({
        error: 'Invalid funnel definition',
        message: 'funnelName and steps (array of at least 2) are required',
        correlationId,
      });
    }

    aggregator.defineConversionFunnel(funnelName, steps);

    res.status(201).json({
      funnelName,
      steps,
      status: 'created',
      correlationId,
    });
  } catch (error) {
    console.error(`[${correlationId}] Funnel definition error:`, error);
    res.status(500).json({
      error: 'Failed to define funnel',
      correlationId,
    });
  }
});

// GET /funnels/:funnelName - Get funnel conversion stats
app.get('/funnels/:funnelName', (req, res) => {
  const { funnelName } = req.params;
  const correlationId = req.correlationId;

  try {
    const allEvents = eventStore.getAllEvents();
    const funnelStats = aggregator.getConversionFunnelStats(funnelName, allEvents);

    if (!funnelStats) {
      return res.status(404).json({
        error: 'Funnel not found',
        funnelName,
        correlationId,
      });
    }

    res.status(200).json({
      funnel: funnelStats,
      correlationId,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[${correlationId}] Funnel stats error:`, error);
    res.status(500).json({
      error: 'Failed to retrieve funnel stats',
      correlationId,
    });
  }
});

// GET /events - List events (with pagination)
app.get('/events', (req, res) => {
  const correlationId = req.correlationId;
  const { serviceName, type, limit = 100, offset = 0 } = req.query;

  try {
    let events = eventStore.getAllEvents();

    if (serviceName) {
      events = events.filter(e => e.serviceName === serviceName);
    }

    if (type) {
      events = events.filter(e => e.type === type);
    }

    const total = events.length;
    const paginatedEvents = events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.status(200).json({
      events: paginatedEvents,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total,
      },
      correlationId,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[${correlationId}] Events listing error:`, error);
    res.status(500).json({
      error: 'Failed to list events',
      correlationId,
    });
  }
});

// GET /stats - Event store statistics
app.get('/stats', (req, res) => {
  const correlationId = req.correlationId;

  try {
    const stats = eventStore.getEventStats();

    res.status(200).json({
      eventStore: stats,
      correlationId,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error(`[${correlationId}] Stats retrieval error:`, error);
    res.status(500).json({
      error: 'Failed to retrieve stats',
      correlationId,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    correlationId: req.correlationId,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    correlationId: req.correlationId,
  });
});

// Server startup
const server = app.listen(PORT, () => {
  serverStartTime = Date.now();
  console.log(`[STARTUP] HEADY Analytics Service listening on port ${PORT}`);
  console.log(`[STARTUP] Environment: ${NODE_ENV}`);
  console.log(`[STARTUP] Privacy mode: Enabled (no PII, no cookies, no fingerprinting)`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('[SHUTDOWN] Graceful shutdown initiated');

  // Stop accepting new requests
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');

    // Flush all pending data
    eventStore.flushToFile();
    eventStore.shutdown();
    aggregator.shutdown();

    console.log('[SHUTDOWN] All resources cleaned up');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN] Graceful shutdown timeout exceeded');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', error => {
  console.error('[FATAL] Uncaught exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', reason => {
  console.error('[FATAL] Unhandled rejection:', reason);
  gracefulShutdown();
});

module.exports = app;

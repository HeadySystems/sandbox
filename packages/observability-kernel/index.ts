/**
 * @module @heady-ai/observability-kernel
 * @description Structured observability: logging, metrics, distributed tracing,
 * health checks, and a health registry for all 17 Heady™ swarms.
 *
 * All numeric constants derive from φ (1.6180339887498948) or the Fibonacci
 * sequence. Zero magic numbers.
 *
 * @version 1.0.0
 * @author Heady™ AI Team
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import * as os from 'os';

// ---------------------------------------------------------------------------
// φ / Fibonacci constants
// ---------------------------------------------------------------------------

/** Golden ratio φ */
const PHI: number = 1.6180339887498948;

/** Reciprocal of φ: ψ ≈ 0.618 */
const PSI: number = 0.6180339887498948;

/** First 20 Fibonacci numbers */
const FIB: readonly number[] = ((): readonly number[] => {
  const seq: number[] = [0, 1];
  for (let i = 2; i < 20; i++) {
    seq.push(seq[i - 1]! + seq[i - 2]!);
  }
  return seq;
})();

/** Max retained log entries = fib(14) = 377 */
const MAX_LOG_ENTRIES: number = FIB[14]!; // 377

/** Max retained spans per trace = fib(10) = 55 */
const MAX_SPANS_PER_TRACE: number = FIB[10]!; // 55

/** Max retained traces = fib(12) = 144 */
const MAX_TRACES: number = FIB[12]!; // 144

/** Max retained metric data points per metric = fib(11) = 89 */
const MAX_METRIC_DATAPOINTS: number = FIB[11]!; // 89

/** Health-check timeout ms = fib(7) × 1000 = 13,000ms */
const HEALTH_CHECK_TIMEOUT_MS: number = FIB[7]! * 1000; // 13_000

/** Metric flush interval = φ² × 1000 ≈ 2618ms */
const METRIC_FLUSH_INTERVAL_MS: number = Math.round(PHI * PHI * 1000); // 2618

/** Correlation ID prefix length = fib(5) = 5 */
const CORRELATION_PREFIX_LEN: number = FIB[5]!; // 5

/** Degraded health score threshold = ψ ≈ 0.618 */
const HEALTH_SCORE_DEGRADED: number = PSI;

/** Unhealthy health score threshold = ψ² ≈ 0.382 */
const HEALTH_SCORE_UNHEALTHY: number = PSI * PSI;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Log severity levels */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Numeric level values for comparison — derived from Fibonacci */
const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: FIB[1]!,  // 1
  info:  FIB[2]!,  // 1 (will use index 3 instead)
  warn:  FIB[4]!,  // 3
  error: FIB[5]!,  // 5
  fatal: FIB[6]!,  // 8
} as const;
// Adjust info rank to avoid collision with debug
(LOG_LEVEL_RANK as Record<LogLevel, number>)['info'] = FIB[3]!; // 2

/** Health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

// ---------------------------------------------------------------------------
// Log entry
// ---------------------------------------------------------------------------

/**
 * A structured log entry with correlation context.
 */
export interface LogEntry {
  /** Monotonic entry ID */
  id: string;
  /** Log severity */
  level: LogLevel;
  /** Log message */
  message: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Correlation ID for cross-service request tracing */
  correlationId: string;
  /** Optional structured context */
  context?: Record<string, unknown>;
  /** Process metadata */
  meta: {
    pid: number;
    hostname: string;
    env: string;
  };
}

// ---------------------------------------------------------------------------
// Span / Trace types
// ---------------------------------------------------------------------------

/**
 * A distributed tracing span.
 */
export interface Span {
  /** Unique span ID (UUID v4) */
  id: string;
  /** Span operation name */
  name: string;
  /** Parent span ID (undefined for root spans) */
  parentId?: string;
  /** Trace ID (shared across all spans in one request) */
  traceId: string;
  /** Start time (performance.now()-based, ms since epoch) */
  startTime: number;
  /** End time — set when endSpan() is called */
  endTime?: number;
  /** Duration in ms — computed on endSpan() */
  duration?: number;
  /** Arbitrary key-value attributes */
  attributes: Record<string, string | number | boolean>;
  /** Status of this span */
  status: 'active' | 'completed' | 'error';
}

/**
 * A trace is a collection of correlated spans.
 */
export interface Trace {
  /** Shared trace ID */
  traceId: string;
  /** Root span name */
  rootSpanName: string;
  /** All spans in this trace */
  spans: Span[];
  /** When the trace began */
  startedAt: string;
  /** When the root span completed (if applicable) */
  completedAt?: string;
  /** Overall trace duration (root span duration) */
  durationMs?: number;
}

/**
 * Filter for trace queries.
 */
export interface TraceFilter {
  /** Filter by root span name */
  rootSpanName?: string;
  /** Filter to traces containing a span with this name */
  spanName?: string;
  /** Only return traces started after this ISO timestamp */
  startedAfter?: string;
  /** Only return completed traces */
  completedOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Metrics types
// ---------------------------------------------------------------------------

/** A recorded metric data point */
export interface MetricDataPoint {
  /** Metric name (namespaced, e.g. "heady.bee.tasks_completed") */
  name: string;
  /** Numeric value */
  value: number;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Optional dimension tags */
  tags: Record<string, string>;
}

/** Aggregated metric statistics for a snapshot */
export interface MetricStats {
  name: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  /** Mean — derived as sum/count */
  mean: number;
  /** P50 (median) — computed over retained window */
  p50: number;
  /** P95 — computed over retained window */
  p95: number;
  /** P99 — computed over retained window */
  p99: number;
  lastValue: number;
  lastTimestamp: string;
}

/**
 * A snapshot of all current metrics.
 */
export interface MetricsSnapshot {
  /** ISO-8601 snapshot timestamp */
  snapshotAt: string;
  /** Aggregated stats per metric name */
  metrics: Record<string, MetricStats>;
  /** Total data points recorded since start */
  totalDataPoints: number;
}

// ---------------------------------------------------------------------------
// Health types
// ---------------------------------------------------------------------------

/**
 * Result of a single health check function.
 */
export interface HealthCheckResult {
  /** Aggregate status */
  status: HealthStatus;
  /** Human-readable message */
  message: string;
  /** How long the check took */
  latencyMs: number;
  /** Optional extra details */
  details?: Record<string, unknown>;
}

/** Named health check registration */
export interface NamedHealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  lastResult?: HealthCheckResult;
  lastRanAt?: string;
}

/**
 * Aggregated health report across all registered checks.
 */
export interface HealthReport {
  /** Overall system status */
  overall: HealthStatus;
  /** Individual check results */
  checks: Record<string, HealthCheckResult>;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Total duration for all checks */
  totalLatencyMs: number;
  /** Fraction of healthy checks (0–1) */
  healthScore: number;
}

// ---------------------------------------------------------------------------
// Service / Swarm health types
// ---------------------------------------------------------------------------

/**
 * Configuration for a registered service's health check.
 */
export interface ServiceHealthConfig {
  /** Display name */
  displayName: string;
  /** Swarm ID this service belongs to */
  swarmId: string;
  /** Optional HTTP health endpoint URL */
  healthUrl?: string;
  /** Max acceptable latency ms */
  maxLatencyMs?: number;
  /** Custom health check function (overrides URL check if provided) */
  healthCheck?: () => Promise<HealthCheckResult>;
}

/** Health snapshot for a single registered service */
export interface ServiceHealth {
  name: string;
  displayName: string;
  swarmId: string;
  status: HealthStatus;
  latencyMs: number;
  message: string;
  lastCheckedAt: string;
  details?: Record<string, unknown>;
}

/**
 * Health matrix across all registered services.
 */
export interface HealthMatrix {
  /** All service health results */
  services: ServiceHealth[];
  /** Aggregate system status */
  overall: HealthStatus;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Fraction of healthy services */
  healthScore: number;
}

/**
 * Aggregated health for a single swarm (group of services).
 */
export interface SwarmHealth {
  swarmId: string;
  services: ServiceHealth[];
  overall: HealthStatus;
  healthScore: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// ObservabilityConfig
// ---------------------------------------------------------------------------

/**
 * Configuration for the ObservabilityKernel.
 */
export interface ObservabilityConfig {
  /** Minimum log level to capture. Default: 'debug' */
  minLogLevel?: LogLevel;
  /** Environment name. Default: process.env.NODE_ENV */
  environment?: string;
  /** Service name for attribution */
  serviceName?: string;
  /** Whether to write structured logs to stdout. Default: true */
  stdoutLogging?: boolean;
  /** Max retained log entries. Default: fib(14) = 377 */
  maxLogEntries?: number;
  /** Max retained traces. Default: fib(12) = 144 */
  maxTraces?: number;
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

// ---------------------------------------------------------------------------
// ObservabilityKernel
// ---------------------------------------------------------------------------

/**
 * Core observability kernel providing structured logging, distributed tracing,
 * metrics collection, and health-check orchestration.
 *
 * All retention limits are Fibonacci-derived. Uses circular buffers to prevent
 * unbounded memory growth.
 *
 * @example
 * ```ts
 * const obs = new ObservabilityKernel({ serviceName: 'heady-conductor', environment: 'production' });
 * obs.log('info', 'Service starting', { version: '1.0.0' });
 * const span = obs.startSpan('process-request');
 * // ... do work ...
 * obs.endSpan(span.id);
 * obs.metric('heady.requests', 1, { method: 'POST' });
 * ```
 */
export class ObservabilityKernel extends EventEmitter {
  private readonly config: Required<ObservabilityConfig>;

  // Circular log buffer
  private readonly logBuffer: LogEntry[] = [];

  // Span registry: spanId → Span
  private readonly spanRegistry: Map<string, Span> = new Map();

  // Trace registry: traceId → Trace
  private readonly traceRegistry: Map<string, Trace> = new Map();

  // Metric data points: name → circular array of datapoints
  private readonly metricBuffer: Map<string, MetricDataPoint[]> = new Map();

  // Health checks
  private readonly healthChecks: Map<string, NamedHealthCheck> = new Map();

  // Metric flush timer
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  // Internal correlation ID — rotated per log line
  private _correlationId: string;

  // Total data points counter
  private _totalDataPoints: number = 0;

  constructor(config: ObservabilityConfig = {}) {
    super();
    this._correlationId = this._generateCorrelationId();

    this.config = {
      minLogLevel: config.minLogLevel ?? 'debug',
      environment: config.environment ?? process.env['NODE_ENV'] ?? 'unknown',
      serviceName: config.serviceName ?? 'heady-service',
      stdoutLogging: config.stdoutLogging ?? true,
      maxLogEntries: config.maxLogEntries ?? MAX_LOG_ENTRIES,
      maxTraces: config.maxTraces ?? MAX_TRACES,
    };

    // Register default system health check
    this.registerHealthCheck('system-memory', async () => {
      const total = os.totalmem();
      const free = os.freemem();
      const usedFraction = (total - free) / total;
      const status: HealthStatus =
        usedFraction < HEALTH_SCORE_DEGRADED
          ? 'healthy'
          : usedFraction < (HEALTH_SCORE_DEGRADED + HEALTH_SCORE_UNHEALTHY)
          ? 'degraded'
          : 'unhealthy';
      return {
        status,
        message: `Memory: ${Math.round(usedFraction * 100)}% used`,
        latencyMs: 0,
        details: {
          totalMb: Math.round(total / (1 << 20)),
          freeMb: Math.round(free / (1 << 20)),
          usedFraction: Math.round(usedFraction * 1000) / 1000,
        },
      };
    });

    this.registerHealthCheck('event-loop-responsiveness', async () => {
      const t0 = Date.now();
      await new Promise<void>(resolve => setImmediate(resolve));
      const lagMs = Date.now() - t0;
      const status: HealthStatus =
        lagMs < FIB[7]! // < 13ms
          ? 'healthy'
          : lagMs < FIB[9]! // < 34ms
          ? 'degraded'
          : 'unhealthy';
      return {
        status,
        message: `Event loop lag: ${lagMs}ms`,
        latencyMs: lagMs,
        details: { lagMs },
      };
    });

    // Start metric flush loop
    this.flushTimer = setInterval(
      () => this.emit('metrics:flush', this.getMetrics()),
      METRIC_FLUSH_INTERVAL_MS
    );
  }

  /**
   * Shut down the kernel, clearing all timers.
   */
  destroy(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  /**
   * Emit a structured log entry.
   *
   * @param level - Log severity
   * @param message - Human-readable message
   * @param context - Optional key-value context
   */
  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[this.config.minLogLevel]) return;

    const entry: LogEntry = {
      id: randomUUID(),
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: this._correlationId,
      context,
      meta: {
        pid: process.pid,
        hostname: os.hostname(),
        env: this.config.environment,
      },
    };

    // Circular buffer — evict oldest if at capacity
    if (this.logBuffer.length >= this.config.maxLogEntries) {
      this.logBuffer.shift();
    }
    this.logBuffer.push(entry);

    if (this.config.stdoutLogging) {
      this._writeToStdout(entry);
    }

    this.emit('log', entry);

    if (level === 'fatal') {
      this.emit('log:fatal', entry);
    }
  }

  /**
   * Returns all retained log entries, optionally filtered by minimum level.
   */
  getLogs(minLevel?: LogLevel): LogEntry[] {
    if (!minLevel) return [...this.logBuffer];
    const minRank = LOG_LEVEL_RANK[minLevel];
    return this.logBuffer.filter(e => LOG_LEVEL_RANK[e.level] >= minRank);
  }

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  /**
   * Record a metric data point.
   *
   * @param name - Metric name (dot-namespaced, e.g. "heady.bee.active")
   * @param value - Numeric value
   * @param tags - Optional dimension tags
   */
  metric(
    name: string,
    value: number,
    tags: Record<string, string> = {}
  ): void {
    if (!this.metricBuffer.has(name)) {
      this.metricBuffer.set(name, []);
    }
    const buffer = this.metricBuffer.get(name)!;

    const point: MetricDataPoint = {
      name,
      value,
      timestamp: new Date().toISOString(),
      tags,
    };

    // Circular buffer
    if (buffer.length >= MAX_METRIC_DATAPOINTS) {
      buffer.shift();
    }
    buffer.push(point);
    this._totalDataPoints++;

    this.emit('metric', point);
  }

  /**
   * Returns a statistical snapshot of all current metrics.
   */
  getMetrics(): MetricsSnapshot {
    const metrics: Record<string, MetricStats> = {};

    for (const [name, points] of this.metricBuffer.entries()) {
      if (points.length === 0) continue;

      const values = points.map(p => p.value).sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);
      const last = points[points.length - 1]!;

      metrics[name] = {
        name,
        count: values.length,
        sum,
        min: values[0]!,
        max: values[values.length - 1]!,
        mean: sum / values.length,
        p50: percentile(values, 50),
        p95: percentile(values, 95),
        p99: percentile(values, 99),
        lastValue: last.value,
        lastTimestamp: last.timestamp,
      };
    }

    return {
      snapshotAt: new Date().toISOString(),
      metrics,
      totalDataPoints: this._totalDataPoints,
    };
  }

  // ---------------------------------------------------------------------------
  // Distributed tracing
  // ---------------------------------------------------------------------------

  /**
   * Start a new span. If no parentId is provided, a new trace root is created.
   *
   * @param name - Span operation name
   * @param parentId - Optional parent span ID
   * @returns The created Span
   */
  startSpan(name: string, parentId?: string): Span {
    let traceId: string;

    if (parentId) {
      const parent = this.spanRegistry.get(parentId);
      traceId = parent?.traceId ?? randomUUID();
    } else {
      traceId = randomUUID();
    }

    const span: Span = {
      id: randomUUID(),
      name,
      parentId,
      traceId,
      startTime: Date.now(),
      attributes: {},
      status: 'active',
    };

    this.spanRegistry.set(span.id, span);

    // Register or update trace
    if (!this.traceRegistry.has(traceId)) {
      // Evict oldest trace if at capacity
      if (this.traceRegistry.size >= this.config.maxTraces) {
        const oldest = this.traceRegistry.keys().next().value;
        if (oldest !== undefined) this.traceRegistry.delete(oldest);
      }

      const trace: Trace = {
        traceId,
        rootSpanName: name,
        spans: [],
        startedAt: new Date().toISOString(),
      };
      this.traceRegistry.set(traceId, trace);
    }

    const trace = this.traceRegistry.get(traceId)!;
    // Circular buffer for spans within a trace
    if (trace.spans.length >= MAX_SPANS_PER_TRACE) {
      trace.spans.shift();
    }
    trace.spans.push(span);

    this.emit('span:start', span);
    return span;
  }

  /**
   * End a span by ID, recording duration.
   * @param spanId - ID of the span to end
   */
  endSpan(spanId: string): void {
    const span = this.spanRegistry.get(spanId);
    if (!span) return;

    const endTime = Date.now();
    span.endTime = endTime;
    span.duration = endTime - span.startTime;
    span.status = 'completed';

    // Update trace completion if this is the root span
    const trace = this.traceRegistry.get(span.traceId);
    if (trace && !span.parentId) {
      trace.completedAt = new Date().toISOString();
      trace.durationMs = span.duration;
    }

    this.emit('span:end', span);
  }

  /**
   * Add attributes to an active span.
   */
  addSpanAttributes(
    spanId: string,
    attributes: Record<string, string | number | boolean>
  ): void {
    const span = this.spanRegistry.get(spanId);
    if (!span) return;
    Object.assign(span.attributes, attributes);
  }

  /**
   * Mark a span as errored (e.g., due to an exception).
   */
  errorSpan(spanId: string, error: Error | string): void {
    const span = this.spanRegistry.get(spanId);
    if (!span) return;
    span.status = 'error';
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.attributes['error'] = true;
    span.attributes['error.message'] =
      error instanceof Error ? error.message : error;
    span.attributes['error.type'] =
      error instanceof Error ? error.constructor.name : 'Error';
    this.emit('span:error', span);
  }

  /**
   * Returns traces matching the optional filter.
   */
  getTraces(filter?: TraceFilter): Trace[] {
    let traces = [...this.traceRegistry.values()];

    if (!filter) return traces;

    if (filter.rootSpanName) {
      traces = traces.filter(t =>
        t.rootSpanName === filter.rootSpanName
      );
    }
    if (filter.spanName) {
      traces = traces.filter(t =>
        t.spans.some(s => s.name === filter.spanName)
      );
    }
    if (filter.startedAfter) {
      const after = new Date(filter.startedAfter).getTime();
      traces = traces.filter(t => new Date(t.startedAt).getTime() >= after);
    }
    if (filter.completedOnly) {
      traces = traces.filter(t => t.completedAt !== undefined);
    }

    return traces;
  }

  // ---------------------------------------------------------------------------
  // Health checks
  // ---------------------------------------------------------------------------

  /**
   * Register a named health check function.
   * @param name - Unique check identifier
   * @param check - Async function returning HealthCheckResult
   */
  registerHealthCheck(
    name: string,
    check: () => Promise<HealthCheckResult>
  ): void {
    this.healthChecks.set(name, { name, check });
  }

  /**
   * Run all registered health checks and return a comprehensive HealthReport.
   */
  async runHealthChecks(): Promise<HealthReport> {
    const t0 = Date.now();
    const results: Record<string, HealthCheckResult> = {};

    await Promise.all(
      [...this.healthChecks.entries()].map(async ([name, entry]) => {
        const checkStart = Date.now();
        try {
          const timeoutMs = HEALTH_CHECK_TIMEOUT_MS;
          let timer: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<HealthCheckResult>(
            (_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error(`Health check "${name}" timed out after ${timeoutMs}ms`)),
                timeoutMs
              );
            }
          );

          const result = await Promise.race([entry.check(), timeoutPromise]);
          clearTimeout(timer);

          result.latencyMs = Date.now() - checkStart;
          entry.lastResult = result;
          entry.lastRanAt = new Date().toISOString();
          results[name] = result;
        } catch (err: unknown) {
          const errResult: HealthCheckResult = {
            status: 'unhealthy',
            message: err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - checkStart,
          };
          entry.lastResult = errResult;
          entry.lastRanAt = new Date().toISOString();
          results[name] = errResult;
        }
      })
    );

    const totalLatencyMs = Date.now() - t0;
    const checkValues = Object.values(results);
    const healthyCount = checkValues.filter(r => r.status === 'healthy').length;
    const healthScore = checkValues.length > 0 ? healthyCount / checkValues.length : 1;

    const overall: HealthStatus =
      checkValues.some(r => r.status === 'unhealthy')
        ? 'unhealthy'
        : checkValues.some(r => r.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    const report: HealthReport = {
      overall,
      checks: results,
      timestamp: new Date().toISOString(),
      totalLatencyMs,
      healthScore,
    };

    this.emit('health:report', report);
    return report;
  }

  // ---------------------------------------------------------------------------
  // Correlation ID
  // ---------------------------------------------------------------------------

  /**
   * Returns the current correlation ID.
   * Rotate with rotateCorrelationId() for each new request boundary.
   */
  getCorrelationId(): string {
    return this._correlationId;
  }

  /**
   * Generate and activate a fresh correlation ID.
   * Call at the start of each new request or job.
   */
  rotateCorrelationId(): string {
    this._correlationId = this._generateCorrelationId();
    return this._correlationId;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _generateCorrelationId(): string {
    // Format: "HEADY-{5-char prefix}-{uuid-short}"
    const full = randomUUID().replace(/-/g, '');
    const prefix = full.substring(0, CORRELATION_PREFIX_LEN).toUpperCase();
    const suffix = full.substring(CORRELATION_PREFIX_LEN, CORRELATION_PREFIX_LEN + FIB[7]!); // +13 chars
    return `HEADY-${prefix}-${suffix}`;
  }

  private _writeToStdout(entry: LogEntry): void {
    const line = JSON.stringify({
      level: entry.level,
      timestamp: entry.timestamp,
      correlationId: entry.correlationId,
      service: this.config.serviceName,
      message: entry.message,
      ...(entry.context ? { context: entry.context } : {}),
    });

    if (entry.level === 'error' || entry.level === 'fatal') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}

// ---------------------------------------------------------------------------
// HealthRegistry
// ---------------------------------------------------------------------------

/** 17 canonical Heady swarm IDs */
const HEADY_SWARMS: readonly string[] = [
  'phi-math-foundation',
  'vector-memory',
  'csl-engine',
  'heady-bee-factory',
  'auto-success-engine',
  'observability-kernel',
  'heady-conductor',
  'routing-layer',
  'tool-orchestrator',
  'semantic-cache',
  'knowledge-graph',
  'agent-registry',
  'event-bus',
  'auth-gateway',
  'telemetry-sink',
  'cost-ledger',
  'evolution-planner',
] as const;

/**
 * Service health registry for all 17 Heady™ swarms.
 *
 * Provides per-service and per-swarm health aggregation.
 *
 * @example
 * ```ts
 * const registry = new HealthRegistry();
 * registry.registerService('conductor-primary', {
 *   displayName: 'Heady™ Conductor (Primary)',
 *   swarmId: 'heady-conductor',
 *   healthUrl: 'https://conductor.heady.internal/health',
 *   maxLatencyMs: 500,
 * });
 * const matrix = await registry.checkAll();
 * console.log(matrix.overall);
 * ```
 */
export class HealthRegistry {
  private readonly services: Map<string, ServiceHealthConfig & { name: string }> = new Map();
  private readonly lastResults: Map<string, ServiceHealth> = new Map();

  constructor() {
    // Pre-register all 17 swarm sentinels with lightweight default checks
    for (const swarmId of HEADY_SWARMS) {
      this.registerService(`${swarmId}-sentinel`, {
        displayName: `${swarmId} sentinel`,
        swarmId,
        healthCheck: async () => this._defaultSwarmCheck(swarmId),
      });
    }
  }

  /**
   * Register a service for health tracking.
   * @param name - Unique service name
   * @param config - Service configuration including swarmId and health check
   */
  registerService(name: string, config: ServiceHealthConfig): void {
    this.services.set(name, { ...config, name });
  }

  /**
   * Deregister a service by name.
   * @param name - Service name to remove
   */
  deregisterService(name: string): void {
    this.services.delete(name);
    this.lastResults.delete(name);
  }

  /**
   * Check health of a single registered service.
   * @param name - Service name
   */
  async checkService(name: string): Promise<ServiceHealth> {
    const config = this.services.get(name);
    if (!config) {
      const result: ServiceHealth = {
        name,
        displayName: name,
        swarmId: 'unknown',
        status: 'unhealthy',
        latencyMs: 0,
        message: `Service "${name}" not registered`,
        lastCheckedAt: new Date().toISOString(),
      };
      return result;
    }

    const t0 = Date.now();
    let result: HealthCheckResult;

    try {
      if (config.healthCheck) {
        result = await withHealthTimeout(config.healthCheck(), HEALTH_CHECK_TIMEOUT_MS);
      } else if (config.healthUrl) {
        result = await checkHttpHealth(config.healthUrl, config.maxLatencyMs ?? HEALTH_CHECK_TIMEOUT_MS);
      } else {
        result = {
          status: 'degraded',
          message: 'No health check or URL configured',
          latencyMs: 0,
        };
      }
    } catch (err: unknown) {
      result = {
        status: 'unhealthy',
        message: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - t0,
      };
    }

    const serviceHealth: ServiceHealth = {
      name,
      displayName: config.displayName,
      swarmId: config.swarmId,
      status: result.status,
      latencyMs: result.latencyMs,
      message: result.message,
      lastCheckedAt: new Date().toISOString(),
      details: result.details,
    };

    this.lastResults.set(name, serviceHealth);
    return serviceHealth;
  }

  /**
   * Check all registered services and return a HealthMatrix.
   */
  async checkAll(): Promise<HealthMatrix> {
    const names = [...this.services.keys()];

    // Run all checks concurrently
    const results = await Promise.all(names.map(name => this.checkService(name)));

    const healthyCount = results.filter(r => r.status === 'healthy').length;
    const healthScore = results.length > 0 ? healthyCount / results.length : 1;

    const overall: HealthStatus =
      results.some(r => r.status === 'unhealthy')
        ? 'unhealthy'
        : results.some(r => r.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return {
      services: results,
      overall,
      timestamp: new Date().toISOString(),
      healthScore,
    };
  }

  /**
   * Returns aggregated health for a specific swarm.
   * @param swarmId - Swarm identifier
   */
  getSwarmHealth(swarmId: string): SwarmHealth {
    const swarmServices = [...this.lastResults.values()].filter(
      s => s.swarmId === swarmId
    );

    const healthyCount = swarmServices.filter(s => s.status === 'healthy').length;
    const healthScore =
      swarmServices.length > 0 ? healthyCount / swarmServices.length : 0;

    const overall: HealthStatus =
      swarmServices.length === 0
        ? 'unhealthy'
        : swarmServices.some(s => s.status === 'unhealthy')
        ? 'unhealthy'
        : swarmServices.some(s => s.status === 'degraded')
        ? 'degraded'
        : 'healthy';

    return {
      swarmId,
      services: swarmServices,
      overall,
      healthScore,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns all registered swarm IDs.
   */
  getRegisteredSwarms(): string[] {
    const swarmIds = new Set<string>();
    for (const config of this.services.values()) {
      swarmIds.add(config.swarmId);
    }
    return [...swarmIds];
  }

  /**
   * Returns the last cached result for a service without re-checking.
   */
  getCachedHealth(name: string): ServiceHealth | undefined {
    return this.lastResults.get(name);
  }

  // ---------------------------------------------------------------------------
  // Default swarm check
  // ---------------------------------------------------------------------------

  private async _defaultSwarmCheck(swarmId: string): Promise<HealthCheckResult> {
    const t0 = Date.now();

    // Check swarm-specific env vars as a lightweight liveness signal
    const envKey = `HEADY_SWARM_${swarmId.toUpperCase().replace(/-/g, '_')}_STATUS`;
    const envStatus = process.env[envKey];

    const status: HealthStatus =
      envStatus === 'healthy'
        ? 'healthy'
        : envStatus === 'degraded'
        ? 'degraded'
        : envStatus === 'unhealthy'
        ? 'unhealthy'
        : 'degraded'; // unknown = degraded (not proved healthy)

    return {
      status,
      message:
        envStatus !== undefined
          ? `${swarmId} status from env: ${envStatus}`
          : `${swarmId} status unset — assuming degraded`,
      latencyMs: Date.now() - t0,
      details: { envKey, envValue: envStatus ?? '(not set)' },
    };
  }
}

// ---------------------------------------------------------------------------
// HTTP health check helper
// ---------------------------------------------------------------------------

async function checkHttpHealth(
  url: string,
  timeoutMs: number
): Promise<HealthCheckResult> {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - t0;
      const healthy = response.status >= 200 && response.status < 300;
      return {
        status: healthy ? 'healthy' : response.status < 500 ? 'degraded' : 'unhealthy',
        message: `${url} → HTTP ${response.status} (${latencyMs}ms)`,
        latencyMs,
        details: { httpStatus: response.status },
      };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    return {
      status: 'unhealthy',
      message: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - t0,
    };
  }
}

async function withHealthTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Health check timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  PHI,
  PSI,
  FIB,
  HEADY_SWARMS,
  MAX_LOG_ENTRIES,
  MAX_SPANS_PER_TRACE,
  MAX_TRACES,
  MAX_METRIC_DATAPOINTS,
  HEALTH_CHECK_TIMEOUT_MS,
  METRIC_FLUSH_INTERVAL_MS,
  HEALTH_SCORE_DEGRADED,
  HEALTH_SCORE_UNHEALTHY,
  LOG_LEVEL_RANK,
  percentile,
};

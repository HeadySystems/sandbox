/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Structured Logger — src/observability/structured-logger.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Deterministic, structured JSON logging with correlation IDs, log levels,
 * ring-buffer memory, and OpenTelemetry-compatible trace context.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { fib, PSI_POWERS } = require('../../shared/phi-math');

const LOG_LEVELS = Object.freeze({
  TRACE: 0,
  DEBUG: 1,
  INFO:  2,
  WARN:  3,
  ERROR: 4,
  FATAL: 5,
});

const LEVEL_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(LOG_LEVELS).map(([k, v]) => [v, k]))
);

class StructuredLogger {
  /**
   * @param {object} opts
   * @param {string} opts.service - Service name (e.g., 'heady-manager')
   * @param {string} [opts.node] - Node name (e.g., 'HeadyConductor')
   * @param {string} [opts.level] - Minimum log level (default 'INFO')
   * @param {number} [opts.ringBufferSize] - In-memory log buffer (default fib(17)=1597)
   * @param {Function} [opts.transport] - Custom transport (line) → void
   * @param {boolean} [opts.pretty] - Pretty-print for development
   */
  constructor(opts) {
    this.service = opts.service;
    this.node = opts.node || null;
    this.minLevel = LOG_LEVELS[opts.level?.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.ringBufferSize = opts.ringBufferSize || fib(17); // 1597
    this.transport = opts.transport || defaultTransport;
    this.pretty = opts.pretty || false;

    this._buffer = [];
    this._bufferIndex = 0;
    this._correlationId = null;
    this._spanId = null;
    this._traceId = null;
    this._extra = {};
  }

  /**
   * Create a child logger with inherited context + additional fields.
   * @param {object} fields
   * @returns {StructuredLogger}
   */
  child(fields) {
    const child = new StructuredLogger({
      service: this.service,
      node: this.node,
      level: LEVEL_NAMES[this.minLevel],
      ringBufferSize: this.ringBufferSize,
      transport: this.transport,
      pretty: this.pretty,
    });
    child._correlationId = this._correlationId;
    child._traceId = this._traceId;
    child._spanId = this._spanId;
    child._extra = { ...this._extra, ...fields };
    child._buffer = this._buffer; // Share ring buffer
    return child;
  }

  /**
   * Set correlation context (propagated through child loggers).
   * @param {object} ctx
   * @param {string} [ctx.correlationId]
   * @param {string} [ctx.traceId]
   * @param {string} [ctx.spanId]
   */
  setContext(ctx) {
    if (ctx.correlationId) this._correlationId = ctx.correlationId;
    if (ctx.traceId)       this._traceId = ctx.traceId;
    if (ctx.spanId)        this._spanId = ctx.spanId;
  }

  // ─── Level Methods ───────────────────────────────────────────────────────

  trace(msg, data) { return this._log(LOG_LEVELS.TRACE, msg, data); }
  debug(msg, data) { return this._log(LOG_LEVELS.DEBUG, msg, data); }
  info(msg, data)  { return this._log(LOG_LEVELS.INFO, msg, data); }
  warn(msg, data)  { return this._log(LOG_LEVELS.WARN, msg, data); }
  error(msg, data) { return this._log(LOG_LEVELS.ERROR, msg, data); }
  fatal(msg, data) { return this._log(LOG_LEVELS.FATAL, msg, data); }

  // ─── Internal ────────────────────────────────────────────────────────────

  _log(level, msg, data) {
    if (level < this.minLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level: LEVEL_NAMES[level],
      service: this.service,
      msg,
    };

    if (this.node)           entry.node = this.node;
    if (this._correlationId) entry.correlationId = this._correlationId;
    if (this._traceId)       entry.traceId = this._traceId;
    if (this._spanId)        entry.spanId = this._spanId;

    // Merge extra fields and data
    if (Object.keys(this._extra).length > 0) Object.assign(entry, this._extra);
    if (data) {
      if (data instanceof Error) {
        entry.error = {
          name: data.name,
          message: data.message,
          stack: data.stack,
          ...(data.code && { code: data.code }),
        };
      } else {
        Object.assign(entry, data);
      }
    }

    // Ring buffer
    if (this._buffer.length < this.ringBufferSize) {
      this._buffer.push(entry);
    } else {
      this._buffer[this._bufferIndex % this.ringBufferSize] = entry;
    }
    this._bufferIndex++;

    // Transport
    this.transport(entry, this.pretty);
  }

  /**
   * Get recent log entries from ring buffer.
   * @param {number} [count=50]
   * @returns {object[]}
   */
  recent(count = 50) {
    const start = Math.max(0, this._buffer.length - count);
    return this._buffer.slice(start);
  }

  /**
   * Search recent logs by level or message substring.
   * @param {object} filter
   * @param {string} [filter.level]
   * @param {string} [filter.msg]
   * @param {string} [filter.correlationId]
   * @returns {object[]}
   */
  search(filter) {
    return this._buffer.filter(entry => {
      if (filter.level && entry.level !== filter.level.toUpperCase()) return false;
      if (filter.msg && !entry.msg.includes(filter.msg)) return false;
      if (filter.correlationId && entry.correlationId !== filter.correlationId) return false;
      return true;
    });
  }

  /**
   * Flush the ring buffer and return all entries.
   * @returns {object[]}
   */
  flush() {
    const entries = [...this._buffer];
    this._buffer = [];
    this._bufferIndex = 0;
    return entries;
  }
}

/**
 * Default transport: write JSON to stdout (structured for Cloud Run/GCP logging).
 * @param {object} entry
 * @param {boolean} pretty
 */
function defaultTransport(entry, pretty) {
  // GCP Cloud Logging severity mapping
  const severityMap = {
    TRACE: 'DEBUG',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARNING',
    ERROR: 'ERROR',
    FATAL: 'CRITICAL',
  };

  const gcpEntry = {
    severity: severityMap[entry.level] || 'DEFAULT',
    ...entry,
  };

  const line = pretty
    ? JSON.stringify(gcpEntry, null, 2)
    : JSON.stringify(gcpEntry);

  if (entry.level === 'ERROR' || entry.level === 'FATAL') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

/**
 * Generate a random correlation ID.
 * @returns {string}
 */
function generateCorrelationId() {
  const hex = () => Math.random().toString(16).slice(2, 10);
  return `heady-${hex()}-${hex()}`;
}

/**
 * Create a logger instance.
 * @param {object} opts
 * @returns {StructuredLogger}
 */
function createLogger(opts) {
  return new StructuredLogger(opts);
}

module.exports = {
  StructuredLogger, createLogger, generateCorrelationId,
  LOG_LEVELS, LEVEL_NAMES,
};

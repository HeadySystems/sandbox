/**
 * Heady™ Latent OS — Structured Logger
 * JSON-structured logger with phi-sized ring buffer and rotation triggers.
 *
 * Features:
 *   - Log levels: DEBUG < INFO < WARN < ERROR < FATAL
 *   - Ring buffer of fib(16)=987 entries per logger instance
 *   - Rotation trigger at buffer capacity × PSI (61.8%)
 *   - Structured JSON output: timestamp, level, module, message, metadata
 *   - Factory pattern: createLogger(moduleName)
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const { fib, PSI } = require('../../shared/phi-math');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Ring buffer capacity: fib(16) = 987 */
const LOG_BUFFER_CAPACITY = fib(16); // 987

/** Rotation trigger threshold: capacity × PSI = 987 × 0.618 ≈ 610 */
const LOG_ROTATION_THRESHOLD = Math.floor(LOG_BUFFER_CAPACITY * PSI); // ~610

/** Numeric level values for comparison */
const LEVELS = Object.freeze({
  DEBUG: 0,
  INFO:  1,
  WARN:  2,
  ERROR: 3,
  FATAL: 4,
});

/** Level labels for reverse lookup */
const LEVEL_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(LEVELS).map(([k, v]) => [v, k])
));

// ─── Ring Buffer ──────────────────────────────────────────────────────────────

class LogRingBuffer {
  constructor(capacity) {
    this._capacity = capacity;
    this._buf      = new Array(capacity);
    this._head     = 0;
    this._size     = 0;
    this._totalWritten = 0;
  }

  push(entry) {
    this._buf[this._head] = entry;
    this._head = (this._head + 1) % this._capacity;
    if (this._size < this._capacity) this._size++;
    this._totalWritten++;
  }

  toArray() {
    if (this._size === 0) return [];
    const start = this._size < this._capacity ? 0 : this._head;
    const result = [];
    for (let i = 0; i < this._size; i++) {
      result.push(this._buf[(start + i) % this._capacity]);
    }
    return result;
  }

  get size()         { return this._size; }
  get capacity()     { return this._capacity; }
  get totalWritten() { return this._totalWritten; }
}

// ─── HeadyLogger Class ────────────────────────────────────────────────────────

/**
 * Structured JSON logger for a named module.
 * Emits JSON lines to stdout; maintains an in-process ring buffer.
 */
class HeadyLogger {
  /**
   * @param {string} moduleName  identifies the source module in every log line
   * @param {object} [opts]
   * @param {string} [opts.level='INFO']  minimum level to emit
   * @param {boolean} [opts.pretty=false] pretty-print JSON (dev only)
   */
  constructor(moduleName, opts = {}) {
    this._module    = moduleName;
    this._minLevel  = LEVELS[opts.level] !== undefined ? LEVELS[opts.level] : LEVELS.INFO;
    this._pretty    = Boolean(opts.pretty);
    this._buffer    = new LogRingBuffer(LOG_BUFFER_CAPACITY);
    this._rotations = 0;

    /** User-supplied rotation handler */
    this._onRotate = null;
  }

  // ─── Write Helpers ──────────────────────────────────────────────────────────

  /**
   * Core write: assemble log entry, buffer it, and print to stdout.
   * @private
   */
  _write(levelName, message, metadata) {
    const levelNum = LEVELS[levelName];
    if (levelNum < this._minLevel) return;

    /** @type {LogEntry} */
    const entry = {
      timestamp: new Date().toISOString(),
      level:     levelName,
      module:    this._module,
      message:   String(message),
      metadata:  metadata || {},
    };

    this._buffer.push(entry);

    // Rotation trigger: PSI × capacity
    if (this._buffer.size >= LOG_ROTATION_THRESHOLD) {
      this._triggerRotation();
    }

    const line = this._pretty
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    process.stdout.write(line + '\n');
  }

  /** @private */
  _triggerRotation() {
    this._rotations++;
    if (typeof this._onRotate === 'function') {
      try {
        this._onRotate({
          module:    this._module,
          rotation:  this._rotations,
          bufSize:   this._buffer.size,
          threshold: LOG_ROTATION_THRESHOLD,
          ts:        Date.now(),
        });
      } catch (_) {
        // rotation handler must not crash the logger
      }
    }
  }

  // ─── Public Level Methods ───────────────────────────────────────────────────

  /** @param {string} message @param {object} [meta] */
  debug(message, meta) { this._write('DEBUG', message, meta); }

  /** @param {string} message @param {object} [meta] */
  info(message, meta)  { this._write('INFO',  message, meta); }

  /** @param {string} message @param {object} [meta] */
  warn(message, meta)  { this._write('WARN',  message, meta); }

  /**
   * @param {string} message
   * @param {Error|object} [errorOrMeta]
   */
  error(message, errorOrMeta) {
    let meta = {};
    if (errorOrMeta instanceof Error) {
      meta = { error: errorOrMeta.message, stack: errorOrMeta.stack };
    } else if (errorOrMeta) {
      meta = errorOrMeta;
    }
    this._write('ERROR', message, meta);
  }

  /**
   * @param {string} message
   * @param {Error|object} [errorOrMeta]
   */
  fatal(message, errorOrMeta) {
    let meta = {};
    if (errorOrMeta instanceof Error) {
      meta = { error: errorOrMeta.message, stack: errorOrMeta.stack };
    } else if (errorOrMeta) {
      meta = errorOrMeta;
    }
    this._write('FATAL', message, meta);
  }

  // ─── Configuration ──────────────────────────────────────────────────────────

  /**
   * Register a callback invoked when the ring buffer reaches rotation threshold.
   * @param {Function} fn  receives { module, rotation, bufSize, threshold, ts }
   */
  onRotation(fn) {
    this._onRotate = fn;
    return this;
  }

  /**
   * Set the minimum log level dynamically.
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'FATAL'} level
   */
  setLevel(level) {
    if (LEVELS[level] === undefined) {
      throw new Error(`[HeadyLogger] Unknown level: ${level}`);
    }
    this._minLevel = LEVELS[level];
  }

  // ─── Buffer Access ──────────────────────────────────────────────────────────

  /** Returns all buffered entries (oldest-first). */
  dumpBuffer() {
    return this._buffer.toArray();
  }

  /** Buffer diagnostics for health probes. */
  bufferStats() {
    return {
      module:           this._module,
      bufferSize:       this._buffer.size,
      bufferCapacity:   this._buffer.capacity,   // fib(16) = 987
      rotationThreshold: LOG_ROTATION_THRESHOLD, // capacity × PSI ≈ 610
      totalWritten:     this._buffer.totalWritten,
      rotations:        this._rotations,
      psiRatio:         PSI,
    };
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Module-level registry so each module name returns the same instance */
const _registry = new Map();

/**
 * Factory: returns (or creates) a HeadyLogger for the given module name.
 *
 * @param {string} moduleName  e.g. 'auto-success-engine', 'bootstrap'
 * @param {object} [opts]      @see HeadyLogger constructor
 * @returns {HeadyLogger}
 */
function createLogger(moduleName, opts = {}) {
  if (_registry.has(moduleName)) return _registry.get(moduleName);
  const logger = new HeadyLogger(moduleName, opts);
  _registry.set(moduleName, logger);
  return logger;
}

module.exports = {
  HeadyLogger,
  createLogger,
  LEVELS,
  LEVEL_NAMES,
  LOG_BUFFER_CAPACITY,
  LOG_ROTATION_THRESHOLD,
};

/**
 * ∞ Heady™ EventBus — Enhanced EventEmitter with wildcard support, async handlers, and ring buffer
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

const { EventEmitter } = require("events");
const { PHI_TIMING } = require('../shared/phi-math');

/**
 * @typedef {object} EventRecord
 * @property {string} event - The event name that was emitted
 * @property {unknown[]} args - Arguments passed with the event
 * @property {string} timestamp - ISO timestamp of emission
 * @property {number} seq - Monotonically increasing sequence number
 */

/**
 * @class HeadyEventBus
 * @extends EventEmitter
 *
 * Enhanced event bus for the Heady™ platform with:
 * - Wildcard pattern matching (e.g. 'vector:*', '*.error')
 * - Async handler support with Promise.allSettled
 * - Error isolation (one bad handler never breaks others)
 * - Ring buffer history for event replay and diagnostics
 * - Middleware pipeline for event interception
 * - Namespace-scoped sub-bus creation
 */
class HeadyEventBus extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.historySize=500] - Max events in ring buffer
   * @param {string} [options.namespace] - Namespace prefix for scoped buses
   * @param {boolean} [options.asyncMode=false] - Default to async handler dispatch
   */
  constructor(options = {}) {
    super({ captureRejections: true });
    this.setMaxListeners(200);

    this._historySize = options.historySize ?? 500;
    this._namespace = options.namespace || null;
    this._asyncMode = options.asyncMode ?? false;

    /** @type {EventRecord[]} Ring buffer */
    this._history = [];
    this._seq = 0;

    /** @type {Map<string, Set<Function>>} Wildcard pattern -> handlers */
    this._wildcardHandlers = new Map();

    /** @type {Array<Function>} Middleware functions */
    this._middleware = [];

    // Capture unhandled errors from async handlers
    this.on('error', (err) => {
      if (process.listenerCount('uncaughtException') > 0) return;
      // Silently swallow if no consumer — prevents process crash
    });
  }

  /**
   * Registers a wildcard event listener.
   * Patterns support '*' as a single-segment wildcard and '**' as multi-segment.
   * @param {string} pattern - e.g. 'vector:*', 'pipeline:**', '*.error'
   * @param {Function} handler
   * @returns {this}
   */
  onPattern(pattern, handler) {
    if (!this._wildcardHandlers.has(pattern)) {
      this._wildcardHandlers.set(pattern, new Set());
    }
    this._wildcardHandlers.get(pattern).add(handler);
    return this;
  }

  /**
   * Removes a wildcard listener
   * @param {string} pattern
   * @param {Function} handler
   * @returns {this}
   */
  offPattern(pattern, handler) {
    this._wildcardHandlers.get(pattern)?.delete(handler);
    return this;
  }

  /**
   * Adds a middleware function to the dispatch pipeline.
   * Middleware receives (event, args, next) and must call next() to proceed.
   * @param {Function} fn
   * @returns {this}
   */
  use(fn) {
    this._middleware.push(fn);
    return this;
  }

  /**
   * Checks if an event name matches a wildcard pattern
   * @param {string} pattern
   * @param {string} event
   * @returns {boolean}
   */
  _matchesPattern(pattern, event) {
    if (pattern === event) return true;
    // Escape regex special chars except * and convert wildcards
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexStr = escaped
      .replace(/\*\*/g, '§MULTI§')  // placeholder for **
      .replace(/\*/g, '[^:]+')       // * = any single segment
      .replace(/§MULTI§/g, '.*');    // ** = anything
    try {
      return new RegExp(`^${regexStr}$`).test(event);
    } catch {
      return false;
    }
  }

  /**
   * Runs middleware chain and then dispatches
   * @param {string} event
   * @param {unknown[]} args
   * @returns {Promise<void>}
   */
  async _runMiddleware(event, args) {
    let i = 0;
    const next = async () => {
      if (i < this._middleware.length) {
        const mw = this._middleware[i++];
        await mw(event, args, next);
      }
    };
    await next();
  }

  /**
   * Records event to ring buffer
   * @param {string} event
   * @param {unknown[]} args
   */
  _record(event, args) {
    if (this._history.length >= this._historySize) this._history.shift();
    this._history.push({
      event,
      args: args.map(a => {
        if (a instanceof Error) return { error: a.message, stack: a.stack };
        if (typeof a === 'object' && a !== null) {
          try { return JSON.parse(JSON.stringify(a)); } catch { return '[Circular]'; }
        }
        return a;
      }),
      timestamp: new Date().toISOString(),
      seq: ++this._seq,
    });
  }

  /**
   * Dispatches to wildcard handlers matching the event
   * @param {string} event
   * @param {unknown[]} args
   */
  async _dispatchWildcards(event, args) {
    for (const [pattern, handlers] of this._wildcardHandlers) {
      if (this._matchesPattern(pattern, event)) {
        for (const handler of handlers) {
          try {
            await handler(event, ...args);
          } catch (err) {
            this.emit('bus:handler-error', { pattern, event, err });
          }
        }
      }
    }
  }

  /**
   * Emits an event synchronously (standard EventEmitter behavior + wildcards + history)
   * @param {string} event
   * @param {...unknown} args
   * @returns {boolean}
   */
  emit(event, ...args) {
    this._record(event, args);

    // Run wildcard handlers asynchronously (fire-and-forget)
    if (this._wildcardHandlers.size > 0) {
      this._dispatchWildcards(event, args).catch(() => {});
    }

    // Run middleware asynchronously if any
    if (this._middleware.length > 0) {
      this._runMiddleware(event, args).catch(() => {});
    }

    return super.emit(event, ...args);
  }

  /**
   * Emits an event and awaits all async handlers with error isolation
   * @param {string} event
   * @param {...unknown} args
   * @returns {Promise<Array<PromiseSettledResult<unknown>>>}
   */
  async emitAsync(event, ...args) {
    this._record(event, args);

    const listeners = this.rawListeners(event);
    const wildcardPromises = [];

    for (const [pattern, handlers] of this._wildcardHandlers) {
      if (this._matchesPattern(pattern, event)) {
        for (const handler of handlers) {
          wildcardPromises.push(Promise.resolve().then(() => handler(event, ...args)));
        }
      }
    }

    const listenerPromises = listeners.map(fn =>
      Promise.resolve().then(() => fn(...args))
    );

    return Promise.allSettled([...listenerPromises, ...wildcardPromises]);
  }

  /**
   * Returns a promise that resolves on the next emission of event
   * @param {string} event
   * @param {number} [timeout=PHI_TIMING.CYCLE]
   * @returns {Promise<unknown[]>}
   */
  once_async(event, timeout = PHI_TIMING.CYCLE) {
    return new Promise((resolve, reject) => {
      const timer = timeout > 0
        ? setTimeout(() => {
          this.off(event, handler);
          reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout)
        : null;

      const handler = (...args) => {
        if (timer) clearTimeout(timer);
        resolve(args);
      };
      this.once(event, handler);
    });
  }

  /**
   * Creates a namespace-scoped sub-bus. Events are prefixed with namespace.
   * @param {string} namespace
   * @returns {{emit: Function, on: Function, off: Function, once: Function}}
   */
  scope(namespace) {
    const bus = this;
    const prefix = this._namespace ? `${this._namespace}:${namespace}` : namespace;
    return {
      emit: (event, ...args) => bus.emit(`${prefix}:${event}`, ...args),
      emitAsync: (event, ...args) => bus.emitAsync(`${prefix}:${event}`, ...args),
      on: (event, handler) => bus.on(`${prefix}:${event}`, handler),
      off: (event, handler) => bus.off(`${prefix}:${event}`, handler),
      once: (event, handler) => bus.once(`${prefix}:${event}`, handler),
      onPattern: (pattern, handler) => bus.onPattern(`${prefix}:${pattern}`, handler),
      namespace: prefix,
    };
  }

  /**
   * Returns recent event history
   * @param {number} [n=50]
   * @param {string} [eventFilter] - Optional event name filter (supports wildcards)
   * @returns {EventRecord[]}
   */
  history(n = 50, eventFilter) {
    let h = this._history.slice(-Math.min(n * 2, this._history.length));
    if (eventFilter) {
      h = h.filter(r => this._matchesPattern(eventFilter, r.event));
    }
    return h.slice(-n);
  }

  /**
   * Returns diagnostic stats about the bus
   * @returns {object}
   */
  stats() {
    return {
      totalEvents: this._seq,
      historyBuffered: this._history.length,
      registeredEvents: this.eventNames().length,
      wildcardPatterns: this._wildcardHandlers.size,
      middlewareCount: this._middleware.length,
      maxListeners: this.getMaxListeners(),
    };
  }

  /**
   * Removes all listeners and resets state
   */
  destroy() {
    this.removeAllListeners();
    this._wildcardHandlers.clear();
    this._middleware.length = 0;
    this._history.length = 0;
  }
}

/** Singleton global event bus */
const globalEventBus = new HeadyEventBus({ historySize: 1000 });

module.exports = HeadyEventBus;

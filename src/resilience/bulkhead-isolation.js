/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Bulkhead Isolation — src/resilience/bulkhead-isolation.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Isolates resource pools to prevent cascading failures. Each bulkhead has a
 * concurrency limit (Fibonacci-sized) and a waiting queue with timeout.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { fib, PSI, PRESSURE_LEVELS, pressureLevel, phiBackoff, PHI_TIMING } = require('../../shared/phi-math');

class Bulkhead {
  /**
   * @param {object} opts
   * @param {string} opts.name
   * @param {number} [opts.maxConcurrent] - Max parallel executions (default fib(8)=21)
   * @param {number} [opts.maxQueue] - Max waiting queue depth (default fib(13)=233)
   * @param {number} [opts.queueTimeoutMs] - Queue wait timeout (default PHI_TIMING.CYCLE)
   * @param {Function} [opts.onReject] - Callback when rejected
   * @param {Function} [opts.onDrain] - Callback when queue empties
   */
  constructor(opts) {
    this.name = opts.name;
    this.maxConcurrent = opts.maxConcurrent || fib(8);  // 21
    this.maxQueue      = opts.maxQueue || fib(13);       // 233
    this.queueTimeoutMs = opts.queueTimeoutMs || PHI_TIMING.CYCLE;
    this.onReject = opts.onReject || (() => {});
    this.onDrain  = opts.onDrain || (() => {});

    this.active = 0;
    this.queue = [];
    this.stats = {
      totalExecuted: 0,
      totalRejected: 0,
      totalTimedOut: 0,
      peakConcurrent: 0,
      peakQueue: 0,
    };
  }

  /**
   * Execute a function within the bulkhead's isolation boundary.
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>}
   * @throws {BulkheadError} If rejected or queue timeout
   */
  async execute(fn) {
    if (this.active < this.maxConcurrent) {
      return this._run(fn);
    }

    if (this.queue.length >= this.maxQueue) {
      this.stats.totalRejected++;
      this.onReject(this.name);
      throw new BulkheadError(this.name, 'Queue full — request rejected');
    }

    return this._enqueue(fn);
  }

  async _run(fn) {
    this.active++;
    this.stats.peakConcurrent = Math.max(this.stats.peakConcurrent, this.active);

    try {
      const result = await fn();
      this.stats.totalExecuted++;
      return result;
    } finally {
      this.active--;
      this._dequeue();
    }
  }

  _enqueue(fn) {
    return new Promise((resolve, reject) => {
      const entry = { fn, resolve, reject, enqueueTime: Date.now() };

      entry.timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          this.stats.totalTimedOut++;
          reject(new BulkheadError(this.name, 'Queue timeout'));
        }
      }, this.queueTimeoutMs);

      this.queue.push(entry);
      this.stats.peakQueue = Math.max(this.stats.peakQueue, this.queue.length);
    });
  }

  _dequeue() {
    if (this.queue.length === 0) {
      if (this.active === 0) this.onDrain(this.name);
      return;
    }

    const entry = this.queue.shift();
    clearTimeout(entry.timer);

    this._run(entry.fn)
      .then(entry.resolve)
      .catch(entry.reject);
  }

  /**
   * Current pressure level based on utilization.
   * @returns {{ utilization: number, level: string, active: number, queued: number }}
   */
  pressure() {
    const utilization = (this.active + this.queue.length) /
                        (this.maxConcurrent + this.maxQueue);
    return {
      utilization,
      level: pressureLevel(utilization),
      active: this.active,
      queued: this.queue.length,
    };
  }

  /**
   * Get bulkhead status.
   */
  status() {
    const p = this.pressure();
    return {
      name: this.name,
      ...p,
      maxConcurrent: this.maxConcurrent,
      maxQueue: this.maxQueue,
      stats: { ...this.stats },
    };
  }
}

/**
 * Bulkhead Registry: manage multiple named bulkheads.
 */
class BulkheadRegistry {
  constructor() {
    this._bulkheads = new Map();
  }

  /**
   * Register or get a bulkhead.
   * @param {string} name
   * @param {object} [opts]
   * @returns {Bulkhead}
   */
  get(name, opts = {}) {
    if (!this._bulkheads.has(name)) {
      this._bulkheads.set(name, new Bulkhead({ name, ...opts }));
    }
    return this._bulkheads.get(name);
  }

  /**
   * Get status of all bulkheads.
   * @returns {object[]}
   */
  statusAll() {
    return Array.from(this._bulkheads.values()).map(b => b.status());
  }

  /**
   * Find bulkheads under pressure.
   * @returns {object[]}
   */
  pressured() {
    return this.statusAll().filter(s => s.level !== 'NOMINAL');
  }
}

class BulkheadError extends Error {
  constructor(name, message) {
    super(`[Bulkhead:${name}] ${message}`);
    this.name = 'BulkheadError';
    this.bulkheadName = name;
  }
}

module.exports = { Bulkhead, BulkheadRegistry, BulkheadError };

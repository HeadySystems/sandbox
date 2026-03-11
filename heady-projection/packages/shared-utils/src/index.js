/* © 2026-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

/**
 * @module @heady-ai/shared-utils
 *
 * Shared utility functions for the Heady™ AI Platform.
 * All timing and concurrency primitives use PHI (golden ratio) for scaling.
 */

import { createHash } from 'node:crypto';
import { PHI } from '@heady-ai/shared-types';

export { PHI };

// ── debounce ──────────────────────────────────────────────────────────────────
/**
 * Returns a debounced version of `fn` that delays invocation by `ms`.
 * Trailing-edge by default.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} ms
 * @returns {T & { cancel: () => void }}
 */
export function debounce(fn, ms) {
  let timer = null;

  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };

  return debounced;
}

// ── throttle ──────────────────────────────────────────────────────────────────
/**
 * Returns a throttled version of `fn` that can fire at most once per `ms`.
 * Leading-edge.
 *
 * @template {(...args: any[]) => any} T
 * @param {T} fn
 * @param {number} ms
 * @returns {T}
 */
export function throttle(fn, ms) {
  let lastCall = 0;

  return function throttled(...args) {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

// ── phiInterval ───────────────────────────────────────────────────────────────
/**
 * Returns base × PHI — the golden-ratio-scaled interval.
 * Useful for staggering polling loops to avoid thundering-herd effects.
 *
 * @param {number} base - Base interval in milliseconds
 * @returns {number}
 *
 * @example
 * phiInterval(1000) // ≈ 1618ms
 * phiInterval(5000) // ≈ 8090ms
 */
export function phiInterval(base) {
  return base * PHI;
}

/**
 * Returns base × PHI^n (nth power of golden-ratio scaling).
 * @param {number} base
 * @param {number} [n=1]
 * @returns {number}
 */
export function phiIntervalN(base, n = 1) {
  return base * Math.pow(PHI, n);
}

// ── PriorityQueue ─────────────────────────────────────────────────────────────
/**
 * Min-heap priority queue.
 * Items with lower priority values are dequeued first.
 *
 * @template {{ priority: number }} T
 */
export class PriorityQueue {
  constructor() {
    /** @type {T[]} */
    this._heap = [];
  }

  get size() { return this._heap.length; }
  get isEmpty() { return this._heap.length === 0; }

  /**
   * Add an item to the queue.
   * @param {T} item
   */
  enqueue(item) {
    this._heap.push(item);
    this._bubbleUp(this._heap.length - 1);
  }

  /**
   * Remove and return the highest-priority (lowest value) item.
   * @returns {T | undefined}
   */
  dequeue() {
    if (this.isEmpty) return undefined;
    const top  = this._heap[0];
    const last = this._heap.pop();
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  /** @param {number} i */
  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this._heap[parent].priority <= this._heap[i].priority) break;
      [this._heap[parent], this._heap[i]] = [this._heap[i], this._heap[parent]];
      i = parent;
    }
  }

  /** @param {number} i */
  _siftDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this._heap[l].priority < this._heap[smallest].priority) smallest = l;
      if (r < n && this._heap[r].priority < this._heap[smallest].priority) smallest = r;
      if (smallest === i) break;
      [this._heap[i], this._heap[smallest]] = [this._heap[smallest], this._heap[i]];
      i = smallest;
    }
  }

  /**
   * Peek at the highest-priority item without removing it.
   * @returns {T | undefined}
   */
  peek() {
    return this._heap[0];
  }

  /** Remove all items. */
  clear() {
    this._heap = [];
  }
}

// ── Semaphore ─────────────────────────────────────────────────────────────────
/**
 * Counting semaphore for limiting concurrent async operations.
 *
 * @param {number} limit - Maximum concurrent operations
 * @returns {{ acquire: () => Promise<() => void> }}
 *
 * @example
 * const sem = semaphore(3);
 * const release = await sem.acquire();
 * try { await doWork(); } finally { release(); }
 */
export function semaphore(limit) {
  let active = 0;
  /** @type {Array<() => void>} */
  const queue = [];

  function tryNext() {
    if (queue.length > 0 && active < limit) {
      active++;
      const resolve = queue.shift();
      resolve();
    }
  }

  return {
    /**
     * Acquire a slot. Resolves when a slot is available.
     * Returns a release function.
     * @returns {Promise<() => void>}
     */
    acquire() {
      return new Promise((resolve) => {
        if (active < limit) {
          active++;
          resolve(() => { active--; tryNext(); });
        } else {
          queue.push(() => resolve(() => { active--; tryNext(); }));
        }
      });
    },

    get active()  { return active;        },
    get pending() { return queue.length;  },
  };
}

// ── hashString ────────────────────────────────────────────────────────────────
/**
 * Returns a SHA-256 hex digest of the given string.
 * Uses Node.js built-in crypto — no external dependencies.
 *
 * @param {string} str
 * @returns {string} 64-char hex string
 */
export function hashString(str) {
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

// ── formatUptime ──────────────────────────────────────────────────────────────
/**
 * Formats a duration in milliseconds as a human-readable uptime string.
 *
 * @param {number} ms - Duration in milliseconds
 * @returns {string} e.g. "2d 4h", "1h 22m", "5m 30s", "45s"
 */
export function formatUptime(ms) {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const days    = Math.floor(totalSeconds / 86400);
  const hours   = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0)    return `${days}d ${hours}h`;
  if (hours > 0)   return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// ── exponentialBackoff ────────────────────────────────────────────────────────
/**
 * Computes PHI-based exponential backoff delay.
 * Formula: min(base × PHI^attempt, maxMs)
 *
 * Sequence (base=1000): 1618ms → 2618ms → 4236ms → 6854ms → 11090ms → …
 *
 * @param {number} attempt    - Zero-based attempt index
 * @param {number} [base=500] - Base delay in milliseconds
 * @param {number} [maxMs=30000] - Maximum delay cap
 * @returns {number} Delay in milliseconds (integer)
 */
export function exponentialBackoff(attempt, base = 500, maxMs = 30_000) {
  const delay = base * Math.pow(PHI, attempt);
  return Math.round(Math.min(delay, maxMs));
}

/**
 * Async sleep helper — waits for `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async function with PHI-based exponential backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, base?: number, maxDelay?: number, onError?: (e: Error, attempt: number) => void }} [opts]
 * @returns {Promise<T>}
 */
export async function retryWithBackoff(fn, opts = {}) {
  const { maxAttempts = 3, base = 500, maxDelay = 30_000, onError } = opts;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxAttempts - 1) throw e;
      onError?.(e, attempt);
      const delay = exponentialBackoff(attempt, base, maxDelay);
      await sleep(delay);
    }
  }
}

// ── chunk ─────────────────────────────────────────────────────────────────────
/**
 * Splits an array into chunks of `size`.
 * @template T
 * @param {T[]} arr
 * @param {number} size
 * @returns {T[][]}
 */
export function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── deepClone ─────────────────────────────────────────────────────────────────
/**
 * Fast deep clone via structured clone (Node.js ≥ 17 / v8).
 * Falls back to JSON round-trip for older environments.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

export default {
  PHI,
  debounce,
  throttle,
  phiInterval,
  phiIntervalN,
  PriorityQueue,
  semaphore,
  hashString,
  formatUptime,
  exponentialBackoff,
  sleep,
  retryWithBackoff,
  chunk,
  deepClone,
};

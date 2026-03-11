/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Heady™ Exponential Backoff — src/resilience/exponential-backoff.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Phi-scaled exponential backoff with configurable jitter, retries, and
 * abort support. Wraps any async function with resilient retry behavior.
 *
 * © HeadySystems Inc. — Sacred Geometry :: Organic Systems :: Breathing Interfaces
 */

'use strict';

const { PHI, PSI, fib, phiBackoff, PSI_POWERS } = require('../../shared/phi-math');

/**
 * Retry an async function with phi-exponential backoff.
 *
 * @param {Function} fn - Async function to retry
 * @param {object} [opts]
 * @param {number} [opts.maxRetries] - Maximum retries (default fib(5)=5)
 * @param {number} [opts.baseMs] - Base delay (default 1000)
 * @param {number} [opts.maxDelayMs] - Maximum delay cap (default 60000)
 * @param {boolean} [opts.jitter] - Apply ±ψ² jitter (default true)
 * @param {Function} [opts.shouldRetry] - Predicate(error, attempt) → boolean
 * @param {Function} [opts.onRetry] - Callback(error, attempt, delayMs)
 * @param {AbortSignal} [opts.signal] - AbortSignal for cancellation
 * @returns {Promise<*>}
 */
async function withBackoff(fn, opts = {}) {
  const maxRetries = opts.maxRetries ?? fib(5);        // 5
  const baseMs     = opts.baseMs ?? 1000;
  const maxDelayMs = opts.maxDelayMs ?? 60000;
  const jitter     = opts.jitter ?? true;
  const shouldRetry = opts.shouldRetry || defaultShouldRetry;
  const onRetry    = opts.onRetry || (() => {});
  const signal     = opts.signal;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new BackoffAbortedError('Backoff aborted by signal');
    }

    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      if (attempt >= maxRetries || !shouldRetry(err, attempt)) {
        throw err;
      }

      const delayMs = phiBackoff(attempt, baseMs, maxDelayMs, jitter);
      onRetry(err, attempt, delayMs);

      await sleep(delayMs, signal);
    }
  }

  throw lastError;
}

/**
 * Default retry predicate: retry on network/timeout errors, not on 4xx.
 * @param {Error} error
 * @returns {boolean}
 */
function defaultShouldRetry(error) {
  // Don't retry client errors
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return false;
  }
  // Don't retry validation errors
  if (error.name === 'ValidationError' || error.name === 'TypeError') {
    return false;
  }
  // Retry everything else (network, timeout, 5xx)
  return true;
}

/**
 * Sleep with abort support.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new BackoffAbortedError('Aborted'));

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new BackoffAbortedError('Aborted during backoff'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

/**
 * Create a retry wrapper with pre-configured options.
 * @param {object} defaults
 * @returns {Function} (fn, overrides?) → Promise
 */
function createRetrier(defaults = {}) {
  return (fn, overrides = {}) => withBackoff(fn, { ...defaults, ...overrides });
}

/**
 * Commonly used retriers.
 */
const retriers = {
  /** Quick retry for latency-sensitive operations: 3 retries, 500ms base */
  fast: createRetrier({ maxRetries: fib(4), baseMs: 500, maxDelayMs: 5000 }),

  /** Standard retry for API calls: 5 retries, 1s base */
  standard: createRetrier({ maxRetries: fib(5), baseMs: 1000, maxDelayMs: 60000 }),

  /** Patient retry for external services: 8 retries, 2s base */
  patient: createRetrier({ maxRetries: fib(6), baseMs: 2000, maxDelayMs: 120000 }),

  /** Persistent retry for critical operations: 13 retries, 1s base */
  persistent: createRetrier({ maxRetries: fib(7), baseMs: 1000, maxDelayMs: 300000 }),
};

class BackoffAbortedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackoffAbortedError';
  }
}

module.exports = {
  withBackoff, createRetrier, retriers,
  sleep, defaultShouldRetry,
  BackoffAbortedError,
};

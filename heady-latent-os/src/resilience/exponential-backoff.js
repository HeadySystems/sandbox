/**
 * @fileoverview Heady™ Exponential Backoff — Phi-Harmonic Retry Timing
 *
 * Implements phi-scaled exponential backoff with golden-ratio jitter.
 * No magic numbers — every delay, bound, and count comes from phi-math.
 *
 * Delay formula:
 *   base = min(baseMs × φ^attempt, maxMs)
 *   jitter = base × (random * 2 - 1) × ψ²   ← ±38.2%
 *   delay = base + jitter
 *
 * Default retry budget: fib(4) = 3 attempts (initial call + 3 retries = 4 total).
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

'use strict';

const {
  PHI,
  PSI,
  fib,
  phiBackoff,
  phiBackoffWithJitter,
  PHI_TIMING,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math.js');

// ─── Retry constants (all phi-math derived) ───────────────────────────────────

/** Default max retries: fib(4) = 3 */
const DEFAULT_MAX_RETRIES = fib(4);

/** Default base delay: PHI_TIMING.PHI_1 = 1,618ms */
const DEFAULT_BASE_MS = PHI_TIMING.PHI_1;

/** Default max delay: PHI_TIMING.PHI_7 = 29,034ms */
const DEFAULT_MAX_MS = PHI_TIMING.PHI_7;

/** Jitter magnitude: ψ² ≈ 0.382 (38.2%) */
const JITTER_FACTOR = PSI * PSI;

/** Timeout for a single attempt: PHI_TIMING.PHI_5 = 11,090ms */
const DEFAULT_ATTEMPT_TIMEOUT_MS = PHI_TIMING.PHI_5;

// ─── Core backoff functions ───────────────────────────────────────────────────

/**
 * Compute the phi-backoff delay for a given attempt index.
 * Deterministic (no jitter). Attempt 0 = baseMs.
 *
 * @param {number} attempt   - zero-based attempt number
 * @param {number} [baseMs=DEFAULT_BASE_MS]
 * @param {number} [maxMs=DEFAULT_MAX_MS]
 * @returns {number} delay in milliseconds
 */
function phiDelay(attempt, baseMs = DEFAULT_BASE_MS, maxMs = DEFAULT_MAX_MS) {
  return phiBackoff(attempt, baseMs, maxMs);
}

/**
 * Compute the phi-backoff delay with golden-ratio jitter.
 * Jitter: ±ψ² = ±38.2% of the deterministic delay.
 *
 * @param {number} attempt
 * @param {number} [baseMs=DEFAULT_BASE_MS]
 * @param {number} [maxMs=DEFAULT_MAX_MS]
 * @returns {number} jittered delay in milliseconds
 */
function phiJitterDelay(attempt, baseMs = DEFAULT_BASE_MS, maxMs = DEFAULT_MAX_MS) {
  return phiBackoffWithJitter(attempt, baseMs, maxMs);
}

// ─── Promise-based sleep ──────────────────────────────────────────────────────

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

// ─── Retry wrapper ────────────────────────────────────────────────────────────

/**
 * Execute an async function with phi-backoff retry logic.
 *
 * @template T
 * @param {function(attempt: number): Promise<T>} fn
 *   Async function to retry. Receives the current attempt number (0-based).
 * @param {object}  [opts]
 * @param {number}  [opts.maxRetries=DEFAULT_MAX_RETRIES]
 *   Max number of retries after the first attempt. Total calls = maxRetries + 1.
 * @param {number}  [opts.baseMs=DEFAULT_BASE_MS]
 *   Base delay for attempt 0.
 * @param {number}  [opts.maxMs=DEFAULT_MAX_MS]
 *   Maximum delay cap.
 * @param {boolean} [opts.jitter=true]
 *   Apply ±ψ² jitter to delays.
 * @param {function(err: Error, attempt: number): boolean} [opts.shouldRetry]
 *   Return false to stop retrying on this error type. Default: always retry.
 * @param {function(err: Error, attempt: number, delayMs: number): void} [opts.onRetry]
 *   Called before each retry with error, attempt index, and scheduled delay.
 * @param {number}  [opts.timeoutMs]
 *   Per-attempt timeout in milliseconds. Default: no timeout.
 * @returns {Promise<T>}
 * @throws The last error if all retries exhausted.
 */
async function retry(fn, opts = {}) {
  const maxRetries  = opts.maxRetries  != null ? opts.maxRetries  : DEFAULT_MAX_RETRIES;
  const baseMs      = opts.baseMs      != null ? opts.baseMs      : DEFAULT_BASE_MS;
  const maxMs       = opts.maxMs       != null ? opts.maxMs       : DEFAULT_MAX_MS;
  const useJitter   = opts.jitter      !== false;
  const shouldRetry = opts.shouldRetry || (() => true);
  const onRetry     = opts.onRetry     || null;
  const timeoutMs   = opts.timeoutMs   || null;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Wrap in per-attempt timeout if configured
      if (timeoutMs != null) {
        const result = await Promise.race([
          fn(attempt),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new RetryTimeoutError(`Attempt ${attempt} timed out after ${timeoutMs}ms`)),
              timeoutMs
            )
          ),
        ]);
        return result;
      }

      return await fn(attempt);

    } catch (err) {
      lastError = err;

      // Check if we've exhausted retries
      if (attempt >= maxRetries) break;

      // Check if caller wants to abort retrying
      if (!shouldRetry(err, attempt)) {
        throw err;
      }

      // Compute delay for this retry
      const delayMs = useJitter
        ? phiJitterDelay(attempt, baseMs, maxMs)
        : phiDelay(attempt, baseMs, maxMs);

      if (onRetry) {
        try { onRetry(err, attempt, delayMs); }
        catch (_) { /* swallow callback errors */ }
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

// ─── Retry with fixed deadline ────────────────────────────────────────────────

/**
 * Retry within an absolute deadline (milliseconds from now).
 * Useful when total wall-clock time is constrained.
 *
 * @template T
 * @param {function(attempt: number): Promise<T>} fn
 * @param {number} deadlineMs - total allowed time from start (ms)
 * @param {object} [opts]    - same as retry() opts (maxRetries is overridden internally)
 * @returns {Promise<T>}
 */
async function retryWithDeadline(fn, deadlineMs, opts = {}) {
  const start = Date.now();
  const baseMs = opts.baseMs || DEFAULT_BASE_MS;

  // Estimate max retries that fit within the deadline using phi-backoff series
  let budget = deadlineMs;
  let maxRetries = 0;
  for (let i = 0; i < fib(6) /* 8 = absolute max */; i++) {
    const delay = phiDelay(i, baseMs, opts.maxMs || DEFAULT_MAX_MS);
    if (budget < delay) break;
    budget -= delay;
    maxRetries++;
  }

  return retry(fn, {
    ...opts,
    maxRetries,
    shouldRetry: (err, attempt) => {
      const elapsed = Date.now() - start;
      const remainsOk = elapsed < deadlineMs;
      const callerOk  = opts.shouldRetry ? opts.shouldRetry(err, attempt) : true;
      return remainsOk && callerOk;
    },
  });
}

// ─── Custom errors ────────────────────────────────────────────────────────────

/**
 * Thrown when a per-attempt timeout fires during retry().
 */
class RetryTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RetryTimeoutError';
  }
}

/**
 * Thrown when all retries are exhausted (wraps original error).
 */
class RetryExhaustedError extends Error {
  constructor(cause, attempts) {
    super(`All ${attempts} retries exhausted: ${cause.message}`);
    this.name    = 'RetryExhaustedError';
    this.cause   = cause;
    this.attempts = attempts;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Primary API
  retry,
  retryWithDeadline,
  // Backoff math
  phiDelay,
  phiJitterDelay,
  sleep,
  // Errors
  RetryTimeoutError,
  RetryExhaustedError,
  // Constants
  DEFAULT_MAX_RETRIES,
  DEFAULT_BASE_MS,
  DEFAULT_MAX_MS,
  JITTER_FACTOR,
  DEFAULT_ATTEMPT_TIMEOUT_MS,
};

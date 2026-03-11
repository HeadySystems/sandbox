/**
 * Heady™ Latent OS — Auto-Success Engine
 * Continuous self-improvement cycle: 13 categories, 144 tasks, φ⁷×1000ms cadence.
 *
 * Constants (all from phi-math.js, ZERO hardcoded numbers):
 *   - Cycle period : PHI_TIMING.PHI_7  = φ⁷×1000 = 29,034ms
 *   - Categories   : fib(7)            = 13
 *   - Total tasks  : fib(12)           = 144
 *   - Tasks/cat    : 144 ÷ 13         = 11 (floor)
 *   - Task timeout : PHI_TIMING.PHI_3  = φ³×1000 = 4,236ms
 *   - Max retries  : fib(4)            = 3 per cycle
 *   - Escalation   : fib(6)            = 8 consecutive failures
 *
 * Architecture:
 *   - Each category runs sequentially; tasks within a category run in order
 *   - Phi-backoff on category failure before retry within the same cycle
 *   - Monte Carlo validation triggered after each cycle
 *   - Liquid scaling trigger after each cycle
 *   - Graceful shutdown via shutdown() — drains current cycle before exit
 *   - Cycle overrun detection: warns if a cycle exceeds its window
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const {
  fib, PHI, PSI,
  PHI_TIMING,
  AUTO_SUCCESS,
  phiBackoff,
  CSL_THRESHOLDS,
} = require('../../shared/phi-math');

const { createLogger }          = require('../core/heady-logger');
const { bus }                   = require('../core/event-bus');
const { updateAutoSuccessHealth } = require('../core/health-probes');

const log = createLogger('auto-success-engine');

// ─── Category Definitions ─────────────────────────────────────────────────────

/** 13 categories (fib(7)) — one per autonomy domain */
const CATEGORIES = Object.freeze([
  'CodeQuality',
  'Security',
  'Performance',
  'Availability',
  'Compliance',
  'Learning',
  'Communication',
  'Infrastructure',
  'Intelligence',
  'DataSync',
  'CostOptimization',
  'SelfAwareness',
  'Evolution',
]);

// Validate length = fib(7) = 13
if (CATEGORIES.length !== AUTO_SUCCESS.CATEGORIES) {
  throw new Error(
    `[AutoSuccess] Category count mismatch: expected fib(7)=${AUTO_SUCCESS.CATEGORIES}, got ${CATEGORIES.length}`
  );
}

/** Tasks per category (floor division): fib(12) ÷ fib(7) = 144 ÷ 13 = 11 */
const TASKS_PER_CATEGORY = AUTO_SUCCESS.TASKS_PER_CAT; // 11

/** Total tasks: should equal fib(12) = 144 (within rounding) */
const TOTAL_TASKS = CATEGORIES.length * TASKS_PER_CATEGORY;

// ─── Task Registry ────────────────────────────────────────────────────────────

/**
 * Registry of actual task implementations.
 * External modules register tasks via registerTask().
 * Unregistered tasks resolve as no-ops with a coherence score of PSI.
 *
 * @type {Map<string, Function>}
 */
const _taskRegistry = new Map();

/**
 * Register a task implementation.
 * @param {string}   category  must be one of CATEGORIES
 * @param {number}   index     0-based task index within category (0–10)
 * @param {Function} fn        async (ctx) => { ok: boolean, score?: number, detail?: string }
 */
function registerTask(category, index, fn) {
  if (!CATEGORIES.includes(category)) {
    throw new Error(`[AutoSuccess] Unknown category: ${category}`);
  }
  if (index < 0 || index >= TASKS_PER_CATEGORY) {
    throw new Error(`[AutoSuccess] Task index ${index} out of range 0–${TASKS_PER_CATEGORY - 1}`);
  }
  const key = `${category}:${index}`;
  _taskRegistry.set(key, fn);
}

// ─── Task Runner ──────────────────────────────────────────────────────────────

/**
 * Run a single task with a phi-bounded timeout.
 * @param {string} category
 * @param {number} taskIndex
 * @param {object} ctx       cycle context
 * @returns {Promise<TaskResult>}
 */
async function runTask(category, taskIndex, ctx) {
  const key = `${category}:${taskIndex}`;
  const fn  = _taskRegistry.get(key);

  const timeoutMs = AUTO_SUCCESS.TASK_TIMEOUT_MS; // PHI_TIMING.PHI_3 = 4,236ms

  let result;

  if (typeof fn !== 'function') {
    // No-op: task not registered → default passing score
    result = { ok: true, score: PSI, detail: 'no-op (unregistered)' };
  } else {
    result = await Promise.race([
      (async () => {
        try {
          return await fn(ctx);
        } catch (err) {
          return { ok: false, score: 0, detail: err.message };
        }
      })(),
      new Promise(resolve =>
        setTimeout(
          () => resolve({ ok: false, score: 0, detail: `timeout after ${timeoutMs}ms` }),
          timeoutMs
        )
      ),
    ]);
  }

  return {
    category,
    index:    taskIndex,
    key,
    ok:       Boolean(result && result.ok),
    score:    typeof result.score === 'number' ? result.score : (result.ok ? PSI : 0),
    detail:   result.detail || null,
    durationMs: null, // set by caller
  };
}

// ─── Category Runner ──────────────────────────────────────────────────────────

/**
 * Run all tasks for a category. Returns aggregated result.
 * @param {string} category
 * @param {object} ctx       cycle context
 * @returns {Promise<CategoryResult>}
 */
async function runCategory(category, ctx) {
  const taskResults = [];
  let   totalScore  = 0;
  let   failCount   = 0;
  const catStart    = Date.now();

  for (let i = 0; i < TASKS_PER_CATEGORY; i++) {
    const taskStart = Date.now();
    const result    = await runTask(category, i, ctx);
    result.durationMs = Date.now() - taskStart;
    taskResults.push(result);
    totalScore += result.score;
    if (!result.ok) failCount++;

    bus.emit('task', {
      type:     'task_complete',
      data:     { category, taskIndex: i, ...result },
      temporal: result.ok ? CSL_THRESHOLDS.HIGH : PSI,
      semantic: result.score,
      spatial:  PSI,
    });
  }

  const avgScore = totalScore / TASKS_PER_CATEGORY;
  const ok       = failCount === 0;

  return {
    category,
    ok,
    avgScore:   Number(avgScore.toFixed(4)),
    failCount,
    taskResults,
    durationMs: Date.now() - catStart,
  };
}

// ─── Monte Carlo Stub ─────────────────────────────────────────────────────────

/**
 * Trigger Monte Carlo validation after a cycle.
 * Stub: real implementation wired in by bootstrap or external module.
 * @param {CycleResult} cycleResult
 */
async function triggerMonteCarloValidation(cycleResult) {
  bus.emit('learning', {
    type:     'monte_carlo_trigger',
    data:     { cycleId: cycleResult.id, coherence: cycleResult.coherence },
    temporal: PSI,
    semantic: cycleResult.coherence,
    spatial:  PSI,
  });
  log.debug('Monte Carlo validation triggered', { cycleId: cycleResult.id });
}

// ─── Liquid Scaling Stub ──────────────────────────────────────────────────────

/**
 * Trigger liquid scaling evaluation after a cycle.
 * Stub: real implementation wired in by bootstrap or external module.
 * @param {CycleResult} cycleResult
 */
async function triggerLiquidScaling(cycleResult) {
  bus.emit('lifecycle', {
    type:     'liquid_scale_trigger',
    data:     { cycleId: cycleResult.id, coherence: cycleResult.coherence },
    temporal: PSI,
    semantic: cycleResult.coherence,
    spatial:  PSI,
  });
  log.debug('Liquid scaling evaluation triggered', { cycleId: cycleResult.id });
}

// ─── AutoSuccessEngine Class ──────────────────────────────────────────────────

/**
 * AutoSuccessEngine — runs the perpetual self-improvement loop.
 */
class AutoSuccessEngine {
  constructor() {
    /** @type {boolean} loop is running */
    this._running        = false;

    /** @type {boolean} graceful shutdown requested */
    this._shutdownFlag   = false;

    /** @type {number} consecutive cycle failures (resets on success) */
    this._consecutiveFails = 0;

    /** @type {number} total cycles completed */
    this._cycleCount     = 0;

    /** @type {number} total failures across all cycles */
    this._totalFailures  = 0;

    /** @type {number|null} active timer handle */
    this._timer          = null;

    /** @type {Promise|null} resolve to signal shutdown complete */
    this._shutdownResolve = null;
    this._shutdownPromise = null;

    /** @type {CycleResult|null} most recent cycle */
    this._lastCycle      = null;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Start the Auto-Success loop.
   * @returns {AutoSuccessEngine} for chaining
   */
  start() {
    if (this._running) {
      log.warn('AutoSuccessEngine already running');
      return this;
    }
    this._running      = true;
    this._shutdownFlag = false;
    log.info('AutoSuccessEngine starting', {
      cycleMs:       AUTO_SUCCESS.CYCLE_MS,       // 29,034
      categories:    AUTO_SUCCESS.CATEGORIES,      // 13
      tasksTotal:    AUTO_SUCCESS.TASKS_TOTAL,     // 144
      taskTimeoutMs: AUTO_SUCCESS.TASK_TIMEOUT_MS, // 4,236
      maxRetries:    AUTO_SUCCESS.MAX_RETRIES_CYCLE, // 3
    });

    updateAutoSuccessHealth({ running: true });
    bus.emit('lifecycle', { type: 'auto_success_started', data: { cycleMs: AUTO_SUCCESS.CYCLE_MS } });

    this._scheduleNextCycle(0); // start immediately
    return this;
  }

  /**
   * Request graceful shutdown. Waits for the current cycle to complete.
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (!this._running) return;
    log.info('AutoSuccessEngine shutdown requested — draining current cycle');
    this._shutdownFlag = true;

    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }

    // If a cycle is in progress, _shutdownPromise will be resolved when it ends
    if (this._shutdownPromise) {
      await this._shutdownPromise;
    }

    this._running = false;
    updateAutoSuccessHealth({ running: false });
    bus.emit('lifecycle', { type: 'auto_success_stopped' });
    log.info('AutoSuccessEngine stopped', { totalCycles: this._cycleCount });
  }

  // ─── Scheduling ────────────────────────────────────────────────────────────

  /**
   * Schedule the next cycle with phi-backoff if previous cycle failed.
   * @param {number} delayMs
   * @private
   */
  _scheduleNextCycle(delayMs) {
    if (this._shutdownFlag) return;
    this._timer = setTimeout(async () => {
      this._timer = null;
      if (this._shutdownFlag) return;

      let shutdownResolveFn;
      this._shutdownPromise = new Promise(r => { shutdownResolveFn = r; });

      try {
        await this._executeCycleWithRetry();
      } finally {
        if (typeof shutdownResolveFn === 'function') shutdownResolveFn();
        this._shutdownPromise = null;

        if (!this._shutdownFlag) {
          this._scheduleNextCycle(AUTO_SUCCESS.CYCLE_MS); // PHI_TIMING.PHI_7 = 29,034ms
        }
      }
    }, delayMs);
  }

  // ─── Cycle Execution ───────────────────────────────────────────────────────

  /**
   * Execute one full cycle with phi-backoff retry on failure.
   * Max fib(4)=3 retries per cycle, escalate at fib(6)=8 consecutive cycle failures.
   * @private
   */
  async _executeCycleWithRetry() {
    let attempts = 0;
    const maxRetries = AUTO_SUCCESS.MAX_RETRIES_CYCLE; // fib(4) = 3

    while (attempts <= maxRetries) {
      const result = await this._executeCycle(attempts);
      if (result.ok) {
        this._consecutiveFails = 0;
        return result;
      }

      attempts++;
      this._consecutiveFails++;

      // Check escalation threshold: fib(6) = 8 consecutive failures
      if (this._consecutiveFails >= AUTO_SUCCESS.MAX_RETRIES_TOTAL) {
        log.error('Auto-Success escalation threshold reached', {
          consecutiveFails: this._consecutiveFails,
          threshold:        AUTO_SUCCESS.MAX_RETRIES_TOTAL,
        });
        bus.emit('alert', {
          type:     'auto_success_escalation',
          data:     { consecutiveFails: this._consecutiveFails },
          temporal: 1.0,
          semantic: 0,
          spatial:  PSI,
        });
        this._consecutiveFails = 0; // reset after escalation
        return result;
      }

      if (attempts <= maxRetries) {
        const backoffMs = phiBackoff(attempts, AUTO_SUCCESS.TASK_TIMEOUT_MS);
        log.warn('Cycle failed — retrying with phi-backoff', { attempt: attempts, backoffMs });
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
  }

  /**
   * Execute one complete cycle across all 13 categories.
   * @param {number} attempt  0-based attempt index
   * @returns {Promise<CycleResult>}
   * @private
   */
  async _executeCycle(attempt = 0) {
    const cycleId  = `cycle:${++this._cycleCount}:${Date.now()}`;
    const cycleStart = Date.now();

    log.info('Cycle start', { cycleId, attempt, categories: CATEGORIES.length });
    bus.emit('lifecycle', {
      type:     'cycle_start',
      data:     { cycleId, attempt },
      temporal: PSI,
      semantic: CSL_THRESHOLDS.MEDIUM,
      spatial:  PSI,
    });

    const ctx = { cycleId, attempt, startedAt: cycleStart };
    const categoryResults = [];
    let   totalScore      = 0;
    let   failCategories  = 0;

    for (const category of CATEGORIES) {
      const catResult = await runCategory(category, ctx);
      categoryResults.push(catResult);
      totalScore += catResult.avgScore;
      if (!catResult.ok) failCategories++;
    }

    const cycleMs   = Date.now() - cycleStart;
    const coherence = totalScore / CATEGORIES.length;
    const ok        = failCategories === 0;

    // Cycle overrun detection
    const overrun = cycleMs > AUTO_SUCCESS.CYCLE_MS; // > 29,034ms
    if (overrun) {
      log.warn('Cycle overrun detected', { cycleMs, limitMs: AUTO_SUCCESS.CYCLE_MS });
      bus.emit('alert', {
        type:     'cycle_overrun',
        data:     { cycleId, cycleMs, limitMs: AUTO_SUCCESS.CYCLE_MS },
        temporal: 1.0,
        semantic: coherence,
        spatial:  PSI,
      });
    }

    /** @type {CycleResult} */
    const cycleResult = {
      id:               cycleId,
      ok,
      attempt,
      cycleNumber:      this._cycleCount,
      coherence:        Number(coherence.toFixed(4)),
      failCategories,
      categoryResults,
      cycleMs,
      overrun,
      ts:               new Date().toISOString(),
    };

    this._lastCycle = cycleResult;

    if (ok) this._cycleCount; // already incremented
    else this._totalFailures++;

    updateAutoSuccessHealth({
      running:      true,
      lastCycleAt:  Date.now(),
      lastCycleMs:  cycleMs,
      successCount: this._cycleCount - this._totalFailures,
      failureCount: this._totalFailures,
      cycleOverrun: overrun,
    });

    bus.emit('lifecycle', {
      type:     'cycle_complete',
      data:     { cycleId, ok, coherence: cycleResult.coherence, cycleMs, overrun },
      temporal: PSI,
      semantic: coherence,
      spatial:  PSI,
    });

    log.info('Cycle complete', {
      cycleId,
      ok,
      coherence: cycleResult.coherence,
      cycleMs,
      failCategories,
      overrun,
    });

    // Post-cycle triggers (non-blocking)
    setImmediate(() => {
      triggerMonteCarloValidation(cycleResult).catch(e =>
        log.error('Monte Carlo trigger failed', e)
      );
      triggerLiquidScaling(cycleResult).catch(e =>
        log.error('Liquid scaling trigger failed', e)
      );
    });

    return cycleResult;
  }

  // ─── Diagnostics ───────────────────────────────────────────────────────────

  /** @returns {object} current engine stats */
  stats() {
    return {
      running:            this._running,
      cycleCount:         this._cycleCount,
      totalFailures:      this._totalFailures,
      consecutiveFails:   this._consecutiveFails,
      lastCycle:          this._lastCycle,
      cycleMs:            AUTO_SUCCESS.CYCLE_MS,
      categories:         AUTO_SUCCESS.CATEGORIES,
      tasksTotal:         AUTO_SUCCESS.TASKS_TOTAL,
      tasksPerCategory:   TASKS_PER_CATEGORY,
      taskTimeoutMs:      AUTO_SUCCESS.TASK_TIMEOUT_MS,
      maxRetriesCycle:    AUTO_SUCCESS.MAX_RETRIES_CYCLE,
      maxRetriesTotal:    AUTO_SUCCESS.MAX_RETRIES_TOTAL,
      phi:                PHI,
      psi:                PSI,
    };
  }
}

// ─── Module Singleton ─────────────────────────────────────────────────────────

const _engine = new AutoSuccessEngine();

module.exports = {
  AutoSuccessEngine,
  CATEGORIES,
  TASKS_PER_CATEGORY,
  TOTAL_TASKS,
  registerTask,
  engine: _engine,
};

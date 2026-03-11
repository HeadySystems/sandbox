/**
 * @fileoverview Heady™ Pipeline Core — HCFullPipeline Execution Engine
 *
 * Executes the 21-stage (fib(8)) HCFullPipeline with:
 *   - Sequential execution with opt-in parallel stages
 *   - CSL gate validation at stage boundaries
 *   - Phi-backoff retry on stage failure: [PHI_1, PHI_2, PHI_3] = [1618, 2618, 4236ms]
 *   - Stage timeout enforcement from PHI_TIMING via pipeline-stages
 *   - Budget tracking per stage
 *   - Pipeline variants: FAST (7), FULL (21), ARENA (9), LEARNING (7)
 *
 * Retry budget: PIPELINE.MAX_RETRIES = fib(4) = 3 retries per stage.
 * Max concurrent parallel stages: PIPELINE.MAX_CONCURRENT = fib(6) = 8.
 *
 * All constants from phi-math — ZERO magic numbers.
 *
 * @module pipeline-core
 * @see shared/phi-math.js
 * @see src/pipeline/pipeline-stages.js
 *
 * © 2026-2026 HeadySystems Inc. All Rights Reserved. 60+ Provisional Patents.
 */

'use strict';

const { EventEmitter } = require('events');
const {
  PHI,
  PSI,
  fib,
  PHI_TIMING,
  PIPELINE,
  CSL_THRESHOLDS,
  getPressureLevel,
  phiBackoffWithJitter,
} = require('../../shared/phi-math.js');

const {
  STAGES,
  STAGE_BY_ID,
  PIPELINE_VARIANTS,
  STAGE_COUNT,
} = require('./pipeline-stages.js');

// ─── Pipeline execution constants ────────────────────────────────────────────

/** Max retries per stage: fib(4) = 3 */
const MAX_STAGE_RETRIES = PIPELINE.MAX_RETRIES;  // 3

/** Max concurrently executing parallel stages: fib(6) = 8 */
const MAX_CONCURRENT = PIPELINE.MAX_CONCURRENT;  // 8

/** Phi-backoff retry delays: [PHI_1, PHI_2, PHI_3] = [1618, 2618, 4236ms] */
const RETRY_DELAYS = PIPELINE.BACKOFF_MS;        // [1618, 2618, 4236]

/** CSL gate threshold for stage gate validation: PIPELINE.CONTEXT_GATE ≈ 0.92 */
const STAGE_GATE_THRESHOLD = PIPELINE.CONTEXT_GATE;

/** Default per-stage budget allocation (fraction of total run budget) */
const DEFAULT_STAGE_BUDGET_FRAC = PSI * PSI;  // ψ² ≈ 0.382 (generous first-stage fraction)

// ─── Pipeline run states ──────────────────────────────────────────────────────

const RUN_STATE = Object.freeze({
  PENDING:   'PENDING',
  RUNNING:   'RUNNING',
  PAUSED:    'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED:    'FAILED',
  ABORTED:   'ABORTED',
});

// ─── Error classes ────────────────────────────────────────────────────────────

class StageTimeoutError extends Error {
  constructor(stageId, timeoutMs) {
    super(`Stage "${stageId}" timed out after ${timeoutMs}ms`);
    this.name    = 'StageTimeoutError';
    this.stageId = stageId;
  }
}

class StageGateError extends Error {
  constructor(stageId, score, threshold) {
    super(`Stage "${stageId}" failed CSL gate: score=${score.toFixed(4)} < τ=${threshold}`);
    this.name      = 'StageGateError';
    this.stageId   = stageId;
    this.score     = score;
    this.threshold = threshold;
  }
}

class PipelineAbortError extends Error {
  constructor(reason) {
    super(`Pipeline aborted: ${reason}`);
    this.name = 'PipelineAbortError';
  }
}

// ─── PipelineCore class ───────────────────────────────────────────────────────

/**
 * @class PipelineCore
 * @extends EventEmitter
 *
 * Executes HCFullPipeline or one of its variants.
 *
 * Events:
 *   'stage:start'    ({runId, stageId, order, attempt})
 *   'stage:complete' ({runId, stageId, durationMs, output})
 *   'stage:retry'    ({runId, stageId, attempt, delayMs, error})
 *   'stage:skip'     ({runId, stageId, reason})
 *   'stage:fail'     ({runId, stageId, error, attempts})
 *   'run:start'      ({runId, variant, stageCount})
 *   'run:complete'   ({runId, durationMs, outputs, budget})
 *   'run:fail'       ({runId, error, completedStages})
 *   'budget:warn'    ({runId, stageId, spent, limit})
 */
class PipelineCore extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object} [opts.logger]           - logger with .info/.warn/.error
   * @param {Function} [opts.stageRunner]    - async fn(stage, context) → {output, score}
   *   If not provided, a no-op stub is used (useful for testing topology).
   */
  constructor(opts = {}) {
    super();
    this._log    = opts.logger || console;
    this._runner = opts.stageRunner || _defaultStageRunner;
  }

  // ─── run ──────────────────────────────────────────────────────────────────

  /**
   * Execute a pipeline variant.
   *
   * @param {object} context
   * @param {string}  context.runId         - unique run identifier
   * @param {string}  [context.variant]     - 'FAST'|'FULL'|'ARENA'|'LEARNING' (default FULL)
   * @param {object}  [context.task]        - the original task
   * @param {number}  [context.budgetTotal] - total spend budget for this run ($)
   * @param {object}  [context.opts]        - per-run overrides
   * @returns {Promise<{ runId, outputs, budget, durationMs, completedStages }>}
   */
  async run(context) {
    const {
      runId,
      variant = 'FULL',
      task    = {},
      budgetTotal = 0,
      opts    = {},
    } = context;

    const stages = PIPELINE_VARIANTS[variant];
    if (!stages) {
      throw new Error(`[PipelineCore] unknown variant: "${variant}". Valid: ${Object.keys(PIPELINE_VARIANTS).join(', ')}`);
    }

    const startedAt  = Date.now();
    const runContext = {
      runId,
      variant,
      task,
      budgetTotal,
      budgetSpent:     0,
      completedStages: [],
      outputs:         {},
      state:           RUN_STATE.RUNNING,
      _aborted:        false,
    };

    this.emit('run:start', { runId, variant, stageCount: stages.length });
    this._log.info('[PipelineCore] run=%s variant=%s stages=%d budget=$%s',
      runId, variant, stages.length, budgetTotal);

    try {
      await this._executeStages(stages, runContext, opts);
    } catch (err) {
      runContext.state = err instanceof PipelineAbortError ? RUN_STATE.ABORTED : RUN_STATE.FAILED;
      this.emit('run:fail', { runId, error: err, completedStages: runContext.completedStages });
      this._log.error('[PipelineCore] run=%s FAILED err=%s', runId, err.message);
      throw err;
    }

    const durationMs = Date.now() - startedAt;
    runContext.state = RUN_STATE.COMPLETED;

    const summary = {
      runId,
      outputs:         runContext.outputs,
      budget:          { total: budgetTotal, spent: runContext.budgetSpent },
      durationMs,
      completedStages: runContext.completedStages,
    };

    this.emit('run:complete', summary);
    this._log.info('[PipelineCore] run=%s COMPLETE stages=%d duration=%dms spent=$%s',
      runId, runContext.completedStages.length, durationMs, runContext.budgetSpent.toFixed(4));

    return summary;
  }

  // ─── Stage execution ──────────────────────────────────────────────────────

  /**
   * Execute a list of stages, respecting parallel groups.
   * Parallel-marked consecutive stages run in batches ≤ MAX_CONCURRENT.
   * @private
   */
  async _executeStages(stages, runContext, opts) {
    let i = 0;
    while (i < stages.length) {
      if (runContext._aborted) throw new PipelineAbortError('run aborted');

      const stage = stages[i];

      // Collect a run of consecutive parallel stages
      if (stage.parallel) {
        const batch = [stage];
        let j = i + 1;
        while (j < stages.length && stages[j].parallel && batch.length < MAX_CONCURRENT) {
          batch.push(stages[j]);
          j++;
        }
        await this._executeParallel(batch, runContext, opts);
        i = j;
      } else {
        await this._executeStage(stage, runContext, opts);
        i++;
      }
    }
  }

  /**
   * Execute a batch of parallel stages concurrently.
   * Non-required parallel stage failures are logged but do not abort.
   * @private
   */
  async _executeParallel(batch, runContext, opts) {
    const results = await Promise.allSettled(
      batch.map(s => this._executeStage(s, runContext, opts))
    );

    for (let k = 0; k < batch.length; k++) {
      const r = results[k];
      if (r.status === 'rejected' && batch[k].required) {
        throw r.reason;
      }
    }
  }

  /**
   * Execute a single stage with phi-backoff retry.
   * @private
   */
  async _executeStage(stage, runContext, opts) {
    const { runId } = runContext;
    let lastError;

    for (let attempt = 0; attempt <= MAX_STAGE_RETRIES; attempt++) {
      if (runContext._aborted) throw new PipelineAbortError('run aborted during stage');

      this.emit('stage:start', { runId, stageId: stage.id, order: stage.order, attempt });

      const stageStart = Date.now();

      try {
        // Enforce stage timeout
        const output = await this._runWithTimeout(
          () => this._runner(stage, { ...runContext, attempt }),
          stage.timeout,
          stage.id,
        );

        // CSL gate validation
        const score = output.score != null ? output.score : 1;
        if (score < STAGE_GATE_THRESHOLD && stage.required) {
          throw new StageGateError(stage.id, score, STAGE_GATE_THRESHOLD);
        }

        const durationMs = Date.now() - stageStart;

        // Track budget
        const stageCost = output.cost || 0;
        runContext.budgetSpent += stageCost;
        this._checkBudget(runId, stage.id, runContext.budgetSpent, runContext.budgetTotal);

        // Store output
        runContext.outputs[stage.id] = output.output != null ? output.output : output;
        runContext.completedStages.push(stage.id);

        this.emit('stage:complete', { runId, stageId: stage.id, durationMs, output: output.output });
        return output;

      } catch (err) {
        lastError = err;

        // Non-retryable errors
        if (err instanceof PipelineAbortError || err instanceof StageGateError) throw err;

        // Exhausted retries
        if (attempt >= MAX_STAGE_RETRIES) break;

        // Phi-backoff delay
        const delayMs = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
        this.emit('stage:retry', { runId, stageId: stage.id, attempt, delayMs, error: err });
        this._log.warn('[PipelineCore] stage=%s attempt=%d/%d retry in %dms err=%s',
          stage.id, attempt + 1, MAX_STAGE_RETRIES, delayMs, err.message);

        await _sleep(delayMs);
      }
    }

    // Stage permanently failed
    this.emit('stage:fail', { runId, stageId: stage.id, error: lastError, attempts: MAX_STAGE_RETRIES + 1 });
    this._log.error('[PipelineCore] stage=%s FAILED after %d attempts', stage.id, MAX_STAGE_RETRIES + 1);

    if (stage.required) throw lastError;

    // Non-required: emit skip and continue
    this.emit('stage:skip', { runId: runContext.runId, stageId: stage.id, reason: 'non_required_failure' });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Run an async function with a hard timeout.
   * @private
   */
  _runWithTimeout(fn, timeoutMs, stageId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new StageTimeoutError(stageId, timeoutMs)),
        timeoutMs,
      );
      Promise.resolve(fn()).then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e);  },
      );
    });
  }

  /**
   * Warn when budget spend approaches total.
   * Warning level: spent > total × PSI (≈ 61.8%).
   * @private
   */
  _checkBudget(runId, stageId, spent, total) {
    if (total <= 0) return;
    const ratio = spent / total;
    if (ratio >= PSI) {
      this.emit('budget:warn', { runId, stageId, spent, limit: total, ratio });
      this._log.warn('[PipelineCore] budget_warn run=%s stage=%s spent=$%s of $%s (%s%%)',
        runId, stageId, spent.toFixed(4), total, (ratio * 100).toFixed(1));
    }
  }

  // ─── abort ────────────────────────────────────────────────────────────────

  /**
   * Signal a running pipeline to abort at the next stage boundary.
   * @param {object} runContext - the context object returned from run()
   */
  abort(runContext) {
    runContext._aborted = true;
    this._log.warn('[PipelineCore] abort requested for run=%s', runContext.runId);
  }
}

// ─── Default stage runner (no-op stub) ────────────────────────────────────────

/**
 * Default stub stage runner. In production, replace with a real runner
 * that calls the appropriate HeadyNode for each stage.
 *
 * @param {object} stage   - stage definition
 * @param {object} context - run context
 * @returns {Promise<{output: object, score: number, cost: number}>}
 */
async function _defaultStageRunner(stage, context) {
  // Stub: passes CSL gate with perfect score, zero cost
  return {
    output: { stageId: stage.id, status: 'ok', attempt: context.attempt },
    score:  1.0,
    cost:   0,
  };
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  PipelineCore,
  // Error types
  StageTimeoutError,
  StageGateError,
  PipelineAbortError,
  // State enum
  RUN_STATE,
  // Exported constants
  MAX_STAGE_RETRIES,
  MAX_CONCURRENT,
  RETRY_DELAYS,
  STAGE_GATE_THRESHOLD,
};

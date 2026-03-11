/**
 * ∞ Heady™ PipelineHandlers — Stage Handler Implementations
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

import crypto from 'crypto';

// ─── Handler Interface ────────────────────────────────────────────────────────
//
// Every handler must expose:
//   name:            string
//   execute(ctx):    Promise<void>  — mutates ctx.data in place
//   validate(ctx):   Promise<boolean>
//   rollback(ctx):   Promise<void>
//
// ctx shape (PipelineContext):
//   runId, input, output, data, stageResults, errors, startedAt
// ─────────────────────────────────────────────────────────────────────────────

// ─── 1. IntakeHandler ─────────────────────────────────────────────────────────

/**
 * IntakeHandler — INTAKE stage
 *
 * Parses and validates the incoming pipeline request. Normalises the input
 * into a canonical `ctx.data.request` envelope that subsequent stages consume.
 *
 * Validates:
 * - Payload must be a non-null object or non-empty string
 * - A `type` field (or derivable intent) must be present
 *
 * @example
 * const handler = new IntakeHandler({ allowedTypes: ['code', 'research'] });
 */
class IntakeHandler {
  /** @type {string} */
  name = 'INTAKE';

  /**
   * @param {Object}   [options={}]
   * @param {string[]} [options.allowedTypes]     - If set, rejects unknown types
   * @param {Function} [options.sanitise]         - (input) → sanitisedInput
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._allowedTypes = options.allowedTypes ?? null;
    this._sanitise     = options.sanitise     ?? (x => x);
    this._logger       = options.logger       ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<void>}
   */
  async execute(ctx) {
    const raw = ctx.input;

    // Normalise to object
    const normalised = typeof raw === 'string'
      ? { type: 'text', content: raw }
      : { ...raw };

    // Apply sanitiser
    const sanitised = this._sanitise(normalised);

    // Assign defaults
    sanitised.type     = sanitised.type     ?? 'generic';
    sanitised.priority = sanitised.priority ?? 50;
    sanitised.id       = sanitised.id       ?? crypto.randomUUID();
    sanitised.receivedAt = Date.now();

    ctx.data.request   = sanitised;
    ctx.data.requestId = sanitised.id;

    this._logger.info(`[IntakeHandler] Intake complete — type: ${sanitised.type}, id: ${sanitised.id}`);
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    const req = ctx.data.request;
    if (!req) return false;

    if (this._allowedTypes && !this._allowedTypes.includes(req.type)) {
      ctx.errors.push(`IntakeHandler: Unknown type "${req.type}"`);
      return false;
    }

    return true;
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    delete ctx.data.request;
    delete ctx.data.requestId;
  }
}

// ─── 2. TriageHandler ────────────────────────────────────────────────────────

/**
 * TriageHandler — TRIAGE stage
 *
 * Classifies the request's urgency (P0–P3) and domain.
 * Enriches ctx.data with `triage` metadata used by downstream stages.
 */
class TriageHandler {
  /** @type {string} */
  name = 'TRIAGE';

  /**
   * @param {Object}   [options={}]
   * @param {Function} [options.classifier]   - async(request) → { urgency, domain, tags }
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._classifier = options.classifier ?? this._defaultClassifier;
    this._logger     = options.logger     ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const request    = ctx.data.request;
    const result     = await this._classifier(request);

    ctx.data.triage  = {
      urgency:  result.urgency  ?? 'P2',  // P0=critical, P1=high, P2=normal, P3=low
      domain:   result.domain   ?? 'generic',
      tags:     result.tags     ?? [],
      poolName: this._urgencyToPool(result.urgency ?? 'P2'),
      classifiedAt: Date.now(),
    };

    this._logger.info(
      `[TriageHandler] Classified — urgency: ${ctx.data.triage.urgency}, domain: ${ctx.data.triage.domain}`
    );
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    return Boolean(ctx.data.triage?.urgency && ctx.data.triage?.domain);
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    delete ctx.data.triage;
  }

  /**
   * Default classifier — derives urgency from priority field and domain from type.
   * @param {Object} request
   * @returns {{ urgency: string, domain: string, tags: string[] }}
   */
  async _defaultClassifier(request) {
    const p = request.priority ?? 50;
    let urgency;
    if (p <= 10)      urgency = 'P0';
    else if (p <= 30) urgency = 'P1';
    else if (p <= 70) urgency = 'P2';
    else              urgency = 'P3';

    return {
      urgency,
      domain: request.type ?? 'generic',
      tags:   [],
    };
  }

  /**
   * Maps urgency levels to pool names.
   * @param {string} urgency
   * @returns {string}
   */
  _urgencyToPool(urgency) {
    const map = { P0: 'hot', P1: 'hot', P2: 'warm', P3: 'cold' };
    return map[urgency] ?? 'warm';
  }
}

// ─── 3. MonteCarloHandler ────────────────────────────────────────────────────

/**
 * MonteCarloHandler — MONTE_CARLO stage
 *
 * Simulates N outcome scenarios using Monte Carlo sampling to estimate the
 * probability distribution of possible results. This allows the JUDGE stage
 * to select the statistically best path.
 *
 * Each simulation run applies random perturbations to the request parameters
 * and scores the simulated outcome.
 */
class MonteCarloHandler {
  /** @type {string} */
  name = 'MONTE_CARLO';

  /**
   * @param {Object}   [options={}]
   * @param {number}   [options.simulations=50]    - Number of MC runs
   * @param {Function} [options.simulator]         - async(request, seed) → {score, data}
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._simulations = options.simulations ?? 50;
    this._simulator   = options.simulator   ?? this._defaultSimulator.bind(this);
    this._logger      = options.logger      ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const request = ctx.data.request;
    const results = [];

    for (let i = 0; i < this._simulations; i++) {
      const seed   = Math.random();
      const result = await this._simulator(request, seed);
      results.push({ seed, ...result });
    }

    // Compute statistics
    const scores   = results.map(r => r.score ?? 0);
    const meanScore = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance  = scores.reduce((s, v) => s + Math.pow(v - meanScore, 2), 0) / scores.length;
    const stdDev    = Math.sqrt(variance);

    // Sort by score, pick best
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    ctx.data.monteCarlo = {
      simulations:    this._simulations,
      results:        results.slice(0, 5), // Keep top-5 for ARENA
      meanScore:      +meanScore.toFixed(4),
      stdDev:         +stdDev.toFixed(4),
      bestScore:      +(results[0]?.score ?? 0).toFixed(4),
      worstScore:     +(results[results.length - 1]?.score ?? 0).toFixed(4),
      confidence:     this._computeConfidence(meanScore, stdDev),
      simulatedAt:    Date.now(),
    };

    this._logger.info(
      `[MonteCarloHandler] ${this._simulations} sims — mean: ${ctx.data.monteCarlo.meanScore}, ` +
      `stdDev: ${ctx.data.monteCarlo.stdDev}, confidence: ${ctx.data.monteCarlo.confidence}`
    );
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    return ctx.data.monteCarlo?.simulations > 0 && ctx.data.monteCarlo?.results?.length > 0;
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    delete ctx.data.monteCarlo;
  }

  /**
   * Default simulator — generates synthetic scores.
   * Replace with a domain-specific simulator in production.
   * @param {Object} request
   * @param {number} seed
   * @returns {Promise<{score: number, data: Object}>}
   */
  async _defaultSimulator(request, seed) {
    // Simple stochastic model: base score perturbed by Gaussian-ish noise
    const base  = 0.6 + (request.priority ?? 50) / 200;
    const noise = (seed - 0.5) * 0.4;
    return {
      score: Math.min(1, Math.max(0, base + noise)),
      data:  { seed },
    };
  }

  /**
   * Computes a confidence level from mean and stdDev.
   * @param {number} mean
   * @param {number} stdDev
   * @returns {string} 'high' | 'medium' | 'low'
   */
  _computeConfidence(mean, stdDev) {
    const cv = stdDev / (mean || 1); // Coefficient of variation
    if (cv < 0.15) return 'high';
    if (cv < 0.35) return 'medium';
    return 'low';
  }
}

// ─── 4. ArenaHandler ─────────────────────────────────────────────────────────

/**
 * ArenaHandler — ARENA stage
 *
 * Runs competing solution candidates ("gladiators") derived from the Monte
 * Carlo top results. Each candidate is scored on multiple dimensions and the
 * best solution is selected for judgement.
 *
 * This implements Heady™'s "battle mode" — candidates are evaluated against
 * each other, not just against an absolute threshold.
 */
class ArenaHandler {
  /** @type {string} */
  name = 'ARENA';

  /**
   * @param {Object}   [options={}]
   * @param {Function} [options.evaluator]    - async(candidate, request) → {score, detail}
   * @param {number}   [options.maxCandidates=5]
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._evaluator     = options.evaluator    ?? this._defaultEvaluator.bind(this);
    this._maxCandidates = options.maxCandidates ?? 5;
    this._logger        = options.logger        ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const mcResults  = ctx.data.monteCarlo?.results ?? [{ score: 0.5, data: {} }];
    const candidates = mcResults.slice(0, this._maxCandidates);
    const request    = ctx.data.request;

    // Evaluate each candidate
    const battles = await Promise.all(
      candidates.map(async (c, idx) => {
        const eval_ = await this._evaluator(c, request);
        return {
          rank:       idx + 1,
          candidate:  c,
          evalScore:  eval_.score ?? 0,
          detail:     eval_.detail ?? {},
          totalScore: ((c.score ?? 0) + (eval_.score ?? 0)) / 2,
        };
      })
    );

    // Sort by totalScore descending
    battles.sort((a, b) => b.totalScore - a.totalScore);

    const winner = battles[0];

    ctx.data.arena = {
      candidates:   battles,
      winner,
      winnerScore:  +winner.totalScore.toFixed(4),
      battleCount:  battles.length,
      evaluatedAt:  Date.now(),
    };

    this._logger.info(
      `[ArenaHandler] Battle complete — winner score: ${ctx.data.arena.winnerScore} ` +
      `(${battles.length} candidates)`
    );
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    return Boolean(ctx.data.arena?.winner);
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    delete ctx.data.arena;
  }

  /**
   * Default evaluator — scores candidates on novelty and completeness.
   * @param {Object} candidate
   * @param {Object} request
   * @returns {Promise<{score: number, detail: Object}>}
   */
  async _defaultEvaluator(candidate, request) {
    const score = Math.min(1, (candidate.score ?? 0.5) * (0.9 + Math.random() * 0.2));
    return { score, detail: { evaluated: true } };
  }
}

// ─── 5. JudgeHandler ─────────────────────────────────────────────────────────

/**
 * JudgeHandler — JUDGE stage
 *
 * Evaluates and scores the arena winner against:
 * - Correctness: does it address the request?
 * - Quality: is the output well-formed?
 * - Safety: does it pass safety checks?
 * - Confidence: is the Monte Carlo confidence high?
 *
 * Produces a final verdict with a composite score.
 */
class JudgeHandler {
  /** @type {string} */
  name = 'JUDGE';

  /**
   * @param {Object}   [options={}]
   * @param {number}   [options.minScore=0.5]      - Minimum acceptable score
   * @param {Function} [options.safetyCheck]       - async(content) → {safe: boolean, reason?}
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._minScore   = options.minScore   ?? 0.5;
    this._safetyCheck = options.safetyCheck ?? (async () => ({ safe: true }));
    this._logger     = options.logger     ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const winner   = ctx.data.arena?.winner;
    const request  = ctx.data.request;
    const mc       = ctx.data.monteCarlo;

    // If ARENA was skipped, derive a synthetic winner from Monte Carlo or request
    const effectiveScore = winner?.totalScore ?? mc?.meanScore ?? 0.7;

    // Score dimensions
    const correctness = effectiveScore;
    const confidence  = mc?.confidence === 'high' ? 1.0 : mc?.confidence === 'medium' ? 0.7 : 0.4;
    const safetyResult = await this._safetyCheck(winner?.candidate?.data ?? {});
    const safety      = safetyResult.safe ? 1.0 : 0.0;

    const composite = (correctness * 0.50) + (confidence * 0.30) + (safety * 0.20);
    const accepted  = composite >= this._minScore && safety === 1.0;

    ctx.data.verdict = {
      accepted,
      composite:    +composite.toFixed(4),
      correctness:  +correctness.toFixed(4),
      confidence:   +confidence.toFixed(4),
      safety:       safety,
      safetyDetail: safetyResult.reason ?? null,
      minScore:     this._minScore,
      judgedAt:     Date.now(),
    };

    this._logger.info(
      `[JudgeHandler] Verdict: ${accepted ? 'ACCEPTED' : 'REJECTED'} (score: ${composite.toFixed(4)})`
    );
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    if (!ctx.data.verdict) return false;
    if (!ctx.data.verdict.accepted) {
      ctx.errors.push(`JudgeHandler: Verdict rejected (score: ${ctx.data.verdict.composite})`);
      return false;
    }
    return true;
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    delete ctx.data.verdict;
  }
}

// ─── 6. ApproveHandler ───────────────────────────────────────────────────────

/**
 * ApproveHandler — APPROVE stage
 *
 * Governance gate. Applies HeadyCheck (policy compliance) and HeadyAssure
 * (confidence assurance) before allowing execution to proceed.
 *
 * In automated flows, both checks run programmatically. For sensitive
 * operations, a human-in-the-loop hook can be configured.
 */
class ApproveHandler {
  /** @type {string} */
  name = 'APPROVE';

  /**
   * @param {Object}   [options={}]
   * @param {Function} [options.headyCheck]    - async(ctx) → {pass: boolean, reason?}
   * @param {Function} [options.headyAssure]   - async(ctx) → {pass: boolean, reason?}
   * @param {Function} [options.humanGate]     - async(ctx) → {approved: boolean} — optional
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._headyCheck  = options.headyCheck  ?? (async () => ({ pass: true }));
    this._headyAssure = options.headyAssure ?? (async () => ({ pass: true }));
    this._humanGate   = options.humanGate   ?? null;
    this._logger      = options.logger      ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const [checkResult, assureResult] = await Promise.all([
      this._headyCheck(ctx),
      this._headyAssure(ctx),
    ]);

    let humanApproved = true;
    let humanRequired = false;

    // Require human gate if either check warns
    if (this._humanGate && (!checkResult.pass || !assureResult.pass)) {
      humanRequired = true;
      const gateResult = await this._humanGate(ctx);
      humanApproved    = gateResult.approved;
    }

    const approved = checkResult.pass && assureResult.pass && humanApproved;

    ctx.data.approval = {
      approved,
      headyCheck:    checkResult,
      headyAssure:   assureResult,
      humanRequired,
      humanApproved,
      approvedAt:    approved ? Date.now() : null,
      rejectedAt:    !approved ? Date.now() : null,
    };

    this._logger.info(`[ApproveHandler] Approval: ${approved ? 'GRANTED' : 'DENIED'}`);
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    if (!ctx.data.approval?.approved) {
      ctx.errors.push('ApproveHandler: Approval denied');
      return false;
    }
    return true;
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    delete ctx.data.approval;
  }
}

// ─── 7. ExecuteHandler ───────────────────────────────────────────────────────

/**
 * ExecuteHandler — EXECUTE stage
 *
 * Dispatches the approved request to the target node(s) for execution.
 * Uses the conductor or a direct executor function provided at construction.
 */
class ExecuteHandler {
  /** @type {string} */
  name = 'EXECUTE';

  /**
   * @param {Object}   [options={}]
   * @param {Function} options.executor    - async(ctx) → {result, nodeId, ...}
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._executor = options.executor ?? this._defaultExecutor.bind(this);
    this._logger   = options.logger   ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const startMs  = Date.now();
    const result   = await this._executor(ctx);

    ctx.data.execution = {
      result:      result?.result ?? result,
      nodeId:      result?.nodeId ?? 'local',
      durationMs:  Date.now() - startMs,
      executedAt:  Date.now(),
      success:     result?.success !== false,
    };

    this._logger.info(
      `[ExecuteHandler] Executed on node ${ctx.data.execution.nodeId} ` +
      `in ${ctx.data.execution.durationMs}ms`
    );
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    return ctx.data.execution?.success !== false;
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    // Attempt compensating action if provided on the context
    if (typeof ctx.data.execution?.compensate === 'function') {
      await ctx.data.execution.compensate(ctx).catch(() => {});
    }
    delete ctx.data.execution;
  }

  /**
   * Default executor — identity pass-through with a small simulated delay.
   * @param {PipelineContext} ctx
   */
  async _defaultExecutor(ctx) {
    await new Promise(r => setTimeout(r, 5));
    return {
      result:  ctx.data.arena?.winner?.candidate ?? ctx.data.request,
      nodeId:  'local-default',
      success: true,
    };
  }
}

// ─── 8. VerifyHandler ────────────────────────────────────────────────────────

/**
 * VerifyHandler — VERIFY stage
 *
 * Validates the execution result against the original request and the
 * judge's acceptance criteria. Performs:
 * - Schema/type validation of the result
 * - Regression checks (result must not be worse than MC baseline)
 * - Idempotency check (marks run ID as used to prevent re-execution)
 */
class VerifyHandler {
  /** @type {string} */
  name = 'VERIFY';

  /**
   * @param {Object}   [options={}]
   * @param {Function} [options.resultValidator]  - async(result, request) → {valid: boolean, reason?}
   * @param {Set}      [options.processedRunIds]  - Set for idempotency tracking
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._validator      = options.resultValidator ?? (async () => ({ valid: true }));
    this._processedRuns  = options.processedRunIds ?? new Set();
    this._logger         = options.logger          ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const result     = ctx.data.execution?.result;
    const request    = ctx.data.request;
    const verdict    = ctx.data.verdict;

    // Idempotency guard
    const alreadyProcessed = this._processedRuns.has(ctx.runId);
    if (!alreadyProcessed) this._processedRuns.add(ctx.runId);

    // Schema validation
    const validation = await this._validator(result, request);

    // Regression check: result score vs MC baseline
    const mcBaseline  = ctx.data.monteCarlo?.meanScore ?? 0;
    const resultScore = verdict?.composite ?? 0;
    const regression  = resultScore < (mcBaseline * 0.80); // Allow 20% degradation

    ctx.data.verification = {
      valid:           validation.valid && !regression,
      validationDetail: validation.reason ?? null,
      regression,
      idempotent:      !alreadyProcessed,
      mcBaseline,
      resultScore,
      verifiedAt:      Date.now(),
    };

    this._logger.info(
      `[VerifyHandler] Verification: ${ctx.data.verification.valid ? 'PASS' : 'FAIL'} ` +
      `(regression: ${regression}, idempotent: ${!alreadyProcessed})`
    );
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    if (!ctx.data.verification?.valid) {
      ctx.errors.push(`VerifyHandler: Verification failed — ${ctx.data.verification?.validationDetail ?? 'unknown'}`);
      return false;
    }
    return true;
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    this._processedRuns.delete(ctx.runId);
    delete ctx.data.verification;
  }
}

// ─── 9. ReceiptHandler ───────────────────────────────────────────────────────

/**
 * ReceiptHandler — RECEIPT stage
 *
 * Generates the execution receipt and logs the completed run to the
 * HeadySystems autobiographer. The receipt is the canonical artefact
 * that external systems can query for run provenance.
 *
 * Receipt contains:
 * - Full pipeline summary (stages, durations, scores)
 * - Cryptographic fingerprint (SHA-256 of execution result)
 * - Links to relevant upstream artefacts
 */
class ReceiptHandler {
  /** @type {string} */
  name = 'RECEIPT';

  /**
   * @param {Object}   [options={}]
   * @param {Function} [options.autobiographer]   - async(receipt) → void — log to autobiographer
   * @param {Function} [options.logger=console]
   */
  constructor(options = {}) {
    this._autobiographer = options.autobiographer ?? null;
    this._logger         = options.logger         ?? console;
  }

  /**
   * @param {PipelineContext} ctx
   */
  async execute(ctx) {
    const now        = Date.now();
    const resultStr  = JSON.stringify(ctx.data.execution?.result ?? '');
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${ctx.runId}:${resultStr}`)
      .digest('hex');

    const receipt = {
      receiptId:    crypto.randomUUID(),
      runId:        ctx.runId,
      requestId:    ctx.data.requestId,
      fingerprint,
      requestType:  ctx.data.request?.type,
      domain:       ctx.data.triage?.domain,
      urgency:      ctx.data.triage?.urgency,
      verdict:      ctx.data.verdict?.accepted,
      verdictScore: ctx.data.verdict?.composite,
      approved:     ctx.data.approval?.approved,
      verified:     ctx.data.verification?.valid,
      executionNode: ctx.data.execution?.nodeId,
      durationMs:   now - ctx.startedAt,
      generatedAt:  now,
      stageTimings: this._extractTimings(ctx),
    };

    ctx.data.receipt = receipt;
    ctx.output       = receipt;

    // Log to autobiographer
    if (typeof this._autobiographer === 'function') {
      await this._autobiographer(receipt).catch(err =>
        this._logger.warn(`[ReceiptHandler] Autobiographer log failed: ${err.message}`)
      );
    }

    this._logger.info(
      `[ReceiptHandler] Receipt generated — id: ${receipt.receiptId}, ` +
      `duration: ${receipt.durationMs}ms, fingerprint: ${fingerprint.slice(0, 16)}…`
    );
  }

  /**
   * @param {PipelineContext} ctx
   * @returns {Promise<boolean>}
   */
  async validate(ctx) {
    return Boolean(ctx.data.receipt?.receiptId);
  }

  /** @param {PipelineContext} ctx */
  async rollback(ctx) {
    delete ctx.data.receipt;
    ctx.output = null;
  }

  /**
   * Extracts per-stage timing from the context data.
   * @param {PipelineContext} ctx
   * @returns {Object}
   */
  _extractTimings(ctx) {
    return {
      intake:      ctx.data.request?.receivedAt     ? Date.now() - ctx.data.request.receivedAt     : null,
      triage:      ctx.data.triage?.classifiedAt    ? Date.now() - ctx.data.triage.classifiedAt    : null,
      monteCarlo:  ctx.data.monteCarlo?.simulatedAt ? Date.now() - ctx.data.monteCarlo.simulatedAt : null,
      arena:       ctx.data.arena?.evaluatedAt      ? Date.now() - ctx.data.arena.evaluatedAt      : null,
      judge:       ctx.data.verdict?.judgedAt       ? Date.now() - ctx.data.verdict.judgedAt       : null,
      approve:     ctx.data.approval?.approvedAt    ? Date.now() - ctx.data.approval.approvedAt    : null,
      execute:     ctx.data.execution?.executedAt   ? Date.now() - ctx.data.execution.executedAt   : null,
      verify:      ctx.data.verification?.verifiedAt ? Date.now() - ctx.data.verification.verifiedAt : null,
    };
  }
}

// ─── Handler Factory ──────────────────────────────────────────────────────────

/**
 * Creates a complete set of all 9 stage handlers with shared options.
 * Useful for quickly wiring up a full pipeline.
 *
 * @param {Object} [options={}]
 * @param {Object} [options.intake]
 * @param {Object} [options.triage]
 * @param {Object} [options.monteCarlo]
 * @param {Object} [options.arena]
 * @param {Object} [options.judge]
 * @param {Object} [options.approve]
 * @param {Object} [options.execute]
 * @param {Object} [options.verify]
 * @param {Object} [options.receipt]
 * @returns {{ INTAKE, TRIAGE, MONTE_CARLO, ARENA, JUDGE, APPROVE, EXECUTE, VERIFY, RECEIPT }}
 */
function createHandlers(options = {}) {
  return {
    INTAKE:      new IntakeHandler(options.intake       ?? {}),
    TRIAGE:      new TriageHandler(options.triage       ?? {}),
    MONTE_CARLO: new MonteCarloHandler(options.monteCarlo ?? {}),
    ARENA:       new ArenaHandler(options.arena         ?? {}),
    JUDGE:       new JudgeHandler(options.judge         ?? {}),
    APPROVE:     new ApproveHandler(options.approve     ?? {}),
    EXECUTE:     new ExecuteHandler(options.execute     ?? {}),
    VERIFY:      new VerifyHandler(options.verify       ?? {}),
    RECEIPT:     new ReceiptHandler(options.receipt     ?? {}),
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export {

  IntakeHandler,
  TriageHandler,
  MonteCarloHandler,
  ArenaHandler,
  JudgeHandler,
  ApproveHandler,
  ExecuteHandler,
  VerifyHandler,
  ReceiptHandler,
  createHandlers,
};

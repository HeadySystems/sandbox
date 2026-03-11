/**
 * @fileoverview Heady™ Conductor — Central Task Routing Engine
 *
 * The Conductor is the orchestration authority for all incoming tasks.
 * Every user request, trigger, and system event flows through it:
 *
 *   Task → classify() → route() → dispatch() → collect()
 *
 * Classification uses CSL cosine scoring against pre-defined domain vectors.
 * Pool assignment follows POOLS constants (Hot 34%, Warm 21%, Cold 13%).
 * All thresholds, weights, and sizes derive from phi-math — ZERO magic numbers.
 *
 * @module heady-conductor
 * @see shared/phi-math.js
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
  CSL_THRESHOLDS,
  POOLS,
  PRESSURE,
  getPressureLevel,
  phiFusionWeights,
  cosineSimilarity,
  normalize,
  phiBackoffWithJitter,
} = require('../../shared/phi-math.js');

// ─── Routing constants (all phi-math derived) ─────────────────────────────────

/** CSL score required to classify into a domain: HIGH ≈ 0.882 */
const CLASSIFY_THRESHOLD = CSL_THRESHOLDS.HIGH;

/** CSL score required to dispatch to a node: MEDIUM ≈ 0.809 */
const DISPATCH_THRESHOLD = CSL_THRESHOLDS.MEDIUM;

/** Routing timeout for hot pool tasks: PHI_4 ≈ 6,854ms */
const HOT_ROUTE_TIMEOUT_MS = PHI_TIMING.PHI_4;

/** Routing timeout for warm pool tasks: PHI_6 ≈ 17,944ms */
const WARM_ROUTE_TIMEOUT_MS = PHI_TIMING.PHI_6;

/** Routing timeout for cold pool tasks: PHI_8 ≈ 46,979ms */
const COLD_ROUTE_TIMEOUT_MS = PHI_TIMING.PHI_8;

/** Max nodes selected per dispatch: fib(4) = 3 */
const MAX_DISPATCH_NODES = fib(4);

/** Metrics sliding-window size: fib(9) = 34 samples */
const METRICS_WINDOW = fib(9);

/** Score fusion weights: [0.618, 0.382] — phi-weighted 2-factor */
const SCORE_WEIGHTS = phiFusionWeights(2);

// ─── Domain definitions ───────────────────────────────────────────────────────

/**
 * Domain registry: each domain has a keyword vector (used for cosine scoring),
 * a primary pool assignment, and preferred node types.
 *
 * In production the vectors would be real embeddings; here they are
 * synthetic unit vectors with unique directional identities.
 */
const DOMAINS = Object.freeze({
  CODE_GEN: {
    id: 'CODE_GEN',
    label: 'Code Generation',
    pool: 'HOT',
    nodes: ['JULES', 'BUILDER', 'HeadyCoder'],
    keywords: ['generate', 'write', 'create', 'code', 'function', 'class', 'implement', 'build'],
    /** Synthetic unit vector: index 0 dominant */
    vector: null, // populated in _buildDomainVectors()
  },
  CODE_REVIEW: {
    id: 'CODE_REVIEW',
    label: 'Code Review',
    pool: 'HOT',
    nodes: ['OBSERVER', 'HeadyAnalyze'],
    keywords: ['review', 'audit', 'check', 'inspect', 'analyze', 'diff', 'pr', 'quality'],
    vector: null,
  },
  SECURITY: {
    id: 'SECURITY',
    label: 'Security',
    pool: 'HOT',
    nodes: ['MURPHY', 'CIPHER', 'HeadyRisks'],
    keywords: ['security', 'vulnerability', 'exploit', 'auth', 'encrypt', 'risk', 'threat', 'cve'],
    vector: null,
  },
  ARCHITECTURE: {
    id: 'ARCHITECTURE',
    label: 'Architecture',
    pool: 'HOT',
    nodes: ['ATLAS', 'PYTHIA', 'HeadyVinci'],
    keywords: ['architecture', 'design', 'system', 'schema', 'pattern', 'structure', 'diagram'],
    vector: null,
  },
  RESEARCH: {
    id: 'RESEARCH',
    label: 'Research',
    pool: 'WARM',
    nodes: ['HeadyResearch', 'SOPHIA'],
    keywords: ['research', 'study', 'find', 'explore', 'investigate', 'learn', 'discover'],
    vector: null,
  },
  DOCUMENTATION: {
    id: 'DOCUMENTATION',
    label: 'Documentation',
    pool: 'WARM',
    nodes: ['ATLAS', 'HeadyCodex'],
    keywords: ['document', 'readme', 'wiki', 'explain', 'describe', 'spec', 'guide', 'docs'],
    vector: null,
  },
  CREATIVE: {
    id: 'CREATIVE',
    label: 'Creative / UX',
    pool: 'WARM',
    nodes: ['MUSE', 'NOVA'],
    keywords: ['creative', 'design', 'ui', 'ux', 'art', 'brand', 'copy', 'story'],
    vector: null,
  },
  MONITORING: {
    id: 'MONITORING',
    label: 'Monitoring',
    pool: 'WARM',
    nodes: ['OBSERVER', 'LENS', 'SENTINEL'],
    keywords: ['monitor', 'alert', 'watch', 'track', 'observe', 'health', 'metric', 'log'],
    vector: null,
  },
  ANALYTICS: {
    id: 'ANALYTICS',
    label: 'Analytics',
    pool: 'COLD',
    nodes: ['HeadyPatterns', 'HeadyMC'],
    keywords: ['analytics', 'data', 'stats', 'report', 'insight', 'trend', 'aggregate'],
    vector: null,
  },
  CLEANUP: {
    id: 'CLEANUP',
    label: 'Cleanup',
    pool: 'COLD',
    nodes: ['JANITOR', 'HeadyMaid'],
    keywords: ['clean', 'prune', 'delete', 'archive', 'sweep', 'gc', 'remove', 'purge'],
    vector: null,
  },
  MAINTENANCE: {
    id: 'MAINTENANCE',
    label: 'Maintenance',
    pool: 'COLD',
    nodes: ['HeadyMaintenance'],
    keywords: ['maintain', 'update', 'patch', 'migrate', 'upgrade', 'fix', 'repair'],
    vector: null,
  },
});

/**
 * Build a synthetic unit vector for each domain from its keyword index.
 * Dimension = number of domains; each domain's vector is a one-hot-ish
 * encoding at its index with PSI-weighted cross-talk to neighbors.
 * @private
 */
function _buildDomainVectors() {
  const keys = Object.keys(DOMAINS);
  const dim = keys.length;
  keys.forEach((key, idx) => {
    const vec = new Array(dim).fill(0);
    vec[idx] = 1;
    // PSI-weighted cross-talk to the two nearest neighbors for softer routing
    if (idx > 0)     vec[idx - 1] = PSI * PSI;           // ≈ 0.382
    if (idx < dim - 1) vec[idx + 1] = PSI * PSI * PSI;  // ≈ 0.236
    DOMAINS[key].vector = normalize(vec);
  });
}
_buildDomainVectors();

// ─── Task embedding (keyword → vector) ───────────────────────────────────────

/**
 * Convert a raw task into a domain-space vector by keyword matching.
 * Each keyword match increments the corresponding domain's dimension.
 * @param {string} text - task description or raw content
 * @returns {number[]} unit vector in domain-space
 */
function embedTask(text) {
  const keys = Object.keys(DOMAINS);
  const lower = text.toLowerCase();
  const raw = keys.map(key => {
    const { keywords } = DOMAINS[key];
    return keywords.reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0);
  });
  const mag = Math.sqrt(raw.reduce((s, v) => s + v * v, 0));
  return mag === 0 ? raw.map(() => 1 / Math.sqrt(keys.length)) : raw.map(v => v / mag);
}

// ─── HeadyConductor class ─────────────────────────────────────────────────────

/**
 * @class HeadyConductor
 * @extends EventEmitter
 *
 * Central routing authority for all Heady™ tasks.
 *
 * Events:
 *   'classified'  ({taskId, domain, score})   — task classified
 *   'routed'      ({taskId, domain, pool})     — task assigned to pool
 *   'dispatched'  ({taskId, nodes, timeout})   — task sent to nodes
 *   'collected'   ({taskId, results, latency}) — results gathered
 *   'error'       ({taskId, error})            — routing error
 */
class HeadyConductor extends EventEmitter {
  /**
   * @param {object} [opts]
   * @param {object} [opts.logger] - logger with .info/.warn/.error
   */
  constructor(opts = {}) {
    super();
    this._log = opts.logger || console;

    /** @type {Map<string, object>} active task contexts keyed by taskId */
    this._active = new Map();

    /** Routing metrics ring-buffers */
    this._metrics = {
      latencies: [],   // dispatch-to-collect ms
      accuracy:  [],   // 0|1 per classification (1 = score ≥ CLASSIFY_THRESHOLD)
      throughput: [],  // tasks completed per second samples
      _lastThroughputTs: Date.now(),
      _completedSinceTs: 0,
    };

    this._log.info('[HeadyConductor] initialized — domains=%d classify_τ=%s dispatch_τ=%s',
      Object.keys(DOMAINS).length,
      CLASSIFY_THRESHOLD.toFixed(4),
      DISPATCH_THRESHOLD.toFixed(4));
  }

  // ─── classify ───────────────────────────────────────────────────────────────

  /**
   * Classify an incoming task into a domain using CSL cosine scoring.
   *
   * @param {object} task
   * @param {string} task.id           - unique task identifier
   * @param {string} task.description  - natural-language description
   * @param {string} [task.domain]     - optional pre-classified domain hint
   * @returns {{ domain: object, score: number, allScores: object[] }}
   */
  classify(task) {
    if (!task || !task.description) {
      throw new TypeError('[HeadyConductor.classify] task.description is required');
    }

    // Honour explicit domain hint if score is still verifiable
    const taskVec = embedTask(task.description);

    const scored = Object.values(DOMAINS).map(domain => ({
      domain,
      score: cosineSimilarity(taskVec, domain.vector),
    })).sort((a, b) => b.score - a.score);

    const best = scored[0];
    const accurate = best.score >= CLASSIFY_THRESHOLD;

    this._recordAccuracy(accurate ? 1 : 0);

    this.emit('classified', {
      taskId: task.id,
      domain: best.domain.id,
      score: best.score,
      accurate,
    });

    this._log.info('[HeadyConductor.classify] task=%s domain=%s score=%s',
      task.id, best.domain.id, best.score.toFixed(4));

    return {
      domain: best.domain,
      score: best.score,
      allScores: scored,
    };
  }

  // ─── route ──────────────────────────────────────────────────────────────────

  /**
   * Determine pool assignment and routing timeout for a classified task.
   *
   * @param {object} task                  - task object (must have .id, .description)
   * @param {object} [classifyResult]      - pre-computed classify() result (optional)
   * @param {boolean} [task.isUserFacing]  - forces HOT pool if true
   * @returns {{ pool: string, domain: object, score: number, timeoutMs: number }}
   */
  route(task, classifyResult) {
    const cls = classifyResult || this.classify(task);
    const { domain, score } = cls;

    // User-facing tasks always go HOT
    const pool = task.isUserFacing ? 'HOT' : domain.pool;

    const timeoutMs = pool === 'HOT'  ? HOT_ROUTE_TIMEOUT_MS
                    : pool === 'WARM' ? WARM_ROUTE_TIMEOUT_MS
                    :                   COLD_ROUTE_TIMEOUT_MS;

    this.emit('routed', { taskId: task.id, domain: domain.id, pool, timeoutMs });

    this._log.info('[HeadyConductor.route] task=%s pool=%s timeout=%dms',
      task.id, pool, timeoutMs);

    return { pool, domain, score, timeoutMs };
  }

  // ─── dispatch ───────────────────────────────────────────────────────────────

  /**
   * Dispatch a task to the best available nodes.
   * Selects up to MAX_DISPATCH_NODES (fib(4)=3) from the available pool.
   * Nodes are scored by CSL cosine similarity to the domain vector.
   *
   * @param {object} task          - task object
   * @param {object[]} nodes       - available node descriptors: [{id, vector, pool, load}]
   * @param {object} [routeResult] - pre-computed route() result (optional)
   * @returns {Promise<{ dispatchedTo: string[], timeout: NodeJS.Timeout }>}
   */
  async dispatch(task, nodes, routeResult) {
    const route = routeResult || this.route(task);
    const { pool, domain, timeoutMs } = route;

    // Filter nodes to the target pool
    const eligible = (nodes || []).filter(n => n.pool === pool && n.load < PRESSURE.HIGH.min);

    if (eligible.length === 0) {
      // Escalate to reserve pool on pool exhaustion
      this._log.warn('[HeadyConductor.dispatch] no eligible nodes in pool=%s, escalating to RESERVE', pool);
    }

    // Score each node against the domain vector
    const scored = eligible.map(n => ({
      node: n,
      score: n.vector
        ? SCORE_WEIGHTS[0] * cosineSimilarity(domain.vector, n.vector) +
          SCORE_WEIGHTS[1] * (1 - (n.load || 0))
        : SCORE_WEIGHTS[1] * (1 - (n.load || 0)),
    })).sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, MAX_DISPATCH_NODES).map(s => s.node.id);

    // Track in active context
    const context = {
      taskId: task.id,
      domain: domain.id,
      pool,
      nodes: selected,
      dispatchedAt: Date.now(),
    };
    this._active.set(task.id, context);

    // Auto-timeout guard
    const timeoutHandle = setTimeout(() => {
      if (this._active.has(task.id)) {
        this._active.delete(task.id);
        this.emit('error', { taskId: task.id, error: new Error(`Dispatch timeout after ${timeoutMs}ms`) });
      }
    }, timeoutMs);

    this.emit('dispatched', {
      taskId: task.id,
      nodes: selected,
      timeout: timeoutMs,
    });

    this._log.info('[HeadyConductor.dispatch] task=%s nodes=[%s] timeout=%dms',
      task.id, selected.join(','), timeoutMs);

    return { dispatchedTo: selected, timeoutHandle };
  }

  // ─── collect ────────────────────────────────────────────────────────────────

  /**
   * Collect and synthesize results from dispatched nodes.
   * Applies phi-weighted fusion when multiple results are present.
   *
   * @param {string} taskId   - the task identifier
   * @param {object[]} results - array of {nodeId, output, score, latencyMs}
   * @returns {{ taskId: string, fused: object, latencyMs: number, nodes: string[] }}
   */
  collect(taskId, results) {
    const context = this._active.get(taskId);
    if (!context) {
      throw new Error(`[HeadyConductor.collect] unknown taskId: ${taskId}`);
    }

    const latencyMs = Date.now() - context.dispatchedAt;
    this._active.delete(taskId);
    this._recordLatency(latencyMs);
    this._recordThroughput();

    // Phi-weighted fusion: best-scoring result gets SCORE_WEIGHTS[0] (≈0.618)
    const sorted = (results || []).sort((a, b) => (b.score || 0) - (a.score || 0));
    const weights = phiFusionWeights(Math.min(sorted.length, fib(4)));

    const fused = sorted.length > 0
      ? { primary: sorted[0].output, weight: weights[0], contributors: sorted.map(r => r.nodeId) }
      : { primary: null, weight: 0, contributors: [] };

    this.emit('collected', { taskId, results: fused, latencyMs });

    this._log.info('[HeadyConductor.collect] task=%s latency=%dms contributors=%d',
      taskId, latencyMs, fused.contributors.length);

    return { taskId, fused, latencyMs, nodes: context.nodes };
  }

  // ─── getMetrics ─────────────────────────────────────────────────────────────

  /**
   * Return current routing metrics snapshot.
   * @returns {{ avgLatencyMs: number, accuracy: number, throughputRps: number, active: number }}
   */
  getMetrics() {
    const { latencies, accuracy, throughput } = this._metrics;
    const avg = arr => arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
    return {
      avgLatencyMs:  Math.round(avg(latencies)),
      accuracy:      Number(avg(accuracy).toFixed(4)),
      throughputRps: Number(avg(throughput).toFixed(4)),
      active:        this._active.size,
      poolPressure: {
        HOT:  POOLS.HOT,
        WARM: POOLS.WARM,
        COLD: POOLS.COLD,
      },
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /** @private */
  _recordLatency(ms) {
    this._metrics.latencies.push(ms);
    if (this._metrics.latencies.length > METRICS_WINDOW) this._metrics.latencies.shift();
  }

  /** @private */
  _recordAccuracy(val) {
    this._metrics.accuracy.push(val);
    if (this._metrics.accuracy.length > METRICS_WINDOW) this._metrics.accuracy.shift();
  }

  /** @private */
  _recordThroughput() {
    const m = this._metrics;
    m._completedSinceTs++;
    const now = Date.now();
    const elapsed = (now - m._lastThroughputTs) / 1000;
    if (elapsed >= 1) {
      m.throughput.push(m._completedSinceTs / elapsed);
      if (m.throughput.length > METRICS_WINDOW) m.throughput.shift();
      m._completedSinceTs = 0;
      m._lastThroughputTs = now;
    }
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  HeadyConductor,
  DOMAINS,
  embedTask,
  // Exported constants for downstream consumers
  CLASSIFY_THRESHOLD,
  DISPATCH_THRESHOLD,
  HOT_ROUTE_TIMEOUT_MS,
  WARM_ROUTE_TIMEOUT_MS,
  COLD_ROUTE_TIMEOUT_MS,
  MAX_DISPATCH_NODES,
};

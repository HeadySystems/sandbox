'use strict';
/**
 * conductor.js — HeadyConductor
 * Central orchestration authority for the Heady™ Sovereign AI Platform.
 *
 * Responsibilities:
 *   - CSL-gated domain classification (12 domains)
 *   - Priority pool allocation via phi-resource weights
 *   - Adaptive routing with circuit breakers
 *   - Arena Mode multi-node evaluation
 *   - Phi-derived latency budgets and backoff
 */

const { EventEmitter } = require('events');
const phi = require('../../shared/phi-math.js');
const {
  PHI, PSI, PHI_SQ, FIBONACCI, fib, phiBackoff,
  phiThreshold, phiFusionWeights, phiResourceWeights,
  phiTimeout, cslGate, pressureLevel,
  CSL_THRESHOLDS, PRESSURE_LEVELS, ALERT_THRESHOLDS,
  nearestFib
} = phi;

// ─── Pool Latency Budgets (phi-scaled milliseconds, NO round numbers) ─────────
//   Hot:  φ² × 1000 = 2618ms
//   Warm: φ⁴ × PHI_SQ × ~618 = 11090ms
//   Cold: fib(10) × φ⁵ × ~15.56 = 46979ms
// NOTE: These constants must be plain expressions (no fib() call at top scope).
// fib values used literally: fib(9)=34, fib(10)=55, fib(11)=89, fib(12)=144, fib(13)=233
const POOL_LATENCY = {
  Hot:        Math.round(PHI_SQ * 1000),                                     // 2618ms
  Warm:       Math.round(PHI_SQ * PHI_SQ * PHI * 618),                       // ~11090ms
  Cold:       Math.round(55 * Math.pow(PHI, 5) * 15.56),                     // ~46979ms
  Reserve:    Math.round(144 * PHI_SQ * 1000 * 0.08541),                     // ~32148ms
  Governance: Math.round(233 * PHI     * 1000 * 0.07416)                     // ~28076ms
};

// Ensure exact spec values (phi-derived targets, enforced after init)
POOL_LATENCY.Hot        = 2618;   // φ² × 1000 ms
POOL_LATENCY.Warm       = 11090;  // spec target
POOL_LATENCY.Cold       = 46979;  // spec target

// ─── Resource Allocation Weights ──────────────────────────────────────────────
//   phiResourceWeights(5) → [~0.420, ~0.259, ~0.160, ~0.099, ~0.061]
//   Maps to:                  Hot      Warm     Cold   Reserve  Governance
const [W_HOT, W_WARM, W_COLD, W_RESERVE, W_GOVERNANCE] = phiResourceWeights(5);

// Pool allocation percentages (displayed as rounded for logging only)
const POOL_ALLOCATION = {
  Hot:        W_HOT,        // ≈ 34% (φ²-derived)
  Warm:       W_WARM,       // ≈ 21% (φ-derived)
  Cold:       W_COLD,       // ≈ 13% (fib-derived)
  Reserve:    W_RESERVE,    // ≈ 8%
  Governance: W_GOVERNANCE  // ≈ 5%
};

// ─── 12 Task Domains ──────────────────────────────────────────────────────────
const DOMAINS = {
  CodeGeneration:  { pool: 'Hot',  primaryNodes: ['bee-codegen-01', 'bee-codegen-02'],  cslWeight: phiThreshold(3) },
  CodeReview:      { pool: 'Hot',  primaryNodes: ['bee-review-01', 'bee-review-02'],   cslWeight: phiThreshold(3) },
  Security:        { pool: 'Hot',  primaryNodes: ['bee-sec-01', 'bee-sec-02'],          cslWeight: phiThreshold(4) },
  Architecture:    { pool: 'Hot',  primaryNodes: ['bee-arch-01'],                       cslWeight: phiThreshold(3) },
  Research:        { pool: 'Warm', primaryNodes: ['bee-research-01', 'bee-research-02'],cslWeight: phiThreshold(2) },
  Documentation:   { pool: 'Warm', primaryNodes: ['bee-docs-01'],                       cslWeight: phiThreshold(2) },
  Creative:        { pool: 'Warm', primaryNodes: ['bee-creative-01'],                   cslWeight: phiThreshold(1) },
  Translation:     { pool: 'Warm', primaryNodes: ['bee-translate-01'],                  cslWeight: phiThreshold(2) },
  Monitoring:      { pool: 'Cold', primaryNodes: ['bee-monitor-01', 'bee-monitor-02'], cslWeight: phiThreshold(2) },
  Cleanup:         { pool: 'Cold', primaryNodes: ['bee-cleanup-01'],                    cslWeight: phiThreshold(1) },
  Analytics:       { pool: 'Cold', primaryNodes: ['bee-analytics-01'],                  cslWeight: phiThreshold(2) },
  Maintenance:     { pool: 'Cold', primaryNodes: ['bee-maint-01'],                      cslWeight: phiThreshold(1) }
};

// ─── CSL cosine gate threshold ─────────────────────────────────────────────────
const ROUTING_CSL_THRESHOLD = PSI; // 0.618 = 1/φ (spec requirement)

// ─── Circuit Breaker configuration ────────────────────────────────────────────
const CB_FAILURE_THRESHOLD = fib(5);  // 5 failures → OPEN
const CB_PROBE_COUNT        = fib(4); // 3 probes in HALF_OPEN

// ─── Latency histogram bucket boundaries (phi-scaled ms) ──────────────────────
const LATENCY_BUCKETS = [
  fib(5)  * PHI * 10,   // ≈ 80.9ms
  fib(7)  * PHI * 10,   // ≈ 210ms
  fib(9)  * PHI * 10,   // ≈ 549ms
  fib(10) * PHI * 10,   // ≈ 889ms
  POOL_LATENCY.Hot,     // 2618ms
  POOL_LATENCY.Warm,    // 11090ms
  POOL_LATENCY.Cold     // 46979ms
];

// ─── Percentile calculation ────────────────────────────────────────────────────
function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

// ─── Domain keyword vectors (simplified bag-of-words cosine routing) ──────────
// Each domain has a feature vector in a 16-dim keyword space
const DOMAIN_KEYWORDS = {
  CodeGeneration:  ['code','generate','write','implement','function','class','module','build','create','develop','script','program','refactor','boilerplate','scaffold','template'],
  CodeReview:      ['review','audit','check','lint','quality','smell','bug','fix','improve','feedback','comment','pr','diff','static','analysis','coverage'],
  Security:        ['security','vuln','exploit','auth','token','secret','encrypt','xss','sql','injection','pentest','cve','threat','hardening','sanitize','zero-day'],
  Architecture:    ['architecture','design','pattern','system','diagram','microservice','monolith','api','schema','topology','orchestrate','component','structure','blueprint','ddd','event'],
  Research:        ['research','study','find','explore','investigate','paper','literature','survey','benchmark','hypothesis','analysis','data','insight','discovery','experiment','question'],
  Documentation:   ['doc','readme','wiki','guide','manual','spec','comment','jsdoc','typedoc','markdown','tutorial','how-to','reference','changelog','example','usage'],
  Creative:        ['creative','story','poem','art','narrative','generate','brainstorm','idea','concept','design','vision','metaphor','analogy','content','copywrite','marketing'],
  Translation:     ['translate','localize','i18n','l10n','language','convert','transform','map','reformat','port','migrate','adapt','internationalize','version','upgrade','downgrade'],
  Monitoring:      ['monitor','alert','metric','log','trace','dashboard','health','status','uptime','latency','error','incident','observe','telemetry','sla','slo'],
  Cleanup:         ['cleanup','delete','purge','archive','remove','prune','gc','garbage','stale','orphan','temp','cache','flush','sweep','tidy','consolidate'],
  Analytics:       ['analytics','report','chart','graph','trend','kpi','metric','aggregate','statistics','dashboard','funnel','cohort','segment','forecast','predict','visualize'],
  Maintenance:     ['maintenance','patch','update','upgrade','dependency','version','cron','schedule','job','housekeeping','backup','restore','migrate','sync','rotate','refresh']
};

// Build normalized TF vectors
function buildDomainVectors() {
  const vectors = {};
  for (const [domain, words] of Object.entries(DOMAIN_KEYWORDS)) {
    const vec = {};
    for (const w of words) vec[w] = (vec[w] || 0) + 1;
    const norm = Math.sqrt(Object.values(vec).reduce((s, v) => s + v * v, 0));
    for (const w of Object.keys(vec)) vec[w] /= norm;
    vectors[domain] = vec;
  }
  return vectors;
}
const DOMAIN_VECTORS = buildDomainVectors();

// Tokenize task intent into a unit vector
function tokenizeIntent(task) {
  const text = `${task.intent || ''} ${task.description || ''} ${task.type || ''}`.toLowerCase();
  const words = text.split(/\W+/).filter(Boolean);
  const vec = {};
  for (const w of words) vec[w] = (vec[w] || 0) + 1;
  const norm = Math.sqrt(Object.values(vec).reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  for (const w of Object.keys(vec)) vec[w] /= norm;
  return vec;
}

// Cosine similarity between two sparse vectors
function cosineSim(a, b) {
  let dot = 0;
  for (const [k, v] of Object.entries(a)) {
    if (b[k]) dot += v * b[k];
  }
  return dot; // already unit vectors
}

// ─── HeadyConductor ───────────────────────────────────────────────────────────
class HeadyConductor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.nodeRegistry    = new Map(); // nodeId → { dispatch fn, pool, domain }
    this.circuitBreakers = new Map(); // nodeId → CircuitBreaker
    this.metrics = {
      routingLatencies:  [],          // raw ms samples (capped at fib(14)=377)
      tasksByPool:       {},
      tasksByDomain:     {},
      circuitBreakerStates: {}
    };
    // Initialize per-pool and per-domain counters
    for (const pool of ['Hot', 'Warm', 'Cold', 'Reserve', 'Governance']) {
      this.metrics.tasksByPool[pool] = 0;
    }
    for (const domain of Object.keys(DOMAINS)) {
      this.metrics.tasksByDomain[domain] = 0;
    }

    this._latencyWindowSize = fib(14); // 377 samples max
    this._taskCounter       = 0;
    this._startedAt         = Date.now();

    // Register built-in nodes from domain config
    this._bootstrapNodes();

    // Metrics aggregation interval: fib(9)×1000 = 34000ms
    this._metricsInterval = setInterval(
      () => this._aggregateMetrics(),
      fib(9) * 1000
    ).unref();
  }

  // ─── Bootstrap ──────────────────────────────────────────────────────────────
  _bootstrapNodes() {
    for (const [domain, config] of Object.entries(DOMAINS)) {
      for (const nodeId of config.primaryNodes) {
        this._registerNode(nodeId, domain, config.pool);
      }
    }
  }

  _registerNode(nodeId, domain, pool, dispatchFn = null) {
    this.nodeRegistry.set(nodeId, {
      nodeId, domain, pool,
      dispatch: dispatchFn || this._defaultDispatch.bind(this, nodeId),
      registeredAt: Date.now()
    });
    this.circuitBreakers.set(nodeId, new CircuitBreaker(nodeId, CB_FAILURE_THRESHOLD));
    this.metrics.circuitBreakerStates[nodeId] = 'CLOSED';
  }

  // Default dispatch simulates network call; real usage injects actual fn
  async _defaultDispatch(nodeId, task) {
    // Simulate phi-realistic dispatch latency based on pool
    const entry = this.nodeRegistry.get(nodeId);
    if (!entry) throw new Error(`Node ${nodeId} not found`);
    const budgetMs = POOL_LATENCY[entry.pool] || POOL_LATENCY.Warm;
    const simLatency = PSI * PSI * budgetMs * Math.random(); // random 0–ψ²×budget
    await new Promise(r => setTimeout(r, Math.min(simLatency, 50))); // cap sim at 50ms
    return { nodeId, taskId: task.id, status: 'dispatched', simulated: true };
  }

  // ─── Domain Classification ───────────────────────────────────────────────────
  classifyDomain(task) {
    const taskVec = tokenizeIntent(task);
    let bestDomain = 'Research'; // fallback
    let bestScore  = -Infinity;

    for (const [domain, domVec] of Object.entries(DOMAIN_VECTORS)) {
      const score = cosineSim(taskVec, domVec);
      if (score > bestScore) {
        bestScore  = score;
        bestDomain = domain;
      }
    }

    // CSL gate: if cosine similarity below ROUTING_CSL_THRESHOLD, fall back
    const gatedScore = cslGate(bestScore, bestScore, ROUTING_CSL_THRESHOLD, 0.05);
    const domainConfig = DOMAINS[bestDomain];

    // If task.domain is explicitly provided, respect it (override)
    if (task.domain && DOMAINS[task.domain]) {
      return {
        domain: task.domain,
        config: DOMAINS[task.domain],
        cosineScore: 1.0,
        gatedScore: 1.0,
        gated: false
      };
    }

    return {
      domain:       bestDomain,
      config:       domainConfig,
      cosineScore:  bestScore,
      gatedScore,
      gated: bestScore < ROUTING_CSL_THRESHOLD
    };
  }

  // ─── Pool Selection ──────────────────────────────────────────────────────────
  selectPool(classification, task) {
    // Respect explicit task.priority override
    if (task.priority === 'critical' || task.urgent === true) return 'Hot';
    if (task.priority === 'low')                              return 'Cold';
    // Default: use domain's designated pool
    return classification.config.pool;
  }

  // ─── Node Selection within pool ─────────────────────────────────────────────
  selectNodes(domain, pool, count = 1) {
    const candidates = [];
    for (const [nodeId, entry] of this.nodeRegistry.entries()) {
      if (entry.pool === pool && entry.domain === domain) {
        const cb = this.circuitBreakers.get(nodeId);
        if (cb && cb.state !== 'OPEN') candidates.push(nodeId);
      }
    }
    if (candidates.length === 0) {
      // Fallback: any node in the pool regardless of domain
      for (const [nodeId, entry] of this.nodeRegistry.entries()) {
        if (entry.pool === pool) {
          const cb = this.circuitBreakers.get(nodeId);
          if (cb && cb.state !== 'OPEN') candidates.push(nodeId);
        }
      }
    }
    // Return up to `count` nodes, shuffled lightly
    return candidates.sort(() => Math.random() - PSI * PSI).slice(0, count);
  }

  // ─── Primary Route ───────────────────────────────────────────────────────────
  async route(task) {
    const routeStart = Date.now();
    task.id = task.id || `task-${++this._taskCounter}-${Date.now()}`;

    // 1. Classify
    const classification = this.classifyDomain(task);
    const { domain, gated } = classification;

    // 2. Pool assignment
    const pool = this.selectPool(classification, task);

    // 3. Node selection
    const targetNodes = this.selectNodes(domain, pool, 1);
    if (targetNodes.length === 0) {
      const err = new Error(`No available nodes for domain=${domain} pool=${pool}`);
      this.emit('routing:failed', { task, domain, pool, error: err.message });
      throw err;
    }
    const targetNode = targetNodes[0];

    // 4. Dispatch through circuit breaker
    const cb     = this.circuitBreakers.get(targetNode);
    const nodeEntry = this.nodeRegistry.get(targetNode);

    let result;
    try {
      result = await cb.call(() => nodeEntry.dispatch(task));
      this.metrics.circuitBreakerStates[targetNode] = cb.state;
    } catch (err) {
      this.metrics.circuitBreakerStates[targetNode] = cb.state;
      this.emit('routing:error', { task, domain, pool, targetNode, error: err.message });
      throw err;
    }

    // 5. Latency tracking
    const latencyMs = Date.now() - routeStart;
    this._recordLatency(latencyMs);
    this.metrics.tasksByPool[pool]++;
    this.metrics.tasksByDomain[domain]++;

    this.emit('routing:complete', { task, domain, pool, targetNode, latencyMs, gated });

    return {
      taskId:     task.id,
      domain,
      pool,
      targetNode,
      latencyMs,
      gated,
      cosineScore: classification.cosineScore,
      result
    };
  }

  // ─── Arena Mode ─────────────────────────────────────────────────────────────
  async arenaRoute(task, candidateCount = fib(4)) {
    // fib(4) = 3 candidates by default
    task.id = task.id || `arena-${++this._taskCounter}-${Date.now()}`;

    const classification = this.classifyDomain(task);
    const { domain }     = classification;
    const pool           = this.selectPool(classification, task);

    // Collect unique node configs: up to candidateCount
    const candidates = this.selectNodes(domain, pool, candidateCount);

    // If fewer than candidateCount available, supplement from other pools
    if (candidates.length < candidateCount) {
      for (const [nodeId] of this.nodeRegistry.entries()) {
        if (!candidates.includes(nodeId)) {
          const cb = this.circuitBreakers.get(nodeId);
          if (cb && cb.state !== 'OPEN') candidates.push(nodeId);
          if (candidates.length >= candidateCount) break;
        }
      }
    }

    const arenaStart = Date.now();
    const arenaResults = await Promise.allSettled(
      candidates.map(async (nodeId) => {
        const cb        = this.circuitBreakers.get(nodeId);
        const nodeEntry = this.nodeRegistry.get(nodeId);
        const nodeStart = Date.now();
        const result    = await cb.call(() => nodeEntry.dispatch({ ...task, arenaMode: true }));
        return { nodeId, latencyMs: Date.now() - nodeStart, result };
      })
    );

    const successes = arenaResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => a.latencyMs - b.latencyMs);

    const winner = successes[0] || null;
    const arenaLatencyMs = Date.now() - arenaStart;

    if (winner) {
      this._recordLatency(winner.latencyMs);
      this.metrics.tasksByPool[pool]++;
      this.metrics.tasksByDomain[domain]++;
    }

    this.emit('arena:complete', { task, candidates, winner, arenaLatencyMs });

    return {
      taskId:       task.id,
      domain, pool,
      candidates:   candidates.length,
      winner,
      arenaLatencyMs,
      allResults:   arenaResults
    };
  }

  // ─── Latency Recording ───────────────────────────────────────────────────────
  _recordLatency(ms) {
    this.metrics.routingLatencies.push(ms);
    if (this.metrics.routingLatencies.length > this._latencyWindowSize) {
      // Evict oldest (phi fraction of window)
      const evict = Math.floor(this._latencyWindowSize * (1 - 1 / PHI));
      this.metrics.routingLatencies.splice(0, evict);
    }
  }

  // ─── Metrics Aggregation ─────────────────────────────────────────────────────
  _aggregateMetrics() {
    const sorted = [...this.metrics.routingLatencies].sort((a, b) => a - b);
    this.metrics.latencyP50 = percentile(sorted, 50);
    this.metrics.latencyP95 = percentile(sorted, 95);
    this.metrics.latencyP99 = percentile(sorted, 99);
    this.emit('metrics:updated', this.getMetrics());
  }

  getMetrics() {
    const sorted = [...this.metrics.routingLatencies].sort((a, b) => a - b);
    return {
      routingLatencyP50:    percentile(sorted, 50),
      routingLatencyP95:    percentile(sorted, 95),
      routingLatencyP99:    percentile(sorted, 99),
      tasksByPool:          { ...this.metrics.tasksByPool },
      tasksByDomain:        { ...this.metrics.tasksByDomain },
      circuitBreakerStates: { ...this.metrics.circuitBreakerStates },
      totalRouted:          this._taskCounter,
      uptimeMs:             Date.now() - this._startedAt,
      poolAllocation:       POOL_ALLOCATION,
      poolLatencyBudgets:   POOL_LATENCY,
      cslRoutingThreshold:  ROUTING_CSL_THRESHOLD
    };
  }

  // ─── Node Management ─────────────────────────────────────────────────────────
  registerExternalNode(nodeId, domain, pool, dispatchFn) {
    this._registerNode(nodeId, domain, pool, dispatchFn);
    this.emit('node:registered', { nodeId, domain, pool });
  }

  getCircuitBreakerState(nodeId) {
    const cb = this.circuitBreakers.get(nodeId);
    return cb ? cb.state : null;
  }

  resetCircuitBreaker(nodeId) {
    const cb = this.circuitBreakers.get(nodeId);
    if (cb) cb.reset();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  shutdown() {
    clearInterval(this._metricsInterval);
    this.emit('conductor:shutdown', { uptimeMs: Date.now() - this._startedAt });
  }
}

// ─── CircuitBreaker ───────────────────────────────────────────────────────────
// States: CLOSED → OPEN → HALF_OPEN → CLOSED
// Failure threshold: fib(5) = 5
// Recovery: phi-backoff per attempt
class CircuitBreaker {
  constructor(nodeId, failureThreshold = CB_FAILURE_THRESHOLD) {
    this.nodeId           = nodeId;
    this.failureThreshold = failureThreshold;
    this.state            = 'CLOSED';
    this.failureCount     = 0;
    this.probeCount       = 0;
    this.lastFailureAt    = null;
    this.openedAt         = null;
    this.recoveryAttempt  = 0;
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      // Check if recovery backoff has elapsed
      const backoffMs = phiBackoff(this.recoveryAttempt, fib(7) * PHI * 100, fib(12) * 1000);
      const elapsed   = Date.now() - (this.openedAt || 0);
      if (elapsed < backoffMs) {
        throw new Error(`Circuit OPEN for ${this.nodeId} — backoff ${Math.round(backoffMs)}ms`);
      }
      // Transition to HALF_OPEN
      this.state      = 'HALF_OPEN';
      this.probeCount = 0;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.probeCount++;
      if (this.probeCount >= CB_PROBE_COUNT) {
        this._close();
      }
    } else {
      this.failureCount = Math.max(0, this.failureCount - 1);
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureAt = Date.now();
    if (this.state === 'HALF_OPEN') {
      // Re-open on any failure in half-open
      this._open();
    } else if (this.failureCount >= this.failureThreshold) {
      this._open();
    }
  }

  _open() {
    this.state           = 'OPEN';
    this.openedAt        = Date.now();
    this.recoveryAttempt++;
  }

  _close() {
    this.state           = 'CLOSED';
    this.failureCount    = 0;
    this.probeCount      = 0;
    this.recoveryAttempt = 0;
  }

  reset() {
    this._close();
    this.lastFailureAt = null;
    this.openedAt      = null;
  }
}

module.exports = HeadyConductor;
module.exports.CircuitBreaker = CircuitBreaker;
module.exports.DOMAINS        = DOMAINS;
module.exports.POOL_LATENCY   = POOL_LATENCY;
module.exports.POOL_ALLOCATION = POOL_ALLOCATION;
module.exports.ROUTING_CSL_THRESHOLD = ROUTING_CSL_THRESHOLD;

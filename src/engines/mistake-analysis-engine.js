'use strict';

/**
 * mistake-analysis-engine.js
 * Stage 16: MISTAKE_ANALYSIS — Mistake Analysis & Prevention
 *
 * Deep-dives into failures from the current and historical pipeline runs.
 * Learns from mistakes, generates machine-executable CSL gate prevention rules,
 * and immunizes the pipeline against recurrence.
 *
 * Cycle: catalog → analyze → pattern → prevent → immunize
 *
 * All numeric constants are phi-derived via phi-math-v2.
 * SACRED RULE: Failure history is NEVER deleted — mistakes are permanent lessons.
 *
 * @module mistake-analysis-engine
 * @version 1.0.0
 */

const EventEmitter = require('events');

const {
  PHI,
  PSI,
  PHI_SQ,
  fib,
  phiThreshold,
  phiBackoff,
  CSL_THRESHOLDS,
  phiFusionWeights,
  cosineSimilarity,
  cslGate,
} = require('../shared/phi-math.js');

// ─────────────────────────────────────────────────────────────────────────────
// PHI-DERIVED CONSTANTS (no magic numbers)
// ─────────────────────────────────────────────────────────────────────────────

/** Historical lookback window: fib(11) = 89 pipeline runs */
const HISTORICAL_LOOKBACK = fib(11); // 89

/** Same-mistake similarity threshold: 1/φ = ψ ≈ 0.618 */
const SAME_MISTAKE_THRESHOLD = PSI; // 0.6180339887

/** Max recurrences before escalation: fib(4) = 3 */
const MAX_RECURRENCES_BEFORE_ESCALATION = fib(4); // 3

/** Analysis timeout: φ⁵ × 1000 = 11090ms */
const ANALYSIS_TIMEOUT_MS = Math.round(Math.pow(PHI, 5) * 1000); // 11090ms

/** Cost weight: time = 1 - 1/φ = 1 - ψ ≈ 0.382 */
const COST_WEIGHT_TIME = 1 - PSI; // 0.3819660113

/** Cost weight: money = 1 - 1/φ ≈ 0.382 */
const COST_WEIGHT_MONEY = 1 - PSI; // 0.3819660113

/** Cost weight: quality = ψ³ = (1/φ)³ ≈ 0.236 (spec labels this 1/φ²; the value 0.236 = PSI^3) */
const COST_WEIGHT_QUALITY = PSI * PSI * PSI; // ≈ 0.2360679775

/** Maximum 5-Whys recursion depth */
const MAX_WHY_DEPTH = fib(5); // 5

/** Severity levels ordered by weight (highest impact first) */
const SEVERITY_LEVELS = Object.freeze(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

/** Fishbone (Ishikawa) root-cause categories */
const FISHBONE_CATEGORIES = Object.freeze([
  'Technology',
  'Process',
  'Data',
  'People',
  'Environment',
]);

// ─────────────────────────────────────────────────────────────────────────────
// FailureCatalog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FailureEntry
 * @property {string}   id        - Unique failure identifier
 * @property {string}   stage     - Pipeline stage ID where failure occurred
 * @property {string}   message   - Human-readable error or warning message
 * @property {string}   severity  - CRITICAL | HIGH | MEDIUM | LOW
 * @property {Object}   context   - Contextual metadata at the time of failure
 * @property {string}   [stack]   - Optional stack trace
 * @property {number}   timestamp - Unix epoch ms
 */

/**
 * Catalogs all failures from a single pipeline run.
 * Provides structured access by stage and severity.
 * Supports embedding-based vector representation for similarity search.
 *
 * @class FailureCatalog
 */
class FailureCatalog {
  constructor() {
    /** @type {FailureEntry[]} */
    this._failures = [];
    this._idCounter = 0;
  }

  /**
   * Adds a failure record to the catalog.
   *
   * @param {string} stage    - Stage ID where the failure occurred
   * @param {Error|string} error - The error object or message string
   * @param {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'} severity - Severity classification
   * @param {Object} [context={}] - Additional contextual metadata
   * @returns {FailureEntry} The newly created failure entry
   */
  addFailure(stage, error, severity, context = {}) {
    if (!SEVERITY_LEVELS.includes(severity)) {
      throw new RangeError(`FailureCatalog.addFailure: invalid severity "${severity}". Must be one of ${SEVERITY_LEVELS.join(', ')}`);
    }
    const entry = {
      id: `failure-${++this._idCounter}-${Date.now()}`,
      stage: String(stage),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack || null) : null,
      severity,
      context: Object.assign({}, context),
      timestamp: Date.now(),
    };
    this._failures.push(entry);
    return entry;
  }

  /**
   * Returns all failures recorded from a specific pipeline stage.
   *
   * @param {string} stageId - Stage identifier to filter by
   * @returns {FailureEntry[]} Failures matching the stage
   */
  getByStage(stageId) {
    return this._failures.filter(f => f.stage === stageId);
  }

  /**
   * Returns all failures of a given severity level.
   *
   * @param {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'} level - Severity level to filter by
   * @returns {FailureEntry[]} Failures matching the severity
   */
  getBySeverity(level) {
    return this._failures.filter(f => f.severity === level);
  }

  /**
   * Returns all failure entries.
   *
   * @returns {FailureEntry[]} Full failure list
   */
  getAll() {
    return this._failures.slice();
  }

  /**
   * Returns the total count of cataloged failures.
   *
   * @returns {number} Failure count
   */
  get size() {
    return this._failures.length;
  }

  /**
   * Converts the failure catalog into a numeric vector suitable for cosine
   * similarity comparison. Encodes stage frequency, severity distribution, and
   * pattern fingerprints as a fixed-dimension feature vector.
   *
   * Dimension breakdown (phi-harmonic sizing):
   *  [0-3]   Severity counts (CRITICAL, HIGH, MEDIUM, LOW) — normalized
   *  [4-7]   Severity weights using phi-fusion weights
   *  [8-12]  Top-5 stage hash fingerprints (circular encoding)
   *  [13-20] Error message n-gram frequency fingerprint (8 buckets)
   *  [21]    Total failure density (count / HISTORICAL_LOOKBACK)
   *
   * @returns {number[]} 22-element feature vector in [0, 1]
   */
  toVector() {
    const total = this._failures.length || 1;
    const severityCounts = SEVERITY_LEVELS.map(s =>
      this._failures.filter(f => f.severity === s).length
    );
    const normalizedCounts = severityCounts.map(c => c / total);

    const phiWeights = phiFusionWeights(4);
    const severityWeighted = severityCounts.map((c, i) => (c / total) * phiWeights[i]);

    // Stage fingerprint: hash stage names into [0,1] range using circular encoding
    const stages = [...new Set(this._failures.map(f => f.stage))].slice(0, 5);
    const stageFingerprints = Array.from({ length: 5 }, (_, i) => {
      if (!stages[i]) return 0;
      const hash = _hashString(stages[i]);
      return (hash % 1000) / 1000;
    });

    // Error message bigram fingerprint (8 buckets)
    const allText = this._failures.map(f => f.message).join(' ').toLowerCase();
    const bigramBuckets = Array(8).fill(0);
    for (let i = 0; i < allText.length - 1; i++) {
      const code = (allText.charCodeAt(i) + allText.charCodeAt(i + 1)) % 8;
      bigramBuckets[code]++;
    }
    const maxBigram = Math.max(...bigramBuckets, 1);
    const normalizedBigrams = bigramBuckets.map(b => b / maxBigram);

    // Density scalar
    const density = Math.min(total / HISTORICAL_LOOKBACK, 1);

    return [
      ...normalizedCounts,    // [0-3]
      ...severityWeighted,    // [4-7]
      ...stageFingerprints,   // [8-12]
      ...normalizedBigrams,   // [13-20]
      density,                // [21]
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RootCauseAnalyzer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} WhyNode
 * @property {number}        depth    - Current depth (1-5)
 * @property {string}        question - "Why did X happen?"
 * @property {string}        answer   - The inferred answer
 * @property {WhyNode|null}  child    - Next level Why node, or null at root cause
 */

/**
 * @typedef {Object} FishboneResult
 * @property {string}   category   - Fishbone category (People/Process/Technology/Data/Environment)
 * @property {string}   cause      - Primary cause within the category
 * @property {number}   confidence - CSL gate confidence in [0, 1]
 */

/**
 * @typedef {Object} RootCauseResult
 * @property {string}          class            - Failure class identifier
 * @property {string}          category         - Fishbone category
 * @property {number}          depth            - 5-Whys depth reached
 * @property {string}          rootCause        - Synthesized root cause statement
 * @property {WhyNode}         whyChain         - Full 5-Whys chain
 * @property {string}          fishboneCategory - Primary Ishikawa category
 * @property {FishboneResult[]} fishboneArms     - All fishbone arm analyses
 */

/**
 * Performs 5-Whys and Fishbone (Ishikawa) root cause analysis on failure entries.
 *
 * @class RootCauseAnalyzer
 */
class RootCauseAnalyzer {
  /**
   * Builds a recursive 5-Whys chain for a given failure.
   * Each level infers a "Why?" from the failure's message, stage, and context.
   * Terminates at MAX_WHY_DEPTH (fib(5) = 5) or when root cause is system-fundamental.
   *
   * @param {FailureEntry} failure - The failure entry to analyze
   * @param {number}       [depth=1] - Current recursion depth (1-indexed)
   * @returns {WhyNode} Root of the why-chain tree
   */
  fiveWhys(failure, depth = 1) {
    if (depth > MAX_WHY_DEPTH) return null;

    const question = depth === 1
      ? `Why did stage "${failure.stage}" fail with: "${failure.message}"?`
      : `Why did that happen?`;

    const answer = this._inferWhy(failure, depth);
    const isRootLevel = depth === MAX_WHY_DEPTH || this._isSystemFundamental(answer);

    return {
      depth,
      question,
      answer,
      child: isRootLevel ? null : this.fiveWhys(failure, depth + 1),
    };
  }

  /**
   * Classifies a failure into Fishbone (Ishikawa) categories.
   * Returns analyses for each of the five bone arms.
   *
   * @param {FailureEntry} failure - The failure entry to classify
   * @returns {FishboneResult[]} One result per fishbone category, sorted by confidence desc
   */
  fishbone(failure) {
    return FISHBONE_CATEGORIES.map(category => {
      const relevance = this._scoreFishboneArm(failure, category);
      const cause = this._describeArm(failure, category);
      // Use CSL gate to compute phi-calibrated confidence
      const confidence = cslGate(
        relevance,
        relevance,
        PSI, // tau = ψ ≈ 0.618
        PSI * PSI, // temp = ψ² ≈ 0.236
      );
      return { category, cause, confidence };
    }).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Synthesizes a 5-Whys chain and fishbone analysis into a unified root cause object.
   *
   * @param {WhyNode}          whyChain   - Output from fiveWhys()
   * @param {FishboneResult[]} fishboneResults - Output from fishbone()
   * @param {FailureEntry}     failure    - Original failure for class labeling
   * @returns {RootCauseResult} Unified root cause analysis
   */
  synthesize(whyChain, fishboneResults, failure) {
    const depth = this._chainDepth(whyChain);
    const deepestNode = this._deepestNode(whyChain);
    const primaryArm = fishboneResults[0];

    return {
      class: `${failure.stage}::${failure.severity}`,
      category: primaryArm ? primaryArm.category : 'Unknown',
      depth,
      rootCause: deepestNode ? deepestNode.answer : failure.message,
      whyChain,
      fishboneCategory: primaryArm ? primaryArm.category : 'Unknown',
      fishboneArms: fishboneResults,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Infers a "Why?" answer for a specific depth level based on failure characteristics.
   * Applies heuristics based on severity, stage name, message content, and context keys.
   *
   * @private
   * @param {FailureEntry} failure - Failure to analyze
   * @param {number}       depth   - Current why-depth
   * @returns {string} Inferred answer
   */
  _inferWhy(failure, depth) {
    const { stage, message, severity, context } = failure;
    const msgLower = message.toLowerCase();
    const hasTimeout    = msgLower.includes('timeout') || msgLower.includes('timed out');
    const hasMemory     = msgLower.includes('memory') || msgLower.includes('heap') || msgLower.includes('oom');
    const hasAuth       = msgLower.includes('auth') || msgLower.includes('unauthorized') || msgLower.includes('403') || msgLower.includes('401');
    const hasNetwork    = msgLower.includes('network') || msgLower.includes('econnrefused') || msgLower.includes('connection');
    const hasValidation = msgLower.includes('invalid') || msgLower.includes('schema') || msgLower.includes('validation');
    const hasConfig     = msgLower.includes('config') || msgLower.includes('missing') || msgLower.includes('undefined');
    const ctxKeys       = Object.keys(context);

    switch (depth) {
      case 1:
        if (hasTimeout)    return `Stage "${stage}" exceeded its allotted execution window`;
        if (hasMemory)     return `Stage "${stage}" exhausted available memory resources`;
        if (hasAuth)       return `Stage "${stage}" encountered an authorization or credential failure`;
        if (hasNetwork)    return `Stage "${stage}" could not reach a required external dependency`;
        if (hasValidation) return `Stage "${stage}" received input that did not conform to expected schema`;
        if (hasConfig)     return `Stage "${stage}" encountered a missing or misconfigured dependency`;
        return `Stage "${stage}" produced an unexpected runtime error (severity: ${severity})`;

      case 2:
        if (hasTimeout)    return `Resource contention or upstream latency caused the stage to block`;
        if (hasMemory)     return `Accumulated state or unbounded data growth consumed available heap`;
        if (hasAuth)       return `Credentials were rotated, expired, or never provisioned for this stage`;
        if (hasNetwork)    return `The target service was unavailable, rate-limiting, or misconfigured`;
        if (hasValidation) return `Upstream stage produced output with unexpected shape or missing fields`;
        if (hasConfig)     return `Environment configuration was incomplete or not propagated correctly`;
        if (ctxKeys.length) return `Unexpected interaction between context values: ${ctxKeys.slice(0, 3).join(', ')}`;
        return `An intermediate dependency failed silently before reaching this stage`;

      case 3:
        if (hasTimeout)    return `Stage had insufficient phi-backoff tolerance in its retry strategy`;
        if (hasMemory)     return `Memory eviction policy was not triggered at the right pressure threshold`;
        if (hasAuth)       return `Secret rotation lifecycle was not wired into the pipeline health check`;
        if (hasNetwork)    return `No circuit breaker or fallback was defined for this external dependency`;
        if (hasValidation) return `Schema versioning was not enforced between producing and consuming stages`;
        return `The pipeline lacked a guard condition that should have detected this state earlier`;

      case 4:
        if (hasTimeout)    return `Pipeline timeout budget was not derived from phi-scaled constants (φⁿ × 1000)`;
        if (hasMemory)     return `Stage did not implement a phi-proportioned memory pressure backpressure gate`;
        if (hasAuth)       return `Credential lifecycle was treated as infrastructure concern rather than pipeline concern`;
        if (hasNetwork)    return `Resilience patterns (retry, bulkhead, fallback) were not codified as CSL gates`;
        return `Design assumed a happy path; no phi-harmonic fault tolerance envelope was specified`;

      case 5:
        // Root cause — always systemic
        return `Root cause: lack of phi-compliant defensive design at the "${stage}" boundary. Every stage must assert its preconditions via CSL gate before proceeding.`;

      default:
        return `Unresolved causal chain beyond depth ${depth}`;
    }
  }

  /**
   * Heuristically determines whether an answer represents a system-fundamental cause
   * that warrants stopping the why-chain recursion early.
   *
   * @private
   * @param {string} answer - The inferred why-answer
   * @returns {boolean}
   */
  _isSystemFundamental(answer) {
    const fundamentalPatterns = [
      'root cause',
      'phi-compliant',
      'csl gate',
      'design assumed',
      'no guard',
    ];
    const lower = answer.toLowerCase();
    return fundamentalPatterns.some(p => lower.includes(p));
  }

  /**
   * Scores the relevance of a failure to a given Ishikawa fishbone arm category.
   *
   * @private
   * @param {FailureEntry} failure  - The failure entry
   * @param {string}       category - Fishbone category name
   * @returns {number} Relevance score in [0, 1]
   */
  _scoreFishboneArm(failure, category) {
    const msgLower = (failure.message || '').toLowerCase();
    const stageLower = (failure.stage || '').toLowerCase();

    const patterns = {
      Technology: ['bug', 'error', 'exception', 'crash', 'timeout', 'memory', 'heap', 'stack', 'null', 'undefined', 'type'],
      Process: ['sequence', 'order', 'step', 'missing', 'skip', 'retry', 'loop', 'deadlock', 'race'],
      Data: ['invalid', 'schema', 'format', 'null', 'empty', 'stale', 'corrupt', 'parse', 'serialize', 'json'],
      People: ['assumption', 'config', 'parameter', 'wrong', 'incorrect', 'misunderstand', 'gap', 'knowledge'],
      Environment: ['network', 'connection', 'auth', 'credential', 'external', 'api', 'service', 'infra', 'cloud', 'disk', 'env'],
    };

    const keywords = patterns[category] || [];
    let hits = 0;
    for (const kw of keywords) {
      if (msgLower.includes(kw) || stageLower.includes(kw)) hits++;
    }

    // Base score: keyword hit rate weighted by severity
    const severityMultiplier = {
      CRITICAL: 1.0,
      HIGH: PHI - 1,   // ≈ 0.618
      MEDIUM: PSI * PSI, // ≈ 0.382
      LOW: PSI * PSI * PSI, // ≈ 0.236
    }[failure.severity] || PSI;

    const rawScore = Math.min(hits / Math.max(keywords.length * 0.3, 1), 1);
    return Math.min(rawScore * severityMultiplier + 0.1, 1.0);
  }

  /**
   * Generates a human-readable description of the failure cause within a fishbone arm.
   *
   * @private
   * @param {FailureEntry} failure  - The failure entry
   * @param {string}       category - Fishbone category
   * @returns {string} Causal description
   */
  _describeArm(failure, category) {
    const descMap = {
      Technology: `Software defect or misconfiguration in stage "${failure.stage}"`,
      Process: `Incorrect execution sequence or missing pipeline step in stage "${failure.stage}"`,
      Data: `Invalid, stale, or malformed data encountered by stage "${failure.stage}"`,
      People: `Incorrect assumption or knowledge gap led to improper configuration of "${failure.stage}"`,
      Environment: `External infrastructure or dependency failure impacted stage "${failure.stage}"`,
    };
    return descMap[category] || `Unknown cause in "${failure.stage}"`;
  }

  /**
   * Traverses the why-chain to compute the total depth reached.
   *
   * @private
   * @param {WhyNode|null} node - Root why node
   * @returns {number} Depth count
   */
  _chainDepth(node) {
    let depth = 0;
    let cur = node;
    while (cur) {
      depth = cur.depth;
      cur = cur.child;
    }
    return depth;
  }

  /**
   * Returns the deepest (root-most) WhyNode in the chain.
   *
   * @private
   * @param {WhyNode|null} node - Root why node
   * @returns {WhyNode|null}
   */
  _deepestNode(node) {
    let cur = node;
    while (cur && cur.child) cur = cur.child;
    return cur;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RecurrenceDetector
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FailureCluster
 * @property {string}         patternId     - Unique pattern identifier
 * @property {FailureEntry[]} members       - Failures belonging to this cluster
 * @property {number}         centroid[]    - Mean feature vector of the cluster
 * @property {string}         trend         - 'increasing' | 'stable' | 'decreasing'
 * @property {number}         occurrences   - Total historical occurrence count
 * @property {boolean}        shouldEscalate - True if occurrences > fib(4) = 3
 */

/**
 * Clusters failures by semantic similarity and detects recurrence patterns.
 * Uses cosine similarity with the SAME_MISTAKE_THRESHOLD (ψ ≈ 0.618).
 *
 * @class RecurrenceDetector
 */
class RecurrenceDetector {
  /**
   * Groups current and historical failures into recurrence clusters.
   * Two failures are in the same cluster if their feature vectors have cosine
   * similarity >= SAME_MISTAKE_THRESHOLD (1/φ = 0.618).
   *
   * @param {FailureEntry[]} currentFailures    - Failures from the current run
   * @param {FailureEntry[]} historicalFailures - Failures from historical runs
   * @returns {FailureCluster[]} Array of failure clusters, sorted by recurrence desc
   */
  cluster(currentFailures, historicalFailures) {
    const allFailures = [...currentFailures, ...historicalFailures];
    if (allFailures.length === 0) return [];

    // Build per-failure feature vectors
    const catalog = new FailureCatalog();
    allFailures.forEach(f => catalog.addFailure(f.stage, f.message, f.severity, f.context));
    const vectors = allFailures.map(f => {
      const mini = new FailureCatalog();
      mini.addFailure(f.stage, f.message, f.severity, f.context);
      return mini.toVector();
    });

    // Greedy clustering: assign each failure to existing cluster or create new one
    const clusters = [];
    for (let i = 0; i < allFailures.length; i++) {
      let assigned = false;
      for (const cluster of clusters) {
        const sim = cosineSimilarity(vectors[i], cluster._centroid);
        if (sim >= SAME_MISTAKE_THRESHOLD) {
          cluster.members.push(allFailures[i]);
          // Update centroid as running mean
          cluster._centroid = _vectorMean([cluster._centroid, vectors[i]]);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        clusters.push({
          patternId: `pattern-${clusters.length + 1}-${allFailures[i].stage}`,
          members: [allFailures[i]],
          _centroid: vectors[i].slice(),
          centroid: vectors[i].slice(),
          trend: 'stable',
          occurrences: 1,
          shouldEscalate: false,
        });
      }
    }

    // Compute occurrences and escalation for each cluster
    for (const cluster of clusters) {
      cluster.occurrences = this.countOccurrences(cluster);
      cluster.shouldEscalate = this.shouldEscalate(cluster);
      cluster.trend = this.getTrend(cluster);
      cluster.centroid = cluster._centroid.slice();
    }

    return clusters.sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Counts the total number of occurrences for a given failure cluster.
   * Counts both historical and current run members.
   *
   * @param {FailureCluster} cluster - The failure cluster
   * @returns {number} Total occurrence count
   */
  countOccurrences(cluster) {
    return cluster.members.length;
  }

  /**
   * Returns true if the cluster's occurrence count exceeds the phi-derived
   * escalation threshold: fib(4) = 3.
   *
   * @param {FailureCluster} cluster - The failure cluster
   * @returns {boolean} True if immediate escalation is required
   */
  shouldEscalate(cluster) {
    return cluster.members.length > MAX_RECURRENCES_BEFORE_ESCALATION;
  }

  /**
   * Analyzes the temporal distribution of failures in a cluster to determine
   * whether the recurrence frequency is increasing, stable, or decreasing.
   *
   * Uses the ratio of recent-half to early-half occurrence timestamps.
   *
   * @param {FailureCluster} cluster - The failure cluster
   * @returns {'increasing'|'stable'|'decreasing'} Trend label
   */
  getTrend(cluster) {
    const members = cluster.members;
    if (members.length < 2) return 'stable';

    const sorted = members
      .filter(m => m.timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length < 2) return 'stable';

    const mid = Math.floor(sorted.length / 2);
    const earlyHalf = sorted.slice(0, mid);
    const lateHalf  = sorted.slice(mid);

    // Count failures per unit time in each half
    const earlySpan = (earlyHalf[earlyHalf.length - 1].timestamp - earlyHalf[0].timestamp) || 1;
    const lateSpan  = (lateHalf[lateHalf.length - 1].timestamp  - lateHalf[0].timestamp)  || 1;

    const earlyRate = earlyHalf.length / earlySpan;
    const lateRate  = lateHalf.length  / lateSpan;

    const ratio = lateRate / (earlyRate || Number.EPSILON);

    // Phi-derived thresholds for trend classification
    if (ratio > PHI)      return 'increasing';  // ratio > 1.618
    if (ratio < PSI)      return 'decreasing';  // ratio < 0.618
    return 'stable';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PreventionRuleGenerator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PreventionRule
 * @property {string}  ruleId          - Unique rule identifier
 * @property {string}  type            - 'csl_gate' | 'recon_check' | 'trial_warning' | 'test_case'
 * @property {string}  targetStage     - Stage the rule protects
 * @property {string}  rootCauseClass  - Root cause class this rule addresses
 * @property {Object}  gate            - CSL gate parameters (tau, threshold, action)
 * @property {string}  description     - Human-readable rule description
 * @property {number}  confidence      - Phi-derived confidence in [0, 1]
 * @property {number}  createdAt       - Unix epoch ms
 */

/**
 * Generates machine-executable CSL gate prevention rules from root cause analyses.
 *
 * @class PreventionRuleGenerator
 */
class PreventionRuleGenerator {
  /**
   * Generates a CSL gate rule that blocks the identified failure pattern.
   * The gate fires when a precondition score falls below the failure threshold.
   *
   * @param {RootCauseResult} rootCause - Root cause analysis output
   * @returns {PreventionRule} A machine-executable CSL gate rule
   */
  generateCSLGate(rootCause) {
    const threshold = this._deriveCslThreshold(rootCause);
    return {
      ruleId: `csl-gate-${_hashString(rootCause.class)}-${Date.now()}`,
      type: 'csl_gate',
      targetStage: rootCause.class.split('::')[0],
      rootCauseClass: rootCause.class,
      gate: {
        tau: PSI,                  // sharpness ψ ≈ 0.618
        threshold,                 // phi-derived gate threshold
        temperature: PSI * PSI,    // ψ² ≈ 0.236
        action: 'block_and_escalate',
        preconditionVector: 'stage.preconditionScore',
        description: `Block stage execution when precondition score < ${threshold.toFixed(4)} (phi-derived)`,
      },
      description: `CSL gate preventing recurrence of ${rootCause.rootCause}`,
      confidence: this._computeRuleConfidence(rootCause),
      createdAt: Date.now(),
    };
  }

  /**
   * Generates an automated regression test case for the given root cause pattern.
   *
   * @param {RootCauseResult} rootCause - Root cause analysis output
   * @returns {PreventionRule} A test case prevention rule
   */
  generateTestCase(rootCause) {
    const stage = rootCause.class.split('::')[0];
    return {
      ruleId: `test-${_hashString(rootCause.class)}-${Date.now()}`,
      type: 'test_case',
      targetStage: stage,
      rootCauseClass: rootCause.class,
      gate: {
        assertionType: 'regression',
        scenario: `Reproduce ${rootCause.fishboneCategory} failure in stage "${stage}"`,
        expectedOutcome: 'BLOCKED_BY_CSL_GATE',
        fixtureContext: { rootCause: rootCause.rootCause, depth: rootCause.depth },
      },
      description: `Auto regression test: verify CSL gate prevents "${rootCause.rootCause}"`,
      confidence: this._computeRuleConfidence(rootCause),
      createdAt: Date.now(),
    };
  }

  /**
   * Generates a pre-action scan check to inject into the RECON stage.
   * The check probes for conditions that historically led to this failure pattern.
   *
   * @param {RootCauseResult} rootCause - Root cause analysis output
   * @returns {PreventionRule} A RECON check prevention rule
   */
  generateReconCheck(rootCause) {
    const stage = rootCause.class.split('::')[0];
    return {
      ruleId: `recon-${_hashString(rootCause.class)}-${Date.now()}`,
      type: 'recon_check',
      targetStage: 'RECON',
      rootCauseClass: rootCause.class,
      gate: {
        scanTarget: stage,
        checkType: rootCause.fishboneCategory,
        probes: this._buildReconProbes(rootCause),
        threshold: CSL_THRESHOLDS.MEDIUM, // ≈ 0.809 — medium CSL gate
        action: 'warn_and_recommend',
      },
      description: `RECON pre-scan: detect ${rootCause.fishboneCategory} preconditions for "${stage}" failure`,
      confidence: this._computeRuleConfidence(rootCause),
      createdAt: Date.now(),
    };
  }

  /**
   * Generates a known failure mode warning to inject into the TRIAL_AND_ERROR stage.
   * Prevents the experimentation engine from repeating known-bad paths.
   *
   * @param {RootCauseResult} rootCause - Root cause analysis output
   * @returns {PreventionRule} A TRIAL_AND_ERROR warning rule
   */
  generateTrialWarning(rootCause) {
    const stage = rootCause.class.split('::')[0];
    return {
      ruleId: `trial-warn-${_hashString(rootCause.class)}-${Date.now()}`,
      type: 'trial_warning',
      targetStage: 'TRIAL_AND_ERROR',
      rootCauseClass: rootCause.class,
      gate: {
        knownBadPattern: rootCause.rootCause,
        affectedStage: stage,
        penalty: PSI,     // ψ ≈ 0.618 — reduce trial score for this pattern
        avoidanceWeight: PSI * PSI, // ψ² ≈ 0.236
        whyChainDepth: rootCause.depth,
      },
      description: `Trial warning: known failure mode "${rootCause.rootCause}" — penalize experiments targeting "${stage}"`,
      confidence: this._computeRuleConfidence(rootCause),
      createdAt: Date.now(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Derives the appropriate CSL threshold for a prevention rule based on
   * the failure's severity and fishbone category.
   *
   * @private
   * @param {RootCauseResult} rootCause
   * @returns {number} CSL threshold in [0, 1]
   */
  _deriveCslThreshold(rootCause) {
    const severity = (rootCause.class.split('::')[1] || 'MEDIUM').toUpperCase();
    const categoryMap = {
      CRITICAL: CSL_THRESHOLDS.CRITICAL, // ≈ 0.927
      HIGH:     CSL_THRESHOLDS.HIGH,     // ≈ 0.882
      MEDIUM:   CSL_THRESHOLDS.MEDIUM,   // ≈ 0.809
      LOW:      CSL_THRESHOLDS.LOW,      // ≈ 0.691
    };
    return categoryMap[severity] || CSL_THRESHOLDS.MEDIUM;
  }

  /**
   * Computes phi-weighted rule confidence from root cause analysis depth and fishbone score.
   *
   * @private
   * @param {RootCauseResult} rootCause
   * @returns {number} Confidence in [0, 1]
   */
  _computeRuleConfidence(rootCause) {
    const depthScore = rootCause.depth / MAX_WHY_DEPTH;
    const fishboneScore = (rootCause.fishboneArms && rootCause.fishboneArms[0])
      ? rootCause.fishboneArms[0].confidence
      : 0.5;
    const [w1, w2] = phiFusionWeights(2); // [0.618, 0.382]
    return Math.min(w1 * depthScore + w2 * fishboneScore, 1.0);
  }

  /**
   * Builds probes for the RECON stage to scan for preconditions.
   *
   * @private
   * @param {RootCauseResult} rootCause
   * @returns {string[]} List of probe names
   */
  _buildReconProbes(rootCause) {
    const probeMap = {
      Technology: ['check_service_health', 'verify_dependencies', 'assert_memory_headroom'],
      Process:    ['verify_stage_order', 'check_prerequisite_outputs', 'validate_pipeline_state'],
      Data:       ['validate_input_schema', 'check_data_freshness', 'verify_data_completeness'],
      People:     ['validate_configuration', 'check_parameter_bounds', 'assert_assumptions'],
      Environment: ['ping_external_dependencies', 'check_credentials', 'verify_network_access'],
    };
    return probeMap[rootCause.fishboneCategory] || ['generic_precondition_check'];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MistakeCostCalculator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} MistakeCost
 * @property {number} time_hours    - Developer/compute hours wasted
 * @property {number} money_usd     - Estimated compute / API cost in USD
 * @property {number} quality_score - User impact score in [0, 1]
 * @property {number} total         - Phi-weighted total: 0.382×time + 0.382×money + 0.236×quality
 */

/**
 * Computes phi-weighted cost estimates for pipeline mistakes.
 * Weights: time=0.382, money=0.382, quality=0.236 (all phi-derived).
 *
 * @class MistakeCostCalculator
 */
class MistakeCostCalculator {
  /**
   * Estimates compute/developer time wasted by a failure.
   * Higher severity and deeper why-chains cost more time.
   *
   * @param {FailureEntry}  failure   - The failure entry
   * @param {number}        [whyDepth=1] - Depth of root cause chain (proxy for complexity)
   * @returns {number} Estimated time cost in hours
   */
  computeTimeCost(failure, whyDepth = 1) {
    const severityHours = {
      CRITICAL: PHI * PHI * PHI,  // φ³ ≈ 4.236 hours
      HIGH:     PHI * PHI,         // φ² ≈ 2.618 hours
      MEDIUM:   PHI,               // φ  ≈ 1.618 hours
      LOW:      1 / PHI,           // ψ  ≈ 0.618 hours
    };
    const base = severityHours[failure.severity] || 1;
    // Scale by why-depth: deeper root cause = more investigation time
    const depthMultiplier = 1 + (whyDepth - 1) * PSI;
    return parseFloat((base * depthMultiplier).toFixed(4));
  }

  /**
   * Estimates the compute/API monetary cost of a failure.
   * Based on stage type heuristics and severity.
   *
   * @param {FailureEntry} failure - The failure entry
   * @returns {number} Estimated money cost in USD
   */
  computeMoneyCost(failure) {
    const severityCost = {
      CRITICAL: PHI_SQ * 10,    // φ² × $10 ≈ $26.18
      HIGH:     PHI * 10,        // φ  × $10 ≈ $16.18
      MEDIUM:   PHI * 5,         // φ  × $5  ≈ $8.09
      LOW:      PSI * 5,         // ψ  × $5  ≈ $3.09
    };
    const base = severityCost[failure.severity] || PHI;
    // LLM-heavy stages cost more on failure
    const stageMultiplier = _isLLMStage(failure.stage) ? PHI : 1.0;
    return parseFloat((base * stageMultiplier).toFixed(4));
  }

  /**
   * Estimates the user/quality impact score of a failure.
   * Expressed in [0, 1]: 1.0 = total user-facing outage.
   *
   * @param {FailureEntry} failure - The failure entry
   * @returns {number} Quality impact score in [0, 1]
   */
  computeQualityCost(failure) {
    const severityQuality = {
      CRITICAL: 1.0,
      HIGH:     1 - PSI * PSI,   // 1 - ψ² ≈ 0.764
      MEDIUM:   1 - PSI,          // 1 - ψ  ≈ 0.382
      LOW:      PSI * PSI,        // ψ²    ≈ 0.236
    };
    return severityQuality[failure.severity] || PSI;
  }

  /**
   * Computes the phi-weighted total cost from the three cost dimensions.
   * Formula: 0.382 × time + 0.382 × money + 0.236 × quality
   *
   * @param {number} time    - Time cost (hours)
   * @param {number} money   - Money cost (USD)
   * @param {number} quality - Quality impact score [0, 1]
   * @returns {number} Phi-weighted total
   */
  computeTotal(time, money, quality) {
    return parseFloat((
      COST_WEIGHT_TIME    * time  +
      COST_WEIGHT_MONEY   * money +
      COST_WEIGHT_QUALITY * quality
    ).toFixed(4));
  }

  /**
   * Computes aggregated cost across an entire list of failures.
   *
   * @param {FailureEntry[]}  failures  - Array of failure entries
   * @param {RootCauseResult[]} rootCauses - Corresponding root causes for depth info
   * @returns {MistakeCost} Aggregated cost breakdown
   */
  computeAggregate(failures, rootCauses = []) {
    let totalTime = 0;
    let totalMoney = 0;
    let totalQuality = 0;

    failures.forEach((failure, idx) => {
      const rc = rootCauses[idx] || null;
      const depth = rc ? rc.depth : 1;
      totalTime    += this.computeTimeCost(failure, depth);
      totalMoney   += this.computeMoneyCost(failure);
      totalQuality += this.computeQualityCost(failure);
    });

    const qualityScore = failures.length > 0
      ? Math.min(totalQuality / failures.length, 1.0)
      : 0;

    return {
      time_hours:    parseFloat(totalTime.toFixed(4)),
      money_usd:     parseFloat(totalMoney.toFixed(4)),
      quality_score: parseFloat(qualityScore.toFixed(4)),
      total: this.computeTotal(totalTime, totalMoney, qualityScore),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MistakeReport
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured report produced by the MistakeAnalysisEngine for a pipeline run.
 * Contains full analysis results, prevention rules, and immunization actions.
 *
 * @class MistakeReport
 */
class MistakeReport {
  /**
   * @param {Object} data - Report data fields
   * @param {number}   data.currentRunFailures     - Count of failures in current run
   * @param {number}   data.historicalMatches       - Count of historical similar failures found
   * @param {RootCauseResult[]} data.rootCauses      - Root cause analyses
   * @param {FailureCluster[]}  data.recurringPatterns - Recurrence clusters with trend info
   * @param {number}   data.preventionRulesGenerated - Count of prevention rules created
   * @param {number}   data.antiRegressionGuards     - Count of anti-regression guards injected
   * @param {MistakeCost} data.totalMistakeCost       - Phi-weighted cost breakdown
   * @param {string[]} data.immunizationActions       - Human-readable immunization actions
   * @param {string}   data.runId                    - Pipeline run identifier
   * @param {number}   data.analysisTimestamp        - Unix epoch ms of analysis
   * @param {number}   data.analysisMs               - Time taken for analysis (ms)
   */
  constructor(data) {
    this.currentRunFailures     = data.currentRunFailures     || 0;
    this.historicalMatches      = data.historicalMatches      || 0;
    this.rootCauses             = data.rootCauses             || [];
    this.recurringPatterns      = data.recurringPatterns      || [];
    this.preventionRulesGenerated = data.preventionRulesGenerated || 0;
    this.antiRegressionGuards   = data.antiRegressionGuards   || 0;
    this.totalMistakeCost       = data.totalMistakeCost       || { time_hours: 0, money_usd: 0, quality_score: 0, total: 0 };
    this.immunizationActions    = data.immunizationActions    || [];
    this.runId                  = data.runId                  || 'unknown';
    this.analysisTimestamp      = data.analysisTimestamp      || Date.now();
    this.analysisMs             = data.analysisMs             || 0;
  }

  /**
   * Serializes the report to a plain JSON-compatible object.
   *
   * @returns {Object} Plain JSON representation
   */
  toJSON() {
    return {
      stage: 'MISTAKE_ANALYSIS',
      runId: this.runId,
      analysisTimestamp: this.analysisTimestamp,
      analysisMs: this.analysisMs,
      currentRunFailures: this.currentRunFailures,
      historicalMatches: this.historicalMatches,
      rootCauses: this.rootCauses.map(rc => ({
        class: rc.class,
        category: rc.category,
        depth: rc.depth,
        rootCause: rc.rootCause,
        fishboneCategory: rc.fishboneCategory,
      })),
      recurringPatterns: this.recurringPatterns.map(p => ({
        pattern: p.patternId,
        occurrences: p.occurrences,
        severity: p.members && p.members[0] ? p.members[0].severity : 'UNKNOWN',
        trend: p.trend,
        shouldEscalate: p.shouldEscalate,
      })),
      preventionRulesGenerated: this.preventionRulesGenerated,
      antiRegressionGuards: this.antiRegressionGuards,
      totalMistakeCost: this.totalMistakeCost,
      immunizationActions: this.immunizationActions,
    };
  }

  /**
   * Serializes the report to a human-readable Markdown string.
   *
   * @returns {string} Markdown-formatted report
   */
  toMarkdown() {
    const lines = [
      `# MISTAKE_ANALYSIS Report`,
      ``,
      `**Run ID**: \`${this.runId}\`  `,
      `**Analysis Time**: ${new Date(this.analysisTimestamp).toISOString()}  `,
      `**Duration**: ${this.analysisMs}ms  `,
      ``,
      `## Summary`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Current Run Failures | ${this.currentRunFailures} |`,
      `| Historical Matches | ${this.historicalMatches} |`,
      `| Root Causes Found | ${this.rootCauses.length} |`,
      `| Recurring Patterns | ${this.recurringPatterns.length} |`,
      `| Prevention Rules Generated | ${this.preventionRulesGenerated} |`,
      `| Anti-Regression Guards | ${this.antiRegressionGuards} |`,
      ``,
      `## Mistake Cost (φ-weighted)`,
      ``,
      `| Dimension | Value | Weight |`,
      `|-----------|-------|--------|`,
      `| Time | ${this.totalMistakeCost.time_hours} hours | 0.382 (1-1/φ) |`,
      `| Money | $${this.totalMistakeCost.money_usd} | 0.382 (1-1/φ) |`,
      `| Quality | ${this.totalMistakeCost.quality_score} | 0.236 (1/φ²) |`,
      `| **Total** | **${this.totalMistakeCost.total}** | — |`,
      ``,
    ];

    if (this.rootCauses.length > 0) {
      lines.push(`## Root Causes`, ``);
      this.rootCauses.forEach((rc, i) => {
        lines.push(
          `### ${i + 1}. ${rc.class}`,
          ``,
          `- **Category**: ${rc.category}  `,
          `- **Fishbone Arm**: ${rc.fishboneCategory}  `,
          `- **Why-Depth**: ${rc.depth}/${MAX_WHY_DEPTH}  `,
          `- **Root Cause**: ${rc.rootCause}  `,
          ``,
        );
      });
    }

    if (this.recurringPatterns.length > 0) {
      lines.push(`## Recurring Patterns`, ``);
      this.recurringPatterns.forEach((p, i) => {
        const sev = p.members && p.members[0] ? p.members[0].severity : 'UNKNOWN';
        lines.push(
          `${i + 1}. **${p.patternId}** — ${p.occurrences} occurrences (${p.trend}) [${sev}]${p.shouldEscalate ? ' ⚠ ESCALATE' : ''}`,
        );
      });
      lines.push(``);
    }

    if (this.immunizationActions.length > 0) {
      lines.push(`## Immunization Actions`, ``);
      this.immunizationActions.forEach(action => lines.push(`- ${action}`));
      lines.push(``);
    }

    lines.push(
      `---`,
      `*Timeout: φ⁵ × 1000 = ${ANALYSIS_TIMEOUT_MS}ms | Lookback: fib(11) = ${HISTORICAL_LOOKBACK} runs | Threshold: 1/φ = ${SAME_MISTAKE_THRESHOLD.toFixed(6)}*`,
    );

    return lines.join('\n');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MistakeAnalysisEngine (main)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main engine for Stage 16: MISTAKE_ANALYSIS of the HCFullPipeline.
 *
 * Orchestrates the full mistake analysis cycle:
 *   catalog → analyze → pattern → prevent → immunize
 *
 * Emits events at each stage for observability:
 *   mistake:cataloged, rootcause:found, recurrence:detected, recurrence:escalated,
 *   prevention:generated, immunization:applied, analysis:complete
 *
 * @class MistakeAnalysisEngine
 * @extends EventEmitter
 *
 * @example
 * const engine = new MistakeAnalysisEngine(vectorMemory, wisdomStore);
 * const report = await engine.analyze(pipelineRun);
 * console.log(report.toMarkdown());
 */
class MistakeAnalysisEngine extends EventEmitter {
  /**
   * Creates a new MistakeAnalysisEngine.
   *
   * @param {Object} vectorMemory - Vector memory store with search(namespace, vector, k) API
   * @param {Object} wisdomStore  - Wisdom store with get/set/append API for wisdom.json
   */
  constructor(vectorMemory, wisdomStore) {
    super();
    this._vectorMemory = vectorMemory || _nullVectorMemory();
    this._wisdomStore  = wisdomStore  || _nullWisdomStore();

    this._rootCauseAnalyzer   = new RootCauseAnalyzer();
    this._recurrenceDetector  = new RecurrenceDetector();
    this._preventionGenerator = new PreventionRuleGenerator();
    this._costCalculator      = new MistakeCostCalculator();

    /** @type {MistakeReport[]} History of all past analyses (permanent, never deleted) */
    this._analysisHistory = [];

    /** @type {PreventionRule[]} Accumulated prevention rules */
    this._preventionRules = [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIMARY ENTRYPOINT
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Executes the full mistake analysis cycle for a pipeline run.
   * Enforces the φ⁵ × 1000 = 11090ms timeout.
   *
   * Cycle: catalog → analyze → pattern → prevent → immunize
   *
   * @param {Object} pipelineRun - The completed pipeline run object
   * @param {string}   pipelineRun.id          - Run identifier
   * @param {Object[]} pipelineRun.stages      - Array of stage execution results
   * @param {Object[]} [pipelineRun.errors]    - Top-level errors if any
   * @param {Object}   [pipelineRun.metadata]  - Pipeline run metadata
   * @returns {Promise<MistakeReport>} Full mistake analysis report
   */
  async analyze(pipelineRun) {
    const startMs = Date.now();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`MISTAKE_ANALYSIS timeout after ${ANALYSIS_TIMEOUT_MS}ms (φ⁵ × 1000)`)), ANALYSIS_TIMEOUT_MS)
    );

    const analysisPromise = this._runAnalysisCycle(pipelineRun, startMs);

    return Promise.race([analysisPromise, timeoutPromise]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CYCLE STEPS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Step 1 — CATALOG: Extract all errors, warnings, and suboptimal results
   * from the pipeline run into a structured FailureCatalog.
   *
   * @param {Object} run - Pipeline run object
   * @returns {FailureCatalog} Populated failure catalog
   */
  catalogFailures(run) {
    const catalog = new FailureCatalog();
    const stages = run.stages || [];
    const topErrors = run.errors || [];

    // Catalog top-level errors
    for (const err of topErrors) {
      const severity = err.severity || 'HIGH';
      catalog.addFailure(err.stage || 'PIPELINE', err, severity, err.context || {});
    }

    // Catalog per-stage failures
    for (const stage of stages) {
      const stageId = stage.id || stage.name || 'UNKNOWN_STAGE';

      // Hard errors
      for (const err of (stage.errors || [])) {
        const severity = _classifySeverity(err, stage);
        catalog.addFailure(stageId, err, severity, {
          stageStatus: stage.status,
          durationMs: stage.durationMs,
          ...(err.context || {}),
        });
        this.emit('mistake:cataloged', { stage: stageId, severity, message: String(err.message || err) });
      }

      // Warnings treated as MEDIUM or LOW
      for (const warn of (stage.warnings || [])) {
        catalog.addFailure(stageId, warn, 'LOW', {
          type: 'warning',
          stageStatus: stage.status,
          ...(warn.context || {}),
        });
        this.emit('mistake:cataloged', { stage: stageId, severity: 'LOW', message: String(warn.message || warn) });
      }

      // Suboptimal results (e.g., partial success, quality below threshold)
      if (stage.qualityScore !== undefined && stage.qualityScore < PSI) {
        catalog.addFailure(stageId, `Suboptimal quality score: ${stage.qualityScore} (threshold: ${PSI.toFixed(4)})`, 'MEDIUM', {
          qualityScore: stage.qualityScore,
          threshold: PSI,
        });
        this.emit('mistake:cataloged', { stage: stageId, severity: 'MEDIUM', message: 'Suboptimal quality score' });
      }
    }

    return catalog;
  }

  /**
   * Step 2 — RETRIEVE: Search vector memory for historically similar failures.
   * Lookback window: fib(11) = 89 pipeline runs.
   * Similarity threshold: 1/φ = 0.618.
   *
   * @param {FailureCatalog} catalog - Current run's failure catalog
   * @returns {Promise<FailureEntry[]>} Historical failure entries matching current patterns
   */
  async retrieveHistorical(catalog) {
    if (catalog.size === 0) return [];

    const catalogVector = catalog.toVector();
    try {
      const results = await this._vectorMemory.search(
        'failures',
        catalogVector,
        HISTORICAL_LOOKBACK,
      );

      // Filter to only results above the same-mistake threshold
      return (results || [])
        .filter(r => r.score >= SAME_MISTAKE_THRESHOLD)
        .map(r => r.entry || r.data || r)
        .flat()
        .filter(Boolean);
    } catch (err) {
      // Non-fatal: historical retrieval failure degrades gracefully
      this.emit('error', { stage: 'retrieveHistorical', error: err.message });
      return [];
    }
  }

  /**
   * Step 3a — ANALYZE: Perform 5-Whys + Fishbone root cause analysis on a failure class.
   * A "failure class" is a representative FailureEntry for a cluster.
   *
   * @param {FailureEntry} failureClass - Representative failure for this class
   * @returns {RootCauseResult} Root cause analysis result
   */
  performRootCause(failureClass) {
    const whyChain = this._rootCauseAnalyzer.fiveWhys(failureClass);
    const fishboneResults = this._rootCauseAnalyzer.fishbone(failureClass);
    const result = this._rootCauseAnalyzer.synthesize(whyChain, fishboneResults, failureClass);
    this.emit('rootcause:found', { class: result.class, rootCause: result.rootCause, depth: result.depth });
    return result;
  }

  /**
   * Step 3b — PATTERN: Detect recurring failure patterns across current and historical failures.
   * Escalates patterns exceeding fib(4) = 3 recurrences.
   *
   * @param {FailureEntry[]} currentFailures    - From the current run
   * @param {FailureEntry[]} historicalFailures - From vector memory
   * @returns {FailureCluster[]} Detected recurrence clusters
   */
  detectRecurring(currentFailures, historicalFailures) {
    const clusters = this._recurrenceDetector.cluster(currentFailures, historicalFailures);

    for (const cluster of clusters) {
      this.emit('recurrence:detected', {
        patternId: cluster.patternId,
        occurrences: cluster.occurrences,
        trend: cluster.trend,
      });
      if (cluster.shouldEscalate) {
        this.emit('recurrence:escalated', {
          patternId: cluster.patternId,
          occurrences: cluster.occurrences,
          maxAllowed: MAX_RECURRENCES_BEFORE_ESCALATION,
          message: `Pattern "${cluster.patternId}" has recurred ${cluster.occurrences} times — exceeds fib(4)=${MAX_RECURRENCES_BEFORE_ESCALATION}`,
        });
      }
    }

    return clusters;
  }

  /**
   * Step 4 — PREVENT: Generate machine-executable CSL gate prevention rules
   * for each identified root cause.
   *
   * @param {RootCauseResult[]} rootCauses - Array of root cause analysis results
   * @returns {PreventionRule[]} All generated prevention rules (CSL gates + tests + recon + trial)
   */
  generatePreventionRules(rootCauses) {
    const rules = [];
    for (const rc of rootCauses) {
      const cslGateRule    = this._preventionGenerator.generateCSLGate(rc);
      const testCaseRule   = this._preventionGenerator.generateTestCase(rc);
      const reconCheckRule = this._preventionGenerator.generateReconCheck(rc);
      const trialWarnRule  = this._preventionGenerator.generateTrialWarning(rc);

      rules.push(cslGateRule, testCaseRule, reconCheckRule, trialWarnRule);

      this.emit('prevention:generated', {
        rootCauseClass: rc.class,
        rulesGenerated: 4,
        ruleIds: [cslGateRule.ruleId, testCaseRule.ruleId, reconCheckRule.ruleId, trialWarnRule.ruleId],
      });
    }
    this._preventionRules.push(...rules);
    return rules;
  }

  /**
   * Step 4b — GUARDS: Register anti-regression guards into RECON and TRIAL_AND_ERROR config.
   * Returns the count of guards successfully injected.
   *
   * @param {PreventionRule[]} rules - Prevention rules to inject
   * @returns {number} Number of guards injected
   */
  updateAntiRegressionGuards(rules) {
    const reconRules = rules.filter(r => r.type === 'recon_check');
    const trialRules = rules.filter(r => r.type === 'trial_warning');
    const testRules  = rules.filter(r => r.type === 'test_case');
    const gateRules  = rules.filter(r => r.type === 'csl_gate');

    // Persist to wisdom store for RECON and TRIAL_AND_ERROR stages
    try {
      this._wisdomStore.set('anti_regression.recon_checks',  reconRules.map(r => r.gate));
      this._wisdomStore.set('anti_regression.trial_warnings', trialRules.map(r => r.gate));
      this._wisdomStore.set('anti_regression.csl_gates',      gateRules.map(r => r.gate));
    } catch (_) {
      // Non-fatal: degraded persistence
    }

    return reconRules.length + trialRules.length + testRules.length + gateRules.length;
  }

  /**
   * Step 5 — COST: Compute the phi-weighted total cost of all cataloged failures.
   *
   * @param {FailureEntry[]}    failures  - All failures from the current run
   * @param {RootCauseResult[]} [rootCauses=[]] - Root causes for depth weighting
   * @returns {MistakeCost} Phi-weighted cost breakdown
   */
  computeMistakeCost(failures, rootCauses = []) {
    return this._costCalculator.computeAggregate(failures, rootCauses);
  }

  /**
   * Step 6 — IMMUNIZE: Update wisdom.json and inject guards into the pipeline.
   * Stores all learnings in vector memory under the 'failures' namespace.
   * SACRED RULE: Failure history is NEVER deleted.
   *
   * @param {PreventionRule[]} rules       - Prevention rules to persist
   * @param {Object}           wisdomStore - Wisdom store reference
   * @returns {string[]} Human-readable immunization action descriptions
   */
  immunizePipeline(rules, wisdomStore) {
    const actions = [];
    const store = wisdomStore || this._wisdomStore;

    // Persist prevention rules to wisdom.json
    try {
      store.append('prevention_rules', rules);
      actions.push(`Appended ${rules.length} prevention rules to wisdom.json`);
    } catch (_) {
      actions.push(`[DEGRADED] Could not persist ${rules.length} prevention rules to wisdom.json`);
    }

    // Store failure pattern embeddings in vector memory
    const cslGates = rules.filter(r => r.type === 'csl_gate');
    for (const gate of cslGates) {
      try {
        this._vectorMemory.store('failures', gate.ruleId, gate);
        actions.push(`Stored CSL gate "${gate.ruleId}" in vector memory under 'failures' namespace`);
      } catch (_) {
        actions.push(`[DEGRADED] Could not store gate "${gate.ruleId}" in vector memory`);
      }
    }

    // Record RECON injections
    const reconChecks = rules.filter(r => r.type === 'recon_check');
    if (reconChecks.length > 0) {
      actions.push(`Injected ${reconChecks.length} pre-action scan checks into RECON stage`);
    }

    // Record TRIAL_AND_ERROR warnings
    const trialWarnings = rules.filter(r => r.type === 'trial_warning');
    if (trialWarnings.length > 0) {
      actions.push(`Registered ${trialWarnings.length} known failure modes with TRIAL_AND_ERROR`);
    }

    this.emit('immunization:applied', { actionsCount: actions.length, rulesCount: rules.length });
    return actions;
  }

  /**
   * Returns the full history of all past analyses.
   * History is permanent — it is never deleted.
   *
   * @returns {MistakeReport[]} All past MistakeReport instances
   */
  getAnalysisHistory() {
    return this._analysisHistory.slice();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE: Full cycle orchestration
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Internal orchestration method that runs all cycle steps in sequence.
   *
   * @private
   * @param {Object} pipelineRun - The pipeline run object
   * @param {number} startMs     - Start timestamp for duration measurement
   * @returns {Promise<MistakeReport>}
   */
  async _runAnalysisCycle(pipelineRun, startMs) {
    const runId = (pipelineRun && pipelineRun.id) || `run-${Date.now()}`;

    // ── Step 1: CATALOG ──────────────────────────────────────────────────────
    const catalog = this.catalogFailures(pipelineRun);
    const currentFailures = catalog.getAll();

    // ── Step 2: RETRIEVE HISTORICAL ─────────────────────────────────────────
    const historicalFailures = await this.retrieveHistorical(catalog);

    // ── Step 3a: ROOT CAUSE ──────────────────────────────────────────────────
    // Perform root cause analysis on representative failure per severity tier
    const rootCauses = [];
    for (const severity of SEVERITY_LEVELS) {
      const forSeverity = catalog.getBySeverity(severity);
      if (forSeverity.length > 0) {
        // Use most-recent failure as the class representative
        const representative = forSeverity[forSeverity.length - 1];
        rootCauses.push(this.performRootCause(representative));
      }
    }

    // ── Step 3b: DETECT RECURRENCE ───────────────────────────────────────────
    const recurringPatterns = this.detectRecurring(currentFailures, historicalFailures);

    // ── Step 4: GENERATE PREVENTION RULES ───────────────────────────────────
    const preventionRules = this.generatePreventionRules(rootCauses);

    // ── Step 4b: UPDATE ANTI-REGRESSION GUARDS ───────────────────────────────
    const guardCount = this.updateAntiRegressionGuards(preventionRules);

    // ── Step 5: COMPUTE COST ─────────────────────────────────────────────────
    const mistakeCost = this.computeMistakeCost(currentFailures, rootCauses);

    // ── Step 6: IMMUNIZE ─────────────────────────────────────────────────────
    const immunizationActions = this.immunizePipeline(preventionRules, this._wisdomStore);

    // ── Build report ─────────────────────────────────────────────────────────
    const analysisMs = Date.now() - startMs;
    const report = new MistakeReport({
      currentRunFailures: currentFailures.length,
      historicalMatches: historicalFailures.length,
      rootCauses,
      recurringPatterns,
      preventionRulesGenerated: preventionRules.length,
      antiRegressionGuards: guardCount,
      totalMistakeCost: mistakeCost,
      immunizationActions,
      runId,
      analysisTimestamp: Date.now(),
      analysisMs,
    });

    // Permanent history (never deleted)
    this._analysisHistory.push(report);

    this.emit('analysis:complete', {
      runId,
      currentRunFailures: currentFailures.length,
      historicalMatches: historicalFailures.length,
      rootCausesFound: rootCauses.length,
      preventionRulesGenerated: preventionRules.length,
      analysisMs,
    });

    return report;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple djb2-style string hash, returns a non-negative integer.
 *
 * @private
 * @param {string} str - String to hash
 * @returns {number} Non-negative integer hash
 */
function _hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & 0x7fffffff; // keep positive 31-bit
  }
  return hash;
}

/**
 * Computes the element-wise mean of an array of numeric vectors.
 *
 * @private
 * @param {number[][]} vectors - Array of equal-length numeric vectors
 * @returns {number[]} Mean vector
 */
function _vectorMean(vectors) {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  return sum.map(s => s / vectors.length);
}

/**
 * Classifies error severity based on error characteristics and stage status.
 *
 * @private
 * @param {Error|Object|string} err   - The error
 * @param {Object}              stage - Stage execution result
 * @returns {'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'}
 */
function _classifySeverity(err, stage) {
  const msg = ((err && err.message) || String(err) || '').toLowerCase();
  const stageStatus = (stage && stage.status || '').toLowerCase();

  if (stageStatus === 'crashed' || stageStatus === 'fatal') return 'CRITICAL';
  if (msg.includes('fatal') || msg.includes('crash') || msg.includes('out of memory')) return 'CRITICAL';
  if (stageStatus === 'failed' || msg.includes('error') || msg.includes('exception')) return 'HIGH';
  if (msg.includes('warn') || msg.includes('deprecat') || stageStatus === 'partial') return 'MEDIUM';
  return 'LOW';
}

/**
 * Heuristically determines whether a stage is LLM-heavy (higher API cost on failure).
 *
 * @private
 * @param {string} stageId - Stage identifier
 * @returns {boolean}
 */
function _isLLMStage(stageId) {
  const llmKeywords = ['llm', 'gpt', 'claude', 'gemini', 'inference', 'generate', 'synthesis', 'critique', 'eval'];
  const lower = (stageId || '').toLowerCase();
  return llmKeywords.some(kw => lower.includes(kw));
}

/**
 * Creates a no-op vector memory stub for environments where no real store is provided.
 *
 * @private
 * @returns {Object} Null vector memory with safe no-op methods
 */
function _nullVectorMemory() {
  return {
    search: async () => [],
    store:  () => {},
  };
}

/**
 * Creates a no-op wisdom store stub for environments where no real store is provided.
 *
 * @private
 * @returns {Object} Null wisdom store with safe no-op methods
 */
function _nullWisdomStore() {
  return {
    get:    () => null,
    set:    () => {},
    append: () => {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  MistakeAnalysisEngine,
  FailureCatalog,
  RootCauseAnalyzer,
  RecurrenceDetector,
  PreventionRuleGenerator,
  MistakeCostCalculator,
  MistakeReport,

  // Expose constants for integration/testing
  HISTORICAL_LOOKBACK,
  SAME_MISTAKE_THRESHOLD,
  MAX_RECURRENCES_BEFORE_ESCALATION,
  ANALYSIS_TIMEOUT_MS,
  COST_WEIGHT_TIME,
  COST_WEIGHT_MONEY,
  COST_WEIGHT_QUALITY,
  MAX_WHY_DEPTH,
  SEVERITY_LEVELS,
  FISHBONE_CATEGORIES,
};

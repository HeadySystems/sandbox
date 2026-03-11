/**
 * ∞ Heady™ Pattern Engine — Pattern Recognition & Predictive Learning
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

const EventEmitter = require('events');
const fs           = require('fs');
const path         = require('path');

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Pattern categories */
const PATTERN_TYPES = {
  SUCCESS:      'success',
  FAILURE:      'failure',
  DRIFT:        'drift',
  OPTIMIZATION: 'optimization',
};

/** Confidence decay per day (patterns become less relevant over time) */
const CONFIDENCE_DECAY_PER_DAY = 0.02;

/** Minimum similarity score to consider a pattern a match */
const SIMILARITY_THRESHOLD = 0.65;

/** Maximum number of patterns to store per type */
const MAX_PATTERNS_PER_TYPE = 500;

/** Minimum occurrences before a pattern is promoted to "confirmed" */
const MIN_OCCURRENCES_CONFIRMED = 3;

// ─────────────────────────────────────────────
// Feature Extraction
// ─────────────────────────────────────────────

/**
 * Extract a normalized feature vector from a pipeline execution record.
 * Features: task type encoding, stage durations, retry counts, provider IDs.
 *
 * @param {object} executionRecord
 * @returns {number[]} Feature vector (fixed-length 32-dimensional)
 */
function extractFeatures(executionRecord = {}) {
  const features = new Array(32).fill(0);

  // f[0] — task type (one-hot over 9 types, normalized)
  const TASK_TYPE_MAP = {
    code_generation: 0, code_review: 1, architecture: 2, research: 3,
    quick: 4, creative: 5, security: 6, documentation: 7, embeddings: 8,
  };
  const typeIdx = TASK_TYPE_MAP[executionRecord.taskType] ?? -1;
  if (typeIdx >= 0) features[typeIdx] = 1;

  // f[9] — outcome (1 = success, 0 = failure)
  features[9] = executionRecord.outcome === 'success' ? 1 : 0;

  // f[10] — total duration ms (normalized to 0-1 over 60 s)
  features[10] = Math.min(1, (executionRecord.durationMs ?? 0) / 60_000);

  // f[11] — retry count (normalized to 0-1 over 5)
  features[11] = Math.min(1, (executionRecord.retryCount ?? 0) / 5);

  // f[12] — number of stages (normalized to 0-1 over 20)
  features[12] = Math.min(1, (executionRecord.stageCount ?? 0) / 20);

  // f[13] — provider index (primary provider used)
  const PROVIDER_MAP = {
    anthropic: 0, openai: 1, google: 2, groq: 3, perplexity: 4, local: 5,
  };
  const provIdx = PROVIDER_MAP[executionRecord.primaryProvider] ?? -1;
  if (provIdx >= 0) features[13 + provIdx] = 1;

  // f[19] — token count (normalized to 0-1 over 8192)
  features[19] = Math.min(1, (executionRecord.totalTokens ?? 0) / 8192);

  // f[20] — error code (first 4 bits of hash, normalized)
  if (executionRecord.errorCode) {
    const h = [...executionRecord.errorCode].reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xFFFF, 0);
    features[20] = (h & 0xF) / 15;
  }

  // f[21..31] — stage latency profile (up to 11 stage slots, normalized)
  const stageDurations = executionRecord.stageDurations ?? [];
  for (let i = 0; i < Math.min(11, stageDurations.length); i++) {
    features[21 + i] = Math.min(1, stageDurations[i] / 10_000);
  }

  return features;
}

/**
 * Compute cosine similarity between two equal-length vectors.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} Similarity in [0, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vector length mismatch');
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─────────────────────────────────────────────
// Pattern Record
// ─────────────────────────────────────────────

/**
 * @typedef {object} Pattern
 * @property {string}   id             UUID
 * @property {string}   type           One of PATTERN_TYPES
 * @property {number[]} featureVector  32-dimensional feature vector (centroid)
 * @property {number}   occurrences    How many executions matched this pattern
 * @property {number}   confidence     Weighted confidence score [0, 1]
 * @property {boolean}  confirmed      True once occurrences >= MIN_OCCURRENCES_CONFIRMED
 * @property {string}   recommendation Human-readable suggestion
 * @property {object}   metadata       Domain-specific metadata
 * @property {number}   createdAt      Unix timestamp ms
 * @property {number}   updatedAt      Unix timestamp ms
 */

/**
 * Compute time-decayed confidence for a pattern.
 * @param {number} baseConfidence
 * @param {number} updatedAt  Unix ms
 * @returns {number}
 */
function decayedConfidence(baseConfidence, updatedAt) {
  const ageMs   = Date.now() - updatedAt;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return Math.max(0, baseConfidence - ageDays * CONFIDENCE_DECAY_PER_DAY);
}

// ─────────────────────────────────────────────
// Pattern Store
// ─────────────────────────────────────────────

/**
 * In-memory pattern store with optional file persistence.
 */
class PatternStore {
  /**
   * @param {object} [opts]
   * @param {string} [opts.persistPath]  File path for JSON persistence
   */
  constructor(opts = {}) {
    this.persistPath = opts.persistPath ?? null;
    /** @type {Map<string, Pattern>} */
    this.patterns    = new Map();
    if (this.persistPath) this._load();
  }

  /** @param {Pattern} pattern */
  set(pattern) {
    this.patterns.set(pattern.id, pattern);
    this._maybePersist();
  }

  /** @param {string} id @returns {Pattern|undefined} */
  get(id) { return this.patterns.get(id); }

  /** @returns {Pattern[]} */
  all() { return [...this.patterns.values()]; }

  /** @param {string} type @returns {Pattern[]} */
  byType(type) { return this.all().filter(p => p.type === type); }

  /** @param {string} id */
  delete(id) {
    this.patterns.delete(id);
    this._maybePersist();
  }

  /** Trim each type to MAX_PATTERNS_PER_TYPE, dropping lowest-confidence entries. */
  trim() {
    for (const type of Object.values(PATTERN_TYPES)) {
      let typed = this.byType(type);
      if (typed.length <= MAX_PATTERNS_PER_TYPE) continue;
      typed.sort((a, b) => b.confidence - a.confidence);
      for (const p of typed.slice(MAX_PATTERNS_PER_TYPE)) {
        this.patterns.delete(p.id);
      }
    }
  }

  _maybePersist() {
    if (!this.persistPath) return;
    try {
      const data = JSON.stringify([...this.patterns.values()], null, 2);
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      fs.writeFileSync(this.persistPath, data, 'utf8');
    } catch { /* non-fatal */ }
  }

  _load() {
    try {
      const raw  = fs.readFileSync(this.persistPath, 'utf8');
      const list = JSON.parse(raw);
      for (const p of list) this.patterns.set(p.id, p);
    } catch { /* no prior state */ }
  }
}

// ─────────────────────────────────────────────
// Pattern Engine
// ─────────────────────────────────────────────

/**
 * @typedef {object} PatternEngineConfig
 * @property {string}  [persistPath]         File path for pattern persistence
 * @property {number}  [similarityThreshold] Match threshold (default 0.65)
 * @property {number}  [maxPatternsPerType]  Trim limit per type (default 500)
 * @property {boolean} [useVectorMemory]     If true, also logs to vector memory module
 */

/**
 * @typedef {object} ExecutionRecord
 * @property {string}   taskType
 * @property {string}   outcome        'success' | 'failure' | 'partial'
 * @property {number}   durationMs
 * @property {number}   [retryCount]
 * @property {number}   [stageCount]
 * @property {string}   [primaryProvider]
 * @property {number}   [totalTokens]
 * @property {string}   [errorCode]
 * @property {number[]} [stageDurations]
 * @property {string}   [notes]
 * @property {string}   [sessionId]
 */

/**
 * @typedef {object} PatternMatch
 * @property {Pattern} pattern
 * @property {number}  similarity   [0, 1]
 * @property {number}  confidence   Decayed confidence
 * @property {string}  recommendation
 */

/**
 * @typedef {object} PredictionResult
 * @property {string}         taskType
 * @property {PatternMatch[]} matches          Sorted by similarity desc
 * @property {string|null}    primaryRecommendation
 * @property {number}         predictedSuccessRate [0, 1]
 */

/**
 * Pattern recognition engine.
 *
 * Learn from pipeline execution history → match patterns against new tasks
 * → generate actionable recommendations.
 *
 * @extends EventEmitter
 */
class PatternEngine extends EventEmitter {
  /**
   * @param {PatternEngineConfig} [config]
   */
  constructor(config = {}) {
    super();
    this.config              = config;
    this.similarityThreshold = config.similarityThreshold ?? SIMILARITY_THRESHOLD;
    this.store               = new PatternStore({ persistPath: config.persistPath });
    this._vectorMemory       = null; // injected via setVectorMemory()
  }

  /**
   * Inject a vector memory instance for semantic pattern storage.
   * @param {object} vectorMemory  Must implement store(id, vector, metadata) and search(vector, k)
   */
  setVectorMemory(vectorMemory) {
    this._vectorMemory = vectorMemory;
  }

  // ── Learning ──

  /**
   * Record a completed pipeline execution and update/create patterns.
   * @param {ExecutionRecord} record
   * @returns {Promise<{patternId: string, type: string, action: 'created'|'updated'}>}
   */
  async learn(record) {
    const features = extractFeatures(record);
    const type     = this._classifyType(record);

    // Find existing patterns of the same type that are highly similar
    const candidates = this.store.byType(type);
    let bestMatch = null;
    let bestSim   = 0;

    for (const p of candidates) {
      const sim = cosineSimilarity(features, p.featureVector);
      if (sim > bestSim) { bestSim = sim; bestMatch = p; }
    }

    let action;
    let patternId;

    if (bestMatch && bestSim >= this.similarityThreshold) {
      // Update existing pattern: blend feature vector (EMA), increment occurrences
      const alpha = 0.2; // learning rate
      const blended = bestMatch.featureVector.map(
        (v, i) => v * (1 - alpha) + features[i] * alpha
      );
      const newConfidence = Math.min(
        1,
        bestMatch.confidence + 0.05 + (record.outcome === 'success' ? 0.02 : -0.03)
      );
      const updated = {
        ...bestMatch,
        featureVector: blended,
        occurrences:   bestMatch.occurrences + 1,
        confidence:    newConfidence,
        confirmed:     bestMatch.occurrences + 1 >= MIN_OCCURRENCES_CONFIRMED,
        recommendation: this._buildRecommendation(type, record, bestMatch.occurrences + 1),
        updatedAt:     Date.now(),
      };
      this.store.set(updated);
      patternId = updated.id;
      action    = 'updated';
      this.emit('pattern_updated', updated);
    } else {
      // Create new pattern
      const newPattern = {
        id:            this._uuid(),
        type,
        featureVector: features,
        occurrences:   1,
        confidence:    0.4,
        confirmed:     false,
        recommendation: this._buildRecommendation(type, record, 1),
        metadata:      {
          taskType:        record.taskType,
          primaryProvider: record.primaryProvider,
          errorCode:       record.errorCode,
          notes:           record.notes,
        },
        createdAt:  Date.now(),
        updatedAt:  Date.now(),
      };
      this.store.set(newPattern);
      patternId = newPattern.id;
      action    = 'created';
      this.emit('pattern_created', newPattern);
    }

    // Store in vector memory if available
    if (this._vectorMemory && this.config.useVectorMemory) {
      await this._vectorMemory.store(patternId, features, { type, ...record }).catch(() => {});
    }

    // Trim store periodically
    this.store.trim();

    return { patternId, type, action };
  }

  // ── Matching & Prediction ──

  /**
   * Match a new task against known patterns to predict outcomes.
   * @param {ExecutionRecord} task  Partial record (may lack outcome/duration)
   * @returns {Promise<PredictionResult>}
   */
  async predict(task) {
    const features   = extractFeatures(task);
    const allPatterns = this.store.all().filter(p => p.confirmed);
    const matches    = [];

    for (const p of allPatterns) {
      const sim = cosineSimilarity(features, p.featureVector);
      if (sim < this.similarityThreshold) continue;
      const confidence = decayedConfidence(p.confidence, p.updatedAt);
      matches.push({
        pattern:        p,
        similarity:     sim,
        confidence,
        recommendation: p.recommendation,
      });
    }

    // Sort by similarity descending
    matches.sort((a, b) => b.similarity - a.similarity);

    // Compute predicted success rate from success vs failure patterns in top-5
    const top5       = matches.slice(0, 5);
    const successes  = top5.filter(m => m.pattern.type === PATTERN_TYPES.SUCCESS).length;
    const failures   = top5.filter(m => m.pattern.type === PATTERN_TYPES.FAILURE).length;
    const total      = successes + failures;
    const successRate = total > 0 ? successes / total : 0.5;

    const primaryRecommendation = matches[0]?.recommendation ?? null;

    this.emit('prediction', { task, matchCount: matches.length, successRate });

    return {
      taskType:             task.taskType,
      matches:              matches.slice(0, 10), // top 10
      primaryRecommendation,
      predictedSuccessRate: successRate,
    };
  }

  /**
   * Semantic search through patterns using vector memory.
   * Falls back to cosine-similarity in-memory search if no vector memory.
   *
   * @param {string} query  Free-text query
   * @param {number} [k=5]  Top-k results
   * @returns {Promise<Pattern[]>}
   */
  async search(query, k = 5) {
    if (this._vectorMemory) {
      // Use vector memory semantic search
      try {
        const results = await this._vectorMemory.search(query, k);
        return results.map(r => this.store.get(r.id)).filter(Boolean);
      } catch { /* fall through */ }
    }

    // Fallback: keyword match on recommendation text
    const lower = query.toLowerCase();
    return this.store.all()
      .filter(p => p.recommendation.toLowerCase().includes(lower))
      .slice(0, k);
  }

  // ── Introspection ──

  /**
   * Get pattern summary statistics.
   * @returns {object}
   */
  stats() {
    const all = this.store.all();
    const byType = {};
    for (const type of Object.values(PATTERN_TYPES)) {
      const typed = all.filter(p => p.type === type);
      byType[type] = {
        total:     typed.length,
        confirmed: typed.filter(p => p.confirmed).length,
        avgConfidence: typed.length > 0
          ? typed.reduce((s, p) => s + p.confidence, 0) / typed.length
          : 0,
      };
    }
    return {
      totalPatterns: all.length,
      byType,
    };
  }

  /**
   * Get top-N recommendations based on confirmed patterns.
   * @param {string} [taskType]  Filter by task type (optional)
   * @param {number} [limit=5]
   * @returns {Array<{recommendation: string, confidence: number, occurrences: number}>}
   */
  topRecommendations(taskType, limit = 5) {
    let patterns = this.store.all().filter(p => p.confirmed);
    if (taskType) patterns = patterns.filter(p => p.metadata?.taskType === taskType);
    patterns.sort((a, b) => b.confidence - a.confidence);
    return patterns.slice(0, limit).map(p => ({
      recommendation: p.recommendation,
      confidence:     decayedConfidence(p.confidence, p.updatedAt),
      occurrences:    p.occurrences,
      type:           p.type,
    }));
  }

  // ── Helpers ──

  /**
   * Classify execution record into a pattern type.
   * @param {ExecutionRecord} record
   * @returns {string} One of PATTERN_TYPES
   */
  _classifyType(record) {
    if (record.outcome === 'failure' || record.errorCode) return PATTERN_TYPES.FAILURE;
    if (record.outcome === 'success' && record.retryCount === 0) return PATTERN_TYPES.SUCCESS;
    if (record.outcome === 'success' && record.retryCount > 0)   return PATTERN_TYPES.OPTIMIZATION;
    return PATTERN_TYPES.DRIFT;
  }

  /**
   * Build a human-readable recommendation string.
   * @param {string} type
   * @param {ExecutionRecord} record
   * @param {number} occurrences
   * @returns {string}
   */
  _buildRecommendation(type, record, occurrences) {
    const task = record.taskType ?? 'unknown task';
    const prov = record.primaryProvider ?? 'unknown provider';

    switch (type) {
      case PATTERN_TYPES.SUCCESS:
        return `Based on ${occurrences} similar ${task} tasks, routing to ${prov} consistently succeeds. ` +
               `Expected duration: ~${Math.round((record.durationMs ?? 0) / 1000)}s.`;
      case PATTERN_TYPES.FAILURE:
        return `Based on ${occurrences} similar ${task} tasks, failures often occur with ${prov}` +
               (record.errorCode ? ` (error: ${record.errorCode})` : '') +
               `. Consider switching to a fallback provider.`;
      case PATTERN_TYPES.OPTIMIZATION:
        return `Based on ${occurrences} similar ${task} tasks, ${record.retryCount} retries were needed. ` +
               `Pre-emptive fallover may reduce latency.`;
      case PATTERN_TYPES.DRIFT:
        return `Drift detected in ${task} tasks over ${occurrences} occurrences. ` +
               `Unusual stage duration or provider behavior observed.`;
      default:
        return `Pattern observed ${occurrences} times for ${task}.`;
    }
  }

  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export {

  PatternEngine,
  PatternStore,
  PATTERN_TYPES,
  extractFeatures,
  cosineSimilarity,
  decayedConfidence,
  SIMILARITY_THRESHOLD,
};

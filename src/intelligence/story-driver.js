/**
 * ∞ Heady™ Story Driver — HeadyAutobiographer Narrative Engine
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 */

'use strict';

const EventEmitter = require('events');
const fs           = require('fs');
const path         = require('path');

// ─────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────

/**
 * All supported system event types recorded as narrative entries.
 */
const EVENT_TYPES = {
  TASK_COMPLETED:       'task_completed',
  TASK_FAILED:          'task_failed',
  HEALING_TRIGGERED:    'healing_triggered',
  HEALING_RESOLVED:     'healing_resolved',
  DRIFT_DETECTED:       'drift_detected',
  DRIFT_RESOLVED:       'drift_resolved',
  PIPELINE_RUN:         'pipeline_run',
  PIPELINE_FAILED:      'pipeline_failed',
  DEPLOYMENT:           'deployment',
  DEPLOYMENT_FAILED:    'deployment_failed',
  ROLLBACK:             'rollback',
  BEE_SPAWNED:          'bee_spawned',
  BEE_TERMINATED:       'bee_terminated',
  PROVIDER_SWITCHED:    'provider_switched',
  BUDGET_WARN:          'budget_warn',
  CIRCUIT_OPENED:       'circuit_opened',
  CIRCUIT_CLOSED:       'circuit_closed',
  PATTERN_LEARNED:      'pattern_learned',
  CONFIG_CHANGED:       'config_changed',
  SYSTEM_STARTED:       'system_started',
  SYSTEM_STOPPED:       'system_stopped',
  HEALTH_CHECK:         'health_check',
  MCP_TOOL_CALLED:      'mcp_tool_called',
  VECTOR_STORED:        'vector_stored',
  CUSTOM:               'custom',
};

// ─────────────────────────────────────────────
// Narrative Templates
// ─────────────────────────────────────────────

/**
 * Map of event type → narrative template function.
 * Each function receives the event data and returns a human-readable sentence.
 *
 * @type {Record<string, (data: object) => string>}
 */
const NARRATIVE_TEMPLATES = {
  [EVENT_TYPES.TASK_COMPLETED]: (d) =>
    `Task "${d.taskName ?? 'unnamed'}" completed successfully in ${_fmtDuration(d.durationMs)} via ${d.provider ?? 'unknown provider'}.`,

  [EVENT_TYPES.TASK_FAILED]: (d) =>
    `Task "${d.taskName ?? 'unnamed'}" failed after ${d.attempts ?? 1} attempt(s): ${d.errorMessage ?? 'unknown error'}.`,

  [EVENT_TYPES.HEALING_TRIGGERED]: (d) =>
    `Self-healing initiated for service "${d.service ?? 'unknown'}" — reason: ${d.reason ?? 'anomaly detected'}.`,

  [EVENT_TYPES.HEALING_RESOLVED]: (d) =>
    `Service "${d.service ?? 'unknown'}" restored after ${_fmtDuration(d.durationMs)}. ${d.action ?? 'Automatic recovery'} succeeded.`,

  [EVENT_TYPES.DRIFT_DETECTED]: (d) =>
    `Metric drift detected in "${d.metric ?? 'unknown metric'}" — observed ${d.observedValue}, expected ${d.expectedValue} (threshold: ${d.threshold ?? 'N/A'}).`,

  [EVENT_TYPES.DRIFT_RESOLVED]: (d) =>
    `Drift in "${d.metric ?? 'unknown metric'}" resolved. Values normalized back within acceptable range.`,

  [EVENT_TYPES.PIPELINE_RUN]: (d) =>
    `Pipeline "${d.pipelineName ?? 'unnamed'}" ran ${d.stages ?? 0} stages in ${_fmtDuration(d.durationMs)}. ` +
    `Result: ${d.outcome ?? 'completed'}.`,

  [EVENT_TYPES.PIPELINE_FAILED]: (d) =>
    `Pipeline "${d.pipelineName ?? 'unnamed'}" failed at stage "${d.failedStage ?? 'unknown'}": ${d.errorMessage ?? 'unknown error'}.`,

  [EVENT_TYPES.DEPLOYMENT]: (d) =>
    `Service "${d.service ?? 'unknown'}" deployed version ${d.version ?? 'unknown'} to ${d.target ?? 'production'}.`,

  [EVENT_TYPES.DEPLOYMENT_FAILED]: (d) =>
    `Deployment of "${d.service ?? 'unknown'}" v${d.version ?? '?'} to ${d.target ?? 'unknown'} failed: ${d.errorMessage ?? 'unknown error'}.`,

  [EVENT_TYPES.ROLLBACK]: (d) =>
    `Rollback of "${d.service ?? 'unknown'}" from v${d.fromVersion ?? '?'} to v${d.toVersion ?? '?'} completed in ${_fmtDuration(d.durationMs)}.`,

  [EVENT_TYPES.BEE_SPAWNED]: (d) =>
    `Bee "${d.beeId ?? 'unknown'}" (domain: ${d.domain ?? 'general'}) spawned for task "${d.taskName ?? 'unnamed'}".`,

  [EVENT_TYPES.BEE_TERMINATED]: (d) =>
    `Bee "${d.beeId ?? 'unknown'}" terminated after ${_fmtDuration(d.lifetimeMs)} — reason: ${d.reason ?? 'task completed'}.`,

  [EVENT_TYPES.PROVIDER_SWITCHED]: (d) =>
    `LLM provider switched from ${d.fromProvider ?? 'unknown'} to ${d.toProvider ?? 'unknown'} for task "${d.taskType ?? 'unknown'}" — reason: ${d.reason ?? 'failover'}.`,

  [EVENT_TYPES.BUDGET_WARN]: (d) =>
    `Budget warning: ${d.provider ?? 'unknown'} is at ${Math.round((d.usage / d.cap) * 100)}% of its daily cap ($${(d.usage ?? 0).toFixed(2)}/$${(d.cap ?? 0).toFixed(2)}).`,

  [EVENT_TYPES.CIRCUIT_OPENED]: (d) =>
    `Circuit breaker OPENED for provider "${d.provider ?? 'unknown'}" after ${d.failures ?? 0} consecutive failures.`,

  [EVENT_TYPES.CIRCUIT_CLOSED]: (d) =>
    `Circuit breaker CLOSED for provider "${d.provider ?? 'unknown'}" — service recovered after ${_fmtDuration(d.durationMs)}.`,

  [EVENT_TYPES.PATTERN_LEARNED]: (d) =>
    `New ${d.patternType ?? 'behavioral'} pattern recorded for "${d.taskType ?? 'unknown'}" (${d.occurrences ?? 1} occurrences, confidence: ${((d.confidence ?? 0) * 100).toFixed(0)}%).`,

  [EVENT_TYPES.CONFIG_CHANGED]: (d) =>
    `Configuration change detected in "${d.file ?? 'unknown file'}": ${d.changedKeys?.join(', ') ?? 'multiple keys'} updated.`,

  [EVENT_TYPES.SYSTEM_STARTED]: (d) =>
    `HeadySystems™ Sovereign AI Platform v${d.version ?? '4.0.0'} started. Modules loaded: ${(d.modules ?? []).join(', ') || 'none'}.`,

  [EVENT_TYPES.SYSTEM_STOPPED]: (d) =>
    `Platform gracefully shut down after ${_fmtDuration(d.uptimeMs)}. Total requests served: ${d.totalRequests ?? 0}.`,

  [EVENT_TYPES.HEALTH_CHECK]: (d) =>
    `System health check: ${d.healthy ?? 0} healthy, ${d.degraded ?? 0} degraded, ${d.unhealthy ?? 0} unhealthy components.`,

  [EVENT_TYPES.MCP_TOOL_CALLED]: (d) =>
    `MCP tool "${d.toolName ?? 'unknown'}" called by session "${d.sessionId ?? 'anonymous'}" — ${d.outcome ?? 'completed'} in ${_fmtDuration(d.durationMs)}.`,

  [EVENT_TYPES.VECTOR_STORED]: (d) =>
    `${d.count ?? 1} vector embedding(s) stored in ${d.namespace ?? 'default'} namespace.`,

  [EVENT_TYPES.CUSTOM]: (d) =>
    d.message ?? `Custom event recorded: ${JSON.stringify(d)}`,
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function _fmtDuration(ms) {
  if (ms == null || isNaN(ms)) return 'unknown duration';
  if (ms < 1000)               return `${Math.round(ms)}ms`;
  if (ms < 60_000)             return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000)          return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

// ─────────────────────────────────────────────
// Narrative Entry
// ─────────────────────────────────────────────

/**
 * @typedef {object} NarrativeEntry
 * @property {string}  id          UUID
 * @property {string}  eventType   One of EVENT_TYPES
 * @property {string}  narrative   Human-readable story sentence
 * @property {object}  data        Raw technical event data
 * @property {string}  [sessionId]
 * @property {string}  [service]   Source service
 * @property {string}  [severity]  'info' | 'warn' | 'error' | 'critical'
 * @property {number}  timestamp   Unix ms
 * @property {string}  iso         ISO 8601 timestamp
 */

// ─────────────────────────────────────────────
// Story Store
// ─────────────────────────────────────────────

/**
 * Ring-buffer story store with optional file persistence.
 */
class StoryStore {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxEntries=10000]
   * @param {string} [opts.persistPath]   JSONL file for append-only persistence
   */
  constructor(opts = {}) {
    this.maxEntries  = opts.maxEntries  ?? 10_000;
    this.persistPath = opts.persistPath ?? null;

    /** @type {NarrativeEntry[]} */
    this._entries = [];

    if (this.persistPath) this._loadFromDisk();
  }

  /**
   * Append an entry to the store.
   * @param {NarrativeEntry} entry
   */
  push(entry) {
    this._entries.push(entry);
    if (this._entries.length > this.maxEntries) {
      this._entries.shift(); // ring-buffer eviction
    }
    if (this.persistPath) this._appendToDisk(entry);
  }

  /**
   * Return entries in chronological order, with optional filters.
   * @param {object} [filter]
   * @param {string}   [filter.eventType]
   * @param {string}   [filter.sessionId]
   * @param {string}   [filter.service]
   * @param {string}   [filter.severity]
   * @param {number}   [filter.since]   Unix ms
   * @param {number}   [filter.until]   Unix ms
   * @param {number}   [filter.limit]   Max entries returned
   * @returns {NarrativeEntry[]}
   */
  query(filter = {}) {
    let results = this._entries.slice();
    if (filter.eventType) results = results.filter(e => e.eventType === filter.eventType);
    if (filter.sessionId) results = results.filter(e => e.sessionId === filter.sessionId);
    if (filter.service)   results = results.filter(e => e.service   === filter.service);
    if (filter.severity)  results = results.filter(e => e.severity  === filter.severity);
    if (filter.since)     results = results.filter(e => e.timestamp >= filter.since);
    if (filter.until)     results = results.filter(e => e.timestamp <= filter.until);
    if (filter.limit)     results = results.slice(-filter.limit);
    return results;
  }

  /** @returns {number} */
  get size() { return this._entries.length; }

  _appendToDisk(entry) {
    try {
      fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
      fs.appendFileSync(this.persistPath, JSON.stringify(entry) + '\n', 'utf8');
    } catch { /* non-fatal */ }
  }

  _loadFromDisk() {
    try {
      const raw   = fs.readFileSync(this.persistPath, 'utf8');
      const lines = raw.trim().split('\n').filter(Boolean);
      // Load last maxEntries lines
      const start = Math.max(0, lines.length - this.maxEntries);
      for (const line of lines.slice(start)) {
        try { this._entries.push(JSON.parse(line)); } catch { /* skip corrupt */ }
      }
    } catch { /* no prior state */ }
  }
}

// ─────────────────────────────────────────────
// Story Driver
// ─────────────────────────────────────────────

/**
 * @typedef {object} StoryDriverConfig
 * @property {string}  [persistPath]      JSONL persistence file path
 * @property {number}  [maxEntries]       Max in-memory entries
 * @property {boolean} [useVectorMemory]  Enable semantic search via vector memory
 */

/**
 * HeadyAutobiographer — records all system events as narrative entries,
 * generates human-readable stories, and provides timeline + semantic search.
 *
 * All modules in the Heady™ platform emit events which the StoryDriver
 * subscribes to, converts into narrative form, and stores chronologically.
 *
 * @extends EventEmitter
 *
 * @example
 * const driver = new StoryDriver({ persistPath: './data/story.jsonl' });
 * driver.record(EVENT_TYPES.DEPLOYMENT, { service: 'api', version: '4.0.0', target: 'prod' });
 * const timeline = driver.timeline({ limit: 10 });
 */
class StoryDriver extends EventEmitter {
  /**
   * @param {StoryDriverConfig} [config]
   */
  constructor(config = {}) {
    super();
    this.config        = config;
    this.store         = new StoryStore({
      persistPath: config.persistPath,
      maxEntries:  config.maxEntries,
    });
    this._vectorMemory = null;
  }

  /**
   * Inject a vector memory instance for semantic search.
   * @param {object} vectorMemory  Must implement store(id, vector, metadata) and searchText(query, k)
   */
  setVectorMemory(vectorMemory) {
    this._vectorMemory = vectorMemory;
  }

  // ── Recording ──

  /**
   * Record a system event as a narrative entry.
   *
   * @param {string}  eventType  One of EVENT_TYPES
   * @param {object}  [data]     Raw event data
   * @param {object}  [meta]     Entry metadata
   * @param {string}  [meta.sessionId]
   * @param {string}  [meta.service]
   * @param {string}  [meta.severity]  'info' | 'warn' | 'error' | 'critical'
   * @returns {NarrativeEntry}
   */
  record(eventType, data = {}, meta = {}) {
    const template  = NARRATIVE_TEMPLATES[eventType] ?? NARRATIVE_TEMPLATES[EVENT_TYPES.CUSTOM];
    const narrative = template({ ...data, ...meta });

    const entry = {
      id:        this._uuid(),
      eventType,
      narrative,
      data:      { ...data },
      sessionId: meta.sessionId ?? null,
      service:   meta.service   ?? data.service ?? null,
      severity:  meta.severity  ?? this._defaultSeverity(eventType),
      timestamp: Date.now(),
      iso:       new Date().toISOString(),
    };

    this.store.push(entry);
    this.emit('entry', entry);
    this.emit(eventType, entry);

    // Store in vector memory for semantic search
    if (this._vectorMemory && this.config.useVectorMemory) {
      this._vectorMemory.storeText?.(entry.id, entry.narrative, {
        eventType,
        service:   entry.service,
        severity:  entry.severity,
        timestamp: entry.timestamp,
      }).catch(() => {});
    }

    return entry;
  }

  /**
   * Subscribe to one or more external EventEmitters and auto-record their events.
   *
   * @param {EventEmitter} emitter
   * @param {Array<{event: string, eventType: string, transform?: (data: any) => object}>} bindings
   */
  subscribe(emitter, bindings) {
    for (const binding of bindings) {
      emitter.on(binding.event, (data) => {
        const transformed = binding.transform ? binding.transform(data) : data;
        this.record(
          binding.eventType,
          transformed,
          { service: binding.service ?? null, severity: binding.severity ?? null }
        );
      });
    }
  }

  // ── Timeline ──

  /**
   * Get the chronological event timeline.
   * @param {object} [filter]  Same options as StoryStore.query()
   * @returns {NarrativeEntry[]}
   */
  timeline(filter = {}) {
    return this.store.query(filter);
  }

  /**
   * Get a formatted narrative digest for a time window.
   * @param {object} [opts]
   * @param {number} [opts.since]   Unix ms
   * @param {number} [opts.limit]   Max entries
   * @param {string} [opts.service] Filter by service
   * @returns {string}  Multi-line narrative text
   */
  digest(opts = {}) {
    const entries = this.store.query({
      since:   opts.since,
      limit:   opts.limit ?? 20,
      service: opts.service,
    });

    if (entries.length === 0) return 'No events recorded in this period.';

    const lines = entries.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString('en-US', { hour12: false });
      const sev  = e.severity !== 'info' ? ` [${e.severity?.toUpperCase()}]` : '';
      return `${time}${sev} — ${e.narrative}`;
    });

    return lines.join('\n');
  }

  /**
   * Produce a chapter-style narrative summary for a session.
   * @param {string} sessionId
   * @returns {string}
   */
  sessionNarrative(sessionId) {
    const entries = this.store.query({ sessionId });
    if (entries.length === 0) return `Session "${sessionId}": no events recorded.`;

    const start = new Date(entries[0].timestamp).toISOString();
    const end   = new Date(entries[entries.length - 1].timestamp).toISOString();
    const duration = entries[entries.length - 1].timestamp - entries[0].timestamp;

    const intro = `Session "${sessionId}" ran from ${start} to ${end} ` +
                  `(${_fmtDuration(duration)}), comprising ${entries.length} events:\n`;

    const body = entries.map((e, i) => `  ${i + 1}. ${e.narrative}`).join('\n');
    return intro + body;
  }

  // ── Search ──

  /**
   * Semantic search through the story using vector memory if available.
   * Falls back to keyword substring search.
   *
   * @param {string} query
   * @param {number} [k=10]
   * @returns {Promise<NarrativeEntry[]>}
   */
  async search(query, k = 10) {
    if (this._vectorMemory?.searchText) {
      try {
        const results = await this._vectorMemory.searchText(query, k);
        return results.map(r => this._findById(r.id)).filter(Boolean);
      } catch { /* fall through */ }
    }

    // Fallback: keyword search
    const lower = query.toLowerCase();
    const all   = this.store.query();
    const hits  = all.filter(e =>
      e.narrative.toLowerCase().includes(lower) ||
      e.eventType.toLowerCase().includes(lower) ||
      (e.service ?? '').toLowerCase().includes(lower)
    );
    return hits.slice(-k);
  }

  /**
   * Find a single entry by its ID.
   * @param {string} id
   * @returns {NarrativeEntry|undefined}
   */
  _findById(id) {
    return this.store.query().find(e => e.id === id);
  }

  // ── Statistics ──

  /**
   * Summary statistics for the story.
   * @returns {object}
   */
  stats() {
    const all = this.store.query();
    const byType = {};
    for (const entry of all) {
      byType[entry.eventType] = (byType[entry.eventType] ?? 0) + 1;
    }
    const bySeverity = { info: 0, warn: 0, error: 0, critical: 0 };
    for (const entry of all) {
      const sev = entry.severity ?? 'info';
      bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
    }
    return {
      totalEntries: all.length,
      byType,
      bySeverity,
      oldestEntry: all[0]?.iso ?? null,
      newestEntry: all[all.length - 1]?.iso ?? null,
    };
  }

  // ── Helpers ──

  _defaultSeverity(eventType) {
    const errorTypes = [
      EVENT_TYPES.TASK_FAILED,
      EVENT_TYPES.PIPELINE_FAILED,
      EVENT_TYPES.DEPLOYMENT_FAILED,
    ];
    const warnTypes = [
      EVENT_TYPES.HEALING_TRIGGERED,
      EVENT_TYPES.DRIFT_DETECTED,
      EVENT_TYPES.BUDGET_WARN,
      EVENT_TYPES.CIRCUIT_OPENED,
    ];
    const criticalTypes = [
      EVENT_TYPES.ROLLBACK,
    ];
    if (criticalTypes.includes(eventType)) return 'critical';
    if (errorTypes.includes(eventType))    return 'error';
    if (warnTypes.includes(eventType))     return 'warn';
    return 'info';
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

  StoryDriver,
  StoryStore,
  EVENT_TYPES,
  NARRATIVE_TEMPLATES,
};

/**
 * © 2026 Heady™Systems Inc. PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
// RTP: Edge Durable Agents - Cloudflare Workers Integration

'use strict';

const crypto = require('crypto');

const PHI = 1.6180339887;

// ─── CSL Gate Evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate a Consciousness Synchronization Layer (CSL) gate condition.
 * A gate is a predicate evaluated against current agent state.
 */
function evaluateCslGate(gate, state) {
  if (!gate) return true;
  const { field, op, value } = gate;
  const actual = state[field];
  switch (op) {
    case 'eq':  return actual === value;
    case 'neq': return actual !== value;
    case 'gt':  return actual >   value;
    case 'gte': return actual >=  value;
    case 'lt':  return actual <   value;
    case 'lte': return actual <=  value;
    case 'in':  return Array.isArray(value) && value.includes(actual);
    case 'exists': return actual !== undefined && actual !== null;
    default:    return false;
  }
}

// ─── StateManager ─────────────────────────────────────────────────────────────

class StateManager {
  /**
   * KV-backed state persistence with versioning and migration support.
   * In Cloudflare Workers: backed by Durable Object storage.
   * In Node.js: backed by in-memory Map.
   */
  constructor(opts = {}) {
    this._storage  = opts.storage  || new Map();
    this._prefix   = opts.prefix   || 'agent:';
    this._version  = opts.version  || 1;
    this._listeners = [];
    this._dirty     = new Set();
    this._snapshots = [];
    this._maxSnaps  = opts.maxSnapshots || 10;
  }

  async get(key) {
    const fullKey = this._prefix + key;
    if (this._storage instanceof Map) {
      return this._storage.get(fullKey) ?? null;
    }
    // Cloudflare KV / Durable Object storage
    return this._storage.get(fullKey);
  }

  async set(key, value) {
    const fullKey = this._prefix + key;
    if (this._storage instanceof Map) {
      this._storage.set(fullKey, value);
    } else {
      await this._storage.put(fullKey, JSON.stringify(value));
    }
    this._dirty.add(key);
    this._notifyListeners(key, value);
    return this;
  }

  async delete(key) {
    const fullKey = this._prefix + key;
    if (this._storage instanceof Map) {
      this._storage.delete(fullKey);
    } else {
      await this._storage.delete(fullKey);
    }
    this._dirty.delete(key);
    return this;
  }

  async getAll(keys) {
    const result = {};
    for (const k of keys) result[k] = await this.get(k);
    return result;
  }

  async setAll(entries) {
    for (const [k, v] of Object.entries(entries)) {
      await this.set(k, v);
    }
    return this;
  }

  /**
   * Take a named snapshot of current state.
   */
  async snapshot(label) {
    const snap = {
      label,
      ts:      Date.now(),
      version: this._version,
      data:    {},
    };
    if (this._storage instanceof Map) {
      for (const [k, v] of this._storage.entries()) {
        if (k.startsWith(this._prefix)) {
          snap.data[k.slice(this._prefix.length)] = v;
        }
      }
    }
    this._snapshots.push(snap);
    if (this._snapshots.length > this._maxSnaps) this._snapshots.shift();
    return snap;
  }

  /**
   * Restore from a snapshot.
   */
  async restore(label) {
    const snap = this._snapshots.find(s => s.label === label);
    if (!snap) throw new Error(`Snapshot '${label}' not found`);
    for (const [k, v] of Object.entries(snap.data)) {
      await this.set(k, v);
    }
    return snap;
  }

  /**
   * Migrate state from one edge location to a new StateManager.
   */
  async migrateToEdge(targetStateManager) {
    if (!(this._storage instanceof Map)) {
      throw new Error('Migration requires in-memory storage source');
    }
    for (const [k, v] of this._storage.entries()) {
      if (k.startsWith(this._prefix)) {
        const key = k.slice(this._prefix.length);
        await targetStateManager.set(key, v);
      }
    }
    return { migrated: this._storage.size };
  }

  onChange(fn) { this._listeners.push(fn); return this; }

  _notifyListeners(key, value) {
    for (const fn of this._listeners) fn(key, value);
  }

  getDirtyKeys() { return Array.from(this._dirty); }
  clearDirty()   { this._dirty.clear(); return this; }
  getSnapshots()  { return this._snapshots.slice(); }
}

// ─── EdgeHealthProbe ──────────────────────────────────────────────────────────

class EdgeHealthProbe {
  /**
   * Phi-based heartbeat from edge. Emits health pings at golden-ratio intervals.
   */
  constructor(opts = {}) {
    this._agentId   = opts.agentId   || crypto.randomUUID();
    this._baseMs    = opts.baseMs    || 5000;
    this._maxMs     = opts.maxMs     || 60000;
    this._endpoint  = opts.endpoint  || null;
    this._timer     = null;
    this._beatCount = 0;
    this._lastBeat  = null;
    this._healthy   = true;
    this._callbacks = [];
    this._consecutiveFails = 0;
    this._maxFails  = opts.maxFails || 3;
  }

  /**
   * Compute next heartbeat interval using φ damping.
   * Starts at baseMs, oscillates around it via φ^n mod cycle.
   */
  _nextInterval() {
    // φ-pulsed interval: base * (1 + 0.1 * sin(beat * 2π / PHI))
    const phase = (this._beatCount % Math.round(PHI * 10)) / (PHI * 10);
    const jitter = 1 + 0.1 * Math.sin(phase * 2 * Math.PI);
    return Math.min(this._maxMs, Math.round(this._baseMs * jitter));
  }

  start() {
    this._schedule();
    return this;
  }

  stop() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    return this;
  }

  _schedule() {
    const interval = this._nextInterval();
    this._timer = setTimeout(() => this._beat(), interval);
  }

  async _beat() {
    this._beatCount++;
    this._lastBeat = Date.now();
    const beat = {
      agentId:   this._agentId,
      beat:      this._beatCount,
      ts:        this._lastBeat,
      healthy:   this._healthy,
      interval:  this._nextInterval(),
    };

    let ok = true;
    try {
      if (this._endpoint) await this._sendBeat(beat);
    } catch (err) {
      this._consecutiveFails++;
      if (this._consecutiveFails >= this._maxFails) this._healthy = false;
      ok = false;
    }

    if (ok) {
      this._consecutiveFails = 0;
      this._healthy = true;
    }

    for (const fn of this._callbacks) fn(beat, ok);
    this._schedule();
  }

  async _sendBeat(beat) {
    const url     = new URL(this._endpoint);
    const isHttps = url.protocol === 'https:';
    const mod     = isHttps ? require('https') : require('http');
    const body    = JSON.stringify(beat);

    return new Promise((resolve, reject) => {
      const req = mod.request({
        hostname: url.hostname,
        port:     url.port || (isHttps ? 443 : 80),
        path:     url.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      }, res => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('Heartbeat timeout')); });
      req.write(body);
      req.end();
    });
  }

  onBeat(fn)  { this._callbacks.push(fn); return this; }
  isHealthy() { return this._healthy; }
  getStats()  {
    return {
      agentId: this._agentId,
      beatCount: this._beatCount,
      lastBeat: this._lastBeat,
      healthy: this._healthy,
      consecutiveFails: this._consecutiveFails,
    };
  }
}

// ─── DurableAgent ─────────────────────────────────────────────────────────────

class DurableAgent {
  /**
   * Durable Agent following the Cloudflare Durable Object pattern.
   * Can be used directly in Node.js or as a Durable Object in CF Workers.
   */
  constructor(state, env = {}) {
    this._state    = state;  // Durable Object storage or StateManager
    this._env      = env;
    this._agentId  = state.id ? state.id.toString() : crypto.randomUUID();
    this._sm       = new StateManager({ storage: state.storage || new Map() });
    this._probe    = new EdgeHealthProbe({ agentId: this._agentId });
    this._handlers = {};
    this._initialized = false;
    this._cslGates = env.cslGates || [];
  }

  /**
   * Cloudflare Workers fetch handler entry point.
   */
  async fetch(request) {
    if (!this._initialized) await this._initialize();

    const url    = new URL(request.url);
    const method = request.method;
    const path   = url.pathname;

    // CSL gate evaluation
    const agentState = await this._getCurrentState();
    for (const gate of this._cslGates) {
      if (!evaluateCslGate(gate, agentState)) {
        return new Response(JSON.stringify({ error: 'CSL gate blocked', gate }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    try {
      if (method === 'GET'  && path === '/health')  return this._handleHealth();
      if (method === 'GET'  && path === '/state')   return this._handleGetState(url);
      if (method === 'POST' && path === '/action')  return this._handleAction(request);
      if (method === 'POST' && path === '/migrate') return this._handleMigrate(request);
      if (method === 'GET'  && path === '/snapshot')return this._handleSnapshot(url);

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  async _initialize() {
    this._initialized = true;
    await this._sm.set('agentId',    this._agentId);
    await this._sm.set('startedAt',  Date.now());
    await this._sm.set('status',     'active');
    await this._sm.set('beatCount',  0);
    this._probe.onBeat(async (beat) => {
      await this._sm.set('beatCount', beat.beat);
      await this._sm.set('lastBeat',  beat.ts);
    });
    this._probe.start();
  }

  async _getCurrentState() {
    const keys = ['agentId', 'status', 'beatCount', 'startedAt', 'lastBeat'];
    return this._sm.getAll(keys);
  }

  _handleHealth() {
    const stats = this._probe.getStats();
    return new Response(JSON.stringify({ ok: stats.healthy, ...stats }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async _handleGetState(url) {
    const key = url.searchParams.get('key');
    if (key) {
      const value = await this._sm.get(key);
      return new Response(JSON.stringify({ key, value }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const state = await this._getCurrentState();
    return new Response(JSON.stringify(state), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async _handleAction(request) {
    const body = await request.json();
    const { action, payload } = body;
    const handler = this._handlers[action];
    if (!handler) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    const result = await handler.call(this, payload);
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async _handleMigrate(request) {
    const body = await request.json();
    const targetSm = new StateManager({ prefix: this._sm._prefix });
    const result   = await this._sm.migrateToEdge(targetSm);
    await this._sm.set('migratedAt', Date.now());
    await this._sm.set('migratedTo', body.targetEdge || 'unknown');
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async _handleSnapshot(url) {
    const label = url.searchParams.get('label') || `snap-${Date.now()}`;
    const snap  = await this._sm.snapshot(label);
    return new Response(JSON.stringify({ ok: true, snapshot: snap }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Register a custom action handler.
   */
  registerAction(name, fn) {
    this._handlers[name] = fn;
    return this;
  }

  stop() {
    this._probe.stop();
    return this;
  }

  getAgentId() { return this._agentId; }
  getStateManager() { return this._sm; }
  getProbe()    { return this._probe; }
}

// ─── EdgeAgentRuntime ─────────────────────────────────────────────────────────

class EdgeAgentRuntime {
  /**
   * Manages lifecycle of multiple DurableAgent instances at edge.
   */
  constructor(opts = {}) {
    this._agents     = new Map();
    this._env        = opts.env        || {};
    this._maxAgents  = opts.maxAgents  || 1000;
    this._ttlMs      = opts.ttlMs      || 60 * 60 * 1000; // 1 hour
    this._gcInterval = opts.gcIntervalMs || 5 * 60 * 1000;
    this._gcTimer    = null;
    this._edgeLabel  = opts.edgeLabel  || process.env.CF_EDGE_LOCATION || 'local';
  }

  start() {
    this._gcTimer = setInterval(() => this._gc(), this._gcInterval);
    if (this._gcTimer.unref) this._gcTimer.unref();
    return this;
  }

  stop() {
    if (this._gcTimer) { clearInterval(this._gcTimer); this._gcTimer = null; }
    for (const [, entry] of this._agents) entry.agent.stop();
    this._agents.clear();
    return this;
  }

  /**
   * Instantiate or retrieve a DurableAgent by ID.
   */
  getOrCreate(agentId, cslGates = []) {
    let entry = this._agents.get(agentId);
    if (!entry) {
      if (this._agents.size >= this._maxAgents) {
        this._evictOldest();
      }
      const storage = new Map();
      const agent   = new DurableAgent({ id: agentId, storage }, { ...this._env, cslGates });
      entry = { agent, createdAt: Date.now(), lastSeen: Date.now() };
      this._agents.set(agentId, entry);
    } else {
      entry.lastSeen = Date.now();
    }
    return entry.agent;
  }

  /**
   * Forward a request to the correct DurableAgent.
   */
  async routeRequest(agentId, request) {
    const agent = this.getOrCreate(agentId);
    if (!agent._initialized) await agent._initialize();
    return agent.fetch(request);
  }

  /**
   * Migrate an agent to another edge location.
   */
  async migrateAgent(agentId, targetEdgeLabel) {
    const entry = this._agents.get(agentId);
    if (!entry) throw new Error(`Agent '${agentId}' not found`);

    const sourceSm = entry.agent.getStateManager();
    const targetSm = new StateManager({ prefix: sourceSm._prefix });
    const result   = await sourceSm.migrateToEdge(targetSm);

    return {
      agentId,
      from:     this._edgeLabel,
      to:       targetEdgeLabel,
      migrated: result.migrated,
      ts:       Date.now(),
    };
  }

  _gc() {
    const now     = Date.now();
    const expired = [];
    for (const [id, entry] of this._agents) {
      if (now - entry.lastSeen > this._ttlMs) expired.push(id);
    }
    for (const id of expired) {
      const entry = this._agents.get(id);
      if (entry) entry.agent.stop();
      this._agents.delete(id);
    }
  }

  _evictOldest() {
    let oldest = null;
    let oldestTs = Infinity;
    for (const [id, entry] of this._agents) {
      if (entry.lastSeen < oldestTs) { oldest = id; oldestTs = entry.lastSeen; }
    }
    if (oldest) {
      const entry = this._agents.get(oldest);
      if (entry) entry.agent.stop();
      this._agents.delete(oldest);
    }
  }

  getAgentCount() { return this._agents.size; }
  getEdgeLabel()  { return this._edgeLabel; }
  listAgentIds()  { return Array.from(this._agents.keys()); }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PHI,
  evaluateCslGate,
  StateManager,
  EdgeHealthProbe,
  DurableAgent,
  EdgeAgentRuntime,
};

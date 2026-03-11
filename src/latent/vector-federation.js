/**
 * ∞ Heady™ Vector Federation — Distributed Federated Memory Coordination
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module vector-federation
 * @description Coordinates multiple VectorMemory instances across a distributed
 *   topology. Uses consistent hashing to assign keys to nodes, replicates
 *   writes to `replicationFactor` nodes for fault tolerance, and merges
 *   parallel cross-node recall results by cosine similarity. Handles node
 *   join/leave with automatic rebalancing.
 */

'use strict';

const { PHI_TIMING } = require('../shared/phi-math');
const { EventEmitter } = require('events');
const { VectorMemory } = require('./vector-memory');
const { cosineSimilarity, DIMS, isValidVector } = require('./vector-space-ops');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REPLICATION_FACTOR = 2;
const DEFAULT_HEALTH_INTERVAL_MS = PHI_TIMING.CYCLE; // φ⁷ × 1000
const VIRTUAL_NODES_PER_NODE = 150; // Consistent hash ring density

// ---------------------------------------------------------------------------
// Consistent Hash Ring
// ---------------------------------------------------------------------------

/**
 * A simple consistent hash ring based on FNV-1a.
 * Each logical node is represented by VIRTUAL_NODES_PER_NODE virtual slots
 * evenly distributed around a 32-bit ring.
 */
class ConsistentHashRing {
  constructor() {
    /** @type {Map<number, string>} ring position → nodeId */
    this.ring = new Map();
    /** @type {number[]} sorted ring positions */
    this.sortedKeys = [];
    /** @type {Set<string>} */
    this.nodeIds = new Set();
  }

  /**
   * FNV-1a 32-bit hash of a string.
   * @param {string} str
   * @returns {number}
   */
  _hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  /**
   * Add a node to the ring.
   * @param {string} nodeId
   */
  addNode(nodeId) {
    this.nodeIds.add(nodeId);
    for (let v = 0; v < VIRTUAL_NODES_PER_NODE; v++) {
      const pos = this._hash(`${nodeId}:vn${v}`);
      this.ring.set(pos, nodeId);
    }
    this._rebuild();
  }

  /**
   * Remove a node from the ring.
   * @param {string} nodeId
   */
  removeNode(nodeId) {
    this.nodeIds.delete(nodeId);
    for (const [pos, id] of this.ring) {
      if (id === nodeId) this.ring.delete(pos);
    }
    this._rebuild();
  }

  /**
   * Get the N primary nodes responsible for a key.
   * @param {string} key
   * @param {number} count - Number of nodes (replication factor).
   * @returns {string[]} Ordered node IDs.
   */
  getNodes(key, count) {
    if (this.sortedKeys.length === 0) return [];
    const pos = this._hash(key);
    // Find the first position >= pos (binary search).
    let lo = 0, hi = this.sortedKeys.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.sortedKeys[mid] < pos) lo = mid + 1;
      else hi = mid;
    }
    // Walk the ring collecting unique node IDs.
    const selected = [];
    const seen = new Set();
    for (let i = 0; i < this.sortedKeys.length && selected.length < count; i++) {
      const idx = (lo + i) % this.sortedKeys.length;
      const nodeId = this.ring.get(this.sortedKeys[idx]);
      if (!seen.has(nodeId)) {
        seen.add(nodeId);
        selected.push(nodeId);
      }
    }
    return selected;
  }

  /** @private */
  _rebuild() {
    this.sortedKeys = [...this.ring.keys()].sort((a, b) => a - b);
  }

  /** @returns {string[]} All node IDs in the ring */
  getAll() {
    return [...this.nodeIds];
  }
}

// ---------------------------------------------------------------------------
// NodeState
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} NodeState
 * @property {string} id - Unique node identifier.
 * @property {VectorMemory} memory - In-process VectorMemory instance.
 * @property {'healthy'|'degraded'|'offline'} status
 * @property {number} lastHealthCheck - Timestamp of last health check.
 * @property {number} errorCount - Consecutive error count.
 * @property {Object} metrics - Latest stats snapshot.
 */

// ---------------------------------------------------------------------------
// FederatedMemory
// ---------------------------------------------------------------------------

/**
 * FederatedMemory coordinates writes and queries across multiple VectorMemory
 * nodes using consistent hashing and configurable replication.
 *
 * @extends EventEmitter
 *
 * @fires FederatedMemory#node-added
 * @fires FederatedMemory#node-removed
 * @fires FederatedMemory#node-degraded
 * @fires FederatedMemory#rebalance-start
 * @fires FederatedMemory#rebalance-complete
 * @fires FederatedMemory#recall-complete
 */
class FederatedMemory extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {number} [options.replicationFactor=2] - Write replicas.
   * @param {number} [options.healthIntervalMs=PHI_TIMING.CYCLE] - Health check interval.
   * @param {Object} [options.memoryOptions] - Options forwarded to each VectorMemory.
   */
  constructor(options = {}) {
    super();
    this.replicationFactor = options.replicationFactor || DEFAULT_REPLICATION_FACTOR;
    this.healthIntervalMs = options.healthIntervalMs || DEFAULT_HEALTH_INTERVAL_MS;
    this.memoryOptions = options.memoryOptions || {};

    this.ring = new ConsistentHashRing();
    /** @type {Map<string, NodeState>} nodeId → state */
    this.nodes = new Map();

    this._healthTimer = null;
    this._stats = {
      totalStores: 0,
      totalRecalls: 0,
      rebalances: 0,
      nodeJoins: 0,
      nodeLeaves: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Node management
  // -------------------------------------------------------------------------

  /**
   * Add a new memory node to the federation.
   * Triggers a rebalancing pass to migrate keys from overloaded primary nodes.
   *
   * @param {string} nodeId - Unique identifier for the new node.
   * @param {VectorMemory} [existingMemory] - Optional pre-existing instance.
   * @returns {NodeState} The created node state.
   *
   * @fires FederatedMemory#node-added
   */
  addNode(nodeId, existingMemory = null) {
    if (this.nodes.has(nodeId)) {
      throw new Error(`FederatedMemory: node "${nodeId}" already exists`);
    }
    const memory = existingMemory || new VectorMemory({
      ...this.memoryOptions,
      instanceId: nodeId,
    });
    const state = {
      id: nodeId,
      memory,
      status: 'healthy',
      lastHealthCheck: Date.now(),
      errorCount: 0,
      metrics: {},
    };
    this.nodes.set(nodeId, state);
    this.ring.addNode(nodeId);
    this._stats.nodeJoins += 1;

    /**
     * @event FederatedMemory#node-added
     * @type {{ nodeId: string, timestamp: number }}
     */
    this.emit('node-added', { nodeId, timestamp: Date.now() });

    // Rebalance only if there are already existing keys somewhere.
    if (this.nodes.size > 1) {
      this._rebalance(nodeId);
    }

    return state;
  }

  /**
   * Remove a node from the federation.
   * Migrates all its keys to their new consistent-hash targets before removal.
   *
   * @param {string} nodeId - Node to remove.
   * @returns {boolean} True if the node existed.
   *
   * @fires FederatedMemory#node-removed
   */
  removeNode(nodeId) {
    const state = this.nodes.get(nodeId);
    if (!state) return false;

    // Migrate all keys from the departing node to remaining nodes.
    this._migrateFrom(nodeId);

    this.ring.removeNode(nodeId);
    this.nodes.delete(nodeId);
    this._stats.nodeLeaves += 1;

    /**
     * @event FederatedMemory#node-removed
     * @type {{ nodeId: string, timestamp: number }}
     */
    this.emit('node-removed', { nodeId, timestamp: Date.now() });
    return true;
  }

  // -------------------------------------------------------------------------
  // Write
  // -------------------------------------------------------------------------

  /**
   * Store a key/vector/metadata triple, replicating to replicationFactor nodes.
   *
   * @param {string} key - Memory key.
   * @param {Float32Array} vector - 384D vector.
   * @param {Object} [metadata={}] - Metadata payload.
   * @param {'stm'|'ltm'} [tier='stm'] - Memory tier.
   * @returns {{ storedOn: string[], failed: string[] }}
   */
  store(key, vector, metadata = {}, tier = 'stm') {
    if (!isValidVector(vector, DIMS)) {
      throw new TypeError(`FederatedMemory.store: invalid vector dimensions`);
    }
    const targetNodes = this.ring.getNodes(key, this.replicationFactor);
    const storedOn = [];
    const failed = [];

    for (const nodeId of targetNodes) {
      const state = this.nodes.get(nodeId);
      if (!state || state.status === 'offline') {
        failed.push(nodeId);
        continue;
      }
      try {
        state.memory.store(key, vector, metadata, tier);
        storedOn.push(nodeId);
      } catch (err) {
        this._recordError(state, err);
        failed.push(nodeId);
      }
    }

    this._stats.totalStores += 1;

    if (storedOn.length === 0) {
      throw new Error(`FederatedMemory.store: all replicas failed for key "${key}"`);
    }
    return { storedOn, failed };
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  /**
   * Recall top-K memories across all healthy nodes in parallel, then merge.
   * Deduplicates results by key, keeping the highest similarity for each.
   *
   * @param {Float32Array} queryVector - 384D query embedding.
   * @param {number} [k=10] - Number of results to return.
   * @param {Object} [options={}] - Forwarded to VectorMemory.recall().
   * @returns {Promise<Array<{ entry: Object, similarity: number, nodeId: string }>>}
   *
   * @fires FederatedMemory#recall-complete
   */
  async recall(queryVector, k = 10, options = {}) {
    if (!isValidVector(queryVector, DIMS)) {
      throw new TypeError('FederatedMemory.recall: invalid query vector');
    }
    const healthyNodes = [...this.nodes.values()].filter(n => n.status !== 'offline');

    // Parallel query all nodes.
    const perNodePromises = healthyNodes.map(state =>
      Promise.resolve()
        .then(() => state.memory.recall(queryVector, k, options)
          .map(r => ({ ...r, nodeId: state.id }))
        )
        .catch(err => {
          this._recordError(state, err);
          return [];
        })
    );

    const allResults = (await Promise.all(perNodePromises)).flat();

    // Deduplicate by key, keep highest similarity.
    const bestByKey = new Map();
    for (const result of allResults) {
      const key = result.entry.key;
      const existing = bestByKey.get(key);
      if (!existing || result.similarity > existing.similarity) {
        bestByKey.set(key, result);
      }
    }

    const merged = [...bestByKey.values()]
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    this._stats.totalRecalls += 1;

    /**
     * @event FederatedMemory#recall-complete
     * @type {{ queryVector: Float32Array, k: number, resultsCount: number, nodesQueried: number }}
     */
    this.emit('recall-complete', {
      queryVector,
      k,
      resultsCount: merged.length,
      nodesQueried: healthyNodes.length,
      timestamp: Date.now(),
    });
    return merged;
  }

  /**
   * Retrieve a single key from the first replica that has it.
   *
   * @param {string} key
   * @returns {Object|null}
   */
  get(key) {
    const targetNodes = this.ring.getNodes(key, this.replicationFactor);
    for (const nodeId of targetNodes) {
      const state = this.nodes.get(nodeId);
      if (!state || state.status === 'offline') continue;
      const entry = state.memory.get(key);
      if (entry) return entry;
    }
    return null;
  }

  /**
   * Delete a key from all replicas.
   *
   * @param {string} key
   * @returns {{ forgotOn: string[] }}
   */
  forget(key) {
    const targetNodes = this.ring.getNodes(key, this.replicationFactor);
    const forgotOn = [];
    for (const nodeId of targetNodes) {
      const state = this.nodes.get(nodeId);
      if (!state) continue;
      if (state.memory.forget(key)) forgotOn.push(nodeId);
    }
    return { forgotOn };
  }

  // -------------------------------------------------------------------------
  // Health monitoring
  // -------------------------------------------------------------------------

  /**
   * Start periodic health checks on all nodes.
   */
  startHealthMonitor() {
    if (this._healthTimer) return;
    this._healthTimer = setInterval(() => this._runHealthChecks(), this.healthIntervalMs);
    if (this._healthTimer.unref) this._healthTimer.unref(); // Don't block process exit.
  }

  /**
   * Stop health monitoring.
   */
  stopHealthMonitor() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
  }

  /**
   * Perform a health check on a specific node and update its status.
   *
   * @param {string} nodeId
   * @returns {Object} Health report.
   */
  checkNodeHealth(nodeId) {
    const state = this.nodes.get(nodeId);
    if (!state) return null;
    try {
      const metrics = state.memory.stats();
      state.metrics = metrics;
      state.lastHealthCheck = Date.now();
      // Reset error count on success.
      if (state.errorCount > 0) {
        state.errorCount = Math.max(0, state.errorCount - 1);
      }
      const prevStatus = state.status;
      state.status = state.errorCount >= 5 ? 'degraded' : 'healthy';
      if (prevStatus !== 'healthy' && state.status === 'healthy') {
        this.emit('node-recovered', { nodeId, timestamp: Date.now() });
      }
      return { nodeId, status: state.status, metrics };
    } catch (err) {
      this._recordError(state, err);
      return { nodeId, status: state.status, error: err.message };
    }
  }

  /**
   * Return a snapshot of all nodes and their health status.
   *
   * @returns {Object[]}
   */
  healthReport() {
    return [...this.nodes.values()].map(state => ({
      nodeId: state.id,
      status: state.status,
      lastHealthCheck: state.lastHealthCheck,
      errorCount: state.errorCount,
      metrics: state.metrics,
    }));
  }

  /**
   * Return federation-level statistics.
   * @returns {Object}
   */
  stats() {
    return {
      nodes: this.nodes.size,
      healthyNodes: [...this.nodes.values()].filter(n => n.status === 'healthy').length,
      replicationFactor: this.replicationFactor,
      ...this._stats,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** @private */
  _runHealthChecks() {
    for (const nodeId of this.nodes.keys()) {
      this.checkNodeHealth(nodeId);
    }
  }

  /** @private */
  _recordError(state, err) {
    state.errorCount += 1;
    const prevStatus = state.status;
    if (state.errorCount >= 10) {
      state.status = 'offline';
    } else if (state.errorCount >= 5) {
      state.status = 'degraded';
    }
    if (prevStatus !== state.status) {
      /**
       * @event FederatedMemory#node-degraded
       * @type {{ nodeId: string, status: string, error: string }}
       */
      this.emit('node-degraded', { nodeId: state.id, status: state.status, error: err.message });
    }
  }

  /**
   * Migrate all keys from a departing node to their new owners.
   * @private
   * @param {string} departingNodeId
   */
  _migrateFrom(departingNodeId) {
    const state = this.nodes.get(departingNodeId);
    if (!state) return;

    let migrated = 0;
    for (const entry of state.memory) {
      // Remove the departing node from ring temporarily to find new owners.
      const tempRing = new ConsistentHashRing();
      for (const [id] of this.nodes) {
        if (id !== departingNodeId) tempRing.addNode(id);
      }
      const targets = tempRing.getNodes(entry.key, this.replicationFactor);
      for (const nodeId of targets) {
        const target = this.nodes.get(nodeId);
        if (target && target.status !== 'offline') {
          target.memory.store(entry.key, entry.vector, entry.metadata, entry.tier);
          migrated += 1;
          break; // Migrate to first healthy target only (ring handles redundancy).
        }
      }
    }
    return migrated;
  }

  /**
   * Rebalance keys to a newly joined node.
   * @private
   * @param {string} newNodeId
   */
  _rebalance(newNodeId) {
    this._stats.rebalances += 1;
    this.emit('rebalance-start', { targetNode: newNodeId, timestamp: Date.now() });
    let transferred = 0;

    // Walk all existing nodes and migrate keys that now belong to newNodeId.
    for (const [nodeId, state] of this.nodes) {
      if (nodeId === newNodeId) continue;
      for (const entry of state.memory) {
        const owners = this.ring.getNodes(entry.key, this.replicationFactor);
        if (owners.includes(newNodeId)) {
          const newState = this.nodes.get(newNodeId);
          if (newState) {
            newState.memory.store(entry.key, entry.vector, entry.metadata, entry.tier);
            transferred += 1;
          }
        }
      }
    }

    this.emit('rebalance-complete', { targetNode: newNodeId, transferred, timestamp: Date.now() });
  }
}


module.exports = { FederatedMemory, ConsistentHashRing };

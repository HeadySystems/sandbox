'use strict';

/**
 * GraphRAGBee — Knowledge graph construction and multi-hop retrieval.
 * Builds entity-relation graphs, scores paths via phi-weighted traversal.
 * © 2026-2026 HeadySystems Inc.
 */

const PHI  = 1.6180339887;
const PSI  = 0.6180339887;
const PHI2 = 2.6180339887;
const PHI3 = 4.2360679775;

const MAX_NODES       = 610;    // fib(15)
const MAX_EDGES       = 987;    // fib(16)
const MAX_HOPS        = 5;      // fib(5)
const TOP_K_DEFAULT   = 8;      // fib(6)
const HEARTBEAT_MS    = Math.round(PHI3 * 1000);   // 4236 ms
const COHERENCE_THRESHOLD = 1 - Math.pow(PSI, 2);  // ≈ 0.618
const SIMILARITY_FLOOR    = PSI;                    // ≈ 0.618 — min edge weight to traverse
const DECAY_PER_HOP       = PSI;                    // score × ψ per hop

class GraphRAGBee {
  constructor(config = {}) {
    this.id       = config.id ?? `graph-rag-${Date.now()}`;
    this.maxNodes = config.maxNodes ?? MAX_NODES;
    this.maxEdges = config.maxEdges ?? MAX_EDGES;

    this._alive     = false;
    this._coherence = 1.0;
    this._nodes     = new Map();   // id → { id, label, type, embedding?, meta }
    this._edges     = new Map();   // `${from}-${to}` → { from, to, relation, weight }
    this._queryCount = 0;
    this._heartbeatTimer = null;
  }

  async spawn() {
    this._alive = true;
    this._heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    await this.initialize();
    return this;
  }

  async initialize() {
    this._nodes     = new Map();
    this._edges     = new Map();
    this._queryCount = 0;
    this._coherence  = 1.0;
  }

  /**
   * Execute a graph operation.
   * @param {object} task — { op: 'ADD_NODE'|'ADD_EDGE'|'QUERY'|'INGEST', ...params }
   */
  async execute(task) {
    if (!this._alive) throw new Error('GraphRAGBee not spawned');
    switch (task.op) {
      case 'ADD_NODE':   return this._addNode(task);
      case 'ADD_EDGE':   return this._addEdge(task);
      case 'QUERY':      return this._query(task);
      case 'INGEST':     return this._ingest(task);
      case 'STATS':      return this._stats();
      default: throw new Error(`Unknown op: ${task.op}`);
    }
  }

  _addNode({ id, label, type = 'ENTITY', embedding = null, meta = {} }) {
    if (this._nodes.size >= this.maxNodes) this._evictLRUNode();
    this._nodes.set(id, { id, label, type, embedding, meta, createdAt: Date.now(), lastAccess: Date.now() });
    return { added: true, nodeId: id, totalNodes: this._nodes.size };
  }

  _addEdge({ from, to, relation = 'RELATED', weight = PSI }) {
    if (!this._nodes.has(from) || !this._nodes.has(to)) {
      return { added: false, reason: 'Node not found' };
    }
    if (this._edges.size >= this.maxEdges) this._evictWeakEdge();
    const key = `${from}→${to}`;
    const existing = this._edges.get(key);
    // Phi-blend weights on duplicate edge
    const finalWeight = existing
      ? clamp(existing.weight * PSI + weight * (1 - PSI), 0, 1)
      : clamp(weight, 0, 1);
    this._edges.set(key, { from, to, relation, weight: finalWeight, ts: Date.now() });
    return { added: true, edgeKey: key, weight: finalWeight, totalEdges: this._edges.size };
  }

  /**
   * Multi-hop retrieval starting from seed node(s).
   * @param {object} task — { seedIds: string[], maxHops?: number, topK?: number, minWeight?: number }
   */
  _query({ seedIds = [], maxHops = MAX_HOPS, topK = TOP_K_DEFAULT, minWeight = SIMILARITY_FLOOR }) {
    this._queryCount++;
    const visited  = new Map();   // nodeId → best score
    const frontier = seedIds.map(id => ({ nodeId: id, score: 1.0, path: [id], hops: 0 }));
    const results  = [];

    while (frontier.length > 0) {
      const curr = frontier.shift();
      const { nodeId, score, path, hops } = curr;

      if (!this._nodes.has(nodeId)) continue;
      if ((visited.get(nodeId) ?? 0) >= score) continue;
      visited.set(nodeId, score);

      const node = this._nodes.get(nodeId);
      node.lastAccess = Date.now();
      results.push({ nodeId, label: node.label, type: node.type, score: parseFloat(score.toFixed(4)), hops, path });

      if (hops >= maxHops) continue;

      // Expand neighbors
      for (const [key, edge] of this._edges) {
        if (edge.from !== nodeId) continue;
        if (edge.weight < minWeight) continue;
        const nextScore = score * edge.weight * DECAY_PER_HOP;
        if ((visited.get(edge.to) ?? 0) < nextScore) {
          frontier.push({ nodeId: edge.to, score: nextScore, path: [...path, edge.to], hops: hops + 1 });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    this._updateCoherence();
    return {
      results: results.slice(0, topK),
      totalTraversed: visited.size,
      queryCount: this._queryCount,
      coherence: this._coherence,
    };
  }

  /** Ingest a list of entity-relation triples. */
  _ingest({ triples = [] }) {
    let nodes = 0, edges = 0;
    for (const { subject, predicate, object, weight } of triples) {
      if (!this._nodes.has(subject)) { this._addNode({ id: subject, label: subject }); nodes++; }
      if (!this._nodes.has(object))  { this._addNode({ id: object,  label: object  }); nodes++; }
      this._addEdge({ from: subject, to: object, relation: predicate, weight: weight ?? PSI });
      edges++;
    }
    return { nodesAdded: nodes, edgesAdded: edges, total: triples.length };
  }

  _evictLRUNode() {
    let oldest = null, oldestId = null;
    for (const [id, node] of this._nodes) {
      if (!oldest || node.lastAccess < oldest) { oldest = node.lastAccess; oldestId = id; }
    }
    if (oldestId) {
      this._nodes.delete(oldestId);
      // Remove connected edges
      for (const [key, edge] of this._edges) {
        if (edge.from === oldestId || edge.to === oldestId) this._edges.delete(key);
      }
    }
  }

  _evictWeakEdge() {
    let weakest = null, weakestKey = null;
    for (const [key, edge] of this._edges) {
      if (!weakest || edge.weight < weakest) { weakest = edge.weight; weakestKey = key; }
    }
    if (weakestKey) this._edges.delete(weakestKey);
  }

  _updateCoherence() {
    // Coherence = edge density relative to max possible, scaled by phi
    const density = this._nodes.size > 1
      ? this._edges.size / (this._nodes.size * (this._nodes.size - 1))
      : 0;
    this._coherence = Math.min(1.0, density * PHI2);
  }

  _stats() {
    return { nodes: this._nodes.size, edges: this._edges.size, queryCount: this._queryCount, coherence: this._coherence };
  }

  heartbeat() { this._updateCoherence(); }

  getHealth() {
    return {
      id: this.id,
      status: this._alive ? (this._coherence >= COHERENCE_THRESHOLD ? 'HEALTHY' : 'DEGRADED') : 'OFFLINE',
      coherence: parseFloat(this._coherence.toFixed(4)),
      nodes: this._nodes.size,
      edges: this._edges.size,
      queryCount: this._queryCount,
      maxNodes: this.maxNodes,
      maxEdges: this.maxEdges,
      traversalDecay: DECAY_PER_HOP,
      similarityFloor: SIMILARITY_FLOOR,
    };
  }

  async shutdown() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    this._alive = false;
    this._coherence = 0;
  }
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

module.exports = { GraphRAGBee, MAX_NODES, MAX_EDGES, MAX_HOPS, SIMILARITY_FLOOR, COHERENCE_THRESHOLD };

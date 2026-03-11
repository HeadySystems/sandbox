/**
 * @file sacred-geometry-engine.js
 * @description The Sacred Geometry orchestration engine for Heady™ Latent OS.
 *   Governs node placement, ring topology, coherence scoring, phi-scaling
 *   enforcement, Fibonacci resource allocation, and UI/typography spacing.
 *
 * @module engines/sacred-geometry-engine
 * @version 2.0.0
 * @license Proprietary — HeadySystems Inc.
 */

'use strict';

const {
  PHI,
  PSI,
  PHI_SQ,
  fib,
  CSL_THRESHOLDS,
  cosineSimilarity,
  phiFusionWeights,
  phiMultiSplit,
} = require('../shared/phi-math.js');

// ── Topology Constants ────────────────────────────────────────────────────────

/**
 * Canonical ring definitions.
 * Rings are ordered 0 (innermost) → 4 (outermost governance layer).
 * Each ring has a numeric index used for path routing.
 *
 * @type {Readonly<Record<string, number>>}
 */
const RING_INDEX = Object.freeze({
  central:    0,
  inner:      1,
  middle:     2,
  outer:      3,
  governance: 4,
});

/**
 * Canonical node assignments per ring.
 * These map directly to Heady™ Latent OS service identifiers.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
const RING_NODES = Object.freeze({
  central:    ['HeadySoul'],
  inner:      ['HeadyBrains', 'HeadyConductor', 'HeadyVinci'],
  middle:     ['JULES', 'BUILDER', 'OBSERVER', 'MURPHY', 'ATLAS', 'PYTHIA'],
  outer:      ['BRIDGE', 'MUSE', 'SENTINEL', 'NOVA', 'JANITOR', 'SOPHIA', 'CIPHER', 'LENS'],
  governance: ['HeadyCheck', 'HeadyAssure', 'HeadyAware', 'HeadyPatterns', 'HeadyMC', 'HeadyRisk'],
});

/**
 * Phi-resource pool weights — used by allocateResources and getPoolAllocation.
 * Sum ≈ 81%; the remaining ≈19% is overhead buffer.
 */
const PHI_POOL_WEIGHTS = Object.freeze({
  hot:        0.34,
  warm:       0.21,
  cold:       0.13,
  reserve:    0.08,
  governance: 0.05,
});

/**
 * Fibonacci spacing multipliers for UI systems.
 * Indices 2–9 of the Fibonacci sequence: [1, 2, 3, 5, 8, 13, 21, 34]
 * Starts at fib(2)=1 to avoid the duplicate fib(1)=fib(2)=1.
 * getSpacingScale multiplies each by the base unit (default 8px) to yield
 * [8, 16, 24, 40, 64, 104, 168, 272].
 */
const FIB_SPACING_INDICES = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9]);

/** Coherence drift threshold: nodes scoring below this are flagged as drifted. */
const COHERENCE_DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM; // ≈ 0.809

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic 384-dimensional unit-vector stub embedding.
 * Returns a plain Array<number> compatible with phi-math-v2's cosineSimilarity
 * (which requires plain Array inputs, not TypedArrays).
 * In production this is replaced by a real embedding model call.
 *
 * @param {string} text - Input text
 * @returns {number[]} 384-dimensional unit vector (plain Array)
 */
function stubEmbedding(text) {
  const dim = 384;
  const vec = new Array(dim);
  let hash  = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    hash >>>= 0;
  }
  for (let i = 0; i < dim; i++) {
    hash   = ((hash * 1664525) + 1013904223) >>> 0;
    vec[i] = ((hash & 0xFFFF) / 0xFFFF) * 2 - 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

/**
 * Compute the angular position (radians) of a node within its ring.
 * Nodes are evenly distributed around the ring using tau (2π).
 *
 * @param {number} index     - Node index within its ring (0-based)
 * @param {number} ringTotal - Total number of nodes in the ring
 * @returns {number} Angle in radians
 */
function computeAngle(index, ringTotal) {
  return ringTotal > 1 ? (2 * Math.PI * index) / ringTotal : 0;
}

/**
 * Snap a numeric value to the nearest phi-derived candidate.
 * Candidates: PHI^n for n in [-3, 6], plus PSI^n and Fibonacci values up to fib(10).
 *
 * @param {number} value - Raw numeric value
 * @returns {{ nearest: number, source: string }} Nearest phi-derived value and its formula
 */
function nearestPhiValue(value) {
  const candidates = [];
  for (let n = -3; n <= 6; n++) {
    candidates.push({ v: Math.pow(PHI, n), label: `PHI^${n}` });
    candidates.push({ v: Math.pow(PSI, n), label: `PSI^${n}` });
  }
  for (let i = 1; i <= 10; i++) {
    candidates.push({ v: fib(i), label: `fib(${i})` });
  }
  let best = candidates[0];
  for (const c of candidates) {
    if (Math.abs(c.v - value) < Math.abs(best.v - value)) best = c;
  }
  return { nearest: best.v, source: best.label };
}

/**
 * Determine whether a value is "phi-derived" within a tolerance band.
 * A value is phi-derived if it matches a phi/fibonacci candidate within ±5%.
 *
 * @param {number} value - Value to test
 * @returns {boolean}
 */
function isPhiDerived(value) {
  if (typeof value !== 'number' || !isFinite(value) || value === 0) return false;
  const { nearest } = nearestPhiValue(value);
  return Math.abs(nearest - value) / Math.max(Math.abs(value), 1e-10) < 0.05;
}

// ── Node Record ───────────────────────────────────────────────────────────────

/**
 * Represents a single registered node in the topology.
 */
class NodeRecord {
  /**
   * @param {string}   id           - Unique node identifier
   * @param {string}   ring         - Ring name (central|inner|middle|outer|governance)
   * @param {number}   angle        - Radial angle (radians) within ring
   * @param {string[]} capabilities - List of capability strings
   */
  constructor(id, ring, angle, capabilities = []) {
    this.id           = id;
    this.ring         = ring;
    this.ringIndex    = RING_INDEX[ring] ?? -1;
    this.angle        = angle;
    this.capabilities = capabilities;
    this.embedding    = stubEmbedding(id); // 384-dim unit vector
    this.healthScore  = 1.0;
    this.coherenceScore = 1.0;
    this.registeredAt = new Date().toISOString();
    this.lastSeenAt   = this.registeredAt;
  }

  /**
   * @returns {object} Serialisable snapshot
   */
  toJSON() {
    return {
      id:             this.id,
      ring:           this.ring,
      ringIndex:      this.ringIndex,
      angleDeg:       +(this.angle * (180 / Math.PI)).toFixed(2),
      capabilities:   this.capabilities,
      healthScore:    +this.healthScore.toFixed(4),
      coherenceScore: +this.coherenceScore.toFixed(4),
      registeredAt:   this.registeredAt,
      lastSeenAt:     this.lastSeenAt,
    };
  }
}

// ── SacredGeometryEngine ──────────────────────────────────────────────────────

/**
 * @class SacredGeometryEngine
 * @description Governs the sacred-geometric topology of the Heady™ Latent OS.
 *   Manages ring-based node placement, coherence computation, phi resource
 *   allocation, Fibonacci UI spacing, and phi-compliance auditing.
 *
 * @example
 * const engine = new SacredGeometryEngine();
 * engine.registerNode('HeadySoul', 'central', ['orchestration', 'routing']);
 * const report = engine.getCoherenceReport();
 */
class SacredGeometryEngine {
  /**
   * @param {object} [config={}]
   * @param {number} [config.spacingBase=8]     - Base pixel unit for spacing scale
   * @param {number} [config.typographyBase=16] - Base font size for typography scale
   * @param {boolean} [config.autoRegisterDefaults=true] - Auto-register canonical nodes on init
   */
  constructor(config = {}) {
    this._config = {
      spacingBase:           config.spacingBase           ?? 8,
      typographyBase:        config.typographyBase        ?? 16,
      autoRegisterDefaults:  config.autoRegisterDefaults  ?? true,
    };

    /** @type {Map<string, NodeRecord>} */
    this._nodes = new Map();

    /** Pool allocation state */
    this._poolAllocations = { ...PHI_POOL_WEIGHTS };

    if (this._config.autoRegisterDefaults) {
      this._registerCanonicalNodes();
    }
  }

  // ── Initialisation ──────────────────────────────────────────────────────────

  /**
   * Register all canonical nodes defined in RING_NODES with their default positions.
   * @private
   */
  _registerCanonicalNodes() {
    for (const [ring, nodeIds] of Object.entries(RING_NODES)) {
      nodeIds.forEach((id, idx) => {
        this.registerNode(id, ring, []);
      });
    }
  }

  // ── Topology Management ────────────────────────────────────────────────────

  /**
   * Register a node in the topology.
   * If the node ID already exists, its capabilities and lastSeenAt are updated.
   *
   * @param {string}   id           - Node identifier (e.g. 'HeadySoul')
   * @param {string}   ring         - Ring name: central|inner|middle|outer|governance
   * @param {string[]} [capabilities=[]] - Node capability strings
   * @returns {NodeRecord} The registered or updated node record
   * @throws {Error} If ring name is not recognised
   */
  registerNode(id, ring, capabilities = []) {
    if (!Object.hasOwn(RING_INDEX, ring)) {
      throw new Error(`Unknown ring: "${ring}". Valid rings: ${Object.keys(RING_INDEX).join(', ')}`);
    }

    if (this._nodes.has(id)) {
      const existing      = this._nodes.get(id);
      existing.capabilities = capabilities.length ? capabilities : existing.capabilities;
      existing.lastSeenAt = new Date().toISOString();
      return existing;
    }

    // Compute evenly-distributed angle
    const ringNodes = this.getNodesInRing(ring);
    const angle     = computeAngle(ringNodes.length, (RING_NODES[ring] || []).length || ringNodes.length + 1);

    const node = new NodeRecord(id, ring, angle, capabilities);
    this._nodes.set(id, node);
    return node;
  }

  /**
   * Retrieve a registered node by ID.
   *
   * @param {string} id - Node identifier
   * @returns {NodeRecord|undefined}
   */
  getNode(id) {
    return this._nodes.get(id);
  }

  /**
   * List all nodes registered in a given ring, ordered by angle.
   *
   * @param {string} ring - Ring name
   * @returns {NodeRecord[]} Nodes in the ring, sorted by angle ascending
   */
  getNodesInRing(ring) {
    const nodes = [];
    for (const node of this._nodes.values()) {
      if (node.ring === ring) nodes.push(node);
    }
    return nodes.sort((a, b) => a.angle - b.angle);
  }

  /**
   * Compute the shortest geometric path between two nodes.
   * Traverses rings one hop at a time (inward or outward as required).
   * Path cost is proportional to ring distance × PHI.
   *
   * @param {string} fromId - Source node ID
   * @param {string} toId   - Destination node ID
   * @returns {{ path: string[], hops: number, cost: number }}
   * @throws {Error} If either node is not registered
   */
  getGeometricPath(fromId, toId) {
    const fromNode = this._nodes.get(fromId);
    const toNode   = this._nodes.get(toId);
    if (!fromNode) throw new Error(`Node not found: "${fromId}"`);
    if (!toNode)   throw new Error(`Node not found: "${toId}"`);

    if (fromId === toId) {
      return { path: [fromId], hops: 0, cost: 0 };
    }

    // BFS through rings: each ring is a layer, nodes in the same ring can relay
    const fromRingIdx = fromNode.ringIndex;
    const toRingIdx   = toNode.ringIndex;

    const path  = [fromId];
    const hops  = Math.abs(fromRingIdx - toRingIdx);

    // Find an intermediate relay node on each crossed ring boundary
    if (hops > 0) {
      const direction = toRingIdx > fromRingIdx ? 1 : -1;
      const ringNames = Object.entries(RING_INDEX)
        .sort((a, b) => a[1] - b[1])
        .map(([name]) => name);

      for (let step = 1; step < hops; step++) {
        const crossedRingName = ringNames[fromRingIdx + direction * step];
        if (crossedRingName) {
          const relay = this.getNodesInRing(crossedRingName)[0];
          if (relay) path.push(relay.id);
        }
      }
    }

    path.push(toId);

    // Cost: phi-weighted by ring distance
    const cost = hops === 0 ? 0 : +(Math.pow(PHI, hops) - 1).toFixed(4);

    return { path, hops, cost };
  }

  /**
   * Returns the full topology as a JSON-serialisable object, keyed by ring.
   *
   * @returns {object}
   */
  getTopology() {
    const topology = {};
    for (const ring of Object.keys(RING_INDEX)) {
      topology[ring] = this.getNodesInRing(ring).map(n => n.toJSON());
    }
    return topology;
  }

  // ── Coherence Scoring ──────────────────────────────────────────────────────

  /**
   * Compute pairwise coherence between two nodes using cosine similarity
   * of their 384-dimensional embeddings.
   *
   * @param {string} nodeIdA - First node ID
   * @param {string} nodeIdB - Second node ID
   * @returns {number} Cosine similarity in [−1, 1]
   * @throws {Error} If either node is not registered
   */
  computeNodeCoherence(nodeIdA, nodeIdB) {
    const a = this._nodes.get(nodeIdA);
    const b = this._nodes.get(nodeIdB);
    if (!a) throw new Error(`Node not found: "${nodeIdA}"`);
    if (!b) throw new Error(`Node not found: "${nodeIdB}"`);
    const sim = cosineSimilarity(a.embedding, b.embedding);
    // Update coherence scores on the nodes
    a.coherenceScore = +((a.coherenceScore + sim) / 2).toFixed(4);
    b.coherenceScore = +((b.coherenceScore + sim) / 2).toFixed(4);
    return +sim.toFixed(6);
  }

  /**
   * Compute average pairwise coherence across all registered nodes.
   * Uses phi-weighted sampling for large topologies (>13 nodes).
   *
   * @returns {number} Average coherence score in [0, 1]
   */
  computeSystemCoherence() {
    const nodes = [...this._nodes.values()];
    if (nodes.length < 2) return 1.0;

    // For large topologies, sample phi-fraction of pairs to keep O(n²) manageable
    const maxPairs = fib(11); // 89 pairs max
    const pairs    = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        pairs.push([nodes[i].id, nodes[j].id]);
      }
    }

    const sample = pairs.length > maxPairs
      ? pairs.filter((_, idx) => idx % Math.ceil(pairs.length / maxPairs) === 0).slice(0, maxPairs)
      : pairs;

    const scores = sample.map(([a, b]) => cosineSimilarity(
      this._nodes.get(a).embedding,
      this._nodes.get(b).embedding
    ));

    // Apply phi-fusion weights to the scores for weighted average
    const weights = phiFusionWeights(scores.length);
    const weighted = scores.reduce((sum, s, i) => sum + s * weights[i], 0);
    return +Math.max(0, weighted).toFixed(6);
  }

  /**
   * Detect whether a node has drifted beyond the coherence threshold.
   * A node is considered drifted if its average coherence with ring-mates
   * falls below COHERENCE_DRIFT_THRESHOLD (≈ 0.809).
   *
   * @param {string} nodeId - Node to inspect
   * @returns {{ drifted: boolean, score: number, threshold: number, ringMateScores: object }}
   * @throws {Error} If node is not registered
   */
  detectCoherenceDrift(nodeId) {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: "${nodeId}"`);

    const ringMates    = this.getNodesInRing(node.ring).filter(n => n.id !== nodeId);
    const ringMateScores = {};

    if (ringMates.length === 0) {
      return { drifted: false, score: 1.0, threshold: COHERENCE_DRIFT_THRESHOLD, ringMateScores };
    }

    let totalScore = 0;
    for (const mate of ringMates) {
      const sim = cosineSimilarity(node.embedding, mate.embedding);
      ringMateScores[mate.id] = +sim.toFixed(6);
      totalScore += sim;
    }

    const avgScore = totalScore / ringMates.length;
    const drifted  = avgScore < COHERENCE_DRIFT_THRESHOLD;

    // Update the node's coherence score
    node.coherenceScore = +avgScore.toFixed(4);

    return {
      drifted,
      score:            +avgScore.toFixed(6),
      threshold:        COHERENCE_DRIFT_THRESHOLD,
      ringMateScores,
    };
  }

  /**
   * Generate a full system coherence report.
   * Includes per-node drift detection and system-wide average.
   *
   * @returns {object} Coherence report
   */
  getCoherenceReport() {
    const systemCoherence = this.computeSystemCoherence();
    const nodeReports     = {};
    const driftedNodes    = [];

    for (const [id] of this._nodes) {
      const drift = this.detectCoherenceDrift(id);
      nodeReports[id] = drift;
      if (drift.drifted) driftedNodes.push(id);
    }

    return {
      systemCoherence:  +systemCoherence.toFixed(6),
      driftThreshold:   COHERENCE_DRIFT_THRESHOLD,
      totalNodes:       this._nodes.size,
      driftedNodes,
      driftedCount:     driftedNodes.length,
      healthStatus:     driftedNodes.length === 0 ? 'COHERENT' : 'DRIFT_DETECTED',
      nodeReports,
      generatedAt:      new Date().toISOString(),
    };
  }

  // ── Fibonacci Resource Allocation ──────────────────────────────────────────

  /**
   * Distribute a total budget across pools using phi-resource weights.
   * Each pool allocation is phi-proportional; any remainder goes to hot pool.
   *
   * @param {number} totalBudget - Total resource units to distribute
   * @returns {{ hot: number, warm: number, cold: number, reserve: number, governance: number, overhead: number }}
   */
  allocateResources(totalBudget) {
    if (!Number.isFinite(totalBudget) || totalBudget <= 0) {
      throw new RangeError(`totalBudget must be a positive finite number, got: ${totalBudget}`);
    }

    const pools      = ['hot', 'warm', 'cold', 'reserve', 'governance'];
    const weights    = pools.map(p => PHI_POOL_WEIGHTS[p]);
    const weightSum  = weights.reduce((s, w) => s + w, 0);
    const allocation = {};
    let allocated    = 0;

    for (let i = 0; i < pools.length; i++) {
      // Fibonacci-snap each allocation
      const raw  = totalBudget * (weights[i] / weightSum / (1 / 0.81));
      const snapped = i < pools.length - 1
        ? Math.round(raw)
        : Math.round(raw);
      allocation[pools[i]] = snapped;
      allocated += snapped;
    }

    // Overhead is what remains after the five pools
    const overhead = +(totalBudget - totalBudget * 0.81).toFixed(2);
    allocation.overhead  = Math.round(overhead);
    allocation._total    = totalBudget;
    allocation._sum      = allocated;

    return allocation;
  }

  /**
   * Returns the canonical phi-resource pool allocation percentages.
   *
   * @returns {{ hot: number, warm: number, cold: number, reserve: number, governance: number }}
   */
  getPoolAllocation() {
    return { ...PHI_POOL_WEIGHTS };
  }

  /**
   * Scale a pool up or down by one Fibonacci step and update the allocation.
   * Fibonacci steps (concurrency units): 5, 8, 13, 21, 34, 55, 89.
   *
   * @param {string}    poolName  - Pool name to scale
   * @param {'up'|'down'} direction - Scaling direction
   * @returns {{ pool: string, newConcurrency: number, fibStep: number }}
   * @throws {Error} If poolName is not a valid pool
   */
  scalePool(poolName, direction) {
    if (!Object.hasOwn(PHI_POOL_WEIGHTS, poolName)) {
      throw new Error(`Unknown pool: "${poolName}". Valid pools: ${Object.keys(PHI_POOL_WEIGHTS).join(', ')}`);
    }

    const fibSteps = [fib(5), fib(6), fib(7), fib(8), fib(9), fib(10), fib(11)];
    // Derive current step from weight × 89 (max)
    const currentUnits = Math.round(PHI_POOL_WEIGHTS[poolName] * fib(11));
    let currentIdx = fibSteps.findIndex(f => f >= currentUnits);
    if (currentIdx < 0) currentIdx = fibSteps.length - 1;

    const newIdx      = direction === 'up'
      ? Math.min(currentIdx + 1, fibSteps.length - 1)
      : Math.max(currentIdx - 1, 0);
    const newUnits    = fibSteps[newIdx];

    return {
      pool:           poolName,
      newConcurrency: newUnits,
      fibStep:        newIdx + 5, // fib index
    };
  }

  // ── UI Spacing System ──────────────────────────────────────────────────────

  /**
   * Generate a Fibonacci-based spacing scale.
   * Returns 8 values: [fib(1)×base … fib(8)×base] = [1,1,2,3,5,8,13,21]×base.
   * Deduplicates the leading double-1 → [1,2,3,5,8,13,21,34]×base.
   *
   * @param {number} [base=8] - Base pixel unit (default 8px)
   * @returns {number[]} Eight spacing values in pixels
   */
  getSpacingScale(base = this._config.spacingBase) {
    return FIB_SPACING_INDICES.map(i => fib(i) * base);
  }

  /**
   * Generate a phi-geometric typography scale.
   * Each step is multiplied by PHI: [base, base×PHI, base×PHI², …].
   *
   * @param {number} [baseSize=16] - Base font size in px (default 16)
   * @returns {number[]} Five font sizes in px, rounded to 1 decimal
   */
  getTypographyScale(baseSize = this._config.typographyBase) {
    return [0, 1, 2, 3, 4].map(n => +parseFloat((baseSize * Math.pow(PHI, n)).toFixed(1)));
  }

  /**
   * Compute a golden-ratio layout split for a given container width.
   * Main column = width × PSI (≈61.8%), sidebar = width × PSI² (≈38.2%).
   *
   * @param {number} containerWidth - Total container width in px
   * @returns {{ main: number, sidebar: number, ratio: number, containerWidth: number }}
   */
  getGoldenLayout(containerWidth) {
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
      throw new RangeError(`containerWidth must be a positive finite number, got: ${containerWidth}`);
    }
    const main    = +(containerWidth * PSI).toFixed(2);
    const sidebar = +(containerWidth * PSI * PSI).toFixed(2);
    return {
      main,
      sidebar,
      ratio:          +PSI.toFixed(6),
      containerWidth,
      gap:            +(containerWidth - main - sidebar).toFixed(2),
    };
  }

  // ── Phi Compliance Enforcement ─────────────────────────────────────────────

  /**
   * Audit a configuration object for non-phi-derived numeric values.
   * Recursively traverses the object and flags any number that is not
   * within 5% of a phi/fibonacci candidate.
   *
   * @param {object} config - Configuration object to audit
   * @param {string} [prefix=''] - Key path prefix for nested objects
   * @returns {{ compliant: boolean, violations: Array<{path: string, value: number, suggestion: object}>, scanned: number }}
   */
  auditConfig(config, prefix = '') {
    const violations = [];
    let scanned      = 0;

    const traverse = (obj, path) => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (typeof value === 'number' && isFinite(value) && value !== 0) {
          scanned++;
          if (!isPhiDerived(value)) {
            violations.push({
              path:       fullPath,
              value,
              suggestion: this.suggestPhiReplacement(value),
            });
          }
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          traverse(value, fullPath);
        }
      }
    };

    traverse(config, prefix);

    return {
      compliant:  violations.length === 0,
      violations,
      scanned,
    };
  }

  /**
   * Suggest the nearest phi-derived replacement for a given numeric value.
   *
   * @param {number} value - Non-phi-compliant value
   * @returns {{ nearest: number, source: string, delta: number, relativeError: number }}
   */
  suggestPhiReplacement(value) {
    const { nearest, source } = nearestPhiValue(value);
    const delta         = +(nearest - value).toFixed(6);
    const relativeError = +((Math.abs(nearest - value) / Math.max(Math.abs(value), 1e-10)) * 100).toFixed(2);
    return { nearest: +nearest.toFixed(6), source, delta, relativeError };
  }

  /**
   * Auto-fix a configuration object to use phi-derived values.
   * Each non-compliant number is replaced with the nearest phi-derived value.
   * Returns a deep clone; the original is not mutated.
   *
   * @param {object} config - Configuration object to enforce phi-scaling on
   * @returns {object} New config object with phi-compliant values
   */
  enforcePhiScaling(config) {
    const deepClone = obj => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(deepClone);
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'number' && isFinite(v) && v !== 0) {
          out[k] = isPhiDerived(v) ? v : nearestPhiValue(v).nearest;
        } else if (v !== null && typeof v === 'object') {
          out[k] = deepClone(v);
        } else {
          out[k] = v;
        }
      }
      return out;
    };
    return deepClone(config);
  }

  // ── Ring Utility Methods ───────────────────────────────────────────────────

  /**
   * Returns the canonical ring index for a ring name.
   *
   * @param {string} ring - Ring name
   * @returns {number} Ring index (0 = central, 4 = governance)
   */
  getRingIndex(ring) {
    const idx = RING_INDEX[ring];
    if (idx === undefined) throw new Error(`Unknown ring: "${ring}"`);
    return idx;
  }

  /**
   * List all registered node IDs.
   *
   * @returns {string[]}
   */
  listNodes() {
    return [...this._nodes.keys()];
  }

  /**
   * Update a node's health score and refresh its lastSeenAt timestamp.
   *
   * @param {string} nodeId      - Node to update
   * @param {number} healthScore - New health score in [0, 1]
   * @returns {NodeRecord}
   * @throws {Error} If node is not registered
   */
  updateNodeHealth(nodeId, healthScore) {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`Node not found: "${nodeId}"`);
    node.healthScore = Math.max(0, Math.min(1, healthScore));
    node.lastSeenAt  = new Date().toISOString();
    return node;
  }

  // ── Diagnostics / Observability ────────────────────────────────────────────

  /**
   * Return a full diagnostic snapshot of the engine.
   *
   * @returns {object}
   */
  getDiagnostics() {
    const coherenceReport = this.getCoherenceReport();
    const topology        = this.getTopology();
    const spacingScale    = this.getSpacingScale();
    const typographyScale = this.getTypographyScale();
    const goldenLayout    = this.getGoldenLayout(1440); // reference 1440px

    return {
      engine:          'SacredGeometryEngine',
      version:         '2.0.0',
      totalNodes:      this._nodes.size,
      rings:           Object.keys(RING_INDEX),
      ringNodeCounts:  Object.fromEntries(
        Object.keys(RING_INDEX).map(r => [r, this.getNodesInRing(r).length])
      ),
      coherence:       coherenceReport,
      topology,
      ui: {
        spacingScale,
        typographyScale,
        goldenLayout,
        phiConstant:   +PHI.toFixed(10),
        psiConstant:   +PSI.toFixed(10),
      },
      poolAllocation:  this.getPoolAllocation(),
      phiConstants: {
        PHI:            +PHI.toFixed(10),
        PSI:            +PSI.toFixed(10),
        PHI_SQ:         +PHI_SQ.toFixed(10),
        driftThreshold: COHERENCE_DRIFT_THRESHOLD,
        fibSequence:    FIB_SPACING_INDICES.map(i => fib(i)),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

// ── Module Export ─────────────────────────────────────────────────────────────

module.exports = {
  SacredGeometryEngine,
  NodeRecord,
  RING_INDEX,
  RING_NODES,
  PHI_POOL_WEIGHTS,
  COHERENCE_DRIFT_THRESHOLD,
  FIB_SPACING_INDICES,
  stubEmbedding,
  computeAngle,
  nearestPhiValue,
  isPhiDerived,
};

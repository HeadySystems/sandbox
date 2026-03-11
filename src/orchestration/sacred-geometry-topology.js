'use strict';
/**
 * SacredGeometryTopology — Geometric node placement, coherence scoring, and routing
 * for the Heady™ Sovereign AI Platform.
 *
 * All numeric constants are phi-derived. No round numbers.
 * © 2026-2026 HeadySystems Inc. All Rights Reserved.
 */

const phi = require('../../shared/phi-math.js');

// ─── Phi-derived constants ────────────────────────────────────────────────────
const PHI     = phi.PHI;        // ≈ 1.6180339887
const PSI     = phi.PSI;        // ≈ 0.6180339887  (1/φ)
const PHI_SQ  = phi.PHI_SQ;     // ≈ 2.6180339887  (φ²)
const PHI_CU  = phi.PHI_CU;     // ≈ 4.2360679775  (φ³)

// Golden angle in radians: 2π / φ²  ≈ 2.3999632  rad  (≈ 137.508°)
const GOLDEN_ANGLE = (2 * Math.PI) / PHI_SQ;

// Ring radii expressed as φ-powers
const RING_RADII = {
  HUB:        0,          // r = 0
  INNER:      PSI,        // r = 1/φ ≈ 0.618
  MIDDLE:     1.0,        // r = 1.0 (unity — exact by design)
  OUTER:      PHI,        // r = φ   ≈ 1.618
  GOVERNANCE: PHI_SQ,     // r = φ²  ≈ 2.618
};

// CSL coherence thresholds (phi-harmonic)
const CSL_THRESHOLDS = {
  CRITICAL: phi.CSL_THRESHOLDS ? phi.CSL_THRESHOLDS.CRITICAL : (1 - Math.pow(PSI, 4) * 0.5), // ≈ 0.927
  HIGH:     phi.CSL_THRESHOLDS ? phi.CSL_THRESHOLDS.HIGH     : (1 - Math.pow(PSI, 3) * 0.5), // ≈ 0.882
  MEDIUM:   phi.CSL_THRESHOLDS ? phi.CSL_THRESHOLDS.MEDIUM   : (1 - Math.pow(PSI, 2) * 0.5), // ≈ 0.809
  LOW:      phi.CSL_THRESHOLDS ? phi.CSL_THRESHOLDS.LOW      : (1 - PSI * 0.5),               // ≈ 0.691
  MINIMUM:  phi.CSL_THRESHOLDS ? phi.CSL_THRESHOLDS.MINIMUM  : 0.5,                            // ≈ 0.500
};

// Drift / alert thresholds
const DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM;   // ≈ 0.809
const ALERT_THRESHOLD = PSI;                      // ≈ 0.618  (legacy compat / psi gate)

// Embedding dimensionality (fib(14+x) aligned with 384 ~ F≈377 rounded up to 384)
const EMBEDDING_DIMS = 384;

// ─── Node definitions ─────────────────────────────────────────────────────────

/**
 * Raw node catalogue.  angle is computed at build time via placeNodes().
 * stateEmbedding is allocated lazily as Float32Array(EMBEDDING_DIMS).
 */
const NODE_DEFINITIONS = [
  // Hub
  { id: 'heady-soul',       name: 'HeadySoul',       ring: 'HUB'        },

  // Inner Ring
  { id: 'heady-brains',     name: 'HeadyBrains',     ring: 'INNER'      },
  { id: 'heady-conductor',  name: 'HeadyConductor',  ring: 'INNER'      },
  { id: 'heady-vinci',      name: 'HeadyVinci',      ring: 'INNER'      },

  // Middle Ring
  { id: 'jules',            name: 'JULES',           ring: 'MIDDLE'     },
  { id: 'builder',          name: 'BUILDER',         ring: 'MIDDLE'     },
  { id: 'observer',         name: 'OBSERVER',        ring: 'MIDDLE'     },
  { id: 'murphy',           name: 'MURPHY',          ring: 'MIDDLE'     },
  { id: 'atlas',            name: 'ATLAS',           ring: 'MIDDLE'     },
  { id: 'pythia',           name: 'PYTHIA',          ring: 'MIDDLE'     },

  // Outer Ring
  { id: 'bridge',           name: 'BRIDGE',          ring: 'OUTER'      },
  { id: 'muse',             name: 'MUSE',            ring: 'OUTER'      },
  { id: 'sentinel',         name: 'SENTINEL',        ring: 'OUTER'      },
  { id: 'nova',             name: 'NOVA',            ring: 'OUTER'      },
  { id: 'janitor',          name: 'JANITOR',         ring: 'OUTER'      },
  { id: 'sophia',           name: 'SOPHIA',          ring: 'OUTER'      },
  { id: 'cipher',           name: 'CIPHER',          ring: 'OUTER'      },
  { id: 'lens',             name: 'LENS',            ring: 'OUTER'      },

  // Governance Shell
  { id: 'heady-check',      name: 'HeadyCheck',      ring: 'GOVERNANCE' },
  { id: 'heady-assure',     name: 'HeadyAssure',     ring: 'GOVERNANCE' },
  { id: 'heady-aware',      name: 'HeadyAware',      ring: 'GOVERNANCE' },
  { id: 'heady-patterns',   name: 'HeadyPatterns',   ring: 'GOVERNANCE' },
  { id: 'heady-mc',         name: 'HeadyMC',         ring: 'GOVERNANCE' },
  { id: 'heady-risk',       name: 'HeadyRisk',       ring: 'GOVERNANCE' },
];

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * Place nodes within their ring using golden-angle increments.
 * Each node receives:
 *   angle        — cumulative golden angle for index within ring
 *   position.x/y — 2-D ring coordinates
 *   position.z   — φ-scaled vertical offset by ring depth (adds spatial depth)
 *   stateEmbedding — zero-initialised Float32Array(384)
 *
 * @param {Array<Object>} defs  Raw node definitions
 * @returns {Map<string, Object>}  Keyed by node id
 */
function placeNodes(defs) {
  // Group by ring, preserving order
  const rings = {};
  for (const def of defs) {
    if (!rings[def.ring]) rings[def.ring] = [];
    rings[def.ring].push(def);
  }

  const nodes = new Map();

  for (const [ringName, members] of Object.entries(rings)) {
    const r = RING_RADII[ringName];
    // Z offset: ring index × PSI² so each shell floats slightly above the last
    const ringDepth = Object.keys(RING_RADII).indexOf(ringName);
    const zOffset   = ringDepth * Math.pow(PSI, 2); // PSI² ≈ 0.382 per level

    members.forEach((def, idx) => {
      const angle = idx * GOLDEN_ANGLE; // golden-angle spacing within ring
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      const z = zOffset;

      const node = {
        id:             def.id,
        name:           def.name,
        ring:           def.ring,
        radius:         r,
        angle,          // radians
        position:       { x, y, z },
        stateEmbedding: new Float32Array(EMBEDDING_DIMS), // zero-init; populated by runtime
      };

      nodes.set(def.id, node);
    });
  }

  return nodes;
}

// ─── Coherence math ───────────────────────────────────────────────────────────

/**
 * Cosine similarity between two Float32Arrays of equal length.
 * Returns a value in [-1, 1].  Returns 0 for zero vectors.
 *
 * @param {Float32Array} vecA
 * @param {Float32Array} vecB
 * @returns {number}
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `cosineSimilarity: vector length mismatch ${vecA.length} vs ${vecB.length}`
    );
  }

  let dot   = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot   += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom < 1e-9 ? 0 : dot / denom;
}

/**
 * Coherence score between two node state embeddings.
 * Uses cosine similarity; result in [0, 1] after clamping.
 *
 * @param {Object} nodeA
 * @param {Object} nodeB
 * @returns {number}  0..1
 */
function coherenceScore(nodeA, nodeB) {
  const raw = cosineSimilarity(nodeA.stateEmbedding, nodeB.stateEmbedding);
  // Clamp to [0,1] — negative cosine means total misalignment, treat as 0
  return Math.max(0, raw);
}

// ─── Geometric routing ────────────────────────────────────────────────────────

/**
 * 3-D Euclidean distance between two nodes.
 *
 * @param {Object} nodeA
 * @param {Object} nodeB
 * @returns {number}
 */
function geometricDistance(nodeA, nodeB) {
  const dx = nodeA.position.x - nodeB.position.x;
  const dy = nodeA.position.y - nodeB.position.y;
  const dz = nodeA.position.z - nodeB.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Routing cost combines geometric distance and coherence penalty.
 * Lower cost = preferred path.
 *
 *   routingCost = geometricDistance × (1 - coherenceScore)
 *
 * @param {Object} nodeA
 * @param {Object} nodeB
 * @returns {number}
 */
function routingCost(nodeA, nodeB) {
  const dist = geometricDistance(nodeA, nodeB);
  const coh  = coherenceScore(nodeA, nodeB);
  // When coherence is 1 (perfect alignment) cost → 0; when 0 cost equals distance
  return dist * (1 - coh);
}

/**
 * Dijkstra-style shortest path through the ring hierarchy.
 * Edges connect: hub↔inner, inner↔middle, middle↔outer, outer↔governance,
 * plus all nodes within the same ring are connected to each other.
 *
 * @param {Map<string,Object>} nodeMap
 * @param {string} sourceId
 * @param {string} targetId
 * @returns {{ path: string[], totalCost: number }}
 */
function shortestPath(nodeMap, sourceId, targetId) {
  if (sourceId === targetId) {
    return { path: [sourceId], totalCost: 0 };
  }

  // Build adjacency: nodes are adjacent if they are in the same ring OR in adjacent rings
  const RING_ORDER = ['HUB', 'INNER', 'MIDDLE', 'OUTER', 'GOVERNANCE'];

  function adjacent(a, b) {
    if (a.ring === b.ring) return true;
    const ai = RING_ORDER.indexOf(a.ring);
    const bi = RING_ORDER.indexOf(b.ring);
    return Math.abs(ai - bi) === 1;
  }

  // Dijkstra
  const dist   = new Map();
  const prev   = new Map();
  const unvisited = new Set(nodeMap.keys());

  for (const id of nodeMap.keys()) dist.set(id, Infinity);
  dist.set(sourceId, 0);

  while (unvisited.size > 0) {
    // Pick unvisited node with smallest dist
    let u = null;
    let minD = Infinity;
    for (const id of unvisited) {
      const d = dist.get(id);
      if (d < minD) { minD = d; u = id; }
    }
    if (u === null || u === targetId) break;
    unvisited.delete(u);

    const nodeU = nodeMap.get(u);

    for (const vId of unvisited) {
      const nodeV = nodeMap.get(vId);
      if (!adjacent(nodeU, nodeV)) continue;

      const cost = routingCost(nodeU, nodeV);
      const alt  = dist.get(u) + cost;
      if (alt < dist.get(vId)) {
        dist.set(vId, alt);
        prev.set(vId, u);
      }
    }
  }

  // Reconstruct path
  const path = [];
  let cur = targetId;
  while (cur !== undefined) {
    path.unshift(cur);
    cur = prev.get(cur);
  }

  // Validate reachability
  if (path[0] !== sourceId) {
    return { path: [], totalCost: Infinity };
  }

  return { path, totalCost: dist.get(targetId) };
}

// ─── UI layout helpers ────────────────────────────────────────────────────────

/**
 * Returns phi-proportioned column/row divisions for a given canvas size.
 *
 *   Major division at position × PHI / (1 + PHI) ≈ 0.618 × dimension
 *   Minor remainder: position × PSI / (1 + PHI) ≈ 0.382 × dimension
 *
 * @param {number} width   canvas width in px
 * @param {number} height  canvas height in px
 * @returns {{ columns: number[], rows: number[] }}
 */
function gridRatios(width, height) {
  // Golden section cuts: major, minor, and a further sub-division of major
  const colMajor = width * PSI;           // ≈ 61.8% from left
  const colMinor = width - colMajor;      // ≈ 38.2% (right column)
  const colSub   = colMajor * PSI;        // ≈ 38.2% of major ≈ 23.6% of total

  const rowMajor = height * PSI;
  const rowMinor = height - rowMajor;
  const rowSub   = rowMajor * PSI;

  return {
    columns: [
      Math.round(colSub),
      Math.round(colMajor),
      Math.round(colMajor + colMinor * PSI),
      Math.round(width),
    ],
    rows: [
      Math.round(rowSub),
      Math.round(rowMajor),
      Math.round(rowMajor + rowMinor * PSI),
      Math.round(height),
    ],
    // Named proportions for CSS Grid
    cssGridColumns: `${colSub.toFixed(3)}px ${(colMajor - colSub).toFixed(3)}px ${colMinor.toFixed(3)}px`,
    cssGridRows:    `${rowSub.toFixed(3)}px ${(rowMajor - rowSub).toFixed(3)}px ${rowMinor.toFixed(3)}px`,
  };
}

/**
 * Returns a φ-scaled typography size system.
 *
 * Levels:
 *   h1 = base × φ³  (most prominent)
 *   h2 = base × φ²
 *   h3 = base × φ
 *   body = base
 *   small = base × PSI
 *   caption = base × PSI²
 *
 * @param {number} baseSize  Body text size in px (e.g. 16)
 * @returns {Object}  Sizes keyed by semantic level
 */
function typographyScale(baseSize) {
  return {
    display: +(baseSize * PHI_CU).toFixed(3),   // ≈ base × 4.236
    h1:      +(baseSize * PHI_SQ).toFixed(3),   // ≈ base × 2.618
    h2:      +(baseSize * PHI).toFixed(3),       // ≈ base × 1.618
    h3:      +(baseSize * Math.sqrt(PHI)).toFixed(3), // ≈ base × 1.272
    body:    +baseSize.toFixed(3),
    small:   +(baseSize * PSI).toFixed(3),       // ≈ base × 0.618
    caption: +(baseSize * Math.pow(PSI, 2)).toFixed(3), // ≈ base × 0.382
  };
}

/**
 * Returns a Fibonacci-based spacing system.
 * The base unit is multiplied by consecutive Fibonacci numbers.
 *
 * @param {number} baseUnit  Base spacing unit in px (e.g. 1)
 * @returns {Object}  Spacing tokens xs..xxxl
 */
function spacingSystem(baseUnit) {
  // Fibonacci sequence: 1,1,2,3,5,8,13,21,34,55,89
  const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  const keys = ['px', 'xs', 'sm', 'md', 'base', 'lg', 'xl', 'xxl', 'xxxl', 'huge', 'max'];
  const result = {};
  keys.forEach((key, i) => {
    result[key] = +(FIB[i] * baseUnit).toFixed(3);
  });
  return result;
}

// ─── SacredGeometryTopology class ────────────────────────────────────────────

class SacredGeometryTopology {
  /**
   * @param {Object} [options]
   * @param {number} [options.driftThreshold]   Coherence below which drift is flagged
   * @param {number} [options.alertThreshold]   Secondary alert level (legacy compat)
   */
  constructor(options = {}) {
    this.driftThreshold = options.driftThreshold || DRIFT_THRESHOLD; // CSL_MEDIUM ≈ 0.809
    this.alertThreshold = options.alertThreshold || ALERT_THRESHOLD; // PSI ≈ 0.618

    // Build the node map with geometric placements
    this._nodes = placeNodes(NODE_DEFINITIONS);

    // Index by ring for ring-level queries
    this._ringIndex = this._buildRingIndex();
  }

  // ── Private helpers ──

  _buildRingIndex() {
    const idx = {};
    for (const node of this._nodes.values()) {
      if (!idx[node.ring]) idx[node.ring] = [];
      idx[node.ring].push(node.id);
    }
    return idx;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Return all nodes as an array, sorted by ring depth then angle.
   * @returns {Object[]}
   */
  getAllNodes() {
    const RING_ORDER = ['HUB', 'INNER', 'MIDDLE', 'OUTER', 'GOVERNANCE'];
    return [...this._nodes.values()].sort((a, b) => {
      const ri = RING_ORDER.indexOf(a.ring) - RING_ORDER.indexOf(b.ring);
      return ri !== 0 ? ri : a.angle - b.angle;
    });
  }

  /**
   * Return a single node by id.
   * @param {string} id
   * @returns {Object|undefined}
   */
  getNode(id) {
    return this._nodes.get(id);
  }

  /**
   * Return all nodes in a named ring.
   * @param {'HUB'|'INNER'|'MIDDLE'|'OUTER'|'GOVERNANCE'} ringName
   * @returns {Object[]}
   */
  getRing(ringName) {
    return (this._ringIndex[ringName] || []).map(id => this._nodes.get(id));
  }

  /**
   * Update a node's state embedding (e.g., after a new inference cycle).
   * @param {string}      nodeId
   * @param {Float32Array} embedding  Must be length 384
   */
  updateEmbedding(nodeId, embedding) {
    const node = this._nodes.get(nodeId);
    if (!node) throw new Error(`updateEmbedding: unknown node '${nodeId}'`);
    if (embedding.length !== EMBEDDING_DIMS) {
      throw new Error(
        `updateEmbedding: expected ${EMBEDDING_DIMS}-dim vector, got ${embedding.length}`
      );
    }
    node.stateEmbedding = embedding;
  }

  /**
   * Compute cosine similarity between two arbitrary vectors.
   * @param {Float32Array} vecA
   * @param {Float32Array} vecB
   * @returns {number}
   */
  cosineSimilarity(vecA, vecB) {
    return cosineSimilarity(vecA, vecB);
  }

  /**
   * Coherence score between two nodes.
   * @param {string} idA
   * @param {string} idB
   * @returns {number}  [0,1]
   */
  coherenceScore(idA, idB) {
    const a = this._nodes.get(idA);
    const b = this._nodes.get(idB);
    if (!a) throw new Error(`coherenceScore: unknown node '${idA}'`);
    if (!b) throw new Error(`coherenceScore: unknown node '${idB}'`);
    return coherenceScore(a, b);
  }

  /**
   * Check if two nodes have drifted beyond the configured threshold.
   * @param {string} idA
   * @param {string} idB
   * @returns {{ drifted: boolean, score: number, threshold: number }}
   */
  detectDrift(idA, idB) {
    const score = this.coherenceScore(idA, idB);
    return {
      drifted:   score < this.driftThreshold,
      score,
      threshold: this.driftThreshold,
    };
  }

  /**
   * Find shortest geometric path between two nodes.
   * @param {string} sourceId
   * @param {string} targetId
   * @returns {{ path: string[], totalCost: number }}
   */
  shortestPath(sourceId, targetId) {
    return shortestPath(this._nodes, sourceId, targetId);
  }

  /**
   * 3-D Euclidean distance between two nodes.
   * @param {string} idA
   * @param {string} idB
   * @returns {number}
   */
  geometricDistance(idA, idB) {
    const a = this._nodes.get(idA);
    const b = this._nodes.get(idB);
    if (!a) throw new Error(`geometricDistance: unknown node '${idA}'`);
    if (!b) throw new Error(`geometricDistance: unknown node '${idB}'`);
    return geometricDistance(a, b);
  }

  /**
   * Routing cost between two nodes (distance × coherence penalty).
   * @param {string} idA
   * @param {string} idB
   * @returns {number}
   */
  routingCost(idA, idB) {
    const a = this._nodes.get(idA);
    const b = this._nodes.get(idB);
    if (!a) throw new Error(`routingCost: unknown node '${idA}'`);
    if (!b) throw new Error(`routingCost: unknown node '${idB}'`);
    return routingCost(a, b);
  }

  /**
   * Generate a phi-proportioned grid layout helper for a given canvas.
   * @param {number} width
   * @param {number} height
   * @returns {Object}
   */
  gridRatios(width, height) {
    return gridRatios(width, height);
  }

  /**
   * Generate a φ-scaled typography system from a base font size.
   * @param {number} baseSize  e.g. 16
   * @returns {Object}
   */
  typographyScale(baseSize) {
    return typographyScale(baseSize);
  }

  /**
   * Generate a Fibonacci-based spacing token system.
   * @param {number} baseUnit  e.g. 1 (px)
   * @returns {Object}
   */
  spacingSystem(baseUnit) {
    return spacingSystem(baseUnit);
  }

  /**
   * Full topology snapshot — useful for debugging or visualisation exports.
   * @returns {Object}
   */
  snapshot() {
    const nodes = this.getAllNodes().map(n => ({
      id:       n.id,
      name:     n.name,
      ring:     n.ring,
      radius:   +n.radius.toFixed(9),
      angle:    +n.angle.toFixed(9),
      position: {
        x: +n.position.x.toFixed(9),
        y: +n.position.y.toFixed(9),
        z: +n.position.z.toFixed(9),
      },
      embeddingNorm: Math.sqrt(
        n.stateEmbedding.reduce((s, v) => s + v * v, 0)
      ),
    }));

    return {
      version:        '3.2.3',
      phi:            PHI,
      psi:            PSI,
      phiSq:          PHI_SQ,
      goldenAngle:    GOLDEN_ANGLE,
      driftThreshold: this.driftThreshold,
      alertThreshold: this.alertThreshold,
      rings:          Object.fromEntries(
        Object.entries(RING_RADII).map(([k, v]) => [k, +v.toFixed(9)])
      ),
      cslThresholds:  { ...CSL_THRESHOLDS },
      nodes,
    };
  }
}

// ─── Module exports ───────────────────────────────────────────────────────────

module.exports = {
  SacredGeometryTopology,

  // Export constants for consumers
  PHI,
  PSI,
  PHI_SQ,
  PHI_CU,
  GOLDEN_ANGLE,
  RING_RADII,
  CSL_THRESHOLDS,
  DRIFT_THRESHOLD,
  ALERT_THRESHOLD,
  EMBEDDING_DIMS,

  // Export pure functions for testing / composability
  placeNodes,
  cosineSimilarity,
  coherenceScore,
  geometricDistance,
  routingCost,
  shortestPath,
  gridRatios,
  typographyScale,
  spacingSystem,
};

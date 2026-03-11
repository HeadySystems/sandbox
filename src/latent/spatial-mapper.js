/**
 * ∞ Heady™ Spatial Mapper — 3D Sacred Geometry Topology for 384D Space
 * Part of Heady™Systems™ Sovereign AI Platform v4.0.0
 * © 2026 Heady™Systems Inc. — Proprietary
 *
 * @module spatial-mapper
 * @description Projects 384D embedding vectors to 3D coordinates for real-time
 *   visualisation. Maintains a spatial index for 3D nearest-neighbour queries,
 *   runs a DBSCAN-like cluster detection algorithm, and maps components to
 *   concentric golden-ratio rings:
 *     inner      — core platform services
 *     middle     — execution layer
 *     outer      — specialised modules
 *     governance — oversight shell
 *   Ring radii are spaced by φ (1.618...).
 */

'use strict';

const {
  projectTo3D,
  cosineSimilarity,
  euclideanDistance,
  normalize,
  DIMS,
  PHI,
} = require('./vector-space-ops');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ring names in order from innermost to outermost. */
const RING_NAMES = ['inner', 'middle', 'outer', 'governance'];

/** Base radius for the innermost ring. */
const BASE_RING_RADIUS = 1.0;

/**
 * Ring radii, each scaled by φ relative to the previous.
 * inner=1.0, middle≈1.618, outer≈2.618, governance≈4.236
 */
const RING_RADII = RING_NAMES.map((_, i) => BASE_RING_RADIUS * Math.pow(PHI, i));

/** Type-to-ring mapping (assignable at runtime but seeded with sensible defaults). */
const DEFAULT_TYPE_RING_MAP = {
  memory: 'inner',
  embedding: 'inner',
  pipeline: 'middle',
  federation: 'middle',
  awareness: 'middle',
  drift: 'middle',
  agent: 'outer',
  tool: 'outer',
  plugin: 'outer',
  governance: 'governance',
  oversight: 'governance',
  generic: 'outer',
};

// ---------------------------------------------------------------------------
// SpatialPoint
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SpatialPoint
 * @property {string} id - Component / memory key.
 * @property {string} [type] - Component type for ring assignment.
 * @property {{ x: number, y: number, z: number }} position - 3D world position.
 * @property {string} ring - Assigned ring name.
 * @property {number} ringRadius - Radius for this ring.
 * @property {Float32Array} originalVector - Source 384D vector.
 * @property {Object} [metadata] - Arbitrary extra data.
 * @property {number} insertedAt - Timestamp.
 */

// ---------------------------------------------------------------------------
// OctreeNode (lightweight spatial index)
// ---------------------------------------------------------------------------

/**
 * Simple axis-aligned bounding box.
 * @typedef {{ minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number }} AABB
 */

/**
 * Lightweight octree node for 3D spatial lookups.
 */
class OctreeNode {
  /**
   * @param {AABB} bounds
   * @param {number} capacity - Max points before splitting.
   * @param {number} depth - Current depth.
   * @param {number} maxDepth - Maximum depth.
   */
  constructor(bounds, capacity = 8, depth = 0, maxDepth = 8) {
    this.bounds = bounds;
    this.capacity = capacity;
    this.depth = depth;
    this.maxDepth = maxDepth;
    /** @type {SpatialPoint[]} */
    this.points = [];
    /** @type {OctreeNode[]|null} */
    this.children = null;
  }

  /**
   * Check whether a point is within these bounds.
   * @param {{ x: number, y: number, z: number }} p
   * @returns {boolean}
   */
  contains(p) {
    const b = this.bounds;
    return p.x >= b.minX && p.x <= b.maxX &&
           p.y >= b.minY && p.y <= b.maxY &&
           p.z >= b.minZ && p.z <= b.maxZ;
  }

  /**
   * Insert a spatial point.
   * @param {SpatialPoint} sp
   * @returns {boolean} False if point is outside bounds.
   */
  insert(sp) {
    if (!this.contains(sp.position)) return false;
    if (this.children) {
      return this.children.some(child => child.insert(sp));
    }
    this.points.push(sp);
    if (this.points.length > this.capacity && this.depth < this.maxDepth) {
      this._split();
    }
    return true;
  }

  /**
   * Find all points within a sphere.
   * @param {{ x: number, y: number, z: number }} center
   * @param {number} radius
   * @returns {SpatialPoint[]}
   */
  queryRadius(center, radius) {
    // Fast AABB vs sphere overlap check.
    const b = this.bounds;
    const dx = Math.max(b.minX - center.x, 0, center.x - b.maxX);
    const dy = Math.max(b.minY - center.y, 0, center.y - b.maxY);
    const dz = Math.max(b.minZ - center.z, 0, center.z - b.maxZ);
    if (dx * dx + dy * dy + dz * dz > radius * radius) return [];

    if (this.children) {
      return this.children.flatMap(c => c.queryRadius(center, radius));
    }
    return this.points.filter(sp => {
      const ddx = sp.position.x - center.x;
      const ddy = sp.position.y - center.y;
      const ddz = sp.position.z - center.z;
      return ddx * ddx + ddy * ddy + ddz * ddz <= radius * radius;
    });
  }

  /** @private */
  _split() {
    const b = this.bounds;
    const mx = (b.minX + b.maxX) / 2;
    const my = (b.minY + b.maxY) / 2;
    const mz = (b.minZ + b.maxZ) / 2;

    this.children = [
      new OctreeNode({ minX: b.minX, maxX: mx, minY: b.minY, maxY: my, minZ: b.minZ, maxZ: mz }, this.capacity, this.depth + 1, this.maxDepth),
      new OctreeNode({ minX: mx, maxX: b.maxX, minY: b.minY, maxY: my, minZ: b.minZ, maxZ: mz }, this.capacity, this.depth + 1, this.maxDepth),
      new OctreeNode({ minX: b.minX, maxX: mx, minY: my, maxY: b.maxY, minZ: b.minZ, maxZ: mz }, this.capacity, this.depth + 1, this.maxDepth),
      new OctreeNode({ minX: mx, maxX: b.maxX, minY: my, maxY: b.maxY, minZ: b.minZ, maxZ: mz }, this.capacity, this.depth + 1, this.maxDepth),
      new OctreeNode({ minX: b.minX, maxX: mx, minY: b.minY, maxY: my, minZ: mz, maxZ: b.maxZ }, this.capacity, this.depth + 1, this.maxDepth),
      new OctreeNode({ minX: mx, maxX: b.maxX, minY: b.minY, maxY: my, minZ: mz, maxZ: b.maxZ }, this.capacity, this.depth + 1, this.maxDepth),
      new OctreeNode({ minX: b.minX, maxX: mx, minY: my, maxY: b.maxY, minZ: mz, maxZ: b.maxZ }, this.capacity, this.depth + 1, this.maxDepth),
      new OctreeNode({ minX: mx, maxX: b.maxX, minY: my, maxY: b.maxY, minZ: mz, maxZ: b.maxZ }, this.capacity, this.depth + 1, this.maxDepth),
    ];

    for (const p of this.points) {
      this.children.some(child => child.insert(p));
    }
    this.points = [];
  }
}

// ---------------------------------------------------------------------------
// SpatialMapper
// ---------------------------------------------------------------------------

/**
 * SpatialMapper projects 384D vectors to 3D coordinates and maintains
 * a spatial index for nearest-neighbour queries and cluster detection.
 * Components are placed on concentric φ-spaced rings for visualisation.
 */
class SpatialMapper {
  /**
   * @param {Object} [options]
   * @param {number} [options.octreeBounds=20] - Half-extent of the octree world bounds.
   * @param {Object} [options.typeRingMap] - Override for type→ring assignment.
   * @param {number} [options.dbscanEpsilon=0.5] - DBSCAN neighbourhood radius in 3D.
   * @param {number} [options.dbscanMinPoints=2] - DBSCAN minimum cluster size.
   */
  constructor(options = {}) {
    const halfExt = options.octreeBounds || 20;
    this.octreeBounds = { minX: -halfExt, maxX: halfExt, minY: -halfExt, maxY: halfExt, minZ: -halfExt, maxZ: halfExt };
    this.dbscanEpsilon = options.dbscanEpsilon || 0.5;
    this.dbscanMinPoints = options.dbscanMinPoints || 2;
    this.typeRingMap = { ...DEFAULT_TYPE_RING_MAP, ...(options.typeRingMap || {}) };

    /** @type {Map<string, SpatialPoint>} id → SpatialPoint */
    this.points = new Map();

    /** @type {OctreeNode} */
    this._octree = new OctreeNode(this.octreeBounds);

    this._ringCounters = Object.fromEntries(RING_NAMES.map(r => [r, 0]));
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Project a 384D vector to 3D and insert it into the spatial index.
   *
   * @param {string} id - Component / memory key.
   * @param {Float32Array} vector - 384D embedding.
   * @param {Object} [options={}]
   * @param {string} [options.type='generic'] - Component type for ring assignment.
   * @param {Object} [options.metadata] - Additional metadata stored on the point.
   * @returns {SpatialPoint}
   */
  insert(id, vector, options = {}) {
    if (!(vector instanceof Float32Array) || vector.length !== DIMS) {
      throw new TypeError(`SpatialMapper.insert: vector must be Float32Array(${DIMS})`);
    }
    const type = options.type || 'generic';
    const rawPos = projectTo3D(vector);
    const ring = this.typeRingMap[type] || 'outer';
    const ringIdx = RING_NAMES.indexOf(ring);
    const radius = RING_RADII[ringIdx];
    // Scale the raw [-1, 1] 3D projection to the ring radius.
    const mag = Math.sqrt(rawPos.x ** 2 + rawPos.y ** 2 + rawPos.z ** 2) || 1;
    const position = {
      x: (rawPos.x / mag) * radius,
      y: (rawPos.y / mag) * radius,
      z: (rawPos.z / mag) * radius,
    };

    const sp = {
      id,
      type,
      position,
      ring,
      ringRadius: radius,
      originalVector: vector,
      metadata: options.metadata || {},
      insertedAt: Date.now(),
    };

    this.points.set(id, sp);
    this._ringCounters[ring] = (this._ringCounters[ring] || 0) + 1;

    // Rebuild the octree when a point is inserted (simple approach).
    // For very large collections, switch to incremental insertion.
    this._octree = new OctreeNode(this.octreeBounds);
    for (const p of this.points.values()) {
      this._octree.insert(p);
    }

    return sp;
  }

  /**
   * Remove a point by ID.
   *
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const sp = this.points.get(id);
    if (!sp) return false;
    this._ringCounters[sp.ring] = Math.max(0, (this._ringCounters[sp.ring] || 1) - 1);
    this.points.delete(id);
    // Rebuild octree.
    this._octree = new OctreeNode(this.octreeBounds);
    for (const p of this.points.values()) {
      this._octree.insert(p);
    }
    return true;
  }

  /**
   * Find the K nearest 3D neighbours to a query point.
   *
   * @param {{ x: number, y: number, z: number }|Float32Array} query - 3D position or 384D vector.
   * @param {number} [k=10] - Number of neighbours.
   * @param {number} [searchRadius=5.0] - Initial search radius (expands if needed).
   * @returns {Array<{ point: SpatialPoint, distance3D: number }>}
   */
  nearestNeighbours(query, k = 10, searchRadius = 5.0) {
    let pos;
    if (query instanceof Float32Array) {
      pos = projectTo3D(query);
    } else {
      pos = query;
    }

    let candidates = [];
    let radius = searchRadius;
    // Expand search radius until we have enough candidates.
    while (candidates.length < k && radius <= 50) {
      candidates = this._octree.queryRadius(pos, radius);
      radius *= 2;
    }

    return candidates
      .map(p => {
        const dx = p.position.x - pos.x;
        const dy = p.position.y - pos.y;
        const dz = p.position.z - pos.z;
        return { point: p, distance3D: Math.sqrt(dx * dx + dy * dy + dz * dz) };
      })
      .sort((a, b) => a.distance3D - b.distance3D)
      .slice(0, k);
  }

  /**
   * Run DBSCAN-like cluster detection on all current points.
   * Returns clusters as arrays of point IDs.
   *
   * @param {number} [epsilon] - Neighbourhood radius override.
   * @param {number} [minPoints] - Minimum cluster size override.
   * @returns {Array<{ clusterId: number, points: string[], centroid3D: Object }>}
   */
  detectClusters(epsilon, minPoints) {
    const eps = epsilon || this.dbscanEpsilon;
    const minPts = minPoints || this.dbscanMinPoints;
    const allPoints = [...this.points.values()];
    const labels = new Map(); // id → clusterId (-1 = noise)
    let clusterId = 0;

    for (const p of allPoints) {
      if (labels.has(p.id)) continue;
      const neighbours = this._octree.queryRadius(p.position, eps);
      if (neighbours.length < minPts) {
        labels.set(p.id, -1); // Noise
        continue;
      }
      // Expand cluster.
      labels.set(p.id, clusterId);
      const seed = [...neighbours];
      const visited = new Set([p.id]);
      for (let i = 0; i < seed.length; i++) {
        const q = seed[i];
        if (!labels.has(q.id) || labels.get(q.id) === -1) {
          labels.set(q.id, clusterId);
        }
        if (visited.has(q.id)) continue;
        visited.add(q.id);
        const qNeighbours = this._octree.queryRadius(q.position, eps);
        if (qNeighbours.length >= minPts) {
          seed.push(...qNeighbours.filter(n => !visited.has(n.id)));
        }
      }
      clusterId += 1;
    }

    // Group by cluster ID.
    const clusterMap = new Map();
    for (const [id, cid] of labels) {
      if (cid === -1) continue;
      if (!clusterMap.has(cid)) clusterMap.set(cid, []);
      clusterMap.get(cid).push(id);
    }

    return [...clusterMap.entries()].map(([cid, ids]) => {
      const pts = ids.map(id => this.points.get(id));
      const cx = pts.reduce((s, p) => s + p.position.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.position.y, 0) / pts.length;
      const cz = pts.reduce((s, p) => s + p.position.z, 0) / pts.length;
      return {
        clusterId: cid,
        points: ids,
        centroid3D: { x: cx, y: cy, z: cz },
        size: ids.length,
      };
    });
  }

  /**
   * Get a specific point by ID.
   *
   * @param {string} id
   * @returns {SpatialPoint|null}
   */
  getPoint(id) {
    return this.points.get(id) || null;
  }

  /**
   * Return all points in a specific ring.
   *
   * @param {string} ring - Ring name.
   * @returns {SpatialPoint[]}
   */
  getPointsInRing(ring) {
    return [...this.points.values()].filter(p => p.ring === ring);
  }

  /**
   * Return ring topology metadata including φ-spaced radii.
   *
   * @returns {Object[]}
   */
  getRingTopology() {
    return RING_NAMES.map((name, i) => ({
      name,
      radius: RING_RADII[i],
      pointCount: this._ringCounters[name] || 0,
      phiExponent: i,
    }));
  }

  /**
   * Return a serialisable snapshot of all points (vectors excluded for size).
   *
   * @returns {Object[]}
   */
  export() {
    return [...this.points.values()].map(p => ({
      id: p.id,
      type: p.type,
      position: p.position,
      ring: p.ring,
      ringRadius: p.ringRadius,
      insertedAt: p.insertedAt,
      metadata: p.metadata,
    }));
  }

  /**
   * Summary statistics.
   * @returns {Object}
   */
  stats() {
    return {
      totalPoints: this.points.size,
      ringDistribution: { ...this._ringCounters },
      ringTopology: this.getRingTopology(),
      dbscanEpsilon: this.dbscanEpsilon,
      dbscanMinPoints: this.dbscanMinPoints,
    };
  }
}


module.exports = { SpatialMapper, OctreeNode, RING_NAMES, RING_RADII, DEFAULT_TYPE_RING_MAP, PHI };

/**
 * Heady™ Shadow Memory - Cross-Session Persistence with Decay
 * 
 * Features:
 * - Confidence decay by φ⁻¹ per session
 * - Reinforcement resets decay
 * - VSA bundling for consolidation
 * - DuckDB backend with HNSW indexing
 */

'use strict';

const { PSI, CSL_THRESHOLDS } = require('./vsa-operations');

class ShadowMemory {
  constructor(duckdb, options = {}) {
    this.db = duckdb;
    this.decayRate = options.decayRate || PSI;
    this.consolidationThreshold = options.consolidationThreshold || CSL_THRESHOLDS.HIGH;
    this.sessionDuration = options.sessionDuration || 3600000;  // 1 hour

    this.initDatabase();
  }

  async initDatabase() {
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS shadow_memory (
        id VARCHAR PRIMARY KEY,
        vector FLOAT[10000],
        metadata JSON,
        importance FLOAT,
        confidence FLOAT,
        sessions_since_access INTEGER,
        created_at BIGINT,
        last_accessed_at BIGINT
      )
    `);

    // Create HNSW index
    await this.db.run(`
      CREATE INDEX IF NOT EXISTS shadow_hnsw 
      ON shadow_memory 
      USING HNSW (vector)
      WITH (metric = 'cosine', M = 16, ef_construction = 128)
    `);
  }

  async store(id, vector, metadata = {}, importance = 0.5) {
    const now = Date.now();
    const vectorArray = Array.from(vector);

    await this.db.run(`
      INSERT OR REPLACE INTO shadow_memory
      (id, vector, metadata, importance, confidence, sessions_since_access, created_at, last_accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      JSON.stringify(vectorArray),
      JSON.stringify(metadata),
      importance,
      1.0,  // Initial confidence
      0,    // No decay yet
      now,
      now
    ]);
  }

  async get(id) {
    const row = await this.db.get(`
      SELECT * FROM shadow_memory WHERE id = ?
    `, [id]);

    if (!row) return null;

    return {
      id: row.id,
      vector: new Float64Array(JSON.parse(row.vector)),
      metadata: JSON.parse(row.metadata),
      importance: row.importance,
      confidence: row.confidence,
      sessionsSinceAccess: row.sessions_since_access,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at
    };
  }

  async search(queryVector, k = 10, threshold = CSL_THRESHOLDS.LOW) {
    // Convert threshold to distance
    const distanceThreshold = 1 - threshold;

    const rows = await this.db.all(`
      SELECT 
        id,
        metadata,
        importance,
        confidence,
        array_cosine_distance(vector, ?::FLOAT[10000]) AS distance,
        (1 - array_cosine_distance(vector, ?::FLOAT[10000])) AS similarity
      FROM shadow_memory
      ORDER BY distance
      LIMIT ?
    `, [
      JSON.stringify(Array.from(queryVector)),
      JSON.stringify(Array.from(queryVector)),
      k * 2  // Over-retrieve for filtering
    ]);

    return rows
      .filter(r => r.similarity >= threshold)
      .slice(0, k)
      .map(r => ({
        id: r.id,
        score: r.similarity,
        metadata: JSON.parse(r.metadata),
        importance: r.importance,
        confidence: r.confidence
      }));
  }

  async decayAll() {
    const sessionCutoff = Date.now() - this.sessionDuration;

    await this.db.run(`
      UPDATE shadow_memory
      SET 
        confidence = confidence * ?,
        sessions_since_access = sessions_since_access + 1
      WHERE last_accessed_at < ?
    `, [this.decayRate, sessionCutoff]);
  }

  async reinforce(id) {
    await this.db.run(`
      UPDATE shadow_memory
      SET 
        sessions_since_access = 0,
        last_accessed_at = ?,
        confidence = 1.0
      WHERE id = ?
    `, [Date.now(), id]);
  }

  async consolidate(vsa) {
    // Find clusters of similar memories
    const all = await this.db.all(`
      SELECT id, vector, importance, confidence
      FROM shadow_memory
      WHERE confidence > 0.1
    `);

    const clusters = this.clusterMemories(all, vsa);

    let consolidated = 0;
    for (const cluster of clusters) {
      if (cluster.length > 1) {
        // Bundle vectors
        const vectors = cluster.map(m => new Float64Array(JSON.parse(m.vector)));
        const bundled = vsa.bundle(...vectors);

        // Create consolidated entry
        const newId = `consolidated-${Date.now()}-${consolidated}`;
        await this.store(newId, bundled, {
          type: 'consolidated',
          sourceIds: cluster.map(m => m.id),
          count: cluster.length
        }, Math.max(...cluster.map(m => m.importance)));

        // Delete originals
        for (const mem of cluster) {
          await this.delete(mem.id);
        }

        consolidated++;
      }
    }

    return { clustersConsolidated: consolidated };
  }

  clusterMemories(memories, vsa) {
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < memories.length; i++) {
      if (used.has(i)) continue;

      const cluster = [memories[i]];
      used.add(i);

      const vecI = new Float64Array(JSON.parse(memories[i].vector));

      for (let j = i + 1; j < memories.length; j++) {
        if (used.has(j)) continue;

        const vecJ = new Float64Array(JSON.parse(memories[j].vector));
        const sim = vsa.similarity(vecI, vecJ);

        if (sim >= this.consolidationThreshold) {
          cluster.push(memories[j]);
          used.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters.filter(c => c.length > 1);  // Only multi-member clusters
  }

  async delete(id) {
    await this.db.run(`DELETE FROM shadow_memory WHERE id = ?`, [id]);
  }

  async clear() {
    await this.db.run(`DELETE FROM shadow_memory`);
  }

  async stats() {
    const row = await this.db.get(`
      SELECT 
        COUNT(*) as count,
        AVG(confidence) as avg_confidence,
        AVG(sessions_since_access) as avg_sessions,
        MIN(confidence) as min_confidence,
        MAX(confidence) as max_confidence
      FROM shadow_memory
    `);
    return row;
  }
}

module.exports = { ShadowMemory };

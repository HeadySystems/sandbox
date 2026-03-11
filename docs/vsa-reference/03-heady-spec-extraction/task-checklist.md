# Heady™ VSA Implementation Task Checklist

**Extracted from:** 06-vector-memory-vsa-shadow.md  
**Date:** March 7, 2026

## Priority 1: Core Vector Memory

### Task 1.1: Consolidate Vector Memory Implementation
- [ ] Review existing implementations in codebase
- [ ] Merge into single optimized version in `src/memory/vector-memory.js`
- [ ] Ensure 384-dimensional support
- [ ] Implement LRU eviction with phi-weighted scoring
- [ ] Add memory receipt system for audit trail

**Acceptance Criteria:**
- Single VectorMemory class with consistent API
- Eviction weights use PHI/(PHI+PSI+1) formula
- Receipt generation for all store operations
- Unit tests for store/retrieve/evict operations

### Task 1.2: CSL-Gated Similarity Search
- [ ] Implement threshold parameter (default: φ⁻¹ = 0.618)
- [ ] Only return results above confidence threshold
- [ ] Add threshold override per query
- [ ] Log filtered result counts for tuning

**Acceptance Criteria:**
- search() method accepts threshold parameter
- Results below threshold are dropped
- CSL_THRESHOLDS constants used consistently
- Benchmark shows >30% noise reduction

### Task 1.3: Phi-Scaled Embedding Dimensions
- [ ] Add dimension calculation based on content complexity
- [ ] Implement adaptive dimensionality if needed
- [ ] Document dimension selection rationale

**Acceptance Criteria:**
- Clear documentation on when to use 384 vs other dims
- Performance benchmarks for different dimensions
- Memory usage profiling

---

## Priority 2: VSA Hyperdimensional Computing

### Task 2.1: Expand vsa-csl-bridge.js
- [ ] Implement Binding operation (⊗)
- [ ] Implement Bundling operation (+)
- [ ] Implement Permutation operation (π)
- [ ] Implement Similarity operation (cos)
- [ ] Add CSL gating to all operations

**Acceptance Criteria:**
- All four VSA operations working
- Operations accept Float64Array inputs
- CSL threshold applied at retrieval (φ⁻¹)
- Unit tests with Torchhd validation vectors

**Code Template:**
```javascript
class VSAEngine {
  constructor(dimensions = 10000) {
    this.dim = dimensions;
  }

  bind(vecA, vecB) {
    // Element-wise multiplication
    const result = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      result[i] = vecA[i] * vecB[i];
    }
    return this.normalize(result);
  }

  bundle(...vectors) {
    // Element-wise addition
    const sum = new Float64Array(this.dim);
    for (const vec of vectors) {
      for (let i = 0; i < this.dim; i++) {
        sum[i] += vec[i];
      }
    }
    return this.normalize(sum);
  }

  permute(vec, shifts = 1) {
    // Circular shift
    const result = new Float64Array(this.dim);
    for (let i = 0; i < this.dim; i++) {
      result[i] = vec[(i - shifts + this.dim) % this.dim];
    }
    return result;
  }

  similarity(vecA, vecB) {
    // Cosine similarity with CSL gating
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < this.dim; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return sim >= this.CSL_THRESHOLD ? sim : 0;
  }

  normalize(vec) {
    const norm = Math.sqrt(vec.reduce((s, v) => s + v*v, 0));
    return vec.map(v => norm > 0 ? v / norm : 0);
  }
}
```

### Task 2.2: Replace Branch-Heavy Memory Lookup
- [ ] Identify current branching patterns in memory lookup
- [ ] Replace with vector operations where possible
- [ ] Benchmark before/after performance
- [ ] Document optimization decisions

**Acceptance Criteria:**
- Reduced if/else branches in hot paths
- Vectorized operations using typed arrays
- Performance improvement documented
- Code complexity reduced

---

## Priority 3: Shadow Memory Persistence

### Task 3.1: Cross-Session Memory with Decay
- [ ] Implement confidence decay formula: score × PSI^sessions
- [ ] Track session counter per memory entry
- [ ] Reset session counter on access (reinforcement)
- [ ] Add decay parameter configuration

**Acceptance Criteria:**
- Decay applies to inactive memories
- Reinforcement resets decay counter
- Configurable PSI decay rate
- Unit tests for decay over multiple sessions

**Code Template:**
```javascript
class ShadowMemory {
  constructor(duckdb, decayRate = PSI) {
    this.db = duckdb;
    this.decayRate = decayRate;
  }

  async store(id, vector, metadata, importance) {
    const entry = {
      id,
      vector: Array.from(vector),
      metadata,
      importance,
      confidence: 1.0,
      sessionsSinceAccess: 0,
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    await this.db.run(`
      INSERT INTO shadow_memory (id, vector, metadata, importance, confidence, sessions, created_at, last_accessed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, JSON.stringify(entry.vector), JSON.stringify(metadata), importance, entry.confidence, 0, entry.createdAt, entry.lastAccessedAt]);
  }

  async decayAll() {
    // Decay all memories not accessed this session
    await this.db.run(`
      UPDATE shadow_memory
      SET 
        confidence = confidence * ?,
        sessions = sessions + 1
      WHERE last_accessed_at < ?
    `, [this.decayRate, Date.now() - SESSION_DURATION]);
  }

  async reinforce(id) {
    // Reset decay on access
    await this.db.run(`
      UPDATE shadow_memory
      SET 
        sessions = 0,
        last_accessed_at = ?
      WHERE id = ?
    `, [Date.now(), id]);
  }
}
```

### Task 3.2: Shadow Memory Consolidation with VSA
- [ ] Implement bundling of related memories
- [ ] Use VSA operations for semantic clustering
- [ ] Consolidate duplicate/similar memories
- [ ] Preserve high-importance memories

**Acceptance Criteria:**
- Consolidation reduces memory count by 20-40%
- Important memories never consolidated
- Consolidated memories retrievable
- Consolidation metrics logged

### Task 3.3: DuckDB Backend Integration
- [ ] Create shadow_memory table schema
- [ ] Add HNSW index on vector column
- [ ] Implement CRUD operations
- [ ] Add batch insert/update methods

**Acceptance Criteria:**
- Table with proper data types (JSON for metadata)
- HNSW index created with correct parameters
- All operations have error handling
- Connection pooling implemented

**Schema:**
```sql
CREATE TABLE shadow_memory (
    id VARCHAR PRIMARY KEY,
    vector FLOAT[10000],  -- VSA dimension
    metadata JSON,
    importance FLOAT,
    confidence FLOAT,
    sessions INTEGER,
    created_at BIGINT,
    last_accessed_at BIGINT
);

CREATE INDEX shadow_hnsw ON shadow_memory
USING HNSW (vector)
WITH (metric = 'cosine', M = 16, ef_construction = 128);
```

---

## Priority 4: Memory Bees

### Task 4.1: CSL-Gated Memory Operations
- [ ] Implement Memory Bee agent class
- [ ] Add CSL threshold checks to all retrievals
- [ ] Implement phi-scaled consolidation cycles
- [ ] Add 3D projection for visualization

**Acceptance Criteria:**
- MemoryBee class with consolidate() method
- Consolidation runs on Fibonacci-timed schedule
- 3D projection uses proper dimensionality reduction
- Visualization data exported as JSON

**Code Template:**
```javascript
class MemoryBee {
  constructor(vectorMemory, shadowMemory, vsa) {
    this.vectorMemory = vectorMemory;
    this.shadowMemory = shadowMemory;
    this.vsa = vsa;
    this.nextConsolidation = Date.now() + this.phiInterval();
  }

  phiInterval() {
    // Fibonacci-based interval: fib(16) * 1000ms = 987 seconds
    return fib(16) * 1000;
  }

  async consolidate() {
    const entries = await this.vectorMemory.ids();
    const vectors = [];

    for (const id of entries) {
      const entry = this.vectorMemory.get(id);
      if (entry) vectors.push({ id, vector: entry.vector, metadata: entry.metadata });
    }

    // Cluster using VSA bundling
    const clusters = this.clusterBySimiliarity(vectors, CSL_THRESHOLDS.HIGH);

    // Consolidate each cluster
    for (const cluster of clusters) {
      if (cluster.length > 1) {
        const consolidated = this.vsa.bundle(...cluster.map(c => c.vector));
        await this.shadowMemory.store(
          `cluster-${Date.now()}`,
          consolidated,
          { consolidatedFrom: cluster.map(c => c.id) },
          Math.max(...cluster.map(c => c.metadata.importance || 0.5))
        );
      }
    }

    this.nextConsolidation = Date.now() + this.phiInterval();
  }

  clusterBySimilarity(vectors, threshold) {
    // Simple greedy clustering
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < vectors.length; i++) {
      if (used.has(i)) continue;

      const cluster = [vectors[i]];
      used.add(i);

      for (let j = i + 1; j < vectors.length; j++) {
        if (used.has(j)) continue;

        const sim = this.vsa.similarity(vectors[i].vector, vectors[j].vector);
        if (sim >= threshold) {
          cluster.push(vectors[j]);
          used.add(j);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  project3D(vectors) {
    // Simple PCA-like projection (use proper library in production)
    // Returns [{x, y, z}, ...] for visualization
    return vectors.map((v, i) => ({
      id: v.id,
      x: v.vector[0],
      y: v.vector[1],
      z: v.vector[2],
      // In production: Use UMAP or t-SNE for better projection
    }));
  }
}
```

---

## Priority 5: Test Suite

### Task 5.1: Memory Search Tests
- [ ] Test semantic similarity search
- [ ] Test CSL threshold filtering
- [ ] Test top-k retrieval accuracy
- [ ] Benchmark query latency

**Test Cases:**
```javascript
describe('Vector Memory Search', () => {
  it('should return top-k similar entries', async () => {
    const vm = new VectorMemory({ dimensions: 384 });
    await vm.storeText('1', 'hello world');
    await vm.storeText('2', 'greeting message');
    await vm.storeText('3', 'unrelated content');

    const results = await vm.searchText('greetings', 2);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('2');  // Most similar
  });

  it('should filter by CSL threshold', async () => {
    const results = await vm.searchText('query', 10, CSL_THRESHOLDS.HIGH);
    results.forEach(r => {
      expect(r.score).toBeGreaterThanOrEqual(CSL_THRESHOLDS.HIGH);
    });
  });
});
```

### Task 5.2: VSA Operation Tests
- [ ] Test binding correctness
- [ ] Test bundling correctness
- [ ] Test permutation invertibility
- [ ] Validate against Torchhd test vectors

**Test Cases:**
```javascript
describe('VSA Operations', () => {
  const vsa = new VSAEngine(10000);

  it('should bind vectors dissimilarly', () => {
    const a = randomHypervector(10000);
    const b = randomHypervector(10000);
    const bound = vsa.bind(a, b);

    expect(vsa.similarity(bound, a)).toBeLessThan(0.2);
    expect(vsa.similarity(bound, b)).toBeLessThan(0.2);
  });

  it('should bundle vectors similarly', () => {
    const a = randomHypervector(10000);
    const b = randomHypervector(10000);
    const bundled = vsa.bundle(a, b);

    expect(vsa.similarity(bundled, a)).toBeGreaterThan(0.5);
    expect(vsa.similarity(bundled, b)).toBeGreaterThan(0.5);
  });

  it('should have invertible permutation', () => {
    const a = randomHypervector(10000);
    const permuted = vsa.permute(a, 5);
    const restored = vsa.permute(permuted, -5);

    expect(vsa.similarity(a, restored)).toBeGreaterThan(0.99);
  });
});
```

### Task 5.3: Shadow Memory Tests
- [ ] Test decay over sessions
- [ ] Test reinforcement resets decay
- [ ] Test consolidation reduces count
- [ ] Test DuckDB persistence

**Test Cases:**
```javascript
describe('Shadow Memory', () => {
  it('should decay confidence over sessions', async () => {
    const sm = new ShadowMemory(db);
    await sm.store('1', vector, {}, 1.0);

    // Simulate 3 sessions without access
    await sm.decayAll();
    await sm.decayAll();
    await sm.decayAll();

    const entry = await sm.get('1');
    expect(entry.confidence).toBeCloseTo(Math.pow(PSI, 3), 2);
  });

  it('should reinforce on access', async () => {
    await sm.store('1', vector, {}, 1.0);
    await sm.decayAll();
    await sm.reinforce('1');

    const entry = await sm.get('1');
    expect(entry.sessions).toBe(0);
  });
});
```

### Task 5.4: Integration Tests
- [ ] Test full memory lifecycle
- [ ] Test cross-session continuity
- [ ] Test CSL threshold consistency
- [ ] Test Memory Bee consolidation

### Task 5.5: Performance Benchmarks
- [ ] Measure query latency (target: <50ms for 10K entries)
- [ ] Measure consolidation time
- [ ] Measure DuckDB index performance
- [ ] Profile memory usage

---

## Implementation Sequence

**Week 1:**
- ✅ Priority 1: Core Vector Memory (Tasks 1.1-1.3)
- ✅ Priority 5.1: Basic memory search tests

**Week 2:**
- ✅ Priority 2: VSA Operations (Tasks 2.1-2.2)
- ✅ Priority 5.2: VSA operation tests

**Week 3:**
- ✅ Priority 3: Shadow Memory (Tasks 3.1-3.3)
- ✅ Priority 5.3: Shadow memory tests

**Week 4:**
- ✅ Priority 4: Memory Bees (Task 4.1)
- ✅ Priority 5.4-5.5: Integration tests and benchmarks

---

## Dependencies

**Node.js Packages:**
- `duckdb` - DuckDB Node.js bindings
- `@stdlib/array-float64` - Typed array utilities
- `crypto` - SHA-256 hashing
- `chai` / `jest` - Testing frameworks

**External Resources:**
- Torchhd test vectors (for validation)
- Sentence-Transformers embedding service
- DuckDB VSS extension

---

## Success Metrics

- [ ] All unit tests passing (>95% coverage)
- [ ] Query latency <50ms for 10K entries
- [ ] CSL filtering reduces noise by >30%
- [ ] Shadow memory consolidation reduces count by 20-40%
- [ ] Memory Bees run on Fibonacci-timed schedule
- [ ] DuckDB persistence maintains data across restarts

---

**Next Steps:**
1. Review this checklist with team
2. Assign tasks to developers
3. Set up test infrastructure
4. Begin Priority 1 implementation

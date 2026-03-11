# Heady™ VSA Test Matrix

## Test Coverage Map

| Module | Unit Tests | Integration Tests | Performance Tests | Status |
|--------|------------|-------------------|-------------------|--------|
| Vector Memory Core | ✅ Required | ✅ Required | ✅ Required | 🔴 Not Started |
| VSA Operations | ✅ Required | ✅ Required | ✅ Required | 🔴 Not Started |
| Shadow Memory | ✅ Required | ✅ Required | ✅ Required | 🔴 Not Started |
| Memory Bees | ✅ Required | ✅ Required | ⚠️ Optional | 🔴 Not Started |
| DuckDB Integration | ✅ Required | ✅ Required | ✅ Required | 🔴 Not Started |
| CSL Gating | ✅ Required | ✅ Required | ⚠️ Optional | 🔴 Not Started |

## Unit Test Cases

### Vector Memory Core

```javascript
describe('VectorMemory', () => {
  describe('store()', () => {
    it('should store vector with metadata');
    it('should generate unique IDs');
    it('should enforce dimension constraints');
    it('should trigger eviction when over capacity');
    it('should return memory receipt');
  });

  describe('search()', () => {
    it('should return top-k similar vectors');
    it('should apply CSL threshold');
    it('should handle empty results gracefully');
    it('should respect metadata filters');
  });

  describe('eviction', () => {
    it('should use phi-weighted scoring');
    it('should preserve high-importance entries');
    it('should respect LRU order');
    it('should maintain capacity limits');
  });
});
```

### VSA Operations

```javascript
describe('VSAEngine', () => {
  describe('bind()', () => {
    it('should produce dissimilar output');
    it('should be commutative');
    it('should be invertible with second bind');
    it('should handle 10000-dim vectors');
  });

  describe('bundle()', () => {
    it('should produce similar output');
    it('should be commutative');
    it('should allow recovery of constituents');
    it('should handle variable argument count');
  });

  describe('permute()', () => {
    it('should produce dissimilar output');
    it('should be invertible');
    it('should handle negative shifts');
    it('should preserve vector norm');
  });

  describe('similarity()', () => {
    it('should return 1 for identical vectors');
    it('should return 0 for orthogonal vectors');
    it('should apply CSL threshold');
    it('should handle edge cases (zero vectors)');
  });
});
```

### Shadow Memory

```javascript
describe('ShadowMemory', () => {
  describe('decay', () => {
    it('should decay by PSI per session');
    it('should reset on reinforce()');
    it('should never decay below 0');
    it('should preserve high-confidence entries');
  });

  describe('consolidation', () => {
    it('should reduce memory count');
    it('should preserve semantic similarity');
    it('should use VSA bundling');
    it('should log consolidation metrics');
  });

  describe('DuckDB persistence', () => {
    it('should store and retrieve vectors');
    it('should maintain metadata integrity');
    it('should use HNSW index for search');
    it('should handle concurrent access');
  });
});
```

## Integration Test Scenarios

### End-to-End Memory Lifecycle

```javascript
describe('Memory Lifecycle Integration', () => {
  it('should store, search, and retrieve memories', async () => {
    // 1. Store multiple memories
    await vm.storeText('user-1', 'Hello, how are you?');
    await vm.storeText('user-2', 'What is the weather?');
    await vm.storeText('user-3', 'Tell me a joke');

    // 2. Search with CSL threshold
    const results = await vm.searchText('greeting', 5, CSL_THRESHOLDS.LOW);

    // 3. Verify retrieval quality
    expect(results[0].id).toBe('user-1');
    expect(results[0].score).toBeGreaterThan(0.7);
  });

  it('should persist across sessions', async () => {
    // Session 1: Store memories
    const vm1 = new VectorMemory({ persistence: duckdb });
    await vm1.storeText('persistent-1', 'Important memory');
    await vm1.close();

    // Session 2: Retrieve memories
    const vm2 = new VectorMemory({ persistence: duckdb });
    const results = await vm2.searchText('important', 1);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('persistent-1');
  });

  it('should apply decay over multiple sessions', async () => {
    // Store memory
    await sm.store('decay-test', vector, {}, 1.0);

    // Simulate 5 sessions
    for (let i = 0; i < 5; i++) {
      await sm.decayAll();
    }

    // Verify decay
    const entry = await sm.get('decay-test');
    expect(entry.confidence).toBeCloseTo(Math.pow(PSI, 5), 2);
  });
});
```

### VSA + Memory Integration

```javascript
describe('VSA Memory Integration', () => {
  it('should encode facts with VSA binding', async () => {
    const vsa = new VSAEngine(10000);
    const vm = new VectorMemory({ dimensions: 10000, vsa });

    // Encode: "capital of France is Paris"
    const capitalOf = vsa.atom('CAPITAL_OF');
    const france = vsa.atom('FRANCE');
    const paris = vsa.atom('PARIS');
    const fact = vsa.bind(capitalOf, france, paris);

    await vm.store('fact-1', fact, { type: 'fact' });

    // Query: "capital of France"
    const query = vsa.bind(capitalOf, france);
    const results = await vm.search(query, 1);

    expect(results[0].id).toBe('fact-1');
  });
});
```

## Performance Test Targets

### Query Latency

```javascript
describe('Performance: Query Latency', () => {
  it('should query <50ms for 10K entries', async () => {
    const vm = new VectorMemory({ capacity: 10000 });

    // Populate with 10K entries
    for (let i = 0; i < 10000; i++) {
      await vm.storeText(`entry-${i}`, `Sample text ${i}`);
    }

    // Benchmark queries
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await vm.searchText('sample query', 10);
    }
    const elapsed = Date.now() - start;
    const avgLatency = elapsed / 100;

    expect(avgLatency).toBeLessThan(50);  // <50ms target
  });
});
```

### Consolidation Performance

```javascript
describe('Performance: Consolidation', () => {
  it('should consolidate 1000 entries in <5s', async () => {
    const bee = new MemoryBee(vm, sm, vsa);

    // Populate
    for (let i = 0; i < 1000; i++) {
      await vm.storeText(`entry-${i}`, `Sample ${i}`);
    }

    // Benchmark consolidation
    const start = Date.now();
    await bee.consolidate();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);  // <5s target
  });
});
```

### Memory Usage

```javascript
describe('Performance: Memory Usage', () => {
  it('should stay under 500MB for 10K 384-dim vectors', () => {
    const vm = new VectorMemory({ capacity: 10000, dimensions: 384 });

    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10000; i++) {
      const vec = new Float64Array(384);
      for (let j = 0; j < 384; j++) vec[j] = Math.random();
      vm.store(`entry-${i}`, vec, {});
    }

    const after = process.memoryUsage().heapUsed;
    const used = (after - before) / 1024 / 1024;  // MB

    expect(used).toBeLessThan(500);  // <500MB target
  });
});
```

## Validation Test Data

### Torchhd Test Vectors

Use Torchhd to generate golden test vectors:

```python
import torchhd
import json

# Generate test vectors
a = torchhd.random(1, 10000)
b = torchhd.random(1, 10000)

# Compute operations
bound = torchhd.bind(a, b)
bundled = torchhd.bundle(a, b)
permuted = torchhd.permute(a, shifts=5)
similarity = torchhd.cosine_similarity(a, b)

# Export to JSON
test_data = {
    'a': a.tolist(),
    'b': b.tolist(),
    'bound': bound.tolist(),
    'bundled': bundled.tolist(),
    'permuted': permuted.tolist(),
    'similarity': float(similarity)
}

with open('torchhd-test-vectors.json', 'w') as f:
    json.dump(test_data, f)
```

Then validate JavaScript implementation:

```javascript
describe('VSA Validation against Torchhd', () => {
  const testData = require('./torchhd-test-vectors.json');

  it('should match Torchhd binding', () => {
    const vsa = new VSAEngine(10000);
    const a = new Float64Array(testData.a);
    const b = new Float64Array(testData.b);
    const bound = vsa.bind(a, b);

    const expected = new Float64Array(testData.bound);
    const similarity = vsa.similarity(bound, expected);

    expect(similarity).toBeGreaterThan(0.99);  // Very close match
  });
});
```

## Test Execution Plan

### Phase 1: Unit Tests (Week 1-2)
- Implement all unit tests for core modules
- Achieve >90% code coverage
- Set up CI/CD test automation

### Phase 2: Integration Tests (Week 3)
- Implement end-to-end scenarios
- Test cross-module interactions
- Validate DuckDB persistence

### Phase 3: Performance Tests (Week 4)
- Run latency benchmarks
- Profile memory usage
- Optimize hot paths

### Phase 4: Validation (Week 4)
- Generate Torchhd test vectors
- Validate VSA operations
- Document accuracy metrics

## Success Criteria

- [ ] All unit tests passing
- [ ] Integration tests covering all user flows
- [ ] Query latency <50ms for 10K entries
- [ ] Memory usage <500MB for 10K entries
- [ ] VSA operations match Torchhd within 0.01 similarity
- [ ] CSL filtering reduces noise by >30%
- [ ] Shadow memory consolidation reduces count by 20-40%

---

**Testing Tools:**
- Jest or Mocha for test runner
- Chai for assertions
- nyc for coverage reporting
- clinic.js for performance profiling

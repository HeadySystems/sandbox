# VSA Benchmark Targets

## Performance Targets (from research)

### Torchhd Baseline Performance

**Hardware:** NVIDIA A100 GPU

| Operation | Dimension | Time (ms) | Throughput |
|-----------|-----------|-----------|------------|
| Bind | 10,000 | 0.05 | 20K ops/sec |
| Bundle (10 vectors) | 10,000 | 0.12 | 8.3K ops/sec |
| Permute | 10,000 | 0.03 | 33K ops/sec |
| Similarity | 10,000 | 0.02 | 50K ops/sec |

**Hardware:** CPU (Intel Xeon)

| Operation | Dimension | Time (ms) | Throughput |
|-----------|-----------|-----------|------------|
| Bind | 10,000 | 2.1 | 476 ops/sec |
| Bundle (10 vectors) | 10,000 | 5.8 | 172 ops/sec |
| Permute | 10,000 | 1.3 | 769 ops/sec |
| Similarity | 10,000 | 0.8 | 1250 ops/sec |

### Heady™ Node.js Target Performance

**Target Hardware:** Modern CPU (Node.js single-threaded)

| Operation | Dimension | Target Time (ms) | Notes |
|-----------|-----------|------------------|-------|
| Bind | 10,000 | <5 | ~10× slower than Torchhd CPU |
| Bundle (10 vectors) | 10,000 | <10 | Acceptable for agent memory |
| Permute | 10,000 | <3 | Simple array shift |
| Similarity | 10,000 | <2 | Critical path |

**Critical Path:** Query latency = Embed(50ms) + Search(10ms) + Similarity(2ms) = ~62ms total

## Memory Search Benchmarks

### Vector Memory (384-dim embeddings)

| Dataset Size | Index Type | Query Time | Recall@10 |
|--------------|------------|------------|-----------|
| 1K entries | Brute force | <5ms | 100% |
| 10K entries | Brute force | <50ms | 100% |
| 100K entries | HNSW | <20ms | 95% |
| 1M entries | HNSW | <30ms | 92% |

### Shadow Memory (10,000-dim VSA)

| Dataset Size | Index Type | Query Time | Recall@10 |
|--------------|------------|------------|-----------|
| 1K entries | Brute force | <10ms | 100% |
| 10K entries | HNSW | <40ms | 98% |
| 100K entries | HNSW | <60ms | 95% |

## Accuracy Targets

### VSA Operation Validation

Compare against Torchhd golden test vectors:

| Operation | Cosine Similarity Threshold | Pass Criteria |
|-----------|----------------------------|---------------|
| Bind | >0.99 | Matches within 0.01 |
| Bundle | >0.99 | Matches within 0.01 |
| Permute | >0.999 | Exact match expected |
| Similarity | ±0.001 | Numerical precision |

### CSL Gating Effectiveness

| Threshold | Expected Noise Reduction | Use Case |
|-----------|-------------------------|----------|
| DEDUP (0.951) | 95% | Duplicate detection |
| HIGH (0.882) | 70% | High-confidence retrieval |
| MEDIUM (0.764) | 50% | Standard search |
| LOW (0.618) | 30% | Exploratory search |

## Memory Consolidation Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Reduction ratio | 20-40% | Depends on similarity |
| Consolidation time | <5s per 1K entries | Background process |
| Information loss | <5% | Measured by retrieval accuracy |

## DuckDB VSS Performance

### HNSW Index Build Time

| Vector Count | Dimension | Build Time | Notes |
|--------------|-----------|------------|-------|
| 10K | 384 | ~2s | Fast for embeddings |
| 10K | 10000 | ~8s | Slower for VSA |
| 100K | 384 | ~25s | Still acceptable |
| 100K | 10000 | ~120s | Background build |

### HNSW Query Performance

| Vector Count | Dimension | ef_search | Query Time | Recall@10 |
|--------------|-----------|-----------|------------|-----------|
| 10K | 384 | 32 | <10ms | 92% |
| 10K | 384 | 64 | <15ms | 96% |
| 100K | 10000 | 64 | <40ms | 94% |
| 100K | 10000 | 128 | <60ms | 97% |

## Test Data Generation

### Generate Torchhd Test Vectors

```python
import torchhd
import json
import numpy as np

def generate_test_vectors(dim=10000, num_pairs=10):
    test_data = []

    for i in range(num_pairs):
        a = torchhd.random(1, dim, dtype=torch.float32)
        b = torchhd.random(1, dim, dtype=torch.float32)

        bound = torchhd.bind(a, b)
        bundled = torchhd.bundle(a, b)
        permuted = torchhd.permute(a, shifts=5)
        similarity = float(torchhd.cosine_similarity(a, b))

        test_data.append({
            'id': i,
            'a': a.squeeze().tolist(),
            'b': b.squeeze().tolist(),
            'bound': bound.squeeze().tolist(),
            'bundled': bundled.squeeze().tolist(),
            'permuted': permuted.squeeze().tolist(),
            'similarity': similarity
        })

    with open('torchhd-test-vectors.json', 'w') as f:
        json.dump(test_data, f)

    print(f"Generated {num_pairs} test vector pairs")

generate_test_vectors()
```

## References

- Torchhd paper: "An Open Source Python Library to Support Research on HDC and VSA"
- DuckDB VSS benchmarks: https://duckdb.org/docs/extensions/vss.html
- HNSW paper: "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs"

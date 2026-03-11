# DuckDB VSS Extension Semantics

## Overview

DuckDB's Vector Similarity Search (VSS) extension provides HNSW indexing for approximate nearest neighbor search on fixed-size array columns.

## Key Semantic Changes (October 2024 Update)

### Distance Functions (Not Similarity!)

**IMPORTANT:** VSS extension uses **distance** functions (lower is better) instead of similarity (higher is better).

```sql
-- CORRECT: Distance functions
array_cosine_distance(a, b)        -- Returns 1 - cosine_similarity
array_negative_inner_product(a, b) -- Returns -inner_product
array_l2sq_distance(a, b)          -- Returns squared L2 distance

-- INCORRECT: Similarity functions (not accelerated by HNSW)
array_cosine_similarity(a, b)      -- Returns 1 when identical (confusing!)
array_inner_product(a, b)          -- Higher is better
```

### Operator Semantics

```sql
-- <=> operator is now an alias for array_cosine_distance
SELECT * FROM items
ORDER BY embedding <=> query_embedding
LIMIT 10;

-- Equivalent to:
SELECT * FROM items
ORDER BY array_cosine_distance(embedding, query_embedding)
LIMIT 10;
```

## Creating HNSW Index

```sql
-- Install and load VSS extension
INSTALL vss;
LOAD vss;

-- Create table with fixed-size array column
CREATE TABLE vector_memories (
    id VARCHAR PRIMARY KEY,
    embedding FLOAT[384],          -- Fixed size required for HNSW
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create HNSW index on embedding column
CREATE INDEX vec_idx ON vector_memories
USING HNSW (embedding)
WITH (metric = 'cosine');

-- Alternative metrics: 'ip' (inner product), 'l2sq' (squared L2)
```

## Query Patterns That Use HNSW Index

### Pattern 1: ORDER BY + LIMIT (Top-K)

```sql
-- This uses HNSW index for fast approximate search
SELECT id, array_cosine_distance(embedding, ?) AS distance
FROM vector_memories
ORDER BY distance
LIMIT 10;
```

### Pattern 2: Top-K Aggregates

```sql
-- New in October 2024: min_by/max_by aggregates use HNSW
SELECT min_by(id, array_cosine_distance(embedding, ?), 10) AS top_10
FROM vector_memories;
```

### Pattern 3: Lateral Join for Multiple Queries

```sql
-- Find top 5 matches for each query
SELECT queries.id, matches.item_id, matches.distance
FROM queries, LATERAL (
    SELECT id AS item_id, array_cosine_distance(items.embedding, queries.embedding) AS distance
    FROM items
    ORDER BY distance
    LIMIT 5
)  matches;
```

## Patterns That DON'T Use HNSW Index

```sql
-- ❌ Similarity function (not distance)
SELECT * FROM items
ORDER BY array_cosine_similarity(embedding, ?)
LIMIT 10;

-- ❌ Filter before ORDER BY (forces full scan)
SELECT * FROM items
WHERE category = 'tech'
ORDER BY embedding <=> ?
LIMIT 10;

-- ✅ CORRECT: ORDER BY first, then filter
SELECT * FROM (
    SELECT * FROM items
    ORDER BY embedding <=> ?
    LIMIT 100
) WHERE category = 'tech'
LIMIT 10;
```

## Heady™ Integration Pattern

```javascript
class DuckDBVectorStore {
  async searchSimilar(queryEmbedding, k = 10, threshold = 0.618) {
    // Convert similarity threshold to distance threshold
    const distanceThreshold = 1 - threshold;  // cosine distance = 1 - cosine similarity

    // Query using distance function
    const sql = `
      SELECT 
        id,
        metadata,
        array_cosine_distance(embedding, ?::FLOAT[384]) AS distance,
        (1 - array_cosine_distance(embedding, ?::FLOAT[384])) AS similarity
      FROM vector_memories
      ORDER BY distance
      LIMIT ?
    `;

    const results = await this.db.all(sql, [
      JSON.stringify(Array.from(queryEmbedding)),
      JSON.stringify(Array.from(queryEmbedding)),
      k * 2  // Over-retrieve for threshold filtering
    ]);

    // Filter by similarity threshold (CSL gating)
    return results
      .filter(r => r.similarity >= threshold)
      .slice(0, k);
  }
}
```

## Index Configuration

```sql
-- HNSW parameters (set at index creation)
CREATE INDEX vec_idx ON vector_memories
USING HNSW (embedding)
WITH (
    metric = 'cosine',     -- Distance metric
    M = 16,                -- Max connections per node (default)
    ef_construction = 128  -- Build-time search depth
);

-- Runtime search parameter (set per query)
SET hnsw.ef_search = 64;  -- Query-time search depth
```

## DuckDB VSS vs pgvector Comparison

| Feature | DuckDB VSS | pgvector |
|---------|------------|----------|
| Runtime | Embedded (in-process) | Client-server |
| Persistence | File-based | PostgreSQL DB |
| HNSW Support | ✅ Yes | ✅ Yes |
| IVFFlat Support | ❌ No | ✅ Yes |
| Distance Functions | cosine, ip, l2sq | cosine, ip, l2 |
| Quantization | ❌ Not yet | ✅ halfvec, binary |
| Max Vector Size | ~10,000 dim | ~16,000 dim |

## Best Practices for Heady™

1. **Always use distance functions** (not similarity) in ORDER BY
2. **Set hnsw.ef_search** based on recall needs (32-128 typical)
3. **Over-retrieve and filter** to implement CSL threshold gating
4. **Use LATERAL joins** for multi-query batch retrieval
5. **Create separate indexes** for different embedding types (384-dim vs 10000-dim)

## References

- DuckDB VSS docs: https://duckdb.org/docs/extensions/vss.html
- "What's New in the VSS Extension": https://duckdb.org/2024/10/23/whats-new-in-the-vss-extension.html
- Your spec: src/intelligence/duckdb-memory.js section

---
name: heady-vector-projection
description: Use when working with the vector projection engine, vector serving, vector pipelines, or 3D spatial computing in the Heady™ ecosystem. Keywords include vector projection, vector serve, vector pipeline, 3D spatial, projection engine, vector template, spatial computing, and vector operations.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Vector Projection Engine

## When to Use This Skill

Use this skill when the user needs to:
- Configure the vector projection engine
- Set up vector serving for real-time queries
- Build vector processing pipelines
- Implement 3D spatial computing operations
- Manage vector templates and projections

## Module Map

| Module | Path | Role |
|---|---|---|
| vector-projection-engine | src/vector-projection-engine.js | Core projection engine |
| vector-pipeline | src/vector-pipeline.js | Vector processing pipeline |
| vector-serve | src/vector-serve.js | Real-time vector serving |
| vector-template-engine | src/vector-template-engine.js | Template-based vector generation |
| vector-federation | src/vector-federation.js | Cross-node vector replication |
| vector-space-ops | src/vector-space-ops.js | Vector space operations |

## Instructions

### Vector Projection Engine
1. Projects high-dimensional vectors into meaningful 3D representations.
2. Projection methods: PCA, t-SNE, UMAP with phi-scaled parameters.
3. Autonomous projection: auto-selects best method per data distribution.
4. Real-time updates: streaming projection as new vectors arrive.
5. Sacred Geometry alignment: projected coordinates snap to geometric patterns.

### Projection Parameters
```javascript
const projectionConfig = {
  method: 'umap',        // 'pca', 'tsne', 'umap'
  dimensions: 3,          // Target dimensions
  neighbors: 13,          // Fibonacci
  minDist: 0.382,        // Phi ratio
  spread: 1.618,         // Phi
  metric: 'cosine',
  batchSize: 89,         // Fibonacci
};
```

### Vector Pipeline
1. Ingest: accept vectors from any source (API, batch, stream).
2. Validate: dimension check, NaN detection, normalization.
3. Transform: project, cluster, index.
4. Store: pgvector with HNSW index.
5. Serve: real-time query via vector-serve.js.

### Vector Serving
- Low-latency similarity search (< 8ms target).
- HNSW index with phi-scaled ef_search (89, 144, 233).
- Batch queries with Fibonacci-sized batches.
- Result re-ranking using CSL scoring.
- Federation: query across distributed vector stores.

### Repo Projection Pattern
The autonomous projection pattern projects code from the monorepo into domain-specific repos:
- Source: Heady-pre-production-9f2f0642 (monorepo)
- Targets: 9 core repos (headyme-core, headybuddy-core, etc.)
- Sync: sync-projection-bee manages projection synchronization
- Manifest: projection-manifest-generator.js creates projection maps

## Output Format

- Projection Configuration
- Pipeline Status
- Query Latency Metrics
- Vector Store Statistics
- Projection Map

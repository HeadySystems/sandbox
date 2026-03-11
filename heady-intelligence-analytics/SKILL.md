---
name: heady-intelligence-analytics
description: Use when working with DuckDB-based memory analytics, predictive caching engines, unified context management, proof-of-view receipt systems, or provider usage tracking in the Heady™ ecosystem. Keywords include DuckDB, analytics, predictive cache, unified context, proof of view, receipts, usage tracking, provider analytics, intelligence, and data-driven.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Intelligence & Analytics

## When to Use This Skill

Use this skill when the user needs to:
- Query memory analytics using DuckDB
- Configure predictive caching for performance optimization
- Manage unified context across agents and sessions
- Implement proof-of-view receipt tracking
- Monitor and analyze provider usage patterns

## Module Map

| Module | Path | Role |
|---|---|---|
| duckdb-memory | src/intelligence/duckdb-memory.js | DuckDB-powered memory analytics |
| predictive-cache | src/intelligence/predictive-cache.js | Predictive prefetching and caching |
| unified-context | src/intelligence/unified-context.js | Cross-agent context unification |
| proof-view-receipts | src/telemetry/proof-view-receipts.js | Proof-of-view tracking system |
| provider-usage-tracker | src/telemetry/provider-usage-tracker.js | Provider API usage analytics |

## Instructions

### DuckDB Memory Analytics
1. DuckDB provides SQL analytics over the vector memory store.
2. Query patterns: similarity search results, embedding distributions, cluster analysis.
3. Materialized views for frequently-accessed aggregations.
4. Time-series analysis of memory access patterns.
5. Export analytics to the compute-dashboard for visualization.

```sql
-- Example: Top accessed memory clusters in last 24h
SELECT cluster_id, COUNT(*) as access_count,
       AVG(similarity_score) as avg_relevance
FROM memory_accesses
WHERE accessed_at > NOW() - INTERVAL '24 hours'
GROUP BY cluster_id
ORDER BY access_count DESC
LIMIT 13; -- Fibonacci
```

### Predictive Cache
1. Uses access patterns to prefetch likely-needed data.
2. Cache tiers: L1 (in-memory, 8ms), L2 (Redis, 21ms), L3 (PostgreSQL, 89ms).
3. Prediction model: phi-weighted recency + frequency scoring.
4. Cache sizes follow Fibonacci: L1=89 items, L2=233, L3=610.
5. Eviction: phi-weighted LRU (recency * PHI + frequency).

### Unified Context Management
1. Aggregates context from all active agents into a coherent view.
2. Context layers: working (current task), session (conversation), persistent (memory).
3. Conflict resolution: most recent wins, with phi-weighted merge for overlaps.
4. Context capsules enable inter-agent context transfer.
5. Token budget tracking ensures context fits model windows.

### Proof-of-View Receipts
1. Every content view generates a cryptographic receipt.
2. Receipt = hash(content_id + user_id + timestamp + nonce).
3. Receipts anchor to the Heady™Coin ledger for verification.
4. Use cases: content attribution, usage billing, audit trails.
5. Batch receipts into Merkle trees for efficient verification.

### Provider Usage Analytics
1. Track API calls, tokens, latency, and cost per provider.
2. Dashboard metrics: calls/minute, p50/p95 latency, cost/1K tokens.
3. Alerting: anomaly detection on usage spikes.
4. Budget enforcement: automatic throttling at phi-ratio thresholds.
5. Historical trending for capacity planning.

## Output Format

- Analytics Query Results
- Cache Hit Rate Report
- Context State Summary
- Receipt Verification Status
- Provider Usage Dashboard

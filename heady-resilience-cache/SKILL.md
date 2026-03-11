---
name: heady-resilience-cache
description: Use when implementing advanced caching strategies, retry logic with backoff, hot-cold cache patterns, auto-tuning connection pools, or cache optimization in the Heady™ ecosystem. Keywords include cache, caching, retry, hot-cold, auto-tuning, pool, connection pool, LRU, cache strategy, and resilience cache.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Resilience & Cache Patterns

## When to Use This Skill

Use this skill when the user needs to:
- Implement multi-tier caching strategies
- Configure retry logic with phi-backoff
- Set up hot-cold cache patterns
- Auto-tune connection pools
- Optimize cache hit rates

## Module Map

| Module | Path | Role |
|---|---|---|
| cache | src/resilience/cache.js | Multi-tier caching engine |
| retry | src/resilience/retry.js | Retry with configurable backoff |
| hot-cold-cache | src/patterns/hot-cold-cache.js | Temperature-based cache tiers |
| auto-tuning-pool | src/patterns/auto-tuning-pool.js | Self-tuning connection pools |

## Instructions

### Multi-Tier Cache Architecture
| Tier | Store | TTL | Size | Latency |
|---|---|---|---|---|
| L1 (Hot) | In-memory Map | 89s | 89 items | < 1ms |
| L2 (Warm) | Redis | 610s | 233 items | < 5ms |
| L3 (Cold) | PostgreSQL | 2584s | 610 items | < 21ms |

All sizes and TTLs are Fibonacci numbers.

### Hot-Cold Cache Pattern
1. New entries start in L1 (hot).
2. Entries cool to L2 after TTL expiry or eviction.
3. L2 entries cool to L3 on same pattern.
4. Access promotes entry back to L1 (warming).
5. Eviction uses phi-weighted scoring: score = recency * PHI + frequency.

### Retry Logic
```javascript
const retryConfig = {
  maxRetries: 8,           // Fibonacci
  baseDelay: 89,           // ms, Fibonacci
  maxDelay: 2584,          // ms, Fibonacci
  backoffFactor: 1.618,    // Phi
  jitter: 0.382,           // Phi ratio
  retryableErrors: [429, 500, 502, 503, 504],
};
```
- Delay = min(baseDelay * PHI^attempt + jitter, maxDelay)
- Circuit breaker integration: stop retrying if circuit opens.
- Idempotency keys for safe retry of mutations.

### Auto-Tuning Connection Pool
1. Pool sizes auto-adjust based on utilization.
2. Min connections: 5 (Fibonacci), Max: 34 (Fibonacci).
3. Scale up when utilization > 0.618 (phi ratio).
4. Scale down when utilization < 0.382 (phi ratio).
5. Health checks: ping every 8 seconds (Fibonacci).
6. Idle timeout: 89 seconds (Fibonacci).

### Cache Invalidation
- TTL-based expiry (primary strategy).
- Event-driven invalidation via event-stream.
- Tag-based bulk invalidation.
- Write-through for consistency-critical data.
- Cache-aside for read-heavy workloads.

## Output Format

- Cache Hit Rate Report
- Pool Utilization Metrics
- Retry Statistics
- Tier Distribution
- Optimization Recommendations

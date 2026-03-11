---
title: "Law 06: Ten-Thousand Bee Scale"
domain: unbreakable-law
law_number: 6
semantic_tags: [scale, bee-workers, fibonacci-pool, backpressure, connection-pooling, golden-ratio-scaling, o-log-n]
enforcement: MANDATORY
---

# LAW 6: TEN-THOUSAND BEE SCALE — THE SWARM MUST NOT FALTER

The Heady™ system is architected to support **10,000 concurrent bee workers** without performance
degradation. Scale is not a future concern — it is a present design constraint. Every data
structure, algorithm, queue, and connection pool must be chosen and sized with this ceiling in
mind. The swarm operates on Fibonacci-stepped pool sizes and golden-ratio-derived scale triggers,
ensuring organic, mathematically coherent growth under load.

## Bee Pool Architecture

Bee pools are sized exclusively using Fibonacci steps. No arbitrary pool sizes are permitted:

| Pool Tier | Bee Count | Use Case |
|-----------|-----------|---------|
| Micro swarm | fib(5) = 5 | Single-task burst |
| Small swarm | fib(6) = 8 | Feature-scope work |
| Standard swarm | fib(7) = 13 | Module-level tasks |
| Medium swarm | fib(8) = 21 | Service-level orchestration |
| Large swarm | fib(9) = 34 | Cross-service coordination |
| Cluster swarm | fib(10) = 55 | Domain-wide parallelism |
| Mega swarm | fib(11) = 89 | Full-system operations |

Maximum swarm size per deployment: **10,000 bees**, achieved by composing nested Fibonacci swarms.

## Scale-Up and Scale-Down Triggers

Scale-up and scale-down decisions are governed by the golden ratio to prevent oscillation:

**Scale-up trigger**: queue depth > current pool size × φ (1.6180339887)
- When the queue is growing faster than the swarm can process it, add the next Fibonacci tier

**Scale-down trigger**: idle bees > current pool size × ψ² (0.3819660113) for more than 60 seconds
- ψ² = (1 - 1/φ) ≈ 0.382; idle fraction above this threshold indicates over-provisioning
- Scale-down removes exactly one Fibonacci tier (step back in the sequence)

**Stale bee detection**: any bee with no heartbeat for 60 seconds is marked dead and respawned
- Heartbeat interval: fib(6) = 8 seconds
- Dead bee detection window: fib(8) = 21 heartbeat cycles ≈ 168 seconds maximum
- Actual detection SLA: 60 seconds (first missed heartbeat threshold)

## Algorithm Complexity Requirements

All data structures and algorithms on hot paths must meet:

| Operation | Maximum Complexity |
|-----------|-------------------|
| Lookup | O(log n) or better |
| Insert | O(log n) or better |
| Delete | O(log n) or better |
| Scan/aggregate (cold path only) | O(n) permitted |
| Hot path traversal | O(n²) is an absolute violation |

O(n²) or worse algorithms in hot paths are LAW-06 violations detected by the Performance
category of the Auto-Success Engine heartbeat (LAW-07 category 3).

## Backpressure Requirements

Every queue boundary in the system must have explicit backpressure:

- **Ingestion queues**: reject or buffer when depth > fib(13) = 233
- **Processing queues**: apply phi-backoff to producers when depth > pool size × φ
- **Output queues**: hold and retry with phi-backoff when downstream is unavailable
- **WebSocket connections**: flow-control applied when outbound buffer > fib(12) = 144 messages

No queue may grow unboundedly. Missing backpressure at a queue boundary is a critical architectural
violation requiring immediate remediation.

## Connection Pooling

All external service connections must use pooling:

| Service Type | Minimum Pool Size | Maximum Pool Size |
|-------------|-------------------|------------------|
| PostgreSQL / pgvector | fib(6) = 8 | fib(10) = 55 |
| Redis | fib(5) = 5 | fib(9) = 34 |
| External HTTP APIs | fib(5) = 5 | fib(8) = 21 |
| Internal service mesh | fib(7) = 13 | fib(11) = 89 |

Unpooled connections to external services are LAW-06 violations. Connection pool exhaustion must
trigger backpressure (queue and retry with phi-backoff), never a hard failure.

## Invariants

- **No O(n²) algorithms in hot paths** — detected by Performance heartbeat, blocks APPROVE stage
- **Fibonacci-stepped pool sizes only** — arbitrary pool sizes (e.g., 10, 50, 100) are violations
- **Scale-up trigger: queue depth > pool × φ (1.618)** — immutable ratio, not configurable
- **Scale-down trigger: idle fraction > ψ² (0.382) for > 60s** — immutable ratio
- **Stale bee detection within 60 seconds** of last heartbeat — dead bees respawned automatically
- **Backpressure at every queue boundary** — unbounded queue growth is an architectural violation
- **All external service connections pooled** — minimum fib(5)=5, maximum varies by service type
- **10,000 concurrent bees is the design ceiling** — any component that breaks before this limit must be flagged and remediated

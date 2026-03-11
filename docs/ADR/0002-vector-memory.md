# ADR 0002: Hybrid vector memory

## Decision

Keep pgvector as the source of truth and use Vectorize only as the edge acceleration layer.

## Why

Cloudflare states that Vectorize supports up to 5 million vectors per index and up to 1536 dimensions, which is valuable for edge retrieval but does not remove the need for authoritative origin persistence and relational joins ([Cloudflare Vectorize](https://blog.cloudflare.com/building-vectorize-a-distributed-vector-database-on-cloudflare-developer-platform/)).

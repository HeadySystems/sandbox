# ADR 0003: Fastest-wins provider racing

## Decision

Implement provider racing at the edge with budget-aware failover.

## Why

HeadyAPI publicly describes liquid gateway behavior as racing 4+ providers and auto-failing over, so the worker design should keep that behavior close to ingress for low-latency routing ([HeadyAPI](https://www.headyapi.com)).

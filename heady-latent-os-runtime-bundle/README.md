# Heady™OS latent runtime bundle

This bundle reframes the requested "backend runtime" as a latent OS runtime organized around vector-state transitions, spatial eventing, and cryptographic agent identity.

## Package map

- `@heady-ai/phi-math` — φ and Fibonacci scaling, CSL bands, vector helpers
- `@heady-ai/csl-router` — continuous semantic scoring, gating, and candidate ranking
- `@heady-ai/spatial-events` — octant-aware spatial event bus with replay buffers
- `@heady-ai/agent-identity` — signed agent identity, scoped workflow tokens, trust scoring
- `@heady-ai/memory-stream` — vector-native observe/reflect/plan memory stream
- `@heady-ai/observability-kernel` — workflow tracing, audit chains, neural-stream event logs
- `@heady-ai/latent-boundary` — external trust boundary for gateway, MCP, model routing, and connectors
- `@heady-ai/kernel` — unified runtime kernel for spawn, loop execution, pause, resume, and termination

## Architectural stance

- Internal coordination uses state transitions and spatial broadcast, not internal REST hops.
- MCP stays at the external boundary, consistent with the official MCP specification at [Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25).
- The memory loop preserves observe → reflect → plan from [Generative Agents](https://arxiv.org/abs/2304.03442), but stores vector-native records instead of text blobs.

## Included artifacts

- package-level TypeScript implementations
- unit and integration-style tests in each package
- boundary OpenAPI specification
- Cloud Run service config
- `MANIFEST.md`
- `SETUP_GUIDE.md`
- zip packaging script

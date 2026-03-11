# Section 05 — MCP Server, Tools & Transport: Academic References

## Model Context Protocol (MCP)

### Hugging Face MCP Course
- **Hugging Face (2025)** — "Model Context Protocol Course"
  - https://huggingface.co/learn/mcp-course/unit0/introduction
  - Comprehensive course: MCP fundamentals, architecture, core concepts, end-to-end use cases
  - Covers SSE transport, JSON-RPC, tool schemas, deployment

### MCP for Research
- **Hugging Face Blog (2025)** — "MCP for Research: How to Connect AI to Research Tools"
  - https://huggingface.co/blog/mcp-for-research
  - Standard for agentic models communicating with external tools and data sources

### What is MCP
- **Kseniase (2025)** — "What Is MCP, and Why Is Everyone Talking About It?"
  - https://huggingface.co/blog/Kseniase/mcp
  - Anthropic's open standard for bridging AI assistants with data and tools
  - Trending, passing LangChain, overcoming OpenAPI and CrewAI

### Using MCP with Local Models
- **Hugging Face MCP Course Unit 2** — "Using MCP with Local and Open Source Models"
  - https://huggingface.co/learn/mcp-course/unit2/continue-client
  - Tool calling as built-in feature: Codestral, Qwen, Llama 3.1x

## Tool Routing & Execution

### HaluGate Sentinel (Hugging Face Model)
- **llm-semantic-router/halugate-sentinel** — Prompt Fact-Check Switch for Hallucination Gatekeeper
  - https://huggingface.co/llm-semantic-router/halugate-sentinel
  - ModernBERT + LoRA classifier for LLM gateway routing: FACT_CHECK_NEEDED vs NO_FACT_CHECK_NEEDED
  - 96.4% validation accuracy, 100% on edge cases
  - Directly relevant to Heady's CSL-gated tool execution routing

### Self-Healing Tool Routing
- **HF Paper (2026)** — "Graph-Based Self-Healing Tool Routing for Cost-Efficient LLM Agents"
  - https://huggingface.co/papers/2603.01548
  - Parallel health monitors + cost-weighted tool graph + Dijkstra deterministic routing
  - Automatic recovery when tools fail mid-execution — maps to Heady's circuit breaker integration

### ShardMemo: Masked MoE Routing for Agent Memory
- **Zhao, Y. et al. (2026)** — "ShardMemo: Masked MoE Routing for Sharded Agentic LLM Memory"
  - arXiv:2601.21545 | Scope-before-routing: structured eligibility constraints mask ineligible shards
  - Masked MoE routing over eligible shards — relevant to Heady's CSL-gated tool registry

## Circuit Breaker & Resilience

### Microservices Architecture with Circuit Breakers
- **Babatunde, O. et al. (2024)** — "Building a microservices architecture model for enhanced software delivery"
  - DOI: 10.53294/ijfetr.2024.7.2.0050
  - Circuit breakers and service retries for resilience and high availability

### Microservice Reference Architecture
- **Söylemez, M. et al. (2023)** — "Microservice reference architecture design: A multi-case study"
  - Wiley Software: Practice and Experience | DOI: 10.1002/spe.3241
  - Reference architecture after comprehensive domain analysis

### C-Koordinator for Large-Scale Microservices
- **Wiley (2026)** — "C-Koordinator: Interference-Aware Management for Large-Scale Microservices"
  - DOI: 10.1002/spe.70059 | Optimizes co-location of microservices, AI, and big data workloads on Kubernetes

## Transport Layer

### JSON-RPC 2.0 Standard
- The MCP specification uses JSON-RPC 2.0 as its transport protocol
- SSE (Server-Sent Events) for streaming responses
- Heady's deterministic SSE with sequence numbers adds ordering guarantees on top

## Heady™ Integration Opportunity
- MCP is the dominant emerging standard for AI tool integration — Heady's unified MCP server approach is well-positioned
- CSL confidence gate on every tool invocation (confidence > φ⁻¹) adds a novel quality layer absent from standard MCP
- Circuit breaker integration via mcp-breaker.js aligns with microservices resilience best practices
- HaluGate Sentinel pattern validates the concept of routing classifiers before tool execution
- Self-healing tool routing (93% reduction in control-plane LLM calls) validates deterministic graph-based dispatch

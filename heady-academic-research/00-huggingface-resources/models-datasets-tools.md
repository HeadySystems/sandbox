# Hugging Face Resources for Heady™ Ecosystem

## Embedding Models (384D — Matching Heady's Embedding Space)

### sentence-transformers/all-MiniLM-L6-v2
- **URL**: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- **Dimensions**: 384 — exact match for Heady™'s 384D embedding space
- **Based on**: MiniLM-L6-H384-uncased, fine-tuned on 1B sentence pairs
- **Use**: Semantic search, clustering, similarity, paraphrase mining
- **Key**: This is the de facto standard for 384D embeddings

### sentence-transformers/msmarco-MiniLM-L12-v3
- **URL**: https://huggingface.co/sentence-transformers/msmarco-MiniLM-L12-v3
- **Dimensions**: 384 — optimized for information retrieval / semantic search

## LLM Gateway & Routing Models

### llm-semantic-router/halugate-sentinel
- **URL**: https://huggingface.co/llm-semantic-router/halugate-sentinel
- **Purpose**: Prompt-level fact-check switch for LLM gateway routing
- **Architecture**: ModernBERT + LoRA (rank=16, alpha=32)
- **Accuracy**: 96.4% validation, 100% edge cases
- **Labels**: FACT_CHECK_NEEDED / NO_FACT_CHECK_NEEDED
- **Heady Use**: Stage 0 in CSL security gate pipeline — route before tool execution

## Papers (Hugging Face Papers)

### Vector Symbolic Architectures
- **Capacity Analysis of VSAs**: https://huggingface.co/papers/2301.10352
- **Orthogonal Matrices for MBAT VSAs**: https://huggingface.co/papers/2202.04771

### Patent Analysis
- **Can AI Examine Novelty of Patents?**: https://huggingface.co/papers/2502.06316
- **PatentEdits**: https://huggingface.co/papers/2411.13477
- **PatentMatch**: https://huggingface.co/papers/2012.13919

### Multi-Agent Swarm
- **SwarmAgentic**: https://huggingface.co/papers/2506.15672
- **Multi-Agent Collection**: https://huggingface.co/collections/cschung7/multi-agent

### Tool Routing & Self-Healing
- **Graph-Based Self-Healing Tool Routing**: https://huggingface.co/papers/2603.01548

### Generative UI
- **UI Remix**: https://huggingface.co/papers/2601.18759
- **Generative UI Collection**: https://huggingface.co/collections/prasadt2/generative-ui

### Edge Inference
- **Small Thinking: Compact Reasoning Models for Edge**: https://huggingface.co/collections/mindchain/small-thinking-compact-reasoning-models-for-edge

### Feature Flow & Interpretability
- **Feature Flow via Cosine Similarity**: https://huggingface.co/papers/2502.03032

## MCP Course & Resources

### MCP Course
- **URL**: https://huggingface.co/learn/mcp-course/unit0/introduction
- **Topics**: MCP fundamentals, architecture, core concepts, hands-on implementations
- **Using Local Models**: https://huggingface.co/learn/mcp-course/unit2/continue-client

### MCP for Research
- **URL**: https://huggingface.co/blog/mcp-for-research
- Agentic models communicating with external tools and data sources

## Libraries & Tools

### hdlib: Python Library for VSA Design
- **URL**: https://joss.theoj.org/papers/10.21105/joss.05704
- **DOI**: 10.21105/joss.05704
- Open-source implementation of Vector Symbolic Architectures

### sentence-transformers Package
- **URL**: https://huggingface.co/sentence-transformers
- Standard library for generating sentence/text embeddings
- Supports all 384D models used in Heady's architecture

## Heady™ Integration Map

| Heady Component | HF Resource | Connection |
|---|---|---|
| HeadyEmbed (384D) | all-MiniLM-L6-v2 | Same embedding dimension |
| CSL Security Gate | halugate-sentinel | Routing classifier pattern |
| HeadyBattle Arena | SwarmAgentic | Multi-model orchestration |
| HeadyMCP Server | MCP Course | Protocol implementation |
| HeadyUI Engine | UI Remix, Generative UI | AI-driven component generation |
| Patent Bee | PatentEdits, PatentMatch | Novelty detection datasets |
| Edge Workers | Small Thinking | Compact edge inference |
| VSA Bridge | hdlib, MBAT paper | Binding/bundling operations |
| Self-Healing | Self-Healing Tool Routing | Deterministic recovery |

# Section 06 — Vector Memory, VSA & Shadow Memory: Academic References

## Vector Symbolic Architectures (VSA / HDC)

### Foundational: Kanerva's Sparse Distributed Memory
- **Kanerva, P. (1988)** — "Sparse Distributed Memory"
  - The foundational work for hyperdimensional computing
  - DOI: 10.1007/s12559-009-9009-8

### Comprehensive VSA Comparison
- **Schlegel, K. et al. (2021)** — "A comparison of Vector Symbolic Architectures"
  - Artificial Intelligence Review | DOI: 10.1007/s10462-021-10110-3
  - Taxonomy of binding operations, evaluation of bundle capacity and unbinding quality
  - arXiv:2001.11797

### Capacity Analysis of VSAs
- **Clarkson, K. et al. (2023)** — "Capacity Analysis of Vector Symbolic Architectures"
  - arXiv:2301.10352 | Bounds on dimensions for MAP-I, MAP-B, sparse binary VSAs
  - Connections to sketching algorithms and Bloom filters
  - https://huggingface.co/papers/2301.10352

### MBAT with Orthogonal Matrices
- **Gallant, S. (2022)** — "Orthogonal Matrices for MBAT VSAs, and a Soft VSA for JSON"
  - arXiv:2202.04771 | Non-commutative binding with orthogonal matrices for stability
  - JSON-to-vector representation — directly relevant to Heady's structured data embedding
  - https://huggingface.co/papers/2202.04771

### Attention as Binding (VSA Perspective on Transformers)
- **Dhayalkar, S. (2025)** — "Attention as Binding: A VSA Perspective on Transformer Reasoning"
  - arXiv:2512.14709 | Self-attention and residual streams as approximate VSA
  - Proposes VSA-inspired architectures: explicit binding/unbinding heads, hyperdimensional memory layers

### GPT-2 Through VSA Lens
- **Knittel, J. et al. (2024)** — "GPT-2 Through the Lens of Vector Symbolic Architectures"
  - arXiv:2412.07947 | GPT-2 uses nearly orthogonal vector bundling and binding similar to VSA

### LARS-VSA: Abstract Rule Learning
- **Mejri, M. et al. (2024)** — "LARS-VSA: Learning with Abstract Rules"
  - arXiv:2405.14436 | Compositional architecture with explicit vector binding, novel HD attention mechanism

### VSA for Edge Cognitive Processing
- **Bent, G. et al. (2024)** — "The transformative potential of VSA for cognitive processing at the network edge"
  - SPIE 13206 | DOI: 10.1117/12.3030949
  - VSA for OODA loop processing with compact binary vector representations

### Holographic Declarative Memory (Wiley)
- **Kelly, M. et al. (2020)** — "Holographic Declarative Memory: Distributional Semantics as the Architecture of Memory"
  - Wiley Cognitive Science | DOI: 10.1111/cogs.12904
  - Key components of cognitive architectures implemented as algebraic operations on vectors/tensors in HD space
  - Bridges symbolic cognitive architectures and neural networks

### Hyperdimensional Computing: An Algebra (Wiley Book Chapter)
- **Kanerva, P. (2022)** — "Hyperdimensional Computing: An Algebra for Computing with Vectors"
  - Wiley | DOI: 10.1002/9781119869610.ch2
  - Extends von Neumann model to computing with wide vectors

### hdlib Python Library
- **Cumbo, F. et al. (2023)** — "hdlib: A Python library for designing Vector-Symbolic Architectures"
  - JOSS | DOI: 10.21105/joss.05704 | Open-source VSA implementation

## Persistent Memory & Cross-Session Systems

### Mem0: Production-Ready Long-Term Memory
- **Chhikara, P. et al. (2025)** — "Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory"
  - arXiv:2504.19413 | Graph-based memory for multi-session dialogue, 26% improvement over OpenAI
  - 91% lower p95 latency, 90%+ token cost savings

### Zep: Temporal Knowledge Graph Memory
- **Rasmussen, P. et al. (2025)** — "Zep: A Temporal Knowledge Graph Architecture for Agent Memory"
  - arXiv:2501.13956 | Outperforms MemGPT, Graphiti for dynamic knowledge integration
  - 94.8% vs 93.4% on DMR benchmark, 18.5% improvement on LongMemEval

### Semantic Anchoring for Persistent Memory
- **Chatterjee, M. & Agarwal, D. (2025)** — "Semantic Anchoring in Agentic Memory"
  - arXiv:2508.12630 | Hybrid architecture: vector-based storage + explicit linguistic cues
  - 18% improvement in factual recall and discourse coherence over RAG baselines

### RGMem: Self-Evolving Memory
- **Tian, A. et al. (2025)** — "RGMem: Renormalization Group-inspired Memory Evolution"
  - Multi-scale evolutionary process: episodic → semantic facts → user insights
  - Separates fast-changing evidence from slow-varying traits — relevant to Heady's shadow memory decay

### A-MEM: Agentic Memory for LLM Agents
- **Xu, W. et al. (2025)** — "A-MEM: Agentic Memory for LLM Agents"
  - arXiv:2502.12110 | Novel agentic memory with sophisticated organization beyond basic storage/retrieval

## Hugging Face 384D Embedding Models

### all-MiniLM-L6-v2
- **sentence-transformers/all-MiniLM-L6-v2** — 384-dimensional dense vector space
  - https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
  - Maps sentences & paragraphs to 384D vectors — exactly matches Heady's embedding dimension
  - Based on MiniLM-L6-H384-uncased, fine-tuned on 1B sentence pairs

### msmarco-MiniLM-L12-v3
- **sentence-transformers/msmarco-MiniLM-L12-v3** — 384-dimensional for semantic search
  - https://huggingface.co/sentence-transformers/msmarco-MiniLM-L12-v3

## Heady™ Integration Opportunity
- Heady's 384D embedding space exactly matches sentence-transformers' all-MiniLM-L6-v2 dimension
- VSA binding/bundling/permutation operations (10000-dim hypervectors) are validated by comprehensive academic literature
- Shadow memory with CSL confidence decay (φ⁻¹ per session) aligns with RGMem's multi-scale evolutionary approach
- DuckDB backend for persistent storage is a practical choice validated by production memory systems (Mem0, Zep)

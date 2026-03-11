# Section 07 — Edge Gateway & Inference Routing: Academic References

## Edge AI Inference

### Adaptive Orchestration for Edge AI
- **Koch, F. et al. (2025)** — "Adaptive Orchestration for Inference of Large Foundation Models at the Edge"
  - arXiv:2504.03668 | Novel adaptive orchestration for distributed inference across heterogeneous edge environments
  - Directly relevant to Heady's multi-provider inference routing

### AI Flow at the Network Edge
- **Shao, J. & Li, X. (2025)** — "AI Flow at the Network Edge"
  - arXiv:2411.12469 | Framework making intelligence flow across devices, edge nodes, cloud servers
  - Paradigm shift from transmitting information flow to intelligence flow

### Edge Intelligence: Architectures, Challenges, Applications
- **Xu, D. et al. (2020)** — "Edge Intelligence: Architectures, Challenges, and Applications"
  - arXiv:2003.12172 | Comprehensive survey: edge caching, edge training, edge inference, edge offloading

### Roadmap for Edge AI (Dagstuhl Perspective)
- **Ding, A. et al. (2021)** — "Roadmap for Edge AI: A Dagstuhl Perspective"
  - arXiv:2112.00616 | Adaptation for data-driven applications, quality of experience, trust, security, privacy

### Edge Intelligence Optimization for LLM Inference
- **Zhang, X. et al. (2024)** — "Edge Intelligence Optimization for LLM Inference with Batching and Quantization"
  - arXiv:2405.07140 | Addresses unique characteristics of LLM inference: model size, auto-regressive, self-attention

### Small Thinking: Compact Reasoning for Edge (Hugging Face)
- **mindchain (2026)** — "Small Thinking - Compact Reasoning Models for Edge"
  - https://huggingface.co/collections/mindchain/small-thinking-compact-reasoning-models-for-edge
  - Compact reasoning models for efficient chain-of-thought inference on resource-constrained devices

### Telco Infrastructure for AI Latency
- **Barros, S. (2025)** — "Solving AI Foundational Model Latency with Telco Infrastructure"
  - arXiv:2504.03708 | Hierarchical "AI edges" for caching and partial inference
  - Tiered caching strategies and split-inference architectures — aligns with Heady™'s Hot/Warm/Cold pool model

## Inference Delivery Networks

### Inference Delivery Networks (IDNs)
- **Si Salem, T. et al. (2023)** — "Towards Inference Delivery Networks"
  - arXiv:2105.02510 | Networks of computing nodes coordinating for best latency-accuracy trade-off
  - Distributed dynamic policy for ML model allocation — relevant to Heady's multi-provider routing

### Resource Optimization for Edge ML
- **Truong, H. & Nguyen, M. (2024)** — "On Optimizing Resources for Real-Time End-to-End ML in Heterogeneous Edges"
  - Wiley Software: Practice and Experience | DOI: 10.1002/spe.3383
  - Profiling microservices, estimating scales, allocating on desired hardware platforms

## Cloud-Edge Integration

### Osmotic Cloud-Edge Intelligence
- **Fasciano, C. et al. (2022)** — "Osmotic Cloud-Edge Intelligence for IoT-Based CPS"
  - Sensors 22(6):2166 | Containerized training and inference on Edge, Cloud, or both
  - Direct mapping with COTS modules — aligns with Heady™'s Cloudflare Workers + Cloud Run architecture

### Digital Twin-Assisted Edge Computing
- **Chen, X. et al. (2024)** — "Digital Twin-assisted RL for Resource-aware Microservice Offloading"
  - arXiv:2403.08687 | Predict and adapt to changing edge node loads in real-time

### InTec Framework
- **Larian, H. & Safi-Esfahani, F. (2025)** — "InTec: Integrated Things-Edge Computing"
  - arXiv:2502.11644 | 25.83% reduction in cloud energy consumption
  - New benchmark for scalable, responsive, energy-efficient IoT + Edge AI

## Resilience at Edge

### Resilience Enhancement at Edge Cloud Systems
- **Moura, J. & Hutchison, D. (2022)** — "Resilience Enhancement at Edge Cloud Systems"
  - arXiv:2205.08997 | Programmable asset orchestration for operational resilience
  - Traffic balanced among alternative on-demand routing paths

### Reference Architecture for Edge Systems
- **Pitstick, K. et al. (2024)** — "Defining a Reference Architecture for Edge Systems in Highly-Uncertain Environments"
  - arXiv:2406.08583 | Reduced latency, bandwidth optimization, higher resiliency

## Heady™ Integration Opportunity
- Heady's edge worker architecture (Cloudflare Workers + Cloud Run origin) maps directly to cloud-edge osmotic computing patterns
- CSL-gated routing decisions at the edge add a novel quality layer to standard edge inference
- Phi-scaled cache TTL and Hot/Warm/Cold pool scheduling align with tiered caching in telco AI edge patterns
- Sub-100ms target is achievable given edge inference benchmarks in the literature
- Multi-provider routing (Claude, GPT-4, Gemini, Sonar) with CSL health scoring extends IDN concepts

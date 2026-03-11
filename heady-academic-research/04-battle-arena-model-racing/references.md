# Section 04 — Battle Arena & Model Racing: Academic References

## Model Ensemble & Racing

### Speculative Ensemble
- **Fu, J. et al. (2025)** — "Speculative Ensemble: Fast Large Language Model Ensemble via Speculation"
  - arXiv:2502.01662 | Accelerates LLM ensembles without sacrificing performance
  - Directly relevant to Heady's multi-contestant battle arena approach

### Scalable Consistency Ensembles
- **Zhang, J. et al. (2025)** — "SCE: Scalable Consistency Ensembles Make Blackbox LLM Generation More Reliable"
  - arXiv:2503.10881 | Efficient multi-LLM ensembling framework

### Deep Parallel Collaboration Ensemble (DeePEn)
- **Huang, Y. et al. (2024)** — "Ensemble Learning for Heterogeneous LLMs with Deep Parallel Collaboration"
  - arXiv:2404.12715 | Maps probability distributions to universal relative space, aggregates across different LLM architectures

### Branch-Train-MiX
- **Sukhbaatar, S. et al. (2024)** — "Branch-Train-MiX: Mixing Expert LLMs into a Mixture-of-Experts LLM"
  - arXiv:2403.07816 | Branch from seed model, train domain experts in parallel, merge into MoE with token-level routing

## Mixture-of-Experts Routing (CSL-Relevant)

### Eigenbasis Score Routing (ERMoE)
- **Cheng, A. et al. (2025)** — "ERMoE: Eigen-Reparameterized MoE for Stable Routing"
  - arXiv:2511.10971 | **Cosine similarity between input features and expert's basis** — directly validates CSL's MoE routing approach
  - Content-aware routing ties token assignments to expert representation spaces

### Hippocampal-Inspired Continual Learning (HiCL)
- **Kapoor, K. et al. (2025)** — "HiCL: Hippocampal-Inspired Continual Learning"
  - arXiv:2508.16651 | DG-gated MoE routing via **cosine similarity between sparse representations and task prototypes**
  - Biologically grounded gating strategy without separate gating network

### Routing in Sparse MoE Responds to Context
- **Arnold, S. et al. (2024)** — "Routing in Sparsely-gated Language Models responds to Context"
  - arXiv:2409.14107 | Token-expert assignments influenced by token identities and positions

### Adaptive Gating in MoE
- **Wang, C. et al. (2023)** — "Adaptive Gating in Mixture-of-Experts based Language Models"
  - EMNLP 2023 | Variable number of experts based on probability distribution, reduces 22.5% training time

### HyperRouter
- **Do, G. et al. (2023)** — "HyperRouter: Efficient Training and Inference of Sparse MoE"
  - EMNLP 2023 | Fixed routers achieve competitive performance by alleviating collapsing problem
  - DOI: 10.18653/v1/2023.emnlp-main.351

## LLM Competition Arenas

### UNO Arena for Sequential Decision-Making
- **Qin, Z. et al. (2024)** — "UNO Arena for Evaluating Sequential Decision-Making Capability of LLMs"
  - arXiv:2406.16382 | Monte Carlo-based metrics for evaluating LLM capabilities dynamically
  - Relevant to Heady's HeadyBattle tournament scoring approach

### LLM-as-a-Judge Reliability
- **Schroeder, K. & Wood-Doughty, Z. (2025)** — "Can You Trust LLM Judgments?"
  - arXiv:2412.12509 | Framework for evaluating reliability of LLM judgments

### Uncertainty-Aware LLM Guidance
- **Shoaeinaeini, M. & Harrison, B. (2024)** — "Guiding RL Using Uncertainty-Aware LLMs"
  - arXiv:2411.14457 | Monte Carlo Dropout for assessing LLM prediction variances

## Self-Healing Tool Routing (Hugging Face)
- **HF Paper (2026)** — "Graph-Based Self-Healing Tool Routing for Cost-Efficient LLM Agents"
  - https://huggingface.co/papers/2603.01548 | Fault-tolerant orchestration with parallel health monitors
  - Deterministic shortest-path routing with automatic recovery — directly relevant to Heady's battle-sim pipeline
  - Reduces control-plane LLM calls by 93%

## Heady™ Integration Opportunity
- Heady's 9-stage battle-sim pipeline (Task → Sim → CSL Gate → Battle/MC → Bee → Swarm → Result → Drift → Audit) aligns with tournament-style evaluation and ensemble methods in literature
- CSL-weighted consensus scoring maps to cosine-similarity-based MoE routing validated at scale (ERMoE, HiCL)
- Multi-contestant racing with Perplexity Sonar, Claude, GPT-4, Gemini mirrors speculative ensemble and DeePEn approaches
- Monte Carlo determinism boundary detection has precedent in SMC steering and MCTSr

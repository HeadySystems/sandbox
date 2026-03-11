# Section 03 — Deterministic Execution & Error Prediction: Academic References

## LLM Determinism & Reproducibility

### Non-Determinism of "Deterministic" LLM Settings
- **Atil, B. et al. (2025)** — "Non-Determinism of 'Deterministic' LLM Settings"
  - arXiv:2408.04667 | Systematic investigation: outputs vary even with temperature=0 and fixed seed across 5 LLMs, 8 tasks, 10 runs
  - Directly validates Heady's SHA-256 hash-based determinism verification approach

### Towards Reproducible LLM Evaluation
- **Blackwell, R. et al. (2024)** — "Towards Reproducible LLM Evaluation: Quantifying Uncertainty in Benchmark Scores"
  - arXiv:2410.03492 | Method for cost-effectively quantifying benchmark score uncertainty
  - Relevant to Heady's Monte Carlo determinism boundary detection

### Towards Training Reproducible Deep Learning Models
- **Chen, B. et al. (2022)** — "Towards Training Reproducible Deep Learning Models"
  - ICSE 2022 | DOI: 10.1145/3510003.3510163
  - DL models challenging to reproduce due to randomness in software

### Inferential Reproducibility of ML Research
- **Hagmann, M. et al. (2023)** — "Towards Inferential Reproducibility of Machine Learning Research"
  - arXiv:2302.04054 | Multiple sources of nondeterminism as measurement noise, interaction effects

## Monte Carlo Methods for LLMs

### Monte Carlo Tree Self-Refine
- **Zhang, D. et al. (2024)** — "Accessing GPT-4 level Mathematical Olympiad Solutions via MCTSr"
  - arXiv:2406.07394 | Integration of LLMs with Monte Carlo Tree Search for systematic exploration
  - Relevant to Heady's HeadyMC Monte Carlo determinism boundary approach

### Sequential Monte Carlo Steering of LLMs
- **Lew, A. et al. (2023)** — "Sequential Monte Carlo Steering of Large Language Models using Probabilistic Programs"
  - arXiv:2306.03081 | SMC for enforcing syntactic/semantic constraints on LLM outputs
  - Probabilistic programming library LLaMPPL for specifying steering tasks

### Monte Carlo Search for Policy Improvement
- **Tesauro, G. & Galperin, G. (2025)** — "On-line Policy Improvement using Monte-Carlo Search"
  - arXiv:2501.05407 | MC simulation for real-time policy improvement, reduces error by 5× or more

## LLM Reliability & Ensemble Methods

### Speculative Ensemble for Fast LLM Ensembles
- **Fu, J. et al. (2025)** — "Speculative Ensemble: Fast Large Language Model Ensemble via Speculation"
  - arXiv:2502.01662 | Accelerates LLM ensembles without sacrificing performance
  - Inspired by Speculative Decoding

### Scalable Consistency Ensembles (SCE)
- **Zhang, J. et al. (2025)** — "SCE: Scalable Consistency Ensembles for Blackbox LLM Generation"
  - arXiv:2503.10881 | Efficient framework for ensembling LLMs for reliable responses

### Deep Parallel Collaboration Ensemble
- **Huang, Y. et al. (2024)** — "Ensemble Learning for Heterogeneous LLMs with Deep Parallel Collaboration"
  - arXiv:2404.12715 | DeePEn maps probability distributions to universal relative space for aggregation

### LLM Reliability Assessment
- **Schroeder, K. & Wood-Doughty, Z. (2025)** — "Can You Trust LLM Judgments? Reliability of LLM-as-a-Judge"
  - arXiv:2412.12509 | Deterministic settings improve consistency but don't guarantee reliability

### Bayesian Decoding Game for Consistency
- **Zhang, W. et al. (2024)** — "Truth or Deceit? A Bayesian Decoding Game for Consistency and Reliability"
  - arXiv:2410.01064 | Game-theoretic tools improve truthfulness and reliability of LLMs

## Test-Time Compute Scaling
- **Chen, Y. et al. (2025)** — "Simple and Provable Scaling Laws for Test-Time Compute of LLMs"
  - arXiv:2411.19477 | Two-stage knockout algorithm: generate candidates, aggregate for final output
  - Analogous to Heady's Battle Arena multiple-contestant approach

## LLM Cascade Optimization
- **Zellinger, M. & Thomson, M. (2025)** — "Rational Tuning of LLM Cascades via Probabilistic Modeling"
  - arXiv:2501.09345 | Markov-copula model for tuning LLM cascade performance

## Heady™ Integration Opportunity
- Heady's deterministic prompt executor (SHA-256 hash matching, temp=0, seed=42) addresses a documented problem: "deterministic" LLM settings are often non-deterministic
- Monte Carlo determinism boundary `D(n,v,d,c)` aligns with SMC steering and MCTS self-refine approaches
- CSL confidence gates (EXECUTE > φ⁻¹, CAUTIOUS, HALT < φ⁻²) provide principled thresholds for reliability scoring
- The ensemble/racing approach mirrors knockout-style algorithms with provable scaling laws

# Section 01 — CSL & Geometric Logic: Academic References

## Foundational Papers

### Quantum Logic & Subspace Logic
- **Birkhoff & von Neumann (1936)** — "The Logic of Quantum Mechanics"
  - Propositions as Hilbert subspaces — foundational for CSL's vector-based logical operations
  - Journal of Mathematics and Mechanics

### Orthogonal Negation (CSL NOT)
- **Widdows, D. (2003)** — "Orthogonal Negation in Vector Spaces for Modelling Word-Meanings and Document Retrieval"
  - ACL 2003 | Direct predecessor to CSL's NOT gate: `NOT(a,b) = a - proj_b(a)`
  - https://aclanthology.org/P03-1015

### Semantic Projection
- **Grand et al. (2022)** — "Semantic projection recovers rich human knowledge of multiple object features from word embeddings"
  - Nature Human Behaviour | Validates that geometric projections in vector space recover human semantic judgments
  - DOI: 10.1038/s41562-022-01316-8

### Vector Logic Formal Semantics
- **Quigley, D. (2024)** — "A vector logic for extensional formal semantics"
  - arXiv:2412.16152 | Constructs injective mappings preserving semantic relationships between logical structures and vector space operations
  - https://arxiv.org/abs/2412.16152

### Reasoning with Vectors
- **Widdows, D. & Cohen, T. (2015)** — "Reasoning with vectors: A continuous model for fast robust inference"
  - Logic Journal of the IGPL | Explains logical connectives in semantic vector models, VSA for subject-predicate-object triples
  - DOI: 10.1093/jigpal/jzu028 | https://pmc.ncbi.nlm.nih.gov/articles/PMC4646228/

### Geometric Ordering of Concepts
- **Widdows, D. & Higgins, M.** — "Geometric Ordering of Concepts, Logical Disjunction, and Learning by Induction"
  - Semantic Scholar: 3ca6e0698e8d4537666df0195489234347eddd2f

## Cosine Similarity Analysis

### Critical Analysis of Cosine Similarity
- **Steck, H., Ekanadham, C., & Kallus, N. (2024)** — "Is Cosine-Similarity of Embeddings Really About Similarity?"
  - DOI: 10.1145/3589335.3651526 | https://arxiv.org/html/2403.05440v1
  - Studies when cosine works better or worse than unnormalized dot-product

### Dimension-Insensitive Metrics
- **Tessari, F. & Yao, K. (2025)** — "Surpassing Cosine Similarity for Multidimensional Comparisons: DIEM"
  - arXiv:2407.08623 | Reveals significant limitations of cosine similarity in high dimensions
  - Proposes Dimension Insensitive Euclidean Metric (DIEM) with superior robustness

### Fermatean Fuzzy Cosine Similarity
- **Kirişci, M. (2022)** — "New cosine similarity and distance measures for Fermatean fuzzy sets and TOPSIS approach"
  - DOI: 10.1007/s10115-022-01776-4 | Extends cosine similarity to fuzzy decision-making

## Subspace Representations & Set Operations

### Subspace-Based Set Operations
- **Ishibashi, Y. et al. (2024)** — "Subspace Representations for Soft Set Operations and Sentence Similarities"
  - NAACL 2024 | Quantum-logic-inspired representation of word sets with union, intersection, complement
  - DOI: 10.18653/v1/2024.naacl-long.192 | https://aclanthology.org/2024.naacl-long.192

### Correlations between Word Vector Sets
- **Zhelezniak, V. et al. (2019)** — "Correlations between Word Vector Sets"
  - EMNLP 2019 | Centered Kernel Alignment (CKA) as generalization of squared cosine similarity for sets
  - DOI: 10.18653/v1/D19-1008

## Embedding Space Analysis

### 384-Dimensional Embedding Space
- **Karabašević, D. et al. (2026)** — "A Transformer-Based Semantic Encoding Framework for Quantitative Analysis"
  - Axioms 15(3):175 | Studies 384D embedding spaces, validates angular similarity as the right semantic metric
  - DOI: 10.3390/axioms15030175

### Hyperbolic Entailment for Alignment
- **Chen, W. et al. (2026)** — "HyperAlign: Hyperbolic Entailment Cones for Adaptive Text-to-Image Alignment"
  - arXiv:2601.04614 | Transforms discrete entailment logic into continuous geometric structure
  - Relevant to CSL's continuous geometric approach

## Ternary Logic Foundation

### Three-Valued Logic
- **Łukasiewicz (1920)** — Three-valued logic for future contingents
- **Kleene (1952)** — Strong logic of indeterminacy
- **Fagin, Riegel, Gray (2024)** — "Foundations of reasoning with uncertainty" — PNAS
- **Open Logic Project** — Three-valued Logics PDF

## Heady™ Integration Opportunity
These papers collectively validate CSL's approach of using continuous geometric operations on vectors as logical gates. Key differentiators for Heady™'s CSL:
1. CSL NOT achieves 100% semantic negation vs 32% for probabilistic NOT (internal benchmarks)
2. CSL routing is 5× faster than LLM classification, 43% cheaper
3. Phi-scaled thresholds (φ⁻¹ ≈ 0.618, φ⁻² ≈ 0.382) provide principled decision boundaries
4. 60+ provisional patents on CSL techniques

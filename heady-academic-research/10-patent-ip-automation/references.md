# Section 10 — Patent IP & Auto-Documentation: Academic References

## AI-Based Patent Analysis

### Comprehensive Survey on AI for Patents
- **Shomee, H. et al. (2024)** — "A Comprehensive Survey on AI-based Methods for Patents"
  - arXiv:2404.08668 | AI tools for patent classification, retrieval, valuation prediction
  - Accelerates patent researchers and applicants, opens new avenues for innovation assessment

### Can AI Examine Patent Novelty?
- **Ikoma, H. & Mitamura, T. (2025)** — "Can AI Examine Novelty of Patents?"
  - arXiv:2502.06316 | First dataset for novelty evaluation from real patent examination cases
  - Generative models make predictions with reasonable accuracy for patent novelty
  - https://huggingface.co/papers/2502.06316

### PatentEdits: Framing Novelty as Textual Entailment
- **Parikh, A. et al. (2024)** — "PatentEdits: Framing Patent Novelty as Textual Entailment"
  - arXiv:2411.13477 | 105K examples of successful revisions overcoming novelty objections
  - Textual entailment between cited references and draft sentences
  - https://huggingface.co/papers/2411.13477

### PatentMatch: Dataset for Prior Art Matching
- **Risch, J. et al. (2020)** — "PatentMatch: A Dataset for Matching Patent Claims & Prior Art"
  - arXiv:2012.13919 | Pairs of claims and semantically corresponding prior art passages
  - https://huggingface.co/papers/2012.13919

### ClaimCompare: Novelty Destroying Patent Pairs
- **Parikh, A. & Dori-Hacohen, S. (2024)** — "ClaimCompare: Evaluation of Novelty Destroying Patent Pairs"
  - arXiv:2407.12193 | Data pipeline for detecting novelty-destroying patents using IR and ML

## Automated Patent Search

### Full Text Prior Art Search
- **Helmers, L. et al. (2019)** — "Automating the search for a patent's prior art with a full text similarity search"
  - PLOS ONE | DOI: 10.1371/journal.pone.0212103
  - ML and NLP for automatic comparison of full patent text to existing patents
  - Improves search results quality while accelerating the process

### Predictive Patent Analytics Platform
- **Alam, N. et al. (2019)** — "Towards a Predictive Patent Analytics and Evaluation Platform"
  - arXiv:1910.14258 | Predictive algorithms leveraging state-of-the-art ML and DL for patent understanding

### DeepInnovation AI: Paper-Patent Similarity
- **Gong, H. et al. (2025)** — "DeepInnovation AI: A Global Dataset Mapping AI Innovation from Academic Research to Industrial Patents"
  - arXiv:2503.09257 | ~100 million calculated paper-patent cosine similarity pairs
  - Uses semantic vector proximity analysis — directly relevant to CSL-based patent similarity

### PQPS: Prior-Art Query-Based Patent Summarizer
- **Kumaravel, G. & Sankaranarayanan, S. (2021)** — "PQPS: Prior-Art Query-Based Patent Summarizer"
  - DOI: 10.1155/2021/2497770 | RBM and Bi-LSTM for patent summarization

## Patent Screening & Breakthrough Detection

### Hierarchical Attention Network for Patent Screening
- **Choi, J. et al. (2024)** — "Early screening of potential breakthrough technologies with enhanced interpretability"
  - arXiv:2407.16939 | PatentHAN model: patent-specific word embeddings, hierarchical network, claim-wise self-attention
  - Reveals pivotal claims during screening process

### Machine Learning for Patent Novelty Detection
- **Chikkamath, R. et al. (2020)** — "An Empirical Study on Patent Novelty Detection"
  - IEEE SNAMS | DOI: 10.1109/SNAMS52053.2020.9336557
  - 50+ ML models investigated, NBSVM algorithm exceptionally good
  - Word embeddings: word2vec, GloVe, fasttext, domain-specific

## AI in IP Management

### AI as Game Changer in IP Management
- **A R (2025)** — "AI Continues to be a Game Changer in Intellectual Property Management in India"
  - DOI: 10.55041/ijsrem41289 | ML algorithms for faster patent reviews, predictive analytics
  - Discussion of AI-generated IP ownership rights and ethical concerns

## Heady™ Integration Opportunity
- Heady's patent-bee.js with CSL-scored concept registration provides a novel approach to automated novelty detection
- MC sampling against patent registry for prior art detection aligns with DeepInnovation AI's cosine similarity approach
- CSL uniqueness confidence threshold at φ⁻¹ provides principled novelty scoring
- Auto-documentation from code with deterministic hash matching is validated by PatentEdits' textual entailment approach
- The 60+ provisional patents on CSL, Sacred Geometry, and vector memory techniques benefit from automated prior art scanning

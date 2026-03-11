# CSL (Confidence Scoring Library) Theory

## Overview

CSL is Heady's confidence-based gating mechanism for vector memory operations, using golden-ratio-derived thresholds to filter low-quality matches.

## Core Principles

### 1. Cosine Similarity as Base Metric

```javascript
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### 2. CSL AND Operation

Combines two confidence scores using minimum:

```javascript
function cslAND(vecA, vecB) {
  const sim = cosineSimilarity(vecA, vecB);
  return sim >= CSL_THRESHOLDS.LOW ? sim : 0;
}
```

### 3. CSL OR Operation

Combines two confidence scores using maximum:

```javascript
function cslOR(scoreA, scoreB) {
  return Math.max(scoreA, scoreB);
}
```

### 4. Threshold Gating

Only return results above φ⁻¹ confidence:

```javascript
function gatedRetrieval(results, threshold = PSI) {
  return results.filter(r => r.score >= threshold);
}
```

## Threshold Levels

### DEDUP (0.951)
Near-identical matches for deduplication
- Used: Preventing duplicate memory storage
- Rationale: 1 - PSI³ × 0.2 gives very high bar

### HIGH (0.882)
High-confidence semantic matches
- Used: Critical decision points, high-stakes retrieval
- Rationale: 1 - PSI³ × 0.5 = third-level phi harmonic

### MEDIUM (0.764)
Moderate-confidence matches
- Used: Standard semantic search, clustering
- Rationale: 1 - PSI³ = second-level phi harmonic

### LOW (0.618)
Minimum acceptable confidence
- Used: Exploratory search, related concepts
- Rationale: PSI = φ⁻¹ = golden ratio inverse

### MINIMAL (0.382)
Very low confidence (rarely used)
- Used: Fallback, debug, broad recall
- Rationale: PSI² = (φ⁻¹)² = minor golden section

## Integration with Vector Memory

### Search with Gating

```javascript
async search(queryVector, k = 10, threshold = CSL_THRESHOLDS.LOW) {
  const allResults = this.computeAllSimilarities(queryVector);
  const gated = allResults.filter(r => r.score >= threshold);
  return topK(gated, k);
}
```

### Eviction Scoring

```javascript
function evictionScore(entry, now, maxAccess, maxAge) {
  const recency = 1 - ((now - entry.lastAccessedAt) / maxAge);
  const frequency = entry.accessCount / maxAccess;
  const importance = entry.importance;

  return (
    importance * EVICTION_WEIGHTS.importance +
    recency * EVICTION_WEIGHTS.recency +
    frequency * EVICTION_WEIGHTS.relevance
  );
}
```

## VSA Integration

CSL gates VSA operations:

```javascript
function vsaRetrieve(query, memory, threshold = PSI) {
  const bound = vsa.bind(query, memory.key);
  const similarity = vsa.similarity(bound, memory.value);
  return similarity >= threshold ? memory : null;
}
```

## Shadow Memory Decay

Confidence decays by φ⁻¹ per session:

```javascript
function decayConfidence(originalScore, sessionsSinceAccess) {
  return originalScore * Math.pow(PSI, sessionsSinceAccess);
}
```

## Benefits

1. **Noise Reduction** - Filters out low-quality matches automatically
2. **Interpretable** - Thresholds have geometric meaning (golden ratio)
3. **Adaptive** - Different tasks use different threshold levels
4. **Consistent** - All operations use same φ-based scale

## References

- Your spec: Section "CSL-gated similarity search"
- shared/csl-engine.js in your codebase
- shared/phi-math.js for constant definitions

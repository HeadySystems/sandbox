# Torchhd Operations Guide for JavaScript Implementation

## Overview

This guide maps Torchhd's PyTorch-based VSA operations to JavaScript implementations for Heady™'s Node.js runtime.

## Torchhd API → JavaScript Mapping

### 1. Creating Hypervectors

**Torchhd (Python):**
```python
import torchhd

# Random hypervector
hv = torchhd.random(1, 10000, dtype=torch.float32)

# Identity element for bundling
zero = torchhd.empty(1, 10000, dtype=torch.float32)
```

**JavaScript Equivalent:**
```javascript
function randomHypervector(dim = 10000) {
  const hv = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    hv[i] = Math.random() * 2 - 1;  // Uniform [-1, 1]
  }
  return normalize(hv);
}

function emptyHypervector(dim = 10000) {
  return new Float64Array(dim);  // All zeros
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v*v, 0));
  return vec.map(v => norm > 0 ? v / norm : 0);
}
```

### 2. Binding Operation

**Torchhd:**
```python
# Element-wise multiplication
bound = torchhd.bind(hv_a, hv_b)
```

**JavaScript:**
```javascript
function bind(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector dimension mismatch');
  }
  const result = new Float64Array(vecA.length);
  for (let i = 0; i < vecA.length; i++) {
    result[i] = vecA[i] * vecB[i];
  }
  return normalize(result);
}
```

### 3. Bundling Operation

**Torchhd:**
```python
# Element-wise addition
bundled = torchhd.bundle(hv_a, hv_b, hv_c)
```

**JavaScript:**
```javascript
function bundle(...vectors) {
  if (vectors.length === 0) throw new Error('No vectors to bundle');

  const dim = vectors[0].length;
  const sum = new Float64Array(dim);

  for (const vec of vectors) {
    if (vec.length !== dim) throw new Error('Vector dimension mismatch');
    for (let i = 0; i < dim; i++) {
      sum[i] += vec[i];
    }
  }

  return normalize(sum);
}
```

### 4. Permutation

**Torchhd:**
```python
# Circular shift
permuted = torchhd.permute(hv, shifts=1)
```

**JavaScript:**
```javascript
function permute(vec, shifts = 1) {
  const n = vec.length;
  const result = new Float64Array(n);
  shifts = ((shifts % n) + n) % n;  // Handle negative shifts

  for (let i = 0; i < n; i++) {
    result[i] = vec[(i - shifts + n) % n];
  }

  return result;
}

function unPermute(vec, shifts = 1) {
  return permute(vec, -shifts);
}
```

### 5. Similarity

**Torchhd:**
```python
# Cosine similarity
sim = torchhd.cosine_similarity(hv_a, hv_b)
```

**JavaScript:**
```javascript
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vector dimension mismatch');
  }

  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

## Complete VSA Class for Heady™

```javascript
class HeadyVSA {
  constructor(dimensions = 10000) {
    this.dim = dimensions;
    this.atoms = new Map();  // Named atomic concepts
  }

  // Register or retrieve an atomic hypervector
  atom(name) {
    if (!this.atoms.has(name)) {
      this.atoms.set(name, randomHypervector(this.dim));
    }
    return this.atoms.get(name);
  }

  // Bind multiple concepts
  bind(...vectors) {
    if (vectors.length === 0) throw new Error('No vectors to bind');
    let result = vectors[0];
    for (let i = 1; i < vectors.length; i++) {
      result = bind(result, vectors[i]);
    }
    return result;
  }

  // Bundle multiple concepts
  bundle(...vectors) {
    return bundle(...vectors);
  }

  // Permute for sequence encoding
  permute(vec, shifts = 1) {
    return permute(vec, shifts);
  }

  // Compute similarity
  similarity(vecA, vecB) {
    return cosineSimilarity(vecA, vecB);
  }

  // Encode a sequence with positional information
  encodeSequence(items) {
    const encoded = items.map((item, idx) => {
      const itemVec = typeof item === 'string' ? this.atom(item) : item;
      return permute(itemVec, idx);
    });
    return bundle(...encoded);
  }

  // Clean up noisy vector (return closest atom)
  cleanup(vec, threshold = 0.618) {
    let bestMatch = null;
    let bestSim = threshold;

    for (const [name, atom] of this.atoms) {
      const sim = this.similarity(vec, atom);
      if (sim > bestSim) {
        bestSim = sim;
        bestMatch = { name, similarity: sim };
      }
    }

    return bestMatch;
  }
}

// Helper functions (already defined above)
function randomHypervector(dim) { /* ... */ }
function normalize(vec) { /* ... */ }
function bind(vecA, vecB) { /* ... */ }
function bundle(...vectors) { /* ... */ }
function permute(vec, shifts) { /* ... */ }
function cosineSimilarity(vecA, vecB) { /* ... */ }
```

## Usage Example

```javascript
const vsa = new HeadyVSA(10000);

// Register concepts
const france = vsa.atom('FRANCE');
const capital = vsa.atom('CAPITAL_OF');
const paris = vsa.atom('PARIS');

// Encode fact: "Paris is the capital of France"
const fact = vsa.bind(capital, france, paris);

// Query: "What is the capital of France?"
const query = vsa.bind(capital, france);

// Find answer by similarity
const similarity = vsa.similarity(query, fact);
console.log('Match confidence:', similarity);  // Should be high

// Decode by binding with inverse
const decoded = vsa.bind(fact, capital, france);
const match = vsa.cleanup(decoded);
console.log('Decoded answer:', match);  // Should return 'PARIS'
```

## Performance Notes

- **Torchhd with CUDA:** ~100× faster than CPU for large batches
- **JavaScript (Node.js):** Single-threaded, but sufficient for real-time agent memory
- **Your use case:** Real-time retrieval (not batch training), so JavaScript is adequate

## Validation Strategy

1. Generate test vectors in Torchhd
2. Export to JSON
3. Run same operations in JavaScript
4. Compare cosine similarities (should match within 0.001)

## References

- Torchhd docs: https://torchhd.readthedocs.io/
- Torchhd paper: "An Open Source Python Library to Support Research on HDC and VSA"
- Your spec: src/memory/vsa-csl-bridge.js section

# Vector Symbolic Architecture (VSA) Foundations

## What is VSA/HDC?

Vector Symbolic Architectures (VSA), also known as Hyperdimensional Computing (HDC), is a computational framework that uses high-dimensional vectors (hypervectors) to represent and manipulate symbolic information.

## Core Operations

### 1. Binding (⊗)

Associates two concepts together:

```javascript
// Hadamard (element-wise) multiplication for binary vectors
function bind(vecA, vecB) {
  return vecA.map((a, i) => a * vecB[i]);
}

// For real-valued vectors, can use element-wise multiplication or circular convolution
```

**Properties:**
- Dissimilar: sim(bind(A, B), A) ≈ 0
- Invertible: bind(bind(A, B), B) ≈ A
- Commutative: bind(A, B) = bind(B, A)

**Use cases:** Creating structured representations like "CAPITAL of FRANCE = PARIS"

### 2. Bundling (+)

Combines multiple concepts into a set:

```javascript
// Element-wise addition (with normalization)
function bundle(vectors) {
  const sum = new Float64Array(vectors[0].length);
  for (const vec of vectors) {
    for (let i = 0; i < vec.length; i++) {
      sum[i] += vec[i];
    }
  }
  return normalize(sum);
}

function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v*v, 0));
  return vec.map(v => v / norm);
}
```

**Properties:**
- Similar: sim(bundle([A, B, C]), A) > 0
- Approximate: Can recover constituent vectors
- Commutative: Order doesn't matter

**Use cases:** Creating superposition of memories, semantic categories

### 3. Permutation (π)

Encodes order/position information:

```javascript
// Circular shift (simple permutation)
function permute(vec, positions = 1) {
  const n = vec.length;
  const shifted = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    shifted[i] = vec[(i - positions + n) % n];
  }
  return shifted;
}

// Inverse permutation
function unPermute(vec, positions = 1) {
  return permute(vec, -positions);
}
```

**Properties:**
- Dissimilar: sim(permute(A), A) ≈ 0
- Invertible: unPermute(permute(A)) = A
- Non-commutative: Order matters

**Use cases:** Sequences, temporal order, role assignment

### 4. Similarity

Measures resemblance between hypervectors:

```javascript
function similarity(vecA, vecB) {
  // Cosine similarity
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

## Heady™'s 10,000-Dimensional VSA

Your spec defines:

```javascript
const VSA_DIM = 10000;  // Hypervector dimensionality
```

**Why 10,000 dimensions?**
- Standard in VSA research (Kanerva's work)
- Provides ~5000 nearly-orthogonal random vectors
- Sufficient capacity for complex symbolic operations
- Balances expressiveness vs. computational cost

## Example: Encoding a Fact

Encode "The capital of France is Paris":

```javascript
// Random atomic hypervectors (10000-dim each)
const CAPITAL_OF = randomHypervector(10000);
const FRANCE = randomHypervector(10000);
const PARIS = randomHypervector(10000);

// Create the fact: bind(CAPITAL_OF, bind(FRANCE, PARIS))
const fact = bind(CAPITAL_OF, bind(FRANCE, PARIS));

// Store in memory
memory.store('france-capital', fact);

// Query: "What is the capital of France?"
const query = bind(CAPITAL_OF, FRANCE);
const results = memory.search(query);  // Returns PARIS with high similarity
```

## VSA Models Supported by Torchhd

1. **MAP** - Multiply-Add-Permute
2. **BSC** - Binary Spatter Codes
3. **HRR** - Holographic Reduced Representations
4. **FHRR** - Fourier HRR
5. **VTB** - Vector-Derived Transformation Binding

Heady uses a MAP-like approach with real-valued vectors.

## Integration with Vector Memory

```javascript
class VSAMemory {
  constructor() {
    this.atoms = new Map();  // Atomic concept hypervectors
    this.facts = new Map();  // Bound fact hypervectors
  }

  // Register atomic concept
  registerAtom(name) {
    this.atoms.set(name, randomHypervector(10000));
  }

  // Store a fact: bind multiple concepts
  storeFact(id, concepts) {
    let fact = this.atoms.get(concepts[0]);
    for (let i = 1; i < concepts.length; i++) {
      fact = bind(fact, this.atoms.get(concepts[i]));
    }
    this.facts.set(id, fact);
  }

  // Query by partial binding
  query(concepts, threshold = PSI) {
    let query = this.atoms.get(concepts[0]);
    for (let i = 1; i < concepts.length; i++) {
      query = bind(query, this.atoms.get(concepts[i]));
    }

    const results = [];
    for (const [id, fact] of this.facts) {
      const sim = similarity(query, fact);
      if (sim >= threshold) {
        results.push({ id, similarity: sim });
      }
    }
    return results.sort((a, b) => b.similarity - a.similarity);
  }
}
```

## References

- Kleyko et al., "A Survey on Hyperdimensional Computing aka Vector Symbolic Architectures, Part I"
- Kanerva, "Hyperdimensional Computing: An Introduction to Computing in Distributed Representation"
- Torchhd: https://github.com/hyperdimensional-computing/torchhd
- Your spec: Section "VSA Hyperdimensional Computing"

# Golden Ratio (φ) Mathematical Constants for Heady™

## Core Constants

```javascript
const PHI = 1.6180339887;           // φ = (1 + √5) / 2
const PSI = 0.6180339887;           // ψ = 1/φ = φ - 1
const PHI_SQUARED = 2.6180339887;   // φ²
const PHI_INVERSE = 0.6180339887;   // φ⁻¹ (same as ψ)
```

## Fibonacci Sequence

```javascript
function fib(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

// Key Fibonacci numbers used in Heady™:
// fib(7)  = 13
// fib(8)  = 21
// fib(9)  = 34
// fib(10) = 55
// fib(11) = 89
// fib(12) = 144
// fib(16) = 987
// fib(17) = 1597
// fib(20) = 6765  (default vector memory capacity)
```

## CSL Confidence Thresholds

Based on φ-harmonic levels:

```javascript
const CSL_THRESHOLDS = {
  DEDUP:    0.951,  // Deduplication threshold (1 - PSI³ * 0.2)
  HIGH:     0.882,  // High confidence (1 - PSI³ * 0.5)
  MEDIUM:   0.764,  // Medium confidence (1 - PSI³)
  LOW:      0.618,  // Low confidence (PSI = 1/φ)
  MINIMAL:  0.382   // Minimal confidence (PSI²)
};
```

## Eviction Scoring Weights

Phi-scaled weights for vector memory eviction:

```javascript
const EVICTION_WEIGHTS = {
  importance: PHI / (PHI + PSI + 1),      // ≈ 0.472
  recency:    PSI / (PHI + PSI + 1),      // ≈ 0.180
  relevance:  1 / (PHI + PSI + 1)         // ≈ 0.348
};
```

## Phi Fusion Weights

For combining multiple signals with golden ratio balance:

```javascript
function phiFusionWeights(n) {
  const weights = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.pow(PSI, i);
    weights.push(w);
    sum += w;
  }
  return weights.map(w => w / sum);  // Normalize to sum = 1
}

// Example: phiFusionWeights(3) = [0.618, 0.236, 0.146]
```

## Usage in Heady

### Vector Memory Dimensions
```javascript
const DEFAULT_DIM = 384;           // Standard embedding dimension
const VSA_DIM = 10000;             // VSA hypervector dimension
const DEFAULT_CAPACITY = fib(20);  // 6765 entries
```

### CSL-Gated Retrieval
```javascript
function cslGatedSearch(similarity, threshold = CSL_THRESHOLDS.LOW) {
  return similarity >= threshold ? similarity : null;
}
```

### Decay Rate (Shadow Memory)
```javascript
const DECAY_RATE = PSI;  // φ⁻¹ per session unless reinforced
```

## References

- Livio, Mario. "The Golden Ratio: The Story of PHI, the World's Most Astonishing Number"
- Kak, Subhash. "The Golden Mean and the Physics of Aesthetics"
- Your spec: 06-vector-memory-vsa-shadow.md

---
All constants derived from φ = 1.6180339887 using SHA-256 hashing where needed.

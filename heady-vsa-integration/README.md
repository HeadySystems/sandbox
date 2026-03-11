# Heady™ VSA Integration

## Vector Symbolic Architecture for Continuous Semantic Logic

This package integrates **Vector Symbolic Architectures (VSA)** with Heady™'s **Continuous Semantic Logic (CSL)** system, eliminating traditional discrete logic gates in favor of continuous, semantic-aware computation.

---

## 🎯 Overview

Instead of writing scripts with `if/else` statements and traditional Boolean logic, Heady can now process **semantic scripts** where every operation flows through continuous VSA hypervectors.

### Key Concepts

- **Hypervectors**: 4096-dimensional vectors representing semantic concepts
- **Binding**: Compositional operation creating unique combinations (e.g., `HEADY ⊗ SEMANTIC`)
- **Bundling**: Superposition operation creating semantic sets (e.g., `CAT + DOG + BIRD = ANIMALS`)
- **Resonance**: Continuous similarity measure replacing exact matching
- **CSL Gates**: Continuous semantic logic gates using hypervector operations

---

## 📦 Installation

```bash
# From Heady project root
cd heady-vsa-integration
npm install
```

---

## 🚀 Quick Start

### 1. Create a Codebook

```javascript
const { VSACodebook } = require('./src/vsa/codebook');

// Create Heady™-specific codebook with semantic concepts
const codebook = VSACodebook.createHeadyCodebook(4096);

// Add custom concept
codebook.add('MY_CONCEPT', null, { type: 'atomic', domain: 'custom' });
```

### 2. Use VSA Semantic Gates

```javascript
const { VSASemanticGates } = require('./src/vsa/vsa-csl-bridge');

const gates = new VSASemanticGates(codebook);

// Resonance gate (continuous similarity)
const similarity = gates.resonance_gate('HEADY', 'SEMANTIC');
console.log(`Resonance: ${similarity}`); // 0.0-1.0

// Superposition gate (bundle concepts)
const bundle = gates.superposition_gate('CAT', 'DOG', 'BIRD');
const matches = gates.query_gate(bundle, 0.5, 3);
console.log('Bundle matches:', matches);

// Continuous AND/OR (no if/else!)
const result = gates.continuous_and(0.7, 0.8); // 0.56
```

### 3. Write CSL Scripts

Create a `.csl` file:

```csl
# semantic-task.csl
# Define semantic state
@current_state = superposition_gate(INPUT, SEMANTIC, LOGIC)

# Resonance-based decision (NO if/else!)
@gate_match = resonance_gate($current_state, RESONANCE_GATE)
@threshold = soft_gate($gate_match, 0.618, 10)

# Continuous logic composition
@action = continuous_and($threshold, 0.8)
```

Execute it:

```javascript
const { CSLInterpreter } = require('./src/vsa/vsa-csl-bridge');

const script = fs.readFileSync('semantic-task.csl', 'utf8');
const interpreter = new CSLInterpreter(gates);
const result = interpreter.execute(script);
```

---

## 🏗️ Architecture

```
heady-vsa-integration/
├── src/
│   ├── vsa/
│   │   ├── hypervector.js        # Core VSA hypervector implementation
│   │   ├── codebook.js            # Semantic concept management
│   │   ├── vsa-csl-bridge.js     # CSL gate integration
│   │   └── index.js               # Main exports
│   ├── core/
│   │   └── semantic-logic-vsa.js  # Enhanced semantic-logic.js with VSA
│   └── utils/
│       └── logger.js              # Logging utilities
├── test/
│   ├── hypervector.test.js
│   ├── codebook.test.js
│   └── vsa-csl-bridge.test.js
├── examples/
│   ├── basic-vsa-usage.js
│   ├── csl-script-execution.js
│   └── heady-integration.js
└── docs/
    ├── VSA_THEORY.md
    ├── CSL_SCRIPTING.md
    └── INTEGRATION_GUIDE.md
```

---

## 🔬 VSA Operations

### Binding (⊗)

Creates **structured compositions**:

```javascript
const heady_semantic = codebook.bind('HEADY_SEMANTIC', ['HEADY', 'SEMANTIC']);
// HEADY_SEMANTIC ≈ HEADY when queried with SEMANTIC
```

### Bundling (+)

Creates **semantic sets**:

```javascript
const animals = codebook.bundle('ANIMALS', ['CAT', 'DOG', 'BIRD']);
// ANIMALS is similar to CAT, DOG, and BIRD
```

### Permutation (P)

Encodes **sequences**:

```javascript
const sequence = codebook.sequence('ABC', ['A', 'B', 'C']);
// Ordered representation: A → B → C
```

---

## 🎨 CSL Scripting Language

### Syntax

```csl
# Comments start with #

# Variable assignment
@var_name = expression

# Concept reference (uppercase)
HEADY
SEMANTIC_LOGIC

# Gate invocation
resonance_gate(CONCEPT_A, CONCEPT_B)
superposition_gate(C1, C2, C3)

# Variable reference
$var_name

# Numeric literals
0.618
```

### Example: No-Branch Decision Logic

**Traditional (discrete)**:
```javascript
if (confidence > 0.7) {
  if (priority === 'high') {
    action = 'execute';
  } else {
    action = 'queue';
  }
} else {
  action = 'reject';
}
```

**VSA/CSL (continuous)**:
```csl
@conf_gate = soft_gate($confidence, 0.7, 10)
@prio_vec = resonance_gate($priority_state, HIGH_PRIORITY)
@execute_score = continuous_and($conf_gate, $prio_vec)
@queue_score = continuous_and($conf_gate, continuous_not($prio_vec))
@reject_score = continuous_not($conf_gate)

# All paths computed simultaneously, max wins
@action = superposition_gate($execute_score, $queue_score, $reject_score)
```

---

## 📊 Performance

- **Hypervector operations**: O(d) where d = dimensionality (4096)
- **Similarity computation**: ~0.02ms per comparison
- **Gate evaluation**: ~0.05-0.1ms per gate
- **Memory**: ~16KB per hypervector (4096 × 4 bytes)

### Optimization Tips

1. **Reuse codebooks**: Create once, use everywhere
2. **Cache gates**: `VSASemanticGates` caches computed results
3. **Batch operations**: Process multiple queries together
4. **Reduce dimensionality**: 2048d for prototyping, 4096d for production

---

## 🔗 Integration with Existing Heady

### Replace semantic-logic.js gates

```javascript
// OLD: src/core/semantic-logic.js
function resonance_gate(a, b) {
  return Math.min(a, b); // Discrete
}

// NEW: Use VSA gates
const { VSASemanticGates } = require('./vsa/vsa-csl-bridge');
const gates = new VSASemanticGates(codebook);

// Continuous semantic resonance
const resonance = gates.resonance_gate(concept_a, concept_b);
```

### Enhance phi-scales.js

```javascript
// phi-scales.js integration
const phiValue = hypervector.toPhiScale(); // Maps HV to [0, φ]
const phiScale = new PhiScale(phiValue, 0, PHI);
```

---

## 📚 Documentation

- **[VSA_THEORY.md](docs/VSA_THEORY.md)**: Mathematical foundations
- **[CSL_SCRIPTING.md](docs/CSL_SCRIPTING.md)**: Complete CSL language spec
- **[INTEGRATION_GUIDE.md](docs/INTEGRATION_GUIDE.md)**: Step-by-step Heady integration

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Run examples
npm run example:basic
npm run example:csl
npm run example:heady
```

---

## 🎯 Use Cases in Heady

1. **Task Orchestration**: Semantic matching of tasks to agents via resonance
2. **State Management**: Continuous state representation without discrete modes
3. **Pattern Recognition**: Query-based pattern matching in execution history
4. **Adaptive Behavior**: Hypervector evolution based on feedback
5. **Multi-Agent Coordination**: Semantic consensus via bundled agent states

---

## 📖 References

- **VSA Overview**: [A Comparison of Vector Symbolic Architectures](https://arxiv.org/abs/2001.11797)
- **FHRR**: Plate, T. A. (1995). Holographic Reduced Representations
- **Continuous Logic**: [Fuzzy Logic.jl](https://github.com/lucaferranti/FuzzyLogic.jl)
- **Differentiable Logic**: [Differentiable Logic Machines](https://arxiv.org/abs/2102.11529)

---

## 🚀 Roadmap

- [ ] GPU acceleration for large codebooks (via WebGPU)
- [ ] Incremental learning / online codebook updates
- [ ] Type-2 fuzzy VSA gates
- [ ] Distributed codebook sharding across HeadyNodes
- [ ] Visual VSA debugger / inspector

---

## 📄 License

Apache-2.0 © HeadySystems Inc.

---

## 🤝 Contributing

This is part of the Heady™ project. See main repository for contribution guidelines.

**Contact**: eric@headysystems.com

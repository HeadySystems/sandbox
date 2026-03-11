# Heady™ VSA Integration Guide

## Step-by-Step Integration into Existing Heady Project

### Phase 1: Add VSA Core (Week 1)

#### 1.1 Install VSA Package

```bash
cd /path/to/Heady
cp -r heady-vsa-integration/src/vsa src/
cp heady-vsa-integration/src/utils/logger.js src/utils/ # if not exists
```

#### 1.2 Update package.json

Add dependency reference:
```json
{
  "dependencies": {
    "@heady-ai/vsa-core": "file:./src/vsa"
  }
}
```

#### 1.3 Create Default Codebook

```javascript
// src/core/vsa-init.js
const { VSACodebook } = require('../vsa/codebook');
const path = require('path');

let globalCodebook = null;

async function initializeVSA() {
  if (!globalCodebook) {
    const codebookPath = path.join(__dirname, '../../data/heady-codebook.json');

    try {
      globalCodebook = await VSACodebook.load(codebookPath);
      console.log('✅ Loaded existing VSA codebook');
    } catch (err) {
      globalCodebook = VSACodebook.createHeadyCodebook(4096);
      await globalCodebook.save(codebookPath);
      console.log('✅ Created new VSA codebook');
    }
  }

  return globalCodebook;
}

module.exports = { initializeVSA, getCodebook: () => globalCodebook };
```

### Phase 2: Enhance semantic-logic.js (Week 1-2)

#### 2.1 Add VSA Backend Option

```javascript
// src/core/semantic-logic.js (enhanced version)
const { initializeVSA } = require('./vsa-init');
const { VSASemanticGates } = require('../vsa/vsa-csl-bridge');

let vsaGates = null;

async function initSemanticLogic() {
  const codebook = await initializeVSA();
  vsaGates = new VSASemanticGates(codebook);
  console.log('✅ VSA Semantic Logic initialized');
}

// Enhanced gates with VSA backend
function resonance_gate(a, b, useVSA = true) {
  if (useVSA && vsaGates) {
    // VSA continuous semantic resonance
    return vsaGates.resonance_gate(a, b);
  }

  // Fallback: original implementation
  return Math.min(a, b);
}

function superposition_gate(...inputs) {
  if (vsaGates && inputs.every(i => typeof i === 'string')) {
    // VSA bundling
    return vsaGates.superposition_gate(...inputs);
  }

  // Fallback: original
  return inputs.reduce((acc, val) => acc + val, 0) / inputs.length;
}

// Export both versions
module.exports = {
  initSemanticLogic,
  resonance_gate,
  superposition_gate,
  orthogonal_gate: (a, b) => vsaGates ? vsaGates.orthogonal_gate(a, b) : 1 - Math.min(a, b),
  soft_gate: (v, t, s) => vsaGates ? vsaGates.soft_gate(v, t, s) : v > t ? 1 : 0
};
```

#### 2.2 Update Startup Script

```javascript
// src/index.js or main entry point
const { initSemanticLogic } = require('./core/semantic-logic');

async function startup() {
  console.log('🚀 Starting Heady...');

  // Initialize VSA
  await initSemanticLogic();

  // Continue with rest of startup...
}

startup().catch(console.error);
```

### Phase 3: Create .csl Script Format (Week 2)

#### 3.1 Define .csl File Extension

```javascript
// src/vsa/csl-loader.js
const fs = require('fs').promises;
const { CSLInterpreter } = require('./vsa-csl-bridge');
const { getCodebook } = require('../core/vsa-init');
const { VSASemanticGates } = require('./vsa-csl-bridge');

async function loadCSLScript(filepath) {
  const script = await fs.readFile(filepath, 'utf8');
  const codebook = getCodebook();
  const gates = new VSASemanticGates(codebook);
  const interpreter = new CSLInterpreter(gates);

  return { script, interpreter };
}

async function executeCSLScript(filepath) {
  const { script, interpreter } = await loadCSLScript(filepath);
  return interpreter.execute(script);
}

module.exports = { loadCSLScript, executeCSLScript };
```

#### 3.2 Sample .csl Scripts

Create `scripts/semantic-task.csl`:
```csl
# Semantic Task Orchestration
# Replace discrete if/else with continuous semantic flow

@task_vector = superposition_gate(INPUT, HEADY, AGENT)
@orchestrator_match = resonance_gate($task_vector, ORCHESTRATOR)
@conductor_match = resonance_gate($task_vector, CONDUCTOR)

@orchestrate_gate = soft_gate($orchestrator_match, 0.618, 10)
@conduct_gate = soft_gate($conductor_match, 0.618, 10)

@final_decision = continuous_or($orchestrate_gate, $conduct_gate)
```

### Phase 4: Integrate with Existing Nodes (Week 3)

#### 4.1 HeadyOrchestrator Enhancement

```javascript
// src/nodes/heady-orchestrator.js
const { getCodebook } = require('../core/vsa-init');
const { VSASemanticGates } = require('../vsa/vsa-csl-bridge');

class HeadyOrchestrator {
  constructor() {
    this.codebook = getCodebook();
    this.gates = new VSASemanticGates(this.codebook);
    this.taskVectors = new Map(); // task_id -> Hypervector
  }

  async routeTask(task) {
    // Convert task to hypervector
    const taskConcepts = this.extractConcepts(task);
    const taskVector = this.gates.superposition_gate(...taskConcepts);

    // Store for tracking
    this.taskVectors.set(task.id, taskVector);

    // Query for best agent match
    const matches = this.gates.query_gate(taskVector, 0.5, 3);

    // Continuous decision (no if/else!)
    const scores = matches.map(m => ({
      agent: m.name,
      score: m.similarity
    }));

    // Use soft gates for final decision
    const selectedAgent = scores.reduce((best, curr) => 
      curr.score > best.score ? curr : best
    );

    return selectedAgent.agent;
  }

  extractConcepts(task) {
    // Extract semantic concepts from task object
    const concepts = [];

    if (task.type) concepts.push(task.type.toUpperCase());
    if (task.priority) concepts.push('HIGH_PRIORITY');
    if (task.category) concepts.push(task.category.toUpperCase());

    return concepts.filter(c => this.codebook.has(c));
  }
}

module.exports = { HeadyOrchestrator };
```

#### 4.2 HeadyConductor Enhancement

Similar pattern for Heady™Conductor with semantic state management.

### Phase 5: Testing & Validation (Week 3-4)

#### 5.1 Create Test Suite

```javascript
// test/integration/vsa-integration.test.js
const { initSemanticLogic } = require('../../src/core/semantic-logic');
const { executeCSLScript } = require('../../src/vsa/csl-loader');

describe('VSA Integration Tests', () => {
  beforeAll(async () => {
    await initSemanticLogic();
  });

  test('CSL script execution', async () => {
    const result = await executeCSLScript('./scripts/semantic-task.csl');
    expect(result).toBeDefined();
  });

  test('Orchestrator semantic routing', async () => {
    const orchestrator = new HeadyOrchestrator();
    const agent = await orchestrator.routeTask({
      id: 'test-1',
      type: 'SEMANTIC',
      priority: 'high'
    });
    expect(agent).toBeDefined();
  });
});
```

#### 5.2 Performance Benchmarks

```javascript
// test/benchmarks/vsa-performance.test.js
const { Hypervector } = require('../../src/vsa/hypervector');

test('Hypervector operations performance', () => {
  const hv1 = Hypervector.random(4096);
  const hv2 = Hypervector.random(4096);

  const start = performance.now();
  for (let i = 0; i < 1000; i++) {
    hv1.similarity(hv2);
  }
  const end = performance.now();

  const avgTime = (end - start) / 1000;
  console.log(`Average similarity time: ${avgTime.toFixed(4)}ms`);
  expect(avgTime).toBeLessThan(0.1);
});
```

### Phase 6: Gradual Migration (Week 4+)

#### 6.1 Migration Strategy

1. **Identify high-value modules**: Focus on orchestration and decision logic
2. **Parallel execution**: Run both traditional and VSA versions
3. **Validation**: Compare outputs for correctness
4. **Gradual cutover**: Switch one module at a time

#### 6.2 Feature Flags

```javascript
// config/vsa-config.js
module.exports = {
  vsa: {
    enabled: true,
    fallbackEnabled: true, // Keep traditional logic as fallback
    dimensionality: 4096,
    modules: {
      orchestrator: true,
      conductor: true,
      semantic_logic: true
    }
  }
};
```

### Phase 7: Documentation & Training (Ongoing)

#### 7.1 Developer Guide

Create `docs/VSA_DEVELOPER_GUIDE.md`:
- How to add new concepts to codebook
- How to write .csl scripts
- Best practices for semantic logic
- Debugging VSA systems

#### 7.2 Concept Glossary

Maintain `data/concept-glossary.json`:
```json
{
  "HEADY": {
    "description": "Core Heady system concept",
    "type": "atomic",
    "domain": "core"
  },
  "RESONANCE_GATE": {
    "description": "Semantic similarity gate",
    "type": "composite",
    "constituents": ["RESONANCE", "GATE"]
  }
}
```

## Rollback Plan

If issues arise:

1. **Disable VSA via config**: Set `vsa.enabled = false`
2. **Fallback to traditional**: Original semantic-logic.js still works
3. **Gradual re-enable**: Fix issues and re-enable module by module

## Success Metrics

- ✅ VSA gates integrated into semantic-logic.js
- ✅ .csl scripts executable
- ✅ Orchestrator uses semantic routing
- ✅ Performance: <0.1ms per gate operation
- ✅ Accuracy: >95% task routing correctness
- ✅ Memory: <100MB codebook size

## Next Steps

After successful integration:

1. **Expand codebook**: Add domain-specific concepts
2. **Train VSA**: Learn optimal concept vectors from data
3. **Optimize**: GPU acceleration for large codebooks
4. **Scale**: Distributed codebook across HeadyNodes

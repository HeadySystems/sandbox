---
description: Imagination Engine - Autonomous concept generation and IP discovery for Heady
---

# Heady Imagination Engine Workflow

## Overview

The Imagination Engine is Heady's autonomous concept generation system based on DABUS/Imagination Engines architecture. It generates novel concepts through structured recombination of primitives, evaluates them for novelty/usefulness/risk, and can draft IP materials.

## Core Philosophy

1. **Autonomous but Guided**: The engine generates concepts autonomously but within value constraints (safety, ethics, mission alignment)
2. **Human-in-the-Loop**: AI generates candidates; humans validate, refine, and claim IP
3. **Continuous Learning**: Primitive weights and operator preferences update based on outcomes
4. **IP-Aware**: All concepts are evaluated for patentability and appropriate IP posture

## Quick Start

### 1. Initialize the Engine

```javascript
const { imagination } = require('./src/hc_imagination');
await imagination.init();
```

### 2. Add Primitives

Primitives are building blocks for concept generation:

```javascript
// Add from code
await imagination.extractPrimitives(sourceCode, 'code');

// Add manually
imagination.addPrimitive('mechanism', 'Fractal branching for load distribution', 'design_pattern', ['scalability', 'fractal']);
imagination.addPrimitive('constraint', 'Must work offline', 'requirement', ['offline', 'resilience']);
```

### 3. Generate Concepts

```javascript
// Run imagination cycle
const concepts = await imagination.imagine(5);

// Concepts are auto-evaluated for novelty, usefulness, risk
console.log(concepts.map(c => ({
  title: c.title,
  novelty: c.scores.novelty,
  usefulness: c.scores.usefulness,
  risk: c.scores.risk
})));
```

### 4. Use Recombination Operators

```javascript
const primA = imagination.primitives.get('prim_xxx');
const primB = imagination.primitives.get('prim_yyy');

// Blend two primitives
const blended = imagination.blend(primA, primB);

// Extend existing concept
const extended = imagination.extend(existingConcept, newPrimitive);

// Invert a primitive
const inverted = imagination.invert(primA);

// Morph between concepts
const morphed = imagination.morph(conceptA, conceptB, 0.5);
```

### 5. Create IP Packages

```javascript
// Search prior art
const priorArt = await imagination.searchPriorArt(conceptId);

// Create IP package
const ipPackage = await imagination.createIPPackage(conceptId);

// Review IP posture
console.log(ipPackage.ip_posture); // 'patent', 'open_license', 'defensive_publication', 'trade_secret'
```

## Recombination Operators

### BLEND(A, B)
Merges two primitives into a hybrid concept.
- Use when: Combining technologies from different domains
- Example: BLEND('blockchain', 'voting_system') -> 'decentralized voting'

### SUBSTITUTE(Concept, NewPrimitive)
Replaces one primitive in a concept with another.
- Use when: Iterating on a design by swapping components
- Example: SUBSTITUTE('cloud_storage_concept', 'edge_storage') -> 'edge-first storage'

### EXTEND(Concept, NewPrimitive)
Adds a new capability to an existing concept.
- Use when: Enhancing existing ideas with new features
- Example: EXTEND('chat_app', 'voice_synthesis') -> 'voice-enabled chat'

### INVERT(Primitive)
Flips assumptions of a primitive.
- Use when: Exploring contrarian approaches
- Example: INVERT('centralized') -> 'fully distributed'

### MORPH(A, B, alpha)
Creates intermediate form between two concepts.
- Use when: Finding middle-ground solutions
- Example: MORPH('local_ai', 'cloud_ai', 0.5) -> 'hybrid AI with edge compute'

## Evaluation System

### Novelty Score (0-1)
Calculated as inverse of maximum similarity to existing concepts.
- >0.8: Highly novel, may be patentable
- 0.6-0.8: Moderately novel, likely distinct
- <0.6: Similar to existing work

### Usefulness Score (0-1)
Based on:
- Track record of source primitives (success/fail counts)
- Number of identified applications
- Domain relevance

### Risk Score (0-1)
Checks against:
- **Hard Constraints** (auto-discard if violated):
  - no_weapons
  - no_surveillance_exploitation
  - no_discriminatory_systems
  - no_environmental_harm
  - no_human_rights_abuse

- **Amber Zones** (elevated risk, requires review):
  - surveillance_technology
  - automated_decision_making
  - biometric_systems
  - social_scoring

## Hot Concept Protocol

Concepts scoring:
- Novelty > 0.8
- Usefulness > 0.7
- Risk < 0.3

are marked as "hot" and prioritized for:
1. Elaboration and refinement
2. IP package creation
3. Human review
4. Notification to other Heady systems (self-critique, pattern engine)

## Meta-Learning

The engine learns from outcomes:

```javascript
// Provide feedback on concept
imagination.updatePrimitiveWeights(conceptId, success=true);
imagination.updateOperatorStats('BLEND', success=true);
```

Successful concepts boost primitive weights by 1.2x.
Failed concepts decay weights by 0.8x.
Operator statistics influence operator selection probability.

## IP Discovery Workflow

### 1. Prior Art Search
```javascript
const priorArt = await imagination.searchPriorArt(conceptId);
```

### 2. Claim Drafting
System generates:
- Independent system claim
- Method claim
- Computer-readable medium claim

### 3. IP Posture Selection
Based on:
- Novelty score (>0.8 favors patent)
- Prior art similarity (>0.7 favors defensive publication)
- Social impact (>0.8 favors open license)

### 4. Human Review
IP packages require human review before filing:
```javascript
ipPackage.human_review_status = 'pending' | 'approved' | 'rejected';
```

## API Endpoints

### Primitives
- `POST /api/imagination/primitives` - Add primitives
- `GET /api/imagination/primitives` - List primitives
- `POST /api/imagination/extract-primitives` - Extract from source

### Concepts
- `POST /api/imagination/imagine` - Generate concepts
- `GET /api/imagination/concepts` - List concepts
- `GET /api/imagination/concepts/:id` - Get concept details
- `POST /api/imagination/concepts/:id/evaluate` - Re-evaluate
- `POST /api/imagination/concepts/:id/feedback` - Provide feedback

### Operators
- `POST /api/imagination/operators/blend`
- `POST /api/imagination/operators/substitute`
- `POST /api/imagination/operators/extend`
- `POST /api/imagination/operators/invert`
- `POST /api/imagination/operators/morph`

### IP
- `POST /api/imagination/concepts/:id/prior-art`
- `POST /api/imagination/concepts/:id/ip-package`
- `GET /api/imagination/ip-packages`

### System
- `GET /api/imagination/stats` - System statistics
- `POST /api/imagination/auto-cycle` - Run full cycle
- `POST /api/imagination/tournament` - Compare concepts
- `POST /api/imagination/safety-check` - Check safety

## Configuration

Edit `configs/imagination-engine.yaml`:

```yaml
recombination:
  interval_minutes: 30
  concepts_per_batch: 5

thresholds:
  novelty: 0.6
  usefulness: 0.5
  risk_max: 0.7
  hot_novelty: 0.8
  hot_usefulness: 0.7

safety:
  hard_constraints: [...]
  amber_zones: [...]

mission:
  preferred_tags: ["social_impact", "equity", "accessibility"]
  boost_tags:
    social_impact: 0.1
    equity: 0.15
```

## For Coding Agents: How to Use Imagination

### After Each Task
1. **Extract Primitives**: From the code you just wrote, extract reusable patterns
   ```javascript
   await imagination.extractPrimitives(code, 'code');
   ```

2. **Generate Concepts**: Run imagination to combine primitives
   ```javascript
   await imagination.imagine(3);
   ```

3. **Check Hot Concepts**: See if anything valuable emerged
   ```javascript
   const hot = imagination.getHotConcepts();
   if (hot.length > 0) {
     // Present to human for review
   }
   ```

### Before Starting New Work
1. **Query Top Concepts**: Check existing ideas that might help
   ```javascript
   const top = imagination.getTopConcepts(5, 'refined');
   ```

2. **Use as Inspiration**: Blend or extend relevant concepts

### For IP Discovery
1. **Mark Interesting Concepts**: When you find something novel
   ```javascript
   await imagination.createIPPackage(conceptId);
   ```

2. **Check Safety**: Always run safety check before presenting
   ```javascript
   await imagination.evaluateConcept(concept);
   if (concept.scores.risk > 0.7) {
     // Flag for human review
   }
   ```

## Testing Imagination

### Unit Tests
```javascript
// Test operator
const concept = imagination.blend(primA, primB);
assert(concept.primitive_ids.length === 2);

// Test evaluation
await imagination.evaluateConcept(concept);
assert(concept.scores.novelty >= 0);
assert(concept.scores.novelty <= 1);
```

### Integration Tests
```javascript
// Full cycle
await imagination.init();
const primitives = [
  imagination.addPrimitive('mechanism', 'A', 'test'),
  imagination.addPrimitive('mechanism', 'B', 'test')
];
const concepts = await imagination.imagine(5);
assert(concepts.length > 0);
```

## Mission Alignment

The Imagination Engine is designed to:
1. **Maximize global happiness**: Prefer concepts that increase well-being
2. **Enable fair wealth redistribution**: Boost equity-related concepts
3. **Be safe and ethical**: Hard constraints prevent harmful outputs
4. **Be transparent**: All reasoning is logged and auditable

## Next Steps

1. Start extracting primitives from your codebase
2. Run initial imagination cycles
3. Review hot concepts
4. Create IP packages for novel ideas
5. Provide feedback to train the system

---
*Heady Imagination Engine - Sacred Geometry Architecture*

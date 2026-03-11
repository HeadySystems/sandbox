---
name: heady-cognitive-runtime
description: Use when working with cognitive operations control, runtime governance, ternary logic operations, spatial mapping for 3D vector space, rulez gatekeeper enforcement, semantic contextualizer, or spatial context engine in the Heady™ ecosystem. Keywords include cognitive, runtime, governor, ternary logic, spatial mapping, rulez, gatekeeper, semantic context, cognitive controller, and intelligent process management.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Cognitive Runtime

## When to Use This Skill

Use this skill when the user needs to:
- Implement cognitive operations control flows
- Configure the runtime governor for process management
- Use ternary logic (true/false/unknown) instead of binary
- Work with spatial mapping for 3D vector operations
- Set up the rulez gatekeeper for rule enforcement
- Enrich context with the semantic contextualizer

## Module Map

| Module | Path | Role |
|---|---|---|
| cognitive-operations-controller | src/orchestration/cognitive-operations-controller.js | Central cognitive process manager |
| cognitive-runtime-governor | src/orchestration/cognitive-runtime-governor.js | Runtime governance and throttling |
| ternary-logic | src/orchestration/ternary-logic.js | Three-valued logic system |
| spatial-mapping | src/orchestration/spatial-mapping.js | 3D spatial coordinate mapping |
| rulez-gatekeeper | src/orchestration/rulez-gatekeeper.js | Rule evaluation and enforcement |
| semantic-contextualizer | src/engines/semantic-contextualizer.js | Semantic context enrichment |
| spatial-context-engine | src/engines/spatial-context-engine.js | Spatial context for 3D ops |

## Instructions

### Cognitive Operations Controller
1. The controller manages the cognitive pipeline: perceive -> reason -> act -> reflect.
2. Each stage has a CSL-gated quality threshold.
3. Stages can be parallelized when their dependency DAG allows.
4. Self-critique loops run after each act() stage.
5. Reflection updates the continuous learning model.

### Runtime Governor
1. Governs resource allocation across cognitive processes.
2. Uses phi-scaled priority levels (1.0, 1.618, 2.618, 4.236).
3. Implements backpressure when cognitive load exceeds threshold.
4. Auto-scales reasoning depth based on task complexity score.

### Ternary Logic System
Unlike binary (true/false), ternary logic adds an "unknown" state:
- TRUE (1.0): Confirmed with high confidence
- UNKNOWN (0.5): Insufficient evidence, needs more data
- FALSE (0.0): Confirmed negative

Operations:
- AND: min(a, b) — both must be true
- OR: max(a, b) — either can be true  
- NOT: 1.0 - a — inversion
- IMPLIES: max(1.0 - a, b) — logical implication

This extends naturally to CSL continuous gates where 0.0-1.0 are all valid states.

### Spatial Mapping
- Maps concepts to 3D coordinates using phi-scaled positioning.
- Clusters form Sacred Geometry patterns (tetrahedron, cube, octahedron).
- Distance = semantic dissimilarity; proximity = relatedness.
- Navigation uses vector projection along reasoning paths.

### Rulez Gatekeeper
- Evaluates governance rules before any action executes.
- Rules are CSL expressions, not boolean conditions.
- Priority: security > governance > quality > performance.
- Violation triggers: log, warn, block, escalate (phi-scored severity).

## Output Format

- Cognitive Pipeline State
- Governor Resource Allocation
- Ternary Logic Evaluation
- Spatial Map Coordinates
- Rule Evaluation Results

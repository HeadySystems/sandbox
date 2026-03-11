# Migration Guide: Heady™ System v3.x → v4.0.0

> **Date**: 2026-03-08
> **Author**: HeadySystems Inc.
> **Scope**: Pipeline, Auto-Success Engine, Configs, Crypto, Cognitive Integration

---

## Overview

This release resolves 8 critical findings identified during the deep scan of the
HeadyMe pre-production repository and attached specification files. The changes
bring all components into alignment with MASTER_DIRECTIVES v2.0.0 and establish
a single source of truth for the Liquid Dynamic Latent OS.

---

## Breaking Changes

### 1. Pipeline Stage Count: 9 → 21

**Before (v3.x):**
```
INTAKE → TRIAGE → MONTE_CARLO → ARENA → JUDGE → APPROVE → EXECUTE → VERIFY → RECEIPT
(9 stages in hc-full-pipeline.js)
```

**After (v4.0.0):**
```
CHANNEL_ENTRY → RECON → INTAKE → CLASSIFY → TRIAGE → DECOMPOSE → TRIAL_AND_ERROR →
ORCHESTRATE → MONTE_CARLO → ARENA → JUDGE → APPROVE → EXECUTE → VERIFY →
SELF_AWARENESS → SELF_CRITIQUE → MISTAKE_ANALYSIS → OPTIMIZATION_OPS →
CONTINUOUS_SEARCH → EVOLUTION → RECEIPT
(21 stages = fib(8) — Sacred Geometry aligned)
```

**Migration Steps:**
1. Replace `require('./hc-full-pipeline')` with `require('./hc-full-pipeline-v3')`
2. Update any code that references `STAGES.length === 9` to `=== 21`
3. Update stage index references (APPROVE was index 5, now index 11)
4. Update SSE/WebSocket consumers to handle new stage events
5. The old `hc-full-pipeline.js` is preserved but deprecated

### 2. Retry Backoff: 2x → φ (1.618)

**Before:**
```json
"retryPolicy": { "backoffMultiplier": 2, "backoffMs": 1000 }
// Sequence: 1000, 2000, 4000
```

**After:**
```json
"retryPolicy": { "backoffMultiplier": 1.618, "backoffMs": 1000, "sequence": [1618, 2618, 4236] }
```

**Migration Steps:**
1. Replace the `configs/hcfullpipeline.json` with the v4.0.0 version
2. Any code using `Math.pow(2, attempt)` for backoff must use `phiBackoff()` from `shared/phi-math.js`
3. Hardcoded retry sequences (1000, 2000, 4000) → (1618, 2618, 4236)

### 3. Auto-Success Category Names

**Before (TypeScript):**
```
HealthChecks, ResourceOptimization, QualityGates, SecurityScans,
PerformanceMonitoring, DataSync, BackupValidation, CostOptimization, LearningEvents
```

**After (canonical LAW-07):**
```
CodeQuality, Security, Performance, Availability, Compliance,
Learning, Communication, Infrastructure, Intelligence
```

**Migration Steps:**
1. Replace `auto-success-engine.ts` with the v3.0.0 canonical version
2. Update any dashboards or metrics that reference old category names
3. Update observability-kernel category filters
4. The canonical names are exported as `AUTO_SUCCESS.CATEGORY_NAMES` from `shared/phi-math.js`

### 4. Receipt Signing: UUID → Ed25519

**Before:**
```javascript
_stageReceipt(run) {
  return { receiptId: crypto.randomUUID(), ... };
}
```

**After:**
```javascript
_stageReceipt(run) {
  const receiptData = { receiptId, runId, stages, winner, ... };
  return this.receiptSigner.sign(receiptData);
  // Returns: { receipt, signature: { algorithm: 'Ed25519', value: hex, keyId } }
}
```

**Migration Steps:**
1. Generate an initial keypair: `const km = new KeyRotationManager(); km.initialize();`
2. Pass `receiptSigner` to HCFullPipeline constructor
3. Store the public key for external verification
4. Receipt consumers must now verify `signature.value` using the public key
5. Set up key rotation schedule (recommended: weekly)

### 5. Judge Scoring: Random → Weighted CSL

**Before:**
```javascript
criteria: {
  correctness: +(rng() * 20 + 80).toFixed(1),  // RANDOM!
  quality: +(rng() * 20 + 75).toFixed(1),       // RANDOM!
}
```

**After:**
```javascript
const { judgeArenaResults } = require('../scoring/csl-judge-scorer');
// Uses JUDGE_WEIGHTS: correctness(34%), safety(21%), perf(21%), quality(13%), elegance(11%)
```

**Migration Steps:**
1. No external API changes — Judge stage output format is the same
2. Scores are now deterministic based on actual criteria evaluation
3. The `criteria` field in judge results now reflects real weighted scores

### 6. Cognitive Layer Integration

**Before:** 7 layers defined in `heady-cognitive-config.json` with zero pipeline integration.

**After:** `CognitiveFusion` engine runs all 7 layers in parallel and injects insights into every pipeline stage via `createPipelineHook()`.

**Migration Steps:**
1. Update `heady-cognitive-config.json` to v2.1.0 (adds `integration` fields)
2. Instantiate `CognitiveFusion` and pass to pipeline constructor as `cognitiveFusion`
3. Each stage result now includes `_cognitiveMetadata` with layer insights

---

## New Files

| File | Purpose |
|------|---------|
| `shared/phi-math.js` v2.0.0 | Enhanced with JUDGE_WEIGHTS, AUTO_SUCCESS, PIPELINE_STAGES, COGNITIVE_LAYERS, STAGE_TIMEOUTS, PIPELINE_PATHS, and more |
| `src/orchestration/hc-full-pipeline-v3.js` | 21-stage pipeline implementation |
| `src/orchestration/auto-success-engine.ts` | Canonical LAW-07 Auto-Success Engine |
| `src/scoring/csl-judge-scorer.js` | Weighted criteria scoring for Judge stage |
| `src/crypto/ed25519-receipt-signer.js` | Cryptographic receipt signing |
| `src/cognitive/cognitive-layer-integration.js` | 7 cognitive layers wired into pipeline |
| `configs/hcfullpipeline.json` v4.0.0 | Corrected JSON config (21 stages, phi-backoff) |
| `configs/hcfullpipeline.yaml` v4.0.0 | Corrected YAML config (unified naming) |
| `configs/heady-cognitive-config.json` v2.1.0 | Cognitive config with integration hooks |

## Deprecated Files

| File | Replacement | Action |
|------|-------------|--------|
| `src/orchestration/hc-full-pipeline.js` | `hc-full-pipeline-v3.js` | Deprecate, keep for reference |
| `src/orchestration/hc-full-pipeline-v2.js` | `hc-full-pipeline-v3.js` | Remove |
| `src/bees/bee-factory-v2.js` | Merge into `bee-factory.js` | Consolidate |
| `src/resilience/circuit-breaker-v2.js` | Merge into `circuit-breaker.js` | Consolidate |

---

## Dependency Graph

```
shared/phi-math.js (v2.0.0) ← FOUNDATION — everything imports from here
  ├── src/scoring/csl-judge-scorer.js
  ├── src/crypto/ed25519-receipt-signer.js
  ├── src/cognitive/cognitive-layer-integration.js
  ├── src/orchestration/auto-success-engine.ts
  └── src/orchestration/hc-full-pipeline-v3.js
        ├── imports csl-judge-scorer
        ├── imports ed25519-receipt-signer
        └── imports cognitive-layer-integration
```

---

## Initialization Example

```javascript
const { KeyRotationManager } = require('./src/crypto/ed25519-receipt-signer');
const { CognitiveFusion } = require('./src/cognitive/cognitive-layer-integration');
const HCFullPipeline = require('./src/orchestration/hc-full-pipeline-v3');

// 1. Initialize receipt signing
const receiptSigner = new KeyRotationManager();
receiptSigner.initialize();

// 2. Initialize cognitive fusion
const cognitiveFusion = new CognitiveFusion({
  minConfidence: 0.7,
  mode: 'PARALLEL',
  conflictResolution: 'WEIGHTED_SYNTHESIS',
});

// 3. Create the pipeline
const pipeline = new HCFullPipeline({
  vectorMemory: myVectorMemory,      // your pgvector/vector memory instance
  selfAwareness: mySelfAwareness,    // your self-awareness module
  monteCarlo: myMonteCarloEngine,    // your Monte Carlo simulator
  cognitiveFusion,
  receiptSigner,
});

// 4. Run a task through the full 21-stage pipeline
const run = pipeline.createRun({
  task: 'Implement user authentication module',
  taskType: 'code',
  riskLevel: 'MEDIUM',
  path: 'FULL',  // or 'FAST', 'ARENA', 'LEARNING'
});

const result = await pipeline.execute(run.id);
console.log(`Pipeline completed: ${result.status}`);
console.log(`Receipt signed: ${result.result?.signature?.algorithm}`);
```

---

## Verification Checklist

After migration, verify:

- [ ] Pipeline executes all 21 stages in order
- [ ] Retry delays follow phi-backoff (1618, 2618, 4236 ms)
- [ ] Auto-Success Engine uses 9 canonical category names
- [ ] Judge stage produces weighted scores (not random)
- [ ] Receipt stage produces Ed25519-signed receipts
- [ ] Cognitive layers are active in pipeline processing
- [ ] `shared/phi-math.js` is the ONLY source of PHI/PSI constants
- [ ] No module defines PHI or PSI locally
- [ ] All 4 pipeline paths work (FAST, FULL, ARENA, LEARNING)
- [ ] Self-healing protocol queries vector memory for resolutions

---

*Heady™ — HeadySystems Inc. — All Rights Reserved — 60+ Provisional Patents.*

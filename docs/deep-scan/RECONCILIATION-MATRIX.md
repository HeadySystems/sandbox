---
title: "Heady™ Cross-File Reconciliation Matrix"
version: "1.0.0"
date: "2026-03-08"
scope: "All config, law, code, and pipeline files"
---

# Cross-File Reconciliation Matrix

## Constant Alignment (After Audit)

| Constant | phi-math.ts | engine.ts | config.json | pipeline.json | LAW-07.md | DIRECTIVES.md | YAML |
|----------|-------------|-----------|-------------|---------------|-----------|---------------|------|
| Cycle interval | 29,034ms | ✅ | ✅ | ✅ | ✅ | ⚠️ Says 30s | ⚠️ N/A |
| Categories | 13 | ✅ | ✅ | N/A | ✅ | ⚠️ Says 9 | N/A |
| Total tasks | 144 | ✅ | ✅ | N/A | ✅ | ⚠️ Says 135 | N/A |
| Tasks/category | 11 | ✅ | N/A | N/A | ✅ | ⚠️ Says 15 | N/A |
| Pipeline stages | 21 | N/A | ✅ | ✅ (21) | N/A | ✅ | ✅ |
| CSL threshold | 0.618 | ✅ | ✅ | ✅ | N/A | ✅ | ✅ |
| Retry backoff | φ-exponential | ✅ | N/A | ✅ | ✅ | ✅ | ⚠️ [500,2k,8k] |
| min_confidence | 0.618 | N/A | ✅ | N/A | N/A | N/A | N/A |
| Vector dims | 384 | N/A | ✅ | N/A | N/A | ✅ | N/A |

**⚠️ = Needs manual update in repo (MASTER_DIRECTIVES.md references "30-second cycle" and "135 tasks" and "9 categories" — these are hardcoded prose references that should match the new φ-scaled values)**

## Stage Mapping (MASTER_DIRECTIVES ↔ Pipeline JSON v4.0.0)

| # | MASTER_DIRECTIVES Name | JSON Stage ID | JSON Order | Status |
|---|----------------------|---------------|-----------|--------|
| 0 | CHANNEL_ENTRY | stage_channel_entry | 0 | ✅ Aligned |
| 1 | RECON | stage_recon | 1 | ✅ Aligned |
| 2 | INTAKE | stage_intake | 2 | ✅ Aligned |
| 3 | CLASSIFY | stage_memory | 3 | ✅ (memory retrieval includes classification) |
| 4 | TRIAGE | stage_triage | 4 | ✅ Aligned |
| 5 | DECOMPOSE | stage_decompose | 5 | ✅ Aligned |
| 6 | TRIAL_AND_ERROR | stage_trial_and_error | 6 | ✅ Aligned |
| 7 | ORCHESTRATE | stage_orchestrate | 7 | ✅ Aligned |
| 8 | MONTE_CARLO | stage_monte_carlo | 8 | ✅ Aligned |
| 9 | ARENA | stage_arena | 9 | ✅ Aligned |
| 10 | JUDGE | stage_judge | 10 | ✅ Aligned |
| 11 | APPROVE | stage_approve | 11 | ✅ Aligned |
| 12 | EXECUTE | stage_execute_verified | 12 | ✅ Aligned |
| 13 | VERIFY | stage_verify | 13 | ✅ Aligned |
| 14 | SELF_AWARENESS | stage_self_awareness | 14 | ✅ Aligned |
| 15 | SELF_CRITIQUE | stage_self_critique | 15 | ✅ Aligned |
| 16 | MISTAKE_ANALYSIS | stage_mistake_analysis | 16 | ✅ Aligned |
| 17 | OPTIMIZATION_OPS | stage_optimization_ops | 17 | ✅ Aligned |
| 18 | CONTINUOUS_SEARCH | stage_continuous_search | 18 | ✅ Aligned |
| 19 | EVOLUTION | stage_evolution | 19 | ✅ Aligned |
| 20 | RECEIPT | stage_receipt | 20 | ✅ Aligned |

## Pipeline Variant Mapping

| Variant | MASTER_DIRECTIVES Stages | JSON v4.0.0 | Status |
|---------|------------------------|-------------|--------|
| Fast Path | 0-1-2-7-12-13-20 | ✅ Matched | ✅ |
| Full Path | All 21 stages | ✅ Matched | ✅ |
| Arena Path | 0-1-2-3-4-8-9-10-20 | ✅ Matched | ✅ |
| Learning Path | 0-1-16-17-18-19-20 | ✅ Matched | ✅ |

## Timeout Alignment

| Stage | YAML (φ-derived) | JSON v4.0.0 | Match? |
|-------|------------------|-------------|--------|
| Recon | 6,854 (φ⁴) | 6,854 | ✅ |
| Trial & Error | 17,944 (φ⁶) | 17,944 | ✅ |
| Self-Awareness | 11,090 (φ⁵) | 11,090 | ✅ |
| Mistake Analysis | 11,090 (φ⁵) | 11,090 | ✅ |
| Optimization Ops | 17,944 (φ⁶) | 17,944 | ✅ |
| Continuous Search | 29,034 (φ⁷) | 29,034 | ✅ |
| Evolution | 29,034 (φ⁷) | 29,034 | ✅ |

## Remaining Manual Updates (Not in Deliverable)

1. **MASTER_DIRECTIVES.md** — Update prose references:
   - "135 background tasks" → "fib(12) = 144 background tasks"
   - "9 categories" → "fib(7) = 13 categories"
   - "30-second cycle" → "φ⁷ × 1000 = 29,034ms cycle"
   - "15 tasks each" → "11 tasks each"

2. **UNBREAKABLE_LAWS.md** — Same prose updates (lines 200, 372-373, 391)

3. **SYSTEM_PRIME_DIRECTIVE.md** — Same prose updates (line 111)

4. **README.md** — Same prose updates (line 33)

5. **hcfullpipeline.yaml** — Update retry backoff:
   - `retryBackoffMs: [500, 2000, 8000]` → `[1618, 2618, 4236]`

6. **8 src/ modules** — Replace hardcoded `30000` with import from `shared/phi-math`

---

*Heady™ — HeadySystems Inc. — All Rights Reserved — 60+ Provisional Patents.*

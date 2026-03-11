# STAGE 17: OPTIMIZATION_OPS — Optimization Ops Scanning

> **Pipeline Position**: Stage 17 (after MISTAKE_ANALYSIS, before CONTINUOUS_SEARCH)
> **Timeout**: 17944ms (φ⁶ × 1000)
> **Parallel**: Yes
> **Required**: Yes

---

## Purpose

Active scanning for system-wide optimization opportunities. Find and rank
everything that's wasteful, slow, dead, or suboptimal. The system doesn't
just run — it constantly searches for ways to run BETTER.

## Cycle

```
scan → profile → identify → rank → recommend
```

## Scan Targets

### 1. Service Performance Profiling

- Measure p50 / p95 / p99 latency for every service
- Profiling window: **fib(10) = 55 minutes**
- Flag services with p99 > 2× expected latency

### 2. Dead Code Detection

- Method: **AST Reachability Analysis**
- Parse all source files, build call graph, find unreachable functions
- Ignore patterns: `test/**`, `__mocks__/**`, `*.spec.*`
- Report: function name, file, last called date (if available)

### 3. Unused Services

- Identify services with **zero traffic** in the profiling window
- Cross-reference with site-registry.yaml — is the service supposed to be active?
- Flag "ghost services" — deployed but never called

### 4. Unused Endpoints

- Identify API endpoints that were never called in the profiling window
- Cross-reference with API documentation — is the endpoint documented?
- Flag undocumented + uncalled endpoints as removal candidates

### 5. Cost Per Request Analysis

- Calculate $/request for each AI provider route
- Target: **$0.001/request**
- Flag routes exceeding target by > 2×
- Suggest cheaper provider alternatives

### 6. Over-Provisioned Instances

- Cloud Run instances with average CPU utilization < **fib(7)/100 = 0.13**
- These instances are wasting money — suggest scaling down

### 7. Under-Utilized Workers

- Workers with < 13% utilization = under-utilized
- Suggest consolidation or removal

### 8. Redundant Data

- Duplicate embeddings in vector memory
- Stale vector entries (> fib(7) = 13 days without access)
- Orphaned database records

### 9. Suboptimal Configurations

- Configs not using φ-scaling
- Magic numbers instead of Fibonacci/φ constants
- Hardcoded timeouts instead of φ-power calculations

## Impact Scoring

Rank each optimization opportunity using CSL-weighted impact score:

| Weight | Metric |
|--------|--------|
| 0.382 | Cost reduction impact |
| 0.382 | Performance improvement impact |
| 0.236 (1/φ²) | Reliability improvement impact |

## Output

```json
{
  "optimizationOpportunities": int,
  "topRecommendations": [
    { "type": str, "target": str, "impact": float, "effort": str, "savings": str }
  ],
  "servicePerformance": { "healthy": int, "degraded": int, "critical": int },
  "deadCode": { "functions": int, "files": int, "estimatedLines": int },
  "unusedServices": [str],
  "unusedEndpoints": [str],
  "costOutliers": [{ "route": str, "costPerReq": float, "suggestion": str }],
  "overProvisioned": [{ "service": str, "utilization": float }],
  "redundantData": { "duplicateEmbeddings": int, "staleEntries": int }
}
```

## Sacred Rules

- Profiling window: fib(10) = 55 minutes
- Utilization floor: fib(7)/100 = 0.13 (below = under-utilized)
- Utilization ceiling: fib(11)/100 = 0.89 (above = bottleneck)
- Budget alert: 61.8% consumption (1/φ)
- Cost target: $0.001/request
- Impact weights: φ-derived (0.382, 0.382, 0.236)
- Timeout: φ⁶ × 1000 = 17944ms

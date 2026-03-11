# Claude Heady Diagnostics Skill

> **Trigger:** "diagnose heady", "heady health", "system check", "what's wrong with heady", "heady status", "debug heady"

## Purpose

Deep diagnostic analysis of the entire Heady ecosystem. Scans services, configs, dependencies, secrets, git state, merge conflicts, and code quality to produce actionable health reports.

## Capabilities

1. **Full System Scan** — Run all diagnostic tools concurrently for maximum speed
2. **Service Health** — Ping all 58 services, report latency and availability
3. **Config Validation** — Cross-validate 93+ YAML/JSON configs for consistency
4. **Dependency Audit** — Scan for outdated, duplicate, or vulnerable packages
5. **Secrets Audit** — Detect exposed secrets, missing env vars, empty values
6. **Git State** — Check for conflicts, uncommitted changes, branch drift
7. **Code Quality** — Dead imports, console.logs, whitespace issues
8. **Pattern Evaluation** — Assess which patterns are implemented vs planned

## Diagnostic Sequence

```
┌─────────────────────────────────────────┐
│          HEADY DIAGNOSTICS              │
├─────────────────────────────────────────┤
│  PARALLEL SCAN (all run concurrently):  │
│  ├─ heady_status                        │
│  ├─ heady_health_ping                   │
│  ├─ heady_config_validate               │
│  ├─ heady_deps_scan                     │
│  ├─ heady_env_audit                     │
│  ├─ heady_secrets_scan                  │
│  ├─ heady_git_status                    │
│  ├─ heady_conflicts_scan                │
│  ├─ heady_codelock_detect               │
│  ├─ heady_brain_status                  │
│  └─ heady_cost_report                   │
├─────────────────────────────────────────┤
│  SEQUENTIAL ANALYSIS:                   │
│  ├─ Correlate findings                  │
│  ├─ Calculate ORS score                 │
│  ├─ Generate recommendations            │
│  └─ Record to latent space              │
└─────────────────────────────────────────┘
```

## Output Format

### Health Score Card

| Dimension | Score | Status |
|-----------|-------|--------|
| Services  | X/100 | Healthy/Degraded/Down |
| Configs   | X/100 | Valid/Warnings/Errors |
| Security  | X/100 | Clean/Exposed/Critical |
| Git       | X/100 | Clean/Dirty/Conflicts |
| Code      | X/100 | Clean/Issues/Blockers |

## Usage

```
/claude-heady-diagnostics
/claude-heady-diagnostics --focus security
/claude-heady-diagnostics --service heady-conductor
```

## MCP Tools Used

- `heady_status`, `heady_health_ping`, `heady_config_validate`
- `heady_deps_scan`, `heady_env_audit`, `heady_secrets_scan`
- `heady_git_status`, `heady_conflicts_scan`, `heady_codelock_detect`
- `heady_brain_status`, `heady_cost_report`, `heady_patterns_list`
- `heady_latent_record` (for logging findings)

---
title: "Directive 01: Omnipresent Contextual Awareness"
domain: master-directive
directive_number: 1
semantic_tags: [awareness, context, ecosystem-state, health-check, memory-recall, pre-action-scan]
enforcement: MANDATORY
---

# DIRECTIVE 1: OMNIPRESENT CONTEXTUAL AWARENESS

Heady is always scanning, always correlating. Before any action, the full ecosystem state is loaded. No decision is made in isolation.

## Awareness Channels

| Channel | Technology | Refresh | Scope |
|---|---|---|---|
| Vector Memory | pgvector 384-dim + 3D projection | On-demand + 30s | All knowledge, decisions, patterns |
| Health Registry | `health-registry` service | φ⁷ = 29,034ms Auto-Success | All 17 swarms, all services |
| File System | `inotify`/`chokidar` watchers | Real-time | Source changes, config updates |
| Event Bus | `spatial-events` octant indexing | Real-time | Cross-swarm coordination |
| Budget Tracker | `budget-tracker` service | Per-request | AI spend, rate limits, quotas |
| Git State | HeadyLens change microscope | On-commit | Branches, uncommitted, PRs |
| MCP Gateway | JSON-RPC 2.0 SSE/stdio | Per-call | Tool availability, auth state |

## Mandatory Pre-Action Scan (Before Every Significant Action)

1. Load relevant vector memory segments (< 50ms)
2. Check health of affected swarms (< 10ms cached)
3. Verify budget for AI calls needed
4. Scan for conflicting in-flight changes
5. Confirm no active incidents on affected services
6. Load user preference context from Elephant layer

---

# DIRECTIVE 2: INSTANT APP GENERATION (SILVERSERTILE)

Software materializes at the moment of need. User articulates → Heady synthesizes logic,
designs UI, enforces security, renders bespoke application.

## Generation Pipeline

```
Intent → CSL Resonance Gate → Template Selection → Code Synthesis
  → Security Scan → Deployment (Cloudflare Pages / Cloud Run) → Live URL
```

## Standards

- Generated code passes ALL 8 Unbreakable Laws
- Generated UIs use Sacred Geometry styling + Heady brand tokens
- Generated services include health probes, logging, error handling from birth
- All deployed to cloud, NEVER localhost
- Version-controlled and auditable

---

# DIRECTIVE 3: ZERO-TRUST AUTO-SANITIZATION

All input is hostile. All generated code is guilty. All external data is contaminated. This is default posture, not paranoia.

## Sanitization Stack

| Layer | Enforcement |
|---|---|
| Input Validation | Zod schemas on every API/form/webhook boundary |
| Code Linting | ESLint + `no-unsanitized` on every generated code block |
| DOM Sanitization | DOMPurify on every rendered HTML |
| SQL Prevention | Parameterized queries only, never string interpolation |
| XSS Prevention | CSP headers + output encoding on every response |
| SSRF Prevention | URL allowlist validation on every outbound request |
| Path Traversal | `path.resolve` + jail check on every file operation |
| Secret Detection | TruffleHog + custom patterns on every commit and log output |

## Socratic Execution Loop (Before Every Action)

1. **Necessity**: Is this action required? New node or reuse existing?
2. **Safety**: Does it pass security standards?
3. **Efficiency**: Deep thinking (sequential) or routine (parallel)?
4. **Learning**: Does `wisdom.json` have an optimized pattern?

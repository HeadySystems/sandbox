---
title: "Law 02: Solutions Not Workarounds"
domain: unbreakable-law
law_number: 2
semantic_tags: [root-cause, tech-debt, no-hacks, error-handling, workaround-detection, code-hygiene]
enforcement: ABSOLUTE
---

# LAW 2: SOLUTIONS NOT WORKAROUNDS — ROOT CAUSE OR NOTHING

Every fix applied by a Heady agent must address the **root cause** of the problem, not mask its
symptoms. Workarounds introduce compounding technical debt, degrade system coherence, and violate
the self-healing guarantee that Heady's alive architecture depends on. This law applies to code,
configuration, infrastructure, and orchestration decisions alike.

## Workaround Detection Patterns (Automatic Enforcement)

The following patterns are detected by the Code Quality category of the Auto-Success Engine and
flagged as LAW-02 violations:

| Pattern | Classification |
|---------|---------------|
| `setTimeout` used to "wait and retry" without exponential backoff | Workaround |
| Hardcoded delays (`await sleep(2000)`, `Thread.sleep(500)`) | Workaround |
| `catch` block with no body, or body is only a comment | Critical Violation |
| `catch (e) {}` or `catch (e) { /* ignore */ }` | Critical Violation |
| `TODO` / `FIXME` / `HACK` comments in production branch | Tech Debt Trigger |
| Duplicate implementation of existing module functionality | Duplication Violation |
| Copy-paste code block > 13 lines (fib(7)) | Extract-to-Module Required |

## Technical Debt Tracking

Any `TODO`, `FIXME`, or `HACK` comment merged into a production branch **automatically**:
1. Creates a tracked entry in `wisdom.json` under the `tech_debt` key
2. Assigns an expiry date of 13 days (fib(7)) from merge date
3. Surfaces in the MISTAKE_ANALYSIS stage (16) on every subsequent pipeline run
4. Escalates to HeadySoul if the expiry date is exceeded without resolution

Temporary solutions must include an `@expires` annotation with ISO date. Unannotated temporary
solutions are treated as permanent debt and flagged at CRITICAL severity.

## Duplication Rules

- When a v2 implementation exists, v1 **must** be deprecated within 1 sprint (13 days, fib(7))
- Code blocks > 13 lines (fib(7)) shared in two or more locations must be extracted to a shared module
- Copy-paste detection runs as part of the Code Quality heartbeat (LAW-07 category 1)
- Duplicate API surface violations block the APPROVE stage (11) in HCFullPipeline

## Error Path Requirements

All error paths must satisfy three conditions:
1. **Log**: emit a structured log entry with context, error type, and stack if available
2. **Classify**: assign an error category from the canonical error taxonomy
3. **Surface**: propagate or re-throw so upstream orchestrators can respond

Silent error swallowing breaks the self-healing cycle by hiding signals that HeadyPatterns
and HeadyMC depend on for diagnosis and recovery planning.

## Invariants

- **Zero tolerance for empty catch blocks** — any empty `catch` blocks fail the lint gate
- **All error paths must log, classify, and surface** — three conditions, all mandatory
- **Temporary solutions must have expiry dates tracked in `wisdom.json`** — no exceptions
- **`setTimeout` as retry logic** is always a violation; use phi-backoff with max 3 attempts
- **Copy-paste blocks > fib(7) = 13 lines** trigger mandatory module extraction before merge
- **v1 implementations live at most fib(7) = 13 days** after a v2 supersedes them
- Workaround patterns detected in production branches trigger automatic rollback request to HeadySoul

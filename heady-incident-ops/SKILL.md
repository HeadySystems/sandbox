---
name: heady-incident-ops
description: Use when managing incident response, policy enforcement, structured logging, system monitoring, or governance approval gates in the Heady™ ecosystem. Keywords include incident, response, policy, enforcement, logging, structured log, monitoring, dashboard, approval gates, governance, and operational excellence.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™Systems Incident & Operations Management

## When to Use This Skill

Use this skill when the user needs to:
- Handle incident response and triage
- Configure policy enforcement engines
- Set up structured logging
- Build system monitoring dashboards
- Implement governance approval gates

## Module Map

| Module | Path | Role |
|---|---|---|
| incident-manager | src/incident-manager.js | Incident lifecycle management |
| policy-engine | src/policy-engine.js | Policy evaluation and enforcement |
| policy-service | src/policy-service.js | Policy API service |
| structured-logger | src/structured-logger.js | Structured JSON logging |
| system-monitor | src/system-monitor.js | System health monitoring |
| approval-gates | src/governance/approval-gates.js | Governance approval workflows |

## Instructions

### Incident Response
1. Detection: system-monitor identifies anomaly.
2. Classification: severity scored using phi-scaled levels.
   - P0 (critical): system down, data loss risk — respond in 5 min
   - P1 (major): degraded service — respond in 13 min
   - P2 (moderate): non-critical issue — respond in 34 min
   - P3 (minor): cosmetic/low impact — respond in 89 min
3. Triage: incident-manager assigns to appropriate responder.
4. Mitigation: execute runbook or auto-heal.
5. Resolution: verify fix, update status.
6. Postmortem: generate incident report with root cause.

### Policy Engine
1. Policies defined as CSL expressions (continuous, not boolean).
2. Evaluation returns a compliance score (0.0 to 1.0).
3. Actions based on score: allow (>0.786), review (0.618-0.786), deny (<0.618).
4. Policy categories: security, data governance, cost, performance, compliance.
5. Policies version-controlled and auditable.

### Structured Logging
```javascript
const log = {
  timestamp: ISO8601,
  level: 'info|warn|error|debug',
  service: 'heady-conductor',
  trace_id: 'W3C-trace-context',
  span_id: 'current-span',
  message: 'Human readable message',
  data: { /* structured payload */ },
  tags: ['orchestration', 'pipeline'],
};
```
- All logs are JSON formatted.
- Correlation via W3C Trace Context (trace_id, span_id).
- Log levels: debug, info, warn, error, fatal.
- Retention: 8 days hot, 34 days warm, 144 days cold (Fibonacci).

### Governance Approval Gates
1. Define gates at critical decision points.
2. Gate types: auto-approve, single-approver, multi-approver, quorum.
3. Timeout: phi-scaled (8 min auto, 34 min escalate, 89 min default-deny).
4. Audit trail: every gate decision logged with approver and rationale.
5. Integration: gates can trigger in CI/CD, deployment, and data operations.

## Output Format

- Incident Status and Timeline
- Policy Compliance Report
- Log Analysis Summary
- System Health Dashboard
- Approval Gate Status

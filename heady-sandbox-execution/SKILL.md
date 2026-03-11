---
name: heady-sandbox-execution
description: Use when implementing sandboxed code execution, WASM isolation, event streaming systems, or safe computation in multi-tenant environments for the Heady™ ecosystem. Keywords include sandbox, WASM, isolation, code execution, event stream, multi-tenant, safe execution, and compute sandbox.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Sandbox Execution

## When to Use This Skill

Use this skill when the user needs to:
- Execute untrusted code in a sandboxed environment
- Configure WASM isolation for safe computation
- Set up event streaming between services
- Implement multi-tenant compute isolation
- Run user-submitted code or agent-generated code safely

## Module Map

| Module | Path | Role |
|---|---|---|
| sandbox-executor | src/sandbox-executor.js | Sandboxed code execution engine |
| wasm-sandbox | src/api/wasm-sandbox.js | WASM-based isolation layer |
| event-stream | src/event-stream.js | Event streaming system |

## Instructions

### Sandbox Execution
1. All untrusted code runs in isolated V8 contexts or WASM sandboxes.
2. Resource limits: CPU (Fibonacci ms: 89, 233, 610), Memory (8MB, 21MB, 55MB).
3. Network access: denied by default, allowlist-based.
4. File system: virtual FS with no host access.
5. Timeout enforcement: hard kill at limit.

### WASM Isolation
1. Compile code to WASM for maximum isolation.
2. Linear memory model prevents out-of-bounds access.
3. Import whitelist controls available host functions.
4. Fuel metering limits computation steps.
5. Instance pooling for fast startup (phi-sized pool: 8, 13, 21 instances).

### Event Streaming
1. Events use structured format: { type, source, data, timestamp, trace_id }.
2. Transport: Redis Streams for internal, SSE for external consumers.
3. Partitioning: by service name with phi-ratio consumer groups.
4. Retention: 89 minutes hot, 610 minutes warm, 2584 minutes cold.
5. Back-pressure: semantic dedup + phi-scaled throttling.

### Security Boundaries
```
User Code → [WASM Sandbox] → [Capability Check] → [Host API]
                ↓                                      ↓
           Timeout Kill                          Audit Log
                ↓                                      ↓
           Resource Meter                      Event Stream
```

## Output Format

- Sandbox Configuration
- Execution Results
- Resource Usage Report
- Event Stream Status
- Security Boundary Verification

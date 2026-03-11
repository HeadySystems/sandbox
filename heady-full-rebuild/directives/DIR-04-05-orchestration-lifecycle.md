---
title: "Directive 04-05: Deterministic Orchestration & Lifecycle"
domain: master-directive
directive_number: [4, 5]
semantic_tags: [determinism, low-latency, protocols, lifecycle, graceful-shutdown, resource-cleanup, MIDI, orchestration]
enforcement: MANDATORY
---

# DIRECTIVE 4: LOW-LATENCY DETERMINISTIC ORCHESTRATION

When determinism matters — hardware, finance, pipelines — use the fastest, most predictable protocol.

## Protocol Selection Matrix

| Scenario | Protocol | Latency | Guarantee |
|---|---|---|---|
| Real-time IoT/A/V sync | MIDI → UDP | < 1ms | Fire-and-forget |
| Financial triggers/DB | MIDI → TCP | < 10ms | Buffered + ACK |
| Gestures → LLM tools | MIDI → MCP | < 50ms | CC values → JSON-RPC |
| Webhooks | MIDI → REST | < 200ms | SysEx → Edge Proxy + mTLS |
| Cross-swarm comms | Event Bus | < 10ms | Spatial octant indexing |
| AI model routing | LLM Router | < 100ms | CSL-scored selection |
| Bee task dispatch | Task Queue | < 5ms | Priority + phi-scoring |

## Determinism Requirements

- All pipeline stages use seeded PRNG for reproducible audit trails
- CSL gate evaluations: pure vector arithmetic — no LLM reasoning in math path
- VALU Tensor Core (`scripts/valu_tensor_core.py`): math-as-a-service
- Race prevention by design (event ordering), not locks
- Eventual consistency windows bounded and documented per service

---

# DIRECTIVE 5: GRACEFUL LIFECYCLE MANAGEMENT

Every process, bee, card, and connection has a lifecycle. Born → runs → dies gracefully. No zombies. No leaks. No orphans.

## Lifecycle State Machine

```
SPAWN → INITIALIZE → READY → ACTIVE → DRAINING → SHUTDOWN → DEAD
```

- **SPAWN**: Register in registry, allocate from swarm pool
- **INITIALIZE**: Load config, establish connections, validate env
- **READY**: Health check passed, accepting task assignments
- **ACTIVE**: Processing tasks, emitting heartbeats every 30s
- **DRAINING**: Stop accepting new work, finish in-flight with timeout
- **SHUTDOWN**: Release all handles, connections, timers, file descriptors
- **DEAD**: Deregister from registry, memory freed

## Resource Cleanup Guarantees

- Every `exit-hook` registered for stdout/stderr flush
- Every TCP/UDP socket closed with `FIN`
- Every MIDI port released with `del midiout`
- Every database connection returned to pool
- Every file handle closed (even on error paths)
- Every timer/interval cleared (no lingering `setInterval`)
- Every child process terminated (SIGTERM → 5s wait → SIGKILL)
- Every temporary file deleted
- Every event listener unsubscribed (prevent memory leak)
- Every WebSocket connection closed with proper close frame

## Bee Lifecycle at 10K Scale

- Pre-warmed pools: 5-8-13-21 per swarm (Fibonacci)
- Scale-up: queue depth > pool × φ for 10s
- Scale-down: idle > pool × (1 - 1/φ) for 60s
- Stale detection: no heartbeat 60s → dead → respawn
- Graceful: cancellation tokens → drain → checkpoint → die

---
name: heady-a2a-protocol
description: Use when implementing Agent-to-Agent (A2A) or Agent-to-UI (A2UI) communication protocols, inter-agent messaging, agent handoffs, or UI integration patterns in the Heady™ ecosystem. Keywords include A2A, A2UI, agent protocol, inter-agent, messaging, handoff, agent communication, protocol, and agent-to-agent.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ A2A & A2UI Protocols

## When to Use This Skill

Use this skill when the user needs to:
- Implement agent-to-agent communication
- Set up agent-to-UI message passing
- Design inter-agent handoff protocols
- Debug message routing between agents
- Integrate agents with frontend micro-frontends

## Module Map

| Module | Path | Role |
|---|---|---|
| a2a | src/protocols/a2a.js | Agent-to-Agent messaging protocol |
| a2ui | src/protocols/a2ui.js | Agent-to-UI communication bridge |

## Instructions

### A2A Protocol (Agent-to-Agent)
1. Messages use JSON-RPC 2.0 format with Heady™ extensions.
2. Each agent has a unique agent_id and capability manifest.
3. Discovery: Agents register capabilities in the agent registry.
4. Routing: Messages route through the Conductor based on capability matching.
5. Handoff: Structured context transfer using context capsules.

#### Message Format
```json
{
  "jsonrpc": "2.0",
  "method": "agent.execute",
  "params": {
    "from_agent": "brain-bee-001",
    "to_agent": "memory-bee-003",
    "task": {
      "type": "memory.store",
      "payload": { "key": "conversation_context", "value": "..." },
      "priority": 1.618,
      "deadline_ms": 2618
    },
    "context_capsule": {
      "working_memory": "...",
      "session_context": "...",
      "relevance_score": 0.891
    }
  },
  "id": "msg-uuid-here"
}
```

#### Handoff Protocol
1. Source agent serializes context capsule.
2. Conductor validates target agent capability.
3. Context capsule transferred with phi-weighted priority.
4. Target agent acknowledges receipt and begins execution.
5. Source agent receives completion notification.

### A2UI Protocol (Agent-to-UI)
1. Uses Server-Sent Events (SSE) for agent -> UI streaming.
2. Uses WebSocket for bidirectional UI <-> agent communication.
3. UI events map to agent actions through the action registry.
4. Streaming tokens use SSE with chunked transfer encoding.
5. UI state sync uses optimistic updates with reconciliation.

#### Event Types
| Event | Direction | Purpose |
|---|---|---|
| agent.thinking | Agent -> UI | Show reasoning progress |
| agent.response | Agent -> UI | Stream response tokens |
| agent.tool_call | Agent -> UI | Display tool execution |
| user.input | UI -> Agent | User message/action |
| user.interrupt | UI -> Agent | Cancel current operation |
| state.sync | Bidirectional | Synchronize shared state |

### Security
- All A2A messages signed with agent keypair.
- A2UI messages authenticated via session token.
- Rate limiting per agent pair (phi-scaled: 89, 144, 233 msg/s).
- Context capsules encrypted in transit.

## Output Format

- Protocol Configuration
- Message Flow Diagram
- Agent Capability Manifest
- Handoff Sequence
- Security Verification

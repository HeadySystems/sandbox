---
name: heady-buddy-device
description: Use when implementing cross-device HeadyBuddy bridge, computer-use agent capabilities, conversational agent patterns, or Claude coding agent integration in the Heady™ ecosystem. Keywords include buddy, device, bridge, cross-device, computer use, agent, conversational, Claude code agent, and HeadyBuddy device.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Buddy Device Bridge

## When to Use This Skill

Use this skill when the user needs to:
- Bridge HeadyBuddy across multiple devices
- Implement computer-use agent capabilities
- Configure conversational agent patterns
- Integrate Claude coding agent workflows
- Manage device-specific buddy configurations

## Module Map

| Module | Path | Role |
|---|---|---|
| buddy-device-bridge | src/buddy-device-bridge.js | Cross-device buddy sync |
| buddy-computer-use | src/buddy-computer-use.js | Computer-use agent capability |
| heady-buddy-agent | src/agents/heady-buddy-agent.js | HeadyBuddy conversational agent |
| claude-code-agent | src/agents/claude-code-agent.js | Claude coding agent integration |
| buddy-authorization | src/buddy-authorization.js | Buddy auth and permissions |
| buddy-agent-hub | src/buddy-agent-hub.js | Multi-agent hub for buddy |

## Instructions

### Cross-Device Bridge
1. HeadyBuddy syncs state across all user devices via the bridge.
2. Sync protocol: optimistic replication with conflict resolution.
3. State includes: conversation history, preferences, active tasks, memory.
4. Transport: WebSocket for real-time, REST for batch sync.
5. Offline support: queue operations, sync on reconnect.

### Device Types
| Device | Capabilities |
|---|---|
| Desktop (Windows/Linux) | Full compute, keyboard, screen |
| Mobile | Touch, camera, GPS, voice |
| Browser Extension | Tab context, page content |
| CLI | Terminal, file system |
| IoT/Edge | Sensors, limited compute |

### Computer-Use Agent
1. Screen observation: capture and analyze screen content.
2. Action execution: mouse, keyboard, and application control.
3. Safety: all actions require user confirmation by default.
4. Permission levels: observe-only, suggest, execute-with-confirm, autonomous.
5. Audit: every computer-use action logged with screenshot evidence.

### Conversational Agent Patterns
1. HeadyBuddy uses multi-turn conversation with persistent memory.
2. Context: session memory + persistent memory + HeadySoul knowledge.
3. Personality: configurable via buddy-system-config.yaml.
4. Multi-modal: text, voice, image input supported.
5. Proactive: anticipatory suggestions based on user patterns.

### Claude Code Agent Integration
1. Code generation and review via Claude SDK.
2. File operations: read, write, refactor through sandboxed executor.
3. Context: project files + HeadyBuddy context + IDE state.
4. Output: code diffs, explanations, test suggestions.

## Output Format

- Device Bridge Status
- Sync State Report
- Computer-Use Action Log
- Conversation Context
- Agent Configuration

---
name: heady-connector-vault
description: Use when managing external connector vaults, secret management, dynamic connector synthesis, OAuth scope management, SDK service layers, or compute dashboards in the Heady™ ecosystem. Keywords include connector, vault, secret, OAuth, scope, SDK, compute dashboard, dynamic synthesis, service integration, and connector management.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Connector Vault

## When to Use This Skill

Use this skill when the user needs to:
- Manage external service connectors and credentials
- Configure the connector vault for secret storage
- Dynamically synthesize new connectors
- Manage OAuth scopes for integrations
- Work with the SDK service layer
- Monitor the compute resource dashboard

## Module Map

| Module | Path | Role |
|---|---|---|
| connector-vault | src/connectors/connector-vault.js | Secure credential storage |
| dynamic-synthesizer | src/connectors/dynamic-synthesizer.js | Auto-generate connectors |
| connector-routes | src/connectors/connector-routes.js | Connector API endpoints |
| oauth-scopes | src/connectors/oauth-scopes.js | OAuth scope management |
| sdk-services | src/sdk-services.js | SDK service layer |
| compute-dashboard | src/compute-dashboard.js | Resource monitoring UI |

## Instructions

### Connector Vault
1. All credentials stored encrypted at rest (AES-256-GCM).
2. Access control: per-agent permissions for each connector.
3. Rotation: automatic credential rotation at Fibonacci intervals.
4. Audit: every access logged with agent_id and purpose.
5. Backup: encrypted vault snapshots to cold storage.

### Dynamic Connector Synthesis
1. Analyze target API documentation or OpenAPI spec.
2. Generate connector stub with auth, endpoints, error handling.
3. Test connector against target API sandbox.
4. Register in connector registry with capability manifest.
5. Auto-generate SDK methods for the new connector.

### OAuth Scope Management
```javascript
const scopes = {
  github: ['repo', 'read:org', 'workflow'],
  google: ['calendar.readonly', 'drive.readonly'],
  slack: ['chat:write', 'channels:read'],
  // Each scope has a CSL trust score
  trustScores: {
    'repo': 0.786,      // High trust needed
    'read:org': 0.618,  // Medium trust
    'workflow': 0.891,   // Very high trust
  }
};
```

### SDK Service Layer
1. Unified SDK wrapping all Heady services.
2. Auto-generated TypeScript types from service contracts.
3. Request/response middleware chain.
4. Retry, circuit breaker, and rate limiting built in.
5. Telemetry: every SDK call instrumented.

## Output Format

- Vault Status
- Connector Registry
- OAuth Configuration
- SDK Service Map
- Compute Dashboard

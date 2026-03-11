# HEADY Schema Registry

Centralized JSON Schema definitions and TypeScript types for inter-service API contracts across the HEADY platform.

## Overview

This package provides:
- **9 JSON Schema definitions** for core HEADY services
- **Type-safe validation** using AJV with full TypeScript support
- **Production-ready schemas** for authentication, billing, search, analytics, and more
- **Extensible schema registry** for adding new service contracts

## Schemas

### Core Services

| Schema | Purpose | Definition |
|--------|---------|-----------|
| `auth-session` | Session management (create, verify, revoke) | [auth-session.schema.json](./auth-session.schema.json) |
| `notification` | Multi-channel notifications and WebSocket messages | [notification.schema.json](./notification.schema.json) |
| `billing-event` | Subscription events, payments, usage metering | [billing-event.schema.json](./billing-event.schema.json) |
| `analytics-event` | Event tracking payloads and batching | [analytics-event.schema.json](./analytics-event.schema.json) |
| `search-query` | Search requests, responses, and faceting | [search-query.schema.json](./search-query.schema.json) |
| `vector-embedding` | Vector embeddings (384-dim) and semantic search | [vector-embedding.schema.json](./vector-embedding.schema.json) |
| `health-check` | Standard health check responses | [health-check.schema.json](./health-check.schema.json) |
| `error-response` | Standard error responses with HEADY error codes | [error-response.schema.json](./error-response.schema.json) |
| `csl-signal` | Confidence Signal Layer signals and gates | [csl-signal.schema.json](./csl-signal.schema.json) |

## Installation

```bash
npm install @heady/schemas
```

## Usage

### Basic Validation

```typescript
import { validateSchema, SCHEMAS } from '@heady/schemas';

// Validate request data
const result = validateSchema(userData, 'auth-session', SCHEMAS['auth-session']);

if (result.valid) {
  console.log('Valid:', result.data);
} else {
  console.error('Errors:', result.errors);
}
```

### Type-Safe Validation

```typescript
import { validateOrThrow, SessionCreateRequest } from '@heady/schemas';

try {
  const session = validateOrThrow<SessionCreateRequest>(
    requestBody,
    'auth-session',
    SCHEMAS['auth-session']
  );
  // session is now typed as SessionCreateRequest
} catch (error) {
  console.error('Validation failed:', error.message);
}
```

### TypeScript Types

```typescript
import {
  SessionCreateRequest,
  NotificationSendRequest,
  SearchRequest,
  AnalyticsEvent,
  ConfidenceSignal,
} from '@heady/schemas';

const notif: NotificationSendRequest = {
  type: 'email',
  subject: 'Welcome',
  body: 'Welcome to HEADY',
  data: { userId: '123' },
};

const search: SearchRequest = {
  q: 'kubernetes',
  type: 'documents',
  filters: { language: 'en' },
};
```

### Batch Validation

```typescript
import { validateBatch, hasBatchErrors } from '@heady/schemas';

const events = [event1, event2, event3];
const results = validateBatch(events, 'analytics-event', SCHEMAS['analytics-event']);

if (hasBatchErrors(results)) {
  console.error('Some items failed validation');
}
```

### List Available Schemas

```typescript
import { listSchemas, hasSchema } from '@heady/schemas';

// Get all schema IDs
const schemas = listSchemas();
console.log(schemas); // ['auth-session', 'notification', ...]

// Check if schema exists
if (hasSchema('custom-schema')) {
  // Use schema
}
```

## Schema Structure

Each schema includes:
- **Definitions** - Reusable type definitions
- **Properties** - Field specifications with constraints
- **Required** - Mandatory fields
- **Examples** - Usage examples (in comments)

### Auth Session Schema

```json
{
  "SessionCreateRequest": {
    "email": "user@example.com",
    "password": "secure-password",
    "mfaToken": "optional-mfa",
    "deviceFingerprint": "optional-device-id"
  },
  "SessionCreateResponse": {
    "sessionId": "32-char-hex-id",
    "accessToken": "jwt-token",
    "refreshToken": "jwt-token",
    "expiresIn": 900,
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "roles": ["admin", "user"]
    }
  }
}
```

## Error Handling

### Standard Error Codes

HEADY uses standardized error codes for consistency:

```typescript
type HeadyErrorCode =
  | 'HEADY_VALIDATION_ERROR'
  | 'HEADY_AUTH_INVALID_CREDENTIALS'
  | 'HEADY_AUTH_TOKEN_EXPIRED'
  | 'HEADY_AUTHZ_INSUFFICIENT_PERMISSIONS'
  | 'HEADY_RESOURCE_NOT_FOUND'
  | 'HEADY_RATE_LIMIT_EXCEEDED'
  | 'HEADY_INTERNAL_ERROR'
  // ... more codes
```

### Error Response Format

```typescript
{
  "error": {
    "code": "HEADY_VALIDATION_ERROR",
    "message": "Validation failed",
    "statusCode": 400,
    "timestamp": "2026-01-15T10:30:00Z",
    "requestId": "req-12345",
    "details": {
      "field": "email",
      "errors": [...]
    }
  }
}
```

## CSL (Confidence Signal Layer)

Schemas support the Confidence Signal Layer for data quality assessment:

```typescript
import { ConfidenceSignal, CSLGate } from '@heady/schemas';

const signal: ConfidenceSignal = {
  signalId: 'sig_abc123',
  dataId: 'data-456',
  score: 0.95,
  level: 'high',
  factors: [
    { name: 'data_age', weight: 0.3, value: 0.9 },
    { name: 'source_reliability', weight: 0.5, value: 0.98 },
  ],
};

const gate: CSLGate = {
  gateId: 'gate_xyz',
  signalId: 'sig_abc123',
  decision: 'pass',
  threshold: 0.7,
};
```

## Integration Examples

### Express Middleware

```typescript
import { validateOrThrow, SessionCreateRequest, SCHEMAS } from '@heady/schemas';

app.post('/auth/login', (req, res) => {
  try {
    const session = validateOrThrow<SessionCreateRequest>(
      req.body,
      'auth-session',
      SCHEMAS['auth-session']
    );
    // Process validated session
  } catch (error) {
    res.status(400).json({
      error: {
        code: 'HEADY_VALIDATION_ERROR',
        message: error.message,
        statusCode: 400,
      },
    });
  }
});
```

### Event Publishing

```typescript
import { AnalyticsEvent, SCHEMAS } from '@heady/schemas';

async function publishEvent(event: AnalyticsEvent) {
  const result = validateSchema(event, 'analytics-event', SCHEMAS['analytics-event']);

  if (result.valid) {
    await eventBus.publish(result.data);
  } else {
    logger.error('Invalid event', result.errors);
  }
}
```

## Performance

### Caching

Validators are compiled and cached automatically:

```typescript
// First call compiles and caches
validateSchema(data1, 'auth-session', schema);

// Subsequent calls use cached validator
validateSchema(data2, 'auth-session', schema);

// Check cache stats
import { getCacheStats } from '@heady/schemas';
const stats = getCacheStats();
console.log(`Cached schemas: ${stats.size}`);
```

### Batch Processing

For high-volume validation, use batch operations:

```typescript
const results = validateBatch(
  largeArray,
  'analytics-event',
  SCHEMAS['analytics-event']
);
```

## Contributing

When adding new schemas:

1. Create JSON Schema definition with proper structure
2. Add TypeScript interfaces in `index.ts`
3. Register schema in `SCHEMAS` object
4. Add integration examples in README
5. Run validation: `npm run validate-schemas`

## Testing

```bash
npm test

# Validate all schemas
npm run validate-schemas

# Lint code
npm lint
```

## API Reference

### `validateSchema<T>(data, schemaId, schema)`

Validate data against a schema with type safety.

**Parameters:**
- `data` - Data to validate
- `schemaId` - Schema identifier for caching
- `schema` - JSON Schema object

**Returns:** `ValidationResult<T>` with `valid` boolean and `data` or `errors`

### `validateOrThrow<T>(data, schemaId, schema)`

Validate or throw error.

**Throws:** Error with code `HEADY_VALIDATION_ERROR`

### `validateBatch<T>(items, schemaId, schema)`

Validate array of items.

**Returns:** Array of `ValidationResult<T>`

### `compileSchema(schemaId, schema)`

Pre-compile schema for repeated use.

**Returns:** AJV validator function

### `clearValidatorCache()`

Clear all cached validators.

### `getCacheStats()`

Get validator cache statistics.

## License

MIT

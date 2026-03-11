# HEADY Shared Configuration

Shared configuration utilities for HEADY platform services including service configuration, CORS, structured logging, health checks, and Express middleware stacks.

## Overview

This package provides:
- **Base service configuration** - Port, host, environment, logging level
- **CORS configuration** - Pre-configured for ~60 HEADY domains
- **Structured JSON logging** - With correlation IDs and distributed tracing
- **Health check endpoints** - Kubernetes liveness, readiness, startup probes
- **Express middleware stack** - CORS, compression, logging, rate limiting, error handling

## Installation

```bash
npm install @heady/config
```

## Usage

### Base Service Configuration

```typescript
import { getBaseServiceConfig, validateBaseServiceConfig } from '@heady/config';

const config = getBaseServiceConfig({
  name: 'auth-service',
  version: '1.0.0',
});

validateBaseServiceConfig(config);
console.log(`Starting ${config.name} on ${config.host}:${config.port}`);
```

### Environment Variables

```bash
SERVICE_NAME=auth-service
SERVICE_VERSION=1.0.0
SERVICE_HOST=localhost
SERVICE_PORT=3000
NODE_ENV=production
LOG_LEVEL=info
REQUEST_TIMEOUT=30000
GRACEFUL_SHUTDOWN_TIMEOUT=30000
```

### CORS Configuration

```typescript
import cors from 'cors';
import { getCorsConfig } from '@heady/config';

app.use(cors(getCorsConfig(process.env.NODE_ENV)));

// Or use specific configurations:
// - getCorsConfig() - Default with ~60 HEADY domains
// - getStrictCorsConfig() - More restrictive for public APIs
// - getPermissiveCorsConfig() - For internal APIs
// - getWebhookCorsConfig() - For webhook endpoints
```

### Structured Logging

```typescript
import {
  createLogEntry,
  createErrorLogEntry,
  redactSensitiveFields,
  getCorrelationId,
  createLogContextFromRequest,
} from '@heady/config';

// Create log entry
const log = createLogEntry('info', 'User logged in', {
  userId: 'user-123',
  sessionId: 'session-456',
});

console.log(JSON.stringify(log));

// Create error log entry
try {
  // Some operation
} catch (error) {
  const errorLog = createErrorLogEntry('Operation failed', error);
  console.error(JSON.stringify(errorLog));
}

// Redact sensitive fields
const userData = { email: 'user@example.com', password: 'secret' };
const redacted = redactSensitiveFields(userData, ['password']);
// => { email: 'user@example.com', password: '***REDACTED***' }

// Extract correlation ID
const correlationId = getCorrelationId(req.headers);

// Create context from request
const context = createLogContextFromRequest(req);
```

### Health Check Endpoints

```typescript
import { registerHealthCheckEndpoints, createDatabaseHealthCheck } from '@heady/config';

registerHealthCheckEndpoints(app, {
  serviceName: 'auth-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  startTime: new Date(),
  checks: {
    database: createDatabaseHealthCheck(pgPool),
    cache: createRedisHealthCheck(redisClient),
  },
  dependencies: {
    authService: createHttpHealthCheck('https://auth.heady.io/health'),
  },
});

// Endpoints:
// GET /health - Full health check
// GET /alive - Liveness probe (Kubernetes)
// GET /ready - Readiness probe (Kubernetes)
// GET /startup - Startup probe (Kubernetes)
```

### Express Middleware Stack

```typescript
import { buildMiddlewareStack } from '@heady/config';
import express from 'express';

const app = express();

// Build standard middleware stack
buildMiddlewareStack(app, {
  cors: true,
  compression: true,
  requestLogging: true,
  requestId: true,
  rateLimit: true,
  errorHandler: true,
  rateLimitConfig: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  excludeFromLogging: ['/health', '/alive', '/ready', '/metrics'],
});

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
```

### Health Check Examples

```typescript
// Database health check
const dbCheck = createDatabaseHealthCheck(pgPool);

// Redis health check
const cacheCheck = createRedisHealthCheck(redisClient);

// HTTP health check
const externalCheck = createHttpHealthCheck('https://api.example.com/health');

// Memory health check
const memoryCheck = createMemoryHealthCheck(0.85); // 85% threshold

// Disk space health check
const diskCheck = createDiskSpaceHealthCheck('/', 0.9);
```

## Configuration Options

### BaseServiceConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | - | Service name |
| `version` | string | - | Service version (semver) |
| `host` | string | `localhost` | Server host |
| `port` | number | `3000` | Server port |
| `environment` | `production \| staging \| development \| test` | `development` | Runtime environment |
| `logLevel` | `debug \| info \| warn \| error \| fatal` | `info` | Log level |
| `debug` | boolean | `false` | Enable debug mode |
| `requestTimeout` | number | `30000` | Request timeout (ms) |
| `gracefulShutdownTimeout` | number | `30000` | Shutdown timeout (ms) |
| `maxConnections` | number | `1000` | Max HTTP connections |
| `keepAliveTimeout` | number | `65000` | Keep-alive timeout (ms) |
| `compression` | boolean | `true` | Enable compression |
| `trustProxy` | boolean \| string | `false` | Trust proxy headers |
| `requestBodyLimit` | string | `10mb` | Max body size |

### LoggerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | string | `info` | Minimum log level |
| `includeStackTrace` | boolean | `true` | Include stack traces |
| `includeContext` | boolean | `true` | Include context info |
| `prettyPrint` | boolean | `false` | Pretty print JSON |
| `stdout` | boolean | `true` | Output to stdout |
| `fileOutput` | boolean | `false` | Output to file |
| `logRequests` | boolean | `true` | Log requests/responses |
| `logMetrics` | boolean | `true` | Log metrics |
| `correlationId` | boolean | `true` | Enable correlation IDs |
| `distributedTracing` | boolean | `true` | Enable distributed tracing |

## CORS Domains

The default CORS configuration supports ~60 HEADY domains:

**Primary:** heady.io, www.heady.io, api.heady.io, app.heady.io, admin.heady.io

**Features:** search, analytics, billing, auth, notifications, chat, docs, dashboard

**Regional:** eu, asia, us

**Environment:** staging, dev, localhost

**Partners:** marketplace, integrations, white-label

**Services:** webhooks, events, queue, monitoring, logs, metrics

**CDN:** cdn, static, assets

## Distributed Tracing

Supports B3 and Jaeger tracing:

```typescript
import { extractB3Trace, extractJaegerTrace } from '@heady/config';

const b3 = extractB3Trace(req.headers);
const jaeger = extractJaegerTrace(req.headers);
```

## Error Handling

Standard error response format:

```typescript
{
  "error": {
    "code": "HEADY_INTERNAL_ERROR",
    "message": "Internal server error",
    "statusCode": 500,
    "timestamp": "2026-01-15T10:30:00Z",
    "requestId": "req-12345",
    "details": {}
  }
}
```

## Rate Limiting

In-memory rate limiting middleware:

```typescript
buildMiddlewareStack(app, {
  rateLimit: true,
  rateLimitConfig: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 100,        // 100 requests per minute
    message: 'Too many requests',
  },
});
```

Response headers:
- `X-RateLimit-Limit` - Rate limit
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Reset time

## Integration Example

```typescript
import express from 'express';
import {
  getBaseServiceConfig,
  buildMiddlewareStack,
  registerHealthCheckEndpoints,
  createDatabaseHealthCheck,
} from '@heady/config';

const app = express();
const config = getBaseServiceConfig({
  name: 'api-service',
  version: '1.0.0',
});

// Build middleware
buildMiddlewareStack(app, { environment: config.environment });

// Register health checks
registerHealthCheckEndpoints(app, {
  serviceName: config.name,
  serviceVersion: config.version,
  environment: config.environment,
  dependencies: {
    database: createDatabaseHealthCheck(dbPool),
  },
});

// Your routes
app.get('/api/users', (req, res) => {
  res.json([]);
});

app.listen(config.port, config.host, () => {
  console.log(`${config.name} running on ${config.host}:${config.port}`);
});
```

## Testing

```bash
npm test

# Lint code
npm lint
```

## License

MIT

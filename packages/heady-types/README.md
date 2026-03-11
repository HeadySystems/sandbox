# HEADY Shared Types

Comprehensive TypeScript type definitions for the HEADY platform covering services, authentication, Confidence Signal Layer (CSL), and event-driven architecture.

## Overview

This package provides:
- **Service types** - Service information, health checks, metrics
- **Auth types** - Users, sessions, tokens, roles, permissions
- **CSL types** - Confidence signals, gates, data quality assessment
- **Event types** - Event bus, NATS messaging, sagas, event streaming

## Installation

```bash
npm install @heady/types
```

## Usage

### Service Types

```typescript
import {
  ServiceInfo,
  HealthCheckResult,
  ServiceMetrics,
  ServiceConfig,
} from '@heady/types';

const service: ServiceInfo = {
  id: 'auth-service',
  name: 'Authentication Service',
  version: '1.0.0',
  environment: 'production',
  status: 'healthy',
  startedAt: new Date(),
  uptime: 3600,
};

const health: HealthCheckResult = {
  component: 'database',
  status: 'healthy',
  duration: 15,
  checkedAt: new Date(),
};

const metrics: ServiceMetrics = {
  totalRequests: 10000,
  requestsPerSecond: 25.5,
  avgResponseTime: 45,
  p95ResponseTime: 150,
  p99ResponseTime: 250,
  totalErrors: 5,
  errorRate: 0.0005,
  successCount: 9995,
  cpuUsage: 35,
  memoryUsage: 524288000,
  memoryLimit: 1073741824,
  activeConnections: 42,
  timestamp: new Date(),
};
```

### Auth Types

```typescript
import {
  User,
  Session,
  AuthToken,
  JWTClaims,
  Credentials,
} from '@heady/types';

const user: User = {
  id: 'user-123',
  email: 'user@example.com',
  displayName: 'John Doe',
  status: 'active',
  roles: ['user', 'editor'],
  mfaEnabled: true,
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

const session: Session = {
  id: 'abc123def456',
  user,
  status: 'active',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 3600000),
  lastActivityAt: new Date(),
  deviceFingerprint: 'device-fp-123',
};

const token: AuthToken = {
  type: 'Bearer',
  token: 'eyJhbGc...',
  expiresAt: new Date(Date.now() + 3600000),
  expiresIn: 3600,
  scopes: ['read:profile', 'write:profile'],
};

const claims: JWTClaims = {
  sub: 'user-123',
  email: 'user@example.com',
  roles: ['user', 'editor'],
  sessionId: 'abc123def456',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  use: 'access',
};

const credentials: Credentials = {
  email: 'user@example.com',
  password: 'secure-password',
  mfaToken: 'mfa-token-123',
  rememberMe: false,
};
```

### CSL Types

```typescript
import {
  Signal,
  Gate,
  CSLMetrics,
  DataQuality,
  Anomaly,
} from '@heady/types';

const signal: Signal = {
  id: 'sig-abc123',
  dataId: 'data-456',
  score: 0.95,
  level: 'high',
  timestamp: new Date(),
  source: 'database',
  factors: [
    {
      name: 'data_age',
      weight: 0.3,
      value: 0.9,
    },
    {
      name: 'source_reliability',
      weight: 0.5,
      value: 0.98,
    },
  ],
};

const gate: Gate = {
  id: 'gate-xyz',
  signalId: 'sig-abc123',
  decision: 'pass',
  threshold: 0.7,
  signal,
  suggestedAction: 'proceed',
  evaluatedAt: new Date(),
};

const metrics: CSLMetrics = {
  pipelineId: 'pipeline-001',
  period: {
    startTime: new Date(Date.now() - 3600000),
    endTime: new Date(),
  },
  averageConfidence: 0.89,
  minConfidence: 0.45,
  maxConfidence: 0.99,
  signalCount: 1523,
  gateDecisions: {
    pass: 1200,
    caution: 250,
    block: 73,
  },
  anomalyCounts: {
    outlier: 23,
    missing: 12,
    inconsistent: 8,
    duplicate: 5,
    suspicious: 2,
  },
};

const quality: DataQuality = {
  dataId: 'data-456',
  score: 0.92,
  rating: 'good',
  signals: [signal],
  dimensions: {
    accuracy: 0.95,
    completeness: 0.90,
    consistency: 0.93,
    timeliness: 0.88,
    validity: 0.95,
  },
  assessedAt: new Date(),
};

const anomaly: Anomaly = {
  type: 'outlier',
  severity: 'medium',
  description: 'Value significantly deviates from expected range',
  affectedField: 'user_age',
  suggestedAction: 'investigate',
};
```

### Event Types

```typescript
import {
  Event,
  NATSMessage,
  EventBusConfig,
  Subjects,
  SubscriptionOptions,
} from '@heady/types';

const event: Event = {
  id: 'evt-abc123',
  type: 'user.registered',
  subject: Subjects.USER_REGISTERED,
  source: 'auth-service',
  timestamp: new Date(),
  correlationId: 'corr-123',
  requestId: 'req-456',
  data: {
    userId: 'user-789',
    email: 'user@example.com',
    registeredAt: new Date().toISOString(),
  },
  metadata: {
    version: '1.0.0',
    traceId: 'trace-123',
  },
};

const config: EventBusConfig = {
  servers: ['nats://nats.example.com:4222'],
  maxReconnectAttempts: 10,
  reconnectTimeWait: 2000,
  requestTimeout: 5000,
  debug: false,
};

const options: SubscriptionOptions = {
  queue: 'service-group',
  maxInFlight: 100,
  durable: true,
  startPosition: 'latest',
  filterSubjects: [Subjects.USER_REGISTERED, Subjects.USER_UPDATED],
};
```

## Subject Patterns

Event subjects for routing and filtering:

### Auth Events

- `auth.session.created` - Session created
- `auth.session.verified` - Session verified
- `auth.session.revoked` - Session revoked
- `auth.user.registered` - User registered
- `auth.user.updated` - User profile updated
- `auth.user.deleted` - User deleted
- `auth.mfa.enabled` - MFA enabled
- `auth.mfa.disabled` - MFA disabled

### Billing Events

- `billing.subscription.created` - Subscription created
- `billing.subscription.updated` - Subscription updated
- `billing.subscription.cancelled` - Subscription cancelled
- `billing.payment.succeeded` - Payment succeeded
- `billing.payment.failed` - Payment failed
- `billing.invoice.created` - Invoice created
- `billing.usage.recorded` - Usage recorded

### Search Events

- `search.document.indexed` - Document indexed
- `search.document.updated` - Document updated
- `search.document.deleted` - Document deleted
- `search.index.rebuilt` - Index rebuilt
- `search.query.executed` - Search query executed

### Analytics Events

- `analytics.event.tracked` - Event tracked
- `analytics.session.started` - Session started
- `analytics.session.ended` - Session ended
- `analytics.funnel.step_completed` - Funnel step completed
- `analytics.cohort.created` - Cohort created

### Notification Events

- `notification.sent` - Notification sent
- `notification.delivered` - Notification delivered
- `notification.failed` - Notification failed
- `notification.email.sent` - Email sent
- `notification.sms.sent` - SMS sent
- `notification.push.sent` - Push sent

### System Events

- `system.service.started` - Service started
- `system.service.stopped` - Service stopped
- `system.service.health_changed` - Service health changed
- `system.error.occurred` - Error occurred
- `system.alert.triggered` - Alert triggered

## Type Safety

All types are designed with strong type safety:

```typescript
// Enum-like types for safety
type UserRole = 'admin' | 'user' | 'editor' | 'viewer' | 'guest' | 'service';
type ConfidenceLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'initializing';

// Type-safe event handling
interface EventHandler<T extends Event = Event> {
  (event: T): Promise<void> | void;
}

// Discriminated unions for patterns
type Subject = typeof Subjects[keyof typeof Subjects];
```

## Integration Examples

### Service Registration

```typescript
import { ServiceInfo, ServiceRegistrationRequest } from '@heady/types';

const registrationRequest: ServiceRegistrationRequest = {
  service: {
    id: 'auth-service',
    name: 'Authentication Service',
    version: '1.0.0',
    environment: 'production',
    status: 'healthy',
    startedAt: new Date(),
    uptime: 0,
    capabilities: ['sessions', 'mfa', 'oauth'],
  },
  endpoints: {
    base: 'https://auth.heady.io',
    health: 'https://auth.heady.io/health',
    ready: 'https://auth.heady.io/ready',
  },
};
```

### Event Publishing

```typescript
import { Event, Subjects } from '@heady/types';

async function publishUserRegistered(userId: string, email: string): Promise<Event> {
  const event: Event = {
    id: `evt-${Date.now()}`,
    type: 'user.registered',
    subject: Subjects.USER_REGISTERED,
    source: 'auth-service',
    timestamp: new Date(),
    correlationId: requestId,
    data: { userId, email },
  };

  await eventBus.publish(event);
  return event;
}
```

### CSL Integration

```typescript
import { Signal, Gate } from '@heady/types';

function evaluateDataQuality(signal: Signal): Gate {
  return {
    id: `gate-${Date.now()}`,
    signalId: signal.id,
    decision: signal.score > 0.8 ? 'pass' : signal.score > 0.5 ? 'caution' : 'block',
    threshold: 0.7,
    signal,
    evaluatedAt: new Date(),
  };
}
```

## Testing

```bash
npm test

# Lint code
npm lint
```

## License

MIT

/**
 * Event Bus and Event Types
 *
 * Core types for inter-service event communication using NATS
 * and event-driven architecture patterns.
 *
 * @module @heady/types
 */

/**
 * NATS subject patterns for event routing
 */
export namespace Subjects {
  // Auth events
  export const SESSION_CREATED = 'auth.session.created';
  export const SESSION_VERIFIED = 'auth.session.verified';
  export const SESSION_REVOKED = 'auth.session.revoked';
  export const USER_REGISTERED = 'auth.user.registered';
  export const USER_UPDATED = 'auth.user.updated';
  export const USER_DELETED = 'auth.user.deleted';
  export const MFA_ENABLED = 'auth.mfa.enabled';
  export const MFA_DISABLED = 'auth.mfa.disabled';

  // Billing events
  export const SUBSCRIPTION_CREATED = 'billing.subscription.created';
  export const SUBSCRIPTION_UPDATED = 'billing.subscription.updated';
  export const SUBSCRIPTION_CANCELLED = 'billing.subscription.cancelled';
  export const PAYMENT_SUCCEEDED = 'billing.payment.succeeded';
  export const PAYMENT_FAILED = 'billing.payment.failed';
  export const INVOICE_CREATED = 'billing.invoice.created';
  export const USAGE_RECORDED = 'billing.usage.recorded';

  // Search and indexing events
  export const DOCUMENT_INDEXED = 'search.document.indexed';
  export const DOCUMENT_UPDATED = 'search.document.updated';
  export const DOCUMENT_DELETED = 'search.document.deleted';
  export const INDEX_REBULIT = 'search.index.rebuilt';
  export const SEARCH_QUERY_EXECUTED = 'search.query.executed';

  // Analytics events
  export const EVENT_TRACKED = 'analytics.event.tracked';
  export const SESSION_STARTED = 'analytics.session.started';
  export const SESSION_ENDED = 'analytics.session.ended';
  export const FUNNEL_STEP_COMPLETED = 'analytics.funnel.step_completed';
  export const COHORT_CREATED = 'analytics.cohort.created';

  // Notification events
  export const NOTIFICATION_SENT = 'notification.sent';
  export const NOTIFICATION_DELIVERED = 'notification.delivered';
  export const NOTIFICATION_FAILED = 'notification.failed';
  export const EMAIL_SENT = 'notification.email.sent';
  export const SMS_SENT = 'notification.sms.sent';
  export const PUSH_SENT = 'notification.push.sent';

  // System events
  export const SERVICE_STARTED = 'system.service.started';
  export const SERVICE_STOPPED = 'system.service.stopped';
  export const SERVICE_HEALTH_CHANGED = 'system.service.health_changed';
  export const ERROR_OCCURRED = 'system.error.occurred';
  export const ALERT_TRIGGERED = 'system.alert.triggered';
}

/**
 * Base event message
 */
export interface Event {
  /**
   * Event ID
   */
  id: string;

  /**
   * Event type
   */
  type: string;

  /**
   * Event subject/routing key
   */
  subject: string;

  /**
   * Event source service
   */
  source: string;

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Correlation ID for tracing
   */
  correlationId: string;

  /**
   * Request ID for tracing
   */
  requestId?: string;

  /**
   * Event data payload
   */
  data: Record<string, any>;

  /**
   * Event metadata
   */
  metadata?: {
    version?: string;
    traceId?: string;
    spanId?: string;
    [key: string]: any;
  };
}

/**
 * NATS message wrapper
 */
export interface NATSMessage {
  /**
   * Message subject
   */
  subject: string;

  /**
   * Message payload (JSON string)
   */
  payload: string;

  /**
   * Message headers
   */
  headers?: Record<string, string>;

  /**
   * Delivery info
   */
  delivery: {
    /**
     * Consumer name
     */
    consumer: string;

    /**
     * Consumer sequence
     */
    consumerSeq: number;

    /**
     * Stream sequence
     */
    streamSeq: number;

    /**
     * Number of remaining messages
     */
    pending: number;

    /**
     * Delivery timestamp
     */
    timestamp: Date;
  };
}

/**
 * Event bus configuration
 */
export interface EventBusConfig {
  /**
   * NATS servers
   */
  servers: string[];

  /**
   * Max reconnect attempts
   */
  maxReconnectAttempts?: number;

  /**
   * Reconnect timeout in milliseconds
   */
  reconnectTimeWait?: number;

  /**
   * Request timeout in milliseconds
   */
  requestTimeout?: number;

  /**
   * Enable debug logging
   */
  debug?: boolean;

  /**
   * Default queue group
   */
  queueGroup?: string;

  /**
   * Durable consumer name
   */
  durableName?: string;
}

/**
 * Event handler function
 */
export type EventHandler<T extends Event = Event> = (
  event: T
) => Promise<void> | void;

/**
 * Event filter
 */
export interface EventFilter {
  /**
   * Event type pattern
   */
  type?: string;

  /**
   * Event source
   */
  source?: string;

  /**
   * Time range
   */
  timeRange?: {
    start: Date;
    end: Date;
  };

  /**
   * Custom filter function
   */
  custom?: (event: Event) => boolean;
}

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /**
   * Queue group for load balancing
   */
  queue?: string;

  /**
   * Max in-flight messages
   */
  maxInFlight?: number;

  /**
   * Durable name for persistence
   */
  durable?: boolean;

  /**
   * Start position
   */
  startPosition?: 'beginning' | 'latest' | 'date';

  /**
   * Start date (if startPosition is 'date')
   */
  startDate?: Date;

  /**
   * Filter subjects
   */
  filterSubjects?: string[];
}

/**
 * Publish options
 */
export interface PublishOptions {
  /**
   * Expected reply count
   */
  expectedReplyCount?: number;

  /**
   * Reply timeout in milliseconds
   */
  replyTimeout?: number;

  /**
   * Idempotent key (for deduplication)
   */
  idempotentKey?: string;

  /**
   * Headers
   */
  headers?: Record<string, string>;
}

/**
 * Dead letter queue message
 */
export interface DeadLetterMessage {
  /**
   * Original message
   */
  message: NATSMessage;

  /**
   * Reason for DLQ placement
   */
  reason: 'max_deliveries' | 'nack' | 'timeout' | 'error';

  /**
   * Delivery attempts
   */
  attempts: number;

  /**
   * Last error
   */
  lastError?: string;

  /**
   * Timestamp
   */
  timestamp: Date;

  /**
   * Handler that failed
   */
  handler?: string;
}

/**
 * Event store entry
 */
export interface EventStoreEntry {
  /**
   * Event
   */
  event: Event;

  /**
   * Store position
   */
  position: number;

  /**
   * Version
   */
  version: number;

  /**
   * Stored at
   */
  storedAt: Date;

  /**
   * Checksum for integrity
   */
  checksum?: string;
}

/**
 * Event stream
 */
export interface EventStream {
  /**
   * Stream ID
   */
  id: string;

  /**
   * Stream subject
   */
  subject: string;

  /**
   * Max messages
   */
  maxMessages?: number;

  /**
   * Max bytes
   */
  maxBytes?: number;

  /**
   * Retention policy
   */
  retention?: 'limits' | 'interest' | 'workqueue';

  /**
   * Created at
   */
  createdAt: Date;

  /**
   * Last updated
   */
  updatedAt: Date;
}

/**
 * Event statistics
 */
export interface EventStats {
  /**
   * Total events
   */
  totalEvents: number;

  /**
   * Events by type
   */
  eventsByType: Record<string, number>;

  /**
   * Events by source
   */
  eventsBySource: Record<string, number>;

  /**
   * Failed deliveries
   */
  failedDeliveries: number;

  /**
   * Dead letter queue size
   */
  dlqSize: number;

  /**
   * Average processing time (ms)
   */
  avgProcessingTime: number;

  /**
   * Statistics period
   */
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Event retry policy
 */
export interface RetryPolicy {
  /**
   * Max retry attempts
   */
  maxAttempts: number;

  /**
   * Initial backoff in milliseconds
   */
  initialBackoff: number;

  /**
   * Max backoff in milliseconds
   */
  maxBackoff: number;

  /**
   * Backoff multiplier
   */
  backoffMultiplier: number;

  /**
   * Jitter enabled
   */
  jitter: boolean;
}

/**
 * Saga definition
 */
export interface SagaDefinition {
  /**
   * Saga ID
   */
  id: string;

  /**
   * Saga name
   */
  name: string;

  /**
   * Steps in saga
   */
  steps: SagaStep[];

  /**
   * Compensation steps
   */
  compensations?: CompensationStep[];

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Retry policy
   */
  retryPolicy?: RetryPolicy;
}

/**
 * Saga step
 */
export interface SagaStep {
  /**
   * Step ID
   */
  id: string;

  /**
   * Event to trigger
   */
  event: string;

  /**
   * Expected response event
   */
  expectedResponse: string;

  /**
   * Timeout in milliseconds
   */
  timeout: number;

  /**
   * Next step on success
   */
  nextStep?: string;

  /**
   * Compensation step on failure
   */
  compensationStep?: string;
}

/**
 * Compensation step
 */
export interface CompensationStep {
  /**
   * Compensation ID
   */
  id: string;

  /**
   * Event to trigger compensation
   */
  event: string;

  /**
   * Related saga step
   */
  relatedStep: string;
}

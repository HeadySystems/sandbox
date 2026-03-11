/**
 * HEADY Schema Registry
 *
 * Central registry of JSON Schema definitions for inter-service API contracts.
 * Provides TypeScript type generation and runtime validation.
 *
 * @module @heady/schemas
 */

import authSessionSchema from './auth-session.schema.json';
import notificationSchema from './notification.schema.json';
import billingEventSchema from './billing-event.schema.json';
import analyticsEventSchema from './analytics-event.schema.json';
import searchQuerySchema from './search-query.schema.json';
import vectorEmbeddingSchema from './vector-embedding.schema.json';
import healthCheckSchema from './health-check.schema.json';
import errorResponseSchema from './error-response.schema.json';
import cslSignalSchema from './csl-signal.schema.json';

export * from './validate';

/**
 * Map of schema identifiers to their definitions
 */
export const SCHEMAS = {
  'auth-session': authSessionSchema,
  'notification': notificationSchema,
  'billing-event': billingEventSchema,
  'analytics-event': analyticsEventSchema,
  'search-query': searchQuerySchema,
  'vector-embedding': vectorEmbeddingSchema,
  'health-check': healthCheckSchema,
  'error-response': errorResponseSchema,
  'csl-signal': cslSignalSchema,
} as const;

/**
 * Schema type literal
 */
export type SchemaId = keyof typeof SCHEMAS;

/**
 * Get schema by identifier
 *
 * @param schemaId - Schema identifier
 * @returns Schema definition
 * @throws Error if schema not found
 */
export function getSchema(schemaId: SchemaId): any {
  const schema = SCHEMAS[schemaId];
  if (!schema) {
    throw new Error(`Schema not found: ${schemaId}`);
  }
  return schema;
}

/**
 * List all available schema identifiers
 *
 * @returns Array of schema identifiers
 */
export function listSchemas(): SchemaId[] {
  return Object.keys(SCHEMAS) as SchemaId[];
}

/**
 * Check if schema identifier exists
 *
 * @param schemaId - Schema identifier
 * @returns True if schema exists
 */
export function hasSchema(schemaId: string): schemaId is SchemaId {
  return schemaId in SCHEMAS;
}

// ============================================================================
// Auth Session Types
// ============================================================================

export interface SessionCreateRequest {
  email: string;
  password: string;
  mfaToken?: string;
  deviceFingerprint?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName?: string;
  roles?: ('admin' | 'user' | 'editor' | 'viewer')[];
}

export interface SessionCreateResponse {
  sessionId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: SessionUser;
}

export interface SessionVerifyRequest {
  token: string;
}

export interface SessionVerifyResponse {
  valid: boolean;
  userId: string;
  sessionId: string;
  expiresAt: number;
  remainingTime?: number;
}

export interface SessionRevokeRequest {
  sessionId: string;
  reason?: 'logout' | 'timeout' | 'security' | 'admin';
}

export interface SessionRevokeResponse {
  success: boolean;
  revokedAt: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface NotificationSendRequest {
  userId?: string;
  userIds?: string[];
  type: 'email' | 'sms' | 'push' | 'websocket' | 'in-app';
  template?: string;
  subject: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  expireAt?: number;
  metadata?: {
    source?: string;
    correlationId?: string;
  };
}

export interface NotificationSendResponse {
  notificationIds: string[];
  successCount: number;
  failureCount?: number;
  createdAt: string;
}

export interface WebSocketMessage {
  type: 'notification' | 'update' | 'ping' | 'auth';
  id: string;
  timestamp: string;
  notificationId?: string;
  payload?: {
    title: string;
    message: string;
    icon?: string;
    actionUrl?: string;
    data?: Record<string, any>;
  };
  sequence?: number;
}

export interface WebSocketSubscription {
  action: 'subscribe' | 'unsubscribe';
  channels: string[];
}

// ============================================================================
// Billing Event Types
// ============================================================================

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'past_due';

export type SubscriptionEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.activated'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.cancelled'
  | 'subscription.expired'
  | 'subscription.trial_ended';

export interface SubscriptionEvent {
  eventId: string;
  eventType: SubscriptionEventType;
  timestamp: string;
  subscriptionId: string;
  customerId: string;
  planId?: string;
  status: SubscriptionStatus;
  data?: {
    previousStatus?: string;
    reason?: string;
    effectiveDate?: string;
    billingCycle?: {
      startDate: string;
      endDate: string;
    };
  };
}

export type PaymentEventType =
  | 'payment.initiated'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.refunded'
  | 'payment.disputed';

export interface PaymentEvent {
  eventId: string;
  eventType: PaymentEventType;
  timestamp: string;
  paymentId: string;
  customerId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed' | 'pending' | 'cancelled';
  data?: {
    method?: 'card' | 'bank_transfer' | 'paypal' | 'crypto';
    lastFour?: string;
    failureReason?: string;
  };
}

export interface WebhookPayload {
  id: string;
  apiVersion: string;
  timestamp: string;
  event: SubscriptionEvent | PaymentEvent;
  signature: string;
  retryCount?: number;
}

export interface UsageEvent {
  eventId: string;
  customerId: string;
  subscriptionId?: string;
  timestamp: string;
  meterType: 'api_calls' | 'storage_gb' | 'bandwidth_gb' | 'seats' | 'custom';
  quantity: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// Analytics Event Types
// ============================================================================

export interface AnalyticsEventProperties {
  [key: string]: any;
}

export interface AnalyticsEventContext {
  page?: {
    url?: string;
    path?: string;
    title?: string;
    referrer?: string;
  };
  userAgent?: string;
  ip?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  device?: {
    type?: 'mobile' | 'tablet' | 'desktop';
    brand?: string;
    model?: string;
    os?: 'ios' | 'android' | 'windows' | 'macos' | 'linux';
    osVersion?: string;
  };
  browser?: {
    name?: string;
    version?: string;
  };
}

export interface AnalyticsEvent {
  eventId: string;
  eventName: string;
  timestamp: string;
  userId?: string;
  sessionId: string;
  properties?: AnalyticsEventProperties;
  context?: AnalyticsEventContext;
}

export interface EventBatch {
  batchId: string;
  timestamp: string;
  events: AnalyticsEvent[];
  metadata?: {
    source?: string;
    environment?: 'production' | 'staging' | 'development';
    sdkVersion?: string;
  };
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchFilters {
  dateRange?: {
    from?: string;
    to?: string;
  };
  author?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived' | 'deleted';
  language?: string;
  [key: string]: any;
}

export interface SearchPagination {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface SearchSort {
  field?: 'relevance' | 'date' | 'updated' | 'title' | 'author';
  order?: 'asc' | 'desc';
}

export interface SearchRequest {
  q: string;
  type?: 'all' | 'documents' | 'users' | 'conversations' | 'resources' | 'analytics';
  filters?: SearchFilters;
  pagination?: SearchPagination;
  sort?: SearchSort;
  facets?: string[];
  highlight?: boolean;
  explain?: boolean;
}

export interface SearchHit {
  id: string;
  type: string;
  title: string;
  description?: string;
  content?: string;
  url?: string;
  metadata?: {
    author?: string;
    created?: string;
    updated?: string;
    tags?: string[];
    status?: string;
  };
  score: number;
  highlights?: Record<string, string[]>;
  explanation?: {
    factors?: Array<{ name: string; value: number }>;
  };
}

export interface SearchResponse {
  requestId: string;
  query: string;
  totalHits: number;
  hits: SearchHit[];
  facets?: Record<string, Array<{ value: string; count: number }>>;
  pagination?: {
    limit?: number;
    offset?: number;
    nextCursor?: string;
    hasMore?: boolean;
  };
  executionTime?: number;
  cached?: boolean;
}

// ============================================================================
// Vector Embedding Types
// ============================================================================

export type EmbeddingModel = 'sentence-transformers/all-MiniLM-L6-v2' | 'OpenAI' | 'custom';

export interface EmbeddingRequest {
  texts: string[];
  model?: EmbeddingModel;
  normalize?: boolean;
  dimensions?: 384;
  inputType?: 'search_document' | 'search_query' | 'clustering' | 'similarity';
  metadata?: {
    requestId?: string;
    userId?: string;
  };
}

export interface Embedding {
  text: string;
  vector: number[];
  index?: number;
}

export interface EmbeddingResponse {
  embeddings: Embedding[];
  model: EmbeddingModel;
  dimensions: 384;
  totalTokens?: number;
  processingTime?: number;
  cached?: boolean;
}

export interface VectorSimilarityRequest {
  vectors: number[][];
  method?: 'cosine' | 'euclidean' | 'manhattan' | 'dot_product';
}

export interface VectorSimilarityResponse {
  similarities: number[][];
  method: string;
}

export interface SemanticSearchRequest {
  query: string;
  queryVector?: number[];
  limit?: number;
  threshold?: number;
  collection?: string;
}

export interface SemanticSearchResult {
  id: string;
  text: string;
  similarity: number;
  metadata?: Record<string, any>;
}

export interface SemanticSearchResponse {
  query: string;
  results: SemanticSearchResult[];
  searchTime?: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckComponent {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface HealthCheckMetrics {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  requestsPerSecond?: number;
  p99ResponseTime?: number;
  errorRate?: number;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: {
    name: string;
    version: string;
    environment?: 'production' | 'staging' | 'development';
    uptime?: number;
  };
  checks?: Record<string, HealthCheckComponent>;
  dependencies?: Record<string, HealthCheckComponent>;
  metrics?: HealthCheckMetrics;
  details?: Record<string, any>;
}

export interface LivenessCheck {
  alive: boolean;
}

export interface ReadinessCheck {
  ready: boolean;
  reason?: string;
}

// ============================================================================
// Error Response Types
// ============================================================================

export type HeadyErrorCode =
  | 'HEADY_VALIDATION_ERROR'
  | 'HEADY_AUTH_INVALID_CREDENTIALS'
  | 'HEADY_AUTH_TOKEN_EXPIRED'
  | 'HEADY_AUTH_TOKEN_INVALID'
  | 'HEADY_AUTH_MFA_REQUIRED'
  | 'HEADY_AUTH_SESSION_NOT_FOUND'
  | 'HEADY_AUTHZ_INSUFFICIENT_PERMISSIONS'
  | 'HEADY_AUTHZ_RESOURCE_NOT_ACCESSIBLE'
  | 'HEADY_AUTHZ_ROLE_REQUIRED'
  | 'HEADY_RESOURCE_NOT_FOUND'
  | 'HEADY_RESOURCE_CONFLICT'
  | 'HEADY_RESOURCE_ALREADY_EXISTS'
  | 'HEADY_VERSION_CONFLICT'
  | 'HEADY_RATE_LIMIT_EXCEEDED'
  | 'HEADY_INTERNAL_ERROR'
  | 'HEADY_SERVICE_UNAVAILABLE'
  | 'HEADY_GATEWAY_ERROR';

export interface ErrorDetail {
  code: HeadyErrorCode;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  traceId?: string;
  details?: Record<string, any>;
}

export interface ErrorResponse {
  error: ErrorDetail;
}

// ============================================================================
// CSL Signal Types
// ============================================================================

export interface ConfidenceSignalFactor {
  name: string;
  weight: number;
  value: number;
}

export interface ConfidenceSignal {
  signalId: string;
  dataId: string;
  score: number;
  level: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  factors?: ConfidenceSignalFactor[];
  dataAge?: {
    createdAt?: string;
    updatedAt?: string;
    ageSeconds?: number;
  };
  sourceReliability?: {
    source?: string;
    reliability?: number;
    verifications?: number;
    historicalAccuracy?: number;
  };
  completeness?: number;
  consistency?: number;
  anomalies?: Array<{
    type: 'outlier' | 'missing' | 'inconsistent' | 'duplicate';
    severity: 'low' | 'medium' | 'high';
    description?: string;
  }>;
  metadata?: {
    requestId?: string;
    service?: string;
    timestamp?: string;
  };
}

export interface CSLGate {
  gateId: string;
  signalId: string;
  decision: 'pass' | 'caution' | 'block';
  threshold: number;
  signal?: ConfidenceSignal;
  metadata?: {
    reason?: string;
    suggestedAction?: 'proceed' | 'retry' | 'escalate' | 'reject';
  };
}

export interface CSLMetrics {
  pipelineId: string;
  period: {
    startTime?: string;
    endTime?: string;
  };
  averageConfidence: number;
  minConfidence?: number;
  maxConfidence?: number;
  signalCount: number;
  gateDecisions?: {
    pass?: number;
    caution?: number;
    block?: number;
  };
  anomalyCounts?: {
    outlier?: number;
    missing?: number;
    inconsistent?: number;
    duplicate?: number;
  };
}

// ============================================================================
// Export all types
// ============================================================================

export {
  authSessionSchema,
  notificationSchema,
  billingEventSchema,
  analyticsEventSchema,
  searchQuerySchema,
  vectorEmbeddingSchema,
  healthCheckSchema,
  errorResponseSchema,
  cslSignalSchema,
};

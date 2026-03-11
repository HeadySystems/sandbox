/**
 * Base Service Types
 *
 * Fundamental types for service identification, status reporting,
 * and inter-service communication.
 *
 * @module @heady/types
 */

/**
 * Service information
 */
export interface ServiceInfo {
  /**
   * Unique service identifier
   * @example 'auth-service'
   */
  id: string;

  /**
   * Service name
   * @example 'Authentication Service'
   */
  name: string;

  /**
   * Service version (semver)
   * @example '1.2.3'
   */
  version: string;

  /**
   * Service description
   */
  description?: string;

  /**
   * Runtime environment
   */
  environment: 'production' | 'staging' | 'development' | 'test';

  /**
   * Service team/owner
   */
  team?: string;

  /**
   * Repository URL
   */
  repository?: string;

  /**
   * Documentation URL
   */
  documentation?: string;

  /**
   * Contact email for service owner
   */
  contactEmail?: string;

  /**
   * Service health status
   */
  status: HealthStatus;

  /**
   * Service start time
   */
  startedAt: Date;

  /**
   * Service uptime in seconds
   */
  uptime: number;

  /**
   * Service capabilities/features
   */
  capabilities?: string[];

  /**
   * Service dependencies
   */
  dependencies?: ServiceDependency[];
}

/**
 * Service dependency reference
 */
export interface ServiceDependency {
  /**
   * Dependent service ID
   */
  serviceId: string;

  /**
   * Dependency type
   */
  type: 'required' | 'optional';

  /**
   * Current health of dependency
   */
  healthy: boolean;

  /**
   * Last health check time
   */
  lastChecked?: Date;
}

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'initializing';

/**
 * Health check result
 */
export interface HealthCheckResult {
  /**
   * Component name
   */
  component: string;

  /**
   * Health status
   */
  status: HealthStatus;

  /**
   * Status message
   */
  message?: string;

  /**
   * Check duration in milliseconds
   */
  duration: number;

  /**
   * Additional details
   */
  details?: Record<string, any>;

  /**
   * Last check timestamp
   */
  checkedAt: Date;
}

/**
 * Service metrics
 */
export interface ServiceMetrics {
  /**
   * Total requests handled
   */
  totalRequests: number;

  /**
   * Requests per second
   */
  requestsPerSecond: number;

  /**
   * Average response time in milliseconds
   */
  avgResponseTime: number;

  /**
   * P95 response time
   */
  p95ResponseTime: number;

  /**
   * P99 response time
   */
  p99ResponseTime: number;

  /**
   * Total errors
   */
  totalErrors: number;

  /**
   * Error rate (0-1)
   */
  errorRate: number;

  /**
   * Successful requests
   */
  successCount: number;

  /**
   * CPU usage percentage
   */
  cpuUsage: number;

  /**
   * Memory usage in bytes
   */
  memoryUsage: number;

  /**
   * Memory limit in bytes
   */
  memoryLimit: number;

  /**
   * Active connections
   */
  activeConnections: number;

  /**
   * Collection timestamp
   */
  timestamp: Date;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  /**
   * Service identification
   */
  service: ServiceInfo;

  /**
   * Server configuration
   */
  server: {
    host: string;
    port: number;
    timeout: number;
    maxConnections: number;
  };

  /**
   * Logging configuration
   */
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    format: 'json' | 'text';
    includeStackTrace: boolean;
  };

  /**
   * Feature flags
   */
  features?: Record<string, boolean>;

  /**
   * External service endpoints
   */
  endpoints?: Record<string, string>;

  /**
   * Security configuration
   */
  security?: {
    enableCors: boolean;
    enableRateLimit: boolean;
    enableAuth: boolean;
    jwtSecret?: string;
    apiKeyHeader?: string;
  };
}

/**
 * Service registration request
 */
export interface ServiceRegistrationRequest {
  /**
   * Service information
   */
  service: ServiceInfo;

  /**
   * Service endpoints
   */
  endpoints: {
    base: string;
    health: string;
    ready: string;
  };

  /**
   * Service metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Service registration response
 */
export interface ServiceRegistrationResponse {
  /**
   * Registration successful
   */
  registered: boolean;

  /**
   * Service ID
   */
  serviceId: string;

  /**
   * Registration timestamp
   */
  registeredAt: Date;

  /**
   * Service catalog entry
   */
  catalogEntry?: ServiceCatalogEntry;

  /**
   * Error message if registration failed
   */
  error?: string;
}

/**
 * Service catalog entry
 */
export interface ServiceCatalogEntry {
  /**
   * Service ID
   */
  id: string;

  /**
   * Service name
   */
  name: string;

  /**
   * Service version
   */
  version: string;

  /**
   * Service endpoints
   */
  endpoints: {
    base: string;
    health: string;
    ready: string;
  };

  /**
   * Service tags
   */
  tags: string[];

  /**
   * Service status
   */
  status: HealthStatus;

  /**
   * Last updated
   */
  updatedAt: Date;

  /**
   * Service metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Service discovery result
 */
export interface ServiceDiscoveryResult {
  /**
   * Found services
   */
  services: ServiceCatalogEntry[];

  /**
   * Total count
   */
  total: number;

  /**
   * Search query
   */
  query?: string;

  /**
   * Search timestamp
   */
  timestamp: Date;
}

/**
 * Service event
 */
export interface ServiceEvent {
  /**
   * Event ID
   */
  id: string;

  /**
   * Event type
   */
  type: 'registered' | 'deregistered' | 'healthy' | 'unhealthy' | 'updated';

  /**
   * Service ID
   */
  serviceId: string;

  /**
   * Service name
   */
  serviceName: string;

  /**
   * Event data
   */
  data?: Record<string, any>;

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Event source
   */
  source?: string;
}

/**
 * Service health aggregation
 */
export interface ServiceHealthAggregation {
  /**
   * Healthy services
   */
  healthy: number;

  /**
   * Degraded services
   */
  degraded: number;

  /**
   * Unhealthy services
   */
  unhealthy: number;

  /**
   * Services initializing
   */
  initializing: number;

  /**
   * Total services
   */
  total: number;

  /**
   * Overall status
   */
  overallStatus: HealthStatus;

  /**
   * Aggregation timestamp
   */
  timestamp: Date;
}

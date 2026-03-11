/**
 * Base Service Configuration
 *
 * Standard configuration options for HEADY services including
 * port, host, environment, logging level, and graceful shutdown settings.
 *
 * @module @heady/config
 */

/**
 * Service environment
 */
export type ServiceEnvironment = 'production' | 'staging' | 'development' | 'test';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Base service configuration
 */
export interface BaseServiceConfig {
  /**
   * Service name for logging and identification
   * @example 'auth-service'
   */
  name: string;

  /**
   * Service version (semver)
   * @example '1.2.3'
   */
  version: string;

  /**
   * Server host
   * @default 'localhost'
   */
  host: string;

  /**
   * Server port
   * @default 3000
   */
  port: number;

  /**
   * Runtime environment
   * @default process.env.NODE_ENV || 'development'
   */
  environment: ServiceEnvironment;

  /**
   * Log level
   * @default 'info'
   */
  logLevel: LogLevel;

  /**
   * Enable debug mode
   * @default false
   */
  debug: boolean;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  requestTimeout: number;

  /**
   * Graceful shutdown timeout in milliseconds
   * @default 30000
   */
  gracefulShutdownTimeout: number;

  /**
   * Max connections for HTTP server
   * @default 1000
   */
  maxConnections: number;

  /**
   * Keep-alive timeout in milliseconds
   * @default 65000
   */
  keepAliveTimeout: number;

  /**
   * Whether to enable compression
   * @default true
   */
  compression: boolean;

  /**
   * Trust proxy headers
   * @default false
   */
  trustProxy: boolean | string;

  /**
   * Request body size limit
   * @default '10mb'
   */
  requestBodyLimit: string;

  /**
   * Service metadata
   */
  metadata?: {
    team?: string;
    repository?: string;
    documentation?: string;
    [key: string]: any;
  };
}

/**
 * Get base service configuration from environment
 *
 * @param overrides - Configuration overrides
 * @returns Merged configuration
 *
 * @example
 * ```typescript
 * const config = getBaseServiceConfig({
 *   name: 'my-service',
 *   version: '1.0.0',
 * });
 * ```
 */
export function getBaseServiceConfig(
  overrides?: Partial<BaseServiceConfig>
): BaseServiceConfig {
  const config: BaseServiceConfig = {
    name: process.env.SERVICE_NAME || 'heady-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    host: process.env.SERVICE_HOST || 'localhost',
    port: parseInt(process.env.SERVICE_PORT || '3000', 10),
    environment: (process.env.NODE_ENV as ServiceEnvironment) || 'development',
    logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
    debug: process.env.DEBUG === 'true',
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    gracefulShutdownTimeout: parseInt(
      process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000',
      10
    ),
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000', 10),
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000', 10),
    compression: process.env.COMPRESSION !== 'false',
    trustProxy: process.env.TRUST_PROXY === 'true'
      ? true
      : process.env.TRUST_PROXY === 'false'
        ? false
        : process.env.TRUST_PROXY || false,
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '10mb',
    metadata: {
      team: process.env.SERVICE_TEAM,
      repository: process.env.SERVICE_REPO,
      documentation: process.env.SERVICE_DOCS,
    },
  };

  return { ...config, ...overrides };
}

/**
 * Validate base service configuration
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 *
 * @example
 * ```typescript
 * validateBaseServiceConfig(config);
 * ```
 */
export function validateBaseServiceConfig(config: BaseServiceConfig): void {
  const errors: string[] = [];

  if (!config.name || config.name.trim() === '') {
    errors.push('Service name is required');
  }

  if (!config.version || config.version.trim() === '') {
    errors.push('Service version is required');
  }

  if (!config.host || config.host.trim() === '') {
    errors.push('Service host is required');
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push('Service port must be between 1 and 65535');
  }

  if (!config.environment || !['production', 'staging', 'development', 'test'].includes(config.environment)) {
    errors.push('Service environment must be one of: production, staging, development, test');
  }

  if (!config.logLevel || !['debug', 'info', 'warn', 'error', 'fatal'].includes(config.logLevel)) {
    errors.push('Log level must be one of: debug, info, warn, error, fatal');
  }

  if (config.requestTimeout < 0) {
    errors.push('Request timeout must be non-negative');
  }

  if (config.gracefulShutdownTimeout < 0) {
    errors.push('Graceful shutdown timeout must be non-negative');
  }

  if (config.maxConnections < 1) {
    errors.push('Max connections must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid service configuration:\n${errors.join('\n')}`);
  }
}

/**
 * Get service URL from configuration
 *
 * @param config - Service configuration
 * @returns Service URL
 *
 * @example
 * ```typescript
 * const url = getServiceUrl(config);
 * // => 'http://localhost:3000'
 * ```
 */
export function getServiceUrl(config: BaseServiceConfig): string {
  const protocol = config.environment === 'production' ? 'https' : 'http';
  return `${protocol}://${config.host}:${config.port}`;
}

/**
 * Check if service is in production
 *
 * @param config - Service configuration
 * @returns True if environment is production
 */
export function isProduction(config: BaseServiceConfig): boolean {
  return config.environment === 'production';
}

/**
 * Check if service is in development
 *
 * @param config - Service configuration
 * @returns True if environment is development
 */
export function isDevelopment(config: BaseServiceConfig): boolean {
  return config.environment === 'development';
}

/**
 * Get log level value for comparison
 *
 * @param level - Log level
 * @returns Numeric value (higher = more severe)
 */
export function getLogLevelValue(level: LogLevel): number {
  const levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
  };
  return levels[level];
}

/**
 * Check if log level should be logged
 *
 * @param minLevel - Minimum log level
 * @param actualLevel - Actual log level
 * @returns True if message should be logged
 */
export function shouldLog(minLevel: LogLevel, actualLevel: LogLevel): boolean {
  return getLogLevelValue(actualLevel) >= getLogLevelValue(minLevel);
}

/**
 * Structured JSON Logging Configuration
 *
 * Provides structured JSON logging with context propagation,
 * correlation IDs, and distributed tracing support.
 *
 * @module @heady/config
 */

/**
 * Log context for correlation and tracing
 */
export interface LogContext {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  service?: string;
  environment?: string;
  [key: string]: any;
}

/**
 * Structured log entry
 */
export interface StructuredLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
  duration?: number;
}

/**
 * Create a structured log entry
 *
 * @param level - Log level
 * @param message - Log message
 * @param context - Log context
 * @param metadata - Additional metadata
 * @returns Structured log entry
 *
 * @example
 * ```typescript
 * const entry = createLogEntry('info', 'User logged in', { userId: '123' });
 * console.log(JSON.stringify(entry));
 * ```
 */
export function createLogEntry(
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  message: string,
  context?: LogContext,
  metadata?: Record<string, any>
): StructuredLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    metadata,
  };
}

/**
 * Create error log entry
 *
 * @param message - Error message
 * @param error - Error object
 * @param context - Log context
 * @returns Structured log entry
 */
export function createErrorLogEntry(
  message: string,
  error: Error | unknown,
  context?: LogContext
): StructuredLogEntry {
  const errorObj = error instanceof Error
    ? {
        message: error.message,
        code: (error as any).code,
        stack: error.stack,
      }
    : {
        message: String(error),
      };

  return {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    context,
    error: errorObj,
  };
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /**
   * Minimum log level
   * @default 'info'
   */
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';

  /**
   * Include stack traces for errors
   * @default true
   */
  includeStackTrace: boolean;

  /**
   * Include context in logs
   * @default true
   */
  includeContext: boolean;

  /**
   * Pretty print JSON (development only)
   * @default false
   */
  prettyPrint: boolean;

  /**
   * Output to stdout
   * @default true
   */
  stdout: boolean;

  /**
   * Output to file
   * @default false
   */
  fileOutput: boolean;

  /**
   * Log file path (if fileOutput is true)
   */
  filePath?: string;

  /**
   * Maximum file size before rotation (bytes)
   * @default 10485760 (10MB)
   */
  maxFileSize: number;

  /**
   * Maximum number of rotated files to keep
   * @default 5
   */
  maxFiles: number;

  /**
   * Enable request/response logging
   * @default true
   */
  logRequests: boolean;

  /**
   * Enable performance metrics logging
   * @default true
   */
  logMetrics: boolean;

  /**
   * Exclude endpoints from request logging
   */
  excludeEndpoints?: string[];

  /**
   * Sensitive fields to redact
   */
  redactFields?: string[];

  /**
   * Enable correlation ID propagation
   * @default true
   */
  correlationId: boolean;

  /**
   * Enable distributed tracing (B3, Jaeger)
   * @default true
   */
  distributedTracing: boolean;
}

/**
 * Get default logger configuration
 *
 * @param environment - Service environment
 * @returns Logger configuration
 *
 * @example
 * ```typescript
 * const config = getLoggerConfig('production');
 * ```
 */
export function getLoggerConfig(environment?: string): LoggerConfig {
  const isDev = environment === 'development' || process.env.NODE_ENV === 'development';

  return {
    level: (process.env.LOG_LEVEL as any) || (isDev ? 'debug' : 'info'),
    includeStackTrace: isDev || process.env.INCLUDE_STACK_TRACE === 'true',
    includeContext: true,
    prettyPrint: isDev && process.env.PRETTY_PRINT === 'true',
    stdout: true,
    fileOutput: process.env.LOG_FILE_OUTPUT === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    maxFileSize: parseInt(process.env.LOG_MAX_SIZE || '10485760', 10),
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
    logRequests: process.env.LOG_REQUESTS !== 'false',
    logMetrics: process.env.LOG_METRICS !== 'false',
    excludeEndpoints: ['/health', '/metrics', '/ready', '/alive'],
    redactFields: [
      'password',
      'token',
      'apiKey',
      'secret',
      'creditCard',
      'ssn',
      'authorization',
    ],
    correlationId: true,
    distributedTracing: true,
  };
}

/**
 * Redact sensitive fields from log data
 *
 * @param data - Data to redact
 * @param fields - Sensitive field names
 * @returns Data with sensitive fields redacted
 *
 * @example
 * ```typescript
 * const redacted = redactSensitiveFields(userData, ['password', 'token']);
 * ```
 */
export function redactSensitiveFields(
  data: any,
  fields: string[] = ['password', 'token', 'apiKey']
): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const redacted = Array.isArray(data) ? [...data] : { ...data };

  const redact = (obj: any) => {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const lowerKey = key.toLowerCase();
        if (fields.some(f => lowerKey.includes(f.toLowerCase()))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          redact(obj[key]);
        }
      }
    }
  };

  redact(redacted);
  return redacted;
}

/**
 * Extract correlation ID from headers
 *
 * @param headers - Request headers
 * @returns Correlation ID
 *
 * @example
 * ```typescript
 * const correlationId = getCorrelationId(req.headers);
 * ```
 */
export function getCorrelationId(headers: Record<string, any>): string {
  return (
    headers['x-correlation-id']
    || headers['x-request-id']
    || headers['x-amzn-trace-id']
    || headers['trace-id']
    || generateCorrelationId()
  );
}

/**
 * Generate a new correlation ID
 *
 * @returns Generated correlation ID
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract B3 distributed tracing headers
 *
 * @param headers - Request headers
 * @returns B3 trace context
 *
 * @example
 * ```typescript
 * const b3 = extractB3Trace(req.headers);
 * ```
 */
export function extractB3Trace(headers: Record<string, any>) {
  return {
    traceId: headers['x-b3-traceid'],
    spanId: headers['x-b3-spanid'],
    parentSpanId: headers['x-b3-parentspanid'],
    sampled: headers['x-b3-sampled'],
    flags: headers['x-b3-flags'],
  };
}

/**
 * Extract Jaeger distributed tracing headers
 *
 * @param headers - Request headers
 * @returns Jaeger trace context
 */
export function extractJaegerTrace(headers: Record<string, any>) {
  const uberpTrace = headers['uber-trace-id'];
  if (!uberpTrace) {
    return null;
  }

  const [traceId, spanId, parentSpanId, flags] = uberpTrace.split(':');
  return { traceId, spanId, parentSpanId, flags };
}

/**
 * Create log context from request
 *
 * @param req - Express request object
 * @returns Log context
 *
 * @example
 * ```typescript
 * const context = createLogContextFromRequest(req);
 * ```
 */
export function createLogContextFromRequest(req: any): LogContext {
  return {
    requestId: req.id || getCorrelationId(req.headers),
    correlationId: req.headers['x-correlation-id'],
    traceId: req.headers['x-b3-traceid'] || req.headers['x-trace-id'],
    spanId: req.headers['x-b3-spanid'],
    userId: req.user?.id,
    sessionId: req.session?.id,
    service: req.app?.locals?.serviceName,
    environment: process.env.NODE_ENV,
  };
}

/**
 * Format log entry for output
 *
 * @param entry - Log entry
 * @param prettyPrint - Whether to pretty print
 * @returns Formatted log string
 */
export function formatLogEntry(entry: StructuredLogEntry, prettyPrint = false): string {
  if (prettyPrint) {
    return JSON.stringify(entry, null, 2);
  }
  return JSON.stringify(entry);
}

/**
 * Log levels in order of severity
 */
export const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
} as const;

/**
 * Check if log level should be logged
 *
 * @param minLevel - Minimum log level
 * @param actualLevel - Actual log level
 * @returns True if message should be logged
 */
export function shouldLog(
  minLevel: keyof typeof LOG_LEVELS,
  actualLevel: keyof typeof LOG_LEVELS
): boolean {
  return LOG_LEVELS[actualLevel] >= LOG_LEVELS[minLevel];
}

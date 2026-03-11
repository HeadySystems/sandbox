/**
 * Common Express Middleware Stack
 *
 * Factory for building a standard middleware stack across HEADY services
 * including logging, CORS, rate limiting, and error handling.
 *
 * @module @heady/config
 */

import { Express, Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { getCorsConfig } from './cors';
import { createLogContextFromRequest, formatLogEntry, createLogEntry, redactSensitiveFields } from './logging';

/**
 * Middleware stack configuration
 */
export interface MiddlewareStackConfig {
  /**
   * Enable CORS middleware
   * @default true
   */
  cors?: boolean;

  /**
   * Enable compression middleware
   * @default true
   */
  compression?: boolean;

  /**
   * Enable request logging
   * @default true
   */
  requestLogging?: boolean;

  /**
   * Enable request ID assignment
   * @default true
   */
  requestId?: boolean;

  /**
   * Enable rate limiting
   * @default true
   */
  rateLimit?: boolean;

  /**
   * Enable error handler
   * @default true
   */
  errorHandler?: boolean;

  /**
   * Enable request validation
   * @default true
   */
  validation?: boolean;

  /**
   * Environment
   */
  environment?: string;

  /**
   * Rate limit options
   */
  rateLimitConfig?: {
    windowMs: number;
    maxRequests: number;
    message?: string;
  };

  /**
   * Excluded paths from logging
   */
  excludeFromLogging?: string[];

  /**
   * Sensitive fields to redact
   */
  redactFields?: string[];
}

/**
 * Build middleware stack
 *
 * @param app - Express app
 * @param config - Middleware configuration
 *
 * @example
 * ```typescript
 * buildMiddlewareStack(app, {
 *   cors: true,
 *   compression: true,
 *   requestLogging: true,
 *   rateLimit: true,
 * });
 * ```
 */
export function buildMiddlewareStack(
  app: Express,
  config: MiddlewareStackConfig = {}
): void {
  // Set config defaults
  const {
    cors: enableCors = true,
    compression: enableCompression = true,
    requestLogging: enableRequestLogging = true,
    requestId: enableRequestId = true,
    rateLimit: enableRateLimit = true,
    errorHandler: enableErrorHandler = true,
    environment = process.env.NODE_ENV,
    rateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    },
    excludeFromLogging = ['/health', '/alive', '/ready', '/metrics'],
    redactFields = ['password', 'token', 'apiKey', 'authorization'],
  } = config;

  // Middleware order is critical!

  // 1. Trust proxy headers first (before any logging/cors)
  app.set('trust proxy', 1);

  // 2. Request ID middleware
  if (enableRequestId) {
    app.use(createRequestIdMiddleware());
  }

  // 3. CORS middleware
  if (enableCors) {
    const cors = require('cors');
    app.use(cors(getCorsConfig(environment)));
  }

  // 4. Compression middleware
  if (enableCompression) {
    app.use(
      compression({
        threshold: 1024, // Only compress responses > 1KB
        level: 6, // Compression level (0-9)
      })
    );
  }

  // 5. Body parsing middleware
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true }));

  // 6. Request logging middleware
  if (enableRequestLogging) {
    app.use(createRequestLoggingMiddleware(excludeFromLogging, redactFields));
  }

  // 7. Rate limiting middleware
  if (enableRateLimit) {
    app.use(createRateLimitMiddleware(rateLimitConfig));
  }

  // 8. Error handling middleware (added last)
  if (enableErrorHandler) {
    app.use(createErrorHandlerMiddleware());
  }
}

/**
 * Create request ID middleware
 *
 * Assigns unique request IDs for tracing
 *
 * @returns Express middleware
 */
export function createRequestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId =
      req.headers['x-request-id']
      || req.headers['x-correlation-id']
      || req.headers['trace-id']
      || generateRequestId();

    req.id = String(requestId);
    res.setHeader('X-Request-ID', req.id);

    next();
  };
}

/**
 * Create request logging middleware
 *
 * Logs incoming and outgoing requests in structured format
 *
 * @param excludedPaths - Paths to exclude from logging
 * @param redactFields - Fields to redact from logs
 * @returns Express middleware
 */
export function createRequestLoggingMiddleware(
  excludedPaths: string[] = [],
  redactFields: string[] = []
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging for excluded paths
    if (excludedPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const context = createLogContextFromRequest(req);

    // Log request
    const requestLog = createLogEntry('info', 'Incoming request', context, {
      method: req.method,
      path: req.path,
      query: redactSensitiveFields(req.query, redactFields),
      headers: redactSensitiveFields(req.headers, redactFields),
    });

    console.log(formatLogEntry(requestLog));

    // Hook response finish event
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      const responseLog = createLogEntry(level, 'Request completed', context, {
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        contentLength: res.get('content-length'),
      });

      console.log(formatLogEntry(responseLog));
    });

    next();
  };
}

/**
 * Create rate limiting middleware
 *
 * Simple in-memory rate limiting
 *
 * @param config - Rate limit configuration
 * @returns Express middleware
 */
export function createRateLimitMiddleware(config: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const requests = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create request times for this IP
    let times = requests.get(ip) || [];
    times = times.filter(time => time > windowStart);

    if (times.length >= config.maxRequests) {
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(Math.max(...times) + config.windowMs).toISOString()
      );

      return res.status(429).json({
        error: {
          code: 'HEADY_RATE_LIMIT_EXCEEDED',
          message: config.message || 'Too many requests',
          statusCode: 429,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Add current request
    times.push(now);
    requests.set(ip, times);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', config.maxRequests - times.length);
    res.setHeader(
      'X-RateLimit-Reset',
      new Date(Math.max(...times) + config.windowMs).toISOString()
    );

    next();
  };
}

/**
 * Create error handling middleware
 *
 * Catches and formats errors
 *
 * @returns Express middleware
 */
export function createErrorHandlerMiddleware() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    const requestId = req.id || 'unknown';
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';

    // Create error response
    const errorResponse = {
      error: {
        code: err.code || 'HEADY_INTERNAL_ERROR',
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId,
        details: err.details || {},
      },
    };

    // Log error
    const errorLog = createLogEntry('error', `Request failed: ${message}`, {
      requestId,
      service: req.app?.locals?.serviceName,
    });

    console.error(formatLogEntry(errorLog));

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development' && err.stack) {
      (errorResponse.error as any).stack = err.stack.split('\n');
    }

    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Generate a unique request ID
 *
 * @returns Request ID
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a custom middleware
 *
 * @param name - Middleware name
 * @param handler - Middleware handler
 * @returns Express middleware
 *
 * @example
 * ```typescript
 * const authMiddleware = createCustomMiddleware('auth', async (req, res, next) => {
 *   // Custom logic
 *   next();
 * });
 * ```
 */
export function createCustomMiddleware(
  name: string,
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

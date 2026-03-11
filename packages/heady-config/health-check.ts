/**
 * Health Check Endpoint Builder
 *
 * Factory for creating standard health check endpoints for Kubernetes
 * liveness, readiness, and startup probes.
 *
 * @module @heady/config
 */

import { Express, Request, Response } from 'express';
import { HealthCheckResponse, HealthCheckComponent } from '@heady/schemas';

/**
 * Health check probe type
 */
export type ProbeType = 'liveness' | 'readiness' | 'startup';

/**
 * Health check handler
 */
export type HealthCheckHandler = (req: Request) => Promise<HealthCheckComponent | boolean>;

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /**
   * Service name
   */
  serviceName: string;

  /**
   * Service version
   */
  serviceVersion: string;

  /**
   * Service environment
   */
  environment: string;

  /**
   * Custom health check handlers
   */
  checks?: Record<string, HealthCheckHandler>;

  /**
   * Custom dependency handlers
   */
  dependencies?: Record<string, HealthCheckHandler>;

  /**
   * Include metrics in response
   * @default false
   */
  includeMetrics?: boolean;

  /**
   * Include system information
   * @default false
   */
  includeSystemInfo?: boolean;

  /**
   * Service start time for uptime calculation
   */
  startTime?: Date;
}

/**
 * Get initial health check response
 *
 * @param config - Health check configuration
 * @returns Initial response structure
 */
function getInitialResponse(config: HealthCheckConfig): HealthCheckResponse {
  const now = new Date();
  const uptime = config.startTime
    ? Math.floor((now.getTime() - config.startTime.getTime()) / 1000)
    : 0;

  return {
    status: 'healthy',
    timestamp: now.toISOString(),
    service: {
      name: config.serviceName,
      version: config.serviceVersion,
      environment: config.environment as any,
      uptime,
    },
    checks: {},
    dependencies: {},
  };
}

/**
 * Run health check handler
 *
 * @param handler - Handler function
 * @param req - Express request
 * @returns Health check result
 */
async function runHealthCheck(
  handler: HealthCheckHandler,
  req: Request
): Promise<HealthCheckComponent> {
  const startTime = Date.now();

  try {
    const result = await handler(req);

    const responseTime = Date.now() - startTime;

    if (typeof result === 'boolean') {
      return {
        status: result ? 'healthy' : 'unhealthy',
        responseTime,
      };
    }

    return {
      ...result,
      responseTime: result.responseTime || responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
    };
  }
}

/**
 * Determine overall health status
 *
 * @param checks - Individual check results
 * @returns Overall status
 */
function getOverallStatus(checks: Record<string, HealthCheckComponent>): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(checks).map(c => c.status);

  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }

  if (statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

/**
 * Register health check endpoints on Express app
 *
 * @param app - Express app
 * @param config - Health check configuration
 *
 * @example
 * ```typescript
 * registerHealthCheckEndpoints(app, {
 *   serviceName: 'auth-service',
 *   serviceVersion: '1.0.0',
 *   environment: 'production',
 *   checks: {
 *     database: async () => ({ status: 'healthy' }),
 *     cache: async () => ({ status: 'healthy' }),
 *   },
 * });
 * ```
 */
export function registerHealthCheckEndpoints(
  app: Express,
  config: HealthCheckConfig
): void {
  // Full health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    const response = getInitialResponse(config);

    // Run custom checks
    if (config.checks) {
      for (const [name, handler] of Object.entries(config.checks)) {
        response.checks![name] = await runHealthCheck(handler, req);
      }
    }

    // Run dependency checks
    if (config.dependencies) {
      for (const [name, handler] of Object.entries(config.dependencies)) {
        response.dependencies![name] = await runHealthCheck(handler, req);
      }
    }

    // Determine overall status
    const allChecks = {
      ...response.checks,
      ...response.dependencies,
    };

    response.status = getOverallStatus(allChecks);

    const statusCode = response.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  });

  // Kubernetes liveness probe (just check if process is alive)
  app.get('/alive', (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  });

  // Kubernetes readiness probe (check if ready to receive traffic)
  app.get('/ready', async (req: Request, res: Response) => {
    try {
      // Run critical dependency checks
      const criticalDeps = config.dependencies || {};
      const results: Record<string, boolean> = {};

      for (const [name, handler] of Object.entries(criticalDeps)) {
        const result = await runHealthCheck(handler, req);
        results[name] = result.status !== 'unhealthy';
      }

      const allReady = Object.values(results).every(r => r);

      if (allReady) {
        res.status(200).json({ ready: true });
      } else {
        const failedDeps = Object.entries(results)
          .filter(([, ready]) => !ready)
          .map(([name]) => name);

        res.status(503).json({
          ready: false,
          reason: `Dependencies not ready: ${failedDeps.join(', ')}`,
        });
      }
    } catch (error) {
      res.status(503).json({
        ready: false,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Startup probe for long-running initialization
  app.get('/startup', async (req: Request, res: Response) => {
    try {
      const response = getInitialResponse(config);

      if (config.checks) {
        for (const [name, handler] of Object.entries(config.checks)) {
          response.checks![name] = await runHealthCheck(handler, req);
        }
      }

      const allChecks = {
        ...response.checks,
      };

      response.status = getOverallStatus(allChecks);

      const statusCode = response.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Startup failed',
      });
    }
  });
}

/**
 * Create a database health check handler
 *
 * @param pool - Database connection pool with query method
 * @returns Health check handler
 *
 * @example
 * ```typescript
 * const dbCheck = createDatabaseHealthCheck(pgPool);
 * registerHealthCheckEndpoints(app, {
 *   serviceName: 'api',
 *   serviceVersion: '1.0.0',
 *   environment: 'production',
 *   dependencies: { database: dbCheck },
 * });
 * ```
 */
export function createDatabaseHealthCheck(
  pool: { query: (sql: string) => Promise<any> }
): HealthCheckHandler {
  return async () => {
    try {
      await pool.query('SELECT 1');
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database query failed',
      };
    }
  };
}

/**
 * Create a Redis health check handler
 *
 * @param client - Redis client with ping method
 * @returns Health check handler
 */
export function createRedisHealthCheck(
  client: { ping: () => Promise<string> }
): HealthCheckHandler {
  return async () => {
    try {
      await client.ping();
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Redis ping failed',
      };
    }
  };
}

/**
 * Create an HTTP health check handler
 *
 * @param url - URL to check
 * @param options - Fetch options
 * @returns Health check handler
 */
export function createHttpHealthCheck(
  url: string,
  options?: RequestInit & { expectedStatus?: number }
): HealthCheckHandler {
  return async () => {
    try {
      const expectedStatus = options?.expectedStatus || 200;
      const response = await fetch(url, options);

      if (response.status === expectedStatus) {
        return { status: 'healthy' };
      }

      return {
        status: 'unhealthy',
        message: `Expected status ${expectedStatus}, got ${response.status}`,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'HTTP request failed',
      };
    }
  };
}

/**
 * Create a memory usage health check handler
 *
 * @param threshold - Memory usage threshold (0-1)
 * @returns Health check handler
 */
export function createMemoryHealthCheck(threshold = 0.85): HealthCheckHandler {
  return async () => {
    const usage = process.memoryUsage();
    const heapUsedPercent = usage.heapUsed / usage.heapTotal;

    if (heapUsedPercent > threshold) {
      return {
        status: 'degraded',
        message: `Memory usage at ${(heapUsedPercent * 100).toFixed(2)}%`,
        details: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          percent: heapUsedPercent,
        },
      };
    }

    return {
      status: 'healthy',
      details: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        percent: heapUsedPercent,
      },
    };
  };
}

/**
 * Create a disk space health check handler
 *
 * @param path - Path to check
 * @param threshold - Disk usage threshold (0-1)
 * @returns Health check handler
 */
export function createDiskSpaceHealthCheck(
  path = '/',
  threshold = 0.9
): HealthCheckHandler {
  return async () => {
    try {
      // Note: This would require a library like 'diskusage' in production
      // This is a placeholder implementation
      return {
        status: 'healthy',
        details: { path },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Disk check failed',
      };
    }
  };
}

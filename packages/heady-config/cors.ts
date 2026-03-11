/**
 * CORS Configuration
 *
 * Shared CORS configuration for ~60 HEADY platform domains.
 * Provides security-conscious defaults for cross-origin requests.
 *
 * @module @heady/config
 */

import { CorsOptions } from 'cors';

/**
 * HEADY allowed origin domains (approximately 60 domains)
 * Includes main platform, subdomains, development, staging, and partner domains
 */
const HEADY_ALLOWED_ORIGINS = [
  // Primary domains
  'https://heady.io',
  'https://www.heady.io',
  'https://api.heady.io',
  'https://app.heady.io',
  'https://admin.heady.io',

  // Feature-specific domains
  'https://search.heady.io',
  'https://analytics.heady.io',
  'https://billing.heady.io',
  'https://auth.heady.io',
  'https://notifications.heady.io',
  'https://chat.heady.io',
  'https://docs.heady.io',
  'https://dashboard.heady.io',

  // Regional domains
  'https://eu.heady.io',
  'https://asia.heady.io',
  'https://us.heady.io',

  // Team/workspace domains
  'https://teams.heady.io',
  'https://workspace.heady.io',
  'https://collab.heady.io',

  // Staging domains
  'https://staging.heady.io',
  'https://app-staging.heady.io',
  'https://api-staging.heady.io',

  // Development domains
  'https://dev.heady.io',
  'https://app-dev.heady.io',

  // Localhost for development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8000',
  'http://localhost:8001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',

  // Partner/integration domains
  'https://partners.heady.io',
  'https://integrations.heady.io',
  'https://marketplace.heady.io',

  // Embedded widgets
  'https://widget.heady.io',
  'https://embed.heady.io',

  // CDN domains
  'https://cdn.heady.io',
  'https://static.heady.io',
  'https://assets.heady.io',

  // Enterprise domains (customer-specific)
  'https://enterprise.heady.io',
  'https://white-label.heady.io',

  // Monitoring and observability
  'https://monitoring.heady.io',
  'https://logs.heady.io',
  'https://metrics.heady.io',
  'https://tracing.heady.io',

  // Additional service domains
  'https://webhooks.heady.io',
  'https://events.heady.io',
  'https://queue.heady.io',

  // Mobile apps (custom schemes would be handled separately)
  // https://capacitor.io/docs/guides/deep-links
];

/**
 * Get CORS configuration for production
 *
 * @returns CORS options
 *
 * @example
 * ```typescript
 * import cors from 'cors';
 * import { getCorsConfig } from '@heady/config';
 *
 * app.use(cors(getCorsConfig('production')));
 * ```
 */
export function getCorsConfig(environment?: string): CorsOptions {
  const isDev = environment === 'development' || process.env.NODE_ENV === 'development';

  return {
    // Allowed origins
    origin: isDev
      ? (origin, callback) => {
          // Allow any origin in development
          callback(null, true);
        }
      : (origin, callback) => {
          if (!origin) {
            // Allow requests with no origin (like mobile apps, curl requests)
            callback(null, true);
          } else if (HEADY_ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },

    // Allowed HTTP methods
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

    // Allowed request headers
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'X-Request-ID',
      'X-Correlation-ID',
      'X-B3-TraceId',
      'X-B3-SpanId',
      'Accept',
      'Accept-Language',
      'Accept-Encoding',
      'Cache-Control',
      'Pragma',
      'User-Agent',
    ],

    // Expose headers to client
    exposedHeaders: [
      'Content-Type',
      'Content-Length',
      'Content-Encoding',
      'X-Request-ID',
      'X-Correlation-ID',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Response-Time',
      'Retry-After',
      'ETag',
    ],

    // Credentials
    credentials: true,

    // Cache preflight request for 24 hours
    maxAge: 86400,

    // Preflight request handling
    preflightContinue: false,

    // Success status for preflight
    optionsSuccessStatus: 200,
  };
}

/**
 * Strict CORS configuration for public APIs
 * More restrictive than default
 *
 * @returns CORS options
 */
export function getStrictCorsConfig(): CorsOptions {
  return {
    origin: (origin, callback) => {
      const whitelist = [
        'https://heady.io',
        'https://www.heady.io',
        'https://app.heady.io',
      ];

      if (!origin || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },

    methods: ['GET', 'OPTIONS'],

    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],

    credentials: false,

    maxAge: 3600,

    optionsSuccessStatus: 200,
  };
}

/**
 * Permissive CORS configuration for internal APIs
 * More permissive than default
 *
 * @returns CORS options
 */
export function getPermissiveCorsConfig(): CorsOptions {
  return {
    origin: true, // Allow all origins

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

    allowedHeaders: ['*'], // Allow all headers

    credentials: true,

    maxAge: 86400,

    optionsSuccessStatus: 200,
  };
}

/**
 * Get CORS configuration for webhook endpoints
 * More restrictive for security
 *
 * @returns CORS options
 */
export function getWebhookCorsConfig(): CorsOptions {
  return {
    // Webhooks should be called from our infrastructure only
    origin: (origin, callback) => {
      const internalOrigins = [
        'https://api.heady.io',
        'https://webhooks.heady.io',
        'https://events.heady.io',
      ];

      if (!origin || internalOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },

    methods: ['POST', 'OPTIONS'],

    allowedHeaders: [
      'Content-Type',
      'X-Webhook-Signature',
      'X-Webhook-ID',
      'X-Timestamp',
    ],

    credentials: false,

    maxAge: 3600,

    optionsSuccessStatus: 200,
  };
}

/**
 * Check if origin is allowed
 *
 * @param origin - Request origin
 * @param environment - Service environment
 * @returns True if origin is allowed
 *
 * @example
 * ```typescript
 * if (isOriginAllowed(req.get('origin'), 'production')) {
 *   // Handle request
 * }
 * ```
 */
export function isOriginAllowed(origin: string | undefined, environment?: string): boolean {
  const isDev = environment === 'development';

  if (isDev) {
    return true;
  }

  if (!origin) {
    return true; // Allow requests without origin
  }

  return HEADY_ALLOWED_ORIGINS.includes(origin);
}

/**
 * Add origin to allowed list
 *
 * @param origin - Origin to add
 *
 * @example
 * ```typescript
 * addAllowedOrigin('https://partner.example.com');
 * ```
 */
export function addAllowedOrigin(origin: string): void {
  if (!HEADY_ALLOWED_ORIGINS.includes(origin)) {
    HEADY_ALLOWED_ORIGINS.push(origin);
  }
}

/**
 * Remove origin from allowed list
 *
 * @param origin - Origin to remove
 */
export function removeAllowedOrigin(origin: string): void {
  const index = HEADY_ALLOWED_ORIGINS.indexOf(origin);
  if (index > -1) {
    HEADY_ALLOWED_ORIGINS.splice(index, 1);
  }
}

/**
 * Get list of allowed origins
 *
 * @returns Array of allowed origins
 */
export function getAllowedOrigins(): string[] {
  return [...HEADY_ALLOWED_ORIGINS];
}

/**
 * Replace all allowed origins
 *
 * @param origins - New list of origins
 */
export function setAllowedOrigins(origins: string[]): void {
  HEADY_ALLOWED_ORIGINS.length = 0;
  HEADY_ALLOWED_ORIGINS.push(...origins);
}

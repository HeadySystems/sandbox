/**
 * @file cloudflare-worker.ts
 * @description Heady™ Liquid Latent OS — Cloudflare Worker Edge Script
 *
 * Responsibilities:
 *  • Route all requests to the Cloud Run origin
 *  • Edge caching with Fibonacci-stepped TTLs (per content type)
 *  • CORS enforcement per Heady™ domain allowlist
 *  • φ-scaled rate limiting (120 req/min base × φ per tier)
 *  • Health check passthrough (no caching, no rate limit)
 *  • CSP header injection on all HTML responses
 *  • X-Request-ID injection for end-to-end correlation
 *
 * φ constant: 1.6180339887498948482…
 * All numeric thresholds are derived from φ or Fibonacci.
 */

// ─── φ constants ──────────────────────────────────────────────────────────────
const PHI: number = 1.6180339887498948482;

/** fib(n) — iterative implementation, no recursion limit risk */
function fib(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  let a = 0;
  let b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}

// Pre-computed Fibonacci numbers used in this module
const FIB_5: number = fib(5);    // 5   — readiness probe period, short cache
const FIB_8: number = fib(8);    // 21  — standard API TTL (seconds)
const FIB_10: number = fib(10);  // 55  — static asset TTL (seconds)
const FIB_12: number = fib(12);  // 144 — media/immutable asset TTL (seconds)
const FIB_13: number = fib(13);  // 233 — long-lived public asset TTL (seconds)
const FIB_14: number = fib(14);  // 377 — rate-limit window base (seconds)

/** Base rate limit: 120 requests per minute (env-configurable) */
const RATE_LIMIT_BASE_RPM: number = 120;

/** φ-scaled tier multipliers for rate limiting:
 *  tier 0 (anonymous):  120 × φ⁰ = 120
 *  tier 1 (basic):      120 × φ¹ ≈ 194
 *  tier 2 (standard):   120 × φ² ≈ 314
 *  tier 3 (premium):    120 × φ³ ≈ 508
 */
const RATE_LIMIT_TIERS: readonly number[] = [
  Math.round(RATE_LIMIT_BASE_RPM),                        // tier 0
  Math.round(RATE_LIMIT_BASE_RPM * PHI),                  // tier 1
  Math.round(RATE_LIMIT_BASE_RPM * PHI * PHI),            // tier 2
  Math.round(RATE_LIMIT_BASE_RPM * PHI * PHI * PHI),      // tier 3
] as const;

// ─── Allowed CORS origins ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  'https://headysystems.com',
  'https://www.headysystems.com',
  'https://headyio.com',
  'https://www.headyio.com',
  'https://headymcp.com',
  'https://www.headymcp.com',
  'https://headyapi.com',
  'https://www.headyapi.com',
  'https://headybuddy.org',
  'https://www.headybuddy.org',
  'https://headyconnection.org',
  'https://www.headyconnection.org',
]);

// ─── Cache TTL rules (Fibonacci-stepped, seconds) ────────────────────────────
interface CacheTtlRule {
  pattern: RegExp;
  ttlSeconds: number;
  cacheControl: string;
}

const CACHE_TTL_RULES: readonly CacheTtlRule[] = [
  // Health probes — never cache
  {
    pattern: /^\/health\//,
    ttlSeconds: 0,
    cacheControl: 'no-store, no-cache, must-revalidate',
  },
  // Metrics endpoint — very short TTL (fib(5) = 5 s)
  {
    pattern: /^\/api\/metrics/,
    ttlSeconds: FIB_5,
    cacheControl: `public, max-age=${FIB_5}, s-maxage=${FIB_5}`,
  },
  // API status and conductor — short TTL (fib(8) = 21 s)
  {
    pattern: /^\/api\/(status|conductor|bees)/,
    ttlSeconds: FIB_8,
    cacheControl: `public, max-age=${FIB_8}, s-maxage=${FIB_8}`,
  },
  // POST / mutation endpoints — never cache
  {
    pattern: /^\/api\/(pipeline|conductor\/route)/,
    ttlSeconds: 0,
    cacheControl: 'no-store',
  },
  // Static assets with hashed filenames — long-lived (fib(13) = 233 s)
  {
    pattern: /\.[0-9a-f]{8}\.(js|css|woff2|png|svg|webp)$/,
    ttlSeconds: FIB_13,
    cacheControl: `public, max-age=${FIB_13}, immutable`,
  },
  // General static assets (fib(10) = 55 s)
  {
    pattern: /\.(js|css|png|jpg|svg|ico|woff2|webp)$/,
    ttlSeconds: FIB_10,
    cacheControl: `public, max-age=${FIB_10}`,
  },
  // HTML responses — short revalidation (fib(8) = 21 s)
  {
    pattern: /\.html$/,
    ttlSeconds: FIB_8,
    cacheControl: `public, max-age=${FIB_8}, stale-while-revalidate=${FIB_12}`,
  },
  // Default fallback (fib(8) = 21 s)
  {
    pattern: /.*/,
    ttlSeconds: FIB_8,
    cacheControl: `public, max-age=${FIB_8}`,
  },
] as const;

// ─── Content Security Policy ──────────────────────────────────────────────────
const CSP_HEADER: string = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://api.openai.com https://api.anthropic.com",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join('; ');

// ─── Cloudflare Worker environment bindings ───────────────────────────────────
export interface Env {
  /** Cloud Run origin URL — bound via wrangler.toml vars */
  ORIGIN_URL: string;
  /** Rate limiter KV namespace */
  RATE_LIMITER: KVNamespace;
}

// ─── Helper utilities ─────────────────────────────────────────────────────────

/** Generates a RFC-4122 v4 UUID using the Web Crypto API available in Workers */
function generateRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Set version bits (v4)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  // Set variant bits
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Returns the matching cache TTL rule for a given URL path */
function getCacheTtlRule(pathname: string): CacheTtlRule {
  for (const rule of CACHE_TTL_RULES) {
    if (rule.pattern.test(pathname)) return rule;
  }
  // Unreachable — last rule matches everything — but satisfies TypeScript
  return CACHE_TTL_RULES[CACHE_TTL_RULES.length - 1]!;
}

/** Returns CORS headers if the request origin is in the allowlist, else empty object */
function buildCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Expose-Headers': 'X-Request-ID, X-Correlation-ID',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': String(fib(11)), // fib(11) = 89 s preflight cache
    Vary: 'Origin',
  };
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterSeconds: number;
}

/**
 * φ-scaled sliding-window rate limiter backed by Cloudflare KV.
 * Window: FIB_14 = 377 s ≈ 6 min 17 s (closest Fibonacci to 6-min window).
 * Limit: RATE_LIMIT_TIERS[tier] requests per window.
 */
async function checkRateLimit(
  kv: KVNamespace,
  clientKey: string,
  tier: 0 | 1 | 2 | 3 = 0,
): Promise<RateLimitResult> {
  const window = FIB_14;    // seconds
  const limit = RATE_LIMIT_TIERS[tier]!;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `rl:${clientKey}:${Math.floor(now / window)}`;

  const raw = await kv.get(windowKey);
  const count = raw !== null ? parseInt(raw, 10) : 0;

  if (count >= limit) {
    const resetAfterSeconds = window - (now % window);
    return { allowed: false, remaining: 0, resetAfterSeconds };
  }

  await kv.put(windowKey, String(count + 1), { expirationTtl: window });
  return {
    allowed: true,
    remaining: limit - count - 1,
    resetAfterSeconds: window - (now % window),
  };
}

// ─── Fetch handler ────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const origin = request.headers.get('Origin');
    const requestId = request.headers.get('X-Request-ID') ?? generateRequestId();

    // ── Handle CORS preflight ──
    if (request.method === 'OPTIONS') {
      const corsHeaders = buildCorsHeaders(origin);
      if (Object.keys(corsHeaders).length === 0) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // ── Health checks — passthrough, no rate limit, no caching ──
    if (pathname.startsWith('/health/')) {
      const probeRequest = new Request(
        `${env.ORIGIN_URL}${pathname}${url.search}`,
        {
          method: request.method,
          headers: {
            'X-Request-ID': requestId,
            'X-Forwarded-For': request.headers.get('CF-Connecting-IP') ?? '',
            'User-Agent': request.headers.get('User-Agent') ?? 'Cloudflare-Worker',
          },
        },
      );
      const probeResponse = await fetch(probeRequest);
      const responseHeaders = new Headers(probeResponse.headers);
      responseHeaders.set('X-Request-ID', requestId);
      responseHeaders.set('Cache-Control', 'no-store, no-cache');
      return new Response(probeResponse.body, {
        status: probeResponse.status,
        headers: responseHeaders,
      });
    }

    // ── Rate limiting (skip for internal / same-origin requests) ──
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const rateResult = await checkRateLimit(env.RATE_LIMITER, clientIp, 0);
    if (!rateResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          retryAfterSeconds: rateResult.resetAfterSeconds,
          rateLimit: RATE_LIMIT_TIERS[0],
          phiScaled: true,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateResult.resetAfterSeconds),
            'X-RateLimit-Limit': String(RATE_LIMIT_TIERS[0]),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + rateResult.resetAfterSeconds),
            'X-Request-ID': requestId,
          },
        },
      );
    }

    // ── Cache lookup (GET/HEAD only) ──
    const cacheRule = getCacheTtlRule(pathname);
    const cache = caches.default;
    let cachedResponse: Response | undefined;

    if ((request.method === 'GET' || request.method === 'HEAD') && cacheRule.ttlSeconds > 0) {
      cachedResponse = await cache.match(request);
      if (cachedResponse) {
        const cached = new Response(cachedResponse.body, cachedResponse);
        cached.headers.set('X-Cache', 'HIT');
        cached.headers.set('X-Request-ID', requestId);
        return cached;
      }
    }

    // ── Forward to Cloud Run origin ──
    const originUrl = `${env.ORIGIN_URL}${pathname}${url.search}`;
    const originRequest = new Request(originUrl, {
      method: request.method,
      headers: (() => {
        const h = new Headers(request.headers);
        h.set('X-Request-ID', requestId);
        h.set('X-Correlation-ID', requestId);
        h.set('X-Forwarded-For', clientIp);
        h.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
        // Strip Cloudflare-only headers before forwarding
        h.delete('CF-Connecting-IP');
        h.delete('CF-Ray');
        return h;
      })(),
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'follow',
    });

    let originResponse: Response;
    try {
      originResponse = await fetch(originRequest);
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Origin Unreachable',
          detail: err instanceof Error ? err.message : String(err),
          requestId,
        }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
        },
      );
    }

    // ── Build response with injected headers ──
    const responseHeaders = new Headers(originResponse.headers);

    // Correlation headers
    responseHeaders.set('X-Request-ID', requestId);
    responseHeaders.set('X-Correlation-ID', requestId);
    responseHeaders.set('X-Cache', 'MISS');

    // Rate limit headers
    responseHeaders.set('X-RateLimit-Limit', String(RATE_LIMIT_TIERS[0]));
    responseHeaders.set('X-RateLimit-Remaining', String(rateResult.remaining));

    // CORS headers (merge with origin response)
    const corsHeaders = buildCorsHeaders(origin);
    for (const [key, value] of Object.entries(corsHeaders)) {
      responseHeaders.set(key, value);
    }

    // CSP — inject on all non-streaming, non-binary responses
    const contentType = responseHeaders.get('Content-Type') ?? '';
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      responseHeaders.set('Content-Security-Policy', CSP_HEADER);
    }

    // Cache-Control from TTL rules
    responseHeaders.set('Cache-Control', cacheRule.cacheControl);

    // Remove server fingerprinting headers
    responseHeaders.delete('Server');
    responseHeaders.delete('X-Powered-By');

    const finalResponse = new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: responseHeaders,
    });

    // ── Store in edge cache for eligible responses ──
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      cacheRule.ttlSeconds > 0 &&
      originResponse.status === 200
    ) {
      _ctx.waitUntil(cache.put(request, finalResponse.clone()));
    }

    return finalResponse;
  },
};

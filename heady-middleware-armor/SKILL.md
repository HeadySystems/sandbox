---
name: heady-middleware-armor
description: Use when implementing model output armor, security headers middleware, CORS configuration, resilience middleware chains, or request pipeline protection in the Heady™ ecosystem. Keywords include middleware, armor, model armor, security headers, CORS, resilience middleware, request pipeline, output filtering, and middleware chain.
metadata:
  author: HeadySystems
  version: '1.0'
---

# Heady™ Middleware & Model Armor

## When to Use This Skill

Use this skill when the user needs to:
- Filter and validate model outputs (model armor)
- Configure security headers for HTTP responses
- Set up CORS policies
- Build resilience middleware chains
- Protect the request pipeline

## Module Map

| Module | Path | Role |
|---|---|---|
| model-armor | src/middleware/model-armor.js | AI output filtering and safety |
| security-headers | src/middleware/security-headers.js | HTTP security headers |
| cors-config | src/middleware/cors-config.js | CORS policy management |
| resilience-middleware | src/middleware/resilience-middleware.js | Resilience chain |
| error-handler | src/middleware/error-handler.js | Global error handling |
| request-id | src/middleware/request-id.js | Request correlation IDs |
| auto-error-pipeline | src/middleware/auto-error-pipeline.js | Auto error recovery |

## Instructions

### Model Armor
1. Scans all AI model outputs before delivery to users.
2. Filters: PII detection, toxicity, hallucination markers, prompt injection artifacts.
3. Scoring: CSL-gated safety score (0.0 to 1.0).
4. Actions based on score:
   - score > 0.786: pass through
   - 0.618 < score < 0.786: flag for review
   - score < 0.618: block and regenerate
5. Audit: all filtered outputs logged with reason.

### Security Headers
```javascript
const headers = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-{random}'",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
```

### CORS Configuration
- Allowed origins: all 9+ Heady domains + configured partners.
- Methods: GET, POST, PUT, DELETE, OPTIONS.
- Headers: Authorization, Content-Type, X-Request-ID, X-Trace-ID.
- Max-age: 3600 seconds.
- Credentials: true for authenticated endpoints.

### Resilience Middleware Chain
Order matters — applied in this sequence:
1. request-id (correlation) — adds trace context
2. security-headers — applies security headers
3. cors-config — handles CORS preflight
4. rate-limiter — rate limiting
5. model-armor — AI output filtering (on response)
6. error-handler — catches all errors
7. auto-error-pipeline — auto-recovery for known patterns

### Error Handling
- Structured error responses: { error: { code, message, trace_id } }.
- Error categorization: client (4xx), server (5xx), transient, permanent.
- Auto-retry for transient errors (via auto-error-pipeline).
- Error aggregation for alerting.

## Output Format

- Middleware Chain Configuration
- Security Header Audit
- Model Armor Report
- CORS Policy Summary
- Error Rate Dashboard

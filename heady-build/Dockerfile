# =============================================================================
# Heady Liquid Latent OS — Multi-stage Production Dockerfile
#
# Stage 1 (deps)        Install production-only npm dependencies
# Stage 2 (build)       Compile TypeScript → JavaScript
# Stage 3 (production)  Minimal runtime image with non-root user and tini
#
# Port:   3300 (Heady standard)
# User:   heady (UID 1001, non-root)
# Signal: tini handles PID 1 → clean SIGTERM propagation to Node.js
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1 — deps
# Install production npm dependencies only (no devDependencies).
# Uses a pinned Node 22 Alpine for a minimal, auditable base.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

# Install dumb-init and tini and curl (needed for health check in final stage)
# tini: signals PID 1 · dumb-init: zombie reaping fallback
RUN apk add --no-cache tini curl

WORKDIR /app

# Copy manifests first for layer-cache efficiency
COPY package.json package-lock.json ./

# Install *production* dependencies only — skip dev tooling
RUN npm ci --omit=dev --prefer-offline --no-audit --no-fund \
    && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2 — build
# Full devDependencies are needed to compile TypeScript.
# The output in /app/dist is the only artifact carried forward.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests
COPY package.json package-lock.json tsconfig.json ./

# Install ALL dependencies (including devDependencies) for compilation
RUN npm ci --prefer-offline --no-audit --no-fund

# Copy source tree
COPY src/ ./src/
COPY packages/ ./packages/

# Compile TypeScript → dist/
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3 — production
# Minimal runtime image.  Only compiled JS + production node_modules copied in.
# Non-root user 'heady' (UID/GID 1001) prevents privilege escalation.
# tini acts as PID 1 for correct SIGTERM → Node.js signal forwarding.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production

# Metadata labels
LABEL org.opencontainers.image.title="Heady Liquid Latent OS"
LABEL org.opencontainers.image.description="φ-resonant cognitive infrastructure — production runtime"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="eric@headyconnection.org"
LABEL org.opencontainers.image.url="https://headyconnection.org"
LABEL org.opencontainers.image.source="https://github.com/heady-ai/liquid-latent-os"
LABEL org.opencontainers.image.licenses="UNLICENSED"

# Install tini (PID 1 signal handler) and curl (health check)
# Clean apk cache in the same layer to keep image size minimal
RUN apk add --no-cache tini curl \
    && rm -rf /var/cache/apk/*

# Create non-root user and group with fixed UID/GID 1001
RUN addgroup -g 1001 -S heady \
    && adduser -u 1001 -S heady -G heady -s /sbin/nologin

WORKDIR /app

# Copy production node_modules from the deps stage
COPY --from=deps --chown=heady:heady /app/node_modules ./node_modules

# Copy compiled JavaScript from the build stage
COPY --from=build --chown=heady:heady /app/dist ./dist

# Copy runtime data files (wisdom.json, etc.) from packages
COPY --from=build --chown=heady:heady /app/packages ./packages

# Copy package manifest for runtime introspection
COPY --chown=heady:heady package.json ./

# Switch to the non-root user before any network exposure
USER heady

# Heady standard port (configurable via PORT env, default 3300)
EXPOSE 3300

# Health check: Cloud Run calls /health/live every 30 s
# fib(6) = 8 s initial delay, fib(7) = 13 s interval, fib(5) = 5 s timeout, fib(4) = 3 retries
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=15s \
    --retries=3 \
    CMD curl --fail --silent --max-time 5 \
        "http://127.0.0.1:${PORT:-3300}/health/live" \
        || exit 1

# tini as PID 1 ensures SIGTERM is forwarded to Node.js child process
# --max-old-space-size=512 caps the V8 old heap at 512 MiB for Cloud Run 1Gi pods
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--max-old-space-size=512", "dist/src/main.js"]

# © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL.
# Heady™ Projection Service — Multi-stage Dockerfile
#
# Stage 1 (builder): Install all dependencies, run turbo prune to produce a
#                    minimal workspace subset for the projection-service app.
# Stage 2 (runtime): Lean production image — only runtime artifacts, no dev deps.

ARG NODE_VERSION=20
ARG BUILD_SHA=unknown
ARG BUILD_DATE=unknown

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /app

# Install turbo globally for prune step
RUN npm install -g turbo@^2.0.0

# Copy the full monorepo workspace manifests (before source files for layer caching)
COPY package.json package-lock.json turbo.json ./
COPY packages/shared-types/package.json  packages/shared-types/
COPY packages/shared-utils/package.json  packages/shared-utils/
COPY apps/projection-service/package.json apps/projection-service/

# Prune to only the projection-service workspace and its dependencies
RUN turbo prune --scope=@heady/projection-service --docker

# ── Stage 1b: Install pruned deps ─────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS installer

WORKDIR /app

# Copy pruned lockfile + manifests from builder
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json

# Install only production deps for the pruned workspace
RUN npm ci --omit=dev --prefer-offline

# Copy pruned source files
COPY --from=builder /app/out/full/ .

# Build packages (if any compilation step exists)
RUN npm run build --if-present 2>/dev/null || true

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime

LABEL org.opencontainers.image.title="Heady Projection Service"
LABEL org.opencontainers.image.vendor="HeadySystems Inc."
LABEL org.opencontainers.image.version="${BUILD_SHA}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL com.headysystems.phi="1.6180339887"

WORKDIR /app

# Security: run as non-root
RUN addgroup -S heady && adduser -S heady -G heady
USER heady

# Copy installed artifacts from installer stage
COPY --from=installer --chown=heady:heady /app/node_modules  ./node_modules
COPY --from=installer --chown=heady:heady /app/packages      ./packages
COPY --from=installer --chown=heady:heady /app/apps          ./apps
COPY --from=installer --chown=heady:heady /app/package.json  ./package.json

# Runtime environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    PROJECTION_PORT=3849 \
    LOG_LEVEL=info \
    PHI=1.6180339887

EXPOSE 3849

# Health check — uses PHI-scaled interval (φ × 10s ≈ 16.18s)
HEALTHCHECK --interval=16s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3849/health || exit 1

CMD ["node", "apps/projection-service/index.js"]

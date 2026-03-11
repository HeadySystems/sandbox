# HEADY™ Search Service - Multi-stage Docker Build
# HeadySystems Inc. - Proprietary

# Stage 1: Builder
FROM node:20-alpine AS builder

LABEL maintainer="HeadySystems Inc. (Eric Haywood)"
LABEL description="HEADY™ Search Service - Hybrid Full-text and Vector Search"

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy runtime files from builder
COPY --from=builder /build/node_modules ./node_modules

# Copy application files
COPY package*.json ./
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1000 heady && \
    adduser -D -u 1000 -G heady heady && \
    chown -R heady:heady /app

USER heady

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3391/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Environment
ENV NODE_ENV=production
ENV PORT=3391
ENV NODE_OPTIONS="--max-old-space-size=512"

EXPOSE 3391

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start application
CMD ["node", "src/index.js"]

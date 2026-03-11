# HEADY™ Analytics Service Dockerfile
# Multi-stage build for optimal image size
# Copyright (c) HeadySystems Inc. Eric Haywood, founder. All rights reserved.

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Runtime
FROM node:20-alpine
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy production dependencies from builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./

# Copy application code
COPY src ./src

# Create data directory for event persistence
RUN mkdir -p data && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3392

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3392/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "src/index.js"]

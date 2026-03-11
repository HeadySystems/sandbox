# Multi-stage build for HeadySystems Scheduler Service
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Runtime
FROM node:20-alpine

LABEL maintainer="HeadySystems"
LABEL service="scheduler-service"
LABEL version="1.0.0"

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy application code
COPY --chown=nodejs:nodejs src/ ./src/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3390/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3390

# Set environment
ENV NODE_ENV=production
ENV PORT=3390
ENV HOST=0.0.0.0

# Start application
CMD ["node", "src/index.js"]

# HeadyGateway — Unified API Gateway
# Sacred Geometry Architecture v3.0.0

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -g 1001 -S heady && adduser -S heady -u 1001
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER heady
ENV NODE_ENV=production
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3100/health || exit 1
CMD ["node", "src/gateway.js"]

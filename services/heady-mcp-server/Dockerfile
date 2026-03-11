FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
ENV NODE_ENV=production
ENV PORT=3310
ENV HEADY_MCP_TRANSPORT=http
ENV HEADY_MCP_PORT=3310
RUN groupadd -r heady && useradd -r -g heady heady
RUN chown -R heady:heady /app
USER heady
EXPOSE 3310
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3310/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]

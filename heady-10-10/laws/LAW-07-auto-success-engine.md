---
title: "Law 07: Auto-Success Engine Integrity"
domain: unbreakable-law
law_number: 7
semantic_tags: [auto-success, heartbeat, background-tasks, 135-tasks, 9-categories, 30-second-cycle]
enforcement: MANDATORY_IMMUTABLE
---

# LAW 7: AUTO-SUCCESS ENGINE INTEGRITY — THE 135-TASK HEARTBEAT

The Auto-Success Engine runs **135 background tasks** across **9 categories** on a **30-second cycle**. This heartbeat is sacrosanct. No change may degrade, slow, or disrupt it.

## The Nine Categories (15 tasks each)

### 1. Code Quality (15 tasks)

ESLint checks, TypeScript type validation, dead code detection, import cycle detection, complexity scoring, duplication scanning, pattern compliance, naming convention audit, deprecated API usage scan, bundle size tracking, test coverage calculation, documentation completeness, coding standard enforcement, dependency freshness, security-sensitive pattern detection

### 2. Security (15 tasks)

Vulnerability scanning (npm audit), secret detection (TruffleHog patterns), access control audit, CORS configuration validation, CSP header verification, auth token expiry monitoring, SSL certificate expiry check, dependency CVE scan, SQL injection pattern scan, XSS pattern scan, SSRF pattern scan, path traversal detection, rate limit configuration verify, permission escalation detection, security header completeness

### 3. Performance (15 tasks)

Response time P50/P95/P99, memory usage per service, CPU utilization trending, queue depth monitoring, event loop lag measurement, garbage collection frequency, connection pool utilization, cache hit ratio, database query latency, embedding generation throughput, API request throughput, WebSocket connection count, worker thread utilization, network I/O bandwidth, disk I/O monitoring

### 4. Availability (15 tasks)

Health probe execution for all services, uptime percentage calculation, circuit breaker state monitoring, service dependency health, DNS resolution verification, CDN cache status, edge worker availability, database connection health, Redis connection health, MCP server connectivity, webhook delivery success rate, email delivery health, streaming endpoint availability, load balancer health, failover readiness verification

### 5. Compliance (15 tasks)

License compatibility checks, patent zone integrity, IP protection verification, GDPR data handling audit, API versioning compliance, SLA monitoring, data retention policy enforcement, backup verification, disaster recovery readiness, audit log integrity, regulatory change monitoring, privacy policy consistency, terms of service alignment, export control compliance, accessibility standards check

### 6. Learning (15 tasks)

Pattern extraction from Arena Mode results, wisdom.json update processing, HeadyVinci model refresh, embedding freshness scoring, knowledge gap detection, user preference model update, error pattern catalog maintenance, performance optimization catalog, successful pattern reinforcement, failed pattern deprecation, cross-swarm insight correlation, new pattern discovery alerting, pattern confidence decay tracking, fine-tuning data preparation, training data quality scoring

### 7. Communication (15 tasks)

Notification delivery verification, webhook health check, MCP connectivity test, email queue processing, Slack/Discord integration health, API documentation freshness, changelog generation trigger, status page update, incident notification readiness, user-facing error message quality, HeadyBuddy response quality sampling, cross-device sync verification, notification deduplication check, delivery preference compliance, escalation path verification

### 8. Infrastructure (15 tasks)

DNS record validation, SSL cert expiry warning, container image freshness, Kubernetes pod health, Cloud Run revision status, Cloudflare Worker deployment status, database migration status, storage quota monitoring, log rotation verification, backup completion check, CDN purge queue, edge cache warm status, service mesh connectivity, network policy compliance, infrastructure drift detection

### 9. Intelligence (15 tasks)

Embedding freshness scoring, vector index quality metrics, CSL gate calibration check, model routing accuracy tracking, response quality scoring, hallucination detection rate, context retrieval relevance scoring, multi-model agreement rate, prompt effectiveness measurement, knowledge base completeness, Graph RAG relationship freshness, semantic search precision/recall, model cost-efficiency ratio, inference latency trending, intelligence improvement velocity

## Invariants

- Total cycle time MUST remain ≤ 30 seconds
- Failed tasks retry with phi-backoff (max 3 per cycle, max 8 total before incident)
- Individual task timeout: 5s (flag and optimize if exceeded)
- New tasks require category assignment and cycle budget allocation
- Cycle metrics exposed via `observability-kernel` to HeadyConductor dashboard

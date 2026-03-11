# Runbook: Redis Failure

**Severity:** P1 (Production) / P2 (Staging)
**Team:** Infrastructure On-Call
**Version:** 3.2.2
**Last Updated:** 2026-03-07

---

## φ Quick Reference

```
φ = 1.618033988749895
Fibonacci: 1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597

Escalation timers: 5min (fib(5)), 8min (fib(6)), 13min (fib(7)), 21min (fib(8))
Retry backoffs: 1618ms, 2618ms, 4236ms, 6854ms (φ^1 through φ^4)
Max reconnect attempts: fib(4)=3
Pool size: fib(7)=13 connections
```

---

## Overview

Redis is the primary data store for Heady™Systems. All 21 microservices depend on it for:
- Session state and JWT cache
- Rate limiting (4-layer system)
- Agent queue depth tracking
- CSL (Cognitive Stress Level) tracking
- Pub/sub for real-time agent coordination
- Distributed locks for orchestration

A Redis outage will cause **complete platform degradation** within φ^4=6854ms (6.8 seconds).

---

## Detection

### Automated Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| `redis-connection-pool-exhausted` | Pool utilization > 85.4% (critical threshold) for fib(5)=5m | P1 |
| `redis-latency-critical` | p99 latency > φ^3=4236ms for fib(4)=3 consecutive checks | P1 |
| `redis-down` | Health check fails for fib(4)=3 consecutive attempts | P0 |
| `redis-memory-critical` | Memory usage > 85.4% (critical threshold) | P1 |
| `redis-keyspace-miss-rate` | Miss rate > 61.8% (1/φ) sustained for fib(6)=8m | P2 |

### Manual Detection

```bash
# Test connectivity
redis-cli -h $REDIS_HOST -p 6379 -a "$REDIS_PASSWORD" ping

# Check info
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" info server
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" info memory
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" info clients
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" info stats

# Check connected clients (target: < fib(10)=55)
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" client list | wc -l

# Check keyspace
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" dbsize

# Check slowlog (threshold: φ^1=1618ms = 1618μs)
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" slowlog get 13
```

---

## Impact Assessment

| Scenario | Impact | Recovery Time |
|----------|--------|---------------|
| Redis pod restart (K8s) | Temporary: fib(7)=13s readiness probe delay | <30s |
| Redis memory exhausted | Evictions → cache misses → DB pressure | <fib(5)=5 min with intervention |
| Redis connection pool exhausted | 503 errors on rate-limit-dependent endpoints | Immediate on pool release |
| Memorystore failover (GCP) | fib(8)=21s automatic failover | <30s (HA mode) |
| Full Redis failure | Platform down | fib(8)=21 min RTO |

---

## Remediation Steps

### Step 1: Verify Failure Scope (0-5 min)

```bash
# 1. Check pod status (K8s)
kubectl get pods -n heady-system -l app.kubernetes.io/name=redis

# 2. Check Redis logs
kubectl logs -n heady-system -l app.kubernetes.io/name=redis --tail=100

# 3. Test connectivity from heady-brain
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-brain -o jsonpath='{.items[0].metadata.name}') \
  -- redis-cli -h redis -p 6379 -a "$REDIS_PASSWORD" ping

# 4. Check GCP Memorystore (production)
gcloud redis instances describe heady-redis-production --region=us-central1
```

### Step 2: Triage — Memory Issue

```bash
# Check memory usage
redis-cli info memory | grep -E 'used_memory:|maxmemory:|mem_fragmentation'

# If memory > 85.4% (critical threshold):
# Flush expired keys manually
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" memory purge

# Check which databases have the most keys
for db in 0 1 2 3; do
  echo "DB $db:"; redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" -n $db dbsize
done

# Emergency: clear rate-limiting keys if causing pressure
# DB 3 = heady-web (sessions + rate limits)
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" -n 3 keys "rate:*" | head -20
```

### Step 3: Triage — Connection Pool Exhausted

```bash
# Check client count (should be < fib(10)=55)
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" info clients

# Kill idle clients (idle > φ^5=11090ms = 11090000 microseconds)
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" client kill ID 0 IDLE 11090000 SKIPME yes

# Restart affected pods to force pool reset (fib(4)=3 pods at a time)
kubectl rollout restart deployment/heady-brain -n heady-system
kubectl rollout restart deployment/heady-mcp -n heady-system
```

### Step 4: Pod Restart (K8s)

```bash
# Delete and let K8s recreate (fastest)
kubectl delete pod -n heady-system -l app.kubernetes.io/name=redis

# Wait for readiness (fib(7)=13s start period)
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=redis \
  -n heady-system \
  --timeout=89s  # fib(11)=89s max wait
```

### Step 5: GCP Memorystore Failover (Production)

```bash
# Initiate manual failover for HA instance
gcloud redis instances failover heady-redis-production \
  --region=us-central1 \
  --data-protection-mode=LIMITED_DATA_LOSS

# Monitor failover (takes ~21 seconds = fib(8)=21)
gcloud redis instances describe heady-redis-production \
  --region=us-central1 \
  --format="get(state)"
```

### Step 6: Emergency — Platform Degraded Mode

If Redis is down for > fib(8)=21 minutes, activate degraded mode:

```bash
# Set READ_ONLY flag in ConfigMap to bypass Redis-dependent features
kubectl patch configmap heady-config -n heady-system \
  --type merge \
  -p '{"data":{"REDIS_FAILSAFE_MODE":"true","RATE_LIMITING_ENABLED":"false"}}'

# This activates in-memory rate limiting with fib(5)=5× reduced limits
# and falls back to Postgres for session state (slower but functional)
```

---

## Verification

```bash
# Confirm Redis is healthy
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" ping
# Expected: PONG

# Confirm latency is normal (< φ^1=1618ms)
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" --latency-history -i 1

# Confirm heady-brain is reconnected
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-brain -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:8080/health/ready
# Expected: {"status":"healthy",...}

# Confirm rate limiting is functional
curl -I https://headyme.com/api/v1/health
# Check X-RateLimit-Remaining header
```

---

## Post-Incident

1. Review slowlog: `redis-cli slowlog get 144` (fib(12)=144 entries)
2. Check memory fragmentation ratio (healthy: < φ = 1.618)
3. Review connection pool metrics in Grafana dashboard "Redis Pool — φ Dashboard"
4. File incident report with φ-timeline:
   - T+0: Alert fired
   - T+fib(5)=5m: First escalation
   - T+fib(6)=8m: Second escalation
   - T+fib(7)=13m: Third escalation
   - T+fib(8)=21m: Executive escalation
5. Update error budget tracking for affected SLO tier

---

## Escalation

| Time | Action |
|------|--------|
| T+0 | On-call engineer paged |
| T+fib(5)=5m | If no acknowledgment: secondary on-call |
| T+fib(6)=8m | If not resolved: infrastructure lead |
| T+fib(7)=13m | If not resolved: VP Engineering |
| T+fib(8)=21m | Executive escalation |

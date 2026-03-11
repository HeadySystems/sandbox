# Runbook: Rate Limiter Saturation

**Severity:** P2 / P1 (if >85.4% of requests are being rejected)
**Team:** Infrastructure On-Call
**Version:** 3.2.2

---

## φ Quick Reference

```
φ = 1.618033988749895
Rate limits: Pilot=fib(11)=89 rps, Pro=fib(12)=144 rps, Enterprise=fib(13)=233 rps
Burst: Pilot=fib(12)=144, Pro=fib(13)=233, Enterprise=fib(14)=377
4-layer rate limiter + semantic deduplication
Saturation threshold: 91.0% (exceeded pressure level)
Warning threshold: 61.8% (1/φ)
```

---

## Overview

HeadySystems uses a 4-layer rate limiting system:
1. **IP-level** — NGINX Ingress (fib(11)=89 rps/IP)
2. **User-level** — JWT-based per-user limits (tier-specific)
3. **Tenant-level** — Per-tenant aggregate limits
4. **Semantic dedup** — Identical requests within φ^2=2618ms window

All counters stored in Redis with φ^2=2618ms sliding windows.

---

## Detection

| Alert | Condition | Severity |
|-------|-----------|----------|
| `rate-limit-saturation-warning` | 429 rate > 61.8% of total requests (1/φ) | P2 |
| `rate-limit-saturation-critical` | 429 rate > 85.4% (critical threshold) | P1 |
| `rate-limit-redis-pressure` | Redis rate-limit keys > fib(14)=377 per second create rate | P1 |
| `rate-limit-ddos-suspected` | Single IP > fib(12)=144 rps for fib(5)=5m | P1 |

```bash
# Check rejection rate
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-web -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:9090/metrics | grep -E 'rate_limit_(429|rejected|allowed)'

# Check Redis rate-limit key pressure
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" -n 3 \
  eval "return #redis.call('keys', 'rate:*')" 0
```

---

## Remediation

### Emergency: Increase Limits Temporarily

```bash
# Bump rate limits via ConfigMap (fib(13)=233 → fib(14)=377)
kubectl patch configmap heady-config -n heady-system \
  --type merge \
  -p '{"data":{"RATE_LIMIT_ENTERPRISE_RPS":"377","RATE_LIMIT_PRO_RPS":"233","RATE_LIMIT_PILOT_RPS":"144"}}'

# Rolling restart for config to take effect
kubectl rollout restart deployment/heady-web -n heady-system
```

### DDoS — Block Offending IPs

```bash
# Get top IPs by request count in last fib(9)=34s
kubectl logs -n heady-system -l app.kubernetes.io/name=heady-web --since=34s | \
  grep -oP '"remote_addr":"([^"]+)"' | sort | uniq -c | sort -rn | head -13

# Block at Nginx (add to Nginx ConfigMap)
kubectl patch configmap nginx-configuration -n ingress-nginx \
  --type merge \
  -p '{"data":{"block-cidrs":"<OFFENDING_IP>/32"}}'
```

### Redis Rate-Limit Counter Flush

```bash
# If rate-limit counters are stale/incorrect, flush DB 3
# WARNING: This will reset all rate limit windows — use only in emergencies
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" -n 3 flushdb async
echo "Rate limit counters reset — all windows start fresh"
```

### Scale Web Layer

```bash
# Scale heady-web to max: fib(8)=21 pods
kubectl scale deployment/heady-web -n heady-system --replicas=21
```

---

## Verification

```bash
# Check 429 rate has decreased
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-web -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:9090/metrics | grep 'http_requests_total.*429'

# Confirm Enterprise tier is unaffected (fib(13)=233 rps limit)
curl -H "X-Heady-Tier: enterprise" -H "Authorization: Bearer $ENTERPRISE_TOKEN" \
  https://api.headyme.com/api/v1/health
```

---

## Escalation

| Time | Action |
|------|--------|
| T+0 | On-call paged |
| T+fib(5)=5m | Secondary on-call |
| T+fib(6)=8m | Security team (if DDoS) |
| T+fib(7)=13m | Infrastructure lead |
| T+fib(8)=21m | Executive escalation |

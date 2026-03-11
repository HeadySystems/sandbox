# Runbook: MCP Service Recovery

**Severity:** P1 (Production)
**Team:** Infrastructure On-Call
**Version:** 3.2.2

---

## φ Quick Reference

```
φ = 1.618033988749895
MCP tool slots: fib(7)=13
Max active sessions: fib(11)=89
Tool execution timeout: φ^3=4236ms
Session timeout: fib(11)=89 × 10s = 890s
Replicas: fib(4)=3 (min), fib(7)=13 (max)
```

---

## Impact

When heady-mcp is unreachable:
- All AI agents lose tool-calling capability
- MCP tool calls return 503
- In-flight sessions fail immediately
- heady-brain falls back to no-tool mode (degraded intelligence)

---

## Detection

```bash
# Check pod status
kubectl get pods -n heady-system -l app.kubernetes.io/name=heady-mcp

# Check health
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-mcp -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:8080/health/ready

# Check active sessions count (target: < fib(11)=89)
curl -H "Authorization: Bearer $INTERNAL_TOKEN" \
  http://heady-mcp.heady-system.svc.cluster.local:8080/api/internal/sessions/count
```

---

## Remediation

### Pod Not Running

```bash
# Describe pod for events
kubectl describe pod -n heady-system -l app.kubernetes.io/name=heady-mcp

# Force restart
kubectl rollout restart deployment/heady-mcp -n heady-system
kubectl rollout status deployment/heady-mcp -n heady-system --timeout=89s
```

### Session Exhaustion (> fib(11)=89 sessions)

```bash
# Check active session count
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" keys "mcp:session:*" | wc -l

# Kill oldest sessions if > fib(11)=89
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" \
  zrangebyscore "mcp:sessions:by_start" 0 $(date -d "-890 seconds" +%s) | \
  xargs -I {} redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" del "mcp:session:{}"
```

### Tool Execution Hang (stuck tools > φ^3=4236ms)

```bash
# Check for hung tool executions
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" \
  keys "mcp:tool:*:executing" | head -13  # fib(7)=13 sample

# Force-expire stuck tool locks
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" \
  keys "mcp:tool:*:lock" | xargs -I {} \
  redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" expire {} 4  # φ^3=4236ms ≈ 4s
```

### Scale Up if Overloaded

```bash
# Manually scale to max replicas: fib(7)=13
kubectl scale deployment/heady-mcp -n heady-system --replicas=13

# HPA will take over: fib(4)=3 min, fib(7)=13 max
```

---

## Verification

```bash
# Confirm health
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-mcp -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:8080/health/ready

# Test a sample tool call
curl -X POST \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  http://heady-mcp.heady-system.svc.cluster.local:8080/api/v1/tools/invoke \
  -d '{"tool": "health_check", "args": {}}'
```

---

## Escalation

| Time | Action |
|------|--------|
| T+0 | On-call paged |
| T+fib(5)=5m | Secondary on-call |
| T+fib(6)=8m | Infrastructure lead |
| T+fib(7)=13m | Engineering director |
| T+fib(8)=21m | Executive escalation |

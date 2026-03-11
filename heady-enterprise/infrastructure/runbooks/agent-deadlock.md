# Runbook: Agent Deadlock Detection and Resolution

**Severity:** P1 (Production)
**Team:** AI Platform On-Call
**Version:** 3.2.2
**Last Updated:** 2026-03-07

---

## φ Quick Reference

```
φ = 1.618033988749895
Deadlock detection window: fib(9)=34 seconds
Deadlock timeout threshold: φ^6=17944ms (17.9 seconds)
Max orchestration retry: fib(7)=13 attempts
Max concurrent agents: fib(10)=55
Circuit breaker open threshold: 61.8% failure rate (1/φ)
```

---

## Overview

HeadySystems runs up to fib(10)=55 concurrent agents orchestrated by heady-conductor. Agent deadlocks occur when:
- fib(4)=3 or more agents hold resources while waiting for each other (circular dependency)
- An agent exceeds φ^6=17944ms orchestration timeout without releasing its lock
- Redis Pub/Sub channel is blocked by a stuck agent
- heady-brain is unreachable for > φ^3=4236ms (agent waits indefinitely)

---

## Detection

### Automated Alerts

| Alert | Condition | Threshold |
|-------|-----------|-----------|
| `agent-deadlock-suspected` | fib(4)=3+ agents in WAITING state for > φ^4=6854ms | P1 |
| `orchestration-timeout` | Any orchestration run exceeds φ^6=17944ms | P1 |
| `agent-queue-stalled` | Queue depth > fib(10)=55 with no throughput for fib(9)=34s | P1 |
| `conductor-lock-count` | Active distributed locks > fib(8)=21 | P2 |
| `brain-response-timeout` | heady-brain p99 > φ^5=11090ms | P1 |

### Manual Detection

```bash
# Check conductor metrics
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-conductor -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:8080/metrics | grep -E 'agent|orchestration|lock'

# Check agent states via Redis
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" \
  keys "agent:*:state" | xargs -I {} \
  redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" get {}

# Check for stale locks (any lock held > φ^6=17944ms)
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" \
  keys "lock:agent:*" | head -fib7  # fib(7)=13 sample

# Check orchestration queue depth
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" llen "queue:orchestration:pending"
# Alert if > fib(10)=55 (critical threshold)
```

---

## Deadlock Indicators

```
1. Queue depth is NOT decreasing despite active conductor pods
2. Redis lock keys: lock:agent:* are not expiring
3. heady-conductor logs show "waiting_for_resource" repeatedly
4. CPU usage is LOW on all pods (blocked, not processing)
5. Orchestration timeout counter is increasing
```

### Log Patterns to Look For

```bash
# In heady-conductor logs
kubectl logs -n heady-system -l app.kubernetes.io/name=heady-conductor --tail=200 | \
  grep -E "deadlock|WAITING|lock_timeout|circular"

# Expected deadlock log pattern:
# {"level":"error","message":"deadlock_detected","agents":["agent-a","agent-b","agent-c"],"waitChain":["a->b","b->c","c->a"],"waitTimeMs":17944}
```

---

## Remediation Steps

### Step 1: Confirm Deadlock (0-5 min)

```bash
# 1. Get all agents in WAITING state
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-conductor -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:8080/api/internal/agents/waiting

# 2. Check deadlock detection endpoint
curl -H "Authorization: Bearer $INTERNAL_TOKEN" \
  http://heady-conductor.heady-system.svc.cluster.local:8080/api/internal/deadlock-check

# 3. Verify by checking wait chain in Redis
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" \
  hgetall "orchestration:wait_chain"
```

### Step 2: Identify Deadlock Participants

```bash
# Get the deadlock cycle (circular wait chain)
# Format: agent-id -> waiting-for -> agent-id -> ...
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-conductor -o jsonpath='{.items[0].metadata.name}') \
  -- node -e "
    const { detectDeadlock } = require('./src/orchestration/deadlock-detector');
    detectDeadlock().then(r => console.log(JSON.stringify(r, null, 2)));
  "
```

### Step 3: Break Deadlock — Automated

The conductor has an automatic deadlock breaker triggered after fib(9)=34 seconds:

```bash
# Force-trigger deadlock resolution
curl -X POST \
  -H "Authorization: Bearer $INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  http://heady-conductor.heady-system.svc.cluster.local:8080/api/internal/break-deadlock \
  -d '{
    "strategy": "oldest-first",
    "timeout_ms": 17944,
    "phi_derived": true
  }'
# Strategy: kill the oldest-waiting agent first (victim selection)
```

### Step 4: Manual Lock Release

If automated resolution fails, manually release locks:

```bash
# List all agent locks
LOCKS=$(redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" keys "lock:agent:*")
echo "$LOCKS"

# Check TTL of each lock
for lock in $LOCKS; do
  ttl=$(redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" ttl "$lock")
  echo "$lock: TTL=$ttl"
done

# Delete stale locks (TTL=-1 means no expiry — these are stuck)
for lock in $LOCKS; do
  ttl=$(redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" ttl "$lock")
  if [ "$ttl" = "-1" ]; then
    echo "Deleting stale lock: $lock"
    redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" del "$lock"
  fi
done
```

### Step 5: Terminate Deadlocked Agents

```bash
# Get IDs of agents in the deadlock cycle from Step 2
DEADLOCKED_AGENTS=("agent-abc123" "agent-def456" "agent-ghi789")

# Send termination signal to each agent
for agent_id in "${DEADLOCKED_AGENTS[@]}"; do
  curl -X DELETE \
    -H "Authorization: Bearer $INTERNAL_TOKEN" \
    http://heady-conductor.heady-system.svc.cluster.local:8080/api/v1/agents/$agent_id \
    -d '{"reason":"deadlock_resolution","phi_timeout_ms":17944}'
done

# Clear agent state from Redis
for agent_id in "${DEADLOCKED_AGENTS[@]}"; do
  redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" del "agent:$agent_id:state"
  redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" del "agent:$agent_id:lock"
  redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" srem "agents:active" "$agent_id"
done
```

### Step 6: Drain Queue and Restart

```bash
# After deadlock resolution, check queue is draining
watch -n 3 "redis-cli -h $REDIS_HOST -a $REDIS_PASSWORD llen queue:orchestration:pending"

# If queue is not draining, restart conductor pods (rolling restart)
kubectl rollout restart deployment/heady-conductor -n heady-system

# Wait for rollout (fib(8)=21 seconds expected)
kubectl rollout status deployment/heady-conductor -n heady-system --timeout=89s
```

---

## Prevention

The conductor's deadlock prevention is φ-governed:

```javascript
// In heady-conductor/src/orchestration/lock-manager.js:
const LOCK_TTL_MS = Math.round(1000 * PHI ** 6);   // φ^6 = 17944ms max lock hold
const DEADLOCK_CHECK_INTERVAL_MS = FIB[9] * 1000;  // fib(9)=34s detection window
const MAX_WAIT_MS = Math.round(1000 * PHI ** 4);    // φ^4 = 6854ms wait before backoff
const MAX_RETRIES = FIB[6];                          // fib(7)=13 retries before fail
```

---

## Verification

```bash
# Confirm queue is draining
redis-cli -h $REDIS_HOST -a "$REDIS_PASSWORD" llen "queue:orchestration:pending"
# Should be decreasing toward 0

# Confirm no waiting agents
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-conductor -o jsonpath='{.items[0].metadata.name}') \
  -- wget -qO- http://localhost:8080/api/internal/agents/waiting
# Expected: {"count": 0, "agents": []}

# Check error budget impact
# Downtime during deadlock × burn rate factor
```

---

## Escalation

| Time | Action |
|------|--------|
| T+0 | AI Platform on-call paged |
| T+fib(5)=5m | If no acknowledgment: secondary on-call |
| T+fib(6)=8m | Infrastructure lead joined |
| T+fib(7)=13m | Engineering director alerted |
| T+fib(8)=21m | Executive escalation |

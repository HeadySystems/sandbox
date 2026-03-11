# Runbook: Postgres Failover Procedures

**Severity:** P0 (unplanned), P1 (planned)
**Team:** Infrastructure On-Call + DBA
**Version:** 3.2.2

---

## φ Quick Reference

```
φ = 1.618033988749895
RTO: fib(8)=21 minutes (production target)
RPO: fib(5)=5 minutes (PITR enabled)
Read replicas: fib(3)=2
Max connections: fib(10)=55 (via pgbouncer)
Connection pool size: fib(7)=13 (pgbouncer default)
Backup retention: fib(11)=89 days
Failover time (GCP HA): ~21 seconds = fib(8)=21s
```

---

## Architecture

```
Primary (us-central1-a)
    ├── Read Replica 1 (us-central1-b) — failover target
    └── Read Replica 2 (us-central1-c) — secondary replica

pgbouncer (pool: fib(7)=13 default, fib(10)=55 max)
    └── All services connect via pgbouncer
```

---

## Detection

```bash
# Check Cloud SQL instance health (production)
gcloud sql instances describe heady-postgres-production \
  --format="table(name,state,databaseVersion,settings.availabilityType)"

# Check from application
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-brain -o jsonpath='{.items[0].metadata.name}') \
  -- node -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.query('SELECT 1').then(() => { console.log('DB OK'); process.exit(0); })
       .catch(e => { console.error('DB FAIL:', e.message); process.exit(1); });
  "

# Check pgbouncer stats
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=pgbouncer -o jsonpath='{.items[0].metadata.name}') \
  -- psql -h 127.0.0.1 -p 5432 -U heady_prod -d pgbouncer -c "SHOW STATS;"

# Check active connections (should be < fib(10)=55)
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=pgbouncer -o jsonpath='{.items[0].metadata.name}') \
  -- psql -h 127.0.0.1 -p 5432 -U heady_prod -d pgbouncer -c "SHOW POOLS;"
```

---

## Scenarios

### Scenario A: Automatic Failover (GCP HA)

GCP Cloud SQL REGIONAL instances fail over automatically in ~fib(8)=21 seconds.

```bash
# Monitor failover
watch -n 2 "gcloud sql instances describe heady-postgres-production \
  --format='get(state)'"

# Check connection string hasn't changed (it doesn't — same IP)
gcloud sql instances describe heady-postgres-production \
  --format="get(ipAddresses)"

# Verify services reconnect (pgbouncer handles reconnection)
kubectl get pods -n heady-system -l app.kubernetes.io/name=pgbouncer
```

Expected timeline:
- T+0: Primary fails
- T+fib(4)=3s: GCP detects failure
- T+fib(8)=21s: Failover to us-central1-b replica completes
- T+fib(6)=8s: pgbouncer reconnects
- T+fib(8)=21s total: Services fully restored

### Scenario B: Manual Promotion of Read Replica

If primary is permanently lost or regional failure:

```bash
# 1. List replicas
gcloud sql instances list --filter="masterInstanceName:heady-postgres-production"

# 2. Promote Replica 1 to primary
gcloud sql instances promote-replica heady-postgres-production-replica-0

# 3. Update Cloud SQL connection string in Secret Manager
gcloud secrets versions add postgres-url \
  --data-file=<(echo -n "postgresql://heady_prod:PASSWORD@NEW_REPLICA_IP:5432/heady_production?sslmode=require")

# 4. Restart pgbouncer to pick up new connection
kubectl rollout restart deployment/pgbouncer -n heady-system

# 5. Verify connectivity
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-brain -o jsonpath='{.items[0].metadata.name}') \
  -- node -e "require('pg').Pool({connectionString:process.env.DATABASE_URL}).query('SELECT current_database()').then(r=>console.log(r.rows[0])).catch(e=>console.error(e.message))"
```

### Scenario C: Point-in-Time Recovery (RPO = fib(5)=5 min)

For data corruption or accidental deletion:

```bash
# 1. Identify recovery point (within fib(5)=5 minute RPO)
# Format: YYYY-MM-DDTHH:MM:SSZ
RECOVERY_TIME="2026-03-07T09:35:00Z"  # 5 minutes before incident

# 2. Clone instance to recovery point
gcloud sql instances clone heady-postgres-production \
  heady-postgres-recovery-$(date +%s) \
  --point-in-time=$RECOVERY_TIME

# 3. Connect to recovery instance and export affected tables
gcloud sql export sql heady-postgres-recovery-TIMESTAMP \
  gs://heady-systems-backups/recovery/tables-$(date +%Y%m%d).sql.gz \
  --database=heady_production \
  --table=agents,sessions,orchestration_runs

# 4. Import to production (selective restore)
gcloud sql import sql heady-postgres-production \
  gs://heady-systems-backups/recovery/tables-$(date +%Y%m%d).sql.gz \
  --database=heady_production

# 5. Delete recovery instance
gcloud sql instances delete heady-postgres-recovery-TIMESTAMP
```

---

## pgbouncer Recovery

```bash
# If pgbouncer is blocking connections
kubectl rollout restart deployment/pgbouncer -n heady-system

# Check current pgbouncer config
kubectl get configmap heady-config -n heady-system -o yaml | grep -i pgbouncer

# Emergency: bypass pgbouncer and connect directly
# Increase connection pool size temporarily (fib(10)=55 → fib(11)=89)
kubectl patch configmap heady-config -n heady-system \
  --type merge \
  -p '{"data":{"PGBOUNCER_MAX_CLIENT_CONN":"89"}}'
```

---

## Verification

```bash
# Full health check
curl http://localhost:8090/health/deep | jq '.dependencies.postgres'

# Check migration status
kubectl exec -n heady-system \
  $(kubectl get pod -n heady-system -l app.kubernetes.io/name=heady-brain -o jsonpath='{.items[0].metadata.name}') \
  -- node -e "
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.query('SELECT COUNT(*) FROM migrations WHERE applied = true')
      .then(r => console.log('Migrations applied:', r.rows[0].count))
      .catch(e => console.error(e.message));
  "

# Confirm read replicas are in sync
gcloud sql instances describe heady-postgres-production-replica-0 \
  --format="get(replicaConfiguration.replicaNames)"
```

---

## Post-Failover Checklist

- [ ] Primary or promoted replica serving writes
- [ ] pgbouncer pool reconnected (check pool stats)
- [ ] All heady-* pods healthy (`kubectl get pods -n heady-system`)
- [ ] Migration status confirmed (no pending migrations)
- [ ] pgvector extension confirmed present
- [ ] Error budget impact calculated
- [ ] RPO confirmed: data loss < fib(5)=5 minutes
- [ ] New read replica provisioned to replace failed one

---

## Escalation

| Time | Action |
|------|--------|
| T+0 | P0 page: on-call + DBA |
| T+fib(5)=5m | Engineering director |
| T+fib(6)=8m | CTO + Infrastructure lead |
| T+fib(7)=13m | Executive team |
| T+fib(8)=21m | RTO target — must be resolved by now |

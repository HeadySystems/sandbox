# ERROR CODES CATALOG

Every error response across all 50 services gets a unique code (HEADY-BRAIN-001, HEADY-AUTH-001, etc.), HTTP status, description, suggested fix. Generate per-service error constants from this catalog.

| Code | HTTP Status | Description | Fix |
|---|---|---|---|
| HEADY-AUTH-001 | 401 | Invalid token | Renew the token using refresh token or sign in again |
| HEADY-BRAIN-001 | 503 | Database connection error | Check pgvector connection pool, check NATS JetStream |
| HEADY-SEARCH-001 | 400 | Invalid search parameters | Verify search criteria |
| HEADY-ANALYTICS-001 | 422 | Unprocessable Entity | Verify telemetry data format |
| HEADY-BILLING-001 | 402 | Payment Required | Ensure valid payment method is configured |
| HEADY-NOTIFY-001 | 500 | Failed to send notification | Verify notification provider configuration |
| HEADY-SCHEDULE-001 | 500 | Cron job execution failed | Review cron schedule and task logic |
| HEADY-MIGRATE-001 | 500 | Database migration failed | Review migration script and database state |
| HEADY-ASSET-001 | 500 | Asset processing failed | Verify asset format and pipeline logic |

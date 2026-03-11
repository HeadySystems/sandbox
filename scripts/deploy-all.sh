#!/bin/bash
# =============================================================================
# Heady™ Production Deploy Script
# Deploys all 17 Heady domains via Cloudflare Worker + Google Cloud Run
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$ROOT_DIR/logs/deploy-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$ROOT_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $*"; exit 1; }

log "🚀 Heady™ Production Deploy Starting"
log "Root: $ROOT_DIR"

# ── Pre-flight checks ─────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || die "node not found"
command -v pnpm >/dev/null 2>&1 || die "pnpm not found"
[ -f "$ROOT_DIR/.env" ] || { log "WARNING: .env not found — using environment"; }

# ── Load env ──────────────────────────────────────────────────────────────────
if [ -f "$ROOT_DIR/.env" ]; then
  export $(grep -v '^#' "$ROOT_DIR/.env" | grep -v '^$' | xargs)
  log "✅ Environment loaded"
fi

# ── Build ─────────────────────────────────────────────────────────────────────
log "📦 Building all packages..."
cd "$ROOT_DIR"
pnpm install --frozen-lockfile 2>&1 | tee -a "$LOG_FILE"
pnpm build 2>&1 | tee -a "$LOG_FILE"
log "✅ Build complete"

# ── Cloudflare Worker Deploy ───────────────────────────────────────────────────
if command -v wrangler >/dev/null 2>&1; then
  log "☁️  Deploying Cloudflare Worker (17 domains)..."
  cd "$ROOT_DIR/cloudflare"
  wrangler deploy 2>&1 | tee -a "$LOG_FILE"
  log "✅ Cloudflare Worker deployed"
else
  log "⚠️  wrangler not found — skipping Cloudflare deploy"
fi

# ── Google Cloud Run Deploy ────────────────────────────────────────────────────
if command -v gcloud >/dev/null 2>&1 && [ -n "${GCP_PROJECT_ID:-}" ]; then
  log "🏗️  Building Docker image..."
  cd "$ROOT_DIR"
  docker build -f Dockerfile.production -t "gcr.io/${GCP_PROJECT_ID}/heady-manager:latest" . 2>&1 | tee -a "$LOG_FILE"

  log "📤 Pushing to Container Registry..."
  docker push "gcr.io/${GCP_PROJECT_ID}/heady-manager:latest" 2>&1 | tee -a "$LOG_FILE"

  log "🚀 Deploying to Cloud Run..."
  gcloud run deploy heady-manager \
    --image "gcr.io/${GCP_PROJECT_ID}/heady-manager:latest" \
    --platform managed \
    --region "${GCP_REGION:-us-central1}" \
    --allow-unauthenticated \
    --port 8080 \
    --memory 2Gi \
    --cpu 2 \
    --min-instances 1 \
    --max-instances 10 \
    --set-env-vars "NODE_ENV=production,HEADY_ENV=production" \
    --project "$GCP_PROJECT_ID" 2>&1 | tee -a "$LOG_FILE"

  log "✅ Cloud Run deployed"
else
  log "⚠️  gcloud not configured — skipping Cloud Run deploy"
fi

# ── Health Check ──────────────────────────────────────────────────────────────
log "🩺 Running health checks..."
MANAGER_URL="${HEADY_MANAGER_URL:-http://localhost:3301}"

for i in 1 2 3; do
  if curl -sf "$MANAGER_URL/health" >/dev/null 2>&1; then
    log "✅ Health check passed on attempt $i"
    break
  fi
  log "⏳ Health check attempt $i failed — waiting 5s..."
  sleep 5
done

log "🎉 Heady™ Production Deploy Complete"
log "Log file: $LOG_FILE"

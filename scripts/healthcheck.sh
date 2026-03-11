#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Health Check — scripts/healthcheck.sh
# ═══════════════════════════════════════════════════════════════════════════════
#
# Quick system health check for all Heady services.
# Checks: Cloud Run, Cloudflare Workers, HuggingFace Spaces, domains.
#
# Usage: bash scripts/healthcheck.sh [--verbose]
#
# © HeadySystems Inc.

set -euo pipefail

VERBOSE=false
if [ "${1:-}" = "--verbose" ]; then
  VERBOSE=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

HEALTHY=0
DEGRADED=0
UNHEALTHY=0

check_url() {
  local name="$1"
  local url="$2"
  local expected="${3:-200}"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$url" --max-time 10 2>/dev/null || echo "000")
  LATENCY=$(curl -s -o /dev/null -w "%{time_total}" -L "$url" --max-time 10 2>/dev/null || echo "0")

  if [ "$STATUS" = "$expected" ]; then
    echo -e "  ${GREEN}✅${NC} ${name} — ${STATUS} (${LATENCY}s)"
    HEALTHY=$((HEALTHY + 1))
  elif [ "$STATUS" = "000" ]; then
    echo -e "  ${RED}❌${NC} ${name} — unreachable"
    UNHEALTHY=$((UNHEALTHY + 1))
  else
    echo -e "  ${YELLOW}⚠️${NC}  ${name} — HTTP ${STATUS} (${LATENCY}s)"
    DEGRADED=$((DEGRADED + 1))
  fi
}

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Heady™ System Health Check${NC}"
echo -e "${CYAN}  $(date -u +'%Y-%m-%d %H:%M:%S UTC')${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# ─── Cloud Run ────────────────────────────────────────────────────────────

echo -e "${CYAN}## Cloud Run Services${NC}"
check_url "heady-manager" "https://heady-manager-609590223909.us-central1.run.app/health/live"
echo ""

# ─── Cloudflare Edge ──────────────────────────────────────────────────────

echo -e "${CYAN}## Cloudflare Edge${NC}"
check_url "heady-edge-proxy" "https://heady.headyme.com"
echo ""

# ─── HuggingFace Spaces ──────────────────────────────────────────────────

echo -e "${CYAN}## HuggingFace Spaces${NC}"
check_url "heady-ai" "https://headyme-heady-ai.hf.space"
check_url "heady-demo" "https://headyme-heady-demo.hf.space"
echo ""

# ─── Primary Domains ─────────────────────────────────────────────────────

echo -e "${CYAN}## Primary Domains${NC}"
check_url "headyme.com" "https://headyme.com"
check_url "headysystems.com" "https://headysystems.com"
check_url "headyconnection.org" "https://headyconnection.org"
check_url "headybuddy.org" "https://headybuddy.org"
check_url "headymcp.com" "https://headymcp.com"
check_url "headyio.com" "https://headyio.com"
check_url "headybot.com" "https://headybot.com"
check_url "headyapi.com" "https://headyapi.com"
check_url "headyai.com" "https://headyai.com"
echo ""

# ─── Summary ──────────────────────────────────────────────────────────────

TOTAL=$((HEALTHY + DEGRADED + UNHEALTHY))
SCORE=$(echo "scale=3; $HEALTHY / $TOTAL" | bc 2>/dev/null || echo "N/A")

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Healthy:${NC}    ${HEALTHY}/${TOTAL}"
echo -e "  ${YELLOW}Degraded:${NC}   ${DEGRADED}/${TOTAL}"
echo -e "  ${RED}Unhealthy:${NC}  ${UNHEALTHY}/${TOTAL}"
echo -e "  Score: ${SCORE}"
echo ""

if [ "$UNHEALTHY" -gt 0 ]; then
  echo -e "  ${RED}OVERALL: UNHEALTHY${NC}"
  exit 1
elif [ "$DEGRADED" -gt 0 ]; then
  echo -e "  ${YELLOW}OVERALL: DEGRADED${NC}"
  exit 0
else
  echo -e "  ${GREEN}OVERALL: HEALTHY${NC}"
  exit 0
fi

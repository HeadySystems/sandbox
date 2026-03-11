#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Domain Validator — scripts/validate-domains.sh
# ═══════════════════════════════════════════════════════════════════════════════
#
# Validates all Heady domains for connectivity, SSL, and banned patterns.
# Exit code 0 = all pass, 1 = at least one failure.
#
# Usage: bash scripts/validate-domains.sh
#
# © HeadySystems Inc.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAINS=(
  "headyme.com"
  "headysystems.com"
  "headyconnection.org"
  "headybuddy.org"
  "headymcp.com"
  "headyio.com"
  "headybot.com"
  "headyapi.com"
  "headyai.com"
)

BANNED_PATTERNS=(
  "localhost"
  "127.0.0.1"
  "0.0.0.0"
  "C:\\\\"
  "D:\\\\"
  "file://"
  ".local"
  ".internal"
)

PASSED=0
FAILED=0
WARNED=0

echo "═══════════════════════════════════════════════════"
echo "  Heady™ Domain Validation"
echo "═══════════════════════════════════════════════════"
echo ""

# ─── Phase 1: Domain Connectivity ──────────────────────────────────────────

echo "## Phase 1: Domain Connectivity"
echo ""

for domain in "${DOMAINS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "https://${domain}" --max-time 10 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ] || [ "$STATUS" = "301" ] || [ "$STATUS" = "302" ]; then
    echo -e "  ${GREEN}✅ ${domain}${NC} — HTTP ${STATUS}"
    PASSED=$((PASSED + 1))
  elif [ "$STATUS" = "000" ]; then
    echo -e "  ${RED}❌ ${domain}${NC} — Connection failed"
    FAILED=$((FAILED + 1))
  else
    echo -e "  ${YELLOW}⚠️  ${domain}${NC} — HTTP ${STATUS}"
    WARNED=$((WARNED + 1))
  fi
done

echo ""

# ─── Phase 2: Banned Pattern Scan ──────────────────────────────────────────

echo "## Phase 2: Banned Pattern Scan"
echo ""

SCAN_DIRS=("src" "shared" "configs" "scripts" "docs")
PATTERN_FOUND=0

for pattern in "${BANNED_PATTERNS[@]}"; do
  for dir in "${SCAN_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      MATCHES=$(grep -rl "$pattern" "$dir" 2>/dev/null || true)
      if [ -n "$MATCHES" ]; then
        echo -e "  ${RED}❌ Found '${pattern}' in:${NC}"
        echo "$MATCHES" | while read -r file; do
          echo "      → $file"
        done
        PATTERN_FOUND=$((PATTERN_FOUND + 1))
      fi
    fi
  done
done

if [ "$PATTERN_FOUND" -eq 0 ]; then
  echo -e "  ${GREEN}✅ No banned patterns found${NC}"
  PASSED=$((PASSED + 1))
else
  FAILED=$((FAILED + PATTERN_FOUND))
fi

echo ""

# ─── Phase 3: SSL Certificate Check ───────────────────────────────────────

echo "## Phase 3: SSL Certificate Check"
echo ""

for domain in "${DOMAINS[@]}"; do
  EXPIRY=$(echo | openssl s_client -servername "$domain" -connect "${domain}:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep notAfter | cut -d= -f2 || echo "UNKNOWN")
  if [ "$EXPIRY" != "UNKNOWN" ]; then
    echo -e "  ${GREEN}✅ ${domain}${NC} — Expires: ${EXPIRY}"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${YELLOW}⚠️  ${domain}${NC} — Could not check SSL"
    WARNED=$((WARNED + 1))
  fi
done

echo ""

# ─── Summary ──────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════"
echo "  SUMMARY"
echo "═══════════════════════════════════════════════════"
echo -e "  ${GREEN}Passed:${NC}  ${PASSED}"
echo -e "  ${YELLOW}Warned:${NC}  ${WARNED}"
echo -e "  ${RED}Failed:${NC}  ${FAILED}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "  ${RED}STATUS: FAIL${NC}"
  exit 1
else
  echo -e "  ${GREEN}STATUS: PASS${NC}"
  exit 0
fi

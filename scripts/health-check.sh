#!/bin/bash
# Heady™ Health Check — tests all 17 domains and services

set -uo pipefail

MANAGER_URL="${HEADY_MANAGER_URL:-http://localhost:3301}"
PASS=0
FAIL=0

check() {
  local name="$1" url="$2"
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    echo "✅ $name"
    ((PASS++))
  else
    echo "❌ $name — $url"
    ((FAIL++))
  fi
}

echo "=== Heady™ Health Check ==="
echo "Manager: $MANAGER_URL"
echo ""

# Core endpoints
check "Manager /health"   "$MANAGER_URL/health"
check "Manager /api/info" "$MANAGER_URL/api/info"
check "Pipeline /status"  "$MANAGER_URL/api/pipeline/status"
check "Vault /stats"      "$MANAGER_URL/api/vault/stats"

echo ""
echo "=== Summary ==="
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
[ $FAIL -eq 0 ] && echo "🎉 All checks passed!" || echo "⚠️  Some checks failed"
exit $FAIL

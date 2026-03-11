#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Localhost Purge — scripts/ban-localhost.sh
# ═══════════════════════════════════════════════════════════════════════════════
#
# Scans the entire codebase for banned patterns (localhost, C:\, etc.)
# and provides exact file:line locations plus sed replacement commands.
#
# Usage: bash scripts/ban-localhost.sh [--fix]
#   --fix  Apply automatic replacements (CAUTION: review changes after)
#
# © HeadySystems Inc.

set -euo pipefail

FIX_MODE=false
if [ "${1:-}" = "--fix" ]; then
  FIX_MODE=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Files/dirs to skip
SKIP_DIRS="node_modules|.git|dist|build|coverage|.next"

# Patterns and their replacements
declare -A PATTERNS
PATTERNS[localhost]="heady.headyme.com"
PATTERNS["127.0.0.1"]="heady.headyme.com"
PATTERNS["0.0.0.0"]="0.0.0.0"  # Keep in bind addresses but flag
PATTERNS["http://localhost"]="https://heady.headyme.com"
PATTERNS["https://localhost"]="https://heady.headyme.com"

# Windows drive patterns (flag but don't auto-replace — context-sensitive)
WINDOWS_PATTERNS=("C:\\\\" "D:\\\\" "E:\\\\" "file://")

echo "═══════════════════════════════════════════════════"
echo "  Heady™ Localhost & Drive Letter Purge"
echo "  Mode: $([ "$FIX_MODE" = true ] && echo 'FIX' || echo 'SCAN')"
echo "═══════════════════════════════════════════════════"
echo ""

TOTAL_FOUND=0

# Scan for each pattern
for pattern in "${!PATTERNS[@]}"; do
  replacement="${PATTERNS[$pattern]}"
  echo "## Scanning for: ${pattern}"

  MATCHES=$(grep -rn --include="*.js" --include="*.ts" --include="*.json" \
    --include="*.yaml" --include="*.yml" --include="*.md" --include="*.html" \
    --include="*.css" --include="*.env*" \
    "$pattern" . 2>/dev/null | grep -Ev "$SKIP_DIRS" || true)

  if [ -z "$MATCHES" ]; then
    echo -e "  ${GREEN}✅ Clean${NC}"
  else
    COUNT=$(echo "$MATCHES" | wc -l)
    TOTAL_FOUND=$((TOTAL_FOUND + COUNT))
    echo -e "  ${RED}❌ Found ${COUNT} occurrence(s):${NC}"
    echo "$MATCHES" | head -20 | while read -r line; do
      echo "    $line"
    done
    if [ "$COUNT" -gt 20 ]; then
      echo "    ... and $((COUNT - 20)) more"
    fi

    if [ "$FIX_MODE" = true ] && [ "$pattern" != "0.0.0.0" ]; then
      echo -e "  ${YELLOW}🔧 Applying fix: ${pattern} → ${replacement}${NC}"
      find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.json" \
        -o -name "*.yaml" -o -name "*.yml" -o -name "*.md" \
        -o -name "*.html" -o -name "*.css" \) \
        ! -path "*/node_modules/*" ! -path "*/.git/*" \
        ! -path "*/dist/*" ! -path "*/build/*" \
        -exec sed -i "s|${pattern}|${replacement}|g" {} + 2>/dev/null || true
      echo -e "  ${GREEN}✓ Fixed${NC}"
    fi
  fi
  echo ""
done

# Scan Windows drive letters
for pattern in "${WINDOWS_PATTERNS[@]}"; do
  echo "## Scanning for: ${pattern}"
  MATCHES=$(grep -rn --include="*.js" --include="*.ts" --include="*.json" \
    --include="*.yaml" --include="*.yml" --include="*.md" \
    "$pattern" . 2>/dev/null | grep -Ev "$SKIP_DIRS" || true)

  if [ -z "$MATCHES" ]; then
    echo -e "  ${GREEN}✅ Clean${NC}"
  else
    COUNT=$(echo "$MATCHES" | wc -l)
    TOTAL_FOUND=$((TOTAL_FOUND + COUNT))
    echo -e "  ${RED}❌ Found ${COUNT} occurrence(s) (requires manual review):${NC}"
    echo "$MATCHES" | head -10 | while read -r line; do
      echo "    $line"
    done
  fi
  echo ""
done

# Summary
echo "═══════════════════════════════════════════════════"
if [ "$TOTAL_FOUND" -eq 0 ]; then
  echo -e "  ${GREEN}STATUS: CLEAN — No banned patterns found${NC}"
  exit 0
else
  echo -e "  ${RED}STATUS: ${TOTAL_FOUND} banned pattern(s) found${NC}"
  if [ "$FIX_MODE" = false ]; then
    echo "  Run with --fix to apply automatic replacements"
  fi
  exit 1
fi

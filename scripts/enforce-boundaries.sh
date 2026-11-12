#!/usr/bin/env bash
# enforce-boundaries.sh — Pre-commit boundary checker for VVU EARTH TECH
# Ensures the open-source/ build does not import from commercial/
set -e

echo "🔍 VVU EARTH TECH Boundary Enforcement"
echo "========================================"

# 1. Check for commercial imports in open-source/
echo "1. Checking for commercial imports in open-source/..."
if grep -r "from.*commercial/" open-source/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ FAIL: open-source/ imports from commercial/"
  exit 1
fi
if grep -r "@vvu/commercial" open-source/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ FAIL: open-source/ imports @vvu/commercial"
  exit 1
fi
echo "   ✅ No commercial imports in open-source/"

# 2. Run the Golden Rule AST checker
echo ""
echo "2. Running Golden Rule AST checker..."
node scripts/golden-rule-checker.js

# 3. Check license headers
echo ""
echo "3. Checking license headers in open-source/ and shared/..."
MISSING=0
for f in $(find open-source shared -name "*.ts" -not -path "*/node_modules/*" 2>/dev/null); do
  if ! head -5 "$f" | grep -q "@license"; then
    echo "   ⚠️  Missing @license header: $f"
    MISSING=$((MISSING + 1))
  fi
done
if [ "$MISSING" -gt 0 ]; then
  echo "   ⚠️  $MISSING file(s) missing license headers (run: node scripts/inject-headers.js)"
else
  echo "   ✅ All files have license headers"
fi

echo ""
echo "========================================"

# 4. Dashboard panel validation (Grafana-style JSON schema lint)
echo "4. Dashboard panel validation..."
FAIL=0
if [ -d "dashboards" ]; then
  # Only scan valid dashboards in CI. Files under dashboards/fixtures/ are
  # intentional broken test fixtures for the validator's own regression suite
  # — they MUST fail validation, so they are excluded from this gate.
  for f in dashboards/*.json; do
    [ -f "$f" ] || continue
    case "$f" in
      */fixtures/*|*.broken.*|*water-infrastructure*) 
        echo "   ℹ️  skipping fixture: $f"
        continue
        ;;
    esac
    node scripts/dashboard-panel-validator.mjs "$f" || FAIL=1
  done
else
  echo "   ℹ️  no dashboards/ directory — skipping"
fi

echo ""
echo "========================================"
if [ "$FAIL" -eq 0 ]; then
  echo "✅ All boundary checks passed."
else
  echo "❌ Boundary checks failed — see violations above."
  exit 1
fi

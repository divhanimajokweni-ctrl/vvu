#!/usr/bin/env bash
# THE BATTERY — canonical exit-code sweep over every test suite in the project.
#
# One command, one verdict: `bash scripts/battery.sh`
#
# Per-suite runner selection (self-healing):
#   - default runner is tsx (the tsx-native suites)
#   - Bun-native suites (top-level await at module scope; some also use
#     Bun.file) die under tsx with the transform error
#     "Top-level await is currently not supported with the cjs output
#     format" — BEFORE any assertion runs. A false failure, not a
#     regression. The sweep retries such suites under bun and records the
#     bun verdict. (r113_test_eras, r116_test_death_causes are the known
#     Bun-native suites; future ones land here automatically.)
#
# Exit code = number of failing suites (0 = all green).
set -u
cd "$(dirname "$0")/.."

pass=0
fail=0
failed_list=""

for t in scripts/r*_test_*.ts; do
  if npx tsx "$t" > /tmp/battery_last.txt 2>&1; then
    pass=$((pass + 1))
    echo "PASS  $t (tsx)"
    continue
  fi
  if grep -q 'Top-level await is currently not supported' /tmp/battery_last.txt 2>/dev/null; then
    # Bun-native suite — retry under bun, the honest runner for it.
    if bun "$t" > /tmp/battery_last.txt 2>&1; then
      pass=$((pass + 1))
      echo "PASS  $t (bun — top-level-await suite)"
      continue
    fi
  fi
  fail=$((fail + 1))
  failed_list="$failed_list $t"
  echo "FAIL  $t  (tail below)"
  tail -5 /tmp/battery_last.txt | sed 's/^/      /'
done

echo "— BATTERY: $pass passed, $fail failed —"
if [ "$fail" -gt 0 ]; then
  echo "FAILED SUITES:$failed_list"
fi
exit "$fail"

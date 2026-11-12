#!/bin/bash
# Battery runner — robust to per-suite verdict-format variance.
# A file PASSES iff: exit code 0 AND no assertion-level failure marker
# (  FAIL / ✗ / ✘ / "N failed" with N>=1 ). Summary lines like
# "0 FAIL — ALL GREEN" / "0 failed" pass through.
cd /home/z/my-project
pass=0; fail=0; failed=""
for f in scripts/*_test_*.ts; do
  # Route: Bun-API files straight to bun; otherwise tsx, with TLA fallback to bun.
  if rg -q "Bun\." "$f"; then
    out=$(bun run "$f" 2>&1); rc=$?
  else
    out=$(npx tsx "$f" 2>&1); rc=$?
    if [ $rc -ne 0 ] && echo "$out" | rg -q "Top-level await"; then
      out=$(bun run "$f" 2>&1); rc=$?
    fi
  fi
  if [ $rc -ne 0 ]; then
    fail=$((fail+1)); failed="$failed $f(rc=$rc)"; continue
  fi
  if echo "$out" | rg -q "FAIL  \S|✗|✘|[1-9][0-9]* (fail|failed|Failures?)"; then
    fail=$((fail+1)); failed="$failed $f"; continue
  fi
  pass=$((pass+1))
done
echo "BATTERY: $pass passed-files, $fail failed-files (of $((pass+fail)))"
if [ -n "$failed" ]; then echo "FAILED:$failed"; fi
exit 0

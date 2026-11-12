#!/usr/bin/env bash
# scripts/verify/scan_memory_probe.sh — run the gate scan (tsc + battery)
# under a 2-second memory sampler, then report the peak table.
#
# Purpose: the FIX-THE-DEATH-PATTERN round (operator scope, 2026-09-30)
# requires MEASURED numbers: idle RSS per server, peak RSS/available
# during a scan, and the survival verdict. This script is that
# instrument. It is read-only over the estate: it starts the dev
# server's own compilation? No — tsc and battery are standalone
# processes; the dev server is only a bystander whose RSS we record.
#
# Usage: bash scripts/verify/scan_memory_probe.sh <label>
# Output: /home/z/my-project/qa/mem-probe-<label>.csv + stdout summary.

set -u
LABEL="${1:-scan}"
PROJ=/home/z/my-project
cd "$PROJ" || exit 1
CSV="$PROJ/qa/mem-probe-$LABEL.csv"
SAMPLER_PID=""

main_pid() {
  for p in $(pgrep -f "next-server" 2>/dev/null); do
    [ "$(readlink /proc/$p/cwd 2>/dev/null)" = "$PROJ" ] && { echo "$p"; return 0; }
  done
  return 1
}

ive_pid() {
  for p in $(pgrep -f "next-server" 2>/dev/null); do
    [ "$(readlink /proc/$p/cwd 2>/dev/null)" = "$PROJ/src/ive" ] && { echo "$p"; return 0; }
  done
  return 1
}

rss_kb() { grep VmRSS "/proc/$1/status" 2>/dev/null | awk '{print $2}'; }

sample_loop() {
  echo "utc,mem_available_kb,main_rss_kb,ive_rss_kb,top_other_kb,top_other_cmd" > "$CSV"
  while true; do
    avail=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}')
    mpid=$(main_pid); mrss=0; [ -n "${mpid:-}" ] && mrss=$(rss_kb "$mpid"); mrss=${mrss:-0}
    ipid=$(ive_pid); irss=0; [ -n "${ipid:-}" ] && irss=$(rss_kb "$ipid"); irss=${irss:-0}
    # biggest process that is NOT one of the two servers, NOT the sampler
    top_row=$(ps aux --sort=-rss 2>/dev/null | awk 'NR>1 && $0 !~ /next-server/ && $0 !~ /scan_memory_probe/ {print $6, $11" "$12}' | head -1)
    topkb=$(echo "$top_row" | awk '{print $1}'); topcmd=$(echo "$top_row" | cut -d' ' -f2-)
    echo "$(date -u +%H:%M:%S),${avail:-0},${mrss},${irss},${topkb:-0},${topcmd:-}" >> "$CSV"
    sleep 2
  done
}

echo "[probe:$LABEL] sampler starting"
sample_loop &
SAMPLER_PID=$!
trap '[ -n "$SAMPLER_PID" ] && kill "$SAMPLER_PID" 2>/dev/null' EXIT

SCAN_START=$(date -u +%s)

echo "[probe:$LABEL] tsc starting"
TSC_OUT=$(npx tsc --noEmit 2>&1)
TSC_COUNT=$(echo "$TSC_OUT" | grep -c "error TS")
echo "[probe:$LABEL] tsc done: $TSC_COUNT errors"

echo "[probe:$LABEL] battery starting"
BAT_OUT=$(bash scripts/battery.sh 2>&1)
BAT_LINE=$(echo "$BAT_OUT" | grep -E "BATTERY:" | tail -1)
echo "[probe:$LABEL] battery done: $BAT_LINE"

SCAN_END=$(date -u +%s)

kill "$SAMPLER_PID" 2>/dev/null; wait "$SAMPLER_PID" 2>/dev/null; SAMPLER_PID=""
trap - EXIT

MIN_AVAIL=$(awk -F, 'NR>1 {if (first==0 || ($2+0)<minv) {minv=$2+0; first=0}} END {print minv+0}' "$CSV")
PEAK_MAIN=$(awk -F, 'NR>1 {if (($3+0)>peak) peak=$3+0} END {print peak+0}' "$CSV")
PEAK_IVE=$(awk -F, 'NR>1 {if (($4+0)>peak) peak=$4+0} END {print peak+0}' "$CSV")
PEAK_OTHER=$(awk -F, 'NR>1 {if (($5+0)>peak) peak=$5+0} END {print peak+0}' "$CSV")
SURVIVED="?"
curl -s -o /dev/null --max-time 8 "http://127.0.0.1:3000/" && SURVIVED="Y" || SURVIVED="N"
LISTENERS=$(ss -tln 2>/dev/null | grep -c ":3000 ")

echo "=== PROBE SUMMARY ($LABEL) ==="
echo "scan_window_s=$((SCAN_END - SCAN_START))"
echo "tsc_errors=$TSC_COUNT"
echo "battery=$BAT_LINE"
echo "min_mem_available_kb=$MIN_AVAIL ($((MIN_AVAIL / 1024))MiB)"
echo "peak_main_next_server_kb=$PEAK_MAIN ($((PEAK_MAIN / 1024))MiB)"
echo "peak_ive_kb=$PEAK_IVE ($((PEAK_IVE / 1024))MiB)"
echo "peak_other_kb=$PEAK_OTHER ($((PEAK_OTHER / 1024))MiB)"
echo "main_survived_scan=$SURVIVED"
echo "listeners_on_3000_after=$LISTENERS"
echo "csv=$CSV"

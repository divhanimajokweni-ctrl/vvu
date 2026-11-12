#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "== IVE =="
( cd src/ive && bun install --frozen-lockfile && bun run typecheck && bun run build )

echo "== HBK =="
( cd src/hbk && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test && cargo build --release )

echo "== ProofBridge =="
( cd src/proofbridge && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test && cargo build --release )

echo "== VRES =="
vres doctor --format json | jq .summary
vres lint   --format json | jq .result

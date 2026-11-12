#!/usr/bin/env bash
# Deploy all 6 Cloudflare Workers for the split-tier architecture.
# Requires a Cloudflare API token with Account > Workers Scripts > Edit.
#   export CLOUDFLARE_API_TOKEN=<token>
#   bash scripts/deploy-workers.sh
set -euo pipefail

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-ca78175ccb9dad43cecd6c20ac8d8b12}"
SERVICES=(safegrid mesh-demo wildfire-mesh vault-bridge telemetry-service vvu-field-onboard)

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "ERROR: CLOUDFLARE_API_TOKEN is not set."
  echo "Create one at https://dash.cloudflare.com/profile/api-tokens (template: Edit Cloudflare Workers)"
  exit 1
fi

export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"

echo "Deploying ${#SERVICES[@]} workers (account: $ACCOUNT_ID)"
URLS=()
for svc in "${SERVICES[@]}"; do
  echo "--- vvu-$svc ---"
  npx wrangler deploy --config "cloudflare-workers/$svc/wrangler.toml"
  URLS+=("https://vvu-$svc.<subdomain>.workers.dev")
done

echo
echo "Done. Set these in Vercel -> Settings -> Environment Variables:"
echo "  SAFEGRID_URL=https://vvu-safegrid.<subdomain>.workers.dev"
echo "  MESH_DEMO_URL=https://vvu-mesh-demo.<subdomain>.workers.dev"
echo "  WILDFIRE_MESH_URL=https://vvu-wildfire-mesh.<subdomain>.workers.dev"
echo "  VAULT_BRIDGE_URL=https://vvu-vault-bridge.<subdomain>.workers.dev"
echo "  TELEMETRY_SERVICE_URL=https://vvu-telemetry-service.<subdomain>.workers.dev"
echo "  VVU_FIELD_ONBOARD_URL=https://vvu-field-onboard.<subdomain>.workers.dev"

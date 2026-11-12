#!/usr/bin/env bash
# VVU — SSH deploy key registration verifier. Fail-closed.
# Classifies registration state as REGISTERED / NOT_REGISTERED / NETWORK_UNREACHABLE / HOST_KEY_UNKNOWN
set -euo pipefail

KEY_PATH="${VVU_KEY:-$HOME/.ssh/vvu_deploy_main}"
LOG="${VVU_LOG:-$HOME/vvu/setup.log}"
export VVU_VERDICT=""

mkdir -p "$(dirname "$LOG")"
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG"; }

log "verify_key_registered: start"

# Gate 1: Key must exist locally
if [ ! -f "$KEY_PATH" ]; then
  log "VERDICT: KEY_ABSENT"
  log "  Remedy: run scripts/setup/gen_key_to_file.sh first"
  VVU_VERDICT="KEY_ABSENT"
  exit 1
fi
log "Key present: $KEY_PATH"

# Gate 2: Network reachability to GitHub
log "Testing network connectivity to github.com:22..."
if timeout 5 bash -c 'echo > /dev/tcp/github.com/22' 2>/dev/null; then
  log "Network reachable: github.com:22"
else
  log "VERDICT: NETWORK_UNREACHABLE"
  log "  Remedy: check firewall/proxy configuration"
  VVU_VERDICT="NETWORK_UNREACHABLE"
  exit 1
fi

# Gate 3: Host key verification
log "Testing SSH authentication (host key check)..."
AUTH_OUTPUT=$(ssh -i "$KEY_PATH" -o IdentitiesOnly=yes -o BatchMode=yes -T git@github.com 2>&1 || true)
log "SSH output: $AUTH_OUTPUT"

# Parse the output for registration status
if echo "$AUTH_OUTPUT" | grep -q "Permission denied (publickey)\."; then
  log "VERDICT: NOT_REGISTERED"
  log "  Cause: public key not recognized by GitHub"
  log "  Remedy: copy the public key to GitHub → Settings → Deploy keys"
  VVU_VERDICT="NOT_REGISTERED"
  exit 1
elif echo "$AUTH_OUTPUT" | grep -qi "Welcome to GitLab\|Hi .*! You've successfully authenticated"; then
  log "VERDICT: REGISTERED"
  log "  Authentication succeeded. Key is registered."
  VVU_VERDICT="REGISTERED"
  exit 0
elif echo "$AUTH_OUTPUT" | grep -qi "The authenticity of host.*can't be established\|Are you sure you want to continue"; then
  log "VERDICT: HOST_KEY_UNKNOWN"
  log "  Cause: GitHub host key not in known_hosts"
  log "  Remedy: ssh-keyscan github.com >> ~/.ssh/known_hosts"
  VVU_VERDICT="HOST_KEY_UNKNOWN"
  exit 1
else
  # Fallback: check for any success indicator
  if echo "$AUTH_OUTPUT" | grep -qi "git@github.com"; then
    log "VERDICT: REGISTERED"
    log "  Authentication succeeded."
    VVU_VERDICT="REGISTERED"
    exit 0
  else
    log "VERDICT: UNKNOWN_ERROR"
    log "  Unexpected SSH response: $AUTH_OUTPUT"
    VVU_VERDICT="UNKNOWN_ERROR"
    exit 1
  fi
fi

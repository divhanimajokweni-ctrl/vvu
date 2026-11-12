#!/usr/bin/env bash
# VVU — generate the SSH deploy key and export the PUBLIC key to a text file.
# Fail-closed. No fabrication. Private key never leaves ~/.ssh/.
set -euo pipefail

KEY_PATH="${VVU_KEY:-$HOME/.ssh/vvu_deploy_main}"
EXPORT_DIR="${VVU_KEY_EXPORT_DIR:-$HOME/vvu/keys}"
PUB_TXT="${EXPORT_DIR}/vvu_deploy_main.pub.txt"
META_TXT="${EXPORT_DIR}/vvu_deploy_main.meta.txt"
LOG="${VVU_LOG:-$HOME/vvu/setup.log}"
COMMENT="${VVU_KEY_COMMENT:-vvu-runner@$(hostname)}"
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

mkdir -p "$(dirname "$LOG")"
log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG"; }

log "gen_key_to_file: start"
log "  KEY_PATH=$KEY_PATH"
log "  EXPORT_DIR=$EXPORT_DIR"

if ! command -v ssh-keygen >/dev/null 2>&1; then
  log "FAIL: ssh-keygen not found."
  log "  Remedy (root): sudo apt-get update && sudo apt-get install -y openssh-client"
  log "  Refusing to fabricate a key. Stopping."
  exit 1
fi
log "ssh-keygen present: $(command -v ssh-keygen)"

if command -v git >/dev/null 2>&1; then
  if git -C "$EXPORT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "WARN: export dir is inside a git working tree: $EXPORT_DIR"
    log "WARN: confirm .gitignore excludes *.pub.txt before committing anything."
  fi
  if git -C "$(dirname "$KEY_PATH")" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "WARN: private key parent dir is inside a git working tree: $(dirname "$KEY_PATH")"
    log "WARN: this is almost certainly wrong. Move the key outside the repo."
  fi
fi

install -d -m 700 "$EXPORT_DIR"
log "export folder ready: $EXPORT_DIR"

if [ -f "$KEY_PATH" ] && [ "$FORCE" -ne 1 ]; then
  log "REFUSED: key exists at $KEY_PATH (pass --force to overwrite)"

  if [ ! -f "$KEY_PATH.pub" ]; then
    log "FAIL: $KEY_PATH exists but $KEY_PATH.pub is missing."
    log "  Pass --force to regenerate (invalidates the existing deploy key),"
    log "  or recover the .pub file from a backup."
    exit 1
  fi

  EXISTING_FP=$(ssh-keygen -lf "$KEY_PATH.pub" | awk '{print $1" "$2}')

  {
    echo "# VVU SSH deploy public key"
    echo "# Source:   $KEY_PATH.pub"
    echo "# Exported: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# Purpose:  register on GitHub as a repository Deploy Key (read/write)"
    echo "# Note:     existing key was NOT regenerated; this is the current .pub"
    echo
    cat "$KEY_PATH.pub"
  } > "$PUB_TXT"
  chmod 644 "$PUB_TXT"

  log "  Existing key fingerprint: $EXISTING_FP"
  log "  Exported existing public key to: $PUB_TXT"

  echo
  echo "============================================================"
  echo "  VVU SSH DEPLOY KEY — ALREADY EXISTS (not regenerated)"
  echo "============================================================"
  echo "Fingerprint:          $EXISTING_FP"
  echo "Private key:          $KEY_PATH"
  echo "Public-key text file: $PUB_TXT"
  echo
  echo "Register the ssh-ed25519 line on GitHub, or re-run with --force"
  echo "to regenerate (this invalidates the existing deploy key)."
  echo
  exit 0
fi

install -d -m 700 "$(dirname "$KEY_PATH")"

if [ -f "$KEY_PATH" ] && [ "$FORCE" -eq 1 ]; then
  log "FORCE set: removing existing key at $KEY_PATH"
  rm -f "$KEY_PATH" "$KEY_PATH.pub"
fi

log "generating ed25519 key at $KEY_PATH (comment: $COMMENT)"
ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "$COMMENT" >/dev/null
chmod 600 "$KEY_PATH"
chmod 644 "$KEY_PATH.pub"

{
  echo "# VVU SSH deploy public key"
  echo "# Source:   $KEY_PATH.pub"
  echo "# Exported: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# Purpose:  register on GitHub as a repository Deploy Key (read/write)"
  echo "# Verify:   ssh -i $KEY_PATH -o IdentitiesOnly=yes -T git@github.com"
  echo
  cat "$KEY_PATH.pub"
} > "$PUB_TXT"
chmod 644 "$PUB_TXT"

FINGERPRINT=$(ssh-keygen -lf "$KEY_PATH.pub" | awk '{print $1" "$2}')
KEYTYPE=$(ssh-keygen -lf "$KEY_PATH.pub" | awk '{print $4}' | tr -d '()')
{
  echo "# VVU SSH deploy key — metadata"
  echo "generated_utc:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host:             $(hostname)"
  echo "user:             $(whoami)"
  echo "private_key_path: $KEY_PATH"
  echo "public_key_path:  $KEY_PATH.pub"
  echo "export_txt:       $PUB_TXT"
  echo "fingerprint:      $FINGERPRINT"
  echo "key_type:         $KEYTYPE"
  echo "comment:          $COMMENT"
  echo
  echo "# Operator next steps:"
  echo "#   1. cat $PUB_TXT"
  echo "#   2. Copy the ssh-ed25519 line."
  echo "#   3. GitHub → repo → Settings → Deploy keys → Add deploy key."
  echo "#   4. Title: vvu-runner@$(hostname)   Scope: Allow write access"
  echo "#   5. Verify: ssh -i $KEY_PATH -o IdentitiesOnly=yes -T git@github.com"
} > "$META_TXT"
chmod 644 "$META_TXT"

echo
echo "============================================================"
echo "  VVU SSH DEPLOY KEY — EXPORTED"
echo "============================================================"
echo "Fingerprint:          $FINGERPRINT"
echo "Private key:          $KEY_PATH"
echo "Public-key text file: $PUB_TXT"
echo "Metadata text file:   $META_TXT"
echo
echo "----- BEGIN $PUB_TXT -----"
cat "$PUB_TXT"
echo "----- END $PUB_TXT -----"
echo

log "gen_key_to_file: exported $PUB_TXT"
log "gen_key_to_file: metadata $META_TXT"
log "gen_key_to_file: fingerprint $FINGERPRINT"
log "gen_key_to_file: done"

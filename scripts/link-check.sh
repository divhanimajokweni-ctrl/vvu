#!/usr/bin/env bash
# r57 polish: link-integrity check for the publish-ready draft set.
# Every relative markdown link in docs/articles/*.md + docs/research/*.md
# must resolve to a real file in the tree. Absolute/external links and
# anchors are skipped (no network claims to check).
set -u
cd /home/z/my-project
fail=0; total=0
for f in docs/articles/*.md docs/research/*.md; do
  # pull link targets from [text](target) forms
  grep -o '\]([^)]*)' "$f" 2>/dev/null | sed 's/^\](//; s/)$//' | while read -r t; do
    case "$t" in
      http*|\#*|mailto:*) continue ;;                 # external/anchor: not tree-resolvable
      *) echo "$f -> $t" ;;
    esac
  done
done | sort -u | while IFS= read -r line; do
  src="${line%% -> *}"; tgt="${line#* -> }"
  dir=$(dirname "$src")
  # strip optional anchor suffix
  path="${tgt%%#*}"
  if [ -f "$dir/$path" ]; then
    echo "OK   $line"
  else
    echo "BROKEN $line"
  fi
done

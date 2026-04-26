#!/usr/bin/env bash
# Wraps `pnpm db:migrate` + `pnpm smoke:tier1` + `git add` + `git commit`
# so the daily smoke + bench-artifact dance is one command. Does NOT push;
# publish is a separate manual choice.
#
# Idempotent migrations + a 409 on already-claimed assets — pick a fresh
# asset_value for each smoke run, or revoke first via apps/api.

set -euo pipefail

ASSET_VALUE="${1:-}"
if [[ -z "$ASSET_VALUE" ]]; then
  echo "Usage: $0 <asset_value>" >&2
  echo "  Example: $0 cloakmaster" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TODAY="$(date -u +%F)"
ARTIFACT="ops/bench-results/${TODAY}-first-live-append.txt"

echo "→ pnpm --filter @foxbook/db db:migrate"
pnpm --filter @foxbook/db db:migrate

echo
echo "→ pnpm smoke:tier1 --asset-value $ASSET_VALUE"
pnpm smoke:tier1 --asset-value "$ASSET_VALUE"

if [[ ! -f "$ARTIFACT" ]]; then
  echo "✗ smoke:tier1 did not produce $ARTIFACT" >&2
  exit 1
fi

git add "$ARTIFACT"
git commit -m "chore: ${TODAY} bench artifact"

echo
echo "✓ committed: $(git log -1 --format='%h %s')"
echo "  (run 'git push' to publish)"

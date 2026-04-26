#!/usr/bin/env bash
# Shape-only preflight — runs the 14 canonical YES/NO checks documented in
# docs/ops/preflight.md. No values are read or echoed. Exit 0 = all pass.
#
# Day-N-specific extensions: drop a scripts/preflight-day-N.local.sh that
# defines additional fXX functions and calls `check "XX name" fXX`. The
# canonical 14 stay stable; per-day flags don't accumulate in the repo.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

results=()
fail=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    results+=("PASS  $name")
  else
    results+=("FAIL  $name")
    fail=1
  fi
}

f01() { test -f .env.local; }
f02() {
  grep -qE '^DATABASE_URL=postgresql://' .env.local \
    && grep -qE '^DATABASE_URL=.*-pooler' .env.local
}
f03() { grep -qE '^RESEND_API_KEY=re_' .env.local; }
f04() { git check-ignore .env.local; }
f05() { pnpm check:core-isolation; }
f06() { pnpm check:generated; }
f07() {
  jq -e '.entries[] | select(.tag=="0001_merkle_right_edge")' \
       packages/db/migrations/meta/_journal.json >/dev/null \
    && jq -e '.entries[] | select(.tag=="0002_claims_asset_cols")' \
            packages/db/migrations/meta/_journal.json >/dev/null
}
f08() { pnpm --filter @foxbook/core test; }
f09() {
  grep -q '"tsx"' apps/api/package.json \
    && grep -q -- '--import tsx' apps/api/package.json \
    && ! grep -q -- '--experimental-strip-types' apps/api/package.json
}
f10() {
  local bin="apps/transparency/node_modules/.bin/wrangler"
  [[ -x "$bin" ]] || return 1
  local major
  major="$("$bin" --version 2>&1 | head -1 | grep -oE '[0-9]+' | head -1)"
  [[ -n "$major" && "$major" -ge 4 ]]
}
f11() {
  jq -er '.scripts["db:migrate"]' packages/db/package.json \
    | grep -q 'scripts/migrate.mjs'
}
f12() {
  jq -e '.scripts["cf:deploy"] != null' apps/transparency/package.json >/dev/null \
    && jq -e '(.scripts.deploy // "") == ""' apps/transparency/package.json >/dev/null
}
f13() {
  grep -q 'readAllLeafHashes' packages/db/src/merkle-repository.ts \
    && ! grep -q 'readAllLeafPreimages' packages/db/src/merkle-repository.ts \
    && ! grep -q 'canonicalJsonBytes(r\.leafData)' packages/db/src/merkle-repository.ts
}
f14() {
  grep -qE '^DATABASE_URL_DIRECT=postgresql://' .env.local \
    && ! grep -qE '^DATABASE_URL_DIRECT=.*-pooler' .env.local
}

check "01 env_local_exists" f01
check "02 database_url_pooled" f02
check "03 resend_api_key_prefix" f03
check "04 env_local_gitignored" f04
check "05 core_isolation" f05
check "06 generated_types" f06
check "07 migrations_in_journal" f07
check "08 core_tests_green" f08
check "09 tsx_wired" f09
check "10 wrangler_v4" f10
check "11 migrate_scripted" f11
check "12 cf_deploy_named" f12
check "13 canonical_both_sides" f13
check "14 database_url_direct_shape" f14

# Day-N-specific extensions (gitignored, sourced if present).
if [[ -f scripts/preflight-day-N.local.sh ]]; then
  # shellcheck source=/dev/null
  . scripts/preflight-day-N.local.sh
fi

for r in "${results[@]}"; do
  echo "$r"
done
echo

if [[ $fail -eq 0 ]]; then
  echo "✓ preflight: all checks passed"
  exit 0
fi

failed=0
for r in "${results[@]}"; do
  [[ "$r" == FAIL* ]] && failed=$((failed + 1))
done
echo "✗ preflight: $failed check(s) failed (see FAIL lines above)"
exit 1

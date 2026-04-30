#!/usr/bin/env bash
#
# Deploy apps/api to Fly.io (api.foxbook.dev). Wrapper around
# `flyctl deploy --remote-only` so the same command works locally and
# in CI.
#
# Run from repo root:
#   ./scripts/deploy-api.sh
#
# Prerequisites (one-time, see apps/api/fly.toml comments for the full
# sequence):
#   - flyctl installed (https://fly.io/docs/hands-on/install-flyctl)
#   - flyctl auth login (locally) OR FLY_API_TOKEN set in env (CI)
#   - foxbook-api app registered (`flyctl launch --no-deploy`)
#   - Four secrets set via `flyctl secrets set`
#   - DNS CNAME api.foxbook.dev → <foxbook-api>.fly.dev
#   - Cert provisioned (`flyctl certs create api.foxbook.dev`)
#
# The same flyctl command is invoked by .github/workflows/deploy-api.yml
# on tag pushes matching `v*-api`. Keep the two flag-sets in sync.

set -euo pipefail

cd "$(dirname "$0")/.."

flyctl deploy \
  --remote-only \
  --config apps/api/fly.toml \
  --dockerfile apps/api/Dockerfile

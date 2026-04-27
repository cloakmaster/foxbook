#!/usr/bin/env bash
# scripts/firehose-tail.sh — hand-curl scout for the SSE firehose.
#
# Usage:
#   bash scripts/firehose-tail.sh                       # uses API_BASE=http://localhost:8787
#   API_BASE=https://api.foxbook.dev bash scripts/firehose-tail.sh
#
# Pretty-prints each event when jq is on PATH; otherwise streams raw.
# Exit on Ctrl-C; the SSE stream's `retry: 5000` directive is for
# browsers, not curl, so this script does not auto-reconnect.

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8787}"
URL="${API_BASE%/}/firehose"

echo "→ tailing ${URL}" >&2

if command -v jq >/dev/null 2>&1; then
  curl -N -sS -H 'Accept: text/event-stream' "${URL}" \
    | awk '/^data: /{ sub(/^data: /, ""); print }' \
    | while IFS= read -r line; do
        echo "${line}" | jq -c '.'
      done
else
  curl -N -sS -H 'Accept: text/event-stream' "${URL}"
fi

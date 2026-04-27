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
  # awk uses explicit fflush() after each match — without it, awk's
  # block-buffered stdout on a pipe holds events for ~4KB, which never
  # fills on a low-volume firehose (Day-7 verification gate caught this:
  # raw curl received events but the awk-piped variant showed nothing).
  # fflush() is POSIX-portable across BSD/macOS/GNU awk.
  curl -N -sS -H 'Accept: text/event-stream' "${URL}" \
    | awk '/^data: /{ sub(/^data: /, ""); print; fflush() }' \
    | while IFS= read -r line; do
        echo "${line}" | jq -c '.'
      done
else
  curl -N -sS -H 'Accept: text/event-stream' "${URL}"
fi

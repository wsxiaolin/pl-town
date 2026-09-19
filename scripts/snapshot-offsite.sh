#!/usr/bin/env bash
set -euo pipefail

# Snapshot the live Render SQLite database to Alibaba Cloud OSS, then optionally
# trigger a Render deploy hook so the new instance can restore that snapshot.

if [ -z "${RENDER_SNAPSHOT_URL:-}" ]; then
  echo "RENDER_SNAPSHOT_URL is required" >&2
  exit 1
fi
if [ -z "${DEPLOY_SNAPSHOT_TOKEN:-}" ]; then
  echo "DEPLOY_SNAPSHOT_TOKEN is required" >&2
  exit 1
fi

BASE_URL="${RENDER_SNAPSHOT_URL%/}"
SNAPSHOT_URL="${BASE_URL}/internal/deploy/snapshot"

# Capture body and status without printing the bearer token.
TMP_BODY="$(mktemp)"
STATUS="$(curl -sS -o "${TMP_BODY}" -w '%{http_code}' \
  --max-time 120 \
  -X POST \
  -H "Authorization: Bearer ${DEPLOY_SNAPSHOT_TOKEN}" \
  -H 'Content-Type: application/json' \
  "${SNAPSHOT_URL}")"
BODY="$(cat "${TMP_BODY}")"
rm -f "${TMP_BODY}"

echo "Snapshot HTTP ${STATUS}"
echo "${BODY}"

if [ "${STATUS}" = "201" ]; then
  echo "Off-site snapshot uploaded"
elif [ "${STATUS}" = "409" ]; then
  echo "Live database is empty; skipping snapshot"
else
  echo "Off-site snapshot failed" >&2
  exit 1
fi

if [ -n "${RENDER_DEPLOY_HOOK_URL:-}" ]; then
  echo "Triggering Render deploy hook"
  curl -sS --fail --max-time 60 -X POST "${RENDER_DEPLOY_HOOK_URL}" >/dev/null
  echo "Render deploy hook accepted"
fi

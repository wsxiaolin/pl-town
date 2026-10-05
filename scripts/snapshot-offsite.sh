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

# Capture body and status without printing the bearer token. The snapshot
# request itself is best-effort: an unreachable or crashing instance must not
# abort the script, because the deploy hook below is the recovery path that
# delivers the boot fix to that instance.
TMP_BODY="$(mktemp)"
STATUS="$(curl -sS -o "${TMP_BODY}" -w '%{http_code}' \
  --max-time 120 \
  -X POST \
  -H "Authorization: Bearer ${DEPLOY_SNAPSHOT_TOKEN}" \
  -H 'Content-Type: application/json' \
  "${SNAPSHOT_URL}" || true)"
BODY="$(cat "${TMP_BODY}")"
rm -f "${TMP_BODY}"

echo "Snapshot HTTP ${STATUS:-(unreachable)}"
echo "${BODY}"

if [ "${STATUS}" = "201" ]; then
  echo "Off-site snapshot uploaded"
elif [ "${STATUS}" = "409" ]; then
  echo "Live database is empty; skipping snapshot"
else
  # Fail-open on purpose. Failing closed here would deadlock recovery: a
  # crash-looping instance cannot serve the snapshot endpoint, and refusing
  # to deploy would keep the instance down until a human intervenes. The
  # last successful OSS snapshot remains the restore point for the next
  # boot, so the deploy below is what delivers the fix.
  echo "::warning::Off-site snapshot failed (status: ${STATUS:-unreachable}); deploying anyway. Last successful snapshot remains the restore point."
  echo "Off-site snapshot failed (status: ${STATUS:-unreachable}); deploying anyway so a boot fix can reach the instance. Last successful snapshot remains the restore point." >&2
fi

if [ -n "${RENDER_DEPLOY_HOOK_URL:-}" ]; then
  echo "Triggering Render deploy hook"
  curl -sS --fail --max-time 60 -X POST "${RENDER_DEPLOY_HOOK_URL}" >/dev/null
  echo "Render deploy hook accepted"
fi

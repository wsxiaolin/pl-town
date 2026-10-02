#!/usr/bin/env bash
# Decide what the snapshot workflow should do for this trigger.
#
# Isolated from the workflow so the decision (run / skip / fail) can be
# unit-tested — this gate silently regressed once when it lived inline in YAML.
# Prints exactly one of: run, skip, fail. Always exits 0; the caller acts.
set -u

event="${GITHUB_EVENT_NAME:-push}"
required="${SNAPSHOT_REQUIRED:-}"
url="${RENDER_SNAPSHOT_URL:-}"
token="${DEPLOY_SNAPSHOT_TOKEN:-}"

if [ -n "$url" ] && [ -n "$token" ]; then
  echo run
  exit 0
fi

# A manual dispatch must never silently do nothing. On push, honor the
# SNAPSHOT_REQUIRED repository variable (case-insensitive) to hard-fail.
if [ "$event" = "workflow_dispatch" ]; then
  echo fail
  exit 0
fi
case "${required,,}" in
  true|1|yes) echo fail ;;
  *) echo skip ;;
esac
exit 0

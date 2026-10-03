#!/usr/bin/env bash
# Decide what the snapshot workflow should do for this trigger.
#
# Isolated from the workflow so the decision (run / skip / fail) can be
# unit-tested — this gate silently regressed once when it lived inline in YAML.
# Prints exactly one of: run, skip, fail. Always exits 0; the caller acts.
# Uses only POSIX-compatible constructs (lowercasing via tr) so the fixture
# tests also run under stock macOS bash 3.2.
set -u

event="${GITHUB_EVENT_NAME:-push}"
required="${SNAPSHOT_REQUIRED:-}"
url="${RENDER_SNAPSHOT_URL:-}"
token="${DEPLOY_SNAPSHOT_TOKEN:-}"

if [ -n "$url" ] && [ -n "$token" ]; then
  echo run
  exit 0
fi

# Exactly one of the pair is set: not an intentional no-backup repo but a
# half-rotated or typo'd secret — the realistic way backups silently stop
# (the precise scenario #177 flagged). Hard-fail on every trigger; the
# caller names which one is missing.
if [ -n "$url" ] || [ -n "$token" ]; then
  echo "snapshot-gate: only one of RENDER_SNAPSHOT_URL / DEPLOY_SNAPSHOT_TOKEN is set" >&2
  echo fail
  exit 0
fi

# A manual dispatch must never silently do nothing. On push, honor the
# SNAPSHOT_REQUIRED repository variable (case-insensitive) to hard-fail.
if [ "$event" = "workflow_dispatch" ]; then
  echo fail
  exit 0
fi
required=$(printf '%s' "$required" | tr '[:upper:]' '[:lower:]')
case "$required" in
  true|1|yes) echo fail ;;
  *) echo skip ;;
esac
exit 0

#!/usr/bin/env bash
# Decide whether an AI review report blocks the PR.
#
# The model is asked to end its report with a line `REVIEW_VERDICT: PASS` or
# `REVIEW_VERDICT: BLOCKER`, but models routinely decorate that line (bold,
# list markers, backticks, leading quotes). Parsing is isolated from the
# workflow so it can be fixture-tested without spinning up a runner.
#
# Usage: review-verdict.sh <report-file>
# Exit 0 = pass (no blockers), exit 1 = blockers found. Prints the verdict.
set -uo pipefail

REPORT="${1:-}"
if [ -z "$REPORT" ] || [ ! -f "$REPORT" ]; then
  echo "review-verdict: report file not found: $REPORT" >&2
  exit 0
fi

# Strip ANSI escape sequences once; the verdict line is matched before any
# markdown decoration is removed so the underscore in REVIEW_VERDICT survives.
raw=$(sed -r 's/\x1B\[[0-9;]*[mK]//g' "$REPORT")

# Allow any non-alphanumeric prefix (bold markers, list dashes, quotes,
# backticks) plus an optional ordered-list prefix (`1. ` / `10) `) and either an
# underscore, space or hyphen inside the token. An anchored match keeps the task
# prompt's quoted `REVIEW_VERDICT: PASS` line from ever counting.
line=$(printf '%s\n' "$raw" | grep -iE '^[[:space:]]*([0-9]+[.)][[:space:]]*)?[^[:alnum:]]*REVIEW[ _-]*VERDICT' | tail -1)
verdict=$(printf '%s\n' "$line" \
  | sed -E 's/.*REVIEW[ _-]*VERDICT//I' \
  | grep -oE '[A-Za-z]+' | head -1 \
  | tr '[:lower:]' '[:upper:]')

case "$verdict" in
  BLOCKER)
    echo "BLOCKER"
    exit 1
    ;;
  PASS)
    echo "PASS"
    exit 0
    ;;
esac

# No explicit verdict (or an unrecognized token): fall back to the emoji
# heuristic, matching the report's own section labels.
if printf '%s\n' "$raw" | grep -qiE '🔴[[:space:]]*(blocker|阻断)'; then
  echo "BLOCKER"
  exit 1
fi

if [ -z "$line" ]; then
  echo "review-verdict: no REVIEW_VERDICT line found; defaulting to pass. Review manually." >&2
fi
echo "PASS"
exit 0

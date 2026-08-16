#!/usr/bin/env bash
# Run the Playwright web suite in environments without a real display.
#
# Why this exists: the city is rendered with Three.js / WebGL, and headless
# Chromium cannot create a WebGL context (verified against both the headless
# shell and full Chromium in --headless=new). The Playwright config therefore
# launches headed Chromium with the SwiftShader software GL driver. On a
# developer laptop with a display that just works; in CI / containers we wrap
# the run in Xvfb so headed Chromium has a virtual display to render into.
#
# Usage:
#   scripts/run-web-tests.sh                # whole suite, default workers
#   PLAYWRIGHT_WORKERS=4 scripts/run-web-tests.sh
#   scripts/run-web-tests.sh --grep "resident phone"
#   scripts/run-web-tests.sh --shard=1/4    # forwarded to playwright
#
# Any extra args are forwarded verbatim to `playwright test`.
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure the Playwright browsers are present. In the packaged Docker image they
# are pre-installed and this is a fast no-op; on a fresh machine it downloads
# Chromium once. Headed rendering needs the *full* chromium build (not the
# headless shell), so install both.
if [ -z "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" ] && ! npx playwright install --with-deps chromium >/dev/null 2>&1; then
  echo "scripts/run-web-tests.sh: 'playwright install --with-deps chromium' failed." >&2
  echo "Install system deps manually (xvfb, libnss3, libgbm1, ...) and retry." >&2
  exit 1
fi

PLAYWRIGHT_ARGS=("--config" "apps/web/playwright.config.ts" "$@")

if [ -n "${DISPLAY:-}" ]; then
  # A display is already available (local dev, or already inside Xvfb).
  exec npx playwright test "${PLAYWRIGHT_ARGS[@]}"
fi

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "scripts/run-web-tests.sh: no DISPLAY and xvfb-run not found." >&2
  echo "WebGL tests need headed Chromium under Xvfb." >&2
  echo "Install xvfb (apt-get install -y xvfb) or run inside the test Docker image." >&2
  exit 1
fi

# --auto-servernum picks a free display; 1600x1200x24 comfortably fits the
# largest test viewport (1440x900 desktop) with headroom for Chromium chrome.
exec xvfb-run --auto-servernum --server-args="-screen 0 1600x1200x24" \
  npx playwright test "${PLAYWRIGHT_ARGS[@]}"

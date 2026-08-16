# Test image for the MiniCity (pl-town) Playwright + WebGL suite.
#
# Why this exists
# ---------------
# The web tests render a Three.js city, which needs a working WebGL context.
# Headless Chromium cannot create one, so the suite runs headed Chromium under
# Xvfb with the Vulkan/SwiftShader software GL driver. Reproducing that setup
# (Node + npm workspace deps + Playwright browsers + xvfb + GL system libs) on
# every CI runner or agent machine is fragile and slow.
#
# This image bakes all of that in once. CI and other agents then just run:
#
#   docker run --rm -v "$PWD":/work -w /work pl-town-test \
#     scripts/run-web-tests.sh
#
# Build:
#   docker build -f docker/test.Dockerfile -t pl-town-test .
#
# The image intentionally does NOT copy the source: tests change every commit,
# so the source is mounted at run time. Only the slow, stable dependencies
# (system packages, Playwright browsers, npm workspace node_modules) are baked
# in, which is what makes reuse across agents fast.

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# System libs: Xvfb (virtual display for headed Chromium), Chromium runtime
# deps (nss, atk, dbus, etc.), and the Vulkan/SwiftShader software-GL stack.
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb \
      xauth \
      libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
      libxrandr2 libgbm1 libasound2 libatspi2.0-0 libxshmfence1 \
      libgl1 libegl1 libgles2 mesa-vulkan-drivers vulkan-tools \
      fonts-noto-cjk fonts-noto-color-emoji \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work

# Install npm workspace dependencies from the lockfile. We only need the
# package manifests + lockfile here, so the layer caches across source changes.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN npm ci --ignore-scripts

# Install the full Chromium build (WebGL needs it; the headless shell does not)
# plus its system deps, into the cached browsers path.
RUN npx --yes playwright install --with-deps chromium

# Xvfb needs a writable /tmp. We stay as root inside CI containers; --no-sandbox
# is already set in the Playwright config launch args for that environment.

CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1600x1200x24", "bash"]

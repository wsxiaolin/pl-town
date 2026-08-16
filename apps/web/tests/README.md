# Test layout

- `smoke.spec.ts`: user-facing browser smoke coverage.
- `movement.spec.ts`: player movement, touch wheel, and camera orientation.
- `helpers.ts`: shared boot helpers (`seedCityStorage`, `waitForCityBooted`,
  `waitForCityReady`, `RENDER_SETTINGS`) used by both specs. Always go through
  `waitForCityBooted` before clicking UI — it waits for the Three.js scene +
  boot screen to settle, which is required on software-GL runners.
- `unit/`: pure TypeScript domain tests (quest engine, navigation, stats).
- `diagnostics/`: opt-in visual and performance diagnostics; these are not part
  of the default smoke suite.

Server integration tests live alongside the server in `server/tests/` because
they require the server's runtime and dependencies.

## WebGL / headless note

The city is rendered with Three.js / WebGL. Headless Chromium cannot create a
WebGL context, so the suite runs **headed Chromium under Xvfb** with the
SwiftShader (Vulkan/ANGLE) software GL driver. On a machine with a real
display `npm run test:web` works directly; in CI / containers use:

```bash
scripts/run-web-tests.sh                # wraps `playwright test` in xvfb-run
scripts/run-web-tests.sh --shard=1/4    # sharded run (see .github/workflows/test.yml)
PLAYWRIGHT_WORKERS=4 scripts/run-web-tests.sh
```

For a fully packaged, reproducible environment (Node deps + Playwright
Chromium + Xvfb + GL libs pre-baked), build and use the test Docker image:

```bash
docker build -f docker/test.Dockerfile -t pl-town-test .
docker run --rm -v "$PWD":/work -w /work pl-town-test scripts/run-web-tests.sh
```


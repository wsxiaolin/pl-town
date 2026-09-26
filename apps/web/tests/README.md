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
- `pending-construction.spec.ts`: pending buildings, plots, labels, and attached
  interactions stay hidden until construction completes, with header controls
  contained on desktop, mobile landscape, and narrow mobile portrait viewports;
  portrait starts behind the rotation prompt, then rotates to exercise gameplay.
- `pending-initial-policy.spec.ts`: a configuration's newly initial building
  becomes visible even when the matching construction snapshot cannot load.
- `city-map-construction-updates.spec.ts`: an open city map updates its entries
  when construction progress changes.
- `city-map-theme.spec.ts`: an open map refreshes its image at dusk and dawn
  without losing search focus or affecting the main WebGL context.
- `ws-building-errors.spec.ts`: authenticated building rejections use Chinese
  toasts while preserving the existing WebSocket connection and session.
- `pending-label.spec.ts`: global story unlocks cannot reveal pending labels;
  construction completion still respects a subsequent story re-lock.
- `pending-damage.spec.ts`: saved damage survives pending construction and
  unrelated saves; explicit repair keeps hidden buildings repaired when built.
- `pending-task-guidance.spec.ts`: pending story destinations and NPC quest
  offers explain collective construction, then resume normal navigation and
  quest progress when built, at desktop and mobile landscape sizes.
- `city-governance-loading.spec.ts`: in-flight configuration/state reads show
  loading before failure, preserve payment feedback, and retry uncertain receipts.
- `city-governance-errors.spec.ts`: persistent target-labelled failure feedback,
  donation/decoration retries, draft preservation across tab changes and panel
  reopening, and mobile feedback layout.
- `city-governance-session.spec.ts`: concurrent focus, draft continuity,
  queued conflict refreshes, HTTP receipt retry policy, target parameter locking,
  and isolation between login sessions. Successful actions recover focus from
  the modal's temporary fallback unless the resident moved elsewhere; completed
  projects and full areas keep focus on an available control. Uncertain receipts remain in memory for
  the running page and original login token; reload, reauthentication with a new
  token, or disposal ends that retry guarantee. The client does not persist new
  credentials or payment receipts.
- `city-commons.spec.ts`: full-screen voting, resident isolation, retained vote
  records, close/fallback scroll restoration, and repeated-open focus. Vote and
  payment success use separate labelled persistent status regions, present before
  their text is set as required by [WAI ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).
- `city-governance-notices.spec.ts`: concurrent donation retries and votes preserve
  both success messages in either response order, with independent feedback when
  another operation begins. Empty status regions stay accessible and visually collapse.
- `city-voting-compatibility.spec.ts`: independently deployed older servers keep
  donation and area construction usable when the votes read endpoint returns
  404/405. Reopening or explicitly checking voting retries capability detection;
  missing legacy counts stay unknown while explicit zero counts remain visible.
  Transport/server failures and malformed mutation receipts remain errors.
- `city-login-recovery.spec.ts`: a real client disconnect and automatic reconnect
  followed by a rejected hello closes the commons dialog before ordinary login
  or Physics Lab verification; server feedback, credentials, and focus remain usable.
- `city-voting-epoch.spec.ts`: a conflict-triggered public read can observe a
  restored city before reauthentication. A delayed successful vote receipt from
  the previous epoch must not overwrite that state or announce a new success.

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


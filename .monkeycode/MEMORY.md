# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[Project Knowledge Summary]
- Date: 2026-08-13
- Context: Discovered by Agent while deploying MiniCity (pl-town) on the cloud devbox preview environment
- Category: Build & Compilation / Environment Configuration
- Instructions:
  - This devbox has no nginx/systemd/domain; deploy MiniCity with the backend in PRODUCTION mode (`NODE_ENV=production`, `npm run build -w @minicity/server` then `npm start -w @minicity/server`, env HOST=127.0.0.1, ADMIN_USERNAME/ADMIN_PASSWORD, ALLOWED_ORIGINS=`https://<preview-domain>`), frontend `npm run dev -w @minicity/web` on Vite port 5173.
  - The backend dev mode (`tsx watch`) cannot run its backup worker (`src/backupVerifier.js` missing until built), so `node dist/index.js` (production build) is required for automatic backups; startup/interval backups then work.
  - Vite `apps/web/vite.config.ts` must proxy `/town-api`, `/admin/` and `/ws` (with `ws: true`) to `http://127.0.0.1:8787`, plus `allowedHosts: ['.monkeycode-ai.online']`.
  - Start the web with `VITE_SERVER_URL=/ws`; `apps/web/src/network/MultiplayerClient.ts` `serverUrl()` converts a leading `/` value into a same-origin ws(s) URL.
  - After `npm install`, Vite may fail with "Cannot find module @rollup/rollup-linux-x64-gnu" (npm optional-dependency bug). Fix by `npm install @rollup/rollup-linux-x64-gnu@<same-version-as-installed-rollup> --no-save`.
  - Backend admin UI/API live on `/admin/`, verified via the same Vite proxy; health checks `/healthz` and `/readyz` hit the backend on 127.0.0.1:8787.
  - Origin validation is strict: in production, browser requests (admin login and WebSocket) are rejected unless the origin is in `ALLOWED_ORIGINS`. Preview-domain access requires `ALLOWED_ORIGINS=https://<preview-domain>` (set the exact `*.monkeycode-ai.online` preview URL), otherwise the backend appears "down/offline" with 403 on admin login. Wrong credentials return 401.
  - Backend supports multiple administrators: the primary account comes from `ADMIN_USERNAME`/`ADMIN_PASSWORD`, additional accounts come from `ADMIN_ACCOUNTS_JSON` (JSON object mapping username to password, each password >= 16 chars).
- Date: 2026-08-16
- Context: Discovered by Agent while converting lab_outer into a memorial monument, then debugging why the app would not boot (`Cannot access 'clamp' before initialization`)
- Category: Troubleshooting & Debugging
- Instructions:
  - In `apps/web/src/city/MiniCityApp.ts` (a `@ts-nocheck` monolith), module-top-level `const roadNavigation = createRoadNavigationSystem({...})` and its destructured helpers (`clamp`, `buildRoadPath`, `nearestRoadCoord`, `FOUNTAIN_CLEAR`, etc.) MUST be declared BEFORE any module-top-level call that references them in an object literal (e.g. `createEventBindings({..., clamp, ...})`), otherwise a TDZ `Cannot access ... before initialization` error is thrown at load and the whole city fails to boot.
  - This ordering was wrong on `origin/main`; the fix moved the `roadNavigation` block above `createBuildingInteraction`/`createEventBindings`.
  - Headless Playwright (chromium headless shell) needs `npx playwright install chromium --with-deps`; without it, `browserType.launch` fails on the missing headless shell binary.

[Project Knowledge Summary]
- Date: 2026-08-17
- Context: Discovered by Agent while reworking the NPC edit-request page into the frontend multi-page app per review feedback
- Category: Operations & Deployment
- Instructions:
  - The web app and server are intended to be deployed on the same server eventually; GitHub Pages / `BASE_PATH` is not the production target to design around.
  - The NPC edit-request page lives in `apps/web` as a Vite MPA entry (`index.html` + `npc-edit-request.html` built together); the server exposes only the `/town-api` endpoints and the admin console, with no hand-written duplicate of the page.

[User Instruction Summary]
- Date: 2026-08-18
- Context: Debugging CI and building interaction behavior
- Instructions:
  - Before changing workflow or application behavior, inspect the actual failure logs and confirm the root cause.
  - Keep unrelated configuration unchanged and avoid speculative fixes.

[Project Knowledge Summary]
- Date: 2026-08-20
- Context: Discovered by Agent while pushing branch `260819-feat-texture-rendering-weather` and creating PR for pl-town
- Category: Environment Configuration
- Instructions:
  - GitHub repository `wsxiaolin/pl-town` is cloned via HTTPS, but the default git credential helper (`/app/agent/bin/agent git-credential-helper`) returns HTTP 500 for any host and cannot provide GitHub credentials.
  - To push or create PRs, authenticate via GitHub CLI device flow: run `gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key` in a background terminal, read the one-time code from the log, have the user complete the browser flow, then run `gh auth setup-git`.
  - Git identity for this repo: `user.name=wsxiaolin`, `user.email=xiegushi2022@outlook.com` (set locally in the repo).
  - PR for the texture/weather branch is https://github.com/wsxiaolin/pl-town/pull/100.

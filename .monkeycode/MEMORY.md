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

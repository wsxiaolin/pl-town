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
- Date: 2026-08-16
- Context: Discovered by Agent while converting lab_outer into a memorial monument, then debugging why the app would not boot (`Cannot access 'clamp' before initialization`)
- Category: Troubleshooting & Debugging
- Instructions:
  - In `apps/web/src/city/MiniCityApp.ts` (a `@ts-nocheck` monolith), module-top-level `const roadNavigation = createRoadNavigationSystem({...})` and its destructured helpers (`clamp`, `buildRoadPath`, `nearestRoadCoord`, `FOUNTAIN_CLEAR`, etc.) MUST be declared BEFORE any module-top-level call that references them in an object literal (e.g. `createEventBindings({..., clamp, ...})`), otherwise a TDZ `Cannot access ... before initialization` error is thrown at load and the whole city fails to boot.
  - This ordering was wrong on `origin/main`; the fix moved the `roadNavigation` block above `createBuildingInteraction`/`createEventBindings`.
  - Headless Playwright (chromium headless shell) needs `npx playwright install chromium --with-deps`; without it, `browserType.launch` fails on the missing headless shell binary.

[Project Knowledge Summary]
- Date: 2026-08-17
- Context: Discovered by Agent while validating the NPC edit request workflow
- Category: Environment Configuration
- Instructions:
  - This checkout currently has no `node_modules`; run the dependency installation matching the committed lockfile before `npm run typecheck`, Vite builds, server builds, or Playwright tests. Without dependencies, typechecking stops with `tsc: not found`.

[Project Knowledge Summary]
- Date: 2026-08-17
- Context: Discovered by Agent while reworking the NPC edit-request page into the frontend multi-page app per review feedback
- Category: Operations & Deployment
- Instructions:
  - The web app and server are intended to be deployed on the same server eventually; GitHub Pages / `BASE_PATH` is not the production target to design around.
  - The NPC edit-request page lives in `apps/web` as a Vite MPA entry (`index.html` + `npc-edit-request.html` built together); the server exposes only the `/town-api` endpoints and the admin console, with no hand-written duplicate of the page.

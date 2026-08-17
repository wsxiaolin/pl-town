# Conclusion — Resolves #51: Reduce savepoints for the "Echo" quest

## Problem

Issue #51 asked to reduce the savepoints (存档点) of the "Echo" (回声) main
story to **under 20**, **without changing the story content**.

Before this change, every node in the story graph acted as a savepoint: the
`StoryRuntime` persisted the current `nodeId` to storage on every choice, so a
player reloading would resume at whatever node they last reached. The Echo
story (`apps/web/src/gameplay/content/stories/echo/echoStory.ts`) had
**53 nodes**, so there were 53 distinct savepoints — far above 20.

## Approach

Instead of deleting or merging story beats (which would remove or compress the
player-visible text/images the issue explicitly forbids changing), a
**checkpoint mechanism** was added to the story runtime. Linear, transitional,
and purely-cosmetic beats are marked `savepoint: false`; reaching them still
advances the live node so the player sees the exact same dialogue/CG/document
content, but the persisted resumption point stays at the last **savepoint**
node. Flags, endings, visit counts and guide state still persist on every
transition, so condition-gated progress (e.g. `echo.stonesInvestigated`,
`echo.diaryInvestigated`) survives a reload. On reload the player resumes at the
last checkpoint and replays the short transient beats forward — standard
checkpoint behaviour.

No story text, images, choices, branches, interactions, guides, achievements or
events were removed or altered. The node graph is unchanged (still 53 nodes);
only which of them act as persisted resumption points changed.

## Files modified

1. `apps/web/src/gameplay/stories/types.ts`
   - Added an optional `savepoint?: boolean` field to `StoryNode` (defaults to
     `true`, so all existing stories keep their current behaviour).

2. `apps/web/src/gameplay/stories/StoryRuntime.ts`
   - `StoryRuntime` now keeps an in-memory `liveNodeId` so the currently-viewed
     node can diverge from the persisted resumption node.
   - `choose()` persists the target `nodeId` only when the target is a
     savepoint (`savepoint !== false`); for transient beats it persists flags
     and the rest of the state but keeps the previous savepoint as the
     resumption node, and advances the live node for immediate display.
   - `publish()` now persists against the persisted resumption node (not the
     live transient node) so external events never silently move the
     savepoint.
   - `state()` returns the live node when the player is mid-chain, falling back
     to the persisted savepoint on a fresh load.
   - Transient-beat persistence reads the repository's current savepoint
     `nodeId` (not the live node) so a chain of consecutive transient beats
     never drifts the resumption point forward — it stays pinned to the last
     savepoint until a savepoint is reached.

3. `apps/web/src/gameplay/content/stories/echo/echoStory.ts`
   - Bumped `definitionVersion` from `11` to `12`.
   - Marked **34** transitional/cosmetic beats with `savepoint: false`,
     leaving exactly **19 savepoints** (< 20):
     `meeting`, `request`, `act-one-complete`, `cracks-start`,
     `third-act-complete`, `fourth-act-complete`, `cabin-active`, `fifth-hub`,
     `photo-wall-investigation`, `diary-investigation`, `confrontation`,
     `forgotten-ending`, `forgotten-complete`, `loop-blackout`,
     `loop-complete`, `truth-memory`, `truth-ending`, `truth-complete`,
     `epilogue-complete`.
   - All branch points, act transitions, distinct-image CGs, document beats
     and the four ending completion nodes (which gate achievement restoration
     on reload) are kept as savepoints; only linear/cosmetic beats and a few
     pre-branch hubs (`confrontation-active`, `archive-active`,
     `truth-question`, `abandon-confirm`) are transient — resuming one step
     back from them on reload is harmless because their gating flags persist.
   - No story text, images, choices, branches, interactions, guides,
     achievements or events were removed or altered. The node graph is
     unchanged (still 53 nodes); only which of them act as persisted
     resumption points changed.

4. `apps/server/src/storyCatalog.ts`
   - Synced the server-side mirror's `definitionVersion` to `12` and updated
     the sync comment, so the admin story topology page keeps reporting the
     correct version.

5. `apps/web/tests/unit/storyRuntime.test.ts`
   - Added a checkpoint-behaviour test asserting that: entering a transient
     beat advances the live node but does not overwrite the persisted
     savepoint; flags set before/during a transient beat still persist; and
     reaching a subsequent savepoint updates the persisted resumption node.
   - Added a chained-transient-beat test asserting that a sequence of
     consecutive transient beats keeps the resumption node pinned to the last
     savepoint until a savepoint is reached.

## Verification

- `npm run check:source-size` — passed (no logic file exceeds size limits).
- `npm run typecheck` — passed (frontend + server, strict).
- `npm run build` — passed (frontend Vite build + server tsc build).
- `npm run test:domain` — passed (all unit suites, including the new
  checkpoint assertions in `storyRuntime.test.ts`).
- `npm run test:server` — passed (integration + restore suites, including the
  admin story-topology assertions).
- Echo savepoint count verified programmatically: **19 savepoints** (down from
  53), with all 53 nodes and their content intact.

Browser/Playwright tests (`npm run test:web`) were not run, because the change
does not touch browser interaction, layout, WebGL or any end-to-end flow — it
only changes story persistence semantics and adds node metadata. The
environment cannot start a headed Chromium session for WebGL here; this is
recorded per the AGENTS.md guidance instead of failing the run.

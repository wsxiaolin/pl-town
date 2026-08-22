# Frontend source layout

- `main.ts`: browser entry point and lifecycle wiring.
- `city/`: city domain, configuration, NPCs, and gameplay orchestration.
- `gameplay/`: strict, framework-free gameplay rules and declarative content.
- `adapters/`: browser, storage, rendering, and transport implementations of gameplay ports.
- `rendering/`: Three.js scene construction and render settings.
- `core/`: reusable rendering/runtime primitives.
- `network/`: multiplayer transport client.
- `styles/`: the single CSS entry point imported by the application.
- `assets/`: runtime media assets (models and textures).

Keep dependencies directed toward the domain: rendering may consume city data,
while data modules should not depend on UI or networking.

New narrative, quest, inventory, puzzle, achievement, and unlock rules belong in
`gameplay/`. The legacy `city/MiniCityApp.ts` remains the composition root while
its existing responsibilities are migrated incrementally.

## Current runtime split

- `city/MiniCityApp.ts`: composition root; startup, teardown, frame scheduling, and compatibility wrappers only. Echo orchestration lives in `city/echo/echoStoryController.ts`; map, camera/player, progression, login, and stats adapters live in their dedicated modules.
- `city/navigation/` and `city/npcSystem.ts`: pure-ish navigation and NPC runtime services kept behind narrow adapters.
- `city/navigation/interiorNavigation.ts`: feature-neutral interior walk bounds, obstacle discovery, and pathfinding shared by narrative scenes.
- `city/progression/`: legacy `minicityStats` compatibility and time-tracking boundary.
- `rendering/buildingMeshFactory.ts`: building shape catalog; `proceduralTextureLibrary.ts`: canvas textures; `worldDecorations.ts`: trees, lamps, houses, ponds, and street props.
- `adapters/ui/cityDialogController.ts`: building/NPC dialog DOM; `communityPanelController.ts`: Physics Lab panels; `multiplayerHousingController.ts`: WebSocket presence and housing UI.

## Ice King feature split

- `gameplay/content/stories/iceKing/`: stable IDs, item/reward/achievement metadata, sanctum dialogue, and Cat Death caption cues.
- `city/iceKing/`: feature composition, narrow ports, StoryRuntime coordination, building registration, and ice-wall interaction.
- `city/buildingFeatures/`: generic building-feature registry; it has no knowledge of Ice King IDs.
- `rendering/iceKing/`: the sanctum scene, ice-wall mesh, crown texture painter, and Canvas-only Cat Death frame renderer.
- `adapters/ui/iceKing/`: sanctum cinematic DOM/camera presentation plus Cat Death playback and blackout controllers.
- `adapters/storage/iceKing/`: resident-scoped StoryRepository implementation, legacy ending migration, and pending reward checkpoints.

The city coordinator consumes narrow scene, presentation, and progress ports. Ice King content must not read DOM, Three.js, networking, or browser storage directly.

Configuration under `city/data/` and `gameplay/content/` is intentionally exempt
from the logic-file size limit. Runtime logic is checked by
`npm run check:source-size`: normal files must stay under 1,000 lines and the
`MiniCityApp.ts` must stay under 1,000 lines. The check runs as part
of the root `typecheck` and `build` scripts.

For domain-only changes, use `npm run test:domain`; use Playwright only when the
browser, WebGL, layout, or end-to-end behavior is in scope.

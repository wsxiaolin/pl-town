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

- `city/MiniCityApp.ts`: transitional composition root; startup, teardown, frame scheduling, and compatibility wrappers only.
- `city/navigation/` and `city/npcSystem.ts`: pure-ish navigation and NPC runtime services kept behind narrow adapters.
- `city/progression/`: legacy `minicityStats` compatibility and time-tracking boundary.
- `rendering/buildingMeshFactory.ts`: building shape catalog; `proceduralTextureLibrary.ts`: canvas textures; `worldDecorations.ts`: trees, lamps, houses, ponds, and street props.
- `adapters/ui/cityDialogController.ts`: building/NPC dialog DOM; `communityPanelController.ts`: Physics Lab panels; `multiplayerHousingController.ts`: WebSocket presence and housing UI.

Configuration under `city/data/` and `gameplay/content/` is intentionally exempt
from the logic-file size limit. Runtime logic is checked by
`npm run check:source-size`: normal files must stay under 1,000 lines and the
transitional `MiniCityApp.ts` must stay under 2,000 lines. The check runs as part
of the root `typecheck` and `build` scripts.

For domain-only changes, use `npm run test:domain`; use Playwright only when the
browser, WebGL, layout, or end-to-end behavior is in scope.

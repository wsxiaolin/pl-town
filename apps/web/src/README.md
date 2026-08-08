# Frontend source layout

- `main.ts`: browser entry point and lifecycle wiring.
- `city/`: city domain, configuration, NPCs, and gameplay orchestration.
- `rendering/`: Three.js scene construction and render settings.
- `core/`: reusable rendering/runtime primitives.
- `network/`: multiplayer transport client.
- `styles/`: the single CSS entry point imported by the application.
- `assets/`: runtime media assets (models and textures).

Keep dependencies directed toward the domain: rendering may consume city data,
while data modules should not depend on UI or networking.

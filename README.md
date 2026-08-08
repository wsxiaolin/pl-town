# MiniCity

MiniCity is split into independent web and server applications, managed from a
small npm workspace at the repository root.

## Layout

```text
apps/
  web/       Vite + Three.js frontend
  server/    Node.js HTTP/WebSocket backend
package.json workspace commands only
```

Runtime data is stored in `apps/server/data/` and is ignored by Git.

## Start everything

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`; the backend and WebSocket server
run at `http://localhost:8787`. `Ctrl+C` stops both processes.

## Commands

```bash
npm run build
npm run typecheck
npm test
npm run test:web
npm run test:server
```

Run one application directly with `npm run dev -w @minicity/web` or
`npm run dev -w @minicity/server`.

Set `VITE_SERVER_URL` for a non-default WebSocket endpoint. Server environment
variables are `HOST`, `PORT`, and `DATA_DIR`.

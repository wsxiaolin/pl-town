# MiniCity

MiniCity is split into independent web and server applications, managed from a
small npm workspace at the repository root

## Layout

```text
apps/
  web/       Vite + Three.js frontend
  server/    Node.js HTTP/WebSocket backend （with sqlite）
package.json workspace commands only
```

Runtime data uses `DATA_DIR` (the default is `data/` relative to the server
working directory) and is ignored by Git.

## Start everything

Use Node.js 22. With [Pixi](https://pixi.sh), the project provides an isolated
Node.js 22 environment (including npm) on Windows, Linux, and macOS:

```bash
pixi run setup
pixi run dev
```

Pixi manages the Node.js runtime through `pixi.toml` and `pixi.lock`; npm still
manages JavaScript dependencies through `package-lock.json`. Commit both lockfiles;
the generated `.pixi/` environment is ignored. Use `pixi run typecheck`,
`pixi run build`, `pixi run test-domain`, or `pixi run test-server` for validation.
For other npm commands, use `pixi run npm ...`. Browser tests still require the
Playwright browser and platform libraries described in `AGENTS.md`.

If installation previously failed under Node.js 24, stop any project processes
that hold files in `node_modules`, then run `pixi run setup` to reinstall from
the npm lockfile using Node.js 22. An `EPERM` error indicates a file access or
locking problem that changing the runtime may not resolve.

Alternatively, with Node.js 22 already installed:

```bash
npm ci
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

控制台调试命令见 [docs/console-debug-api.md](docs/console-debug-api.md)。

Set `VITE_SERVER_URL` for a non-default WebSocket endpoint. The server includes
a light administration UI at `/admin/`, verified automatic SQLite backups, and
an offline restore command. See [server documentation](apps/server/README.md),
[security notes](docs/security.md), and the
[beginner Linux cloud deployment guide](docs/deployment.md). Render is only
documented as a temporary, non-persistent test environment.

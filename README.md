# MiniCity

MiniCity is split into independent web and server applications, managed from a
small npm workspace at the repository root

## 黑洞年份镇（本副本核心内容 · Blackhole Year Towns）

本副本在 MiniCity 基础上新增「黑洞年份群岛」：把社区历年代表内容重新抽象为 106 座城市纪念设施，分布于两座大城与一座起源村，以**跨海大桥 + 磁悬浮环线**与主城互联。设施名、纪念导语和名录均为离线静态数据，**零实时 API 依赖**。

### 启动

需要 Node.js 22（一条命令同时起前端与后端）：

```bash
npm ci
npm run dev
```

- 前端（3D 世界）：`http://localhost:5173`
- 后端（登录/多人/SQLite）：`http://localhost:8787` —— 年份镇内容本身不依赖后端
- `Ctrl+C` 停止；也可用上游 Pixi 流程 `pixi run setup && pixi run dev`（自带隔离 Node 22）

### 玩法速览

1. **乘车环游**：找到任一车站站牌交互 → 弹出 10 站目的地面板 → 选站发车。跨海大桥线（星门站 ⇆ 起源村·桥站）连通主城与首镇；磁悬浮环线（起源村·环线站 ↔ 2020–2026 七镇）串起群岛。
2. **看设施**：走近建筑看铭牌 →「走近看看」打开纪念设施面板，阅读设施名、设施族和纪念导语；少数设施提供盖章、点灯、留言或封存动作。
3. **翻阅名录**：七座年份纪念名录与起源村**千作总目塔**收录全部 106 座设施，支持设施名、导语与设施族检索，每页 20 座。
4. **闲逛**：8 个年份片区共 18 名主题 NPC 分布在主街、广场与街廓之间；城市全景海图标出各片区位置。

### 8 镇一览（115 座结构 = 106 座纪念设施 + 7 座纪念名录 + 千作总目塔 + 起源村界碑）

| 年份 | 镇名 | 纪念设施 |
|---|---|---|
| 2019 | 起源村 | 2 |
| 2020 | 启明镇 | 10 |
| 2021 | 潮声镇 | 16 |
| 2022 | 盛夏镇 | 20 |
| 2023 | 回响镇 | 18 |
| 2024 | 微光镇 | 16 |
| 2025 | 长风镇 | 12 |
| 2026 | 星港 | 12 |

每座设施均经过城市语义改写并逐栋手写落位。年份群岛只呈现纪念设施，不携带作品原文、评论、热度或浏览量。

### 数据与再生成

- 运行时静态数据为 `gen-buildings.ts` 与 `gen-index.ts`：前者固化 115 座结构，后者收录 106 座纪念设施。两份生成物随仓库提交。
- 生成器 `scripts/generate_town_buildings.mjs`（确定性、幂等，`--check` 逐字节复核）。需要从原始数据重生成时：`node scripts/generate_town_buildings.mjs --data-dir=<含 blackhole_top1000.json 与 blackhole_details.json 的目录>`（默认取仓库同级 `../data`）。
- 服务端世界图镜像：`apps/server/src/data/yearTownCatalog.ts`；生成报告：`docs/year-towns-gen-report.md`。

### 已知限制

- 年份群岛纪念设施不提供社区作品原文和评论浏览；设施名录用于城市纪念与空间导览。
- **dev 模式备份 worker**：`npm run dev`（tsx 源码态）下 server 启动备份报 `Cannot find module .../src/backupVerifier.js`（上游缺陷：Worker 以 .js 路径引用、src 下无编译产物）；构建后 `node apps/server/dist/index.js` 运行正常，备份功能完好。
- 未配置 `BIGMODEL_API_KEY` 时聊天内容审核自动禁用（上游行为，启动时 WARN 一条）。

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

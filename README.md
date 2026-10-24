# MiniCity

MiniCity is split into independent web and server applications, managed from a
small npm workspace at the repository root

## 黑洞年份镇（本副本核心内容 · Blackhole Year Towns）

本副本在 MiniCity 基础上新增「黑洞区千作·年份远城镇群」：把物理实验室 AR 社区**黑洞区历史热门 Top1000 作品**按年份落地为 8 座离岸年份城镇，以**跨海大桥 + 磁悬浮环线**与主城互联。全部作品数据（正文全文 + 评论精选）编译为离线静态模块，**零实时 API 依赖**。

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
2. **看作品**：走近建筑看铭牌 → 对话 →「阅读正文」打开详情抽屉（标题/作者/年份/热度/正文/评论精选）。超长正文先出 2000 字节选，「展开全文」懒加载全文包。
3. **检索 1000 作**：每镇 1 座档案馆（起源村除外）+ 起源村**千作总目塔**——目录抽屉支持关键词检索、50 条/页分页，点条目直达详情。
4. **闲逛**：8 镇共 18 名主题 NPC 出没于迎宾带与大街两侧；城市全景海图上标有 8 镇位置。

### 8 镇一览（115 座结构 = 106 作品主题建筑 + 7 档案馆 + 千作总目塔 + 起源村界碑）

| 年份 | 镇名 | 馆藏作品 |
|---|---|---|
| 2019 | 起源村 | 2 |
| 2020 | 启明镇 | 75 |
| 2021 | 潮声镇 | 147 |
| 2022 | 盛夏镇 | 217 |
| 2023 | 回响镇 | 202 |
| 2024 | 微光镇 | 170 |
| 2025 | 长风镇 | 128 |
| 2026 | 星港 | 59 |

主题建筑承载各镇最高热度作品（铭牌即详情）；其余 894 条经档案馆/总目塔目录直达，**1000 条全部可读**。

### 数据与再生成

- 作品内容全部内置于 `apps/web/src/city/data/year-towns/gen-*.ts`（40 个生成模块：1000 条铭牌索引、D 级详情、超长正文外置包 `gen-b*`、评论分页包 `gen-c*`）。**随包附带，开箱即用。**
- 生成器 `scripts/generate_town_buildings.mjs`（确定性、幂等，`--check` 逐字节复核）。需要从原始数据重生成时：`node scripts/generate_town_buildings.mjs --data-dir=<含 blackhole_top1000.json 与 blackhole_details.json 的目录>`（默认取仓库同级 `../data`）。
- 服务端世界图镜像：`apps/server/src/data/yearTownCatalog.ts`；生成报告：`docs/year-towns-gen-report.md`。

### 已知限制

- **评论采样**：采集口径每作品上限 200 条——421 部多评论作品仅收录最新 200 条，面板如实标注「仅展示最新 N 条 / 共 totalComments 条」；另有 12 部作品评论计数与服务端统计存在小偏差（面板一律按实际收录数显示）。
- **rank 344《电学实验的问号》**：评论区被服务端 403 锁定，面板以「评论区已锁定」占位（正文 682 字完好）。
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

# Render 部署指南

本项目在 Render 上建议使用两个服务：

- 后端创建为 `Web Service`
- 前端创建为 `Static Site`

## 后端 Web Service

配置：

```text
Root Directory: 留空
Build Command: npm ci --include=dev && npm run build -w @minicity/server
Start Command: npm run start -w @minicity/server
Health Check Path: /healthz
```

项目根目录的 `package.json` 将 Node.js 固定为 `22.x`。不要把 `PORT` 写死，Render 会自动注入端口；`HOST` 可以设置为 `0.0.0.0`。

不要手动设置 `NODE_ENV=production` 作为构建环境变量。它会让 npm 跳过 TypeScript 和 `@types/*` 等开发依赖。若已经设置，删除它；`--include=dev` 会确保构建依赖被安装。

部署后检查：

```text
https://<backend-name>.onrender.com/healthz
```

预期返回 `{"ok":true,"online":0}`。如果页面显示 `Service is waking up`，先检查 Render 的部署状态和日志；持续显示通常意味着构建或启动失败。

## 前端 Static Site

配置：

```text
Root Directory: 留空
Build Command: npm ci --include=dev && npm install --no-save @rollup/rollup-linux-x64-gnu@4.62.4 && npm run build -w @minicity/web
Publish Directory: apps/web/dist
```

`@rollup/rollup-linux-x64-gnu` 是 Linux 构建所需的 Rollup 原生可选包。当前锁文件由 Windows 环境生成，若 Render 报缺少该模块，使用上面的构建命令并执行 `Clear build cache & deploy`。

添加构建环境变量：

```text
VITE_SERVER_URL=wss://<backend-name>.onrender.com
BASE_PATH=/
```

访问前端 Static Site 的 URL，而不是后端 URL。后端根路径目前只提供 API 和 WebSocket，因此访问后端 `/` 返回 404 是正常的。

## `/town-api` Rewrite

在 Static Site 的 `Redirects/Rewrites` 中添加：

```text
Source: /town-api/*
Destination: https://<backend-name>.onrender.com/town-api/*
Action: Rewrite
```

使用 `Rewrite`，不要使用 `Redirect`。这样浏览器继续以相对路径访问 API。

## 数据持久化

免费 Web Service 的本地文件系统是临时的。休眠、重启或重新部署都可能清除 SQLite 数据；Uptime Bot 只能减少因闲置 15 分钟导致的休眠，不能保证数据不丢失。

需要长期保存数据时，将后端升级为支持磁盘的付费实例，并添加 Persistent Disk：

```text
Mount Path: /var/data
DATA_DIR=/var/data
LOG_DIR=/var/data/logs
```

数据库会写入 `/var/data/minicity.sqlite`。挂载磁盘会触发重新部署，当前免费实例里的临时数据不会自动迁移；正式启用前应先准备导出或接受测试数据清空。

## Uptime Bot

短期演示可以每 10 分钟发送一次：

```text
GET https://<backend-name>.onrender.com/healthz
```

这只能防止一部分空闲休眠，不能防止平台重启、重新部署或文件系统清理。不要把它当作数据库备份或持久化方案。

## 常见构建错误

### `better-sqlite3` 与 Node 26 不兼容

确保根 `package.json` 为：

```json
"engines": { "node": "22.x" }
```

然后清理 Render 构建缓存重新部署。

### 找不到 `node` 或 `ws` 类型

确认 Build Command 包含 `npm ci --include=dev`，并删除手动设置的 `NODE_ENV=production`。

### 找不到 `@rollup/rollup-linux-x64-gnu`

使用前端构建命令中的显式 `npm install --no-save`，然后执行 `Clear build cache & deploy`。

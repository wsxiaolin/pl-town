# MiniCity Server

Node.js + TypeScript 单实例 HTTP/WebSocket 服务，使用 SQLite 持久化居民身份、位置、云进度、剧情和住房。服务同时提供 `/town-api` Physics Lab 代理、`/admin/` 管理后台、自动在线备份和停服恢复命令。

## 本地运行

需要 Node.js 20 或更高版本；仓库生产基线为 Node.js 22。

```bash
npm install
npm run dev -w @minicity/server
```

默认监听 `http://0.0.0.0:8787`。`GET /healthz` 是存活检查，`GET /readyz` 会查询 SQLite。首次本地运行不要求管理员凭据；配置 `ADMIN_USERNAME` 和至少 16 字符的 `ADMIN_PASSWORD` 后，访问 `http://localhost:8787/admin/`。需要多个管理员账号时，可另设 `ADMIN_ACCOUNTS_JSON='{"operator2":"至少 16 字符的密码"}'`；它会与原单账号配置合并。

## 构建与测试

```bash
npm run typecheck -w @minicity/server
npm run build -w @minicity/server
npm run test:integration -w @minicity/server
npm run start -w @minicity/server
```

集成测试覆盖认证、Origin/CSRF、恶意 WebSocket 消息、云进度、住房、管理员操作、在线备份与重新校验、活动服务恢复拒绝、停服恢复和会话撤销。

## 配置

完整生产模板见根目录 `.env.production.example`。主要配置：

- 监听与存储：`HOST`、`PORT`、`DATA_DIR`、`LOG_DIR`、`BACKUP_DIR`。
- 浏览器边界：`ALLOWED_ORIGINS`、`TRUST_PROXY_HOPS`、`ALLOW_ORIGINLESS_WEBSOCKET`。
- 管理员：`ADMIN_USERNAME`、`ADMIN_PASSWORD`、`ADMIN_ACCOUNTS_JSON`（用户名到密码的 JSON 对象）、`ADMIN_SESSION_TTL_MINUTES`。
- 会话/连接：`SESSION_TTL_DAYS`、`MAX_CONNECTIONS`、`MAX_CONNECTIONS_PER_IP`。
- 备份：`AUTO_BACKUP_ENABLED`、`BACKUP_ON_START`、`BACKUP_INTERVAL_MINUTES`、`BACKUP_RETENTION_DAYS`、`BACKUP_MAX_FILES`。

`NODE_ENV=production` 时缺少管理员凭据或 `ALLOWED_ORIGINS` 会直接拒绝启动。生产部署只应监听反向代理可达的回环地址。

## 管理与备份

后台提供：运行/数据库概览、居民搜索与封禁、住房名称和成员管理、住房删除、剧情节点查看、聊天审核、审计日志、WAL 检查点、创建/下载/重新验证备份。所有写操作要求管理员 Cookie、精确 Origin 和 CSRF Token；没有任意 SQL 接口。

备份通过 SQLite Online Backup API 生成 `.partial`，在 worker 中执行完整性检查、外键检查和流式 SHA-256，通过后原子重命名并写入 `manifest.json`。默认每天备份，保留 30 天且最多 30 个文件。

恢复必须先停服：

```bash
npm run db:restore -w @minicity/server -- <backup-file> <expected-sha256> --confirm
```

恢复会先创建恢复前备份，并撤销所有居民会话。完整生产步骤见 [deployment.md](../../docs/deployment.md)，安全边界见 [security.md](../../docs/security.md)。

## 架构约束

- 单进程、单实例；在线状态、管理员/Physics Lab 会话和限流在内存中。
- 位置立即广播，每秒批量写 SQLite；聊天不持久化。
- 服务端校验位置范围、消息大小/频率、住房关系、商品/奖励和可验证成就奖励。
- 住宅 ID 格式为 `residence:x.xx:z.xx`；当前尚无服务端静态地图白名单，详见安全说明。

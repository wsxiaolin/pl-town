# Render 临时测试部署

Render 免费计划没有持久磁盘，重启或重新部署会清空 SQLite。本仓库用阿里云 OSS 做异地快照：部署前由 GitHub Actions 把线上库上传到 OSS，新实例启动时若本地没有居民数据就拉最新快照恢复；进程收到 SIGTERM 时再补传一份。正式长期部署见 [零基础云服务器部署指南](./deployment.md)。

## 后端测试服务

创建一个 Node Web Service：

```text
Build Command: npm ci --include=dev && npm run build -w @minicity/server
Start Command: npm run start -w @minicity/server
Health Check Path: /readyz
```

设置：

```text
NODE_ENV=production
HOST=0.0.0.0
ADMIN_USERNAME=<测试管理员>
ADMIN_PASSWORD=<至少 16 字符的随机测试密码>
ALLOWED_ORIGINS=https://<测试前端域名>,https://*.pl-town.pages.dev
TRUST_PROXY_HOPS=1
AUTO_BACKUP_ENABLED=false
OSS_ENABLED=true
OSS_REGION=oss-cn-hongkong
OSS_BUCKET=<备份桶>
OSS_ACCESS_KEY_ID=<RAM AccessKeyId>
OSS_ACCESS_KEY_SECRET=<RAM AccessKeySecret>
OSS_PREFIX=minicity/render-backups/
OSS_SECURE=true
OSS_RESTORE_ON_EMPTY_START=true
OSS_UPLOAD_ON_SHUTDOWN=true
DEPLOY_SNAPSHOT_TOKEN=<至少 32 字符的随机令牌>
```

`NODE_ENV=production` 时服务启动前会强制校验：`ALLOWED_ORIGINS` 至少一项、`ADMIN_PASSWORD` 至少 16 字符，任一缺失服务直接拒绝启动。Render 会自动注入 `PORT` 环境变量，服务按其监听，无需手动设置。需要多个测试管理员时，可另设 `ADMIN_ACCOUNTS_JSON='{"operator2":"至少 16 字符的密码"}'`。

聊天内容安全审核是可选能力：配置 `BIGMODEL_API_KEY=<测试用智谱 API Key>` 后，公开聊天会在后台调用智谱审核；不配置时服务正常启动，聊天消息保持未审核状态，启动日志会输出审核停用的告警。测试部署可按需省略该 Key。

生产模式下 `ALLOW_ORIGINLESS_WEBSOCKET` 默认关闭，浏览器直连 `wss://<后端域名>` 会携带前端 Origin，只要该 Origin 在 `ALLOWED_ORIGINS` 中即可正常建立 WebSocket。与后端同源的请求（例如托管在后端自身的 `/admin/` 管理面板）始终放行，无需把后端域名加入 `ALLOWED_ORIGINS`。

不要设置 `DATA_DIR` 到所谓长期路径。Render 默认文件系统是临时的，SQLite 只在当前实例存活期间有效。居民、住房和剧情数据靠 OSS 快照跨部署保留：

1. GitHub Actions `snapshot-offsite.yml` 在推送到 `main`（服务端相关路径）或手动触发时，向线上 `POST /internal/deploy/snapshot`，把当前库上传到 OSS。
2. 新实例启动时，若本地 `users` 表为空，则下载 OSS 上最新一份已校验备份并恢复后再监听端口。
3. 旧实例收到 SIGTERM 时再创建并上传一份关机快照，作为 Actions 与健康检查超时之间的兜底。

建议关闭 Render 自动部署，把 Deploy Hook URL 配进 GitHub secret `RENDER_DEPLOY_HOOK_URL`，让快照成功后再触发部署，避免新实例在快照完成前抢先启动。同时配置：

```text
RENDER_SNAPSHOT_URL=https://pl-town.onrender.com
DEPLOY_SNAPSHOT_TOKEN=<与 Render 环境变量相同的令牌>
RENDER_DEPLOY_HOOK_URL=<Render Deploy Hook，可选>
```

`DEPLOY_SNAPSHOT_TOKEN` 至少 32 字符，只用于 CI；不要把它写进仓库。空库会返回 HTTP 409，工作流按跳过处理，不会覆盖 OSS 上已有快照。首次部署没有远端备份时，服务以空库启动。测试账号和密码不得与生产复用。

Render 的负载均衡器终止 TLS 并将请求转发给服务；其官方安全说明建议应用从 `X-Forwarded-For` 读取真实客户端 IP。因此此单层测试拓扑设置 `TRUST_PROXY_HOPS=1`。[Render Web Services](https://render.com/docs/web-services) [Render DDoS guidance](https://render.com/articles/how-render-handles-ddos-attacks)

注意：服务只信任 `TRUSTED_PROXIES`（默认 `127.0.0.1,::1`）转发的 `X-Forwarded-For`。Render 负载均衡器的来源地址不在回环段，因此默认配置下伪造的 `X-Forwarded-For` 会被忽略，所有请求会按负载均衡器 IP 聚合计入每 IP 限流——对测试部署而言这是更安全的取舍。若 Render 公布了固定的转发网段，可显式设置 `TRUSTED_PROXIES=<网段>` 恢复按真实 IP 限流。

## 前端测试站点

```text
Build Command: npm ci --include=dev && npm run build -w @minicity/web
Publish Directory: apps/web/dist
VITE_SERVER_URL=wss://<后端域名>
BASE_PATH=/
```

在 Static Site 中把 `/town-api/*` Rewrite 到后端同路径。`ALLOWED_ORIGINS` 支持逗号分隔的多个来源；Cloudflare Pages 分支预览可使用 `https://*.pl-town.pages.dev`，它匹配一层子域，例如 `https://abc.pl-town.pages.dev`。配置值只写 Origin，不包含路径。

Cloudflare Pages 的 Production 与 Preview 环境变量互相独立。当 Preview 环境未设置 `VITE_SERVER_URL` 时，构建产物会回退到项目默认后端地址，避免分支预览把自己的域名当成 API 和 WebSocket 目标。生产环境仍应显式配置 `VITE_SERVER_URL`。

测试结束后删除服务或测试数据。生产上线只使用 `docs/deployment.md` 的独立 Linux 云服务器方案。

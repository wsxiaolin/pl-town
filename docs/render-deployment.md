# Render 临时测试部署

Render 仅用于功能演示和测试，不承载生产数据，也不配置持久磁盘。正式部署见 [零基础云服务器部署指南](./deployment.md)。

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
```

`NODE_ENV=production` 时服务启动前会强制校验：`ALLOWED_ORIGINS` 至少一项、`ADMIN_PASSWORD` 至少 16 字符，任一缺失服务直接拒绝启动。Render 会自动注入 `PORT` 环境变量，服务按其监听，无需手动设置。需要多个测试管理员时，可另设 `ADMIN_ACCOUNTS_JSON='{"operator2":"至少 16 字符的密码"}'`。

聊天内容安全审核是可选能力：配置 `BIGMODEL_API_KEY=<测试用智谱 API Key>` 后，公开聊天会在后台调用智谱审核；不配置时服务正常启动，聊天消息保持未审核状态，启动日志会输出审核停用的告警。测试部署可按需省略该 Key。

生产模式下 `ALLOW_ORIGINLESS_WEBSOCKET` 默认关闭，浏览器直连 `wss://<后端域名>` 会携带前端 Origin，只要该 Origin 在 `ALLOWED_ORIGINS` 中即可正常建立 WebSocket。与后端同源的请求（例如托管在后端自身的 `/admin/` 管理面板）始终放行，无需把后端域名加入 `ALLOWED_ORIGINS`。

不要设置 `DATA_DIR` 到所谓长期路径，也不要把 Render 上生成的居民、住房或剧情数据视为可保留数据。Render 默认文件系统是临时的，重启或重新部署可能清空 SQLite。测试账号和密码不得与生产复用。

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

测试结束后删除服务或测试数据。生产上线只使用 `docs/deployment.md` 的独立 Linux 云服务器方案。

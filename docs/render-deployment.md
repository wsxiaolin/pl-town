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
ALLOWED_ORIGINS=https://<测试前端域名>
TRUST_PROXY_HOPS=1
AUTO_BACKUP_ENABLED=false
```

不要设置 `DATA_DIR` 到所谓长期路径，也不要把 Render 上生成的居民、住房或剧情数据视为可保留数据。Render 默认文件系统是临时的，重启或重新部署可能清空 SQLite。测试账号和密码不得与生产复用。

Render 的负载均衡器终止 TLS 并将请求转发给服务；其官方安全说明建议应用从 `X-Forwarded-For` 读取真实客户端 IP。因此此单层测试拓扑设置 `TRUST_PROXY_HOPS=1`。[Render Web Services](https://render.com/docs/web-services) [Render DDoS guidance](https://render.com/articles/how-render-handles-ddos-attacks)

## 前端测试站点

```text
Build Command: npm ci --include=dev && npm run build -w @minicity/web
Publish Directory: apps/web/dist
VITE_SERVER_URL=wss://<后端域名>
BASE_PATH=/
```

在 Static Site 中把 `/town-api/*` Rewrite 到后端同路径。`ALLOWED_ORIGINS` 必须与最终测试前端 Origin 完全一致。

测试结束后删除服务或测试数据。生产上线只使用 `docs/deployment.md` 的独立 Linux 云服务器方案。

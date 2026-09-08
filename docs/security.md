# MiniCity 服务端安全说明

## 已实施控制

- 生产环境 fail-closed：必须配置管理员账号、至少一个浏览器 Origin，并拒绝无 Origin WebSocket。
- 居民密码使用异步 `scrypt` 和随机盐；令牌只保存 SHA-256 摘要，具有有效期，可由后台撤销。
- 管理后台使用 HttpOnly、Secure、SameSite=Strict Cookie，写操作同时校验 Origin 和 CSRF；不存在静态管理员 Bearer Token 或任意 SQL 接口。
- WebSocket 限制握手 Origin、消息大小、每秒消息数、聊天/住房写入频率、连接总数和单 IP 连接数；所有异步消息处理都有异常兜底。
- HTTP JSON 请求限制 Content-Type、Content-Length 和实际读取字节；公共代理具有每 IP、全局频率限制和上游并发上限。
- SQLite 迁移在单一事务中执行，并用 `application_id`、`user_version` 标记；运行时锁禁止两个服务或恢复进程同时打开同一数据目录。
- 自动备份使用 SQLite Online Backup API，不直接复制 WAL 数据库；独立 worker 执行完整 `integrity_check`、外键检查和流式 SHA-256，并为每份备份持久化不可变 sidecar manifest。
- 日志文件和数据目录使用最小权限；文件日志失效时降级到 stderr，不因未处理的流错误终止进程。
- 管理审计最多保留 10,000 条；故事记录、外部会话、缓存与限流键均有容量边界。

## 数据库管理边界

后台提供运行概览、用户分页搜索、停用/启用、会话撤销、住房只读视图、审计、WAL 检查点、在线备份、下载、备份重新校验，以及经二次确认的在线恢复（本地备份或异地 OSS 备份，后者在本机缺失时会临时拉取）。后台故意不提供任意 SQL。

控制台在线恢复会覆盖当前库并强制下线所有居民，同时拒绝并发恢复和恢复期间的自动/手动备份。灾难恢复或需要整库文件替换时，应先停服再跑 CLI：

```bash
sudo systemctl stop minicity
sudo -u minicity env DATA_DIR=/var/lib/minicity BACKUP_DIR=/var/backups/minicity \
  /usr/bin/node /opt/minicity/current/apps/server/dist/restoreBackup.js \
  <backup.sqlite> <sha256> --confirm
sudo systemctl start minicity
```

CLI 恢复拒绝活动运行锁和遗留 WAL/SHM，先验证候选库、生成并验证恢复前备份，再原子替换；恢复后撤销全部居民令牌。

## 残余风险与运维要求

- 当前架构是单进程、单实例。管理员会话、Physics Lab 会话、在线状态和限流均在内存中；扩展到多实例前必须迁移共享状态和广播。
- 本机 `/var/backups/minicity` 只保护逻辑错误，不是灾难恢复。必须启用独立账号/区域的对象存储同步，并定期做恢复演练。服务端管理后台内置手动上传/下载/在线恢复到阿里云 OSS 的能力（`OSS_ENABLED`）；上传只接受本地已校验备份并记录 SHA-256，在线恢复允许本机缺失时临时拉取 OSS 对象。凭据应使用仅限该桶的 RAM 子账号，优先走内网 endpoint。
- 备份包含密码哈希、会话摘要和可能的邮箱，需按生产数据库同等级保护。对象存储应启用服务端加密、版本控制和最小权限。
- 住宅坐标由前端渲染时根据避障动态生成；服务端目前只能验证 ID 格式，不能证明坐标确实属于地图住宅。后续应把住宅目录生成为前后端共享的静态数据，再启用白名单。
- 部分剧情和浏览行为只能由客户端陈述。服务端只为可由持久状态验证的通用成就发放货币；客户端专属成就可记录徽章但不发货币。
- 应在 Nginx 或云防火墙之外再启用云厂商 DDoS/WAF 能力，并监控 `429`、`401`、备份失败、磁盘容量和 `/readyz`。

# MiniCity Server

独立于前端的 Node.js 实时服务器骨架。当前支持临时身份、玩家位置同步、全服文字公聊和住宅关系；不包含语音、货币、OAuth、后台管理，也不修改前端状态。

## 运行

需要 Node.js 20 或更高版本。

```bash
cd server
npm install
npm run dev
```

默认监听 `http://0.0.0.0:8787`，WebSocket 使用同一个地址。健康检查为 `GET /healthz`。生产环境使用：

```bash
npm run build
npm start
```

可用环境变量：`HOST`、`PORT`、`DATA_DIR`。SQLite 默认保存在当前工作目录的 `data/minicity.sqlite`。

## 架构边界

- Node.js HTTP 仅提供健康检查，实时业务统一走 WebSocket。
- SQLite 保存临时用户、OAuth 预留邮箱、最新位置、住宅和入住关系。
- 位置事件立即广播，每秒批量刷新最新位置到 SQLite，避免每帧写盘。
- 聊天内容只在内存中广播，不写数据库；服务器重启后不会恢复聊天。
- 正式身份为「昵称 + 密码」账号，昵称全局唯一，服务端用带盐 scrypt 保存密码；临时令牌仅用于会话恢复，不算正式登录。接入 OAuth 后，应在服务端验证 OAuth 凭据，再把外部身份绑定到现有用户。
- 当前为单进程、单实例设计，符合最多约 100 人的初期目标。多实例部署前需要增加共享 pub/sub 和在线状态存储。
- 住宅 ID 由前端按居民楼坐标稳定生成，格式为 `residence:x:z`；服务端拒绝其他格式。

## 连接流程

客户端连接后必须首先发送 `hello`。首次不传令牌，同时发送昵称与密码完成注册或登录：

```json
{"type":"hello","nickname":"访客名称","password":"你的密码"}
```

昵称要求：至少两个字（≥2 个字符），只允许中文、英文和数字，禁止空格与任何特殊字符；昵称全局唯一。密码不能为空。

服务器返回新令牌，前端应保存在本地：

```json
{
  "type":"hello",
  "token":"仅在首次或恢复时使用的令牌",
  "user":{"id":"...","nickname":"访客名称","email":null,"position":{"x":0,"y":0,"z":0}},
  "players":[],
  "houses":[]
}
```

昵称已存在时，服务器会校验密码：正确则登录并返回同一个唯一用户 ID，错误则返回
`{"type":"error","message":"昵称或密码错误"}`。昵称或密码不符合规则时也会返回错误，
客户端应停止重连并重新录入。

重连时可以只发送令牌，绕过账号密码校验：

```json
{"type":"hello","token":"此前保存的令牌"}
```

用户 ID 由服务端生成（UUID），全局唯一，同一账号再次登录返回同一个 ID。令牌应视为密码，不要写入日志或 URL。服务端只保存 SHA-256 哈希，不保存令牌明文；密码使用带随机盐的 scrypt 哈希保存。

## 实时位置

客户端按固定频率发送位置，建议每秒 10 至 15 次，不要逐渲染帧发送：

```json
{"type":"position","position":{"x":1.2,"y":0,"z":4.8,"rotation":1.57}}
```

其他客户端收到：

```json
{"type":"player.moved","playerId":"...","position":{"x":1.2,"y":0,"z":4.8,"rotation":1.57}}
```

前端应在两个位置采样之间插值显示连续移动。服务器不做碰撞、速度或位置合法性校验，只检查数值格式。

在线事件为 `player.joined` 和 `player.left`。`hello.players` 是连接时的在线快照。

## 全服文字聊天

发送内容上限 500 个字符：

```json
{"type":"chat","text":"大家好"}
```

所有在线客户端，包括发送者，收到：

```json
{"type":"chat","userId":"...","nickname":"访客名称","text":"大家好"}
```

当前没有限流、敏感词、禁言和历史记录，公开部署前至少应增加按用户和 IP 的发送频率限制。

## 住宅协议

住宅快照结构：

```json
{
  "buildingId":"residence-01",
  "name":"住宅名称",
  "ownerId":"...",
  "ownerNickname":"...",
  "members":[{"userId":"...","nickname":"..."}]
}
```

客户端可发送以下操作：

```json
{"type":"housing.list"}
{"type":"housing.claim","buildingId":"residence-01","name":"可选名称"}
{"type":"housing.rename","buildingId":"residence-01","name":"新名称"}
{"type":"housing.invite","buildingId":"residence-01","userId":"受邀用户 ID"}
{"type":"housing.apply","buildingId":"residence-01"}
{"type":"housing.accept","requestId":123}
{"type":"housing.decline","requestId":123}
{"type":"housing.kick","buildingId":"residence-01","userId":"成员 ID"}
{"type":"housing.leave","buildingId":"residence-01"}
{"type":"housing.transfer","buildingId":"residence-01","userId":"新所有者 ID"}
{"type":"housing.release","buildingId":"residence-01"}
```

规则：住宅只能有一个所有者；所有者自动是成员；最多 10 名成员；每名用户最多入住一间住宅。邀请和主动申请都会先创建待处理请求，邀请对象或房主必须通过 `housing.accept` 同意，拒绝使用 `housing.decline`；请求状态通过 `housing.requests` 返回。转让对象必须已经是成员；所有者必须先转让或放弃住宅，不能直接退出。任何变更都会向全服广播最新的 `housing.updated` 快照。

所有失败响应都是：

```json
{"type":"error","message":"错误原因"}
```

## 后续接入顺序

1. 正式部署前可把地图生成的住宅 ID 导出为服务端静态白名单，进一步限制坐标伪造。
2. 前端保存临时令牌，实现位置发送、远端玩家插值和在线快照。
3. 增加正式 OAuth 回调与外部身份绑定，替换匿名身份入口。
4. 接入货币服务后，在 `housing.claim` 事务内校验并扣款；当前认领不收费。
5. 公开部署前增加 WSS 反向代理、消息限流、请求体限制和结构化日志。

# 控制台调试 API

城市启动完成后，调试入口统一挂载在 `window._mini`。所有控制台调试代码都使用这个命名空间。

## 基础对象

```js
window._mini.scene
window._mini.camera
window._mini.renderer
window._mini.THREE
window._mini.npcs
window._mini.player
window._mini.residences
window._mini.navigation
window._mini.cameraZoom
window._mini.getPlayerPath()
```

## 建筑、住宅和居民

```js
window._mini.interactBuilding('building-id')
window._mini.openBuildingDialog('building-id')
window._mini.interactNpc('npc-id')
window._mini.destroyBuilding('building-id')
window._mini.destroyResidence('residence-id')
window._mini.destroyAll()
window._mini.restoreBuilding('building-id')
window._mini.restoreResidence('residence-id')
window._mini.restoreAll()
```

`destroyAll()` 和 `restoreAll()` 返回实际变更数量。废弃建筑状态由建筑损坏控制器持久化，刷新页面后仍然生效。

## 场景与剧情

```js
window._mini.interactInterestPoint('interest-point-id')
window._mini.burnCity()
window._mini.burnCityActive()
window._mini.burnCityProgress()
window._mini.cinematics.playLanYuPrelude()
window._mini.cinematics.stopLanYuPrelude()
window._mini.cinematics.isLanYuPreludeActive()
window._mini.invasionCG()
window._mini.stopInvasionCG()
window._mini.cinematics.startMuster()
window._mini.cinematics.stopMuster()
window._mini.cinematics.musterActive()
```

## 天气

```js
window._mini.weather.get()
window._mini.weather.set('clear')
window._mini.weather.set('rain')
window._mini.weather.set('snow')
window._mini.weather.set('snow-deep')
```

天气选择器已从渲染设置面板移除。正常天气由服务端通过 WebSocket 下发，客户端登录时接收当前值，之后每分钟接收一次同步。管理员使用 `POST /admin/api/weather` 修改服务端天气：

```json
{"weather":"rain"}
```

该管理接口要求管理员会话和 CSRF 校验。`window._mini.weather.set(...)` 只修改当前客户端的调试状态，不写入本地存储，也不修改服务端状态。

天气由服务端管理员接口手动下发。离线运行时客户端保持 `clear`，服务端重启后也从 `clear` 开始；管理员可通过服务端接口重新设置天气。
本次产品行为保留了服务端手动下发模型，客户端移除了按游戏天自动轮换天气的逻辑。已连接客户端调用 `window._mini.weather.set(...)` 后，最多持续到下一次服务端天气同步。

## 城市分区建设阶段

城市被划分为 9 个分区：`inner`（内区），`outer_east` / `outer_south` / `outer_west` / `outer_north`（环状路以内的东南西北外区），`ext_east` / `ext_south` / `ext_west` / `ext_north`（环状路以外的东南西北延伸区）。

每个分区有五个状态（阶段）：

| 阶段 | 效果 |
| --- | --- |
| `locked`（未解锁） | 区域内一切不可见（仅有贯穿全图的两条黑色主干道），不可到达 |
| `built1`（建设 1） | 显示区域内道路并可以到达 |
| `built2`（建设 2） | 在建设 1 基础上显示路灯、树木等装饰 |
| `built3`（建设 3） | 在建设 2 基础上显示非民居建筑（含喷泉、观星台等构筑物） |
| `unlocked`（已解锁） | 显示全部内容（包括民居） |

```js
window._mini.zones.list()                 // 查看全部分区及当前阶段
window._mini.zones.get('outer_north')     // 查询单个分区阶段
window._mini.zones.set('outer_north', 'built1')  // 设置分区阶段（即时生效）
window._mini.zones.setAll('locked')       // 所有分区统一设置
window._mini.zones.reset()                // 全部恢复为已解锁
window._mini.zones.levelAt(10, -30)       // 查询坐标点所在分区的阶段等级（0-4）
```

分区阶段写入 `localStorage`（键 `minicityZoneStages`），刷新后保持。分区变化会同步更新：道路/装饰/建筑/民居可见性、寻路图与碰撞、全景地图截图与建筑图标、NPC 巡逻与显隐。两条黑色主干道（x=0 与 z=0）在任何阶段都保持可见与可通行。

## 调试约定

- `window._mini.*` 是唯一控制台调用格式。
- 页面触发 `minicity:city-ready` 前，3D 场景相关入口可能尚未可用。

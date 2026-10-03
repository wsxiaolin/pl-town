# 控制台调试 API

城市启动完成后，调试入口统一挂载在 `window._mini`。所有控制台调试代码都使用这个命名空间。

## 视觉验证 dev 门控（`?dev`）

访问 URL 带上 `?dev` 参数即进入开发者视觉验证模式（`apps/web/src/city/devPortal.ts` 判定，本地与云端预览均可用）：

- 跳过登录层与新居民引导，直接以访客身份进入小城（`logo` 显示 `- dev-监工`）；
- 不发起多人连接——保持离线，避免无凭据 connect 被 auth 拒绝后重新弹出登录层；
- 入场动画照常运行（这是离线环境下建筑升起的唯一触发点）；
- 正常玩家不带参数访问零感知，所有分支均以 `isDevPortalRequested()` 门控。

典型用途：云端预览（CF Pages）的视觉验证——

```
https://<preview-host>.pages.dev/?dev=1
```

注意：预览环境连不上治理服务（`/town-api`），`pendingBuildings` 为空，因此待建建筑（含星语北城 12 栋作品建筑）会全部渲染；线上有治理服务时它们按筹资进度隐藏。核对线上观感时以治理状态为准。

## 传送与取景（teleport / focus）

```js
window._mini.teleport(x, z)            // 玩家瞬移到 (x, z)，跟随相机下一帧落位
window._mini.focus(x, z, zoom?)        // teleport + 可选正交 zoom（越大视野越广）
```

- 坐标即世界坐标：主城广场 `(0, 0)`，星语北城核心 `(0, -60)`，Echo 天文台 `(65, 0)`。
- `zoom` 是正交相机半高：默认 10（街景），15 为游戏内上限，19–25 适合整城航拍。
- `teleport` 会清空当前寻路状态；不会触发导航绕行，可落在任意开阔点（不要放进建筑足印内）。
- 相机始终跟随玩家（`playerController.updateCamera`），所以「移动相机」就是移动玩家。

常用取景示例：

```js
window._mini.focus(0, -63, 21)   // 星语北城全景（含两坊与作品街区）
window._mini.focus(-16, -70, 9)  // 西坊街景近景
window._mini.focus(0, 0, 12)     // 主城广场
```

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

`camera` / `cameraZoom` 为只读视图；改取景请用上面的 `teleport` / `focus`。

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

## 新居民引导

```js
window._mini.tutorial.start(true)
window._mini.tutorial.close()
window._mini.tutorial.isCompleted()
```

`start(true)` 会强制重看引导。新居民在登录与开场 CG 结束后自动出现一次，依次点亮走路、地图、手机和登录入口。

## 调试约定

- `window._mini.*` 是唯一控制台调用格式。
- 页面触发 `minicity:city-ready` 前，3D 场景相关入口可能尚未可用。

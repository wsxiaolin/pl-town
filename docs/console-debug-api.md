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

## 调试约定

- `window._mini.*` 是唯一控制台调用格式。
- 页面触发 `minicity:city-ready` 前，3D 场景相关入口可能尚未可用。

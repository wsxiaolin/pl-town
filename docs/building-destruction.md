# 建筑毁坏控制台命令

城市运行后，浏览器控制台可以通过 `window.__mini()` 调试建筑毁坏状态。命令会立即改变场景视觉状态，并禁用对应建筑的射线交互、导航、弹窗和地图入口。

## 命令

```js
// 毁坏主建筑，例如图书馆
window.__mini().destroyBuilding('library')

// 毁坏居民楼，ID 来自居民楼列表
window.__mini().destroyResidence('residence:12.00:-6.00')

// 毁坏所有主建筑和居民楼，并返回本次实际毁坏数量
window.__mini().destroyAll()

// 恢复单个主建筑
window.__mini().restoreBuilding('library')

// 恢复单个居民楼
window.__mini().restoreResidence('residence:12.00:-6.00')

// 恢复全部建筑和居民楼
window.__mini().restoreAll()
```

上述方法也会直接挂在全局 `window` 对象上：

```js
window.destroyBuilding('library')
window.restoreBuilding('library')
window.restoreAll()
```

## 居民楼 ID

居民楼 ID 使用世界坐标生成，格式为 `residence:X.XX:Z.XX`。可以在控制台查看当前居民楼：

```js
window.__mini().residences.map(residence => residence.id)
```

单个毁坏命令首次成功时返回 `true`，目标不存在或已经毁坏时返回 `false`。`destroyAll()` 返回本次新毁坏的对象数量，重复执行时返回 `0`。

恢复命令首次成功时返回 `true`，目标不存在或当前处于正常状态时返回 `false`。`restoreAll()` 返回本次实际恢复的对象数量，重复执行时返回 `0`。

毁坏对象 ID 会保存到浏览器 `localStorage` 的 `minicityDestroyedBuildings`。刷新页面后会自动重放毁坏状态，恢复后会从该列表移除对应 ID。

毁坏效果包含压塌主体、隐藏高位构件、灰暗材质、断墙、焦黑区域和散落碎块。居民楼的认领、命名、地图标签和导航入口会同步停止工作。

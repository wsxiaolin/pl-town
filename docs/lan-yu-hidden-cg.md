# 岚雨隐藏 CG

这段影像是独立的纯 CG 实验，不接入任务、建筑、登录或存档流程。页面正常启动后，它只会在浏览器控制台收到明确命令时播放，不会自行出现，也不会修改玩家进度。

## 播放

打开 MiniCity 页面，等待城市加载完成，然后在浏览器开发者工具的 Console 中执行：

```js
window.__mini?.().cinematics.playLanYuPrelude()
```

命令会返回一个播放句柄：

```js
const cg = window.__mini?.().cinematics.playLanYuPrelude()
cg?.finished.then(reason => console.log('CG ended:', reason))
```

播放结束原因可能是 `completed`、`skipped` 或 `restarted`。再次执行播放命令会无缝终止旧实例并从头开始。

## 停止与查询

播放中按 `Esc`、点击右上角“跳过”，或者执行以下命令，都会关闭 CG：

```js
window.__mini?.().cinematics.stopLanYuPrelude()
```

查询当前是否正在播放：

```js
window.__mini?.().cinematics.isLanYuPreludeActive()
```

## 实现说明

- CG 使用单个 Canvas 2D 和一条连续时间轴；场景不会像原片头一样在每幕之间重建画布。
- 相邻字幕有重叠时间，并由两个字幕平面交叉淡化，转场中不会出现空白字幕帧。
- 焦土、血纹、灰烬、铭文拓测、锁链、月白长靴和斩断束缚均为程序绘制，没有新增图片资源。
- 本功能只挂在隐藏调试对象 `window.__mini()` 下，没有顶层全局快捷函数或可见 UI 入口。

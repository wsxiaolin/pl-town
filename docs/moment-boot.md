# 时刻画面启动系统（moment boot）

访客每次进入小城看到的不再是五幕开场 CG，而是「此刻的小城」——按访客本地时钟选择四张同构图时刻图之一（清晨 / 正午 / 黄昏 / 夜晚）。首次进入、版本更新或预编译缓存丢失时，自动回落到重型启动管线（全量资源下载 + 着色器预编译）。

## 启动模式判定（bootGate）

| 情况 | 模式 | 表现 |
|---|---|---|
| 首次进入（本地无任何标记） | heavy | 旧「正在下载城市资源」页：当前时刻大图 + 底部慢进度条 + GPU 行 |
| 构建 ID 变化（前端代码更新） | heavy | 同上，提示「检测到小城有更新」 |
| 服务端版本变化（`/town-api/version`） | heavy | 同上，提示「服务端已更新」 |
| 预编译缓存标记丢失（清了 localStorage） | heavy | 同上，提示「本地预编译缓存缺失」 |
| 其余日常进入 | light | 单张时刻图 splash，最短停留 2.6s，点击即入 |

构建 ID = `package.json` 版本 + git 短哈希，构建时由 `vite.config.ts` 注入（`__MINICITY_BUILD_ID__`，可用环境变量 `VITE_BUILD_ID` 覆盖）。服务端探测只在本地状态健康时进行（2s 超时，失败按本地判断放行，离线不受影响）。重型管线完整走完后写入 `minicityBuildId` + `minicityPrecacheDone`，下次进入即轻路径。

## 重型管线四阶段（加权进度条）

1. **下载城市资源**（68%）——`import.meta.glob` 枚举全部打包资产（41MB 材质包、CG 图、GLB 模型、活动图、时刻图），6 并发逐字节读取；`preloadTextureResources(force=true)` 无视省流模式与贴图设置强制全量，超时放宽到 240s。单个失败可容忍（城市回退程序化材质）。
2. **构建小城场景**（6%）——正常 `initCity()`。
3. **预编译渲染管线**（22%）——`renderer.compileAsync(scene, camera)` 链接全部着色器程序，再渲染 3 帧预热（强制镜面水面/天空/光照等惰性程序就位），首帧不再卡顿。
4. **即将进入小城**（4%）——写缓存标记，揭幕。

GPU 行：`WEBGL_debug_renderer_info` 读取驱动上报的 renderer 字符串并分级（独立显卡 / 集成显卡 / Apple 芯片 / 软件渲染），WebGPU `navigator.gpu` 作可用性交叉验证。**注意**：WebGL 拿不到 eGPU 的独立信息，外接显卡会以其驱动上报的名字出现（如 "NVIDIA GeForce RTX…"），这已是浏览器侧能拿到的最细粒度。首次启动按 GPU 分级写入默认渲染设置（用户已有手动设置则不覆盖），结果缓存于 `minicityGpuInfo`。

## 时刻映射（本地时间）

| 时段 | 图 | 说明 |
|---|---|---|
| 05:00–10:59 | `dawn.webp` | 金色柔光清晨 |
| 11:00–16:59 | `noon.webp` | 烈日蓝天正午 |
| 17:00–19:59 | `dusk.webp` | 橙色落日黄昏 |
| 20:00–04:59 | `night.webp` | 月夜星空 |

图片位于 `apps/web/src/assets/moments/`（WebP，2688×1536，经 Git LFS 托管）。重/轻路径都只显示**当前现实时刻**一张（按访客本地时钟映射），不轮播——启动画面必须与窗外时间一致。

## 开场 CG 的临时下线与恢复

`apps/web/src/city/cg.ts` 中 `OPENING_CG_ENABLED = false`。五幕 CG 代码（`cg.ts`/`invasionCg.ts`/`musterCg.ts`/`lanYuPreludeCG.ts`）全部保留，改回 `true` 即恢复。

## 调试开关

- URL 参数：`?boot=heavy` / `?boot=light`（单次生效）
- localStorage：`minicityForceBoot = 'heavy' | 'light'`
- `localStorage.removeItem('minicityPrecacheDone')` → 下次进入重新走重型管线

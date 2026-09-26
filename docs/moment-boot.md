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

构建 ID = `package.json` 版本 + git 短哈希（工作区有未提交改动时附加 `-dirty`，避免本地实验复用过期预编译），构建时由 `vite.config.ts` 注入（`__MINICITY_BUILD_ID__`）。服务端探测只在本地状态健康时进行（4.5s 超时覆盖免费后端冷启动，失败按本地判断放行并在控制台告警，离线不受影响）。端点返回的是 16 位身份指纹（version+commit 的 SHA-256 截断）——客户端只比较相等性，精确部署细节不上网线。重型管线完整走完后写入 `minicityBuildId` + `minicityPrecacheDone` + 本次探测到的服务端版本，下次进入即轻路径；中途关页则服务端版本不落地，下次进入会重新执行本次更新。轻路径 boots 立即落地服务端版本（无事待办）。

**权衡说明**：服务端单独发版（前端构建 ID 未变）也会触发全员重型管线（45MB 重下 + 重预编译）。当前服务端变更（治理内容等）没有指纹可对到具体资产，宁可多下载一次也不冒「缓存内容过期」的险。另外 `preloadTextureResources(force)` 无视省流（saveData）/慢速网络设置——这是重型管线"一次到位"语义的一部分；若未来要尊重省流，需要弹窗确认而非静默跳过。

**健壮性**：重型管线的网络阶段与预编译共享 240s 看门狗——单个请求卡死或后台标签页冻结 rAF 时，降级为程序化材质进入小城，而不是把访客永远扣在 splash 上。

## 重型管线四阶段（加权进度条）

1. **下载城市资源**（68%）——`import.meta.glob` 枚举全部打包资产（41MB 材质包、CG 图、GLB 模型、活动图、时刻图），6 并发逐字节读取；`preloadTextureResources(force=true)` 无视省流模式与贴图设置强制全量，超时放宽到 240s。单个失败可容忍（城市回退程序化材质）。
2. **构建小城场景**（6%）——正常 `initCity()`。
3. **预编译渲染管线**（22%）——`renderer.compileAsync(scene, camera)` 链接全部着色器程序，再渲染 3 帧预热（强制镜面水面/天空/光照等惰性程序就位），首帧不再卡顿。
4. **即将进入小城**（4%）——写缓存标记，揭幕。

GPU 行：`WEBGL_debug_renderer_info` 读取驱动上报的 renderer 字符串并分级（独立显卡 / 集成显卡 / Apple 芯片 / 软件渲染），WebGPU 可用性为同步 `navigator.gpu` 存在性检查（信息展示用）。探测用的临时 WebGL 上下文读完即 `WEBGL_lose_context` 销毁并缓存结果（`minicityGpuInfo`），每设备只付一次二级上下文成本。**注意**：WebGL 拿不到 eGPU 的独立信息，外接显卡会以其驱动上报的名字出现（如 "NVIDIA GeForce RTX…"），这已是浏览器侧能拿到的最细粒度。首次启动按 GPU 分级写入默认渲染设置（用户已有手动设置则不覆盖）。

## 时刻映射（本地时间）

| 时段 | 图 | 说明 |
|---|---|---|
| 05:00–10:59 | `dawn.webp` | 金色柔光清晨 |
| 11:00–16:59 | `noon.webp` | 烈日蓝天正午 |
| 17:00–19:59 | `dusk.webp` | 橙色落日黄昏 |
| 20:00–04:59 | `night.webp` | 月夜星空 |

图片位于 `apps/web/src/assets/moments/`（sin 提供的原画 1671×941，WebP q95 重编码，约 525-593KB/张，普通 git 对象托管——曾尝试 Git LFS，但 GitHub 禁止向 public fork 上传新 LFS 对象，回退）。重/轻路径都只显示**当前现实时刻**一张（按访客本地时钟映射），不轮播——启动画面必须与窗外时间一致。揭幕完成后时刻图停止漂移动画并释放位图，不空耗 GPU。

**资产预算**：`check:asset-size` 上限 48MiB，当前 45.4MiB，只剩 ~2.6MiB 余量——下一张大图入库前先考虑压缩或减重。

## 开场 CG 的临时下线与恢复

`apps/web/src/city/cg.ts` 中 `OPENING_CG_ENABLED = false`。五幕 CG 代码（`cg.ts`/`invasionCg.ts`/`musterCg.ts`/`lanYuPreludeCG.ts`）全部保留，改回 `true` 即恢复。**注意**：时刻画面时代删掉了 CG 破解后的「居民证解锁」toast（`showUnlockToast`）——恢复 CG 时若需要该提示，需在 CG 完成回调处补回（toast.ts 仍在）。

## 调试开关

- URL 参数：`?boot=heavy` / `?boot=light`（单次生效）
- localStorage：`minicityForceBoot = 'heavy' | 'light'`
- `localStorage.removeItem('minicityPrecacheDone')` → 下次进入重新走重型管线

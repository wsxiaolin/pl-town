# 时刻画面启动系统（moment boot）

访客每次进入小城看到的不再是五幕开场 CG，而是「此刻的小城」——按访客本地时钟选择四张同构图时刻图之一（清晨 / 正午 / 黄昏 / 夜晚）。首次进入、版本更新或预编译缓存丢失时，自动回落到重型启动管线（全量资源下载 + 着色器预编译）。

## 启动模式判定（bootGate）

| 情况 | 模式 | 表现 |
|---|---|---|
| 首次进入（本地无任何标记） | heavy | 旧「正在下载城市资源」页：当前时刻大图 + 底部慢进度条 + GPU 行 |
| 构建 ID 变化（前端代码更新） | heavy | 同上，提示「检测到小城有更新」 |
| 服务端版本变化（`/town-api/version`——`RENDER_GIT_COMMIT` 环境变量优先，未设时服务器在 git checkout 里自动解析短哈希，两者皆无才退空） | heavy | 同上，提示「服务端已更新」 |
| 预编译缓存标记丢失（清了 localStorage） | heavy | 同上，提示「本地预编译缓存缺失」 |
| 其余日常进入 | light | 单张时刻图 splash，最短停留 2.6s，点击即入 |

构建 ID = `package.json` 版本 + git 短哈希（工作区有未提交改动时附加 `-dirty`，避免本地实验复用过期预编译），构建时由 `vite.config.ts` 注入（`__MINICITY_BUILD_ID__`）。服务端探测只在本地状态健康时进行（**1.5s 预算**——它坐在每日进入的揭幕关键路径上；冷后端首访可能超时按本地放行，下次进入补上检测，治理内容因并行加载不受影响。失败 console.debug，离线不受影响）。端点返回的是 16 位身份指纹（version+commit 的 SHA-256 截断）——客户端只比较相等性，精确部署细节不上网线。重型管线完整走完后写入 `minicityBuildId` + `minicityPrecacheDone` + 本次探测到的服务端版本，下次进入即轻路径；中途关页则服务端版本不落地，下次进入会重新执行本次更新。轻路径 boots 立即落地服务端版本（无事待办）。

**权衡说明**：服务端单独发版（前端构建 ID 未变）也会触发全员重型管线（45MB 重下 + 重预编译）。当前服务端变更（治理内容等）没有指纹可对到具体资产，宁可多下载一次也不冒「缓存内容过期」的险。另外 `preloadTextureResources(force)` 无视省流（saveData）/慢速网络设置——这是重型管线"一次到位"语义的一部分；若未来要尊重省流，需要弹窗确认而非静默跳过。

**健壮性**：重型管线的网络阶段与预编译共享 240s 看门狗——单个请求卡死或后台标签页冻结 rAF 时，降级为程序化材质进入小城，而不是把访客永远扣在 splash 上。

## 重型管线四阶段（加权进度条）

1. **下载城市资源**（68%）——`core/bundledAssets` 枚举打包资产，**按生效配置过滤**（分类基于 glob KEY 而非产物 URL——Vite 会把产物摊平成 `/assets/名字-哈希.png`，URL 里不再有 `textures/` 段）：HD 贴图关闭时不下 41MB 材质包、CG 关闭时不下 CG 图（对应开关启用属于构建变更，会触发重新预下载）；其余（GLB 模型、活动图、时刻图）6 并发流式读取。`preloadTextureResources(force=true)` 只越过省流模式，不越过「本 boot 用不上」；超时 240s。单个失败可容忍（城市回退程序化材质）。
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

## 三级清晰度渐进（时刻图加载，仅重型启动）

每张时刻图配套两级缩图，与原图构成**三级清晰度阶梯**：32px → 256px → 1671px 原图。渐进揭示**只在重型启动（本次进入需要下载资源）时运行**——首次进入 / 构建变更 / 预编译缓存丢失的判定只读本地标记、微任务级返回，冷访问几乎瞬间进入阶梯；日常轻路径（资源已缓存）走**直出**：splash 先于 boot 决策绘制，只设原图 src、decode 门控 1.6s 淡入，一张缩图请求都不发（`boot-gate.spec` 钉住）。

阶梯重画（`showMomentHeavy` → ladder 模式）只发生在 heavy 判定落地后：L1 内联 data URI 零请求瞬时首帧，三级并行请求、独立 decode，**揭示单调**——`momentTiers.tierDecision()`（有单测钉住）保证级层只在比当前显示更清晰时淡入：慢级晚到安静垫底（`is-retired`），网络抖动下画面只变清晰、不倒退；decode 失败跳级、粗级兜底不黑屏。边缘：server-changed 判定（探测期间缓存原图已直出）重画时检测到原图已揭示，跳过阶梯保留直出画面。

| 级 | 分辨率 | 体积/张 | 传输 |
|---|---|---|---|
| L1 | 32px | 176–240B | 内联 data URI（零请求，首帧瞬时） |
| L2 | 256px | 6–8.6KB | 独立文件（fetchpriority=high） |
| L3 | 原图 | ~535–607KB | 独立文件，1.6s 淡入收尾 |

级间淡入 0.45s + 递减 blur（24px / 6px，CSS `boot-moment-step`、`boot-moment-step-2`）；三层共用 drift keyframes 保持像素级同步；`.boot-moment-img` 基础规则与 `.boot-moment-step` 覆盖规则的**层叠顺序**（step 必须在后，否则 1.6s 基础过渡覆盖 0.45s 级间过渡）在内联 `bootCritical` 与外链 `boot.css` 中互为镜像——两处修改需同步。内联阈值 4KB（Vite `assetsInlineLimit`），故仅 L1 内联、L2 起走网络。`paintToken` 代际隔离防止旧 decode 回调翻动新 paint 的层。

**揭示即退役**（#201 B1 修复）：`momentTiers.applyDecodeEvent()` 把每次 decode 完成折叠成整梯状态（纯函数，单测钉住）——更高级层揭示的**同一写**里，所有在屏的粗级层标记 `is-retired`。正常到达顺序（L1→L2→L3）也会退役，不再出现三层全屏模糊层伴随整条重型管线合成/漂移的情况。退役的视觉语义（#201 S1 修复）：退役层**保留 opacity**（`is-front` 不摘，新层在其上淡入 = 交叉淡化，无黑帧），漂移动画立即停止，`visibility` 经基础过渡的 `visibility 0s linear 1.6s` 延迟 1.6s 翻转——恰好等于原图收尾淡入时长，淡入完成即退出合成。慢级晚到则自退休垫底（`tierDecision` 保证揭示单调，网络抖动下画面只变清晰、不倒退）；decode 失败跳级、粗级兜底不黑屏。边缘：server-changed 判定（探测期间缓存原图已直出）重画时检测到原图已揭示，跳过阶梯保留直出画面。层状态（hidden/front/retired）的 DOM 读取-折叠-写回全部经由该纯函数，视图不再自持 `shownMomentLevel` 计数；梯级数量由 `Record<MomentName, readonly [string, string, string]>` 在编译期钉死为三。

缩图由 PIL 生成（`moments/` 下的 `*-step1..2.webp`）：`LANCZOS` 缩放至 32/256 宽，quality 50/60，method 6。原图更新时需重新生成两级，在 `apps/web/` 下执行（#201 N3，可直接复制）：

```bash
python3 - <<'PY'
from PIL import Image
from pathlib import Path

for src in sorted(Path('src/assets/moments').glob('*.webp')):
    if '-step' in src.stem:
        continue  # regenerate from originals only
    for width, quality, suffix in [(32, 50, 'step1'), (256, 60, 'step2')]:
        img = Image.open(src)
        height = round(img.height * width / img.width)
        out = src.with_name(f'{src.stem}-{suffix}.webp')
        img.resize((width, height), Image.LANCZOS).save(out, 'WEBP', quality=quality, method=6)
        print(f'{src.name} -> {out.name} ({width}x{height}px q{quality}, {out.stat().st_size}B)')
PY
```

**资产预算**：`check:asset-size` 上限 48MiB，当前 ~45.4MiB（含 8 张缩图约 29KB），只剩 ~2.6MiB 余量——下一张大图入库前先考虑压缩或减重。

## 开场 CG 的临时下线与恢复

`apps/web/src/city/cg.ts` 中 `OPENING_CG_ENABLED = false`。五幕 CG 代码（`cg.ts`/`invasionCg.ts`/`musterCg.ts`/`lanYuPreludeCG.ts`）全部保留。恢复后入场动画不受渲染门影响（r8 起 entrance 由 frameLoop 首帧钩子触发）。**恢复不是只改一个布尔值**：splash 层 z-index 1000 盖在 CG overlay（700）之上，揭幕只看 cityReady+最短停留，直接改回 `true` 会得到「CG 播了约 2.6s 才被揭开」的画面——恢复时需把 `cgOverlay` 提层到 1001+，或把 `initCG` 的 onFinish 接回启动闸门再揭幕。CG 资源不在 CG 关闭期的重型下载清单里（构建变更即重新预下载）。**注意**：时刻画面时代删掉了 CG 破解后的「居民证解锁」toast（`showUnlockToast`）——恢复 CG 时若需要该提示，需在 CG 完成回调处补回（toast.ts 仍在）。

## 本地复现服务端变更

`/town-api/version` 探针只在配置了 API 基址时工作——本地开发需要 `VITE_SERVER_URL=ws://127.0.0.1:8787 npm run dev`（或 `VITE_API_BASE`），否则每次进入按本地标记直接判定，永远不会出现 server-changed。

## 调试开关

- URL 参数：`?boot=heavy` / `?boot=light`（单次生效）
- localStorage：`minicityForceBoot = 'heavy' | 'light'`
- `localStorage.removeItem('minicityPrecacheDone')` → 下次进入重新走重型管线

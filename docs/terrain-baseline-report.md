# pl-town 地形改造 — 环境基线报告

> 任务：环境准备与基线验证（可信地形改造管道 T0）
> 日期：2026-10-11（Asia/Shanghai）
> 基线 commit：`9d68c2c`（feat(web): 主城建筑精细化建模 + 第一人称漫步模式 #230，即已合并 #230 后的 main）
> 执行环境：Debian 13 (trixie) 容器，非 root（uid 1001），区域 cn

## 结论速览

| 检查项 | 结果 |
|---|---|
| 依赖安装（scripts/setup-deps.sh） | ✅ EXIT=0 |
| npm run typecheck | ✅ EXIT=0（全部门禁通过） |
| npm run test:domain | ✅ EXIT=0（48/48 + 1/1） |
| npm run build | ✅ EXIT=0 |
| WebGL 测试链路（Playwright+Xvfb+SwiftShader） | ✅ 真实用例跑通（需 xauth 补丁，见下） |
| git 工作区 | ✅ 干净，零未提交改动 |

基线全绿。可信地形改造可以在此起点上开工。

## 1. 环境与依赖版本

| 项 | 实际 | 备注 |
|---|---|---|
| Node | v24.21.0 | 仓库 engines 要求 `22.x`，npm 仅告警不阻断（EBADENGINE），全部检查仍绿 |
| npm | 11.19.0 | npm 11 对 esbuild/better-sqlite3 的 install-scripts 报 allowScripts 告警，实测两包均正常（esbuild 可加载、better-sqlite3 原生绑定编译成功、内存建表通过） |
| 包管理 | npm workspace（root package-lock） | npm ci 走 npmmirror（区域自动探测 cn） |
| Playwright | @playwright/test ^1.62.1 | 完整版 chromium-1234（Chrome 151.0.7922.34）+ headless shell 1234 已装入 `~/.cache/ms-playwright` |
| Xvfb | /usr/bin/Xvfb（deb13u4） | 存在，但 **xauth 缺失**（见 §4） |
| docker | 不可用 | `docker/test.Dockerfile` 构建路径在本机走不通，仅作参考 |

安装产物：`npm ci` added 184 packages in 2m；setup-deps.sh EXIT=0（非 root 跳过系统库安装——xvfb 本机已有）。

## 2. 检查命令详情（repo 根目录）

### npm run typecheck ✅
- `check:source-size`：Logic source size check passed.
- `check:asset-size`：137 files, 21.9 MiB（限额 48 MiB）。
- `check:moment-tiers`：4 moments × 2 steps, widths 32/256, aspect matched.
- web `tsc --noEmit`：零错误。
- server `tsc`：零错误（含 `generateBuildingCatalog --check`：70 buildings up to date）。

### npm run test:domain ✅
- `test:unit`：**48/48 文件通过**（含 `worldTerrainAudit`——地形改造相关的 keep-out 约束基线完好）。
- `test:unit:story-sentences`：1/1 通过。

### npm run build ✅
- `check-story-bundle.mjs` 通过；vite build **built in 7.10s**；server tsc 通过。
- 关键产物：`three-*.js` 667.24 kB（gzip 172.68）、`main-*.js` 1,231.82 kB（gzip 418.49）。

## 3. WebGL 测试链路验证 ✅（带一个环境补丁）

**链路组成**：`scripts/run-web-tests.sh`（检测 DISPLAY→无则 xvfb-run 包装）→ playwright webServer 起 vite dev（127.0.0.1:4173）→ headed Chromium（`--use-gl=angle --use-angle=vulkan --enable-unsafe-swiftshader`）渲染 Three.js 城市。

**实测**：`story-gates.spec.ts › echo story entry stays suspended and the guide header stays hidden` — **1 passed（用例 53.2s，总 1.0m）**。该用例经 `waitForCityBooted` 等待 Three.js 场景 + 启动屏就绪，是 WebGL 上下文真实创建、城市真实渲染的最小端到端证明。日志中的 `ECONNREFUSED 127.0.0.1:8787`（/town-api 代理）为预期现象——web 测试不依赖 server，端点由用例自行 stub。

**环境补丁（重要）**：
1. `xvfb-run` 报 `xauth command not found` —— 本机无 root，无法 apt 安装。解法：免 root 从 debian 源 `apt-get download xauth libxmuu1` + `dpkg -x` 解包，以 `PATH` + `LD_LIBRARY_PATH` 注入。已固化到：
   `/home/z/my-project/agents/6a09d973255a98e13526d98b/webgl-env/`
   - `xauth-extracted/`：xauth 1.1.2 + libXmuu.so.1
   - `run-web-tests-fixed.sh`：包装器（注入上述环境 + `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`），用法与原脚本一致，已用 `--list`（179 tests / 40 files）与真实用例双验证。
2. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` 必须：原脚本先跑 `npx playwright install --with-deps chromium`，非 root 下 apt-get 失败会让脚本直接退出；浏览器实际已就位，跳过即可。
3. `/tmp` 可能随环境重建丢失：若 webgl-env 目录不在，按本节命令重下两个 deb 即可（各 <40KB）。

**对后续任务的含义**：WebGL 截图（DoD 视觉验收）完全可行——同一链路（Xvfb + SwiftShader + vite + `?dev=1`）即可产出建立镜头/俯视远景截图；单用例含城市启动约 1 分钟，性能与视觉验收的测试预算按此规划。注意 SwiftShader 是软件渲染，帧率不代表真实 GPU，DoD 的 FPS 数据需在报告里注明测量环境。

## 4. 对后续任务的注意事项

1. **Bash 网关限制（执行环境坑，非仓库问题）**：单次工具调用 >~100s 会被网关 504 杀掉（即使持续输出也拦不住），且会连带杀死前台进程树。**长命令必须 setsid 分离 + 落盘日志 + 短调用轮询**（实测 setsid 分离进程可跨调用存活）。typecheck/test/build 均已用此模式跑通。
2. **Node 24 vs engines 22.x**：当前仅告警。若未来某依赖开启 engine-strict，可 `npm config set engine-strict false` 或换 Node 22；基线阶段无需处理。
3. **worldTerrainAudit 基线**：48/48 全绿确认 keep-out 包围盒约束与 NAVIGABLE_AREA 快照在基线完好；后续任何地形改动以此测试为第一道防线。
4. **git 边界**：全程零 commit/push（遵守 GOAL.md / AGENTS.md 红线）；工作区在验证后保持干净（node_modules/dist/test-results 均被 gitignore）。
5. **服务端不动**：apps/server 依赖（better-sqlite3 等）已随 npm ci 装好且原生模块可用，但本任务未启动 server；web e2e 不依赖它。

## 5. 复现命令备忘

```bash
# 依赖（已完成，环境重建时重跑）
bash scripts/setup-deps.sh

# 三大检查（repo 根目录）
npm run typecheck
npm run test:domain
npm run build

# WebGL 测试（本机需走修复包装器）
bash /home/z/my-project/agents/6a09d973255a98e13526d98b/webgl-env/run-web-tests-fixed.sh
bash /home/z/my-project/agents/6a09d973255a98e13526d98b/webgl-env/run-web-tests-fixed.sh --grep "<用例名>"
```

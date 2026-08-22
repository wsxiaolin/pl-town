# MiniCity 代理协作指南

本文档面向在本仓库中工作的开发代理和协作者。规则以当前代码和配置为准；如果代码与本文档不一致，应优先检查实际实现并同步修订本文档。

## 项目概览

MiniCity 是一个 npm workspace，包含独立的前端和实时服务端：

```text
apps/
  web/       Vite + TypeScript + Three.js 前端
  server/    Node.js + TypeScript HTTP/WebSocket 服务端
data/        服务端运行时数据（被 Git 忽略）
docs/        隐私政策、使用条款等文档
```

前端负责 3D 城市渲染、交互、在线面板和 Physics Lab 数据展示；服务端负责 WebSocket 实时通信、临时身份、SQLite 持久化、住房关系，以及 `/town-api` HTTP 代理接口。

## 环境与启动

- 需要 Node.js 20 或更高版本。
- 拿到项目第一步先安装依赖，且安装与脚本准备要并发进行（后台跑安装的同时并行阅读文档、准备构建/测试/启动脚本）。
- 依赖安装优先使用 `scripts/setup-deps.sh`：它会按运行环境自动选择最快镜像（国内 npmmirror / 清华 PyPI / goproxy.cn，海外官方源），按锁文件执行 `npm ci` / `pnpm install --frozen-lockfile` / `yarn install --frozen-lockfile` 等，并初始化 submodule。检测到 Playwright 项目时还会安装完整版 Chromium 及 WebGL 测试所需系统库（`xvfb`、`mesa-vulkan-drivers`、`libgbm1` 等，需 root/apt；`--skip-browser` 可跳过）。也可在仓库根目录直接 `npm install`。
- `npm run dev` 同时启动前端（默认 `http://localhost:5173`）和服务端（默认 `http://localhost:8787`）。
- 只启动前端：`npm run dev -w @minicity/web`。
- 只启动服务端：`npm run dev -w @minicity/server`。
- 前端可用 `VITE_SERVER_URL` 指定 WebSocket 地址。
- 服务端配置：`HOST`、`PORT`、`DATA_DIR`；日志目录还可由 `LOG_DIR` 指定。默认数据库文件为数据目录下的 `minicity.sqlite`。

## 常用校验命令

提交前至少运行与改动范围匹配的校验：

```bash
npm run typecheck
npm run build
npm run test:web
npm run test:server
npm test                 # 前端 Playwright + 服务端集成测试
```

前端 Playwright 配置使用 Chromium、单 worker，并自动启动 `4173` 端口的 Vite 服务。`apps/web/tests/diagnostics/` 下的诊断脚本是按需运行的性能/视觉检查，不属于默认烟雾套件。

### WebGL / Headless 与 CI 并发

城市使用 Three.js / WebGL 渲染，headless Chromium（含 `--headless=new` 与 headless shell）无法创建 WebGL 上下文，因此测试套件以 **headed Chromium + Xvfb + SwiftShader（Vulkan/ANGLE 软件渲染）** 方式运行。本机有显示时 `npm run test:web` 直接可用；CI / 容器 / 无显示环境必须通过 `scripts/run-web-tests.sh` 包装（内部用 `xvfb-run --auto-servernum` 启动虚拟显示）：

```bash
scripts/run-web-tests.sh                 # 整套，默认单 worker
PLAYWRIGHT_WORKERS=4 scripts/run-web-tests.sh
scripts/run-web-tests.sh --shard=1/4     # 分片，配合 CI matrix
```

为避免在 GitHub CI 和不同 agent 机器上反复踩安装坑（Node 依赖、Playwright Chromium、xvfb、Vulkan/SwiftShader 系统库），所有依赖已打包进 `docker/test.Dockerfile`。镜像只预装稳定依赖、不拷贝源码，运行时挂载仓库即可复用：

```bash
docker build -f docker/test.Dockerfile -t pl-town-test .
docker run --rm -v "$PWD":/work -w /work pl-town-test scripts/run-web-tests.sh
```

CI 走 `.github/workflows/test.yml`：类型检查 / 构建 / 单元（domain）/ 服务端测试在 runner 上直接跑；Web Playwright 套件按 4 分片矩阵并发执行，每个分片在 Xvfb + SwiftShader 下运行并上传报告产物。分片数通过 matrix `shard/total` 控制，套件变长时调大 `total`。

新增或修改浏览器交互、布局、WebGL、端到端流程的测试时，注意：软件渲染下帧率偏低，涉及动画/位移的断言应使用 `expect.poll` 轮询而非固定 `waitForTimeout`；点击顶栏控件前必须经过 `waitForCityBooted`（等待启动屏淡出）；被画布拦截点击的控件使用 `click({ force: true })`。

### 全屏覆盖层与 WebGL 上下文

需要全屏覆盖效果（如火烧城市 `burnCityEffect`）时，**不要创建第二个 `WebGLRenderer`/独立 canvas**：SwiftShader 等软件渲染下多 WebGL 上下文极易触发 `webglcontextlost`，使效果在约 1 秒后中断。正确做法是把覆盖层接入主帧循环——在 `frameLoop` 城市渲染之后调用 `getBurnOverlay().render(renderer)`，用主 renderer 在默认帧缓冲上叠加一个 `depthTest:false` 的全屏 quad（`renderer.autoClear=false` 避免清掉城市）。覆盖层进度由 GSAP timeline 驱动；`burnCityEffect` 通过 `frameLoop` 的 `getBurnOverlay` 选项接入，点击 `writingclub_outer`（野生菌餐馆）经 `buildingInteraction` 路由到 `wildMushroomRestaurant` 剧情控制器触发。

## 代码组织与依赖方向

### 前端

- `src/main.ts` 是浏览器入口，负责启动和销毁 MiniCity 生命周期。
- `src/city/` 放置城市领域模型、场景编排和游戏逻辑。
- `src/rendering/` 放置 Three.js 场景、材质、灯光和渲染设置。
- `src/core/` 放置可复用的渲染/运行时基础设施。
- `src/network/` 放置多人 WebSocket 客户端和传输逻辑。
- `src/styles/` 是 CSS 入口；`src/assets/` 存放 GLB 等运行时资源。

保持依赖方向清晰：渲染层可以消费城市数据；数据/领域模块不应反向依赖 UI 或网络模块。修改 3D 场景时应同时考虑桌面和移动视口、画布尺寸、资源释放和 HMR 销毁逻辑。

### 服务端

- `src/index.ts` 是 HTTP/WebSocket 组合根和消息路由入口。
- `src/auth.ts` 负责账号认证、密码哈希和会话令牌。
- `src/db.ts` 是 SQLite 持久化边界。
- `src/config.ts` 读取环境变量并创建数据/日志目录。
- `src/logger.ts` 负责控制台及按日轮转的文件日志。
- `src/types.ts` 定义服务端消息和领域数据契约。

传输协议处理留在 `index.ts`；认证与持久化逻辑应保持为可独立测试的模块。修改 WebSocket 消息时，同步检查客户端类型、服务端校验、广播事件和相关集成测试。

## 数据与安全边界

- 不提交 `node_modules/`、`dist/`、`test-results/`、`playwright-report/`、运行时 `data/` 和 `logs/`。
- 不把会话令牌、密码、外部认证凭据写入日志或 URL。
- 服务端当前是单进程/单实例设计；不要在没有明确需求时引入跨实例状态或新的持久化协议。
- WebSocket 消息需要保留现有的 JSON、大小限制、频率限制和输入校验；新增接口应提供明确错误响应。
- 前端通过 Vite 代理访问本地 `/town-api`；部署到 GitHub Pages 时工作流使用 `BASE_PATH=/pl-town/`，修改资源路径或路由时需验证子路径部署。

## 修改与提交约定

- 先阅读目标模块及其 README，再进行最小范围修改；避免顺手重构无关代码。
- 优先使用现有 TypeScript 类型、辅助函数和模块边界，不重复实现认证、网络或渲染基础设施。
- 新增用户可见行为时补充 Playwright 烟雾测试；新增服务端协议或持久化行为时补充 `apps/server/tests/integration.mjs` 覆盖。
- 修改资源、渲染参数或响应式布局时，至少检查桌面和移动视口，并确认无控制台错误、横向溢出和空白 WebGL 画布。
- 提交前查看 `git status`，不要提交生成目录、数据库、日志或本地环境文件。

## 部署

`.github/workflows/deploy-frontend.yml` 在 `main` 分支 push 或手动触发时构建并部署前端到 GitHub Pages。该工作流使用 Node.js 20、重新安装 npm 依赖，并以 `BASE_PATH=/pl-town/` 构建 `apps/web/dist`。服务端不在此工作流中部署。

## AI 自动化工作流

仓库包含两个移植自 `NetLogo-Mobile/plweb2` 的 AI 自动化工作流，均使用 OpenCode CLI（`opencode-ai`）与 `skills` 工具（`npx skills update` 读取根目录 `skills-lock.json`）。两者在 CI 中独立运行，不依赖本地开发环境。

- **Auto-Fix（`.github/workflows/autofix.yml`）**：当 Issue 被打上 `autofix` 标签时触发。AI 代理按本指南修改代码、运行校验（`npm run typecheck` / `build` / `test:domain` / `test:server`，必要时 `test:web`），生成根目录 `conclusion.md`，随后由工作流自动创建 `autofix/issue-<n>-<run_id>` 分支、提交并以 `Resolves #<n>` 打开 PR。代理本身不得执行 `git commit` / `git push` / 创建 PR，这些由工作流统一完成。
- **AI PR Reviewer（`.github/workflows/auto-review.yml`）**：PR 创建或更新（`opened` / `synchronize`）时触发。AI 代理读取 `git diff` 与历史，按本指南审查代码质量并下发评论；审查是只读的，不修改代码。

`skills-lock.json` 声明了 `plweb-skill`（Physics Lab 社区 API 文档，来自 `NetLogo-Mobile/plweb-skill`）和 `code-review-skill`（来自 `awesome-skills/code-review-skill`）两个只读技能，为上述代理提供上下文。AI PR Reviewer 按 `opencode/deepseek-v4-flash-free`、`opencode/big-pickle`、`opencode/hy3-free` 的顺序尝试模型，统一使用 `variant high`；如需更换模型，应同步修改对应工作流，并保持只读技能的来源不变。

## 不确定事项

本文档未规定分支命名、提交消息格式、代码格式化工具或生产服务端部署方式，因为仓库中没有可确认的约定；需要这些规则时应先向项目维护者确认。

## 外部社区资料（严格只读）

社区相关功能可以参考以下两个**独立仓库**，但它们不是本仓库的依赖、workspace 或源码目录：

- `D:\plweb-skill`：`plweb-skill` 技能仓库，主要是 Physics Lab AR 社区 API 的只读文档（认证、用户、作品/内容、评论、消息、枚举和示例）。它描述 HTTPS JSON API、`physics-api-cn.turtlesim.com` 以及 Token/AuthCode 等协议细节。
- `D:\plweb2`：独立的 `plweb2 v2` 社区前端仓库，技术栈为 Vue 3、TypeScript、Vite、Vue Router、Vue I18n 和 Naive UI。`src/config/` 保存系统/用户配置；`src/services/` 保存 API、存储、弹窗、通知等服务；`public/` 保存静态资源。其 README 明确说明该项目只提供基础社区功能，不包含实验功能。

对上述路径只能执行读取、搜索和分析操作：不得编辑、删除、移动、生成文件，不得安装依赖，不得运行会改变其状态的脚本，也不得在其中启动开发服务。需要把参考信息带入 `pl-town` 时，只在当前仓库新增或修改代码/文档，并注明来源是外部只读参考。

## Agent 协作

本项目鼓励在任务可拆分时采用多 agent 并行协作。可选模型为 `gptsol` 或 `terra`，推理强度可按任务需要选择任意等级。主 agent 负责整合结果、处理冲突并完成最终验证；子 agent 不得擅自扩大修改范围、提交代码或改动外部只读仓库。

## Git 与命令执行边界

- 严禁代理擅自 `git commit`、`git push`、创建 PR 或修改远程仓库；只有用户明确提出时才可执行提交相关操作。
- 所有 `gh` 操作（push、PR 创建等）必须通过 Git credential helper 认证：先 `git credential fill` 取凭据，再经 `gh auth login --with-token` 注入 gh CLI，token 只走标准输入、不得硬编码或打印。严禁使用未认证的 GitHub 网络 API（如不带 token 调用 `api.github.com`）。详见 `.monkeycode/docs/agent-setup-guide.md`。
- 没有必要或用户明确要求时，不运行 Playwright。优先运行 `typecheck`、`build` 或服务端测试；只有涉及浏览器交互、布局、WebGL、端到端流程时才运行对应的 Playwright 测试。
- 启动任何 `server`、`vite`、`npm run dev`、预览或测试 Web 服务进程后，任务结束前必须停止自己启动的进程，并确认端口不再被该进程占用。不要杀掉用户或其他 agent 已启动的同名服务；启动前先检查端口和进程归属。

## 不确定信息的核实

AI 对事实、接口、依赖版本、运行参数、平台规则或外部项目行为不确定时，必须先进行网络搜索或查阅官方/一手资料，再作出实现决定；不得凭记忆臆测。搜索结果应尽量使用官方文档、项目源码或维护者发布的信息，并在代码注释、文档或最终说明中标明重要外部依据。网络搜索不得替代对当前仓库代码的阅读，也不得泄露本地凭据、令牌、用户数据或未公开配置。

## 当前前端模块边界

`apps/web/src/city/MiniCityApp.ts` 现阶段仍是组合根，负责启动、销毁、帧循环和跨模块装配。新增业务逻辑不得继续写入该文件；迁移完成前，只允许在这里保留必要的兼容 wrapper。

- `gameplay/`：严格 TypeScript 的任务、对话、条件、效果、存档适配和声明式内容，不依赖 DOM、Three.js、网络或 `localStorage`。
- `adapters/ui/`：对话、社区面板、多人和住房等 DOM/API 适配器，内部状态不能回流到 `gameplay/`。
- `city/navigation/`、`city/npcSystem.ts`：道路寻路、碰撞、NPC 生成、日程和巡逻行为。
- `city/progression/`：旧统计数据的兼容读写和迁移边界。
- `rendering/`：程序纹理、建筑网格工厂、城市装饰和场景视觉资源。
- `city/data/`、`gameplay/content/`：配置和内容目录，可以较长，但不得承载运行时业务逻辑或函数回调。

## 逻辑文件体积

根脚本 `npm run check:source-size` 扫描前后端源码：普通逻辑文件上限为 1,000 行，迁移期的 `MiniCityApp.ts` 上限为 2,000 行；`data/` 和 `content/` 配置目录豁免。该检查已接入根级 `npm run typecheck` 和 `npm run build`。超过限制时，应按职责拆分模块，而不是把逻辑伪装成配置。

## 前端迁移验证

涉及领域规则或模块边界时，至少运行 `npm run check:source-size`、`npm run typecheck`、`npm run test:domain` 和 `npm run build`。只有修改浏览器交互、布局、WebGL 或端到端流程时才运行 `npm run test:web`；如果环境无法启动 Chromium，应在交付说明中明确记录。

## 3D 渲染：远镜头下的 z-fighting

所有 agent 在改动画布内容或场景几何时，必须严肃考虑**远镜头（拉远视角 / 全图视野）下的 z-fighting（深度冲突、深度闪烁）**问题：

- 任何新增或修改的平面、贴地网格、道路标记或覆盖层，不要与其他表面共用完全相同的 `y` 高度。`apps/web/src/rendering/layers.ts` 的 `SURFACE_Y` 各层之间必须保留明确、足够的 Y 差（例如 plaza 与 landscape 至少相差 0.004）。
- 当多个表面在同一高度或极近高度叠加、且都依赖 `renderOrder` 或 `depthWrite=false` 时，远镜头拉远或相机移动过程中会出现帧间闪烁的正方形 / 覆盖层重影。
- 修改贴地覆盖层前，先在脑中模拟全图视野（`cameraZoom` 拉大到 15 左右）与接近地面视野两种情况，确认不会出现上述闪烁；涉及可见改动的提交建议至少手动拉一次远视图核对。
- 排查疑似 z-fighting 时，优先检查是否存在 `y` 完全相等或差值小于 0.001 的共面网格，而不只是改纹理或颜色。

## CSS 模块化

前端样式已按组件/功能领域拆分为小文件，不再使用单个大文件。入口 `apps/web/src/styles/index.css` 通过 `@import` 按级联顺序引入 `apps/web/src/styles/modules/` 下的各模块：

- `base.css`：reset、`:root` 变量、`body.night` 基础覆盖。
- `boot.css`：首屏启动动画（boot screen）。
- `works.css`：文化档案抽屉（civic archive / writer catalog）。
- `canvas.css`：主画布 `#c` 与触屏摇杆。
- `phone.css`：居民手机（多人在线、住宅认领）。
- `chat.css`、`housing.css`：公聊与住宅列表/卡片。
- `labels.css`：Three.js → 2D 投影的建筑标签层。
- `chrome.css`：顶部 UI chrome（logo、导航、时间、设置）。
- `city-map.css`：纸质全景地图覆盖层。
- `welcome.css`、`reduced-motion.css`：欢迎语块与 `prefers-reduced-motion`。
- `login.css`：登录覆盖层与 logo 用户标签。
- `stats.css`：统计面板、渲染设置抽屉、商店/库存、人口过滤、解锁 toast 等右侧面板相关样式（较大，约 520 行）。
- `cg.css`：CG 片头动画「城之诞生」。
- `modal.css`：建筑详情纸质弹窗。
- `lyrics.css`：音乐厅歌词舞台。
- `memorial.css`：永退用户纪念碑长卷 overlay。
- `npc.css`：NPC 对话面板（含 story-mode / cg-mode / blackout-mode）。

新增样式优先放入对应模块文件，单个文件目标 50–60 行，较大组件可到几百行但不建议超过 ~600 行。新增模块需在 `index.css` 中按视觉/级联需要追加 `@import`，保持 import 顺序与原单文件顺序一致，避免层叠覆盖意外变化。CSS 文件不在 `check:source-size` 扫描范围（仅扫描 `.ts/.tsx/.js/.mjs`），但仍应遵循同样的拆分原则。

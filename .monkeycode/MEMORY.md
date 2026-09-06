# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-09-06
- Context: 首次发起新手引导 PR 后，用户要求后续都先等 CI
- Instructions:
  - 首次发起 PR 后，前台长时间等待到该 PR 的 CI 跑完，再查看审查意见和 CI 结果。
  - 不要在 CI / 自动审查结束前声称 PR 已处理完毕。

[Project Knowledge Summary]
- Date: 2026-08-16
- Context: Discovered by Agent while converting lab_outer into a memorial monument, then debugging why the app would not boot (`Cannot access 'clamp' before initialization`)
- Category: Troubleshooting & Debugging
- Instructions:
  - In `apps/web/src/city/MiniCityApp.ts` (a `@ts-nocheck` monolith), module-top-level `const roadNavigation = createRoadNavigationSystem({...})` and its destructured helpers (`clamp`, `buildRoadPath`, `nearestRoadCoord`, `FOUNTAIN_CLEAR`, etc.) MUST be declared BEFORE any module-top-level call that references them in an object literal (e.g. `createEventBindings({..., clamp, ...})`), otherwise a TDZ `Cannot access ... before initialization` error is thrown at load and the whole city fails to boot.
  - This ordering was wrong on `origin/main`; the fix moved the `roadNavigation` block above `createBuildingInteraction`/`createEventBindings`.
  - Headless Playwright (chromium headless shell) needs `npx playwright install chromium --with-deps`; without it, `browserType.launch` fails on the missing headless shell binary.

[Project Knowledge Summary]
- Date: 2026-08-17
- Context: Discovered by Agent while reworking the NPC edit-request page into the frontend multi-page app per review feedback
- Category: Operations & Deployment
- Instructions:
  - The web app and server are intended to be deployed on the same server eventually; GitHub Pages / `BASE_PATH` is not the production target to design around.
  - The NPC edit-request page lives in `apps/web` as a Vite MPA entry (`index.html` + `npc-edit-request.html` built together); the server exposes only the `/town-api` endpoints and the admin console, with no hand-written duplicate of the page.

[User Instruction Summary]
- Date: 2026-08-18
- Context: Debugging CI and building interaction behavior
- Instructions:
  - Before changing workflow or application behavior, inspect the actual failure logs and confirm the root cause.
  - Keep unrelated configuration unchanged and avoid speculative fixes.

[Project Knowledge Summary]
- Date: 2026-08-20
- Context: Discovered by Agent while pushing branch `260819-feat-texture-rendering-weather` and creating PR for pl-town
- Category: Environment Configuration
- Instructions:
  - GitHub repository `wsxiaolin/pl-town` is cloned via HTTPS; the git credential helper (`/app/agent/bin/agent git-credential-helper`) can supply GitHub credentials via `git credential fill` — pipe the resulting password into `gh auth login --with-token` (credentials must go through stdin, never printed or hardcoded).
  - Git identity for this repo: `user.name=wsxiaolin`, `user.email=monkeycode-ai@chaitin.com` (set locally in the repo).
  - PR for the texture/weather branch is https://github.com/wsxiaolin/pl-town/pull/100.

[User Instruction Summary]
- Date: 2026-08-22
- Context: 用户要求为所有 agent 建立依赖安装与 GitHub 提交的统一约定，配套文档在 `.monkeycode/docs/agent-setup-guide.md`，脚本在 `scripts/setup-deps.sh`
- Instructions:
  - 拿到项目第一步先装好依赖，依赖安装与脚本准备要并发进行：后台终端跑安装的同时并行阅读文档、准备构建/测试/启动脚本，装完先验证环境可用再改代码。
  - 依赖安装必须按运行环境自动选择合适镜像（国内 agent 用 npmmirror / 清华 PyPI / goproxy.cn，海外 agent 用官方源），优先调用 `scripts/setup-deps.sh`。
  - 所有 gh 操作（push、PR 创建等）必须走 Git credential helper：`git credential fill` 取凭据，再经 `gh auth login --with-token` 注入 gh CLI，凭据只走标准输入、不得硬编码或打印。
  - 严禁使用未认证的 GitHub 网络 API（如不带 token 调用 api.github.com）。

[User Instruction Summary]
- Date: 2026-08-27
- Context: 用户要求在思考时统一以 "we need..." 开头
- Instructions:
  - 所有内部思考（thinking）必须从 "we need..." 开始。

[Project Knowledge Summary]
- Date: 2026-08-27
- Context: Discovered by Agent while debugging sea disappearing after ponds got mirror water shaders (PR #117)
- Category: Troubleshooting & Debugging
- Instructions:
  - three.js 场景中同时存在多个 `Water` mirror 对象时，各自的 `onBeforeRender` 会把整个场景重渲染到各自的镜像渲染目标，镜像互相嵌套破坏彼此，导致水面消失/错乱。全场景只保留一个 mirror `Water` 对象。
  - 池塘等小水面用无镜像的轻量 ShaderMaterial 动画水面（`createPondWaterSurface`，位于 `apps/web/src/rendering/animatedWater.ts`），海面（westBeach）保持唯一 mirror `Water`。

[Project Knowledge Summary]
- Date: 2026-09-04
- Context: Discovered by Agent while doing automated headless WebGL z-fighting verification for the building facade flicker fix (PR #124)
- Category: Testing Methods
- Instructions:
  - SwiftShader（`chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args:['--enable-unsafe-swiftshader']})`）下页面加载到 city-ready 需 3-5 分钟，`page.screenshot` 需显式 `timeout: 180000` 且视口 ≤960×600；脚本收尾必须 `process.exit(0)` 并跳过 `browser.close()`（会挂死）。
  - 开场 CG（5 幕 GSAP 时间线）在 SwiftShader 下永远走不完：帧间隔数秒时 GSAP lagSmoothing 每帧只推进 33ms 时间线。Playwright `reducedMotion:'reduce'` 无效，因为 `MiniCityApp.ts:87` 硬编码 `REDUCED=false`。唯一可靠跳过：`page.addInitScript` 预置 `localStorage.minicityCGSeenV3='true'`（cg.ts shouldShowCG）与 `minicityUser`（loginController.checkLogin 直接 proceed）。注意 `multiplayerHousingController` 会 `removeItem('minicityUser')` 再次弹出登录，全自动进城仍未打通；对场景图测量类验证无影响（不依赖可见画面）。
  - z-fighting 排查可直接做场景图 AABB 扫描而非截图：垂直立面平面（facade，polyOffset 材质）与细节盒的穿越即闪烁类；y@0.0000 地面接触为良性（底面被背面剔除）。建筑入场动画把 group 停在 y=-3，测量前需强制置 0；立面网格晚于 tagMeshes 添加，归属需沿父组后代 userData.buildingId 推断。脚本存于 /tmp/opencode/flicker/（detect.cjs、shot.cjs）。

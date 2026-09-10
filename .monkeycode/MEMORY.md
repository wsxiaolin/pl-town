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

[User Instruction Summary]
- Date: 2026-09-06
- Context: 修复 PR 后验证 CI
- Instructions:
  - CI 验证以远端 GitHub Actions 结果为准，不再主动运行本地 CI 测试。
  - 等待远端 CI 时使用前台 `sleep` 轮询状态。

[User Instruction Summary]
- Date: 2026-09-07
- Context: 处理 PR #129 的 stack 冲突并新建 PR #140
- Instructions:
  - 只能创建/维护 PR，禁止代替用户执行 merge。
  - PR 创建后要等 CI 和 AI review 完成；确认无 Blocker、状态 MERGEABLE 后再交给用户合并。

[Project Knowledge Summary]
- Date: 2026-09-07
- Context: Discovered by Agent while diagnosing PR #129 stuck UNKNOWN/blocked because stack base #127 conflicted with main
- Category: Troubleshooting & Debugging
- Instructions:
  - 堆叠 PR 的 base 分支与 main 冲突时，下游 PR 会长时间 UNKNOWN/无法合并；应将下游分支 rebase 到最新 main 后新开直连 main 的 PR。
  - integration.mjs 中 Physics Lab stub 使用独立端口；不要复用 8793（origin server 也用该端口），当前用 8794。

[Project Knowledge Summary]
- Date: 2026-09-08
- Context: Discovered by Agent while pushing commits to PR #140 branch on 09-07 and 09-08, both times `pull_request synchronize` produced no workflow runs
- Category: Troubleshooting & Debugging
- Instructions:
  - 本仓库 push 到已开 PR 的分支后，`pull_request synchronize` 事件偶发不触发（连续两天复现），表现为 `gh run list` 无新运行。
  - Tests 工作流有 `workflow_dispatch`，可用 `gh workflow run test.yml --ref <branch>` 手动触发，但手动触发的运行不会出现在 `gh pr checks` 里，需用 `gh run view <id>` 单独确认结果。
  - AI PR Reviewer 只监听 `pull_request: [opened, synchronize]` 且无 `workflow_dispatch`，事件被吞时无法补触发；审查基于旧提交时需向用户说明增量改动范围。
  - 前端生产/预览构建通过 `deploy-frontend.yml` 注入 `VITE_SERVER_URL: wss://pl-town.onrender.com`，即 PR 预览站也连 Render 生产后端；后端新功能在 PR 合并前无法在预览站验证。

[Project Knowledge Summary]
- Date: 2026-09-09
- Context: Discovered by Agent while fixing recurring shard-3 failure of PR #142 (onboarding-tutorial.spec)
- Category: Troubleshooting & Debugging
- Instructions:
  - 自写 WebSocket stub 必须在 constructor 里 queueMicrotask 触发 open 事件（参照 tests/helpers.ts:69），否则 MultiplayerClient 停在 CONNECTING、hello 永不发送；gate 流程下表现为登录按钮卡「正在核实身份…」且手机面板显示「连接中」。
  - 排障路径：CI 失败先下载 `test-results-shard-N` artifact 看 error-context.md 页面快照，再对比 stub 与 helpers 差异；本地 Xvfb 复现受限（无 GPU 下 page.goto 60s 超时），以 CI 快照为准。

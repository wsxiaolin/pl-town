# 声明式剧情接入指南

MiniCity 的长篇分支剧情使用独立的 StoryRuntime。普通线性任务继续使用 QuestRuntime；不要把长篇剧情塞进 `MiniCityApp.ts` 或 NPC 回调。通用运行时在 `apps/web/src/gameplay/stories/`，通用 DOM 流程在 `apps/web/src/adapters/ui/stories/`；Echo 仅是 `apps/web/src/city/echo/` 下的剧情适配器，正文数据在 `apps/web/src/gameplay/content/stories/echo/`。

## 内容与进度边界

- 客户端 `gameplay/content/` 保存完整文本、节点、选项和成就定义。
- `gameplay/stories/` 保存纯 TypeScript 类型和状态转换，不依赖 DOM、Three.js、网络或本地存储。
- `adapters/ui/cloudStoryController.ts` 负责把节点渲染到现有对话框，并通过 WebSocket 保存选择。
- 服务端只保存 `storyId`、`definitionVersion`、`nodeId`、flags、ending、visitCount 和时间戳，不保存正文。

## 新增一条剧情

1. 在 `apps/web/src/gameplay/content/<story>/` 导出一个 `StoryDefinition`。
2. 为剧情、节点、选项、旗标和成就使用稳定的 ASCII ID，例如 `story.sample`、`intro.meet`。
3. 节点只声明文本和目标节点；不要在内容文件里放函数回调。
4. 用 `createCloudStoryController` 创建云端适配器，并把对应 NPC 或兴趣点交互转给它的 `open` 方法。
5. 需要服务器成就时，把 ID 加入 `apps/server/src/progression.ts` 的奖励目录。
6. 至少覆盖起点、每个互斥结局、旗标合并、回访计数和重连恢复测试。

## 协议

客户端先发送 `story.get`，选择后发送 `story.update`。服务端统一返回 `story.updated`。正文不会进入网络或数据库，因此可以独立修订文案；节点结构变化时提高 `definitionVersion`，并保留旧节点迁移或兼容逻辑。

具体剧情内容应放在 `apps/web/src/gameplay/content/` 下的独立目录中。

## 剧情暂停与恢复（以「回声」为例）

「回声」（`main.echo.act-one`）当前处于**暂停态**：剧情正文（1011 行 `echoStory.ts`）、真控制器（`echoStoryController.ts`）与 2.3MB CG 完全不进任何构建产物——不是"运行时不加载"，是产物里物理不存在。编译期开关 `__ECHO_STORY_SUSPENDED__`（`vite.config.ts` define 注入）把 `storyOrchestration` 的动态加载分支折叠删除，运行时由 `echoSuspendedController.ts` 占位：林辙交互弹「调整中」toast，存档保留。

**恢复上线（三处同批提交，清单互见 `vite.config.ts` / `bundledAssets.ts`）**：

1. `vite.config.ts`：`__ECHO_STORY_SUSPENDED__` 改回 `'false'`（或删掉 env 覆盖逻辑）
2. `bundledAssets.ts`：glob 删除 `!../assets/cg/echo/**` 排除项
3. `tests/story-gates.spec.ts` 第一个用例改写为恢复态断言

真控制器转懒加载（`import('./echo/echoStoryController')`），主包仍不含剧情文本。注意懒加载 chunk 落地前的窗口期内林辙仍弹「调整中」（见 storyOrchestration 的 bootstrapEcho 时序处理——`echoBootstrapped`/`echoBootScene` 双标志覆盖两种到达顺序）。

**验证命令**：

- 暂停态：`npm run build` —— `scripts/check-story-bundle.mjs` 自动断言零打包（CG 文件探针 + 正文句子探针），任何泄漏构建即红
- 恢复态：`ECHO_STORY_SUSPENDED=false npm run build` —— 守卫自动跳过，人工核对懒加载 chunk 正常 emit；`ECHO_STORY_SUSPENDED=false npm run dev` 可本地全流程走通恢复态剧情

id 常量 `ECHO_STORY_ID` 在 `gameplay/content/stories/echo/echoStoryMeta.ts`（无正文无资产的微模块，唯一进主包的 echo 文件）；服务端 `storyCatalog.ts` 镜像同一 id（跨包独立编译，注释互指）。

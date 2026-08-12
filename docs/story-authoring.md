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

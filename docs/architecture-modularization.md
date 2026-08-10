# MiniCity 模块化演进设计

## 目标与现状

MiniCity 下一阶段需要承载主线与知县剧情、支线、剧情道具、建筑功能、解谜、背包、城区扩张、城市成长、成就和分支对话。当前 `apps/web/src/city/MiniCityApp.ts` 同时负责渲染、场景创建、NPC、寻路、DOM、网络、存档、解锁和成就，并通过 `// @ts-nocheck` 绕过严格类型检查。继续向这个文件增加业务规则会让内容无法独立校验，也会让存档、UI 和 Three.js 相互锁死。

本设计采用渐进迁移。`MiniCityApp.ts` 暂时保留为组合根，新功能先进入严格类型检查的纯领域模块，再逐步把旧逻辑迁出；不进行一次性重写。

## 目标依赖方向

```text
content (纯数据)
   |
   v
gameplay (纯 TypeScript 规则与状态机)
   ^
   |
adapters (DOM / Three.js / localStorage / WebSocket / HTTP)
   ^
   |
app (生命周期、装配、帧调度)
```

- `content/` 不得导入 DOM、Three.js、网络或存储，也不得保存函数。
- `gameplay/` 不直接读取系统时间、`localStorage`、DOM 或场景；外部通过事件、时钟和 repository 端口注入。
- `adapters/` 将领域状态投影到画面和 UI，并把点击、进入区域、取得道具等行为转换为领域事件。
- `app/` 只负责创建依赖、启动/停止系统和安排更新顺序，不实现任务或成就规则。

## 目标目录

```text
apps/web/src/
  app/
    MiniCityApp.ts
    createGame.ts
  gameplay/
    core/                 # GameEvent、GameState、时钟、命令和事件总线
    narrative/            # 稳定节点 ID 的对话图、条件与效果解释器
    quests/               # 主线/支线共用任务状态机
    inventory/            # item catalog、堆叠、容量、发放与消耗
    puzzles/              # PuzzleSession 及 puzzle.solved 事件契约
    progression/          # 成就、城区/建筑解锁、城市成长计划
    world/                # NPC、建筑实例、城区、交互意图与导航
    persistence/          # 版本化 GameState 和迁移
    content/
      quests/main/
      quests/side/
      dialogues/
      npcs/
      items/
      buildings/
      districts/
  adapters/
    three/                # 场景、实体视图、拾取、相机和材质
    ui/                   # 对话、背包、任务、成就和建筑面板
    storage/              # localStorage，未来可替换为服务端存档
    network/              # 多人 WebSocket
    community/            # Physics Lab HTTP API
```

当前首批代码位于 `gameplay/quests/` 和 `gameplay/content/quests/`。目录会随着旧模块迁移逐步补齐，禁止先创建无实现的空壳层。

## 统一状态与事件

长期存档必须以一个版本化 `GameState` 为权威源，至少包含：

```ts
interface GameState {
  schemaVersion: number;
  revision: number;
  player: { id: string; counters: Record<string, number> };
  flags: Record<string, boolean | number | string>;
  quests: Record<string, QuestProgress>;
  inventory: Record<string, number>;
  achievements: string[];
  unlockedDistricts: string[];
  unlockedBuildings: string[];
  worldChanges: Record<string, unknown>;
  recentEventIds: string[];
}
```

所有业务推进来自判别联合事件，例如 `npc.interacted`、`dialogue.option-selected`、`building.visited`、`item.acquired`、`puzzle.solved`。事件必须带唯一 `id` 和调用方注入的时间，reducer 使用有限事件 ID 队列实现幂等。UI toast、场景生成和音效是 reducer 输出后的表现层效果，不写入规则函数。

## 系统边界

- 主线、知县剧情和支线使用同一 QuestEngine。主线只增加章节、优先级和分支锁，不创建第二套任务系统。
- 分支台词由 DialogueEngine 根据条件选择稳定节点；选项只声明 effects，不允许 `onPick`。
- 剧情道具属于 InventorySystem，通过 item tags 和 quest binding 表达用途，不建立独立的“剧情物品数组”。
- 解谜模块只管理谜题会话，完成后发出 `puzzle.solved`；任务引擎决定其剧情含义。
- 建筑使用全局唯一 `instanceId`，并分离 `archetypeId`、`contentId` 和 `featureIds`。当前重复建筑 ID 必须在城区解锁前迁移，否则存档无法区分实例。
- 建筑功能由 `BuildingFeatureRegistry` 注册，如 `archive`、`shop`、`housing`、`lab`、`quest-gate`；不继续扩大 `navigateTo` 的 ID 分支。
- 城区解锁是持久化事实。Three.js 场景根据事实幂等创建/移除城区，规则层不保存 `addTree()` 一类渲染函数。
- 单人剧情进度当前由本地存档权威管理；只有明确需要跨设备或多人共享时才扩展服务端协议。

## 分阶段迁移

1. **领域地基**：加入稳定 ID、Quest/Event/Condition/Effect 契约、catalog 校验、版本化任务存档和纯单元测试。以一条阿紫支线纵向验证 NPC -> 建筑 -> NPC 流程。
2. **统一存档**：引入 `GameState`、repository 和迁移器；从旧 `minicityStats` 单次读取并迁移，之后只写新存档。损坏存档应保留备份并回退默认值。
3. **对话引擎**：把数组下标 `next` 迁移为字符串节点 ID；先迁移任务 NPC，其余约两百名 NPC 继续通过 legacy adapter 工作。
4. **进度系统**：迁出成就和解锁条件，将当前直接调用 Three.js 的 `UNLOCK_TIERS` 改为声明式效果，并保证刷新后可幂等重建。
5. **交互与世界**：以 `InteractionIntent` 统一 NPC、建筑、道具和谜题触发；拆分导航、NPC schedule/spawn 和 building feature。
6. **渲染与 UI**：把实体视图、建筑工厂、对话/任务/背包面板迁到 adapter；最终让组合根只保留生命周期并移除 `@ts-nocheck`。

## 每阶段验收门槛

- 新领域代码必须通过 strict TypeScript，且无 DOM、Three.js、网络和存储实现依赖。
- catalog 校验 ID 唯一、引用存在、节点/阶段可达、数量合法，并拒绝函数值。
- reducer 单测覆盖未接取不推进、重复事件不重复奖励、多阶段顺序、完成幂等和坏存档恢复。
- 修改浏览器交互或布局时再运行 Playwright；纯规则迁移优先执行 `npm run test:domain`、`npm run typecheck` 和 `npm run build`。
- 每次迁移后记录旧存档兼容策略，不允许长期双写两个权威状态源。
- 城区扩张前必须解决重复 building ID；服务端同步前必须明确本地与服务端的权威边界。


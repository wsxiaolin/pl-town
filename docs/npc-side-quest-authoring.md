# NPC 支线任务编写规范

## 文件与职责

- 一个支线一个定义文件，放在 `apps/web/src/gameplay/content/quests/side/`；当前样例目录尚为单文件 catalog，任务数量增加到第二条时再按任务拆文件。
- `QuestDefinition`、状态和事件类型位于 `apps/web/src/gameplay/quests/types.ts`。
- 任务状态转换位于 `gameplay/quests/questEngine.ts`，浏览器存储仅由 `adapters/storage/LocalStorageQuestJournalRepository.ts` 负责。
- NPC 展示、日程和出生位置仍属于 NPC 内容；任务台词、条件、目标和奖励属于任务定义。

内容文件只能是可序列化数据。禁止函数、闭包、DOM 节点、Three.js 对象、`fetch`、`localStorage` 或 `Date.now()`。副作用必须使用已登记的 `QuestEffect` 类型，由系统 adapter 执行。

## ID 规范

- 任务：`side.<npc>.<topic>` 或 `main.<chapter>.<topic>`，例如 `side.azi.night-lights`。
- 阶段和目标 ID 在所属任务内唯一，使用稳定语义名，例如 `inspect-research`、`visit-research`。
- NPC、建筑、道具、谜题和城区引用必须使用 catalog 中的稳定 ID，不使用显示名称或数组下标。
- ID 发布后不可因文案调整而变更；存档依靠 ID 恢复进度。

## 生命周期

```text
not started (派生，不存储)
    -> NPC offer
active
    -> objective events
ready
    -> receiver NPC completion
completed
```

`available`/`not started` 由任务定义、前置条件和存档实时推导，不持久化。首版明确不支持 repeatable 任务；`repeatable` 必须为 `false`。失败和放弃状态已预留，但在有明确产品规则前不提供入口。

事件只推进“事件发生前已经 active”的任务。因此玩家点击接受任务时，不会用同一次点击意外完成首个“与 NPC 交谈”目标。任务接取、目标推进和完成都是幂等操作；同一个事件 ID 只处理一次。

## 定义示例

```ts
export const quest = {
  schemaVersion: 1,
  definitionVersion: 1,
  id: 'side.azi.night-lights',
  kind: 'side',
  title: '夜灯传闻',
  summary: '替阿紫调查研究院深夜不熄的灯。',
  giverNpcId: 'azi',
  receiverNpcId: 'azi',
  offer: {
    optionLabel: '支线：调查夜灯传闻',
    text: '任务邀约台词',
    confirmLabel: '接受任务',
    confirmedText: '接受后的台词',
  },
  completion: {
    optionLabel: '汇报调查结果',
    text: '交付前台词',
    confirmLabel: '交付任务',
    confirmedText: '完成后的台词',
  },
  stages: [{
    id: 'inspect-research',
    title: '前往研究院',
    description: '调查灯光。',
    objectives: [{
      id: 'visit-research',
      description: '访问研究院',
      target: { type: 'building.visited', buildingId: 'research' },
      required: 1,
    }],
  }],
  repeatable: false,
} as const satisfies QuestDefinition;
```

可用目标事件为 NPC 交互、对话选项、建筑访问、区域进入、取得道具和完成谜题。`required` 必须是正整数；道具事件按 quantity 累加，其余事件每次累加 1。

## 条件与奖励

前置条件当前预留：完成指定任务、flag 值、物品数量、成就、建筑解锁和城区解锁。多个前置条件按全部满足处理。需要 `any`/`not`、时间窗或统计阈值时，应先扩展统一 Condition evaluator 和测试，再用于内容。

奖励当前预留：设置 flag、增减物品、解锁成就、建筑和城区。内容可以声明奖励，但只有对应 effect executor 已接入统一 GameState 后才能发布该任务；不得在 UI 点击回调中临时写存档。

## 新任务检查清单

1. 使用永久稳定且唯一的任务、阶段、目标 ID。
2. 确认 giver/receiver NPC 和所有建筑、道具、谜题引用已存在。
3. 保证每个阶段至少一个目标，目标数量为正整数。
4. 不在内容中加入函数或直接副作用。
5. 为接取、未接取不推进、目标完成、回访交付和重复事件补纯单元测试。
6. UI 真正新增交互分支时，再补一条 Playwright 冒烟测试覆盖玩家路径。
7. 修改 definitionVersion 时同时提供旧 QuestProgress 的迁移策略。

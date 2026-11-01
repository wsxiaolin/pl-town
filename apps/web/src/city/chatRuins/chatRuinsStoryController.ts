import {
  CHATRUINS_CHAT_FOUNDING_DAY,
  CHATRUINS_CHAT_POOL,
  CHATRUINS_CHAT_POOL_S009,
  CHATRUINS_EMPTY_INPUT_HINT,
  CHATRUINS_GRAFFITI_BASE_COUNT,
  CHATRUINS_GRAFFITI_MAX_LENGTH,
  CHATRUINS_GUIDE_C,
  CHATRUINS_OPENING_B,
  CHATRUINS_STORY,
  CHATRUINS_VARIANT_TABLE,
  S009_COMPLETED_ACHIEVEMENT,
} from "../../gameplay/content/stories/chatRuins/chatRuinsStory";
import type { StoryConditionContext, StoryEvent } from "../../gameplay/stories/types";
import { LocalStorageStoryRepository } from "../../adapters/storage/stories/LocalStorageStoryRepository";
import { createStoryDialogFlow } from "../../adapters/ui/stories/storyDialogFlow";
import type { CityDialogController } from "../../adapters/ui/cityDialogController";
import { CHATRUINS_AREA } from "../data/cityConfig";

/**
 * S001 会沉的城 · 支线剧情适配器
 *
 * 职责：
 *  - 持有 StoryDefinition 和本地存档 Repository（流程节点：门楣/发掘/反应/墓碑/终局）
 *  - NPC 状态机（laxy 瓦 S0-S3 态、墓碑先生未完成/已完成态）按故事文档写死，
 *    全部走自定义 openStory（NPC 对话不推进剧情主线）
 *  - 涂鸦墙自定义面板（计数器 26532 + 12 字输入 + 3 预设按钮）
 *  - 接近触发轮询：laxy 瓦 10m 强制开场白、墓碑先生 5m 隐藏台词（60s 冷却）
 *
 * 接入方式：
 *  - 建筑交互（遗迹→门楣）由 storyRouter 转入 interactBuilding
 *  - NPC 交互（laxy 瓦、墓碑先生）由 routeNpcDialog 转入 interactNpc
 *  - 兴趣点（发掘点①-⑤走 StoryDefinition.worldInteractions；涂鸦墙由本控制器拦截）
 *  - tick(getDialogs) 由 MiniCityApp 帧循环低频调用（内部 800ms 节流）
 *
 * 跨案咬合：
 *  - s001_completed 对外输出 = 成就 s001_sunken_city（S028 用 achievement.unlocked 消费）
 *  - 闲聊池第 4 条需 S009 鸽咖完成（S009_COMPLETED_ACHIEVEMENT，对侧未实装时自然休眠）
 *
 * @see docs/story-authoring.md
 */
export function createChatRuinsStoryController(options: {
  awardAchievement?: (achievementId: string, name: string) => void;
  showToast?: (message: string) => void;
  getQuestContext?: () => StoryConditionContext;
  onActorsChanged?: () => void;
  /** 涂鸦提交成功后领取「两支持欠条」（服务端 ONE_TIME_REWARDS.s001_iou）。 */
  claimReward?: (rewardId: string) => boolean | Promise<boolean>;
  /** 核对欠条物品是否已到账（断线重试时避免重复领取）。 */
  hasItem?: (itemId: string) => boolean;
  /** 玩家当前位置（接近触发用）。 */
  getPlayerPosition?: () => { x: number; z: number } | null;
  /** 城市对话框惰性引用（接近触发自动开对话用）。 */
  getDialogs?: () => CityDialogController | null;
  /** 兴趣点激活集合上报（与回声剧情合并后驱动场景标记显隐）。 */
  setStoryPoints?: (ids: readonly string[]) => void;
}) {
  const repository = new LocalStorageStoryRepository(CHATRUINS_STORY);
  const flow = createStoryDialogFlow(CHATRUINS_STORY, repository, {
    getContext: options.getQuestContext,
    onEvent: (event) => handleEvent(event),
    // 涂鸦墙不在 worldInteractions 表里：到 wall-open 时把它一并激活，
    // 玩家才看得到 hitbox 并把点击交给 interactWall。
    onWorldInteractionsChanged: (ids) => options.setStoryPoints?.(
      flow.state().nodeId === "wall-open" ? [...ids, "chatruins-wall"] : ids,
    ),
  });

  // ── 常量（与建筑 chatruins (-33,-47.5) 和 CHATRUINS_AREA 共用坐标）──
  const LAXY_POSITION = { x: CHATRUINS_AREA.laxy[0], z: CHATRUINS_AREA.laxy[1] };
  const TOMBSTONE_POSITION = { x: CHATRUINS_AREA.tombstone[0], z: CHATRUINS_AREA.tombstone[1] };
  const LAXY_FORCE_RADIUS = 10;
  const TOMBSTONE_REVEAL_RADIUS = 5;
  const TOMBSTONE_COOLDOWN_MS = 60_000;
  const TICK_INTERVAL_MS = 800;

  const PRESETS_CACHE_KEY = "chatruins.wall.presets";
  const MY_GRAFFITI_KEY = "chatruins.my-graffiti";
  const TOMBSTONE_ANSWERED_KEY = "chatruins.tombstone-answered";
  const IOU_PENDING_KEY = "chatruins.iou-pending";
  const IOU_AWARDED_KEY = "chatruins.iou-awarded";
  const IOU_ITEM_ID = "iou_two_supports";

  let lastRevealAttemptAt = 0;
  let tickTimer: ReturnType<typeof setInterval> | undefined = undefined;
  let chatPoolCursor = 0;

  const ACHIEVEMENT_NAMES: Record<string, string> = {
    "s001_relic_key": "会沉的城",
    "s001_archaeologist": "考古学家",
    "s001_iou_holder": "两支持欠条",
    "s001_sunken_city": "不散的人",
  };

  function handleEvent(event: StoryEvent): void {
    const award = (id: string) => options.awardAchievement?.(id, ACHIEVEMENT_NAMES[id] ?? id);
    if (event.type === "s001.achievement.relic-key") award("s001_relic_key");
    if (event.type === "s001.achievement.archaeologist") award("s001_archaeologist");
    if (event.type === "s001.achievement.sunken-city") award("s001_sunken_city");
    if (event.type === "s001.reward.iou") {
      // 先落盘待领取标记：断线/超时后刷新或重新联网仍能重试。
      writeJsonStore(IOU_PENDING_KEY, true);
      void grantIou();
    }
  }

  function awardIouOnce(): void {
    if (readJsonStore<boolean>(IOU_AWARDED_KEY)) return;
    // 成就只在欠条真正到账后授予；领取失败时保持未解锁。
    options.awardAchievement?.("s001_iou_holder", ACHIEVEMENT_NAMES.s001_iou_holder ?? "s001_iou_holder");
    writeJsonStore(IOU_AWARDED_KEY, true);
  }

  async function grantIou(): Promise<void> {
    if (!readJsonStore<boolean>(IOU_PENDING_KEY)) return;
    // 断线重连后先核对物品：服务端可能已处理，只是响应丢了。
    if (options.hasItem?.(IOU_ITEM_ID)) {
      writeJsonStore(IOU_PENDING_KEY, false);
      awardIouOnce();
      return;
    }
    if (!options.claimReward) {
      options.showToast?.("离线时无法领取「两支持欠条」。");
      return;
    }
    try {
      const claimed = await options.claimReward("s001_iou");
      if (!claimed) return; // 保留 pending，等 online/刷新后重试。
      writeJsonStore(IOU_PENDING_KEY, false);
      awardIouOnce();
    } catch {
      options.showToast?.("领取「两支持欠条」失败，请稍后再试。");
    }
  }

  // ── 阶段判定（文档状态机 S0-S3）──
  type LaxyPhase = "s0" | "s1" | "s2" | "s3";

  function laxyPhase(): LaxyPhase {
    const phase = flow.phase();
    if (phase === "untouched") return "s0";
    const nodeId = flow.state().nodeId;
    if (nodeId === "meet-laxy") return "s0";
    if (phase === "concluded") return "s3";
    if (nodeId === "wall-open" || nodeId === "settle-wait") return "s2";
    return "s1";
  }

  const isDigWaitNode = (nodeId: string): boolean =>
    CHATRUINS_STORY.worldInteractions?.some((item) => item.nodeId === nodeId) ?? false;

  // ── NPC 交互：laxy 瓦 ──
  function interactLaxy(dialogs: CityDialogController): boolean {
    const phase = laxyPhase();
    if (phase === "s0") {
      // S0：门楣（未读）→ 打开剧情（渲染门楣 CG）；门楣已过 → 强制播开场白 A。
      flow.open(dialogs);
      return true;
    }
    if (phase === "s1") {
      openLaxyDialog(dialogs, CHATRUINS_OPENING_B, LAXY_TREE_ROOT);
      return true;
    }
    if (phase === "s2") {
      openLaxyDialog(dialogs, CHATRUINS_GUIDE_C, []);
      return true;
    }
    openChatPool(dialogs);
    return true;
  }

  // ── NPC 交互：墓碑先生 ──
  function interactTombstone(dialogs: CityDialogController): boolean {
    const concluded = flow.phase() === "concluded";
    if (concluded) {
      const lines = isDaytime() ? "……" : "……";
      const text = isFoundingDay() ? `${lines}\n\n「畅快。」` : lines;
      dialogs.openStory({
        title: "墓碑先生",
        role: "碑旁静立的人",
        text,
        options: [{ text: "（退开一点）", onPick: () => dialogs.closeNpc() }],
      });
      return true;
    }
    const today = beijingDayKey();
    const answered = readJsonStore(TOMBSTONE_ANSWERED_KEY);
    if (answered === today) {
      // 已答过的当天：只冒气泡。
      dialogs.openStory({
        title: "墓碑先生",
        role: "碑旁静立的人",
        text: "……",
        options: [{ text: "（退开一点）", onPick: () => dialogs.closeNpc() }],
      });
      return true;
    }
    dialogs.openStory({
      title: "墓碑先生",
      role: "碑旁静立的人",
      text: "「……」",
      options: [
        {
          text: "你是谁？",
          onPick: () => answerTombstone(dialogs, "「墓碑。」"),
        },
        {
          text: "这地方值得守吗？",
          onPick: () => answerTombstone(dialogs, "「刑啊。」"),
        },
      ],
    });
    return true;
  }

  function answerTombstone(dialogs: CityDialogController, line: string): void {
    writeJsonStore(TOMBSTONE_ANSWERED_KEY, beijingDayKey());
    dialogs.openStory({
      title: "墓碑先生",
      role: "碑旁静立的人",
      text: line,
      options: [{ text: "（退开一点）", onPick: () => dialogs.closeNpc() }],
    });
  }

  // ── laxy 瓦 S1 选项树（叶子全文写死，零人称代词）──
  interface LaxyTreeNode {
    prompt: string;
    text: string;
    subs: LaxyTreeNode[];
    onPick?: () => void;
  }

  const LAXY_TREE_ROOT: LaxyTreeNode[] = [
    {
      prompt: "两万六千条？！他们都在聊什么？",
      text: "什么都有！物理题、晚饭吃什么、新出的实验、给楼主的两支持——总之什么都有。还有一整层一整层的『考古』。",
      subs: [
        {
          prompt: "考古是什么意思？",
          text: "就是你现在做的事呀。后来的人一路翻到最底下，看见 2021 年 8 月 29 日晚上九点的原话，就会留一句『考古』，证明自己来过。这个词谁发明的已经说不清了，但每个人都想发明自己的写法——烤咕、考咕、靠顾……待会儿你也可以留一个。要原创的哦。",
          subs: [],
        },
        {
          prompt: "所以这里早就没人聊天了？",
          text: "聊天室这个东西，会沉。新的帖子一天天把它往下压，跟沉积物一样，沉到没人翻得到，就安静了。但你知道最了不起的是什么吗？每沉一间，就有人开一间新的。你进去看墙上层的刻度——两周一代，比月亮还守时。",
          subs: [
            {
              prompt: "为什么是两周？",
              text: "因为开聊天室的都是要上学的人呀。攒了一周的话，周末来倾倒。周五晚上最热闹，周日晚上最哀嚎。后来有一位楼长干脆把签名改成了『暂退，周末上』——你会在最上面那层挖到它的。",
              subs: [
                {
                  prompt: "周日晚上哀嚎什么？",
                  text: "作业呗，还能为什么。聊天室救不了作业，作业倒救了聊天室——周日晚大家准时回来赶工，顺便把楼顶上去。",
                  subs: [],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      prompt: "这间是什么来头？",
      text: "开国的人叫米米米米，立国只说了一句话，门口那块牌子就是。那是全城最早的门禁制度——虽然看不太懂在禁谁，但很有气势！",
      subs: [
        {
          prompt: "后来呢？",
          text: "后来守楼换了人。二代到五代都是同一位楼长，你可以顺着地层把四代看完：先是『不敢发精选的屑西楼』，然后是『消息99+』——那是盛世，忙得看不过来；再然后是『暂退，周末上』……最后嘛，你自己挖到最底下就知道了。",
          subs: [
            {
              prompt: "最底下是什么？",
              text: "去挖呀。考古的人，问出来的都是二手的。",
              subs: [],
            },
          ],
        },
      ],
    },
    {
      prompt: "我就是路过。",
      text: "路过也要留个言嘛！告诉你个秘密：这城里流传一条定理——『除了月满西楼开的聊天室，都不会火』。说这话的时候，那位本人已经改名了。改成什么？喏，碑旁边站着的那位，你问他吧。",
      subs: [
        {
          prompt: "（走向墓碑先生）",
          text: "",
          subs: [],
          onPick: () => options.showToast?.("碑旁边站着的那位，就在遗迹深处。"),
        },
      ],
    },
  ];

  function openLaxyDialog(
    dialogs: CityDialogController,
    text: string,
    tree: readonly LaxyTreeNode[],
  ): void {
    dialogs.openStory({
      title: "laxy 瓦",
      role: "考古向导",
      text,
      options: [
        ...tree.map((node) => ({
          text: node.prompt,
          onPick: () => {
            if (node.onPick) {
              node.onPick();
              dialogs.closeNpc();
              return;
            }
            openLaxyDialog(dialogs, node.text, node.subs);
          },
        })),
        { text: "（聊完了）", onPick: () => dialogs.closeNpc() },
      ],
    });
  }

  // ── S3 闲聊池（3 条循环；8-19 替换第 2 条；第 4 条需 S009）──
  function openChatPool(dialogs: CityDialogController): void {
    const pool = buildChatPool();
    const text = pool[chatPoolCursor % pool.length]!;
    chatPoolCursor = (chatPoolCursor + 1) % pool.length;
    dialogs.openStory({
      title: "laxy 瓦",
      role: "考古向导",
      text,
      options: [{ text: "（聊完了）", onPick: () => dialogs.closeNpc() }],
    });
  }

  function buildChatPool(): readonly string[] {
    const context = options.getQuestContext?.();
    const s009Done = context?.achievements?.has(S009_COMPLETED_ACHIEVEMENT) ?? false;
    const pool = [...CHATRUINS_CHAT_POOL];
    if (isFoundingDay()) pool[1] = CHATRUINS_CHAT_FOUNDING_DAY;
    if (s009Done) pool.push(CHATRUINS_CHAT_POOL_S009);
    return pool;
  }

  // ── 兴趣点交互 ──
  function interactInterestPoint(interestPointId: string, dialogs: CityDialogController): boolean {
    if (interestPointId === "chatruins-wall") return interactWall(dialogs);
    const handled = flow.interactInterestPoint(interestPointId, dialogs);
    if (handled) flow.syncWorldInteractions();
    return handled;
  }

  // ── 涂鸦墙（自定义面板；每玩家限 1 条；计数 26532→26533 玩家本地视角）──
  function interactWall(dialogs: CityDialogController): boolean {
    if (flow.state().nodeId !== "wall-open") return false;
    if (readJsonStore(MY_GRAFFITI_KEY)) {
      options.showToast?.("你已经在第 26533 层留过字了。");
      return true;
    }
    openWallPanel(dialogs);
    return true;
  }

  function pickWallPresets(): string[] {
    const cached = readJsonStore<string[]>(PRESETS_CACHE_KEY);
    if (Array.isArray(cached) && cached.length === 3 && cached.every((item) => CHATRUINS_VARIANT_TABLE.includes(item))) {
      return cached;
    }
    const pool = [...CHATRUINS_VARIANT_TABLE];
    const picked: string[] = [];
    while (picked.length < 3 && pool.length > 0) {
      picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1));
    }
    writeJsonStore(PRESETS_CACHE_KEY, picked);
    return picked;
  }

  function openWallPanel(dialogs: CityDialogController): void {
    const document = window.document;
    const presets = pickWallPresets();
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(12,16,24,0.42);";

    const card = document.createElement("div");
    card.style.cssText = "width:min(340px,86vw);background:#f7f5ef;border-radius:14px;padding:20px 22px;box-shadow:0 18px 48px rgba(10,14,22,0.35);font-family:inherit;color:#2a2d33;";
    overlay.appendChild(card);

    const title = document.createElement("div");
    title.textContent = "涂鸦墙";
    title.style.cssText = "font-size:17px;font-weight:600;letter-spacing:0.06em;";
    card.appendChild(title);

    const counter = document.createElement("div");
    counter.textContent = `第 ${CHATRUINS_GRAFFITI_BASE_COUNT} 层 · 该你落笔了`;
    counter.style.cssText = "margin-top:6px;font-size:13px;color:#6b7078;";
    card.appendChild(counter);

    const presetRow = document.createElement("div");
    presetRow.style.cssText = "display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;";
    const presetButtons = presets.map((preset) => {
      const button = document.createElement("button");
      button.textContent = preset;
      button.style.cssText = "flex:1;min-width:64px;padding:8px 10px;border:1px solid #c9c4b4;border-radius:9px;background:#fffdf7;color:#2a2d33;font-size:14px;cursor:pointer;";
      button.addEventListener("click", () => submit(preset));
      presetRow.appendChild(button);
      return button;
    });
    card.appendChild(presetRow);

    const input = document.createElement("input");
    input.maxLength = CHATRUINS_GRAFFITI_MAX_LENGTH;
    input.placeholder = "自己写一句（要原创的哦）";
    input.setAttribute("aria-label", "涂鸦内容");
    input.style.cssText = "width:100%;box-sizing:border-box;margin-top:12px;padding:9px 12px;border:1px solid #c9c4b4;border-radius:9px;background:#fffdf7;font-size:14px;color:#2a2d33;";
    card.appendChild(input);

    const hint = document.createElement("div");
    hint.style.cssText = "margin-top:8px;min-height:18px;font-size:12px;color:#b0473a;";
    card.appendChild(hint);

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:10px;margin-top:12px;justify-content:flex-end;";
    const cancelButton = document.createElement("button");
    cancelButton.textContent = "再想想";
    cancelButton.style.cssText = "padding:8px 14px;border:1px solid #c9c4b4;border-radius:9px;background:transparent;color:#6b7078;font-size:14px;cursor:pointer;";
    cancelButton.addEventListener("click", () => overlay.remove());
    const submitButton = document.createElement("button");
    submitButton.textContent = "落笔";
    submitButton.style.cssText = "padding:8px 18px;border:none;border-radius:9px;background:#3b6fe0;color:#fffdf7;font-size:14px;cursor:pointer;";
    submitButton.addEventListener("click", () => submit(input.value));
    actions.append(cancelButton, submitButton);
    card.appendChild(actions);

    let settled = false;
    function submit(raw: string): void {
      if (settled) return;
      const text = raw.trim();
      if (!text) {
        // 空输入拒绝（逐字照录）。
        hint.textContent = CHATRUINS_EMPTY_INPUT_HINT;
        return;
      }
      const choiceId = text === "考古"
        ? "wall-archaeology"
        : CHATRUINS_VARIANT_TABLE.includes(text)
          ? "wall-variant"
          : "wall-free";
      // 先推进剧情；跳转失败时保留面板和输入，不写本地存档。
      if (!flow.choose(dialogs, choiceId)) {
        hint.textContent = "提交失败，请重试。";
        return;
      }
      settled = true;
      writeJsonStore(MY_GRAFFITI_KEY, text);
      overlay.remove();
      flow.syncWorldInteractions();
    }

    document.body.appendChild(overlay);
  }

  // ── 接近触发轮询（800ms 节流）──
  function tick(): void {
    const dialogs = options.getDialogs?.() ?? null;
    if (!dialogs || dialogs.isOpen()) return;
    const player = options.getPlayerPosition?.();
    if (!player) return;
    const nodeId = flow.state().nodeId;

    // 刷新可能停在涂鸦反应节点（cg 自动推进尚未发生）：重新打开剧情，
    // 让 StoryDialogFlow 继续播完并触发欠条/结局。
    if (nodeId === "wall-archaeology" || nodeId === "wall-variant" || nodeId === "wall-free") {
      flow.open(dialogs);
      return;
    }

    // laxy 瓦 10m：S0 强制开场（门楣未读 → 渲染门楣；已读 → 开场白 A）。
    if ((nodeId === "lintel" || nodeId === "meet-laxy") && within(player, LAXY_POSITION, LAXY_FORCE_RADIUS)) {
      flow.open(dialogs);
      return;
    }
    // 墓碑先生 5m：涂鸦已提交（settle-wait）→ 隐藏台词（60s 冷却）。
    if (nodeId === "settle-wait" && within(player, TOMBSTONE_POSITION, TOMBSTONE_REVEAL_RADIUS)) {
      const now = Date.now();
      if (now - lastRevealAttemptAt >= TOMBSTONE_COOLDOWN_MS) {
        lastRevealAttemptAt = now;
        flow.choose(dialogs, "tombstone-reveal");
        flow.syncWorldInteractions();
      }
      return;
    }
    // 已完成态 + 8-19 开国日：靠近墓碑先生补一句「畅快。」。
    if (flow.phase() === "concluded" && isFoundingDay() && within(player, TOMBSTONE_POSITION, TOMBSTONE_REVEAL_RADIUS)) {
      const now = Date.now();
      if (now - lastRevealAttemptAt >= TOMBSTONE_COOLDOWN_MS) {
        lastRevealAttemptAt = now;
        dialogs.openStory({
          title: "墓碑先生",
          role: "碑旁静立的人",
          text: "……\n\n「畅快。」",
          options: [{ text: "（退开一点）", onPick: () => dialogs.closeNpc() }],
        });
      }
    }
  }

  function within(player: { x: number; z: number }, target: { x: number; z: number }, radius: number): boolean {
    const dx = player.x - target.x;
    const dz = player.z - target.z;
    return dx * dx + dz * dz <= radius * radius;
  }

  let onlineHandler: (() => void) | undefined = undefined;

  function ensureTicking(): void {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      try {
        tick();
      } catch {
        // 轮询失败静默：交互路径仍可用。
      }
    }, TICK_INTERVAL_MS);
  }

  // ── 通用交互入口 ──
  function interactBuilding(buildingId: string, dialogs: CityDialogController): boolean {
    const handled = flow.interactBuilding(buildingId, dialogs);
    if (handled) flow.syncWorldInteractions();
    return handled;
  }

  function interactNpc(npcId: string, dialogs: CityDialogController): boolean {
    if (npcId === "laxy") return interactLaxy(dialogs);
    if (npcId === "tombstone") return interactTombstone(dialogs);
    return false;
  }

  // ── 本地小存储（JSON 值 + 当日键）──
  function readJsonStore<T = unknown>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  function writeJsonStore(key: string, value: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 存储不可用时静默：预设退化为每次随机。
    }
  }

  function beijingDayKey(): string {
    //  Asia/Shanghai 固定 +8：与服务器 shanghaiDayKey 同口径。
    return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  function isFoundingDay(): boolean {
    return beijingDayKey().slice(5) === "08-19";
  }

  function isDaytime(): boolean {
    const hour = Number(new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(11, 13));
    return hour >= 6 && hour < 20;
  }

  // ── 对外接口（与 yesterday/magi/overcoat 控制器同形）──
  return {
    story: flow,
    interactBuilding,
    interactNpc,
    interactInterestPoint,
    announceGuide: () => flow.announceGuide(),
    syncActiveActors: () => flow.syncActiveActors(),
    state: () => flow.state(),
    phase: () => flow.phase(),
    ownsEntry: flow.ownsEntry,
    start: () => {
      ensureTicking();
      // 恢复当前节点的兴趣点激活（wall-open 会补上涂鸦墙 hitbox）。
      flow.syncWorldInteractions();
      if (!onlineHandler) {
        onlineHandler = () => { void grantIou(); };
        window.addEventListener("online", onlineHandler);
      }
      // 兼容修复前已领到欠条但没拿到成就的老存档。
      if (options.hasItem?.(IOU_ITEM_ID)) awardIouOnce();
      void grantIou();
    },
    dispose: () => {
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = undefined;
      if (onlineHandler) window.removeEventListener("online", onlineHandler);
      onlineHandler = undefined;
    },
  };
}

export type ChatRuinsStoryController = ReturnType<typeof createChatRuinsStoryController>;

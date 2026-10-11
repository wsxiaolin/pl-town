// 海边观景台「云上烟花」秀：进入观景模式后镜头移到海面上空，把云端
// 全体居民的烟花按「幕」轮播——每幕 1–3 支，同幕同时（或错峰 0.5s）
// 升起；一轮放完后重新拉取清单（新存入的烟花会进节目单）并继续循环。
// 相机走 cameraController.focus + view 快照恢复，输入由 cinematic 锁定
// （与物实影视城飞跃体验同一套机制）。
import { OBSERVATION_DECK_VIEW, FIREWORK_LAUNCH_ZONE } from './fireworksConstants';
import type { FireworksClient, FireworkRecordView } from './fireworksClient';
import type { FireworksEngine } from '../../rendering/fireworksEngine';
import type { CityDialogController } from '../../adapters/ui/cityDialogController';

export type CameraSnapshot = { x: number; z: number; zoom: number };

const ACT_GAP_MS = 4_600;
const LAUNCH_STAGGER_MS = 520;

export function createObservationDeckShow(options: {
  engine: FireworksEngine;
  client: FireworksClient;
  document: Document;
  signal: AbortSignal;
  dialogs: () => CityDialogController | null;
  getCameraSnapshot: () => CameraSnapshot;
  focusCamera: (x: number, z: number, zoom: number) => void;
  stopCamera: () => void;
  restoreCamera: (snapshot: CameraSnapshot) => void;
  setCinematicActive: (active: boolean) => void;
  clearPlayerPath: () => void;
  showToast: (message: string) => void;
}) {
  let active = false;
  let snapshot: CameraSnapshot | null = null;
  let actTimer = 0;
  let actIndex = 0;
  let round: FireworkRecordView[] = [];
  let roundActs: FireworkRecordView[][] = [];
  const hud = () => options.document.getElementById('deckShowHud');
  const actLabel = () => options.document.querySelector('[data-deck-act]') as HTMLElement | null;
  const namesLabel = () => options.document.querySelector('[data-deck-names]') as HTMLElement | null;

  function setHudVisible(visible: boolean): void {
    const element = hud();
    if (element) element.hidden = !visible;
  }

  function launchOrigin(index: number): { x: number; z: number } {
    // 同幕的多支烟花横向铺开，避免爆裂云完全重叠。
    const t = index / 3;
    return {
      x: FIREWORK_LAUNCH_ZONE.minX + (FIREWORK_LAUNCH_ZONE.maxX - FIREWORK_LAUNCH_ZONE.minX) * (0.2 + 0.6 * Math.random() - t * 0.1),
      z: FIREWORK_LAUNCH_ZONE.minZ + (FIREWORK_LAUNCH_ZONE.maxZ - FIREWORK_LAUNCH_ZONE.minZ) * (0.25 + 0.5 * Math.random()),
    };
  }

  function playAct(): void {
    const act = roundActs[actIndex % roundActs.length];
    if (!act) { stop('节目单空了'); return; }
    act.forEach((record, memberIndex) => {
      options.engine.launch(record.design, launchOrigin(memberIndex), {
        delay: memberIndex * LAUNCH_STAGGER_MS / 1000,
        targetYJitter: 3,
      });
    });
    const index = actIndex % roundActs.length;
    if (actLabel()) actLabel()!.textContent = `第 ${index + 1} / ${roundActs.length} 幕`;
    if (namesLabel()) {
      namesLabel()!.textContent = act
        .map((record) => `《${record.name}》· ${record.authorNickname}`)
        .join('　');
    }
    actIndex += 1;
    const isRoundEnd = actIndex % roundActs.length === 0;
    actTimer = window.setTimeout(() => {
      if (!active) return;
      if (isRoundEnd) void nextRound();
      else playAct();
    }, ACT_GAP_MS + LAUNCH_STAGGER_MS * (act.length - 1));
  }

  async function nextRound(): Promise<void> {
    try {
      const library = await options.client.list();
      if (library.community.length > 0) round = library.community;
    } catch {
      // 拉取失败就沿用上一轮节目单，不打断演出。
    }
    if (!active) return;
    roundActs = buildActs(round);
    actIndex = 0;
    playAct();
  }

  function start(): void {
    // 关掉确认对话框：它覆盖在 HUD 之上，开着会拦截观景期间的点击。
    options.dialogs()?.closeNpc();
    snapshot = options.getCameraSnapshot();
    active = true;
    options.clearPlayerPath();
    options.setCinematicActive(true);
    setHudVisible(true);
    options.focusCamera(OBSERVATION_DECK_VIEW.targetX, OBSERVATION_DECK_VIEW.targetZ, OBSERVATION_DECK_VIEW.zoom);
    void (async () => {
      try {
        const library = await options.client.list();
        if (!active) return;
        if (library.community.length === 0) {
          stop('云端还没有烟花——先去烟花铺设计一支吧');
          return;
        }
        round = library.community;
        roundActs = buildActs(round);
        actIndex = 0;
        playAct();
      } catch (error) {
        stop(error instanceof Error ? error.message : '无法读取云端烟花');
      }
    })();
  }

  function stop(message?: string): void {
    if (!active) return;
    active = false;
    window.clearTimeout(actTimer);
    setHudVisible(false);
    options.stopCamera();
    options.setCinematicActive(false);
    const saved = snapshot;
    snapshot = null;
    if (saved) options.restoreCamera(saved);
    if (message) options.showToast(message);
  }

  function interact(): void {
    if (active) {
      options.showToast('观景模式正在放映');
      return;
    }
    options.dialogs()?.closeNpc();
    options.dialogs()?.openStory({
      title: '海边观景台',
      role: '云上烟花 · 免费观景',
      text: '登上栈桥尽头的平台，镜头会移到海面上空：所有居民设计并存入云端的烟花将依次升起，偶尔有几支同时绽放。随时可以结束观景。',
      variant: 'story' as const,
      options: [
        { text: '开始观景', onPick: () => start() },
        { text: '稍后再来', onPick: () => options.dialogs()?.closeNpc() },
      ],
    });
  }

  // HUD 退出按钮 + Esc。
  options.document.querySelector('[data-deck-exit]')?.addEventListener('click', () => stop('观景结束，欢迎再来'), { signal: options.signal });
  options.document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && active) stop('观景结束，欢迎再来');
  }, { signal: options.signal });

  function dispose(): void {
    stop();
  }

  return { interact, stop, dispose, isActive: () => active };
}

/** 把节目单切成幕：40% 单支、35% 双支、25% 三支（同幕同时升起）。 */
export function buildActs(community: readonly FireworkRecordView[]): FireworkRecordView[][] {
  const pool = [...community];
  // Fisher–Yates 洗牌（每轮不同顺序）。
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const acts: FireworkRecordView[][] = [];
  let cursor = 0;
  while (cursor < pool.length) {
    const roll = Math.random();
    const size = roll < 0.4 ? 1 : roll < 0.75 ? 2 : 3;
    acts.push(pool.slice(cursor, cursor + size));
    cursor += size;
  }
  return acts;
}

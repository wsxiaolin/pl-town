import { cancelCatDeathBlackout, playCatDeathBlackout } from './catDeathBlackout';
import { drawCatDeathFrame, smoothstep, type CatDeathCanvasStage } from './catDeathCGRenderer';

type CaptionTone = 'narration' | 'white' | 'black';

type CaptionCue = {
  start: number;
  end: number;
  speaker: string;
  line: string;
  tone: CaptionTone;
};

export type CatDeathCGFinishReason = 'completed' | 'skipped' | 'restarted';

export type CatDeathCGHandle = {
  finished: Promise<CatDeathCGFinishReason>;
  stop: () => void;
};

const STORY_SECONDS = 83;
const TOTAL_SECONDS = 88;
const MAP_RETURN_MS = 1800;

// Each cue begins before the previous one ends. Two caption planes cross-fade,
// keeping spoken and narrated beats continuous for the entire short film.
const CAPTION_CUES: readonly CaptionCue[] = [
  { start: 0, end: 4.7, speaker: '旁白', tone: 'narration', line: '白色的小猫奔过绿色平原，把风和蒲公英都甩在身后。' },
  { start: 4.25, end: 8.55, speaker: '旁白', tone: 'narration', line: '它每天追着太阳跑，直到夕阳把影子拉得很长。' },
  { start: 8.1, end: 11.6, speaker: '旁白', tone: 'narration', line: '城里的猫咖却总停在一个温暖的午后。' },
  { start: 11.15, end: 14.15, speaker: '黑猫', tone: 'black', line: '（被抚摸得很舒服，轻轻地哼着）' },
  { start: 13.7, end: 17.1, speaker: '白猫', tone: 'white', line: '喵……黑色的家伙，每天都被人摸？' },
  { start: 16.65, end: 18.75, speaker: '黑猫', tone: 'black', line: '呜……？嗯喵。' },
  { start: 18.3, end: 21.7, speaker: '白猫', tone: 'white', line: '小煤球！你不会没有从这里出去过吧？' },
  { start: 21.25, end: 25.75, speaker: '黑猫', tone: 'black', line: '呜……为什么要出去？被人抚摸的感觉不好嘛喵……' },
  { start: 25.3, end: 28.8, speaker: '白猫', tone: 'white', line: '……还是喜欢在外边玩喵，自由自在喵。' },
  { start: 28.35, end: 33.15, speaker: '黑猫', tone: 'black', line: '被抱出去过几次喵，还是窝里舒服。要进来蹭蹭嘛喵？' },
  { start: 32.7, end: 34.5, speaker: '白猫', tone: 'white', line: '……' },
  { start: 34.05, end: 36.05, speaker: '黑猫', tone: 'black', line: '不喜欢嘛……' },
  { start: 35.6, end: 38.3, speaker: '白猫', tone: 'white', line: '被圈养可不是好事喵。' },
  { start: 37.85, end: 42.05, speaker: '黑猫', tone: 'black', line: '那……顺毛呢！你不需要顺毛嘛喵？' },
  { start: 41.6, end: 44, speaker: '白猫', tone: 'white', line: '我不需要人顺毛。' },
  { start: 43.55, end: 47.75, speaker: '黑猫', tone: 'black', line: '……那你一直在外面跑，死掉了怎么办喵？' },
  { start: 47.3, end: 49.7, speaker: '白猫', tone: 'white', line: '我宁可死在荒野。' },
  { start: 49.25, end: 51.95, speaker: '黑猫', tone: 'black', line: '可是……荒野不会替你顺毛。' },
  { start: 51.5, end: 53.3, speaker: '白猫', tone: 'white', line: '风会喵。' },
  { start: 52.85, end: 57.35, speaker: '旁白', tone: 'narration', line: '白猫跃出窗台。那一年，平原的雨季来得格外早。' },
  { start: 56.9, end: 61.4, speaker: '旁白', tone: 'narration', line: '黑猫仍守着最暖的垫子，却开始在每个黄昏望向门外。' },
  { start: 60.95, end: 66.15, speaker: '旁白', tone: 'narration', line: '直到风带回熟悉的气味：青草、泥土，还有一场已经停下的心跳。' },
  { start: 65.7, end: 68.9, speaker: '黑猫', tone: 'black', line: '你说宁可……原来不是在吓我喵。' },
  { start: 68.45, end: 71.45, speaker: '黑猫', tone: 'black', line: '我带你回家……不，你说荒野才是你的家。' },
  { start: 71, end: 75.6, speaker: '旁白', tone: 'narration', line: '黑猫刨开被雨浸软的泥土，把白猫安葬在风吹过的草坡。' },
  { start: 75.15, end: 78.6, speaker: '黑猫', tone: 'black', line: '晚安。风会替我来看你喵。' },
  { start: 78.15, end: 82.85, speaker: '旁白', tone: 'narration', line: '埋好最后一捧土，黑猫没有回头。它沿着白猫追逐夕阳的方向，第一次走向自己的自由。' },
];

type ActiveSession = {
  root: HTMLElement;
  stage: CatDeathCanvasStage;
  rafId: number;
  startedAt: number;
  captionIndex: number;
  captionSlot: number;
  titleShown: boolean;
  finished: boolean;
  onResize: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  stop: (reason: CatDeathCGFinishReason, immediate?: boolean) => void;
};

let activeSession: ActiveSession | null = null;

export function playCatDeathCG(): CatDeathCGHandle {
  cancelCatDeathBlackout();
  return startCatDeathCG();
}

export async function playCatDeathCGAfterBlackout(): Promise<CatDeathCGHandle | null> {
  cancelCatDeathBlackout();
  activeSession?.stop('restarted', true);
  return playCatDeathBlackout(startCatDeathCG);
}

function startCatDeathCG(): CatDeathCGHandle {
  activeSession?.stop('restarted', true);
  document.querySelectorAll<HTMLElement>('[data-cat-death-cg].is-closing').forEach(element => element.remove());

  const root = document.createElement('section');
  root.className = 'cat-death-cg';
  root.dataset.catDeathCg = 'death-of-a-cat';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '猫之死隐藏影像');
  root.innerHTML = `
    <canvas class="cat-death-cg__canvas" aria-hidden="true"></canvas>
    <div class="cat-death-cg__bloom" aria-hidden="true"></div>
    <div class="cat-death-cg__grain" aria-hidden="true"></div>
    <div class="cat-death-cg__letterbox cat-death-cg__letterbox--top" aria-hidden="true"></div>
    <div class="cat-death-cg__letterbox cat-death-cg__letterbox--bottom" aria-hidden="true"></div>
    <div class="cat-death-cg__hud" aria-hidden="true">
      <span>CAT CAFE ARCHIVE</span><span>FIELD RECORD // 09</span>
    </div>
    <button class="cat-death-cg__skip" type="button" aria-label="跳过猫之死影像">跳过 <span>ESC</span></button>
    <div class="cat-death-cg__caption-stage" aria-live="polite">
      <div class="cat-death-cg__caption" data-cat-caption-slot="0" aria-hidden="true">
        <span class="cat-death-cg__speaker"></span><p class="cat-death-cg__line"></p>
      </div>
      <div class="cat-death-cg__caption" data-cat-caption-slot="1" aria-hidden="true">
        <span class="cat-death-cg__speaker"></span><p class="cat-death-cg__line"></p>
      </div>
    </div>
    <div class="cat-death-cg__title" aria-hidden="true">
      <span>THE WIND REMEMBERS EVERY STRAY</span>
      <h1>猫之死</h1>
    </div>
    <div class="cat-death-cg__progress" aria-hidden="true"><i></i></div>
    <div class="cat-death-cg__end-blackout" aria-hidden="true"></div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('.cat-death-cg__canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) throw new Error('Cat Death CG requires a Canvas 2D context.');

  const stage: CatDeathCanvasStage = { canvas, context, width: 0, height: 0, dpr: 1 };
  let resolveFinished: (reason: CatDeathCGFinishReason) => void = () => undefined;
  const finished = new Promise<CatDeathCGFinishReason>(resolve => { resolveFinished = resolve; });
  const session = {} as ActiveSession;
  const onResize = () => resizeStage(stage, root);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') session.stop('skipped');
  };
  const skip = () => session.stop('skipped');

  Object.assign(session, {
    root,
    stage,
    rafId: 0,
    startedAt: 0,
    captionIndex: -1,
    captionSlot: 1,
    titleShown: false,
    finished: false,
    onResize,
    onKeyDown,
    stop: (reason: CatDeathCGFinishReason, immediate = false) => {
      if (session.finished) return;
      session.finished = true;
      cancelAnimationFrame(session.rafId);
      window.removeEventListener('resize', session.onResize);
      window.removeEventListener('keydown', session.onKeyDown);
      root.querySelector('.cat-death-cg__skip')?.removeEventListener('click', skip);
      root.classList.remove('is-active');
      root.classList.add(reason === 'completed' ? 'is-returning' : 'is-closing');
      if (activeSession === session) activeSession = null;
      const finish = () => { root.remove(); resolveFinished(reason); };
      if (immediate) finish();
      else window.setTimeout(finish, reason === 'completed' ? MAP_RETURN_MS : 650);
    },
  } satisfies ActiveSession);

  root.querySelector('.cat-death-cg__skip')?.addEventListener('click', skip);
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  document.body.append(root);
  resizeStage(stage, root);
  activeSession = session;

  requestAnimationFrame(() => root.classList.add('is-active'));
  session.rafId = requestAnimationFrame(now => {
    session.startedAt = now;
    animateSession(session, now);
  });

  return { finished, stop: () => session.stop('skipped') };
}

export function stopCatDeathCG(): boolean {
  const stoppedBlackout = cancelCatDeathBlackout();
  if (!activeSession) return stoppedBlackout;
  activeSession.stop('skipped');
  return true;
}

export function isCatDeathCGActive(): boolean {
  return activeSession !== null;
}

function animateSession(session: ActiveSession, now: number): void {
  if (session.finished) return;
  const elapsed = Math.min(TOTAL_SECONDS, (now - session.startedAt) / 1000);
  drawCatDeathFrame(session.stage, elapsed);
  updateCaption(session, elapsed);
  updateDom(session, elapsed);
  if (elapsed >= TOTAL_SECONDS) {
    session.stop('completed');
    return;
  }
  session.rafId = requestAnimationFrame(next => animateSession(session, next));
}

function updateCaption(session: ActiveSession, elapsed: number): void {
  let nextIndex = -1;
  for (let index = CAPTION_CUES.length - 1; index >= 0; index -= 1) {
    const cue = CAPTION_CUES[index];
    if (cue && elapsed >= cue.start && elapsed < cue.end) {
      nextIndex = index;
      break;
    }
  }
  if (nextIndex === session.captionIndex) return;

  session.captionIndex = nextIndex;
  const previous = session.root.querySelector<HTMLElement>(`[data-cat-caption-slot="${session.captionSlot}"]`);
  if (nextIndex < 0) {
    previous?.classList.remove('is-current');
    previous?.setAttribute('aria-hidden', 'true');
    return;
  }

  const nextSlot = session.captionSlot === 0 ? 1 : 0;
  const cue = CAPTION_CUES[nextIndex];
  const caption = session.root.querySelector<HTMLElement>(`[data-cat-caption-slot="${nextSlot}"]`);
  if (!cue || !caption) return;
  caption.dataset.tone = cue.tone;
  caption.querySelector<HTMLElement>('.cat-death-cg__speaker')!.textContent = cue.speaker;
  caption.querySelector<HTMLElement>('.cat-death-cg__line')!.textContent = cue.line;
  caption.setAttribute('aria-hidden', 'false');
  void caption.offsetWidth;
  caption.classList.add('is-current');
  session.captionSlot = nextSlot;
  requestAnimationFrame(() => {
    previous?.classList.remove('is-current');
    previous?.setAttribute('aria-hidden', 'true');
  });
}

function updateDom(session: ActiveSession, elapsed: number): void {
  const progress = session.root.querySelector<HTMLElement>('.cat-death-cg__progress i');
  if (progress) progress.style.transform = `scaleX(${elapsed / TOTAL_SECONDS})`;
  const blackout = session.root.querySelector<HTMLElement>('.cat-death-cg__end-blackout');
  if (blackout) blackout.style.opacity = String(smoothstep(STORY_SECONDS, TOTAL_SECONDS, elapsed));
  if (!session.titleShown && elapsed >= 77.8) {
    session.titleShown = true;
    session.root.classList.add('is-title');
    session.root.querySelector('.cat-death-cg__title')?.setAttribute('aria-hidden', 'false');
  }
}

function resizeStage(stage: CatDeathCanvasStage, root: HTMLElement): void {
  const rect = root.getBoundingClientRect();
  stage.width = Math.max(1, rect.width);
  stage.height = Math.max(1, rect.height);
  stage.dpr = Math.min(2, window.devicePixelRatio || 1);
  stage.canvas.width = Math.round(stage.width * stage.dpr);
  stage.canvas.height = Math.round(stage.height * stage.dpr);
  stage.canvas.style.width = `${stage.width}px`;
  stage.canvas.style.height = `${stage.height}px`;
}

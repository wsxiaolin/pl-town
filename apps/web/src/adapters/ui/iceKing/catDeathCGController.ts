import { cancelCatDeathBlackout, playCatDeathBlackout } from './catDeathBlackout';
import { drawCatDeathFrame, smoothstep, type CatDeathCanvasStage } from '../../../rendering/iceKing/catDeathCGRenderer';
import {
  CAT_DEATH_CAPTION_CUES,
  CAT_DEATH_MAP_RETURN_MS,
  CAT_DEATH_STORY_SECONDS,
  CAT_DEATH_TOTAL_SECONDS,
} from '../../../gameplay/content/stories/iceKing/catDeathStory';

export type CatDeathCGFinishReason = 'completed' | 'skipped' | 'restarted';

export type CatDeathCGHandle = {
  finished: Promise<CatDeathCGFinishReason>;
  stop: () => void;
};

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
      else window.setTimeout(finish, reason === 'completed' ? CAT_DEATH_MAP_RETURN_MS : 650);
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
  const elapsed = Math.min(CAT_DEATH_TOTAL_SECONDS, (now - session.startedAt) / 1000);
  drawCatDeathFrame(session.stage, elapsed);
  updateCaption(session, elapsed);
  updateDom(session, elapsed);
  if (elapsed >= CAT_DEATH_TOTAL_SECONDS) {
    session.stop('completed');
    return;
  }
  session.rafId = requestAnimationFrame(next => animateSession(session, next));
}

function updateCaption(session: ActiveSession, elapsed: number): void {
  let nextIndex = -1;
  for (let index = CAT_DEATH_CAPTION_CUES.length - 1; index >= 0; index -= 1) {
    const cue = CAT_DEATH_CAPTION_CUES[index];
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
  const cue = CAT_DEATH_CAPTION_CUES[nextIndex];
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
  if (progress) progress.style.transform = `scaleX(${elapsed / CAT_DEATH_TOTAL_SECONDS})`;
  const blackout = session.root.querySelector<HTMLElement>('.cat-death-cg__end-blackout');
  if (blackout) blackout.style.opacity = String(smoothstep(CAT_DEATH_STORY_SECONDS, CAT_DEATH_TOTAL_SECONDS, elapsed));
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

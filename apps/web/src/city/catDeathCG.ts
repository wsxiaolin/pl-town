import { cancelCatDeathBlackout, playCatDeathBlackout } from './catDeathBlackout';
import { drawCatDeathBurial } from './catDeathBurial';

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
const TAU = Math.PI * 2;

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

type Particle = { x: number; y: number; size: number; speed: number; phase: number };
type GrassBlade = { x: number; height: number; lean: number; phase: number };
type RainDrop = { x: number; y: number; length: number; speed: number };

type CanvasStage = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
};

type ActiveSession = {
  root: HTMLElement;
  stage: CanvasStage;
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

const seeded = mulberry32(0xca75de47);
const POLLEN = createParticles(90, seeded, 0.6, 2.2);
const DUST = createParticles(58, seeded, 0.4, 1.5);
const GRASS = createGrass(165, seeded);
const RAIN = createRain(150, seeded);

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

  const stage: CanvasStage = { canvas, context, width: 0, height: 0, dpr: 1 };
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
  drawFrame(session.stage, elapsed);
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

function resizeStage(stage: CanvasStage, root: HTMLElement): void {
  const rect = root.getBoundingClientRect();
  stage.width = Math.max(1, rect.width);
  stage.height = Math.max(1, rect.height);
  stage.dpr = Math.min(2, window.devicePixelRatio || 1);
  stage.canvas.width = Math.round(stage.width * stage.dpr);
  stage.canvas.height = Math.round(stage.height * stage.dpr);
  stage.canvas.style.width = `${stage.width}px`;
  stage.canvas.style.height = `${stage.height}px`;
}

function drawFrame(stage: CanvasStage, elapsed: number): void {
  const { context: cx, width: w, height: h, dpr } = stage;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.clearRect(0, 0, w, h);

  const fieldWeight = 1 - smoothstep(7.7, 11.8, elapsed);
  const cafeWeight = smoothstep(7.4, 11.5, elapsed) * (1 - smoothstep(51.4, 55.8, elapsed));
  const stormWeight = smoothstep(50.8, 55.4, elapsed) * (1 - smoothstep(61, 65.5, elapsed));
  const memorialWeight = smoothstep(60.5, 65.2, elapsed);

  drawFieldScene(cx, w, h, elapsed, fieldWeight);
  drawCafeScene(cx, w, h, elapsed, cafeWeight);
  drawStormScene(cx, w, h, elapsed, stormWeight);
  drawMemorialScene(cx, w, h, elapsed, memorialWeight);
  drawFilmVignette(cx, w, h, elapsed);
}

function drawFieldScene(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  weight: number,
): void {
  if (weight <= 0.001) return;
  cx.save();
  cx.globalAlpha = weight;
  const sunset = smoothstep(3, 9.8, elapsed);
  const sky = cx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mixColor('#7fccef', '#51314d', sunset));
  sky.addColorStop(0.58, mixColor('#dff3d2', '#eb8d55', sunset));
  sky.addColorStop(1, mixColor('#80bf62', '#583d3b', sunset));
  cx.fillStyle = sky;
  cx.fillRect(0, 0, w, h);
  drawSun(cx, w * (0.76 - sunset * 0.1), h * (0.2 + sunset * 0.31), Math.min(w, h) * 0.085, 1 - sunset * 0.2);
  drawGrassField(cx, w, h, elapsed, '#4e9b45', '#183e27', 1);
  drawPollen(cx, w, h, elapsed, POLLEN, '#f8efbd', 0.7);

  const run = clamp01(elapsed / 8.8);
  const x = w * (0.08 + run * 0.7);
  const y = h * 0.73 - Math.abs(Math.sin(elapsed * 5.8)) * h * 0.035;
  const scale = clamp(Math.min(w, h) / 650, 0.68, 1.15);
  drawCat(cx, x, y, scale, 'white', {
    facing: 1,
    stride: Math.sin(elapsed * 5.8),
    tail: Math.sin(elapsed * 2.8) * 0.25,
    eyes: 'open',
  });
  drawSpeedTrails(cx, x, y, scale, elapsed);
  cx.restore();
}

function drawCafeScene(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  weight: number,
): void {
  if (weight <= 0.001) return;
  cx.save();
  cx.globalAlpha = weight;
  const room = cx.createLinearGradient(0, 0, 0, h);
  room.addColorStop(0, '#73583e');
  room.addColorStop(0.55, '#3a2d25');
  room.addColorStop(1, '#171315');
  cx.fillStyle = room;
  cx.fillRect(0, 0, w, h);

  drawCafeWindow(cx, w, h, elapsed);
  drawCafeFurniture(cx, w, h);
  drawDust(cx, w, h, elapsed);

  const scale = clamp(Math.min(w, h) / 680, 0.68, 1.12);
  const cushionY = h * 0.68;
  drawCat(cx, w * 0.61, cushionY, scale, 'black', {
    facing: -1,
    stride: 0,
    tail: Math.sin(elapsed * 1.4) * 0.14,
    eyes: elapsed < 16.4 ? 'closed' : 'open',
  });
  drawPettingHand(cx, w * 0.61, cushionY, scale, elapsed, weight);

  const entered = smoothstep(11.4, 15.4, elapsed);
  const whiteX = w * (-0.08 + entered * 0.38);
  const whiteY = h * 0.72 - Math.abs(Math.sin(elapsed * 4.2)) * 5 * (1 - entered);
  drawCat(cx, whiteX, whiteY, scale * 0.92, 'white', {
    facing: 1,
    stride: Math.sin(elapsed * 4.2) * (1 - entered),
    tail: 0.35 + Math.sin(elapsed * 2) * 0.12,
    eyes: 'open',
  });

  if (elapsed > 47) {
    const exit = smoothstep(51, 55.5, elapsed);
    cx.save();
    cx.globalAlpha = exit;
    const doorGlow = cx.createLinearGradient(w * 0.04, 0, w * 0.31, 0);
    doorGlow.addColorStop(0, 'rgba(154,183,202,0.82)');
    doorGlow.addColorStop(1, 'rgba(154,183,202,0)');
    cx.fillStyle = doorGlow;
    cx.fillRect(0, h * 0.28, w * 0.32, h * 0.55);
    cx.restore();
  }
  cx.restore();
}

function drawStormScene(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  weight: number,
): void {
  if (weight <= 0.001) return;
  cx.save();
  cx.globalAlpha = weight;
  const sky = cx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#101826');
  sky.addColorStop(0.58, '#27364b');
  sky.addColorStop(1, '#14231f');
  cx.fillStyle = sky;
  cx.fillRect(0, 0, w, h);
  drawGrassField(cx, w, h, elapsed * 2.3, '#244b35', '#091813', 1.55);
  drawRain(cx, w, h, elapsed);

  const local = elapsed - 50;
  const collapse = smoothstep(57.2, 60.2, elapsed);
  const x = w * (0.18 + clamp01(local / 10) * 0.48);
  const y = h * 0.73;
  const scale = clamp(Math.min(w, h) / 650, 0.68, 1.15);
  cx.save();
  cx.translate(x, y);
  cx.rotate(collapse * 1.3);
  cx.translate(-x, -y);
  drawCat(cx, x, y, scale, 'white', {
    facing: 1,
    stride: Math.sin(elapsed * 4.6) * (1 - collapse),
    tail: -0.35 * collapse,
    eyes: collapse > 0.7 ? 'closed' : 'open',
    soaked: true,
  });
  cx.restore();

  const lightning = pulseAt(elapsed, 55.8, 0.16) + pulseAt(elapsed, 59.3, 0.2) * 0.65;
  if (lightning > 0.01) {
    cx.fillStyle = `rgba(216,230,255,${Math.min(0.72, lightning)})`;
    cx.fillRect(0, 0, w, h);
    drawLightning(cx, w * 0.72, 0, h * 0.52, elapsed, lightning);
  }
  cx.restore();
}

function drawMemorialScene(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  weight: number,
): void {
  if (weight <= 0.001) return;
  cx.save();
  cx.globalAlpha = weight;
  const dawn = smoothstep(65, 80.5, elapsed);
  const sky = cx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mixColor('#182331', '#9fb9c1', dawn));
  sky.addColorStop(0.58, mixColor('#3a4b55', '#f0b57a', dawn));
  sky.addColorStop(1, mixColor('#24372e', '#567047', dawn));
  cx.fillStyle = sky;
  cx.fillRect(0, 0, w, h);
  drawSun(cx, w * 0.79, h * 0.39, Math.min(w, h) * 0.065, dawn * 0.72);
  drawGrassField(cx, w, h, elapsed * 0.7, '#344f39', '#101b16', 0.92);
  drawWindWave(cx, w, h, elapsed, smoothstep(70.5, 76, elapsed));

  const scale = clamp(Math.min(w, h) / 650, 0.68, 1.15);
  const groundY = h * 0.76;
  const burial = smoothstep(69.5, 76, elapsed);
  cx.save();
  cx.globalAlpha *= 1 - burial;
  drawRestingCat(cx, w * 0.48, groundY, scale, 'white', true);
  cx.restore();
  drawCatDeathBurial(cx, w * 0.48, groundY, scale, burial);

  const arrival = smoothstep(62, 68.5, elapsed);
  const departure = smoothstep(77, 82.7, elapsed);
  const blackX = w * (0.08 + arrival * 0.28 + departure * 0.48);
  const blackY = groundY - departure * h * 0.13;
  drawCat(cx, blackX, blackY, scale * (0.96 - departure * 0.38), 'black', {
    facing: 1,
    stride: Math.sin(elapsed * 3.5) * Math.max(1 - arrival, departure),
    tail: -0.18 + departure * 0.55 + Math.sin(elapsed) * 0.07,
    eyes: 'open',
  });

  drawFootprints(cx, w, h, elapsed, departure);
  cx.restore();
}

type CatPose = {
  facing: 1 | -1;
  stride: number;
  tail: number;
  eyes: 'open' | 'closed';
  soaked?: boolean;
};

function drawCat(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: 'white' | 'black',
  pose: CatPose,
): void {
  const fur = color === 'white' ? '#f4f0e7' : '#111318';
  const edge = color === 'white' ? 'rgba(90,104,115,0.72)' : 'rgba(213,189,143,0.34)';
  const eye = color === 'white' ? '#527d5e' : '#e4b850';
  const direction = pose.facing;
  cx.save();
  cx.translate(x, y);
  cx.scale(scale * direction, scale);
  cx.shadowColor = color === 'white' ? 'rgba(240,246,255,0.24)' : 'rgba(0,0,0,0.55)';
  cx.shadowBlur = 14;

  cx.strokeStyle = fur;
  cx.lineWidth = 14;
  cx.lineCap = 'round';
  cx.beginPath();
  cx.moveTo(-43, -48);
  cx.bezierCurveTo(-86, -70 - pose.tail * 30, -90, -20 + pose.tail * 70, -62, -13);
  cx.stroke();

  cx.fillStyle = fur;
  cx.beginPath();
  cx.ellipse(0, -38, 55, 36, -0.06, 0, TAU);
  cx.fill();
  cx.strokeStyle = edge;
  cx.lineWidth = 1.3;
  cx.stroke();

  const legSwing = pose.stride * 9;
  cx.strokeStyle = fur;
  cx.lineWidth = 15;
  cx.beginPath();
  cx.moveTo(-24, -25); cx.lineTo(-31 + legSwing, 4);
  cx.moveTo(25, -24); cx.lineTo(31 - legSwing, 4);
  cx.stroke();

  cx.fillStyle = fur;
  cx.beginPath();
  cx.arc(48, -66, 31, 0, TAU);
  cx.fill();
  cx.strokeStyle = edge;
  cx.lineWidth = 1.3;
  cx.stroke();
  cx.beginPath();
  cx.moveTo(27, -87); cx.lineTo(33, -119); cx.lineTo(51, -92);
  cx.moveTo(52, -93); cx.lineTo(70, -116); cx.lineTo(72, -82);
  cx.fill();
  cx.stroke();

  cx.shadowBlur = 0;
  cx.strokeStyle = eye;
  cx.fillStyle = eye;
  cx.lineWidth = 2;
  if (pose.eyes === 'closed') {
    cx.beginPath();
    cx.arc(42, -69, 5, 0.15, Math.PI - 0.15);
    cx.arc(59, -68, 5, 0.15, Math.PI - 0.15);
    cx.stroke();
  } else {
    cx.beginPath(); cx.ellipse(42, -69, 2.2, 4, 0, 0, TAU); cx.fill();
    cx.beginPath(); cx.ellipse(59, -68, 2.2, 4, 0, 0, TAU); cx.fill();
  }
  cx.fillStyle = color === 'white' ? '#8d716d' : '#b98d83';
  cx.beginPath();
  cx.moveTo(51, -58); cx.lineTo(47, -54); cx.lineTo(55, -54); cx.closePath();
  cx.fill();

  cx.strokeStyle = color === 'white' ? 'rgba(82,91,98,0.62)' : 'rgba(220,209,188,0.48)';
  cx.lineWidth = 1;
  for (const offset of [-5, 2, 9]) {
    cx.beginPath(); cx.moveTo(48, -52 + offset * 0.15); cx.lineTo(18, -55 + offset); cx.stroke();
    cx.beginPath(); cx.moveTo(55, -52 + offset * 0.15); cx.lineTo(83, -56 + offset); cx.stroke();
  }

  if (pose.soaked) {
    cx.strokeStyle = 'rgba(158,190,218,0.45)';
    cx.lineWidth = 1.2;
    for (let index = 0; index < 7; index += 1) {
      cx.beginPath();
      cx.moveTo(-35 + index * 15, -66 + index % 2 * 8);
      cx.lineTo(-31 + index * 15, -49 + index % 2 * 8);
      cx.stroke();
    }
  }
  cx.restore();
}

function drawRestingCat(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: 'white' | 'black',
  still: boolean,
): void {
  cx.save();
  cx.translate(x, y);
  cx.scale(scale, scale);
  cx.rotate(0.08);
  const fur = color === 'white' ? '#dedbd4' : '#111318';
  cx.fillStyle = fur;
  cx.shadowColor = 'rgba(0,0,0,0.45)';
  cx.shadowBlur = 16;
  cx.beginPath();
  cx.ellipse(0, -20, 68, 26, 0, 0, TAU);
  cx.fill();
  cx.beginPath();
  cx.arc(57, -30, 24, 0, TAU);
  cx.fill();
  cx.beginPath();
  cx.moveTo(44, -48); cx.lineTo(48, -73); cx.lineTo(62, -50);
  cx.moveTo(61, -50); cx.lineTo(75, -69); cx.lineTo(77, -43);
  cx.fill();
  cx.shadowBlur = 0;
  cx.strokeStyle = 'rgba(87,93,101,0.62)';
  cx.lineWidth = 1.5;
  cx.beginPath();
  cx.arc(52, -31, 5, 0.2, Math.PI - 0.2);
  cx.stroke();
  cx.strokeStyle = fur;
  cx.lineWidth = 13;
  cx.lineCap = 'round';
  cx.beginPath();
  cx.moveTo(-58, -23);
  cx.bezierCurveTo(-91, -30, -96, -2, -72, 1);
  cx.stroke();
  if (still) {
    cx.fillStyle = 'rgba(98,70,53,0.28)';
    cx.beginPath();
    cx.ellipse(-8, 3, 59, 8, 0, 0, TAU);
    cx.fill();
  }
  cx.restore();
}

function drawCafeWindow(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const x = w * 0.08, y = h * 0.12, ww = w * 0.37, wh = h * 0.42;
  const light = cx.createLinearGradient(x, y, x + ww, y + wh);
  light.addColorStop(0, '#f8ddb0');
  light.addColorStop(1, '#d49258');
  cx.fillStyle = light;
  cx.fillRect(x, y, ww, wh);
  cx.strokeStyle = '#2d251f';
  cx.lineWidth = 10;
  cx.strokeRect(x, y, ww, wh);
  cx.lineWidth = 5;
  cx.beginPath();
  cx.moveTo(x + ww / 2, y); cx.lineTo(x + ww / 2, y + wh);
  cx.moveTo(x, y + wh / 2); cx.lineTo(x + ww, y + wh / 2);
  cx.stroke();
  const rays = cx.createLinearGradient(x, y, w * 0.72, h * 0.85);
  rays.addColorStop(0, `rgba(255,228,169,${0.22 + Math.sin(elapsed * 0.4) * 0.03})`);
  rays.addColorStop(1, 'rgba(255,228,169,0)');
  cx.fillStyle = rays;
  cx.beginPath();
  cx.moveTo(x, y + wh * 0.2);
  cx.lineTo(x + ww, y + wh);
  cx.lineTo(w * 0.83, h);
  cx.lineTo(w * 0.28, h);
  cx.closePath();
  cx.fill();
}

function drawCafeFurniture(cx: CanvasRenderingContext2D, w: number, h: number): void {
  cx.fillStyle = '#4c3026';
  cx.fillRect(0, h * 0.78, w, h * 0.22);
  cx.strokeStyle = 'rgba(231,190,137,0.13)';
  cx.lineWidth = 1;
  for (let x = 0; x < w; x += 70) {
    cx.beginPath(); cx.moveTo(x, h * 0.78); cx.lineTo(x + 25, h); cx.stroke();
  }
  cx.fillStyle = '#8f6043';
  roundedRect(cx, w * 0.48, h * 0.68, w * 0.3, h * 0.1, 18);
  cx.fill();
  cx.fillStyle = '#ba825b';
  roundedRect(cx, w * 0.5, h * 0.65, w * 0.26, h * 0.085, 25);
  cx.fill();
  cx.fillStyle = 'rgba(36,27,23,0.72)';
  cx.fillRect(w * 0.84, h * 0.2, w * 0.09, h * 0.58);
}

function drawPettingHand(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  elapsed: number,
  weight: number,
): void {
  const pet = Math.sin(elapsed * 2.1) * 13;
  cx.save();
  cx.globalAlpha *= weight * (1 - smoothstep(46.5, 51, elapsed));
  cx.translate(x + 36 * scale + pet, y - 112 * scale);
  cx.rotate(-0.32);
  cx.fillStyle = '#e5b995';
  roundedRect(cx, -18 * scale, -8 * scale, 72 * scale, 22 * scale, 11 * scale);
  cx.fill();
  cx.fillStyle = '#5a4038';
  cx.fillRect(44 * scale, -11 * scale, 84 * scale, 29 * scale);
  cx.restore();
}

function drawGrassField(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  nearColor: string,
  farColor: string,
  wind: number,
): void {
  const horizon = h * 0.57;
  const ground = cx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, nearColor);
  ground.addColorStop(1, farColor);
  cx.fillStyle = ground;
  cx.fillRect(0, horizon, w, h - horizon);
  cx.strokeStyle = 'rgba(20,47,26,0.54)';
  cx.lineWidth = 1.2;
  for (const blade of GRASS) {
    const x = blade.x * w;
    const baseY = horizon + (blade.phase / TAU) * (h - horizon);
    const height = blade.height * h * (0.5 + (baseY - horizon) / (h - horizon));
    const sway = Math.sin(elapsed * 1.8 * wind + blade.phase) * 11 * wind + blade.lean * 7;
    cx.beginPath();
    cx.moveTo(x, baseY);
    cx.quadraticCurveTo(x + sway * 0.5, baseY - height * 0.55, x + sway, baseY - height);
    cx.stroke();
  }
}

function drawPollen(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  particles: readonly Particle[],
  color: string,
  opacity: number,
): void {
  cx.save();
  for (const particle of particles) {
    const x = modulo(particle.x * w + elapsed * particle.speed * 12, w);
    const y = modulo(particle.y * h + Math.sin(elapsed + particle.phase) * 18, h);
    cx.globalAlpha = opacity * (0.35 + 0.65 * Math.sin(elapsed * 1.2 + particle.phase) ** 2);
    cx.fillStyle = color;
    cx.beginPath(); cx.arc(x, y, particle.size, 0, TAU); cx.fill();
  }
  cx.restore();
}

function drawDust(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  cx.save();
  cx.beginPath();
  cx.rect(w * 0.08, h * 0.12, w * 0.67, h * 0.75);
  cx.clip();
  drawPollen(cx, w, h, elapsed * 0.22, DUST, '#ffe4b6', 0.28);
  cx.restore();
}

function drawRain(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  cx.save();
  cx.strokeStyle = 'rgba(178,208,231,0.43)';
  cx.lineWidth = 1.2;
  for (const drop of RAIN) {
    const x = modulo(drop.x * w - elapsed * 42, w + 80) - 40;
    const y = modulo(drop.y * h + elapsed * drop.speed, h + 100) - 50;
    cx.beginPath();
    cx.moveTo(x, y);
    cx.lineTo(x - drop.length * 0.36, y + drop.length);
    cx.stroke();
  }
  cx.restore();
}

function drawLightning(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  elapsed: number,
  alpha: number,
): void {
  cx.save();
  cx.strokeStyle = `rgba(235,243,255,${Math.min(1, alpha)})`;
  cx.shadowColor = '#dceaff';
  cx.shadowBlur = 22;
  cx.lineWidth = 2.2;
  cx.beginPath();
  cx.moveTo(x, y);
  for (let step = 1; step <= 8; step += 1) {
    const jitter = Math.sin(step * 18.3 + elapsed * 53) * 28;
    cx.lineTo(x + jitter, y + length * step / 8);
  }
  cx.stroke();
  cx.restore();
}

function drawWindWave(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  weight: number,
): void {
  if (weight <= 0) return;
  cx.save();
  cx.globalAlpha = weight * (1 - smoothstep(76, 80.5, elapsed));
  cx.strokeStyle = 'rgba(235,225,191,0.42)';
  cx.lineWidth = 1.2;
  for (let ribbon = 0; ribbon < 4; ribbon += 1) {
    cx.beginPath();
    for (let point = 0; point <= 48; point += 1) {
      const x = -w * 0.1 + point / 48 * w * 1.2;
      const y = h * (0.35 + ribbon * 0.06) + Math.sin(point * 0.42 + elapsed * 2 + ribbon) * 12;
      if (point === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.stroke();
  }
  cx.restore();
}

function drawFootprints(
  cx: CanvasRenderingContext2D,
  w: number,
  h: number,
  elapsed: number,
  weight: number,
): void {
  if (weight <= 0) return;
  cx.save();
  const count = 10;
  for (let index = 0; index < count; index += 1) {
    const visible = clamp01(weight * count - index);
    const x = w * (0.57 + index * 0.045);
    const y = h * (0.79 - index * 0.019) + (index % 2 ? 7 : -7);
    cx.globalAlpha = visible * 0.48;
    cx.fillStyle = '#17181b';
    cx.beginPath();
    cx.ellipse(x, y, 7, 10, -0.6, 0, TAU);
    cx.fill();
    for (let toe = 0; toe < 3; toe += 1) {
      cx.beginPath();
      cx.arc(x + (toe - 1) * 6, y - 10, 2.4, 0, TAU);
      cx.fill();
    }
  }
  cx.restore();
}

function drawSpeedTrails(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  elapsed: number,
): void {
  cx.save();
  cx.strokeStyle = 'rgba(242,247,226,0.35)';
  cx.lineWidth = 1.2;
  for (let line = 0; line < 4; line += 1) {
    const length = (34 + line * 13) * scale;
    const yy = y - (24 + line * 12) * scale + Math.sin(elapsed * 3 + line) * 4;
    cx.beginPath();
    cx.moveTo(x - 64 * scale, yy);
    cx.lineTo(x - 64 * scale - length, yy);
    cx.stroke();
  }
  cx.restore();
}

function drawSun(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  const glow = cx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
  glow.addColorStop(0, `rgba(255,238,178,${alpha})`);
  glow.addColorStop(0.3, `rgba(255,184,101,${alpha * 0.54})`);
  glow.addColorStop(1, 'rgba(255,163,86,0)');
  cx.fillStyle = glow;
  cx.beginPath(); cx.arc(x, y, radius * 3.2, 0, TAU); cx.fill();
  cx.fillStyle = `rgba(255,235,176,${alpha})`;
  cx.beginPath(); cx.arc(x, y, radius, 0, TAU); cx.fill();
}

function drawFilmVignette(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const vignette = cx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.22, w / 2, h * 0.5, Math.max(w, h) * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.66, 'rgba(0,0,0,0.1)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.76)');
  cx.fillStyle = vignette;
  cx.fillRect(0, 0, w, h);
  const breath = pulseAt(elapsed, 60.4, 0.9) * 0.24;
  if (breath > 0.001) {
    cx.fillStyle = `rgba(202,220,232,${breath})`;
    cx.fillRect(0, 0, w, h);
  }
}

function createParticles(count: number, rnd: () => number, min: number, max: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: rnd(), y: rnd(), size: min + rnd() * (max - min), speed: 0.25 + rnd(), phase: rnd() * TAU,
  }));
}

function createGrass(count: number, rnd: () => number): GrassBlade[] {
  return Array.from({ length: count }, () => ({
    x: rnd(), height: 0.025 + rnd() * 0.09, lean: rnd() * 2 - 1, phase: rnd() * TAU,
  }));
}

function createRain(count: number, rnd: () => number): RainDrop[] {
  return Array.from({ length: count }, () => ({
    x: rnd(), y: rnd(), length: 12 + rnd() * 26, speed: 350 + rnd() * 420,
  }));
}

function roundedRect(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.lineTo(x + width - r, y);
  cx.quadraticCurveTo(x + width, y, x + width, y + r);
  cx.lineTo(x + width, y + height - r);
  cx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  cx.lineTo(x + r, y + height);
  cx.quadraticCurveTo(x, y + height, x, y + height - r);
  cx.lineTo(x, y + r);
  cx.quadraticCurveTo(x, y, x + r, y);
  cx.closePath();
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = value + 0x6D2B79F5 | 0;
    let mixed = Math.imul(value ^ value >>> 15, 1 | value);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function mixColor(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const t = clamp01(amount);
  return `rgb(${Math.round(a.r + (b.r - a.r) * t)}, ${Math.round(a.g + (b.g - a.g) * t)}, ${Math.round(a.b + (b.b - a.b) * t)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: value >> 16 & 255, g: value >> 8 & 255, b: value & 255 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function smoothstep(from: number, to: number, value: number): number {
  if (from === to) return value < from ? 0 : 1;
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function pulseAt(value: number, center: number, width: number): number {
  const distance = (value - center) / width;
  return Math.exp(-distance * distance * 3.2);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

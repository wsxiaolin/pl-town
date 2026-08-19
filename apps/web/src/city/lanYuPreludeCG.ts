type CaptionTone = 'narration' | 'unknown' | 'lanyu';

type CaptionCue = {
  start: number;
  end: number;
  speaker: string;
  line: string;
  tone: CaptionTone;
};

export type LanYuCGFinishReason = 'completed' | 'skipped' | 'restarted';

export type LanYuCGHandle = {
  finished: Promise<LanYuCGFinishReason>;
  stop: () => void;
};

const TOTAL_SECONDS = 54;

// Every cue overlaps the next one slightly. The two caption planes cross-fade,
// so the sequence never drops to an empty subtitle frame between lines.
const CAPTION_CUES: readonly CaptionCue[] = [
  { start: 0, end: 3.8, speaker: '旁白', tone: 'narration', line: '月白花纹的皮制长靴，跨过焦臭的血纹大地。' },
  { start: 3.35, end: 6.0, speaker: '旁白', tone: 'narration', line: '访客哼着未知的旋律，脚步与乐音一并踩碎蜿蜒焦蔓。' },
  { start: 5.55, end: 7.2, speaker: '？？？', tone: 'lanyu', line: '嘶，唔……' },
  { start: 6.8, end: 8.55, speaker: '？？？', tone: 'unknown', line: '——醒了？' },
  { start: 8.15, end: 11.15, speaker: '岚雨', tone: 'lanyu', line: '你是谁！嘶……呃……放开我。' },
  { start: 10.7, end: 14.15, speaker: '？？？', tone: 'unknown', line: '劝你省点力，岚雨——如果你尚没有违背戒的话。' },
  { start: 13.7, end: 17.25, speaker: '？？？', tone: 'unknown', line: '你应当清楚，如果你已是血肉的空壳，你现在不会活着。' },
  { start: 16.8, end: 20.05, speaker: '岚雨', tone: 'lanyu', line: '……你拓测了我的铭？啧……你明知道我还不是血疫。' },
  { start: 19.6, end: 22.65, speaker: '岚雨', tone: 'lanyu', line: '——而你将我绑在这里，手足相残。' },
  { start: 22.2, end: 24.55, speaker: '？？？', tone: 'unknown', line: '呵，我有我的理由。' },
  { start: 24.1, end: 26.75, speaker: '？？？', tone: 'unknown', line: '我绑住的，从来不是你。' },
  { start: 26.3, end: 29.55, speaker: '？？？', tone: 'unknown', line: '是藏在你铭下，用你的心跳敲门的东西。' },
  { start: 29.1, end: 32.15, speaker: '岚雨', tone: 'lanyu', line: '那不是血疫。那是岚氏留下的旧誓。' },
  { start: 31.7, end: 34.6, speaker: '？？？', tone: 'unknown', line: '我知道。所以，我没有斩断它。' },
  { start: 34.15, end: 37.0, speaker: '旁白', tone: 'narration', line: '血纹骤然亮起，焦土之下传来第二次心跳。' },
  { start: 36.55, end: 39.35, speaker: '？？？', tone: 'unknown', line: '听——它已经学会用你的疼痛回答。' },
  { start: 38.9, end: 41.0, speaker: '岚雨', tone: 'lanyu', line: '……你想让我做什么？' },
  { start: 40.55, end: 43.4, speaker: '？？？', tone: 'unknown', line: '活着。然后记住，今晚是谁先违背了戒。' },
  { start: 42.95, end: 45.15, speaker: '岚雨', tone: 'lanyu', line: '至少留下名字。' },
  { start: 44.7, end: 47.55, speaker: '？？？', tone: 'unknown', line: '名字会被铭记。现在，还不是时候。' },
  { start: 47.1, end: 49.85, speaker: '旁白', tone: 'narration', line: '银白刃光落下。束缚断裂，血蔓却仍在地底呼吸。' },
  { start: 49.4, end: 53.7, speaker: '旁白', tone: 'narration', line: '未知的旋律重新响起。岚雨抬头时，只看见月白脚印消失在灰烬尽头。' },
];

type Particle = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  phase: number;
};

type Vein = {
  points: ReadonlyArray<{ x: number; y: number }>;
  width: number;
  phase: number;
};

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
  stop: (reason: LanYuCGFinishReason, immediate?: boolean) => void;
};

const random = mulberry32(0x1a4f20c6);
const ASH_PARTICLES = createParticles(118, random, 0.25, 1.3);
const EMBER_PARTICLES = createParticles(48, random, 0.7, 2.1);
const BLOOD_VEINS = createVeins(14, random);

let activeSession: ActiveSession | null = null;

export function playLanYuPreludeCG(): LanYuCGHandle {
  activeSession?.stop('restarted', true);
  document.querySelectorAll<HTMLElement>('[data-lanyu-cg].is-closing').forEach((element) => element.remove());

  const root = document.createElement('section');
  root.className = 'lanyu-cg';
  root.dataset.lanyuCg = 'blood-mark-prelude';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '岚雨与未知访客的隐藏影像');
  root.innerHTML = `
    <canvas class="lanyu-cg__canvas" aria-hidden="true"></canvas>
    <div class="lanyu-cg__grade" aria-hidden="true"></div>
    <div class="lanyu-cg__scanlines" aria-hidden="true"></div>
    <div class="lanyu-cg__grain" aria-hidden="true"></div>
    <div class="lanyu-cg__letterbox lanyu-cg__letterbox--top" aria-hidden="true"></div>
    <div class="lanyu-cg__letterbox lanyu-cg__letterbox--bottom" aria-hidden="true"></div>
    <div class="lanyu-cg__hud" aria-hidden="true">
      <span>UNFILED RECORD</span><span>血铭拓测 // SIGNAL 02</span>
    </div>
    <button class="lanyu-cg__skip" type="button" aria-label="跳过隐藏影像">跳过 <span>ESC</span></button>
    <div class="lanyu-cg__caption-stage" aria-live="polite">
      <div class="lanyu-cg__caption" data-caption-slot="0" aria-hidden="true">
        <span class="lanyu-cg__speaker"></span><p class="lanyu-cg__line"></p>
      </div>
      <div class="lanyu-cg__caption" data-caption-slot="1" aria-hidden="true">
        <span class="lanyu-cg__speaker"></span><p class="lanyu-cg__line"></p>
      </div>
    </div>
    <div class="lanyu-cg__title" aria-hidden="true">
      <span>THE VEIN REMEMBERS</span>
      <h1>血铭 · 序曲</h1>
      <p>岚雨&nbsp;&nbsp;/&nbsp;&nbsp;？？？</p>
    </div>
    <div class="lanyu-cg__progress" aria-hidden="true"><i></i></div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('.lanyu-cg__canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) throw new Error('LanYu CG requires a Canvas 2D context.');

  const stage: CanvasStage = { canvas, context, width: 0, height: 0, dpr: 1 };
  let resolveFinished: (reason: LanYuCGFinishReason) => void = () => undefined;
  const finished = new Promise<LanYuCGFinishReason>((resolve) => { resolveFinished = resolve; });

  const session = {} as ActiveSession;
  const onResize = () => resizeStage(stage, root);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') session.stop('skipped');
  };

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
    stop: (reason: LanYuCGFinishReason, immediate = false) => {
      if (session.finished) return;
      session.finished = true;
      cancelAnimationFrame(session.rafId);
      window.removeEventListener('resize', session.onResize);
      window.removeEventListener('keydown', session.onKeyDown);
      root.querySelector('.lanyu-cg__skip')?.removeEventListener('click', skip);
      root.classList.remove('is-active');
      root.classList.add('is-closing');
      if (activeSession === session) activeSession = null;
      if (immediate) root.remove();
      else window.setTimeout(() => root.remove(), 620);
      resolveFinished(reason);
    },
  } satisfies ActiveSession);

  const skip = () => session.stop('skipped');
  root.querySelector('.lanyu-cg__skip')?.addEventListener('click', skip);
  window.addEventListener('resize', onResize);
  window.addEventListener('keydown', onKeyDown);
  document.body.append(root);
  resizeStage(stage, root);
  activeSession = session;

  requestAnimationFrame(() => root.classList.add('is-active'));
  session.rafId = requestAnimationFrame((now) => {
    session.startedAt = now;
    animateSession(session, now);
  });

  return {
    finished,
    stop: () => session.stop('skipped'),
  };
}

export function stopLanYuPreludeCG(): boolean {
  if (!activeSession) return false;
  activeSession.stop('skipped');
  return true;
}

export function isLanYuPreludeCGActive(): boolean {
  return activeSession !== null;
}

function animateSession(session: ActiveSession, now: number): void {
  if (session.finished) return;
  const elapsed = Math.min(TOTAL_SECONDS, (now - session.startedAt) / 1000);
  drawFrame(session.stage, elapsed);
  updateCaption(session, elapsed);
  updateDomEffects(session, elapsed);

  if (elapsed >= TOTAL_SECONDS) {
    session.stop('completed');
    return;
  }
  session.rafId = requestAnimationFrame((nextNow) => animateSession(session, nextNow));
}

function updateCaption(session: ActiveSession, elapsed: number): void {
  let nextIndex = -1;
  for (let index = CAPTION_CUES.length - 1; index >= 0; index -= 1) {
    const cue = CAPTION_CUES[index];
    if (!cue) continue;
    if (elapsed >= cue.start && elapsed < cue.end) {
      nextIndex = index;
      break;
    }
  }
  if (nextIndex === session.captionIndex) return;

  session.captionIndex = nextIndex;
  const previous = session.root.querySelector<HTMLElement>(`[data-caption-slot="${session.captionSlot}"]`);
  if (nextIndex < 0) {
    previous?.classList.remove('is-current');
    previous?.setAttribute('aria-hidden', 'true');
    return;
  }

  const nextSlot = session.captionSlot === 0 ? 1 : 0;
  const cue = CAPTION_CUES[nextIndex];
  if (!cue) return;
  const caption = session.root.querySelector<HTMLElement>(`[data-caption-slot="${nextSlot}"]`);
  if (!caption) return;
  caption.dataset.tone = cue.tone;
  caption.querySelector<HTMLElement>('.lanyu-cg__speaker')!.textContent = cue.speaker;
  caption.querySelector<HTMLElement>('.lanyu-cg__line')!.textContent = cue.line;
  caption.setAttribute('aria-hidden', 'false');
  void caption.offsetWidth;
  caption.classList.add('is-current');
  session.captionSlot = nextSlot;
  requestAnimationFrame(() => {
    previous?.classList.remove('is-current');
    previous?.setAttribute('aria-hidden', 'true');
  });
}

function updateDomEffects(session: ActiveSession, elapsed: number): void {
  const progress = session.root.querySelector<HTMLElement>('.lanyu-cg__progress i');
  if (progress) progress.style.transform = `scaleX(${elapsed / TOTAL_SECONDS})`;
  if (!session.titleShown && elapsed >= 49.5) {
    session.titleShown = true;
    session.root.classList.add('is-title');
    session.root.querySelector('.lanyu-cg__title')?.setAttribute('aria-hidden', 'false');
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
  drawBackdrop(cx, w, h, elapsed);

  const quake = pulseAt(elapsed, 35.1, 0.7) * 4 + pulseAt(elapsed, 47.15, 0.22) * 7;
  cx.save();
  cx.translate(Math.sin(elapsed * 73) * quake, Math.cos(elapsed * 61) * quake * 0.45);
  drawGround(cx, w, h, elapsed);
  drawAsh(cx, w, h, elapsed);
  drawBootSequence(cx, w, h, elapsed);
  drawCaptiveScene(cx, w, h, elapsed);
  drawMarkProbe(cx, w, h, elapsed);
  drawSeveringLight(cx, w, h, elapsed);
  cx.restore();
  drawVignette(cx, w, h, elapsed);
}

function drawBackdrop(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const base = cx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#030407');
  base.addColorStop(0.5, '#0b080c');
  base.addColorStop(1, '#130608');
  cx.fillStyle = base;
  cx.fillRect(0, 0, w, h);

  const pulse = 0.58 + Math.sin(elapsed * 2.35) * 0.08 + pulseAt(elapsed, 35.1, 1.1) * 0.3;
  const glow = cx.createRadialGradient(w * 0.48, h * 0.68, 0, w * 0.48, h * 0.68, Math.max(w, h) * 0.62);
  glow.addColorStop(0, `rgba(132, 9, 20, ${0.2 * pulse})`);
  glow.addColorStop(0.45, `rgba(72, 6, 15, ${0.16 * pulse})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = glow;
  cx.fillRect(0, 0, w, h);
}

function drawGround(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const horizon = h * 0.48;
  const ground = cx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, 'rgba(22,12,14,0.2)');
  ground.addColorStop(1, 'rgba(34,8,11,0.96)');
  cx.fillStyle = ground;
  cx.beginPath();
  cx.moveTo(0, horizon);
  cx.lineTo(w, horizon);
  cx.lineTo(w, h);
  cx.lineTo(0, h);
  cx.closePath();
  cx.fill();

  cx.save();
  cx.lineCap = 'round';
  const reveal = smoothstep(0.4, 6.2, elapsed);
  const surge = 0.55 + 0.25 * Math.sin(elapsed * 2.8) + pulseAt(elapsed, 35.1, 1.35) * 1.35;
  for (let index = 0; index < BLOOD_VEINS.length; index += 1) {
    const vein = BLOOD_VEINS[index];
    if (!vein) continue;
    const visible = clamp01(reveal * BLOOD_VEINS.length - index);
    if (visible <= 0) continue;
    cx.beginPath();
    vein.points.forEach((point, pointIndex) => {
      const x = point.x * w;
      const y = horizon + point.y * (h - horizon);
      if (pointIndex === 0) cx.moveTo(x, y);
      else cx.lineTo(x, y);
    });
    cx.shadowColor = 'rgba(226, 18, 42, 0.72)';
    cx.shadowBlur = 5 + 12 * surge;
    cx.strokeStyle = `rgba(129, 9, 24, ${visible * (0.38 + 0.22 * Math.sin(elapsed * 3.1 + vein.phase))})`;
    cx.lineWidth = vein.width * (1 + 0.4 * surge);
    cx.stroke();
    cx.shadowBlur = 0;
    cx.strokeStyle = `rgba(245, 44, 67, ${visible * 0.16 * surge})`;
    cx.lineWidth = Math.max(0.65, vein.width * 0.24);
    cx.stroke();
  }
  cx.restore();

  cx.strokeStyle = 'rgba(171, 133, 123, 0.08)';
  cx.lineWidth = 1;
  for (let row = 1; row <= 7; row += 1) {
    const p = row / 7;
    const y = horizon + Math.pow(p, 1.75) * (h - horizon);
    cx.beginPath();
    cx.moveTo(0, y);
    cx.lineTo(w, y);
    cx.stroke();
  }
}

function drawAsh(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  cx.save();
  for (const ash of ASH_PARTICLES) {
    const x = modulo(ash.x * w + Math.sin(elapsed * 0.7 + ash.phase) * ash.drift * 24, w);
    const y = modulo(ash.y * h - elapsed * ash.speed * 13, h);
    const fade = 0.16 + 0.26 * (0.5 + 0.5 * Math.sin(elapsed * 1.4 + ash.phase));
    cx.globalAlpha = fade;
    cx.fillStyle = ash.phase > Math.PI ? '#d5c8bd' : '#8e3038';
    cx.beginPath();
    cx.arc(x, y, ash.radius, 0, Math.PI * 2);
    cx.fill();
  }
  cx.restore();
}

function drawBootSequence(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const opening = fadeWindow(elapsed, 0, 8.8, 0.8);
  const ending = fadeWindow(elapsed, 45.3, 52.4, 0.7);
  const weight = Math.max(opening, ending);
  if (weight <= 0) return;

  cx.save();
  cx.globalAlpha = weight;
  const local = opening >= ending ? elapsed : elapsed - 45.3;
  const direction = opening >= ending ? 1 : -1;
  const travel = clamp01(local / 7.5);
  const baseX = opening >= ending
    ? w * (0.08 + travel * 0.52)
    : w * (0.76 - travel * 0.45);
  const baseY = h * 0.79;
  const scale = clamp(w / 1300, 0.72, 1.15);
  const gait = Math.sin(local * 4.5);
  drawBoot(cx, baseX - direction * 42 * scale, baseY - Math.max(0, gait) * 12, scale, direction, gait * 0.025);
  drawBoot(cx, baseX + direction * 38 * scale, baseY - Math.max(0, -gait) * 12, scale * 0.94, direction, -gait * 0.025);
  drawMelody(cx, baseX, baseY - 120 * scale, scale, elapsed, direction);
  cx.restore();
}

function drawBoot(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  direction: number,
  rotation: number,
): void {
  cx.save();
  cx.translate(x, y);
  cx.scale(scale * direction, scale);
  cx.rotate(rotation);
  const path = new Path2D();
  path.moveTo(-24, -105);
  path.bezierCurveTo(-8, -111, 16, -108, 24, -94);
  path.lineTo(19, -22);
  path.bezierCurveTo(35, -14, 65, -6, 78, 5);
  path.bezierCurveTo(66, 17, 18, 19, -13, 12);
  path.bezierCurveTo(-24, -18, -28, -71, -24, -105);
  path.closePath();

  const leather = cx.createLinearGradient(-24, -100, 68, 15);
  leather.addColorStop(0, '#f4f1e8');
  leather.addColorStop(0.48, '#c9c7c2');
  leather.addColorStop(1, '#77777a');
  cx.shadowColor = 'rgba(238, 244, 255, 0.38)';
  cx.shadowBlur = 18;
  cx.fillStyle = leather;
  cx.fill(path);
  cx.shadowBlur = 0;
  cx.strokeStyle = 'rgba(251,252,255,0.78)';
  cx.lineWidth = 1.2;
  cx.stroke(path);

  cx.save();
  cx.clip(path);
  cx.strokeStyle = 'rgba(104, 112, 128, 0.7)';
  cx.lineWidth = 1.1;
  for (let index = 0; index < 4; index += 1) {
    cx.beginPath();
    cx.arc(-2 + index * 10, -72 + index * 14, 16 + index * 2, Math.PI * 0.95, Math.PI * 1.85);
    cx.stroke();
    cx.beginPath();
    cx.arc(13 + index * 8, -66 + index * 13, 5, 0, Math.PI * 2);
    cx.stroke();
  }
  cx.restore();
  cx.restore();
}

function drawMelody(
  cx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  elapsed: number,
  direction: number,
): void {
  cx.save();
  cx.translate(x, y);
  cx.scale(direction, 1);
  cx.lineCap = 'round';
  for (let ribbon = 0; ribbon < 3; ribbon += 1) {
    cx.beginPath();
    for (let point = 0; point <= 36; point += 1) {
      const px = point * 4.2 * scale;
      const py = Math.sin(point * 0.42 + elapsed * 2.2 + ribbon) * (5 + ribbon * 2) - ribbon * 15;
      if (point === 0) cx.moveTo(px, py);
      else cx.lineTo(px, py);
    }
    cx.strokeStyle = `rgba(214, 225, 242, ${0.22 - ribbon * 0.045})`;
    cx.lineWidth = 1.1;
    cx.stroke();
  }
  cx.restore();
}

function drawCaptiveScene(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const weight = fadeWindow(elapsed, 5.7, 48.2, 1.3);
  if (weight <= 0) return;
  cx.save();
  cx.globalAlpha = weight;
  const floorY = h * 0.79;
  const focus = smoothstep(8, 18, elapsed);
  const lanyuX = w * (0.43 - focus * 0.025);
  const visitorX = w * (0.72 + focus * 0.015);
  drawLanYu(cx, lanyuX, floorY, w, h, elapsed);
  drawUnknownVisitor(cx, visitorX, floorY, w, h, elapsed);
  cx.restore();
}

function drawLanYu(
  cx: CanvasRenderingContext2D,
  x: number,
  floorY: number,
  w: number,
  h: number,
  elapsed: number,
): void {
  const scale = clamp(Math.min(w, h) / 760, 0.72, 1.25);
  const breath = Math.sin(elapsed * 2.3) * 2.2;
  cx.save();
  cx.translate(x, floorY + breath);
  cx.scale(scale, scale);

  const aura = cx.createRadialGradient(0, -126, 0, 0, -126, 132);
  aura.addColorStop(0, 'rgba(128, 11, 26, 0.18)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = aura;
  cx.beginPath();
  cx.arc(0, -126, 132, 0, Math.PI * 2);
  cx.fill();

  cx.fillStyle = '#09090d';
  cx.beginPath();
  cx.ellipse(0, -208, 29, 36, -0.08, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.moveTo(-31, -214);
  cx.bezierCurveTo(-64, -188, -51, -128, -42, -91);
  cx.lineTo(-17, -151);
  cx.closePath();
  cx.fill();

  const coat = cx.createLinearGradient(-50, -180, 52, 5);
  coat.addColorStop(0, '#15131a');
  coat.addColorStop(1, '#06070b');
  cx.fillStyle = coat;
  cx.beginPath();
  cx.moveTo(-27, -174);
  cx.lineTo(29, -174);
  cx.lineTo(55, 0);
  cx.lineTo(-59, 0);
  cx.closePath();
  cx.fill();
  cx.strokeStyle = 'rgba(150, 124, 138, 0.23)';
  cx.lineWidth = 1.2;
  cx.stroke();

  const leftWrist = { x: -77, y: -116 };
  const rightWrist = { x: 75, y: -112 };
  cx.strokeStyle = '#17131a';
  cx.lineWidth = 17;
  cx.beginPath();
  cx.moveTo(-22, -151); cx.lineTo(leftWrist.x, leftWrist.y);
  cx.moveTo(24, -151); cx.lineTo(rightWrist.x, rightWrist.y);
  cx.stroke();
  drawChain(cx, leftWrist.x, leftWrist.y, -145, -77, elapsed);
  drawChain(cx, rightWrist.x, rightWrist.y, 145, -72, elapsed + 0.7);

  cx.strokeStyle = 'rgba(214, 55, 72, 0.75)';
  cx.shadowColor = 'rgba(232, 18, 45, 0.7)';
  cx.shadowBlur = 16;
  cx.lineWidth = 1.6;
  cx.beginPath();
  cx.moveTo(-10, -149);
  cx.lineTo(2, -138);
  cx.lineTo(-7, -125);
  cx.lineTo(12, -112);
  cx.stroke();
  cx.shadowBlur = 0;
  cx.restore();
}

function drawUnknownVisitor(
  cx: CanvasRenderingContext2D,
  x: number,
  floorY: number,
  w: number,
  h: number,
  elapsed: number,
): void {
  const reveal = smoothstep(6.4, 10.2, elapsed);
  const scale = clamp(Math.min(w, h) / 760, 0.72, 1.25);
  cx.save();
  cx.globalAlpha *= reveal;
  cx.translate(x, floorY);
  cx.scale(scale, scale);
  const shadow = cx.createRadialGradient(0, -140, 12, 0, -140, 150);
  shadow.addColorStop(0, 'rgba(0,0,0,0.82)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = shadow;
  cx.fillRect(-150, -300, 300, 320);

  cx.fillStyle = '#020307';
  cx.beginPath();
  cx.ellipse(0, -225, 30, 36, 0, 0, Math.PI * 2);
  cx.fill();
  cx.beginPath();
  cx.moveTo(-28, -194);
  cx.lineTo(31, -194);
  cx.lineTo(71, -8);
  cx.lineTo(-70, -8);
  cx.closePath();
  cx.fill();
  cx.strokeStyle = 'rgba(196, 209, 229, 0.18)';
  cx.lineWidth = 1.2;
  cx.stroke();

  cx.strokeStyle = 'rgba(222, 230, 242, 0.72)';
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(-38, -7); cx.lineTo(-27, 5); cx.lineTo(8, 4);
  cx.moveTo(11, -7); cx.lineTo(23, 5); cx.lineTo(57, 5);
  cx.stroke();

  const handWeight = smoothstep(24, 31, elapsed) * (1 - smoothstep(42, 46, elapsed));
  if (handWeight > 0) {
    cx.globalAlpha *= handWeight;
    cx.strokeStyle = 'rgba(229, 236, 247, 0.76)';
    cx.lineWidth = 2.4;
    cx.beginPath();
    cx.moveTo(-20, -168);
    cx.lineTo(-91, -136);
    cx.stroke();
    cx.beginPath();
    cx.arc(-94, -134, 6, 0, Math.PI * 2);
    cx.stroke();
  }
  cx.restore();
}

function drawChain(
  cx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  elapsed: number,
): void {
  const links = 9;
  const tension = 2.5 * Math.sin(elapsed * 7.2);
  cx.save();
  cx.strokeStyle = 'rgba(122, 126, 139, 0.76)';
  cx.lineWidth = 2.1;
  for (let index = 0; index < links; index += 1) {
    const p = index / (links - 1);
    const x = fromX + (toX - fromX) * p;
    const y = fromY + (toY - fromY) * p + Math.sin(p * Math.PI) * tension;
    cx.beginPath();
    cx.ellipse(x, y, 7, 3.2, index % 2 ? Math.PI / 2 : 0, 0, Math.PI * 2);
    cx.stroke();
  }
  cx.restore();
}

function drawMarkProbe(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const weight = fadeWindow(elapsed, 13.4, 43.8, 1.2);
  if (weight <= 0) return;
  const scale = clamp(Math.min(w, h) / 760, 0.72, 1.25);
  const x = w * (0.43 - smoothstep(8, 18, elapsed) * 0.025);
  const y = h * 0.79 - 138 * scale;
  const radius = 62 * scale;
  const scan = modulo(elapsed * 0.42, 1);
  cx.save();
  cx.globalAlpha = weight;
  cx.translate(x, y);
  cx.rotate(elapsed * 0.12);
  cx.strokeStyle = 'rgba(235, 55, 77, 0.58)';
  cx.shadowColor = 'rgba(238, 14, 48, 0.66)';
  cx.shadowBlur = 17;
  cx.lineWidth = 1.2;
  for (let ring = 0; ring < 3; ring += 1) {
    cx.beginPath();
    cx.arc(0, 0, radius + ring * 13, ring * 0.85 + elapsed * 0.22, ring * 0.85 + elapsed * 0.22 + Math.PI * 1.15);
    cx.stroke();
  }
  cx.rotate(-elapsed * 0.24);
  cx.beginPath();
  for (let point = 0; point < 6; point += 1) {
    const angle = point / 6 * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * radius * 0.74;
    const py = Math.sin(angle) * radius * 0.74;
    if (point === 0) cx.moveTo(px, py);
    else cx.lineTo(px, py);
  }
  cx.closePath();
  cx.stroke();
  cx.shadowBlur = 0;

  const scanY = -radius + scan * radius * 2;
  const beam = cx.createLinearGradient(0, scanY - 16, 0, scanY + 16);
  beam.addColorStop(0, 'rgba(255,60,82,0)');
  beam.addColorStop(0.5, 'rgba(255,92,110,0.32)');
  beam.addColorStop(1, 'rgba(255,60,82,0)');
  cx.fillStyle = beam;
  cx.fillRect(-radius, scanY - 16, radius * 2, 32);

  const heartbeat = Math.pow(Math.max(0, Math.sin(elapsed * Math.PI * 2.2)), 9);
  cx.fillStyle = `rgba(255, 79, 98, ${0.55 + heartbeat * 0.4})`;
  cx.beginPath();
  cx.arc(0, 0, 4 + heartbeat * 5, 0, Math.PI * 2);
  cx.fill();
  cx.restore();
}

function drawSeveringLight(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const surge = fadeWindow(elapsed, 33.5, 41.7, 0.7);
  if (surge > 0) {
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    for (const ember of EMBER_PARTICLES) {
      const life = modulo(ember.phase + elapsed * ember.speed * 0.08, 1);
      const x = w * 0.45 + (ember.x - 0.5) * w * 0.48 * life;
      const y = h * 0.68 + (ember.y - 0.6) * h * 0.42 * life - life * 70;
      cx.globalAlpha = surge * (1 - life) * 0.72;
      cx.fillStyle = ember.phase > Math.PI ? '#ffb2a2' : '#ef284b';
      cx.beginPath();
      cx.arc(x, y, ember.radius * (0.6 + life), 0, Math.PI * 2);
      cx.fill();
    }
    cx.restore();
  }

  const slash = pulseAt(elapsed, 47.15, 0.38);
  if (slash <= 0.001) return;
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  cx.translate(w * 0.63, h * 0.36);
  cx.rotate(-0.76);
  const beam = cx.createLinearGradient(-w * 0.26, 0, w * 0.26, 0);
  beam.addColorStop(0, 'rgba(220,232,255,0)');
  beam.addColorStop(0.48, `rgba(235,244,255,${slash})`);
  beam.addColorStop(0.52, `rgba(255,255,255,${slash})`);
  beam.addColorStop(1, 'rgba(220,232,255,0)');
  cx.strokeStyle = beam;
  cx.shadowColor = '#d9e9ff';
  cx.shadowBlur = 28;
  cx.lineWidth = 2 + slash * 9;
  cx.beginPath();
  cx.moveTo(-w * 0.34, 0);
  cx.lineTo(w * 0.34, 0);
  cx.stroke();
  cx.restore();

  cx.fillStyle = `rgba(238, 246, 255, ${slash * 0.4})`;
  cx.fillRect(0, 0, w, h);
}

function drawVignette(cx: CanvasRenderingContext2D, w: number, h: number, elapsed: number): void {
  const vignette = cx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.18, w / 2, h * 0.5, Math.max(w, h) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.68, 'rgba(0,0,0,0.12)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.82)');
  cx.fillStyle = vignette;
  cx.fillRect(0, 0, w, h);

  const flicker = pulseAt(elapsed, 35.1, 0.18) * 0.18;
  if (flicker > 0.001) {
    cx.fillStyle = `rgba(190, 14, 37, ${flicker})`;
    cx.fillRect(0, 0, w, h);
  }
}

function createParticles(
  count: number,
  rnd: () => number,
  minRadius: number,
  maxRadius: number,
): Particle[] {
  return Array.from({ length: count }, () => ({
    x: rnd(),
    y: rnd(),
    radius: minRadius + rnd() * (maxRadius - minRadius),
    speed: 0.25 + rnd() * 1.1,
    drift: 0.3 + rnd() * 1.4,
    phase: rnd() * Math.PI * 2,
  }));
}

function createVeins(count: number, rnd: () => number): Vein[] {
  return Array.from({ length: count }, (_, index) => {
    const points: Array<{ x: number; y: number }> = [];
    const direction = index % 2 === 0 ? -1 : 1;
    const origin = 0.48 + (rnd() - 0.5) * 0.12;
    for (let point = 0; point < 9; point += 1) {
      const p = point / 8;
      points.push({
        x: origin + direction * p * (0.12 + rnd() * 0.46) + Math.sin(p * 8 + index) * 0.018,
        y: 1.04 - p * (0.32 + rnd() * 0.62),
      });
    }
    return { points, width: 0.8 + rnd() * 2.2, phase: rnd() * Math.PI * 2 };
  });
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

function fadeWindow(value: number, start: number, end: number, fade: number): number {
  return smoothstep(start, start + fade, value) * (1 - smoothstep(end - fade, end, value));
}

function pulseAt(value: number, center: number, width: number): number {
  const distance = (value - center) / width;
  return Math.exp(-distance * distance * 3.2);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

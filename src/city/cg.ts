// CG ANIMATION SYSTEM — 5-scene opening cinematic
import { gsap } from 'gsap';

type CGOptions = {
  onFinish: () => void;
  reduced?: boolean;
};

let cgTimeline: gsap.core.Timeline | null = null;
let cgAutoEnterTimer: number | null = null;
let cgScene5Shown = false;
let options: CGOptions = { onFinish: () => {} };

export function initCG(opts: CGOptions): void {
  options = opts;
}

export function destroyCG(): void {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  clearAutoEnter();
  options = { onFinish: () => {} };
}

export function shouldShowCG(): boolean {
  return !localStorage.getItem('minicityCGSeenV2');
}

export function startCG(): void {
  const overlay = document.getElementById('cgOverlay')!;
  const wrap = document.getElementById('cgSceneWrap')!;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
  cgScene5Shown = false;

  if (options.reduced) { endCG(); return; }

  cgTimeline = gsap.timeline();

  cgTimeline.call(() => scene1(wrap), [], 0)
           .to({}, { duration: 4 }, 0);
  cgTimeline.call(() => scene2(wrap), [], 4)
           .to({}, { duration: 4 }, 4);
  cgTimeline.call(() => scene3(wrap), [], 8)
           .to({}, { duration: 4 }, 8);
  cgTimeline.call(() => scene4(wrap), [], 12)
           .to({}, { duration: 4 }, 12);
  cgTimeline.call(() => scene5(wrap), [], 16);
}

function scene1(wrap: HTMLElement) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-void"><div class="cg-fall-lines"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">UNKNOWN ALTITUDE</span>
      <p class="cg-line cg-line-large">坠落。</p>
      <p class="cg-line" style="animation-delay:1.7s">可地面始终没有到来。</p>
    </div>`;
}

function scene2(wrap: HTMLElement) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-wake"><div class="cg-horizon"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">SIGNAL ACQUIRED</span>
      <p class="cg-line">你睁开眼睛。</p>
      <p class="cg-line cg-highlight" style="animation-delay:1.8s">陌生的天际线正在苏醒。</p>
    </div>`;
}

function scene3(wrap: HTMLElement) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-city"><div class="cg-city-silhouette"></div><div class="cg-searchlight"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">SECTOR 00 / MINICITY</span>
      <p class="cg-line">道路把城市切成两半。</p>
      <p class="cg-line" style="animation-delay:1.6s">一半明亮，一半吞没所有回声。</p>
    </div>`;
}

function scene4(wrap: HTMLElement) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-approach"><div class="cg-gate"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">CITY LIMIT</span>
      <p class="cg-line cg-quote">「一座城市，怎么会没有管理人员呢？」</p>
      <p class="cg-line" style="animation-delay:1.8s">空旷的声音，像是在回答你。</p>
    </div>`;
}

function scene5(wrap: HTMLElement) {
  if (cgScene5Shown) return;
  cgScene5Shown = true;
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-title"></div>
    <div class="cg-frame"></div>
    <div class="cg-title-block">
      <span class="cg-kicker">A CITY AWAITS</span>
      <h1 class="cg-title">物实小城</h1>
      <p class="cg-title-en">MINICITY</p>
      <button class="cg-enter-btn" id="cgEnterBtn">进入边界</button>
    </div>`;
  const btn = document.getElementById('cgEnterBtn');
  if (btn) btn.addEventListener('click', endCG);
  cgAutoEnterTimer = window.setTimeout(endCG, 8000);
}

export function skipCG(): void {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  clearAutoEnter();
  const wrap = document.getElementById('cgSceneWrap')!;
  scene5(wrap);
}

export function endCG(): void {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  clearAutoEnter();
  localStorage.setItem('minicityCGSeenV2', 'true');
  const overlay = document.getElementById('cgOverlay')!;
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
    options.onFinish();
  }, 600);
}

function clearAutoEnter(): void {
  if (cgAutoEnterTimer !== null) { clearTimeout(cgAutoEnterTimer); cgAutoEnterTimer = null; }
}

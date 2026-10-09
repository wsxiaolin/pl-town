// 原神研究院体验音效：全部用 WebAudio 程序化合成（无音频资产，AudioContext
// 惰性创建——浏览器自动播放策略要求首次用户手势后才 resume）。
// - tick：对话打字机的「哒哒」声（与 typewriter 的每字动画同步）
// - duang：启动页大门浮现的低频冲击
// - doorOpen：开门滑音 + 白噪声衰减
// - flash：过门白闪的噪声 swell
// - pad：启动页环境底噪（音量极低，避免打扰）
// 模块只持有合成函数；AudioContext 与节点都在首次调用时创建，退出体验时
// close 释放。

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 对话打字机的「哒哒」声：短促方波 + 指数衰减。 */
export function playTypeTick(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'square';
  osc.frequency.value = 1250 + Math.random() * 220;
  gain.gain.setValueAtTime(0.028, t);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.03);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.035);
}

/** 大门浮现的「Duang」：低频正弦下滑 + 短噪声脉冲。 */
export function playDuang(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.42);
  gain.gain.setValueAtTime(0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.55);
}

/** 开门：低频滑音（门轴感）+ 衰减白噪。 */
export function playDoorOpen(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(64, t);
  osc.frequency.linearRampToValueAtTime(150, t + 0.5);
  gain.gain.setValueAtTime(0.09, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.75);
  const buffer = ac.createBuffer(1, ac.sampleRate * 0.6, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ac.createBufferSource();
  const noiseGain = ac.createGain();
  noise.buffer = buffer;
  noiseGain.gain.setValueAtTime(0.05, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  noise.connect(noiseGain).connect(ac.destination);
  noise.start(t);
}

/** 过门白闪：噪声 swell（涨起再落下）。 */
export function playFlash(): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const buffer = ac.createBuffer(1, ac.sampleRate * 1.4, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const noise = ac.createBufferSource();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(5200, t + 0.7);
  noise.buffer = buffer;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.1, t + 0.65);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  noise.connect(filter).connect(gain).connect(ac.destination);
  noise.start(t);
}

export type PadHandle = { stop: () => void };

/** 启动页环境底噪：两枚失谐长音 + 缓慢音量呼吸（音量极低）。 */
export function startAmbientPad(): PadHandle | null {
  const ac = audio();
  if (!ac) return null;
  const t = ac.currentTime;
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.linearRampToValueAtTime(0.02, t + 2.5);
  master.connect(ac.destination);
  const oscs: OscillatorNode[] = [];
  [220, 220.7, 329.63].forEach((freq, i) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = i === 2 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    gain.gain.value = i === 2 ? 0.35 : 1;
    osc.connect(gain).connect(master);
    osc.start(t);
    oscs.push(osc);
  });
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 0.09;
  lfoGain.gain.value = 0.006;
  lfo.connect(lfoGain).connect(master.gain);
  lfo.start(t);
  oscs.push(lfo);
  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      const now = ac.currentTime;
      try {
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0.0001, now + 1.2);
      } catch { /* 已在释放中 */ }
      oscs.forEach((osc) => osc.stop(now + 1.3));
    },
  };
}

/** 释放 AudioContext（体验退出时调用，下一次使用会重建）。 */
export function disposeGenshinAudio(): void {
  if (ctx) {
    void ctx.close().catch(() => undefined);
    ctx = null;
  }
}

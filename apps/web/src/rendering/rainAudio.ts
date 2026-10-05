// 程序化雨声:双层过滤白噪声(高频沙沙 + 低频哗啦),无音频资产。
// 浏览器自动播放策略下 AudioContext 可能 suspended,首次用户交互时 resume。
export type RainAudio = {
  start: () => void;
  setIntensity: (wetness: number) => void;
  stop: () => void;
  dispose: () => void;
};

const HISS_LEVEL = 0.05;
const RUMBLE_LEVEL = 0.055;

export function createRainAudio(): RainAudio {
  let ctx: AudioContext | null = null;
  let hissGain: GainNode | null = null;
  let rumbleGain: GainNode | null = null;
  let stopped = true;
  let lastIntensity = -1;
  let unlock: (() => void) | null = null;

  function ensure(): boolean {
    if (ctx) return true;
    if (typeof window === 'undefined') return false;
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    hissGain = ctx.createGain();
    hissGain.gain.value = 0;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 2800;
    hissFilter.Q.value = 0.55;
    const hiss = ctx.createBufferSource();
    hiss.buffer = noise;
    hiss.loop = true;
    hiss.connect(hissFilter);
    hissFilter.connect(hissGain);
    hissGain.connect(master);
    hiss.start();

    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 480;
    const rumble = ctx.createBufferSource();
    rumble.buffer = noise;
    rumble.loop = true;
    rumble.playbackRate.value = 0.82;
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start();
    return true;
  }

  function resumeOnGesture(): void {
    if (!ctx || ctx.state !== 'suspended') return;
    unlock = () => {
      void ctx?.resume();
      if (unlock) {
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
        unlock = null;
      }
    };
    document.addEventListener('pointerdown', unlock, { once: false });
    document.addEventListener('keydown', unlock, { once: false });
  }

  function start(): void {
    if (!ensure() || !ctx) return;
    stopped = false;
    lastIntensity = -1;
    if (ctx.state === 'suspended') resumeOnGesture();
    else void ctx.resume();
  }

  function setIntensity(wetness: number): void {
    if (!ctx || !hissGain || !rumbleGain || stopped) return;
    // 每帧调用的节流:雨强变化足够明显时才排一次 ramp,避免堆积 AudioParam 事件。
    if (Math.abs(wetness - lastIntensity) < 0.04) return;
    lastIntensity = wetness;
    const t = ctx.currentTime;
    hissGain.gain.cancelScheduledValues(t);
    hissGain.gain.setValueAtTime(hissGain.gain.value, t);
    hissGain.gain.linearRampToValueAtTime(wetness * HISS_LEVEL, t + 1.4);
    rumbleGain.gain.cancelScheduledValues(t);
    rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, t);
    rumbleGain.gain.linearRampToValueAtTime(wetness * RUMBLE_LEVEL, t + 1.8);
  }

  function stop(): void {
    stopped = true;
    lastIntensity = -1;
    if (!ctx || !hissGain || !rumbleGain) return;
    const t = ctx.currentTime;
    hissGain.gain.cancelScheduledValues(t);
    hissGain.gain.setValueAtTime(hissGain.gain.value, t);
    hissGain.gain.linearRampToValueAtTime(0, t + 1.2);
    rumbleGain.gain.cancelScheduledValues(t);
    rumbleGain.gain.setValueAtTime(rumbleGain.gain.value, t);
    rumbleGain.gain.linearRampToValueAtTime(0, t + 1.2);
    window.setTimeout(() => {
      if (stopped && ctx?.state === 'running') void ctx.suspend();
    }, 1800);
  }

  function dispose(): void {
    stopped = true;
    if (unlock) {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      unlock = null;
    }
    void ctx?.close().catch(() => {});
    ctx = null;
    hissGain = null;
    rumbleGain = null;
  }

  return { start, setIntensity, stop, dispose };
}

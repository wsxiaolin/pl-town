// GPU capability probe — runs once during the heavy (first) boot to report
// which GPU will actually render the city, and to seed sensible quality
// defaults. WebGL deliberately hides eGPU/discrete details behind a generic
// vendor string, so we read the unmasked renderer (WEBGL_debug_renderer_info)
// and classify by keyword. The raw renderer string is always surfaced so an
// external GPU (eGPU) shows up under its own name as reported by the driver.
// WebGPU support is a synchronous navigator.gpu existence check.

export type GpuTier = 'discrete' | 'integrated' | 'apple' | 'software' | 'unknown';

export type GpuInfo = {
  renderer: string;
  vendor: string;
  tier: GpuTier;
  tierLabel: string;
  webgpu: boolean;
  sampledAt: number;
};

const GPU_INFO_KEY = 'minicityGpuInfo';
const RENDER_SETTINGS_KEY = 'minicityRenderSettings';

const DISCRETE_HINTS = [/nvidia/i, /geforce/i, /quadro/i, /radeon(?!\s+(?:hd|r[5-7]\d\d)\b)/i, /amd\s+radeon\s+(?:rx|pro|v)/i, /arc\s+[ab]\d/i, /dg1/i];
const SOFTWARE_HINTS = [/swiftshader/i, /llvmpipe/i, /softpipe/i, /software/i, /basic render/i];
const INTEGRATED_HINTS = [/intel(?!.*(?:arc|dg1))/i, /uhd graphics/i, /hd graphics/i, /iris/i, /mali/i, /adreno\s*[1-6]\d\d/i, /videocore/i, /powervr/i];
const APPLE_HINT = /apple\s*m\d/i;

export function classifyGpu(renderer: string): { tier: GpuTier; tierLabel: string } {
  if (SOFTWARE_HINTS.some((re) => re.test(renderer))) return { tier: 'software', tierLabel: '软件渲染（无 GPU 加速）' };
  if (APPLE_HINT.test(renderer)) return { tier: 'apple', tierLabel: 'Apple 芯片 GPU' };
  if (DISCRETE_HINTS.some((re) => re.test(renderer))) return { tier: 'discrete', tierLabel: '独立显卡' };
  if (INTEGRATED_HINTS.some((re) => re.test(renderer))) return { tier: 'integrated', tierLabel: '集成显卡' };
  return { tier: 'unknown', tierLabel: '未知图形处理器' };
}

function readWebGlRenderer(): { renderer: string; vendor: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', { powerPreference: 'high-performance' })
      ?? canvas.getContext('webgl', { powerPreference: 'high-performance' });
    if (!gl) return { renderer: '', vendor: '' };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? '')
      : String(gl.getParameter(gl.RENDERER) ?? '');
    const vendor = debug
      ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) ?? '')
      : String(gl.getParameter(gl.VENDOR) ?? '');
    const lose = gl.getExtension('WEBGL_lose_context');
    lose?.loseContext();
    return { renderer, vendor };
  } catch {
    return { renderer: '', vendor: '' };
  }
}

function readCachedGpuInfo(): GpuInfo | null {
  try {
    const raw = localStorage.getItem(GPU_INFO_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as GpuInfo;
    if (typeof saved?.renderer === 'string' && typeof saved?.tier === 'string') return saved;
  } catch { /* fall through to a fresh probe. */ }
  return null;
}

/**
 * Synchronous probe for the boot path — cached sample when available, else a
 * quick WebGL read. The probe context is destroyed via WEBGL_lose_context and
 * the result cached, so the second-context cost (see Agents.md warning) is
 * paid once per device, never per boot. WebGPU availability is a synchronous
 * `navigator.gpu` existence check — informational only.
 */
export function probeGpu(): GpuInfo {
  const cached = readCachedGpuInfo();
  if (cached) return cached;
  const { renderer, vendor } = readWebGlRenderer();
  const { tier, tierLabel } = classifyGpu(renderer || 'unknown');
  const webgpu = Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
  const info: GpuInfo = { renderer: renderer || '未知', vendor, tier, tierLabel, webgpu, sampledAt: Date.now() };
  try { localStorage.setItem(GPU_INFO_KEY, JSON.stringify(info)); } catch { /* ignore. */ }
  return info;
}

export function describeGpuForBoot(info: GpuInfo): string {
  return `图形处理器：${gpuSummaryLine(info)}`;
}

export function gpuSummaryLine(info: GpuInfo): string {
  const accel = info.webgpu ? ' · WebGPU 可用' : '';
  return `${info.renderer}（${info.tierLabel}${accel}）`;
}

/**
 * First-run quality seed: capable GPUs get the full HD treatment, software
 * renderers get a lightweight scene. Only applied when the visitor has never
 * saved render settings of their own.
 */
export function applyGpuSuggestedRenderSettings(info: GpuInfo): void {
  if (localStorage.getItem(RENDER_SETTINGS_KEY)) return;
  const presets: Record<GpuTier, Partial<Record<'resolution' | 'antialias' | 'shadows' | 'textureRendering' | 'waterRendering', number | boolean>>> = {
    discrete: { resolution: 2, antialias: true, shadows: false, textureRendering: true, waterRendering: true },
    apple: { resolution: 2, antialias: true, shadows: false, textureRendering: true, waterRendering: true },
    integrated: { resolution: 1.5, antialias: true, shadows: false, textureRendering: true, waterRendering: true },
    software: { resolution: 1, antialias: false, shadows: false, textureRendering: false, waterRendering: false },
    unknown: {},
  };
  const preset = presets[info.tier];
  if (!preset || Object.keys(preset).length === 0) return;
  try { localStorage.setItem(RENDER_SETTINGS_KEY, JSON.stringify(preset)); } catch { /* ignore. */ }
}

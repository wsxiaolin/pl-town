import * as THREE from 'three';

export type RenderSettings = {
  resolution: number;
  antialias: boolean;
  anisotropy: number;
  shadows: boolean;
  exposure: number;
};

export const RENDER_SETTINGS_KEY = 'minicityRenderSettings';
export const MAX_RENDER_RESOLUTION = 4;

const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  resolution: matchMedia('(max-width: 680px)').matches ? 1.5 : 2,
  antialias: !matchMedia('(max-width: 680px)').matches,
  anisotropy: 16,
  shadows: false,
  exposure: 1.18,
};

export function readRenderSettings(): RenderSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(RENDER_SETTINGS_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      return {
        resolution: Math.max(0.5, Math.min(MAX_RENDER_RESOLUTION, Number(saved.resolution) || DEFAULT_RENDER_SETTINGS.resolution)),
        antialias: Boolean(saved.antialias),
        anisotropy: [1, 4, 8, 16].includes(Number(saved.anisotropy)) ? Number(saved.anisotropy) : 16,
        shadows: Boolean(saved.shadows),
        exposure: Math.max(0.8, Math.min(1.5, Number(saved.exposure) || 1.18)),
      };
    }
  } catch { /* Use defaults when storage contains invalid data. */ }
  return { ...DEFAULT_RENDER_SETTINGS };
}

export function getRenderResolutionLimit(maxTextureSize: number, viewportWidth: number, viewportHeight: number): number {
  const longestViewportEdge = Math.max(1, viewportWidth, viewportHeight);
  const textureLimit = Math.floor((maxTextureSize / longestViewportEdge) * 4) / 4;
  return Math.max(0.5, Math.min(MAX_RENDER_RESOLUTION, textureLimit));
}

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const settings = readRenderSettings();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: settings.antialias,
    powerPreference: 'high-performance',
  });

  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const resolutionLimit = getRenderResolutionLimit(
    renderer.capabilities.maxTextureSize,
    window.innerWidth,
    window.innerHeight,
  );
  renderer.setPixelRatio(Math.min(settings.resolution, resolutionLimit));
  // Thousands of static shadow casters made the shadow pass more expensive
  // than the main render and could reset the GPU context on integrated GPUs.
  renderer.shadowMap.enabled = settings.shadows;
  if (settings.shadows) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = settings.exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.sortObjects = true;
  return renderer;
}

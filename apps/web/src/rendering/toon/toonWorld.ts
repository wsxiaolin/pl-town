import * as THREE from 'three';
import { createToonGradientMap } from './toonGradient';

/**
 * First-person world restyle: while active, every standard PBR material in
 * the scene is swapped for a cel-shaded toon twin so walking through the city
 * feels like an anime game rather than a photoreal maquette.
 *
 * - Swaps only `MeshStandardMaterial` instances; custom `ShaderMaterial`s
 *   (sea, shore surf, pond water) are untouched and keep their animation.
 * - Also retunes lights + tone mapping for the cel look (ambient down so the
 *   toon light bands stay visible, directional up, Linear tone mapping so
 *   colors stay saturated). Everything is restored on exit.
 * - Weather repaints land on the original materials; `syncWeather()` mirrors
 *   the refreshed color/map into the toon twins so rain/snow stays visible.
 */
export type ToonWorld = {
  enter(): void;
  exit(): void;
  isActive(): boolean;
  /** Mirror weather-refreshed colors/maps from the originals into the toon twins. */
  syncWeather(): void;
};

type SwapRecord = { mesh: THREE.Mesh | THREE.InstancedMesh; original: THREE.MeshStandardMaterial };

// Rim light: bright sky-white edge highlight — the "二游" silhouette kiss.
// Strong enough to survive JPEG compression and street-view grazing angles.
const RIM_COLOR_R = 0.72;
const RIM_COLOR_G = 0.86;
const RIM_COLOR_B = 1.0;
const RIM_INTENSITY = 1.15;

export function createToonWorld(options: {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  getIsNight: () => boolean;
}): ToonWorld {
  const { scene, renderer } = options;
  let active = false;
  let gradientMap: THREE.DataTexture | null = null;
  const toonByOriginal = new Map<THREE.MeshStandardMaterial, THREE.MeshToonMaterial>();
  const swaps: SwapRecord[] = [];
  const restoredLights: Array<{ light: THREE.Light; intensity: number }> = [];
  let restoredToneMapping: THREE.ToneMapping | null = null;
  let restoredExposure: number | null = null;

  function toonTwin(original: THREE.MeshStandardMaterial): THREE.MeshToonMaterial {
    const existing = toonByOriginal.get(original);
    if (existing) return existing;
    // Flat cel colors: procedural PBR texture noise (stone speckle, wood
    // grain) reads as photographic realism — the anime look wants clean
    // pastel color fields, with the geometry itself carrying the detail.
    const color = original.color.clone();
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    color.setHSL(hsl.h, Math.min(1, hsl.s * 1.28 + 0.08), Math.min(0.85, hsl.l * 1.04 + 0.02));
    const twin = new THREE.MeshToonMaterial({
      color,
      gradientMap: gradientMap ?? undefined,
      emissive: original.emissive.clone(),
      emissiveIntensity: Math.max(original.emissiveIntensity, original.emissiveIntensity > 0 ? 0.5 : 0),
      emissiveMap: original.emissiveMap,
      transparent: original.transparent,
      opacity: original.opacity,
      side: original.side,
      alphaTest: original.alphaTest,
      depthWrite: original.depthWrite,
    });
    // Anime rim light: a fresnel edge highlight injected after the toon
    // lighting — the signature "二游" silhouette kiss that makes characters
    // and buildings pop from the background.
    twin.onBeforeCompile = (shader) => {
      // r154+ renamed the chunk; see the deprecation map in three.module.js.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        [
          '  float rimMask = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));',
          '  float rim = pow(rimMask, 2.2);',
          `  outgoingLight += vec3(${RIM_COLOR_R}, ${RIM_COLOR_G}, ${RIM_COLOR_B}) * rim * ${RIM_INTENSITY};`,
          '#include <opaque_fragment>',
        ].join('\n'),
      );
    };
    twin.customProgramCacheKey = () => 'minicity-toon-rim';
    // Render order lives on the mesh, untouched by the material swap.
    toonByOriginal.set(original, twin);
    return twin;
  }

  function applyToMaterialSlot(object: THREE.Object3D): void {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.InstancedMesh)) return;
    const material = object.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;
    // Batched instanced meshes share the source material instance; the twin
    // map dedupes, so swapping per mesh still produces one toon per material.
    const twin = toonTwin(material);
    if (object.material !== twin) swaps.push({ mesh: object, original: material });
    object.material = twin;
  }

  function retuneLights(night: boolean): void {
    scene.traverse((object) => {
      const light = object as THREE.Light;
      if (!(light as unknown as { isLight?: boolean }).isLight) return;
      if (light instanceof THREE.AmbientLight) {
        // Ambient is NOT run through the toon ramp (only direct light is), so
        // it must stay LOW or it flattens the cel bands into smooth realism.
        restoredLights.push({ light, intensity: light.intensity });
        light.intensity = night ? 0.12 : 0.05;
      } else if (light instanceof THREE.DirectionalLight) {
        restoredLights.push({ light, intensity: light.intensity });
        // Band targets (linear light × ramp step + ambient → sRGB):
        // day 1.0 / 0.66 / 0.31 ≈ 255 / 179 / 88 — hard, clearly separated
        // anime bands. Night rides the moon lower with emissive windows.
        if (light.name === 'dir') light.intensity = night ? 0.7 : 0.95;
        else light.intensity = night ? 0.1 : 0.14;
      }
    });
  }

  function enter(): void {
    if (active) return;
    active = true;
    gradientMap = createToonGradientMap();
    const night = options.getIsNight();
    scene.traverse((object) => { applyToMaterialSlot(object); });
    retuneLights(night);
    restoredToneMapping = renderer.toneMapping;
    restoredExposure = renderer.toneMappingExposure;
    // ACES desaturates and dims the hard toon bands; Linear keeps the
    // painted palette loud and clean.
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
  }

  function exit(): void {
    if (!active) return;
    active = false;
    for (const { mesh, original } of swaps) mesh.material = original;
    swaps.length = 0;
    for (const { light, intensity } of restoredLights) light.intensity = intensity;
    restoredLights.length = 0;
    if (restoredToneMapping !== null) renderer.toneMapping = restoredToneMapping;
    if (restoredExposure !== null) renderer.toneMappingExposure = restoredExposure;
    restoredToneMapping = null;
    restoredExposure = null;
    for (const twin of toonByOriginal.values()) twin.dispose();
    toonByOriginal.clear();
    gradientMap?.dispose();
    gradientMap = null;
  }

  function syncWeather(): void {
    if (!active) return;
    // Twins are mapless flat-color cel surfaces; weather repaints arrive as
    // color changes on the originals and pass through here.
    for (const [original, twin] of toonByOriginal) {
      twin.color.copy(original.color);
    }
  }

  return { enter, exit, isActive: () => active, syncWeather };
}

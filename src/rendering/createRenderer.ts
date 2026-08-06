import * as THREE from 'three';

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !matchMedia('(max-width: 680px)').matches,
    powerPreference: 'high-performance',
  });

  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const isMobile = matchMedia('(max-width: 680px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  // Thousands of static shadow casters made the shadow pass more expensive
  // than the main render and could reset the GPU context on integrated GPUs.
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.sortObjects = true;
  return renderer;
}

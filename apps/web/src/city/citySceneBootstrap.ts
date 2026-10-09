import * as THREE from 'three';
import { createRenderer } from '../rendering/createRenderer';
export { addCityFountain, addCityLighting } from './scenePresentationController';

type SkyTextures = { skyDay: THREE.Texture | null; skyNight: THREE.Texture | null };
type Palette = { NIGHT_BG: number; DAY_BG: number } & Record<string, number>;

export function createCityWebRenderer(): THREE.WebGLRenderer {
  return createRenderer(document.getElementById('c') as HTMLCanvasElement);
}

export function createCityOrthographicCamera(zoom: number): THREE.OrthographicCamera {
  // far 120 → 320：岚屏岭主脊外扩到 z ≈ -150..-200、山麓/裙板铺到 ±420 后，
  // 沿视线（CAMERA_OFFSET=(24,40,24)）的深度约 52.5 + 0.457·|z|，z=-420 处
  // ≈ 245 —— 远裁剪面必须盖住山体与裙板，否则远景被整片裁掉。
  return new THREE.OrthographicCamera(-zoom, zoom, zoom, -zoom, 0.1, 320);
}

export function createCityScene(night: boolean, textures: SkyTextures, palette: Palette): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = night ? textures.skyNight : textures.skyDay;
  if (!scene.background) scene.background = new THREE.Color(night ? palette.NIGHT_BG : palette.DAY_BG);
  return scene;
}

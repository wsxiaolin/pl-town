import * as THREE from 'three';
import { createRenderer } from '../rendering/createRenderer';
export { addCityFountain, addCityLighting } from './scenePresentationController';

type SkyTextures = { skyDay: THREE.Texture | null; skyNight: THREE.Texture | null };
type Palette = { NIGHT_BG: number; DAY_BG: number } & Record<string, number>;

export function createCityWebRenderer(): THREE.WebGLRenderer {
  return createRenderer(document.getElementById('c') as HTMLCanvasElement);
}

export function createCityOrthographicCamera(zoom: number): THREE.OrthographicCamera {
  return new THREE.OrthographicCamera(-zoom, zoom, zoom, -zoom, 0.1, 120);
}

export function createCityScene(night: boolean, textures: SkyTextures, palette: Palette): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = night ? textures.skyNight : textures.skyDay;
  if (!scene.background) scene.background = new THREE.Color(night ? palette.NIGHT_BG : palette.DAY_BG);
  return scene;
}

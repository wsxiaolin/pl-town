// Shared animated water helpers for the west beach sea and the in-city ponds.
// Both run the same three.js Water shader so city water matches the sea look
// once the "water rendering" render setting is enabled.
import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import waterNormalsUrl from '../assets/textures/waternormals.jpg';

export const SUN_DIRECTION = new THREE.Vector3(0.5, 0.8, 0.35).normalize();

export type WaterPalette = {
  dayWaterColor: THREE.Color;
  nightWaterColor: THREE.Color;
  daySunColor: THREE.Color;
  nightSunColor: THREE.Color;
};

export const SEA_WATER_PALETTE: WaterPalette = {
  dayWaterColor: new THREE.Color(0x0d3b5e),
  nightWaterColor: new THREE.Color(0x061a2c),
  daySunColor: new THREE.Color(0xbdd4e6),
  nightSunColor: new THREE.Color(0x3a4a6a),
};

// In-city ponds are calmer (lower distortion), clearer and lighter than the
// open sea, so their palette keeps the sun tint but lifts the water color.
export const POND_WATER_PALETTE: WaterPalette = {
  dayWaterColor: new THREE.Color(0x3f8ec4),
  nightWaterColor: new THREE.Color(0x0e2c48),
  daySunColor: new THREE.Color(0xbdd4e6),
  nightSunColor: new THREE.Color(0x3a4a6a),
};

export type AnimatedWaterOptions = {
  distortionScale: number;
  palette: WaterPalette;
  sunDirection?: THREE.Vector3;
};

export function createAnimatedWater(geometry: THREE.BufferGeometry, options: AnimatedWaterOptions): Water {
  const waterNormals = new THREE.TextureLoader().load(waterNormalsUrl);
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const water = new Water(geometry, {
    waterNormals,
    sunDirection: (options.sunDirection ?? SUN_DIRECTION).clone(),
    sunColor: options.palette.daySunColor.clone(),
    waterColor: options.palette.dayWaterColor.clone(),
    distortionScale: options.distortionScale,
    side: THREE.DoubleSide,
    fog: false,
  });
  water.renderOrder = 3;
  water.castShadow = false;
  const material = water.material as THREE.ShaderMaterial;
  // The stock Water shader reflects the sky almost entirely (rf0 = 0.3, 0.9
  // reflection weight), which washes the water white. Real water has a fresnel
  // base near 0.02, so lower both to let the water color dominate.
  material.fragmentShader = material.fragmentShader
    .replace('float rf0 = 0.3;', 'float rf0 = 0.02;')
    .replace(
      'vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight',
      'vec3( 0.08 ) + reflectionSample * 0.45 + reflectionSample * specularLight',
    );
  material.needsUpdate = true;
  water.userData.dynamicMaterial = material;
  water.userData.waterPalette = options.palette;
  return water;
}

export function updateWaterDaylight(water: Water, daylight: number): void {
  const palette = water.userData.waterPalette as WaterPalette | undefined;
  const uniforms = (water.material as THREE.ShaderMaterial).uniforms;
  if (!palette || !uniforms.waterColor || !uniforms.sunColor) return;
  (uniforms.waterColor.value as THREE.Color)
    .copy(palette.dayWaterColor)
    .lerp(palette.nightWaterColor, 1 - daylight);
  (uniforms.sunColor.value as THREE.Color)
    .copy(palette.daySunColor)
    .lerp(palette.nightSunColor, 1 - daylight);
}

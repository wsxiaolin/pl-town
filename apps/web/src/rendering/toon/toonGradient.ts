import * as THREE from 'three';

/**
 * Cel-shading gradient ramp shared by every toon material. Three hard steps
 * (shadow / mid / light) tuned for maximum perceptual separation: with the
 * light rig in toonWorld the bands land at sRGB ≈ 88 / 179 / 255, so the
 * quantization reads as hard anime bands instead of a smooth gradient.
 */
export function createToonGradientMap(): THREE.DataTexture {
  const data = new Uint8Array([
    // Band math with dir=0.95/ambient=0.05: lit ≈1.0 (sRGB 255), mid ≈0.66
    // (179), shadow ≈0.31 (88) — three clearly separated bands.
    Math.round(255 * 0.28), 0, 0, 255,
    Math.round(255 * 0.65), 0, 0, 255,
    255, 0, 0, 255,
  ]);
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

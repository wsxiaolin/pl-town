import * as THREE from 'three';
import type { Weather } from '../city/weather';

export function createWeatherEffects(scene: THREE.Scene, getWeather: () => Weather): { update: (elapsedSeconds: number, camera: THREE.Camera) => void } {
  const count = 900;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = ((i * 37) % 100) - 50;
    positions[i * 3 + 1] = ((i * 61) % 34) + 2;
    positions[i * 3 + 2] = ((i * 91) % 100) - 50;
    speeds[i] = 13 + (i % 11) * 0.9;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xbdd8e8, size: 0.13, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  const rain = new THREE.Points(geometry, material);
  rain.name = 'rainfall';
  rain.renderOrder = 20;
  scene.add(rain);

  return {
    update(elapsedSeconds, camera) {
      const active = getWeather() === 'rain';
      material.opacity = active ? 0.56 : 0;
      if (!active) return;
      rain.position.set(camera.position.x, 0, camera.position.z);
      const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i += 1) {
        const yIndex = i * 3 + 1;
        const xIndex = i * 3;
        const zIndex = i * 3 + 2;
        attribute.array[yIndex] = ((attribute.array[yIndex] as number) - (speeds[i] ?? 0) * 0.016) % 34;
        if ((attribute.array[yIndex] as number) < 0) attribute.array[yIndex] += 34;
        attribute.array[xIndex] = ((attribute.array[xIndex] as number) + 0.025) % 100;
        attribute.array[zIndex] = (attribute.array[zIndex] as number) + Math.sin(elapsedSeconds * 2 + i) * 0.002;
      }
      attribute.needsUpdate = true;
    },
  };
}

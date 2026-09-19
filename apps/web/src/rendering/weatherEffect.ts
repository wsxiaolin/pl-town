import * as THREE from 'three';
import type { Weather } from '../city/weather';

type FogProfile = { color: number; near: number; far: number };

const WEATHER_FOG: Record<Weather, FogProfile | null> = {
  clear: null,
  rain: { color: 0x7c94a3, near: 96, far: 168 },
  snow: { color: 0xbfccd8, near: 104, far: 176 },
  'snow-deep': { color: 0xb6c4d2, near: 104, far: 176 },
};

export function createWeatherEffect(options: {
  scene: THREE.Scene;
  getCursor: () => THREE.Object3D | null;
  restoreSky: () => void;
  onWeatherChanged?: (weather: Weather | null) => void;
}) {
  const rain = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0x9bc4d8, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false }),
  );
  const positions = new Float32Array(720 * 3);
  for (let index = 0; index < 720; index += 1) {
    positions[index * 3] = (Math.random() - 0.5) * 70;
    positions[index * 3 + 1] = Math.random() * 22;
    positions[index * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  rain.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  rain.visible = false;
  rain.frustumCulled = false;
  options.scene.add(rain);
  let weather: Weather = 'clear';

  function applyFog(next: Weather): void {
    const profile = WEATHER_FOG[next];
    if (!profile) {
      options.scene.fog = null;
      return;
    }
    const current = options.scene.fog;
    if (
      current instanceof THREE.Fog
      && current.color.getHex() === profile.color
      && current.near === profile.near
      && current.far === profile.far
    ) return;
    options.scene.fog = new THREE.Fog(profile.color, profile.near, profile.far);
  }

  function set(next: Weather): void {
    weather = next;
    rain.visible = next === 'rain';
    options.onWeatherChanged?.(next);
    // Weather no longer replaces the sky. Keep the day/night sky visible and
    // only layer a light depth haze on top so the scene stops looking grey.
    options.restoreSky();
    applyFog(next);
  }

  function update(delta: number): void {
    if (!rain.visible) return;
    const cursor = options.getCursor();
    if (cursor) rain.position.set(cursor.position.x, 0, cursor.position.z);
    const attribute = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let index = 0; index < attribute.count; index += 1) {
      let y = attribute.getY(index) - delta * 16;
      if (y < 0) y += 22;
      attribute.setY(index, y);
    }
    attribute.needsUpdate = true;
  }

  function dispose(): void {
    rain.visible = false;
    rain.removeFromParent();
    rain.geometry.dispose();
    (rain.material as THREE.Material).dispose();
    options.scene.fog = null;
    options.restoreSky();
    options.onWeatherChanged?.(null);
  }

  return { set, update, dispose, current: () => weather };
}

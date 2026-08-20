import * as THREE from 'three';

export type CityWeather = 'rain' | 'sunny' | null;

export function createWeatherEffect(options: { scene: THREE.Scene; getCursor: () => THREE.Object3D | null }) {
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
  let weather: CityWeather = null;

  function set(next: Exclude<CityWeather, null>): void {
    weather = next;
    rain.visible = next === 'rain';
    document.body.dataset.cityWeather = next;
    options.scene.background = new THREE.Color(next === 'rain' ? 0x778f9e : 0xbddbf3);
    if (next === 'rain') options.scene.fog = new THREE.Fog(0x9eb7bc, 24, 95);
    else options.scene.fog = null;
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
    rain.removeFromParent();
    rain.geometry.dispose();
    (rain.material as THREE.Material).dispose();
    delete document.body.dataset.cityWeather;
  }

  return { set, update, dispose, current: () => weather };
}

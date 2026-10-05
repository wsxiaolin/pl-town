import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeatherEffect } from '../../src/rendering/weatherEffect';

function advance(effect: ReturnType<typeof createWeatherEffect>, seconds: number): void {
  // 真实实现按帧 delta 收敛;测试用大步长推进(实现内部 clamp 到目标值)。
  for (let i = 0; i < 40; i += 1) effect.update(seconds / 40);
}

test('rain ramps a full ambience stack in and restores the sky on clear', () => {
  const dataset: DOMStringMap = {};
  const scene = new THREE.Scene();
  let restoreCount = 0;
  const sky = new THREE.Texture();
  const effect = createWeatherEffect({
    scene,
    getCursor: () => null,
    restoreSky: () => { restoreCount += 1; scene.background = sky; },
    onWeatherChanged: (weather) => { if (weather) dataset.cityWeather = weather; else delete dataset.cityWeather; },
  });

  const rain = scene.children.find((child) => child instanceof THREE.LineSegments)!;
  const clearFog = scene.fog as THREE.Fog;
  assert.ok(clearFog, 'a persistent far fog keeps shaders fog-aware from first frame');
  assert.ok(clearFog.far >= 3000, 'clear-day fog stays far enough to be invisible');
  assert.equal(rain.visible, false);

  effect.set('rain');
  assert.equal(dataset.cityWeather, 'rain');
  assert.equal(rain.visible, true);
  advance(effect, 2.2);
  assert.equal((rain.material as THREE.LineBasicMaterial).opacity !== 0, true, 'rain streaks fade in');
  const rainFog = scene.fog as THREE.Fog;
  assert.ok(rainFog.far < 400, 'rain pulls the fog in for depth');
  assert.equal(rainFog.color.getHexString(), '93a2b1');
  assert.ok(scene.background instanceof THREE.Color, 'rain swaps the sky for an overcast color');

  effect.set('clear');
  assert.equal(dataset.cityWeather, 'clear');
  advance(effect, 2.6);
  assert.equal(rain.visible, false, 'streaks hide once the ramp-out settles');
  assert.equal(scene.background, sky, 'restoreSky hands the sky back after the rain');
  assert.equal(restoreCount, 1);
  assert.equal((scene.fog as THREE.Fog).far, 4000, 'fog distance lands exactly back on the clear-day value (no lerp residue)');

  effect.dispose();
  assert.equal(dataset.cityWeather, undefined);
  assert.equal(scene.fog, null);
  assert.equal(scene.children.some((child) => child instanceof THREE.LineSegments), false);
});

test('repeated rain sets keep the same particle system and re-arm the ramp', () => {
  const scene = new THREE.Scene();
  let restoreCount = 0;
  const effect = createWeatherEffect({
    scene,
    getCursor: () => null,
    restoreSky: () => { restoreCount += 1; },
  });
  const rain = scene.children.find((child) => child instanceof THREE.LineSegments)!;
  const children = [...scene.children];
  effect.set('rain');
  advance(effect, 2.2);
  effect.set('rain');
  assert.deepEqual(scene.children, children, 'repeated weather keeps the existing particles');
  advance(effect, 2.2);
  assert.equal(rain.visible, true);
  effect.set('clear');
  advance(effect, 2.6);
  effect.dispose();
  assert.equal(restoreCount, 2, 'one restore per completed rain episode + one on dispose');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeatherEffect } from '../../src/rendering/weatherEffect';

test('weather transitions preserve the shared sky and keep the scene free of fog', () => {
  const dataset: DOMStringMap = {};
  const scene = new THREE.Scene();
  let restoreCount = 0;
  let sky = new THREE.Texture();
  const effect = createWeatherEffect({
    scene,
    getCursor: () => null,
    restoreSky: () => { restoreCount += 1; scene.background = sky; },
    onWeatherChanged: (weather) => { if (weather) dataset.cityWeather = weather; else delete dataset.cityWeather; },
  });

  const rain = scene.children.find((child) => child instanceof THREE.Points)!;
  for (const weather of ['rain', 'snow', 'snow-deep', 'clear'] as const) {
    effect.set(weather);
    assert.equal(dataset.cityWeather, weather);
    assert.equal(scene.fog, null);
    assert.equal(scene.background, sky);
    assert.equal(rain.visible, weather === 'rain');
  }

  effect.set('rain');
  const children = [...scene.children];
  sky = new THREE.Texture();
  effect.set('rain');
  assert.equal(scene.background, sky, 'same-weather refresh follows the new day/night sky');
  assert.equal(scene.fog, null);
  assert.deepEqual(scene.children, children, 'repeated weather keeps the existing particles');
  assert.equal(restoreCount, 6);

  effect.dispose();
  assert.equal(dataset.cityWeather, undefined);
  assert.equal(scene.fog, null);
  assert.equal(restoreCount, 7);
  assert.equal(scene.children.some((child) => child instanceof THREE.Points), false);
});

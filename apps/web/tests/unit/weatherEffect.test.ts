import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeatherEffect } from '../../src/rendering/weatherEffect';

test('weather effect keeps the shared sky and applies each weather fog profile', () => {
  const dataset: DOMStringMap = {};
  const scene = new THREE.Scene();
  let restoreCount = 0;
  const effect = createWeatherEffect({
    scene,
    getCursor: () => null,
    restoreSky: () => { restoreCount += 1; scene.background = new THREE.Color(0xabcdef); },
    onWeatherChanged: (weather) => { if (weather) dataset.cityWeather = weather; else delete dataset.cityWeather; },
  });

  effect.set('rain');
  assert.equal(dataset.cityWeather, 'rain');
  assert.ok(scene.fog instanceof THREE.Fog);
  assert.equal((scene.background as THREE.Color).getHex(), 0xabcdef);
  assert.equal(scene.fog.color.getHex(), 0x7c94a3);
  assert.equal(scene.fog.near, 96);
  assert.equal(scene.fog.far, 168);
  assert.equal(restoreCount, 1);

  effect.set('snow');
  assert.ok(scene.fog instanceof THREE.Fog);
  assert.equal(scene.fog.color.getHex(), 0xbfccd8);
  assert.equal(scene.fog.near, 104);
  assert.equal(scene.fog.far, 176);
  assert.equal(restoreCount, 2);

  effect.set('snow-deep');
  assert.ok(scene.fog instanceof THREE.Fog);
  assert.equal(scene.fog.color.getHex(), 0xb6c4d2);
  assert.equal(scene.fog.near, 104);
  assert.equal(scene.fog.far, 176);
  assert.equal(restoreCount, 3);

  effect.set('clear');
  assert.equal(dataset.cityWeather, 'clear');
  assert.equal(scene.fog, null);
  assert.equal((scene.background as THREE.Color).getHex(), 0xabcdef);
  assert.equal(restoreCount, 4);

  effect.dispose();
  assert.equal(dataset.cityWeather, undefined);
  assert.equal(scene.fog, null);
  assert.equal(restoreCount, 5);
  assert.equal(scene.children.some((child) => child instanceof THREE.Points), false);
});

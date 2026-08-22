import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWeatherEffect } from '../../src/rendering/weatherEffect';

test('weather effect restores the shared sky and fog when rain clears or disposes', () => {
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
  assert.equal((scene.background as THREE.Color).getHex(), 0x778f9e);

  effect.set('clear');
  assert.equal(dataset.cityWeather, 'clear');
  assert.equal(scene.fog, null);
  assert.equal((scene.background as THREE.Color).getHex(), 0xabcdef);
  assert.equal(restoreCount, 1);

  effect.dispose();
  assert.equal(dataset.cityWeather, undefined);
  assert.equal(scene.fog, null);
  assert.equal(restoreCount, 2);
  assert.equal(scene.children.some((child) => child instanceof THREE.Points), false);
});

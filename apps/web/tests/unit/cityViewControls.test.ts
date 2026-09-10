import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCityViewControls } from '../../src/city/cityViewControls';

test('city view controls keep path, cinematic and ice zoom independent of camera impl', () => {
  const targets: Array<[number, number, boolean | undefined]> = [];
  const view = createCityViewControls({
    defaultZoom: 7,
    createCamera: (zoom) => new THREE.OrthographicCamera(-zoom, zoom, zoom, -zoom, 0.1, 120),
    getCameraController: () => ({
      updateProjection() {},
      setTarget(x, z, instant) { targets.push([x, z, instant]); },
    }),
    getPlayerController: () => ({ moveTo: () => true }),
    getNavigationTargetMarker: () => ({ show() {}, hide() {} }),
  });

  view.setPlayerPath([new THREE.Vector3(1, 0, 1)]);
  view.setCinematic(true);
  view.captureIceZoom();
  view.applyZoom(13.5);
  view.restoreIceZoom();
  view.clearPlayerPath();
  view.restoreSnapshot({ x: 2, z: 3, zoom: 8 });

  assert.equal(view.isCinematic(), true);
  assert.equal(view.getPlayerPath().length, 0);
  assert.equal(view.getZoom(), 8);
  assert.deepEqual(targets.at(-1), [2, 3, true]);
});

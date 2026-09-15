import assert from 'node:assert/strict';
import test from 'node:test';
import { createIceKingCityHooks } from '../../src/city/iceKingCityHooks';

test('ice king city hooks isolate HUD, zoom, weather and well vision', () => {
  const calls: string[] = [];
  let zoom = 12;
  const hooks = createIceKingCityHooks({
    defaultZoom: 7,
    wellZoom: 5.2,
    beachZoom: 5.5,
    iceZoom: (mobile) => (mobile ? 9.5 : 13.5),
    isMobile: () => false,
    canAdjustCamera: () => true,
    getZoom: () => zoom,
    setZoom: (value) => { zoom = value; calls.push(`zoom:${value}`); },
    captureIceZoom: () => calls.push('capture'),
    restoreIceZoom: () => calls.push('restore'),
    setWellVision: (phase) => calls.push(`vision:${phase}`),
    closeMapIfOpen: () => calls.push('close-map'),
    closeHud: () => calls.push('close-hud'),
    clearTravel: () => calls.push('clear-travel'),
    setWeather: (weather) => calls.push(`weather:${weather}`),
    invalidateMap: () => calls.push('invalidate'),
    setCameraTarget: (x, z, instant) => calls.push(`target:${x},${z},${instant}`),
    focusCamera: (x, z) => calls.push(`focus:${x},${z}`),
    sendLocalPosition: (x, z) => calls.push(`send:${x},${z}`),
    getCursor: () => ({ position: { x: 4, z: 8 }, rotation: { y: 1 } }),
    setWellPhaseVisual: (phase) => calls.push(`well:${phase}`),
    setBeachEncounterPhase: (phase) => calls.push(`beach:${phase}`),
  });

  hooks.onEnter();
  hooks.onReturn('rain');
  hooks.setWellPhase('focus');
  hooks.focusBeachEncounter();

  assert.ok(calls.includes('close-map'));
  assert.ok(calls.includes('weather:rain'));
  assert.equal(zoom, 5.5);
  assert.ok(calls.includes('vision:focus'));
  assert.ok(calls.includes('focus:-41.2,11.5'));
});

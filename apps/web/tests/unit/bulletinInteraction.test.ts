import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuildingInteraction } from '../../src/city/buildingInteraction';
import { resolveBulletinBoardUrl } from '../../src/adapters/ui/bulletinBoard';
import type { BuildingEntity } from '../../src/city/buildingEntity';
import type { CityDialogController } from '../../src/adapters/ui/cityDialogController';

// The bulletin board is outbound navigation, so these tests drive the
// interaction seam the city actually uses: navigateTo fires the opener
// synchronously (inside the click's user-activation window) and the deferred
// navigateUnlocked continuation must not open a second page.

function setup({ openResult = true, interactResult = true, housing = true }: { openResult?: boolean; interactResult?: boolean; housing?: boolean } = {}) {
  const opened: string[] = [];
  const phoneApps: Array<[string, unknown?]> = [];
  const visits: string[] = [];
  let tracked = 0;
  let continuation: (() => void) | null = null;
  const interaction = createBuildingInteraction({
    isBuildingUnavailable: () => false,
    getMultiplayerHousing: () => housing ? {
      progression: {
        interactBuilding: (id: string, onUnlock: () => void) => {
          visits.push(id);
          continuation = onUnlock;
          return interactResult;
        },
        openShop: () => undefined,
      },
    } : null,
    getCityDialogs: () => ({ openBuilding: () => undefined } as unknown as CityDialogController),
    getEchoStoryController: () => null,
    getStatsPanelController: () => null,
    getCommunityPanels: () => ({
      openPhoneApp: (app: string, kind?: unknown) => phoneApps.push([app, kind]),
    }) as unknown as ReturnType<typeof import('../../src/adapters/ui/communityPanelController').createCommunityPanelController>,
    getWriterCatalogController: () => null,
    getNewsstandController: () => null,
    trackInteraction: () => { tracked += 1; },
    openBulletinBoard: () => { opened.push('https://town.example/pl-town/bulletin.html'); return openResult; },
  });
  return { interaction, opened, phoneApps, visits, getTracked: () => tracked, runContinuation: () => continuation?.() };
}

const building = (id: string) => ({ id } as unknown as BuildingEntity);

test('a bulletin board click opens the page synchronously on the visit round trip', () => {
  const { interaction, opened, phoneApps, getTracked } = setup();
  interaction.navigateTo(building('bulletin'));
  // The open happens before the WS round trip resolves — that is the point:
  // the click's user-activation window is still live.
  assert.equal(opened.length, 1);
  assert.equal(getTracked(), 1);
  // The phone must stay closed: the old behavior routed the board there.
  assert.equal(phoneApps.length, 0);
});

test('the deferred continuation does not open a second bulletin page', () => {
  const { interaction, opened, phoneApps, runContinuation } = setup();
  interaction.navigateTo(building('bulletin'));
  runContinuation();
  assert.equal(opened.length, 1);
  // Falling through to the generic building dialog would regress the feature.
  assert.equal(phoneApps.length, 0);
});

test('a rejected visit round trip (offline or pending) skips the open', () => {
  const { interaction, opened, getTracked } = setup({ interactResult: false });
  interaction.navigateTo(building('bulletin'));
  assert.equal(opened.length, 0);
  assert.equal(getTracked(), 0);
});

test('a popup-blocked open (walk-up arrival, no activation left) still counts as an interaction', () => {
  const { interaction, opened, getTracked } = setup({ openResult: false });
  interaction.navigateTo(building('bulletin'));
  assert.equal(opened.length, 1);
  assert.equal(getTracked(), 1);
});

test('the bulletin page opens even before multiplayer housing exists', () => {
  const { interaction, opened, getTracked } = setup({ housing: false });
  interaction.navigateTo(building('bulletin'));
  assert.equal(opened.length, 1);
  assert.equal(getTracked(), 1);
});

test('other phone buildings keep opening the phone apps', () => {
  const { interaction, opened, phoneApps, runContinuation } = setup();
  interaction.navigateTo(building('news'));
  runContinuation();
  assert.equal(opened.length, 0);
  assert.deepEqual(phoneApps, [['inventory', undefined]]);
  interaction.navigateTo(building('community'));
  runContinuation();
  assert.deepEqual(phoneApps[1], ['social', 'profile']);
});

test('the bulletin page URL resolves relative to the deployment base', () => {
  // Subpath deployments (GitHub Pages) keep working when the page is served
  // from a directory or an index document.
  assert.equal(resolveBulletinBoardUrl('https://town.example/pl-town/'), 'https://town.example/pl-town/bulletin.html');
  assert.equal(resolveBulletinBoardUrl('https://town.example/pl-town/index.html'), 'https://town.example/pl-town/bulletin.html');
  assert.equal(resolveBulletinBoardUrl('https://town.example/pl-town/index.html?debug=true'), 'https://town.example/pl-town/bulletin.html');
  assert.equal(resolveBulletinBoardUrl('https://town.example/'), 'https://town.example/bulletin.html');
});

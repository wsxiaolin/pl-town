import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuildingInteraction } from '../../src/city/buildingInteraction';
import type { BuildingEntity } from '../../src/city/buildingEntity';
import type { CityDialogController } from '../../src/adapters/ui/cityDialogController';

type OpenedCall = { url: string; target: string; features: string };

function setup() {
  const opened: OpenedCall[] = [];
  const phoneApps: Array<[string, unknown?]> = [];
  let tracked = 0;
  (globalThis as { window?: unknown }).window = {
    open: (url: string, target: string, features: string) => {
      opened.push({ url, target, features });
      return null;
    },
  };
  const interaction = createBuildingInteraction({
    isBuildingUnavailable: () => false,
    getMultiplayerHousing: () => null,
    getCityDialogs: () => ({ openBuilding: () => undefined } as unknown as CityDialogController),
    getEchoStoryController: () => null,
    getStatsPanelController: () => null,
    getCommunityPanels: () => ({
      openPhoneApp: (app: string, kind?: unknown) => phoneApps.push([app, kind]),
    }) as unknown as ReturnType<typeof import('../../src/adapters/ui/communityPanelController').createCommunityPanelController>,
    getWriterCatalogController: () => null,
    getNewsstandController: () => null,
    trackInteraction: () => { tracked += 1; },
    getBulletinBoardUrl: () => 'https://town.example/pl-town/bulletin.html',
  });
  return { interaction, opened, phoneApps, getTracked: () => tracked };
}

const building = (id: string) => ({ id } as unknown as BuildingEntity);

test('the bulletin board opens the standalone announcements page in a new tab', () => {
  const { interaction, opened, phoneApps, getTracked } = setup();
  interaction.navigateUnlocked(building('bulletin'));
  assert.equal(opened.length, 1);
  const [firstOpen] = opened;
  assert.ok(firstOpen);
  assert.equal(firstOpen.url, 'https://town.example/pl-town/bulletin.html');
  assert.equal(firstOpen.target, '_blank');
  assert.ok(firstOpen.features.includes('noopener'));
  // The phone must stay closed: the old behavior routed the board there.
  assert.equal(phoneApps.length, 0);
  assert.equal(getTracked(), 1);
});

test('other phone buildings keep opening the phone apps', () => {
  const { interaction, opened, phoneApps } = setup();
  interaction.navigateUnlocked(building('news'));
  assert.equal(opened.length, 0);
  assert.deepEqual(phoneApps, [['inventory', undefined]]);
  interaction.navigateUnlocked(building('community'));
  assert.deepEqual(phoneApps[1], ['social', 'profile']);
});

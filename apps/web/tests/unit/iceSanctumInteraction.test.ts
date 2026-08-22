import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createIceSanctumExperience as createIceSanctum } from '../../src/city/iceKing/createIceSanctumExperience';
import { createIceSanctumScene, ICE_SANCTUM_CORRIDOR_LENGTH } from '../../src/rendering/iceKing/iceSanctumScene';
import { createInteractionPointer } from '../../src/city/interactionPointer';
import { createCameraController } from '../../src/city/navigation/cameraController';
import { createPlayerController } from '../../src/city/navigation/playerController';
import { createBuildingInteraction } from '../../src/city/buildingInteraction';
import type { BuildingEntity } from '../../src/city/buildingEntity';
import type { CityDialogController } from '../../src/adapters/ui/cityDialogController';
import { createBuildingFeatureRegistry } from '../../src/city/buildingFeatures/buildingFeatureRegistry';
import { createIceKingBuildingFeature } from '../../src/city/iceKing/createIceKingBuildingFeature';
import { createIceSanctumController } from '../../src/city/iceKing/iceSanctumController';
import { createLocalStorageIceSanctumProgressStore } from '../../src/adapters/storage/iceKing/LocalStorageIceSanctumStoryRepository';
import type { IceSanctumProgressStore } from '../../src/city/iceKing/iceSanctumPorts';

function createRewardTestSanctum(options: {
  progress: IceSanctumProgressStore;
  nextSequence?: number;
  claimReward: (sequence: number) => Promise<boolean>;
  onProgressFailure?: () => void;
}) {
  const cursor = new THREE.Group();
  const root = new THREE.Group();
  const npc = new THREE.Group();
  return createIceSanctumController({
    scene: {
      root,
      npcMesh: npc,
      npcHitMesh: npc,
      center: [0, 0],
      walkBounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      activate: () => undefined,
      deactivate: () => undefined,
      npcWorldPosition: (target = new THREE.Vector3()) => target,
      interactionPosition: (target = new THREE.Vector3()) => target,
      exitPosition: (target = new THREE.Vector3()) => target,
      dispose: () => undefined,
    },
    presentation: {
      enter: () => undefined,
      leave: () => undefined,
      fadeOutTimeSkipBlackout: () => undefined,
      returnThroughBlackout: async (onCovered) => { await onCovered(); },
      schedule: (callback) => { callback(); return 1; },
      isCinematic: () => false,
      dispose: () => undefined,
    },
    progress: options.progress,
    getCursor: () => cursor,
    dialogs: () => ({ openStory: () => undefined, close: () => undefined }),
    nextRewardClaimSequence: () => options.nextSequence ?? 1,
    claimReward: (_rewardId, sequence) => options.claimReward(sequence),
    onEnter: () => undefined,
    onEnterUnavailable: () => undefined,
    onProgressFailure: options.onProgressFailure ?? (() => undefined),
    onRewardFailure: () => undefined,
    onReturn: () => undefined,
  });
}

function chooseRejectEnding(sanctum: ReturnType<typeof createRewardTestSanctum>): void {
  sanctum.selectChoice('ask-identity');
  sanctum.selectChoice('ask-purpose');
  sanctum.selectChoice('confused');
  sanctum.selectChoice('reject-invitation');
}

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

test('King Ice building does not reopen its audience prompt after the sanctum story was completed', () => {
  let promptOpens = 0;
  let lockedNotices = 0;
  let tracked = 0;
  const features = createBuildingFeatureRegistry();
  features.register(createIceKingBuildingFeature({
    getSanctum: () => ({ enter: () => false, hasEntered: () => true }),
    showLocked: () => { lockedNotices += 1; },
  }));
  const interaction = createBuildingInteraction({
    isBuildingUnavailable: () => false,
    getMultiplayerHousing: () => null,
    getCityDialogs: () => ({ openBuilding: () => { promptOpens += 1; } } as unknown as CityDialogController),
    getEchoStoryController: () => null,
    getStatsPanelController: () => null,
    getCommunityPanels: () => null,
    getWriterCatalogController: () => null,
    getNewsstandController: () => null,
    trackInteraction: () => { tracked += 1; },
    interactWithFeature: features.interact,
  });

  interaction.navigateUnlocked({ id: 'kingice', featureIds: ['ice-sanctum'] } as unknown as BuildingEntity);
  assert.equal(promptOpens, 0);
  assert.equal(lockedNotices, 1);
  assert.equal(tracked, 0);
});

test('Ice sanctum has no walls, separates Ice from the desk, and includes floating islands', () => {
  const scene = new THREE.Scene();
  const sanctum = createIceSanctumScene({
    scene,
    makeMaterial: () => new THREE.MeshStandardMaterial(),
    makeCharacter: () => new THREE.Group(),
  });

  const boxHeights = sanctum.root.children
    .filter((child): child is THREE.Mesh<THREE.BoxGeometry> => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry)
    .map((mesh) => mesh.geometry.parameters.height);
  assert.ok(boxHeights.length > 0);
  assert.ok(boxHeights.every((height) => height < 2));
  const desk = sanctum.root.getObjectByName('ice-sanctum-desk');
  const ice = sanctum.root.getObjectByName('ice-sanctum-npc');
  const islands = sanctum.root.getObjectByName('ice-sanctum-floating-islands');
  const originalArea = sanctum.root.getObjectByName('ice-sanctum-original-area');
  const roomFloor = sanctum.root.getObjectByName('ice-sanctum-room-floor');
  const connector = sanctum.root.getObjectByName('ice-sanctum-connector-floor') as THREE.Mesh<THREE.BoxGeometry> | undefined;
  assert.ok(desk && ice && desk.position.z - ice.position.z > 2);
  assert.equal(islands?.children.length, 12);
  const islandShapes = islands?.children.map((island) => island.userData.iceSanctumIsland.shape as string) ?? [];
  const islandScales = islands?.children.map((island) => island.userData.iceSanctumIsland.scale as number) ?? [];
  const islandBlockCounts = islands?.children.map((island) => island.userData.iceSanctumIsland.blocks as number) ?? [];
  const islandBatches = islands?.children.flatMap((island) => island.children) ?? [];
  const iceBatches = islandBatches.filter((batch) => batch.userData.iceSanctumIceBatch) as THREE.InstancedMesh[];
  assert.ok(new Set(islandShapes).size >= 6);
  assert.ok(new Set(islandBlockCounts).size >= 4);
  assert.ok(Math.max(...islandScales) - Math.min(...islandScales) >= 0.6);
  assert.ok(islandBatches.every((batch) => batch instanceof THREE.InstancedMesh));
  assert.ok(islands?.children.every((island) => island.children.length <= 4));
  assert.ok(islandBatches.length * 3 < islandBlockCounts.reduce((total, count) => total + count, 0));
  assert.equal(iceBatches.length, 12);
  assert.ok(iceBatches.reduce((total, batch) => total + batch.count, 0) >= 90);
  assert.ok(islands?.children.every((island) => island.position.y >= 1.25));
  sanctum.root.updateMatrixWorld(true);
  const floorFootprints = [roomFloor, connector].map((object) => new THREE.Box3().setFromObject(object!));
  islands?.children.forEach((island) => {
    const islandFootprint = new THREE.Box3().setFromObject(island);
    const overlapsFloor = floorFootprints.some((floorFootprint) => (
      islandFootprint.max.x > floorFootprint.min.x
      && islandFootprint.min.x < floorFootprint.max.x
      && islandFootprint.max.z > floorFootprint.min.z
      && islandFootprint.min.z < floorFootprint.max.z
    ));
    assert.equal(overlapsFloor, false, `${island.name} overlaps a walkable floor`);
  });
  const floatDurations = islands?.children.map((island) => island.userData.iceSanctumFloat.duration as number) ?? [];
  const floatAmplitudes = islands?.children.map((island) => island.userData.iceSanctumFloat.amplitude as number) ?? [];
  assert.ok(new Set(floatDurations).size >= 3);
  assert.ok(new Set(floatAmplitudes).size >= 4);
  assert.equal(ICE_SANCTUM_CORRIDOR_LENGTH, 40);
  assert.equal(originalArea?.position.z, -40);
  assert.equal(connector?.geometry.parameters.width, 10);
  assert.equal(connector?.geometry.parameters.depth, 40);
  sanctum.dispose();
});

test('Ice sanctum disposes owned hit resources without disposing pooled character geometry', () => {
  const scene = new THREE.Scene();
  const characterGeometry = new THREE.BoxGeometry();
  const character = new THREE.Group();
  character.add(new THREE.Mesh(characterGeometry, new THREE.MeshBasicMaterial()));
  let characterGeometryDisposals = 0;
  let hitGeometryDisposals = 0;
  let hitMaterialDisposals = 0;
  characterGeometry.addEventListener('dispose', () => { characterGeometryDisposals += 1; });
  const sanctum = createIceSanctumScene({
    scene,
    makeMaterial: () => new THREE.MeshStandardMaterial(),
    makeCharacter: () => character,
  });
  const hitMesh = sanctum.npcHitMesh as THREE.Mesh;
  hitMesh.geometry.addEventListener('dispose', () => { hitGeometryDisposals += 1; });
  (hitMesh.material as THREE.Material).addEventListener('dispose', () => { hitMaterialDisposals += 1; });

  sanctum.dispose();

  assert.equal(characterGeometryDisposals, 0);
  assert.equal(hitGeometryDisposals, 1);
  assert.equal(hitMaterialDisposals, 1);
  characterGeometry.dispose();
});

test('Ice cinematic starts immediately when the player enters the sanctum', () => {
  const bodyClasses = new Set<string>();
  const overlays: unknown[] = [];
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: {
        classList: {
          add: (name: string) => bodyClasses.add(name),
          remove: (name: string) => bodyClasses.delete(name),
        },
        append: (element: unknown) => overlays.push(element),
      },
      createElement: () => ({
        className: '',
        yPercent: 0,
        setAttribute: () => undefined,
        append: () => undefined,
        remove: () => undefined,
      }),
    },
  });
  const scene = new THREE.Scene();
  const cursor = new THREE.Group();
  let cameraFocusStops = 0;
  const sanctum = createIceSanctum({
    scene,
    makeMaterial: () => new THREE.MeshStandardMaterial(),
    makeCharacter: () => new THREE.Group(),
    getCursor: () => cursor,
    dialogs: () => null,
    nextRewardClaimSequence: () => 1,
    claimReward: async () => true,
    onEnter: () => undefined,
    onEnterUnavailable: () => undefined,
    onRewardFailure: () => undefined,
    onProgressFailure: () => undefined,
    onReturn: () => undefined,
    setCameraTarget: () => undefined,
    focusCamera: () => undefined,
    stopCameraFocus: () => { cameraFocusStops += 1; },
  });

  assert.equal(sanctum.enter(), true);
  assert.equal(sanctum.isCinematic(), true);
  assert.equal(bodyClasses.has('ice-sanctum-cinematic-active'), true);
  assert.equal(overlays.length, 1);
  assert.equal(cameraFocusStops, 1);
  sanctum.dispose();
});

test('a failed Ice reward claim leaves the ending unlocked for a retry', async () => {
  const bodyClasses = new Set<string>();
  const storage = new Map<string, string>([['minicityUser', 'retry-tester']]);
  const callbacks: Array<() => void> = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      setTimeout: (callback: () => void) => { callbacks.push(callback); return callbacks.length; },
      clearTimeout: () => undefined,
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: {
        classList: {
          add: (name: string) => bodyClasses.add(name),
          remove: (name: string) => bodyClasses.delete(name),
        },
        append: () => undefined,
      },
      createElement: () => ({
        className: '',
        setAttribute: () => undefined,
        append: () => undefined,
        remove: () => undefined,
      }),
    },
  });
  const scene = new THREE.Scene();
  const cursor = new THREE.Group();
  let returned = 0;
  let failures = 0;
  const sanctum = createIceSanctum({
    scene,
    makeMaterial: () => new THREE.MeshStandardMaterial(),
    makeCharacter: () => new THREE.Group(),
    getCursor: () => cursor,
    dialogs: () => ({ closeNpc: () => undefined, openStory: () => undefined } as unknown as CityDialogController),
    nextRewardClaimSequence: () => 1,
    claimReward: async () => false,
    onEnter: () => undefined,
    onEnterUnavailable: () => undefined,
    onRewardFailure: () => { failures += 1; },
    onProgressFailure: () => undefined,
    onReturn: () => { returned += 1; },
    setCameraTarget: () => undefined,
    focusCamera: () => undefined,
    stopCameraFocus: () => undefined,
  });

  assert.equal(sanctum.enter(), true);
  sanctum.selectChoice('ask-identity');
  sanctum.selectChoice('ask-purpose');
  sanctum.selectChoice('confused');
  sanctum.selectChoice('reject-invitation');
  while (callbacks.length) callbacks.shift()?.();
  for (let index = 0; index < 8; index += 1) await Promise.resolve();

  assert.equal(returned, 1);
  assert.equal(failures, 1);
  assert.equal(storage.has('minicityIceChoice:retry-tester'), false);
  assert.equal(sanctum.hasEntered(), false);
  sanctum.dispose();
});

test('Ice reward is not requested when the pending checkpoint cannot be stored', async () => {
  const values = new Map<string, string>([['minicityUser', 'storage-failure']]);
  const progress = createLocalStorageIceSanctumProgressStore({
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (value.includes('reward-pending')) throw new Error('storage full');
        values.set(key, value);
      },
    },
  });
  let claims = 0;
  let progressFailures = 0;
  const sanctum = createRewardTestSanctum({
    progress,
    claimReward: async () => { claims += 1; return true; },
    onProgressFailure: () => { progressFailures += 1; },
  });

  assert.equal(sanctum.enter(), true);
  chooseRejectEnding(sanctum);
  await flushPromises();

  assert.equal(claims, 0);
  assert.equal(progressFailures, 1);
  assert.equal(progress.hasCompleted(), false);
  sanctum.dispose();
});

test('Ice completion retry reuses the persisted reward sequence', async () => {
  const values = new Map<string, string>([['minicityUser', 'completion-retry']]);
  let failCompletionWrite = true;
  const progress = createLocalStorageIceSanctumProgressStore({
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (failCompletionWrite && value.includes('reject-complete')) {
          failCompletionWrite = false;
          throw new Error('temporary write failure');
        }
        values.set(key, value);
      },
    },
  });
  const sequences: number[] = [];
  const claimReward = async (sequence: number) => { sequences.push(sequence); return true; };
  const first = createRewardTestSanctum({ progress, nextSequence: 7, claimReward });
  assert.equal(first.enter(), true);
  chooseRejectEnding(first);
  await flushPromises();
  assert.equal(failCompletionWrite, false);
  assert.equal(progress.hasCompleted(), false);
  first.dispose();

  const retry = createRewardTestSanctum({ progress, nextSequence: 8, claimReward });
  assert.equal(retry.enter(), true);
  await flushPromises();

  assert.deepEqual(sequences, [7, 7]);
  assert.equal(progress.hasCompleted(), true);
  retry.dispose();
});

test('Ice accept ending advances through the declarative story and completes', async () => {
  const values = new Map<string, string>([['minicityUser', 'accept-ending']]);
  const progress = createLocalStorageIceSanctumProgressStore({
    storage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
    },
  });
  const sequences: number[] = [];
  const sanctum = createRewardTestSanctum({
    progress,
    nextSequence: 3,
    claimReward: async (sequence) => { sequences.push(sequence); return true; },
  });
  assert.equal(sanctum.enter(), true);
  sanctum.selectChoice('ask-identity');
  sanctum.selectChoice('ask-purpose');
  sanctum.selectChoice('confused');
  sanctum.selectChoice('accept-casual');
  sanctum.selectChoice('like-crown');
  sanctum.selectChoice('ask-meaning');
  sanctum.selectChoice('receive-lemonade');
  await flushPromises();

  assert.deepEqual(sequences, [3]);
  assert.equal(progress.hasCompleted(), true);
  sanctum.dispose();
});

test('the resident named ice can re-enter after completing the sanctum story', () => {
  const bodyClasses = new Set<string>();
  const storage = new Map<string, string>([
    ['minicityUser', 'ice'],
    ['minicityIceChoice:ice', 'accept'],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body: {
        classList: {
          add: (name: string) => bodyClasses.add(name),
          remove: (name: string) => bodyClasses.delete(name),
        },
        append: () => undefined,
      },
      createElement: () => ({
        className: '',
        setAttribute: () => undefined,
        append: () => undefined,
        remove: () => undefined,
      }),
    },
  });
  const scene = new THREE.Scene();
  const cursor = new THREE.Group();
  const sanctum = createIceSanctum({
    scene,
    makeMaterial: () => new THREE.MeshStandardMaterial(),
    makeCharacter: () => new THREE.Group(),
    getCursor: () => cursor,
    dialogs: () => null,
    nextRewardClaimSequence: () => 1,
    claimReward: async () => true,
    onEnter: () => undefined,
    onEnterUnavailable: () => undefined,
    onRewardFailure: () => undefined,
    onProgressFailure: () => undefined,
    onReturn: () => undefined,
    setCameraTarget: () => undefined,
    focusCamera: () => undefined,
    stopCameraFocus: () => undefined,
  });

  assert.equal(sanctum.hasEntered(), false);
  assert.equal(sanctum.enter(), true);
  assert.equal(sanctum.isActive(), true);
  sanctum.dispose();
});

test('clicking Ice walks to the desk and opens the dialog on arrival', () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { innerWidth: 100, innerHeight: 100 },
  });
  const cursor = new THREE.Group();
  cursor.position.set(220, 0, 49.8);
  const npcMesh = new THREE.Group();
  const npcHitMesh = new THREE.Group();
  const deskPosition = new THREE.Vector3(220, 0, 34.1);
  let moveTarget: THREE.Vector3 | null = null;
  let dialogCount = 0;
  const cursorWorld = new THREE.Vector3();
  const raycaster = {
    ray: { intersectPlane: (_plane: THREE.Plane, target: THREE.Vector3) => target.set(0, 0, 0) },
    setFromCamera: () => undefined,
    intersectObject: (object: THREE.Object3D) => object === npcMesh ? [] : [{ object: npcHitMesh }],
    intersectObjects: () => [],
  } as unknown as THREE.Raycaster;
  const specialInterior = {
    isActive: () => true,
    navigation: () => null,
    npcMesh,
    npcHitMesh,
    npcWorldPosition: (target = new THREE.Vector3()) => target.set(220, 0, 31.15),
    interactionPosition: (target = new THREE.Vector3()) => target.copy(deskPosition),
    interactNpc: () => { dialogCount += 1; return true; },
  };
  const pointer = createInteractionPointer({
    getCamera: () => new THREE.PerspectiveCamera(),
    getRaycaster: () => raycaster,
    getMouse2D: () => new THREE.Vector2(),
    getGroundPlane: () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    getCursorWorld: () => cursorWorld,
    getRaycastBuildingGroups: () => [],
    getCursorChar: () => cursor,
    getBuildings: () => [],
    getSceneInterestPoints: () => null,
    getEchoStoryController: () => null,
    getCityDialogs: () => ({ isOpen: () => false }),
    getConfig: () => ({ npcTalkRadius: 3, buildingInteractRadius: 4 }),
    isBuildingUnavailable: () => false,
    isResidenceUnavailable: () => false,
    findRaycastBuilding: () => null,
    raycastUserData: () => undefined,
    npcForRaycast: () => null,
    nearestNpcTo: () => null,
    openNpcDialog: () => undefined,
    openResidence: () => undefined,
    onYouClick: () => undefined,
    movePlayerTo: (target) => { moveTarget = target.clone(); },
    navigateTo: () => undefined,
    interactWithSceneInterestPoint: () => undefined,
    interactWithInterestPointController: () => undefined,
    getSpecialInterior: () => specialInterior,
  });

  pointer.onCanvasClick({ clientX: 50, clientY: 50 } as MouseEvent);
  assert.deepEqual((moveTarget as THREE.Vector3 | null)?.toArray(), deskPosition.toArray());
  assert.equal(dialogCount, 0);

  cursor.position.copy(deskPosition);
  pointer.handlePlayerIdle();
  pointer.handlePlayerIdle();
  assert.equal(dialogCount, 1);

  cursor.position.set(220, 0, 49.8);
  pointer.onCanvasClick({ clientX: 50, clientY: 50 } as MouseEvent);
  pointer.clearPending();
  cursor.position.copy(deskPosition);
  pointer.handlePlayerIdle();
  assert.equal(dialogCount, 1);
});

test('Ice sanctum camera follows the player while keeping a fixed look direction', () => {
  const camera = new THREE.OrthographicCamera();
  const target = new THREE.Vector3();
  const controller = createCameraController({
    getCamera: () => camera,
    getZoom: () => 10,
    setZoom: () => {},
    getTarget: () => target,
    isInteriorActive: () => true,
    defaultInteriorCenter: [110, 0],
    getInteriorCenter: () => [220, 40],
    getInteriorCameraOffset: () => [13, 22, 17],
    getInteriorFollowsTarget: () => true,
    cameraOffset: new THREE.Vector3(13, 22, 17),
  });

  controller.setTarget(220, 50, true);
  const firstRotation = camera.quaternion.clone();
  const firstPosition = camera.position.clone();
  controller.setTarget(220, 30, true);
  assert.deepEqual(camera.quaternion.toArray(), firstRotation.toArray());
  assert.equal(camera.position.z, firstPosition.z - 20);
});

test('Ice cinematic camera focus keeps the fixed interior camera direction', () => {
  const camera = new THREE.OrthographicCamera();
  const target = new THREE.Vector3(220, 0, 49.8);
  const controller = createCameraController({
    getCamera: () => camera,
    getZoom: () => 10,
    setZoom: () => {},
    getTarget: () => target,
    isInteriorActive: () => true,
    defaultInteriorCenter: [110, 0],
    getInteriorCenter: () => [220, 40],
    getInteriorCameraOffset: () => [13, 22, 17],
    getInteriorFollowsTarget: () => true,
    cameraOffset: new THREE.Vector3(13, 22, 17),
  });

  controller.setTarget(220, 14, true);
  const initialRotation = camera.quaternion.clone();
  controller.focus(220, -8.85, { duration: 0, ease: 'power3.out' });
  assert.deepEqual(target.toArray(), [220, 0, -8.85]);
  assert.deepEqual(camera.quaternion.toArray(), initialRotation.toArray());
  assert.deepEqual(camera.position.toArray(), [233, 22, 8.15]);
});

test('Ice cinematic locks movement and prevents player camera follow from overriding the shot', () => {
  const cursor = new THREE.Group();
  cursor.visible = true;
  cursor.position.set(220, 0, 14);
  let playerPath = [new THREE.Vector3(220, 0, 5)];
  let cameraUpdates = 0;
  const controller = createPlayerController({
    getCursor: () => cursor,
    getCamera: () => new THREE.OrthographicCamera(),
    getCameraTarget: () => new THREE.Vector3(),
    setCameraTarget: () => { cameraUpdates += 1; },
    getPlayerPath: () => playerPath,
    setPlayerPath: (path) => { playerPath = path; },
    isDialogOpen: () => false,
    isMapOpen: () => false,
    buildRoadPath: () => [],
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    playerSpeed: 4.2,
    getNpcs: () => [],
    getEcho: () => null,
    getSpecialInterior: () => ({
      navigation: () => null,
      isMovementLocked: () => true,
      isCinematic: () => true,
    }),
    echoInterior: [110, 0],
    onIdle: () => undefined,
    sendPosition: () => undefined,
    addDistance: () => undefined,
    getManualMovement: () => ({ x: 0, z: -1 }),
    resolveMovement: (_from, target) => target,
  });

  controller.updateMovement(1);
  controller.updateCamera();
  assert.deepEqual(cursor.position.toArray(), [220, 0, 14]);
  assert.deepEqual(playerPath, []);
  assert.equal(cameraUpdates, 0);
});

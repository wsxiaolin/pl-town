import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createIceSanctum,
  ICE_SANCTUM_CORRIDOR_LENGTH,
} from '../../src/city/iceSanctum';
import { createInteractionPointer } from '../../src/city/interactionPointer';
import { createCameraController } from '../../src/city/navigation/cameraController';
import { createPlayerController } from '../../src/city/navigation/playerController';
import { createBuildingInteraction } from '../../src/city/buildingInteraction';
import type { BuildingEntity } from '../../src/city/buildingEntity';
import type { CityDialogController } from '../../src/adapters/ui/cityDialogController';

test('King Ice building does not reopen its audience prompt after the sanctum story was completed', () => {
  let promptOpens = 0;
  let lockedNotices = 0;
  let tracked = 0;
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
    canEnterIceSanctum: () => false,
    onIceSanctumLocked: () => { lockedNotices += 1; },
  });

  interaction.navigateUnlocked({ id: 'kingice' } as BuildingEntity);
  assert.equal(promptOpens, 0);
  assert.equal(lockedNotices, 1);
  assert.equal(tracked, 1);
});

test('Ice sanctum has no walls, separates Ice from the desk, and includes floating islands', () => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body: { classList: { remove: () => undefined } } },
  });
  const scene = new THREE.Scene();
  const sanctum = createIceSanctum({
    scene,
    makeMaterial: () => new THREE.MeshStandardMaterial(),
    makeCharacter: () => new THREE.Group(),
    getCursor: () => null,
    dialogs: () => null,
    claimReward: async () => true,
    onEnter: () => undefined,
    onReturn: () => undefined,
    setCameraTarget: () => undefined,
    focusCamera: () => undefined,
    stopCameraFocus: () => undefined,
    isMobile: () => false,
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
    claimReward: async () => true,
    onEnter: () => undefined,
    onReturn: () => undefined,
    setCameraTarget: () => undefined,
    focusCamera: () => undefined,
    stopCameraFocus: () => { cameraFocusStops += 1; },
    isMobile: () => false,
  });

  sanctum.enter();
  assert.equal(sanctum.isCinematic(), true);
  assert.equal(bodyClasses.has('ice-sanctum-cinematic-active'), true);
  assert.equal(overlays.length, 1);
  assert.equal(cameraFocusStops, 1);
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
    isEchoInterior: () => true,
    echoInterior: [110, 0],
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
    isEchoInterior: () => true,
    echoInterior: [110, 0],
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

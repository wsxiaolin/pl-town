import * as THREE from 'three';
import { gsap } from 'gsap';
import { createEchoCabinNavigation, type EchoCabinNavigation } from './navigation/echoCabinNavigation';
import type { CameraFocusOptions } from './navigation/cameraController';
import type { CityDialogController, NpcEntityLike, StoryDialogModel } from '../adapters/ui/cityDialogController';

type Cursor = THREE.Object3D & { position: THREE.Vector3; rotation: THREE.Euler; visible: boolean };
type IslandBlock = readonly [number, number, number, number, number, number, THREE.Material];
type IslandShape = 'citadel' | 'mesa' | 'spire' | 'crescent' | 'twin' | 'stair';

export type IceSanctumOptions = {
  scene: THREE.Scene;
  makeMaterial: (parameters: Record<string, unknown>) => THREE.Material;
  makeCharacter: (head: number, body: number) => THREE.Group;
  getCursor: () => Cursor | null;
  dialogs: () => CityDialogController | null;
  claimReward: (rewardId: string) => Promise<boolean>;
  onEnter: () => void;
  onReturn: (weather: 'rain' | 'sunny') => void;
  setCameraTarget: (x: number, z: number, instant?: boolean) => void;
  focusCamera: (x: number, z: number, focusOptions?: CameraFocusOptions) => void;
  stopCameraFocus: () => void;
  isMobile: () => boolean;
};

const CENTER: readonly [number, number] = [220, 40];
const ROOM_WIDTH = 34;
const ROOM_DEPTH = 24;
export const ICE_SANCTUM_CORRIDOR_LENGTH = 40;
const ROOM_AREA_Z = -ICE_SANCTUM_CORRIDOR_LENGTH;
const CONNECTOR_WIDTH = 10;
const CONNECTOR_CENTER_Z = ROOM_AREA_Z / 2 + ROOM_DEPTH / 2;
const NAVIGATION_FLOOR_DEPTH = ROOM_DEPTH + ICE_SANCTUM_CORRIDOR_LENGTH;
const NAVIGATION_FLOOR_Z = ROOM_AREA_Z / 2;
const TABLE_Z = -ROOM_DEPTH / 2 + 5.7;
const ICE_Z = -ROOM_DEPTH / 2 + 3.15;
const INTERACTION_Z = TABLE_Z + 2;
const CINEMATIC_PAUSE_DURATION = 1;
const CINEMATIC_FOCUS_DURATION = 1.8;
const CINEMATIC_HOLD_DURATION = 0.9;
const CINEMATIC_RETURN_DURATION = 1.6;
const CINEMATIC_EXIT_AT = CINEMATIC_PAUSE_DURATION + CINEMATIC_FOCUS_DURATION + CINEMATIC_HOLD_DURATION;

function iceResidentId(): string {
  return typeof localStorage === 'undefined' ? 'visitor' : localStorage.getItem('minicityUser') || 'visitor';
}

function iceChoiceKey(resident = iceResidentId()): string {
  return `minicityIceChoice:${resident}`;
}

function box(material: THREE.Material, width: number, height: number, depth: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createIceSanctum(options: IceSanctumOptions) {
  const root = new THREE.Group();
  root.name = 'ice-sanctum-interior';
  root.userData.echoInteriorWalkable = {
    minX: -ROOM_WIDTH / 2 + 0.9,
    maxX: ROOM_WIDTH / 2 - 0.9,
    minZ: ROOM_AREA_Z - ROOM_DEPTH / 2 + 0.9,
    maxZ: ROOM_DEPTH / 2 - 0.9,
  };
  root.position.set(CENTER[0], 0, CENTER[1]);
  const floorMat = options.makeMaterial({ color: 0xb9e9e7, roughness: 0.62, tex: 'ground5', rx: 12, ry: 10 });
  const connectorMat = options.makeMaterial({ color: 0xb3e5e3, roughness: 0.6, tex: 'ground5', rx: 4, ry: 16 });
  const trimMat = options.makeMaterial({ color: 0x9bd3d2, roughness: 0.45, metalness: 0.12 });
  const woodMat = options.makeMaterial({ color: 0x8d6b53, roughness: 0.65, tex: 'wood', rx: 2, ry: 2 });
  const islandMat = options.makeMaterial({ color: 0xa8dfdc, roughness: 0.72, tex: 'stone', rx: 2, ry: 2 });
  const islandShadeMat = options.makeMaterial({ color: 0x72b9b8, roughness: 0.78, tex: 'stone', rx: 2, ry: 2 });
  const islandIceMat = options.makeMaterial({
    color: 0x9eddf0,
    emissive: 0x2f7f9d,
    emissiveIntensity: 0.12,
    roughness: 0.22,
    metalness: 0.04,
    transparent: true,
    opacity: 0.72,
  });
  const islandShapes: Record<IslandShape, readonly IslandBlock[]> = {
    citadel: [
      [0, -0.65, 0, 13.8, 1.3, 10.6, islandMat],
      [0.3, -2.05, 0.1, 11.2, 1.8, 8.8, islandShadeMat],
      [-0.25, -4.05, 0.2, 8.8, 2.4, 6.8, islandShadeMat],
      [0.4, -6.35, 0, 6.5, 2.6, 5.1, islandShadeMat],
      [-0.1, -8.55, 0.15, 4.3, 2.2, 3.6, islandShadeMat],
      [-5.9, -0.2, -3.5, 4.8, 0.95, 4.1, islandMat],
      [5.8, -0.12, 3.4, 5.1, 1.1, 4.3, islandMat],
      [5.5, -0.45, -3.6, 3.8, 1.5, 3.2, islandShadeMat],
      [-5.3, -0.55, 3.8, 3.6, 1.4, 3.5, islandShadeMat],
      [-2.9, 0.32, 3.8, 4.2, 0.72, 3.1, trimMat],
      [3.15, 0.38, -3.65, 4.5, 0.74, 3.2, trimMat],
      [-5.35, 2.35, 0.2, 0.72, 5.2, 0.72, islandIceMat],
      [5.25, 2.8, -0.35, 0.78, 6.1, 0.78, islandIceMat],
      [0, 1.25, 4.45, 6.8, 0.42, 0.55, islandIceMat],
      [0, 1.05, -4.45, 6.2, 0.38, 0.52, islandIceMat],
      [-2.4, 0.7, 1.6, 2.2, 1.4, 0.62, islandIceMat],
      [-0.35, 0.95, 1.55, 1.8, 1.9, 0.66, islandIceMat],
      [1.5, 0.78, 1.5, 1.7, 1.55, 0.62, islandIceMat],
      [3.15, 0.58, 1.45, 1.35, 1.15, 0.6, islandIceMat],
      [0.5, 0.28, -1.8, 2.7, 0.6, 0.52, islandIceMat],
      [0.2, -10.25, 0.1, 2.25, 1.8, 2.05, islandShadeMat],
    ],
    mesa: [
      [0, -0.55, 0, 18, 1.1, 9.2, islandMat],
      [-1.4, -1.9, 0.3, 15.2, 1.6, 7.7, islandShadeMat],
      [1.1, -3.7, 0.1, 12.1, 2.1, 6.1, islandShadeMat],
      [-0.8, -5.9, 0.3, 8.4, 2.5, 4.5, islandShadeMat],
      [0.7, -8, 0, 4.7, 1.8, 2.8, islandShadeMat],
      [-8.2, -0.1, 3.1, 5.1, 0.8, 4, islandMat],
      [8.6, -0.3, -2.7, 4.4, 1.2, 3.4, islandMat],
      [-5.9, 0.35, -3.9, 5.2, 0.55, 1.8, trimMat],
      [3.8, 0.34, 4, 7.2, 0.52, 1.5, trimMat],
      [-7.6, 1.45, 0.3, 0.62, 3.5, 0.62, islandIceMat],
      [6.9, 1.05, 0.5, 0.55, 2.7, 0.55, islandIceMat],
      [-1.8, 0.45, -3.85, 8.8, 0.3, 0.42, islandIceMat],
      [-3.5, 0.65, 1.2, 2.4, 1.3, 0.62, islandIceMat],
      [-1.3, 0.9, 1.18, 1.9, 1.8, 0.65, islandIceMat],
      [0.5, 0.7, 1.2, 1.75, 1.4, 0.62, islandIceMat],
      [4.7, 0.55, -0.8, 2.2, 1.1, 0.6, islandIceMat],
      [2.4, -9.55, 0.1, 2.4, 1.7, 1.9, islandShadeMat],
    ],
    spire: [
      [0, -0.5, 0, 8.4, 1, 7.3, islandMat],
      [0.5, -1.8, -0.2, 7, 1.6, 6.2, islandShadeMat],
      [-0.35, -3.7, 0.2, 5.5, 2.4, 4.8, islandShadeMat],
      [0.25, -6.4, 0, 4.1, 3, 3.6, islandShadeMat],
      [-0.15, -9.5, 0.1, 2.8, 3.2, 2.5, islandShadeMat],
      [0.1, -12.5, 0, 1.55, 2.8, 1.45, islandShadeMat],
      [-3.2, 2.8, 0.6, 0.72, 6.6, 0.72, islandIceMat],
      [3, 4.05, -0.7, 0.68, 9.1, 0.68, islandIceMat],
      [0.2, 1.1, 3, 4.5, 0.45, 1.2, trimMat],
      [-0.4, 0.9, -3, 3.7, 0.4, 1, trimMat],
      [-3.7, -0.1, -2.7, 2.8, 0.8, 2.4, islandMat],
      [3.8, -0.2, 2.5, 2.6, 0.95, 2.1, islandMat],
      [-1.7, 0.65, 1.1, 1.9, 1.3, 0.6, islandIceMat],
      [0, 0.9, 1.12, 1.65, 1.8, 0.64, islandIceMat],
      [1.55, 0.7, 1.05, 1.4, 1.4, 0.6, islandIceMat],
      [0, 0.35, -1.8, 2.5, 0.7, 0.5, islandIceMat],
    ],
    crescent: [
      [0, -0.55, 0, 14.2, 1.1, 7.2, islandMat],
      [-1, -1.8, 0.5, 11.6, 1.6, 6, islandShadeMat],
      [0.8, -3.7, 0, 8.9, 2.3, 4.8, islandShadeMat],
      [-0.4, -6.1, -0.2, 5.8, 2.6, 3.3, islandShadeMat],
      [0.2, -8.4, 0, 3.1, 2.1, 2.2, islandShadeMat],
      [-6.6, 0, 3.7, 4.9, 0.85, 3.5, islandMat],
      [-8.4, -0.2, 6.3, 3.1, 1.05, 2.8, islandMat],
      [-8.7, -0.4, 9, 2.5, 1.25, 2.4, islandShadeMat],
      [6.5, -0.2, -2.4, 3.9, 1.2, 3.1, islandMat],
      [-5.2, 0.55, 5, 4.6, 0.42, 0.55, islandIceMat],
      [-8, 0.65, 7.8, 0.52, 2.6, 0.52, islandIceMat],
      [5.5, 1.55, -2.4, 0.65, 4.1, 0.65, islandIceMat],
      [-5.9, 0.6, 3.4, 2.2, 1.2, 0.62, islandIceMat],
      [-7.35, 0.85, 5.3, 1.8, 1.7, 0.62, islandIceMat],
      [-8.15, 1, 7.05, 1.35, 2, 0.58, islandIceMat],
      [2.3, 0.72, -1.5, 2.1, 1.45, 0.62, islandIceMat],
      [4.05, 0.5, -2, 1.45, 1, 0.56, islandIceMat],
      [1.4, -10.1, 0.2, 1.9, 1.8, 1.6, islandShadeMat],
      [-7.4, -2, 6, 2.2, 2.5, 2.1, islandShadeMat],
    ],
    twin: [
      [-5, -0.55, 0.3, 9.4, 1.1, 8.2, islandMat],
      [5, -0.55, -0.4, 8.7, 1.1, 7.6, islandMat],
      [0, -0.1, 0, 4.5, 0.65, 2.6, trimMat],
      [-4.8, -2, 0.2, 7.3, 1.8, 6.3, islandShadeMat],
      [-4.6, -4.2, 0, 5.3, 2.6, 4.6, islandShadeMat],
      [-4.5, -6.8, 0.1, 3.1, 2.7, 2.8, islandShadeMat],
      [5.1, -1.9, -0.2, 6.8, 1.7, 5.8, islandShadeMat],
      [5.2, -4, 0, 4.7, 2.5, 4, islandShadeMat],
      [5.1, -6.5, 0.1, 2.7, 2.5, 2.4, islandShadeMat],
      [-7.8, -0.1, 3.7, 3.5, 0.85, 3.2, islandMat],
      [8, -0.1, -3.2, 3.3, 0.9, 2.9, islandMat],
      [-6.8, 2.25, -1.8, 0.67, 5.6, 0.67, islandIceMat],
      [6.7, 1.7, 1.7, 0.64, 4.5, 0.64, islandIceMat],
      [-3.8, 0.7, 3.8, 4.8, 0.38, 0.48, islandIceMat],
      [4.3, 0.7, -3.6, 4.4, 0.38, 0.48, islandIceMat],
      [-6.1, 0.7, 0.9, 2.25, 1.4, 0.62, islandIceMat],
      [-4.2, 0.95, 0.92, 1.65, 1.9, 0.64, islandIceMat],
      [-2.65, 0.6, 0.9, 1.25, 1.2, 0.58, islandIceMat],
      [3.2, 0.65, -0.9, 1.4, 1.3, 0.58, islandIceMat],
      [4.65, 0.9, -0.92, 1.55, 1.8, 0.62, islandIceMat],
      [6.3, 0.58, -0.9, 1.45, 1.15, 0.58, islandIceMat],
      [0.3, -1.5, 0, 2.4, 2.2, 2.1, islandShadeMat],
    ],
    stair: [
      [-4.8, -0.4, 4.2, 7.8, 0.8, 6.2, islandMat],
      [-1.5, -1, 1.5, 8.8, 1, 6.8, islandMat],
      [2.2, -1.7, -1.3, 9.7, 1.2, 7.3, islandMat],
      [5.6, -2.5, -4.2, 7.5, 1.4, 5.8, islandShadeMat],
      [0.7, -3.7, 0, 9.4, 2.2, 5.8, islandShadeMat],
      [1.2, -6, -0.2, 6.7, 2.5, 4.1, islandShadeMat],
      [0.9, -8.1, 0, 3.9, 1.9, 2.6, islandShadeMat],
      [-6.8, 0.6, 5.7, 3.3, 0.42, 2.2, trimMat],
      [7.1, -1.4, -5.5, 2.9, 0.48, 2, trimMat],
      [-4.5, 1.6, 3.8, 0.58, 3.9, 0.58, islandIceMat],
      [4.8, 0.7, -3.8, 0.62, 3.1, 0.62, islandIceMat],
      [-4.2, 0.52, 3.1, 2.1, 1.05, 0.58, islandIceMat],
      [-1.1, -0.02, 0.8, 1.85, 1.25, 0.6, islandIceMat],
      [2.1, -0.62, -1.6, 1.65, 1.35, 0.58, islandIceMat],
      [5.1, -1.45, -4, 1.45, 1.2, 0.56, islandIceMat],
      [1.4, -9.7, 0, 2, 1.5, 1.7, islandShadeMat],
    ],
  };

  const originalArea = new THREE.Group();
  originalArea.name = 'ice-sanctum-original-area';
  originalArea.position.z = ROOM_AREA_Z;
  root.add(originalArea);

  const floor = box(floorMat, ROOM_WIDTH, 0.18, ROOM_DEPTH, 0, -0.09, 0);
  floor.name = 'ice-sanctum-room-floor';
  floor.userData.echoInteriorFloor = true;
  originalArea.add(floor);

  const connectorFloor = box(connectorMat, CONNECTOR_WIDTH, 0.18, ICE_SANCTUM_CORRIDOR_LENGTH, 0, -0.09, CONNECTOR_CENTER_Z);
  connectorFloor.name = 'ice-sanctum-connector-floor';
  connectorFloor.userData.echoCabinWalkable = true;
  connectorFloor.userData.echoInteriorObstacle = false;
  root.add(connectorFloor);

  const navigationFloor = box(floorMat, ROOM_WIDTH, 0.18, NAVIGATION_FLOOR_DEPTH, 0, -0.09, NAVIGATION_FLOOR_Z);
  navigationFloor.name = 'ice-sanctum-navigation-floor';
  navigationFloor.visible = false;
  navigationFloor.userData.echoInteriorFloor = true;
  navigationFloor.userData.echoInteriorObstacle = false;
  root.add(navigationFloor);

  const sideVoidWidth = (ROOM_WIDTH - CONNECTOR_WIDTH) / 2;
  for (const side of [-1, 1]) {
    const sideBlocker = box(
      floorMat,
      sideVoidWidth,
      1.2,
      ICE_SANCTUM_CORRIDOR_LENGTH,
      side * (CONNECTOR_WIDTH / 2 + sideVoidWidth / 2),
      0.51,
      CONNECTOR_CENTER_Z,
    );
    sideBlocker.name = `ice-sanctum-connector-boundary-${side < 0 ? 'left' : 'right'}`;
    sideBlocker.visible = false;
    sideBlocker.userData.echoInteriorObstacle = true;
    root.add(sideBlocker);
  }
  const floatingIslands = new THREE.Group();
  floatingIslands.name = 'ice-sanctum-floating-islands';
  const islandBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const islandTransform = new THREE.Object3D();
  const islandConfigs: readonly {
    center: readonly [number, number, number];
    shape: IslandShape;
    scale: number;
    rotation: number;
    amplitude: number;
    duration: number;
    delay: number;
    ease: string;
  }[] = [
    { center: [-30, -10, 2.2], shape: 'citadel', scale: 1.22, rotation: 0.12, amplitude: 1.2, duration: 4.8, delay: -0.3, ease: 'sine.inOut' },
    { center: [-29, 11, 1.45], shape: 'mesa', scale: 0.88, rotation: 1.42, amplitude: 0.74, duration: 3.6, delay: -1.1, ease: 'power1.inOut' },
    { center: [30, -10, 1.75], shape: 'twin', scale: 1.06, rotation: 2.92, amplitude: 1.02, duration: 4.2, delay: -1.8, ease: 'sine.inOut' },
    { center: [30, 11, 3.2], shape: 'spire', scale: 0.74, rotation: 0.55, amplitude: 1.36, duration: 3.25, delay: -0.7, ease: 'power2.inOut' },
    { center: [-17, -27, 1.7], shape: 'crescent', scale: 1.12, rotation: -0.18, amplitude: 0.86, duration: 5.15, delay: -2.4, ease: 'sine.inOut' },
    { center: [8, -28, 1.25], shape: 'stair', scale: 0.79, rotation: 1.08, amplitude: 0.65, duration: 3.85, delay: -1.5, ease: 'power1.inOut' },
    { center: [20, 27, 2.5], shape: 'citadel', scale: 0.84, rotation: 2.4, amplitude: 1.1, duration: 4.55, delay: -3.1, ease: 'power2.inOut' },
    { center: [-18, 27, 1.5], shape: 'twin', scale: 0.94, rotation: -0.62, amplitude: 0.92, duration: 3.45, delay: -2.05, ease: 'sine.inOut' },
    { center: [-39, -24, 3.8], shape: 'spire', scale: 0.62, rotation: 1.75, amplitude: 1.42, duration: 3.1, delay: -0.9, ease: 'power2.inOut' },
    { center: [41, 20, 1.3], shape: 'mesa', scale: 1.28, rotation: -0.3, amplitude: 0.79, duration: 5.4, delay: -3.7, ease: 'sine.inOut' },
    { center: [-20, 38, 3], shape: 'stair', scale: 0.66, rotation: 2.2, amplitude: 1.27, duration: 3.7, delay: -2.8, ease: 'power1.inOut' },
    { center: [27, 39, 1.35], shape: 'crescent', scale: 0.76, rotation: -1.35, amplitude: 0.71, duration: 4.95, delay: -4.2, ease: 'sine.inOut' },
  ];
  const islandTweens: gsap.core.Tween[] = [];
  islandConfigs.forEach((config, islandIndex) => {
    const [x, z, lift] = config.center;
    const island = new THREE.Group();
    island.name = `ice-sanctum-floating-island-${islandIndex + 1}`;
    island.position.set(x, lift, z);
    island.rotation.y = config.rotation;
    const islandScale = config.scale;
    const blocks = islandShapes[config.shape];
    const blocksByMaterial = new Map<THREE.Material, IslandBlock[]>();
    blocks.forEach((blockData) => {
      const material = blockData[6];
      const materialBlocks = blocksByMaterial.get(material) ?? [];
      materialBlocks.push(blockData);
      blocksByMaterial.set(material, materialBlocks);
    });
    let batchIndex = 0;
    blocksByMaterial.forEach((materialBlocks, material) => {
      const batch = new THREE.InstancedMesh(islandBoxGeometry, material, materialBlocks.length);
      batch.name = `ice-sanctum-floating-island-${islandIndex + 1}-batch-${batchIndex + 1}`;
      batch.castShadow = false;
      batch.receiveShadow = false;
      batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      batch.userData.echoInteriorObstacle = false;
      batch.userData.iceSanctumIslandBatch = true;
      batch.userData.iceSanctumIceBatch = material === islandIceMat;
      batch.raycast = () => undefined;
      materialBlocks.forEach(([blockX, blockY, blockZ, width, height, depth], blockIndex) => {
        islandTransform.position.set(blockX * islandScale, blockY * islandScale, blockZ * islandScale);
        islandTransform.scale.set(width * islandScale, height * islandScale, depth * islandScale);
        islandTransform.updateMatrix();
        batch.setMatrixAt(blockIndex, islandTransform.matrix);
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingBox();
      batch.computeBoundingSphere();
      island.add(batch);
      batchIndex += 1;
    });
    const floatAmplitude = config.amplitude;
    const floatDuration = config.duration;
    const floatDelay = config.delay;
    island.userData.iceSanctumIsland = { shape: config.shape, scale: islandScale, blocks: blocks.length };
    island.userData.iceSanctumFloat = { amplitude: floatAmplitude, duration: floatDuration, delay: floatDelay };
    islandTweens.push(gsap.to(island.position, {
      y: lift + floatAmplitude,
      duration: floatDuration,
      delay: floatDelay,
      repeat: -1,
      yoyo: true,
      ease: config.ease,
    }));
    floatingIslands.add(island);
  });
  originalArea.add(floatingIslands);

  const table = box(woodMat, 6.8, 0.82, 2.2, 0, 0.7, TABLE_Z);
  table.name = 'ice-sanctum-desk';
  table.userData.echoInteriorObstacle = true;
  originalArea.add(table);
  for (const x of [-2.7, 2.7]) originalArea.add(box(woodMat, 0.26, 0.82, 1.8, x, 0.29, TABLE_Z));
  const tableTop = box(trimMat, 6.95, 0.08, 2.28, 0, 1.15, TABLE_Z);
  tableTop.userData.echoInteriorObstacle = true;
  originalArea.add(tableTop);

  const iceMesh = options.makeCharacter(0xc8ffff, 0x5aa8a7);
  iceMesh.name = 'ice-sanctum-npc';
  iceMesh.position.set(0, 0.82, ICE_Z);
  iceMesh.rotation.y = Math.PI;
  iceMesh.traverse((child) => { child.userData.iceSanctumNpc = true; child.userData.echoInteriorObstacle = false; });
  originalArea.add(iceMesh);
  const npcHitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 10),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  npcHitMesh.name = 'ice-sanctum-npc-hit-area';
  npcHitMesh.position.set(0, 0.43, ICE_Z);
  npcHitMesh.userData.echoInteriorObstacle = false;
  originalArea.add(npcHitMesh);
  const crown = new THREE.Group();
  const crownMat = options.makeMaterial({ color: 0xe8c25f, roughness: 0.25, metalness: 0.55 });
  for (let index = 0; index < 5; index += 1) {
    const angle = index / 5 * Math.PI * 2;
    const point = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 5), crownMat);
    point.position.set(Math.cos(angle) * 0.11, 0.65, Math.sin(angle) * 0.11);
    crown.add(point);
  }
  iceMesh.add(crown);
  const chandelier = new THREE.PointLight(0xcffdf6, 2.4, 38, 1.5);
  chandelier.position.set(0, 6.3, 0);
  originalArea.add(chandelier);
  root.visible = false;
  options.scene.add(root);

  let navigation: EchoCabinNavigation | null = null;
  let active = false;
  let cinematic = false;
  let cinematicOverlay: HTMLElement | null = null;
  let cinematicTimeline: ReturnType<typeof gsap.timeline> | null = null;
  let timeSkipFadeOverlay: HTMLElement | null = null;
  let hiddenObjects: THREE.Object3D[] = [];

  const postNpc = (dialog: readonly { speaker?: string; text: string; options: readonly { text: string; next: number | null; action?: string }[] }[]): NpcEntityLike => ({
    profile: { id: 'ice-sanctum', name: 'Ice', head: 0xc8ffff, body: 0x5aa8a7, transitionDelayMs: 1000, dialog },
    mesh: iceMesh,
  });

  const openingNpc = postNpc([
    { speaker: '？？？', text: '……', options: [{ text: '你是……', next: 1 }] },
    { speaker: '？？？', text: '冰', options: [
      { text: '哦，你在这做什么', next: 2 },
      { text: '我的天哪冰块大人', next: 2 },
      { text: '呜呜呜我不该来这里的对不起对不起对不起不要惩罚我冰块大人呜呜呜', next: 2 },
    ] },
    { speaker: 'Ice', text: '……', options: [{ text: '？？', next: 3 }] },
    { speaker: 'Ice', text: '你……愿意陪我坐一会吗？', options: [
      { text: '……行？', next: null, action: 'ice:accept' },
      { text: '我的荣幸冰块大人', next: null, action: 'ice:accept' },
      { text: '不……', next: null, action: 'ice:reject' },
    ] },
  ]);

  const afterTimeSkipNpc = postNpc([
    { speaker: 'Ice', text: '你喜欢我的皇冠吗？', options: [
      { text: '喜欢', next: 1 },
      { text: '呃……挺好的', next: 1 },
    ] },
    { speaker: 'Ice', text: '谢谢，我很喜欢你陪着我的感觉。', options: [{ text: '什么？', next: 2 }] },
    { speaker: 'Ice', text: '没什么，希望你喜欢这杯柠檬茶', options: [{ text: '收下', next: null, action: 'ice:finish-accept' }] },
  ]);

  function buildNavigation(): void {
    navigation = createEchoCabinNavigation({
      getInterior: () => root,
      fallbackBounds: {
        minX: CENTER[0] - ROOM_WIDTH / 2 + 1,
        maxX: CENTER[0] + ROOM_WIDTH / 2 - 1,
        minZ: CENTER[1] + ROOM_AREA_Z - ROOM_DEPTH / 2 + 1,
        maxZ: CENTER[1] + ROOM_DEPTH / 2 - 1,
      },
    });
    navigation.refresh();
  }

  function removeCinematicOverlay(): void {
    cinematicOverlay?.remove();
    cinematicOverlay = null;
    document.body.classList.remove('ice-sanctum-cinematic-active');
  }

  function removeTimeSkipFadeOverlay(): void {
    timeSkipFadeOverlay?.remove();
    timeSkipFadeOverlay = null;
  }

  function fadeOutTimeSkipBlackout(): void {
    removeTimeSkipFadeOverlay();
    const overlay = document.createElement('div');
    overlay.className = 'ice-sanctum-time-skip-fade';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.append(overlay);
    timeSkipFadeOverlay = overlay;
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-fading')));
    window.setTimeout(() => {
      if (timeSkipFadeOverlay === overlay) timeSkipFadeOverlay = null;
      overlay.remove();
    }, 2100);
  }

  function cancelCinematic(): void {
    cinematicTimeline?.kill();
    cinematicTimeline = null;
    options.stopCameraFocus();
    removeCinematicOverlay();
    cinematic = false;
  }

  function completeCinematic(): void {
    cinematicTimeline = null;
    removeCinematicOverlay();
    cinematic = false;
    const cursor = options.getCursor();
    if (cursor) options.setCameraTarget(cursor.position.x, cursor.position.z, true);
  }

  function startCinematic(): void {
    const cursor = options.getCursor();
    if (!cursor) return;
    cinematic = true;
    document.body.classList.add('ice-sanctum-cinematic-active');

    const overlay = document.createElement('div');
    overlay.className = 'ice-sanctum-cinematic';
    overlay.setAttribute('aria-hidden', 'true');
    const topMask = document.createElement('div');
    topMask.className = 'ice-sanctum-cinematic-mask ice-sanctum-cinematic-mask-top';
    const bottomMask = document.createElement('div');
    bottomMask.className = 'ice-sanctum-cinematic-mask ice-sanctum-cinematic-mask-bottom';
    overlay.append(topMask, bottomMask);
    document.body.append(overlay);
    cinematicOverlay = overlay;

    const playerPosition = cursor.position.clone();
    const icePosition = npcWorldPosition();
    const timelineClock = { progress: 0 };
    options.setCameraTarget(playerPosition.x, playerPosition.z, true);
    gsap.set(topMask, { yPercent: -100 });
    gsap.set(bottomMask, { yPercent: 100 });

    cinematicTimeline = gsap.timeline({ onComplete: completeCinematic });
    cinematicTimeline.call(() => {
      options.focusCamera(icePosition.x, icePosition.z, {
        duration: CINEMATIC_FOCUS_DURATION,
        ease: 'power3.out',
      });
    }, [], CINEMATIC_PAUSE_DURATION);
    cinematicTimeline.to([topMask, bottomMask], {
      yPercent: 0,
      duration: 0.9,
      ease: 'power3.out',
    }, CINEMATIC_PAUSE_DURATION);
    cinematicTimeline.call(() => {
      const currentCursor = options.getCursor();
      if (!currentCursor) return;
      options.focusCamera(currentCursor.position.x, currentCursor.position.z, {
        duration: CINEMATIC_RETURN_DURATION,
        ease: 'power3.out',
      });
    }, [], CINEMATIC_EXIT_AT);
    cinematicTimeline.to(topMask, {
      yPercent: -100,
      duration: 1.2,
      ease: 'power3.inOut',
    }, CINEMATIC_EXIT_AT);
    cinematicTimeline.to(bottomMask, {
      yPercent: 100,
      duration: 1.2,
      ease: 'power3.inOut',
    }, CINEMATIC_EXIT_AT);
    cinematicTimeline.to(timelineClock, {
      progress: 1,
      duration: CINEMATIC_RETURN_DURATION,
      ease: 'none',
    }, CINEMATIC_EXIT_AT);
  }

  function hasEntered(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(iceChoiceKey()) !== null;
  }

  function enter(): boolean {
    const cursor = options.getCursor();
    if (!cursor || active || hasEntered()) return false;
    if (!navigation) buildNavigation();
    cancelCinematic();
    removeTimeSkipFadeOverlay();
    active = true;
    options.onEnter();
    root.visible = true;
    document.body.classList.add('ice-sanctum-active');
    hiddenObjects = [];
    options.scene.children.forEach((object) => {
      if (object === root || object === cursor || object instanceof THREE.Light) return;
      if (object.visible) { hiddenObjects.push(object); object.visible = false; }
    });
    cursor.position.set(CENTER[0], 0, CENTER[1] + ROOM_DEPTH / 2 - 2.2);
    cursor.visible = true;
    cursor.position.copy(navigation?.clampToWalkable(cursor.position) ?? cursor.position);
    options.dialogs()?.closeNpc();
    startCinematic();
    return true;
  }

  function openIceDialog(npc: NpcEntityLike): void {
    options.dialogs()?.openNpc(npc);
  }

  async function finish(weather: 'rain' | 'sunny', rewardId: string): Promise<void> {
    const resident = iceResidentId();
    if (typeof localStorage !== 'undefined') localStorage.setItem(iceChoiceKey(resident), weather === 'rain' ? 'reject' : 'accept');
    void options.claimReward(rewardId);
    options.dialogs()?.closeNpc();
    cancelCinematic();
    removeTimeSkipFadeOverlay();
    active = false;
    root.visible = false;
    hiddenObjects.forEach((object) => { object.visible = true; });
    hiddenObjects = [];
    document.body.classList.remove('ice-sanctum-active');
    const cursor = options.getCursor();
    if (cursor) cursor.position.set(20, 0, 26);
    options.onReturn(weather);
  }

  function returnThroughBlackout(weather: 'rain' | 'sunny', rewardId: string): void {
    document.body.classList.add('ice-sanctum-returning');
    window.setTimeout(() => void finish(weather, rewardId), 1500);
    window.setTimeout(() => document.body.classList.remove('ice-sanctum-returning'), 3000);
  }

  function handleAction(action: string): void {
    if (!active) return;
    if (action === 'ice:reject') window.setTimeout(() => {
      options.dialogs()?.openStory({ title: 'Ice', text: '……抱歉', variant: 'story' });
      window.setTimeout(() => returnThroughBlackout('rain', 'ice_reject'), 2000);
    }, 0);
    if (action === 'ice:accept') window.setTimeout(() => {
      options.dialogs()?.openStory({ title: 'Ice', text: '……谢谢', variant: 'story' });
      window.setTimeout(() => {
        options.dialogs()?.openStory({ title: '', text: '', variant: 'blackout' });
        window.setTimeout(() => {
          const model: StoryDialogModel = { title: '', text: '一段时间后……', variant: 'blackout' };
          options.dialogs()?.openStory(model);
          window.setTimeout(() => {
            fadeOutTimeSkipBlackout();
            openIceDialog(afterTimeSkipNpc);
          }, 2500);
        }, 2000);
      }, 2400);
    }, 0);
    if (action === 'ice:finish-accept') window.setTimeout(() => returnThroughBlackout('sunny', 'ice_accept'), 300);
  }

  function interactNpc(): boolean {
    if (!active || cinematic) return false;
    openIceDialog(openingNpc);
    return true;
  }

  function npcWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
    return iceMesh.getWorldPosition(target);
  }

  function interactionPosition(target = new THREE.Vector3()): THREE.Vector3 {
    target.set(0, 0, INTERACTION_Z);
    return originalArea.localToWorld(target);
  }

  function dispose(): void {
    cancelCinematic();
    removeTimeSkipFadeOverlay();
    islandTweens.forEach((tween) => tween.kill());
    hiddenObjects.forEach((object) => { object.visible = true; });
    hiddenObjects = [];
    active = false;
    document.body.classList.remove('ice-sanctum-active');
    document.body.classList.remove('ice-sanctum-returning');
    const geometries = new Set<THREE.BufferGeometry>();
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    });
    geometries.forEach((geometry) => geometry.dispose());
    root.removeFromParent();
  }

  return {
    root,
    enter,
    handleAction,
    interactNpc,
    npcMesh: iceMesh,
    npcHitMesh,
    npcWorldPosition,
    interactionPosition,
    hasEntered,
    isActive: () => active,
    isCinematic: () => cinematic,
    isMovementLocked: () => cinematic,
    isInteractionLocked: () => cinematic,
    navigation: () => navigation,
    center: CENTER,
    dispose,
  };
}

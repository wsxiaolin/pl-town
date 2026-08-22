import * as THREE from 'three';
import { ECHO_OBSERVATORY_AREA } from '../city/data/cityConfig';
import type { SceneInterestPointId } from '../gameplay/world/sceneInteractions';
export type { SceneInterestPointId };
import { createWestBeach } from './westBeach';
import { createCatCafeIceWall } from './iceKing/catCafeIceWall';

export interface SceneInterestPointEntity {
  id: SceneInterestPointId;
  object: THREE.Group;
  interactionPosition: THREE.Vector3;
}

interface SceneInterestPointOptionsInput {
  scene: THREE.Scene;
  makeMaterial: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
}

interface SceneInterestPointOptions extends SceneInterestPointOptionsInput {
  materialFor: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
}

export interface SceneInterestPoints {
  entities: ReadonlyMap<SceneInterestPointId, SceneInterestPointEntity>;
  raycastTargets: readonly THREE.Object3D[];
  obstacleRoots: readonly THREE.Object3D[];
  update(elapsedSeconds: number): void;
  setWellPhase(phase: 'idle' | 'focus' | 'engulf' | 'recede'): void;
  setBeachEncounterPhase(phase: 'hidden' | 'revealed' | 'reward'): void;
  setActiveStoryPoints(ids: readonly SceneInterestPointId[]): void;
  dispose(): void;
}

function tag(group: THREE.Group, id: SceneInterestPointId): void {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.userData.sceneInterestPointId = id;
  });
}

function addMesh(
  group: THREE.Group,
  options: SceneInterestPointOptions,
  geometry: THREE.BufferGeometry,
  material: Record<string, unknown> | THREE.Material,
  position: readonly [number, number, number],
): THREE.Mesh {
  const mesh = options.makeMesh(geometry, material instanceof THREE.Material ? material : options.materialFor(material));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createCatCafeNote(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  const paper = addMesh(
    object,
    options,
    new THREE.BoxGeometry(0.62, 0.018, 0.43),
    { color: 0xf4ecd8, roughness: 0.92 },
    [0, 0.045, 0],
  );
  paper.rotation.y = -0.34;
  const fold = addMesh(
    object,
    options,
    new THREE.BoxGeometry(0.18, 0.01, 0.16),
    { color: 0xe2d5b9, roughness: 0.95 },
    [0.21, 0.061, -0.12],
  );
  fold.rotation.y = -0.34;
  object.position.set(10.65, 0, 4.35);
  tag(object, 'cat-cafe-note');
  options.scene.add(object);
  return { id: 'cat-cafe-note', object, interactionPosition: object.position.clone() };
}

function createOrangeTree(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  const soil = addMesh(object, options, new THREE.CylinderGeometry(0.92, 1.02, 0.12, 24), { color: 0x554336, roughness: 1 }, [0, 0.06, 0]);
  soil.receiveShadow = true;
  addMesh(
    object,
    options,
    new THREE.CylinderGeometry(0.12, 0.18, 1.3, 10),
    { color: 0x76543a, roughness: 0.94 },
    [0, 0.65, 0],
  );
  const branchPositions: readonly (readonly [number, number, number, number])[] = [
    [-0.25, 1.05, 0.05, -0.33], [0.24, 1.08, -0.04, 0.36], [0.05, 1.18, 0.18, 0.08],
  ];
  branchPositions.forEach(([x,y,z,rz]) => {
    const branch = addMesh(object, options, new THREE.CylinderGeometry(0.045, 0.075, 0.72, 8), { color: 0x725039, roughness: .96 }, [x,y,z]);
    branch.rotation.z = rz;
  });
  const crownPositions: readonly [number, number, number, number][] = [
    [0, 1.54, 0, 0x47763a], [-0.28, 1.42, 0.05, 0x5d9147], [0.25, 1.4, -0.08, 0x3f6f37],
    [0.05, 1.35, 0.28, 0x6a9d50], [-0.43, 1.58, -0.16, 0x4c803d], [0.43, 1.56, 0.12, 0x47763a],
  ];
  crownPositions.forEach(([x, y, z, color]) => {
    const crown = addMesh(object, options, new THREE.IcosahedronGeometry(0.42, 1), { color, roughness: 0.86 }, [x, y, z]);
    crown.scale.set(1.08, 0.72, 0.92);
    crown.rotation.set(0.12, x * 1.8, z * 1.2);
  });
  const fruitMaterial = { color: 0xef8b24, roughness: 0.68, emissive: 0x5a2100, emissiveIntensity: 0.04 };
  const fruitPositions: readonly [number, number, number][] = [
    [-0.28, 1.52, 0.38], [0.3, 1.47, 0.3], [0.42, 1.63, -0.12], [-0.12, 1.28, 0.42], [-0.4, 1.69, -0.05],
  ];
  fruitPositions.forEach((position, index) => {
    const fruit = addMesh(object, options, new THREE.SphereGeometry(0.085, 10, 8), fruitMaterial, position);
    fruit.userData.orangeFruitIndex = index;
    fruit.userData.orangeFruitBaseY = position[1];
  });
  const marker = addMesh(object, options, new THREE.BoxGeometry(0.78, 0.38, 0.07), { color: 0xf5f0e4, roughness: .9 }, [1.04, .42, .12]);
  marker.rotation.y = -.18;
  addMesh(object, options, new THREE.CylinderGeometry(.025, .035, .62, 8), { color: 0x5f4937, roughness: 1 }, [1.04, .17, .12]);
  object.position.set(-15, 0, -3);
  tag(object, 'origin-orange-tree');
  options.scene.add(object);
  return { id: 'origin-orange-tree', object, interactionPosition: object.position.clone().add(new THREE.Vector3(1.65, 0, 0.85)) };
}

function createLongjingWell(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  const stone = { color: 0xa4a7a0, roughness: 0.96 };
  addMesh(object, options, new THREE.CylinderGeometry(0.62, 0.72, 0.55, 18, 1, true), stone, [0, 0.275, 0]);
  const rim = addMesh(
    object,
    options,
    new THREE.TorusGeometry(0.67, 0.12, 8, 24),
    { color: 0xb9bbb4, roughness: 0.92 },
    [0, 0.58, 0],
  );
  rim.rotation.x = Math.PI / 2;
  const water = addMesh(
    object,
    options,
    new THREE.CircleGeometry(0.52, 24),
    { color: 0x315f49, roughness: 0.25, metalness: 0.12 },
    [0, 0.535, 0],
  );
  water.rotation.x = -Math.PI / 2;
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const block = addMesh(object, options, new THREE.BoxGeometry(.29, .24, .34), { color: index % 2 ? 0xa9aaa3 : 0x92968f, roughness: .98 }, [Math.cos(angle) * .67, .22 + (index % 3) * .025, Math.sin(angle) * .67]);
    block.rotation.y = -angle;
  }
  [-.82,.82].forEach((x) => addMesh(object, options, new THREE.CylinderGeometry(.055,.075,1.45,10), { color: 0x594535, roughness: .92 }, [x,.76,0]));
  const beam = addMesh(object, options, new THREE.CylinderGeometry(.055,.055,1.78,10), { color: 0x594535, roughness: .92 }, [0,1.42,0]);
  beam.rotation.z = Math.PI / 2;
  const vineMaterial = { color: 0x497d42, roughness: 0.9 };
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * Math.PI * 2;
    const leaf = addMesh(
      object,
      options,
      new THREE.SphereGeometry(0.1, 8, 6),
      vineMaterial,
      [Math.cos(angle) * 0.69, 0.45 + (index % 2) * 0.12, Math.sin(angle) * 0.69],
    );
    leaf.scale.set(1.5, 0.45, 0.75);
    leaf.rotation.y = -angle;
    leaf.userData.wellVine = true;
  }
  object.position.set(14.6, 0, -16.6);
  tag(object, 'longjing-well');
  options.scene.add(object);
  return { id: 'longjing-well', object, interactionPosition: object.position.clone().add(new THREE.Vector3(2.1, 0, 1.6)) };
}

const ECHO_STORY_POINT_IDS = ['echo-stone-pile', 'echo-table', 'echo-cabin', 'echo-diary', 'echo-photo-wall', 'echo-cabin-door'] as const;

function addInvestigationMarker(
  object: THREE.Group,
  options: SceneInterestPointOptions,
  position: readonly [number, number, number] = [0, 1.28, 0],
): THREE.Mesh {
  const marker = addMesh(object, options, new THREE.ConeGeometry(0.2, 0.36, 4), { color: 0xf2c94c, emissive: 0x8a6500, emissiveIntensity: 0.5, roughness: 0.55 }, position);
  marker.rotation.z = Math.PI;
  marker.userData.investigationMarker = true;
  marker.userData.storyActivationVisual = true;
  marker.userData.storyInteractionTarget = true;
  marker.userData.markerBaseY = position[1];
  marker.visible = false;
  return marker;
}

function addStoryHitbox(
  object: THREE.Group,
  options: SceneInterestPointOptions,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
): THREE.Mesh {
  const hitbox = addMesh(object, options, new THREE.BoxGeometry(...size), { color: 0xffffff, transparent: true, opacity: 0.001, depthWrite: false }, position);
  hitbox.userData.storyActivationVisual = true;
  hitbox.userData.storyHitbox = true;
  hitbox.userData.storyInteractionTarget = true;
  hitbox.visible = false;
  return hitbox;
}

function createEchoStonePile(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  const rockMaterials = [
    { color: 0x858a86, roughness: 1 },
    { color: 0x9da19a, roughness: 0.98 },
    { color: 0xb4b5ad, roughness: 0.96 },
    { color: 0x737a78, roughness: 1 },
  ];
  // Five times the original 61 rocks, spread primarily along X while keeping
  // enough Z depth and height variation to read as a pile rather than a row.
  const layerCounts = [100, 80, 60, 40, 25];
  const rockGeometry = new THREE.DodecahedronGeometry(0.5, 1);
  let rockIndex = 0;
  layerCounts.forEach((count, layer) => {
    const ringRadiusX = 4.5 - layer * 0.55;
    const ringRadiusZ = 2.0 - layer * 0.25;
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + layer * 0.37;
      const jitter = 0.88 + ((index * 11 + layer * 7) % 7) * 0.035;
      const x = Math.cos(angle) * ringRadiusX * jitter;
      const z = Math.sin(angle) * ringRadiusZ * jitter;
      const y = 0.13 + layer * 0.22 + ((index * 5 + layer) % 4) * 0.035;
      const radius = 0.24 - layer * 0.018 + ((index * 3) % 5) * 0.018;
      const rock = addMesh(object, options, rockGeometry, rockMaterials[rockIndex % rockMaterials.length]!, [x, y, z]);
      rock.scale.set(radius * (1.15 + (index % 3) * 0.12), radius * (0.82 + (index % 4) * 0.1), radius * (0.92 + (index % 2) * 0.18));
      rock.rotation.set(index * 0.47, index * 0.83, layer * 0.29 + index * 0.17);
      rock.userData.stoneIndex = rockIndex;
      rockIndex += 1;
    }
  });
  const moss = { color: 0x627c5c, roughness: 1, emissive: 0x142116, emissiveIntensity: 0.04 };
  const mossPositions: readonly (readonly [number, number, number])[] = [
    [-0.76, 0.5, 0.18], [0.42, 0.72, -0.1], [0.05, 1.0, 0.12], [0.84, 0.32, -0.25], [-0.2, 0.32, -0.54],
  ];
  mossPositions.forEach(([x, y, z], index) => {
    const patch = addMesh(object, options, new THREE.SphereGeometry(0.16, 8, 6), moss, [x, y, z]);
    patch.scale.set(1.5, 0.18 + (index % 2) * 0.08, 0.9);
    patch.rotation.y = index * 0.8;
  });
  addStoryHitbox(object, options, [9.8, 2.2, 4.7], [0, 1.0, 0]);
  addInvestigationMarker(object, options, [0, 2.05, 0]);
  object.position.set(ECHO_OBSERVATORY_AREA.stonePile[0], 0, ECHO_OBSERVATORY_AREA.stonePile[1]);
  options.scene.add(object);
  return { id: 'echo-stone-pile', object, interactionPosition: object.position.clone().add(new THREE.Vector3(0, 0, -2.65)) };
}

function createEchoTable(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  const tableWood = { color: 0x76523b, roughness: 0.9, tex: 'wood', rx: 2, ry: 1 };
  const tableDark = { color: 0x4f3427, roughness: 0.95, tex: 'wood', rx: 1, ry: 2 };
  const brass = { color: 0xc59a52, roughness: 0.3, metalness: 0.75, tex: 'metal', rx: 1, ry: 1 };
  const ceramic = { color: 0xe8e4d8, roughness: 0.55, tex: 'stone', rx: 1, ry: 1 };
  const darkMetal = { color: 0x343d42, roughness: 0.5, metalness: 0.35, tex: 'metal', rx: 1, ry: 1 };
  // Thick top made from three boards, with an inset edge and a visible apron.
  [-0.39, 0, 0.39].forEach((x, index) => {
    const plank = addMesh(object, options, new THREE.BoxGeometry(0.76, 0.12, 1.18), options.materialFor({ ...tableWood, rx: index === 1 ? 1 : 2 }), [x, 0.88, 0]);
    plank.rotation.y = (index - 1) * 0.012;
  });
  addMesh(object, options, new THREE.BoxGeometry(2.48, 0.1, 0.1), options.materialFor(tableDark), [0, 0.79, -0.59]);
  addMesh(object, options, new THREE.BoxGeometry(2.48, 0.1, 0.1), options.materialFor(tableDark), [0, 0.79, 0.59]);
  addMesh(object, options, new THREE.BoxGeometry(2.2, 0.25, 0.1), options.materialFor(tableDark), [0, 0.58, -0.57]);
  const legPositions: readonly (readonly [number, number, number])[] = [[-0.92, 0.38, -0.43], [0.92, 0.38, -0.43], [-0.92, 0.38, 0.43], [0.92, 0.38, 0.43]];
  legPositions.forEach((position, index) => {
    const leg = addMesh(object, options, new THREE.BoxGeometry(0.17, 0.76, 0.17), options.materialFor(tableDark), position);
    leg.rotation.z = (index % 2 ? -1 : 1) * 0.025;
    addMesh(object, options, new THREE.BoxGeometry(0.26, 0.08, 0.26), options.materialFor(tableWood), [position[0], 0.03, position[2]]);
  });
  addMesh(object, options, new THREE.BoxGeometry(1.82, 0.11, 0.11), options.materialFor(tableDark), [0, 0.25, 0.43]);
  addMesh(object, options, new THREE.BoxGeometry(1.82, 0.11, 0.11), options.materialFor(tableDark), [0, 0.25, -0.43]);
  // Drawer, handle and corner joinery.
  addMesh(object, options, new THREE.BoxGeometry(0.82, 0.28, 0.08), options.materialFor(tableWood), [0, 0.64, -0.63]);
  addMesh(object, options, new THREE.BoxGeometry(0.18, 0.045, 0.05), options.materialFor(brass), [0, 0.65, -0.69]);
  [[-1.1, 0.83, -0.5], [1.1, 0.83, -0.5], [-1.1, 0.83, 0.5], [1.1, 0.83, 0.5]].forEach((position) => addMesh(object, options, new THREE.BoxGeometry(0.12, 0.08, 0.12), options.materialFor(brass), position as [number, number, number]));

  // Leftover dishes, chopsticks, a recorder and a small music box make the clue readable.
  addMesh(object, options, new THREE.CylinderGeometry(0.29, 0.25, 0.045, 24), options.materialFor(ceramic), [-0.53, 0.97, 0.08]);
  addMesh(object, options, new THREE.TorusGeometry(0.16, 0.035, 8, 18), options.materialFor(tableDark), [-0.53, 1.0, 0.08]);
  addMesh(object, options, new THREE.CylinderGeometry(0.2, 0.17, 0.13, 18), options.materialFor(ceramic), [0.16, 1.0, 0.12]);
  addMesh(object, options, new THREE.CylinderGeometry(0.15, 0.15, 0.025, 18), options.materialFor({ color: 0xa8b9c2, roughness: 0.35, metalness: 0.15 }), [0.16, 1.08, 0.12]);
  [-0.08, 0.02].forEach((x) => {
    const chopstick = addMesh(object, options, new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8), options.materialFor(tableDark), [x, 1.02, -0.32]);
    chopstick.rotation.x = Math.PI / 2;
    chopstick.rotation.z = x * 0.4;
  });
  addMesh(object, options, new THREE.BoxGeometry(0.48, 0.1, 0.26), options.materialFor(darkMetal), [0.55, 0.99, -0.27]);
  addMesh(object, options, new THREE.BoxGeometry(0.32, 0.025, 0.12), options.materialFor({ color: 0x9da9a5, roughness: 0.45, metalness: 0.2 }), [0.55, 1.055, -0.27]);
  [0.45, 0.58, 0.71].forEach((x) => addMesh(object, options, new THREE.SphereGeometry(0.025, 8, 6), options.materialFor(brass), [x, 1.07, -0.27]));
  addMesh(object, options, new THREE.BoxGeometry(0.44, 0.23, 0.34), options.materialFor(tableWood), [0.76, 1.08, 0.34]);
  addMesh(object, options, new THREE.BoxGeometry(0.3, 0.025, 0.23), options.materialFor(brass), [0.76, 1.205, 0.34]);
  addMesh(object, options, new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), options.materialFor(brass), [1.02, 1.1, 0.34]).rotation.z = Math.PI / 2;
  addMesh(object, options, new THREE.BoxGeometry(0.32, 0.04, 0.42), options.materialFor({ color: 0x8c6c54, roughness: 0.94, tex: 'fabric', rx: 1, ry: 1 }), [-0.92, 0.98, 0.25]);
  addStoryHitbox(object, options, [3.1, 1.55, 2.05], [0, 0.78, 0]);
  addInvestigationMarker(object, options, [0, 1.9, 0]);
  object.position.set(ECHO_OBSERVATORY_AREA.table[0], 0, ECHO_OBSERVATORY_AREA.table[1]);
  object.rotation.y = -Math.PI / 2;
  options.scene.add(object);
  const interactionPosition = new THREE.Vector3(-1.65, 0, 1.25)
    .applyEuler(object.rotation)
    .add(object.position);
  return { id: 'echo-table', object, interactionPosition };
}

function createEchoCabin(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  // Keep this marker at the scaled porch entrance so story navigation resolves
  // outside the cabin footprint.
  const entrance = new THREE.Vector3(
    ECHO_OBSERVATORY_AREA.home[0],
    0,
    ECHO_OBSERVATORY_AREA.home[1] + 5.65 * ECHO_OBSERVATORY_AREA.homeScale,
  );
  const ring = addMesh(object, options, new THREE.TorusGeometry(0.28, 0.055, 8, 20), { color: 0xf2c94c, emissive: 0x8a6500, emissiveIntensity: 0.5, roughness: 0.55 }, [0, 1.55, 0]);
  ring.rotation.x = Math.PI / 2;
  ring.userData.storyActivationVisual = true;
  ring.userData.storyInteractionTarget = true;
  ring.visible = false;
  addInvestigationMarker(object, options, [0, 1.96, 0]);
  addStoryHitbox(object, options, [1.2, 2.2, 1.2], [0, 1.1, 0]);
  object.position.copy(entrance);
  options.scene.add(object);
  return {
    id: 'echo-cabin',
    object,
    interactionPosition: new THREE.Vector3(ECHO_OBSERVATORY_AREA.home[0], 0, -0.8),
  };
}

function createEchoDiary(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  addMesh(object, options, new THREE.BoxGeometry(0.72, 0.12, 0.96), { color: 0x4d6484, roughness: 0.8 }, [0, 2.56, 0]);
  addMesh(object, options, new THREE.BoxGeometry(0.62, 0.025, 0.86), { color: 0xe9dfc7, roughness: 0.95 }, [0, 2.63, 0]);
  addInvestigationMarker(object, options, [0, 3.15, 0]);
  addStoryHitbox(object, options, [1.2, 1.2, 1.4], [0, 2.55, 0]);
  object.position.set(ECHO_OBSERVATORY_AREA.interior[0] + 2.2, 0, ECHO_OBSERVATORY_AREA.interior[1]);
  options.scene.add(object);
  return { id: 'echo-diary', object, interactionPosition: object.position.clone().add(new THREE.Vector3(0.65, 0, -0.4)) };
}

function createEchoPhotoWall(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  addStoryHitbox(object, options, [17.5, 6.2, 0.35], [0, 5.2, 0]);
  addInvestigationMarker(object, options, [0, 7.2, -0.3]);
  object.position.set(ECHO_OBSERVATORY_AREA.interior[0], 0, ECHO_OBSERVATORY_AREA.interior[1] + 10.4);
  options.scene.add(object);
  return { id: 'echo-photo-wall', object, interactionPosition: new THREE.Vector3(ECHO_OBSERVATORY_AREA.interior[0], 0, ECHO_OBSERVATORY_AREA.interior[1] + 7.4) };
}

function createEchoCabinDoor(options: SceneInterestPointOptions): SceneInterestPointEntity {
  const object = new THREE.Group();
  // This generous volume is also queried by the cabin's priority exit path.
  // Center it on the visible door plane and extend it into the room.
  addStoryHitbox(object, options, [4.8, 4.2, 1.6], [0, 2.0, 0]);
  addInvestigationMarker(object, options, [0, 4.0, 0]);
  object.position.set(ECHO_OBSERVATORY_AREA.interior[0], 0, ECHO_OBSERVATORY_AREA.interior[1] - 10.0);
  options.scene.add(object);
  return { id: 'echo-cabin-door', object, interactionPosition: object.position.clone().add(new THREE.Vector3(0, 0, 0.9)) };
}

export function createSceneInterestPoints(input: SceneInterestPointOptionsInput): SceneInterestPoints {
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const options: SceneInterestPointOptions = {
    ...input,
    materialFor(parameters) {
      const key = JSON.stringify(parameters);
      const existing = materialCache.get(key);
      if (existing) return existing;
      const material = input.makeMaterial(parameters);
      materialCache.set(key, material);
      return material;
    },
  };
  const westBeach = createWestBeach(options);
  const catCafeIceWall = createCatCafeIceWall(options);
  const list = [createCatCafeNote(options), catCafeIceWall, createOrangeTree(options), createLongjingWell(options), westBeach.entity, createEchoStonePile(options), createEchoTable(options), createEchoCabin(options), createEchoDiary(options), createEchoPhotoWall(options), createEchoCabinDoor(options)];
  const entities = new Map(list.map((entity) => [entity.id, entity]));
  const storyEntities = ECHO_STORY_POINT_IDS
    .map((id) => entities.get(id))
    .filter((entity): entity is SceneInterestPointEntity => Boolean(entity));
  const baseRaycastTargets = list
    .filter((entity) => !entity.object.userData.autoTrigger && !ECHO_STORY_POINT_IDS.includes(entity.id as (typeof ECHO_STORY_POINT_IDS)[number]))
    .map((entity) => entity.object);
  const storyRaycastTargets = storyEntities.map((entity) => {
    const targets: THREE.Object3D[] = [];
    entity.object.traverse((child) => { if (child.userData.storyInteractionTarget) targets.push(child); });
    return { entity, targets };
  });
  const raycastTargets: THREE.Object3D[] = [...baseRaycastTargets];
  const investigationMarkers: THREE.Mesh[] = [];
  storyEntities.forEach((entity) => entity.object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.userData.investigationMarker) return;
    child.userData.investigationMarkerIndex = investigationMarkers.length;
    investigationMarkers.push(child);
  }));
  const activeInvestigationMarkers: THREE.Mesh[] = [];
  const orangeTree = entities.get('origin-orange-tree')?.object;
  const orangeFruits: THREE.Mesh[] = [];
  orangeTree?.traverse((object) => {
    if (object instanceof THREE.Mesh && typeof object.userData.orangeFruitIndex === 'number') orangeFruits.push(object);
  });
  const well = entities.get('longjing-well')?.object;
  const vines: THREE.Mesh[] = [];
  well?.traverse((child) => { if (child instanceof THREE.Mesh && child.userData.wellVine) vines.push(child); });
  let wellPhase: 'idle' | 'focus' | 'engulf' | 'recede' = 'idle';
  let wellPhaseStarted = 0;
  let wellStaticDirty = true;

  return {
    entities,
    raycastTargets,
    obstacleRoots: [catCafeIceWall.object],
    update(elapsedSeconds) {
      westBeach.update(elapsedSeconds);
      for (const object of orangeFruits) {
        const index = object.userData.orangeFruitIndex as number;
        const baseY = object.userData.orangeFruitBaseY as number;
        object.position.y = baseY + Math.sin(elapsedSeconds * 1.4 + index) * 0.012;
      }
      const wellAnimating = wellPhase === 'engulf' || wellPhase === 'recede';
      if (well && (wellStaticDirty || wellAnimating)) {
        const duration = wellPhase === 'engulf' ? 2.8 : wellPhase === 'recede' ? 2.2 : 0;
        const t = duration ? Math.min(1, (elapsedSeconds - wellPhaseStarted) / duration) : 0;
        const amount = wellPhase === 'engulf' ? t : wellPhase === 'recede' ? 1 - t : 0;
        for (let index = 0; index < vines.length; index += 1) {
          const mesh = vines[index]!;
          mesh.scale.set(1.5 * (0.25 + amount * 0.75), 0.45 + amount * 0.55, 0.75 * (0.25 + amount * 0.75));
          mesh.position.y = 0.38 + amount * (0.38 + (index % 3) * 0.12);
          mesh.rotation.z = Math.sin(elapsedSeconds * 3 + index) * 0.12 * amount;
        }
        wellStaticDirty = false;
        if (wellPhase === 'recede' && t >= 1) wellPhase = 'idle';
      }
      for (let index = 0; index < activeInvestigationMarkers.length; index += 1) {
        const marker = activeInvestigationMarkers[index]!;
        const markerIndex = marker.userData.investigationMarkerIndex as number;
        const baseY = Number(marker.userData.markerBaseY) || marker.position.y;
        marker.position.y = baseY + Math.sin(elapsedSeconds * 2.2 + markerIndex * 0.7) * 0.06;
        marker.rotation.y = elapsedSeconds * 0.8 + markerIndex * 0.35;
      }
    },
    setWellPhase(phase) {
      wellPhase = phase;
      wellPhaseStarted = performance.now() / 1000;
      wellStaticDirty = true;
    },
    setBeachEncounterPhase(phase) { westBeach.setPhase(phase); },
    setActiveStoryPoints(ids) {
      const active = new Set(ids);
      activeInvestigationMarkers.length = 0;
      storyEntities.forEach((entity) => {
        const isActive = active.has(entity.id);
        entity.object.traverse((child) => {
          if (child.userData.storyActivationVisual) child.visible = isActive;
          if (isActive && child instanceof THREE.Mesh && child.userData.investigationMarker) {
            activeInvestigationMarkers.push(child);
          }
          if (child.userData.storyInteractionTarget) {
            if (isActive) child.userData.sceneInterestPointId = entity.id;
            else delete child.userData.sceneInterestPointId;
          }
        });
      });
      raycastTargets.length = 0;
      raycastTargets.push(
        ...baseRaycastTargets,
        ...storyRaycastTargets.filter(({ entity }) => active.has(entity.id)).flatMap(({ targets }) => targets),
      );
    },
    dispose() {
      materialCache.forEach((material) => material.dispose());
      materialCache.clear();
    },
  };
}

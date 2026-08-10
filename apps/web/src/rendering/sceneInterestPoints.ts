import * as THREE from 'three';
import type { SceneInterestPointId } from '../gameplay/world/sceneInteractions';

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
  update(elapsedSeconds: number): void;
  setWellPhase(phase: 'idle' | 'focus' | 'engulf' | 'recede'): void;
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
  material: Record<string, unknown>,
  position: readonly [number, number, number],
): THREE.Mesh {
  const mesh = options.makeMesh(geometry, options.materialFor(material));
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
  const list = [createCatCafeNote(options), createOrangeTree(options), createLongjingWell(options)];
  const entities = new Map(list.map((entity) => [entity.id, entity]));
  const orangeTree = entities.get('origin-orange-tree')?.object;
  const well = entities.get('longjing-well')?.object;
  const vines: THREE.Mesh[] = [];
  well?.traverse((child) => { if (child instanceof THREE.Mesh && child.userData.wellVine) vines.push(child); });
  let wellPhase: 'idle' | 'focus' | 'engulf' | 'recede' = 'idle';
  let wellPhaseStarted = 0;

  return {
    entities,
    raycastTargets: list.map((entity) => entity.object),
    update(elapsedSeconds) {
      orangeTree?.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || typeof object.userData.orangeFruitIndex !== 'number') return;
        const index = object.userData.orangeFruitIndex as number;
        const baseY = object.userData.orangeFruitBaseY as number;
        object.position.y = baseY + Math.sin(elapsedSeconds * 1.4 + index) * 0.012;
      });
      if (well) {
        const duration = wellPhase === 'engulf' ? 2.8 : wellPhase === 'recede' ? 2.2 : 0;
        const t = duration ? Math.min(1, (elapsedSeconds - wellPhaseStarted) / duration) : 0;
        const amount = wellPhase === 'engulf' ? t : wellPhase === 'recede' ? 1 - t : 0;
        vines.forEach((mesh, index) => {
          mesh.scale.set(1.5 * (0.25 + amount * 0.75), 0.45 + amount * 0.55, 0.75 * (0.25 + amount * 0.75));
          mesh.position.y = 0.38 + amount * (0.38 + (index % 3) * 0.12);
          mesh.rotation.z = Math.sin(elapsedSeconds * 3 + index) * 0.12 * amount;
        });
      }
    },
    setWellPhase(phase) { wellPhase = phase; wellPhaseStarted = performance.now() / 1000; },
    dispose() {
      materialCache.forEach((material) => material.dispose());
      materialCache.clear();
    },
  };
}

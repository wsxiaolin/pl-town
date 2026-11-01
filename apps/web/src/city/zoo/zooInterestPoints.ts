import * as THREE from 'three';
import { ZOO_AREA } from '../data/cityConfig';
import { ZOO_POINT_IDS } from '../../gameplay/content/stories/zoo/zooMeta';
import type { SceneInterestPointEntity, SceneInterestPointOptions } from '../../rendering/sceneInterestPoints';

export interface ZooInterestPointsResult {
  entities: readonly SceneInterestPointEntity[];
  update: (elapsedSeconds: number) => void;
  dispose: () => void;
}

type Coord = readonly [number, number];

function tag(object: THREE.Object3D, id: string): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) child.userData.sceneInterestPointId = id;
  });
}

function addMesh(
  object: THREE.Object3D,
  options: SceneInterestPointOptions,
  geometry: THREE.BufferGeometry,
  color: number | Record<string, unknown>,
  position: readonly [number, number, number],
): THREE.Mesh {
  const material = typeof color === 'number'
    ? options.materialFor({ color, roughness: 0.86 })
    : options.materialFor(color);
  const mesh = options.makeMesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  object.add(mesh);
  return mesh;
}

function addMarker(object: THREE.Object3D, options: SceneInterestPointOptions, y: number): THREE.Mesh {
  const marker = addMesh(
    object,
    options,
    new THREE.ConeGeometry(0.2, 0.36, 4),
    0xf2c94c,
    [0, y, 0],
  );
  marker.material = options.materialFor({ color: 0xf2c94c, emissive: 0x8a6500, emissiveIntensity: 0.5, roughness: 0.55 });
  marker.rotation.x = Math.PI;
  marker.visible = false;
  marker.userData.investigationMarker = true;
  marker.userData.storyActivationVisual = true;
  marker.userData.markerBaseY = y;
  return marker;
}

function addHitbox(
  object: THREE.Object3D,
  options: SceneInterestPointOptions,
  size: readonly [number, number, number],
  y: number,
): void {
  const hitbox = options.makeMesh(
    new THREE.BoxGeometry(...size),
    options.materialFor({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  hitbox.position.set(0, y, 0);
  hitbox.visible = false;
  hitbox.userData.storyActivationVisual = true;
  hitbox.userData.storyInteractionTarget = true;
  object.add(hitbox);
}

function createPoint(
  options: SceneInterestPointOptions,
  id: string,
  coord: Coord,
  hitbox: readonly [number, number, number],
  markerY: number,
  build: (object: THREE.Object3D) => void,
  offset: Coord = [0, 0],
): SceneInterestPointEntity {
  const object = new THREE.Group();
  build(object);
  addHitbox(object, options, hitbox, Math.min(markerY * 0.62, 1.5));
  addMarker(object, options, markerY);
  object.position.set(coord[0], 0, coord[1]);
  tag(object, id);
  options.scene.add(object);
  return {
    id: id as SceneInterestPointEntity['id'],
    object,
    interactionPosition: new THREE.Vector3(coord[0] + offset[0], 0, coord[1] + offset[1]),
  };
}

function createPigeonHouse(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.pigeon, ZOO_AREA.pigeon, [2.6, 2.4, 2.6], 2.7, (object) => {
    addMesh(object, options, new THREE.CylinderGeometry(1.1, 1.2, 0.18, 12), 0x8c8370, [0, 0.09, 0]);
    addMesh(object, options, new THREE.BoxGeometry(1.5, 1.7, 1.4), 0xc6b089, [0, 0.95, 0]);
    addMesh(object, options, new THREE.ConeGeometry(1.12, 0.85, 4), 0x7a5b45, [0, 2.15, 0]);
    const roof = object.children[object.children.length - 1] as THREE.Mesh;
    roof.rotation.y = Math.PI / 4;
    for (let index = 0; index < 4; index += 1) {
      const row = Math.floor(index / 2);
      const column = index % 2;
      addMesh(object, options, new THREE.BoxGeometry(0.3, 0.3, 0.06), 0x3d3a32, [column ? 0.32 : -0.32, 1.38 - row * 0.42, 0.71]);
    }
    addMesh(object, options, new THREE.CylinderGeometry(0.035, 0.05, 0.9, 8), 0x6b5642, [1.15, 0.45, 0.35]);
    addMesh(object, options, new THREE.BoxGeometry(0.5, 0.04, 0.22), 0xe2d7ba, [1.15, 0.92, 0.35]);
    addMesh(object, options, new THREE.SphereGeometry(0.12, 8, 6), 0xdedbd0, [0.75, 1.86, 0.25]);
  }, [0, -1.5]);
}

function createCatPavilion(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.cat, ZOO_AREA.cat, [2.4, 2.2, 2.4], 2.2, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(2, 0.2, 1.6), 0x9a8f78, [0, 0.1, 0]);
    ([[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]] as const).forEach(([x, z]) => {
      addMesh(object, options, new THREE.CylinderGeometry(0.07, 0.09, 1.5, 8), 0x6e5941, [x, 0.85, z]);
    });
    addMesh(object, options, new THREE.BoxGeometry(2.2, 0.14, 1.8), 0x82674c, [0, 1.65, 0]);
    addMesh(object, options, new THREE.ConeGeometry(1.35, 0.7, 4), 0x5e6f54, [0, 1.98, 0]).rotation.y = Math.PI / 4;
    addMesh(object, options, new THREE.CylinderGeometry(0.48, 0.5, 0.16, 16), 0x9c6f58, [0.25, 0.28, 0.1]);
    addMesh(object, options, new THREE.SphereGeometry(0.24, 10, 8), 0xcfb296, [0.25, 0.42, 0.1]).scale.set(1.35, 0.7, 1);
    addMesh(object, options, new THREE.BoxGeometry(0.36, 0.03, 0.48), 0xf0e4cc, [0.25, 1.72, 0.2]);
  }, [0, -1.5]);
}

function createMonkeyStreet(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.monkey, ZOO_AREA.monkey, [2.6, 2.8, 2.4], 2.9, (object) => {
    ([[-1, 0], [1, 0]] as const).forEach(([x]) => {
      addMesh(object, options, new THREE.BoxGeometry(0.24, 2.25, 0.24), 0x8a5f3c, [x, 1.12, 0]);
      addMesh(object, options, new THREE.BoxGeometry(0.42, 0.16, 0.42), 0x6d4a2f, [x, 0.08, 0]);
    });
    addMesh(object, options, new THREE.BoxGeometry(2.4, 0.3, 0.28), 0x9d6c43, [0, 2.18, 0]);
    addMesh(object, options, new THREE.BoxGeometry(1.4, 0.9, 0.08), 0xb9c6c0, [0, 1.2, 0.12]);
    addMesh(object, options, new THREE.BoxGeometry(1.1, 0.62, 0.02), 0x8aa4a0, [0, 1.2, 0.17]);
    addMesh(object, options, new THREE.BoxGeometry(0.75, 0.26, 0.05), 0xe7dfc9, [0, 1.75, 0.14]);
    addMesh(object, options, new THREE.CylinderGeometry(0.03, 0.04, 0.55, 6), 0x6b5642, [1.12, 0.3, 0.15]);
    addMesh(object, options, new THREE.BoxGeometry(0.34, 0.2, 0.03), 0xe7dfc9, [1.12, 0.6, 0.15]);
  }, [0, -1.4]);
}

function createBeastStall(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.beast, ZOO_AREA.beast, [2.4, 2.2, 2.4], 2.3, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(2, 0.7, 1.2), 0x9b875e, [0, 0.35, 0]);
    addMesh(object, options, new THREE.BoxGeometry(2.2, 0.12, 1.4), 0x6b5b40, [0, 0.76, 0]);
    addMesh(object, options, new THREE.BoxGeometry(1.4, 0.08, 0.8), 0xd6bf7f, [0, 0.84, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.8, 0.45, 0.06), 0x3b3a33, [0.6, 1.55, 0.06]);
    addMesh(object, options, new THREE.BoxGeometry(0.26, 0.17, 0.04), 0xd8c25e, [0.43, 1.55, 0.1]);
    addMesh(object, options, new THREE.BoxGeometry(0.26, 0.17, 0.04), 0xd8c25e, [0.78, 1.55, 0.1]);
    addMesh(object, options, new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6), 0x6b5642, [-0.95, 1.1, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.42, 0.25, 0.03), 0xe7dfc9, [-0.95, 1.6, 0]);
  }, [0, -1.5]);
}

function createWaterfowlPond(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.waterfowl, ZOO_AREA.waterfowl, [3.2, 1.2, 3.2], 1.25, (object) => {
    addMesh(object, options, new THREE.CylinderGeometry(1.65, 1.75, 0.18, 24), 0x9c9a8a, [0, 0.09, 0]);
    addMesh(object, options, new THREE.CircleGeometry(1.45, 24), { color: 0x4d7f86, roughness: 0.25, metalness: 0.12 }, [0, 0.19, 0]).rotation.x = -Math.PI / 2;
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      addMesh(object, options, new THREE.CylinderGeometry(0.025, 0.04, 0.65, 5), 0x5b7a45, [Math.cos(angle) * 1.35, 0.4, Math.sin(angle) * 1.35]);
    }
    const lamp = addMesh(object, options, new THREE.BoxGeometry(0.18, 0.26, 0.18), { color: 0xe8c96a, emissive: 0x8a6500, emissiveIntensity: 0.45, roughness: 0.5 }, [0.75, 0.32, -0.4]);
    lamp.userData.zooReflectionLamp = true;
    addMesh(object, options, new THREE.BoxGeometry(0.3, 0.12, 0.3), 0x6b5b40, [0.75, 0.2, -0.4]);
  }, [0, -2.1]);
}

function createMuseumWall(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.museum, ZOO_AREA.museum, [4.2, 3.2, 2.2], 3.2, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(3.8, 2.5, 0.5), 0x6f6a5e, [0, 1.5, 0]);
    addMesh(object, options, new THREE.BoxGeometry(3.2, 1.7, 0.08), { color: 0x3f6a72, roughness: 0.2, metalness: 0.25, transparent: true, opacity: 0.85 }, [0, 1.55, 0.3]);
    for (let index = 0; index < 5; index += 1) {
      addMesh(object, options, new THREE.BoxGeometry(2.9, 0.02, 0.02), 0x9cc4c6, [0, 0.85 + index * 0.32, 0.36]);
    }
    addMesh(object, options, new THREE.BoxGeometry(1.15, 0.36, 0.08), 0xe7dfc9, [0, 0.28, 0.34]);
    addMesh(object, options, new THREE.BoxGeometry(0.9, 0.04, 0.04), 0x6b5642, [0, 0.28, 0.4]);
    addMesh(object, options, new THREE.BoxGeometry(0.26, 0.34, 0.06), 0xcbaa62, [-3.1, 0.35, 0.3]);
    addMesh(object, options, new THREE.BoxGeometry(0.22, 0.3, 0.05), 0xcbaa62, [3.1, 0.35, 0.3]);
  }, [0, -2.4]);
}

function createOfficeWindow(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.office, ZOO_AREA.office, [2, 2.4, 1.6], 2.4, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(1.5, 1.9, 1.1), 0x8d7c60, [0, 0.95, 0]);
    const window = addMesh(object, options, new THREE.BoxGeometry(0.85, 0.68, 0.06), { color: 0xf2d58a, emissive: 0xc79a3f, emissiveIntensity: 0.55, roughness: 0.4 }, [0, 1.18, 0.58]);
    window.userData.zooOfficeWindow = true;
    addMesh(object, options, new THREE.BoxGeometry(0.95, 0.08, 0.12), 0x5f4f3b, [0, 0.82, 0.6]);
    addMesh(object, options, new THREE.BoxGeometry(1.75, 0.16, 1.3), 0x6b5b40, [0, 1.95, 0]);
  }, [0, 1.35]);
}

function createStand(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.stand, ZOO_AREA.stand, [1.5, 1.3, 1.2], 1.45, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(1.2, 0.12, 0.7), 0x8b6844, [0, 0.85, 0]);
    addMesh(object, options, new THREE.BoxGeometry(1.05, 0.7, 0.55), 0x71563a, [0, 0.45, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.34, 0.09, 0.45), 0xe7dfc9, [-0.18, 0.96, 0.02]).rotation.z = -0.08;
    addMesh(object, options, new THREE.BoxGeometry(0.3, 0.07, 0.4), 0xd8ceb4, [0.2, 0.94, 0.04]).rotation.z = 0.1;
  }, [0, -0.95]);
}

function createSignIn(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.signin, ZOO_AREA.signin, [1.1, 1.3, 1.1], 1.45, (object) => {
    addMesh(object, options, new THREE.CylinderGeometry(0.08, 0.12, 0.9, 8), 0x6b5642, [0, 0.45, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.8, 0.06, 0.55), 0x8b6844, [0, 0.95, 0]).rotation.x = 0.22;
    addMesh(object, options, new THREE.BoxGeometry(0.64, 0.03, 0.42), 0xf0e8d5, [0, 1.0, 0.03]).rotation.x = 0.22;
    addMesh(object, options, new THREE.BoxGeometry(0.18, 0.02, 0.02), 0x4b4b46, [0.12, 1.02, -0.08]).rotation.x = 0.22;
  }, [0, -0.9]);
}

function createBorrowNote(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.borrowNote, ZOO_AREA.borrowNote, [1.2, 1.4, 0.8], 1.55, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(0.9, 1.05, 0.08), 0x6d5035, [0, 0.85, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.72, 0.78, 0.02), 0xf2ead6, [0, 0.87, 0.06]);
    addMesh(object, options, new THREE.BoxGeometry(0.5, 0.02, 0.02), 0x7a6a50, [0, 0.98, 0.08]);
    addMesh(object, options, new THREE.BoxGeometry(0.44, 0.02, 0.02), 0x7a6a50, [0, 0.87, 0.08]);
    addMesh(object, options, new THREE.BoxGeometry(0.38, 0.02, 0.02), 0x7a6a50, [0, 0.76, 0.08]);
    addMesh(object, options, new THREE.BoxGeometry(0.1, 1.2, 0.1), 0x5e4a33, [-0.55, 0.6, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.1, 1.2, 0.1), 0x5e4a33, [0.55, 0.6, 0]);
  }, [0, -0.7]);
}

function createDoorplate(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.doorplate, ZOO_AREA.doorplate, [1.4, 1.4, 0.7], 1.7, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(0.12, 1.2, 0.12), 0x5e4a33, [-0.45, 0.6, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.12, 1.2, 0.12), 0x5e4a33, [0.45, 0.6, 0]);
    addMesh(object, options, new THREE.BoxGeometry(1.15, 0.5, 0.1), 0x6d5035, [0, 1.05, 0]);
    addMesh(object, options, new THREE.BoxGeometry(1.0, 0.34, 0.02), 0xd9cba8, [0, 1.05, 0.07]);
  }, [0, -0.6]);
}

function createPhoneBooth(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.phone, ZOO_AREA.phone, [1.3, 2.2, 1.3], 2.3, (object) => {
    addMesh(object, options, new THREE.BoxGeometry(1, 1.8, 0.9), 0xd7a72f, [0, 0.9, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.76, 1.15, 0.03), 0xb9d2cf, [0, 1.03, 0.47]);
    addMesh(object, options, new THREE.BoxGeometry(1.1, 0.12, 1), 0xb98524, [0, 1.86, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.42, 0.32, 0.2), 0x3f3f3a, [0, 1.18, -0.1]);
    addMesh(object, options, new THREE.CylinderGeometry(0.03, 0.03, 0.25, 6), 0x2f2f2b, [0.28, 1.18, -0.12]).rotation.z = Math.PI / 2;
  }, [0, -1.15]);
}

function createProxySign(options: SceneInterestPointOptions): SceneInterestPointEntity {
  return createPoint(options, ZOO_POINT_IDS.proxySign, ZOO_AREA.proxySign, [1, 1.2, 0.8], 1.35, (object) => {
    addMesh(object, options, new THREE.CylinderGeometry(0.04, 0.05, 1, 8), 0x6b5642, [0, 0.5, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.72, 0.34, 0.05), 0xe7dfc9, [0, 0.92, 0]);
    addMesh(object, options, new THREE.BoxGeometry(0.56, 0.04, 0.02), 0x6f6755, [0, 0.96, 0.04]);
    addMesh(object, options, new THREE.BoxGeometry(0.44, 0.04, 0.02), 0x6f6755, [0, 0.86, 0.04]);
  }, [0, -0.65]);
}

export function createZooInterestPoints(options: SceneInterestPointOptions): ZooInterestPointsResult {
  const entities = [
    createPigeonHouse(options),
    createCatPavilion(options),
    createMonkeyStreet(options),
    createBeastStall(options),
    createWaterfowlPond(options),
    createMuseumWall(options),
    createOfficeWindow(options),
    createStand(options),
    createSignIn(options),
    createBorrowNote(options),
    createDoorplate(options),
    createPhoneBooth(options),
    createProxySign(options),
  ];

  const reflectionLamp = entities[4]!.object.children.find((child) => child.userData.zooReflectionLamp) as THREE.Mesh | undefined;
  const officeWindow = entities[6]!.object.children.find((child) => child.userData.zooOfficeWindow) as THREE.Mesh | undefined;

  return {
    entities,
    update(elapsedSeconds) {
      if (reflectionLamp) {
        reflectionLamp.position.y = 0.32 + Math.sin(elapsedSeconds * 1.2) * 0.03;
      }
      if (officeWindow) {
        const material = officeWindow.material as THREE.MeshStandardMaterial;
        material.emissiveIntensity = 0.45 + Math.sin(elapsedSeconds * 0.8) * 0.08;
      }
    },
    dispose() {
      entities.forEach((entity) => {
        entity.object.parent?.remove(entity.object);
      });
    },
  };
}

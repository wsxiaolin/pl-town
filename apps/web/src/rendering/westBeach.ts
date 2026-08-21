import * as THREE from 'three';
import type { SceneInterestPointEntity } from './sceneInterestPoints';
import { WEST_BEACH } from '../city/data/cityConfig';

type BeachOptions = {
  scene: THREE.Scene;
  materialFor: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  getWaterRendering?: () => boolean;
};

export const WEST_BEACH_EVENT_POSITION = new THREE.Vector3(-39.2, 0, 11.5);

function addMesh(
  group: THREE.Group,
  options: BeachOptions,
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

function createWarship(options: BeachOptions, color: number, scale: number): THREE.Group {
  const ship = new THREE.Group();
  const hull = addMesh(ship, options, new THREE.BoxGeometry(2.4, 0.22, 0.58), { color, roughness: 0.62, tex: 'metal', rx: 3, ry: 1 }, [0, 0.22, 0]);
  hull.scale.x = scale;
  const bow = addMesh(ship, options, new THREE.ConeGeometry(0.34, 0.72, 4), { color, roughness: 0.62, tex: 'metal', rx: 1, ry: 1 }, [1.48 * scale, 0.22, 0]);
  bow.rotation.z = -Math.PI / 2;
  bow.scale.z = 0.85;
  addMesh(ship, options, new THREE.BoxGeometry(0.86, 0.27, 0.38), { color: 0xb9c0c4, roughness: 0.55, tex: 'metal', rx: 1, ry: 1 }, [-0.05, 0.45, 0]);
  addMesh(ship, options, new THREE.BoxGeometry(0.16, 0.55, 0.16), { color: 0x545b61, roughness: 0.52, tex: 'metal', rx: 1, ry: 1 }, [-0.22, 0.78, 0]);
  [-0.72, 0.72].forEach((x) => {
    addMesh(ship, options, new THREE.CylinderGeometry(0.17, 0.19, 0.16, 10), { color: 0x656c72, roughness: 0.58, tex: 'metal', rx: 1, ry: 1 }, [x, 0.45, 0]);
    const barrel = addMesh(ship, options, new THREE.CylinderGeometry(0.025, 0.025, 0.58, 7), { color: 0x41474c, roughness: 0.5, tex: 'metal', rx: 1, ry: 2 }, [x + 0.28, 0.49, 0]);
    barrel.rotation.z = Math.PI / 2;
  });
  return ship;
}

function createSeagull(options: BeachOptions): THREE.Group {
  const bird = new THREE.Group();
  [-1, 1].forEach((side) => {
    const wing = addMesh(bird, options, new THREE.BoxGeometry(0.34, 0.025, 0.08), { color: 0xf8f7f2, roughness: 0.8 }, [side * 0.15, 0, 0]);
    wing.rotation.z = side * 0.34;
  });
  return bird;
}

function createSeaGod(options: BeachOptions): THREE.Group {
  const god = new THREE.Group();
  god.name = 'yihang-sea-god';
  addMesh(god, options, new THREE.CylinderGeometry(0.18, 0.23, 0.62, 12), { color: 0x2f78a8, roughness: 0.62 }, [0, 0.34, 0]);
  addMesh(god, options, new THREE.SphereGeometry(0.21, 16, 14), { color: 0x62acd0, roughness: 0.58 }, [0, 0.82, 0]);
  addMesh(god, options, new THREE.ConeGeometry(0.25, 0.28, 8), { color: 0x24658e, roughness: 0.7 }, [0, 1.1, 0]);
  const staff = addMesh(god, options, new THREE.CylinderGeometry(0.025, 0.025, 1.35, 8), { color: 0xd9b75f, roughness: 0.45, metalness: 0.4, tex: 'metal', rx: 1, ry: 2 }, [0.34, 0.66, 0]);
  staff.rotation.z = -0.08;
  [-0.12, 0, 0.12].forEach((x) => {
    const tine = addMesh(god, options, new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), { color: 0xd9b75f, roughness: 0.45, metalness: 0.4, tex: 'metal', rx: 1, ry: 1 }, [0.34 + x, 1.34, 0]);
    tine.rotation.z = x * -1.5;
  });
  god.visible = false;
  return god;
}

export function createWestBeach(options: BeachOptions): {
  entity: SceneInterestPointEntity;
  update(elapsedSeconds: number): void;
  setPhase(phase: 'hidden' | 'revealed' | 'reward'): void;
} {
  const object = new THREE.Group();
  object.name = 'west-beach';
  object.userData.autoTrigger = true;

  const sand = addMesh(object, options, new THREE.PlaneGeometry(9, 58), { color: 0xe6ce96, roughness: 0.98, tex: 'ground', rx: 4, ry: 18 }, [-39.4, 0.07, 10]);
  sand.rotation.x = -Math.PI / 2;
  sand.renderOrder = 4;
  const waterWidth = 106;
  const waterLength = 180;
  const waterGeometry = new THREE.PlaneGeometry(waterWidth, waterLength, 42, 56);
  const waterBase = options.materialFor({ color: 0x2f789b, roughness: 0.2, metalness: 0.16, tex: 'water', rx: 32, ry: 42 });
  const waterMaterial = options.getWaterRendering?.()
    ? new THREE.MeshPhysicalMaterial({ color: 0x2f789b, roughness: 0.12, metalness: 0.22, clearcoat: 0.78, clearcoatRoughness: 0.08, reflectivity: 0.9, map: waterBase.map })
    : waterBase;
  const water = addMesh(object, options, waterGeometry, waterMaterial, [WEST_BEACH.coastlineX-waterWidth/2, -0.02, 10]);
  water.rotation.x = -Math.PI / 2;
  waterGeometry.computeVertexNormals();
  water.castShadow = false;
  water.renderOrder = 3;
  const coastLine = addMesh(object, options, new THREE.TubeGeometry(new THREE.LineCurve3(
    new THREE.Vector3(WEST_BEACH.coastlineX + 0.03, 0.095, -waterLength / 2 + 10),
    new THREE.Vector3(WEST_BEACH.coastlineX + 0.03, 0.095, waterLength / 2 + 10),
  ), 48, 0.06, 5, false), { color: 0xf3e9d4, roughness: 0.42, transparent: true, opacity: 0.92, depthWrite: false }, [0, 0, 0]);
  coastLine.castShadow = false;
  coastLine.renderOrder = 5;
  const foams: THREE.Mesh[] = [];
  for (let index = 0; index < 4; index += 1) {
    const foam = addMesh(object, options, new THREE.TubeGeometry(new THREE.LineCurve3(
      new THREE.Vector3(WEST_BEACH.coastlineX - 0.55 - index * 0.72, 0.10, -waterLength / 2 + 10),
      new THREE.Vector3(WEST_BEACH.coastlineX - 0.55 - index * 0.72, 0.10, waterLength / 2 + 10),
    ), 48, 0.045, 5, false), { color: 0xe9f3ef, roughness: 0.42, transparent: true, opacity: 0.64, depthWrite: false }, [0, 0, 0]);
    foam.userData.foamIndex = index;
    foams.push(foam);
  }
  const palms = [-1, 1].map((side) => {
    const palm = new THREE.Group();
    addMesh(palm, options, new THREE.CylinderGeometry(0.09, 0.14, 1.8, 9), { color: 0x765139, roughness: 0.9, tex: 'wood', rx: 1, ry: 2 }, [0, 0.9, 0]);
    for (let leaf = 0; leaf < 6; leaf += 1) {
      const frond = addMesh(palm, options, new THREE.BoxGeometry(0.75, 0.035, 0.16), { color: 0x4f843f, roughness: 0.92, tex: 'grass', rx: 2, ry: 1 }, [Math.cos(leaf) * 0.3, 1.78, Math.sin(leaf) * 0.3]);
      frond.rotation.y = leaf * Math.PI / 3;
      frond.rotation.z = 0.28;
    }
    palm.position.set(-38.4, 0, 2 + side * 8.5);
    object.add(palm);
    return palm;
  });
  void palms;

  const bismarck = createWarship(options, 0x5d666b, 1.05);
  bismarck.name = 'bismarck-model';
  bismarck.position.set(-61, 0.18, -4);
  bismarck.rotation.y = Math.PI / 2;
  object.add(bismarck);
  const hipper = createWarship(options, 0x788086, 0.78);
  hipper.name = 'hipper-model';
  hipper.position.set(-55, 0.16, 25);
  hipper.rotation.y = Math.PI / 2;
  object.add(hipper);

  const seagulls = [0, 1, 2].map((index) => {
    const bird = createSeagull(options);
    bird.position.set(-49 - index * 2.2, 3.1 + index * 0.4, -2 + index * 10);
    object.add(bird);
    return bird;
  });
  const seaGod = createSeaGod(options);
  seaGod.position.set(-41.2, 0, 11.5);
  object.add(seaGod);
  const rewardCard = addMesh(object, options, new THREE.BoxGeometry(0.44, 0.58, 0.045), { color: 0x445466, roughness: 0.45, metalness: 0.15, tex: 'metal', rx: 1, ry: 1 }, [-40.65, 1.05, 11.5]);
  rewardCard.visible = false;
  const cardStripe = addMesh(object, options, new THREE.BoxGeometry(0.35, 0.07, 0.052), { color: 0xe0c06b, roughness: 0.48, metalness: 0.25 }, [-40.65, 1.18, 11.5]);
  cardStripe.visible = false;
  options.scene.add(object);

  return {
    entity: { id: 'west-beach', object, interactionPosition: WEST_BEACH_EVENT_POSITION.clone() },
    update(elapsedSeconds) {
      bismarck.position.z = -4 + Math.sin(elapsedSeconds * 0.16) * 12;
      hipper.position.z = 25 - Math.sin(elapsedSeconds * 0.13) * 9;
      for (let index = 0; index < seagulls.length; index += 1) {
        const bird = seagulls[index]!;
        bird.position.x = -53 + Math.sin(elapsedSeconds * 0.35 + index * 2.1) * 7;
        bird.position.z = 10 + Math.cos(elapsedSeconds * 0.3 + index * 2.1) * 25;
        bird.rotation.y = elapsedSeconds * 0.25 + index;
      }
      for (const foam of foams) {
        const index = foam.userData.foamIndex as number;
        foam.position.x = Math.sin(elapsedSeconds * 0.8 + index) * 0.14;
        foam.position.z = Math.cos(elapsedSeconds * 0.36 + index) * 0.55;
      }
      const position = water.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let index = 0; index < position.count; index += 1) {
        const x = position.getX(index);
        const z = position.getZ(index);
        position.setY(index, Math.sin(elapsedSeconds * 1.25 + x * 0.17 + z * 0.11) * 0.06 + Math.sin(elapsedSeconds * 2.1 + z * 0.23) * 0.025);
      }
      position.needsUpdate = true;
      water.geometry.computeVertexNormals();
      if (water.material instanceof THREE.MeshPhysicalMaterial) {
        water.material.clearcoat = 0.72 + Math.sin(elapsedSeconds * 0.8) * 0.08;
        water.material.needsUpdate = true;
      }
      if (seaGod.visible) seaGod.position.y = Math.sin(elapsedSeconds * 2.1) * 0.035;
      if (rewardCard.visible) {
        rewardCard.rotation.y = elapsedSeconds * 0.8;
        cardStripe.rotation.y = rewardCard.rotation.y;
      }
    },
    setPhase(phase) {
      seaGod.visible = phase !== 'hidden';
      rewardCard.visible = phase === 'reward';
      cardStripe.visible = phase === 'reward';
    },
  };
}

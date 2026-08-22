import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import type { SceneInterestPointEntity } from './sceneInterestPoints';
import { WEST_BEACH } from '../city/data/cityConfig';
import waterNormalsUrl from '../assets/textures/waternormals.jpg';

const DAY_WATER_COLOR = new THREE.Color(0x0d3b5e);
const NIGHT_WATER_COLOR = new THREE.Color(0x061a2c);
const DAY_SUN_COLOR = new THREE.Color(0xbdd4e6);
const NIGHT_SUN_COLOR = new THREE.Color(0x3a4a6a);
const SUN_DIRECTION = new THREE.Vector3(0.5, 0.8, 0.35).normalize();

type BeachOptions = {
  scene: THREE.Scene;
  materialFor: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  waterRendering: boolean;
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

function shorelineX(z: number): number {
  // Amplitude stays below the gap between coastlineX and deepWaterX so the
  // walkable-sand / deep-water gameplay bounds still match the visible shore.
  return WEST_BEACH.coastlineX + Math.sin(z * 0.19) * 0.85 + Math.sin(z * 0.47 + 1.4) * 0.35;
}

function createShoreRibbonGeometry(
  innerX: (z: number) => number,
  outerX: (z: number) => number,
  minZ: number,
  maxZ: number,
  columns = 18,
  rows = 72,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const z = minZ + (maxZ - minZ) * row / rows;
    for (let column = 0; column <= columns; column += 1) {
      const t = column / columns;
      positions.push(THREE.MathUtils.lerp(innerX(z), outerX(z), t), 0, z);
      uvs.push(t, row / rows);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, d, a, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createAnimatedWater(geometry: THREE.BufferGeometry): Water {
  const waterNormals = new THREE.TextureLoader().load(waterNormalsUrl);
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
  const water = new Water(geometry, {
    waterNormals,
    sunDirection: SUN_DIRECTION.clone(),
    sunColor: DAY_SUN_COLOR.clone(),
    waterColor: DAY_WATER_COLOR.clone(),
    distortionScale: 3.7,
    side: THREE.DoubleSide,
    fog: false,
  });
  water.renderOrder = 3;
  water.castShadow = false;
  const material = water.material as THREE.ShaderMaterial;
  // The stock Water shader reflects the sky almost entirely (rf0 = 0.3, 0.9
  // reflection weight), which washes the sea white. Real water has a fresnel
  // base near 0.02, so lower both to let the deep water color dominate.
  material.fragmentShader = material.fragmentShader
    .replace('float rf0 = 0.3;', 'float rf0 = 0.02;')
    .replace(
      'vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight',
      'vec3( 0.08 ) + reflectionSample * 0.45 + reflectionSample * specularLight',
    );
  material.needsUpdate = true;
  water.userData.dynamicMaterial = material;
  return water;
}

export function createWestBeach(options: BeachOptions): {
  entity: SceneInterestPointEntity;
  update(elapsedSeconds: number): void;
  setPhase(phase: 'hidden' | 'revealed' | 'reward'): void;
  setDaylight(daylight: number, instant?: boolean): void;
} {
  const object = new THREE.Group();
  object.name = 'west-beach';
  object.userData.autoTrigger = true;

  const minZ = WEST_BEACH.minZ - 14;
  const maxZ = WEST_BEACH.maxZ + 14;
  const sand = addMesh(object, options, createShoreRibbonGeometry(shorelineX, (z) => shorelineX(z) + 10, minZ, maxZ, 8, 96), { color: 0xe6ce96, roughness: 0.98, tex: 'ground', rx: 4, ry: 18 }, [0, 0.07, 0]);
  sand.renderOrder = 4;
  // The sea must sit above the city base ground plane (y = 0) or it is hidden
  // underneath it, and it spans past the ground edge so no land shows beyond.
  const waterMinZ = -112;
  const waterMaxZ = 112;
  const waterGeometry = createShoreRibbonGeometry((z) => shorelineX(z) - 96, shorelineX, waterMinZ, waterMaxZ, options.waterRendering ? 64 : 12, options.waterRendering ? 220 : 96);
  const water = options.waterRendering
    ? createAnimatedWater(waterGeometry)
    : addMesh(object, options, waterGeometry, options.materialFor({ color: 0x438fb8, roughness: 0.28, metalness: 0.08, tex: 'water', rx: 20, ry: 30 }), [0, 0.06, 0]);
  water.position.set(0, 0.06, 0);
  if (!options.waterRendering) {
    water.castShadow = false;
    water.renderOrder = 3;
  }
  object.add(water);
  const waterMaterial = options.waterRendering ? (water.material as THREE.ShaderMaterial) : null;
  const foams: THREE.Mesh[] = [];
  for (let index = 0; index < 28; index += 1) {
    const z = minZ + ((maxZ - minZ) * (index + 0.5)) / 28;
    const foam = addMesh(object, options, new THREE.PlaneGeometry(0.8 + (index % 3) * 0.35, 0.16 + (index % 4) * 0.05), { color: 0xe9f3ef, roughness: 0.5, transparent: true, opacity: 0.58, depthWrite: false }, [shorelineX(z) - 0.16, 0.1, z]);
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.z = Math.sin(index * 2.1) * 0.25;
    foam.renderOrder = 5;
    foam.userData.foamIndex = index;
    foam.userData.foamZ = z;
    foams.push(foam);
  }
  // A tidal band whose shoreward edge oscillates every frame, so the
  // waterline visibly advances onto the sand and retreats — the signature of
  // waves lapping at the beach.
  const tidalColumns = 6;
  const tidalRows = 100;
  const tidalPositions: number[] = [];
  const tidalUvs: number[] = [];
  const tidalIndices: number[] = [];
  for (let row = 0; row <= tidalRows; row += 1) {
    const z = minZ - 2 + ((maxZ - minZ + 4) * row) / tidalRows;
    for (let column = 0; column <= tidalColumns; column += 1) {
      tidalPositions.push(0, 0, z);
      tidalUvs.push(column / tidalColumns, row / tidalRows);
    }
  }
  for (let row = 0; row < tidalRows; row += 1) {
    for (let column = 0; column < tidalColumns; column += 1) {
      const a = row * (tidalColumns + 1) + column;
      const b = a + 1;
      const c = a + tidalColumns + 1;
      const d = c + 1;
      tidalIndices.push(a, c, d, a, d, b);
    }
  }
  const tidalGeometry = new THREE.BufferGeometry();
  const tidalAttr = new THREE.Float32BufferAttribute(tidalPositions, 3);
  tidalGeometry.setAttribute('position', tidalAttr);
  tidalGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(tidalUvs, 2));
  tidalGeometry.setIndex(tidalIndices);
  tidalGeometry.computeVertexNormals();
  const tidalMesh = addMesh(object, options, tidalGeometry, options.materialFor({ color: 0x0d3b5e, roughness: 0.24, metalness: 0.1, transparent: true, opacity: 0.82, tex: 'water', rx: 6, ry: 30, depthWrite: false }), [0, 0.06, 0]);
  tidalMesh.renderOrder = 4;
  tidalMesh.castShadow = false;
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
  // Daylight eases toward the theme-clock target inside update(), so the
  // unlit water shader follows the day/night transition smoothly.
  let daylight = 1;
  let daylightTarget = 1;
  let lastElapsed = 0;
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
      const tidalPhase = elapsedSeconds * 0.45;
      const tideHeight = (z: number) => {
        const wave = Math.sin(tidalPhase + z * 0.22) * 0.5 + Math.sin(tidalPhase * 1.7 + z * 0.13) * 0.5;
        return Math.max(0, wave) * 1.9;
      };
      const tidalArray = tidalAttr.array as Float32Array;
      for (let row = 0; row <= tidalRows; row += 1) {
        const z = minZ - 2 + ((maxZ - minZ + 4) * row) / tidalRows;
        const inner = shorelineX(z) - 2.2;
        const outer = shorelineX(z) + tideHeight(z);
        for (let column = 0; column <= tidalColumns; column += 1) {
          const t = column / tidalColumns;
          tidalArray[(row * (tidalColumns + 1) + column) * 3] = THREE.MathUtils.lerp(inner, outer, t);
        }
      }
      tidalAttr.needsUpdate = true;
      tidalGeometry.computeVertexNormals();
      for (const foam of foams) {
        const index = foam.userData.foamIndex as number;
        const z = foam.userData.foamZ as number;
        const height = tideHeight(z);
        foam.position.x = shorelineX(z) + height - 0.2;
        foam.position.y = 0.1 + height * 0.04;
        const foamMaterial = foam.material as THREE.MeshStandardMaterial;
        foamMaterial.opacity = Math.min(1, 0.32 + height * 0.55);
      }
      if (waterMaterial) {
        const dt = Math.min(Math.max(elapsedSeconds - lastElapsed, 0), 0.1);
        lastElapsed = elapsedSeconds;
        daylight += (daylightTarget - daylight) * Math.min(1, dt * 2.5);
        const uniforms = waterMaterial.uniforms;
        if (uniforms.time) uniforms.time.value = elapsedSeconds;
        if (uniforms.waterColor) {
          const waterColor = uniforms.waterColor.value as THREE.Color;
          waterColor.copy(DAY_WATER_COLOR).lerp(NIGHT_WATER_COLOR, 1 - daylight);
        }
        if (uniforms.sunColor) {
          const sunColor = uniforms.sunColor.value as THREE.Color;
          sunColor.copy(DAY_SUN_COLOR).lerp(NIGHT_SUN_COLOR, 1 - daylight);
        }
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
    setDaylight(value, instant = false) {
      daylightTarget = value;
      if (instant) daylight = value;
    },
  };
}

import * as THREE from 'three';
import type { SceneInterestPointEntity } from './sceneInterestPoints';
import { createAnimatedWaterSurface } from './animatedWater';
import { WEST_BEACH, shorelineX, westBeachWaterlineMaxX } from '../city/data/cityConfig';

const DAY_WATER_COLOR = new THREE.Color(0x0d3b5e);
const NIGHT_WATER_COLOR = new THREE.Color(0x061a2c);
const DAY_SUN_COLOR = new THREE.Color(0xbdd4e6);
const NIGHT_SUN_COLOR = new THREE.Color(0x3a4a6a);
const SUN_DIRECTION = new THREE.Vector3(0.5, 0.8, 0.35).normalize();
// The sea used to drift at full shader speed, which read as choppy; scale the
// time uniform down so the swell rolls visibly slower.
const SEA_TIME_SCALE = 0.55;
// How far the surf strip may push the waterline up the beach. Owned by
// cityConfig (WEST_BEACH.surfReach) because it feeds westBeachWaterlineMaxX,
// which the unit tests lock clear of WEST_RING_ROAD_END_X.
const SURF_REACH = WEST_BEACH.surfReach;
// Crest lift at the waterline, in world y units.
const SURF_LIFT = 0.26;
// Shared height of the flat sea sheet, and how far the surf strip's root sits
// above it so the opaque sea covers the join. Both the mesh position and the
// vertex shader read these, so a change can't silently make the two coplanar
// and reintroduce z-fighting (Agents.md asks for a ≥0.004 y separation).
const SEA_SURFACE_Y = 0.06;
const SURF_ROOT_LIFT = 0.005;
const SURF_SURFACE_Y = SEA_SURFACE_Y + SURF_ROOT_LIFT;
// Surf strip extents, in world units from the coastline: how far it reaches
// under the sea sheet (the root fade covers the strip/sea join; the sea's
// own shoreBlend band in animatedWater.ts is wider than this, so the join
// always happens over tinted water) and how far up the sand its landward
// edge sits before the geometry cap below trims it.
const SURF_SEAWARD = 3;
const SURF_LANDWARD = 2.2;

// Surf strip: a narrow, finely subdivided ribbon laid over the seam between
// the sea sheet and the sand. It carries the lapping waterline (vertex
// advance/retreat + crest lift) and a faint shallow tint that feathers into
// the sand — the big sea sheet stays opaque, unmoved and cheap. Frequencies
// are tuned against the already time-scaled `time` uniform shared with the sea.
const SURF_VERT = /* glsl */ `
  uniform float time;
  uniform float reach;
  uniform float lift;
  uniform float limitX;
  varying float vFront;
  void main() {
    vec3 p = position;
    // uv.x 0 → 1 runs from open water to the wet sand; the first ~1 unit
    // fades the strip into the sea sheet so no seam shows.
    float root = smoothstep(0.0, 0.35, uv.x);
    float lap = sin(time * 2.1 + position.z * 0.35) * 0.62
      + sin(time * 3.4 - position.z * 0.22 + 2.1) * 0.30;
    float roll = sin(time * 1.6 - (1.0 - uv.x) * 10.0 + position.z * 0.55);
    float crest = pow(max(lap, 0.0), 1.35);
    p.x += root * lap * reach;
    // Soft clamp into limitX: the geometry is already capped at limitX - 0.4
    // (see createShoreSurf), so this only ever eases the crest displacement's
    // overshoot — a hard min() would fold every crest column past the bound
    // onto the same x and flash a straight seam across the beach. Eased, the
    // clamp is monotonic (no two columns ever collapse) and asymptotic to
    // limitX, so the waterline can still never reach the west road arm.
    float band = 0.2;
    float over = max(p.x - (limitX - band), 0.0);
    p.x = min(p.x, limitX - band) + band * over / (over + band);
    // Sits 0.005 above the sea sheet so the underwater root covers the join;
    // the crest climbs the sand from there. Damp the lift to zero across the
    // feathered landward edge (where alpha also fades) so the thin edge stays
    // glued to the sand instead of hovering above it as a 40%-opacity lip.
    float edge = 1.0 - smoothstep(0.72, 1.0, uv.x);
    p.y = ${SURF_SURFACE_Y} + root * (0.03 + crest * lift + max(roll, 0.0) * lift * 0.3) * edge;
    vFront = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const SURF_FRAG = /* glsl */ `
  uniform float daylight;
  uniform vec3 shallowDay;
  uniform vec3 shallowNight;
  varying float vFront;
  void main() {
    // Shallow tint only: a slightly lighter, still-saturated sea tone. No
    // foam — a white foam line read as a glaring, unnatural rim rather than
    // water, so the strip just carries the lapping edge in water colour.
    vec3 shallow = mix(shallowNight, shallowDay, daylight);
    // Translucency: the strip fades in gently from the sea sheet so its
    // seaward edge never shows as a line, then feathers to zero on the sand.
    float alpha = mix(0.24, 0.42, smoothstep(0.0, 0.7, vFront));
    alpha *= smoothstep(0.0, 0.5, vFront);
    alpha = mix(alpha, 0.0, smoothstep(0.72, 1.0, vFront));
    gl_FragColor = vec4(shallow, alpha);
    // Same output chain as the sea sheet's Water shader, so the strip and
    // the water it sits on agree under every tone-mapping exposure.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

type ShoreSurf = {
  mesh: THREE.Mesh;
  update(elapsedSeconds: number): void;
  setDaylight(value: number, instant?: boolean): void;
};

function createShoreSurf(
  innerX: (z: number) => number,
  outerX: (z: number) => number,
  minZ: number,
  maxZ: number,
): ShoreSurf {
  // 44 columns across a ~5-unit band ≈ 0.11 units per quad — fine enough
  // for a crisp 1-2 unit waterline without touching the heavy sea sheet.
  const geometry = createShoreRibbonGeometry(innerX, outerX, minZ, maxZ, 44, 220);
  geometry.computeBoundingSphere();
  // The vertex displacement pushes past the computed bounds; widen it so
  // frustum culling keeps working on honest data instead of being disabled.
  geometry.boundingSphere!.radius += SURF_REACH + 0.5;
  const material = new THREE.ShaderMaterial({
    vertexShader: SURF_VERT,
    fragmentShader: SURF_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      daylight: { value: 1 },
      reach: { value: SURF_REACH },
      lift: { value: SURF_LIFT },
      limitX: { value: westBeachWaterlineMaxX(SURF_REACH) },
      shallowDay: { value: new THREE.Color(0x2c8699) },
      shallowNight: { value: new THREE.Color(0x0e2b36) },
    },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'shore-surf';
  mesh.renderOrder = 4;
  // Same disposal contract as the sea sheet (sceneInterestPoints dispose pass).
  mesh.userData.dynamicMaterial = material;
  let daylightTarget = 1;
  let daylight = 1;
  let lastElapsed = 0;
  return {
    mesh,
    update(elapsedSeconds) {
      // Per-second easing, matching the pond/sea surfaces: a fixed
      // per-frame step makes the transition speed depend on the frame rate.
      const dt = Math.min(Math.max(elapsedSeconds - lastElapsed, 0), 0.1);
      lastElapsed = elapsedSeconds;
      daylight += (daylightTarget - daylight) * Math.min(1, dt * 2.5);
      material.uniforms.time!.value = elapsedSeconds * SEA_TIME_SCALE;
      material.uniforms.daylight!.value = daylight;
    },
    setDaylight(value, instant = false) {
      daylightTarget = value;
      if (instant) daylight = value;
    },
  };
}

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
  const waterSurface = options.waterRendering
    ? createAnimatedWaterSurface(waterGeometry, {
        sunDirection: SUN_DIRECTION,
        waterColorDay: DAY_WATER_COLOR,
        waterColorNight: NIGHT_WATER_COLOR,
        sunColorDay: DAY_SUN_COLOR,
        sunColorNight: NIGHT_SUN_COLOR,
        distortionScale: 3.7,
        timeScale: SEA_TIME_SCALE,
        // The sea sheet only takes the near-shore tint: the open water stays
        // deep and opaque, and the tint fades over tens of world units so the
        // deep→shallow change is a smooth gradient rather than a band edge.
        // The lapping waterline lives on the surf strip below.
        shoreBlend: { ribbonDepth: 96, width: 34 },
      })
    : null;
  const water = waterSurface
    ? waterSurface.water
    : addMesh(object, options, waterGeometry, options.materialFor({ color: 0x438fb8, roughness: 0.28, metalness: 0.08, tex: 'water', rx: 20, ry: 30 }), [0, SEA_SURFACE_Y, 0]);
  water.position.set(0, SEA_SURFACE_Y, 0);
  if (!options.waterRendering) {
    water.castShadow = false;
    water.renderOrder = 3;
  }
  object.add(water);
  // The lapping waterline rides on its own fine strip: underwater it blends
  // into the sea sheet, on land it climbs the sand and feathers away.
  // The landward edge is capped at the geometry level, NOT in the shader:
  // uv.x drives alpha, so a world-space shader clamp would squeeze the
  // front band non-uniformly wherever the coast wobbles landward. Capping
  // the geometry keeps the uv→x mapping linear per row; the eased clamp in
  // SURF_VERT remains as a backstop for the crest displacement overshoot.
  const surfLimitX = westBeachWaterlineMaxX(SURF_REACH);
  const shoreSurf = options.waterRendering
    ? createShoreSurf(
        (z) => shorelineX(z) - SURF_SEAWARD,
        (z) => Math.min(shorelineX(z) + SURF_LANDWARD, surfLimitX - 0.4),
        waterMinZ,
        waterMaxZ,
      )
    : null;
  if (shoreSurf) object.add(shoreSurf.mesh);
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
  // Perched just landward of the furthest lapping crest (waterlineMaxX ≈
  // coastlineX + wobble + surfReach ≈ -40.5): at -41.2 the crest sliced a
  // hard water line through the pedestal mid-height — the statue read as
  // drowned. At -40.7 the peak only licks the base's seaward face, the
  // "waves washing against its feet" read (A/B capture + VLM verified).
  seaGod.position.set(-40.7, 0, 11.5);
  object.add(seaGod);
  const rewardCard = addMesh(object, options, new THREE.BoxGeometry(0.44, 0.58, 0.045), { color: 0x445466, roughness: 0.45, metalness: 0.15, tex: 'metal', rx: 1, ry: 1 }, [-40.15, 1.05, 11.5]);
  rewardCard.visible = false;
  const cardStripe = addMesh(object, options, new THREE.BoxGeometry(0.35, 0.07, 0.052), { color: 0xe0c06b, roughness: 0.48, metalness: 0.25 }, [-40.15, 1.18, 11.5]);
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
      if (waterSurface) waterSurface.update(elapsedSeconds);
      if (shoreSurf) shoreSurf.update(elapsedSeconds);
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
      waterSurface?.setDaylight(value, instant);
      shoreSurf?.setDaylight(value, instant);
    },
  };
}

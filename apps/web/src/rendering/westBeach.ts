import * as THREE from 'three';
import type { SceneInterestPointEntity } from './sceneInterestPoints';
import { WEST_BEACH } from '../city/data/cityConfig';

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

function createAnimatedWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDaylight: { value: 1 },
    },
    // Directional sine waves shared by the vertex displacement and the
    // fragment normal, so the lighting always matches the visible surface.
    // Broad-swell amplitudes sum to 0.05: troughs stay above the city ground
    // plane (y = 0) that extends beneath the sea.
    // Everything downstream is derived from vWorldPos in the fragment shader:
    // both the uv attribute and extra varyings interpolate unreliably on this
    // large hand-built ribbon mesh, while vWorldPos provably interpolates
    // correctly, so shore proximity is recomputed per pixel (mirrors
    // shorelineX in JS).
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        vec3 transformed = position;
        float shoreX = ${WEST_BEACH.coastlineX.toFixed(1)} + sin(position.z * 0.19) * 0.85 + sin(position.z * 0.47 + 1.4) * 0.35;
        float shore = clamp((position.x - (shoreX - 96.0)) / 96.0, 0.0, 1.0);
        // shore == 1 at the shoreline: flatten waves there so they lap the sand.
        float calm = 1.0 - smoothstep(0.75, 1.0, shore) * 0.8;
        float height = sin(dot(position.xz, vec2(0.97, 0.24)) * 0.5 + uTime * 1.05) * 0.033
                     + sin(dot(position.xz, vec2(0.86, -0.5)) * 0.95 + uTime * 0.75) * 0.017;
        transformed.y += height * calm;
        vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDaylight;
      varying vec3 vWorldPos;

      // Surface gradient of the wave sum: broad swell plus two fine-chop
      // components that only exist as per-pixel normals.
      vec2 waterGradient(vec2 p) {
        vec2 g = vec2(0.0);
        g += vec2(0.97, 0.24) * (0.5 * 0.033 * cos(dot(p, vec2(0.97, 0.24)) * 0.5 + uTime * 1.05));
        g += vec2(0.86, -0.5) * (0.95 * 0.017 * cos(dot(p, vec2(0.86, -0.5)) * 0.95 + uTime * 0.75));
        g += vec2(-0.45, 0.89) * (2.6 * 0.014 * cos(dot(p, vec2(-0.45, 0.89)) * 2.6 - uTime * 1.7));
        g += vec2(0.63, 0.78) * (5.1 * 0.008 * cos(dot(p, vec2(0.63, 0.78)) * 5.1 + uTime * 2.3));
        return g;
      }

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float shoreX = ${WEST_BEACH.coastlineX.toFixed(1)} + sin(vWorldPos.z * 0.19) * 0.85 + sin(vWorldPos.z * 0.47 + 1.4) * 0.35;
        float shoreT = clamp((vWorldPos.x - (shoreX - 96.0)) / 96.0, 0.0, 1.0);
        // Fade the fine chop with distance so the far sea does not shimmer.
        float dist = length(cameraPosition - vWorldPos);
        vec2 grad = waterGradient(vWorldPos.xz) * (1.0 - clamp((dist - 45.0) / 150.0, 0.0, 0.8));
        vec3 normal = normalize(vec3(-grad.x, 1.0, -grad.y));

        vec3 sunDir = normalize(vec3(0.5, 0.8, 0.35));
        float diffuse = max(dot(normal, sunDir), 0.0);

        // Water body color: deep marine blue out at sea, turquoise at the
        // sand. Colors are authored dark because the renderer applies
        // exposure 1.18 + ACES, which lifts mid-tones strongly.
        float shore = smoothstep(0.4, 1.0, shoreT);
        vec3 color = mix(vec3(0.006, 0.09, 0.17), vec3(0.02, 0.22, 0.3), shore);
        color *= 0.6 + 0.4 * diffuse;

        // Schlick fresnel (water F0 ~ 0.02): mostly body color, sky reflection
        // only at the grazing angles on the far side of the sea.
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(viewDir, normal), 0.0), 5.0);
        color = mix(color, vec3(0.3, 0.44, 0.55), clamp(fresnel, 0.0, 1.0) * 0.45);

        // Tight sun glints riding the wave normals.
        vec3 halfDir = normalize(sunDir + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), 240.0);
        color += vec3(1.0, 0.97, 0.88) * spec * 0.6;

        // Animated foam line hugging the sand, plus a fainter trailing band.
        float wobble = sin(vWorldPos.z * 0.62 + uTime * 2.0) * 0.012;
        float foamEdge = smoothstep(0.955, 0.995, shoreT + wobble);
        float foamTrail = smoothstep(0.86, 0.9, shoreT + wobble * 2.0 + sin(uTime * 0.7) * 0.015)
                        * (1.0 - smoothstep(0.93, 0.97, shoreT));
        color = mix(color, vec3(0.9, 0.95, 0.94), clamp(foamEdge + foamTrail * 0.5, 0.0, 1.0) * 0.7);

        // Theme-clock dimming keeps the unlit shader dark at night.
        color *= mix(0.14, 1.0, uDaylight);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
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
  const waterMaterial = options.waterRendering
    ? createAnimatedWaterMaterial()
    : options.materialFor({ color: 0x438fb8, roughness: 0.28, metalness: 0.08, tex: 'water', rx: 20, ry: 30 });
  const water = addMesh(object, options, waterGeometry, waterMaterial, [0, 0.06, 0]);
  water.userData.dynamicMaterial = options.waterRendering ? waterMaterial : null;
  water.castShadow = false;
  water.renderOrder = 3;
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
      for (const foam of foams) {
        const index = foam.userData.foamIndex as number;
        const z = foam.userData.foamZ as number;
        foam.position.x = shorelineX(z) - 0.16 - Math.sin(elapsedSeconds * 0.8 + index) * 0.14;
      }
      const uniforms = waterMaterial instanceof THREE.ShaderMaterial ? waterMaterial.uniforms : null;
      if (uniforms?.uTime) {
        const dt = Math.min(Math.max(elapsedSeconds - lastElapsed, 0), 0.1);
        lastElapsed = elapsedSeconds;
        daylight += (daylightTarget - daylight) * Math.min(1, dt * 2.5);
        uniforms.uTime.value = elapsedSeconds;
        if (uniforms.uDaylight) uniforms.uDaylight.value = daylight;
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

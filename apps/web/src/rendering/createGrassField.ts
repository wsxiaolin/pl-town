import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';
import { BUILDING_DEFS } from '../city/data/buildings';
import { inferPlot } from '../city/data/buildings/_shapeDefaults';
import { RING_ROAD_RADII, shorelineX } from '../city/data/cityConfig';
import { RENDER_ORDER, SURFACE_Y } from './layers';

export type GrassDensity = 'off' | 'low' | 'high';

/** Four small draw calls, with wind and distance thinning evaluated on the GPU. */
export function createGrassField(options: {
  scene: THREE.Scene;
  resources: ResourcePool;
  density: GrassDensity;
  reducedMotion: boolean;
  material: THREE.MeshStandardMaterial;
  patches: readonly (readonly [number, number])[];
  exclusions?: readonly { x: number; z: number; half: number }[];
}): () => void {
  if (options.density === 'off') return () => {};
  const { scene, resources, material } = options;
  const geometry = resources.geometry(new THREE.BufferGeometry());
  // Two tapered segments keep roots fixed and curve the tip, without textures.
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0, 0.5, 0, 0, -0.28, 0.55, 0.12, 0.28, 0.55, 0.12, 0, 1, 0.3,
  ], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  geometry.computeVertexNormals();
  material.side = THREE.DoubleSide;
  // setColorAt supplies instanceColor; enabling vertexColors without a
  // geometry color attribute reads an unbound attribute as black on some GPUs.
  material.vertexColors = false;
  const time = { value: 0 };
  const origin = { value: new THREE.Vector3() };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.grassTime = time;
    shader.uniforms.grassCamera = origin;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      uniform float grassTime;
      uniform vec3 grassCamera;
      varying float grassHeight;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      grassHeight = position.y;
      vec3 root = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
      float distanceFade = 1. - smoothstep(35., 85., distance(root, grassCamera));
      transformed *= distanceFade;
      float sway = sin(grassTime * 1.6 + root.x * 0.55 + root.z * 0.38);
      transformed.x += sway * position.y * position.y * 0.24 * distanceFade;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying float grassHeight;
    `).replace('#include <color_fragment>', `
      #include <color_fragment>
      diffuseColor.rgb *= mix(0.82, 1.35, grassHeight);
    `);
  };
  material.customProgramCacheKey = () => 'city-grass-blades-v1';
  const footprints = [...BUILDING_DEFS.map((building) => ({
    x: building.x, z: building.z, half: (building.plot ?? inferPlot(building.shape)).size / 2 + 0.65,
  })), ...(options.exclusions ?? [])];
  const batches: THREE.InstancedMesh[] = [];
  let seed = 78;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  for (const [cx, cz] of options.patches) {
    const count = options.density === 'low' ? 1500 : 6500;
    const grass = new THREE.InstancedMesh(geometry, material, count);
    grass.name = `city-grass:${cx}:${cz}`;
    grass.userData.cityGrass = true;
    // Ground overlays are painter ordered with depthWrite=false; blades must
    // render after them or the flat lawn paints over the blades' roots.
    grass.renderOrder = RENDER_ORDER.buildingSurface;
    let placed = 0;
    for (let attempt = 0; attempt < count * 4 && placed < count; attempt++) {
      const x = cx + (random() - 0.5) * 23.6;
      const z = cz + (random() - 0.5) * 23.6;
      // The central square is paved; buildings include their surrounding plots.
      if (Math.abs(x) < 20.25 && Math.abs(z) < 20.25) continue;
      if (x < shorelineX(z) + 10.35) continue;
      const radius = Math.hypot(x, z);
      if (radius > RING_ROAD_RADII.inner - 0.55 && radius < RING_ROAD_RADII.outer + 0.55) continue;
      if (footprints.some((b) => Math.abs(x - b.x) < b.half && Math.abs(z - b.z) < b.half)) continue;
      transform.position.set(x, SURFACE_Y.landscape + 0.012, z);
      transform.rotation.set(0, random() * Math.PI * 2, 0);
      transform.scale.set(0.025 + random() * 0.035, 0.025 + random() * 0.05, 0.06);
      transform.updateMatrix();
      grass.setMatrixAt(placed, transform.matrix);
      color.setHSL(0.23 + random() * 0.035, 0.25 + random() * 0.12, 0.78 + random() * 0.15);
      grass.setColorAt(placed, color);
      placed++;
    }
    grass.count = placed;
    grass.computeBoundingSphere();
    // Wind moves tips slightly beyond the undeformed bounds.
    if (grass.boundingSphere) grass.boundingSphere.radius += 0.5;
    grass.onBeforeRender = (_renderer, _scene, camera) => {
      time.value = options.reducedMotion ? 0 : performance.now() / 1000;
      camera.getWorldPosition(origin.value);
    };
    scene.add(grass);
    batches.push(grass);
  }
  return () => batches.forEach((grass) => { grass.removeFromParent(); grass.dispose(); });
}

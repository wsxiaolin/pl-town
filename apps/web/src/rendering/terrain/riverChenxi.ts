import * as THREE from 'three';
import { createPondWaterSurface } from '../animatedWater';
import { riverWaterRows } from '../../city/data/terrain/heightfield/riverField';

export type RiverChenxiOptions = { scene: THREE.Scene };
export type RiverChenxiHandle = {
  object: THREE.Group;
  update(elapsedSeconds: number): void;
  setDaylight(value: number, instant?: boolean): void;
  dispose(): void;
};

// One connected ribbon. Outer vertices extend into the sampled wet banks so
// terrain clips the waterline naturally; bed and banks belong to world ground.
export function createRiverWaterGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const columns = 9;
  riverWaterRows().forEach((sample, i) => {
    const half = sample.extent;
    for (let j = 0; j < columns; j += 1) {
      const offset = half * (2 * j / (columns - 1) - 1);
      positions.push(sample.x + sample.nx * offset, sample.waterY, sample.z + sample.nz * offset);
      uvs.push(j / (columns - 1), sample.s / 12);
    }
    if (i === 0) return;
    for (let j = 0; j < columns - 1; j += 1) {
      const a = (i - 1) * columns + j;
      indices.push(a, a + columns, a + columns + 1, a, a + columns + 1, a + 1);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createRiverChenxi({ scene }: RiverChenxiOptions): RiverChenxiHandle {
  const object = new THREE.Group();
  object.name = 'river-chenxi';
  const geometry = createRiverWaterGeometry();
  const surface = createPondWaterSurface(geometry, {
    sunDirection: new THREE.Vector3(-1, 1, -0.5),
    waterColorDay: new THREE.Color(0x7fb5c9),
    waterColorNight: new THREE.Color(0x193e50),
    sunColorDay: new THREE.Color(0xffffff),
    sunColorNight: new THREE.Color(0x607890),
    alpha: 0.94,
    size: 6,
    timeScale: 0.55,
    waveHeight: 0.018,
    mouthFade: {
      xStart: -40, xEnd: -48,
      seaColorDay: new THREE.Color(0x2c8699),
      seaColorNight: new THREE.Color(0x0e2b36),
    },
  });
  surface.water.name = 'river-chenxi-water';
  object.add(surface.water);
  scene.add(object);
  return {
    object,
    update: surface.update,
    setDaylight: surface.setDaylight,
    dispose() {
      object.removeFromParent();
      geometry.dispose();
      (surface.water.material as THREE.Material).dispose();
    },
  };
}

// 低密度实例化草叶（issue #78）。风动模型参考 owenyuwono/gaia（MIT）：
// 梢部 sway、沿风向行进的主波 + 无理频率扰动；uWindStrength=0 时位移为零。
// 不引入 gaia 依赖树；海面仍是唯一 mirror Water，草地是 InstancedMesh。
import * as THREE from 'three';

export type GrassSpot = {
  x: number;
  y: number;
  z: number;
  scale: number;
  yaw: number;
};

export type GrassFieldHandle = {
  object: THREE.InstancedMesh;
  count: number;
  update(elapsedSeconds: number): void;
  dispose(): void;
};

const WIND_DIR = new THREE.Vector2(0.82, 0.37).normalize();
const WIND_STRENGTH = 0.16;
const BLADE_COLORS = [0x6f9c52, 0x7ea75e, 0x8fb96a] as const;

const WIND_GLSL = /* glsl */ `
uniform float uTime;
uniform float uWindStrength;
uniform vec2 uWindDir;
attribute float aSwayFactor;
vec3 grassWindOffset(vec3 worldPos, float swayFactor) {
  vec3 windDir3 = normalize(vec3(uWindDir.x, 0.0, uWindDir.y));
  vec3 crossDir = vec3(-windDir3.z, 0.0, windDir3.x);
  float phase = dot(worldPos, windDir3) * 0.8 + uTime;
  float flex = swayFactor;
  float primary = sin(phase * 1.1) * uWindStrength * flex * 1.2;
  float turb = sin(phase * 2.73 + worldPos.y * 1.4) * uWindStrength * flex * 0.35;
  float cross = sin(phase * 0.83 + 0.9) * uWindStrength * flex * 0.08;
  return windDir3 * (primary + turb) + crossDir * cross;
}
`;

export function createGrassTuftGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const sway: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();
  let vertex = 0;
  for (let blade = 0; blade < 3; blade += 1) {
    const yaw = blade * 2.094 + 0.31;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const height = 0.40 + blade * 0.08;
    const halfBase = 0.028 + blade * 0.004;
    const lean = (blade - 1) * 0.05;
    const tint = BLADE_COLORS[blade]!;
    color.setHex(tint);
    const corners: Array<[number, number, number, number]> = [
      [-halfBase, 0, lean, 0],
      [halfBase, 0, lean, 0],
      [halfBase * 0.22, height, lean + 0.02, 1],
      [-halfBase * 0.22, height, lean + 0.02, 1],
    ];
    for (const [lx, y, lz, factor] of corners) {
      positions.push(lx * cos - lz * sin, y, lx * sin + lz * cos);
      const lift = 0.88 + factor * 0.18;
      colors.push(color.r * lift, color.g * lift, color.b * lift);
      sway.push(factor);
    }
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
    vertex += 4;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSwayFactor', new THREE.Float32BufferAttribute(sway, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGrassMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
    flatShading: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uTime'] = { value: 0 };
    shader.uniforms['uWindStrength'] = { value: WIND_STRENGTH };
    shader.uniforms['uWindDir'] = { value: WIND_DIR.clone() };
    material.userData.grassUniforms = shader.uniforms;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${WIND_GLSL}`)
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 grassWorldPosition;
        #ifdef USE_INSTANCING
          grassWorldPosition = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        #else
          grassWorldPosition = modelMatrix * vec4(transformed, 1.0);
        #endif
        grassWorldPosition.xyz += grassWindOffset(grassWorldPosition.xyz, aSwayFactor);
        vec4 mvPosition = viewMatrix * grassWorldPosition;
        gl_Position = projectionMatrix * mvPosition;
        `,
      );
  };
  material.customProgramCacheKey = () => 'cityside-grass-wind-v1';
  return material;
}

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const euler = new THREE.Euler(0, 0, 0, 'YXZ');

export function createGrassField(spots: readonly GrassSpot[]): GrassFieldHandle | null {
  if (spots.length === 0) return null;
  const geometry = createGrassTuftGeometry();
  const material = createGrassMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
  mesh.name = 'cityside-grass-field';
  mesh.count = spots.length;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.dynamicMaterial = material;
  for (let index = 0; index < spots.length; index += 1) {
    const spot = spots[index]!;
    position.set(spot.x, spot.y - 0.02, spot.z);
    euler.set(0, spot.yaw, 0);
    quaternion.setFromEuler(euler);
    scale.setScalar(spot.scale);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return {
    object: mesh,
    count: spots.length,
    update(elapsedSeconds) {
      const uniforms = material.userData.grassUniforms as { uTime?: { value: number } } | undefined;
      if (uniforms?.uTime) uniforms.uTime.value = elapsedSeconds;
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

import * as THREE from 'three';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);

export class InstancedBatch {
  readonly mesh: THREE.InstancedMesh;
  private nextIndex = 0;

  constructor(
    scene: THREE.Scene,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
    shadows = true,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.castShadow = shadows;
    this.mesh.receiveShadow = shadows;
    this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  add(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): void {
    if (this.nextIndex >= this.mesh.instanceMatrix.count) return;
    position.set(x, y, z);
    scale.set(sx, sy, sz);
    matrix.compose(position, quaternion, scale);
    this.mesh.setMatrixAt(this.nextIndex++, matrix);
    this.mesh.count = this.nextIndex;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

import * as THREE from 'three';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3(1, 1, 1);
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

export class InstancedBatch {
  readonly mesh: THREE.InstancedMesh;
  private nextIndex = 0;
  private readonly matrices: THREE.Matrix4[] = [];

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
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  add(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): number {
    if (this.nextIndex >= this.mesh.instanceMatrix.count) return -1;
    position.set(x, y, z);
    scale.set(sx, sy, sz);
    matrix.compose(position, quaternion, scale);
    this.mesh.setMatrixAt(this.nextIndex, matrix);
    this.matrices[this.nextIndex] = matrix.clone();
    this.mesh.count = this.nextIndex + 1;
    this.nextIndex += 1;
    this.mesh.instanceMatrix.needsUpdate = true;
    return this.nextIndex - 1;
  }

  // 单实例可见性（用于按城市分区隐藏成组的树/路灯实例）
  setIndexVisible(index: number, visible: boolean): void {
    const original = this.matrices[index];
    if (!original || index >= this.mesh.count) return;
    this.mesh.setMatrixAt(index, visible ? original : hiddenMatrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

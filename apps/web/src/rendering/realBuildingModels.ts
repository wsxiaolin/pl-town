import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URLS = {
  banana: new URL('../assets/models/banana.glb', import.meta.url).href,
};

export type ReplaceableBuilding = {
  id: string;
  group: THREE.Group;
  bodyMat?: THREE.MeshStandardMaterial;
  body?: THREE.Mesh | null;
};

const loader = new GLTFLoader();

function detachedClone(source: THREE.Object3D): THREE.Object3D {
  source.updateWorldMatrix(true, true);
  const clone = source.clone(true);
  source.matrixWorld.decompose(new THREE.Vector3(), clone.quaternion, clone.scale);
  clone.position.set(0, 0, 0);
  clone.matrixAutoUpdate = true;
  clone.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(material => material.clone())
      : mesh.material.clone();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return clone;
}

function normalizeModel(model: THREE.Object3D, targetSize: THREE.Vector3): THREE.Group {
  const holder = new THREE.Group();
  const content = new THREE.Group();
  holder.add(content);
  content.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const scale = Math.min(
    targetSize.x / Math.max(size.x, 0.001),
    targetSize.y / Math.max(size.y, 0.001),
    targetSize.z / Math.max(size.z, 0.001),
  );
  content.scale.setScalar(scale);
  holder.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(holder);
  const center = scaledBox.getCenter(new THREE.Vector3());
  content.position.set(-center.x, -scaledBox.min.y, -center.z);
  return holder;
}

function replaceBuilding(building: ReplaceableBuilding, source: THREE.Object3D): void {
  const target = building.group.clone(true);
  target.position.set(0, 0, 0);
  target.quaternion.identity();
  target.scale.set(1, 1, 1);
  target.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(target);
  const size = box.getSize(new THREE.Vector3());
  size.set(Math.max(size.x, 0.5), Math.max(size.y, 0.8), Math.max(size.z, 0.5));
  const model = normalizeModel(detachedClone(source), size);
  building.group.clear();
  building.group.add(model);
  building.body = undefined;
  building.group.userData.buildingState = 'default';
  building.group.userData.destroyed = false;
  let firstMaterial: THREE.MeshStandardMaterial | undefined;
  model.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.userData.buildingId = building.id;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!firstMaterial && material instanceof THREE.MeshStandardMaterial) firstMaterial = material;
    if (!building.body) building.body = mesh;
  });
  if (firstMaterial) building.bodyMat = firstMaterial;
}

export async function addRealBuildingModels(_scene: THREE.Scene, buildings: ReplaceableBuilding[]): Promise<void> {
  const bananaBuilding = buildings.find(building => building.id === 'banana_palace');
  const banana = await loader.loadAsync(MODEL_URLS.banana);
  if (bananaBuilding) replaceBuilding(bananaBuilding, banana.scene);
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URLS = {
  banana: new URL('../../../banana.glb', import.meta.url).href,
  buildings: new URL('../../../buildings.glb', import.meta.url).href,
  european: new URL('../../../european_buildings_asset_pack_1.glb', import.meta.url).href,
  newYork: new URL('../../../new_york_buildings.glb', import.meta.url).href,
};

export type ReplaceableBuilding = {
  id: string;
  group: THREE.Group;
  bodyMat?: THREE.MeshStandardMaterial;
};

const loader = new GLTFLoader();

function detachedClone(source: THREE.Object3D): THREE.Object3D {
  source.updateWorldMatrix(true, true);
  const clone = source.clone(true);
  clone.matrix.copy(source.matrixWorld);
  clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
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

function normalizeModel(model: THREE.Object3D, footprint: number, height: number): THREE.Group {
  const holder = new THREE.Group();
  holder.add(model);
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const horizontal = Math.max(size.x, size.z, 0.001);
  const scale = Math.min(footprint / horizontal, height / Math.max(size.y, 0.001));
  model.scale.multiplyScalar(scale);
  holder.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(holder);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBox.min.y;
  return holder;
}

function replaceBuilding(building: ReplaceableBuilding, source: THREE.Object3D): void {
  const tmp = new THREE.Group();
  tmp.add(building.group);
  tmp.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(tmp);
  tmp.remove(building.group);
  const size = box.getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z, 0.5);
  const height = Math.max(size.y, 0.8);
  const model = normalizeModel(detachedClone(source), footprint, height);
  building.group.clear();
  building.group.add(model);
  let firstMaterial: THREE.MeshStandardMaterial | undefined;
  model.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.userData.buildingId = building.id;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!firstMaterial && material instanceof THREE.MeshStandardMaterial) firstMaterial = material;
  });
  if (firstMaterial) building.bodyMat = firstMaterial;
}

// Collect atomic building units: nodes whose children are all leaf meshes.
// Multi-mesh units (a building made of walls/roof/shops parts) stay as one model.
// Merged clusters (a node containing nested groups) are skipped since they cannot be split.
function collectUnits(root: THREE.Object3D, maxHorizontal = Infinity): THREE.Object3D[] {
  const units: THREE.Object3D[] = [];
  const visit = (node: THREE.Object3D) => {
    let meshCount = 0;
    let nestedGroups = 0;
    for (const child of node.children) {
      if ((child as THREE.Mesh).isMesh) meshCount += 1;
      else nestedGroups += 1;
    }
    if (meshCount > 0 && nestedGroups === 0) units.push(node);
    for (const child of node.children) {
      if (!(child as THREE.Mesh).isMesh) visit(child);
    }
  };
  visit(root);
  return units.filter(unit => {
    unit.updateWorldMatrix(true, true);
    const size = new THREE.Box3().setFromObject(unit).getSize(new THREE.Vector3());
    const horizontal = Math.max(size.x, size.z);
    const ratio = size.y / Math.max(horizontal, 0.001);
    return size.y > 0.05
      && horizontal > 0.05
      && horizontal < maxHorizontal
      && size.y < 500
      && ratio >= 0.25
      && ratio <= 12;
  });
}

export async function replaceWithRealBuildingModels(
  buildings: ReplaceableBuilding[],
  residentialBuildings: ReplaceableBuilding[],
  realModels: boolean,
): Promise<void> {
  const bananaBuilding = buildings.find(building => building.id === 'banana_palace');
  const banana = await loader.loadAsync(MODEL_URLS.banana);
  if (bananaBuilding) replaceBuilding(bananaBuilding, banana.scene);
  if (!realModels) return;

  const [buildingPack, europeanPack, newYorkPack] = await Promise.all([
    loader.loadAsync(MODEL_URLS.buildings),
    loader.loadAsync(MODEL_URLS.european),
    loader.loadAsync(MODEL_URLS.newYork),
  ]);
  // low_poly_night_city_building_skyline.glb is one merged skyline mesh and cannot be split;
  // it is intentionally left out so we only reuse packs with separable buildings.
  const candidates = [
    ...collectUnits(buildingPack.scene),
    ...collectUnits(newYorkPack.scene),
    ...collectUnits(europeanPack.scene, 250),
  ];
  if (candidates.length === 0) return;
  residentialBuildings.forEach((building, index) => {
    const source = candidates[index % candidates.length];
    if (source) replaceBuilding(building, source);
  });
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SATELLITE_CITY } from '../city/data/cityConfig';
import { RENDER_ORDER, SURFACE_Y } from './layers';

const MODEL_URLS = {
  banana: new URL('../assets/models/banana.glb', import.meta.url).href,
  buildings: new URL('../assets/models/buildings.glb', import.meta.url).href,
};

export type ReplaceableBuilding = {
  id: string;
  group: THREE.Group;
  bodyMat?: THREE.MeshStandardMaterial;
};

const loader = new GLTFLoader();
const PACK_POSITIONS = SATELLITE_CITY.buildingPositions.slice(0, 13).map(([x, z]) => ({ x, z }));
const DESIGNED_POSITIONS = SATELLITE_CITY.buildingPositions.slice(13).map(([x, z]) => ({ x, z }));

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

function addBuildingPack(scene: THREE.Scene, sources: THREE.Object3D[]): void {
  const plotMaterial = new THREE.MeshStandardMaterial({ color: 0xd6d3cc, roughness: 0.92 });
  PACK_POSITIONS.forEach((position, index) => {
    const x = position.x!;
    const z = position.z!;
    const source = sources[index % sources.length];
    if (!source) return;
    const model = normalizeModel(detachedClone(source), new THREE.Vector3(7, 8, 7));
    model.name = `imported-building-${index + 1}`;
    model.userData.assetPack = 'buildings';
    model.position.set(x, 0, z);
    // Keep each house facing the same direction so the satellite rows read as
    // a continuous, orderly residential block.
    model.rotation.y = 0;
    scene.add(model);
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 8.4), plotMaterial);
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(x, SURFACE_Y.buildingPlot, z);
    plot.receiveShadow = true;
    plot.renderOrder = RENDER_ORDER.buildingPlot;
    scene.add(plot);
  });
}

function addDesignedBuildings(scene: THREE.Scene, buildings: ReplaceableBuilding[]): void {
  const plotMaterial = new THREE.MeshStandardMaterial({ color: 0xd6d3cc, roughness: 0.92 });
  const sources = ['library', 'academy', 'catcafe', 'teahouse', 'qipai_hall']
    .map(id => buildings.find(building => building.id === id)?.group)
    .filter((group): group is THREE.Group => Boolean(group));
  DESIGNED_POSITIONS.forEach((position, index) => {
    const x = position.x!;
    const z = position.z!;
    const source = sources[index % sources.length];
    if (!source) return;
    const model = normalizeModel(detachedClone(source), new THREE.Vector3(7, 7, 7));
    model.name = `satellite-designed-${index + 1}`;
    model.userData.assetPack = 'main-city-design';
    model.position.set(x, 0, z);
    model.rotation.y = 0;
    scene.add(model);
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 7.4), plotMaterial);
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(x, SURFACE_Y.buildingPlot, z);
    plot.receiveShadow = true;
    plot.renderOrder = RENDER_ORDER.buildingPlot;
    scene.add(plot);
  });
}

// Collect atomic building units: nodes whose children are all leaf meshes.
// Multi-mesh units (a building made of walls/roof/shops parts) stay as one model.
// Merged clusters (a node containing nested groups) are skipped since they cannot be split.
function collectUnits(root: THREE.Object3D): THREE.Object3D[] {
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
  return units;
}

export async function addRealBuildingModels(scene: THREE.Scene, buildings: ReplaceableBuilding[]): Promise<void> {
  const bananaBuilding = buildings.find(building => building.id === 'banana_palace');
  const [banana, buildingPack] = await Promise.all([
    loader.loadAsync(MODEL_URLS.banana),
    loader.loadAsync(MODEL_URLS.buildings),
  ]);
  if (bananaBuilding) replaceBuilding(bananaBuilding, banana.scene);
  const candidates = collectUnits(buildingPack.scene);
  addBuildingPack(scene, candidates);
  addDesignedBuildings(scene, buildings);
}

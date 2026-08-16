import * as THREE from 'three';

export type DamageableBuilding = {
  id: string;
  group: THREE.Group;
  body?: THREE.Mesh;
  labelEl?: HTMLElement | null;
};

function damagedMaterial(material: THREE.Material): THREE.Material {
  const clone = material.clone() as THREE.MeshStandardMaterial;
  clone.color?.multiplyScalar(0.42);
  clone.emissive?.setHex(0);
  clone.emissiveIntensity = 0;
  if (typeof clone.roughness === 'number') clone.roughness = Math.max(clone.roughness, 0.94);
  if (typeof clone.metalness === 'number') clone.metalness = Math.min(clone.metalness, 0.02);
  return clone;
}

function addRubble(group: THREE.Group, bounds: THREE.Box3): void {
  const size = bounds.getSize(new THREE.Vector3());
  const rubble = new THREE.Group();
  rubble.name = 'building-destruction-rubble';

  const stone = new THREE.MeshStandardMaterial({ color: 0x4d4a46, roughness: 1 });
  const dust = new THREE.MeshStandardMaterial({ color: 0x777169, roughness: 1 });
  const charred = new THREE.MeshStandardMaterial({ color: 0x171615, roughness: 1 });
  const pieces: ReadonlyArray<readonly [number, number, number, number, number, number, number]> = [
    [-size.x * 0.42, 0.14, size.z * 0.28, 0.42, 0.22, 0.3, 0.28],
    [size.x * 0.3, 0.1, -size.z * 0.35, 0.34, 0.18, 0.25, -0.42],
    [size.x * 0.05, 0.09, size.z * 0.42, 0.22, 0.14, 0.18, 0.64],
    [-size.x * 0.12, 0.07, -size.z * 0.18, 0.16, 0.12, 0.2, -0.3],
  ];
  pieces.forEach(([x, y, z, width, height, depth, rotation], index) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(0.12, width), Math.max(0.08, height), Math.max(0.12, depth)),
      index % 2 ? dust : stone,
    );
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotation * 0.6, rotation, rotation * 0.35);
    mesh.castShadow = true;
    rubble.add(mesh);
  });

  const wallHeight = Math.max(0.5, size.y * 0.34);
  const wallWidth = Math.max(0.34, size.x * 0.22);
  const wallDepth = Math.max(0.2, size.z * 0.16);
  const brokenWalls: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-size.x * 0.34, wallHeight / 2, size.z * 0.2, wallHeight, -0.08],
    [0, wallHeight * 0.38, size.z * 0.32, wallHeight * 0.76, 0.1],
    [size.x * 0.34, wallHeight * 0.62, size.z * 0.16, wallHeight * 1.24, -0.16],
  ];
  brokenWalls.forEach(([x, y, z, height, rotation]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, height, wallDepth), dust);
    wall.position.set(x, y, z);
    wall.rotation.z = rotation;
    wall.castShadow = true;
    rubble.add(wall);
  });

  const burnedInterior = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.5, size.x * 0.55), 0.12, Math.max(0.5, size.z * 0.5)),
    charred,
  );
  burnedInterior.position.y = 0.12;
  burnedInterior.rotation.y = 0.18;
  rubble.add(burnedInterior);
  group.add(rubble);
}

function collapseBuilding(building: DamageableBuilding): void {
  const body = building.body;
  if (!body) return;
  body.geometry.computeBoundingBox();
  const height = body.geometry.boundingBox?.getSize(new THREE.Vector3()).y ?? 0;
  if (height <= 0) return;

  const originalTop = body.position.y + height * body.scale.y / 2;
  const collapseRatio = 0.48;
  body.scale.y *= collapseRatio;
  body.position.y -= height * (1 - collapseRatio) / 2;
  body.rotation.z = -0.035;

  building.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh === body) return;
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (bounds.min.y > originalTop * 0.72) mesh.visible = false;
  });
}

function toLocalBounds(group: THREE.Group): THREE.Box3 {
  const worldBounds = new THREE.Box3().setFromObject(group);
  const corners = [
    new THREE.Vector3(worldBounds.min.x, worldBounds.min.y, worldBounds.min.z),
    new THREE.Vector3(worldBounds.max.x, worldBounds.max.y, worldBounds.max.z),
  ].map(point => group.worldToLocal(point));
  return new THREE.Box3().setFromPoints(corners);
}

export function applyBuildingDestroyedPresentation(building: DamageableBuilding): boolean {
  if (building.group.userData.buildingState === 'damaged') return false;

  building.group.userData.buildingState = 'damaged';
  building.group.userData.destroyed = true;
  building.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || object.parent?.name === 'building-destruction-rubble') return;
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const materials = source.map(damagedMaterial);
    mesh.material = Array.isArray(mesh.material) ? materials : materials[0]!;
  });

  if (building.labelEl) {
    building.labelEl.hidden = true;
    building.labelEl.tabIndex = -1;
    building.labelEl.setAttribute('aria-disabled', 'true');
  }

  const bounds = toLocalBounds(building.group);
  collapseBuilding(building);
  addRubble(building.group, bounds);
  return true;
}

export function isBuildingDestroyed(building: { group: THREE.Object3D }): boolean {
  return building.group.userData.buildingState === 'damaged';
}

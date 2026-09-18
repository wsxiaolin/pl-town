import * as THREE from 'three';

type MeshMaterialSnapshot = {
  mesh: THREE.Mesh;
  material: THREE.Material | THREE.Material[];
};

// Keeps the pre-lock materials so a server-driven global unlock can restore the
// building instead of darkening it a second time. Mirrors the snapshot approach
// used by buildingDamage.ts.
const snapshots = new WeakMap<THREE.Object3D, MeshMaterialSnapshot[]>();

export function applyStoryLockedBuildingPresentation(buildings: readonly { group: THREE.Object3D; labelEl?: HTMLElement | null }[]): void {
  buildings.forEach((building) => {
    if (building.group.userData.storyLocked === true) return;
    building.group.userData.storyLocked = true;
    if (building.labelEl) { building.labelEl.hidden = true; building.labelEl.tabIndex = -1; }
    const snapshot: MeshMaterialSnapshot[] = [];
    building.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      snapshot.push({ mesh, material: mesh.material });
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const materials = source.map((material: THREE.Material) => {
        const locked = material.clone();
        const standard = locked as THREE.MeshStandardMaterial;
        standard.color?.multiplyScalar(0.48);
        if (typeof standard.roughness === 'number') standard.roughness = Math.max(standard.roughness, 0.9);
        if (typeof standard.metalness === 'number') standard.metalness = Math.min(standard.metalness, 0.05);
        standard.emissive?.setHex(0);
        standard.emissiveIntensity = 0;
        return locked;
      });
      mesh.material = Array.isArray(mesh.material) ? materials : materials[0]!;
    });
    snapshots.set(building.group, snapshot);
  });
}

export function restoreStoryLockedBuildingPresentation(buildings: readonly { group: THREE.Object3D; labelEl?: HTMLElement | null }[]): void {
  buildings.forEach((building) => {
    if (building.group.userData.storyLocked !== true) return;
    const snapshot = snapshots.get(building.group);
    if (!snapshot) return;
    snapshot.forEach(({ mesh, material }) => { mesh.material = material; });
    snapshots.delete(building.group);
    building.group.userData.storyLocked = false;
    if (building.labelEl) { building.labelEl.hidden = false; building.labelEl.tabIndex = 0; }
  });
}

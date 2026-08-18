import * as THREE from 'three';

export function applyStoryLockedBuildingPresentation(buildings: readonly { group: THREE.Object3D; labelEl?: HTMLElement | null }[]): void {
  buildings.forEach((building) => {
    building.group.userData.storyLocked = true;
    if (building.labelEl) { building.labelEl.hidden = true; building.labelEl.tabIndex = -1; }
    building.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
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
  });
}

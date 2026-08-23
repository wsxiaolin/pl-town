import * as THREE from 'three';
import { CAT_CAFE_ICE_WALL } from '../../gameplay/content/stories/iceKing/iceKingContent';

export function createCatCafeIceWall(options: {
  scene: THREE.Scene;
  materialFor: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
}) {
  const object = new THREE.Group();
  const addBlock = (
    geometry: THREE.BufferGeometry,
    parameters: Record<string, unknown>,
    position: readonly [number, number, number],
  ): THREE.Mesh => {
    const mesh = options.makeMesh(geometry, options.materialFor(parameters));
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
    return mesh;
  };
  const ice = {
    color: 0x9eddf0,
    emissive: 0x2f7f9d,
    emissiveIntensity: 0.12,
    roughness: 0.22,
    metalness: 0.04,
    transparent: true,
    opacity: 0.72,
  };
  const deepIce = { ...ice, color: 0x67b9d6, opacity: 0.58 };
  const capIce = { ...ice, color: 0xd8f5fb, opacity: 0.82, roughness: 0.12 };
  const lowerBlocks = [
    [-0.98, 0.31, 0.01, 0.7, 0.58, 0.34],
    [-0.34, 0.34, -0.02, 0.62, 0.64, 0.36],
    [0.31, 0.32, 0.02, 0.66, 0.6, 0.35],
    [0.97, 0.3, -0.01, 0.64, 0.56, 0.34],
  ] as const;
  lowerBlocks.forEach(([x, y, z, width, height, depth], index) => {
    const block = addBlock(new THREE.BoxGeometry(width, height, depth), index % 2 ? deepIce : ice, [x, y, z]);
    block.rotation.set((index % 2 ? -1 : 1) * 0.025, (index - 1.5) * 0.018, (index % 2 ? 1 : -1) * 0.035);
  });
  const upperBlocks = [
    [-0.72, 0.73, 0, 0.62, 0.34, 0.31],
    [-0.12, 0.77, 0.01, 0.58, 0.4, 0.32],
    [0.49, 0.74, -0.01, 0.62, 0.35, 0.31],
  ] as const;
  upperBlocks.forEach(([x, y, z, width, height, depth], index) => {
    const block = addBlock(new THREE.BoxGeometry(width, height, depth), index === 1 ? capIce : ice, [x, y, z]);
    block.rotation.set(0, (index - 1) * 0.025, (index - 1) * 0.04);
  });
  for (let index = 0; index < 5; index += 1) {
    const glint = addBlock(
      new THREE.BoxGeometry(0.22 + (index % 2) * 0.08, 0.018, 0.012),
      { color: 0xffffff, emissive: 0xbdefff, emissiveIntensity: 0.45, transparent: true, opacity: 0.7, roughness: 0.1 },
      [-0.92 + index * 0.46, 0.51 + (index % 3) * 0.13, -0.19],
    );
    glint.rotation.z = index % 2 ? -0.42 : 0.34;
  }
  object.position.set(9.1, 0, 5.9);
  object.rotation.y = Math.PI / 4;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) child.userData.sceneInterestPointId = CAT_CAFE_ICE_WALL.interestPointId;
  });
  options.scene.add(object);
  return {
    id: CAT_CAFE_ICE_WALL.interestPointId,
    object,
    interactionPosition: new THREE.Vector3(8.15, 0, 6.85),
  } as const;
}

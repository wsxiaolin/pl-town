import * as THREE from 'three';

type RestaurantDefinition = { id: string; x: number; z: number } & Record<string, unknown>;

export function buildWildMushroomRestaurant(options: {
  platformHeight: number;
  makeMaterial: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  addPart: (...args: any[]) => THREE.Mesh;
}, definition: RestaurantDefinition) {
  const { platformHeight: base, makeMaterial, makeMesh, addPart } = options;
  const group = new THREE.Group();
  const width = 5.8;
  const height = 2.35;
  const depth = 4.4;
  const wall = makeMaterial({ color: 0x8e5737, roughness: 0.86, tex: 'wood' });
  const timber = { color: 0x4d2b1f, roughness: 0.8, tex: 'wood' };
  const roof = { color: 0x6f3027, roughness: 0.78, tex: 'rooftile' };
  const warm = { color: 0xffc56b, emissive: 0xff8b32, emissiveIntensity: 0.6, roughness: 0.4 };

  addPart(group, new THREE.BoxGeometry(width + 0.8, base, depth + 0.8), { color: 0x75614c, roughness: 0.95, tex: 'pavement', rx: 3, ry: 2 }, [0, base / 2, 0]);
  const floorTop = base + 0.14;
  addPart(group, new THREE.BoxGeometry(width, 0.14, depth), timber, [0, floorTop - 0.07, 0]);

  const body = makeMesh(new THREE.BoxGeometry(width, height, depth), wall);
  body.position.set(0, floorTop + height / 2, 0);
  body.castShadow = body.receiveShadow = true;
  group.add(body);

  const frontZ = depth / 2 + 0.04;
  addPart(group, new THREE.BoxGeometry(width + 0.3, 0.28, depth + 0.3), roof, [0, floorTop + height + 0.14, 0]);
  addPart(group, new THREE.ConeGeometry(3.8, 1.05, 4), roof, [0, floorTop + height + 0.72, 0]);
  addPart(group, new THREE.BoxGeometry(2.2, 1.25, 0.08), { color: 0x2b211d, roughness: 0.3, metalness: 0.05 }, [0, floorTop + 1.02, frontZ], false);
  addPart(group, new THREE.BoxGeometry(0.12, 1.45, 0.16), timber, [-1.18, floorTop + 1.02, frontZ + 0.03], false);
  addPart(group, new THREE.BoxGeometry(0.12, 1.45, 0.16), timber, [1.18, floorTop + 1.02, frontZ + 0.03], false);
  addPart(group, new THREE.BoxGeometry(2.45, 0.12, 0.16), timber, [0, floorTop + 1.67, frontZ + 0.03], false);

  const sign = addPart(group, new THREE.BoxGeometry(3.2, 0.62, 0.18), { color: 0x3f211b, roughness: 0.6 }, [0, floorTop + 2.18, frontZ + 0.16], false);
  sign.userData.restaurantPart = definition.label ?? '野生菌餐馆';
  [-1.05, -0.35, 0.35, 1.05].forEach((x) => addPart(group, new THREE.BoxGeometry(0.38, 0.08, 0.03), warm, [x, floorTop + 2.18, frontZ + 0.27], false));

  [-2.05, 2.05].forEach((x) => {
    addPart(group, new THREE.CylinderGeometry(0.09, 0.12, 0.62, 10), { color: 0xe6d0a6, roughness: 0.8 }, [x, floorTop + 0.31, frontZ + 0.28], false);
    const cap = addPart(group, new THREE.SphereGeometry(0.26, 12, 8), { color: 0xa94e32, roughness: 0.72 }, [x, floorTop + 0.72, frontZ + 0.28], false);
    cap.scale.set(1.25, 0.55, 1.25);
    cap.userData.restaurantPart = 'mushroom-decoration';
  });
  addPart(group, new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20), warm, [0, floorTop + 0.08, 0], false);

  group.position.set(definition.x, 0, definition.z);
  group.userData.navigationFootprint = { width: width + 0.2, depth: depth + 0.2 };
  group.traverse((child) => { if ((child as THREE.Mesh).isMesh) child.userData.buildingId = definition.id; });
  return { ...definition, group, body, bodyMat: wall, labelEl: null, labelY: base + height + 1.2 };
}

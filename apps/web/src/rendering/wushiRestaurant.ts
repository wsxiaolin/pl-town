import * as THREE from 'three';

type RestaurantDefinition = { id: string; x: number; z: number } & Record<string, unknown>;

export function buildWushiRestaurant(options: {
  platformHeight: number;
  makeMaterial: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  addPart: (...args: any[]) => THREE.Mesh;
}, definition: RestaurantDefinition) {
  const { platformHeight: base, makeMaterial, makeMesh, addPart } = options;
  const group = new THREE.Group();
  const width = 5.4;
  const height = 2.8;
  const depth = 3.8;
  const wall = makeMaterial({ color: 0xead59a, roughness: 0.72, emissive: 0x8a5a18, emissiveIntensity: 0.08 });
  const glass = { color: 0x9fd3dc, roughness: 0.08, metalness: 0.12, transparent: true, opacity: 0.42 };
  const frame = { color: 0x3c4548, roughness: 0.35, metalness: 0.48 };
  const warm = { color: 0xffd78a, emissive: 0xffb347, emissiveIntensity: 0.75, roughness: 0.4 };

  addPart(group, new THREE.BoxGeometry(width + 0.7, base, depth + 0.7), { color: 0xd9c692, roughness: 0.9, tex: 'pavement', rx: 3, ry: 2 }, [0, base / 2, 0]);
  const floorTop = base + 0.132;
  addPart(group, new THREE.BoxGeometry(width, 0.12, depth), { color: 0x8d7048, roughness: 0.82, tex: 'wood', rx: 4, ry: 3 }, [0, floorTop - 0.06, 0]);
  const wallBase = floorTop + 0.012;
  const body = makeMesh(new THREE.BoxGeometry(width, height, 0.18), wall);
  body.position.set(0, wallBase + height / 2, -depth / 2 + 0.09);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  addPart(group, new THREE.BoxGeometry(0.18, height, depth), wall, [-width / 2 + 0.09, wallBase + height / 2, 0]);
  addPart(group, new THREE.BoxGeometry(0.18, height, depth), wall, [width / 2 - 0.09, wallBase + height / 2, 0]);
  addPart(group, new THREE.BoxGeometry(width + 0.24, 0.18, depth + 0.24), { color: 0xa66e32, roughness: 0.64, tex: 'rooftile', rx: 4, ry: 3 }, [0, wallBase + height + 0.102, 0]);

  [-1.85, -0.62, 0.62, 1.85].forEach((x) => {
    const panel = addPart(group, new THREE.BoxGeometry(1.16, 1.86, 0.06), glass, [x, base + 1.05, depth / 2 + 0.02], false);
    panel.userData.restaurantPart = 'glass-wall';
  });
  [-2.46, -1.23, 0, 1.23, 2.46].forEach((x) => addPart(group, new THREE.BoxGeometry(0.055, 1.92, 0.075), frame, [x, base + 1.05, depth / 2 + 0.06], false));
  addPart(group, new THREE.BoxGeometry(width, 0.1, 0.08), frame, [0, base + 1.98, depth / 2 + 0.06], false);

  const sign = addPart(group, new THREE.BoxGeometry(2.6, 0.55, 0.13), { color: 0x8c3e24, roughness: 0.55, emissive: 0x5a1e0c, emissiveIntensity: 0.18 }, [0, base + 2.43, depth / 2 + 0.1], false);
  sign.userData.restaurantPart = definition.label ?? '野生菌餐馆';
  [-0.78, -0.26, 0.26, 0.78].forEach((x) => addPart(group, new THREE.BoxGeometry(0.3, 0.08, 0.03), warm, [x, base + 2.43, depth / 2 + 0.185], false));

  addPart(group, new THREE.BoxGeometry(0.92, 1.72, 0.08), glass, [0, base + 0.92, depth / 2 + 0.095], false);
  addPart(group, new THREE.BoxGeometry(0.06, 1.78, 0.1), frame, [-0.49, base + 0.92, depth / 2 + 0.12], false);
  addPart(group, new THREE.BoxGeometry(0.06, 1.78, 0.1), frame, [0.49, base + 0.92, depth / 2 + 0.12], false);
  addPart(group, new THREE.BoxGeometry(0.035, 0.42, 0.05), { color: 0xe4c988, metalness: 0.6, roughness: 0.25 }, [0.18, base + 0.93, depth / 2 + 0.18], false);

  const advert = addPart(group, new THREE.BoxGeometry(0.72, 1.05, 0.07), { color: 0xf4eee0, roughness: 0.9, emissive: 0xf1c46d, emissiveIntensity: 0.14 }, [-1.62, base + 1.02, depth / 2 + 0.11], false);
  advert.userData.restaurantPart = 'advertisement';
  [0.2, -0.08, -0.36].forEach((y, index) => addPart(group, new THREE.BoxGeometry(index === 0 ? 0.5 : 0.42, 0.055, 0.025), { color: index === 0 ? 0xb34b32 : 0x805d3c, roughness: 0.7 }, [-1.62, base + 1.02 + y, depth / 2 + 0.17], false));

  const counter = addPart(group, new THREE.BoxGeometry(1.12, 0.64, 0.24), { color: 0x9b6b3f, roughness: 0.72, tex: 'wood', rx: 2, ry: 1 }, [1.65, base + 0.42, depth / 2 + 0.08]);
  counter.userData.restaurantPart = 'service-window';
  addPart(group, new THREE.BoxGeometry(1.3, 0.12, 0.55), { color: 0xc48743, roughness: 0.58, tex: 'wood', rx: 2, ry: 1 }, [1.65, base + 0.78, depth / 2 + 0.18]);
  [-0.45, 0, 0.45].forEach((offset) => addPart(group, new THREE.BoxGeometry(0.34, 0.13, 0.22), warm, [1.65 + offset, base + 0.9, depth / 2 + 0.15], false));

  [-1.5, 0, 1.5].forEach((x) => addPart(group, new THREE.BoxGeometry(0.72, 0.06, 0.35), warm, [x, base + height - 0.16, 0], false));
  [-1.9, -1.35, 1.35, 1.9].forEach((x, index) => {
    const stem = addPart(group, new THREE.CylinderGeometry(0.07, 0.1, 0.28, 10), { color: 0xe8d8b5, roughness: 0.78 }, [x, floorTop + 0.14, depth / 2 + 0.28], false);
    const cap = addPart(group, new THREE.SphereGeometry(0.18, 12, 8), { color: index % 2 ? 0x9a5a32 : 0xc47a3c, roughness: 0.7 }, [x, floorTop + 0.34, depth / 2 + 0.28], false);
    cap.scale.set(1.2, 0.55, 1.2);
    stem.userData.restaurantPart = 'mushroom-decoration';
    cap.userData.restaurantPart = 'mushroom-decoration';
  });
  addPart(group, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), { color: 0x3b6fe0, emissive: 0x3b6fe0, emissiveIntensity: 0.28 }, [0, floorTop + 0.05, 0], false);

  group.position.set(definition.x, 0, definition.z);
  group.userData.navigationFootprint = { width: width + 0.2, depth: depth + 0.2 };
  group.traverse((child) => { if ((child as THREE.Mesh).isMesh) child.userData.buildingId = definition.id; });
  return { ...definition, group, body, bodyMat: wall, labelEl: null, labelY: base + height + 0.95 };
}

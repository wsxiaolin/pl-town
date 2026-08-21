import * as THREE from 'three';
import type { Weather } from '../city/weather';

type NaturalBorderOptions = {
  scene: THREE.Scene;
  makeMaterial: (parameters: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  getWeather: () => Weather;
  getWaterRendering?: () => boolean;
  addObstacleGroup: (group: THREE.Object3D) => void;
};

type AnimatedSurface = { mesh: THREE.Mesh; phase: number; strength: number };

function addTree(group: THREE.Group, options: NaturalBorderOptions, x: number, z: number, scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunk = options.makeMesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 1.6 * scale, 7), options.makeMaterial({ color: 0x5f4938, roughness: 0.95 }));
  trunk.position.set(0, 0.8 * scale, 0);
  tree.add(trunk);
  const crownMaterials = [0x315e43, 0x477653, 0x6c925d];
  for (let layer = 0; layer < 3; layer += 1) {
    const crown = options.makeMesh(new THREE.IcosahedronGeometry((0.76 - layer * 0.11) * scale, 1), options.makeMaterial({ color: crownMaterials[layer], roughness: 0.9 }));
    crown.position.set((layer - 1) * 0.08 * scale, (1.48 + layer * 0.42) * scale, (layer % 2) * 0.06 * scale);
    crown.scale.y = 0.82;
    tree.add(crown);
  }
  tree.position.set(x, 0, z);
  tree.userData.windPhase = x * 0.17 + z * 0.11;
  group.add(tree);
  return tree;
}

export function createNaturalBorder(options: NaturalBorderOptions): { update: (elapsedSeconds: number) => void } {
  const root = new THREE.Group();
  root.name = 'natural-border';
  const animated: AnimatedSurface[] = [];
  const trees: THREE.Group[] = [];

  const hillMaterial = options.makeMaterial({ color: 0x64765b, roughness: 1 });
  const ridgeMaterial = options.makeMaterial({ color: 0x4d604f, roughness: 1 });
  const riverBase = options.makeMaterial({ color: 0x4e8aa0, roughness: 0.18, metalness: 0.12, transparent: true, opacity: 0.9 });
  const riverMaterial = options.getWaterRendering?.()
    ? new THREE.MeshPhysicalMaterial({ color: 0x4e8aa0, roughness: 0.1, metalness: 0.18, clearcoat: 0.65, clearcoatRoughness: 0.08, transparent: true, opacity: 0.88 })
    : riverBase;
  const bankMaterial = options.makeMaterial({ color: 0x9ba880, roughness: 1 });

  const addHill = (x: number, z: number, radius: number, height: number, material: THREE.Material): void => {
    const hill = options.makeMesh(new THREE.ConeGeometry(radius, height, 16, 3), material);
    hill.position.set(x, height / 2 - 0.02, z);
    hill.scale.z = 0.72;
    root.add(hill);
  };

  // Low-poly silhouettes keep the skyline organic while staying cheap at this camera scale.
  const ridge = (x: number, z: number, radius: number, height: number, material: THREE.Material): void => {
    addHill(x, z, radius, height, material);
    addHill(x + radius * 0.55, z + radius * 0.22, radius * 0.72, height * 0.78, material);
  };
  ridge(-54, -31, 15, 8, hillMaterial);
  addHill(-64, -12, 12, 6, ridgeMaterial);
  ridge(54, 35, 18, 10, hillMaterial);
  addHill(67, 18, 13, 7, ridgeMaterial);
  addHill(34, -58, 16, 8, ridgeMaterial);
  addHill(-28, 57, 12, 6, hillMaterial);

  const river = options.makeMesh(new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(-3, -58), new THREE.Vector2(1, -58), new THREE.Vector2(4, -32),
    new THREE.Vector2(1, -12), new THREE.Vector2(3, 8), new THREE.Vector2(-1, 33),
    new THREE.Vector2(-4, 58), new THREE.Vector2(-8, 58), new THREE.Vector2(-4, 32),
    new THREE.Vector2(-6, 8), new THREE.Vector2(-4, -12), new THREE.Vector2(-7, -32),
  ])), riverMaterial);
  river.rotation.x = -Math.PI / 2;
  river.position.set(28, 0.07, 0);
  root.add(river);
  animated.push({ mesh: river, phase: 0.8, strength: 0.025 });

  for (const [x, z, scale] of [
    [-54, -20, 1.2], [-58, -24, 0.9], [-49, -26, 0.8], [-61, -7, 1.1],
    [48, 25, 1.2], [53, 29, 0.85], [59, 28, 1.05], [64, 12, 0.75],
    [35, -46, 1.1], [42, -51, 0.82], [-20, 49, 1.0], [-33, 52, 0.75],
  ] as Array<[number, number, number]>) trees.push(addTree(root, options, x, z, scale));

  const bank = options.makeMesh(new THREE.RingGeometry(0.8, 1.1, 32), bankMaterial);
  bank.rotation.x = -Math.PI / 2;
  bank.position.set(28, 0.085, -12);
  root.add(bank);

  const airWalls = new THREE.Group();
  airWalls.name = 'natural-border-air-walls';
  const wallMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const wall = (size: [number, number, number], position: [number, number, number]): void => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), wallMaterial);
    mesh.position.set(...position);
    mesh.userData.navigationFootprint = { width: size[0], depth: size[2] };
    airWalls.add(mesh);
  };
  wall([0.8, 6, 84], [-43.2, 3, 0]);
  wall([0.8, 6, 84], [43.2, 3, 0]);
  wall([84, 6, 0.8], [0, 3, -43.2]);
  wall([84, 6, 0.8], [0, 3, 43.2]);
  root.add(airWalls);
  options.scene.add(root);
  options.addObstacleGroup(airWalls);

  return {
    update(elapsedSeconds) {
      const storm = options.getWeather() === 'rain' ? 1 : 0.35;
      river.material = riverMaterial;
      riverMaterial.opacity = 0.76 + Math.sin(elapsedSeconds * 1.8) * 0.06 * storm;
      for (const surface of animated) surface.mesh.position.y = 0.07 + Math.sin(elapsedSeconds * 1.6 + surface.phase) * surface.strength * storm;
      for (const tree of trees) {
        const phase = Number(tree.userData.windPhase ?? 0);
        tree.rotation.z = Math.sin(elapsedSeconds * 0.72 + phase) * 0.018;
        tree.rotation.x = Math.cos(elapsedSeconds * 0.58 + phase) * 0.012;
      }
    },
  };
}

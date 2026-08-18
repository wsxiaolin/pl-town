import * as THREE from 'three';
import { ECHO_OBSERVATORY_AREA } from '../city/data/cityConfig';

type Vec3 = readonly [number, number, number];

type MaterialOptions = Record<string, unknown> & {
  tex?: string;
  rx?: number;
  ry?: number;
};

type EchoObservatoryAreaOptions = {
  scene: THREE.Scene;
  makeMaterial: (options: MaterialOptions) => THREE.MeshStandardMaterial;
};

type Face = 'north' | 'south' | 'east' | 'west';

type EchoMaterials = {
  wall: THREE.MeshStandardMaterial;
  wallLight: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  timberDark: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  roofAccent: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  warmGlass: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  fabric: THREE.MeshStandardMaterial;
  fabricBlue: THREE.MeshStandardMaterial;
  ceramic: THREE.MeshStandardMaterial;
  greenery: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
};

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3,
  rotation?: Vec3,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(position[0], position[1], position[2]);
  if (rotation) result.rotation.set(rotation[0], rotation[1], rotation[2]);
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function addBox(
  parent: THREE.Object3D,
  material: THREE.Material,
  size: Vec3,
  position: Vec3,
  rotation?: Vec3,
  name?: string,
): THREE.Mesh {
  const result = mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material, position, rotation);
  if (name) result.name = name;
  parent.add(result);
  return result;
}

function markInteriorObstacle(object: THREE.Object3D): void {
  object.userData.echoInteriorObstacle = true;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) child.userData.echoInteriorObstacle = true;
  });
}

function markInteriorWalkable(object: THREE.Object3D): void {
  object.userData.echoCabinWalkable = true;
  object.traverse((child) => { child.userData.echoCabinWalkable = true; });
}

function addCylinder(
  parent: THREE.Object3D,
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  position: Vec3,
  rotation?: Vec3,
): THREE.Mesh {
  const result = mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, position, rotation);
  parent.add(result);
  return result;
}

function addSphere(
  parent: THREE.Object3D,
  material: THREE.Material,
  radius: number,
  position: Vec3,
  scale?: Vec3,
): THREE.Mesh {
  const result = mesh(new THREE.SphereGeometry(radius, 16, 10), material, position);
  if (scale) result.scale.set(scale[0], scale[1], scale[2]);
  parent.add(result);
  return result;
}

function outwardAxis(face: Face): { axis: 'x' | 'z'; sign: number } {
  if (face === 'east') return { axis: 'x', sign: 1 };
  if (face === 'west') return { axis: 'x', sign: -1 };
  if (face === 'north') return { axis: 'z', sign: 1 };
  return { axis: 'z', sign: -1 };
}

function addFramedWindow(
  parent: THREE.Object3D,
  frameMaterial: THREE.Material,
  glassMaterial: THREE.Material,
  openingMaterial: THREE.Material,
  center: Vec3,
  width: number,
  height: number,
  face: Face,
): void {
  const { axis, sign } = outwardAxis(face);
  const [x, y, z] = center;
  const depth = 0.16;
  const glassOffset = sign * 0.1;
  const openingOffset = sign * 0.03;
  if (axis === 'z') {
    addBox(parent, openingMaterial, [width, height, 0.035], [x, y, z + openingOffset]);
    addBox(parent, glassMaterial, [width - 0.16, height - 0.16, 0.035], [x, y, z + glassOffset]);
    addBox(parent, frameMaterial, [width + 0.24, 0.12, depth], [x, y - height / 2, z + sign * 0.08]);
    addBox(parent, frameMaterial, [width + 0.24, 0.12, depth], [x, y + height / 2, z + sign * 0.08]);
    addBox(parent, frameMaterial, [0.12, height, depth], [x - width / 2, y, z + sign * 0.08]);
    addBox(parent, frameMaterial, [0.12, height, depth], [x + width / 2, y, z + sign * 0.08]);
    addBox(parent, frameMaterial, [0.07, height - 0.14, depth + 0.01], [x, y, z + sign * 0.1]);
    addBox(parent, frameMaterial, [width - 0.14, 0.07, depth + 0.01], [x, y, z + sign * 0.1]);
    addBox(parent, frameMaterial, [width + 0.3, 0.14, 0.24], [x, y - height / 2 - 0.1, z + sign * 0.02]);
  } else {
    addBox(parent, openingMaterial, [0.035, height, width], [x + openingOffset, y, z]);
    addBox(parent, glassMaterial, [0.035, height - 0.16, width - 0.16], [x + glassOffset, y, z]);
    addBox(parent, frameMaterial, [depth, 0.12, width + 0.24], [x + sign * 0.08, y - height / 2, z]);
    addBox(parent, frameMaterial, [depth, 0.12, width + 0.24], [x + sign * 0.08, y + height / 2, z]);
    addBox(parent, frameMaterial, [depth, height, 0.12], [x + sign * 0.08, y, z - width / 2]);
    addBox(parent, frameMaterial, [depth, height, 0.12], [x + sign * 0.08, y, z + width / 2]);
    addBox(parent, frameMaterial, [depth + 0.01, height - 0.14, 0.07], [x + sign * 0.1, y, z]);
    addBox(parent, frameMaterial, [depth + 0.01, 0.07, width - 0.14], [x + sign * 0.1, y, z]);
    addBox(parent, frameMaterial, [0.24, 0.14, width + 0.3], [x + sign * 0.02, y - height / 2 - 0.1, z]);
  }
}

function addDoor(
  parent: THREE.Object3D,
  frameMaterial: THREE.Material,
  panelMaterial: THREE.Material,
  darkMaterial: THREE.Material,
  metalMaterial: THREE.Material,
  center: Vec3,
  width: number,
  height: number,
  face: Face,
): void {
  const { axis, sign } = outwardAxis(face);
  const [x, y, z] = center;
  const openingOffset = sign * 0.025;
  const panelOffset = sign * 0.1;
  if (axis === 'z') {
    addBox(parent, darkMaterial, [width + 0.06, height + 0.08, 0.04], [x, y, z + openingOffset]);
    addBox(parent, panelMaterial, [width - 0.12, height - 0.1, 0.08], [x, y, z + panelOffset]);
    addBox(parent, frameMaterial, [0.16, height + 0.22, 0.22], [x - width / 2, y, z + sign * 0.1]);
    addBox(parent, frameMaterial, [0.16, height + 0.22, 0.22], [x + width / 2, y, z + sign * 0.1]);
    addBox(parent, frameMaterial, [width + 0.28, 0.16, 0.22], [x, y + height / 2, z + sign * 0.1]);
    addBox(parent, frameMaterial, [width + 0.1, 0.12, 0.28], [x, y - height / 2 - 0.1, z + sign * 0.08]);
    addBox(parent, frameMaterial, [width - 0.2, 0.07, 0.1], [x, y, z + sign * 0.15]);
    addBox(parent, frameMaterial, [width - 0.2, 0.07, 0.1], [x, y - 0.62, z + sign * 0.15]);
    addSphere(parent, metalMaterial, 0.075, [x + sign * 0.48, y - 0.02, z + sign * 0.18], [1, 1, 0.7]);
  } else {
    addBox(parent, darkMaterial, [0.04, height + 0.08, width + 0.06], [x + openingOffset, y, z]);
    addBox(parent, panelMaterial, [0.08, height - 0.1, width - 0.12], [x + panelOffset, y, z]);
    addBox(parent, frameMaterial, [0.22, height + 0.22, 0.16], [x + sign * 0.1, y, z - width / 2]);
    addBox(parent, frameMaterial, [0.22, height + 0.22, 0.16], [x + sign * 0.1, y, z + width / 2]);
    addBox(parent, frameMaterial, [0.22, 0.16, width + 0.28], [x + sign * 0.1, y + height / 2, z]);
    addBox(parent, frameMaterial, [0.28, 0.12, width + 0.1], [x + sign * 0.08, y - height / 2 - 0.1, z]);
    addSphere(parent, metalMaterial, 0.075, [x + sign * 0.18, y - 0.02, z + sign * 0.48], [0.7, 1, 1]);
  }
}

function addGableTriangle(
  parent: THREE.Object3D,
  material: THREE.Material,
  width: number,
  height: number,
  wallTop: number,
  z: number,
  front: boolean,
): void {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(0, height);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const triangle = mesh(new THREE.ShapeGeometry(shape), material, [0, wallTop, z], [0, front ? 0 : Math.PI, 0]);
  parent.add(triangle);
}

function addGableRoof(
  parent: THREE.Object3D,
  roofMaterial: THREE.Material,
  accentMaterial: THREE.Material,
  width: number,
  depth: number,
  eaveY: number,
  ridgeRise: number,
  markAsInteriorRoof = false,
): void {
  const halfWidth = width / 2;
  const slope = Math.hypot(halfWidth, ridgeRise);
  const angle = Math.atan2(ridgeRise, halfWidth);
  const roofDepth = depth + 0.52;
  const pieces: THREE.Mesh[] = [];
  pieces.push(addBox(parent, roofMaterial, [slope + 0.08, 0.22, roofDepth], [-halfWidth / 2, eaveY + ridgeRise / 2, 0], [0, 0, angle], 'echo-gable-roof-left'));
  pieces.push(addBox(parent, roofMaterial, [slope + 0.08, 0.22, roofDepth], [halfWidth / 2, eaveY + ridgeRise / 2, 0], [0, 0, -angle], 'echo-gable-roof-right'));
  pieces.push(addBox(parent, accentMaterial, [0.2, 0.22, roofDepth + 0.08], [0, eaveY + ridgeRise + 0.04, 0], undefined, 'echo-gable-ridge'));
  pieces.push(addBox(parent, accentMaterial, [0.2, 0.22, roofDepth + 0.08], [-halfWidth, eaveY - 0.02, 0], undefined, 'echo-gable-eave-left'));
  pieces.push(addBox(parent, accentMaterial, [0.2, 0.22, roofDepth + 0.08], [halfWidth, eaveY - 0.02, 0], undefined, 'echo-gable-eave-right'));
  for (let index = 1; index <= 5; index += 1) {
    const t = index / 6;
    pieces.push(addBox(parent, accentMaterial, [0.055, 0.04, roofDepth - 0.12], [-halfWidth + t * halfWidth, eaveY + t * ridgeRise + 0.14, 0], [0, 0, angle]));
    pieces.push(addBox(parent, accentMaterial, [0.055, 0.04, roofDepth - 0.12], [halfWidth - t * halfWidth, eaveY + t * ridgeRise + 0.14, 0], [0, 0, -angle]));
  }
  if (markAsInteriorRoof) pieces.forEach((piece) => { piece.userData.echoInteriorRoof = true; });
}

function addRug(parent: THREE.Object3D, edgeMaterial: THREE.Material, centerMaterial: THREE.Material, x: number, z: number, width: number, depth: number): void {
  addBox(parent, edgeMaterial, [width, 0.035, depth], [x, 0.24, z]);
  addBox(parent, centerMaterial, [width - 0.24, 0.045, depth - 0.24], [x, 0.265, z]);
  addBox(parent, edgeMaterial, [width - 0.5, 0.025, 0.07], [x, 0.3, z - depth / 2 + 0.28]);
  addBox(parent, edgeMaterial, [width - 0.5, 0.025, 0.07], [x, 0.3, z + depth / 2 - 0.28]);
}

function addBed(
  parent: THREE.Object3D,
  timber: THREE.Material,
  timberDark: THREE.Material,
  mattress: THREE.Material,
  blanket: THREE.Material,
  x: number,
  z: number,
  rotationY = 0,
): void {
  const bed = new THREE.Group();
  bed.position.set(x, 0, z);
  bed.rotation.y = rotationY;
  addBox(bed, timberDark, [4.5, 0.34, 5.1], [0, 0.48, 0]);
  addBox(bed, timber, [4.25, 0.22, 4.88], [0, 0.72, 0]);
  addBox(bed, mattress, [4.02, 0.38, 4.65], [0, 0.98, 0]);
  addBox(bed, blanket, [4.02, 0.1, 2.1], [0, 1.2, -1.15]);
  addSphere(bed, mattress, 0.62, [-1.16, 1.28, 1.48], [1.35, 0.36, 0.75]);
  addSphere(bed, mattress, 0.62, [1.16, 1.28, 1.48], [1.35, 0.36, 0.75]);
  addBox(bed, timber, [4.32, 2.2, 0.18], [0, 1.55, 2.46]);
  [-1.8, 1.8].forEach((legX) => [-2.0, 2.0].forEach((legZ) => addBox(bed, timberDark, [0.14, 0.48, 0.14], [legX, 0.25, legZ])));
  markInteriorObstacle(bed);
  parent.add(bed);
}

function addDesk(
  parent: THREE.Object3D,
  timber: THREE.Material,
  timberDark: THREE.Material,
  ceramic: THREE.Material,
  x: number,
  z: number,
): void {
  const desk = new THREE.Group();
  desk.position.set(x, 0, z);
  addBox(desk, timber, [4.4, 0.2, 1.42], [0, 1.28, 0]);
  addBox(desk, timberDark, [1.05, 0.66, 1.2], [-1.45, 0.9, 0]);
  for (const legX of [-1.9, 1.9]) addBox(desk, timberDark, [0.16, 1.2, 0.16], [legX, 0.62, 0]);
  addBox(desk, ceramic, [0.46, 0.05, 0.3], [0.7, 1.42, 0]);
  addCylinder(desk, ceramic, 0.12, 0.14, 0.18, 12, [0.7, 1.53, 0]);
  addBox(desk, ceramic, [0.8, 0.04, 0.56], [1.35, 1.42, -0.18]);
  const chair = new THREE.Group();
  chair.position.set(x, 0, z - 1.35);
  addBox(chair, timberDark, [1.15, 0.16, 1.05], [0, 0.72, 0]);
  addBox(chair, timber, [1.05, 1.1, 0.14], [0, 1.22, 0.46]);
  [-0.42, 0.42].forEach((cx) => addBox(chair, timberDark, [0.12, 0.68, 0.12], [cx, 0.34, -0.36]));
  markInteriorObstacle(desk);
  markInteriorObstacle(chair);
  parent.add(desk);
  parent.add(chair);
}

function addBookshelf(
  parent: THREE.Object3D,
  timber: THREE.Material,
  timberDark: THREE.Material,
  bookMaterials: readonly THREE.Material[],
  x: number,
  z: number,
  width: number,
  height: number,
  depth: number,
): void {
  const shelf = new THREE.Group();
  shelf.position.set(x, 0, z);
  addBox(shelf, timberDark, [width, height, depth], [0, height / 2 + 0.26, 0]);
  for (let row = 0; row < 4; row += 1) {
    const y = 0.48 + row * ((height - 0.15) / 4);
    addBox(shelf, timber, [width + 0.14, 0.12, depth + 0.08], [0, y, 0]);
    for (let column = 0; column < 6; column += 1) {
      const bookWidth = 0.24 + (column % 3) * 0.05;
      const bookHeight = 0.52 + ((row + column) % 2) * 0.16;
      const bookMaterial = bookMaterials[(row * 6 + column) % bookMaterials.length]!;
      addBox(shelf, bookMaterial, [bookWidth, bookHeight, depth * 0.72], [-width / 2 + 0.3 + column * 0.46, y + bookHeight / 2 + 0.07, 0]);
    }
  }
  markInteriorObstacle(shelf);
  parent.add(shelf);
}

function addSofa(
  parent: THREE.Object3D,
  timber: THREE.Material,
  fabric: THREE.Material,
  fabricBlue: THREE.Material,
  x: number,
  z: number,
): void {
  const sofa = new THREE.Group();
  sofa.position.set(x, 0, z);
  addBox(sofa, timber, [5.2, 0.42, 1.9], [0, 0.55, 0]);
  addBox(sofa, fabric, [4.7, 0.72, 1.45], [0, 1.0, 0.05]);
  addBox(sofa, fabricBlue, [4.55, 0.22, 0.62], [0, 1.48, -0.36]);
  addBox(sofa, fabricBlue, [4.55, 0.22, 0.62], [0, 1.48, 0.38]);
  addBox(sofa, fabric, [0.28, 1.1, 1.78], [-2.5, 1.02, 0]);
  addBox(sofa, fabric, [0.28, 1.1, 1.78], [2.5, 1.02, 0]);
  [-2.1, 2.1].forEach((legX) => addBox(sofa, timber, [0.16, 0.42, 0.16], [legX, 0.22, -0.65]));
  markInteriorObstacle(sofa);
  parent.add(sofa);
}

function addKitchen(
  parent: THREE.Object3D,
  timber: THREE.Material,
  timberDark: THREE.Material,
  ceramic: THREE.Material,
  metal: THREE.Material,
  x: number,
  z: number,
): void {
  const kitchen = new THREE.Group();
  kitchen.position.set(x, 0, z);
  addBox(kitchen, timberDark, [7.2, 1.15, 1.28], [0, 0.83, 0]);
  addBox(kitchen, ceramic, [7.35, 0.14, 1.42], [0, 1.48, 0]);
  for (let cabinet = 0; cabinet < 4; cabinet += 1) {
    addBox(kitchen, timber, [1.62, 0.76, 0.06], [-2.55 + cabinet * 1.7, 0.82, -0.68]);
    addBox(kitchen, metal, [0.16, 0.04, 0.05], [-2.55 + cabinet * 1.7, 1.02, -0.73]);
  }
  addBox(kitchen, metal, [1.38, 0.08, 0.9], [0.2, 1.58, 0]);
  addBox(kitchen, timberDark, [0.95, 0.05, 0.62], [0.2, 1.64, 0]);
  addCylinder(kitchen, metal, 0.055, 0.055, 0.44, 10, [0.2, 1.86, 0.28], [Math.PI / 2, 0, 0]);
  addCylinder(kitchen, metal, 0.16, 0.16, 0.06, 16, [2.2, 1.62, 0]);
  addCylinder(kitchen, metal, 0.16, 0.16, 0.06, 16, [2.72, 1.62, 0]);
  addBox(kitchen, timberDark, [6.9, 2.1, 0.12], [0, 2.55, 0.46]);
  for (let shelf = 0; shelf < 2; shelf += 1) addBox(kitchen, timber, [6.1, 0.1, 0.45], [0, 2.05 + shelf * 0.72, 0.25]);
  for (let jar = 0; jar < 5; jar += 1) {
    addCylinder(kitchen, jar % 2 ? ceramic : metal, 0.12, 0.12, 0.32, 10, [-2.4 + jar * 1.2, 2.3 + (jar % 2) * 0.72, 0.15]);
  }
  markInteriorObstacle(kitchen);
  parent.add(kitchen);
}

function addFireplace(
  parent: THREE.Object3D,
  timber: THREE.Material,
  timberDark: THREE.Material,
  dark: THREE.Material,
  warmGlass: THREE.Material,
  x: number,
  z: number,
): void {
  const fireplace = new THREE.Group();
  fireplace.position.set(x, 0, z);
  addBox(fireplace, timberDark, [3.6, 3.8, 0.7], [0, 2.02, 0]);
  addBox(fireplace, dark, [2.6, 1.9, 0.1], [0, 1.42, -0.38]);
  addBox(fireplace, timber, [4.2, 0.22, 1.05], [0, 4.0, 0]);
  addBox(fireplace, timber, [3.2, 0.18, 0.9], [0, 0.36, -0.02]);
  addCylinder(fireplace, timberDark, 0.14, 0.14, 1.95, 10, [-0.5, 0.68, -0.28], [Math.PI / 2, 0, 0]);
  addCylinder(fireplace, timber, 0.14, 0.14, 1.95, 10, [0.5, 0.68, -0.28], [Math.PI / 2, 0.15, 0]);
  addSphere(fireplace, warmGlass, 0.34, [0, 1.22, -0.44], [1.25, 0.75, 0.55]);
  markInteriorObstacle(fireplace);
  parent.add(fireplace);
}

function addPlant(parent: THREE.Object3D, ceramic: THREE.Material, greenery: THREE.Material, x: number, z: number): void {
  const plant = new THREE.Group();
  plant.position.set(x, 0, z);
  addCylinder(plant, ceramic, 0.38, 0.46, 0.56, 12, [0, 0.52, 0]);
  addCylinder(plant, greenery, 0.08, 0.1, 1.3, 8, [0, 1.35, 0]);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2;
    addSphere(plant, greenery, 0.34, [Math.cos(angle) * 0.34, 1.62 + (i % 2) * 0.12, Math.sin(angle) * 0.34], [1.25, 0.42, 0.58]);
  }
  parent.add(plant);
}

function addWallFrames(parent: THREE.Object3D, frame: THREE.Material, art: THREE.Material, z: number): void {
  const frames = [-5.4, -3.0, -0.6, 1.8, 4.2];
  frames.forEach((x, index) => {
    addBox(parent, frame, [1.75, 1.32, 0.1], [x, 3.1 + (index % 2) * 0.5, z]);
    addBox(parent, art, [1.45, 1.02, 0.035], [x, 3.1 + (index % 2) * 0.5, z - 0.07]);
    addBox(parent, frame, [0.06, 1.05, 0.05], [x, 3.1 + (index % 2) * 0.5, z - 0.11]);
  });
}

function addPendant(parent: THREE.Object3D, cord: THREE.Material, shade: THREE.Material, glow: THREE.Material, x: number, z: number): void {
  addCylinder(parent, cord, 0.025, 0.025, 1.15, 8, [x, 5.25, z]);
  addCylinder(parent, shade, 0.38, 0.18, 0.32, 16, [x, 4.62, z]);
  addSphere(parent, glow, 0.16, [x, 4.48, z]);
}

function createMaterials(makeMaterial: EchoObservatoryAreaOptions['makeMaterial']): EchoMaterials {
  return {
    wall: makeMaterial({ color: 0xd6c7b5, roughness: 0.92, tex: 'suburb', rx: 2.2, ry: 1.8 }),
    wallLight: makeMaterial({ color: 0xe8dfd3, roughness: 0.88, tex: 'wall', rx: 2, ry: 2 }),
    timber: makeMaterial({ color: 0x80583f, roughness: 0.86, tex: 'wood', rx: 2, ry: 2 }),
    timberDark: makeMaterial({ color: 0x4e3528, roughness: 0.92, tex: 'wood', rx: 3, ry: 2 }),
    roof: makeMaterial({ color: 0x544a54, roughness: 0.72, tex: 'rooftile', rx: 2.5, ry: 3 }),
    roofAccent: makeMaterial({ color: 0x342f3b, roughness: 0.78, tex: 'wood', rx: 3, ry: 2 }),
    glass: makeMaterial({ color: 0x91bdd0, roughness: 0.12, metalness: 0.22, transparent: true, opacity: 0.72, side: THREE.DoubleSide }),
    warmGlass: makeMaterial({ color: 0xf0bc68, emissive: 0x9a5c1d, emissiveIntensity: 0.32, roughness: 0.28 }),
    dark: makeMaterial({ color: 0x292a31, roughness: 0.88, tex: 'darkwall', rx: 2, ry: 2 }),
    floor: makeMaterial({ color: 0xa9805c, roughness: 0.94, tex: 'wood', rx: 4, ry: 3 }),
    fabric: makeMaterial({ color: 0x8799a2, roughness: 0.96, tex: 'fabric', rx: 2, ry: 2 }),
    fabricBlue: makeMaterial({ color: 0x4f6680, roughness: 0.94, tex: 'fabric', rx: 2, ry: 2 }),
    ceramic: makeMaterial({ color: 0xe8dfd2, roughness: 0.42, tex: 'stone', rx: 2, ry: 2 }),
    greenery: makeMaterial({ color: 0x61794c, roughness: 0.95, tex: 'grass', rx: 2, ry: 2 }),
    metal: makeMaterial({ color: 0x858b8d, roughness: 0.36, metalness: 0.55, tex: 'metal', rx: 2, ry: 2 }),
  };
}

function createObservatory(materials: EchoMaterials): THREE.Group {
  const { wallLight, dark, roof, glass, timber, warmGlass, metal } = materials;
  const observatory = new THREE.Group();
  observatory.name = 'echo-observatory';
  observatory.position.set(ECHO_OBSERVATORY_AREA.observatory[0], 0, ECHO_OBSERVATORY_AREA.observatory[1]);
  observatory.scale.setScalar(ECHO_OBSERVATORY_AREA.observatoryScale);
  addCylinder(observatory, dark, 3.72, 3.84, 0.18, 24, [0, 0.09, 0]);
  addCylinder(observatory, timber, 3.5, 3.56, 0.14, 24, [0, 0.27, 0]);
  addCylinder(observatory, wallLight, 3.2, 3.45, 2.7, 20, [0, 1.35, 0]);
  addCylinder(observatory, timber, 3.42, 3.42, 0.13, 24, [0, 2.7, 0]);
  addFramedWindow(observatory, dark, glass, dark, [0, 1.42, -3.34], 0.86, 0.82, 'south');
  addFramedWindow(observatory, dark, glass, dark, [0, 1.42, 3.34], 0.86, 0.82, 'north');
  addFramedWindow(observatory, dark, glass, dark, [3.34, 1.42, 0], 0.86, 0.82, 'east');
  addDoor(observatory, timber, timber, dark, metal, [-3.38, 1.08, 0], 1.2, 1.8, 'west');
  addBox(observatory, timber, [1.65, 0.14, 0.58], [-3.56, 0.08, 0]);
  addBox(observatory, dark, [1.35, 0.12, 0.48], [-3.76, -0.06, 0]);
  const dome = mesh(new THREE.SphereGeometry(3.15, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), roof, [0, 2.7, 0]);
  observatory.add(dome);
  const domeRing = mesh(new THREE.TorusGeometry(3.17, 0.045, 6, 32), metal, [0, 2.78, 0], [Math.PI / 2, 0, 0]);
  observatory.add(domeRing);
  [-1.15, -0.45, 0.25, 0.95].forEach((angle) => {
    const rib = mesh(new THREE.TorusGeometry(3.16, 0.035, 5, 28, Math.PI), metal, [0, 2.7, 0], [0, angle, 0]);
    observatory.add(rib);
  });
  const domeSlit = addBox(observatory, glass, [0.72, 2.2, 3.22], [0, 3.75, 0], [-0.24, 0, 0]);
  domeSlit.renderOrder = 7;
  const telescope = addCylinder(observatory, metal, 0.22, 0.32, 3.1, 12, [0, 4.15, 0.25]);
  telescope.rotation.z = -0.48;
  addCylinder(observatory, dark, 0.16, 0.2, 0.72, 12, [0, 3.05, 0.25]);
  addBox(observatory, dark, [1.25, 0.1, 0.18], [0, 2.68, 0.25]);
  addCylinder(observatory, timber, 0.3, 0.34, 0.16, 14, [0, 3.4, 0.25]);
  addCylinder(observatory, glass, 0.23, 0.23, 0.04, 16, [0.7, 4.49, 0.25]);
  addCylinder(observatory, metal, 0.3, 0.3, 0.12, 14, [-0.7, 3.82, 0.25]);
  addCylinder(observatory, timber, 0.62, 0.72, 0.22, 16, [0, 0.15, 0]);
  addSphere(observatory, warmGlass, 0.18, [0, 5.7, 0]);
  return observatory;
}

function createExteriorHome(materials: EchoMaterials): THREE.Group {
  const { wall, wallLight, timber, timberDark, roof, roofAccent, glass, warmGlass, dark, metal, ceramic, greenery } = materials;
  const home = new THREE.Group();
  home.name = 'linche-home';
  home.position.set(ECHO_OBSERVATORY_AREA.home[0], 0, ECHO_OBSERVATORY_AREA.home[1]);
  home.scale.setScalar(ECHO_OBSERVATORY_AREA.homeScale);
  // Keep the projecting porch away from the road-side NPC interaction area.
  home.rotation.y = 0;

  const width = 8.8;
  const depth = 6.8;
  const wallHeight = 3.7;
  const wallBottom = 0.42;
  const wallTop = wallBottom + wallHeight;
  const wallThickness = 0.28;
  const frontZ = depth / 2;
  const backZ = -depth / 2;
  const doorWidth = 1.72;
  const doorHeight = 2.55;
  const frontSegment = (width - doorWidth) / 2;

  addBox(home, timberDark, [width + 0.9, 0.28, depth + 0.86], [0, 0.14, 0], undefined, 'echo-home-foundation');
  addBox(home, ceramic, [width + 0.42, 0.18, depth + 0.4], [0, 0.37, 0]);
  addBox(home, wall, [width, wallHeight, wallThickness], [0, wallBottom + wallHeight / 2, backZ]);
  addBox(home, wall, [wallThickness, wallHeight, depth], [-width / 2, wallBottom + wallHeight / 2, 0]);
  addBox(home, wall, [wallThickness, wallHeight, depth], [width / 2, wallBottom + wallHeight / 2, 0]);
  addBox(home, wall, [frontSegment, wallHeight, wallThickness], [-(doorWidth + frontSegment) / 2, wallBottom + wallHeight / 2, frontZ]);
  addBox(home, wall, [frontSegment, wallHeight, wallThickness], [(doorWidth + frontSegment) / 2, wallBottom + wallHeight / 2, frontZ]);
  addBox(home, wall, [doorWidth, wallHeight - doorHeight + 0.02, wallThickness], [0, wallBottom + doorHeight + (wallHeight - doorHeight) / 2, frontZ]);
  addGableTriangle(home, wallLight, width, 1.65, wallTop, frontZ - 0.05, true);
  addGableTriangle(home, wallLight, width, 1.65, wallTop, backZ + 0.05, false);
  addGableRoof(home, roof, roofAccent, width + 0.42, depth + 0.42, wallTop + 0.08, 1.72);

  addDoor(home, timber, timberDark, dark, metal, [0, wallBottom + doorHeight / 2, frontZ + 0.06], doorWidth, doorHeight, 'north');
  addFramedWindow(home, timberDark, glass, dark, [-2.65, 2.35, frontZ + 0.06], 1.45, 1.22, 'north');
  addFramedWindow(home, timberDark, glass, dark, [2.65, 2.35, frontZ + 0.06], 1.45, 1.22, 'north');
  addFramedWindow(home, timberDark, glass, dark, [width / 2 + 0.06, 2.35, -0.7], 1.45, 1.18, 'east');
  addFramedWindow(home, timberDark, glass, dark, [-width / 2 - 0.06, 2.35, 0.8], 1.45, 1.18, 'west');
  addFramedWindow(home, timberDark, warmGlass, dark, [2.25, 2.45, backZ - 0.06], 1.35, 1.15, 'south');
  addFramedWindow(home, timberDark, glass, dark, [0, wallTop + 0.72, frontZ + 0.07], 1.2, 0.82, 'north');

  // A real porch gives the front facade a readable entrance at the default camera angle.
  addBox(home, timberDark, [4.6, 0.18, 1.72], [0, 0.49, frontZ + 0.83]);
  addBox(home, timber, [4.9, 0.14, 1.92], [0, 3.28, frontZ + 0.78]);
  [-2.05, 2.05].forEach((x) => addBox(home, timberDark, [0.18, 2.75, 0.18], [x, 1.85, frontZ + 1.5]));
  addBox(home, timber, [4.95, 0.13, 0.18], [0, 3.16, frontZ + 1.56]);
  addBox(home, timberDark, [2.2, 0.22, 0.72], [0, 0.27, frontZ + 1.78]);
  addBox(home, timberDark, [1.8, 0.18, 0.62], [0, 0.5, frontZ + 2.27]);
  addBox(home, warmGlass, [0.28, 0.54, 0.12], [-1.15, 2.08, frontZ + 1.59]);
  addBox(home, warmGlass, [0.28, 0.54, 0.12], [1.15, 2.08, frontZ + 1.59]);

  // Window boxes and small domestic details make the facade read as lived-in.
  [-2.65, 2.65].forEach((x) => {
    addBox(home, timberDark, [1.7, 0.2, 0.48], [x, 1.45, frontZ + 0.23]);
    for (let plant = 0; plant < 3; plant += 1) addSphere(home, greenery, 0.13, [x - 0.52 + plant * 0.52, 1.63, frontZ + 0.28], [1.15, 0.5, 0.75]);
  });
  addCylinder(home, metal, 0.08, 0.1, 0.62, 10, [-(doorWidth / 2 + 0.45), 2.0, frontZ + 0.27]);
  addSphere(home, warmGlass, 0.14, [-(doorWidth / 2 + 0.45), 2.35, frontZ + 0.27]);
  addBox(home, timberDark, [1.15, 0.18, 0.58], [width / 2 - 1.05, 0.6, frontZ + 0.1]);
  addBox(home, timberDark, [0.13, 0.62, 0.13], [width / 2 - 1.5, 0.31, frontZ + 0.1]);
  addBox(home, timberDark, [0.13, 0.62, 0.13], [width / 2 - 0.6, 0.31, frontZ + 0.1]);

  // Tall masonry chimney breaks up the roof silhouette and anchors the fireplace inside.
  addBox(home, dark, [0.82, 2.0, 0.82], [2.35, wallTop + 0.76, -1.25]);
  addBox(home, timberDark, [1.08, 0.16, 1.08], [2.35, wallTop + 1.79, -1.25]);
  addBox(home, ceramic, [1.22, 0.13, 1.2], [2.35, wallTop + 1.91, -1.25]);

  home.userData.echoHomeBounds = { width: width + 1.1, depth: depth + 1.1, door: { x: 0, z: frontZ + 2.25 } };
  home.userData.echoExteriorHome = true;
  home.userData.echoWalkableEntrance = new THREE.Vector3(0, 0, frontZ + 2.25)
    .multiply(home.scale)
    .applyEuler(home.rotation)
    .add(home.position);
  return home;
}

function createInteriorHome(materials: EchoMaterials): THREE.Group {
  const { wallLight, timber, timberDark, roof, roofAccent, glass, warmGlass, dark, floor, fabric, fabricBlue, ceramic, greenery, metal } = materials;
  const interior = new THREE.Group();
  interior.name = 'linche-home-interior';
  interior.position.set(ECHO_OBSERVATORY_AREA.interior[0], 0, ECHO_OBSERVATORY_AREA.interior[1]);

  const width = 28;
  const depth = 20;
  const wallHeight = 5.55;
  const wallBottom = 0.3;
  const wallTop = wallBottom + wallHeight;
  const thickness = 0.3;
  const frontZ = -depth / 2;
  const backZ = depth / 2;
  const doorWidth = 3.4;
  const doorHeight = 3.5;
  const sideSegment = (width - doorWidth) / 2;

  const foundation = addBox(interior, timberDark, [width + 0.7, 0.25, depth + 0.7], [0, 0.12, 0], undefined, 'echo-interior-foundation');
  foundation.userData.echoInteriorFloor = true;
  const interiorFloor = addBox(interior, floor, [width, 0.18, depth], [0, 0.12, 0], undefined, 'echo-interior-floor');
  interiorFloor.userData.echoInteriorFloor = true;
  interiorFloor.userData.echoCabinWalkable = true;
  const walls = new THREE.Group();
  walls.name = 'echo-interior-walls';
  addBox(walls, wallLight, [width, wallHeight, thickness], [0, wallBottom + wallHeight / 2, backZ]);
  addBox(walls, wallLight, [thickness, wallHeight, depth], [-width / 2, wallBottom + wallHeight / 2, 0]);
  addBox(walls, wallLight, [thickness, wallHeight, depth], [width / 2, wallBottom + wallHeight / 2, 0]);
  addBox(walls, wallLight, [sideSegment, wallHeight, thickness], [-(doorWidth + sideSegment) / 2, wallBottom + wallHeight / 2, frontZ]);
  addBox(walls, wallLight, [sideSegment, wallHeight, thickness], [(doorWidth + sideSegment) / 2, wallBottom + wallHeight / 2, frontZ]);
  addBox(walls, wallLight, [doorWidth, wallHeight - doorHeight + 0.03, thickness], [0, wallBottom + doorHeight + (wallHeight - doorHeight) / 2, frontZ]);
  interior.add(walls);
  markInteriorObstacle(walls);

  // Baseboards, corner posts, and exposed rafters replace the old blank cutaway walls.
  const trim = new THREE.Group();
  trim.name = 'echo-interior-trim';
  addBox(trim, timberDark, [width, 0.18, 0.22], [0, 0.52, backZ - 0.18]);
  addBox(trim, timberDark, [sideSegment, 0.18, 0.22], [-(doorWidth + sideSegment) / 2, 0.52, frontZ + 0.18]);
  addBox(trim, timberDark, [sideSegment, 0.18, 0.22], [(doorWidth + sideSegment) / 2, 0.52, frontZ + 0.18]);
  addBox(trim, timberDark, [0.22, 0.18, depth], [-width / 2 + 0.18, 0.52, 0]);
  addBox(trim, timberDark, [0.22, 0.18, depth], [width / 2 - 0.18, 0.52, 0]);
  [-width / 2 + 0.18, width / 2 - 0.18].forEach((x) => addBox(trim, timber, [0.24, wallHeight + 0.08, 0.24], [x, wallBottom + wallHeight / 2, frontZ + 0.16]));
  [-6.5, 0, 6.5].forEach((x) => addBox(trim, timberDark, [0.18, 0.2, depth - 0.55], [x, wallTop - 0.25, 0]));
  addBox(trim, timberDark, [width - 0.5, 0.2, 0.18], [0, wallTop - 0.25, 0]);
  interior.add(trim);
  markInteriorObstacle(trim);
  addGableRoof(interior, roof, roofAccent, width + 0.65, depth + 0.65, wallTop + 0.05, 2.35, true);
  const ceiling = addBox(interior, roofAccent, [width - 0.7, 0.12, depth - 0.7], [0, wallTop - 0.07, 0], undefined, 'echo-interior-ceiling');
  ceiling.userData.echoInteriorRoof = true;

  // The playable face is the room-facing (+Z) side of the south door.
  const interiorDoor = new THREE.Group();
  interiorDoor.name = 'echo-interior-door';
  addDoor(interiorDoor, timber, timberDark, dark, metal, [0, wallBottom + doorHeight / 2, frontZ + 0.08], doorWidth, doorHeight, 'north');
  markInteriorWalkable(interiorDoor);
  interior.add(interiorDoor);
  addFramedWindow(interior, timberDark, warmGlass, dark, [-8.5, 3.05, frontZ + 0.18], 3.3, 2.1, 'north');
  addFramedWindow(interior, timberDark, warmGlass, dark, [8.5, 3.05, frontZ + 0.18], 3.3, 2.1, 'north');
  addFramedWindow(interior, timberDark, glass, dark, [width / 2 + 0.18, 3.2, -1.6], 3.4, 2.25, 'west');
  addFramedWindow(interior, timberDark, glass, dark, [-width / 2 - 0.18, 3.2, 1.7], 3.4, 2.25, 'east');
  addWallFrames(interior, timberDark, warmGlass, backZ - 0.18);
  addRug(interior, timberDark, fabricBlue, 0, -1.7, 8.8, 5.8);

  // The room is intentionally arranged around a clear south-to-north route.
  addBed(interior, timber, timberDark, ceramic, fabricBlue, -8.1, 2.55, 0);
  addDesk(interior, timber, timberDark, ceramic, 2.2, -0.05);
  addBookshelf(interior, timber, timberDark, [warmGlass, fabricBlue, ceramic, greenery], 10.0, 3.9, 5.5, 4.25, 0.66);
  addSofa(interior, timber, fabric, fabricBlue, -2.5, 7.0);
  addKitchen(interior, timber, timberDark, ceramic, metal, 7.0, -6.85);
  addFireplace(interior, timber, timberDark, dark, warmGlass, -10.5, 7.7);
  addPlant(interior, ceramic, greenery, -12.1, -5.9);
  addPlant(interior, ceramic, greenery, 12.0, -5.4);
  addPendant(interior, timberDark, ceramic, warmGlass, 0, 1.2);
  const diningTable = new THREE.Group();
  diningTable.name = 'echo-interior-dining-table';
  addBox(diningTable, timber, [2.25, 0.12, 1.2], [0, 1.15, 0]);
  const diningLegs: readonly Vec3[] = [
    [-0.82, 0.88, -0.34], [0.82, 0.88, -0.34],
    [-0.82, 0.88, 0.34], [0.82, 0.88, 0.34],
  ];
  diningLegs.forEach(([x, y, z]) => addBox(diningTable, timberDark, [0.12, 0.76, 0.12], [x, y, z]));
  addBox(diningTable, ceramic, [0.7, 0.08, 0.45], [0, 1.28, 0]);
  diningTable.position.set(0, 0, 4.25);
  markInteriorObstacle(diningTable);
  interior.add(diningTable);

  interior.userData.echoInteriorBounds = { width, depth, wallHeight, door: { x: 0, z: frontZ - 0.55 } };
  interior.userData.echoInteriorWalkable = {
    minX: -width / 2 + 0.65,
    maxX: width / 2 - 0.65,
    minZ: frontZ + 0.65,
    maxZ: backZ - 0.65,
  };
  return interior;
}

function createSign(materials: EchoMaterials): THREE.Group {
  const sign = new THREE.Group();
  sign.name = 'echo-observatory-sign';
  sign.position.set(64.8, 0, -1.4);
  addBox(sign, materials.timberDark, [0.16, 1.7, 0.16], [0, 0.85, 0]);
  addBox(sign, materials.timber, [2.3, 0.8, 0.16], [0, 1.45, 0]);
  addBox(sign, materials.warmGlass, [1.75, 0.2, 0.035], [0, 1.45, 0.1]);
  return sign;
}

export function addEchoObservatoryArea(options: EchoObservatoryAreaOptions): THREE.Group[] {
  const materials = createMaterials(options.makeMaterial);
  const observatory = createObservatory(materials);
  const home = createExteriorHome(materials);
  const interior = createInteriorHome(materials);
  const sign = createSign(materials);
  options.scene.add(observatory, home, interior, sign);
  // Only the two exterior structures participate in the town obstacle graph.
  // The interior is a narrative teleport room and exposes explicit bounds above.
  return [observatory, home];
}

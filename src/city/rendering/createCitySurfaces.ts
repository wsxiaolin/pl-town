import * as THREE from 'three';
import { POLYGON_OFFSET, RENDER_ORDER, SURFACE_Y } from '../../rendering/layers';

type MaterialOptions = THREE.MeshStandardMaterialParameters & {
  tex?: string;
  rx?: number;
  ry?: number;
};

type ThemeMaterial = {
  mat: THREE.MeshStandardMaterial;
  day: number;
  night: number;
};

type CitySurfaceOptions = {
  scene: THREE.Scene;
  isNight: boolean;
  roadCoords: readonly number[];
  cityLimit: number;
  colors: {
    asphalt: number;
    dayPath: number;
    nightPath: number;
  };
  createMaterial: (options: MaterialOptions) => THREE.MeshStandardMaterial;
  pathMaterials: THREE.MeshStandardMaterial[];
  groundMaterials: ThemeMaterial[];
  addLamps: (positions: number[][]) => void;
};

export function createCitySurfaces(options: CitySurfaceOptions): THREE.MeshStandardMaterial {
  const {
    scene,
    isNight,
    roadCoords,
    cityLimit,
    colors,
    createMaterial,
    pathMaterials,
    groundMaterials,
    addLamps,
  } = options;

  const groundMaterial = addGround();
  addPaths();
  return groundMaterial;

  function addGround(): THREE.MeshStandardMaterial {
    const farMat = createMaterial({ color: isNight ? 0x9a988e : 0xd8d4cc, roughness: 1, metalness: 0, tex: 'ground6', rx: 24, ry: 24 });
    const farGround = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), farMat);
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.y = SURFACE_Y.base;
    farGround.receiveShadow = true;
    farGround.renderOrder = RENDER_ORDER.base;
    scene.add(farGround);

    const districtMat = createMaterial({ color: isNight ? 0xb4b0a4 : 0xe0d8cc, roughness: 1, tex: 'ground2', rx: 18, ry: 18 });
    const district = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), districtMat);
    district.rotation.x = -Math.PI / 2;
    district.position.y = SURFACE_Y.district;
    district.receiveShadow = true;
    district.renderOrder = RENDER_ORDER.district;
    scene.add(district);

    const plazaMat = createMaterial({ color: isNight ? 0xb0afa8 : 0xe8e7e4, roughness: 0.9, tex: 'ground5', rx: 10, ry: 10 });
    plazaMat.polygonOffset = true;
    plazaMat.polygonOffsetFactor = POLYGON_OFFSET.plaza.factor;
    plazaMat.polygonOffsetUnits = POLYGON_OFFSET.plaza.units;
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = SURFACE_Y.plaza;
    plaza.receiveShadow = true;
    plaza.renderOrder = RENDER_ORDER.plaza;
    scene.add(plaza);

    const grassMat = createMaterial({ color: isNight ? 0x6a7a50 : 0xc0d0a0, roughness: 1, tex: 'ground4', rx: 12, ry: 12 });
    grassMat.polygonOffset = true;
    grassMat.polygonOffsetFactor = POLYGON_OFFSET.landscape.factor;
    grassMat.polygonOffsetUnits = POLYGON_OFFSET.landscape.units;
    const grassPositions: Array<[number, number]> = [[24, 24], [24, -24], [-24, 24], [-24, -24]];
    for (const [x, z] of grassPositions) {
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(x, SURFACE_Y.landscape, z);
      grass.receiveShadow = true;
      grass.renderOrder = RENDER_ORDER.landscape;
      scene.add(grass);
    }

    groundMaterials.push(
      { mat: farMat, day: 0xd8d4cc, night: 0x9a988e },
      { mat: districtMat, day: 0xe0d8cc, night: 0xb4b0a4 },
      { mat: plazaMat, day: 0xe8e7e4, night: 0xb0afa8 },
      { mat: grassMat, day: 0xc0d0a0, night: 0x6a7a50 },
    );
    return farMat;
  }

  function addPaths(): void {
    const pathColor = isNight ? colors.nightPath : colors.dayPath;
    const roadWidth = (position: number) => position === 0 ? 2.4 : (Math.abs(position) === 6 || Math.abs(position) === 12 ? 1.5 : 1.0);
    const addRoadSegment = (width: number, depth: number, x: number, z: number, main = false, texture = 'road') => {
      const material = createMaterial({
        color: main ? colors.asphalt : pathColor,
        roughness: 1,
        tex: texture,
        rx: Math.max(1, width / 3),
        ry: Math.max(1, depth / 3),
      });
      pathMaterials.push(material);
      const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), material);
      road.position.set(x, SURFACE_Y.road, z);
      road.renderOrder = RENDER_ORDER.road;
      road.receiveShadow = true;
      scene.add(road);
    };

    addRoadSegment(2.4, 35.8, 0, -21.1, true, 'asphalt');
    addRoadSegment(2.4, 35.8, 0, 21.1, true, 'asphalt');
    addRoadSegment(38.8, 2.4, -23.6, 0, true, 'asphalt');
    addRoadSegment(38.8, 2.4, 23.6, 0, true, 'asphalt');
    addRoadSegment(2.4, 2.0, 0, -39.0, true, 'asphalt');
    addRoadSegment(2.4, 2.0, 0, 39.0, true, 'asphalt');

    const minorCoords = roadCoords.filter((position) => position !== 0);
    for (const position of minorCoords) {
      const width = roadWidth(position);
      const texture = Math.abs(position) === 6 || Math.abs(position) === 12 ? 'road' : 'pavement';
      addRoadSegment(width, 32.8, position, -18.6, false, texture);
      addRoadSegment(width, 32.8, position, 18.6, false, texture);
    }

    const boundaries = [-cityLimit, ...roadCoords, cityLimit];
    for (const z of minorCoords) {
      const width = roadWidth(z);
      const texture = Math.abs(z) === 6 || Math.abs(z) === 12 ? 'road' : 'pavement';
      for (let index = 0; index < boundaries.length - 1; index++) {
        const left = boundaries[index]!;
        const right = boundaries[index + 1]!;
        const start = left + (roadCoords.includes(left) ? roadWidth(left) / 2 : 0);
        const end = right - (roadCoords.includes(right) ? roadWidth(right) / 2 : 0);
        if (end > start) addRoadSegment(end - start, width, (start + end) / 2, z, false, texture);
      }
    }

    const lineMat = createMaterial({ color: 0xe8b34b, roughness: 0.6, metalness: 0.1 });
    pathMaterials.push(lineMat);
    for (let position = -36; position <= 36; position += 2.4) {
      if (Math.abs(position) < 2.8) continue;
      addMarking(new THREE.BoxGeometry(0.07, 0.008, 1.15), lineMat, 0, position);
      addMarking(new THREE.BoxGeometry(1.15, 0.008, 0.07), lineMat, position, 0);
    }

    for (const x of roadCoords) for (const z of roadCoords) {
      if ((x !== 0 && z !== 0) || (x === 0 && z === 0)) continue;
      const material = createMaterial({ color: 0xf0f0ec, roughness: 0.85, tex: 'crosswalk', rx: 1, ry: 1 });
      pathMaterials.push(material);
      addMarking(new THREE.BoxGeometry(x === 0 ? 2 : 0.5, 0.005, x === 0 ? 0.5 : 2), material, x, z);
    }

    const ringMat = createMaterial({ color: colors.asphalt, roughness: 0.95 });
    pathMaterials.push(ringMat);
    addRing(37, 39, ringMat, SURFACE_Y.roadSurface, RENDER_ORDER.road);

    const ringLineMat = createMaterial({ color: 0xe8b34b, roughness: 0.6, metalness: 0.1 });
    pathMaterials.push(ringLineMat);
    addRing(37.96, 38.04, ringLineMat, SURFACE_Y.roadMarking, RENDER_ORDER.roadMarking);

    for (let index = 0; index < 8; index++) {
      const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
      addLamps([[Math.cos(angle) * 38, 0, Math.sin(angle) * 38]]);
    }

    const pedestrianMat = createMaterial({ color: 0xb9b8b3, roughness: 0.9, tex: 'pavement', rx: 3, ry: 3 });
    pathMaterials.push(pedestrianMat);
    addRing(2.25, 3, pedestrianMat, SURFACE_Y.roadSurface, RENDER_ORDER.road);
  }

  function addMarking(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number): void {
    const marking = new THREE.Mesh(geometry, material);
    marking.position.set(x, SURFACE_Y.roadMarking, z);
    marking.renderOrder = RENDER_ORDER.roadMarking;
    scene.add(marking);
  }

  function addRing(inner: number, outer: number, material: THREE.Material, y: number, renderOrder: number): void {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    ring.renderOrder = renderOrder;
    ring.receiveShadow = true;
    scene.add(ring);
  }
}

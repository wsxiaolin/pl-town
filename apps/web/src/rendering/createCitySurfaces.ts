import * as THREE from 'three';
import { RENDER_ORDER, SURFACE_Y } from './layers';
import { EAST_RING_ROAD_END_X, ECHO_OBSERVATORY_AREA, MAIN_ROAD_WIDTH, NORTH_DISTRICT_AREA, RING_ARM_INNER_X, RING_ROAD_RADII, WEST_RING_ROAD_END_X } from '../city/data/cityConfig';
import { BUILDING_DEFS } from '../city/data/buildings';
import { batchStaticMeshes } from './staticMeshBatcher';
import type { MaterialParameters } from './meshFactory';

type MaterialOptions = MaterialParameters;

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
  createMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  pathMaterials: THREE.MeshStandardMaterial[];
  groundMaterials: ThemeMaterial[];
  addLamps: (positions: readonly (readonly [number, number, number])[]) => void;
};

export function createCitySurfaces(options: CitySurfaceOptions): void {
  const {
    scene,
    isNight,
    colors,
    createMaterial,
    createMesh,
    pathMaterials,
    groundMaterials,
    addLamps,
  } = options;
  const existingSceneChildren = new Set(scene.children);
  const layerMaterials = new Map<string, THREE.MeshStandardMaterial>();
  const trackedPathMaterials = new Set(pathMaterials);

  // Surface overlays are painter-ordered. They still test against buildings,
  // but do not compete with one another in the depth buffer.
  const createLayerMaterial = (parameters: MaterialOptions): THREE.MeshStandardMaterial => {
    const key = JSON.stringify(parameters);
    const cached = layerMaterials.get(key);
    if (cached) return cached;
    const material = createMaterial(parameters);
    material.depthWrite = false;
    layerMaterials.set(key, material);
    return material;
  };

  const trackPathMaterial = (material: THREE.MeshStandardMaterial): void => {
    if (trackedPathMaterials.has(material)) return;
    trackedPathMaterials.add(material);
    pathMaterials.push(material);
  };

  addGround();
  addPaths();
  batchStaticMeshes(scene, scene.children.filter((child) => !existingSceneChildren.has(child)));

  function addGround(): void {
    const farMat = createMaterial({ color: isNight ? 0x9a988e : 0xd8d4cc, roughness: 1, metalness: 0, tex: 'ground6', rx: 24, ry: 24 });
    const farGround = createMesh(new THREE.PlaneGeometry(220, 220), farMat);
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.y = SURFACE_Y.base;
    farGround.receiveShadow = true;
    farGround.renderOrder = RENDER_ORDER.base;
    scene.add(farGround);

    const districtMat = createLayerMaterial({ color: isNight ? 0xb4b0a4 : 0xe0d8cc, roughness: 1, tex: 'ground2', rx: 18, ry: 18 });
    const district = createMesh(new THREE.PlaneGeometry(150, 150), districtMat);
    district.rotation.x = -Math.PI / 2;
    district.position.y = SURFACE_Y.district;
    district.receiveShadow = true;
    district.renderOrder = RENDER_ORDER.district;
    scene.add(district);

    const plazaMat = createLayerMaterial({ color: isNight ? 0xb0afa8 : 0xe8e7e4, roughness: 0.9, tex: 'ground5', rx: 10, ry: 10 });
    const plaza = createMesh(new THREE.PlaneGeometry(40, 40), plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = SURFACE_Y.plaza;
    plaza.receiveShadow = true;
    plaza.renderOrder = RENDER_ORDER.plaza;
    scene.add(plaza);

    const grassMat = createLayerMaterial({ color: isNight ? 0x6a7a50 : 0xc0d0a0, roughness: 1, tex: 'ground4', rx: 12, ry: 12 });
    const grassPositions: Array<[number, number]> = [[24, 24], [24, -24], [-24, 24], [-24, -24]];
    for (const [x, z] of grassPositions) {
      const grass = createMesh(new THREE.PlaneGeometry(24, 24), grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(x, SURFACE_Y.landscape, z);
      grass.receiveShadow = true;
      grass.renderOrder = RENDER_ORDER.landscape;
      scene.add(grass);
    }

    const echoGroundMat = createLayerMaterial({ color: isNight ? 0x667256 : 0xb8c99d, roughness: 1, tex: 'ground4', rx: 8, ry: 6 });
    const echoGround = createMesh(new THREE.PlaneGeometry(ECHO_OBSERVATORY_AREA.width, ECHO_OBSERVATORY_AREA.depth), echoGroundMat);
    echoGround.rotation.x = -Math.PI / 2;
    echoGround.position.set(ECHO_OBSERVATORY_AREA.center[0], SURFACE_Y.district, ECHO_OBSERVATORY_AREA.center[1]);
    echoGround.receiveShadow = true;
    echoGround.renderOrder = RENDER_ORDER.district;
    scene.add(echoGround);

    groundMaterials.push(
      { mat: farMat, day: 0xd8d4cc, night: 0x9a988e },
      { mat: districtMat, day: 0xe0d8cc, night: 0xb4b0a4 },
      { mat: plazaMat, day: 0xe8e7e4, night: 0xb0afa8 },
      { mat: grassMat, day: 0xc0d0a0, night: 0x6a7a50 },
      { mat: echoGroundMat, day: 0xb8c99d, night: 0x667256 },
    );
  }

  function addPaths(): void {
    const pathColor = isNight ? colors.nightPath : colors.dayPath;
    const addRoadSegment = (width: number, depth: number, x: number, z: number, main = false, texture = 'road', district = '') => {
      const material = createLayerMaterial({
        color: main ? colors.asphalt : pathColor,
        roughness: 1,
        tex: texture,
        rx: Math.max(1, width / 3),
        ry: Math.max(1, depth / 3),
      });
      trackPathMaterial(material);
      const road = createMesh(new THREE.BoxGeometry(width, 0.04, depth), material);
      road.position.set(x, SURFACE_Y.road, z);
      road.renderOrder = RENDER_ORDER.road;
      road.receiveShadow = true;
      if(district) road.userData.district = district;
      scene.add(road);
    };

    addRoadSegment(MAIN_ROAD_WIDTH, 35.8, 0, -21.1, true, 'asphalt');
    addRoadSegment(MAIN_ROAD_WIDTH, 35.8, 0, 21.1, true, 'asphalt');
    // Both arms share RING_ARM_INNER_X so they stay symmetric at the plaza.
    // Both ends (WEST/EAST_RING_ROAD_END_X) live in cityConfig next to the
    // ring radii they meet; the west arm ends on dry sand, clear of the
    // shore surf (see cityConfig), and the east arm keeps its full run to
    // the city edge.
    const westRoadWidth = -RING_ARM_INNER_X - WEST_RING_ROAD_END_X;
    addRoadSegment(westRoadWidth, MAIN_ROAD_WIDTH, WEST_RING_ROAD_END_X + westRoadWidth / 2, 0, true, 'asphalt');
    const eastRoadWidth = EAST_RING_ROAD_END_X - RING_ARM_INNER_X;
    addRoadSegment(eastRoadWidth, MAIN_ROAD_WIDTH, RING_ARM_INNER_X + eastRoadWidth / 2, 0, true, 'asphalt');
    // The pavement spokes stop at the ring's outer edge.
    addRoadSegment(MAIN_ROAD_WIDTH, 2.0, 0, -RING_ROAD_RADII.outer, false, 'pavement');
    addRoadSegment(MAIN_ROAD_WIDTH, 2.0, 0, RING_ROAD_RADII.outer, false, 'pavement');
    addRoadSegment(2.0, MAIN_ROAD_WIDTH, -RING_ROAD_RADII.outer, 0, false, 'pavement');
    addRoadSegment(2.0, MAIN_ROAD_WIDTH, RING_ROAD_RADII.outer, 0, false, 'pavement');

    ECHO_OBSERVATORY_AREA.roadSegments.forEach((segment) => {
      const [x1, z1, x2, z2] = segment as [number, number, number, number];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      const road = createMesh(new THREE.BoxGeometry(1.35, 0.04, length), createLayerMaterial({
        color: pathColor,
        roughness: 1,
        tex: 'pavement',
        rx: 1,
        ry: Math.max(1, length / 3),
      }));
      road.position.set((x1 + x2) / 2, SURFACE_Y.road, (z1 + z2) / 2);
      road.rotation.y = -Math.atan2(dx, dz);
      road.renderOrder = RENDER_ORDER.road;
      road.receiveShadow = true;
      road.userData.district = 'echo-observatory-road';
      scene.add(road);
    });
    addLamps([[44, 0, -1.3], [52, 0, 1.3], [60, 0, -1.3], [66, 0, 1.3]]);

    const lineMat = createLayerMaterial({ color: 0xe8b34b, roughness: 0.6, metalness: 0.1 });
    trackPathMaterial(lineMat);
    for (let position = -36; position <= 36; position += 2.4) {
      if (Math.abs(position) < 2.8) continue;
      addMarking(new THREE.BoxGeometry(0.07, 0.008, 1.15), lineMat, 0, position);
      addMarking(new THREE.BoxGeometry(1.15, 0.008, 0.07), lineMat, position, 0);
    }

    const ringMat = createLayerMaterial({ color: 0xb8b5ae, roughness: 0.95, tex: 'pavement', rx: 8, ry: 8 });
    trackPathMaterial(ringMat);
    addRing(RING_ROAD_RADII.inner, RING_ROAD_RADII.outer, ringMat, SURFACE_Y.roadSurface, RENDER_ORDER.road);

    const ringLineMat = createLayerMaterial({ color: 0xe8b34b, roughness: 0.6, metalness: 0.1 });
    trackPathMaterial(ringLineMat);
    const ringMid = (RING_ROAD_RADII.inner + RING_ROAD_RADII.outer) / 2;
    addRing(ringMid - 0.04, ringMid + 0.04, ringLineMat, SURFACE_Y.roadMarking, RENDER_ORDER.roadMarking);

    const pedestrianMat = createLayerMaterial({ color: 0xb9b8b3, roughness: 0.9, tex: 'pavement', rx: 3, ry: 3 });
    trackPathMaterial(pedestrianMat);
    addRing(2.25, 3, pedestrianMat, SURFACE_Y.roadSurface, RENDER_ORDER.road);

    // ── 星语北城（North district）：地面、道路与公园 ─────────────────
    // 地面：与主城 district 层同色调同贴图（暖灰），让北城读作主城地面
    // 的自然延伸；绿色只保留给公园与绿地斑块，避免「贴上去的绿洲」感。
    const northGroundMat = createLayerMaterial({ color: isNight ? 0xb4b0a4 : 0xe0d8cc, roughness: 1, tex: 'ground2', rx: 18, ry: 12 });
    const northGround = createMesh(
      new THREE.PlaneGeometry(NORTH_DISTRICT_AREA.ground.maxX - NORTH_DISTRICT_AREA.ground.minX, NORTH_DISTRICT_AREA.ground.maxZ - NORTH_DISTRICT_AREA.ground.minZ),
      northGroundMat,
    );
    northGround.rotation.x = -Math.PI / 2;
    northGround.position.set(
      (NORTH_DISTRICT_AREA.ground.minX + NORTH_DISTRICT_AREA.ground.maxX) / 2,
      SURFACE_Y.district,
      (NORTH_DISTRICT_AREA.ground.minZ + NORTH_DISTRICT_AREA.ground.maxZ) / 2,
    );
    northGround.receiveShadow = true;
    northGround.renderOrder = RENDER_ORDER.district;
    scene.add(northGround);
    groundMaterials.push({ mat: northGroundMat, day: 0xe0d8cc, night: 0xb4b0a4 });

    // 街区绿地斑块：主城在 ±24 处铺 24×24 草坪，北城以同色调草坪呼应
    // （两坊南缘的共享绿地），密度低于公园、高于零。
    const northLawnMat = createLayerMaterial({ color: isNight ? 0x6a7a50 : 0xc0d0a0, roughness: 1, tex: 'ground4', rx: 5, ry: 4 });
    trackPathMaterial(northLawnMat);
    ([[-19.5, -82.6, 18, 3.6], [10.5, -82.6, 10, 3.6]] as Array<[number, number, number, number]>).forEach(([x, z, w, d]) => {
      const lawn = createMesh(new THREE.PlaneGeometry(w, d), northLawnMat);
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(x, SURFACE_Y.landscape, z);
      lawn.receiveShadow = true;
      lawn.renderOrder = RENDER_ORDER.landscape;
      lawn.userData.district = 'north-district';
      scene.add(lawn);
    });

    // 公园草地板（星语公园，东北角）。
    const parkMat = createLayerMaterial({ color: isNight ? 0x6a7a50 : 0xc0d0a0, roughness: 1, tex: 'ground4', rx: 4, ry: 5 });
    const park = createMesh(
      new THREE.PlaneGeometry(NORTH_DISTRICT_AREA.park.maxX - NORTH_DISTRICT_AREA.park.minX, NORTH_DISTRICT_AREA.park.maxZ - NORTH_DISTRICT_AREA.park.minZ),
      parkMat,
    );
    park.rotation.x = -Math.PI / 2;
    park.position.set(
      (NORTH_DISTRICT_AREA.park.minX + NORTH_DISTRICT_AREA.park.maxX) / 2,
      SURFACE_Y.landscape,
      (NORTH_DISTRICT_AREA.park.minZ + NORTH_DISTRICT_AREA.park.maxZ) / 2,
    );
    park.receiveShadow = true;
    park.renderOrder = RENDER_ORDER.landscape;
    scene.add(park);
    groundMaterials.push({ mat: parkMat, day: 0xc0d0a0, night: 0x6a7a50 });

    // 中央大道（沥青）——与主城南北主轴经 z=-40 步道、环城路无缝相接。
    {
      const [x1, z1, x2, z2] = NORTH_DISTRICT_AREA.avenueSegment as [number, number, number, number];
      addRoadSegment(
        NORTH_DISTRICT_AREA.roadWidth,
        Math.abs(z2 - z1),
        (x1 + x2) / 2,
        (z1 + z2) / 2,
        true,
        'asphalt',
        'north-district',
      );
      // 大道两侧人行道：在横街交叉口处断开，避免与巷道路面共面重叠。
      const sidewalkMat = createLayerMaterial({ color: isNight ? 0xa8a7a1 : 0xd4d3ce, roughness: 0.95, tex: 'pavement', rx: 1, ry: 6 });
      trackPathMaterial(sidewalkMat);
      const crossings = NORTH_DISTRICT_AREA.crosswalkZs;
      const spanStart = NORTH_DISTRICT_AREA.avenueSegment[1] - 0.4;
      const spanEnd = NORTH_DISTRICT_AREA.avenueSegment[3] + 0.4;
      const gapHalf = NORTH_DISTRICT_AREA.laneWidth / 2 + 0.55;
      const walkX = NORTH_DISTRICT_AREA.roadWidth / 2 + 0.45;
      const sidewalkRuns: Array<[number, number]> = [];
      let cursor = spanStart;
      for (const crossing of crossings) {
        sidewalkRuns.push([cursor, crossing - gapHalf]);
        cursor = crossing + gapHalf;
      }
      sidewalkRuns.push([cursor, spanEnd]);
      sidewalkRuns.forEach(([z1, z2]) => {
        if (z2 - z1 < 0.4) return;
        [-walkX, walkX].forEach((x) => {
          const walk = createMesh(new THREE.BoxGeometry(0.7, 0.04, z2 - z1), sidewalkMat);
          walk.position.set(x, SURFACE_Y.road, (z1 + z2) / 2);
          walk.renderOrder = RENDER_ORDER.road;
          walk.receiveShadow = true;
          walk.userData.district = 'north-district';
          scene.add(walk);
        });
      });
      // 斑马线：白色短划横排，与主城路口观感一致（roadMarking 层）。
      const zebraMat = createLayerMaterial({ color: 0xe8e7e4, roughness: 0.7 });
      trackPathMaterial(zebraMat);
      crossings.forEach((crossing) => {
        for (let i = -2; i <= 2; i++) {
          addMarking(new THREE.BoxGeometry(0.34, 0.008, 1.1), zebraMat, i * 0.5, crossing);
        }
      });
    }

    // 人行道街巷：支路（z=-44.5/-54.5/-64.5，宽 streetWidth）+ 巷道
    // （laneWidth）。按两端点方向旋转绘制（与 Echo 区渲染同法）。
    const northLaneMat = createLayerMaterial({ color: pathColor, roughness: 1, tex: 'pavement', rx: 1, ry: 4 });
    trackPathMaterial(northLaneMat);
    NORTH_DISTRICT_AREA.laneSegments.forEach((segment) => {
      const [x1, z1, x2, z2] = segment as [number, number, number, number];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      const isWideStreet = Math.abs(dx) > Math.abs(dz)
        && NORTH_DISTRICT_AREA.wideStreetZs.includes((z1 + z2) / 2);
      const width = isWideStreet ? NORTH_DISTRICT_AREA.streetWidth : NORTH_DISTRICT_AREA.laneWidth;
      const lane = createMesh(new THREE.BoxGeometry(width, 0.04, length), northLaneMat);
      lane.position.set((x1 + x2) / 2, SURFACE_Y.road, (z1 + z2) / 2);
      lane.rotation.y = -Math.atan2(dx, dz);
      lane.renderOrder = RENDER_ORDER.road;
      lane.receiveShadow = true;
      lane.userData.district = 'north-district';
      scene.add(lane);
    });

    // 路口小广场：内部巷与支路交汇处的圆形铺装（roadSurface 层，盖过
    // 路口、低于中心线标记），中心树由 streetTrees 提供。
    const plazaMat = createLayerMaterial({ color: isNight ? 0xa8a7a1 : 0xd0cfca, roughness: 0.92, tex: 'pavement', rx: 2, ry: 2 });
    trackPathMaterial(plazaMat);
    NORTH_DISTRICT_AREA.plazaSpots.forEach(([x, z]) => {
      const plaza = createMesh(new THREE.CircleGeometry(2.1, 24), plazaMat);
      plaza.rotation.x = -Math.PI / 2;
      plaza.position.set(x, SURFACE_Y.roadSurface, z);
      plaza.renderOrder = RENDER_ORDER.road;
      plaza.receiveShadow = true;
      plaza.userData.district = 'north-district';
      scene.add(plaza);
    });

    // 作品街区（博物馆区）：四个大街坊的整片院落铺装——地标建筑、树阵
    // 与长椅都落在这层连续的城市肌理上，而不是各自脚下一块孤立垫层。
    const courtyardMat = createLayerMaterial({ color: isNight ? 0xaba9a3 : 0xdedcd7, roughness: 0.95, tex: 'ground5', rx: 8, ry: 5 });
    trackPathMaterial(courtyardMat);
    NORTH_DISTRICT_AREA.landmarkBlocks.forEach(([minX, minZ, maxX, maxZ]) => {
      const block = createMesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), courtyardMat);
      block.rotation.x = -Math.PI / 2;
      block.position.set((minX + maxX) / 2, SURFACE_Y.landscape + 0.006, (minZ + maxZ) / 2);
      block.receiveShadow = true;
      block.renderOrder = RENDER_ORDER.landscape;
      block.userData.district = 'north-district';
      scene.add(block);
    });

    // 地标 parcel 垫层：12 处作品建筑的建设地块统一为 pavement 基面，
    // 让两排作品街区在项目筹资前也呈现「预留地块」的城市肌理，而不是
    // 零散色块。坐标取自 BUILDING_DEFS（north_* 唯一事实来源）；尺寸
    // 必须盖过各 north_*.ts 自带的 plot 方块（4.0–6.4），再留 0.5 边距。
    const northPadSizes: Record<string, [number, number]> = {
      chat_plaza: [7.4, 6.6], pigeon_square: [7.2, 7.2], planetarium: [6.8, 6.8],
      singularity: [6.0, 6.0], binary_garden: [6.0, 6.0], ziggurat: [7.0, 7.0],
      monolith: [5.2, 5.2], worry_store: [5.0, 5.0], bistro: [5.2, 5.2],
      night_kiosk: [4.8, 4.8], jukebox: [4.6, 4.6], backrooms_door: [4.6, 4.6],
    };
    const northPadMat = createLayerMaterial({ color: isNight ? 0xa3a29c : 0xdcdad6, roughness: 0.92, tex: 'ground5', rx: 2, ry: 2 });
    trackPathMaterial(northPadMat);
    BUILDING_DEFS.filter((definition) => definition.id.startsWith('north_')).forEach((definition) => {
      const padSize = northPadSizes[definition.shape];
      if (!padSize) return;
      const pad = createMesh(new THREE.PlaneGeometry(padSize[0], padSize[1]), northPadMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(definition.x, 0.054, definition.z);
      pad.receiveShadow = true;
      pad.renderOrder = RENDER_ORDER.road;
      pad.userData.district = 'north-district';
      scene.add(pad);
    });

    // 中央大道中心虚线（与主城主路同规格的黄色短划）。
    const northLineMat = createLayerMaterial({ color: 0xe8b34b, roughness: 0.6, metalness: 0.1 });
    trackPathMaterial(northLineMat);
    for (let z = -41.5; z >= -78.5; z -= 2.4) {
      addMarking(new THREE.BoxGeometry(0.07, 0.008, 1.15), northLineMat, 0, z);
    }

    addLamps(NORTH_DISTRICT_AREA.lampPositions.map(([x, z]) => [x, 0, z] as const));
  }

  function addMarking(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number): void {
    const marking = createMesh(geometry, material);
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

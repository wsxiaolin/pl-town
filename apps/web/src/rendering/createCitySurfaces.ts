import * as THREE from 'three';
import { RENDER_ORDER, SURFACE_Y } from './layers';
import { ECHO_OBSERVATORY_AREA, MAIN_ROAD_WIDTH } from '../city/data/cityConfig';
import { classifyZone, zoneBoundariesAlongAxis, type ZoneId } from '../city/data/cityZones';
import { batchRetainedStaticMeshes, batchStaticMeshes, type RetainedStaticMeshBatch } from './staticMeshBatcher';
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

export type CitySurfacesApi = {
  setZoneRoadsVisible: (zone: ZoneId, visible: boolean) => void;
};

export function createCitySurfaces(options: CitySurfaceOptions): CitySurfacesApi {
  const {
    scene,
    isNight,
    roadCoords,
    cityLimit,
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

  // ── 分区道路容器：每个分区一个 Group，配合 retained 批处理按区显隐 ──
  const zoneRoadBuckets = new Map<ZoneId, THREE.Group>();
  const zoneRoadHandles: Array<{ zone: ZoneId; key: string; root: THREE.Group; batch: RetainedStaticMeshBatch }> = [];
  const zoneBucket = (zone: ZoneId): THREE.Group => {
    let bucket = zoneRoadBuckets.get(zone);
    if (!bucket) {
      bucket = new THREE.Group();
      bucket.name = `zone-roads:${zone}`;
      zoneRoadBuckets.set(zone, bucket);
      scene.add(bucket);
    }
    return bucket;
  };

  addGround();
  addPaths();
  const zoneRoadBucketSet = new Set<THREE.Object3D>(zoneRoadBuckets.values());
  zoneRoadBuckets.forEach((root, zone) => {
    const key = `zone-roads:${zone}`;
    zoneRoadHandles.push({ zone, key, root, batch: batchRetainedStaticMeshes(scene, [{ key, root }]) });
  });
  // 两条黑色主干道（x=0 / z=0）及其标线永远可见，不进入分区容器。
  batchStaticMeshes(scene, scene.children.filter((child) => !existingSceneChildren.has(child) && !zoneRoadBucketSet.has(child)));

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
    const roadWidth = (position: number) => position === 0 ? MAIN_ROAD_WIDTH : (Math.abs(position) === 6 || Math.abs(position) === 12 ? 1.5 : 1.0);

    // 进入分区容器的路段：按 (x,z) 自动归类，或用 zoneOverride 显式指定。
    const addZoneRoadSegment = (width: number, depth: number, x: number, z: number, texture = 'pavement', district = '', zoneOverride?: ZoneId) => {
      const material = createLayerMaterial({
        color: pathColor,
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
      if (district) road.userData.district = district;
      zoneBucket(zoneOverride ?? classifyZone(x, z)).add(road);
    };

    // 把 [start,end] 沿可变轴按分类边界切开，保证每段只属于一个分区。
    const emitZoneSplitRoads = (axis: 'x' | 'z', fixed: number, start: number, end: number, width: number, texture = 'pavement') => {
      if (end <= start) return;
      const cuts = zoneBoundariesAlongAxis(fixed)
        .filter((cut) => cut > start && cut < end)
        .sort((left, right) => left - right);
      const stops = [start, ...cuts, end];
      for (let index = 0; index < stops.length - 1; index += 1) {
        const pieceStart = stops[index]!;
        const pieceEnd = stops[index + 1]!;
        if (pieceEnd - pieceStart < 0.05) continue;
        const center = (pieceStart + pieceEnd) / 2;
        if (axis === 'x') addZoneRoadSegment(pieceEnd - pieceStart, width, center, fixed, texture);
        else addZoneRoadSegment(width, pieceEnd - pieceStart, fixed, center, texture);
      }
    };

    // ── 两条黑色主干道（含划线、斑马线）永远可见 ──
    const addRoadSegment = (width: number, depth: number, x: number, z: number, main = false, texture = 'road') => {
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
      scene.add(road);
    };

    addRoadSegment(MAIN_ROAD_WIDTH, 35.8, 0, -21.1, true, 'asphalt');
    addRoadSegment(MAIN_ROAD_WIDTH, 35.8, 0, 21.1, true, 'asphalt');
    addRoadSegment(38.8, MAIN_ROAD_WIDTH, -23.6, 0, true, 'asphalt');
    addRoadSegment(38.8, MAIN_ROAD_WIDTH, 23.6, 0, true, 'asphalt');
    // 主干道与环路之间的两小段引道，归对应外区。
    addZoneRoadSegment(MAIN_ROAD_WIDTH, 2.0, 0, -39.0);
    addZoneRoadSegment(MAIN_ROAD_WIDTH, 2.0, 0, 39.0);

    // 观测台延伸道路整条归东延伸区。
    ECHO_OBSERVATORY_AREA.roadSegments.forEach((segment) => {
      const [x1, z1, x2, z2] = segment as [number, number, number, number];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      const material = createLayerMaterial({
        color: pathColor,
        roughness: 1,
        tex: 'pavement',
        rx: 1,
        ry: Math.max(1, length / 3),
      });
      const road = createMesh(new THREE.BoxGeometry(1.35, 0.04, length), material);
      road.position.set((x1 + x2) / 2, SURFACE_Y.road, (z1 + z2) / 2);
      road.rotation.y = -Math.atan2(dx, dz);
      road.renderOrder = RENDER_ORDER.road;
      road.receiveShadow = true;
      road.userData.district = 'echo-observatory-road';
      zoneBucket('ext_east').add(road);
    });
    addLamps([[44, 0, -1.3], [52, 0, 1.3], [60, 0, -1.3], [66, 0, 1.3]]);

    const minorCoords = roadCoords.filter((position) => position !== 0);
    for (const position of minorCoords) {
      const width = roadWidth(position);
      // 纵向道路：原本是 ±18.6 处两整段，现在按分区边界切开。
      emitZoneSplitRoads('z', position, 2.2, 35, width);
      emitZoneSplitRoads('z', position, -35, -2.2, width);
    }

    const boundaries = [-cityLimit, ...roadCoords, cityLimit];
    for (const z of minorCoords) {
      const width = roadWidth(z);
      for (let index = 0; index < boundaries.length - 1; index++) {
        const left = boundaries[index]!;
        const right = boundaries[index + 1]!;
        const start = left + (roadCoords.includes(left) ? roadWidth(left) / 2 : 0);
        const end = right - (roadCoords.includes(right) ? roadWidth(right) / 2 : 0);
        if (end > start) emitZoneSplitRoads('x', z, start, end, width, 'pavement');
      }
    }

    const lineMat = createLayerMaterial({ color: 0xe8b34b, roughness: 0.6, metalness: 0.1 });
    trackPathMaterial(lineMat);
    for (let position = -36; position <= 36; position += 2.4) {
      if (Math.abs(position) < 2.8) continue;
      addMarking(new THREE.BoxGeometry(0.07, 0.008, 1.15), lineMat, 0, position);
      addMarking(new THREE.BoxGeometry(1.15, 0.008, 0.07), lineMat, position, 0);
    }

    // Keep crosswalks at half of the grid intersections while retaining a
    // deterministic spread along the main roads.
    const nonZeroRoadCoords = roadCoords.filter((position) => position !== 0);
    const crosswalkRoadCoords = nonZeroRoadCoords
      .filter((_, index) => index % 2 === 0)
      .slice(0, Math.ceil(nonZeroRoadCoords.length / 2));
    for (const x of crosswalkRoadCoords) {
      const material = createLayerMaterial({ color: 0xf0f0ec, roughness: 0.85, tex: 'crosswalkRotated', rx: 1, ry: 1 });
      trackPathMaterial(material);
      addMarking(new THREE.BoxGeometry(roadWidth(x), 0.005, MAIN_ROAD_WIDTH), material, x, 0);
    }
    for (const z of crosswalkRoadCoords) {
      const material = createLayerMaterial({ color: 0xf0f0ec, roughness: 0.85, tex: 'crosswalk', rx: 1, ry: 1 });
      trackPathMaterial(material);
      addMarking(new THREE.BoxGeometry(MAIN_ROAD_WIDTH, 0.005, roadWidth(z)), material, 0, z);
    }

    // ── 环状路：按象限拆成 4 段圆弧，归四个外区 ──
    const ringMat = createLayerMaterial({ color: 0xb8b5ae, roughness: 0.95, tex: 'pavement', rx: 8, ry: 8 });
    trackPathMaterial(ringMat);
    const ringLineMat = createLayerMaterial({ color: 0xe8b34b, roughness: 0.6, metalness: 0.1 });
    trackPathMaterial(ringLineMat);
    const ringArcs: Array<{ zone: ZoneId; thetaStart: number }> = [
      { zone: 'outer_north', thetaStart: Math.PI / 4 },
      { zone: 'outer_west', thetaStart: (Math.PI * 3) / 4 },
      { zone: 'outer_south', thetaStart: (Math.PI * 5) / 4 },
      { zone: 'outer_east', thetaStart: -Math.PI / 4 },
    ];
    for (const arc of ringArcs) {
      addZoneRing(37, 39, ringMat, SURFACE_Y.roadSurface, RENDER_ORDER.road, arc.zone, arc.thetaStart);
      addZoneRing(37.96, 38.04, ringLineMat, SURFACE_Y.roadMarking, RENDER_ORDER.roadMarking, arc.zone, arc.thetaStart);
    }

    for (let index = 0; index < 8; index++) {
      const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
      addLamps([[Math.cos(angle) * 38, 0, Math.sin(angle) * 38]]);
    }

    // 中央喷泉周围的人行环道，归内区。
    const pedestrianMat = createLayerMaterial({ color: 0xb9b8b3, roughness: 0.9, tex: 'pavement', rx: 3, ry: 3 });
    trackPathMaterial(pedestrianMat);
    const pedestrianRing = new THREE.Mesh(new THREE.RingGeometry(2.25, 3, 48), pedestrianMat);
    pedestrianRing.rotation.x = -Math.PI / 2;
    pedestrianRing.position.y = SURFACE_Y.roadSurface;
    pedestrianRing.renderOrder = RENDER_ORDER.road;
    pedestrianRing.receiveShadow = true;
    zoneBucket('inner').add(pedestrianRing);
  }

  function addMarking(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, z: number): void {
    const marking = createMesh(geometry, material);
    marking.position.set(x, SURFACE_Y.roadMarking, z);
    marking.renderOrder = RENDER_ORDER.roadMarking;
    scene.add(marking);
  }

  function addZoneRing(inner: number, outer: number, material: THREE.Material, y: number, renderOrder: number, zone: ZoneId, thetaStart: number): void {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 28, thetaStart, Math.PI / 2), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = y;
    ring.renderOrder = renderOrder;
    ring.receiveShadow = true;
    zoneBucket(zone).add(ring);
  }

  return {
    setZoneRoadsVisible: (zone: ZoneId, visible: boolean) => {
      for (const handle of zoneRoadHandles) {
        if (handle.zone !== zone) continue;
        handle.batch.setVisible(handle.key, visible);
        handle.root.visible = visible;
      }
    },
  };
}

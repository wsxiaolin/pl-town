// Procedural city decoration catalog and its instanced rendering resources.
import * as THREE from 'three';
import { InstancedBatch } from '../core/InstancedBatch';
import { ResourcePool } from '../core/ResourcePool';
import { RENDER_ORDER, SURFACE_Y } from './layers';
import { createResidenceModel, residenceStyleSeedForLot } from './residenceStyles';
import { footprintOverlapsMainRoad, isFilmCityClearing, MAIN_ROAD_WIDTH, NORTH_DISTRICT_AREA } from '../city/data/cityConfig';
import { batchRetainedStaticMeshes, batchStaticMeshes, type RetainedStaticMeshBatch, type RetainedStaticMeshRoot } from './staticMeshBatcher';
import type { MaterialParameters, MeshHelpers } from './meshFactory';
import type { BuildingEntity, ResidenceEntity } from '../city/buildingEntity';

type Palette = Record<string, number>;

type Vec3 = readonly [number, number, number];

export interface WorldDecorationsOptions {
  scene: THREE.Scene;
  resources: ResourcePool;
  palette: Palette;
  roadCoords: readonly number[];
  cityLimit: number;
  buildings: BuildingEntity[];
  residences: ResidenceEntity[];
  lampMaterials: THREE.MeshStandardMaterial[];
  getIsNight: () => boolean;
  makeMaterial: MeshHelpers['stdMat'];
  addPart: MeshHelpers['part'];
  addRaycastGroup: (group: THREE.Object3D) => void;
  addObstacleGroup?: (group: THREE.Object3D) => void;
}

export function createWorldDecorations(options: WorldDecorationsOptions) {
  const {
    scene, resources, palette: P, roadCoords: ROAD_COORDS, cityLimit: CITY_LIMIT,
    buildings, residences, lampMaterials: lampGlobes,
    getIsNight, makeMaterial: stdMat, addPart: part, addRaycastGroup,
    addObstacleGroup,
  } = options;
  let lampPosts: InstancedBatch | undefined, lampLights: InstancedBatch | undefined;
  let treeTrunks: InstancedBatch | undefined, treeCrowns: InstancedBatch | undefined;
  let decorationObstacleBounds: THREE.Box3[] | null = null;
  let residenceVisualBatch: RetainedStaticMeshBatch | null = null;
  const residenceRoots: RetainedStaticMeshRoot[] = [];
  const interactiveDecorationRoots = new Set<THREE.Object3D>();
  const orangeGroveCenter={x:-15,z:-3};
  const roadWidth=(position: number)=>position===0?MAIN_ROAD_WIDTH:(Math.abs(position)===6||Math.abs(position)===12?1.5:1.0);

  function treeCenterIsOnRoad(x: number, z: number) {
    return ROAD_COORDS.some((position) => Math.abs(x - position) <= roadWidth(position) / 2
      || Math.abs(z - position) <= roadWidth(position) / 2);
  }

  // ── Building ground plots ──
  function addDecorations() {
    const existingSceneChildren = new Set(scene.children);
    addDistrictBuildings();
    addNorthDistrictResidences();
    addNorthDistrictScenery();
    addSignpost(-4.0,0,-5.0);
    addSuburbHouse(12, 32, 90);
    addSuburbHouse(-12, -32, -90);
    const decorationRoots = scene.children.filter((child)=>!existingSceneChildren.has(child));
    batchStaticMeshes(scene, decorationRoots, interactiveDecorationRoots);
    residenceVisualBatch = batchRetainedStaticMeshes(scene, residenceRoots);
  }

  function addDistrictBuildings() {
    const centers=[-33,-27,-21,-15,-9,-3,3,9,15,21,27,33], lots: Array<[number, number, number]> = [];
    // Keep these landmark coordinates reserved as an explicit intent marker;
    // buildingBounds below also blocks their current building footprints.
    const reservedSpecialLots = new Set(['32,-8', '28,2', '33,3']);
    const buildingBounds=buildings.map((building)=>({
      building,
      box: new THREE.Box3().setFromObject(building.group),
    }));
    centers.forEach(x=>centers.forEach(z=>{
      if(Math.hypot(x,z)<4.8)return;
      const dist=Math.max(Math.abs(x),Math.abs(z));
      const density = dist>24 ? 0.5 : dist>12 ? 0.8 : 1;
      const pairs: Array<[number, number]> = [[0,0],[-1.35,1.15],[1.25,-1.2]];
      pairs.forEach(([dx,dz],k)=>{
        const seeded=Math.abs(Math.round((x+41)*97+(z+43)*193+k*389))%1000/1000;
        if(seeded>density)return;
        const lx=x+dx, lz=z+dz;
        if(isFilmCityClearing(lx,lz))return;
        if(Math.abs(lx)>CITY_LIMIT||Math.abs(lz)>CITY_LIMIT)return;
        if(reservedSpecialLots.has(`${Math.round(lx)},${Math.round(lz)}`))return;
        if(footprintOverlapsMainRoad(lx,lz,1.1))return;
        // Reserve a complete clearing for the interactive mandarin tree.
        if(Math.hypot(lx-orangeGroveCenter.x,lz-orangeGroveCenter.z)<2.4)return;
        const blocked=buildingBounds.some(({building,box})=>{
          const clearance=building.decorationClearance ?? 1.35;
          return lx>=box.min.x-clearance&&lx<=box.max.x+clearance
            &&lz>=box.min.z-clearance&&lz<=box.max.z+clearance;
        });
        if(!blocked) lots.push([lx,lz,(Math.abs(Math.round(lx+lz))+k)%3]);
      });
    }));
    lots.forEach(([x,z,t])=>addSmallBlock(x,0,z,t));
    decorationObstacleBounds=null;
  }

  // 星语北城民居批次：配置驱动（NORTH_DISTRICT_AREA.residenceLots），
  // 复用主城 addSmallBlock（可认领住宅实体 + 导航障碍 + 标签批次）。
  // 地块统一 pavement 色调：随机取色会抽到与北城基底同色的 0xE0D8CC，
  // 让部分民居看起来「没有地板」。
  function addNorthDistrictResidences() {
    NORTH_DISTRICT_AREA.residenceLots.forEach(([x, z], index) => {
      addSmallBlock(x, 0, z, index % 3, { color: 0xdcdad6, tex: 'ground5' });
    });
  }

  // 星语北城街景：北城门石柱、街景小屋（不可认领）、行道树与大道长椅。
  // 全部为主城既有装饰语汇的复用，让北城在作品建筑筹资前就有街区生活气。
  function addNorthDistrictScenery() {
    addNorthGate(NORTH_DISTRICT_AREA.gate.x, NORTH_DISTRICT_AREA.gate.z);
    NORTH_DISTRICT_AREA.sceneryHouses.forEach(([x, z, rotDeg]) => addSuburbHouse(x, z, rotDeg, true));
    addTrees(NORTH_DISTRICT_AREA.streetTrees.map(([x, z]) => [x, 0, z] as const));
    addBench(-2.6, 0, -47.2, Math.PI / 2);
    addBench(2.6, 0, -62.6, -Math.PI / 2);
    addBench(-2.6, 0, -71.8, Math.PI / 2);
    // 内部巷口小广场的座椅（朝向广场中心）。
    addBench(-17.5, 0, -63.3, Math.PI);
    addBench(13.6, 0, -63.3, Math.PI);
    // 作品街区（博物馆区）内部的长椅：落在垫层间隙，供居民歇脚。
    addBench(-20.5, 0, -49.5, 0);
    addBench(-19.9, 0, -59.5, 0);
    addBench(26, 0, -59.5, 0);
    addNorthCommunityProps();
  }

  // 居住坊的社区生活层：宅前小路（每户直连最近横街）、绿篱边界与院落
  // 道具（菜畦/晾衣绳/信报箱/垃圾桶/花坛/小游园）——让民居坊读作有
  // 日常生活的「小区」而不是几排孤立的房子。
  function addNorthCommunityProps() {
    const pavementMat = stdMat({ color: getIsNight() ? 0x9d9c97 : 0xc6c5c0, roughness: 0.95, tex: 'pavement', rx: 1, ry: 1 });
    pavementMat.depthWrite = false;
    // 宅前小路：每个可认领民居沿 z 向连到最近的横街（-64.5 / -74 / -80）。
    // 起点在地块边缘之外（地块 2.2 宽），避免路面切进住宅地板。
    NORTH_DISTRICT_AREA.residenceLots.forEach(([x, z]) => {
      const streets = [-64.5, -74, -80];
      const street = streets.reduce((best, s) => Math.abs(z - s) < Math.abs(z - best) ? s : best, streets[0]!);
      const startZ = z + (street > z ? 1.15 : -1.15);
      const endZ = street + (street > z ? 0.7 : -0.7);
      const length = Math.abs(endZ - startZ);
      if (length < 0.3) return;
      const path = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.035, length), pavementMat);
      path.position.set(x, SURFACE_Y.buildingPlot, (startZ + endZ) / 2);
      path.renderOrder = RENDER_ORDER.buildingPlot;
      path.receiveShadow = true;
      scene.add(path);
    });
    // 绿篱：沿 run 逐段摆放，带轻微高度抖动。
    const hedgeMat = stdMat({ color: getIsNight() ? 0x43603a : 0x5f8f49, roughness: 0.95, tex: 'grass', rx: 1, ry: 1 });
    NORTH_DISTRICT_AREA.hedgeRuns.forEach(([x1, z1, x2, z2]) => {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const count = Math.round(length / 0.55);
      const rotY = -Math.atan2(x2 - x1, z2 - z1);
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const hedge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26 + ((i * 7) % 3) * 0.03, 0.6), hedgeMat);
        hedge.position.set(x1 + (x2 - x1) * t, 0.13, z1 + (z2 - z1) * t);
        hedge.rotation.y = rotY;
        hedge.castShadow = true;
        scene.add(hedge);
      }
    });
    NORTH_DISTRICT_AREA.yardProps.forEach(([x, z, kind]) => addYardProp(x, z, kind));
  }

  // 单个院落道具：全部程序化小件，与主城装饰同一材质语汇。
  function addYardProp(x: number, z: number, kind: string) {
    const g = new THREE.Group();
    const metal = { color: 0xb5b2ac, roughness: 0.45, metalness: 0.5, tex: 'metal', rx: 1, ry: 1 };
    switch (kind) {
      case 'tree':
        part(g, new THREE.CylinderGeometry(0.06, 0.09, 0.38, 8), { color: 0x6a4a2a, roughness: 0.9 }, [0, 0.19, 0]);
        part(g, new THREE.SphereGeometry(0.3, 12, 12), { color: 0x6f9f4f, roughness: 0.85 }, [0, 0.66, 0]);
        break;
      case 'bin':
        part(g, new THREE.CylinderGeometry(0.14, 0.12, 0.4, 10), { color: 0x3f5a44, roughness: 0.6 }, [0, 0.2, 0]);
        part(g, new THREE.CylinderGeometry(0.15, 0.15, 0.05, 10), { color: 0x35483a, roughness: 0.6 }, [0, 0.42, 0]);
        break;
      case 'mailbox':
        part(g, new THREE.CylinderGeometry(0.03, 0.035, 0.55, 8), metal, [0, 0.28, 0]);
        part(g, new THREE.BoxGeometry(0.26, 0.2, 0.14), { color: 0x4a6a9a, roughness: 0.5 }, [0, 0.62, 0]);
        break;
      case 'planter':
        part(g, new THREE.BoxGeometry(0.6, 0.24, 0.44), { color: 0xcdccca, roughness: 0.8, tex: 'stone', rx: 1, ry: 1 }, [0, 0.12, 0]);
        part(g, new THREE.BoxGeometry(0.52, 0.08, 0.36), { color: 0x5f8f49, roughness: 0.95 }, [0, 0.27, 0]);
        part(g, new THREE.SphereGeometry(0.06, 8, 8), { color: 0xe8a838, roughness: 0.6 }, [0.12, 0.34, 0], false);
        part(g, new THREE.SphereGeometry(0.06, 8, 8), { color: 0xd86a6a, roughness: 0.6 }, [-0.14, 0.34, 0.04], false);
        break;
      case 'bikeRack':
        part(g, new THREE.BoxGeometry(0.05, 0.5, 0.05), metal, [-0.3, 0.25, 0]);
        part(g, new THREE.BoxGeometry(0.05, 0.5, 0.05), metal, [0.3, 0.25, 0]);
        part(g, new THREE.BoxGeometry(0.66, 0.05, 0.05), metal, [0, 0.5, 0]);
        break;
      case 'clothesline':
        ([-0.95, 0.95] as const).forEach((px) => {
          part(g, new THREE.CylinderGeometry(0.03, 0.04, 1.25, 8), { color: 0x8a6a42, roughness: 0.8, tex: 'wood', rx: 1, ry: 1 }, [px, 0.62, 0]);
          part(g, new THREE.BoxGeometry(0.3, 0.04, 0.04), { color: 0x8a6a42, roughness: 0.8 }, [px, 1.2, 0], false);
        });
        part(g, new THREE.BoxGeometry(1.9, 0.018, 0.018), { color: 0xd8d7d2, roughness: 0.6 }, [0, 1.18, 0], false);
        part(g, new THREE.BoxGeometry(0.24, 0.18, 0.03), { color: 0x9ac7dc, roughness: 0.7 }, [-0.4, 1.05, 0], false);
        part(g, new THREE.BoxGeometry(0.24, 0.18, 0.03), { color: 0xe8d5a8, roughness: 0.7 }, [0.38, 1.04, 0], false);
        break;
      case 'garden': {
        part(g, new THREE.BoxGeometry(1.7, 0.06, 1.05), { color: P.FIELD, roughness: 1, tex: 'field', rx: 1, ry: 1 }, [0, 0.04, 0]);
        [0, 1, 2].forEach((row) => {
          [0, 1, 2, 3].forEach((col) => {
            part(g, new THREE.SphereGeometry(0.075, 8, 8), { color: row % 2 ? 0x6f9f4f : 0x87b45c, roughness: 0.95 }, [-0.55 + col * 0.37, 0.14, -0.3 + row * 0.3], false);
          });
        });
        break;
      }
      case 'sandpit':
        part(g, new THREE.CylinderGeometry(0.9, 0.95, 0.05, 18), { color: 0xd9c692, roughness: 1, tex: 'ground', rx: 1, ry: 1 }, [0, 0.03, 0]);
        part(g, new THREE.TorusGeometry(0.92, 0.05, 6, 20), { color: 0xb5a37c, roughness: 0.85 }, [0, 0.06, 0], false).rotation.x = Math.PI / 2;
        part(g, new THREE.CylinderGeometry(0.06, 0.05, 0.14, 8), { color: 0xe8a838, roughness: 0.5 }, [0.3, 0.12, 0.2], false);
        break;
      case 'swing': {
        ([[-0.6, 0.25], [-0.6, -0.25], [0.6, 0.25], [0.6, -0.25]] as Array<[number, number]>).forEach(([px, pz]) => {
          const leg = part(g, new THREE.BoxGeometry(0.06, 1.35, 0.06), metal, [px, 0.62, pz]);
          leg.rotation.z = px < 0 ? 0.18 : -0.18;
        });
        part(g, new THREE.BoxGeometry(1.5, 0.06, 0.06), metal, [0, 1.28, 0]);
        part(g, new THREE.BoxGeometry(0.02, 0.5, 0.02), metal, [-0.22, 1.0, 0], false);
        part(g, new THREE.BoxGeometry(0.02, 0.5, 0.02), metal, [0.22, 1.0, 0], false);
        part(g, new THREE.BoxGeometry(0.5, 0.05, 0.16), { color: 0x9b6b3f, roughness: 0.7, tex: 'wood', rx: 1, ry: 1 }, [0, 0.74, 0], false);
        break;
      }
      case 'tap':
        part(g, new THREE.CylinderGeometry(0.045, 0.055, 0.75, 8), metal, [0, 0.37, 0]);
        part(g, new THREE.BoxGeometry(0.2, 0.04, 0.04), metal, [0.08, 0.68, 0], false);
        part(g, new THREE.CylinderGeometry(0.16, 0.18, 0.06, 12), { color: 0x9ac7dc, roughness: 0.2, metalness: 0.2 }, [0.14, 0.04, 0.06], false);
        break;
      case 'bench':
        addBench(x, 0, z, 0);
        return;
      default:
        return;
    }
    g.position.set(x, 0, z);
    scene.add(g);
  }

  // 北城门：跨中央大道的石柱横梁（比主城 addArch 更宽的城区门户）。
  function addNorthGate(x: number, z: number) {
    const g = new THREE.Group();
    const stone = { color: 0xecebe8, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 };
    const trim = { color: 0xe8a838, roughness: 0.35, metalness: 0.4 };
    [-2.1, 2.1].forEach((px) => {
      part(g, new THREE.BoxGeometry(0.34, 2.0, 0.34), stone, [px, 1.0, 0]);
      part(g, new THREE.BoxGeometry(0.5, 0.14, 0.5), stone, [px, 2.05, 0]);
      part(g, new THREE.SphereGeometry(0.11, 10, 10), trim, [px, 2.2, 0], false);
    });
    // 石梁 + 梁下细金线（点「星语」金色而不像道闸）。
    part(g, new THREE.BoxGeometry(4.6, 0.3, 0.32), stone, [0, 1.88, 0]);
    part(g, new THREE.BoxGeometry(4.3, 0.05, 0.2), trim, [0, 1.7, 0], false);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function addSmallBlock(x: number, y: number, z: number, type: number, plotStyle?: { color: number; tex: string }) {
    const variationSeed = residenceStyleSeedForLot(x, z);
    const { group:g, body, styleId, styleName } = createResidenceModel({x,z,variationSeed,lotType:type,isNight:getIsNight(),part});
    const residenceId=`residence:${x.toFixed(2)}:${z.toFixed(2)}`;
    g.position.set(x,y,z); g.rotation.y=(variationSeed%4)*Math.PI/2;
    g.traverse((object: THREE.Object3D)=>{ if('isMesh' in object && object.isMesh) { object.userData.residenceId=residenceId; object.userData.residenceStyleId=styleId; } });
    scene.add(g); interactiveDecorationRoots.add(g); addRaycastGroup(g); addObstacleGroup?.(g);
    residenceRoots.push({key:residenceId,root:g});
    residences.push({id:residenceId,label:`${Math.round(x)}, ${Math.round(z)} 号住宅 · ${styleName}`,group:g,body,labelEl:null,styleId});
    // ── 建筑下面的小地块贴图（成片共享纹理）──
    const plotTexs = ['ground5','ground4','ground2','ground','ground5','ground2','ground4','ground5'];
    const plotTex = plotStyle?.tex ?? plotTexs[Math.abs(Math.round(x+z)) % plotTexs.length]!;
    const plotColors = [0xE4E3E0, 0xC0D0A0, 0xE0D8CC, 0xF2F1EE, 0xE8E7E4, 0xD8D4CC, 0xB8C888, 0xE4E3E0];
    const plotCol = plotStyle?.color ?? plotColors[Math.abs(Math.round(x+z)) % plotColors.length]!;
    addGroundPlot(x, z, plotCol, plotTex, { residenceId });
  }

  // 建筑脚下的小地块：可带 residenceId 成为可交互地皮（认领入口），
  // 也可作纯装饰垫层（街景小屋）。同一 jitter 公式避免与相邻地块共面。
  function addGroundPlot(x: number, z: number, plotCol: number, plotTex: string, opts?: { residenceId?: string }) {
    const pmat = stdMat({color: getIsNight() ? Math.floor(plotCol*0.7) : plotCol, roughness:0.9, tex:plotTex, rx:1, ry:1});
    pmat.depthWrite = false;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), pmat);
    if (opts?.residenceId) plot.userData.residenceId = opts.residenceId;
    const plotJitter = (Math.abs(Math.round(x*7 + z*13)) % 8) * 0.0015;
    plot.rotation.x = -Math.PI/2; plot.position.set(x, SURFACE_Y.buildingPlot + plotJitter, z); plot.receiveShadow = true;
    plot.renderOrder = RENDER_ORDER.buildingPlot; scene.add(plot);
    if (opts?.residenceId) { interactiveDecorationRoots.add(plot); addRaycastGroup(plot); }
  }
  
  function addLamps(positions: readonly Vec3[]) {
    if (!lampPosts) {
      const postMaterial=resources.material({kind:'lamp-post'},()=>stdMat({color:0xCDCCCA,roughness:0.7,tex:'metal',rx:1,ry:1}));
      const globeMaterial=resources.material({kind:'lamp-light'},()=>stdMat({color:0xF8F7F5,roughness:0.15,emissive:0xEEF0FF,emissiveIntensity:getIsNight()?0.6:0.05}));
      lampPosts = new InstancedBatch(scene,resources.geometry(new THREE.CylinderGeometry(0.04,0.04,1.15,8)),postMaterial,384);
      lampLights = new InstancedBatch(scene,resources.geometry(new THREE.SphereGeometry(0.13,14,14)),globeMaterial,384,false);
      lampGlobes.push(globeMaterial);
    }
    const bounds = decorationObstacleBounds ?? (decorationObstacleBounds=[...buildings,...residences]
        .map((entry)=>new THREE.Box3().setFromObject(entry.group)));
    positions.forEach(([x,,z]) => {
      if(footprintOverlapsMainRoad(x,z,0.13))return;
      const blocked=bounds.some(box=>{
        return x>=box.min.x-0.8&&x<=box.max.x+0.8&&z>=box.min.z-0.8&&z<=box.max.z+0.8;
      });
      if(blocked)return;
      lampPosts!.add(x,0.575,z);
      lampLights!.add(x,1.28,z);
    });
  }
  function addTrees(positions: readonly Vec3[]) {
    if (!treeTrunks) {
      treeTrunks = new InstancedBatch(scene, resources.geometry(new THREE.CylinderGeometry(0.06, 0.09, 0.38, 8)), resources.material({ kind: 'legacy-tree-trunk' }, () => stdMat({ color: 0x6a4a2a, roughness: 0.9 })), 512);
      treeCrowns = new InstancedBatch(scene, resources.geometry(new THREE.SphereGeometry(0.3, 12, 12)), resources.material({ kind: 'legacy-tree-crown' }, () => stdMat({ color: 0x6f9f4f, roughness: 0.85 })), 512);
    }
    positions.forEach(([x, , z]) => {
      if (Math.hypot(x - orangeGroveCenter.x, z - orangeGroveCenter.z) < 2.4 || treeCenterIsOnRoad(x, z)) return;
      treeTrunks!.add(x, 0.19, z);
      treeCrowns!.add(x, 0.66, z);
    });
  }
  function addBench(x: number, y: number, z: number, rotY: number) {
    const group = new THREE.Group();
    part(group, new THREE.BoxGeometry(0.9, 0.1, 0.38), { color: 0xa97950, roughness: 0.85 }, [0, 0.48, 0]);
    part(group, new THREE.BoxGeometry(0.9, 0.3, 0.08), { color: 0xa97950, roughness: 0.85 }, [0, 0.7, -0.15]);
    group.position.set(x, y, z); group.rotation.y = rotY; scene.add(group);
  }
  function addArch(x: number, y: number, z: number, rotY: number) {
    const group = new THREE.Group();
    const material = { color: 0xecebe8, roughness: 0.7, tex: 'stone', rx: 1, ry: 1 };
    part(group, new THREE.BoxGeometry(0.22, 1.55, 0.22), material, [-0.78, 0.88, 0]);
    part(group, new THREE.BoxGeometry(0.22, 1.55, 0.22), material, [0.78, 0.88, 0]);
    part(group, new THREE.BoxGeometry(0.22, 0.24, 1.78), material, [0, 1.72, 0]);
    group.position.set(x, y, z); group.rotation.y = rotY; scene.add(group);
  }
  function addSignpost(x: number, y: number, z: number) {
    const g=new THREE.Group();
    part(g,new THREE.CylinderGeometry(0.03,0.03,0.9,8),{color:0xD0CFCC,roughness:0.8,tex:'wood',rx:1,ry:1},[0,0.45,0]);
    part(g,new THREE.BoxGeometry(0.36,0.18,0.04),{color:0xF0EFEC,roughness:0.5,tex:'wood',rx:1,ry:1},[0.18,0.72,0]);
    g.position.set(x,y,z); scene.add(g);
  }
  // 街景小屋：默认与主城用法一致（纯装饰、无碰撞）。北城居住坊里它们
  // 与可认领民居混排，必须 solid——注册导航障碍并补地块，否则看起来
  // 和邻居一样却能穿墙、还没有地板。
  function addSuburbHouse(x: number, z: number, rotDeg: number, solid = false) {
    const g = new THREE.Group();
    const bw = 1.2, bh = 0.9;
    // Foundation
    part(g, new THREE.BoxGeometry(bw+0.4, 0.1, bw+0.4), {color:0xC4A86D, roughness:0.7, tex:'stone', rx:1, ry:1}, [0, 0.05, 0]);
    // Walls
    part(g, new THREE.BoxGeometry(bw, bh, bw), {color:P.SUBURB_WALL, roughness:0.85, tex:'suburb', rx:1, ry:1}, [0, 0.1+bh/2, 0]);
    // Pitched roof
    part(g, new THREE.ConeGeometry(bw*0.85, 0.7, 4), {color:P.SUBURB_ROOF, roughness:0.6, tex:'rooftile', rx:1, ry:1}, [0, 0.1+bh+0.35, 0]).rotation.y = Math.PI/4;
    // Chimney on some
    if ((Math.abs(x+z)|0) % 3 === 0) {
      part(g, new THREE.BoxGeometry(0.15, 0.5, 0.15), {color:0x8A5A4A, roughness:0.7, tex:'brick', rx:1, ry:1}, [bw/2-0.2, 0.1+bh+0.4, 0], false);
    }
    // Door
    part(g, new THREE.BoxGeometry(0.25, 0.45, 0.04), {color:0x5A3A2A, roughness:0.6, tex:'wood', rx:1, ry:1}, [0, 0.1+0.225, bw/2+0.01], false);
    // Windows
    part(g, new THREE.BoxGeometry(0.25, 0.25, 0.04), {color:0xA8C8E0, roughness:0.1, metalness:0.2, tex:'glass', rx:1, ry:1}, [-0.35, 0.1+bh*0.55, bw/2+0.01], false);
    part(g, new THREE.BoxGeometry(0.25, 0.25, 0.04), {color:0xA8C8E0, roughness:0.1, metalness:0.2, tex:'glass', rx:1, ry:1}, [0.35, 0.1+bh*0.55, bw/2+0.01], false);
    // Side windows
    part(g, new THREE.BoxGeometry(0.04, 0.25, 0.25), {color:0xA8C8E0, roughness:0.1, metalness:0.2, tex:'glass', rx:1, ry:1}, [bw/2+0.01, 0.1+bh*0.55, 0], false);
    part(g, new THREE.BoxGeometry(0.04, 0.25, 0.25), {color:0xA8C8E0, roughness:0.1, metalness:0.2, tex:'glass', rx:1, ry:1}, [-bw/2-0.01, 0.1+bh*0.55, 0], false);
    // Garden patch (front) — raised to avoid z-fighting with ground
    part(g, new THREE.BoxGeometry(bw*0.8, 0.04, 0.4), {color:P.FIELD, roughness:1, tex:'field', rx:1, ry:1}, [0, 0.06, bw/2+0.3], false);
    // Small tree next to some
    if ((Math.abs(x*z)|0) % 2 === 0) {
      part(g, new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6), {color:0x6A4A2A, roughness:0.8, tex:'wood', rx:1, ry:1}, [bw/2+0.4, 0.2, -bw/2-0.2], false);
      part(g, new THREE.SphereGeometry(0.28, 8, 8), {color:0x4A7A3A, roughness:0.9, tex:'grass', rx:1, ry:1}, [bw/2+0.4, 0.5, -bw/2-0.2], false);
    }
    g.position.set(x, 0, z); g.rotation.y = (rotDeg * Math.PI / 180);
    scene.add(g);
    if (solid) {
      addObstacleGroup?.(g);
      addGroundPlot(x, z, 0xdcdad6, 'ground5');
    }
  }
  
  return {
    addDecorations, addLamps,
    setResidenceVisualVisible: (residenceId: string, visible: boolean) => residenceVisualBatch?.setVisible(residenceId, visible),
    addTrees, addBench, addArch,
    update(_elapsedSeconds?: number) {},
    setWaterDaylight(_value?: number, _instant = false) {},
  };
}

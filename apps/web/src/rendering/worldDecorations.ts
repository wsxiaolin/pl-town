// Procedural city decoration catalog and its instanced rendering resources.
import * as THREE from 'three';
import { InstancedBatch } from '../core/InstancedBatch';
import { ResourcePool } from '../core/ResourcePool';
import { RENDER_ORDER, SURFACE_Y } from './layers';
import { createResidenceModel, residenceStyleSeedForLot } from './residenceStyles';
import { footprintOverlapsMainRoad, isFilmCityClearing, MAIN_ROAD_WIDTH } from '../city/data/cityConfig';
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
  
  function addSmallBlock(x: number, y: number, z: number, type: number) {
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
    const plotTex = plotTexs[Math.abs(Math.round(x+z)) % plotTexs.length];
    const plotColors = [0xE4E3E0, 0xC0D0A0, 0xE0D8CC, 0xF2F1EE, 0xE8E7E4, 0xD8D4CC, 0xB8C888, 0xE4E3E0];
    const plotCol = plotColors[Math.abs(Math.round(x+z)) % plotColors.length]!;
    const pmat = stdMat({color: getIsNight() ? Math.floor(plotCol*0.7) : plotCol, roughness:0.9, tex:plotTex, rx:1, ry:1});
    pmat.depthWrite = false;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), pmat);
    plot.userData.residenceId = residenceId;
    const plotJitter = (Math.abs(Math.round(x*7 + z*13)) % 8) * 0.0015;
    plot.rotation.x = -Math.PI/2; plot.position.set(x, SURFACE_Y.buildingPlot + plotJitter, z); plot.receiveShadow = true;
    plot.renderOrder = RENDER_ORDER.buildingPlot; scene.add(plot); interactiveDecorationRoots.add(plot); addRaycastGroup(plot);
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
  function addSuburbHouse(x: number, z: number, rotDeg: number) {
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
  }
  
  return {
    addDecorations, addLamps,
    setResidenceVisualVisible: (residenceId: string, visible: boolean) => residenceVisualBatch?.setVisible(residenceId, visible),
    addTrees, addBench, addArch,
    update(_elapsedSeconds?: number) {},
    setWaterDaylight(_value?: number, _instant = false) {},
  };
}

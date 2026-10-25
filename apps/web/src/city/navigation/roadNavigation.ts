import * as THREE from 'three';
import { terrainHeight, slopeAlong, WALKABLE_SLOPE_MAX } from '../data/terrain/heightfield/terrainHeight';
import { transitGroundY } from '../data/terrain/heightfield/transitGround';
import { SOUTH_TRAIL_NODES, NORTH_TRAIL_NODES } from '../data/terrain/heightfield/worldReliefField';
import { LANPING_ALPINE_FIELD } from '../data/terrain/heightfield/alpineField';
import { isArchipelagoWaterAt } from '../data/terrain/sea-archipelago';
import { isInsideIsland } from '../data/terrain/heightfield/islandField';
import { bridgeCorridorWeight } from '../data/terrain/heightfield/transitField';

type Coord2 = [number, number];
type RoadSegment4 = [number, number, number, number];
type RoadNode = THREE.Vector3 & { i: number; adj: RoadNode[] };
type BuildingBox = { minX: number; maxX: number; minZ: number; maxZ: number };
type RoadGraph = { nodes: RoadNode[]; nodeIdx: Map<string, number>; routeCache: Map<string, RoadNode[] | null> };
type CollisionBox = BuildingBox & { queryStamp: number };
type ObstacleGroup = THREE.Object3D & {
  userData: THREE.Object3D['userData'] & { navigationFootprint?: { width: number; depth: number } };
};

export interface RoadNavigationOptions {
  roadCoords: readonly number[];
  echoObservatoryArea?: { roadNodes: readonly Coord2[]; roadSegments: readonly RoadSegment4[] };
  northDistrictArea?: { roadNodes: readonly Coord2[]; avenueSegment: readonly [number, number, number, number]; laneSegments: readonly RoadSegment4[]; roadJunctions?: readonly RoadSegment4[] };
  /** 南草甸出城步道（方案 §5.3/§6.1）：S1..S4 挂接路网，WORLD_BOUNDS 随新节点外扩至观景平台。 */
  meadowTrail?: { roadNodes: readonly Coord2[]; roadSegments: readonly RoadSegment4[] };
  /** T4a 跨海交通（设计 §5.1/§5.2）：星门大桥 B 链（S4 观景平台挂接）+
   *  起源村枢纽街。走线/纵断面唯一事实源 = data/year-towns/transit.ts
   *  （buildTransitRoadGraph 工厂产出，本模块只接线不造数）。 */
  transit?: { roadNodes: readonly Coord2[]; roadSegments: readonly RoadSegment4[] };
  westBeach?: { deepWaterX: number; safeReturnX: number; minZ: number; maxZ: number };
  /** 年份群岛（T3）：8 镇中心作为 bounds 外扩锚点（不是路网节点——T4 桥
   *  节点接入前，玩家传送/飞抵后的自由行走不被 WORLD_BOUNDS 钳回主城）。 */
  yearTownAnchors?: readonly Coord2[];
  cityLimit: number;
  getBuildings: () => readonly { group: THREE.Object3D }[];
}

/**
 * 南草甸出城步道的导航图（roadNavigation.meadowTrail 选项的工厂）：
 * SOUTH/NORTH_TRAIL_NODES 与 heightfield 切槽场同源常量——导航图与地形面永远一致；
 * 首段把城市网格节点 [6,36] 接进 S1，末节点即观景平台（bounds 外扩锚点）。
 */
export function buildMeadowTrailGraph(): { roadNodes: [number, number][]; roadSegments: [number, number, number, number][] } {
  // v9 双走廊各自成链（AI 审查 🔴 修复：禁止把拼接表首尾连成 S4→N1 跨城
  // 假边）。南线接主城南路网节点 [6,36]（S1 南出口外 8u 沿 x=6 路轴）；
  // 北线接星语北城东南街尾 [33,-80]——桥接段 (33,-80)→N1(70,-86) 沿台地
  // 东北缘平地（建筑扫描无占位、台地内 terrainHeight≡0），北线由此独立
  // 入城市图。节点表与 heightfield 切槽场同源常量，图与地形永远一致。
  const south = SOUTH_TRAIL_NODES.map(({ x, z }) => [x, z] as [number, number]);
  const north = NORTH_TRAIL_NODES.map(({ x, z }) => [x, z] as [number, number]);
  const nodes: [number, number][] = [...south, ...north];
  const segments: [number, number, number, number][] = [];
  const chain = (list: [number, number][]) => {
    for (let index = 1; index < list.length; index += 1) {
      segments.push([list[index - 1]![0], list[index - 1]![1], list[index]![0], list[index]![1]]);
    }
  };
  segments.push([6, 36, south[0]![0], south[0]![1]]);
  chain(south);
  segments.push([33, -80, north[0]![0], north[0]![1]]);
  chain(north);
  return { roadNodes: nodes, roadSegments: segments };
}

/**
 * 山体面阻挡（review #243 🔴）：可步行外框随北线步道（N4 z=-113）扩进岚屏岭
 * 高度场，而 terrainHeight 不收编山体（方案 §2.4，山体是叠在地形上的凸出体块）。
 * 山体包围盒内不再生成世界地面（worldGroundMesh 跳过共面区），唯一可见地面是
 * 独立的岚屏岭连续山体网格；玩家落位 y 却由 terrainHeight 赋值，走进山脚会被
 * 埋进山体内部。这里用与渲染网格同一份连续高度场（LANPING_ALPINE_FIELD）逐点
 * 判定：山面高出可走地面超过一个步高即视为山体墙，谷地走廊（山面≈0）仍可通行。
 * 这是各处 navigationBlocking 标记落地的实际判定（此前该字段无消费者）。
 */
export const MOUNTAIN_WALK_RISE_MAX = 0.35;

/** 该点是否位于「山面高出可走地面」的山体墙内（heightAt 场外恒 0，自然为假）。 */
export function mountainSurfaceBlocked(x: number, z: number): boolean {
  if (z > LANPING_ALPINE_FIELD.bounds.z1) return false;
  return LANPING_ALPINE_FIELD.heightAt(x, z) - terrainHeight(x, z) > MOUNTAIN_WALK_RISE_MAX;
}

/** 南海开放水面不可步行；岛体与星门步行桥走廊保持通行。 */
export function archipelagoWaterBlocked(x: number, z: number): boolean {
  return isArchipelagoWaterAt(x, z) && !isInsideIsland(x, z) && bridgeCorridorWeight(x, z) <= 0;
}

export function createRoadNavigationSystem(options: RoadNavigationOptions) {
  const ROAD_COORDS = [...options.roadCoords];
  const ECHO_OBSERVATORY_AREA = { roadNodes: [...(options.echoObservatoryArea?.roadNodes ?? [])] as Coord2[], roadSegments: [...(options.echoObservatoryArea?.roadSegments ?? [])] as RoadSegment4[] };
  const NORTH_DISTRICT_AREA = {
    roadNodes: [...(options.northDistrictArea?.roadNodes ?? [])] as Coord2[],
    avenueSegment: options.northDistrictArea?.avenueSegment ?? [0, 0, 0, 0],
    laneSegments: [...(options.northDistrictArea?.laneSegments ?? [])] as RoadSegment4[],
    roadJunctions: [...(options.northDistrictArea?.roadJunctions ?? [])] as RoadSegment4[],
  };
  const MEADOW_TRAIL = { roadNodes: [...(options.meadowTrail?.roadNodes ?? [])] as Coord2[], roadSegments: [...(options.meadowTrail?.roadSegments ?? [])] as RoadSegment4[] };
  const TRANSIT = { roadNodes: [...(options.transit?.roadNodes ?? [])] as Coord2[], roadSegments: [...(options.transit?.roadSegments ?? [])] as RoadSegment4[] };
  const CITY_LIMIT = options.cityLimit;
  const PLAYER_CLEARANCE = 0.2;
  const WEST_BEACH = options.westBeach;
  const YEAR_TOWN_ANCHORS = options.yearTownAnchors ?? [];
  const allExtraNodes = [...ECHO_OBSERVATORY_AREA.roadNodes, ...NORTH_DISTRICT_AREA.roadNodes, ...MEADOW_TRAIL.roadNodes, ...TRANSIT.roadNodes];
  const WORLD_BOUNDS = {
    minX: Math.min(-CITY_LIMIT, ...allExtraNodes.map(([x]) => x), ...YEAR_TOWN_ANCHORS.map(([x]) => x)) - 8,
    maxX: Math.max(CITY_LIMIT, ...allExtraNodes.map(([x]) => x), ...YEAR_TOWN_ANCHORS.map(([x]) => x)) + 8,
    minZ: Math.min(-CITY_LIMIT, ...allExtraNodes.map(([,z]) => z), ...YEAR_TOWN_ANCHORS.map(([,z]) => z)) - 8,
    maxZ: Math.max(CITY_LIMIT, ...allExtraNodes.map(([,z]) => z), ...YEAR_TOWN_ANCHORS.map(([,z]) => z)) + 8,
  };
  const buildings = options.getBuildings();
  const buildingBoxes: CollisionBox[] = [];
  const obstacleGroups: ObstacleGroup[] = [];
  const obstacleGroupSet = new Set<THREE.Object3D>();
  const collisionRows = new Map<number, Map<number, CollisionBox[]>>();
  const collisionBounds = new THREE.Box3();
  const collisionCenter = new THREE.Vector3();
  const COLLISION_CELL_SIZE = 6;
  let collisionQueryStamp = 0;
  let buildingBoxesInitialized = false;

  function registerObstacleGroup(group: THREE.Object3D | null) {
    if (!group || obstacleGroupSet.has(group)) return;
    obstacleGroupSet.add(group);
    obstacleGroups.push(group as ObstacleGroup);
    if (buildingBoxesInitialized) addObstacleBounds(group as ObstacleGroup);
    roadGraph = null;
  }

  function collisionCell(value: number): number {
    return Math.floor(value / COLLISION_CELL_SIZE);
  }

  // Keep the exact AABB collision tests below, while limiting each query to
  // boxes in the grid cells touched by the point or segment.
  function indexBuildingBox(box: CollisionBox): void {
    const minCellX=collisionCell(box.minX), maxCellX=collisionCell(box.maxX);
    const minCellZ=collisionCell(box.minZ), maxCellZ=collisionCell(box.maxZ);
    for(let cellX=minCellX;cellX<=maxCellX;cellX++){
      let row=collisionRows.get(cellX);
      if(!row){ row=new Map(); collisionRows.set(cellX,row); }
      for(let cellZ=minCellZ;cellZ<=maxCellZ;cellZ++){
        let bucket=row.get(cellZ);
        if(!bucket){ bucket=[]; row.set(cellZ,bucket); }
        bucket.push(box);
      }
    }
  }

  function addBuildingBox(box: CollisionBox): void {
    buildingBoxes.push(box);
    indexBuildingBox(box);
  }

  function visitCollisionCandidates(minX: number,minZ: number,maxX: number,maxZ: number,visitor: (box: CollisionBox) => boolean): boolean {
    const stamp=++collisionQueryStamp;
    const minCellX=collisionCell(minX), maxCellX=collisionCell(maxX);
    const minCellZ=collisionCell(minZ), maxCellZ=collisionCell(maxZ);
    for(let cellX=minCellX;cellX<=maxCellX;cellX++){
      const row=collisionRows.get(cellX);
      if(!row) continue;
      for(let cellZ=minCellZ;cellZ<=maxCellZ;cellZ++){
        const bucket=row.get(cellZ);
        if(!bucket) continue;
        for(const box of bucket){
          // Large buildings can occupy multiple cells. A numeric stamp avoids
          // allocating a Set for every movement query.
          if(box.queryStamp===stamp) continue;
          box.queryStamp=stamp;
          if(visitor(box)) return true;
        }
      }
    }
    return false;
  }

  function addObjectBounds(group: THREE.Object3D): void {
    collisionBounds.setFromObject(group);
    if(!Number.isFinite(collisionBounds.min.x)) return;
    addBuildingBox({
      minX:collisionBounds.min.x-PLAYER_CLEARANCE, maxX:collisionBounds.max.x+PLAYER_CLEARANCE,
      minZ:collisionBounds.min.z-PLAYER_CLEARANCE, maxZ:collisionBounds.max.z+PLAYER_CLEARANCE,
      queryStamp:0,
    });
  }

  function addObstacleBounds(group: ObstacleGroup): void {
    const footprint=group.userData.navigationFootprint;
    if(!footprint){ addObjectBounds(group); return; }
    group.getWorldPosition(collisionCenter);
    const quarterTurn=Math.abs(Math.sin(group.rotation.y))>0.5;
    const width=quarterTurn?footprint.depth:footprint.width;
    const depth=quarterTurn?footprint.width:footprint.depth;
    addBuildingBox({
      minX:collisionCenter.x-width/2-PLAYER_CLEARANCE,
      maxX:collisionCenter.x+width/2+PLAYER_CLEARANCE,
      minZ:collisionCenter.z-depth/2-PLAYER_CLEARANCE,
      maxZ:collisionCenter.z+depth/2+PLAYER_CLEARANCE,
      queryStamp:0,
    });
  }

  function buildRoadPath(from: THREE.Vector3, rawTarget: THREE.Vector3): THREE.Vector3[] {
    const start=roadEntry(from);
    const end=roadEntry(rawTarget);
    const graph=getRoadGraph();
    const sNode=connectToGrid(start,graph);
    const eNode=connectToGrid(end,graph);
    if(sNode&&eNode){
      const gridPath=aStarRoad(sNode,eNode,graph);
      if(gridPath&&gridPath.length){
        const pts: THREE.Vector3[]=[start];
        for(let i=1;i<gridPath.length;i++){ const n=gridPath[i]; if(n) pts.push(new THREE.Vector3(n.x,n.y,n.z)); }
        // Never end a leg inside a building footprint, and never strike the final
        // approach across a building: stop on the road instead.
        const last=pts[pts.length-1];
        if(!last) return [];
        const approachClear=!pointInAnyBuilding(end.x,end.z)
          && !segHitsBuilding(last.x,last.z,end.x,end.z)
          && !pathBlocked(last.x,last.z,end.x,end.z);
        if(approachClear) pts.push(end);
        // Straighten collinear runs along the SAME road line only — never cut
        // diagonally across building blocks or open ground.
        const out: THREE.Vector3[]=[];
        for(const p of pts){
          if(out.length>=2){
            const a=out[out.length-2], b=out[out.length-1];
            if(a && b){
              const sameLine=(a.x===b.x&&b.x===p.x)||(a.z===b.z&&b.z===p.z);
              if(sameLine&&!segHitsBuilding(a.x,a.z,p.x,p.z)&&!pathBlocked(a.x,a.z,p.x,p.z)){
                out.pop();
              }
            }
          }
          out.push(p);
        }
        const filtered=out.filter((p,i,arr)=>i===0|| (arr[i-1]!==undefined && p.distanceTo(arr[i-1] as THREE.Vector3)>0.05));
        if(filtered.length>1) return filtered;
      }
    }
    // No connected route — never cut across open ground into a building. Walking
    // to the nearest road entry is still safe when the hop itself is clear.
    if(!pointInAnyBuilding(start.x,start.z)&&!pathBlocked(from.x,from.z,start.x,start.z)&&start.distanceTo(end)>0.05) return [start];
    return [];
  }
  
  // ── Road network graph (grid A* over the 7×7 intersections) ─────────────────
  const FOUNTAIN_CLEAR = 1.95;  // keep walking paths clear of the center fountain
  // Walkable ring around the fountain plaza (radius 2.7) — also used by roadEntry
  // so a player standing in the plaza snaps onto the closest plaza point instead
  // of being pushed toward a far grid corner.
  const PLAZA_POINTS: Coord2[] = Array.from({length:8},(_,i)=>{
    const a=i/8*Math.PI*2;
    return [Number((Math.cos(a)*2.7).toFixed(3)), Number((Math.sin(a)*2.7).toFixed(3))] as Coord2;
  });
  let roadGraph: RoadGraph | null = null;
  
  // 地面点构造（唯一权威采样器落位，GOAL 红线：禁止硬编码 0）。
  // T4b 乘车交互（transitField 契约消费方——桥面/月台可步行）：桥面/月台
  // 段的地面 y 由 transitGroundY 统一接管（月台 > 桥走廊 > 自然地形，
  // 与 worldReliefAt 岛分支同口径——月台是乘车落点的精确基准面，星门
  // 月台不再被桥走廊压偏 0.1054）；岛足印内 terrainHeight 已按同一
  // 函数融过桥/台（桥/月台节点在中心线上、走廊权重恒 1 → 重采样幂等）；
  // 恒海区 z≥145 无 farGround 网格的桥中段由此补齐 y=deck（走桥不沉
  // 海）。两域之外返回原值，主城/步道全部落点零回归。
  function groundPoint(x: number,z: number): THREE.Vector3 {
    return new THREE.Vector3(x,transitGroundY(x,z),z);
  }

  // 坡度可通行判定（方案 §6.1）：建边时对两端点与中点沿边方向采样
  // slopeAlong，任一点超阈值即阻断该边（更陡的谷坡/滩涂外缘为障碍）。
  // 台地内坡度恒 0 → 既有全部边零变化（回归不破坏）。
  function edgeTooSteep(a: RoadNode,b: RoadNode): boolean {
    const dx=b.x-a.x, dz=b.z-a.z;
    if(dx*dx+dz*dz<1e-9) return false;
    if(slopeAlong(a.x,a.z,dx,dz)>WALKABLE_SLOPE_MAX) return true;
    if(slopeAlong(b.x,b.z,-dx,-dz)>WALKABLE_SLOPE_MAX) return true;
    return slopeAlong((a.x+b.x)/2,(a.z+b.z)/2,dx,dz)>WALKABLE_SLOPE_MAX;
  }

  function getRoadGraph(): RoadGraph {
    if(roadGraph) return roadGraph;
    const coords=ROAD_COORDS;
    const nodeIdx=new Map<string, number>();
    const nodes: RoadNode[]=[];
    const addNode=(x: number,z: number): RoadNode=>{
      const key=x+','+z;
      const existing=nodeIdx.get(key);
      if(existing!==undefined) return nodes[existing]!;
      const node=groundPoint(x,z) as RoadNode;
      node.i=nodes.length;
      node.adj=[];
      nodeIdx.set(key,nodes.length);
      nodes.push(node);
      return node;
    };
    coords.forEach((x:number)=>coords.forEach((z:number)=>addNode(x,z)));
    nodes.forEach((n,i)=>{ n.i=i; n.adj=[]; });
    const addEdge=(a: RoadNode,b: RoadNode)=>{
      if(pathBlocked(a.x,a.z,b.x,b.z)) return;
      if(edgeTooSteep(a,b)) return;
      a.adj.push(b); b.adj.push(a);
    };
    coords.forEach((x,i)=>coords.forEach((z,j)=>{
      const key=x+','+z;
      const aIdx=nodeIdx.get(key);
      const a=aIdx!==undefined?nodes[aIdx]:undefined;
      if(!a) return;
      if(i+1<coords.length) { const bIdx=nodeIdx.get(coords[i+1]+','+z); if(bIdx!==undefined) addEdge(a,nodes[bIdx]!); }
      if(j+1<coords.length) { const bIdx=nodeIdx.get(x+','+coords[j+1]); if(bIdx!==undefined) addEdge(a,nodes[bIdx]!); }
    }));
  
    // The visible outer ring is a real escape route around the fountain and
    // blocked building edges. Connect it to the four arterial endpoints.
    const ringNodes: RoadNode[]=[];
    const ringR=38;
    const ringCount=24;
    for(let i=0;i<ringCount;i++){
      const a=i/ringCount*Math.PI*2;
      ringNodes.push(addNode(Number((Math.cos(a)*ringR).toFixed(3)),Number((Math.sin(a)*ringR).toFixed(3))));
    }
    ringNodes.forEach((n,i)=>addEdge(n,ringNodes[(i+1)%ringCount]!));
    ([[0,-36,0,-38],[36,0,38,0],[0,36,0,38],[-36,0,-38,0]] as const).forEach(([x1,z1,x2,z2])=>{
      const aIdx=nodeIdx.get(x1+','+z1);
      const bIdx=nodeIdx.get(x2+','+z2);
      if(aIdx!==undefined && bIdx!==undefined) addEdge(nodes[aIdx]!,nodes[bIdx]!);
    });
  
    ECHO_OBSERVATORY_AREA.roadNodes.forEach(([x,z])=>addNode(x,z));
    ECHO_OBSERVATORY_AREA.roadSegments.forEach(([x1,z1,x2,z2])=>{
      const aIdx=nodeIdx.get(x1+','+z1);
      const bIdx=nodeIdx.get(x2+','+z2);
      if(aIdx!==undefined && bIdx!==undefined) addEdge(nodes[aIdx]!,nodes[bIdx]!);
    });

    // 南草甸出城步道（方案 §5.3）：S1..S4 串联成边并接入主城网格
    //（segments 首段即 [6,36]→S1 的网格连接边）。步道床纵坡 ≤ 7%，
    // 远低于 WALKABLE_SLOPE_MAX——边坡度判定对步道恒放行。
    MEADOW_TRAIL.roadNodes.forEach(([x,z])=>addNode(x,z));
    MEADOW_TRAIL.roadSegments.forEach(([x1,z1,x2,z2])=>{
      const aIdx=nodeIdx.get(x1+','+z1);
      const bIdx=nodeIdx.get(x2+','+z2);
      if(aIdx!==undefined && bIdx!==undefined) addEdge(nodes[aIdx]!,nodes[bIdx]!);
    });

    // 跨海交通（T4a2，设计 §5.1/§5.2）：星门大桥 B 链首节点 [34,96] 与南步道
    // S4 观景平台重合（addNode 按坐标去重 → 桥链自然挂进步道图）；末端
    // (96,197)→(96,212) 为起源村枢纽街。海上段（z≥145 无 farGround 网格）
    // terrainHeight 仍是自然场（≈海床），坡度判定采两端点恒 0 → 边恒放行；
    // 节点 y 由 groundPoint 的 transitGroundY 接管（T4b 换月台优先口径）。
    TRANSIT.roadNodes.forEach(([x,z])=>addNode(x,z));
    TRANSIT.roadSegments.forEach(([x1,z1,x2,z2])=>{
      const aIdx=nodeIdx.get(x1+','+z1);
      const bIdx=nodeIdx.get(x2+','+z2);
      if(aIdx!==undefined && bIdx!==undefined) addEdge(nodes[aIdx]!,nodes[bIdx]!);
    });
    
    NORTH_DISTRICT_AREA.roadNodes.forEach(([x,z])=>addNode(x,z));
    // 街道按途经节点切分成逐交叉口边，保证每个路口都是图节点
    // （与主城网格逐格建边的方式一致）。
    const northSegments=[NORTH_DISTRICT_AREA.avenueSegment,...NORTH_DISTRICT_AREA.laneSegments] as Array<[number,number,number,number]>;
    northSegments.forEach(([x1,z1,x2,z2])=>{
      const dx=x2-x1, dz=z2-z1;
      const length=Math.hypot(dx,dz);
      if(length<1e-6) return;
      const onSegment=NORTH_DISTRICT_AREA.roadNodes
        .filter(([nx,nz])=>Math.abs(dx*(nz-z1)-dz*(nx-x1))<1e-3)
        .map(([nx,nz])=>({x:nx,z:nz,t:((nx-x1)*dx+(nz-z1)*dz)/(length*length)}))
        .filter((p)=>p.t>=-1e-6&&p.t<=1+1e-6)
        .sort((a,b)=>a.t-b.t);
      for(let i=0;i+1<onSegment.length;i++){
        const aIdx=nodeIdx.get(onSegment[i]!.x+','+onSegment[i]!.z);
        const bIdx=nodeIdx.get(onSegment[i+1]!.x+','+onSegment[i+1]!.z);
        if(aIdx!==undefined && bIdx!==undefined) addEdge(nodes[aIdx]!,nodes[bIdx]!);
      }
    });
    // roadJunctions 是图级连接边：路面由主城网格/环城步道覆盖，
    // 仅把北城街道端点接入主城网格节点。
    NORTH_DISTRICT_AREA.roadJunctions.forEach(([x1,z1,x2,z2])=>{
      const aIdx=nodeIdx.get(x1+','+z1);
      const bIdx=nodeIdx.get(x2+','+z2);
      if(aIdx!==undefined && bIdx!==undefined) addEdge(nodes[aIdx]!,nodes[bIdx]!);
    });
  
    // Inner plaza loop: the walkable counterpart of the central ring mesh added
    // in addPaths(). It connects to each arterial without entering the fountain.
    const plazaNodes=PLAZA_POINTS.map(([x,z])=>addNode(x,z));
    plazaNodes.forEach((n,i)=>addEdge(n,plazaNodes[(i+1)%plazaNodes.length]!));
    ([[0,-6,0,-2.7],[6,0,2.7,0],[0,6,0,2.7],[-6,0,-2.7,0]] as const).forEach(([x1,z1,x2,z2])=>{
      const aIdx=nodeIdx.get(x1+','+z1);
      const bIdx=nodeIdx.get(x2+','+z2);
      if(aIdx!==undefined && bIdx!==undefined) addEdge(nodes[aIdx]!,nodes[bIdx]!);
    });
    roadGraph={nodes,nodeIdx,routeCache:new Map()};
    return roadGraph;
  }
  
  // A straight segment is unusable if it crosses a building footprint or the
  // fountain plaza (the arterial roads are cut there and no mesh exists).
  function pathBlocked(x1: number,z1: number,x2: number,z2: number): boolean {
    if(segHitsBuilding(x1,z1,x2,z2)) return true;
    const dx=x2-x1, dz=z2-z1;
    const samples=Math.ceil(Math.hypot(dx,dz)/2);
    for(let i=1;i<samples;i+=1) {
      const ratio=i/samples;
      if(archipelagoWaterBlocked(x1+dx*ratio,z1+dz*ratio)) return true;
    }
    const len2=dx*dx+dz*dz;
    const t=len2<1e-9?0:clamp(((0-x1)*dx+(0-z1)*dz)/len2,0,1);
    const cx=x1+dx*t, cz=z1+dz*t;
    return cx*cx+cz*cz < FOUNTAIN_CLEAR*FOUNTAIN_CLEAR;
  }

  // 深水兜底阈值（方案 §6.3）：低于所有可行走地面场的最大下切滩涂值 +
  // 水深余量。河谷河槽（床 -0.45..-0.85）与深海床判定为深水不可走；
  // 湿岸带（-0.45..0）仍可走。z 先裁剪：可行走域 z ≥ minZ=-88.2，仅河谷
  // 北坡地带会真正算到高度场，台地内零额外采样成本。
  const DEEP_TERRAIN_MIN_Y = -0.35;
  const DEEP_TERRAIN_Z_GATE = -85.5;

  function positionBlocked(x: number,z: number): boolean {
    if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>WORLD_BOUNDS.maxZ) return true;
    if(x*x+z*z < FOUNTAIN_CLEAR*FOUNTAIN_CLEAR) return true;
    if(WEST_BEACH && x<WEST_BEACH.deepWaterX && z>=WEST_BEACH.minZ && z<=WEST_BEACH.maxZ) return true;
    if(archipelagoWaterBlocked(x,z)) return true;
    if(z<DEEP_TERRAIN_Z_GATE && terrainHeight(x,z)<DEEP_TERRAIN_MIN_Y) return true;
    if(mountainSurfaceBlocked(x,z)) return true;
    return pointInAnyBuilding(x,z);
  }

  function resolveMovement(from: THREE.Vector3, target: THREE.Vector3, result: THREE.Vector3 = new THREE.Vector3()): THREE.Vector3 {
    const fromX=from.x, fromZ=from.z;
    const desiredX=clamp(target.x,WORLD_BOUNDS.minX,WORLD_BOUNDS.maxX);
    const desiredZ=clamp(target.z,WORLD_BOUNDS.minZ,WORLD_BOUNDS.maxZ);
    // 落点 y 一律由权威采样器赋值（方案 §6.2；台地内恒 0 零回归）。T4b：
    // 交通件上盖（桥面/月台）由 transitGroundY 接管——走桥 y=桥面纵断面。
    result.set(desiredX,transitGroundY(desiredX,desiredZ),desiredZ);
    if(WEST_BEACH && desiredX<WEST_BEACH.deepWaterX && desiredZ>=WEST_BEACH.minZ && desiredZ<=WEST_BEACH.maxZ) {
      const returnZ=clamp(desiredZ,WEST_BEACH.minZ,WEST_BEACH.maxZ);
      return result.set(WEST_BEACH.safeReturnX,transitGroundY(WEST_BEACH.safeReturnX,returnZ),returnZ);
    }
    // 坡度可通行判定（方案 §6.1 movement 层兜底）：图外自由移动时按
    // 「落点处沿运动方向」采样 slopeAlong，超阈值视为不可走，与建筑
    // 阻挡共用分轴钳制回退。台地内坡度恒 0 → 行为与现状完全一致。
    const stepTooSteep=(x: number,z: number): boolean=>{
      const dx=x-fromX, dz=z-fromZ;
      if(dx*dx+dz*dz<1e-9) return false;
      return slopeAlong(x,z,dx,dz)>WALKABLE_SLOPE_MAX;
    };
    if(positionBlocked(fromX,fromZ)) return positionBlocked(desiredX,desiredZ) ? result.set(fromX,transitGroundY(fromX,fromZ),fromZ) : result;
    if(!positionBlocked(desiredX,desiredZ)&&!pathBlocked(fromX,fromZ,desiredX,desiredZ)&&!stepTooSteep(desiredX,desiredZ)) return result;
    const alongXClear=!positionBlocked(desiredX,fromZ)&&!pathBlocked(fromX,fromZ,desiredX,fromZ)&&!stepTooSteep(desiredX,fromZ);
    const alongZClear=!positionBlocked(fromX,desiredZ)&&!pathBlocked(fromX,fromZ,fromX,desiredZ)&&!stepTooSteep(fromX,desiredZ);
    if(alongXClear&&alongZClear){
      const alongXDistance=(fromZ-desiredZ)**2;
      const alongZDistance=(fromX-desiredX)**2;
      return alongXDistance<=alongZDistance ? result.set(desiredX,transitGroundY(desiredX,fromZ),fromZ) : result.set(fromX,transitGroundY(fromX,desiredZ),desiredZ);
    }
    if(alongXClear) return result.set(desiredX,transitGroundY(desiredX,fromZ),fromZ);
    if(alongZClear) return result.set(fromX,transitGroundY(fromX,desiredZ),desiredZ);
    return result.set(fromX,transitGroundY(fromX,fromZ),fromZ);
  }
  
  function aStarRoad(sNode: RoadNode, eNode: RoadNode, _graph: RoadGraph): RoadNode[] | null {
    if(sNode===eNode) return [sNode];
    const cacheKey=sNode.i+','+eNode.i;
    if(_graph.routeCache.has(cacheKey)) return _graph.routeCache.get(cacheKey) ?? null;
    const gScore=new Map<number, number>([[sNode.i,0]]);
    const cameFrom=new Map<number, RoadNode>();
    const closed=new Set<number>();
    const open: Array<{n: RoadNode; f: number; g: number}>=[{n:sNode,f:0,g:0}];
    const h=(n: RoadNode)=>Math.abs(n.x-eNode.x)+Math.abs(n.z-eNode.z);
    while(open.length){
      let bi=0;
      for(let i=1;i<open.length;i++){ const cur_i=open[i], cur_bi=open[bi]; if(cur_i && cur_bi && cur_i.f<cur_bi.f) bi=i; }
      const cur=open.splice(bi,1)[0];
      if(cur && closed.has(cur.n.i)) continue;
      if(!cur) continue;
      if(cur.n.i===eNode.i){
        const path: RoadNode[]=[]; let c: RoadNode | undefined=cur.n;
        while(c!==undefined){ path.unshift(c); c=cameFrom.get(c.i); }
        _graph.routeCache.set(cacheKey,path);
        _graph.routeCache.set(eNode.i+','+sNode.i,[...path].reverse());
        return path;
      }
      closed.add(cur.n.i);
      for(const nb of cur.n.adj){
        if(closed.has(nb.i)) continue;
        const tg=cur.g+Math.hypot(nb.x-cur.n.x,nb.z-cur.n.z);
        const old=gScore.get(nb.i);
        if(old===undefined||tg<old){
          gScore.set(nb.i,tg);
          cameFrom.set(nb.i,cur.n);
          open.push({n:nb,g:tg,f:tg+h(nb)});
        }
      }
    }
    _graph.routeCache.set(cacheKey,null);
    return null;
  }
  
  // Snap a road-line point to the nearest reachable intersection on the network
  // (grid, central plaza ring, outer ring or dedicated area roads).
  function connectToGrid(p: THREE.Vector3, graph: RoadGraph): RoadNode | null {
    const key=p.x+','+p.z;
    if(graph.nodeIdx.has(key)) {
      const idx=graph.nodeIdx.get(key);
      const node=idx!==undefined?graph.nodes[idx]:undefined;
      if(node && node.adj.length) return node;
    }
    if(ROAD_COORDS.includes(p.x)){
      let best: RoadNode | null=null,bestDelta=Infinity;
      for(const z of ROAD_COORDS) {
        const delta=Math.abs(z-p.z);
        if(delta>=bestDelta) continue;
        const idx=graph.nodeIdx.get(p.x+','+z);
        const node=idx!==undefined?graph.nodes[idx]:undefined;
        if(node&&node.adj.length&&!pathBlocked(p.x,p.z,p.x,z)){ best=node; bestDelta=delta; }
      }
      if(best) return best;
    }
    if(ROAD_COORDS.includes(p.z)){
      let best: RoadNode | null=null,bestDelta=Infinity;
      for(const x of ROAD_COORDS) {
        const delta=Math.abs(x-p.x);
        if(delta>=bestDelta) continue;
        const idx=graph.nodeIdx.get(x+','+p.z);
        const node=idx!==undefined?graph.nodes[idx]:undefined;
        if(node&&node.adj.length&&!pathBlocked(p.x,p.z,x,p.z)){ best=node; bestDelta=delta; }
      }
      if(best) return best;
    }
    // Nearest reachable node anywhere on the network. This handles spawn in the
    // fountain plaza and corner off-grid spots: the player is
    // snapped to the CLOSEST clear node so it never gets pushed the wrong way.
    let echoNode: RoadNode | null=null,echoDistanceSquared=Infinity;
    for(const [x,z] of ECHO_OBSERVATORY_AREA.roadNodes){
      const idx=graph.nodeIdx.get(x+','+z);
      const node=idx!==undefined?graph.nodes[idx]:undefined;
      if(!node||!node.adj.length) continue;
      const dx=node.x-p.x,dz=node.z-p.z,distanceSquared=dx*dx+dz*dz;
      if(distanceSquared<echoDistanceSquared){ echoNode=node; echoDistanceSquared=distanceSquared; }
    }
    if(echoNode && p.x>=44 && !pathBlocked(p.x,p.z,echoNode.x,echoNode.z)) return echoNode;
    let best: RoadNode | null=null, bestDistanceSquared=Infinity;
    for(const node of graph.nodes){
      if(!node.adj.length) continue;
      const dx=node.x-p.x,dz=node.z-p.z,distanceSquared=dx*dx+dz*dz;
      if(distanceSquared>=bestDistanceSquared) continue;
      if(!pathBlocked(p.x,p.z,node.x,node.z)){ best=node; bestDistanceSquared=distanceSquared; }
    }
    return best;
  }
  
  // Malls/schools sit ON the outer arterial lines; a road-line target that lands
  // in their footprint is moved just outside the base, along the road, toward
  // the city center — so the player never walks through the building.
  function snapToRoadClear(p: THREE.Vector3): THREE.Vector3 {
    const q=p.clone();
    const lineX=ROAD_COORDS.includes(q.x);
    const lineZ=ROAD_COORDS.includes(q.z);
    if(!lineX&&!lineZ) return q;
    for(const bx of buildingBoxes){
      if(q.x<bx.minX||q.x>bx.maxX||q.z<bx.minZ||q.z>bx.maxZ) continue;
      if(lineX){
        const a=bx.minZ-0.6, b=bx.maxZ+0.6;
        q.z=Math.abs(a)<Math.abs(b)?a:b;
      } else {
        const a=bx.minX-0.6, b=bx.maxX+0.6;
        q.x=Math.abs(a)<Math.abs(b)?a:b;
      }
      break;
    }
    return q;
  }
  
  // Building clicks start inside the building footprint. Find the closest road
  // centerline outside that footprint instead of testing a segment whose first
  // point is already inside the obstacle.
  function buildingRoadEntry(p: THREE.Vector3): THREE.Vector3 | null {
    let owner: BuildingBox | null=null;
    for(const bx of buildingBoxes){
      if(p.x>=bx.minX&&p.x<=bx.maxX&&p.z>=bx.minZ&&p.z<=bx.maxZ){ owner=bx; break; }
    }
    if(!owner) return null;
    const candidates: THREE.Vector3[]=[];
    ROAD_COORDS.forEach((x:number)=>{
      const z = x>=owner.minX&&x<=owner.maxX
        ? (Math.abs(owner.minZ-0.6)<Math.abs(owner.maxZ+0.6) ? owner.minZ-0.6 : owner.maxZ+0.6)
        : p.z;
      candidates.push(groundPoint(x,z));
    });
    ROAD_COORDS.forEach((z:number)=>{
      const x = z>=owner.minZ&&z<=owner.maxZ
        ? (Math.abs(owner.minX-0.6)<Math.abs(owner.maxX+0.6) ? owner.minX-0.6 : owner.maxX+0.6)
        : p.x;
      candidates.push(groundPoint(x,z));
    });
    // The echo house sits beside a short, dedicated road rather than on a
    // main-grid centerline. Add perimeter points so an interaction target can
    // stop at its nearest doorway-facing edge instead of ending several metres
    // away at [68, 0] (which becomes unreachable after the house is enlarged).
    if (p.x >= 44) {
      const clearance = 0.7;
      const x = clamp(p.x, owner.minX, owner.maxX);
      const z = clamp(p.z, owner.minZ, owner.maxZ);
      candidates.push(
        groundPoint(x, owner.minZ - clearance),
        groundPoint(x, owner.maxZ + clearance),
        groundPoint(owner.minX - clearance, z),
        groundPoint(owner.maxX + clearance, z),
      );
    }
    if(p.x>=44){
      ECHO_OBSERVATORY_AREA.roadNodes.forEach(([x,z])=>candidates.push(groundPoint(x,z)));
    }
    candidates.sort((a,b)=>{
      const da=a.distanceTo(p), db=b.distanceTo(p);
      return da-db || Math.abs(a.x)+Math.abs(a.z)-Math.abs(b.x)-Math.abs(b.z);
    });
    const clear=(q: THREE.Vector3): boolean=>{
      if(q.x>=owner.minX&&q.x<=owner.maxX&&q.z>=owner.minZ&&q.z<=owner.maxZ) return false;
      return !pointInAnyBuilding(q.x,q.z);
    };
    return candidates.find(clear) || candidates.find((q: THREE.Vector3)=>{
      return q.x<owner.minX||q.x>owner.maxX||q.z<owner.minZ||q.z>owner.maxZ;
    }) || candidates[0] || null;
  }
  
  // True when (x,z) falls inside any cached building footprint (used to stop the
  // player from being told to walk through or stand inside a building).
  function pointInAnyBuilding(x: number,z: number): boolean {
    return visitCollisionCandidates(x,z,x,z,(bx)=>
      x>=bx.minX&&x<=bx.maxX&&z>=bx.minZ&&z<=bx.maxZ,
    );
  }
  
  function cacheBuildingBoxes() {
    buildingBoxes.length=0;
    collisionRows.clear();
    buildings.forEach((building)=>addObjectBounds(building.group));
    obstacleGroups.forEach(addObstacleBounds);
    buildingBoxesInitialized=true;
  }
  
  function segHitsBuilding(x1: number,z1: number,x2: number,z2: number): boolean {
    const dx=x2-x1, dz=z2-z1;
    if(Math.abs(dx)<1e-8&&Math.abs(dz)<1e-8) return pointInAnyBuilding(x1,z1);
    return visitCollisionCandidates(
      Math.min(x1,x2),Math.min(z1,z2),Math.max(x1,x2),Math.max(z1,z2),(bx)=>{
      let near=0, far=1;
      const clip=(origin: number,delta: number,min: number,max: number): boolean=>{
        if(Math.abs(delta)<1e-8) return origin>=min&&origin<=max;
        let a=(min-origin)/delta, b=(max-origin)/delta;
        if(a>b){const t=a;a=b;b=t;}
        near=Math.max(near,a); far=Math.min(far,b);
        return near<=far;
      };
      if(clip(x1,dx,bx.minX,bx.maxX)&&clip(z1,dz,bx.minZ,bx.maxZ)&&far>=0&&near<=1) return true;
      return false;
    });
  }
  
  // 找一个「从 p 直达且不穿建筑/喷泉」的路点；p 已在路上则原样返回
  function roadEntry(p: THREE.Vector3): THREE.Vector3 {
    const buildingEntry=buildingRoadEntry(p);
    if(buildingEntry) return buildingEntry;
    if(isRoadPoint(p)) return snapToRoadClear(p);
    if(p.z<=-42 && NORTH_DISTRICT_AREA.roadNodes.length){
      const nearest=NORTH_DISTRICT_AREA.roadNodes.slice().sort((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)-Math.hypot(b[0]-p.x,b[1]-p.z))[0]!;
      const q=groundPoint(nearest[0],nearest[1]);
      if(!pointInAnyBuilding(p.x,p.z) && !pathBlocked(p.x,p.z,q.x,q.z)) return p.clone();
      return pointInAnyBuilding(q.x,q.z) ? p.clone() : q;
    }
    // 南草甸步道（方案 §6.1）：主城网格以南（z ≥ 42，镜像北城 -42 门）的
    // 目标吸附到最近的步道节点——草甸深处的点击由此改走切槽步道路径。
    if(p.z>=42 && MEADOW_TRAIL.roadNodes.length){
      const nearest=MEADOW_TRAIL.roadNodes.slice().sort((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)-Math.hypot(b[0]-p.x,b[1]-p.z))[0]!;
      const q=groundPoint(nearest[0],nearest[1]);
      const nearTrail=Math.hypot(p.x-q.x,p.z-q.z)<=8;
      if(nearTrail && !pointInAnyBuilding(p.x,p.z) && !pathBlocked(p.x,p.z,q.x,q.z)) return p.clone();
      return pointInAnyBuilding(q.x,q.z) ? p.clone() : q;
    }
    if(p.x>=44 && ECHO_OBSERVATORY_AREA.roadNodes.length){
      const nearest=ECHO_OBSERVATORY_AREA.roadNodes.slice().sort((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)-Math.hypot(b[0]-p.x,b[1]-p.z))[0]!;
      const q=groundPoint(nearest[0],nearest[1]);
      // Echo story markers (notably the porch ring) live a few metres off the
      // short road. Keep a nearby clear marker as the final approach target so
      // pending interactions can complete instead of stopping at [68, 0].
      const nearRoad = Math.hypot(p.x-q.x,p.z-q.z) <= 5;
      if (nearRoad && !pointInAnyBuilding(p.x,p.z) && !pathBlocked(p.x,p.z,q.x,q.z)) return p.clone();
      return pointInAnyBuilding(q.x,q.z) ? p.clone() : q;
    }
    // Otherwise snap to the NEAREST road-line point that can be reached with a
    // straight clear hop — for the fountain plaza this is the closest plaza
    // node, so the player never gets pushed toward a far corner first.
    let best: THREE.Vector3|null=null, bestD=Infinity;
    const tryPoint=(cx: number,cz: number)=>{
      const q=groundPoint(cx,cz);
      const d=q.distanceTo(p);
      if(d<bestD&&!pathBlocked(p.x,p.z,cx,cz)&&!pointInAnyBuilding(cx,cz)){
        best=q; bestD=d;
      }
    };
    ROAD_COORDS.forEach((x:number)=>{ tryPoint(x,p.z); tryPoint(x,nearestRoadCoord(p.z)); });
    ROAD_COORDS.forEach((z:number)=>{ tryPoint(p.x,z); tryPoint(nearestRoadCoord(p.x),z); });
    PLAZA_POINTS.forEach(([x,z])=>tryPoint(x,z));
    ECHO_OBSERVATORY_AREA.roadNodes.forEach(([x,z])=>tryPoint(x,z));
    NORTH_DISTRICT_AREA.roadNodes.forEach(([x,z])=>tryPoint(x,z));
    MEADOW_TRAIL.roadNodes.forEach(([x,z])=>tryPoint(x,z));
    if(best) return best;
    return nearestRoadPoint(p);
  }
  
  function nearestRoadPoint(p: THREE.Vector3): THREE.Vector3 {
    const x=clamp(p.x,-CITY_LIMIT,CITY_LIMIT), z=clamp(p.z,-CITY_LIMIT,CITY_LIMIT);
    const rx=nearestRoadCoord(x), rz=nearestRoadCoord(z);
    return Math.abs(x-rx)<Math.abs(z-rz) ? groundPoint(rx,z) : groundPoint(x,rz);
  }
  
  function nearestRoadCoord(v: number): number {
    return nearestCoord(v,ROAD_COORDS);
  }
  
  function nearestCoord(v: number, coords: readonly number[]): number {
    const start=coords[0] ?? v;
    return coords.reduce((best,c)=>Math.abs(v-c)<Math.abs(v-best)?c:best,start);
  }
  
  function isRoadPoint(p: THREE.Vector3): boolean {
    return ROAD_COORDS.some(c=>Math.abs(p.x-c)<0.01)||ROAD_COORDS.some(c=>Math.abs(p.z-c)<0.01);
  }
  
  function clamp(v: number,min: number,max: number): number { return Math.max(min,Math.min(max,v)); }

  return {
    fountainClear: FOUNTAIN_CLEAR,
    buildRoadPath,
    buildingRoadEntry,
    pointInAnyBuilding,
    cacheBuildingBoxes,
    registerObstacleGroup,
    resolveMovement,
    nearestRoadCoord,
    clamp,
  };
}

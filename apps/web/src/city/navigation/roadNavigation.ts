import * as THREE from 'three';

interface RoadNode extends THREE.Vector3 {
  i: number;
  adj: RoadNode[];
}
interface RoadGraph {
  nodes: RoadNode[];
  nodeIdx: Map<string, number>;
}
interface BuildingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
interface ObstacleFootprint {
  width: number;
  depth: number;
}

export interface RoadNavigationOptions {
  roadCoords: readonly number[];
  echoObservatoryArea?: {
    roadNodes: readonly (readonly [number, number])[];
    roadSegments: readonly (readonly [number, number, number, number])[];
  };
  westBeach?: { deepWaterX: number; safeReturnX: number; minZ: number; maxZ: number };
  cityLimit: number;
  getBuildings: () => readonly { group: THREE.Object3D }[];
}

export function createRoadNavigationSystem(options: RoadNavigationOptions) {
  const ROAD_COORDS = [...options.roadCoords];
  const ECHO_OBSERVATORY_AREA = options.echoObservatoryArea || { roadNodes: [], roadSegments: [] };
  const CITY_LIMIT = options.cityLimit;
  const PLAYER_CLEARANCE = 0.2;
  const WEST_BEACH = options.westBeach;
  const allExtraNodes = [...ECHO_OBSERVATORY_AREA.roadNodes];
  const WORLD_BOUNDS = {
    minX: Math.min(-CITY_LIMIT, ...allExtraNodes.map(([x]) => x)) - 8,
    maxX: Math.max(CITY_LIMIT, ...allExtraNodes.map(([x]) => x)) + 8,
    minZ: Math.min(-CITY_LIMIT, ...allExtraNodes.map(([,z]) => z)) - 8,
    maxZ: Math.max(CITY_LIMIT, ...allExtraNodes.map(([,z]) => z)) + 8,
  };
  const buildings = options.getBuildings();
  const buildingBoxes: BuildingBox[] = [];
  const obstacleGroups: THREE.Object3D[] = [];
  function registerObstacleGroup(group: THREE.Object3D) {
    if (!group || obstacleGroups.includes(group)) return;
    obstacleGroups.push(group);
    cacheBuildingBoxes();
    roadGraph = null;
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
        for(let i=1;i<gridPath.length;i++){ const g=gridPath[i]!; pts.push(new THREE.Vector3(g.x,0,g.z)); }
        // Never end a leg inside a building footprint, and never strike the final
        // approach across a building: stop on the road instead.
        const lastPts=pts[pts.length-1]!;
        const approachClear=!pointInAnyBuilding(end.x,end.z)
          && !segHitsBuilding(lastPts.x,lastPts.z,end.x,end.z)
          && !pathBlocked(lastPts.x,lastPts.z,end.x,end.z);
        if(approachClear) pts.push(end);
        // Straighten collinear runs along the SAME road line only — never cut
        // diagonally across building blocks or open ground.
        const out: THREE.Vector3[]=[];
        for(const p of pts){
          if(out.length>=2){
            const a=out[out.length-2]!, b=out[out.length-1]!;
            const sameLine=(a.x===b.x&&b.x===p.x)||(a.z===b.z&&b.z===p.z);
            if(sameLine&&!segHitsBuilding(a.x,a.z,p.x,p.z)&&!pathBlocked(a.x,a.z,p.x,p.z)){
              out.pop();
            }
          }
          out.push(p);
        }
        const filtered=out.filter((p,i,arr)=>i===0||p.distanceTo(arr[i-1]!)>0.05);
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
  const PLAZA_POINTS: [number, number][] = Array.from({length:8},(_,i)=>{
    const a=i/8*Math.PI*2;
    return [Number((Math.cos(a)*2.7).toFixed(3)), Number((Math.sin(a)*2.7).toFixed(3))];
  });
  let roadGraph: RoadGraph | null = null;
  
  function getRoadGraph(): RoadGraph {
    if(roadGraph) return roadGraph;
    const coords=ROAD_COORDS;
    const nodeIdx=new Map<string, number>();
    const nodes: RoadNode[]=[];
    const addNode=(x: number, z: number): RoadNode => {
      const key=x+','+z;
      if(nodeIdx.has(key)) return nodes[nodeIdx.get(key)!]!;
      const node=new THREE.Vector3(x,0,z) as RoadNode;
      node.i=nodes.length;
      node.adj=[];
      nodeIdx.set(key,nodes.length);
      nodes.push(node);
      return node;
    };
    const nodeAt=(key: string): RoadNode => nodes[nodeIdx.get(key)!]!;
    coords.forEach(x=>coords.forEach(z=>addNode(x,z)));
    nodes.forEach((n,i)=>{ n.i=i; n.adj=[]; });
    const addEdge=(a: RoadNode, b: RoadNode)=>{
      if(pathBlocked(a.x,a.z,b.x,b.z)) return;
      a.adj.push(b); b.adj.push(a);
    };
    coords.forEach((x,i)=>coords.forEach((z,j)=>{
      const a=nodeAt(x+','+z);
      if(i+1<coords.length) addEdge(a,nodeAt(coords[i+1]+','+z));
      if(j+1<coords.length) addEdge(a,nodeAt(x+','+coords[j+1]));
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
    [[0,-36,0,-38],[36,0,38,0],[0,36,0,38],[-36,0,-38,0]].forEach(([x1,z1,x2,z2])=>{
      const a=nodeAt(x1+','+z1);
      const b=nodeAt(x2+','+z2);
      if(a&&b) addEdge(a,b);
    });

    ECHO_OBSERVATORY_AREA.roadNodes.forEach(([x,z])=>addNode(x,z));
    ECHO_OBSERVATORY_AREA.roadSegments.forEach(([x1,z1,x2,z2])=>{
      addEdge(nodeAt(x1+','+z1),nodeAt(x2+','+z2));
    });
  
    // Inner plaza loop: the walkable counterpart of the central ring mesh added
    // in addPaths(). It connects to each arterial without entering the fountain.
    const plazaNodes=PLAZA_POINTS.map(([x,z])=>addNode(x,z));
    plazaNodes.forEach((n,i)=>addEdge(n,plazaNodes[(i+1)%plazaNodes.length]!));
    [[0,-6,0,-2.7],[6,0,2.7,0],[0,6,0,2.7],[-6,0,-2.7,0]].forEach(([x1,z1,x2,z2])=>{
      const a=nodeAt(x1+','+z1);
      const b=nodeAt(x2+','+z2);
      if(a&&b) addEdge(a,b);
    });
    roadGraph={nodes,nodeIdx};
    return roadGraph;
  }
  
  // A straight segment is unusable if it crosses a building footprint or the
  // fountain plaza (the arterial roads are cut there and no mesh exists).
  function pathBlocked(x1: number, z1: number, x2: number, z2: number): boolean {
    if(segHitsBuilding(x1,z1,x2,z2)) return true;
    const dx=x2-x1, dz=z2-z1;
    const len2=dx*dx+dz*dz;
    const t=len2<1e-9?0:clamp(((0-x1)*dx+(0-z1)*dz)/len2,0,1);
    const cx=x1+dx*t, cz=z1+dz*t;
    return cx*cx+cz*cz < FOUNTAIN_CLEAR*FOUNTAIN_CLEAR;
  }

  function positionBlocked(x: number, z: number): boolean {
    if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>WORLD_BOUNDS.maxZ) return true;
    if(x*x+z*z < FOUNTAIN_CLEAR*FOUNTAIN_CLEAR) return true;
    if(WEST_BEACH && x<WEST_BEACH.deepWaterX && z>=WEST_BEACH.minZ && z<=WEST_BEACH.maxZ) return true;
    return pointInAnyBuilding(x,z);
  }

  function resolveMovement(from: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    const desired = new THREE.Vector3(
      clamp(target.x,WORLD_BOUNDS.minX,WORLD_BOUNDS.maxX),
      0,
      clamp(target.z,WORLD_BOUNDS.minZ,WORLD_BOUNDS.maxZ),
    );
    if(WEST_BEACH && desired.x<WEST_BEACH.deepWaterX && desired.z>=WEST_BEACH.minZ && desired.z<=WEST_BEACH.maxZ) {
      return new THREE.Vector3(WEST_BEACH.safeReturnX,0,clamp(desired.z,WEST_BEACH.minZ,WEST_BEACH.maxZ));
    }
    if(positionBlocked(from.x,from.z)) return positionBlocked(desired.x,desired.z) ? from.clone() : desired;
    if(!positionBlocked(desired.x,desired.z)&&!pathBlocked(from.x,from.z,desired.x,desired.z)) return desired;
    const alongX=new THREE.Vector3(desired.x,0,from.z);
    const alongZ=new THREE.Vector3(from.x,0,desired.z);
    const candidates=[alongX,alongZ].filter(p=>!positionBlocked(p.x,p.z)&&!pathBlocked(from.x,from.z,p.x,p.z));
    candidates.sort((a,b)=>a.distanceToSquared(desired)-b.distanceToSquared(desired));
    return candidates[0] ?? from.clone();
  }
  
  function aStarRoad(sNode: RoadNode, eNode: RoadNode, graph: RoadGraph): RoadNode[] | null {
    if(sNode===eNode) return [sNode];
    const gScore=new Map<number, number>([[sNode.i,0]]);
    const cameFrom=new Map<number, RoadNode>();
    const closed=new Set<number>();
    const open: {n: RoadNode, f: number, g: number}[]=[{n:sNode,f:0,g:0}];
    const h=(n: RoadNode)=>Math.abs(n.x-eNode.x)+Math.abs(n.z-eNode.z);
    while(open.length){
      let bi=0;
      for(let i=1;i<open.length;i++) if(open[i]!.f<open[bi]!.f) bi=i;
      const cur=open.splice(bi,1)[0];
      if(!cur) continue;
      if(closed.has(cur.n.i)) continue;
      if(cur.n.i===eNode.i){
        const path: RoadNode[]=[]; let c: RoadNode | undefined=cur.n;
        while(c!==undefined){ path.unshift(c); c=cameFrom.get(c.i); }
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
    return null;
  }
  
  // Snap a road-line point to the nearest reachable intersection on the network
  // (grid, central plaza ring, outer ring or dedicated area roads).
  function connectToGrid(p: THREE.Vector3, graph: RoadGraph): RoadNode | null {
    const key=p.x+','+p.z;
    if(graph.nodeIdx.has(key)) {
      const node=graph.nodes[graph.nodeIdx.get(key)!]!;
      if(node.adj.length) return node;
    }
    if(ROAD_COORDS.includes(p.x)){
      const zs=ROAD_COORDS.slice().sort((a,b)=>Math.abs(a-p.z)-Math.abs(b-p.z));
      for(const z of zs) {
        const node=graph.nodes[graph.nodeIdx.get(p.x+','+z)!];
        if(node&&node.adj.length&&!pathBlocked(p.x,p.z,p.x,z)) return node;
      }
    }
    if(ROAD_COORDS.includes(p.z)){
      const xs=ROAD_COORDS.slice().sort((a,b)=>Math.abs(a-p.x)-Math.abs(b-p.x));
      for(const x of xs) {
        const node=graph.nodes[graph.nodeIdx.get(x+','+p.z)!];
        if(node&&node.adj.length&&!pathBlocked(p.x,p.z,x,p.z)) return node;
      }
    }
    // Nearest reachable node anywhere on the network. This handles spawn in the
    // fountain plaza and corner off-grid spots: the player is
    // snapped to the CLOSEST clear node so it never gets pushed the wrong way.
    const echoNode = ECHO_OBSERVATORY_AREA.roadNodes
      .map(([x,z])=>graph.nodes[graph.nodeIdx.get(x+','+z)!])
      .filter((node): node is RoadNode => Boolean(node && node.adj.length))
      .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
    if(echoNode && p.x>=44 && !pathBlocked(p.x,p.z,echoNode.x,echoNode.z)) return echoNode;
    let best: RoadNode | null = null, bestD=Infinity;
    for(const node of graph.nodes){
      if(!node.adj.length) continue;
      const d=Math.hypot(node.x-p.x,node.z-p.z);
      if(d>=bestD) continue;
      if(!pathBlocked(p.x,p.z,node.x,node.z)){ best=node; bestD=d; }
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
    let owner: BuildingBox | null = null;
    for(const bx of buildingBoxes){
      if(p.x>=bx.minX&&p.x<=bx.maxX&&p.z>=bx.minZ&&p.z<=bx.maxZ){ owner=bx; break; }
    }
    if(!owner) return null;
    const candidates: THREE.Vector3[]=[];
    ROAD_COORDS.forEach(x=>{
      const z = x>=owner.minX&&x<=owner.maxX
        ? (Math.abs(owner.minZ-0.6)<Math.abs(owner.maxZ+0.6) ? owner.minZ-0.6 : owner.maxZ+0.6)
        : p.z;
      candidates.push(new THREE.Vector3(x,0,z));
    });
    ROAD_COORDS.forEach(z=>{
      const x = z>=owner.minZ&&z<=owner.maxZ
        ? (Math.abs(owner.minX-0.6)<Math.abs(owner.maxX+0.6) ? owner.minX-0.6 : owner.maxX+0.6)
        : p.x;
      candidates.push(new THREE.Vector3(x,0,z));
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
        new THREE.Vector3(x, 0, owner.minZ - clearance),
        new THREE.Vector3(x, 0, owner.maxZ + clearance),
        new THREE.Vector3(owner.minX - clearance, 0, z),
        new THREE.Vector3(owner.maxX + clearance, 0, z),
      );
    }
    if(p.x>=44){
      ECHO_OBSERVATORY_AREA.roadNodes.forEach(([x,z])=>candidates.push(new THREE.Vector3(x,0,z)));
    }
    candidates.sort((a,b)=>{
      const da=a.distanceTo(p), db=b.distanceTo(p);
      return da-db || Math.abs(a.x)+Math.abs(a.z)-Math.abs(b.x)-Math.abs(b.z);
    });
    const clear=(q: THREE.Vector3)=>{
      if(q.x>=owner.minX&&q.x<=owner.maxX&&q.z>=owner.minZ&&q.z<=owner.maxZ) return false;
      return !pointInAnyBuilding(q.x,q.z);
    };
    return candidates.find(clear) ?? candidates.find(q=>{
      return q.x<owner.minX||q.x>owner.maxX||q.z<owner.minZ||q.z>owner.maxZ;
    }) ?? candidates[0] ?? null;
  }
  
  // True when (x,z) falls inside any cached building footprint (used to stop the
  // player from being told to walk through or stand inside a building).
  function pointInAnyBuilding(x: number, z: number): boolean {
    for(const bx of buildingBoxes){
      if(x>=bx.minX&&x<=bx.maxX&&z>=bx.minZ&&z<=bx.maxZ) return true;
    }
    return false;
  }
  
  function cacheBuildingBoxes() {
    buildingBoxes.length=0;
    const b=new THREE.Box3();
    buildings.forEach(bd=>{
      b.setFromObject(bd.group);
      buildingBoxes.push({
        minX:b.min.x-PLAYER_CLEARANCE, maxX:b.max.x+PLAYER_CLEARANCE,
        minZ:b.min.z-PLAYER_CLEARANCE, maxZ:b.max.z+PLAYER_CLEARANCE
      });
    });
    obstacleGroups.forEach(group=>{
      const footprint=group.userData.navigationFootprint as ObstacleFootprint | undefined;
      if(footprint){
        const center=group.getWorldPosition(new THREE.Vector3());
        const quarterTurn=Math.abs(Math.sin(group.rotation.y))>0.5;
        const width=quarterTurn?footprint.depth:footprint.width;
        const depth=quarterTurn?footprint.width:footprint.depth;
        buildingBoxes.push({minX:center.x-width/2-PLAYER_CLEARANCE,maxX:center.x+width/2+PLAYER_CLEARANCE,minZ:center.z-depth/2-PLAYER_CLEARANCE,maxZ:center.z+depth/2+PLAYER_CLEARANCE});
        return;
      }
      b.setFromObject(group);
      if (!Number.isFinite(b.min.x)) return;
      buildingBoxes.push({minX:b.min.x-PLAYER_CLEARANCE,maxX:b.max.x+PLAYER_CLEARANCE,minZ:b.min.z-PLAYER_CLEARANCE,maxZ:b.max.z+PLAYER_CLEARANCE});
    });
  }
  
  function segHitsBuilding(x1: number, z1: number, x2: number, z2: number): boolean {
    const dx=x2-x1, dz=z2-z1;
    if(Math.abs(dx)<1e-8&&Math.abs(dz)<1e-8) return pointInAnyBuilding(x1,z1);
    for(const bx of buildingBoxes){
      let near=0, far=1;
      const clip=(origin: number, delta: number, min: number, max: number): boolean => {
        if(Math.abs(delta)<1e-8) return origin>=min&&origin<=max;
        let a=(min-origin)/delta, b=(max-origin)/delta;
        if(a>b){const t=a;a=b;b=t;}
        near=Math.max(near,a); far=Math.min(far,b);
        return near<=far;
      };
      if(clip(x1,dx,bx.minX,bx.maxX)&&clip(z1,dz,bx.minZ,bx.maxZ)&&far>=0&&near<=1) return true;
    }
    return false;
  }
  
  // 找一个「从 p 直达且不穿建筑/喷泉」的路点；p 已在路上则原样返回
  function roadEntry(p: THREE.Vector3): THREE.Vector3 {
    const buildingEntry=buildingRoadEntry(p);
    if(buildingEntry) return buildingEntry;
    if(isRoadPoint(p)) return snapToRoadClear(p);
    if(p.x>=44 && ECHO_OBSERVATORY_AREA.roadNodes.length){
      const nearest=ECHO_OBSERVATORY_AREA.roadNodes.slice().sort((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)-Math.hypot(b[0]-p.x,b[1]-p.z))[0]!;
      const q=new THREE.Vector3(nearest[0],0,nearest[1]);
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
    let best=new THREE.Vector3(0,0,0), bestD=Infinity;
    const tryPoint=(cx: number, cz: number)=>{
      const q=new THREE.Vector3(cx,0,cz);
      const d=q.distanceTo(p);
      if(d<bestD&&!pathBlocked(p.x,p.z,cx,cz)&&!pointInAnyBuilding(cx,cz)){
        best=q; bestD=d;
      }
    };
    ROAD_COORDS.forEach(x=>{ tryPoint(x,p.z); tryPoint(x,nearestRoadCoord(p.z)); });
    ROAD_COORDS.forEach(z=>{ tryPoint(p.x,z); tryPoint(nearestRoadCoord(p.x),z); });
    PLAZA_POINTS.forEach(([x,z])=>tryPoint(x,z));
    ECHO_OBSERVATORY_AREA.roadNodes.forEach(([x,z])=>tryPoint(x,z));
    if(bestD<Infinity) return best;
    return nearestRoadPoint(p);
  }
  
  function nearestRoadPoint(p: THREE.Vector3): THREE.Vector3 {
    const x=clamp(p.x,-CITY_LIMIT,CITY_LIMIT), z=clamp(p.z,-CITY_LIMIT,CITY_LIMIT);
    const rx=nearestRoadCoord(x), rz=nearestRoadCoord(z);
    return Math.abs(x-rx)<Math.abs(z-rz) ? new THREE.Vector3(rx,0,z) : new THREE.Vector3(x,0,rz);
  }
  
  function nearestRoadCoord(v: number): number {
    return nearestCoord(v,ROAD_COORDS);
  }
  
  function nearestCoord(v: number, coords: readonly number[]): number {
    return coords.reduce((best,c)=>Math.abs(v-c)<Math.abs(v-best)?c:best,coords[0] ?? 0);
  }
  
  function isRoadPoint(p: THREE.Vector3): boolean {
    return ROAD_COORDS.some(c=>Math.abs(p.x-c)<0.01)||ROAD_COORDS.some(c=>Math.abs(p.z-c)<0.01);
  }
  
  function clamp(v: number, min: number, max: number): number { return Math.max(min,Math.min(max,v)); }

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
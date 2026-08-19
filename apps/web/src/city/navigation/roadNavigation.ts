// @ts-nocheck
import * as THREE from 'three';

export interface RoadNavigationOptions {
  roadCoords: readonly number[];
  echoObservatoryArea?: any;
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
  const buildingBoxes = [];
  const obstacleGroups = [];
  const obstacleGroupSet = new Set();
  const collisionRows = new Map();
  const collisionBounds = new THREE.Box3();
  const collisionCenter = new THREE.Vector3();
  const COLLISION_CELL_SIZE = 6;
  let collisionQueryStamp = 0;
  let buildingBoxesInitialized = false;

  function registerObstacleGroup(group) {
    if (!group || obstacleGroupSet.has(group)) return;
    obstacleGroupSet.add(group);
    obstacleGroups.push(group);
    if (buildingBoxesInitialized) addObstacleBounds(group);
    roadGraph = null;
  }

  function collisionCell(value) {
    return Math.floor(value / COLLISION_CELL_SIZE);
  }

  // Keep the exact AABB collision tests below, while limiting each query to
  // boxes in the grid cells touched by the point or segment.
  function indexBuildingBox(box) {
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

  function addBuildingBox(box) {
    buildingBoxes.push(box);
    indexBuildingBox(box);
  }

  function visitCollisionCandidates(minX,minZ,maxX,maxZ,visitor) {
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

  function addObjectBounds(group) {
    collisionBounds.setFromObject(group);
    if(!Number.isFinite(collisionBounds.min.x)) return;
    addBuildingBox({
      minX:collisionBounds.min.x-PLAYER_CLEARANCE, maxX:collisionBounds.max.x+PLAYER_CLEARANCE,
      minZ:collisionBounds.min.z-PLAYER_CLEARANCE, maxZ:collisionBounds.max.z+PLAYER_CLEARANCE,
      queryStamp:0,
    });
  }

  function addObstacleBounds(group) {
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

  function buildRoadPath(from, rawTarget) {
    const start=roadEntry(from);
    const end=roadEntry(rawTarget);
    const graph=getRoadGraph();
    const sNode=connectToGrid(start,graph);
    const eNode=connectToGrid(end,graph);
    if(sNode&&eNode){
      const gridPath=aStarRoad(sNode,eNode,graph);
      if(gridPath&&gridPath.length){
        const pts=[start];
        for(let i=1;i<gridPath.length;i++) pts.push(new THREE.Vector3(gridPath[i].x,0,gridPath[i].z));
        // Never end a leg inside a building footprint, and never strike the final
        // approach across a building: stop on the road instead.
        const approachClear=!pointInAnyBuilding(end.x,end.z)
          && !segHitsBuilding(pts[pts.length-1].x,pts[pts.length-1].z,end.x,end.z)
          && !pathBlocked(pts[pts.length-1].x,pts[pts.length-1].z,end.x,end.z);
        if(approachClear) pts.push(end);
        // Straighten collinear runs along the SAME road line only — never cut
        // diagonally across building blocks or open ground.
        const out=[];
        for(const p of pts){
          if(out.length>=2){
            const a=out[out.length-2], b=out[out.length-1];
            const sameLine=(a.x===b.x&&b.x===p.x)||(a.z===b.z&&b.z===p.z);
            if(sameLine&&!segHitsBuilding(a.x,a.z,p.x,p.z)&&!pathBlocked(a.x,a.z,p.x,p.z)){
              out.pop();
            }
          }
          out.push(p);
        }
        const filtered=out.filter((p,i,arr)=>i===0||p.distanceTo(arr[i-1])>0.05);
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
  const PLAZA_POINTS = Array.from({length:8},(_,i)=>{
    const a=i/8*Math.PI*2;
    return [Number((Math.cos(a)*2.7).toFixed(3)), Number((Math.sin(a)*2.7).toFixed(3))];
  });
  let roadGraph=null;
  
  function getRoadGraph() {
    if(roadGraph) return roadGraph;
    const coords=ROAD_COORDS;
    const nodeIdx=new Map();
    const nodes=[];
    const addNode=(x,z)=>{
      const key=x+','+z;
      if(nodeIdx.has(key)) return nodes[nodeIdx.get(key)];
      const node=new THREE.Vector3(x,0,z);
      node.i=nodes.length;
      node.adj=[];
      nodeIdx.set(key,nodes.length);
      nodes.push(node);
      return node;
    };
    coords.forEach(x=>coords.forEach(z=>addNode(x,z)));
    nodes.forEach((n,i)=>{ n.i=i; n.adj=[]; });
    const addEdge=(a,b)=>{
      if(pathBlocked(a.x,a.z,b.x,b.z)) return;
      a.adj.push(b); b.adj.push(a);
    };
    coords.forEach((x,i)=>coords.forEach((z,j)=>{
      const a=nodes[nodeIdx.get(x+','+z)];
      if(i+1<coords.length) addEdge(a,nodes[nodeIdx.get(coords[i+1]+','+z)]);
      if(j+1<coords.length) addEdge(a,nodes[nodeIdx.get(x+','+coords[j+1])]);
    }));
  
    // The visible outer ring is a real escape route around the fountain and
    // blocked building edges. Connect it to the four arterial endpoints.
    const ringNodes=[];
    const ringR=38;
    const ringCount=24;
    for(let i=0;i<ringCount;i++){
      const a=i/ringCount*Math.PI*2;
      ringNodes.push(addNode(Number((Math.cos(a)*ringR).toFixed(3)),Number((Math.sin(a)*ringR).toFixed(3))));
    }
    ringNodes.forEach((n,i)=>addEdge(n,ringNodes[(i+1)%ringCount]));
    [[0,-36,0,-38],[36,0,38,0],[0,36,0,38],[-36,0,-38,0]].forEach(([x1,z1,x2,z2])=>{
      const a=nodes[nodeIdx.get(x1+','+z1)];
      const b=nodes[nodeIdx.get(x2+','+z2)];
      if(a&&b) addEdge(a,b);
    });
  
    ECHO_OBSERVATORY_AREA.roadNodes.forEach(([x,z])=>addNode(x,z));
    ECHO_OBSERVATORY_AREA.roadSegments.forEach(([x1,z1,x2,z2])=>{
      addEdge(nodes[nodeIdx.get(x1+','+z1)],nodes[nodeIdx.get(x2+','+z2)]);
    });
  
    // Inner plaza loop: the walkable counterpart of the central ring mesh added
    // in addPaths(). It connects to each arterial without entering the fountain.
    const plazaNodes=PLAZA_POINTS.map(([x,z])=>addNode(x,z));
    plazaNodes.forEach((n,i)=>addEdge(n,plazaNodes[(i+1)%plazaNodes.length]));
    [[0,-6,0,-2.7],[6,0,2.7,0],[0,6,0,2.7],[-6,0,-2.7,0]].forEach(([x1,z1,x2,z2])=>{
      const a=nodes[nodeIdx.get(x1+','+z1)];
      const b=nodes[nodeIdx.get(x2+','+z2)];
      if(a&&b) addEdge(a,b);
    });
    roadGraph={nodes,nodeIdx,routeCache:new Map()};
    return roadGraph;
  }
  
  // A straight segment is unusable if it crosses a building footprint or the
  // fountain plaza (the arterial roads are cut there and no mesh exists).
  function pathBlocked(x1,z1,x2,z2) {
    if(segHitsBuilding(x1,z1,x2,z2)) return true;
    const dx=x2-x1, dz=z2-z1;
    const len2=dx*dx+dz*dz;
    const t=len2<1e-9?0:clamp(((0-x1)*dx+(0-z1)*dz)/len2,0,1);
    const cx=x1+dx*t, cz=z1+dz*t;
    return cx*cx+cz*cz < FOUNTAIN_CLEAR*FOUNTAIN_CLEAR;
  }

  function positionBlocked(x,z) {
    if(x<WORLD_BOUNDS.minX||x>WORLD_BOUNDS.maxX||z<WORLD_BOUNDS.minZ||z>WORLD_BOUNDS.maxZ) return true;
    if(x*x+z*z < FOUNTAIN_CLEAR*FOUNTAIN_CLEAR) return true;
    if(WEST_BEACH && x<WEST_BEACH.deepWaterX && z>=WEST_BEACH.minZ && z<=WEST_BEACH.maxZ) return true;
    return pointInAnyBuilding(x,z);
  }

  function resolveMovement(from,target,result=new THREE.Vector3()) {
    const fromX=from.x, fromZ=from.z;
    const desiredX=clamp(target.x,WORLD_BOUNDS.minX,WORLD_BOUNDS.maxX);
    const desiredZ=clamp(target.z,WORLD_BOUNDS.minZ,WORLD_BOUNDS.maxZ);
    result.set(desiredX,0,desiredZ);
    if(WEST_BEACH && desiredX<WEST_BEACH.deepWaterX && desiredZ>=WEST_BEACH.minZ && desiredZ<=WEST_BEACH.maxZ) {
      return result.set(WEST_BEACH.safeReturnX,0,clamp(desiredZ,WEST_BEACH.minZ,WEST_BEACH.maxZ));
    }
    if(positionBlocked(fromX,fromZ)) return positionBlocked(desiredX,desiredZ) ? result.set(fromX,0,fromZ) : result;
    if(!positionBlocked(desiredX,desiredZ)&&!pathBlocked(fromX,fromZ,desiredX,desiredZ)) return result;
    const alongXClear=!positionBlocked(desiredX,fromZ)&&!pathBlocked(fromX,fromZ,desiredX,fromZ);
    const alongZClear=!positionBlocked(fromX,desiredZ)&&!pathBlocked(fromX,fromZ,fromX,desiredZ);
    if(alongXClear&&alongZClear){
      const alongXDistance=(fromZ-desiredZ)**2;
      const alongZDistance=(fromX-desiredX)**2;
      return alongXDistance<=alongZDistance ? result.set(desiredX,0,fromZ) : result.set(fromX,0,desiredZ);
    }
    if(alongXClear) return result.set(desiredX,0,fromZ);
    if(alongZClear) return result.set(fromX,0,desiredZ);
    return result.set(fromX,0,fromZ);
  }
  
  function aStarRoad(sNode,eNode,graph) {
    if(sNode===eNode) return [sNode];
    const cacheKey=sNode.i+','+eNode.i;
    if(graph.routeCache.has(cacheKey)) return graph.routeCache.get(cacheKey);
    const gScore=new Map([[sNode.i,0]]);
    const cameFrom=new Map();
    const closed=new Set();
    const open=[{n:sNode,f:0,g:0}];
    const h=n=>Math.abs(n.x-eNode.x)+Math.abs(n.z-eNode.z);
    while(open.length){
      let bi=0;
      for(let i=1;i<open.length;i++) if(open[i].f<open[bi].f) bi=i;
      const cur=open.splice(bi,1)[0];
      if(closed.has(cur.n.i)) continue;
      if(cur.n.i===eNode.i){
        const path=[]; let c=cur.n;
        while(c!==undefined){ path.unshift(c); c=cameFrom.get(c.i); }
        graph.routeCache.set(cacheKey,path);
        graph.routeCache.set(eNode.i+','+sNode.i,[...path].reverse());
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
    graph.routeCache.set(cacheKey,null);
    return null;
  }
  
  // Snap a road-line point to the nearest reachable intersection on the network
  // (grid, central plaza ring, outer ring or dedicated area roads).
  function connectToGrid(p,graph) {
    const key=p.x+','+p.z;
    if(graph.nodeIdx.has(key)) {
      const node=graph.nodes[graph.nodeIdx.get(key)];
      if(node.adj.length) return node;
    }
    if(ROAD_COORDS.includes(p.x)){
      let best=null,bestDelta=Infinity;
      for(const z of ROAD_COORDS) {
        const delta=Math.abs(z-p.z);
        if(delta>=bestDelta) continue;
        const node=graph.nodes[graph.nodeIdx.get(p.x+','+z)];
        if(node&&node.adj.length&&!pathBlocked(p.x,p.z,p.x,z)){ best=node; bestDelta=delta; }
      }
      if(best) return best;
    }
    if(ROAD_COORDS.includes(p.z)){
      let best=null,bestDelta=Infinity;
      for(const x of ROAD_COORDS) {
        const delta=Math.abs(x-p.x);
        if(delta>=bestDelta) continue;
        const node=graph.nodes[graph.nodeIdx.get(x+','+p.z)];
        if(node&&node.adj.length&&!pathBlocked(p.x,p.z,x,p.z)){ best=node; bestDelta=delta; }
      }
      if(best) return best;
    }
    // Nearest reachable node anywhere on the network. This handles spawn in the
    // fountain plaza and corner off-grid spots: the player is
    // snapped to the CLOSEST clear node so it never gets pushed the wrong way.
    let echoNode=null,echoDistanceSquared=Infinity;
    for(const [x,z] of ECHO_OBSERVATORY_AREA.roadNodes){
      const node=graph.nodes[graph.nodeIdx.get(x+','+z)];
      if(!node||!node.adj.length) continue;
      const dx=node.x-p.x,dz=node.z-p.z,distanceSquared=dx*dx+dz*dz;
      if(distanceSquared<echoDistanceSquared){ echoNode=node; echoDistanceSquared=distanceSquared; }
    }
    if(echoNode && p.x>=44 && !pathBlocked(p.x,p.z,echoNode.x,echoNode.z)) return echoNode;
    let best=null, bestDistanceSquared=Infinity;
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
  function snapToRoadClear(p) {
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
  function buildingRoadEntry(p) {
    let owner=null;
    for(const bx of buildingBoxes){
      if(p.x>=bx.minX&&p.x<=bx.maxX&&p.z>=bx.minZ&&p.z<=bx.maxZ){ owner=bx; break; }
    }
    if(!owner) return null;
    const candidates=[];
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
    const clear=q=>{
      if(q.x>=owner.minX&&q.x<=owner.maxX&&q.z>=owner.minZ&&q.z<=owner.maxZ) return false;
      return !pointInAnyBuilding(q.x,q.z);
    };
    return candidates.find(clear) || candidates.find(q=>{
      return q.x<owner.minX||q.x>owner.maxX||q.z<owner.minZ||q.z>owner.maxZ;
    }) || candidates[0];
  }
  
  // True when (x,z) falls inside any cached building footprint (used to stop the
  // player from being told to walk through or stand inside a building).
  function pointInAnyBuilding(x,z) {
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
  
  function segHitsBuilding(x1,z1,x2,z2) {
    const dx=x2-x1, dz=z2-z1;
    if(Math.abs(dx)<1e-8&&Math.abs(dz)<1e-8) return pointInAnyBuilding(x1,z1);
    return visitCollisionCandidates(
      Math.min(x1,x2),Math.min(z1,z2),Math.max(x1,x2),Math.max(z1,z2),(bx)=>{
      let near=0, far=1;
      const clip=(origin,delta,min,max)=>{
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
  function roadEntry(p) {
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
    const tryPoint=(cx,cz)=>{
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
  
  function nearestRoadPoint(p) {
    const x=clamp(p.x,-CITY_LIMIT,CITY_LIMIT), z=clamp(p.z,-CITY_LIMIT,CITY_LIMIT);
    const rx=nearestRoadCoord(x), rz=nearestRoadCoord(z);
    return Math.abs(x-rx)<Math.abs(z-rz) ? new THREE.Vector3(rx,0,z) : new THREE.Vector3(x,0,rz);
  }
  
  function nearestRoadCoord(v) {
    return nearestCoord(v,ROAD_COORDS);
  }
  
  function nearestCoord(v,coords) {
    return coords.reduce((best,c)=>Math.abs(v-c)<Math.abs(v-best)?c:best,coords[0]);
  }
  
  function isRoadPoint(p) {
    return ROAD_COORDS.some(c=>Math.abs(p.x-c)<0.01)||ROAD_COORDS.some(c=>Math.abs(p.z-c)<0.01);
  }
  
  function clamp(v,min,max) { return Math.max(min,Math.min(max,v)); }

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

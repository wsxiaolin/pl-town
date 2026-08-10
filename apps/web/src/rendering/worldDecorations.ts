// Procedural city decoration catalog and its instanced rendering resources.
// @ts-nocheck
import * as THREE from 'three';
import { InstancedBatch } from '../core/InstancedBatch';
import { RENDER_ORDER, SURFACE_Y } from './layers';

export function createWorldDecorations(options) {
  const {
    scene, resources, palette: P, roadCoords: ROAD_COORDS, cityLimit: CITY_LIMIT,
    buildings, residences, pathMaterials: pathMats, lampMaterials: lampGlobes,
    getIsNight, makeMaterial: stdMat, makeMesh: mk, addPart: part, addRaycastGroup,
  } = options;
  let treeTrunks, treeCrowns, lampPosts, lampLights;

  function addPigeonSculpture(x, y, z, rotY) {
    const g = new THREE.Group();
    part(g, new THREE.BoxGeometry(0.6, 0.08, 0.6), {color:0xD4D3D0, roughness:0.8, tex:'stone', rx:1, ry:1}, [0, 0.04, 0]);
    part(g, new THREE.BoxGeometry(0.5, 0.4, 0.5), {color:0xE0DFDC, roughness:0.7, tex:'stone', rx:1, ry:1}, [0, 0.08+0.2, 0]);
    part(g, new THREE.BoxGeometry(0.55, 0.05, 0.55), {color:0xD4D3D0, roughness:0.7, tex:'stone', rx:1, ry:1}, [0, 0.08+0.4+0.025, 0]);
    const topY = 0.08 + 0.4 + 0.05;
    const bodyG = mk(new THREE.SphereGeometry(0.18, 14, 12), stdMat({color:0xC0BFB8, roughness:0.4, metalness:0.3}));
    bodyG.position.set(0, topY+0.18, 0); bodyG.scale.set(1.3, 1.0, 1.8); bodyG.castShadow = true; g.add(bodyG);
    const head = mk(new THREE.SphereGeometry(0.12, 12, 10), stdMat({color:0xC8C7C0, roughness:0.4, metalness:0.3}));
    head.position.set(0, topY+0.3, 0.15); head.castShadow = true; g.add(head);
    const beak = mk(new THREE.ConeGeometry(0.04, 0.1, 6), stdMat({color:0xE8A838, roughness:0.3}));
    beak.position.set(0, topY+0.3, 0.25); beak.rotation.x = Math.PI/2; g.add(beak);
    [-0.06, 0.06].forEach(dx => { const eye = mk(new THREE.SphereGeometry(0.015, 8, 8), stdMat({color:0x2A2A2E, roughness:0.1})); eye.position.set(dx, topY+0.32, 0.2); g.add(eye); });
    [-0.2, 0.2].forEach(dx => { const wing = mk(new THREE.SphereGeometry(0.1, 10, 8), stdMat({color:0xB0AFA8, roughness:0.4, metalness:0.3})); wing.position.set(dx, topY+0.18, -0.02); wing.scale.set(0.5, 1.0, 1.5); wing.castShadow = true; g.add(wing); });
    const tail = mk(new THREE.ConeGeometry(0.08, 0.2, 6), stdMat({color:0xB0AFA8, roughness:0.4}));
    tail.position.set(0, topY+0.15, -0.18); tail.rotation.x = -Math.PI/2; tail.rotation.z = Math.PI; g.add(tail);
    [-0.05, 0.05].forEach(dx => { part(g, new THREE.CylinderGeometry(0.015, 0.015, 0.08, 6), {color:0xE8A838, roughness:0.3}, [dx, topY+0.04, 0.05], false); });
    part(g, new THREE.BoxGeometry(0.3, 0.08, 0.02), {color:0xC4A86D, roughness:0.5, metalness:0.3}, [0, 0.08+0.15, 0.26], false);
    g.position.set(x, y, z); if (rotY) g.rotation.y = rotY; scene.add(g);
  }
  
  // ── Building ground plots ──
  function addDecorations() {
    addDistrictBuildings();
    addMarketStalls(-9, 6, 4, 0);
    addMarketStalls(6, -12, 3, 1);
    addTrees([[-4.2,0,-3.8],[3.6,0,-5.2],[4.2,0,3.4]]);
    addLamps([[-2.2,0,-3.0],[2.4,0,2.8]]);
    addBench(-3.9,0,2.4,0); addObelisk(3.3,0,-3.6); addSignpost(-4.0,0,-5.0);
    addTrees([[-6.2,0,-4.2],[6.5,0,-4.0],[-6.5,0,5.2],[6.0,0,5.8],[-3.0,0,6.5],[5.5,0,-7.0]]);
    addLamps([[-3.2,0,-1.8],[3.5,0,1.5],[-1.8,0,4.5]]);
    addArch(-5.5,0,-6.2,Math.PI/5);
    addSphereStack(5.2,0,5.0); addStoneRing(5.8,0,-5.5); addGazebo(5.8,0,5.9);
    addMonolith(-5.8,0,5.8,0.4); addSteppingStones(-4.5,0,3.5); addHedgeRow(4.5,0,-2.0);
    addPlanter(-2.8,0,-5.3); addPlanter(-2.0,0,-5.8);
    addBollards(2.0,0,-2.8); addBench(5.1,0,-1.8,Math.PI/2);
    addStackedColumn(-5.5,0,2.0); addWallSection(5.5,0,-2.0,0);
    addBushCluster(-4.8,0,-0.5); addPavers();
    // (Original two addPond calls at (-18,18) and (18,-18) removed — positions were wrong.)
    addFlowerbed(-3.0, 0, 4.0); addFlowerbed(3.0, 0, -4.0);
    addLamps([[0+1.9,0,-18.9],[0-1.9,0,18.9],[-18.9,0,0+1.9],[18.9,0,0-1.9]]);
    ROAD_COORDS.forEach(p=>{
      addLamps([[p+1.9,0,-18.9],[p-1.9,0,18.9],[-18.9,0,p+1.9],[18.9,0,p-1.9]]);
    });
    // ── New city-life additions ──
    // One grass patch + one pond at the city edge, each with a straight short path
    // leading out from the inner road grid, with 2 small buildings beside the feature.
    // (Removes the 4 cardinal community-park patches — too symmetric and not city-like.)
    addEdgeGrassAndPond();
    // Inner-city greenery — boulevard trees and one city grass patch
    addInnerCityGreenery();
    // City gate lamp pillars at the cardinal entrances (where new malls/schools sit)
    addLamps([[0,0,-22],[0,0,22],[-22,0,0],[22,0,0],[0,0,-38],[0,0,38],[-38,0,0],[38,0,0]]);
    // ── 外环装饰 ──
    addPigeonSculpture(0, 0, -12, 0);
    addPigeonSculpture(-12, 0, 12, Math.PI/3);
    addPigeonSculpture(-24, 0, 0, 0.5);
    addPigeonSculpture(24, 0, 0, -0.3);
    addTrees([[-15,0,-15],[-21,0,-21],[-27,0,-27],[-12,0,-27],[-27,0,-12],
              [27,0,27],[21,0,21],[12,0,27],[27,0,12],[27,0,-27],[21,0,-21],
              [-27,0,27],[-21,0,27],[-27,0,0],[27,0,0],[0,0,-27],[0,0,27],
              [-30,0,0],[30,0,0],[0,0,-30],[0,0,30],
              [-36,0,-36],[36,0,36],[36,0,-36],[-36,0,36]]);
    addLamps([[-18,0,-18],[-18,0,18],[18,0,-18],[18,0,18],
              [-24,0,-6],[-24,0,6],[24,0,-6],[24,0,6],
              [-6,0,-24],[6,0,-24],[-6,0,24],[6,0,24],
              [-30,0,-6],[-30,0,6],[30,0,-6],[30,0,6],
              [-6,0,-30],[6,0,-30],[-6,0,30],[6,0,30]]);
    addArch(-21,0,-21,Math.PI/6); addArch(21,0,21,-Math.PI/5);
    addGazebo(-21,0,0); addGazebo(21,0,0);
    addBench(-15,0,-15,0); addBench(15,0,15,Math.PI/2);
    addBench(-15,0,15,Math.PI/3); addBench(15,0,-15,Math.PI);
    addSphereStack(-15,0,15); addSphereStack(15,0,-15);
    addStoneRing(-21,0,12); addStoneRing(21,0,-12);
    addMonolith(21,0,21,-0.3); addMonolith(-21,0,-21,0.5);
    addPond(-24, -24, 3.0); addPond(24, 24, 2.5);
    addFlowerbed(-15, 0, 15); addFlowerbed(15, 0, -15);
    for(let v of [-27,-21,-15,15,21,27]) {
      addTrees([[v,0,-3],[v,0,3],[-3,0,v],[3,0,v]]);
    }
  }
  
  // ── Edge grass + edge pond with short straight paths and small buildings ─────
  function addEdgeGrassAndPond() {
    // Edge grass: NE of city, just outside the ring road
    // Grass patch at (15, 30), straight path from (15, 26) going north
    const grassX = 15, grassZ = 30, grassR = 2.5;
    const grassMat = stdMat({color:0xA8C888, roughness:1, tex:'grass', rx:grassR/1.5, ry:grassR/1.5});
    const grass = new THREE.Mesh(new THREE.CircleGeometry(grassR, 32), grassMat);
    grass.rotation.x = -Math.PI/2; grass.position.set(grassX, 0.05, grassZ); grass.receiveShadow = true;
    scene.add(grass);
    // A couple of trees on the grass
    addTrees([[grassX-1.2, 0, grassZ+0.6], [grassX+1.0, 0, grassZ-0.8]]);
    addFlowerbed(grassX, 0, grassZ-1.5);
    // Straight path from ring-road side to grass — going north from (15, 25) to (15, 27.5)
    // (clear of any buildings on either side per user request)
    const pathMat = stdMat({color:0xE8E7E4, roughness:1, tex:'road', rx:1, ry:2});
    pathMats.push(pathMat);
    const path1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 5.5), pathMat);
    path1.position.set(15, 0.04, 27.5); path1.receiveShadow = true; scene.add(path1);
    // One small building beside the feature; the path itself stays open.
    addSuburbHouse(12, 32, 90);
  
    // Edge pond: SW of city, mirror of the grass
    const pondX = -15, pondZ = -30, pondR = 2.5;
    // Pond water
    const pondMat = stdMat({color:P.RIVER, roughness:0.05, metalness:0.25, tex:'river', rx:2, ry:2});
    const pond = new THREE.Mesh(new THREE.CircleGeometry(pondR, 32), pondMat);
    pond.rotation.x = -Math.PI/2; pond.position.set(pondX, 0.05, pondZ); pond.receiveShadow = true;
    scene.add(pond);
    // Stone border
    for (let i = 0; i < 16; i++) {
      const a = (i/16)*Math.PI*2;
      const stone = part(null, new THREE.SphereGeometry(0.2+Math.random()*0.1, 8, 8), {color:0xC4A86D, roughness:0.7, tex:'stone', rx:1, ry:1});
      stone.position.set(pondX+Math.cos(a)*pondR, 0.06, pondZ+Math.sin(a)*pondR);
      scene.add(stone);
    }
    // Reeds
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2;
      const reed = part(null, new THREE.ConeGeometry(0.08, 0.5+Math.random()*0.3, 6), {color:0x6A8A4A, roughness:0.9, tex:'grass', rx:1, ry:1});
      reed.position.set(pondX+Math.cos(a)*pondR*0.85, 0.25, pondZ+Math.sin(a)*pondR*0.85);
      scene.add(reed);
    }
    // Lily pads
    for (let i = 0; i < 4; i++) {
      const a = Math.random()*Math.PI*2, d = Math.random()*pondR*0.6;
      const lily = part(null, new THREE.CircleGeometry(0.15+Math.random()*0.05, 8), {color:0x5A8A3A, roughness:0.9, tex:'grass', rx:1, ry:1});
      lily.rotation.x = -Math.PI/2; lily.position.set(pondX+Math.cos(a)*d, 0.06, pondZ+Math.sin(a)*d);
      scene.add(lily);
    }
    // Straight path from ring-road side to pond — going south from (-15, -25) to (-15, -27.5)
    const path2 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 5.5), pathMat);
    path2.position.set(-15, 0.04, -27.5); path2.receiveShadow = true; scene.add(path2);
    // One small building beside the feature; the path itself stays open.
    addSuburbHouse(-12, -32, -90);
  }
  
  // ── Inner-city greenery: boulevard trees + city grass + city pond ───────────
  function addInnerCityGreenery() {
    // Boulevard trees along main road (x=0 and z=0), on both sides — skip intersections
    const treeSpots = [];
    for (let p = -33; p <= 33; p += 3) {
      if (p === 0) continue;            // skip central plaza
      if (ROAD_COORDS.includes(p)) continue;  // skip intersections (would clash with plaza)
      treeSpots.push([1.8, 0, p], [-1.8, 0, p]);   // both sides of x=0 road
      treeSpots.push([p, 0, 1.8], [p, 0, -1.8]);   // both sides of z=0 road
    }
    addTrees(treeSpots);
  
    // City grass patch — placed in a gap between district blocks (off the road grid)
    // Position (5, 5) is between blocks at (3, 3) and (9, 9) — clear of roads.
    addCityGrassPatch(5, 5, 1.4);
  
    // A few extra tree clusters scattered between buildings
    addTrees([[ 5.5, 0, -5.5], [-5.5, 0,  5.5]]);
  }
  
  function addCityGrassPatch(cx, cz, r) {
    const grassMat = stdMat({color:0xA8C888, roughness:1, tex:'grass', rx:r, ry:r});
    const grass = new THREE.Mesh(new THREE.CircleGeometry(r, 24), grassMat);
    grass.rotation.x = -Math.PI/2; grass.position.set(cx, 0.05, cz); grass.receiveShadow = true;
    scene.add(grass);
    // A small tree at the center
    addTrees([[cx, 0, cz]]);
    // Flowerbeds around
    for (let i = 0; i < 3; i++) {
      const a = (i/3)*Math.PI*2 + 0.7;
      addFlowerbed(cx + Math.cos(a)*r*0.6, 0, cz + Math.sin(a)*r*0.6);
    }
    // Stone border
    const curbMat = stdMat({color:0xC4A86D, roughness:0.8, tex:'stone', rx:1, ry:1});
    for (let i = 0; i < 12; i++) {
      const a = (i/12)*Math.PI*2;
      const stone = part(null, new THREE.SphereGeometry(0.08, 6, 6), curbMat);
      stone.position.set(cx+Math.cos(a)*r, 0.05, cz+Math.sin(a)*r);
      scene.add(stone);
    }
  }
  
  function addDistrictBuildings() {
    const centers=[-33,-27,-21,-15,-9,-3,3,9,15,21,27,33], lots=[];
    centers.forEach(x=>centers.forEach(z=>{
      if(Math.hypot(x,z)<4.8)return;
      const dist=Math.max(Math.abs(x),Math.abs(z));
      const density = dist>24 ? 0.5 : dist>12 ? 0.8 : 1;
      [[0,0],[-1.35,1.15],[1.25,-1.2]].forEach(([dx,dz],k)=>{
        const seeded=Math.abs(Math.round((x+41)*97+(z+43)*193+k*389))%1000/1000;
        if(seeded>density)return;
        const lx=x+dx, lz=z+dz;
        if(Math.abs(lx)>CITY_LIMIT||Math.abs(lz)>CITY_LIMIT)return;
        const blocked=buildings.some(b=>Math.hypot(b.x-lx,b.z-lz)<2.8);
        if(!blocked) lots.push([lx,lz,(Math.abs(Math.round(lx+lz))+k)%3]);
      });
    }));
    lots.forEach(([x,z,t],i)=>addSmallBlock(x,0,z,t,i));
  }
  
  function addSmallBlock(x,y,z,type,i) {
    const g = new THREE.Group();
    const w = type===2 ? 1.2 : 1.6, d = type===1 ? 1.1 : 1.55, h = 0.9 + ((i%5)*0.24);
    // Varied colors for residential feel
    const wallColors = [
      [0xF2F1EE, 'wall'], [0xECEBE8, 'wall'], [0xE8D5A8, 'brick'],
      [0xD8C8A0, 'brick'], [0xF0EFEC, 'stone'], [0xE8E0D5, 'brick'],
      [0xD5D6D8, 'wall'], [0xC5C5C2, 'brick'], [0xD8D6D0, 'stone'],
      [0xF0EDE5, 'wall'], [0xC8CED4, 'wall'], [0xE4E3E0, 'stone']
    ];
    const wc = wallColors[i % wallColors.length];
    const roofColors = [P.ROOF_RIM, 0xDAD9D5, 0xC45A4A, 0x8A5A3A, 0xB0AFAA];
    const rc = roofColors[i % roofColors.length];
    const roofTex = i%3===0 ? 'rooftile' : i%3===1 ? 'metal' : 'pagoda_tile';
    part(g,new THREE.BoxGeometry(w+0.35,0.12,d+0.35),{color:P.BUILDING_BASE,roughness:0.86,tex:'stone',rx:1,ry:1},[0,0.06,0]);
    part(g,new THREE.BoxGeometry(w,h,d),{color:wc[0],roughness:0.32,tex:wc[1],rx:1,ry:1},[0,0.12+h/2,0]);
    part(g,new THREE.BoxGeometry(w+0.12,0.08,d+0.12),{color:rc,roughness:0.6,tex:roofTex,rx:2,ry:2},[0,0.12+h+0.04,0]);
    if(type===0) part(g,new THREE.ConeGeometry(Math.max(w,d)*0.55,0.48,4),{color:rc,roughness:0.5,tex:roofTex,rx:2,ry:1},[0,0.12+h+0.28,0]).rotation.y=Math.PI/4;
    if(type===1) part(g,new THREE.CylinderGeometry(0.32,0.32,0.44,14),{color:0xF7F6F3,roughness:0.22,tex:'metal',rx:1,ry:1},[0,0.12+h+0.3,0]);
    const windows = type===2 ? 4 : 2;
    for(let n=0;n<windows;n++){
      const wx=-w/2+0.35+(n%2)*0.7, wy=0.42+Math.floor(n/2)*0.42;
      part(g,new THREE.BoxGeometry(0.22,0.16,0.03),{color:0xB8CCEA,emissive:0xA8C8F8,emissiveIntensity:getIsNight()?0.12:0.02,roughness:0.2},[wx,wy,d/2+0.02],false);
    }
    const residenceId=`residence:${x.toFixed(2)}:${z.toFixed(2)}`;
    g.position.set(x,y,z); g.rotation.y=(i%4)*Math.PI/2;
    g.traverse((object)=>{ if(object.isMesh) object.userData.residenceId=residenceId; });
    scene.add(g); addRaycastGroup(g);
    residences.push({id:residenceId,label:`${Math.round(x)}, ${Math.round(z)} 号住宅`,group:g,labelEl:null});
    // ── 建筑下面的小地块贴图（成片共享纹理）──
    const plotTexs = ['ground5','ground4','ground2','ground','ground5','ground2','ground4','ground5'];
    const plotTex = plotTexs[Math.abs(Math.round(x+z)) % plotTexs.length];
    const plotColors = [0xE4E3E0, 0xC0D0A0, 0xE0D8CC, 0xF2F1EE, 0xE8E7E4, 0xD8D4CC, 0xB8C888, 0xE4E3E0];
    const plotCol = plotColors[Math.abs(Math.round(x+z)) % plotColors.length];
    const pmat = stdMat({color: getIsNight() ? Math.floor(plotCol*0.7) : plotCol, roughness:0.9, tex:plotTex, rx:1, ry:1});
    pmat.depthWrite = false;
    const plot = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), pmat);
    const plotJitter = (Math.abs(Math.round(x*7 + z*13)) % 8) * 0.0015;
    plot.rotation.x = -Math.PI/2; plot.position.set(x, SURFACE_Y.buildingPlot + plotJitter, z); plot.receiveShadow = true;
    plot.renderOrder = RENDER_ORDER.buildingPlot; scene.add(plot);
  }
  
  function addTrees(positions) {
    if (!treeTrunks) {
      treeTrunks = new InstancedBatch(scene,
        resources.geometry(new THREE.CylinderGeometry(0.06,0.09,0.38,8)),
        resources.material({kind:'tree-trunk'},()=>stdMat({color:0xE0DFDC,roughness:0.9,tex:'wood',rx:1,ry:1})), 512);
      treeCrowns = new InstancedBatch(scene,
        resources.geometry(new THREE.SphereGeometry(0.30,12,12)),
        resources.material({kind:'tree-crown'},()=>stdMat({color:0x6F9F4F,roughness:0.85,tex:'grass',rx:2,ry:2})), 512);
    }
    positions.forEach(([x,,z]) => {
      treeTrunks.add(x,0.19,z);
      treeCrowns.add(x,0.66,z);
    });
  }
  function addLamps(positions) {
    if (!lampPosts) {
      const postMaterial=resources.material({kind:'lamp-post'},()=>stdMat({color:0xCDCCCA,roughness:0.7,tex:'metal',rx:1,ry:1}));
      const globeMaterial=resources.material({kind:'lamp-light'},()=>stdMat({color:0xF8F7F5,roughness:0.15,emissive:0xEEF0FF,emissiveIntensity:getIsNight()?0.6:0.05}));
      lampPosts = new InstancedBatch(scene,resources.geometry(new THREE.CylinderGeometry(0.04,0.04,1.15,8)),postMaterial,384);
      lampLights = new InstancedBatch(scene,resources.geometry(new THREE.SphereGeometry(0.13,14,14)),globeMaterial,384,false);
      lampGlobes.push(globeMaterial);
    }
    positions.forEach(([x,,z]) => {
      lampPosts.add(x,0.575,z);
      lampLights.add(x,1.28,z);
    });
  }
  function addBench(x,y,z,rotY) {
    const g=new THREE.Group();
    part(g,new THREE.BoxGeometry(0.68,0.07,0.26),{color:0xEEEDEA,roughness:0.75,tex:'wood',rx:1,ry:1},[0,0.17,0]);
    part(g,new THREE.BoxGeometry(0.68,0.20,0.05),{color:0xE2E1DE,roughness:0.8,tex:'wood',rx:1,ry:1},[0,0.30,-0.105]);
    g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
  }
  function addObelisk(x,y,z) {
    const g=new THREE.Group();
    part(g,new THREE.BoxGeometry(0.42,0.13,0.42),{color:0xEAE9E6,roughness:0.75,tex:'stone',rx:1,ry:1},[0,0.065,0]);
    part(g,new THREE.BoxGeometry(0.17,1.35,0.17),{color:0xF8F7F5,roughness:0.4,tex:'stone',rx:1,ry:2},[0,0.13+0.675,0]);
    const tip=part(g,new THREE.ConeGeometry(0.13,0.28,4),{color:0xE6E5E2,roughness:0.5,tex:'stone',rx:1,ry:1},[0,0.13+1.35+0.14,0]);
    tip.rotation.y=Math.PI/4; g.position.set(x,y,z); scene.add(g);
  }
  function addSignpost(x,y,z) {
    const g=new THREE.Group();
    part(g,new THREE.CylinderGeometry(0.03,0.03,0.9,8),{color:0xD0CFCC,roughness:0.8,tex:'wood',rx:1,ry:1},[0,0.45,0]);
    part(g,new THREE.BoxGeometry(0.36,0.18,0.04),{color:0xF0EFEC,roughness:0.5,tex:'wood',rx:1,ry:1},[0.18,0.72,0]);
    g.position.set(x,y,z); scene.add(g);
  }
  function addArch(x,y,z,rotY) {
    const g=new THREE.Group(), m={color:0xECEBE8,roughness:0.7,tex:'stone',rx:1,ry:1};
    part(g,new THREE.BoxGeometry(0.4,0.10,1.9),m,[0,0.05,0],false);
    [-0.78,0.78].forEach(pz=>part(g,new THREE.BoxGeometry(0.22,1.55,0.22),m,[0,0.1+0.775,pz]));
    part(g,new THREE.BoxGeometry(0.22,0.24,1.78),m,[0,0.1+1.55+0.12,0]);
    g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
  }
  function addSphereStack(x,y,z) {
    const g=new THREE.Group(), m={color:0xF0EFEC,roughness:0.3,tex:'stone',rx:1,ry:1};
    part(g,new THREE.BoxGeometry(0.52,0.14,0.52),{color:0xE0DFDC,roughness:0.75,tex:'stone',rx:1,ry:1},[0,0.07,0]);
    let cy=0.14; [0.30,0.21,0.14].forEach(r=>{cy+=r;part(g,new THREE.SphereGeometry(r,14,14),m,[0,cy,0]);cy+=r;});
    g.position.set(x,y,z); scene.add(g);
  }
  function addStoneRing(x,y,z) {
    const m={color:0xE4E3E0,roughness:0.85,tex:'stone',rx:1,ry:1};
    for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;const s=part(null,new THREE.CylinderGeometry(0.10,0.13,0.48,8),m);s.position.set(x+Math.cos(a)*0.95,0.24,z+Math.sin(a)*0.95);s.castShadow=true;scene.add(s);}
  }
  function addGazebo(x,y,z) {
    const g=new THREE.Group();
    [[0.85,0.85],[-0.85,0.85],[0.85,-0.85],[-0.85,-0.85]].forEach(([cx,cz])=>part(g,new THREE.CylinderGeometry(0.08,0.08,1.4,10),{color:0xEDECE9,roughness:0.6,tex:'stone',rx:1,ry:1},[cx,0.7,cz]));
    part(g,new THREE.BoxGeometry(2.1,0.1,2.1),{color:0xF0EFEC,roughness:0.5,tex:'rooftile',rx:2,ry:2},[0,1.45,0]);
    const tip=part(g,new THREE.ConeGeometry(0.82,0.65,4),{color:0xE8E7E4,roughness:0.6,tex:'rooftile',rx:2,ry:1},[0,1.5+0.325,0]);
    tip.rotation.y=Math.PI/4; g.position.set(x,y,z); scene.add(g);
  }
  function addMonolith(x,y,z,rotY) {
    const g=new THREE.Group();
    part(g,new THREE.BoxGeometry(0.65,0.12,0.65),{color:0xDFDEDB,roughness:0.8,tex:'stone',rx:1,ry:1},[0,0.06,0]);
    part(g,new THREE.BoxGeometry(0.13,2.1,0.72),{color:0xF4F3F0,roughness:0.25,tex:'stone',rx:1,ry:3},[0,0.12+1.05,0]);
    g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
  }
  function addSteppingStones(x,y,z) {
    [[0,0],[0.72,0.25],[1.42,0.42],[2.1,0.25],[2.78,-0.08]].forEach(([dx,dz])=>{
      const s=part(null,new THREE.CylinderGeometry(0.20,0.23,0.06,10),{color:0xE2E1DE,roughness:0.9,tex:'stone',rx:1,ry:1});
      s.position.set(x+dx,0.03,z+dz); s.receiveShadow=true; scene.add(s);
    });
  }
  function addHedgeRow(x,y,z) {
    const g=new THREE.Group();
    [0,0.62,1.22].forEach((dx,i)=>{
      const r=0.30+i*0.02, h=0.55+i*0.08;
      const b=mk(new THREE.SphereGeometry(r,10,10),stdMat({color:0xECEBE8,roughness:0.9}));
      b.position.set(dx,h*0.55+0.05,0); b.scale.y=h; b.castShadow=true; g.add(b);
    });
    g.position.set(x,y,z); scene.add(g);
  }
  function addPlanter(x,y,z) {
    const g=new THREE.Group();
    part(g,new THREE.CylinderGeometry(0.20,0.15,0.30,12),{color:0xE4E3E0,roughness:0.8,tex:'stone',rx:1,ry:1},[0,0.15,0]);
    part(g,new THREE.SphereGeometry(0.22,10,10),{color:0xEEEDEA,roughness:0.85},[0,0.48,0]);
    g.position.set(x,y,z); scene.add(g);
  }
  function addBollards(x,y,z) {
    [0,0.48,0.96,1.44].forEach(dx=>{
      const b=part(null,new THREE.CylinderGeometry(0.07,0.07,0.48,8),{color:0xD8D7D4,roughness:0.6,tex:'metal',rx:1,ry:1});
      b.position.set(x+dx,0.24,z); b.castShadow=true; scene.add(b);
    });
  }
  function addStackedColumn(x,y,z) {
    const g=new THREE.Group();
    part(g,new THREE.CylinderGeometry(0.38,0.38,0.10,16),{color:0xE0DFDC,roughness:0.75,tex:'stone',rx:2,ry:1},[0,0.05,0]);
    part(g,new THREE.CylinderGeometry(0.22,0.28,0.55,12),{color:0xEEEDEA,roughness:0.4,tex:'stone',rx:1,ry:1},[0,0.10+0.275,0]);
    const mid=part(g,new THREE.CylinderGeometry(0.16,0.20,0.42,10),{color:0xF2F1EE,roughness:0.35,tex:'stone',rx:1,ry:1},[0,0.65+0.21,0]);
    mid.rotation.y=0.4;
    part(g,new THREE.SphereGeometry(0.15,12,12),{color:0xF8F7F5,roughness:0.2},[0,0.65+0.42+0.15,0]);
    g.position.set(x,y,z); scene.add(g);
  }
  function addWallSection(x,y,z,rotY) {
    const g=new THREE.Group();
    part(g,new THREE.BoxGeometry(2.2,0.42,0.22),{color:0xE8E7E4,roughness:0.85,tex:'stone',rx:2,ry:1},[0,0.21,0]);
    part(g,new THREE.BoxGeometry(2.2,0.1,0.28),{color:0xEEEDEB,roughness:0.7,tex:'stone',rx:2,ry:1},[0,0.42+0.05,0]);
    g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
  }
  function addBushCluster(x,y,z) {
    [[0,0,0.28],[0.5,0,0.24],[0.25,0,0.32]].forEach(([dx,,r])=>{
      const b=mk(new THREE.SphereGeometry(r,10,10),stdMat({color:0xEAE9E6,roughness:0.9}));
      b.position.set(x+dx,r*0.7,z); b.castShadow=true; scene.add(b);
    });
  }
  function addPavers() {
    [[-1.9,0,-1.9],[1.9,0,-1.9],[-1.9,0,1.9],[1.9,0,1.9]].forEach(([x,,z])=>{
      const p=mk(new THREE.BoxGeometry(0.6,0.04,0.6),stdMat({color:0xE4E3E0,roughness:0.9,tex:'stone',rx:1,ry:1}));
      p.position.set(x,0.02,z); p.receiveShadow=true; scene.add(p);
    });
  }
  
  function addFlowerbed(x, y, z) {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.28, 0.24, 0.14, 12), {color:0xC4A86D, roughness:0.7, tex:'wood', rx:1, ry:1}, [0, 0.07, 0]);
    const flowerColors = [0xE85858, 0xE8A838, 0xA858E8, 0xF8F4E8];
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2, r = 0.15;
      part(g, new THREE.SphereGeometry(0.06, 8, 8), {color:flowerColors[i%4], roughness:0.8}, [Math.cos(a)*r, 0.14, Math.sin(a)*r], false);
    }
    part(g, new THREE.SphereGeometry(0.08, 8, 8), {color:0xE85858, roughness:0.8}, [0, 0.14, 0], false);
    g.position.set(x, y, z); scene.add(g);
  }
  
  function addPond(cx, cz, r) {
    const waterMat = stdMat({color:0xA8C8F0, roughness:0.05, metalness:0.2, tex:'water', rx:2, ry:2});
    const pond = new THREE.Mesh(new THREE.CircleGeometry(r, 24), waterMat);
    // Keep the water above the lawn/plaza surface (SURFACE_Y.landscape=0.036) so
    // the surrounding ground never z-fights through the pond.
    pond.renderOrder = RENDER_ORDER.water;
    pond.rotation.x = -Math.PI/2; pond.position.set(cx, 0.055, cz); scene.add(pond);
    // Stone border
    for (let i = 0; i < 12; i++) {
      const a = (i/12)*Math.PI*2;
      const stone = part(null, new THREE.SphereGeometry(0.15, 8, 8), {color:0xC4A86D, roughness:0.7, tex:'stone', rx:1, ry:1});
      stone.position.set(cx+Math.cos(a)*r, 0.09, cz+Math.sin(a)*r);
      scene.add(stone);
    }
    // Lily pads
    for (let i = 0; i < 3; i++) {
      const a = Math.random()*Math.PI*2, d = Math.random()*r*0.6;
      const lily = part(null, new THREE.CircleGeometry(0.12+Math.random()*0.05, 8), {color:0x5A8A3A, roughness:0.9, tex:'grass', rx:1, ry:1});
      lily.rotation.x = -Math.PI/2; lily.position.set(cx+Math.cos(a)*d, 0.08, cz+Math.sin(a)*d);
      scene.add(lily);
    }
  }
  
  function addSuburbHouse(x, z, rotDeg) {
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
  
  function addMarketStalls(x, z, count, dir) {
    const colors = [0xE8A838, 0x3B6FE0, 0xE85858, 0x5A8A3A, 0xA858E8];
    for (let i = 0; i < count; i++) {
      const px = dir === 0 ? x + i * 1.5 : x;
      const pz = dir === 1 ? z + i * 1.5 : z;
      const g = new THREE.Group();
      // Posts
      [-0.5, 0.5].forEach(dx =>
        part(g, new THREE.BoxGeometry(0.08, 1.2, 0.08), {color:0xC4A86D, roughness:0.6, tex:'wood', rx:1, ry:1}, [dx, 0.6, 0]));
      // Striped awning
      part(g, new THREE.BoxGeometry(1.2, 0.05, 0.9), {color:colors[i%5], roughness:0.5, tex:'fabric', rx:1, ry:1}, [0, 1.2, 0]);
      // Table
      part(g, new THREE.BoxGeometry(1.0, 0.5, 0.6), {color:0xC4A86D, roughness:0.6, tex:'wood', rx:1, ry:1}, [0, 0.25, 0.3]);
      // Goods
      part(g, new THREE.BoxGeometry(0.3, 0.2, 0.3), {color:0xB8956B, roughness:0.7, tex:'wood', rx:1, ry:1}, [-0.2, 0.6, 0.3], false);
      part(g, new THREE.BoxGeometry(0.25, 0.15, 0.25), {color:colors[(i+1)%5], roughness:0.6}, [0.2, 0.58, 0.3], false);
      part(g, new THREE.SphereGeometry(0.07, 8, 8), {color:0xE85858, roughness:0.8}, [-0.1, 0.68, 0.3], false);
      g.position.set(px, 0, pz); scene.add(g);
    }
  }
  
  // ── Characters ────────────────────────────────────────────────────────────────

  return { addDecorations, addTrees, addLamps, addArch, addBench };
}

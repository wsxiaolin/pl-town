// NPC rendering, schedules, patrols, and player avoidance.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { getNpcType, type NpcProfile } from './data/npcTypes';
import type { MaterialParameters } from '../rendering/meshFactory';

export interface NpcEntity {
  profile: NpcProfile;
  mesh: THREE.Group;
  tween: gsap.core.Tween | null;
  spawnTimer: number;
  idleTimer: number;
  walking?: boolean;
  yielding?: boolean;
}

export type NpcSystemOptions = {
  scene: THREE.Scene;
  profiles: NpcProfile[];
  npcList: NpcEntity[];
  actors: {
    cursorChar: THREE.Object3D | null;
    playerMarker: THREE.Object3D | null;
  };
  raycaster: THREE.Raycaster;
  roadCoords: readonly number[];
  reduced: boolean;
  isMobile: () => boolean;
  getGameClock: () => number;
  getCurrentFilter: () => string;
  nearestRoadCoord: (value: number) => number;
  buildRoadPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  makeMaterial: (params?: MaterialParameters | null) => THREE.MeshStandardMaterial;
  makeMesh: (geo: THREE.BufferGeometry, mat: THREE.Material) => THREE.Mesh;
  view: {
    mapMode: boolean;
    dialogOpen: boolean;
    cameraZoom: number;
  };
  updateCameraProjection: (zoom: number) => void;
  getActiveStoryActorIds: () => Set<string>;
};

export function hoursInRange(h: number, wh: [number, number] | null | undefined): boolean {
  if(!wh) return false;
  const [s,e]=wh;
  if(s===e) return true;
  if(s<e) return h>=s && h<e;
  return h>=s || h<e;
}

export function isNpcHiddenAtHour(profile: NpcProfile, hour: number): boolean {
  return hoursInRange(hour, profile.hiddenHours);
}

export function createNpcSystem(options: NpcSystemOptions) {
  const {
    scene, profiles: NPC_PROFILES, npcList, actors, raycaster, roadCoords: ROAD_COORDS,
    reduced: REDUCED, isMobile: MOBILE, getGameClock, getCurrentFilter,
    nearestRoadCoord, buildRoadPath, makeMaterial: stdMat, makeMesh: mk,
    view, updateCameraProjection,
    getActiveStoryActorIds,
  } = options;

  function makeCharacter(headHex: number, bodyHex: number): THREE.Group {
    const g=new THREE.Group();
    const shadow=mk(new THREE.CircleGeometry(0.17,16),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.11,depthWrite:false}));
    shadow.rotation.x=-Math.PI/2; shadow.position.y=0.012; g.add(shadow);
    const body=mk(new THREE.CylinderGeometry(0.10,0.13,0.30,12),stdMat({color:bodyHex,roughness:0.6}));
    body.position.y=0.15; body.castShadow=true; g.add(body);
    const head=mk(new THREE.SphereGeometry(0.135,14,14),stdMat({color:headHex,roughness:0.5}));
    head.position.y=0.43; head.castShadow=true; g.add(head);
    return g;
  }
  function makePlayerMarker(): THREE.Group {
    const g=new THREE.Group();
    const cone=new THREE.Mesh(
      new THREE.ConeGeometry(0.13,0.26,3),
      new THREE.MeshBasicMaterial({color:0xE8A838,transparent:true,opacity:0.95,depthTest:false})
    );
    cone.rotation.y=Math.PI/2; cone.position.y=0;
    g.add(cone);
    return g;
  }
  
  // 点击 “You are here”/小人：视角不够近就拉近，并高亮头顶三角
  function onYouClick() {
    if(view.mapMode||view.dialogOpen||!actors.cursorChar||!actors.cursorChar.visible)return;
    if(view.cameraZoom>6.5){ // 视角还不够大的时候才放大
      const state={z:view.cameraZoom};
      gsap.killTweensOf(state);
      gsap.to(state,{z:6.5,duration:0.45,ease:'power2.out',onUpdate:()=>{
        view.cameraZoom=state.z; updateCameraProjection(view.cameraZoom);
      }});
    }
    highlightPlayerMarker();
  }
  
  function highlightPlayerMarker() {
    const cone=(actors.playerMarker&&actors.playerMarker.children[0]) as THREE.Mesh|undefined;
    if(!cone)return;
    gsap.killTweensOf(cone.scale); gsap.killTweensOf(cone.material);
    gsap.timeline()
      .to(cone.material,{opacity:1,duration:0.1})
      .to(cone.scale,{x:2.4,y:2.4,z:2.4,duration:0.22,ease:'power2.out'})
      .to(cone.scale,{x:1,y:1,z:1,duration:0.5,ease:'elastic.out(1.1,0.4)'})
      .to(cone.material,{opacity:0.95,duration:0.3});
  }
  function addCharacters() {
    if (REDUCED) return;
    NPC_PROFILES.forEach(profile=>{
      const g=makeCharacter(profile.head,profile.body);
      g.traverse(c=>{ if((c as THREE.Mesh).isMesh) { c.userData.npcId=profile.id; c.userData.npcType=getNpcType(profile); } });
      const start=randomSpawnPosition(profile) ?? new THREE.Vector3(profile.home[0],0,profile.home[1]);
      g.position.copy(start); scene.add(g);
      const npc: NpcEntity={profile, mesh:g, tween:null, spawnTimer:profile.spawnChance===1?0:Math.random()*10, idleTimer:0};
      npcList.push(npc);
      if(profile.behavior==='rare') g.visible=false;
      if(isNpcHiddenAtHour(profile, getGameClock())) g.visible=false;
      if(profile.storyOnly) g.visible=false;
      if (!MOBILE()) npcRoutine(npc);
    });
    actors.cursorChar=makeCharacter(0xA8C8F8,0x3B6FE0);
    // Spawn point offset slightly from center — per user request
    actors.cursorChar.position.set(0, 0, -6);
    actors.cursorChar.visible=false; scene.add(actors.cursorChar);
    actors.playerMarker=makePlayerMarker();
    actors.playerMarker.position.y=0.95; actors.cursorChar.add(actors.playerMarker);
  }

  function randomSpawnPosition(profile: NpcProfile): THREE.Vector3|null {
    if (!profile.spawnArea) return null;
    const [x,z,radius]=profile.spawnArea;
    const angle=Math.random()*Math.PI*2;
    const distance=Math.sqrt(Math.random())*radius;
    return new THREE.Vector3(x+Math.cos(angle)*distance,0,z+Math.sin(angle)*distance);
  }
  
  function npcDesiredTarget(npc: NpcEntity): THREE.Vector3 {
    const dest = hoursInRange(getGameClock(), npc.profile.workHours)
      ? (npc.profile.work || npc.profile.home) : npc.profile.home;
    return new THREE.Vector3(dest[0],0,dest[1]);
  }
  
  function pickPatrolSpot(npc: NpcEntity): THREE.Vector3|null {
    const radius = npc.profile.patrolRadius ?? (hoursInRange(getGameClock(), npc.profile.workHours) ? 3.5 : 2.5);
    const center = npcDesiredTarget(npc);
    const pool: THREE.Vector3[]=[];
    ROAD_COORDS.forEach(x=>ROAD_COORDS.forEach(z=>{
      const p=new THREE.Vector3(x,0,z);
      if(p.distanceTo(center)<=radius && p.distanceTo(center)>0.5) pool.push(p);
    }));
    // Also consider road-line points right beside the destination, so NPCs don't
    // only stand at the intersection grid.
    const rx=nearestRoadCoord(center.x), rz=nearestRoadCoord(center.z);
    [[rx,center.z],[center.x,rz],[rx,rz]].forEach(([x,z])=>{
      const p=new THREE.Vector3(x,0,z);
      if(p.distanceTo(center)<=radius && p.distanceTo(center)>0.5) pool.push(p);
    });
    if(!pool.length) return null;
    return pool[Math.floor(Math.random()*pool.length)] ?? null;
  }
  
  // NPCs step aside when the player walks into them instead of blocking the road.
  function npcYieldToPlayer(npc: NpcEntity) {
    if (!actors.cursorChar || !actors.cursorChar.visible) return;
    const dx=npc.mesh.position.x-actors.cursorChar.position.x;
    const dz=npc.mesh.position.z-actors.cursorChar.position.z;
    const d=Math.hypot(dx,dz);
    if (d < 1.05) {
      if (!npc.yielding) {
        npc.yielding=true;
        if (npc.tween){ npc.tween.kill(); npc.tween=null; }
        const len=d||1;
        const ox=dx/len, oz=dz/len;
        // Step sideways, perpendicular to the line between player and NPC.
        const dest={x:npc.mesh.position.x-oz*0.55, z:npc.mesh.position.z+ox*0.55};
        npc.tween=gsap.to(npc.mesh.position,{x:dest.x,z:dest.z,duration:0.32,ease:'power1.out',
          onComplete:()=>{ npc.tween=null; }});
      }
    } else if (npc.yielding) {
      npc.yielding=false;
      npc.idleTimer=0;
      npcRoutine(npc);
    }
  }
  
  function npcRoutine(npc: NpcEntity) {
    if (npc.walking===false) return;
    if (npc.yielding) return;
    if (!npc.mesh.visible) return;
    const target=npcDesiredTarget(npc);
    const dist=npc.mesh.position.distanceTo(target);
    if (dist>0.8 && !npc.tween) { walkAlongPath(npc, buildRoadPath(npc.mesh.position, target)); return; }
    if (npc.tween) return;
    if (npc.idleTimer>0) { npc.idleTimer-=1; return; }
    const spot=pickPatrolSpot(npc);
    if (spot && spot.distanceTo(npc.mesh.position)>0.3) {
      walkAlongPath(npc, buildRoadPath(npc.mesh.position, spot));
    } else {
      npc.idleTimer=3+Math.random()*6;
    }
  }
  
  const MAX_RARE_VISIBLE_NPCS = 8;
  
  function updateNpcSchedules() {
    let visibleRare=npcList.filter(n=>n.mesh.visible && (n.profile.behavior==='rare')).length;
    npcList.forEach(npc=>{
      if (getCurrentFilter()==='friends') {
        if(npc.mesh.visible){ npc.mesh.visible=false; if(npc.tween){ npc.tween.kill(); npc.tween=null; } }
        return;
      }
      const behavior=npc.profile.behavior||'field';
      if (isNpcHiddenAtHour(npc.profile, getGameClock())) {
        npc.mesh.visible=false;
        if(npc.tween){ npc.tween.kill(); npc.tween=null; }
        return;
      }
      if (npc.profile.storyOnly && !getActiveStoryActorIds().has(npc.profile.id)) {
        npc.mesh.visible=false;
        if(npc.tween){ npc.tween.kill(); npc.tween=null; }
        return;
      }
      if (behavior==='rare') {
        if (!hoursInRange(getGameClock(), npc.profile.workHours)) {
          npc.mesh.visible=false;
          npc.spawnTimer=0;
          if(npc.tween){ npc.tween.kill(); npc.tween=null; }
          return;
        }
        npc.spawnTimer-=1;
        if(npc.spawnTimer<=0){
          npc.spawnTimer=14+Math.random()*18;
          const appear=Math.random()<npc.profile.spawnChance;
          const wasVisible=npc.mesh.visible;
          npc.mesh.visible=appear;
          if(appear && visibleRare>=MAX_RARE_VISIBLE_NPCS && !npc.profile.guaranteedSpawn){
            npc.mesh.visible=false;
            npc.spawnTimer=6+Math.random()*8;
          } else if(appear){
            visibleRare+=1;
            if(!wasVisible){
              const spawn=randomSpawnPosition(npc.profile);
              if(spawn) npc.mesh.position.copy(spawn);
            }
          } else if(!appear && npc.tween){ npc.tween.kill(); npc.tween=null; }
        }
      } else {
        npc.mesh.visible=true;
      }
      if (npc.walking===false) return;
      if (!npc.mesh.visible) return;
      npcRoutine(npc);
    });
  }
  
  function walkAlongPath(npc: NpcEntity, path: THREE.Vector3[]) {
    if (npc.walking===false) return;
    if (!path.length) {
      npc.tween=null;
      return;
    }
    const target=path.shift();
    if (!target) return;
    const from=npc.mesh.position.clone();
    const dur=Math.max(0.6,from.distanceTo(target)/1.4);
    gsap.to(npc.mesh.rotation,{y:Math.atan2(target.x-from.x,target.z-from.z),duration:0.3,ease:'power1.out'});
    npc.tween=gsap.to(npc.mesh.position,{x:target.x,z:target.z,duration:dur,ease:'power1.inOut',
      onComplete:()=>{ npc.tween=null; walkAlongPath(npc,path); }});
  }
  
  function pauseNpcs() {
    npcList.forEach(npc=>{
      npc.walking=false;
      if(npc.tween){ npc.tween.kill(); npc.tween=null; }
    });
  }
  
  function resumeNpcs() {
    npcList.forEach(npc=>{
      npc.walking=true;
      if (!MOBILE()) npcRoutine(npc);
    });
  }
  
  function nearestNpcTo(p: THREE.Vector3, radius: number): NpcEntity|null {
    let best: NpcEntity|null=null, bestD=radius;
    npcList.forEach(npc=>{
      if(!npc.mesh.visible)return;
      const d=npc.mesh.position.distanceTo(p);
      if(d<bestD){ bestD=d; best=npc; }
    });
    return best;
  }
  
  function npcForRaycast(): NpcEntity|null {
    const visible=npcList.filter(n=>n.mesh.visible);
    const hits=raycaster.intersectObjects(visible.map(n=>n.mesh),true);
    if(!hits.length)return null;
    const first=hits[0];
    if (!first) return null;
    const id=first.object.userData.npcId as string|undefined;
    if (!id) return null;
    return npcList.find(n=>n.profile.id===id)||null;
  }
  
  // ── Labels ────────────────────────────────────────────────────────────────────

  return {
    makeCharacter, addCharacters, onYouClick, updateNpcSchedules, npcYieldToPlayer, pauseNpcs,
    resumeNpcs, nearestNpcTo, npcForRaycast,
  };
}
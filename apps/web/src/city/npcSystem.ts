// NPC rendering, schedules, patrols, and player avoidance.
import * as THREE from 'three';
import { gsap } from 'gsap';
import { getNpcType } from './data/npcTypes';
import type { NpcType } from './data/npcTypes';
import type { LegacyDialogueNode } from '../adapters/ui/cityDialogController';

export type NpcProfile = {
  id: string;
  name: string;
  role?: string;
  core?: boolean;
  spawnChance: number;
  behavior?: string;
  workHours: number[] | null;
  hiddenHours?: number[] | null;
  head: number;
  body: number;
  home: number[];
  work?: number[] | null;
  patrolRadius: number;
  spawnArea?: number[];
  storyOnly?: boolean;
  guaranteedSpawn?: boolean;
  npcType?: NpcType;
  type?: NpcType;
  dialog: readonly LegacyDialogueNode[];
};

type NpcTween = gsap.core.Tween;

export type Npc = {
  profile: NpcProfile;
  mesh: THREE.Group;
  tween: NpcTween | null;
  spawnTimer: number;
  idleTimer: number;
  homeTarget: THREE.Vector3;
  workTarget: THREE.Vector3;
  homePatrol: THREE.Vector3[];
  workPatrol: THREE.Vector3[];
  walking?: boolean;
  yielding?: boolean;
};

type Actors = {
  cursorChar: THREE.Group | null;
  playerMarker: THREE.Group | null;
};

type View = {
  mapMode: boolean;
  dialogOpen: boolean;
  cameraZoom: number;
};

type NpcSystemOptions = {
  scene: THREE.Scene;
  profiles: NpcProfile[];
  npcList: Npc[];
  actors: Actors;
  raycaster: THREE.Raycaster;
  roadCoords: readonly number[];
  reduced: boolean;
  isMobile: () => boolean;
  getGameClock: () => number;
  getCurrentFilter: () => string;
  nearestRoadCoord: (value: number) => number;
  buildRoadPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
  makeMaterial: (params: Record<string, unknown>) => THREE.MeshStandardMaterial;
  makeMesh: (geometry: THREE.BufferGeometry, material: THREE.Material) => THREE.Mesh;
  makeCharacterMaterial?: (partName: string, color: number, factory: () => THREE.MeshStandardMaterial) => THREE.Material;
  view: View;
  updateCameraProjection: (zoom: number) => void;
  getActiveStoryActorIds: () => Set<string>;
};

export function hoursInRange(h: number, wh: number[] | null): boolean {
  if(!wh) return false;
  const s=wh[0], e=wh[1];
  if(s===undefined || e===undefined) return false;
  if(s===e) return true;
  if(s<e) return h>=s && h<e;
  return h>=s || h<e;
}

export function isNpcHiddenAtHour(profile: NpcProfile, hour: number): boolean {
  return hoursInRange(hour, profile.hiddenHours ?? null);
}

export function createNpcSystem(options: NpcSystemOptions) {
  const {
    scene, profiles: NPC_PROFILES, npcList, actors, raycaster, roadCoords: ROAD_COORDS,
    reduced: REDUCED, isMobile: MOBILE, getGameClock, getCurrentFilter,
    nearestRoadCoord, buildRoadPath, makeMaterial: stdMat, makeMesh: mk, makeCharacterMaterial,
    view, updateCameraProjection,
    getActiveStoryActorIds,
  } = options;
  const avoidanceNpcs: Npc[]=[];
  const visibleNpcMeshes: THREE.Object3D[]=[];
  const npcById=new Map<string, Npc>();
  const shadowMaterial=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.11,depthWrite:false});

  function refreshNpcIndexes() {
    avoidanceNpcs.length=0;
    visibleNpcMeshes.length=0;
    for(const npc of npcList){
      if(!npc.mesh.visible) continue;
      visibleNpcMeshes.push(npc.mesh);
      if(npc.walking!==false) avoidanceNpcs.push(npc);
    }
  }

  function makeCharacter(headHex: number, bodyHex: number) {
    const g=new THREE.Group();
    const shadow=mk(new THREE.CircleGeometry(0.17,16),shadowMaterial);
    shadow.rotation.x=-Math.PI/2; shadow.position.y=0.012; g.add(shadow);
    const bodyMaterial=makeCharacterMaterial?.('body',bodyHex,()=>stdMat({color:bodyHex,roughness:0.6}))
      ?? stdMat({color:bodyHex,roughness:0.6});
    const body=mk(new THREE.CylinderGeometry(0.10,0.13,0.30,12),bodyMaterial);
    body.position.y=0.15; body.castShadow=true; g.add(body);
    const headMaterial=makeCharacterMaterial?.('head',headHex,()=>stdMat({color:headHex,roughness:0.5}))
      ?? stdMat({color:headHex,roughness:0.5});
    const head=mk(new THREE.SphereGeometry(0.135,14,14),headMaterial);
    head.position.y=0.43; head.castShadow=true; g.add(head);
    return g;
  }
  function makePlayerMarker() {
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
    const cone=actors.playerMarker&&actors.playerMarker.children[0] as THREE.Mesh | undefined;
    if(!cone||!cone.material)return;
    gsap.killTweensOf(cone.scale); gsap.killTweensOf(cone.material);
    gsap.timeline()
      .to(cone.material as THREE.MeshBasicMaterial,{opacity:1,duration:0.1})
      .to(cone.scale,{x:2.4,y:2.4,z:2.4,duration:0.22,ease:'power2.out'})
      .to(cone.scale,{x:1,y:1,z:1,duration:0.5,ease:'elastic.out(1.1,0.4)'})
      .to(cone.material as THREE.MeshBasicMaterial,{opacity:0.95,duration:0.3});
  }
  function addCharacters() {
    if (REDUCED) return;
    NPC_PROFILES.forEach((profile: NpcProfile)=>{
      const g=makeCharacter(profile.head,profile.body);
      g.traverse((c: THREE.Object3D)=>{ if('isMesh' in c && c.isMesh) { c.userData.npcId=profile.id; c.userData.npcType=getNpcType(profile); } });
      const start=randomSpawnPosition(profile) ?? new THREE.Vector3(profile.home[0],0,profile.home[1]);
      g.position.copy(start); scene.add(g);
      const homeTarget=new THREE.Vector3(profile.home[0],0,profile.home[1]);
      const workPosition=profile.work||profile.home;
      const workTarget=new THREE.Vector3(workPosition[0],0,workPosition[1]);
      const npc={
        profile, mesh:g, tween:null, spawnTimer:profile.spawnChance===1?0:Math.random()*10, idleTimer:0,
        homeTarget, workTarget,
        homePatrol:createPatrolPool(homeTarget,profile.patrolRadius??2.5),
        workPatrol:createPatrolPool(workTarget,profile.patrolRadius??3.5),
      };
      npcList.push(npc);
      npcById.set(profile.id,npc);
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
    refreshNpcIndexes();
  }

  function randomSpawnPosition(profile: NpcProfile): THREE.Vector3 | null {
    if (!profile.spawnArea) return null;
    const [x,z,radius]=profile.spawnArea ?? [];
    if (x === undefined || z === undefined || radius === undefined) return null;
    const angle=Math.random()*Math.PI*2;
    const distance=Math.sqrt(Math.random())*radius;
    return new THREE.Vector3(x+Math.cos(angle)*distance,0,z+Math.sin(angle)*distance);
  }
  
  function npcIsWorking(npc: Npc, gameHour: number): boolean {
    return hoursInRange(gameHour,npc.profile.workHours);
  }

  function npcDesiredTarget(npc: Npc, gameHour: number): THREE.Vector3 {
    return npcIsWorking(npc,gameHour)?npc.workTarget:npc.homeTarget;
  }

  function createPatrolPool(center: THREE.Vector3, radius: number): THREE.Vector3[] {
    const pool: THREE.Vector3[]=[];
    const radiusSquared=radius*radius;
    for(const x of ROAD_COORDS) for(const z of ROAD_COORDS){
      const dx=x-center.x,dz=z-center.z,distanceSquared=dx*dx+dz*dz;
      if(distanceSquared<=radiusSquared&&distanceSquared>0.25) pool.push(new THREE.Vector3(x,0,z));
    }
    // Also consider road-line points right beside the destination, so NPCs don't
    // only stand at the intersection grid.
    const rx=nearestRoadCoord(center.x), rz=nearestRoadCoord(center.z);
    for(const [x,z] of [[rx,center.z],[center.x,rz],[rx,rz]] as [number, number][]){
      const dx=x-center.x,dz=z-center.z,distanceSquared=dx*dx+dz*dz;
      if(distanceSquared<=radiusSquared&&distanceSquared>0.25) pool.push(new THREE.Vector3(x,0,z));
    }
    return pool;
  }

  function pickPatrolSpot(npc: Npc, gameHour: number): THREE.Vector3 | null {
    const pool=npcIsWorking(npc,gameHour)?npc.workPatrol:npc.homePatrol;
    if(!pool.length) return null;
    return pool[Math.floor(Math.random()*pool.length)] ?? null;
  }
  
  // NPCs step aside when the player walks into them instead of blocking the road.
  function npcYieldToPlayer(npc: Npc) {
    if (!actors.cursorChar || !actors.cursorChar.visible) return;
    const dx=npc.mesh.position.x-actors.cursorChar.position.x;
    const dz=npc.mesh.position.z-actors.cursorChar.position.z;
    const distanceSquared=dx*dx+dz*dz;
    if (distanceSquared < 1.05*1.05) {
      if (!npc.yielding) {
        npc.yielding=true;
        if (npc.tween){ npc.tween.kill(); npc.tween=null; }
        const len=Math.sqrt(distanceSquared)||1;
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
  
  function npcRoutine(npc: Npc, gameHour: number = getGameClock()) {
    if (npc.walking===false) return;
    if (npc.yielding) return;
    if (!npc.mesh.visible) return;
    const target=npcDesiredTarget(npc,gameHour);
    if (npc.mesh.position.distanceToSquared(target)>0.8*0.8 && !npc.tween) { walkAlongPath(npc, buildRoadPath(npc.mesh.position, target)); return; }
    if (npc.tween) return;
    if (npc.idleTimer>0) { npc.idleTimer-=1; return; }
    const spot=pickPatrolSpot(npc,gameHour);
    if (spot && spot.distanceToSquared(npc.mesh.position)>0.3*0.3) {
      walkAlongPath(npc, buildRoadPath(npc.mesh.position, spot));
    } else {
      npc.idleTimer=3+Math.random()*6;
    }
  }
  
  const MAX_RARE_VISIBLE_NPCS = 8;
  
  function updateNpcSchedules() {
    const gameHour=getGameClock();
    const currentFilter=getCurrentFilter();
    const activeStoryActorIds=getActiveStoryActorIds();
    let visibleRare=0;
    for(const npc of npcList){
      if(npc.mesh.visible&&npc.profile.behavior==='rare') visibleRare+=1;
    }
    for(const npc of npcList){
      if (currentFilter==='friends') {
        if(npc.mesh.visible){ npc.mesh.visible=false; if(npc.tween){ npc.tween.kill(); npc.tween=null; } }
        continue;
      }
      const behavior=npc.profile.behavior||'field';
      if (isNpcHiddenAtHour(npc.profile, gameHour)) {
        npc.mesh.visible=false;
        if(npc.tween){ npc.tween.kill(); npc.tween=null; }
        continue;
      }
      if (npc.profile.storyOnly && !activeStoryActorIds.has(npc.profile.id)) {
        npc.mesh.visible=false;
        if(npc.tween){ npc.tween.kill(); npc.tween=null; }
        continue;
      }
      if (behavior==='rare') {
        if (!hoursInRange(gameHour, npc.profile.workHours)) {
          npc.mesh.visible=false;
          npc.spawnTimer=0;
          if(npc.tween){ npc.tween.kill(); npc.tween=null; }
          continue;
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
      if (npc.walking===false) continue;
      if (!npc.mesh.visible) continue;
      npcRoutine(npc,gameHour);
    }
    refreshNpcIndexes();
  }
  
  function walkAlongPath(npc: Npc, path: THREE.Vector3[]) {
    if (npc.walking===false) return;
    if (!path.length) {
      npc.tween=null;
      return;
    }
    const target=path.shift();
    if(!target){ npc.tween=null; return; }
    const fromX=npc.mesh.position.x,fromZ=npc.mesh.position.z;
    const dx=target.x-fromX,dz=target.z-fromZ;
    const dur=Math.max(0.6,Math.sqrt(dx*dx+dz*dz)/1.4);
    gsap.to(npc.mesh.rotation,{y:Math.atan2(dx,dz),duration:0.3,ease:'power1.out'});
    npc.tween=gsap.to(npc.mesh.position,{x:target.x,z:target.z,duration:dur,ease:'power1.inOut',
      onComplete:()=>{ npc.tween=null; walkAlongPath(npc,path); }});
  }
  
  function pauseNpcs() {
    for(const npc of npcList){
      npc.walking=false;
      if(npc.tween){ npc.tween.kill(); npc.tween=null; }
    }
    refreshNpcIndexes();
  }
  
  function resumeNpcs() {
    const gameHour=getGameClock();
    for(const npc of npcList){
      npc.walking=true;
      if (!MOBILE()) npcRoutine(npc,gameHour);
    }
    refreshNpcIndexes();
  }
  
  function nearestNpcTo(p: THREE.Vector3, radius: number): Npc | null {
    let best: Npc | null=null, bestDistanceSquared=radius*radius;
    for(const npc of npcList){
      if(!npc.mesh.visible) continue;
      const distanceSquared=npc.mesh.position.distanceToSquared(p);
      if(distanceSquared<bestDistanceSquared){ bestDistanceSquared=distanceSquared; best=npc; }
    }
    return best;
  }
  
  function npcForRaycast(): Npc | null {
    const hits=raycaster.intersectObjects(visibleNpcMeshes,true);
    if(!hits.length)return null;
    const hit=hits[0];
    if(!hit)return null;
    const id=hit.object.userData.npcId;
    return npcById.get(id)||null;
  }

  function destroy() { shadowMaterial.dispose(); }
  
  // ── Labels ────────────────────────────────────────────────────────────────────

  return {
    makeCharacter, addCharacters, onYouClick, updateNpcSchedules, npcYieldToPlayer, pauseNpcs,
    resumeNpcs, nearestNpcTo, npcForRaycast, getAvoidanceNpcs: () => avoidanceNpcs, destroy,
  };
}

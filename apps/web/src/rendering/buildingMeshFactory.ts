// Building meshes are intentionally kept together as a visual catalog.
// This module has no scene, DOM, storage, or gameplay responsibilities.
import * as THREE from 'three';
import { buildWushiRestaurant } from './wushiRestaurant';
import { buildWildMushroomRestaurant } from './wildMushroomRestaurant';
import { RENDER_ORDER } from './layers';
import type { MaterialParameters, MeshHelpers } from './meshFactory';
import type { BuildingDefinition, BuildingEntity } from '../city/buildingEntity';

type Palette = Record<string, number>;

export interface BuildingMeshFactoryOptions {
  palette: Palette;
  platformHeight: number;
  makeMaterial: MeshHelpers['stdMat'];
  makeMesh: MeshHelpers['mk'];
  addPart: MeshHelpers['part'];
}

type ShapeBuilder = (cfg: BuildingDefinition) => BuildingEntity;

export function createBuildingMeshFactory(options: BuildingMeshFactoryOptions) {
  const {
    palette: P,
    platformHeight: PLH,
    makeMaterial: stdMat,
    makeMesh: mk,
    addPart: part,
  } = options;

  function tagMeshes(g: THREE.Object3D, id: string) {
    g.traverse((c: THREE.Object3D) => { if ('isMesh' in c && c.isMesh) c.userData.buildingId = id; });
  }

  function buildFilmCity(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const width = 5.8, depth = 4.2, height = 2.2;
    part(g, new THREE.BoxGeometry(width + 0.8, PLH, depth + 0.8), { color: P.BUILDING_BASE, roughness: 0.8, tex: 'stone', rx: 2, ry: 2 }, [0, PLH / 2, 0]);
    const bodyMat = mkBodyMat('wall', 2, 1);
    const body = mk(new THREE.BoxGeometry(width, height, depth), bodyMat);
    body.position.y = PLH + height / 2 + 0.012;
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const top = PLH + height;
    part(g, new THREE.BoxGeometry(width + 0.3, 0.16, depth + 0.3), { color: P.ROOF_RIM, roughness: 0.4, tex: 'rooftile', rx: 2, ry: 2 }, [0, top + 0.08, 0]);
    part(g, new THREE.BoxGeometry(0.18, 2.5, 0.18), { color: P.MALL_FRAME, roughness: 0.35, metalness: 0.25 }, [-2.1, top + 1.25, 0]);
    part(g, new THREE.BoxGeometry(0.18, 2.5, 0.18), { color: P.MALL_FRAME, roughness: 0.35, metalness: 0.25 }, [2.1, top + 1.25, 0]);
    part(g, new THREE.BoxGeometry(4.5, 1.1, 0.16), { color: P.MALL_SIGN, emissive: P.MALL_SIGN, emissiveIntensity: 0.12, roughness: 0.35 }, [0, top + 1.45, depth / 2 + 0.1], false);
    part(g, new THREE.BoxGeometry(1.5, 0.12, 0.12), { color: P.BLUE, emissive: P.BLUE, emissiveIntensity: 0.28 }, [0, PLH + 0.06, depth / 2 + 1.1], false);
    for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) part(g, new THREE.BoxGeometry(0.75, 0.05, 0.75), { color: x % 2 ? P.PARCHMENT : P.BLUE, roughness: 0.5 }, [x, PLH + 0.04, depth / 2 + 0.75], false);
    part(g, new THREE.BoxGeometry(3.2, 0.05, 4.8), { color: 0x8f2f35, roughness: 0.65 }, [0, PLH + 0.035, -4.6], false);
    [-1.7, 1.7].forEach((x) => part(g, new THREE.CylinderGeometry(0.09, 0.11, 1.8, 10), { color: P.MALL_FRAME, roughness: 0.4, metalness: 0.25 }, [x, PLH + 0.9, -5.8]));
    part(g, new THREE.BoxGeometry(3.8, 0.28, 0.3), { color: P.MALL_SIGN, emissive: P.MALL_SIGN, emissiveIntensity: 0.16 }, [0, PLH + 1.8, -5.8], false);
    g.position.set(cfg.x, 0, cfg.z);
    tagMeshes(g, cfg.id);
    return { ...cfg, group: g, body, bodyMat, labelEl: null, labelY: top + 2.2 };
  }
  function mkBodyMat(texKey: string, rx: number, ry: number): THREE.MeshStandardMaterial {
    const m = stdMat({color:P.BUILDING_WHITE,roughness:0.08, tex:texKey, rx:rx, ry:ry});
    m.emissive = new THREE.Color(P.BLUE); m.emissiveIntensity = 0;
    return m;
  }
  
  // 01 ACTIVITY — treasury / bank with columns and gold dome
  function buildBank(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=2.2, bh=1.8;
    part(g, new THREE.BoxGeometry(2.8,PLH,2.4), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,PLH/2,0]);
    const bodyMat = mkBodyMat('stone', 1, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    // Leave a tiny physical separation from the dark foundation edge.
    body.position.y = PLH+bh/2+0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = PLH+bh;
    // Pediment
    part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.ROOF_RIM,roughness:0.5,tex:'rooftile',rx:2,ry:2}, [0,top+0.05,0]);
    // Columns at front
    [-0.7,-0.23,0.23,0.7].forEach(cx =>
      part(g, new THREE.CylinderGeometry(0.07,0.08,bh*0.85,10), {color:0xF8F7F5,roughness:0.3}, [cx,PLH+bh*0.425,bw/2+0.12]));
    // Gold dome
    part(g, new THREE.SphereGeometry(0.42,16,8,0,Math.PI*2,0,Math.PI/2), {color:0xF0EFEC,roughness:0.12,tex:'metal',rx:2,ry:1}, [0,top+0.1,0]);
    part(g, new THREE.SphereGeometry(0.07,10,10), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.35}, [0,top+0.1+0.42+0.07,0], false);
    // Keep the entry marker clear of the platform top (0.3), whose coplanar
    // depth value otherwise flickers during camera movement.
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.1+0.42+0.5};
  }
  
  // 02 BULLETIN — board with two posts and small roof
  function buildBoard(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    part(g, new THREE.BoxGeometry(2.0,0.15,0.7), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,0.075,0]);
    const boardMat = stdMat({color:P.PARCHMENT,roughness:0.85,tex:'wood',rx:1,ry:1});
    boardMat.emissive = new THREE.Color(P.BLUE); boardMat.emissiveIntensity = 0;
    [-0.6,0.6].forEach(cx =>
      part(g, new THREE.BoxGeometry(0.1,1.6,0.1), {color:0xC4A86D,roughness:0.7,tex:'wood',rx:1,ry:2}, [cx,0.15+0.8,0]));
    const board = mk(new THREE.BoxGeometry(1.5,1.0,0.08), boardMat);
    board.position.y = 0.15+1.1; board.castShadow = true; g.add(board);
    // Roof slats
    part(g, new THREE.BoxGeometry(1.75,0.06,0.55), {color:0xB8956B,roughness:0.6,tex:'wood',rx:2,ry:1}, [0,0.15+1.64,0]);
    part(g, new THREE.BoxGeometry(1.75,0.04,0.1), {color:0xA8855B,roughness:0.6}, [0,0.15+1.67,0.22]);
    // Posted papers
    part(g, new THREE.BoxGeometry(0.4,0.3,0.02), {color:0xF8F4E8,roughness:0.9}, [-0.3,0.15+1.15,0.05]);
    part(g, new THREE.BoxGeometry(0.35,0.25,0.02), {color:0xF5F0E0,roughness:0.9}, [0.25,0.15+1.05,0.05]);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.15+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body:board, bodyMat:boardMat, labelEl:null, labelY:0.15+1.64+0.5};
  }
  
  // 03 TECHHALF — tall elegant tower (reuse existing tower design)
  function buildTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=1.85, bh=4.6;
    part(g, new THREE.BoxGeometry(2.55,PLH,2.55), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,PLH/2,0]);
    const bodyMat = mkBodyMat('wall', 1, 3);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    // Separate the dark wall from its foundation edge to prevent a flickering seam.
    body.position.y = PLH+bh/2+0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = PLH+bh;
    part(g, new THREE.BoxGeometry(bw+0.2,0.12,bw+0.2), {color:P.ROOF_RIM,roughness:0.4,tex:'rooftile',rx:2,ry:2}, [0,top+0.06,0]);
    part(g, new THREE.BoxGeometry(1.1,0.72,1.1), {color:0xF9F8F6,roughness:0.06,tex:'glass',rx:1,ry:1}, [0,top+0.12+0.36,0]);
    // Roof slab raised so its bottom clears the glass box top (top+0.12+0.72) —
    // coplanar faces there caused the lighthouse-edge flicker.
    part(g, new THREE.BoxGeometry(1.22,0.08,1.22), {color:P.ROOF_RIM,roughness:0.4,tex:'metal',rx:1,ry:1}, [0,top+0.12+0.72+0.12,0]);
    part(g, new THREE.CylinderGeometry(0.022,0.022,0.7,8), {color:0xD0CFCC,roughness:0.5,tex:'metal',rx:1,ry:1}, [0,top+0.12+0.72+0.16+0.35,0]);
    const tipY = top+0.12+0.72+0.16+0.35+0.35+0.07;
    part(g, new THREE.SphereGeometry(0.07,12,12), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.4}, [0,tipY,0], false);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:tipY+0.5};
  }
  
  // 04 BLACKHOLE — dark tower with swirling aura
  function buildDarkTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=1.7, bh=4.0;
    part(g, new THREE.BoxGeometry(2.4,PLH,2.4), {color:0x3A3A3E,roughness:0.8,tex:'darkwall',rx:1,ry:1}, [0,PLH/2,0]);
    const bodyMat = stdMat({color:P.DARK_TOWER,roughness:0.15,metalness:0.3,tex:'darkwall',rx:1,ry:3});
    bodyMat.emissive = new THREE.Color(0x1a1a2e); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    // Separate the dark wall from its foundation edge to prevent a flickering seam.
    body.position.y = PLH+bh/2+0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = PLH+bh;
    // Dark cone roof
    part(g, new THREE.ConeGeometry(1.0,1.4,6), {color:0x2A2A30,roughness:0.2,tex:'darkwall',rx:2,ry:1}, [0,top+0.7,0]);
    // Purple aura ring
    part(g, new THREE.TorusGeometry(0.9,0.04,8,24), {color:0x6B4FE8,emissive:0x6B4FE8,emissiveIntensity:0.3}, [0,PLH+bh*0.35,0], false).rotation.x = Math.PI/2;
    // Dark orb on top
    part(g, new THREE.SphereGeometry(0.15,12,12), {color:0x1a1a2e,emissive:0x4B3FE8,emissiveIntensity:0.15}, [0,top+1.4+0.15,0], false);
    // Blue entrance disc. Keep it clear of the platform's top face.
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+1.4+0.5};
  }
  
  // 05 LAWS — pavilion with cone roof (reuse existing pavilion)
  function buildPavilion(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=2.4, bh=2.3;
    part(g, new THREE.BoxGeometry(3.1,0.25,3.1), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:2}, [0,0.125,0]);
    const bodyMat = mkBodyMat('stone', 1, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.25+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const bodyTop = 0.25+bh;
    part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.ROOF_RIM,roughness:0.5,tex:'rooftile',rx:2,ry:2}, [0,bodyTop+0.05,0]);
    const coneH=1.05;
    part(g, new THREE.CylinderGeometry(0.08,1.38,coneH,24), {color:0xF0EFEC,roughness:0.35,tex:'rooftile',rx:3,ry:1}, [0,bodyTop+0.1+coneH/2,0]);
    part(g, new THREE.SphereGeometry(0.1,12,12), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.3}, [0,bodyTop+0.1+coneH+0.1,0], false);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:bodyTop+0.1+coneH+0.6};
  }
  
  // 06 LIBRARY — wide classical building with pediment and columns
  function buildLibrary(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=3.0, bh=2.0;
    part(g, new THREE.BoxGeometry(3.6,0.25,2.8), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:2}, [0,0.125,0]);
    const bodyMat = mkBodyMat('brick', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.25+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.25+bh;
    // Cornice
    part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.ROOF_RIM,roughness:0.4,tex:'rooftile',rx:3,ry:3}, [0,top+0.05,0]);
    // Triangular pediment
    part(g, new THREE.CylinderGeometry(0.01,1.5,0.5,3), {color:0xF5F4F1,roughness:0.2}, [0,top+0.1+0.25,0]).rotation.z = 0;
    const ped = mk(new THREE.ConeGeometry(1.55, 0.55, 3), stdMat({color:0xF5F4F1,roughness:0.2,tex:'stone',rx:2,ry:1}));
    ped.rotation.y = Math.PI/6; ped.position.y = top+0.1+0.275; g.add(ped);
    // Columns at front (4)
    [-0.9,-0.3,0.3,0.9].forEach(cx =>
      part(g, new THREE.CylinderGeometry(0.08,0.09,bh*0.9,10), {color:0xF8F7F5,roughness:0.3,tex:'stone',rx:1,ry:2}, [cx,0.25+bh*0.45,bw/2+0.15]));
    // Book silo (round reading room on roof)
    part(g, new THREE.CylinderGeometry(0.5,0.5,0.7,16), {color:0xF0EFEC,roughness:0.15,tex:'stone',rx:2,ry:1}, [0,top+0.1+0.35,0]);
    part(g, new THREE.SphereGeometry(0.5,16,8,0,Math.PI*2,0,Math.PI/2), {color:0xEEEDEA,roughness:0.1,tex:'rooftile',rx:2,ry:1}, [0,top+0.1+0.7,0]);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.1+0.7+0.5+0.4};
  }
  
  // 07 LITREVIEW — abandoned ruins with broken top
  function buildRuins(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=2.2, bh=1.6;
    part(g, new THREE.BoxGeometry(2.7,0.22,2.3), {color:0x9A988E,roughness:0.9,tex:'ruin',rx:2,ry:2}, [0,0.11,0]);
    const bodyMat = stdMat({color:P.RUIN_GREY,roughness:0.85,tex:'ruin',rx:1,ry:1});
    bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.22+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.22+bh;
    // Broken/jagged top — several uneven blocks
    part(g, new THREE.BoxGeometry(0.6,0.4,0.6), {color:P.RUIN_GREY,roughness:0.85,tex:'ruin',rx:1,ry:1}, [-0.6,top+0.2,0]);
    part(g, new THREE.BoxGeometry(0.4,0.25,0.4), {color:0xA5A29A,roughness:0.85,tex:'ruin',rx:1,ry:1}, [0.1,top+0.12,0.3]);
    part(g, new THREE.BoxGeometry(0.35,0.15,0.35), {color:0x9A988E,roughness:0.85,tex:'ruin',rx:1,ry:1}, [0.7,top+0.07,-0.2]);
    // Faded sign (desaturated board)
    part(g, new THREE.BoxGeometry(0.8,0.4,0.04), {color:0xC8C2B0,roughness:0.9,tex:'wood',rx:1,ry:1}, [0,0.22+bh*0.6,bw/2+0.03]);
    // Overgrown vine
    part(g, new THREE.SphereGeometry(0.18,8,8), {color:0x8A8870,roughness:0.95}, [-0.8,0.22+0.3,0.8]);
    part(g, new THREE.SphereGeometry(0.15,8,8), {color:0x7A7860,roughness:0.95}, [0.9,0.22+0.2,-0.6]);
    // Story-locked ruins have no entrance marker until narrative content opts in.
    if (!cfg.storyLocked) {
      part(g, new THREE.CylinderGeometry(0.12,0.12,0.04,16), {color:0x7A7A82,emissive:0x4A4A52,emissiveIntensity:0.1}, [0,0.22+0.045,0], false);
    }
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.6};
  }
  
  // 08 CATCAFE — very tall thin skyscraper with banded floors
  function buildSkyscraper(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=1.3, bh=6.5;
    part(g, new THREE.BoxGeometry(2.0,PLH,2.0), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,PLH/2,0]);
    const bodyMat = stdMat({color:0xFDFCFA,roughness:0.06,tex:'glass',rx:1,ry:4});
    bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = PLH+bh;
    // Floor banding (horizontal lines every ~1 unit)
    for (let i = 1; i < 7; i++) {
      part(g, new THREE.BoxGeometry(bw+0.04,0.06,bw+0.04), {color:0xE8E7E4,roughness:0.4,tex:'metal',rx:1,ry:1}, [0,PLH+i*0.95,0]);
    }
    // Rooftop
    part(g, new THREE.BoxGeometry(bw+0.1,0.1,bw+0.1), {color:P.ROOF_RIM,roughness:0.4,tex:'metal',rx:1,ry:1}, [0,top+0.05,0]);
    // Cat silhouette on roof (small sphere + cones for ears)
    part(g, new THREE.SphereGeometry(0.15,10,10), {color:0xE8A838,emissive:0xE8A838,emissiveIntensity:0.12}, [0,top+0.1+0.15,0]);
    part(g, new THREE.ConeGeometry(0.06,0.12,4), {color:0xE8A838,emissive:0xE8A838,emissiveIntensity:0.12}, [-0.07,top+0.1+0.3,0]);
    part(g, new THREE.ConeGeometry(0.06,0.12,4), {color:0xE8A838,emissive:0xE8A838,emissiveIntensity:0.12}, [0.07,top+0.1+0.3,0]);
    // Wind chimes
    part(g, new THREE.CylinderGeometry(0.02,0.02,0.3,6), {color:0xD4D3D0,roughness:0.5}, [-0.5,top+0.1+0.15,0]);
    part(g, new THREE.CylinderGeometry(0.02,0.02,0.25,6), {color:0xD4D3D0,roughness:0.5}, [0.5,top+0.1+0.12,0]);
    // Keep the entry marker clear of the platform top to avoid depth flicker.
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
  }
  
  // 09 ACADEMY — wide campus with annex (reuse existing campus)
  function buildCampus(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const mw=2.9, mh=2.1, md=2.1;
    part(g, new THREE.BoxGeometry(3.6,0.25,2.8), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:2}, [0,0.125,0]);
    const bodyMat = mkBodyMat('wall', 2, 1);
    const body = mk(new THREE.BoxGeometry(mw,mh,md), bodyMat);
    body.position.y = 0.25+mh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const mainTop = 0.25+mh;
    part(g, new THREE.BoxGeometry(mw+0.18,0.1,md+0.18), {color:P.ROOF_RIM,roughness:0.5,tex:'rooftile',rx:3,ry:3}, [0,mainTop+0.05,0]);
    const aw=1.05, ah=1.5, ad=1.85;
    const aX = -(mw/2-aw/2), aZ = md/2+ad/2;
    part(g, new THREE.BoxGeometry(aw,ah,ad), {color:0xFDFCFA,roughness:0.1,tex:'wall',rx:1,ry:1}, [aX,0.25+ah/2,aZ]);
    part(g, new THREE.BoxGeometry(aw+0.14,0.08,ad+0.14), {color:P.ROOF_RIM,roughness:0.5,tex:'rooftile',rx:2,ry:2}, [aX,0.25+ah+0.04,aZ]);
    ([[-0.7,0.22],[0,0.18],[0.75,0.26]] as const).forEach(([rx,rh]) => {
      part(g, new THREE.BoxGeometry(0.32,rh,0.32), {color:0xF0EFEC,roughness:0.3,tex:'stone',rx:1,ry:1}, [rx,mainTop+0.1+rh/2,-0.5]);
    });
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:mainTop+0.7};
  }
  
  // 10/11 KIOSK — small square structure with awning (for news & mutualaid)
  function buildKiosk(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=1.6, bh=1.5;
    const accentColor = cfg.id === 'news' ? 0xD4A838 : 0x6B8FE8;
    part(g, new THREE.BoxGeometry(2.1,0.2,1.8), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,0.1,0]);
    const bodyMat = mkBodyMat('wood', 1, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.2+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.2+bh;
    // Flat roof
    part(g, new THREE.BoxGeometry(bw+0.4,0.08,bw+0.4), {color:P.ROOF_RIM,roughness:0.4,tex:'rooftile',rx:2,ry:2}, [0,top+0.04,0]);
    // Striped awning (alternating color bands)
    for (let i = 0; i < 5; i++) {
      const x = -bw/2 - 0.1 + i * (bw+0.2)/5;
      part(g, new THREE.BoxGeometry((bw+0.2)/5-0.02, 0.06, 0.4), {color: i%2===0 ? accentColor : 0xF5F4F1, roughness:0.5}, [x+0.1, top+0.02, bw/2+0.2]);
    }
    // Window cutout (simulated with darker box). Keep it fully in front of the
    // generated facade plane (depth/2 + 0.024) so its faces never share a depth
    // boundary with the facade and flicker at the photo-studio wall.
    part(g, new THREE.BoxGeometry(bw*0.7,bh*0.5,0.04), {color:0x4A6FA8,roughness:0.1,metalness:0.3,tex:'glass',rx:1,ry:1}, [0,0.2+bh*0.5,bw/2+0.055]);
    // Sign on top
    part(g, new THREE.BoxGeometry(bw*0.6,0.3,0.05), {color:accentColor,roughness:0.4,tex:'wood',rx:1,ry:1}, [0,top+0.08+0.15,0]);
    // Blue accent disc
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
  }
  
  // 12 SCREEN — wall structure with glowing blue screen
  function buildScreen(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=2.8, bh=3.2;
    part(g, new THREE.BoxGeometry(3.4,0.25,1.0), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:1}, [0,0.125,0]);
    const bodyMat = mkBodyMat('wall', 2, 2);
    const body = mk(new THREE.BoxGeometry(bw,bh,0.6), bodyMat);
    body.position.y = 0.25+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.25+bh;
    // Roof slab
    part(g, new THREE.BoxGeometry(bw+0.3,0.12,1.0), {color:P.ROOF_RIM,roughness:0.4,tex:'rooftile',rx:3,ry:1}, [0,top+0.06,0]);
    // Glowing screen on front face — layers stepped outward with clear gaps so no
    // coplanar faces z-fight (screen→frame→glow lines all distinct depths).
    const screenMat = stdMat({color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.25,roughness:0.1});
    const screen = part(g, new THREE.BoxGeometry(bw*0.8,bh*0.7,0.08), screenMat, [0,0.25+bh*0.5,0.46], false);
    screen.renderOrder = RENDER_ORDER.buildingSurface;
    // Screen frame
    const screenFrame = part(g, new THREE.BoxGeometry(bw*0.85,bh*0.75,0.08), {color:0x2A2A30,roughness:0.3}, [0,0.25+bh*0.5,0.33], false);
    screenFrame.renderOrder = RENDER_ORDER.buildingSurface;
    // Screen glow lines
    for (let i = 0; i < 4; i++) {
      const glowLine = part(g, new THREE.BoxGeometry(bw*0.6,0.03,0.04), {color:0xA8C8F8,emissive:0xA8C8F8,emissiveIntensity:0.2,depthWrite:false}, [0,0.25+bh*0.3+i*0.4,0.54], false);
      glowLine.renderOrder = RENDER_ORDER.overlay;
    }
    // Antenna on top
    part(g, new THREE.CylinderGeometry(0.03,0.03,0.5,6), {color:0xD0CFCC,roughness:0.5}, [0,top+0.12+0.25,0]);
    part(g, new THREE.SphereGeometry(0.06,8,8), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.3}, [0,top+0.12+0.5,0], false);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.12+0.5+0.5};
  }
  
  // 13 ELEVATOR — tall narrow shaft with door and button panel
  function buildShaft(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=1.3, bh=3.8;
    part(g, new THREE.BoxGeometry(2.0,PLH,1.8), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,PLH/2,0]);
    const bodyMat = stdMat({color:0xE8E7E4,roughness:0.2,metalness:0.4,tex:'metal',rx:1,ry:3});
    bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = PLH+bh;
    // Roof
    part(g, new THREE.BoxGeometry(bw+0.15,0.1,bw+0.15), {color:P.ROOF_RIM,roughness:0.3,tex:'metal',rx:1,ry:1}, [0,top+0.05,0]);
    // Elevator door (split design)
    part(g, new THREE.BoxGeometry(bw*0.7,1.6,0.04), {color:0x4A6FA8,roughness:0.1,metalness:0.6,tex:'metal',rx:1,ry:2}, [0,PLH+0.8,bw/2+0.02], false);
    part(g, new THREE.BoxGeometry(0.02,1.6,0.04), {color:0x2A2A30,roughness:0.3,tex:'metal',rx:1,ry:1}, [0,PLH+0.8,bw/2+0.03], false);
    // Button panel
    part(g, new THREE.BoxGeometry(0.15,0.4,0.03), {color:0x2A2A30,roughness:0.3,tex:'metal',rx:1,ry:1}, [bw/2-0.1,PLH+1.2,bw/2+0.02], false);
    // Floor indicator (glowing)
    part(g, new THREE.BoxGeometry(0.1,0.08,0.02), {color:0xA8C8F8,emissive:0xA8C8F8,emissiveIntensity:0.3}, [0,PLH+bh-0.4,bw/2+0.02], false);
    // Top indicator light
    part(g, new THREE.SphereGeometry(0.06,8,8), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.4}, [0,top+0.1+0.06,0], false);
    // Keep the entry marker clear of the platform top to avoid depth flicker.
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
  }
  
  // 14 RESIDENTID — stone altar with paper on top
  function buildAltar(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw=2.0, bh=1.2;
    part(g, new THREE.BoxGeometry(2.6,0.2,1.8), {color:0xD4D3D0,roughness:0.85,tex:'stone',rx:2,ry:2}, [0,0.1,0]);
    const bodyMat = stdMat({color:0xE8E7E4,roughness:0.6,tex:'stone',rx:1,ry:1});
    bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.2+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.2+bh;
    // Stone table top (wider slab)
    part(g, new THREE.BoxGeometry(bw+0.4,0.12,bw+0.4), {color:0xF0EFEC,roughness:0.5,tex:'stone',rx:2,ry:2}, [0,top+0.06,0]);
    // Paper/certificate on top
    part(g, new THREE.BoxGeometry(1.2,0.04,0.8), {color:0xF8F4E8,roughness:0.9}, [0,top+0.12+0.02,0]);
    // Wax seal (gold dot)
    part(g, new THREE.CylinderGeometry(0.08,0.08,0.03,12), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.2}, [0,top+0.12+0.04,0], false);
    // Pillars at corners
    ([[-0.8,-0.8],[-0.8,0.8],[0.8,-0.8],[0.8,0.8]] as const).forEach(([cx,cz]) =>
      part(g, new THREE.CylinderGeometry(0.07,0.08,bh,8), {color:0xDEDDE0,roughness:0.5}, [cx,0.2+bh/2,cz]));
    // Decorative arch
    part(g, new THREE.BoxGeometry(1.6,0.08,0.1), {color:0xE8E7E4,roughness:0.5}, [0,top+0.5,0]);
    part(g, new THREE.CylinderGeometry(0.04,0.04,0.5,6), {color:0xD0CFCC,roughness:0.5}, [-0.7,top+0.3,0]);
    part(g, new THREE.CylinderGeometry(0.04,0.04,0.5,6), {color:0xD0CFCC,roughness:0.5}, [0.7,top+0.3,0]);
    // Quill pen
    part(g, new THREE.CylinderGeometry(0.02,0.02,0.4,6), {color:0xE8E7E4,roughness:0.5}, [0.3,top+0.12+0.2,0.2]);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5+0.3};
  }
  
  // 15 STATS — octagonal observatory with pulsing glow ring
  function buildObservatory(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(1.65,1.65,0.22,8), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:1}, [0,0.11,0]);
    const bodyMat = mkBodyMat('stone', 2, 1);
    const body = mk(new THREE.CylinderGeometry(1.1,1.22,2.1,8), bodyMat);
    body.position.y = 0.22+1.05; body.castShadow = body.receiveShadow = true; g.add(body);
    part(g, new THREE.CylinderGeometry(1.28,1.28,0.09,24), {color:P.ROOF_RIM,roughness:0.5,tex:'rooftile',rx:3,ry:1}, [0,0.22+1.05,0]);
    const bodyTop = 0.22+2.1;
    part(g, new THREE.CylinderGeometry(1.3,1.3,0.1,24), {color:P.ROOF_RIM,roughness:0.4,tex:'rooftile',rx:3,ry:1}, [0,bodyTop+0.05,0]);
    const glowMat = stdMat({color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.2,roughness:0.2});
    part(g, new THREE.CylinderGeometry(1.12,1.12,0.06,24), glowMat, [0,bodyTop+0.1+0.03,0], false);
    const domeY = bodyTop+0.1+0.06;
    part(g, new THREE.SphereGeometry(1.1,20,10,0,Math.PI*2,0,Math.PI/2), {color:0xF8F7F5,roughness:0.06,metalness:0.05,tex:'metal',rx:2,ry:1}, [0,domeY,0]);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.22+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    const labelY = domeY+1.1+0.5;
    return {...cfg, group:g, body, bodyMat, glowMat, labelEl:null, labelY};
  }
  
  // 16 PAGODA — multi-tiered Asian tower
  function buildPagoda(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const tiers = 3, bw = 1.6, tierH = 0.6;
    let y = PLH;
    // Keep the facade on the actual closed wall meshes. A detached facade plane
    // leaves visible gaps around the stepped tiers and can be mistaken for a wall.
    const bodyMat = mkBodyMat('facade_pagoda', 1, 1);
    let body: THREE.Mesh | null = null;
    for (let i = 0; i < tiers; i++) {
      const w = bw * (1 - i * 0.18);
      const tierBody = mk(new THREE.BoxGeometry(w, tierH, w), bodyMat);
      tierBody.position.y = y + tierH/2; tierBody.castShadow = tierBody.receiveShadow = true; g.add(tierBody);
      if (!body) body = tierBody;
      const roofW = w + 0.6;
      const roof = part(g, new THREE.ConeGeometry(roofW * 0.72, 0.22, 4), {color:0xC45A4A,roughness:0.4,tex:'pagoda_tile',rx:2,ry:1}, [0, y + tierH + 0.11, 0]);
      roof.rotation.y = Math.PI/4;
      y += tierH + 0.2;
    }
    part(g, new THREE.ConeGeometry(0.08, 0.35, 6), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.2}, [0, y, 0], false);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body: body ?? undefined, bodyMat, labelEl:null, labelY:y+0.5};
  }
  
  // 17 MARKET — open-air stalls with striped awning
  function buildMarket(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.6, bh = 1.6;
    part(g, new THREE.BoxGeometry(3.2,0.2,2.2), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:1}, [0,0.1,0]);
    const bodyMat = mkBodyMat('wood', 1, 1);
    [-1.1,1.1].forEach(cx =>
      part(g, new THREE.BoxGeometry(0.1,bh,0.1), {color:0xC4A86D,roughness:0.6,tex:'wood',rx:1,ry:2}, [cx,0.2+bh/2,0]));
    const body = mk(new THREE.BoxGeometry(0.1,bh,0.1), bodyMat);
    body.position.y = 0.2+bh/2; g.add(body);
    // Striped awning
    for (let i = 0; i < 5; i++) {
      const x = -bw/2 - 0.1 + i*(bw+0.2)/5;
      part(g, new THREE.BoxGeometry((bw+0.2)/5-0.02, 0.06, 2.0), {color: i%2===0?0xE8A838:0xF5F4F1, roughness:0.5, tex:'fabric',rx:1,ry:1}, [x+0.1, 0.2+bh, 0]);
    }
    // Goods crates
    part(g, new THREE.BoxGeometry(0.4,0.35,0.4), {color:0xB8956B,roughness:0.7,tex:'wood',rx:1,ry:1}, [-0.7,0.2+0.175,0.5], false);
    part(g, new THREE.BoxGeometry(0.35,0.3,0.35), {color:0xC4A86D,roughness:0.7,tex:'wood',rx:1,ry:1}, [0.7,0.2+0.15,-0.4], false);
    part(g, new THREE.SphereGeometry(0.1,8,8), {color:0xE85858,roughness:0.8}, [-0.5,0.2+0.55,0.5], false);
    part(g, new THREE.SphereGeometry(0.08,8,8), {color:0xE8A838,roughness:0.8}, [0.5,0.2+0.5,-0.4], false);
    // Counter
    part(g, new THREE.BoxGeometry(1.4,0.55,0.45), {color:0xC4A86D,roughness:0.6,tex:'wood',rx:2,ry:1}, [0,0.2+0.275,0.65]);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:0.2+bh+0.5};
  }
  
  // 18 GREENHOUSE — glass dome with plants
  function buildGreenhouse(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.4, bh = 1.8;
    part(g, new THREE.BoxGeometry(3.0,0.2,2.4), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:1}, [0,0.1,0]);
    const bodyMat = mkBodyMat('glass', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.2+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    // Domed glass roof
    part(g, new THREE.SphereGeometry(bw/2, 20, 10, 0, Math.PI*2, 0, Math.PI/2), {color:0xE0F0D8,roughness:0.05,transparent:true,opacity:0.85,tex:'glass',rx:2,ry:1}, [0,0.2+bh,0]);
    // Plants inside
    part(g, new THREE.SphereGeometry(0.35,10,10), {color:0x6A9A4A,roughness:0.9}, [-0.5,0.2+0.3,0.3], false);
    part(g, new THREE.SphereGeometry(0.28,10,10), {color:0x5A8A3A,roughness:0.9}, [0.5,0.2+0.25,-0.3], false);
    part(g, new THREE.CylinderGeometry(0.04,0.04,0.5,6), {color:0x8A6A3A,roughness:0.8,tex:'wood',rx:1,ry:1}, [0,0.2+0.25,0], false);
    part(g, new THREE.SphereGeometry(0.2,10,10), {color:0x7AAA5A,roughness:0.9}, [0,0.2+0.5,0], false);
    part(g, new THREE.SphereGeometry(0.15,10,10), {color:0xE85858,roughness:0.8}, [0.3,0.2+0.6,0.1], false);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:0.2+bh+bw/2+0.3};
  }
  
  // 19 CLOCKTOWER — tall brick tower with clock faces
  function buildClockTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 1.5, bh = 4.0;
    part(g, new THREE.BoxGeometry(2.2,PLH,2.2), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,PLH/2,0]);
    const bodyMat = mkBodyMat('brick', 1, 3);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = PLH+bh;
    // Clock face (4 sides)
    const clockFaces: Array<{ position: [number, number, number]; rotation: number }> = [
      { position: [0, top-0.6, bw/2+0.04], rotation: 0 },
      { position: [0, top-0.6, -bw/2-0.04], rotation: Math.PI },
      { position: [bw/2+0.04, top-0.6, 0], rotation: Math.PI/2 },
      { position: [-bw/2-0.04, top-0.6, 0], rotation: -Math.PI/2 },
    ];
    clockFaces.forEach(({position, rotation}) => {
      const face = new THREE.Group();
      const disc = part(face, new THREE.CylinderGeometry(0.3,0.3,0.04,20), {color:0xF8F4E8,roughness:0.3,emissive:0xF8F4E8,emissiveIntensity:0.05}, [0,0,0], false);
      disc.rotation.x = Math.PI/2;
      part(face, new THREE.BoxGeometry(0.02,0.28,0.02), {color:0x2A2A2A,roughness:0.4}, [0,0.05,0.02], false);
      part(face, new THREE.BoxGeometry(0.22,0.02,0.02), {color:0x2A2A2A,roughness:0.4}, [0,0.1,0.02], false);
      face.position.set(...position); face.rotation.y = rotation; g.add(face);
    });
    // Pyramidal roof
    part(g, new THREE.ConeGeometry(1.1,0.8,4), {color:0x8A5A3A,roughness:0.5,tex:'rooftile',rx:2,ry:1}, [0,top+0.4,0]).rotation.y = Math.PI/4;
    // Weather vane
    part(g, new THREE.CylinderGeometry(0.02,0.02,0.3,6), {color:0xD0CFCC,roughness:0.5,tex:'metal',rx:1,ry:1}, [0,top+0.8+0.15,0], false);
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.8+0.5};
  }
  
  // 20 TEMPLE — classical Greek-style temple
  function buildTemple(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 2.8, bh = 1.8;
    part(g, new THREE.BoxGeometry(3.6,0.25,2.8), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:2,ry:2}, [0,0.125,0]);
    const bodyMat = mkBodyMat('stone', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.25+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.25+bh;
    // Cornice
    part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.ROOF_RIM,roughness:0.5,tex:'stone',rx:3,ry:3}, [0,top+0.05,0]);
    // Columns all around
    [-1.1,-0.55,0.55,1.1].forEach(cx => {
      part(g, new THREE.CylinderGeometry(0.08,0.09,bh*0.95,12), {color:0xF8F7F5,roughness:0.3,tex:'stone',rx:1,ry:2}, [cx,0.25+bh*0.475,bw/2+0.15]);
      part(g, new THREE.CylinderGeometry(0.08,0.09,bh*0.95,12), {color:0xF8F7F5,roughness:0.3,tex:'stone',rx:1,ry:2}, [cx,0.25+bh*0.475,-bw/2-0.15]);
    });
    // Front steps
    part(g, new THREE.BoxGeometry(bw-0.4,0.08,bw/2), {color:0xF0EFEC,roughness:0.5,tex:'stone',rx:2,ry:1}, [0,0.04,bw/2+0.1]);
    // Triangular pediment
    const ped = mk(new THREE.ConeGeometry(1.5,0.5,3), stdMat({color:0xF5F4F1,roughness:0.2,tex:'stone',rx:2,ry:1}));
    ped.rotation.y = Math.PI/6; ped.position.y = top+0.1+0.25; g.add(ped);
    // Roof
    part(g, new THREE.ConeGeometry(1.8,0.4,4), {color:0xC45A4A,roughness:0.4,tex:'pagoda_tile',rx:2,ry:1}, [0,top+0.1+0.5+0.2,0]).rotation.y = Math.PI/4;
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.8+0.5};
  }
  
  // 21 FACTORY — industrial building with chimney
  function buildFactory(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 3.0, bh = 1.8;
    part(g, new THREE.BoxGeometry(3.6,0.2,2.6), {color:P.BUILDING_BASE,roughness:0.85,tex:'stone',rx:2,ry:2}, [0,0.1,0]);
    const bodyMat = mkBodyMat('metal', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.2+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.2+bh;
    // Flat corrugated roof
    part(g, new THREE.BoxGeometry(bw+0.2,0.08,bw+0.2), {color:0xB0AFAA,roughness:0.6,tex:'metal',rx:3,ry:3}, [0,top+0.04,0]);
    // Chimney
    part(g, new THREE.CylinderGeometry(0.18,0.22,1.8,12), {color:0xC4A86D,roughness:0.7,tex:'brick',rx:2,ry:1}, [bw/2-0.4,top+0.9,0]);
    // Smoke
    part(g, new THREE.SphereGeometry(0.15,10,10), {color:0xD0CFCC,transparent:true,opacity:0.4,roughness:1}, [bw/2-0.4,top+1.8+0.15,0], false);
    part(g, new THREE.SphereGeometry(0.1,10,10), {color:0xD0CFCC,transparent:true,opacity:0.3,roughness:1}, [bw/2-0.4,top+2.1,0], false);
    // Loading door. Keep all facade details fully in front of the generated
    // facade plane; overlapping it made the Writing Club visibly flicker.
    const facadeGap = 0.055;
    part(g, new THREE.BoxGeometry(0.6,0.8,0.04), {color:0x4A6FA8,roughness:0.3,metalness:0.4,tex:'metal',rx:1,ry:1}, [0,0.2+0.4,bw/2+facadeGap], false);
    // Side pipes
    part(g, new THREE.CylinderGeometry(0.04,0.04,1.2,8), {color:0x8A8A8E,roughness:0.4,metalness:0.3,tex:'metal',rx:1,ry:1}, [-bw/2+0.3,0.2+0.6,bw/2+facadeGap], false);
    // Windows
    for (let i = 0; i < 3; i++) {
      part(g, new THREE.BoxGeometry(0.4,0.4,0.02), {color:0xA8C8F8,roughness:0.1,metalness:0.2,tex:'glass',rx:1,ry:1}, [-0.8+i*0.8, 0.2+bh*0.6, bw/2+facadeGap], false);
    }
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+1.5};
  }
  
  // 22 MALL — large shopping center with glass facade, billboard, entrance awning
  function buildMall(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 3.6, bd = 2.8, bh = 2.4;
    part(g, new THREE.BoxGeometry(bw+0.6, 0.25, bd+0.6), {color:P.BUILDING_BASE,roughness:0.85,tex:'pavement',rx:2,ry:1}, [0,0.125,0]);
    const bodyMat = stdMat({color:0xD8E0E8, roughness:0.08, metalness:0.3, tex:'mallglass', rx:1, ry:1});
    bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(bw,bh,bd), bodyMat);
    body.position.y = 0.25+bh/2+0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.25+bh;
    // Flat dark parapet roof. Keep it above the glass body so the black fascia
    // cannot share a depth boundary with the reflective wall.
    const roofLift = 0.025;
    part(g, new THREE.BoxGeometry(bw+0.15,0.18,bd+0.15), {color:P.MALL_FRAME,roughness:0.4,metalness:0.5,tex:'metal',rx:2,ry:1}, [0,top+0.09+roofLift,0]);
    // Rooftop sign / billboard. The sign and its posts sit clear of the roof
    // top surface (signLift) so their bottom faces never share the roof's depth
    // boundary, which otherwise flickers as black pixels in far views.
    const signLift = 0.02;
    const signY = top+0.18+0.275+roofLift+signLift;
    part(g, new THREE.BoxGeometry(2.4,0.55,0.12), {color:P.MALL_SIGN,emissive:P.MALL_SIGN,emissiveIntensity:0.22,roughness:0.3,tex:'fabric',rx:2,ry:1}, [0,signY,bd/2-0.3]);
    part(g, new THREE.BoxGeometry(0.1,0.55,0.1), {color:0x6A6A6E,roughness:0.5,metalness:0.3,tex:'metal',rx:1,ry:1}, [-1.0,signY,bd/2-0.3]);
    part(g, new THREE.BoxGeometry(0.1,0.55,0.1), {color:0x6A6A6E,roughness:0.5,metalness:0.3,tex:'metal',rx:1,ry:1}, [1.0,signY,bd/2-0.3]);
    // Entrance awning (curved feel via thin slab)
    part(g, new THREE.BoxGeometry(2.0,0.08,0.9), {color:P.MALL_SIGN,roughness:0.5,tex:'fabric',rx:3,ry:1}, [0,0.25+1.0,bd/2+0.45]);
    part(g, new THREE.CylinderGeometry(0.05,0.05,0.9,8), {color:0x9A9A9E,roughness:0.5,metalness:0.3,tex:'metal',rx:1,ry:1}, [-0.9,0.25+0.55,bd/2+0.45], false).rotation.x = Math.PI/2;
    part(g, new THREE.CylinderGeometry(0.05,0.05,0.9,8), {color:0x9A9A9E,roughness:0.5,metalness:0.3,tex:'metal',rx:1,ry:1}, [0.9,0.25+0.55,bd/2+0.45], false).rotation.x = Math.PI/2;
    // Glass entrance doors
    part(g, new THREE.BoxGeometry(1.2,1.0,0.04), {color:0xA8C8F8,roughness:0.05,metalness:0.4,transparent:true,opacity:0.85,tex:'glass',rx:1,ry:1}, [0,0.25+0.5,bd/2+0.02], false);
    // Side accent windows (lower band)
    for (let i = 0; i < 4; i++) {
      part(g, new THREE.BoxGeometry(0.5,0.4,0.02), {color:0xB8D4F0,roughness:0.1,metalness:0.3,tex:'glass',rx:1,ry:1}, [-1.35+i*0.9, 0.25+bh*0.55, bd/2+0.02], false);
    }
    // Accent corner pylon
    // Offset both exterior faces from the glass walls to prevent z-fighting.
    const pylonOffset = 0.025;
    const pylonX = bw/2-0.15+pylonOffset;
    const pylonZ = -bd/2+0.15-pylonOffset;
    part(g, new THREE.BoxGeometry(0.3,2.8,0.3), {color:P.MALL_FRAME,roughness:0.4,metalness:0.5,tex:'metal',rx:1,ry:2}, [pylonX,0.25+1.4,pylonZ]);
    part(g, new THREE.SphereGeometry(0.12,12,12), {color:P.MALL_SIGN,emissive:P.MALL_SIGN,emissiveIntensity:0.35}, [pylonX,0.25+2.8+0.12,pylonZ], false);
    // Blue entrance disc
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.18+0.55+0.5};
  }
  
  // 23 SCHOOL — multi-building campus with playground, flagpole
  function buildSchool(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    // Main building
    const bw = 3.0, bh = 1.6;
    part(g, new THREE.BoxGeometry(bw+0.6,0.22,bw+0.6), {color:P.BUILDING_BASE,roughness:0.85,tex:'pavement',rx:2,ry:2}, [0,0.11,0]);
    const bodyMat = mkBodyMat('schoolbrick', 2, 1);
    const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
    body.position.y = 0.22+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = 0.22+bh;
    // Pitched slate roof
    part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.SCHOOL_ROOF,roughness:0.5,tex:'rooftile',rx:3,ry:3}, [0,top+0.05,0]);
    // Roof ridge
    part(g, new THREE.CylinderGeometry(0.05,0.05,bw+0.2,8), {color:0x4A3A2A,roughness:0.5,tex:'wood',rx:2,ry:1}, [0,top+0.1+0.025,0]).rotation.z = Math.PI/2;
    // Front gable
    part(g, new THREE.ConeGeometry(bw/2+0.1,0.6,4), {color:P.SCHOOL_ROOF,roughness:0.5,tex:'rooftile',rx:2,ry:1}, [0,top+0.1+0.3,bw/2-0.05]).rotation.y = Math.PI/4;
    // Entrance door
    part(g, new THREE.BoxGeometry(0.5,0.85,0.04), {color:0x6A4A3A,roughness:0.6,tex:'wood',rx:1,ry:1}, [0,0.22+0.425,bw/2+0.02], false);
    part(g, new THREE.BoxGeometry(0.6,0.1,0.1), {color:0x4A3A2A,roughness:0.6,tex:'wood',rx:1,ry:1}, [0,0.22+0.85+0.05,bw/2+0.04], false);
    // Front windows (rows)
    for (let i = 0; i < 4; i++) {
      const x = -1.05 + i*0.7;
      part(g, new THREE.BoxGeometry(0.42,0.42,0.02), {color:0xA8C8E0,roughness:0.1,metalness:0.2,tex:'glass',rx:1,ry:1}, [x, 0.22+bh*0.55, bw/2+0.02], false);
      ctx2d_windows(g, x, 0.22+bh*0.55, bw/2+0.02);
    }
    // Flagpole in front
    part(g, new THREE.CylinderGeometry(0.03,0.03,2.4,8), {color:0xD0CFCC,roughness:0.5,metalness:0.3,tex:'metal',rx:1,ry:2}, [0,0.22+1.2,bw/2+1.0], false);
    part(g, new THREE.BoxGeometry(0.5,0.32,0.02), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.18,roughness:0.5}, [0.25,0.22+2.3,bw/2+1.0], false);
    // Playground: sandbox + see-saw + swing set (all raised to avoid z-fighting with ground)
    // Sandbox
    part(g, new THREE.CylinderGeometry(0.45,0.45,0.08,12), {color:0xE2C8A0,roughness:0.9,tex:'wood',rx:1,ry:1}, [bw/2+0.9,0.08,-bw/2+0.5], false);
    part(g, new THREE.CylinderGeometry(0.42,0.42,0.05,12), {color:0xD8C098,roughness:0.95,tex:'wood',rx:1,ry:1}, [bw/2+0.9,0.11,-bw/2+0.5], false);
    // Swing set
    part(g, new THREE.BoxGeometry(1.4,0.06,0.06), {color:0x6A6A6E,roughness:0.4,metalness:0.4,tex:'metal',rx:2,ry:1}, [bw/2+0.9,0.22+1.2,-bw/2+1.4], false);
    part(g, new THREE.CylinderGeometry(0.04,0.04,1.2,8), {color:0x6A6A6E,roughness:0.4,metalness:0.4,tex:'metal',rx:1,ry:1}, [bw/2+0.9-0.65,0.22+0.6,-bw/2+1.4], false);
    part(g, new THREE.CylinderGeometry(0.04,0.04,1.2,8), {color:0x6A6A6E,roughness:0.4,metalness:0.4,tex:'metal',rx:1,ry:1}, [bw/2+0.9+0.65,0.22+0.6,-bw/2+1.4], false);
    part(g, new THREE.BoxGeometry(0.2,0.3,0.04), {color:0xE8A838,roughness:0.6,tex:'wood',rx:1,ry:1}, [bw/2+0.9,0.22+0.45,-bw/2+1.4], false);
    // See-saw
    part(g, new THREE.BoxGeometry(1.4,0.06,0.18), {color:0xE85858,roughness:0.6,tex:'wood',rx:2,ry:1}, [bw/2+1.8,0.22+0.25,-bw/2+0.4], false);
    part(g, new THREE.CylinderGeometry(0.08,0.08,0.25,8), {color:0x6A6A6E,roughness:0.5,metalness:0.4,tex:'metal',rx:1,ry:1}, [bw/2+1.8,0.22+0.125,-bw/2+0.4], false);
    // Side wing: gym
    part(g, new THREE.BoxGeometry(1.4,1.0,1.2), {color:P.SCHOOL_BRICK,roughness:0.4,tex:'schoolbrick',rx:1,ry:1}, [-bw/2-0.9,0.22+0.5,-bw/2+0.3]);
    part(g, new THREE.CylinderGeometry(0.7,0.7,0.18,16), {color:0xC0BFBC,roughness:0.5,tex:'metal',rx:3,ry:1}, [-bw/2-0.9,0.22+1.0+0.09,-bw/2+0.3]);
    // Blue entrance disc
    part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.22+0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.7};
  }

  // 24 ACADEMY — courtyard library with a gate tower and covered side galleries
  function buildAcademy(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const baseY = 0.22;
    const bodyMat = mkBodyMat('academybrick', 2, 1);
    const body = mk(new THREE.BoxGeometry(2.7, 1.55, 1.55), bodyMat);
    body.position.set(0, baseY + 0.775, 0.15);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    part(g, new THREE.BoxGeometry(3.8, 0.18, 2.45), {color:0xD8C9A8,roughness:0.9,tex:'stone',rx:2,ry:2}, [0,0.09,0]);
    part(g, new THREE.BoxGeometry(3.1, 0.12, 1.95), {color:0x6A4635,roughness:0.65,tex:'wood',rx:2,ry:1}, [0,1.96,0.15]);
    part(g, new THREE.BoxGeometry(3.45, 0.1, 0.18), {color:0x3E3029,roughness:0.6,tex:'wood',rx:1,ry:1}, [0,2.07,0.15]);
    // Front gate tower and two covered galleries make the silhouette distinct from the generic school.
    part(g, new THREE.BoxGeometry(0.75, 2.35, 0.55), {color:0xA66F4E,roughness:0.75,tex:'academybrick',rx:1,ry:1}, [0,1.18,1.0]);
    part(g, new THREE.ConeGeometry(0.58, 0.42, 4), {color:0x4D382C,roughness:0.6,tex:'rooftile',rx:1,ry:1}, [0,2.56,1.0]).rotation.y = Math.PI / 4;
    part(g, new THREE.BoxGeometry(0.4, 0.82, 0.04), {color:0x4A2C23,roughness:0.65,tex:'wood',rx:1,ry:1}, [0,0.63,1.29], false);
    [-1.45, 1.45].forEach((x) => {
      part(g, new THREE.BoxGeometry(0.45, 1.05, 1.75), {color:0xB67B58,roughness:0.75,tex:'academybrick',rx:1,ry:1}, [x,0.75,0.15]);
      part(g, new THREE.BoxGeometry(0.62, 0.12, 1.95), {color:0x5A4030,roughness:0.6,tex:'wood',rx:1,ry:1}, [x,1.34,0.15]);
    });
    for (let i = 0; i < 5; i++) {
      const x = -1.05 + i * 0.525;
      part(g, new THREE.BoxGeometry(0.3, 0.38, 0.03), {color:0xC7D8D4,roughness:0.2,metalness:0.1,tex:'glass',rx:1,ry:1}, [x,1.0,0.94], false);
    }
    part(g, new THREE.BoxGeometry(1.0, 0.18, 0.08), {color:0xD6B56B,emissive:0x8C6B31,emissiveIntensity:0.15,roughness:0.4,tex:'wood',rx:1,ry:1}, [0,2.1,1.31], false);
    part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.05,0], false);
    g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:2.65};
  }
  
  // helper: small window cross bars for school
  function ctx2d_windows(g: THREE.Group | null, x: number, y: number, z: number) {
    part(g, new THREE.BoxGeometry(0.45,0.02,0.025), {color:0x4A4A4E,roughness:0.5,tex:'metal',rx:1,ry:1}, [x, y+0.21, z+0.005], false);
    part(g, new THREE.BoxGeometry(0.02,0.45,0.025), {color:0x4A4A4E,roughness:0.5,tex:'metal',rx:1,ry:1}, [x, y, z+0.005], false);
  }
  
  // 30 KINGICE — a freestanding royal crown used as the Ice sanctum entrance
  function buildCrown(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bandBottom = 0.14;
    const bandHeight = 0.66;
    const bandTop = bandBottom + bandHeight;
    const outerBottomRadius = 1.48;
    const outerTopRadius = 1.72;
    const goldMat = stdMat({color:0xe8ad32,roughness:0.2,metalness:0.72});
    const innerGoldMat = stdMat({color:0x9f6818,roughness:0.28,metalness:0.62,side:THREE.BackSide});
    const liningMat = stdMat({color:0xa8e1e7,roughness:0.3,metalness:0.12,side:THREE.DoubleSide});
    const bodyMat = stdMat({color:0xd99522,roughness:0.2,metalness:0.7,side:THREE.DoubleSide});
    bodyMat.emissive = new THREE.Color(0x7d510f); bodyMat.emissiveIntensity = 0;

    const body = mk(new THREE.CylinderGeometry(outerTopRadius, outerBottomRadius, bandHeight, 64, 1, true), bodyMat);
    body.position.y = bandBottom + bandHeight / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);

    part(g, new THREE.CylinderGeometry(1.57, 1.35, bandHeight - 0.08, 64, 1, true), innerGoldMat, [0, bandBottom + bandHeight / 2, 0]);
    const lining = part(g, new THREE.CircleGeometry(1.34, 48), liningMat, [0, bandBottom + 0.015, 0], false);
    lining.rotation.x = -Math.PI / 2;
    const lowerRim = part(g, new THREE.TorusGeometry(outerBottomRadius, 0.11, 10, 64), goldMat, [0, bandBottom, 0]);
    lowerRim.rotation.x = Math.PI / 2;
    const middleRim = part(g, new THREE.TorusGeometry(1.59, 0.045, 8, 64), goldMat, [0, bandBottom + bandHeight * 0.48, 0]);
    middleRim.rotation.x = Math.PI / 2;
    const upperRim = part(g, new THREE.TorusGeometry(outerTopRadius, 0.1, 10, 64), goldMat, [0, bandTop, 0]);
    upperRim.rotation.x = Math.PI / 2;

    function crownPointGeometry(width: number, height: number): THREE.ExtrudeGeometry {
      const shape = new THREE.Shape();
      shape.moveTo(-width / 2, 0);
      shape.lineTo(-width * 0.43, height * 0.3);
      shape.quadraticCurveTo(-width * 0.2, height * 0.68, 0, height);
      shape.quadraticCurveTo(width * 0.2, height * 0.68, width * 0.43, height * 0.3);
      shape.lineTo(width / 2, 0);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelSegments: 2,
        bevelSize: 0.035,
        bevelThickness: 0.025,
        curveSegments: 6,
      });
      geometry.translate(0, 0, -0.07);
      return geometry;
    }

    const tallPoint = crownPointGeometry(0.9, 1.68);
    const shortPoint = crownPointGeometry(0.76, 1.18);
    const pointRadius = 1.57;
    const jewelColors = [0x8de5ef, 0x4caec8, 0xcdf8fa, 0x62c8d8, 0x9eeff2, 0x3f9ebd, 0xd8ffff, 0x68cad7];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const tall = i % 2 === 0;
      const pointHeight = tall ? 1.68 : 1.18;
      const px = Math.cos(angle) * pointRadius;
      const pz = Math.sin(angle) * pointRadius;
      const point = part(g, tall ? tallPoint : shortPoint, goldMat, [px, bandTop - 0.04, pz]);
      point.rotation.y = Math.PI / 2 - angle;
      part(g, new THREE.SphereGeometry(tall ? 0.12 : 0.09, 14, 10), goldMat, [px, bandTop - 0.04 + pointHeight + (tall ? 0.08 : 0.06), pz]);

      const settingRadius = 1.64;
      const setting = part(g, new THREE.SphereGeometry(0.21, 16, 12), goldMat, [Math.cos(angle) * settingRadius, bandBottom + bandHeight * 0.48, Math.sin(angle) * settingRadius]);
      setting.scale.set(1, 1, 0.34);
      setting.rotation.y = Math.PI / 2 - angle;
      const jewelRadius = 1.76;
      const jewelColor = jewelColors[i]!;
      const jewel = part(g, new THREE.OctahedronGeometry(0.15, 0), {color:jewelColor,roughness:0.08,metalness:0.25,emissive:jewelColor,emissiveIntensity:0.24}, [Math.cos(angle) * jewelRadius, bandBottom + bandHeight * 0.48, Math.sin(angle) * jewelRadius], false);
      jewel.scale.set(0.82, 1.18, 0.48);
      jewel.rotation.y = Math.PI / 2 - angle;
    }

    const labelY = bandTop + 1.68 + 0.45;
    g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY};
  }
  
  // 30 BANANA PALACE — 布拿拉宫
  function buildBanana(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 4.0, bh = 3.5, bd = 4.0;
    part(g, new THREE.BoxGeometry(bw+0.8, PLH, bd+0.8), {color:0xD4C020, roughness:0.7, tex:'stone', rx:1, ry:1}, [0, PLH/2, 0]);
    const bodyMat = stdMat({color:0xF5E838, roughness:0.3, metalness:0.1});
    bodyMat.emissive = new THREE.Color(0xE8D528); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.SphereGeometry(1, 24, 16), bodyMat);
    body.scale.set(bw/2, bh/2, bd/2); body.position.y = PLH + bh/2 + 0.012;
    body.castShadow = true; body.receiveShadow = true; g.add(body);
    const stem = mk(new THREE.ConeGeometry(0.5, 1.5, 12), stdMat({color:0x5A4A00, roughness:0.6}));
    stem.position.set(0, PLH+bh+0.4, 0); stem.castShadow = true; g.add(stem);
    for (let i = 0; i < 4; i++) {
      const a = (i/4)*Math.PI*2;
      const strip = mk(new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI*0.6, 0, Math.PI/2), stdMat({color:0xE8D528, roughness:0.4}));
      strip.position.set(Math.cos(a)*1.2, PLH+0.1, Math.sin(a)*1.2); strip.rotation.y = a + Math.PI/2;
      strip.scale.set(2, 0.5, 2); strip.castShadow = true; g.add(strip);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i/6)*Math.PI*2;
      const win = mk(new THREE.CircleGeometry(0.18, 16), stdMat({color:0x4A6FA8, roughness:0.2, metalness:0.3, emissive:0xA8C8F8, emissiveIntensity:0.1}));
      win.position.set(Math.cos(a)*bw/2*0.9, PLH+bh*0.5, Math.sin(a)*bd/2*0.9);
      win.lookAt(Math.cos(a)*bw, PLH+bh*0.5, Math.sin(a)*bd); g.add(win);
    }
    part(g, new THREE.BoxGeometry(0.6, 0.8, 0.06), {color:0x8A5A00, roughness:0.6, tex:'wood', rx:1, ry:1}, [0, PLH+0.4, bd/2+0.02], false);
    part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, PLH+0.05, 0], false);
    g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY: PLH+bh+0.4+1.5+0.5};
  }
  
  // 31 QIPAI — 棋气派 grand chess-themed building
  function buildQipai(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const bw = 6.0, bh = 4.5, bd = 6.0;
    part(g, new THREE.BoxGeometry(bw+1.0, PLH, bd+1.0), {color:P.BUILDING_BASE, roughness:0.8, tex:'stone', rx:2, ry:2}, [0, PLH/2, 0]);
    const bodyMat = mkBodyMat('stone', 2, 2);
    const body = mk(new THREE.BoxGeometry(bw, bh, bd), bodyMat);
    body.position.y = PLH + bh/2 + 0.012; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const top = PLH + bh;
    part(g, new THREE.BoxGeometry(bw+0.3, 0.3, bd+0.3), {color:P.ROOF_RIM, roughness:0.4, tex:'rooftile', rx:3, ry:3}, [0, top+0.15, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i/12)*Math.PI*2;
      part(g, new THREE.BoxGeometry(0.4, 0.25, 0.4), {color:P.ROOF_RIM, roughness:0.4, tex:'rooftile', rx:1, ry:1}, [Math.cos(a)*(bw/2+0.15), top+0.3, Math.sin(a)*(bd/2+0.15)], false);
    }
    // King statue
    const kingG = new THREE.Group();
    part(kingG, new THREE.CylinderGeometry(0.35, 0.4, 0.15, 16), {color:0x2A2A2E, roughness:0.3, metalness:0.4}, [0, 0.075, 0]);
    part(kingG, new THREE.CylinderGeometry(0.22, 0.32, 1.2, 16), {color:0x2A2A2E, roughness:0.3, metalness:0.4}, [0, 0.15+0.6, 0]);
    part(kingG, new THREE.CylinderGeometry(0.3, 0.25, 0.12, 16), {color:0x2A2A2E, roughness:0.3, metalness:0.4}, [0, 0.15+1.2+0.06, 0]);
    part(kingG, new THREE.CylinderGeometry(0.18, 0.2, 0.35, 16), {color:0x2A2A2E, roughness:0.3, metalness:0.4}, [0, 0.15+1.2+0.12+0.175, 0]);
    part(kingG, new THREE.SphereGeometry(0.15, 12, 8), {color:0xE8A838, roughness:0.2, metalness:0.5, emissive:0xE8A838, emissiveIntensity:0.1}, [0, 0.15+1.2+0.12+0.35+0.15, 0], false);
    kingG.position.set(-bw/2-0.8, 0, bd/2+0.3);
    kingG.traverse((c: THREE.Object3D) => { if ('isMesh' in c && c.isMesh) c.castShadow = true; });
    g.add(kingG);
    // Queen statue
    const queenG = new THREE.Group();
    part(queenG, new THREE.CylinderGeometry(0.35, 0.4, 0.15, 16), {color:0xF8F7F5, roughness:0.3, metalness:0.4}, [0, 0.075, 0]);
    part(queenG, new THREE.CylinderGeometry(0.22, 0.32, 1.2, 16), {color:0xF8F7F5, roughness:0.3, metalness:0.4}, [0, 0.15+0.6, 0]);
    part(queenG, new THREE.CylinderGeometry(0.28, 0.25, 0.12, 16), {color:0xF8F7F5, roughness:0.3, metalness:0.4}, [0, 0.15+1.2+0.06, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i/5)*Math.PI*2 - Math.PI/2;
      part(queenG, new THREE.ConeGeometry(0.06, 0.2, 6), {color:0xF8F7F5, roughness:0.3, metalness:0.4}, [Math.cos(a)*0.18, 0.15+1.2+0.12+0.1, Math.sin(a)*0.18], false);
    }
    queenG.position.set(bw/2+0.8, 0, bd/2+0.3);
    queenG.traverse((c: THREE.Object3D) => { if ('isMesh' in c && c.isMesh) c.castShadow = true; });
    g.add(queenG);
    // Grand entrance
    part(g, new THREE.BoxGeometry(1.8, 0.1, 0.1), {color:P.ROOF_RIM, roughness:0.4, tex:'stone', rx:1, ry:1}, [0, PLH+1.8, bd/2+0.02], false);
    part(g, new THREE.BoxGeometry(0.3, 1.8, 0.1), {color:0x2A2A2E, roughness:0.3, tex:'stone', rx:1, ry:1}, [-0.9, PLH+0.9, bd/2+0.02], false);
    part(g, new THREE.BoxGeometry(0.3, 1.8, 0.1), {color:0x2A2A2E, roughness:0.3, tex:'stone', rx:1, ry:1}, [0.9, PLH+0.9, bd/2+0.02], false);
    // Checker floor
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cw = 0.4, cx = -1.5 + c*cw + cw/2, cz = bd/2 + 0.3 + r*cw + cw/2;
      part(g, new THREE.BoxGeometry(cw-0.02, 0.02, cw-0.02), {color:(r+c)%2===0?0x2A2A2E:0xF8F7F5, roughness:0.3}, [cx, PLH+0.035, cz], false);
    }
    part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, PLH+0.05, 0], false);
    g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY: top+0.3+0.25+0.5};
  }

  // Neighborhood landmarks: a broadcast tower, takeaway restaurant, and tavern.
  function buildTelevisionTower(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const baseY = 0.22;
    part(g, new THREE.CylinderGeometry(2.15, 2.35, baseY, 32), {color:0xc8d0d4, roughness:0.72, tex:'stone', rx:2, ry:2}, [0, baseY / 2, 0]);
    const bodyMat = stdMat({color:0xdce7ec, roughness:0.28, metalness:0.24, tex:'metal', rx:1, ry:4});
    bodyMat.emissive = new THREE.Color(0x8aaed0); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.CylinderGeometry(0.38, 0.74, 5.25, 16), bodyMat);
    body.position.y = baseY + 2.625 + 0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const deckY = baseY + 3.25;
    part(g, new THREE.CylinderGeometry(1.33, 1.33, 0.16, 24), {color:0x4f6570, roughness:0.38, metalness:0.42, tex:'metal', rx:2, ry:1}, [0, deckY, 0]);
    part(g, new THREE.CylinderGeometry(1.05, 1.1, 0.55, 24), {color:0x9fc6df, roughness:0.12, metalness:0.38, tex:'glass', rx:2, ry:1, emissive:0x6a9fc8, emissiveIntensity:0.08}, [0, deckY + 0.34, 0]);
    part(g, new THREE.CylinderGeometry(1.17, 1.17, 0.12, 24), {color:0x3f5560, roughness:0.35, metalness:0.48, tex:'metal', rx:2, ry:1}, [0, deckY + 0.67, 0]);
    const antennaBase = baseY + 5.25;
    part(g, new THREE.CylinderGeometry(0.12, 0.24, 1.55, 12), {color:0x607985, roughness:0.28, metalness:0.65, tex:'metal', rx:1, ry:2}, [0, antennaBase + 0.775, 0]);
    part(g, new THREE.ConeGeometry(0.12, 0.62, 10), {color:0xe5eef2, roughness:0.2, metalness:0.55, tex:'metal', rx:1, ry:1}, [0, antennaBase + 1.55 + 0.31, 0]);
    [-1, 1].forEach((side) => {
      const dish = part(g, new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), {color:0xe1e9ec, roughness:0.2, metalness:0.52, tex:'metal', rx:1, ry:1}, [side * 0.66, antennaBase + 0.42, 0]);
      dish.rotation.z = side * Math.PI / 2;
      part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), {color:0x455a64, roughness:0.34, metalness:0.5, tex:'metal', rx:1, ry:1}, [side * 0.9, antennaBase + 0.42, 0]).rotation.z = side * Math.PI / 2;
    });
    part(g, new THREE.SphereGeometry(0.1, 12, 12), {color:0xe85858, emissive:0xe85858, emissiveIntensity:0.5, roughness:0.18}, [0, antennaBase + 2.18, 0], false);
    part(g, new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, baseY + 0.05, 0], false);
    g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:antennaBase + 2.7};
  }

  function buildFriedChickenShop(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const width = 3.25, depth = 2.35, height = 1.52, baseY = 0.2;
    part(g, new THREE.BoxGeometry(width + 0.55, baseY, depth + 0.55), {color:0xd6c9b9, roughness:0.82, tex:'pavement', rx:2, ry:2}, [0, baseY / 2, 0]);
    const bodyMat = stdMat({color:0xe95e3f, roughness:0.42, tex:'wall', rx:2, ry:1});
    bodyMat.emissive = new THREE.Color(0xc83f2d); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(width, height, depth), bodyMat);
    body.position.y = baseY + height / 2 + 0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = baseY + height;
    part(g, new THREE.BoxGeometry(width + 0.24, 0.16, depth + 0.24), {color:0xf1c54a, roughness:0.38, tex:'metal', rx:2, ry:2}, [0, top + 0.08, 0]);
    const glass = {color:0x9ac7dc, emissive:0x5b92bd, emissiveIntensity:0.08, roughness:0.14, metalness:0.25, tex:'glass', rx:1, ry:1};
    [-0.92, 0.92].forEach((x) => part(g, new THREE.BoxGeometry(0.64, 0.66, 0.035), glass, [x, baseY + 0.88, depth / 2 + 0.022], false));
    part(g, new THREE.BoxGeometry(0.5, 1.05, 0.04), {color:0x394d55, roughness:0.35, tex:'metal', rx:1, ry:1}, [0, baseY + 0.525, depth / 2 + 0.025], false);
    for (let index = 0; index < 7; index += 1) {
      part(g, new THREE.BoxGeometry(0.42, 0.18, 0.42), {color:index % 2 ? 0xf7e7bd : 0xd64032, roughness:0.66, tex:'fabric', rx:1, ry:1}, [-1.26 + index * 0.42, top - 0.02, depth / 2 + 0.22], false);
    }
    part(g, new THREE.CylinderGeometry(0.42, 0.5, 0.62, 16), {color:0xf1c54a, roughness:0.4, metalness:0.1, tex:'metal', rx:1, ry:1}, [0, top + 0.45, 0]);
    part(g, new THREE.TorusGeometry(0.25, 0.07, 8, 16), {color:0xd64032, roughness:0.35, tex:'metal', rx:1, ry:1}, [0, top + 0.75, 0], false).rotation.x = Math.PI / 2;
    [-0.18, 0, 0.18].forEach((x) => part(g, new THREE.SphereGeometry(0.095, 10, 8), {color:0xb96e2a, roughness:0.78}, [x, top + 0.75, 0.12], false));
    [-1.3, 1.3].forEach((x) => part(g, new THREE.CylinderGeometry(0.06, 0.08, 1.0, 8), {color:0x4d5d61, roughness:0.45, metalness:0.46, tex:'metal', rx:1, ry:1}, [x, baseY + 0.5, depth / 2 + 0.38], false));
    part(g, new THREE.BoxGeometry(2.75, 0.42, 0.06), {color:0xf4cf5b, emissive:0xf1b93c, emissiveIntensity:0.12, roughness:0.34, tex:'metal', rx:2, ry:1}, [0, top + 0.33, depth / 2 + 0.32], false);
    part(g, new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, baseY + 0.05, 0], false);
    g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top + 1.3};
  }

  function buildTavern(cfg: BuildingDefinition): BuildingEntity {
    const g = new THREE.Group();
    const width = 3.0, depth = 2.55, height = 2.35, baseY = 0.2;
    part(g, new THREE.BoxGeometry(width + 0.62, baseY, depth + 0.62), {color:0xbda68a, roughness:0.86, tex:'stone', rx:2, ry:2}, [0, baseY / 2, 0]);
    const bodyMat = stdMat({color:0x7a5238, roughness:0.63, tex:'residence_wood', rx:2, ry:2});
    bodyMat.emissive = new THREE.Color(0x3d2418); bodyMat.emissiveIntensity = 0;
    const body = mk(new THREE.BoxGeometry(width, height, depth), bodyMat);
    body.position.y = baseY + height / 2 + 0.012; body.castShadow = body.receiveShadow = true; g.add(body);
    const top = baseY + height;
    const roof = part(g, new THREE.ConeGeometry(2.22, 1.08, 4), {color:0x36534e, roughness:0.54, tex:'residence_tile', rx:2, ry:1}, [0, top + 0.54, 0]);
    roof.rotation.y = Math.PI / 4;
    [-1.16, 0, 1.16].forEach((x) => part(g, new THREE.BoxGeometry(0.12, height + 0.04, 0.08), {color:0x3d2b21, roughness:0.78, tex:'wood', rx:1, ry:2}, [x, baseY + height / 2, depth / 2 + 0.045], false));
    part(g, new THREE.BoxGeometry(width + 0.08, 0.11, 0.1), {color:0x3d2b21, roughness:0.78, tex:'wood', rx:2, ry:1}, [0, baseY + 1.2, depth / 2 + 0.05], false);
    const windowMat = {color:0xe0a451, emissive:0xd78535, emissiveIntensity:0.28, roughness:0.2, tex:'glass', rx:1, ry:1};
    [-0.78, 0.78].forEach((x) => part(g, new THREE.BoxGeometry(0.44, 0.52, 0.035), windowMat, [x, baseY + 0.73, depth / 2 + 0.06], false));
    part(g, new THREE.BoxGeometry(0.52, 1.05, 0.05), {color:0x2e453f, roughness:0.72, tex:'wood', rx:1, ry:1}, [0, baseY + 0.525, depth / 2 + 0.065], false);
    part(g, new THREE.BoxGeometry(1.08, 0.16, 0.62), {color:0x7a2530, roughness:0.7, tex:'fabric', rx:2, ry:1}, [0, baseY + 1.34, depth / 2 + 0.31], false);
    part(g, new THREE.BoxGeometry(0.17, 1.02, 0.17), {color:0x795445, roughness:0.8, tex:'brick', rx:1, ry:1}, [width * 0.3, top + 0.42, -depth * 0.18]);
    part(g, new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16), {color:0x3d2b21, roughness:0.75, tex:'wood', rx:1, ry:1}, [-width / 2 - 0.25, baseY + 0.35, depth / 2 + 0.1], false);
    part(g, new THREE.CylinderGeometry(0.34, 0.34, 0.4, 16), {color:0x93633f, roughness:0.82, tex:'wood', rx:1, ry:1}, [-width / 2 - 0.25, baseY + 0.6, depth / 2 + 0.1], false);
    part(g, new THREE.TorusGeometry(0.35, 0.035, 6, 14), {color:0x4b3526, roughness:0.6, tex:'metal', rx:1, ry:1}, [-width / 2 - 0.25, baseY + 0.58, depth / 2 + 0.1], false).rotation.x = Math.PI / 2;
    part(g, new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, baseY + 0.05, 0], false);
    g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
    return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top + 1.85};
  }

  const builders = {
    bank: buildBank, board: buildBoard, tower: buildTower, darktower: buildDarkTower,
    pavilion: buildPavilion, library: buildLibrary, ruins: buildRuins,
    skyscraper: buildSkyscraper, campus: buildCampus, kiosk: buildKiosk,
    screen: buildScreen, shaft: buildShaft, altar: buildAltar, observatory: buildObservatory,
    pagoda: buildPagoda, market: buildMarket, greenhouse: buildGreenhouse,
    clocktower: buildClockTower, temple: buildTemple, factory: buildFactory,
    mall: buildMall, school: buildSchool, academy: buildAcademy, crown: buildCrown,
    banana: buildBanana, qipai: buildQipai,
    television_tower: buildTelevisionTower, fried_chicken_shop: buildFriedChickenShop, tavern: buildTavern,
    restaurant: (cfg: BuildingDefinition) => buildWushiRestaurant({ platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }, cfg),
    wild_mushroom_restaurant: (cfg: BuildingDefinition) => buildWildMushroomRestaurant({ platformHeight: PLH, makeMaterial: stdMat, makeMesh: mk, addPart: part }, cfg),
    film_city: buildFilmCity,
  };

  return { builders };
}

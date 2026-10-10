import * as THREE from 'three';
import { ICE_KING_BUILDING_ID } from '../gameplay/content/stories/iceKing/iceKingContent';
import { drawIceKingCrownFacade } from './iceKing/crownFacadeTexture';
import type { ResourcePool } from '../core/ResourcePool';
import { applyNoiseLattice } from './textureNoise';
import { registerFacadePainters } from './proceduralFacadePainters';
import groundCityColor from '../assets/textures/ground_city_color.webp';
import groundDistrictColor from '../assets/textures/ground_district_color.webp';
import groundGrassColor from '../assets/textures/ground_grass_color.webp';
import asphaltColor from '../assets/textures/road_asphalt_color.webp';
import pavementColor from '../assets/textures/road_pavement_color.webp';
import wallPlasterColor from '../assets/textures/wall_plaster_color.webp';
import stoneLightColor from '../assets/textures/stone_light_color.webp';
import brickWarmColor from '../assets/textures/brick_warm_color.webp';
import woodColor from '../assets/textures/wood_color.webp';
import metalColor from '../assets/textures/metal_color.webp';
import roofTileColor from '../assets/textures/rooftile_color.webp';
import shingleColor from '../assets/textures/residence_shingle_color.webp';
import wetAsphaltColor from '../assets/textures/road_asphalt_wet_color.webp';
import snowGroundColor from '../assets/textures/snow_ground_color.webp';
import snowRoofColor from '../assets/textures/snow_roof_color.webp';
import sandColor from '../assets/textures/sand_color.webp';
import mossGroundColor from '../assets/textures/ground_moss_color.webp';
import concreteWornColor from '../assets/textures/concrete_worn_color.webp';
import redBrickColor from '../assets/textures/brick_red_color.webp';
import puddleAsphaltColor from '../assets/textures/puddle_asphalt_color.webp';
import type { Weather } from '../city/weather';
import { weatherTextureKey } from './weatherTextureVariants';
import { isTextureResourceAvailable } from '../city/textureResourcePreloader';

type Canvas2D = CanvasRenderingContext2D;
type DrawFn = (ctx: Canvas2D, size: number) => void;
type RGB = [number, number, number];

const GENERATED_FACADES = import.meta.glob('../assets/textures/facade_*_color.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const GENERATED_WEATHER_TEXTURES = import.meta.glob('../assets/textures/{residence_*,road_*}_color.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

/** Canvas fallbacks for generated facade keys used by the canvas (low-preset) path. */
const FACADE_CANVAS_FALLBACK: Record<string, string> = {
  facade_bank_plaster: 'wall', facade_utility_concrete: 'concrete_worn', facade_tower_glass: 'glass', facade_darktower_glass: 'glass', facade_temple_stone: 'stone', facade_library_stone: 'stone', facade_ruin_stone: 'stone', facade_school_cream: 'wall', facade_kiosk_woodglass: 'wood', facade_observatory_concrete: 'concrete_worn', facade_market_awning: 'wall', facade_greenhouse_glass: 'glass', facade_clocktower_brick: 'brick', facade_factory_brick: 'brick', facade_community_brick: 'brick',
  facade_residence_cream: 'residence_plaster',
  residence_cream: 'residence_plaster',
  residence_redbrick: 'brick',
  residence_bluepanel: 'residence_panel',
  residence_palestone: 'stone',
  residence_clapboard: 'residence_panel',
  residence_mossplaster: 'residence_plaster',
  residence_terracotta_roof: 'rooftile',
  residence_slate_roof: 'residence_shingle',
  residence_green_roof: 'residence_tile',
  facade_residence_bluepanel: 'residence_panel',
  facade_residence_stone: 'stone',
  facade_residence_darkwood: 'residence_wood',
  facade_residence_moss: 'residence_tile',
};

const GENERATED_TEXTURES: Record<string, string> = {
  ground6: groundCityColor,
  ground2: groundDistrictColor,
  ground4: groundGrassColor,
  ground5: groundDistrictColor,
  asphalt: asphaltColor,
  road: asphaltColor,
  pavement: pavementColor,
  wall: wallPlasterColor,
  residence_plaster: wallPlasterColor,
  stone: stoneLightColor,
  brick: brickWarmColor,
  academybrick: brickWarmColor,
  wood: woodColor,
  residence_wood: woodColor,
  metal: metalColor,
  rooftile: roofTileColor,
  residence_tile: roofTileColor,
  residence_shingle: shingleColor,
  ground: sandColor,
  moss_ground: mossGroundColor,
  concrete_worn: concreteWornColor,
  brick_red: redBrickColor,
  puddle_asphalt: puddleAsphaltColor,
  facade_residence_cream: GENERATED_FACADES['../assets/textures/facade_residence_cream_color.webp'] ?? '',
  facade_residence_bluepanel: GENERATED_FACADES['../assets/textures/facade_residence_bluepanel_color.webp'] ?? '',
  facade_residence_stone: GENERATED_FACADES['../assets/textures/facade_residence_stone_color.webp'] ?? '',
  facade_residence_darkwood: GENERATED_FACADES['../assets/textures/facade_residence_darkwood_color.webp'] ?? '',
  facade_residence_moss: GENERATED_FACADES['../assets/textures/facade_residence_moss_color.webp'] ?? '',
};

export function createProceduralTextureLibrary(
  resources: ResourcePool,
  getRenderer: () => THREE.WebGLRenderer | null | undefined,
  getAnisotropy: () => number,
  getWeather: () => Weather,
  getTextureRendering: () => boolean,
) {
  const facadeMaterials = new Set<THREE.MeshStandardMaterial>();
  const _texCanvases: Record<string, HTMLCanvasElement> = {};
  // Painter registry — registerPainters() fills this once with pure closures;
  // execution happens either synchronously in initTextures() or in slices via
  // preGenerateTextures() (see below).
  const painterQueue: { key: string; size: number; draw: DrawFn }[] = [];
  function _paint(key: string, size: number, draw: DrawFn) {
    painterQueue.push({ key, size, draw });
  }
  function _canvas(key: string, size: number, drawFn: DrawFn) {
    if (!_texCanvases[key]) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      // willReadFrequently: the grain pass round-trips pixels via getImageData; a
      // GPU-backed 2D context turns every read into a sync readback (~10ms+
      // each, 62 painters). A CPU-backed context makes it a memcpy.
      drawFn(c.getContext('2d', { willReadFrequently: true })!, size);
      _texCanvases[key] = c;
    }
    return _texCanvases[key];
  }
  function _tex(key: string, rx = 1, ry = 1) {
    const weather = getWeather();
    const generatedKey = weatherTextureKey(key, weather);
    const generatedSource = GENERATED_TEXTURES[generatedKey]
      ?? GENERATED_WEATHER_TEXTURES[`../assets/textures/${generatedKey}_color.webp`]
      ?? (generatedKey === 'wet_asphalt' ? puddleAsphaltColor
        : generatedKey === 'snow_ground' ? snowGroundColor
          : generatedKey === 'snow_roof' ? snowRoofColor
            : undefined);
    if (getTextureRendering() && generatedSource && isTextureResourceAvailable(generatedSource)) {
      return resources.texture(`generated:repeat:${generatedKey}:${rx || 1}:${ry || 1}`, () => {
        const t = new THREE.TextureLoader().load(generatedSource);
        t.name = `generated_${generatedKey}`;
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        const renderer = getRenderer();
        t.anisotropy = renderer ? Math.min(renderer.capabilities.getMaxAnisotropy(), getAnisotropy()) : 1;
        t.repeat.set(rx || 1, ry || 1);
        return t;
      });
    }
    const canvasKey = _texCanvases[generatedKey]
      ? generatedKey
      : (FACADE_CANVAS_FALLBACK[key] && _texCanvases[FACADE_CANVAS_FALLBACK[key]])
        ? FACADE_CANVAS_FALLBACK[key]
        : key;
    const c = _texCanvases[canvasKey];
    if (!c) return null;
    const repeatX = rx || 1, repeatY = ry || 1;
    return resources.texture(`repeat:${canvasKey}:${key}:${repeatX}:${repeatY}`, () => {
      const t = new THREE.CanvasTexture(c);
      t.name = canvasKey;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      const renderer = getRenderer();
      t.anisotropy = renderer ? Math.min(renderer.capabilities.getMaxAnisotropy(), getAnisotropy()) : 1;
      t.repeat.set(repeatX, repeatY);
      return t;
    });
  }
  function _texClamp(key: string) {
    const facadeSource = GENERATED_FACADES[`../assets/textures/${key}_color.webp`];
    if (getTextureRendering() && facadeSource && isTextureResourceAvailable(facadeSource)) {
      return resources.texture(`generated:clamp:${key}`, () => {
        const texture = new THREE.TextureLoader().load(facadeSource);
        texture.name = `generated_${key}`;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        const renderer = getRenderer();
        texture.anisotropy = renderer ? Math.min(renderer.capabilities.getMaxAnisotropy(), getAnisotropy()) : 1;
        return texture;
      });
    }
    const canvasKey = FACADE_CANVAS_FALLBACK[key] ?? key;
    const c = _texCanvases[canvasKey];
    if (!c) return null;
    return resources.texture(`clamp:${key}`, () => {
      const t = new THREE.CanvasTexture(c);
      t.name = canvasKey;
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      const renderer = getRenderer();
      t.anisotropy = renderer ? Math.min(renderer.capabilities.getMaxAnisotropy(), getAnisotropy()) : 1;
      return t;
    });
  }
  function addFacade(g: THREE.Group, texKey: string, w: number, h: number, y: number, zOffset: number, rotY = 0) {
    const t = _texClamp(texKey);
    if (!t) return null;
    const mat = resources.material({ kind:'facade', texKey }, () =>
      new THREE.MeshStandardMaterial({ map: t, roughness: 0.65, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    facadeMaterials.add(mat);
    mat.name = `generated_${texKey}`;
    mat.userData.weatherBaseColor = mat.color.clone();
    mat.userData.weatherBaseRoughness = mat.roughness;
    mat.userData.weatherBaseMetalness = mat.metalness;
    const facade = new THREE.Mesh(resources.geometry(new THREE.PlaneGeometry(w, h)), mat);
    facade.position.set(0, y, zOffset);
    if (rotY) facade.rotation.y = rotY;
    facade.castShadow = true; facade.receiveShadow = true;
    g.add(facade);
    return facade;
  }

  function refreshWeather(): void {
    const weather = getWeather();
    for (const material of facadeMaterials) {
      const key = material.name.replace(/^generated_/, '');
      const texture = _texClamp(key);
      if (texture) material.map = texture;
      const baseColor = (material.userData.weatherBaseColor as THREE.Color | undefined)?.clone() ?? new THREE.Color(0xffffff);
      const baseRoughness = Number(material.userData.weatherBaseRoughness ?? 0.65);
      const baseMetalness = Number(material.userData.weatherBaseMetalness ?? 0.05);
      material.color.copy(baseColor);
      material.roughness = baseRoughness;
      material.metalness = baseMetalness;
      if (weather === 'rain') {
        material.roughness = Math.min(baseRoughness, 0.24);
        material.metalness = Math.max(baseMetalness, 0.08);
        material.color.multiplyScalar(0.78);
      } else if (weather === 'snow' || weather === 'snow-deep') {
        material.roughness = Math.max(baseRoughness, 0.85);
        material.metalness = Math.min(baseMetalness, 0.02);
        material.color.multiplyScalar(1.12);
      }
      material.needsUpdate = true;
    }
  }
  function _shade(base: RGB, s: number) {
    return `rgb(${Math.floor(base[0]*s)},${Math.floor(base[1]*s)},${Math.floor(base[2]*s)})`;
  }
  const TEX: { skyDay: THREE.Texture | null; skyNight: THREE.Texture | null } = { skyDay: null, skyNight: null };
  function registerPainters() {
    // --- Wall: cream facade with window grid ---
    _paint('wall', 512, (ctx, s) => {
      ctx.fillStyle = '#EFEDE8'; ctx.fillRect(0, 0, s, s);
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, 'rgba(255,255,255,0.12)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.02)');
      g.addColorStop(1, 'rgba(0,0,0,0.06)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      const cols = 4, rows = 4, pad = 14;
      const wW = (s - pad*(cols+1))/cols, wH = (s - pad*(rows+1))/rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = pad + c*(wW+pad), y = pad + r*(wH+pad);
          ctx.fillStyle = '#D5D4CF'; ctx.fillRect(x-3, y+wH, wW+6, 4); // sill
          ctx.fillStyle = '#C8C7C2'; ctx.fillRect(x-1.5, y-1.5, wW+3, wH+3); // frame
          const wg = ctx.createLinearGradient(x, y, x+wW, y+wH);
          wg.addColorStop(0, '#C5DEF8'); wg.addColorStop(0.5, '#A8C8F0'); wg.addColorStop(1, '#90B8E0');
          ctx.fillStyle = wg; ctx.fillRect(x, y, wW, wH);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+wW*0.4, y); ctx.lineTo(x, y+wH*0.4); ctx.fill();
          ctx.fillStyle = 'rgba(180,180,175,0.5)';
          ctx.fillRect(x+wW/2-0.5, y, 1, wH); ctx.fillRect(x, y+wH/2-0.5, wW, 1);
        }
      }
      applyNoiseLattice(ctx, s, 0.025);
    });
  
    // --- Stone: cut stone blocks ---
    _paint('stone', 512, (ctx, s) => {
      ctx.fillStyle = '#F0EFEC'; ctx.fillRect(0, 0, s, s);
      const bh = 64, bw = 128;
      for (let y = 0; y < s; y += bh) {
        const off = ((y/bh)%2)*(bw/2);
        for (let x = -bw; x < s + bw; x += bw) {
          const bx = x + off, sh = 0.92 + Math.random()*0.08;
          ctx.fillStyle = _shade([240,239,236], sh);
          ctx.fillRect(bx, y, bw-2, bh-2);
          ctx.fillStyle = 'rgba(0,0,0,0.02)';
          for (let i = 0; i < 3; i++) ctx.fillRect(bx+Math.random()*bw, y+Math.random()*bh, 2, 2);
          ctx.fillStyle = '#C8C7C2';
          ctx.fillRect(bx+bw-2, y, 2, bh); ctx.fillRect(bx, y+bh-2, bw, 2);
        }
      }
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- Brick: running bond ---
    _paint('brick', 512, (ctx, s) => {
      ctx.fillStyle = '#E8E0D5'; ctx.fillRect(0, 0, s, s);
      const bh = 24, bw = 60;
      for (let y = 0; y < s; y += bh) {
        const off = ((y/bh)%2)*(bw/2);
        for (let x = -bw; x < s + bw; x += bw) {
          const bx = x + off;
          const r = 190+Math.floor(Math.random()*30), g = 175+Math.floor(Math.random()*25), b = 160+Math.floor(Math.random()*25);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(bx+1, y+1, bw-3, bh-3);
          ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx+1, y+1, bw-3, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(bx+1, y+bh-3, bw-3, 2);
        }
      }
      applyNoiseLattice(ctx, s, 0.02);
    });

    _paint('academybrick', 512, (ctx, s) => {
      ctx.fillStyle = '#C28B68'; ctx.fillRect(0, 0, s, s);
      const bh = 28, bw = 72;
      for (let y = 0; y < s; y += bh) {
        const offset = ((y / bh) % 2) * (bw / 2);
        for (let x = -bw; x < s + bw; x += bw) {
          const bx = x + offset;
          ctx.fillStyle = `rgb(${170 + Math.floor(Math.random() * 24)},${112 + Math.floor(Math.random() * 22)},${82 + Math.floor(Math.random() * 18)})`;
          ctx.fillRect(bx + 1, y + 1, bw - 3, bh - 3);
          ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx + 1, y + 1, bw - 3, 2);
          ctx.fillStyle = 'rgba(60,30,20,0.08)'; ctx.fillRect(bx + 1, y + bh - 3, bw - 3, 2);
        }
      }
      applyNoiseLattice(ctx, s, 0.02);
    });
  
    // --- Glass: skyscraper facade ---
    _paint('glass', 512, (ctx, s) => {
      ctx.fillStyle = '#D0DDED'; ctx.fillRect(0, 0, s, s);
      const floors = 8, fh = s/floors;
      for (let f = 0; f < floors; f++) {
        const y = f*fh;
        ctx.fillStyle = '#D8D7D2'; ctx.fillRect(0, y, s, 4);
        const panels = 4, pw = s/panels;
        for (let p = 0; p < panels; p++) {
          const x = p*pw, t = (f+p)%2;
          const gr = ctx.createLinearGradient(x, y+4, x+pw, y+fh-4);
          if (t===0) { gr.addColorStop(0,'#B8D0F0'); gr.addColorStop(0.5,'#A0BCDF'); gr.addColorStop(1,'#88A5CF'); }
          else { gr.addColorStop(0,'#C5DBF5'); gr.addColorStop(0.5,'#A8C5E8'); gr.addColorStop(1,'#90B0D8'); }
          ctx.fillStyle = gr; ctx.fillRect(x+2, y+4, pw-4, fh-8);
          ctx.fillStyle = 'rgba(120,130,140,0.3)'; ctx.fillRect(x, y+4, 1, fh-8);
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x+2, y+4, pw-4, (fh-8)*0.3);
        }
      }
      applyNoiseLattice(ctx, s, 0.015);
    });
  
    // --- Dark wall: dark metal/stone ---
    _paint('darkwall', 512, (ctx, s) => {
      ctx.fillStyle = '#3A3A3E'; ctx.fillRect(0, 0, s, s);
      const ps = 128;
      for (let y = 0; y < s; y += ps) {
        for (let x = 0; x < s; x += ps) {
          const sh = 0.85+Math.random()*0.3;
          ctx.fillStyle = `rgba(${Math.floor(60*sh)},${Math.floor(60*sh)},${Math.floor(68*sh)},1)`;
          ctx.fillRect(x, y, ps-2, ps-2);
          ctx.fillStyle = 'rgba(100,100,110,0.4)';
          ctx.fillRect(x+ps-2, y, 2, ps); ctx.fillRect(x, y+ps-2, ps, 2);
        }
      }
      for (let i = 0; i < 6; i++) {
        const x = Math.random()*s, y = Math.random()*s, r = 20+Math.random()*30;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(107,79,232,0.15)'); g.addColorStop(1, 'rgba(107,79,232,0)');
        ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2);
      }
      applyNoiseLattice(ctx, s, 0.04);
    });
  
    // --- Ruin: weathered stone ---
    _paint('ruin', 512, (ctx, s) => {
      ctx.fillStyle = '#B5B2AC'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 48) {
        const off = Math.random()*24;
        for (let x = -60; x < s+60; x += 60+Math.random()*20) {
          const bx = x+off, bw = 50+Math.random()*20, sh = 0.75+Math.random()*0.35;
          ctx.fillStyle = _shade([181,178,172], sh);
          ctx.fillRect(bx, y, bw, 46);
          if (Math.random() > 0.5) {
            ctx.strokeStyle = 'rgba(60,55,50,0.3)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx+Math.random()*bw, y); ctx.lineTo(bx+Math.random()*bw, y+46); ctx.stroke();
          }
        }
      }
      for (let i = 0; i < 8; i++) {
        const x = Math.random()*s, y = Math.random()*s, r = 15+Math.random()*25;
        ctx.fillStyle = 'rgba(120,130,90,0.2)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      }
      applyNoiseLattice(ctx, s, 0.05);
    });
  
    // --- Wood: plank grain ---
    _paint('wood', 512, (ctx, s) => {
      ctx.fillStyle = '#C4A86D'; ctx.fillRect(0, 0, s, s);
      const pw = 64;
      for (let x = 0; x < s; x += pw) {
        const sh = 0.88+Math.random()*0.24;
        ctx.fillStyle = _shade([196,168,109], sh);
        ctx.fillRect(x, 0, pw-2, s);
        ctx.strokeStyle = 'rgba(120,90,50,0.15)'; ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const y = Math.random()*s;
          ctx.beginPath(); ctx.moveTo(x+2, y);
          ctx.bezierCurveTo(x+pw/3, y+(Math.random()-0.5)*10, x+2*pw/3, y+(Math.random()-0.5)*10, x+pw-2, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(80,60,30,0.3)'; ctx.fillRect(x+pw-2, 0, 2, s);
      }
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- Metal: brushed ---
    _paint('metal', 512, (ctx, s) => {
      ctx.fillStyle = '#D8D7D2'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 200; i++) {
        const y = Math.random()*s, a = 0.05+Math.random()*0.1;
        ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, y, s, 1);
      }
      const ps = 128;
      ctx.strokeStyle = 'rgba(100,100,100,0.3)'; ctx.lineWidth = 2;
      for (let x = ps; x < s; x += ps) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
      for (let y = ps; y < s; y += ps) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
      applyNoiseLattice(ctx, s, 0.02);
    });
  
    // --- Roof tile: shingles ---
    _paint('rooftile', 256, (ctx, s) => {
      ctx.fillStyle = '#E8E7E2'; ctx.fillRect(0, 0, s, s);
      const tr = 16;
      for (let y = 0; y < s; y += tr) {
        const off = ((y/tr)%2)*(tr/2);
        for (let x = -tr; x < s+tr; x += tr) {
          const bx = x+off, sh = 0.88+Math.random()*0.2;
          ctx.fillStyle = _shade([232,231,226], sh);
          ctx.beginPath(); ctx.arc(bx+tr/2, y+tr, tr/2-1, Math.PI, 0); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(bx, y+tr-2, tr, 2);
        }
      }
      applyNoiseLattice(ctx, s, 0.025);
    });
  
    // --- Ground: grass + dirt ---
    _paint('ground', 256, (ctx, s) => {
      ctx.fillStyle = '#F2F1EE'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 300; i++) {
        const x = Math.random()*s, y = Math.random()*s, r = 0.5+Math.random()*1.5;
        const sh = Math.random();
        if (sh < 0.3) ctx.fillStyle = 'rgba(180,190,160,0.5)';
        else if (sh < 0.6) ctx.fillStyle = 'rgba(160,170,150,0.4)';
        else ctx.fillStyle = 'rgba(200,195,185,0.4)';
        ctx.fillRect(x, y, r*2, r*2);
      }
      for (let i = 0; i < 20; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = ['rgba(200,180,200,0.4)','rgba(220,200,160,0.4)','rgba(180,200,220,0.3)'][i%3]!;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      applyNoiseLattice(ctx, s, 0.025);
    });
  
    // --- Road: cobblestone ---
    _paint('road', 256, (ctx, s) => {
      ctx.fillStyle = '#E8E7E4'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 32) {
        for (let x = 0; x < s; x += 32) {
          const sh = 0.88+Math.random()*0.2;
          ctx.fillStyle = _shade([232,231,228], sh);
          ctx.fillRect(x+Math.random()*4, y+Math.random()*4, 28-Math.random()*4, 28-Math.random()*4);
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(x, y+26, 32, 2); ctx.fillRect(x+26, y, 2, 32);
        }
      }
      applyNoiseLattice(ctx, s, 0.035);
    });
  
    // --- Plaza: radial pattern ---
    _paint('plaza', 256, (ctx, s) => {
      ctx.fillStyle = '#E8E7E4'; ctx.fillRect(0, 0, s, s);
      const cx = s/2, cy = s/2;
      for (let r = 30; r < s/2; r += 24) {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- Sky day ---
    _paint('skyDay', 256, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#F9F8F6'); g.addColorStop(0.6, '#F5F4F0'); g.addColorStop(1, '#ECEBE6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 12; i++) {
        const x = Math.random()*s, y = Math.random()*s*0.4, r = 20+Math.random()*40;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      }
      applyNoiseLattice(ctx, s, 0.015);
    });
  
    // --- Sky night ---
    _paint('skyNight', 256, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#D4D3CE'); g.addColorStop(0.6, '#C8C7C2'); g.addColorStop(1, '#BCBBB6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      applyNoiseLattice(ctx, s, 0.02);
    });
  
  
    // --- Grass: lush green ---
    _paint('grass', 256, (ctx, s) => {
      ctx.fillStyle = '#C8D8A8'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 500; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        const sh = 0.7 + Math.random()*0.5;
        ctx.fillStyle = `rgba(${Math.floor(120*sh)},${Math.floor(160*sh)},${Math.floor(80*sh)},0.6)`;
        ctx.fillRect(x, y, 1, 2+Math.random()*3);
      }
      for (let i = 0; i < 15; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = ['rgba(232,88,88,0.5)','rgba(232,168,56,0.5)','rgba(168,88,232,0.4)'][i%3]!;
        ctx.fillRect(x, y, 2, 2);
      }
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- Water: blue ripples ---
    _paint('water', 256, (ctx, s) => {
      ctx.fillStyle = '#A8C8F0'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 30; i++) {
        ctx.strokeStyle = `rgba(200,220,250,${0.1+Math.random()*0.2})`;
        ctx.lineWidth = 1+Math.random();
        ctx.beginPath();
        const y = Math.random()*s;
        ctx.moveTo(0, y);
        for (let x = 0; x < s; x += 10) ctx.lineTo(x, y + Math.sin(x*0.1)*3);
        ctx.stroke();
      }
      applyNoiseLattice(ctx, s, 0.02);
    });
  
    // --- Fabric: striped awning ---
    _paint('fabric', 128, (ctx, s) => {
      const stripeW = s / 8;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i%2===0 ? '#E8A838' : '#F5F4F1';
        ctx.fillRect(i*stripeW, 0, stripeW, s);
      }
      applyNoiseLattice(ctx, s, 0.02);
    });
  
    // --- Pagoda tile: Asian red-brown curved ---
    _paint('pagoda_tile', 256, (ctx, s) => {
      ctx.fillStyle = '#C45A4A'; ctx.fillRect(0, 0, s, s);
      const tr = 16;
      for (let y = 0; y < s; y += tr) {
        const off = ((y/tr)%2)*(tr/2);
        for (let x = -tr; x < s+tr; x += tr) {
          const bx = x+off, sh = 0.85+Math.random()*0.25;
          ctx.fillStyle = `rgb(${Math.floor(196*sh)},${Math.floor(90*sh)},${Math.floor(74*sh)})`;
          ctx.beginPath(); ctx.arc(bx+tr/2, y+tr, tr/2-1, Math.PI, 0); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(bx, y+tr-2, tr, 2);
        }
      }
      applyNoiseLattice(ctx, s, 0.025);
    });
  
    // --- Asphalt: plain dark road surface (no lane markings in texture) ---
    _paint('asphalt', 256, (ctx, s) => {
      ctx.fillStyle = '#3A3D44'; ctx.fillRect(0, 0, s, s);
      // grain
      for (let i = 0; i < 800; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        const sh = Math.random();
        ctx.fillStyle = sh > 0.5 ? 'rgba(80,82,90,0.4)' : 'rgba(28,30,36,0.4)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      // subtle cracks
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = 'rgba(20,22,28,0.5)'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        const x = Math.random()*s, y = Math.random()*s;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random()-0.5)*40, y + (Math.random()-0.5)*40);
        ctx.stroke();
      }
      applyNoiseLattice(ctx, s, 0.025);
    });

    // --- Wet asphalt: dark rain-slicked road with puddle sheen ---
    _paint('wet_asphalt', 256, (ctx, s) => {
      ctx.fillStyle = '#2E3036'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 800; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        const sh = Math.random();
        ctx.fillStyle = sh > 0.5 ? 'rgba(70,72,82,0.5)' : 'rgba(20,22,28,0.5)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = 'rgba(16,18,24,0.55)'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        const x = Math.random()*s, y = Math.random()*s;
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random()-0.5)*40, y + (Math.random()-0.5)*40);
        ctx.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const x = Math.random()*s, y = Math.random()*s, r = 6 + Math.random()*18;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(150,180,220,0.28)');
        g.addColorStop(0.55, 'rgba(120,150,200,0.14)');
        g.addColorStop(1, 'rgba(120,150,200,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r*2, r*2);
      }
      ctx.fillStyle = 'rgba(200,220,255,0.10)';
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.random()*s, Math.random()*s, 18 + Math.random()*22, 1);
      applyNoiseLattice(ctx, s, 0.02);
    });

    // --- Crosswalk: white stripes on dark for intersections ---
    _paint('crosswalk', 256, (ctx, s) => {
      ctx.fillStyle = '#3A3D44'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 400; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(80,82,90,0.35)' : 'rgba(28,30,36,0.35)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      // white zebra stripes along the length
      const stripeW = 14, stripeH = s * 0.84, gap = 10;
      for (let x = 0; x < s; x += stripeW + gap) {
        ctx.fillStyle = 'rgba(245,245,245,0.92)';
        ctx.fillRect(x, s/2 - stripeH/2, stripeW, stripeH);
      }
      applyNoiseLattice(ctx, s, 0.02);
    });

    // Rotated variant for roads running along the other world axis.
    _paint('crosswalkRotated', 256, (ctx, s) => {
      ctx.fillStyle = '#3A3D44'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 400; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(80,82,90,0.35)' : 'rgba(28,30,36,0.35)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      const stripeW = 14, stripeH = s * 0.84, gap = 10;
      for (let y = 0; y < s; y += stripeW + gap) {
        ctx.fillStyle = 'rgba(245,245,245,0.92)';
        ctx.fillRect(s/2 - stripeH/2, y, stripeH, stripeW);
      }
      applyNoiseLattice(ctx, s, 0.02);
    });
  
    // --- Pavement: sidewalk tiles ---
    _paint('pavement', 256, (ctx, s) => {
      ctx.fillStyle = '#C8C7C2'; ctx.fillRect(0, 0, s, s);
      const t = 32;
      for (let y = 0; y < s; y += t) {
        const off = ((y/t)%2)*(t/2);
        for (let x = -t; x < s+t; x += t) {
          const bx = x + off, sh = 0.92 + Math.random()*0.12;
          ctx.fillStyle = _shade([200,199,194], sh);
          ctx.fillRect(bx+1, y+1, t-2, t-2);
          ctx.fillStyle = 'rgba(140,138,132,0.5)';
          ctx.fillRect(bx, y, t, 1); ctx.fillRect(bx, y, 1, t);
        }
      }
      // a few weather cracks
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = 'rgba(100,98,92,0.4)'; ctx.lineWidth = 0.6;
        const x = Math.random()*s, y = Math.random()*s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random()-0.5)*16, y + (Math.random()-0.5)*16); ctx.stroke();
      }
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- Mall glass: reflective blue-mirrored curtain wall ---
    _paint('mallglass', 512, (ctx, s) => {
      ctx.fillStyle = '#7CA8D8'; ctx.fillRect(0, 0, s, s);
      const fh = s/10, panels = 6, pw = s/panels;
      for (let f = 0; f < 10; f++) {
        const y = f*fh;
        ctx.fillStyle = '#A8C8E8'; ctx.fillRect(0, y, s, 2);  // floor dividers
        for (let p = 0; p < panels; p++) {
          const x = p*pw, tone = (f*3 + p*7) % 5;
          const palettes: Array<[string, string]> = [
            ['#B8D4F0', '#90B8DC'],
            ['#A0C0E8', '#7CA0C8'],
            ['#C0DCF8', '#A0C4E0'],
            ['#88A8CC', '#6088B0'],
            ['#A8C4E4', '#80A4C8']
          ];
          const pal = palettes[tone]!;
          const g = ctx.createLinearGradient(x, y+2, x, y+fh-2);
          g.addColorStop(0, pal[0]); g.addColorStop(0.5, pal[1]); g.addColorStop(1, pal[0]);
          ctx.fillStyle = g; ctx.fillRect(x+2, y+2, pw-4, fh-4);
          // reflection highlight
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(x+2, y+2, pw-4, (fh-4)*0.35);
          // mullion
          ctx.fillStyle = 'rgba(50,70,90,0.4)'; ctx.fillRect(x+pw-2, y, 2, fh);
        }
      }
      applyNoiseLattice(ctx, s, 0.015);
    });
  
    // --- School brick: warm red brick wall ---
    _paint('schoolbrick', 512, (ctx, s) => {
      ctx.fillStyle = '#A04030'; ctx.fillRect(0, 0, s, s);
      const bh = 22, bw = 56;
      for (let y = 0; y < s; y += bh) {
        const off = ((y/bh)%2)*(bw/2);
        for (let x = -bw; x < s+bw; x += bw) {
          const bx = x+off, sh = 0.88+Math.random()*0.2;
          ctx.fillStyle = _shade([160,64,48], sh);
          ctx.fillRect(bx+1, y+1, bw-3, bh-3);
          ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(bx+1, y+1, bw-3, 2);
          ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(bx+1, y+bh-3, bw-3, 2);
        }
      }
      // a few windows embedded
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 10; c++) {
          const x = 18 + c*48, y = 30 + r*44;
          ctx.fillStyle = '#3A5060'; ctx.fillRect(x-2, y-2, 26, 18);
          ctx.fillStyle = '#A8C8E0'; ctx.fillRect(x, y, 22, 14);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x+11, y); ctx.lineTo(x+11, y+14);
          ctx.moveTo(x, y+7); ctx.lineTo(x+22, y+7); ctx.stroke();
        }
      }
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- River: flowing water with currents ---
    _paint('river', 256, (ctx, s) => {
      ctx.fillStyle = '#5A8FB8'; ctx.fillRect(0, 0, s, s);
      // depth variations
      for (let i = 0; i < 40; i++) {
        const x = Math.random()*s, y = Math.random()*s, r = 10+Math.random()*30;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const tone = Math.random() > 0.5 ? 'rgba(120,170,210,0.35)' : 'rgba(50,100,140,0.3)';
        g.addColorStop(0, tone); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2);
      }
      // flowing current lines
      for (let i = 0; i < 60; i++) {
        const y = Math.random()*s;
        ctx.strokeStyle = `rgba(220,235,245,${0.12+Math.random()*0.22})`;
        ctx.lineWidth = 1+Math.random()*1.5;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x < s; x += 8) ctx.lineTo(x, y + Math.sin(x*0.08+i)*4);
        ctx.stroke();
      }
      // sparkle highlights
      for (let i = 0; i < 25; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(x, y, 2, 1);
      }
      applyNoiseLattice(ctx, s, 0.015);
    });
  
    // --- Field: grass with crop rows ---
    _paint('field', 256, (ctx, s) => {
      ctx.fillStyle = '#B8C898'; ctx.fillRect(0, 0, s, s);
      // crop rows
      const rows = 12, rh = s/rows;
      for (let r = 0; r < rows; r++) {
        const y = r*rh, tone = (r%3);
        const colors = ['#A8B880', '#C8D8A0', '#9AB078'];
        ctx.fillStyle = colors[tone]!;
        ctx.fillRect(0, y, s, rh-1);
        ctx.fillStyle = 'rgba(60,80,40,0.4)';
        for (let x = 0; x < s; x += 6) ctx.fillRect(x, y, 1, rh-1);
      }
      // sparse wildflowers
      for (let i = 0; i < 30; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = ['rgba(232,168,56,0.6)','rgba(232,88,88,0.5)','rgba(168,88,232,0.4)'][i%3]!;
        ctx.fillRect(x, y, 2, 2);
      }
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- Bridge: wood planks across ---
    _paint('bridge', 256, (ctx, s) => {
      ctx.fillStyle = '#9A7A4A'; ctx.fillRect(0, 0, s, s);
      const pw = 16;
      for (let x = 0; x < s; x += pw) {
        const sh = 0.88+Math.random()*0.2;
        ctx.fillStyle = _shade([154,122,74], sh);
        ctx.fillRect(x+1, 0, pw-2, s);
        ctx.strokeStyle = 'rgba(80,55,30,0.4)'; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const y = Math.random()*s;
          ctx.beginPath(); ctx.moveTo(x+1, y);
          ctx.bezierCurveTo(x+pw/3, y+(Math.random()-0.5)*8, x+2*pw/3, y+(Math.random()-0.5)*8, x+pw-1, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(80,55,30,0.45)'; ctx.fillRect(x+pw-2, 0, 2, s);
      }
      applyNoiseLattice(ctx, s, 0.03);
    });
  
    // --- KingIce: golden crown surface with "King Ice" text ---
    _paint(ICE_KING_BUILDING_ID, 512, (ctx, s) => drawIceKingCrownFacade(ctx, s, applyNoiseLattice));
  
    // --- Suburb: small house wall texture ---
    _paint('suburb', 256, (ctx, s) => {
      ctx.fillStyle = '#EDE3D0'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 250; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(220,205,180,0.4)' : 'rgba(180,165,140,0.4)';
        ctx.fillRect(x, y, 1, 2);
      }
      applyNoiseLattice(ctx, s, 0.025);
    });

    // --- Residence plaster: soft painted wall with restrained block seams ---
    _paint('residence_plaster', 256, (ctx, s) => {
      ctx.fillStyle = '#D9EADC'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 64) {
        ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(0, y, s, 4);
        ctx.fillStyle = 'rgba(85,120,95,0.08)'; ctx.fillRect(0, y + 60, s, 4);
      }
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(70,100,80,0.07)';
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      applyNoiseLattice(ctx, s, 0.018);
    });

    // --- Residence wood: painted timber boards for porches and trim ---
    _paint('residence_wood', 128, (ctx, s) => {
      ctx.fillStyle = '#E4D2B6'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 16) {
        ctx.fillStyle = y % 32 ? 'rgba(112,82,57,0.16)' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, y, s, 3);
      }
      applyNoiseLattice(ctx, s, 0.025);
    });

    // --- Residence tile: muted green roof tiles for the new garden family ---
    _paint('residence_tile', 256, (ctx, s) => {
      ctx.fillStyle = '#6C9279'; ctx.fillRect(0, 0, s, s);
      const tile = 16;
      for (let y = 0; y < s; y += tile) {
        const offset = (y / tile % 2) * (tile / 2);
        for (let x = -tile; x < s + tile; x += tile) {
          const bx = x + offset;
          ctx.fillStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.08})`;
          ctx.beginPath(); ctx.arc(bx + tile / 2, y + tile, tile / 2 - 1, Math.PI, 0); ctx.fill();
          ctx.fillStyle = 'rgba(35,65,45,0.16)'; ctx.fillRect(bx, y + tile - 2, tile, 2);
        }
      }
      applyNoiseLattice(ctx, s, 0.02);
    });

    // --- Residence shingle: blue-grey slate tiles for the brick-chimney family ---
    _paint('residence_shingle', 256, (ctx, s) => {
      ctx.fillStyle = '#59656F'; ctx.fillRect(0, 0, s, s);
      const tile = 32;
      for (let y = 0; y < s; y += tile) {
        const offset = (y / tile % 2) * (tile / 2);
        for (let x = -tile; x < s + tile; x += tile) {
          const bx = x + offset, sh = 0.85 + Math.random() * 0.25;
          ctx.fillStyle = _shade([89, 101, 111], sh);
          ctx.fillRect(bx + 1, y + 1, tile - 3, tile - 3);
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.fillRect(bx + tile - 3, y, 3, tile);
          ctx.fillRect(bx, y + tile - 3, tile, 3);
        }
      }
      applyNoiseLattice(ctx, s, 0.025);
    });

    // --- Residence panel: warm horizontal clapboard for the red-roof family ---
    _paint('residence_panel', 256, (ctx, s) => {
      ctx.fillStyle = '#E5D1B8'; ctx.fillRect(0, 0, s, s);
      const bh = 32;
      for (let y = 0; y < s; y += bh) {
        const sh = 0.92 + Math.random() * 0.12;
        ctx.fillStyle = _shade([229, 209, 184], sh);
        ctx.fillRect(0, y, s, bh - 6);
        ctx.fillStyle = 'rgba(120, 80, 50, 0.15)';
        ctx.fillRect(0, y + bh - 6, s, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, y, s, 2);
      }
      applyNoiseLattice(ctx, s, 0.025);
    });
  
    // ══ 建筑立面贴图（完整立面，非重复）：见 proceduralFacadePainters.ts ══
    registerFacadePainters(_paint);
  
    // ══ 地面区域贴图 ══
    _paint('ground2',256,(ctx,s)=>{ctx.fillStyle='#E0D8CC';ctx.fillRect(0,0,s,s);for(let i=0;i<350;i++){const x=Math.random()*s,y=Math.random()*s,r=0.5+Math.random()*2;const sh=Math.random();ctx.fillStyle=sh<0.3?'rgba(200,180,150,0.5)':sh<0.6?'rgba(180,160,130,0.4)':'rgba(210,200,180,0.4)';ctx.fillRect(x,y,r*2,r*2);}applyNoiseLattice(ctx,s,0.025);});
    _paint('ground4',256,(ctx,s)=>{ctx.fillStyle='#C0D0A0';ctx.fillRect(0,0,s,s);for(let i=0;i<600;i++){const x=Math.random()*s,y=Math.random()*s;const sh=0.65+Math.random()*0.5;ctx.fillStyle=`rgba(${Math.floor(100*sh)},${Math.floor(150*sh)},${Math.floor(70*sh)},0.5)`;ctx.fillRect(x,y,1,2+Math.random()*3);}applyNoiseLattice(ctx,s,0.02);});
    _paint('ground5',256,(ctx,s)=>{ctx.fillStyle='#E8E7E4';ctx.fillRect(0,0,s,s);const ts=32;for(let y=0;y<s;y+=ts){const off=((y/ts)%2)*(ts/2);for(let x=-ts;x<s+ts;x+=ts){const bx=x+off,sh=0.9+Math.random()*0.12;ctx.fillStyle=_shade([232,231,228],sh);ctx.fillRect(bx+1,y+1,ts-2,ts-2);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(bx+ts-2,y,2,ts);ctx.fillRect(bx,y+ts-2,ts,2);}}applyNoiseLattice(ctx,s,0.015);});
    _paint('ground6',256,(ctx,s)=>{ctx.fillStyle='#D0CCC8';ctx.fillRect(0,0,s,s);ctx.strokeStyle='rgba(100,90,80,0.2)';ctx.lineWidth=1;for(let i=0;i<20;i++){ctx.beginPath();const x=Math.random()*s,y=Math.random()*s;ctx.moveTo(x,y);for(let j=0;j<5;j++)ctx.lineTo(x+(Math.random()-0.5)*40,y+(Math.random()-0.5)*40);ctx.stroke();}for(let i=0;i<200;i++){const x=Math.random()*s,y=Math.random()*s;const sh=Math.random();ctx.fillStyle=`rgba(${180+Math.floor(sh*40)},${170+Math.floor(sh*30)},${160+Math.floor(sh*20)},0.3)`;ctx.fillRect(x,y,1.5,1.5);}applyNoiseLattice(ctx,s,0.02);});

    // --- Snow ground: soft blue-white drifts（山体雪带键 snow_ground 的 canvas
    // 兜底：生成纹理关闭时（textureRendering 默认 false）雪带仍有贴图；生成
    // 路径可用时依旧优先 snow_ground_color.webp）---
    _paint('snow_ground',256,(ctx,s)=>{ctx.fillStyle='#EDF1F5';ctx.fillRect(0,0,s,s);for(let i=0;i<240;i++){const x=Math.random()*s,y=Math.random()*s,r=2+Math.random()*7;const g=ctx.createRadialGradient(x,y,0,x,y,r);const tone=Math.random();g.addColorStop(0,tone<0.5?'rgba(206,218,232,0.4)':'rgba(255,255,255,0.5)');g.addColorStop(1,'rgba(206,218,232,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}for(let i=0;i<60;i++){const x=Math.random()*s,y=Math.random()*s;ctx.fillStyle='rgba(148,168,190,0.35)';ctx.fillRect(x,y,1+Math.random()*2,1);}for(let i=0;i<26;i++){const x=Math.random()*s,y=Math.random()*s;ctx.fillStyle='rgba(255,255,255,0.85)';ctx.fillRect(x,y,1.5,1.5);}applyNoiseLattice(ctx,s,0.015);});
  }

  let paintersRegistered = false;
  function ensurePainters(): { key: string; size: number; draw: DrawFn }[] {
    if (!paintersRegistered) { paintersRegistered = true; registerPainters(); }
    return painterQueue;
  }

  /** Sky textures bind lazily (NOT during pre-generation): the factory reads
   * the renderer for anisotropy, which only exists after init() created it. */
  function bindSkyTextures() {
    TEX.skyDay = resources.texture('sky:day', () => {
      const texture = new THREE.CanvasTexture(_texCanvases.skyDay!);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    });
    TEX.skyNight = resources.texture('sky:night', () => {
      const texture = new THREE.CanvasTexture(_texCanvases.skyNight!);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    });
  }

  function initTextures() {
    paintPendingTextures();
    bindSkyTextures();
  }

  /**
   * Synchronous pre-paint of every procedural canvas — no yields (timer
   * yields measured ~185 ms each against an animating splash on software
   * renderers; a single block costs the same CPU with zero amplification).
   * The heavy boot calls this while its fetches are in flight.
   */
  function paintPendingTextures(): void {
    for (const painter of ensurePainters()) {
      // Per-painter isolation: one bad texture logs and skips, the rest of
      // the city still paints (a whole-pass abort would leave the boot
      // without any procedural material). The unset slot is what the
      // initTextures() pass re-attempts.
      try {
        _canvas(painter.key, painter.size, painter.draw);
      } catch (error) {
        console.error(`Procedural texture painter failed: ${painter.key}`, error);
      }
    }
  }


  const library: ProceduralTextureLibrary = {
    initialize: initTextures,
    paintPending: paintPendingTextures,
    repeat: _tex,
    addFacade,
    refreshWeather,
    backgrounds: TEX,
  };
  activeTextureLibrary = library;
  return library;
}

export type ProceduralTextureLibrary = {
  initialize: () => void;
  paintPending: () => void;
  repeat: (key: string, rx?: number, ry?: number) => THREE.Texture | null;
  addFacade: (
    g: THREE.Group,
    texKey: string,
    w: number,
    h: number,
    y: number,
    zOffset: number,
    rotY?: number,
  ) => THREE.Mesh | null;
  refreshWeather: () => void;
  backgrounds: { skyDay: THREE.Texture | null; skyNight: THREE.Texture | null };
};

// 模块级活动实例注册表：纹理库由 cityGraphics 在模块加载期创建，而
// rendering/terrain 下的地形工厂（mountainRanges 等）只接收 { scene }，
// 无法经参数拿到库实例。这里保存最近一次创建的库，供地形工厂按
// createCitySurfaces 同样的公开 API（library.repeat(key, rx, ry)）取图，
// 复用同一 ResourcePool 纹理缓存。纹理归池所有，地形 dispose() 不得
// 释放经此取得的共享纹理。
let activeTextureLibrary: ProceduralTextureLibrary | null = null;

export function getActiveProceduralTextureLibrary(): ProceduralTextureLibrary | null {
  return activeTextureLibrary;
}

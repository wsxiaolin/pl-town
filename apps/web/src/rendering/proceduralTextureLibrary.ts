import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';
import groundCityColor from '../assets/textures/ground_city_color.png';
import groundDistrictColor from '../assets/textures/ground_district_color.png';
import groundGrassColor from '../assets/textures/ground_grass_color.png';
import asphaltColor from '../assets/textures/road_asphalt_color.png';
import pavementColor from '../assets/textures/road_pavement_color.png';
import wallPlasterColor from '../assets/textures/wall_plaster_color.png';
import stoneLightColor from '../assets/textures/stone_light_color.png';
import brickWarmColor from '../assets/textures/brick_warm_color.png';
import woodColor from '../assets/textures/wood_color.png';
import metalColor from '../assets/textures/metal_color.png';
import roofTileColor from '../assets/textures/rooftile_color.png';
import shingleColor from '../assets/textures/residence_shingle_color.png';
import wetAsphaltColor from '../assets/textures/road_asphalt_wet_color.png';
import snowGroundColor from '../assets/textures/snow_ground_color.png';
import snowRoofColor from '../assets/textures/snow_roof_color.png';
import sandColor from '../assets/textures/sand_color.png';
import mossGroundColor from '../assets/textures/ground_moss_color.png';
import concreteWornColor from '../assets/textures/concrete_worn_color.png';
import redBrickColor from '../assets/textures/brick_red_color.png';
import puddleAsphaltColor from '../assets/textures/puddle_asphalt_color.png';
import type { Weather } from '../city/weather';
import { weatherTextureKey } from './weatherTextureVariants';
import { isTextureResourceAvailable, isTextureResourceReady } from '../city/textureResourcePreloader';

type Canvas2D = CanvasRenderingContext2D;
type DrawFn = (ctx: Canvas2D, size: number) => void;
type RGB = [number, number, number];

const GENERATED_FACADES = import.meta.glob('../assets/textures/facade_*_color.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const GENERATED_WEATHER_TEXTURES = import.meta.glob('../assets/textures/{residence_*,road_*}_color.png', {
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
  facade_residence_cream: GENERATED_FACADES['../assets/textures/facade_residence_cream_color.png'] ?? '',
  facade_residence_bluepanel: GENERATED_FACADES['../assets/textures/facade_residence_bluepanel_color.png'] ?? '',
  facade_residence_stone: GENERATED_FACADES['../assets/textures/facade_residence_stone_color.png'] ?? '',
  facade_residence_darkwood: GENERATED_FACADES['../assets/textures/facade_residence_darkwood_color.png'] ?? '',
  facade_residence_moss: GENERATED_FACADES['../assets/textures/facade_residence_moss_color.png'] ?? '',
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
  function _canvas(key: string, size: number, drawFn: DrawFn) {
    if (!_texCanvases[key]) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      drawFn(c.getContext('2d')!, size);
      _texCanvases[key] = c;
    }
    return _texCanvases[key];
  }
  function _tex(key: string, rx = 1, ry = 1) {
    const weather = getWeather();
    const generatedKey = weatherTextureKey(key, weather);
    const generatedSource = GENERATED_TEXTURES[generatedKey]
      ?? GENERATED_WEATHER_TEXTURES[`../assets/textures/${generatedKey}_color.png`]
      ?? (generatedKey === 'wet_asphalt' ? puddleAsphaltColor
        : generatedKey === 'snow_ground' ? snowGroundColor
          : generatedKey === 'snow_roof' ? snowRoofColor
            : undefined);
    if (getTextureRendering() && isTextureResourceReady() && generatedSource && isTextureResourceAvailable(generatedSource)) {
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
    const facadeSource = GENERATED_FACADES[`../assets/textures/${key}_color.png`];
    if (getTextureRendering() && isTextureResourceReady() && facadeSource && isTextureResourceAvailable(facadeSource)) {
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
      } else if (weather === 'snow') {
        material.roughness = Math.max(baseRoughness, 0.85);
        material.metalness = Math.min(baseMetalness, 0.02);
        material.color.multiplyScalar(1.12);
      }
      material.needsUpdate = true;
    }
  }
  function _noise(ctx: Canvas2D, size: number, amount: number) {
    const img = ctx.getImageData(0, 0, size, size);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * amount * 255;
      data[i]   = Math.max(0, Math.min(255, (data[i]   ?? 0) + n));
      data[i+1] = Math.max(0, Math.min(255, (data[i+1] ?? 0) + n));
      data[i+2] = Math.max(0, Math.min(255, (data[i+2] ?? 0) + n));
    }
    ctx.putImageData(img, 0, 0);
  }
  function _shade(base: RGB, s: number) {
    return `rgb(${Math.floor(base[0]*s)},${Math.floor(base[1]*s)},${Math.floor(base[2]*s)})`;
  }
  const TEX: { skyDay: THREE.Texture | null; skyNight: THREE.Texture | null } = { skyDay: null, skyNight: null };
  function initTextures() {
    // --- Wall: cream facade with window grid ---
    _canvas('wall', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.025);
    });
  
    // --- Stone: cut stone blocks ---
    _canvas('stone', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.03);
    });
  
    // --- Brick: running bond ---
    _canvas('brick', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.02);
    });

    _canvas('academybrick', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.02);
    });
  
    // --- Glass: skyscraper facade ---
    _canvas('glass', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.015);
    });
  
    // --- Dark wall: dark metal/stone ---
    _canvas('darkwall', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.04);
    });
  
    // --- Ruin: weathered stone ---
    _canvas('ruin', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.05);
    });
  
    // --- Wood: plank grain ---
    _canvas('wood', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.03);
    });
  
    // --- Metal: brushed ---
    _canvas('metal', 512, (ctx, s) => {
      ctx.fillStyle = '#D8D7D2'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 200; i++) {
        const y = Math.random()*s, a = 0.05+Math.random()*0.1;
        ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, y, s, 1);
      }
      const ps = 128;
      ctx.strokeStyle = 'rgba(100,100,100,0.3)'; ctx.lineWidth = 2;
      for (let x = ps; x < s; x += ps) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke(); }
      for (let y = ps; y < s; y += ps) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
      _noise(ctx, s, 0.02);
    });
  
    // --- Roof tile: shingles ---
    _canvas('rooftile', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.025);
    });
  
    // --- Ground: grass + dirt ---
    _canvas('ground', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.025);
    });
  
    // --- Road: cobblestone ---
    _canvas('road', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.035);
    });
  
    // --- Plaza: radial pattern ---
    _canvas('plaza', 256, (ctx, s) => {
      ctx.fillStyle = '#E8E7E4'; ctx.fillRect(0, 0, s, s);
      const cx = s/2, cy = s/2;
      for (let r = 30; r < s/2; r += 24) {
        ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
      _noise(ctx, s, 0.03);
    });
  
    // --- Sky day ---
    _canvas('skyDay', 256, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#F9F8F6'); g.addColorStop(0.6, '#F5F4F0'); g.addColorStop(1, '#ECEBE6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 12; i++) {
        const x = Math.random()*s, y = Math.random()*s*0.4, r = 20+Math.random()*40;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      }
      _noise(ctx, s, 0.015);
    });
  
    // --- Sky night ---
    _canvas('skyNight', 256, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#D4D3CE'); g.addColorStop(0.6, '#C8C7C2'); g.addColorStop(1, '#BCBBB6');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      _noise(ctx, s, 0.02);
    });
  
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
  
    // --- Grass: lush green ---
    _canvas('grass', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.03);
    });
  
    // --- Water: blue ripples ---
    _canvas('water', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.02);
    });
  
    // --- Fabric: striped awning ---
    _canvas('fabric', 128, (ctx, s) => {
      const stripeW = s / 8;
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i%2===0 ? '#E8A838' : '#F5F4F1';
        ctx.fillRect(i*stripeW, 0, stripeW, s);
      }
      _noise(ctx, s, 0.02);
    });
  
    // --- Pagoda tile: Asian red-brown curved ---
    _canvas('pagoda_tile', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.025);
    });
  
    // --- Asphalt: plain dark road surface (no lane markings in texture) ---
    _canvas('asphalt', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.025);
    });

    // --- Wet asphalt: dark rain-slicked road with puddle sheen ---
    _canvas('wet_asphalt', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.02);
    });

    // --- Crosswalk: white stripes on dark for intersections ---
    _canvas('crosswalk', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.02);
    });

    // Rotated variant for roads running along the other world axis.
    _canvas('crosswalkRotated', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.02);
    });
  
    // --- Pavement: sidewalk tiles ---
    _canvas('pavement', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.03);
    });
  
    // --- Mall glass: reflective blue-mirrored curtain wall ---
    _canvas('mallglass', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.015);
    });
  
    // --- School brick: warm red brick wall ---
    _canvas('schoolbrick', 512, (ctx, s) => {
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
      _noise(ctx, s, 0.03);
    });
  
    // --- River: flowing water with currents ---
    _canvas('river', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.015);
    });
  
    // --- Field: grass with crop rows ---
    _canvas('field', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.03);
    });
  
    // --- Bridge: wood planks across ---
    _canvas('bridge', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.03);
    });
  
    // --- KingIce: golden crown surface with "King Ice" text ---
    _canvas('kingice', 512, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#E8A838');
      g.addColorStop(0.3, '#F0C050');
      g.addColorStop(0.5, '#FFF1C0');
      g.addColorStop(0.7, '#F0C050');
      g.addColorStop(1, '#D49028');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      // Subtle diamond pattern
      for (let y = 0; y < s; y += 48) {
        for (let x = 0; x < s; x += 48) {
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath(); ctx.moveTo(x+24, y); ctx.lineTo(x+48, y+24);
          ctx.lineTo(x+24, y+48); ctx.lineTo(x, y+24); ctx.closePath(); ctx.fill();
        }
      }
      // Horizontal band lines
      ctx.fillStyle = 'rgba(180,120,20,0.18)';
      ctx.fillRect(0, s*0.22, s, 4);
      ctx.fillRect(0, s*0.78, s, 4);
      // "King Ice" text — large, bold, white with gold outline
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 96px "Segoe UI", Arial, sans-serif';
      // Gold outline/shadow
      ctx.strokeStyle = 'rgba(140,80,0,0.5)'; ctx.lineWidth = 8;
      ctx.strokeText('King Ice', s/2, s/2);
      // White fill
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
      ctx.fillText('King Ice', s/2, s/2);
      ctx.shadowColor = 'transparent';
      _noise(ctx, s, 0.02);
    });
  
    // --- Suburb: small house wall texture ---
    _canvas('suburb', 256, (ctx, s) => {
      ctx.fillStyle = '#EDE3D0'; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 250; i++) {
        const x = Math.random()*s, y = Math.random()*s;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(220,205,180,0.4)' : 'rgba(180,165,140,0.4)';
        ctx.fillRect(x, y, 1, 2);
      }
      _noise(ctx, s, 0.025);
    });

    // --- Residence plaster: soft painted wall with restrained block seams ---
    _canvas('residence_plaster', 256, (ctx, s) => {
      ctx.fillStyle = '#D9EADC'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 64) {
        ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(0, y, s, 4);
        ctx.fillStyle = 'rgba(85,120,95,0.08)'; ctx.fillRect(0, y + 60, s, 4);
      }
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(70,100,80,0.07)';
        ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
      }
      _noise(ctx, s, 0.018);
    });

    // --- Residence wood: painted timber boards for porches and trim ---
    _canvas('residence_wood', 128, (ctx, s) => {
      ctx.fillStyle = '#E4D2B6'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 16) {
        ctx.fillStyle = y % 32 ? 'rgba(112,82,57,0.16)' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, y, s, 3);
      }
      _noise(ctx, s, 0.025);
    });

    // --- Residence tile: muted green roof tiles for the new garden family ---
    _canvas('residence_tile', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.02);
    });

    // --- Residence shingle: blue-grey slate tiles for the brick-chimney family ---
    _canvas('residence_shingle', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.025);
    });

    // --- Residence panel: warm horizontal clapboard for the red-roof family ---
    _canvas('residence_panel', 256, (ctx, s) => {
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
      _noise(ctx, s, 0.025);
    });
  
    // ══ 建筑立面贴图（完整立面，非重复）══
    function _win(ctx: Canvas2D, x: number, y: number, w: number, h: number, frame: string, glass: [string, string, string]){ctx.fillStyle=frame;ctx.fillRect(x-2,y-2,w+4,h+4);const gr=ctx.createLinearGradient(x,y,x+w,y+h);gr.addColorStop(0,glass[0]);gr.addColorStop(0.5,glass[1]);gr.addColorStop(1,glass[2]);ctx.fillStyle=gr;ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillRect(x,y,w*0.35,h*0.35);ctx.fillStyle='rgba(60,70,90,0.15)';ctx.fillRect(x+w/2-0.5,y,1,h);ctx.fillRect(x,y+h/2-0.5,w,1);}
    function _door(ctx: Canvas2D, x: number, y: number, w: number, h: number, frame: string, panel: string){ctx.fillStyle=frame;ctx.fillRect(x-3,y-3,w+6,h+6);ctx.fillStyle=panel;ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(0,0,0,0.1)';ctx.fillRect(x,y,w/2,h);ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(x+w/2,y,w/2,h);ctx.fillStyle='rgba(218,165,32,0.6)';ctx.beginPath();ctx.arc(x+w*0.7,y+h*0.5,2,0,Math.PI*2);ctx.fill();}
    function _cornice(ctx: Canvas2D, y: number, color: string){ctx.fillStyle=color;ctx.fillRect(0,y,512,8);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,y+8,512,3);}
    function _awning(ctx: Canvas2D, y: number, a: string, b: string){const sw=512/8;for(let i=0;i<8;i++){ctx.fillStyle=i%2===0?a:b;ctx.fillRect(i*sw,y,sw,12);}ctx.fillStyle='rgba(0,0,0,0.1)';ctx.fillRect(0,y+12,512,3);}
  
    _canvas('facade_bank',512,(ctx,s)=>{ctx.fillStyle='#F0EFEC';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#E8E7E2');ctx.fillStyle='#F5F4F1';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(s/2,50);ctx.lineTo(s,8);ctx.fill();ctx.fillStyle='rgba(0,0,0,0.04)';ctx.fillRect(0,8,s,4);ctx.fillStyle='#EAE9E4';ctx.fillRect(0,50,s,20);ctx.fillStyle='#D8D7D2';ctx.fillRect(0,64,s,6);const colW=40,gap=(s-5*colW)/4;for(let i=0;i<5;i++){const cx=i*(colW+gap);ctx.fillStyle='#F8F7F5';ctx.fillRect(cx,70,colW,s-100);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(cx,70,4,s-100);ctx.fillRect(cx+colW-4,70,4,s-100);ctx.fillStyle='#E8E7E2';ctx.fillRect(cx-4,68,colW+8,6);ctx.fillRect(cx-4,s-36,colW+8,6);}_door(ctx,s/2-30,s-90,60,50,'#C8A86D','#4A3A2A');ctx.fillStyle='#E0DFDC';ctx.fillRect(s/2-50,s-30,100,6);ctx.fillStyle='#D4D3D0';ctx.fillRect(s/2-40,s-20,80,6);_noise(ctx,s,0.02);});
    _canvas('facade_tower',512,(ctx,s)=>{ctx.fillStyle='#D5DDED';ctx.fillRect(0,0,s,s);const floors=12,fh=s/floors;for(let f=0;f<floors;f++){const y=f*fh;ctx.fillStyle='#C8C8C0';ctx.fillRect(0,y,s,3);const panels=5,pw=s/panels;for(let p=0;p<panels;p++){const x=p*pw,t=(f+p)%3;const gr=ctx.createLinearGradient(x,y,x+pw,y+fh);if(t===0){gr.addColorStop(0,'#B0C8E8');gr.addColorStop(0.5,'#90B0D0');gr.addColorStop(1,'#7898B8');}else if(t===1){gr.addColorStop(0,'#C0D8F0');gr.addColorStop(0.5,'#A0C0E0');gr.addColorStop(1,'#88A8C8');}else{gr.addColorStop(0,'#A8C0E0');gr.addColorStop(0.5,'#88A8C8');gr.addColorStop(1,'#7090B0');}ctx.fillStyle=gr;ctx.fillRect(x+1,y+4,pw-2,fh-7);ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(x+1,y+4,pw-2,(fh-7)*0.3);}}ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.3,s-fh,s*0.4,fh-4);ctx.fillStyle='rgba(200,220,250,0.4)';ctx.fillRect(s*0.32,s-fh+2,s*0.36,fh-8);_noise(ctx,s,0.012);});
    _canvas('facade_darktower',512,(ctx,s)=>{ctx.fillStyle='#3A3A3E';ctx.fillRect(0,0,s,s);const floors=10,fh=s/floors;for(let f=0;f<floors;f++){const y=f*fh;ctx.fillStyle='#2A2A2E';ctx.fillRect(0,y,s,3);for(let p=0;p<3;p++){const x=p*(s/3)+8,pw=s/3-16;const lit=Math.random()>0.3;if(lit){const gr=ctx.createLinearGradient(x,y,x+pw,y+fh);gr.addColorStop(0,'#5A4F8E');gr.addColorStop(0.5,'#4A3F7E');gr.addColorStop(1,'#3A2F6E');ctx.fillStyle=gr;}else{ctx.fillStyle='#2A2A2E';}ctx.fillRect(x,y+4,pw,fh-7);if(lit){ctx.fillStyle='rgba(107,79,232,0.2)';ctx.fillRect(x,y+4,pw,(fh-7)*0.4);}}}ctx.fillStyle='#1A1A2E';ctx.fillRect(s*0.35,s-fh,s*0.3,fh);ctx.fillStyle='rgba(107,79,232,0.3)';ctx.fillRect(s*0.37,s-fh+4,s*0.26,fh-8);_noise(ctx,s,0.035);});
    _canvas('facade_library',512,(ctx,s)=>{ctx.fillStyle='#E8E0D5';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D8D0C5');const uY=40,uH=s*0.45,cols=5,cw=s/cols;for(let c=0;c<cols;c++){const x=c*cw+10;_win(ctx,x,uY+15,cw-20,uH-20,'#C8C0B5',['#D5E8F8','#A8C8E0','#90B0C8']);}_cornice(ctx,uY+uH,'#D8D0C5');const gY=uY+uH+8,gH=s-gY-10;_door(ctx,s/2-25,gY+5,50,gH-15,'#B8A06D','#5A4A3A');_awning(ctx,gY-2,'#8A5A3A','#D8C8B8');_noise(ctx,s,0.025);});
    _canvas('facade_skyscraper',512,(ctx,s)=>{ctx.fillStyle='#D8D7D2';ctx.fillRect(0,0,s,s);const floors=15,fh=s/floors;for(let f=0;f<floors;f++){const y=f*fh;ctx.fillStyle='#C8C7C2';ctx.fillRect(0,y,s,2);const panels=4,pw=s/panels;for(let p=0;p<panels;p++){const x=p*pw,t=(f+p)%2;const gr=ctx.createLinearGradient(x,y,x+pw,y+fh);if(t===0){gr.addColorStop(0,'#C5DBF5');gr.addColorStop(0.5,'#A8C5E8');gr.addColorStop(1,'#90B0D8');}else{gr.addColorStop(0,'#B8D0F0');gr.addColorStop(0.5,'#A0BCDF');gr.addColorStop(1,'#88A5CF');}ctx.fillStyle=gr;ctx.fillRect(x+1,y+3,pw-2,fh-5);ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(x+1,y+3,pw-2,(fh-5)*0.25);}}ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.3,s-fh,s*0.4,fh);_noise(ctx,s,0.012);});
    _canvas('facade_campus',512,(ctx,s)=>{ctx.fillStyle='#EFEDE8';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#E0DFDC');const uY=30,uH=s*0.55;for(let f=0;f<3;f++){const y=uY+f*(uH/3);ctx.fillStyle='#D5D4CF';ctx.fillRect(0,y,s,4);_win(ctx,20,y+8,s-40,uH/3-16,'#C8C7C2',['#D0E8F8','#A8C8E0','#90B0C8']);}_cornice(ctx,uY+uH,'#E0DFDC');const gY=uY+uH+8;ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.35,gY,s*0.3,s-gY-5);ctx.fillStyle='rgba(200,220,250,0.5)';ctx.fillRect(s*0.37,gY+3,s*0.26,s-gY-11);_noise(ctx,s,0.02);});
    _canvas('facade_screen', 512, (ctx, s) => {
      ctx.fillStyle = '#EAE9E6'; ctx.fillRect(0, 0, s, s);
      _cornice(ctx, 0, '#D8D7D2'); _cornice(ctx, s - 12, '#D8D7D2');
      ctx.fillStyle = '#2A2A30'; ctx.fillRect(30, 30, s - 60, s - 60);
      const gr = ctx.createLinearGradient(0, 30, 0, s - 30);
      gr.addColorStop(0, '#1A3A6E'); gr.addColorStop(0.5, '#2A5FA8'); gr.addColorStop(1, '#1A3A6E');
      ctx.fillStyle = gr; ctx.fillRect(35, 35, s - 70, s - 70);
      ctx.fillStyle = 'rgba(200,220,250,0.6)';
      ctx.fillRect(60, 60, s - 120, 4); ctx.fillRect(60, 75, s - 150, 3);
      const lyricLines = ['never goona give you up', 'never gonna let you down'];
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const lyricWidth = Math.max(...lyricLines.map(l => ctx.measureText(l).width));
      const lyricSize = Math.round(11 * (s - 60) * 0.9 / lyricWidth);
      ctx.font = `bold ${lyricSize}px sans-serif`;
      lyricLines.forEach((l, i) => ctx.fillText(l, s / 2, s / 2 + (i - 0.5) * lyricSize * 1.3));
      ctx.fillStyle = '#D0CFCC'; ctx.fillRect(s / 2 - 2, 0, 4, 30);
      _noise(ctx, s, 0.02);
    });
    _canvas('facade_temple',512,(ctx,s)=>{ctx.fillStyle='#F0EFEC';ctx.fillRect(0,0,s,s);ctx.fillStyle='#F5F4F1';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(s/2,55);ctx.lineTo(s,10);ctx.fill();ctx.fillStyle='#EAE9E4';ctx.fillRect(0,55,s,18);ctx.fillStyle='#D8D7D2';ctx.fillRect(0,68,s,5);const nCol=6,colW=28,gap=(s-nCol*colW)/(nCol+1);for(let i=0;i<nCol;i++){const cx=gap+i*(colW+gap);ctx.fillStyle='#F8F7F5';ctx.fillRect(cx,73,colW,s-113);ctx.fillStyle='rgba(0,0,0,0.05)';ctx.fillRect(cx,73,3,s-113);ctx.fillRect(cx+colW-3,73,3,s-113);ctx.fillStyle='#E8E7E2';ctx.fillRect(cx-4,71,colW+8,6);ctx.fillRect(cx-4,s-40,colW+8,6);}ctx.fillStyle='#E0DFDC';ctx.fillRect(0,s-34,s,6);ctx.fillStyle='#D4D3D0';ctx.fillRect(0,s-22,s,6);ctx.fillStyle='#4A3A2A';ctx.fillRect(s/2-25,s-90,50,56);_noise(ctx,s,0.018);});
    _canvas('facade_factory',512,(ctx,s)=>{ctx.fillStyle='#D0CCC6';ctx.fillRect(0,0,s,s);const bh=20,bw=50;for(let y=0;y<s;y+=bh){const off=((y/bh)%2)*(bw/2);for(let x=-bw;x<s+bw;x+=bw){const bx=x+off;ctx.fillStyle=`rgb(${170+Math.floor(Math.random()*30)},${150+Math.floor(Math.random()*25)},${135+Math.floor(Math.random()*20)})`;ctx.fillRect(bx+1,y+1,bw-3,bh-3);}}for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=30+c*(s/4),y=30+r*(s/4);_win(ctx,x,y,(s/4)-30,(s/4)-30,'#A09890',['#B8D0E8','#98B8D0','#8098B0']);}ctx.fillStyle='#5A5A5A';ctx.fillRect(s*0.2,s-80,s*0.25,70);ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.22,s-78,s*0.21,66);ctx.fillStyle='#E8A838';ctx.fillRect(s*0.5,s-100,s*0.3,15);_noise(ctx,s,0.03);});
    _canvas('facade_pagoda',512,(ctx,s)=>{ctx.fillStyle='#C4A86D';ctx.fillRect(0,0,s,s);const tiers=4,tierH=s/tiers;for(let i=0;i<tiers;i++){const y=i*tierH,w=s*(1-i*0.12),x=(s-w)/2;ctx.fillStyle='#8A5A3A';ctx.fillRect(x+20,y+8,w-40,tierH-16);ctx.fillStyle='#D0C8B0';ctx.fillRect(x+30,y+12,20,tierH-24);ctx.fillRect(x+w-50,y+12,20,tierH-24);ctx.fillStyle='#C45A4A';ctx.beginPath();ctx.moveTo(x-10,y+tierH-2);ctx.quadraticCurveTo(x+w/2,y+tierH+18,x+w+10,y+tierH-2);ctx.lineTo(x+w+10,y+tierH-8);ctx.lineTo(x-10,y+tierH-8);ctx.fill();}ctx.fillStyle='#E8A838';ctx.fillRect(s/2-2,0,4,12);ctx.beginPath();ctx.arc(s/2,14,5,0,Math.PI*2);ctx.fill();_noise(ctx,s,0.025);});
    _canvas('facade_clocktower',512,(ctx,s)=>{ctx.fillStyle='#C5C5C2';ctx.fillRect(0,0,s,s);const bh=24,bw=60;for(let y=0;y<s;y+=bh){const off=((y/bh)%2)*(bw/2);for(let x=-bw;x<s+bw;x+=bw){const bx=x+off;const r=160+Math.floor(Math.random()*40),g=70+Math.floor(Math.random()*30),b=55+Math.floor(Math.random()*25);ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(bx+1,y+1,bw-3,bh-3);}}for(let f=0;f<4;f++){const y=30+f*(s/5);_win(ctx,s*0.15,y,50,40,'#A09890',['#C0D8E8','#A0B8D0','#8898B0']);_win(ctx,s*0.7,y,50,40,'#A09890',['#C0D8E8','#A0B8D0','#8898B0']);}const cy=s*0.15,cr=35;ctx.fillStyle='#F8F4E8';ctx.beginPath();ctx.arc(s/2,cy,cr,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#5A5A5A';ctx.lineWidth=3;ctx.beginPath();ctx.arc(s/2,cy,cr,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#2A2A2A';ctx.fillRect(s/2-2,cy-20,4,20);ctx.fillRect(s/2-1,cy,2,25);_door(ctx,s/2-20,s-60,40,50,'#8A5A3A','#5A3A2A');_noise(ctx,s,0.025);});
    _canvas('facade_market',512,(ctx,s)=>{ctx.fillStyle='#F0EFEC';ctx.fillRect(0,0,s,s);_awning(ctx,0,'#E8A838','#F5F4F1');_awning(ctx,s-20,'#E8A838','#F5F4F1');ctx.fillStyle='#C4A86D';ctx.fillRect(0,s*0.5,s,12);ctx.fillStyle='#E85858';ctx.beginPath();ctx.arc(s*0.2,s*0.5-5,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#E8A838';ctx.beginPath();ctx.arc(s*0.4,s*0.5-5,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5A8A3A';ctx.beginPath();ctx.arc(s*0.6,s*0.5-5,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#A88858';ctx.fillRect(5,20,8,s*0.5-20);ctx.fillRect(s-13,20,8,s*0.5-20);ctx.fillStyle='#3B6FE0';ctx.fillRect(s*0.3,14,s*0.4,18);ctx.fillStyle='#F8F7F5';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('MARKET',s/2,27);_noise(ctx,s,0.02);});
    _canvas('facade_greenhouse',512,(ctx,s)=>{ctx.fillStyle='#E0F0D8';ctx.fillRect(0,0,s,s);const panels=4,pw=s/panels;for(let p=0;p<panels;p++){const x=p*pw;const gr=ctx.createLinearGradient(x,0,x+pw,s);gr.addColorStop(0,'rgba(200,235,210,0.8)');gr.addColorStop(0.5,'rgba(170,210,180,0.6)');gr.addColorStop(1,'rgba(140,190,160,0.4)');ctx.fillStyle=gr;ctx.fillRect(x+2,2,pw-4,s-4);}ctx.strokeStyle='#A8B8A0';ctx.lineWidth=4;for(let p=0;p<=panels;p++){ctx.beginPath();ctx.moveTo(p*pw,0);ctx.lineTo(p*pw,s);ctx.stroke();}ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.4,s*0.7,s*0.2,s*0.3);_noise(ctx,s,0.015);});
    _canvas('facade_kiosk',512,(ctx,s)=>{ctx.fillStyle='#E8E0D5';ctx.fillRect(0,0,s,s);ctx.fillStyle='#D8C8A0';ctx.fillRect(0,0,s,s*0.35);for(let c=0;c<3;c++){_win(ctx,20+c*(s/3),15,(s/3)-30,s*0.3-20,'#C8B8A0',['#D5E8F8','#A8C8E0','#90B0C8']);}_awning(ctx,s*0.35,'#E8A838','#F5F4F1');ctx.fillStyle='#4A6FA8';ctx.fillRect(20,s*0.4,s-40,s*0.25);ctx.fillStyle='#C4A86D';ctx.fillRect(0,s*0.65,s,s*0.35);ctx.fillStyle='#3B6FE0';ctx.fillRect(s*0.2,s*0.35-2,s*0.6,8);_noise(ctx,s,0.02);});
    _canvas('facade_observatory',512,(ctx,s)=>{ctx.fillStyle='#EAE9E6';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D8D7D2');_cornice(ctx,s-10,'#D8D7D2');for(let c=0;c<4;c++){_win(ctx,20+c*(s/4),20,(s/4)-30,s*0.4-20,'#C8C7C2',['#D0E8F8','#A8C8E0','#90B0C8']);}_cornice(ctx,s*0.45,'#D8D7D2');_door(ctx,s/2-25,s*0.55,50,s*0.35,'#B8A06D','#5A4A3A');const gr=ctx.createRadialGradient(s/2,s*0.2,0,s/2,s*0.2,40);gr.addColorStop(0,'rgba(59,111,224,0.15)');gr.addColorStop(1,'rgba(59,111,224,0)');ctx.fillStyle=gr;ctx.fillRect(s*0.2,0,s*0.6,s*0.4);_noise(ctx,s,0.02);});
    _canvas('facade_altar',512,(ctx,s)=>{ctx.fillStyle='#E4E3E0';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D0CFCC');ctx.fillStyle='#F0EFEC';ctx.fillRect(0,10,s,15);const nP=5;for(let i=0;i<nP;i++){const px=20+i*(s-40)/(nP-1)-12;ctx.fillStyle='#D8D7D2';ctx.fillRect(px,25,24,s-55);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(px,25,4,s-55);ctx.fillRect(px+20,25,4,s-55);ctx.fillStyle='#C8C7C2';ctx.fillRect(px-3,23,30,5);ctx.fillRect(px-3,s-32,30,5);}ctx.fillStyle='#D0CFCC';ctx.fillRect(0,s-30,s,12);ctx.fillStyle='#F8F4E8';ctx.fillRect(s/2-50,s-35,100,12);ctx.fillStyle='#E8A838';ctx.beginPath();ctx.arc(s/2,s-29,5,0,Math.PI*2);ctx.fill();_noise(ctx,s,0.02);});
    _canvas('facade_board',512,(ctx,s)=>{ctx.fillStyle='#C4A86D';ctx.fillRect(0,0,s,s);ctx.fillStyle='#A88858';ctx.fillRect(0,0,s,20);ctx.fillRect(0,s-20,s,20);ctx.fillRect(0,0,20,s);ctx.fillRect(s-20,0,20,s);ctx.fillStyle='#D8C8A0';ctx.fillRect(20,20,s-40,s-40);const papers:Array<[number,number,number,number,string]>=[[40,35,80,60,'#F8F4E8'],[150,30,70,50,'#F5F0E0'],[250,40,90,55,'#F0EBD8'],[370,35,75,60,'#F8F4E8'],[50,120,85,65,'#F5F0E0'],[160,110,70,55,'#F0EBD8'],[260,125,80,60,'#F8F4E8'],[370,120,70,50,'#F5F0E0'],[60,220,75,55,'#F0EBD8'],[170,210,85,65,'#F8F4E8'],[290,220,70,50,'#F5F0E0'],[380,215,65,55,'#F0EBD8'],[50,310,80,60,'#F5F0E0'],[160,300,70,55,'#F8F4E8'],[260,310,85,60,'#F5F0E0'],[375,305,65,50,'#F8F4E8']];papers.forEach(p=>{ctx.fillStyle=p[4];ctx.fillRect(p[0],p[1],p[2],p[3]);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(p[0],p[1]+p[3],p[2],3);ctx.fillStyle='rgba(60,50,40,0.3)';for(let i=0;i<4;i++)ctx.fillRect(p[0]+5,p[1]+5+i*8,p[2]-10-Math.random()*20,1);ctx.fillStyle='#E85858';ctx.beginPath();ctx.arc(p[0]+p[2]/2,p[1]+5,2,0,Math.PI*2);ctx.fill();});_noise(ctx,s,0.03);});
    _canvas('facade_shaft',512,(ctx,s)=>{ctx.fillStyle='#D8D7D2';ctx.fillRect(0,0,s,s);const ps=s/4;for(let y=0;y<s;y+=ps)for(let x=0;x<s;x+=ps){const sh=0.9+Math.random()*0.15;ctx.fillStyle=_shade([216,215,210],sh);ctx.fillRect(x+2,y+2,ps-4,ps-4);ctx.fillStyle='rgba(0,0,0,0.08)';ctx.fillRect(x+ps-4,y,4,ps);ctx.fillRect(x,y+ps-4,ps,4);}ctx.fillStyle='#2A2A30';ctx.fillRect(s*0.2,s*0.4,s*0.6,s*0.55);ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.22,s*0.42,s*0.56,s*0.51);ctx.fillStyle='#2A2A30';ctx.fillRect(s/2-1,s*0.42,2,s*0.51);ctx.fillStyle='#1A1A1E';ctx.fillRect(s*0.8,s*0.5,30,50);ctx.fillStyle='#A8C8F8';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(s*0.8+15,s*0.52+i*10,3,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#2A2A30';ctx.fillRect(s*0.4,s*0.15,s*0.2,25);ctx.fillStyle='#A8C8F8';ctx.font='bold 14px monospace';ctx.textAlign='center';ctx.fillText('1F',s/2,s*0.15+17);_noise(ctx,s,0.018);});
    _canvas('facade_mall',512,(ctx,s)=>{ctx.fillStyle='#D8E0E8';ctx.fillRect(0,0,s,s);const floors=5,fh=s/floors;for(let f=0;f<floors;f++){const y=f*fh;ctx.fillStyle='#B8C0C8';ctx.fillRect(0,y,s,3);const panels=6,pw=s/panels;for(let p=0;p<panels;p++){const x=p*pw,t=(f+p)%3;const gr=ctx.createLinearGradient(x,y,x+pw,y+fh);if(t===0){gr.addColorStop(0,'#C0D8F0');gr.addColorStop(0.5,'#A0C0E0');gr.addColorStop(1,'#88A8C8');}else if(t===1){gr.addColorStop(0,'#B8D0E8');gr.addColorStop(0.5,'#98B8D0');gr.addColorStop(1,'#8098B0');}else{gr.addColorStop(0,'#D0E0F0');gr.addColorStop(0.5,'#B0C8E0');gr.addColorStop(1,'#98B0C8');}ctx.fillStyle=gr;ctx.fillRect(x+1,y+4,pw-2,fh-7);ctx.fillStyle='rgba(255,255,255,0.12)';ctx.fillRect(x+1,y+4,pw-2,(fh-7)*0.25);}}ctx.fillStyle='#E8A838';ctx.fillRect(s*0.25,s*0.9,s*0.5,8);_noise(ctx,s,0.012);});
    _canvas('facade_school',512,(ctx,s)=>{ctx.fillStyle='#F0EDE5';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#E0DFDC');_cornice(ctx,s-10,'#E0DFDC');const floors=4,fh=(s-20)/floors;for(let f=0;f<floors;f++){const y=10+f*fh;ctx.fillStyle='#D8D7D2';ctx.fillRect(0,y,s,3);for(let c=0;c<6;c++){const x=15+c*((s-30)/6),ww=(s-30)/6-8;_win(ctx,x,y+5,ww,fh-10,'#C8C7C2',['#C5DBF5','#A0BCDF','#88A5CF']);}}_door(ctx,s/2-25,s-55,50,45,'#B8A06D','#5A4A3A');_noise(ctx,s,0.02);});
    _canvas('facade_banana',512,(ctx,s)=>{ctx.fillStyle='#F5E838';ctx.fillRect(0,0,s,s);ctx.fillStyle='#E8D528';ctx.beginPath();ctx.moveTo(s*0.2,s);ctx.quadraticCurveTo(s*0.2,s*0.4,s*0.5,s*0.35);ctx.quadraticCurveTo(s*0.8,s*0.4,s*0.8,s);ctx.fill();ctx.fillStyle='rgba(180,150,0,0.2)';ctx.beginPath();ctx.moveTo(s*0.25,s);ctx.quadraticCurveTo(s*0.25,s*0.45,s*0.5,s*0.42);ctx.quadraticCurveTo(s*0.75,s*0.45,s*0.75,s);ctx.fill();for(let i=0;i<4;i++){const x=s*0.1+i*s*0.22,y=s*0.15;ctx.fillStyle='#4A6FA8';ctx.beginPath();ctx.ellipse(x+s*0.08,y,s*0.06,s*0.1,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(200,220,250,0.5)';ctx.beginPath();ctx.ellipse(x+s*0.08,y,s*0.05,s*0.08,0,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#D8C020';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(s/2,s*0.15,s,0);ctx.lineTo(s,8);ctx.lineTo(0,8);ctx.fill();ctx.fillStyle='#8A5A00';ctx.fillRect(s*0.3,s*0.82,s*0.4,16);ctx.fillStyle='#F5E838';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('布拿拉宫',s/2,s*0.82+11);_noise(ctx,s,0.03);});
    _canvas('facade_qipai',512,(ctx,s)=>{ctx.fillStyle='#E8E7E4';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D8D7D2');const ts=s/8;for(let r=0;r<4;r++)for(let c=0;c<8;c++){ctx.fillStyle=(r+c)%2===0?'#2A2A2E':'#F8F7F5';ctx.fillRect(c*ts,r*ts+8,ts,ts);}_cornice(ctx,4*ts+8,'#D8D7D2');ctx.fillStyle='#4A3A2A';ctx.fillRect(s*0.15,s*0.55,s*0.7,s*0.4);ctx.fillStyle='rgba(80,60,40,0.5)';ctx.fillRect(s*0.17,s*0.57,s*0.66,s*0.36);ctx.fillStyle='#E8E7E2';ctx.fillRect(s*0.05,s*0.55,8,s*0.4);ctx.fillRect(s*0.9,s*0.55,8,s*0.4);_noise(ctx,s,0.02);});
  
    // ══ 地面区域贴图 ══
    _canvas('ground2',256,(ctx,s)=>{ctx.fillStyle='#E0D8CC';ctx.fillRect(0,0,s,s);for(let i=0;i<350;i++){const x=Math.random()*s,y=Math.random()*s,r=0.5+Math.random()*2;const sh=Math.random();ctx.fillStyle=sh<0.3?'rgba(200,180,150,0.5)':sh<0.6?'rgba(180,160,130,0.4)':'rgba(210,200,180,0.4)';ctx.fillRect(x,y,r*2,r*2);}_noise(ctx,s,0.025);});
    _canvas('ground4',256,(ctx,s)=>{ctx.fillStyle='#C0D0A0';ctx.fillRect(0,0,s,s);for(let i=0;i<600;i++){const x=Math.random()*s,y=Math.random()*s;const sh=0.65+Math.random()*0.5;ctx.fillStyle=`rgba(${Math.floor(100*sh)},${Math.floor(150*sh)},${Math.floor(70*sh)},0.5)`;ctx.fillRect(x,y,1,2+Math.random()*3);}_noise(ctx,s,0.02);});
    _canvas('ground5',256,(ctx,s)=>{ctx.fillStyle='#E8E7E4';ctx.fillRect(0,0,s,s);const ts=32;for(let y=0;y<s;y+=ts){const off=((y/ts)%2)*(ts/2);for(let x=-ts;x<s+ts;x+=ts){const bx=x+off,sh=0.9+Math.random()*0.12;ctx.fillStyle=_shade([232,231,228],sh);ctx.fillRect(bx+1,y+1,ts-2,ts-2);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(bx+ts-2,y,2,ts);ctx.fillRect(bx,y+ts-2,ts,2);}}_noise(ctx,s,0.015);});
    _canvas('ground6',256,(ctx,s)=>{ctx.fillStyle='#D0CCC8';ctx.fillRect(0,0,s,s);ctx.strokeStyle='rgba(100,90,80,0.2)';ctx.lineWidth=1;for(let i=0;i<20;i++){ctx.beginPath();const x=Math.random()*s,y=Math.random()*s;ctx.moveTo(x,y);for(let j=0;j<5;j++)ctx.lineTo(x+(Math.random()-0.5)*40,y+(Math.random()-0.5)*40);ctx.stroke();}for(let i=0;i<200;i++){const x=Math.random()*s,y=Math.random()*s;const sh=Math.random();ctx.fillStyle=`rgba(${180+Math.floor(sh*40)},${170+Math.floor(sh*30)},${160+Math.floor(sh*20)},0.3)`;ctx.fillRect(x,y,1.5,1.5);}_noise(ctx,s,0.02);});
  }

  return {
    initialize: initTextures,
    repeat: _tex,
    addFacade,
    refreshWeather,
    backgrounds: TEX,
  };
}

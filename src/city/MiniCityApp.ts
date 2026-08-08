// @ts-nocheck
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ResourcePool } from '../core/ResourcePool';
import { InstancedBatch } from '../core/InstancedBatch';
import { createRenderer, RENDER_SETTINGS_KEY, readRenderSettings } from '../rendering/createRenderer';
import { RENDER_ORDER, SURFACE_Y } from '../rendering/layers';
import { BUILDING_PLATFORM_HEIGHT, CAMERA_OFFSET, CITY_CONFIG, CITY_LIMIT, PALETTE, ROAD_COORDS, SATELLITE_CITY } from './data/cityConfig';
import { BUILDING_CONTENT, BUILDING_DEFS } from './data/buildings';
import { NPC_PROFILES } from './data/npcs';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { destroyCG, initCG, shouldShowCG, skipCG, startCG } from './cg';
import { MultiplayerClient } from '../network/MultiplayerClient';

const resources = new ResourcePool();
let animationFrame = 0;
let clockInterval = 0;
let trackingInterval = 0;
let started = false;
let eventController = new AbortController();
let treeTrunks, treeCrowns, lampPosts, lampLights;
let raycastBuildingGroups = [];
const labelWorldPosition = new THREE.Vector3();

const MOBILE  = () => window.innerWidth <= 680;
const REDUCED = false;

const P = PALETTE;

// ── Procedural Textures ──────────────────────────────────────────────────────
const _texCanvases = {};
function _canvas(key, size, drawFn) {
  if (!_texCanvases[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    drawFn(c.getContext('2d'), size);
    _texCanvases[key] = c;
  }
  return _texCanvases[key];
}
function _tex(key, rx, ry) {
  const c = _texCanvases[key];
  if (!c) return null;
  const repeatX = rx || 1, repeatY = ry || 1;
  return resources.texture(`repeat:${key}:${repeatX}:${repeatY}`, () => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer ? Math.min(renderer.capabilities.getMaxAnisotropy(), readRenderSettings().anisotropy) : 1;
    t.repeat.set(repeatX, repeatY);
    return t;
  });
}
function _texClamp(key) {
  const c = _texCanvases[key];
  if (!c) return null;
  return resources.texture(`clamp:${key}`, () => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer ? Math.min(renderer.capabilities.getMaxAnisotropy(), readRenderSettings().anisotropy) : 1;
    return t;
  });
}
function addFacade(g, texKey, w, h, y, zOffset, rotY) {
  const t = _texClamp(texKey);
  if (!t) return null;
  const mat = resources.material({ kind:'facade', texKey }, () =>
    new THREE.MeshStandardMaterial({ map: t, roughness: 0.65, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
  );
  const facade = new THREE.Mesh(resources.geometry(new THREE.PlaneGeometry(w, h)), mat);
  facade.position.set(0, y, zOffset);
  if (rotY) facade.rotation.y = rotY;
  facade.castShadow = true; facade.receiveShadow = true;
  g.add(facade);
  return facade;
}
function _noise(ctx, size, amount) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount * 255;
    img.data[i]   = Math.max(0, Math.min(255, img.data[i]   + n));
    img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + n));
    img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + n));
  }
  ctx.putImageData(img, 0, 0);
}
function _shade(base, s) {
  return `rgb(${Math.floor(base[0]*s)},${Math.floor(base[1]*s)},${Math.floor(base[2]*s)})`;
}
const TEX = {};
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
      ctx.fillStyle = ['rgba(200,180,200,0.4)','rgba(220,200,160,0.4)','rgba(180,200,220,0.3)'][i%3];
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
    const texture = new THREE.CanvasTexture(_texCanvases.skyDay);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
  TEX.skyNight = resources.texture('sky:night', () => {
    const texture = new THREE.CanvasTexture(_texCanvases.skyNight);
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
      ctx.fillStyle = ['rgba(232,88,88,0.5)','rgba(232,168,56,0.5)','rgba(168,88,232,0.4)'][i%3];
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

  // --- Crosswalk: white stripes on dark for intersections ---
  _canvas('crosswalk', 256, (ctx, s) => {
    ctx.fillStyle = '#3A3D44'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) {
      const x = Math.random()*s, y = Math.random()*s;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(80,82,90,0.35)' : 'rgba(28,30,36,0.35)';
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    // white zebra stripes along the length
    const stripeW = 14, stripeH = 32, gap = 10;
    for (let x = 0; x < s; x += stripeW + gap) {
      ctx.fillStyle = 'rgba(245,245,245,0.92)';
      ctx.fillRect(x, s/2 - stripeH/2, stripeW, stripeH);
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
        const palettes = [
          ['#B8D4F0', '#90B8DC'],
          ['#A0C0E8', '#7CA0C8'],
          ['#C0DCF8', '#A0C4E0'],
          ['#88A8CC', '#6088B0'],
          ['#A8C4E4', '#80A4C8']
        ];
        const pal = palettes[tone];
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
      ctx.fillStyle = colors[tone];
      ctx.fillRect(0, y, s, rh-1);
      ctx.fillStyle = 'rgba(60,80,40,0.4)';
      for (let x = 0; x < s; x += 6) ctx.fillRect(x, y, 1, rh-1);
    }
    // sparse wildflowers
    for (let i = 0; i < 30; i++) {
      const x = Math.random()*s, y = Math.random()*s;
      ctx.fillStyle = ['rgba(232,168,56,0.6)','rgba(232,88,88,0.5)','rgba(168,88,232,0.4)'][i%3];
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

  // ══ 建筑立面贴图（完整立面，非重复）══
  function _win(ctx,x,y,w,h,frame,glass){ctx.fillStyle=frame;ctx.fillRect(x-2,y-2,w+4,h+4);const gr=ctx.createLinearGradient(x,y,x+w,y+h);gr.addColorStop(0,glass[0]);gr.addColorStop(0.5,glass[1]);gr.addColorStop(1,glass[2]);ctx.fillStyle=gr;ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(255,255,255,0.25)';ctx.fillRect(x,y,w*0.35,h*0.35);ctx.fillStyle='rgba(60,70,90,0.15)';ctx.fillRect(x+w/2-0.5,y,1,h);ctx.fillRect(x,y+h/2-0.5,w,1);}
  function _door(ctx,x,y,w,h,frame,panel){ctx.fillStyle=frame;ctx.fillRect(x-3,y-3,w+6,h+6);ctx.fillStyle=panel;ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(0,0,0,0.1)';ctx.fillRect(x,y,w/2,h);ctx.fillStyle='rgba(255,255,255,0.08)';ctx.fillRect(x+w/2,y,w/2,h);ctx.fillStyle='rgba(218,165,32,0.6)';ctx.beginPath();ctx.arc(x+w*0.7,y+h*0.5,2,0,Math.PI*2);ctx.fill();}
  function _cornice(ctx,y,color){ctx.fillStyle=color;ctx.fillRect(0,y,512,8);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,y+8,512,3);}
  function _awning(ctx,y,a,b){const sw=512/8;for(let i=0;i<8;i++){ctx.fillStyle=i%2===0?a:b;ctx.fillRect(i*sw,y,sw,12);}ctx.fillStyle='rgba(0,0,0,0.1)';ctx.fillRect(0,y+12,512,3);}

  _canvas('facade_bank',512,(ctx,s)=>{ctx.fillStyle='#F0EFEC';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#E8E7E2');ctx.fillStyle='#F5F4F1';ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(s/2,50);ctx.lineTo(s,8);ctx.fill();ctx.fillStyle='rgba(0,0,0,0.04)';ctx.fillRect(0,8,s,4);ctx.fillStyle='#EAE9E4';ctx.fillRect(0,50,s,20);ctx.fillStyle='#D8D7D2';ctx.fillRect(0,64,s,6);const colW=40,gap=(s-5*colW)/4;for(let i=0;i<5;i++){const cx=i*(colW+gap);ctx.fillStyle='#F8F7F5';ctx.fillRect(cx,70,colW,s-100);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(cx,70,4,s-100);ctx.fillRect(cx+colW-4,70,4,s-100);ctx.fillStyle='#E8E7E2';ctx.fillRect(cx-4,68,colW+8,6);ctx.fillRect(cx-4,s-36,colW+8,6);}_door(ctx,s/2-30,s-90,60,50,'#C8A86D','#4A3A2A');ctx.fillStyle='#E0DFDC';ctx.fillRect(s/2-50,s-30,100,6);ctx.fillStyle='#D4D3D0';ctx.fillRect(s/2-40,s-20,80,6);_noise(ctx,s,0.02);});
  _canvas('facade_tower',512,(ctx,s)=>{ctx.fillStyle='#D5DDED';ctx.fillRect(0,0,s,s);const floors=12,fh=s/floors;for(let f=0;f<floors;f++){const y=f*fh;ctx.fillStyle='#C8C8C0';ctx.fillRect(0,y,s,3);const panels=5,pw=s/panels;for(let p=0;p<panels;p++){const x=p*pw,t=(f+p)%3;const gr=ctx.createLinearGradient(x,y,x+pw,y+fh);if(t===0){gr.addColorStop(0,'#B0C8E8');gr.addColorStop(0.5,'#90B0D0');gr.addColorStop(1,'#7898B8');}else if(t===1){gr.addColorStop(0,'#C0D8F0');gr.addColorStop(0.5,'#A0C0E0');gr.addColorStop(1,'#88A8C8');}else{gr.addColorStop(0,'#A8C0E0');gr.addColorStop(0.5,'#88A8C8');gr.addColorStop(1,'#7090B0');}ctx.fillStyle=gr;ctx.fillRect(x+1,y+4,pw-2,fh-7);ctx.fillStyle='rgba(255,255,255,0.18)';ctx.fillRect(x+1,y+4,pw-2,(fh-7)*0.3);}}ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.3,s-fh,s*0.4,fh-4);ctx.fillStyle='rgba(200,220,250,0.4)';ctx.fillRect(s*0.32,s-fh+2,s*0.36,fh-8);_noise(ctx,s,0.012);});
  _canvas('facade_darktower',512,(ctx,s)=>{ctx.fillStyle='#3A3A3E';ctx.fillRect(0,0,s,s);const floors=10,fh=s/floors;for(let f=0;f<floors;f++){const y=f*fh;ctx.fillStyle='#2A2A2E';ctx.fillRect(0,y,s,3);for(let p=0;p<3;p++){const x=p*(s/3)+8,pw=s/3-16;const lit=Math.random()>0.3;if(lit){const gr=ctx.createLinearGradient(x,y,x+pw,y+fh);gr.addColorStop(0,'#5A4F8E');gr.addColorStop(0.5,'#4A3F7E');gr.addColorStop(1,'#3A2F6E');ctx.fillStyle=gr;}else{ctx.fillStyle='#2A2A2E';}ctx.fillRect(x,y+4,pw,fh-7);if(lit){ctx.fillStyle='rgba(107,79,232,0.2)';ctx.fillRect(x,y+4,pw,(fh-7)*0.4);}}}ctx.fillStyle='#1A1A2E';ctx.fillRect(s*0.35,s-fh,s*0.3,fh);ctx.fillStyle='rgba(107,79,232,0.3)';ctx.fillRect(s*0.37,s-fh+4,s*0.26,fh-8);_noise(ctx,s,0.035);});
  _canvas('facade_library',512,(ctx,s)=>{ctx.fillStyle='#E8E0D5';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D8D0C5');const uY=40,uH=s*0.45,cols=5,cw=s/cols;for(let c=0;c<cols;c++){const x=c*cw+10;_win(ctx,x,uY+15,cw-20,uH-20,'#C8C0B5',['#D5E8F8','#A8C8E0','#90B0C8']);}_cornice(ctx,uY+uH,'#D8D0C5');const gY=uY+uH+8,gH=s-gY-10;_door(ctx,s/2-25,gY+5,50,gH-15,'#B8A06D','#5A4A3A');_awning(ctx,gY-2,'#8A5A3A','#D8C8B8');_noise(ctx,s,0.025);});
  _canvas('facade_skyscraper',512,(ctx,s)=>{ctx.fillStyle='#D8D7D2';ctx.fillRect(0,0,s,s);const floors=15,fh=s/floors;for(let f=0;f<floors;f++){const y=f*fh;ctx.fillStyle='#C8C7C2';ctx.fillRect(0,y,s,2);const panels=4,pw=s/panels;for(let p=0;p<panels;p++){const x=p*pw,t=(f+p)%2;const gr=ctx.createLinearGradient(x,y,x+pw,y+fh);if(t===0){gr.addColorStop(0,'#C5DBF5');gr.addColorStop(0.5,'#A8C5E8');gr.addColorStop(1,'#90B0D8');}else{gr.addColorStop(0,'#B8D0F0');gr.addColorStop(0.5,'#A0BCDF');gr.addColorStop(1,'#88A5CF');}ctx.fillStyle=gr;ctx.fillRect(x+1,y+3,pw-2,fh-5);ctx.fillStyle='rgba(255,255,255,0.15)';ctx.fillRect(x+1,y+3,pw-2,(fh-5)*0.25);}}ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.3,s-fh,s*0.4,fh);_noise(ctx,s,0.012);});
  _canvas('facade_campus',512,(ctx,s)=>{ctx.fillStyle='#EFEDE8';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#E0DFDC');const uY=30,uH=s*0.55;for(let f=0;f<3;f++){const y=uY+f*(uH/3);ctx.fillStyle='#D5D4CF';ctx.fillRect(0,y,s,4);_win(ctx,20,y+8,s-40,uH/3-16,'#C8C7C2',['#D0E8F8','#A8C8E0','#90B0C8']);}_cornice(ctx,uY+uH,'#E0DFDC');const gY=uY+uH+8;ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.35,gY,s*0.3,s-gY-5);ctx.fillStyle='rgba(200,220,250,0.5)';ctx.fillRect(s*0.37,gY+3,s*0.26,s-gY-11);_noise(ctx,s,0.02);});
  _canvas('facade_screen',512,(ctx,s)=>{ctx.fillStyle='#EAE9E6';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D8D7D2');_cornice(ctx,s-12,'#D8D7D2');ctx.fillStyle='#2A2A30';ctx.fillRect(30,30,s-60,s-60);const gr=ctx.createLinearGradient(0,30,0,s-30);gr.addColorStop(0,'#1A3A6E');gr.addColorStop(0.5,'#2A5FA8');gr.addColorStop(1,'#1A3A6E');ctx.fillStyle=gr;ctx.fillRect(35,35,s-70,s-70);ctx.fillStyle='rgba(200,220,250,0.6)';ctx.fillRect(60,60,s-120,4);ctx.fillRect(60,75,s-150,3);ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillStyle='rgba(255,255,255,0.8)';ctx.fillText('WELCOME',s/2,s/2-10);ctx.fillStyle='#D0CFCC';ctx.fillRect(s/2-2,0,4,30);_noise(ctx,s,0.02);});
  _canvas('facade_temple',512,(ctx,s)=>{ctx.fillStyle='#F0EFEC';ctx.fillRect(0,0,s,s);ctx.fillStyle='#F5F4F1';ctx.beginPath();ctx.moveTo(0,10);ctx.lineTo(s/2,55);ctx.lineTo(s,10);ctx.fill();ctx.fillStyle='#EAE9E4';ctx.fillRect(0,55,s,18);ctx.fillStyle='#D8D7D2';ctx.fillRect(0,68,s,5);const nCol=6,colW=28,gap=(s-nCol*colW)/(nCol+1);for(let i=0;i<nCol;i++){const cx=gap+i*(colW+gap);ctx.fillStyle='#F8F7F5';ctx.fillRect(cx,73,colW,s-113);ctx.fillStyle='rgba(0,0,0,0.05)';ctx.fillRect(cx,73,3,s-113);ctx.fillRect(cx+colW-3,73,3,s-113);ctx.fillStyle='#E8E7E2';ctx.fillRect(cx-4,71,colW+8,6);ctx.fillRect(cx-4,s-40,colW+8,6);}ctx.fillStyle='#E0DFDC';ctx.fillRect(0,s-34,s,6);ctx.fillStyle='#D4D3D0';ctx.fillRect(0,s-22,s,6);ctx.fillStyle='#4A3A2A';ctx.fillRect(s/2-25,s-90,50,56);_noise(ctx,s,0.018);});
  _canvas('facade_factory',512,(ctx,s)=>{ctx.fillStyle='#D0CCC6';ctx.fillRect(0,0,s,s);const bh=20,bw=50;for(let y=0;y<s;y+=bh){const off=((y/bh)%2)*(bw/2);for(let x=-bw;x<s+bw;x+=bw){const bx=x+off;ctx.fillStyle=`rgb(${170+Math.floor(Math.random()*30)},${150+Math.floor(Math.random()*25)},${135+Math.floor(Math.random()*20)})`;ctx.fillRect(bx+1,y+1,bw-3,bh-3);}}for(let r=0;r<3;r++)for(let c=0;c<4;c++){const x=30+c*(s/4),y=30+r*(s/4);_win(ctx,x,y,(s/4)-30,(s/4)-30,'#A09890',['#B8D0E8','#98B8D0','#8098B0']);}ctx.fillStyle='#5A5A5A';ctx.fillRect(s*0.2,s-80,s*0.25,70);ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.22,s-78,s*0.21,66);ctx.fillStyle='#E8A838';ctx.fillRect(s*0.5,s-100,s*0.3,15);_noise(ctx,s,0.03);});
  _canvas('facade_pagoda',512,(ctx,s)=>{ctx.fillStyle='#C4A86D';ctx.fillRect(0,0,s,s);const tiers=4,tierH=s/tiers;for(let i=0;i<tiers;i++){const y=i*tierH,w=s*(1-i*0.12),x=(s-w)/2;ctx.fillStyle='#8A5A3A';ctx.fillRect(x+20,y+8,w-40,tierH-16);ctx.fillStyle='#D0C8B0';ctx.fillRect(x+30,y+12,20,tierH-24);ctx.fillRect(x+w-50,y+12,20,tierH-24);ctx.fillStyle='#C45A4A';ctx.beginPath();ctx.moveTo(x-10,y+tierH-2);ctx.quadraticCurveTo(x+w/2,y+tierH+18,x+w+10,y+tierH-2);ctx.lineTo(x+w+10,y+tierH-8);ctx.lineTo(x-10,y+tierH-8);ctx.fill();}ctx.fillStyle='#E8A838';ctx.fillRect(s/2-2,0,4,12);ctx.beginPath();ctx.arc(s/2,14,5,0,Math.PI*2);ctx.fill();_noise(ctx,s,0.025);});
  _canvas('facade_clocktower',512,(ctx,s)=>{ctx.fillStyle='#C5C5C2';ctx.fillRect(0,0,s,s);const bh=24,bw=60;for(let y=0;y<s;y+=bh){const off=((y/bh)%2)*(bw/2);for(let x=-bw;x<s+bw;x+=bw){const bx=x+off;const r=160+Math.floor(Math.random()*40),g=70+Math.floor(Math.random()*30),b=55+Math.floor(Math.random()*25);ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(bx+1,y+1,bw-3,bh-3);}}for(let f=0;f<4;f++){const y=30+f*(s/5);_win(ctx,s*0.15,y,50,40,'#A09890',['#C0D8E8','#A0B8D0','#8898B0']);_win(ctx,s*0.7,y,50,40,'#A09890',['#C0D8E8','#A0B8D0','#8898B0']);}const cy=s*0.15,cr=35;ctx.fillStyle='#F8F4E8';ctx.beginPath();ctx.arc(s/2,cy,cr,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#5A5A5A';ctx.lineWidth=3;ctx.beginPath();ctx.arc(s/2,cy,cr,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#2A2A2A';ctx.fillRect(s/2-2,cy-20,4,20);ctx.fillRect(s/2-1,cy,2,25);_door(ctx,s/2-20,s-60,40,50,'#8A5A3A','#5A3A2A');_noise(ctx,s,0.025);});
  _canvas('facade_market',512,(ctx,s)=>{ctx.fillStyle='#F0EFEC';ctx.fillRect(0,0,s,s);_awning(ctx,0,'#E8A838','#F5F4F1');_awning(ctx,s-20,'#E8A838','#F5F4F1');ctx.fillStyle='#C4A86D';ctx.fillRect(0,s*0.5,s,12);ctx.fillStyle='#E85858';ctx.beginPath();ctx.arc(s*0.2,s*0.5-5,8,0,Math.PI*2);ctx.fill();ctx.fillStyle='#E8A838';ctx.beginPath();ctx.arc(s*0.4,s*0.5-5,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5A8A3A';ctx.beginPath();ctx.arc(s*0.6,s*0.5-5,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#A88858';ctx.fillRect(5,20,8,s*0.5-20);ctx.fillRect(s-13,20,8,s*0.5-20);ctx.fillStyle='#3B6FE0';ctx.fillRect(s*0.3,14,s*0.4,18);ctx.fillStyle='#F8F7F5';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText('MARKET',s/2,27);_noise(ctx,s,0.02);});
  _canvas('facade_greenhouse',512,(ctx,s)=>{ctx.fillStyle='#E0F0D8';ctx.fillRect(0,0,s,s);const panels=4,pw=s/panels;for(let p=0;p<panels;p++){const x=p*pw;const gr=ctx.createLinearGradient(x,0,x+pw,s);gr.addColorStop(0,'rgba(200,235,210,0.8)');gr.addColorStop(0.5,'rgba(170,210,180,0.6)');gr.addColorStop(1,'rgba(140,190,160,0.4)');ctx.fillStyle=gr;ctx.fillRect(x+2,2,pw-4,s-4);}ctx.strokeStyle='#A8B8A0';ctx.lineWidth=4;for(let p=0;p<=panels;p++){ctx.beginPath();ctx.moveTo(p*pw,0);ctx.lineTo(p*pw,s);ctx.stroke();}ctx.fillStyle='#4A6FA8';ctx.fillRect(s*0.4,s*0.7,s*0.2,s*0.3);_noise(ctx,s,0.015);});
  _canvas('facade_kiosk',512,(ctx,s)=>{ctx.fillStyle='#E8E0D5';ctx.fillRect(0,0,s,s);ctx.fillStyle='#D8C8A0';ctx.fillRect(0,0,s,s*0.35);for(let c=0;c<3;c++){_win(ctx,20+c*(s/3),15,(s/3)-30,s*0.3-20,'#C8B8A0',['#D5E8F8','#A8C8E0','#90B0C8']);}_awning(ctx,s*0.35,'#E8A838','#F5F4F1');ctx.fillStyle='#4A6FA8';ctx.fillRect(20,s*0.4,s-40,s*0.25);ctx.fillStyle='#C4A86D';ctx.fillRect(0,s*0.65,s,s*0.35);ctx.fillStyle='#3B6FE0';ctx.fillRect(s*0.2,s*0.35-2,s*0.6,8);_noise(ctx,s,0.02);});
  _canvas('facade_observatory',512,(ctx,s)=>{ctx.fillStyle='#EAE9E6';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D8D7D2');_cornice(ctx,s-10,'#D8D7D2');for(let c=0;c<4;c++){_win(ctx,20+c*(s/4),20,(s/4)-30,s*0.4-20,'#C8C7C2',['#D0E8F8','#A8C8E0','#90B0C8']);}_cornice(ctx,s*0.45,'#D8D7D2');_door(ctx,s/2-25,s*0.55,50,s*0.35,'#B8A06D','#5A4A3A');const gr=ctx.createRadialGradient(s/2,s*0.2,0,s/2,s*0.2,40);gr.addColorStop(0,'rgba(59,111,224,0.15)');gr.addColorStop(1,'rgba(59,111,224,0)');ctx.fillStyle=gr;ctx.fillRect(s*0.2,0,s*0.6,s*0.4);_noise(ctx,s,0.02);});
  _canvas('facade_altar',512,(ctx,s)=>{ctx.fillStyle='#E4E3E0';ctx.fillRect(0,0,s,s);_cornice(ctx,0,'#D0CFCC');ctx.fillStyle='#F0EFEC';ctx.fillRect(0,10,s,15);const nP=5;for(let i=0;i<nP;i++){const px=20+i*(s-40)/(nP-1)-12;ctx.fillStyle='#D8D7D2';ctx.fillRect(px,25,24,s-55);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(px,25,4,s-55);ctx.fillRect(px+20,25,4,s-55);ctx.fillStyle='#C8C7C2';ctx.fillRect(px-3,23,30,5);ctx.fillRect(px-3,s-32,30,5);}ctx.fillStyle='#D0CFCC';ctx.fillRect(0,s-30,s,12);ctx.fillStyle='#F8F4E8';ctx.fillRect(s/2-50,s-35,100,12);ctx.fillStyle='#E8A838';ctx.beginPath();ctx.arc(s/2,s-29,5,0,Math.PI*2);ctx.fill();_noise(ctx,s,0.02);});
  _canvas('facade_board',512,(ctx,s)=>{ctx.fillStyle='#C4A86D';ctx.fillRect(0,0,s,s);ctx.fillStyle='#A88858';ctx.fillRect(0,0,s,20);ctx.fillRect(0,s-20,s,20);ctx.fillRect(0,0,20,s);ctx.fillRect(s-20,0,20,s);ctx.fillStyle='#D8C8A0';ctx.fillRect(20,20,s-40,s-40);const papers=[[40,35,80,60,'#F8F4E8'],[150,30,70,50,'#F5F0E0'],[250,40,90,55,'#F0EBD8'],[370,35,75,60,'#F8F4E8'],[50,120,85,65,'#F5F0E0'],[160,110,70,55,'#F0EBD8'],[260,125,80,60,'#F8F4E8'],[370,120,70,50,'#F5F0E0'],[60,220,75,55,'#F0EBD8'],[170,210,85,65,'#F8F4E8'],[290,220,70,50,'#F5F0E0'],[380,215,65,55,'#F0EBD8'],[50,310,80,60,'#F5F0E0'],[160,300,70,55,'#F8F4E8'],[260,310,85,60,'#F5F0E0'],[375,305,65,50,'#F8F4E8']];papers.forEach(p=>{ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(p.x,p.y+p.h,p.w,3);ctx.fillStyle='rgba(60,50,40,0.3)';for(let i=0;i<4;i++)ctx.fillRect(p.x+5,p.y+5+i*8,p.w-10-Math.random()*20,1);ctx.fillStyle='#E85858';ctx.beginPath();ctx.arc(p.x+p.w/2,p.y+5,2,0,Math.PI*2);ctx.fill();});_noise(ctx,s,0.03);});
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

// ── Globals ───────────────────────────────────────────────────────────────────
let renderer, scene, camera;
const pathMats = [], groundMats = [], lampGlobes = [], buildings = [], npcList = [];
const buildingBoxes = []; // 主建筑的占地 AABB，用于寻路避障
let cursorChar = null;
let playerPath = [];
let pendingBuilding = null;
let playerMarker = null; // 玩家头顶的三角标记，用于高亮
let cameraZoom; // 当前视野宽度，由滚轮/双指缩放调整
let lastFrameTime = performance.now();
let isNight    = false; // 由社区时间自动决定
let hoveredB   = null, mouseOnScene = false;
let currentFilter = 'all';
let statsMode = 'clean';
let mapMode = false; // 全景地图弹层是否打开
let mapShotData = null;    // 启动时俯视截取的全城图（dataURL）
let mapShotRenderer = null, mapShotCam = null;
const MAP_SHOT = 1024;     // 截图像素边长
const MAP_SHOT_SPAN = 48;  // 半边长：只框住主城（外围环线 r≈38），卫星城在下方便不进入画面
let mapIconsBuilt = false, mapTipB = null;
const cameraTarget = new THREE.Vector3(0,0,0);
let dialogOpen = false, activeNpc = null, activeNode = null;
let pendingDistance = 0;
let gameClock = 9; // 游戏时间（小时）：现实 1 分钟 = 游戏 1 小时
let gameTimeRef = Date.now(); // 实时时间的锚点：页面加载瞬间视为早上 9 点
let multiplayer = null;
const remotePlayers = new Map();
let lastNetworkPosition = 0;
let onlinePlayers = [];
const residences = [];
let currentHouses = [];
let currentHousingRequests = [];
let selectedResidenceId = null;
let unreadChats = 0;
let pendingHousingRequests = 0;
let residenceClaimId = null;
// 住宅卡片内联面板（改名/邀请/成员/放弃/退出）的展开状态，跨刷新保留
let housePanelState = { houseId: null, mode: null };
const HOUSE_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/><path d="M10.2 20v-5h3.6v5"/></svg>';

const mouse2D     = new THREE.Vector2(-9999, -9999);
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();
const CONFIG = CITY_CONFIG;

// ── Building config ───────────────────────────────────────────────────────────
const PLH = BUILDING_PLATFORM_HEIGHT;

// Progression unlock tiers
const UNLOCK_TIERS = [
  { threshold:2,  label:'a lamp post appeared',  fn: () => addLamps([[4.5,0,-6.8]]) },
  { threshold:5,  label:'a new tree sprouted',   fn: () => addTrees([[7.2,0,7.0]]) },
  { threshold:9,  label:'a stone arch revealed', fn: () => addArch(-5.5,0,5.8,-Math.PI/6) },
  { threshold:14, label:'a bench was placed',    fn: () => addBench(6.8,0,-1.5,Math.PI/3) },
];

// ── 成就系统 ─────────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'citizen',       name:'居民落籍',      desc:'签下名字，成为这座城的居民',            check:s=>!!localStorage.getItem('minicityUser') },
  { id:'first_building',name:'第一次叩门',    desc:'进入任意一座建筑',                      check:s=>(s.buildingsVisited||[]).length>=1 },
  { id:'explorer_5',    name:'街区漫游者',    desc:'参观 5 座建筑',                         check:s=>(s.buildingsVisited||[]).length>=5 },
  { id:'explorer_10',   name:'城市测绘员',    desc:'参观 10 座建筑',                        check:s=>(s.buildingsVisited||[]).length>=10 },
  { id:'walker_100',    name:'长街行者',      desc:'累计步行 100 米',                       check:s=>(s.distance||0)>=100 },
  { id:'walker_500',    name:'环城暴走',      desc:'累计步行 500 米',                       check:s=>(s.distance||0)>=500 },
  { id:'chat_1',        name:'初次交谈',      desc:'和一位居民交谈',                        check:s=>(s.npcsTalked||0)>=1 },
  { id:'chat_all',      name:'城中人脉',      desc:'和每一位核心居民都交谈过',             check:s=>{
    const core=NPC_PROFILES.filter(p=>p.core).map(p=>p.id);
    return (s.npcsMet||[]).filter(id=>core.includes(id)).length>=core.length;
  } },
  { id:'night_owl',     name:'守夜人',        desc:'第一次在夜里看这座城市',                check:s=>(s.nightToggles||0)>=1 },
  { id:'unlock_3',      name:'城市生长',      desc:'解锁 3 次城市变化',                     check:s=>(s.unlockLevel||0)>=3 },
];

function checkAchievements() {
  const s=getStats();
  s.achievements=s.achievements||[];
  let gained=false;
  ACHIEVEMENTS.forEach(a=>{
    if(s.achievements.includes(a.id))return;
    if(a.check(s)){ s.achievements.push(a.id); gained=true; showUnlockToast('成就解锁 · '+a.name); }
  });
  if(gained) saveStats(s);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  setupRenderer(); setupCamera(); initTextures(); setupScene(); setupLighting();
  createCitySurfaces({
    scene,
    isNight,
    roadCoords: ROAD_COORDS,
    cityLimit: CITY_LIMIT,
    colors: { asphalt: P.ASPHALT, dayPath: P.DAY_PATH, nightPath: P.NIGHT_PATH },
    createMaterial: stdMat,
    pathMaterials: pathMats,
    groundMaterials: groundMats,
    addLamps,
  });
  addFountain();
  addBuildings(); cacheBuildingBoxes(); addDecorations(); addCharacters();
  addRealBuildingModels(scene, buildings)
    .then(() => { mapShotData = null; })
    .catch(error => console.error('3D model loading failed', error));
  addLabels(); applyRenames();
  setupEvents(); setupFilter();
  setupModal();
  applyTheme(isNight, true);
  initAnimations();
  clockInterval = window.setInterval(syncTimeAndTheme, 1000);
  syncTimeAndTheme();
  document.getElementById('labelsWrap').classList.add('hidden');
  animationFrame = requestAnimationFrame(loop);
  updateWelcome();

  checkLogin();
  setupMultiplayerUI();
}

// ── Renderer / Camera / Scene / Lighting ──────────────────────────────────────
function setupRenderer() {
  const canvas = document.getElementById('c');
  renderer = createRenderer(canvas);
}
function setupCamera() {
  cameraZoom=CONFIG.cameraNearSize;
  const vs = cameraZoom;
  camera = new THREE.OrthographicCamera(-vs,vs,vs,-vs,0.1,120);
  updateCameraProjection(vs);
  setCameraTarget(0,0,true);
}
function setupScene() {
  scene = new THREE.Scene();
  scene.background = isNight ? TEX.skyNight : TEX.skyDay;
  if (!scene.background) scene.background = new THREE.Color(isNight ? P.NIGHT_BG : P.DAY_BG);
  (window as any).__mini = () => ({ scene, camera, renderer, cameraZoom, THREE });
}
function setupLighting() {
  const amb = new THREE.AmbientLight(0xFAF8F4, isNight ? 0.60 : 1.05);
  amb.name = 'amb'; scene.add(amb);
  const dir = new THREE.DirectionalLight(0xFFFFFF, isNight ? 0.30 : 0.55);
  dir.name = 'dir'; dir.position.set(18,28,12); dir.castShadow = true;
  const shadowSize = MOBILE() ? 512 : 1024;
  dir.shadow.mapSize.set(shadowSize,shadowSize);
  dir.shadow.camera.left=-45; dir.shadow.camera.right=45;
  dir.shadow.camera.top=45;   dir.shadow.camera.bottom=-45;
  dir.shadow.camera.near=0.5; dir.shadow.camera.far=120;
  dir.shadow.bias=-0.0006; dir.shadow.normalBias=0.02;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xD8E8FF, 0.18);
  fill.position.set(-6,8,-6); scene.add(fill);
}
// ── Fountain (city-center landmark, made prominent) ──────────────────────────
function addFountain() {
  const g = new THREE.Group();
  // Outer stone rim — raised above ground so it's clearly visible
  const rimY = 0.18;  // rim center, half-height 0.18 → bottom at y=0, top at y=0.36
  part(g, new THREE.CylinderGeometry(1.8, 1.9, 0.36, 48), {color:P.FOUNTAIN_RIM, roughness:0.75, tex:'stone', rx:6, ry:1}, [0, rimY, 0], true);
  // Inner water surface — bright blue, slightly below rim top
  // Keep water below the basin lip; coplanar top faces caused blue z-fighting.
  part(g, new THREE.CylinderGeometry(1.55, 1.55, 0.03, 48), {color:P.FOUNTAIN_WATER, roughness:0.05, metalness:0.2, transparent:true, opacity:0.85}, [0, 0.335, 0], false);
  // Tier 2 — smaller upper basin
  part(g, new THREE.CylinderGeometry(0.85, 0.95, 0.18, 32), {color:P.FOUNTAIN_RIM, roughness:0.75, tex:'stone', rx:3, ry:1}, [0, 0.45, 0], true);
  part(g, new THREE.CylinderGeometry(0.7, 0.7, 0.03, 32), {color:P.FOUNTAIN_WATER, roughness:0.05, metalness:0.2, transparent:true, opacity:0.85}, [0, 0.54, 0], false);
  // Central spout column
  part(g, new THREE.CylinderGeometry(0.12, 0.15, 0.7, 16), {color:0xD4D3D0, roughness:0.55, tex:'stone', rx:1, ry:1}, [0, 0.65, 0], true);
  // Water jet — glowing blue sphere on top
  part(g, new THREE.SphereGeometry(0.18, 16, 16), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.45, roughness:0.2, metalness:0.3}, [0, 1.1, 0], false);
  // Surrounding spray droplets — small spheres scattered
  for (let i = 0; i < 8; i++) {
    const a = (i/8)*Math.PI*2;
    const d = 0.25 + Math.random()*0.15;
    part(g, new THREE.SphereGeometry(0.04 + Math.random()*0.03, 8, 8), {color:0xA8C8F8, emissive:0x6A8FE0, emissiveIntensity:0.2, transparent:true, opacity:0.7, roughness:0.3}, [Math.cos(a)*d, 1.0 + Math.random()*0.2, Math.sin(a)*d], false);
  }
  // Stone bench ring around the fountain (for citizens to sit)
  for (let i = 0; i < 8; i++) {
    const a = (i/8)*Math.PI*2;
    const bx = Math.cos(a)*2.5, bz = Math.sin(a)*2.5;
    part(g, new THREE.BoxGeometry(0.6, 0.12, 0.25), {color:0xC4A86D, roughness:0.7, tex:'stone', rx:1, ry:1}, [bx, 0.06, bz]).rotation.y = -a + Math.PI/2;
  }
  scene.add(g);
}

// ── Building shapes ───────────────────────────────────────────────────────────
function tagMeshes(g, id) {
  g.traverse(c => { if (c.isMesh) c.userData.buildingId = id; });
}
function mkBodyMat(texKey, rx, ry) {
  const m = stdMat({color:P.BUILDING_WHITE,roughness:0.08, tex:texKey, rx:rx, ry:ry});
  m.emissive = new THREE.Color(P.BLUE); m.emissiveIntensity = 0;
  return m;
}

// 01 ACTIVITY — treasury / bank with columns and gold dome
function buildBank(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.1+0.42+0.5};
}

// 02 BULLETIN — board with two posts and small roof
function buildBoard(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.15+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body:board, bodyMat:boardMat, labelEl:null, labelY:0.15+1.64+0.5};
}

// 03 TECHHALF — tall elegant tower (reuse existing tower design)
function buildTower(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:tipY+0.5};
}

// 04 BLACKHOLE — dark tower with swirling aura
function buildDarkTower(cfg) {
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
  // Blue entrance disc
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+1.4+0.5};
}

// 05 LAWS — pavilion with cone roof (reuse existing pavilion)
function buildPavilion(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:bodyTop+0.1+coneH+0.6};
}

// 06 LIBRARY — wide classical building with pediment and columns
function buildLibrary(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.1+0.7+0.5+0.4};
}

// 07 LITREVIEW — abandoned ruins with broken top
function buildRuins(cfg) {
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
  // Faded entrance disc
  part(g, new THREE.CylinderGeometry(0.12,0.12,0.04,16), {color:0x7A7A82,emissive:0x4A4A52,emissiveIntensity:0.1}, [0,0.22+0.022,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.6};
}

// 08 CATCAFE — very tall thin skyscraper with banded floors
function buildSkyscraper(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
}

// 09 ACADEMY — wide campus with annex (reuse existing campus)
function buildCampus(cfg) {
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
  [[-0.7,0.22],[0,0.18],[0.75,0.26]].forEach(([rx,rh]) => {
    part(g, new THREE.BoxGeometry(0.32,rh,0.32), {color:0xF0EFEC,roughness:0.3,tex:'stone',rx:1,ry:1}, [rx,mainTop+0.1+rh/2,-0.5]);
  });
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:mainTop+0.7};
}

// 10/11 KIOSK — small square structure with awning (for news & mutualaid)
function buildKiosk(cfg) {
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
  // Window cutout (simulated with darker box)
  part(g, new THREE.BoxGeometry(bw*0.7,bh*0.5,0.04), {color:0x4A6FA8,roughness:0.1,metalness:0.3,tex:'glass',rx:1,ry:1}, [0,0.2+bh*0.5,bw/2+0.02]);
  // Sign on top
  part(g, new THREE.BoxGeometry(bw*0.6,0.3,0.05), {color:accentColor,roughness:0.4,tex:'wood',rx:1,ry:1}, [0,top+0.08+0.15,0]);
  // Blue accent disc
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
}

// 12 SCREEN — wall structure with glowing blue screen
function buildScreen(cfg) {
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
  part(g, new THREE.BoxGeometry(bw*0.8,bh*0.7,0.05), screenMat, [0,0.25+bh*0.5,0.41], false);
  // Screen frame
  part(g, new THREE.BoxGeometry(bw*0.85,bh*0.75,0.05), {color:0x2A2A30,roughness:0.3}, [0,0.25+bh*0.5,0.34], false);
  // Screen glow lines
  for (let i = 0; i < 4; i++) {
    part(g, new THREE.BoxGeometry(bw*0.6,0.03,0.03), {color:0xA8C8F8,emissive:0xA8C8F8,emissiveIntensity:0.2}, [0,0.25+bh*0.3+i*0.4,0.475], false);
  }
  // Antenna on top
  part(g, new THREE.CylinderGeometry(0.03,0.03,0.5,6), {color:0xD0CFCC,roughness:0.5}, [0,top+0.12+0.25,0]);
  part(g, new THREE.SphereGeometry(0.06,8,8), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.3}, [0,top+0.12+0.5,0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.12+0.5+0.5};
}

// 13 ELEVATOR — tall narrow shaft with door and button panel
function buildShaft(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
}

// 14 RESIDENTID — stone altar with paper on top
function buildAltar(cfg) {
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
  [[-0.8,-0.8],[-0.8,0.8],[0.8,-0.8],[0.8,0.8]].forEach(([cx,cz]) =>
    part(g, new THREE.CylinderGeometry(0.07,0.08,bh,8), {color:0xDEDDE0,roughness:0.5}, [cx,0.2+bh/2,cz]));
  // Decorative arch
  part(g, new THREE.BoxGeometry(1.6,0.08,0.1), {color:0xE8E7E4,roughness:0.5}, [0,top+0.5,0]);
  part(g, new THREE.CylinderGeometry(0.04,0.04,0.5,6), {color:0xD0CFCC,roughness:0.5}, [-0.7,top+0.3,0]);
  part(g, new THREE.CylinderGeometry(0.04,0.04,0.5,6), {color:0xD0CFCC,roughness:0.5}, [0.7,top+0.3,0]);
  // Quill pen
  part(g, new THREE.CylinderGeometry(0.02,0.02,0.4,6), {color:0xE8E7E4,roughness:0.5}, [0.3,top+0.12+0.2,0.2]);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5+0.3};
}

// 15 STATS — octagonal observatory with pulsing glow ring
function buildObservatory(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.22+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  const labelY = domeY+1.1+0.5;
  return {...cfg, group:g, body, bodyMat, glowMat, labelEl:null, labelY};
}

// 16 PAGODA — multi-tiered Asian tower
function buildPagoda(cfg) {
  const g = new THREE.Group();
  const tiers = 3, bw = 1.6, tierH = 0.6;
  let y = PLH;
  // Keep the facade on the actual closed wall meshes. A detached facade plane
  // leaves visible gaps around the stepped tiers and can be mistaken for a wall.
  const bodyMat = mkBodyMat('facade_pagoda', 1, 1);
  let body = null;
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:y+0.5};
}

// 17 MARKET — open-air stalls with striped awning
function buildMarket(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:0.2+bh+0.5};
}

// 18 GREENHOUSE — glass dome with plants
function buildGreenhouse(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:0.2+bh+bw/2+0.3};
}

// 19 CLOCKTOWER — tall brick tower with clock faces
function buildClockTower(cfg) {
  const g = new THREE.Group();
  const bw = 1.5, bh = 4.0;
  part(g, new THREE.BoxGeometry(2.2,PLH,2.2), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,PLH/2,0]);
  const bodyMat = mkBodyMat('brick', 1, 3);
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = PLH+bh;
  // Clock face (4 sides)
  const clockPositions = [[0,0,bw/2+0.03],[0,0,-bw/2-0.03],[bw/2+0.03,0,0],[-bw/2-0.03,0,0]];
  const clockRotations = [0, Math.PI, Math.PI/2, -Math.PI/2];
  clockPositions.forEach(([px,,pz], i) => {
    part(g, new THREE.CylinderGeometry(0.3,0.3,0.04,20), {color:0xF8F4E8,roughness:0.3,emissive:0xF8F4E8,emissiveIntensity:0.05}, [px, top-0.6, pz], false).rotation.x = Math.PI/2;
    part(g, new THREE.BoxGeometry(0.02,0.28,0.02), {color:0x2A2A2A,roughness:0.4}, [px, top-0.55, pz], false);
    part(g, new THREE.BoxGeometry(0.22,0.02,0.02), {color:0x2A2A2A,roughness:0.4}, [px, top-0.5, pz], false);
  });
  // Pyramidal roof
  part(g, new THREE.ConeGeometry(1.1,0.8,4), {color:0x8A5A3A,roughness:0.5,tex:'rooftile',rx:2,ry:1}, [0,top+0.4,0]).rotation.y = Math.PI/4;
  // Weather vane
  part(g, new THREE.CylinderGeometry(0.02,0.02,0.3,6), {color:0xD0CFCC,roughness:0.5,tex:'metal',rx:1,ry:1}, [0,top+0.8+0.15,0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.8+0.5};
}

// 20 TEMPLE — classical Greek-style temple
function buildTemple(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.8+0.5};
}

// 21 FACTORY — industrial building with chimney
function buildFactory(cfg) {
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
  // Loading door
  part(g, new THREE.BoxGeometry(0.6,0.8,0.04), {color:0x4A6FA8,roughness:0.3,metalness:0.4,tex:'metal',rx:1,ry:1}, [0,0.2+0.4,bw/2+0.02], false);
  // Side pipes
  part(g, new THREE.CylinderGeometry(0.04,0.04,1.2,8), {color:0x8A8A8E,roughness:0.4,metalness:0.3,tex:'metal',rx:1,ry:1}, [-bw/2+0.3,0.2+0.6,bw/2+0.02], false);
  // Windows
  for (let i = 0; i < 3; i++) {
    part(g, new THREE.BoxGeometry(0.4,0.4,0.02), {color:0xA8C8F8,roughness:0.1,metalness:0.2,tex:'glass',rx:1,ry:1}, [-0.8+i*0.8, 0.2+bh*0.6, bw/2+0.02], false);
  }
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+1.5};
}

// 22 MALL — large shopping center with glass facade, billboard, entrance awning
function buildMall(cfg) {
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
  // Rooftop sign / billboard
  part(g, new THREE.BoxGeometry(2.4,0.55,0.12), {color:P.MALL_SIGN,emissive:P.MALL_SIGN,emissiveIntensity:0.22,roughness:0.3,tex:'fabric',rx:2,ry:1}, [0,top+0.18+0.275+roofLift,bd/2-0.3]);
  part(g, new THREE.BoxGeometry(0.1,0.55,0.1), {color:0x6A6A6E,roughness:0.5,metalness:0.3,tex:'metal',rx:1,ry:1}, [-1.0,top+0.18+0.275+roofLift,bd/2-0.3]);
  part(g, new THREE.BoxGeometry(0.1,0.55,0.1), {color:0x6A6A6E,roughness:0.5,metalness:0.3,tex:'metal',rx:1,ry:1}, [1.0,top+0.18+0.275+roofLift,bd/2-0.3]);
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.18+0.55+0.5};
}

// 23 SCHOOL — multi-building campus with playground, flagpole
function buildSchool(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.22+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.7};
}

// helper: small window cross bars for school
function ctx2d_windows(g, x, y, z) {
  part(g, new THREE.BoxGeometry(0.45,0.02,0.025), {color:0x4A4A4E,roughness:0.5,tex:'metal',rx:1,ry:1}, [x, y+0.21, z+0.005], false);
  part(g, new THREE.BoxGeometry(0.02,0.45,0.025), {color:0x4A4A4E,roughness:0.5,tex:'metal',rx:1,ry:1}, [x, y, z+0.005], false);
}

// 30 KINGICE — crown-shaped golden building with "King Ice" text
function buildCrown(cfg) {
  const g = new THREE.Group();
  // Stone base
  part(g, new THREE.CylinderGeometry(1.8, 2.0, 0.3, 32), {color:P.BUILDING_BASE,roughness:0.8,tex:'stone',rx:1,ry:1}, [0,0.15,0]);
  // Crown band — main cylinder body with golden "King Ice" texture
  const bodyMat = stdMat({color:0xE8A838,roughness:0.25,metalness:0.35,tex:'kingice',rx:1,ry:1});
  bodyMat.emissive = new THREE.Color(P.GOLD); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.CylinderGeometry(1.5, 1.6, 1.6, 32), bodyMat);
  body.position.y = 0.3 + 0.8; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = 0.3 + 1.6;
  // Gold rim at top of band
  part(g, new THREE.CylinderGeometry(1.58, 1.58, 0.08, 32), {color:P.GOLD,roughness:0.2,metalness:0.5,tex:'metal',rx:1,ry:1}, [0, top + 0.04, 0]);
  // Gold rim at bottom of band
  part(g, new THREE.CylinderGeometry(1.62, 1.62, 0.08, 32), {color:P.GOLD,roughness:0.2,metalness:0.5,tex:'metal',rx:1,ry:1}, [0, 0.34, 0]);
  // 5 crown points (teeth) — evenly spaced around the top rim
  const pointCount = 5;
  const crownGemColors = [0x3B6FE0, 0xE85858, 0x5A8A3A, 0xA858E8, 0xE8A838];
  for (let i = 0; i < pointCount; i++) {
    const angle = (i / pointCount) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * 1.25;
    const pz = Math.sin(angle) * 1.25;
    // Tapered crown point — wider at base, narrow at tip
    const pointH = 0.75 + (i % 2) * 0.15; // alternate heights for variety
    part(g, new THREE.CylinderGeometry(0.06, 0.22, pointH, 6), {color:P.GOLD,roughness:0.2,metalness:0.45,tex:'metal',rx:1,ry:1}, [px, top + 0.08 + pointH / 2, pz]);
    // Gem at each tip
    part(g, new THREE.SphereGeometry(0.1, 12, 12), {color:crownGemColors[i],emissive:crownGemColors[i],emissiveIntensity:0.35,roughness:0.15,metalness:0.4}, [px, top + 0.08 + pointH + 0.1, pz], false);
  }
  // Short crown points between the tall ones (fill the gaps for full crown look)
  for (let i = 0; i < pointCount; i++) {
    const angle = ((i + 0.5) / pointCount) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(angle) * 1.35;
    const pz = Math.sin(angle) * 1.35;
    const pointH = 0.4;
    part(g, new THREE.CylinderGeometry(0.04, 0.18, pointH, 6), {color:P.GOLD,roughness:0.2,metalness:0.45,tex:'metal',rx:1,ry:1}, [px, top + 0.08 + pointH / 2, pz]);
    // Small gem at tip
    part(g, new THREE.SphereGeometry(0.06, 8, 8), {color:0xFFF8E0,emissive:0xFFF8E0,emissiveIntensity:0.25,roughness:0.2,metalness:0.3}, [px, top + 0.08 + pointH + 0.06, pz], false);
  }
  // Blue entrance disc at base
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.3+0.026,0], false);
  // Label Y for floating tag
  const labelY = top + 0.08 + 0.85 + 0.5;
  g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY};
}

// 30 BANANA PALACE — 布拿拉宫
function buildBanana(cfg) {
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
  part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, PLH+0.026, 0], false);
  g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY: PLH+bh+0.4+1.5+0.5};
}

// 31 QIPAI — 棋气派 grand chess-themed building
function buildQipai(cfg) {
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
  kingG.traverse(c => { if (c.isMesh) c.castShadow = true; });
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
  queenG.traverse(c => { if (c.isMesh) c.castShadow = true; });
  g.add(queenG);
  // Grand entrance
  part(g, new THREE.BoxGeometry(1.8, 0.1, 0.1), {color:P.ROOF_RIM, roughness:0.4, tex:'stone', rx:1, ry:1}, [0, PLH+1.8, bd/2+0.02], false);
  part(g, new THREE.BoxGeometry(0.3, 1.8, 0.1), {color:0x2A2A2E, roughness:0.3, tex:'stone', rx:1, ry:1}, [-0.9, PLH+0.9, bd/2+0.02], false);
  part(g, new THREE.BoxGeometry(0.3, 1.8, 0.1), {color:0x2A2A2E, roughness:0.3, tex:'stone', rx:1, ry:1}, [0.9, PLH+0.9, bd/2+0.02], false);
  // Checker floor
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const cw = 0.4, cx = -1.5 + c*cw + cw/2, cz = bd/2 + 0.3 + r*cw + cw/2;
    part(g, new THREE.BoxGeometry(cw-0.02, 0.02, cw-0.02), {color:(r+c)%2===0?0x2A2A2E:0xF8F7F5, roughness:0.3}, [cx, PLH+0.01, cz], false);
  }
  part(g, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.28}, [0, PLH+0.026, 0], false);
  g.position.set(cfg.x, 0, cfg.z); tagMeshes(g, cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY: top+0.3+0.25+0.5};
}

// Pigeon sculpture
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
const PLOT_MAP = {
  bank:{tex:'ground5',size:4.5,color:0xE8E7E4}, board:{tex:'ground5',size:3.0,color:0xE4E3E0},
  tower:{tex:'ground5',size:4.0,color:0xD8D7D2}, darktower:{tex:'ground6',size:4.0,color:0x9A988E},
  pavilion:{tex:'ground4',size:4.5,color:0xC0D0A0}, library:{tex:'ground5',size:4.0,color:0xE8E7E4},
  ruins:{tex:'ground2',size:3.5,color:0xE0D8CC}, skyscraper:{tex:'ground5',size:3.5,color:0xD8D7D2},
  campus:{tex:'ground5',size:4.5,color:0xE8E7E4}, kiosk:{tex:'ground5',size:3.0,color:0xE4E3E0},
  screen:{tex:'ground5',size:4.0,color:0xD8D7D2}, shaft:{tex:'ground5',size:3.0,color:0xD8D7D2},
  altar:{tex:'ground5',size:3.5,color:0xE4E3E0}, observatory:{tex:'ground5',size:4.0,color:0xE8E7E4},
  pagoda:{tex:'ground4',size:4.0,color:0xC0D0A0}, market:{tex:'ground5',size:4.5,color:0xE4E3E0},
  greenhouse:{tex:'ground4',size:4.0,color:0xB8C888}, clocktower:{tex:'ground5',size:4.0,color:0xE4E3E0},
  temple:{tex:'ground5',size:4.5,color:0xF0EFEC}, factory:{tex:'ground2',size:5.0,color:0xC8C4B8},
  mall:{tex:'ground5',size:5.5,color:0xD8D7D2}, school:{tex:'ground4',size:5.0,color:0xB8C888},
  crown:{tex:'ground5',size:4.5,color:0xF0EFEC}, banana:{tex:'ground2',size:6.0,color:0xE0D8A0},
  qipai:{tex:'ground5',size:8.0,color:0xE4E3E0},
};
function addBuildingPlot(x, z, shape) {
  const p = PLOT_MAP[shape] || {tex:'ground5', size:3.5, color:0xE4E3E0};
  const mat = stdMat({color: isNight ? Math.floor(p.color*0.7) : p.color, roughness:0.9, tex:p.tex, rx:Math.max(1,p.size/2), ry:Math.max(1,p.size/2)});
  mat.depthWrite = false;
  const plot = new THREE.Mesh(new THREE.PlaneGeometry(p.size, p.size), mat);
  const plotJitter = (Math.abs(Math.round(x*7 + z*13)) % 8) * 0.0015;
  plot.rotation.x = -Math.PI/2; plot.position.set(x, SURFACE_Y.buildingPlot + plotJitter, z); plot.receiveShadow = true;
  plot.renderOrder = RENDER_ORDER.buildingPlot; scene.add(plot);
}

const SHAPE_FNS = {
  bank:buildBank, board:buildBoard, tower:buildTower, darktower:buildDarkTower,
  pavilion:buildPavilion, library:buildLibrary, ruins:buildRuins,
  skyscraper:buildSkyscraper, campus:buildCampus, kiosk:buildKiosk,
  screen:buildScreen, shaft:buildShaft, altar:buildAltar, observatory:buildObservatory,
  pagoda:buildPagoda, market:buildMarket, greenhouse:buildGreenhouse,
  clocktower:buildClockTower, temple:buildTemple, factory:buildFactory,
  mall:buildMall, school:buildSchool, crown:buildCrown,
  banana:buildBanana, qipai:buildQipai
};

function addBuildings() {
  const FACADE_MAP = {
    bank:'facade_bank',board:'facade_board',tower:'facade_tower',darktower:'facade_darktower',
    pavilion:'facade_temple',library:'facade_library',ruins:'facade_library',
    skyscraper:'facade_skyscraper',campus:'facade_campus',kiosk:'facade_kiosk',
    screen:'facade_screen',shaft:'facade_shaft',altar:'facade_altar',
    observatory:'facade_observatory',market:'facade_market',
    greenhouse:'facade_greenhouse',clocktower:'facade_clocktower',temple:'facade_temple',
    factory:'facade_factory',mall:'facade_mall',school:'facade_school',
    banana:'facade_banana',qipai:'facade_qipai'
  };
  BUILDING_DEFS.forEach(cfg => {
    const b = SHAPE_FNS[cfg.shape](cfg);
    // Facade planes are only valid for rectangular bodies. Curved buildings
    // carry their facade texture directly on the mesh so their outline stays
    // circular and the texture closes around the circumference.
    if (b.body && b.body.geometry && b.body.geometry.parameters) {
      const p = b.body.geometry.parameters;
      const isBoxBody = p.width !== undefined && p.height !== undefined && p.depth !== undefined;
      const bw = p.width, bh = p.height, bd = p.depth;
      const fk = cfg.facade || FACADE_MAP[cfg.shape];
      if (isBoxBody && fk && bw > 0.3 && bh > 0.3) {
        addFacade(b.group, fk, bw, bh, b.body.position.y, bd/2 + 0.012);
        const f2 = addFacade(b.group, fk, bw, bh, b.body.position.y, -(bd/2 + 0.012));
        if (f2) f2.rotation.y = Math.PI;
        if (bd > 0.3) {
          const f3 = addFacade(b.group, fk, bd, bh, b.body.position.y, 0, 0);
          if (f3) { f3.position.x = -(bw/2 + 0.012); f3.rotation.y = -Math.PI/2; }
          const f4 = addFacade(b.group, fk, bd, bh, b.body.position.y, 0, 0);
          if (f4) { f4.position.x = bw/2 + 0.012; f4.rotation.y = Math.PI/2; }
        }
      }
    }
    b.group.position.y = -3; // Start hidden below ground for entrance animation
    scene.add(b.group); buildings.push(b);
    // Add ground plot under the building
    addBuildingPlot(cfg.x, cfg.z, cfg.shape);
  });
  raycastBuildingGroups = buildings.map(b => b.group);
}

// ── Decorations ───────────────────────────────────────────────────────────────
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
    part(g,new THREE.BoxGeometry(0.22,0.16,0.03),{color:0xB8CCEA,emissive:0xA8C8F8,emissiveIntensity:isNight?0.12:0.02,roughness:0.2},[wx,wy,d/2+0.02],false);
  }
  const residenceId=`residence:${x.toFixed(2)}:${z.toFixed(2)}`;
  g.position.set(x,y,z); g.rotation.y=(i%4)*Math.PI/2;
  g.traverse((object)=>{ if(object.isMesh) object.userData.residenceId=residenceId; });
  scene.add(g); raycastBuildingGroups.push(g);
  residences.push({id:residenceId,label:`${Math.round(x)}, ${Math.round(z)} 号住宅`,group:g,labelEl:null});
  // ── 建筑下面的小地块贴图（成片共享纹理）──
  const plotTexs = ['ground5','ground4','ground2','ground','ground5','ground2','ground4','ground5'];
  const plotTex = plotTexs[Math.abs(Math.round(x+z)) % plotTexs.length];
  const plotColors = [0xE4E3E0, 0xC0D0A0, 0xE0D8CC, 0xF2F1EE, 0xE8E7E4, 0xD8D4CC, 0xB8C888, 0xE4E3E0];
  const plotCol = plotColors[Math.abs(Math.round(x+z)) % plotColors.length];
  const pmat = stdMat({color: isNight ? Math.floor(plotCol*0.7) : plotCol, roughness:0.9, tex:plotTex, rx:1, ry:1});
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
      resources.material({kind:'tree-crown'},()=>stdMat({color:0xF5F4F2,roughness:0.85})), 512);
  }
  positions.forEach(([x,,z]) => {
    treeTrunks.add(x,0.19,z);
    treeCrowns.add(x,0.66,z);
  });
}
function addLamps(positions) {
  if (!lampPosts) {
    const postMaterial=resources.material({kind:'lamp-post'},()=>stdMat({color:0xCDCCCA,roughness:0.7,tex:'metal',rx:1,ry:1}));
    const globeMaterial=resources.material({kind:'lamp-light'},()=>stdMat({color:0xF8F7F5,roughness:0.15,emissive:0xEEF0FF,emissiveIntensity:isNight?0.6:0.05}));
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
function makeCharacter(headHex, bodyHex) {
  const g=new THREE.Group();
  const shadow=mk(new THREE.CircleGeometry(0.17,16),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.11,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=0.012; g.add(shadow);
  const body=mk(new THREE.CylinderGeometry(0.10,0.13,0.30,12),stdMat({color:bodyHex,roughness:0.6}));
  body.position.y=0.15; body.castShadow=true; g.add(body);
  const head=mk(new THREE.SphereGeometry(0.135,14,14),stdMat({color:headHex,roughness:0.5}));
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
  if(mapMode||dialogOpen||!cursorChar||!cursorChar.visible)return;
  if(cameraZoom>6.5){ // 视角还不够大的时候才放大
    const state={z:cameraZoom};
    gsap.killTweensOf(state);
    gsap.to(state,{z:6.5,duration:0.45,ease:'power2.out',onUpdate:()=>{
      cameraZoom=state.z; updateCameraProjection(cameraZoom);
    }});
  }
  highlightPlayerMarker();
}

function highlightPlayerMarker() {
  const cone=playerMarker&&playerMarker.children[0];
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
    g.traverse(c=>{ if(c.isMesh) c.userData.npcId=profile.id; });
    const start=new THREE.Vector3(profile.home[0],0,profile.home[1]);
    g.position.copy(start); scene.add(g);
    const npc={profile, mesh:g, tween:null, spawnTimer:Math.random()*10, idleTimer:0};
    npcList.push(npc);
    if(profile.behavior==='rare') g.visible=false;
    if (!MOBILE()) npcRoutine(npc);
  });
  cursorChar=makeCharacter(0xA8C8F8,0x3B6FE0);
  // Spawn point offset slightly from center — per user request
  cursorChar.position.set(0, 0, -6);
  cursorChar.visible=false; scene.add(cursorChar);
  playerMarker=makePlayerMarker();
  playerMarker.position.y=0.95; cursorChar.add(playerMarker);
}

function hoursInRange(h, wh) {
  if(!wh) return false;
  const [s,e]=wh;
  if(s===e) return true;
  if(s<e) return h>=s && h<e;
  return h>=s || h<e;
}

function npcDesiredTarget(npc) {
  const dest = hoursInRange(gameClock, npc.profile.workHours)
    ? (npc.profile.work || npc.profile.home) : npc.profile.home;
  return new THREE.Vector3(dest[0],0,dest[1]);
}

function pickPatrolSpot(npc) {
  const radius = hoursInRange(gameClock, npc.profile.workHours) ? 3.5 : 2.5;
  const center = npcDesiredTarget(npc);
  const pool=[];
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
  return pool[Math.floor(Math.random()*pool.length)];
}

// NPCs step aside when the player walks into them instead of blocking the road.
function npcYieldToPlayer(npc) {
  if (!cursorChar || !cursorChar.visible) return;
  const dx=npc.mesh.position.x-cursorChar.position.x;
  const dz=npc.mesh.position.z-cursorChar.position.z;
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

function npcRoutine(npc) {
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
    if (currentFilter==='friends') {
      if(npc.mesh.visible){ npc.mesh.visible=false; if(npc.tween){ npc.tween.kill(); npc.tween=null; } }
      return;
    }
    const behavior=npc.profile.behavior||'field';
    if (behavior==='rare') {
      npc.spawnTimer-=1;
      if(npc.spawnTimer<=0){
        npc.spawnTimer=14+Math.random()*18;
        const appear=Math.random()<npc.profile.spawnChance;
        npc.mesh.visible=appear;
        if(appear && visibleRare>=MAX_RARE_VISIBLE_NPCS){
          npc.mesh.visible=false;
          npc.spawnTimer=6+Math.random()*8;
        } else if(appear){
          visibleRare+=1;
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

function walkAlongPath(npc, path) {
  if (npc.walking===false) return;
  if (!path.length) {
    npc.tween=null;
    return;
  }
  const target=path.shift();
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

function nearestNpcTo(p, radius) {
  let best=null, bestD=radius;
  npcList.forEach(npc=>{
    if(!npc.mesh.visible)return;
    const d=npc.mesh.position.distanceTo(p);
    if(d<bestD){ bestD=d; best=npc; }
  });
  return best;
}

function npcForRaycast() {
  const visible=npcList.filter(n=>n.mesh.visible);
  const hits=raycaster.intersectObjects(visible.map(n=>n.mesh),true);
  if(!hits.length)return null;
  const id=hits[0].object.userData.npcId;
  return npcList.find(n=>n.profile.id===id)||null;
}

// ── Labels ────────────────────────────────────────────────────────────────────
function addLabels() {
  const wrap=document.getElementById('labelsWrap');
  buildings.forEach(b=>{
    const el=document.createElement('a');
    el.className='b-label-item'; el.href='#'; el.tabIndex=0;
    el.setAttribute('aria-label',`${b.label}${b.isStats?' — open stats panel':' — 查看详情'}`);
    el.innerHTML=`<span class="bl-num">${b.num}</span><span class="bl-icon">${b.icon}</span><span class="bl-name">${b.label}</span>`;
    el.addEventListener('click',e=>{e.preventDefault();interactOrWalk(b);});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();interactOrWalk(b);}});
    if (!b.isStats) {
      el.querySelector('.bl-name').addEventListener('dblclick',e=>{
        e.preventDefault(); e.stopPropagation(); startRename(b, el.querySelector('.bl-name'));
      });
    }
    wrap.appendChild(el); b.labelEl=el;
  });
}

function applyRenames() {
  const saved=JSON.parse(localStorage.getItem('minicityRenames')||'{}');
  buildings.forEach(b=>{
    if(saved[b.id]&&b.labelEl) b.labelEl.querySelector('.bl-name').textContent=saved[b.id];
  });
}

function startRename(b, nameEl) {
  const current=nameEl.textContent;
  const input=document.createElement('input');
  input.className='bl-rename-input'; input.value=current; input.maxLength=16;
  nameEl.replaceWith(input); input.focus(); input.select();
  const finish=()=>{
    const val=input.value.trim()||current;
    const span=document.createElement('span');
    span.className='bl-name'; span.textContent=val;
    span.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();startRename(b,span);});
    input.replaceWith(span);
    const saved=JSON.parse(localStorage.getItem('minicityRenames')||'{}');
    saved[b.id]=val; localStorage.setItem('minicityRenames',JSON.stringify(saved));
  };
  input.addEventListener('blur',finish);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter') input.blur();
    if(e.key==='Escape'){input.value=current; input.blur();}
  });
}

// ── Events ────────────────────────────────────────────────────────────────────
function setupEvents() {
  const canvas=document.getElementById('c');
  const signal=eventController.signal;
  canvas.addEventListener('mousemove',onMouseMove,{signal});
  canvas.addEventListener('click',onCanvasClick,{signal});
  canvas.addEventListener('mouseenter',()=>{mouseOnScene=true;},{signal});
  canvas.addEventListener('mouseleave',()=>{mouseOnScene=false;},{signal});

  // PC：滚轮缩放
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const factor=e.deltaY>0?1.12:1/1.12;
    cameraZoom=clamp(cameraZoom*factor,CONFIG.cameraZoomMin,CONFIG.cameraZoomMax);
    updateCameraProjection(cameraZoom);
  },{passive:false,signal});

  // 移动端：双指缩放
  let pinchDist=0;
  canvas.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      pinchDist=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
    }
  },{passive:true,signal});
  canvas.addEventListener('touchmove',e=>{
    if(e.touches.length===2){
      e.preventDefault();
      const d=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
      if(pinchDist>0){
        cameraZoom=clamp(cameraZoom*pinchDist/d,CONFIG.cameraZoomMin,CONFIG.cameraZoomMax);
        updateCameraProjection(cameraZoom);
      }
      pinchDist=d;
    }
  },{passive:false,signal});

  document.getElementById('mapToggle').addEventListener('click',toggleMapMode,{signal});
  setupRenderSettings(signal);
  document.getElementById('renderSettingsClose').addEventListener('click',closeRenderSettings,{signal});
  document.getElementById('mapClose').addEventListener('click',()=>mapMode&&toggleMapMode(),{signal});
  document.querySelector('.you-block').addEventListener('click',onYouClick,{signal});
  document.getElementById('fsToggle').addEventListener('click',()=>{
    if(document.fullscreenElement){
      document.exitFullscreen().catch(()=>{});
    }else{
      document.documentElement.requestFullscreen().catch(()=>{});
    }
  },{signal});
  document.getElementById('mapOverlay').addEventListener('click',e=>{
    if(e.target.id==='mapOverlay'&&mapMode)toggleMapMode();
  },{signal});
  document.getElementById('mapTipClose').addEventListener('click',closeMapTip,{signal});
  document.getElementById('mapTipTele').addEventListener('click',()=>{
    if(!mapTipB||!teleportUnlocked())return;
    const b=mapTipB;
    closeMapTip();
    toggleMapMode();
    mapTeleport(b);
  },{signal});

  document.getElementById('spClose').addEventListener('click',closeStatsPanel,{signal});
  document.getElementById('spModeClean').addEventListener('click',()=>setStatsMode('clean'),{signal});
  document.getElementById('spModeRaw').addEventListener('click',()=>setStatsMode('raw'),{signal});
  document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        if(mapMode){toggleMapMode();return;}
       closeRenderSettings();closeStatsPanel();closeModal();closeNpcDialog();
    }
  },{signal});

  document.getElementById('loginBtn').addEventListener('click',doLogin,{signal});
  document.getElementById('loginInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();},{signal});
  document.getElementById('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();},{signal});

  document.getElementById('cgSkip').addEventListener('click',skipCG,{signal});

  window.addEventListener('resize',()=>{
    renderer.setSize(window.innerWidth,window.innerHeight);
    updateCameraProjection(cameraZoom);
    if(mapMode) updateMapImage();
  },{signal});
}

function setupRenderSettings(signal: AbortSignal) {
  const toggle = document.getElementById('renderSettingsToggle');
  const panel = document.getElementById('renderSettings');
  if (!toggle || !panel) return;
  const settings = readRenderSettings();
  const resolution = panel.querySelector('#renderResolution') as HTMLInputElement;
  const resolutionValue = panel.querySelector('#renderResolutionValue');
  const antialias = panel.querySelector('#renderAntialias') as HTMLInputElement;
  const anisotropy = panel.querySelector('#renderAnisotropy') as HTMLSelectElement;
  const anisotropyValue = panel.querySelector('#renderAnisotropyValue');
  const shadows = panel.querySelector('#renderShadows') as HTMLInputElement;
  const exposure = panel.querySelector('#renderExposure') as HTMLInputElement;
  const exposureValue = panel.querySelector('#renderExposureValue');
  resolution.value = String(settings.resolution);
  // Let the user push resolution all the way to (and beyond) the device pixel
  // ratio; on high-DPI screens that is real supersampling, not a no-op.
  if(resolution) {
    const dpr=window.devicePixelRatio||1;
    resolution.min='0.5';
    resolution.max=String(Math.max(4, dpr));
    resolution.step='0.25';
  }
  antialias.checked = settings.antialias;
  anisotropy.value = String(settings.anisotropy);
  shadows.checked = settings.shadows;
  exposure.value = String(settings.exposure);
  const updateLabels = () => {
    resolutionValue.textContent = `${resolution.value}x`;
    anisotropyValue.textContent = `${anisotropy.value}x`;
    exposureValue.textContent = Number(exposure.value).toFixed(2);
  };
  updateLabels();
  const close = closeRenderSettings;
  const saveAndReload = () => {
    localStorage.setItem(RENDER_SETTINGS_KEY, JSON.stringify({
      resolution: Number(resolution.value),
      antialias: antialias.checked,
      anisotropy: Number(anisotropy.value),
      shadows: shadows.checked,
      exposure: Number(exposure.value),
    }));
    window.location.reload();
  };
  toggle.addEventListener('click',e=>{
    e.stopPropagation();
    if (panel.classList.contains('open')) close();
    else {
      panel.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  },{signal});
  resolution.addEventListener('input',updateLabels,{signal});
  exposure.addEventListener('input',updateLabels,{signal});
  panel.querySelector('#renderSettingsApply').addEventListener('click',saveAndReload,{signal});
  panel.querySelector('#renderSettingsReset').addEventListener('click',()=>{
    localStorage.removeItem(RENDER_SETTINGS_KEY);
    window.location.reload();
  },{signal});
  document.addEventListener('click',e=>{
    if (panel.classList.contains('open') && !panel.contains(e.target as Node) && e.target !== toggle) close();
  },{signal});
}

function closeRenderSettings() {
  const panel = document.getElementById('renderSettings');
  const toggle = document.getElementById('renderSettingsToggle');
  panel?.classList.remove('open');
  toggle?.setAttribute('aria-expanded','false');
}

function onMouseMove(e) {
  mouse2D.x=(e.clientX/window.innerWidth)*2-1;
  mouse2D.y=-(e.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse2D,camera);
  raycaster.ray.intersectPlane(groundPlane,cursorWorld);
  raycaster.setFromCamera(mouse2D,camera);
  const hits=raycaster.intersectObjects(raycastBuildingGroups,true);
  if(hits.length){
    const id=hits[0].object.userData.buildingId;
    const b=buildings.find(x=>x.id===id);
    if(b&&b!==hoveredB){if(hoveredB)unhover(hoveredB);hover(b);}
  } else{if(hoveredB)unhover(hoveredB);hoveredB=null;}
}

// ── Multiplayer ────────────────────────────────────────────────────────────────
function setupMultiplayerUI() {
  const toggle = document.getElementById('onlinePanelToggle');
  const panel = document.getElementById('onlinePanel');
  const closeBtn = document.getElementById('phoneClose');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  if (!toggle || !panel || !form || !input) return;
  const claimClose = document.getElementById('residenceClaimClose');
  const claimCancel = document.getElementById('residenceClaimCancel');
  const claimSubmit = document.getElementById('residenceClaimSubmit');
  const applyButton = document.getElementById('residenceApply');
  const navigateButton = document.getElementById('residenceNavigate');
  const claimInput = document.getElementById('residenceNameInput');
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setPhoneOpen(!panel.classList.contains('open'));
  }, { signal: eventController.signal });
  closeBtn?.addEventListener('click', () => setPhoneOpen(false), { signal: eventController.signal });
  document.addEventListener('click', (event) => {
    if (panel.classList.contains('open') && !panel.contains(event.target) && !toggle.contains(event.target)) setPhoneOpen(false);
  }, { signal: eventController.signal });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    multiplayer?.chat(text);
    input.value = '';
  }, { signal: eventController.signal });
  document.querySelectorAll('[data-online-tab]').forEach((tab) => tab.addEventListener('click', () => {
    const target = tab.dataset.onlineTab;
    document.querySelectorAll('[data-online-tab]').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.online-view').forEach((view) => view.classList.toggle('active', view.id === `online${target === 'chat' ? 'Chat' : 'Houses'}View`));
    if (target === 'chat') clearUnreadChats();
  }, { signal: eventController.signal }));
  claimClose?.addEventListener('click', closeResidencePanel, { signal: eventController.signal });
  claimCancel?.addEventListener('click', closeResidencePanel, { signal: eventController.signal });
  claimSubmit?.addEventListener('click', () => {
    if (!residenceClaimId) return;
    const name = claimInput?.value.trim() || '';
    if (!name) { claimInput?.focus(); return; }
    if (multiplayer?.user) {
      claimSubmit.setAttribute('disabled', 'true');
      multiplayer.housing('claim', { buildingId: residenceClaimId, name });
    } else {
      showUnlockToast('联机后才能认领住宅');
    }
  }, { signal: eventController.signal });
  navigateButton?.addEventListener('click', () => {
    if (residenceClaimId) navigateToResidence(residenceClaimId);
  }, { signal: eventController.signal });
  applyButton?.addEventListener('click', () => {
    if (!residenceClaimId || applyButton.hasAttribute('disabled')) return;
    multiplayer?.housing('apply', { buildingId: residenceClaimId });
    applyButton.setAttribute('disabled', 'true');
    applyButton.textContent = '申请中';
    showUnlockToast('入住申请已发送');
  }, { signal: eventController.signal });
  document.getElementById('residenceClaim')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeResidencePanel();
  }, { signal: eventController.signal });
}

// 打开/收起“居民手机”，并同步悬浮按钮状态与未读角标
function setPhoneOpen(open) {
  const panel = document.getElementById('onlinePanel');
  const toggle = document.getElementById('onlinePanelToggle');
  if (!panel || !toggle) return;
  panel.classList.toggle('open', open);
  toggle.classList.toggle('active', open);
  toggle.setAttribute('aria-expanded', String(open));
  if (open && document.querySelector('[data-online-tab="chat"]')?.classList.contains('active')) clearUnreadChats();
}

function bumpUnreadChats() {
  unreadChats += 1;
  updatePhoneBadge();
}

function updatePhoneBadge() {
  const badge = document.getElementById('phoneBadge');
  if (!badge) return;
  const total = unreadChats + pendingHousingRequests;
  badge.hidden = total === 0;
  badge.textContent = total > 99 ? '99+' : String(total);
}

function clearUnreadChats() {
  unreadChats = 0;
  updatePhoneBadge();
}

function setupMultiplayer(nickname, password) {
  if (multiplayer) return;
  multiplayer = new MultiplayerClient({
    connection: (state) => {
      const dot = document.getElementById('onlineStateDot');
      const count = document.getElementById('onlineCount');
      const fab = document.getElementById('onlinePanelToggle');
      dot?.classList.toggle('connected', state === 'connected');
      fab?.classList.toggle('connected', state === 'connected');
      if (state !== 'connected' && count) count.textContent = '连接中';
    },
    connected: (user, players, houses) => {
      onlinePlayers = players.filter((player) => player.id !== user.id);
      const owner = document.getElementById('phoneOwner');
      if (owner) owner.textContent = `${user.nickname} 的手机`;
      if (cursorChar) {
        const unsafe = Math.hypot(user.position.x, user.position.z) < FOUNTAIN_CLEAR || pointInAnyBuilding(user.position.x, user.position.z);
        if (unsafe) {
          cursorChar.position.set(0, 0, -6);
          multiplayer?.position({ x: 0, y: 0, z: -6, rotation: 0 });
        } else {
          cursorChar.position.set(user.position.x, 0, user.position.z);
          cursorChar.rotation.y = user.position.rotation ?? 0;
        }
      }
      players.forEach(addRemotePlayer);
      renderHouseList(houses);
      updateOnlineCount(players.length);
    },
    playerJoined: (player) => { onlinePlayers = [...onlinePlayers.filter((item) => item.id !== player.id), player]; addRemotePlayer(player); updateOnlineCount(remotePlayers.size + 1); },
    playerMoved: (id, position) => {
      const remote = remotePlayers.get(id);
      if (remote) { remote.target.set(position.x, position.y, position.z); remote.rotation = position.rotation ?? remote.rotation; }
    },
    playerLeft: (id) => { onlinePlayers = onlinePlayers.filter((player) => player.id !== id); removeRemotePlayer(id); updateOnlineCount(Math.max(1, remotePlayers.size + 1)); },
    chat: (message) => appendChat(message.nickname, message.text, message.userId === multiplayer?.user?.id),
    houses: renderHouseList,
    requests: (requests) => {
      currentHousingRequests = requests;
      pendingHousingRequests = requests.filter((request) => request.targetId === multiplayer?.user?.id).length;
      updatePhoneBadge();
      renderHouseList(currentHouses);
    },
    error: (message) => {
      document.getElementById('residenceClaimSubmit')?.removeAttribute('disabled');
      document.getElementById('residenceApply')?.removeAttribute('disabled');
      showUnlockToast(message);
    },
  });
  multiplayer.connect(nickname, password);
}

function updateOnlineCount(count) {
  const el = document.getElementById('onlineCount');
  if (el) el.textContent = `${Math.max(0, count)} 人在线`;
}

function addRemotePlayer(player) {
  if (!player?.id || player.id === multiplayer?.user?.id || remotePlayers.has(player.id)) return;
  const mesh = makeCharacter(0xF0C18A, 0xC45A4A);
  mesh.position.set(player.position.x, player.position.y, player.position.z);
  mesh.rotation.y = player.position.rotation ?? 0;
  mesh.userData.remotePlayerId = player.id;
  scene.add(mesh);
  remotePlayers.set(player.id, { mesh, target: new THREE.Vector3(player.position.x, player.position.y, player.position.z), rotation: player.position.rotation ?? 0, nickname: player.nickname });
}

function removeRemotePlayer(id) {
  const remote = remotePlayers.get(id);
  if (!remote) return;
  scene.remove(remote.mesh);
  remote.mesh.traverse((object) => { if (object.geometry) object.geometry.dispose(); if (object.material?.dispose) object.material.dispose(); });
  remotePlayers.delete(id);
}

function updateRemotePlayers(delta) {
  remotePlayers.forEach((remote) => {
    remote.mesh.position.lerp(remote.target, Math.min(1, delta * 12));
    remote.mesh.rotation.y += Math.atan2(Math.sin(remote.rotation - remote.mesh.rotation.y), Math.cos(remote.rotation - remote.mesh.rotation.y)) * Math.min(1, delta * 12);
  });
}

function appendChat(nickname, text, own) {
  const log = document.getElementById('chatLog');
  if (!log) return;
  const row = document.createElement('p'); row.className = `chat-line${own ? ' own' : ''}`;
  const author = document.createElement('b'); author.textContent = nickname;
  const body = document.createElement('span'); body.textContent = text;
  row.append(author, body); log.appendChild(row);
  while (log.children.length > 80) log.firstElementChild?.remove();
  log.scrollTop = log.scrollHeight;
  // 手机收起或不在公聊页时，用悬浮按钮角标提示未读
  const panel = document.getElementById('onlinePanel');
  const chatActive = document.querySelector('[data-online-tab="chat"]')?.classList.contains('active');
  if (!own && (!panel?.classList.contains('open') || !chatActive)) bumpUnreadChats();
}

function renderHouseList(houses) {
  const list = document.getElementById('houseList');
  if (!list) return;
  currentHouses = houses;
  list.replaceChildren();
  const mine = multiplayer?.user?.id;
  renderHousingRequests(list, mine);
  if (selectedResidenceId && houses.some((house) => house.buildingId === selectedResidenceId)) list.appendChild(buildHouseFocus(houses));
  if (!houses.length) {
    const empty = document.createElement('p'); empty.className = 'house-empty'; empty.textContent = '还没有被认领的住宅。'; list.appendChild(empty);
  }
  houses.forEach((house) => list.appendChild(buildHouseCard(house, houses, mine)));
  if (!selectedResidenceId) {
    const hint = document.createElement('p'); hint.className = 'house-select-hint'; hint.textContent = '点击地图中的小型居民楼，可查看或认领该住宅。'; list.appendChild(hint);
  }
  syncResidenceLabels();
  renderMapHouseTags();
  if (residenceClaimId && houses.some((house) => house.buildingId === residenceClaimId)) openResidence(residenceClaimId);
  if (residenceClaimId && !houses.some((house) => house.buildingId === residenceClaimId)) {
    const submit = document.getElementById('residenceClaimSubmit');
    submit?.removeAttribute('disabled');
  }
}

function renderHousingRequests(list, mine) {
  if (!mine || !currentHousingRequests.length) return;
  const section = document.createElement('section'); section.className = 'house-requests';
  const heading = document.createElement('strong'); heading.className = 'house-requests-title'; heading.textContent = '待处理请求'; section.appendChild(heading);
  currentHousingRequests.forEach((request) => {
    const incoming = request.targetId === mine;
    const row = document.createElement('div'); row.className = 'house-request';
    const text = document.createElement('span'); text.className = 'house-request-text';
    const houseName = request.houseName || '未命名住宅';
    text.textContent = incoming
      ? (request.kind === 'invite' ? `${request.requesterNickname} 邀请你入住「${houseName}」` : `${request.requesterNickname} 申请入住「${houseName}」`)
      : (request.kind === 'invite' ? `已邀请 ${request.targetNickname} 入住「${houseName}」` : `已申请入住「${houseName}」`);
    row.appendChild(text);
    if (incoming) {
      row.append(
        houseActionButton('同意', false, () => { multiplayer?.housing('accept', { requestId: request.id }); }, 'primary'),
        houseActionButton('拒绝', false, () => { multiplayer?.housing('decline', { requestId: request.id }); }, 'danger'),
      );
    } else {
      const pending = document.createElement('small'); pending.className = 'house-request-pending'; pending.textContent = '等待同意'; row.appendChild(pending);
    }
    section.appendChild(row);
  });
  list.appendChild(section);
}

// 当前在地图上选中的住宅：未认领时给入口，已认领时显示入住进度
function buildHouseFocus(houses) {
  const residence = residences.find((item) => item.id === selectedResidenceId);
  const house = houses.find((item) => item.buildingId === selectedResidenceId);
  const focus = document.createElement('article'); focus.className = 'house-focus';
  const head = document.createElement('div'); head.className = 'hf-head';
  const icon = document.createElement('span'); icon.className = 'hf-icon'; icon.innerHTML = HOUSE_ICON_SVG;
  const titles = document.createElement('div'); titles.className = 'hf-titles';
  const title = document.createElement('strong'); title.textContent = house?.name || '闲置住宅';
  const addr = document.createElement('span'); addr.className = 'hf-addr'; addr.textContent = residence?.label || selectedResidenceId;
  titles.append(title, addr);
  const close = document.createElement('button'); close.type = 'button'; close.className = 'hf-close'; close.textContent = '✕'; close.title = '取消选择';
  close.onclick = () => { selectedResidenceId = null; renderHouseList(currentHouses); };
  head.append(icon, titles, close);
  focus.appendChild(head);
  const state = document.createElement('div'); state.className = 'hf-state';
  if (house) {
    const bar = document.createElement('div'); bar.className = 'hc-bar';
    const fill = document.createElement('i'); fill.style.width = `${Math.min(100, house.members.length * 10)}%`;
    bar.appendChild(fill);
    const text = document.createElement('span'); text.textContent = `已入住 ${house.members.length}/10`;
    state.append(bar, text);
    focus.appendChild(state);
  } else {
    const text = document.createElement('span'); text.textContent = '这间住宅还没有主人。'; state.appendChild(text);
    focus.appendChild(state);
  }
  return focus;
}

function houseActionButton(label, active, onClick, variant) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `hc-btn${variant ? ` ${variant}` : ''}${active ? ' active' : ''}`;
  button.textContent = label;
  button.onclick = onClick;
  return button;
}

function setHousePanel(houseId, mode) {
  if (housePanelState.houseId === houseId && housePanelState.mode === mode) housePanelState = { houseId: null, mode: null };
  else housePanelState = { houseId, mode };
  renderHouseList(currentHouses);
}

function buildHouseCard(house, houses, mine) {
  const isOwner = house.ownerId === mine;
  const isMember = house.members.some((member) => member.userId === mine);
  const card = document.createElement('article');
  card.className = `house-card${isOwner ? ' mine' : ''}${house.buildingId === selectedResidenceId ? ' selected' : ''}`;

  const head = document.createElement('div'); head.className = 'hc-head';
  const titleBox = document.createElement('div'); titleBox.className = 'hc-title';
  const name = document.createElement('strong'); name.className = 'hc-name'; name.textContent = house.name || '未命名住宅';
  const owner = document.createElement('span'); owner.className = 'hc-owner'; owner.textContent = `所有者 ${house.ownerNickname}`;
  titleBox.append(name, owner);
  const occ = document.createElement('span'); occ.className = 'hc-occ'; occ.textContent = `${house.members.length}/10`;
  head.append(titleBox, occ);

  const bar = document.createElement('div'); bar.className = 'hc-bar';
  const fill = document.createElement('i'); fill.style.width = `${Math.min(100, house.members.length * 10)}%`;
  bar.appendChild(fill);

  const members = document.createElement('div'); members.className = 'hc-members';
  house.members.forEach((member) => {
    const chip = document.createElement('span');
    chip.className = `hc-chip${member.userId === house.ownerId ? ' owner' : ''}${member.userId === mine ? ' me' : ''}`;
    chip.textContent = member.userId === house.ownerId ? `${member.nickname} · 房主` : member.nickname;
    members.appendChild(chip);
  });
  card.append(head, bar, members);

  const panelMode = housePanelState.houseId === house.buildingId ? housePanelState.mode : null;
  const actions = document.createElement('div'); actions.className = 'hc-actions';
  if (isOwner) {
    actions.append(
      houseActionButton('改名', panelMode === 'rename', () => setHousePanel(house.buildingId, 'rename')),
      houseActionButton('邀请', panelMode === 'invite', () => setHousePanel(house.buildingId, 'invite')),
      houseActionButton('成员', panelMode === 'members', () => setHousePanel(house.buildingId, 'members')),
      houseActionButton('放弃', panelMode === 'release', () => setHousePanel(house.buildingId, 'release'), 'danger'),
    );
    card.appendChild(actions);
  } else if (isMember) {
    actions.appendChild(houseActionButton('退出住宅', panelMode === 'leave', () => setHousePanel(house.buildingId, 'leave'), 'danger'));
    card.appendChild(actions);
  } else if (!houses.some((item) => item.members.some((member) => member.userId === mine))) {
    const pending = currentHousingRequests.some((request) => request.kind === 'application' && request.buildingId === house.buildingId && request.requesterId === mine);
    const applyAction = houseActionButton(pending ? '申请中' : '申请入住', false, () => {
      if (!pending) {
        multiplayer?.housing('apply', { buildingId: house.buildingId });
        showUnlockToast(`已申请入住「${house.name || '未命名住宅'}」`);
      }
    }, pending ? undefined : 'primary');
    applyAction.disabled = pending;
    actions.appendChild(applyAction);
    card.appendChild(actions);
  }
  if (panelMode) card.appendChild(buildHousePanel(house, houses, mine, panelMode));
  return card;
}

// 卡片内的内联操作区：改名表单 / 邀请选择器 / 成员管理 / 两步骤确认
function buildHousePanel(house, houses, mine, mode) {
  const panel = document.createElement('div'); panel.className = 'hc-panel';
  const panelTitle = (text) => { const el = document.createElement('span'); el.className = 'hc-panel-title'; el.textContent = text; return el; };
  if (mode === 'rename') {
    const form = document.createElement('div'); form.className = 'hc-form';
    const input = document.createElement('input');
    input.value = house.name || ''; input.maxLength = 24; input.placeholder = '输入新的住宅名称';
    input.setAttribute('aria-label', '住宅名称');
    const save = houseActionButton('保存', false, () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      housePanelState = { houseId: null, mode: null };
      multiplayer?.housing('rename', { buildingId: house.buildingId, name });
    }, 'primary');
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); save.click(); } });
    form.append(input, save, houseActionButton('取消', false, () => setHousePanel(house.buildingId, 'rename')));
    panel.append(panelTitle('重新命名'), form);
    requestAnimationFrame(() => input.focus());
  } else if (mode === 'invite') {
    panel.appendChild(panelTitle('邀请在线居民入住'));
    const candidates = onlinePlayers.filter((player) => !houses.some((item) => item.members.some((member) => member.userId === player.id)));
    const box = document.createElement('div'); box.className = 'hc-candidates';
    if (!candidates.length) {
      const empty = document.createElement('p'); empty.className = 'hc-person-empty'; empty.textContent = '当前没有可邀请的在线居民。'; box.appendChild(empty);
    }
    candidates.forEach((player) => {
      const row = document.createElement('div'); row.className = 'hc-person';
      const name = document.createElement('span'); name.className = 'hc-person-name'; name.textContent = player.nickname;
      const pendingInvite = currentHousingRequests.some((request) => request.kind === 'invite' && request.buildingId === house.buildingId && request.requesterId === mine && request.targetId === player.id);
      const inviteAction = houseActionButton(pendingInvite ? '已邀请' : '邀请', false, () => {
        if (pendingInvite) return;
        housePanelState = { houseId: null, mode: null };
        multiplayer?.housing('invite', { buildingId: house.buildingId, userId: player.id });
        showUnlockToast(`已邀请 ${player.nickname} 入住`);
      }, 'primary');
      inviteAction.disabled = pendingInvite;
      row.append(name, inviteAction);
      box.appendChild(row);
    });
    panel.appendChild(box);
  } else if (mode === 'members') {
    panel.appendChild(panelTitle('管理成员'));
    const rows = document.createElement('div'); rows.className = 'hc-member-rows';
    const others = house.members.filter((member) => member.userId !== mine);
    if (!others.length) {
      const empty = document.createElement('p'); empty.className = 'hc-person-empty'; empty.textContent = '还没有其他成员。'; rows.appendChild(empty);
    }
    others.forEach((member) => {
      const row = document.createElement('div'); row.className = 'hc-person';
      const name = document.createElement('span'); name.className = 'hc-person-name'; name.textContent = member.nickname;
      row.append(name,
        houseActionButton('转让', false, () => {
          housePanelState = { houseId: null, mode: null };
          multiplayer?.housing('transfer', { buildingId: house.buildingId, userId: member.userId });
        }),
        houseActionButton('踢出', false, () => {
          housePanelState = { houseId: null, mode: null };
          multiplayer?.housing('kick', { buildingId: house.buildingId, userId: member.userId });
        }, 'danger'),
      );
      rows.appendChild(row);
    });
    panel.appendChild(rows);
  } else if (mode === 'release' || mode === 'leave') {
    const text = mode === 'release'
      ? `确认放弃「${house.name || '这间住宅'}」？所有成员都会被移出。`
      : `确认退出「${house.name || '这间住宅'}」？`;
    const confirm = document.createElement('div'); confirm.className = 'hc-confirm';
    const label = document.createElement('span'); label.textContent = text;
    confirm.append(label,
      houseActionButton('确认', false, () => {
        housePanelState = { houseId: null, mode: null };
        multiplayer?.housing(mode === 'release' ? 'release' : 'leave', { buildingId: house.buildingId });
      }, 'danger'),
      houseActionButton('取消', false, () => setHousePanel(house.buildingId, mode)),
    );
    panel.appendChild(confirm);
  }
  return panel;
}

// 被命名的住宅：在 3D 场景中挂上可点击的名字标签
function syncResidenceLabels() {
  const wrap = document.getElementById('labelsWrap');
  if (!wrap) return;
  residences.forEach((residence) => {
    const house = currentHouses.find((item) => item.buildingId === residence.id);
    const name = house?.name?.trim();
    if (!name) {
      if (residence.labelEl) { residence.labelEl.remove(); residence.labelEl = null; }
      return;
    }
    if (!residence.labelEl) {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'house-map-label show';
      el.innerHTML = `${HOUSE_ICON_SVG}<span class="hml-name"></span>`;
      el.addEventListener('click', (event) => { event.stopPropagation(); openResidence(residence.id); });
      wrap.appendChild(el);
      residence.labelEl = el;
    }
    residence.labelEl.querySelector('.hml-name').textContent = name;
  });
}

// 全景地图上同步显示已命名住宅的名字
function renderMapHouseTags() {
  const wrap = document.getElementById('mapIcons');
  if (!wrap || !mapIconsBuilt) return;
  wrap.querySelectorAll('.map-house-tag').forEach((el) => el.remove());
  currentHouses.forEach((house) => {
    const name = house.name?.trim();
    if (!name) return;
    const residence = residences.find((item) => item.id === house.buildingId);
    if (!residence) return;
    const tag = document.createElement('button');
    tag.type = 'button'; tag.className = 'map-house-tag'; tag.textContent = name;
    tag.style.left = ((residence.group.position.x + MAP_SHOT_SPAN) / (2 * MAP_SHOT_SPAN) * 100) + '%';
    tag.style.top = ((MAP_SHOT_SPAN - residence.group.position.z) / (2 * MAP_SHOT_SPAN) * 100) + '%';
    tag.addEventListener('click', () => { if (mapMode) toggleMapMode(); openResidence(house.buildingId); });
    wrap.appendChild(tag);
  });
}

function openResidence(residenceId) {
  const residence = residences.find((item) => item.id === residenceId);
  if (!residence) return;
  selectedResidenceId = residenceId;
  residenceClaimId = residenceId;
  const house = currentHouses.find((item) => item.buildingId === residenceId);
  const panel = document.getElementById('residenceClaim');
  const title = document.getElementById('residenceClaimTitle');
  const address = document.getElementById('residenceClaimAddress');
  const status = document.getElementById('residenceClaimStatus');
  const field = document.getElementById('residenceNameField');
  const input = document.getElementById('residenceNameInput');
  const submit = document.getElementById('residenceClaimSubmit');
  const apply = document.getElementById('residenceApply');
  const navigate = document.getElementById('residenceNavigate');
  if (!panel || !title || !address || !status || !field || !submit || !apply || !navigate) return;
  title.textContent = house?.name || '未命名住宅';
  address.textContent = residence.label;
  status.textContent = house
    ? `已认领 · 房主 ${house.ownerNickname} · ${house.members.length}/10 名成员`
    : '这栋住宅尚未被认领。';
  field.hidden = Boolean(house);
  submit.hidden = Boolean(house);
  navigate.hidden = !house;
  const mine = multiplayer?.user?.id;
  const alreadyLivesSomewhere = currentHouses.some((item) => item.members.some((member) => member.userId === mine));
  const canApply = Boolean(house && mine && !alreadyLivesSomewhere && house.ownerId !== mine);
  const pendingApplication = currentHousingRequests.some((request) => request.kind === 'application' && request.buildingId === residenceId && request.requesterId === mine);
  apply.hidden = !canApply;
  apply.textContent = pendingApplication ? '申请中' : '申请入住';
  apply.toggleAttribute('disabled', pendingApplication);
  submit.removeAttribute('disabled');
  if (input) input.value = house?.name || '';
  panel.hidden = false;
  if (!house) requestAnimationFrame(() => input?.focus());
}

function closeResidencePanel() {
  const panel = document.getElementById('residenceClaim');
  if (panel) panel.hidden = true;
  residenceClaimId = null;
}

function navigateToResidence(residenceId) {
  const residence = residences.find((item) => item.id === residenceId);
  if (!residence) return;
  closeResidencePanel();
  movePlayerTo(residence.group.position.clone());
}
function onCanvasClick() {
  if (dialogOpen) return;
  raycaster.setFromCamera(mouse2D,camera);
  if(cursorChar&&cursorChar.visible){
    const phits=raycaster.intersectObject(cursorChar,true);
    if(phits.length){ onYouClick(); return; }
  }
  const npcHit=npcForRaycast();
  if(npcHit){ talkToOrWalk(npcHit); return; }
  const hits=raycaster.intersectObjects(raycastBuildingGroups,true);
  if(hits.length){
    const residenceId=hits[0].object.userData.residenceId;
    if(residenceId){ openResidence(residenceId); return; }
    const b=buildings.find(x=>x.id===hits[0].object.userData.buildingId);
    if(b){ interactOrWalk(b); return; }
  }
  const near=nearestNpcTo(cursorWorld,CONFIG.npcTalkRadius);
  if(near){ talkToOrWalk(near); return; }
  movePlayerTo(cursorWorld);
}

function talkToOrWalk(npc) {
  if(cursorChar && cursorChar.position.distanceTo(npc.mesh.position)<=CONFIG.npcTalkRadius){
    openNpcDialog(npc);
  } else {
    const p=cursorChar?cursorChar.position:new THREE.Vector3(0,0,0);
    const n=npc.mesh.position;
    const dx=p.x-n.x, dz=p.z-n.z, d=Math.hypot(dx,dz)||1;
    const stopDist=CONFIG.npcTalkRadius-0.35;
    movePlayerTo(new THREE.Vector3(n.x+dx/d*stopDist,0,n.z+dz/d*stopDist));
  }
}

function interactOrWalk(b) {
  const buildingDistance = cursorChar ? Math.hypot(
    cursorChar.position.x - b.group.position.x,
    cursorChar.position.z - b.group.position.z
  ) : Infinity;
  if(cursorChar && buildingDistance<=CONFIG.buildingInteractRadius){
    pendingBuilding=null;
    navigateTo(b);
  } else {
    pendingBuilding=b;
    movePlayerTo(b.group.position);
  }
}

// ── Hover / Navigate ──────────────────────────────────────────────────────────
function hover(b) {
  hoveredB=b;
  gsap.to(b.group.position,{y:0.22,duration:0.28,ease:'power2.out'});
  gsap.to(b.bodyMat,{emissiveIntensity:0.08,duration:0.28});
  b.labelEl&&b.labelEl.classList.add('hovered');
}
function unhover(b) {
  gsap.to(b.group.position,{y:0,duration:0.38,ease:'power2.out'});
  gsap.to(b.bodyMat,{emissiveIntensity:0,duration:0.38});
  b.labelEl&&b.labelEl.classList.remove('hovered');
}
function navigateTo(b) {
  if (b.isStats) { openStatsPanel(); trackInteraction('stats'); return; }
  trackInteraction(b.id);
  openModal(b);
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(night,instant) {
  const d=instant?0:0.72;
  // Swap sky texture
  if (TEX.skyDay && TEX.skyNight) {
    scene.background = night ? TEX.skyNight : TEX.skyDay;
  } else {
    tweenColor(scene.background,night?P.NIGHT_BG:P.DAY_BG,d);
  }
  pathMats.forEach(m=>tweenColor(m.color,night?P.NIGHT_PATH:P.DAY_PATH,d));
  groundMats.forEach(g=>tweenColor(g.mat.color,night?g.night:g.day,d));
  const amb=scene.getObjectByName('amb'),dir=scene.getObjectByName('dir');
  if(amb)gsap.to(amb,{intensity:night?0.60:1.05,duration:d});
  if(dir)gsap.to(dir,{intensity:night?0.30:0.55,duration:d});
  lampGlobes.forEach(m=>gsap.to(m,{emissiveIntensity:night?0.60:0.05,duration:d}));
}
function tweenColor(c,hex,dur) {
  const t=new THREE.Color(hex);
  if(dur===0){c.copy(t);return;}
  gsap.to(c,{r:t.r,g:t.g,b:t.b,duration:dur,ease:'power2.inOut'});
}

function syncTimeAndTheme() {
  gameClock=(9+(Date.now()-gameTimeRef)/60000)%24; // 实时计算：加载时刻=9点，此后每分钟快进1小时
  const night = gameClock>=19 || gameClock<6;
  if (night!==isNight) {
    isNight=night;
    document.body.classList.toggle('night',isNight);
    document.body.classList.toggle('day',!isNight);
    applyTheme(isNight,false);
    setTimeout(()=>{ mapShotData=null; captureMapShot(); if(mapMode)updateMapImage(); },1000); // 昼夜切换后重拍全景
    if(isNight){
      const s=getStats();
      s.nightToggles=(s.nightToggles||0)+1;
      saveStats(s);
      checkAchievements();
    }
  }
  const el=document.getElementById('communityTime');
  if(el){
    const h=Math.floor(gameClock), m=Math.floor((gameClock-h)*60);
    el.textContent=(h<10?'0':'')+h+':'+(m<10?'0':'')+m;
  }
  updateNpcSchedules();
}

// ── Entrance + loop animations ────────────────────────────────────────────────
function entranceAnimation() {
  buildings.forEach((b,i)=>{
    gsap.to(b.group.position,{y:0,duration:0.85,delay:0.1+i*0.06,ease:'back.out(1.6)'});
  });
  gsap.from('.welcome-block',{opacity:0,y:8,duration:0.9,delay:0.2,ease:'power2.out'});
  gsap.from('.ui-header',{opacity:0,y:-6,duration:0.7,delay:0.1,ease:'power2.out'});
  gsap.from('.you-block',{opacity:0,y:8,duration:0.9,delay:0.4,ease:'power2.out'});
  document.getElementById('labelsWrap').classList.remove('hidden');
}
function initAnimations() {
  if (REDUCED) return;
  const sb=buildings.find(b=>b.isStats);
  if(sb&&sb.glowMat)
    gsap.to(sb.glowMat,{emissiveIntensity:0.55,duration:1.6,ease:'sine.inOut',repeat:-1,yoyo:true});
}

// ── Label projection ──────────────────────────────────────────────────────────
function updateLabels() {
  buildings.forEach(b=>{
    if(!b.labelEl)return;
    labelWorldPosition.copy(b.group.position);
    labelWorldPosition.y=b.group.position.y+b.labelY;
    labelWorldPosition.project(camera);
    b.labelEl.style.transform=`translate3d(${(labelWorldPosition.x*0.5+0.5)*window.innerWidth}px,${((-labelWorldPosition.y)*0.5+0.5)*window.innerHeight}px,0) translate(-50%,-50%)`;
  });
  residences.forEach(residence=>{
    if(!residence.labelEl)return;
    labelWorldPosition.copy(residence.group.position);
    labelWorldPosition.y=residence.group.position.y+2.45;
    labelWorldPosition.project(camera);
    residence.labelEl.style.transform=`translate3d(${(labelWorldPosition.x*0.5+0.5)*window.innerWidth}px,${((-labelWorldPosition.y)*0.5+0.5)*window.innerHeight}px,0) translate(-50%,-50%)`;
  });
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop() {
  animationFrame = requestAnimationFrame(loop);
  const now=performance.now();
  const delta=Math.min((now-lastFrameTime)/1000,0.05);
  lastFrameTime=now;
  updatePlayerMovement(delta);
  updateRemotePlayers(delta);
  npcList.forEach(npc=>{
    if(!npc.mesh.visible||npc.walking===false) return;
    npcYieldToPlayer(npc);
  });
  updateCameraFollow(delta);
  updateLabels();
  renderer.render(scene,camera);
  if(mapMode) updateMapMarker(); // 玩家走动时同步地图上的位置标记
}

function toggleMapMode() {
  mapMode=!mapMode;
  const btn=document.getElementById('mapToggle');
  btn&&btn.classList.toggle('active',mapMode);
  const overlay=document.getElementById('mapOverlay');
  if(mapMode){
    overlay.classList.add('show');
    updateMapImage();
  }else{
    overlay.classList.remove('show');
    closeMapTip();
  }
}

// ── 全景地图：启动时俯视渲染一张真实截图，纸上只标注玩家位置 ──────────────────
function captureMapShot() {
  if(!scene)return;
  if(!mapShotCam){
    mapShotCam=new THREE.OrthographicCamera(
      -MAP_SHOT_SPAN,MAP_SHOT_SPAN,MAP_SHOT_SPAN,-MAP_SHOT_SPAN,0.1,130);
    mapShotCam.position.set(0,90,0);
    mapShotCam.up.set(0,0,1); // 图像顶端=北
    mapShotCam.lookAt(0,0,0);
    mapShotCam.updateProjectionMatrix();
  }
  if(!mapShotRenderer){
    const cv=document.createElement('canvas');
    cv.width=MAP_SHOT; cv.height=MAP_SHOT;
    mapShotRenderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
    mapShotRenderer.setSize(MAP_SHOT,MAP_SHOT,false);
    mapShotRenderer.setPixelRatio(1);
    mapShotRenderer.toneMapping=THREE.ACESFilmicToneMapping;
    mapShotRenderer.toneMappingExposure=1.0;
    if(THREE.SRGBColorSpace) mapShotRenderer.outputColorSpace=THREE.SRGBColorSpace;
  }
  // The satellite town lives south of the main city (z>=44). Keep it off the
  // overview map so the paper only shows the main city.
  const hiddenSatellite=[];
  scene.traverse(obj=>{
    const p=new THREE.Vector3();
    obj.getWorldPosition(p);
    if(p.z>=44&&obj.isMesh&&obj.visible){
      hiddenSatellite.push(obj);
      obj.visible=false;
    }
  });
  mapShotRenderer.render(scene,mapShotCam);
  hiddenSatellite.forEach(obj=>{ obj.visible=true; });
  mapShotData=mapShotRenderer.domElement.toDataURL('image/png');
  mapShotRenderer.dispose();
  mapShotRenderer.forceContextLoss();
  mapShotRenderer=null;
}

function updateMapImage() {
  const image=document.getElementById('mapImage');
  if(!image)return;
  renderMapIcons();
  if(!mapShotData)captureMapShot();
  if(mapShotData&&image.src!==mapShotData)image.src=mapShotData;
  updateMapMarker();
}

function updateMapMarker() {
  const marker=document.getElementById('mapMarker');
  if(!marker||!cursorChar)return;
  const left=((cursorChar.position.x+MAP_SHOT_SPAN)/(2*MAP_SHOT_SPAN))*100;
   const top=((MAP_SHOT_SPAN-cursorChar.position.z)/(2*MAP_SHOT_SPAN))*100;
  marker.style.left=clamp(left,0,100)+'%';
  marker.style.top=clamp(top,0,100)+'%';
}

// ── 地图图标：建筑只标小图标，点击弹小介绍 ────────────────────────────────────
function renderMapIcons() {
  const wrap=document.getElementById('mapIcons');
  if(!wrap||mapIconsBuilt)return;
  mapIconsBuilt=true;
  buildings.forEach(b=>{
    const el=document.createElement('button');
    el.type='button';
    el.className='map-icon';
    el.title=b.label;
    el.innerHTML=b.icon;
    el.style.left=((b.group.position.x+MAP_SHOT_SPAN)/(2*MAP_SHOT_SPAN)*100)+'%';
     el.style.top=((MAP_SHOT_SPAN-b.group.position.z)/(2*MAP_SHOT_SPAN)*100)+'%';
    el.addEventListener('click',()=>openMapTip(b));
    wrap.appendChild(el);
  });
  renderMapHouseTags();
}

function teleportUnlocked() {
  const s=getStats();
  return (s.achievements||[]).includes('walker_100');
}

function openMapTip(b) {
  mapTipB=b;
  const content=BUILDING_CONTENT[b.id];
  document.getElementById('mapTipTitle').textContent=content?content.name:b.label;
  document.getElementById('mapTipSlogan').textContent=content?content.slogan:'这座小城的一角。';
  const unlocked=teleportUnlocked();
  document.getElementById('mapTipTele').disabled=!unlocked;
  document.getElementById('mapTipLock').classList.toggle('hidden',unlocked);
  document.getElementById('mapTip').classList.add('open');
}

function closeMapTip() {
  mapTipB=null;
  document.getElementById('mapTip').classList.remove('open');
}

function mapTeleport(b) {
  if(!cursorChar)return;
  const q=buildingRoadEntry(b.group.position);
  if(q){
    playerPath=[];
    cursorChar.position.set(q.x,0,q.z);
    setCameraTarget(q.x,q.z,true);
  }else{
    movePlayerTo(b.group.position);
  }
}

function updateCameraFollow(delta) {
  if(!cursorChar||mapMode)return;
  const p=cursorChar.position;
  labelWorldPosition.copy(p); labelWorldPosition.y=0.4; labelWorldPosition.project(camera);
  const ox=Math.abs(labelWorldPosition.x), oz=Math.abs(labelWorldPosition.y);
  if(ox<=CONFIG.cameraEdge&&oz<=CONFIG.cameraEdge)return;
  // 玩家当前 NDC 超出边缘，休息点 = 让玩家刚好回到边缘的目标位置
  const maxo=Math.max(ox,oz);
  const scale=1-CONFIG.cameraEdge/maxo;
  const dx=p.x-cameraTarget.x, dz=p.z-cameraTarget.z;
  const rx=cameraTarget.x+dx*scale, rz=cameraTarget.z+dz*scale;
  const t=1-Math.exp(-6*delta); // 帧率无关的连续缓动
  setCameraTarget(
    cameraTarget.x+(rx-cameraTarget.x)*t,
    cameraTarget.z+(rz-cameraTarget.z)*t,
    true
  );
}

function setCameraTarget(x,z,instant) {
  const nx=clamp(x,-38,38), nz=clamp(z,-38,112);
  if(instant){
    cameraTarget.set(nx,0,nz);
    camera.position.copy(cameraTarget).add(CAMERA_OFFSET);
    camera.lookAt(cameraTarget);
    return;
  }
  gsap.to(cameraTarget,{x:nx,z:nz,duration:0.55,ease:'power2.out',onUpdate:()=>{
    camera.position.copy(cameraTarget).add(CAMERA_OFFSET);
    camera.lookAt(cameraTarget);
  }});
}

function updateCameraProjection(vs) {
  const a=window.innerWidth/window.innerHeight;
  camera.left=-vs*a; camera.right=vs*a; camera.top=vs; camera.bottom=-vs;
  camera.updateProjectionMatrix();
}

function movePlayerTo(target) {
  if(!cursorChar||dialogOpen)return;
  cursorChar.visible=true;
  playerPath = buildRoadPath(cursorChar.position, target);
}

function updatePlayerMovement(delta) {
  if(!cursorChar||!playerPath.length){
    if(pendingBuilding && cursorChar){
      const b=pendingBuilding;
      const distance=Math.hypot(cursorChar.position.x-b.group.position.x,cursorChar.position.z-b.group.position.z);
      if(distance<=CONFIG.buildingInteractRadius){ pendingBuilding=null; navigateTo(b); }
    }
    return;
  }
  if(dialogOpen){ playerPath=[]; return; }
  const target=playerPath[0];
  const dx=target.x-cursorChar.position.x, dz=target.z-cursorChar.position.z;
  const dist=Math.hypot(dx,dz);
  const step=CONFIG.playerSpeed*delta;
  if(dist<=step){
    cursorChar.position.set(target.x,0,target.z);
    playerPath.shift();
    return;
  }
  cursorChar.position.x+=dx/dist*step;
  cursorChar.position.z+=dz/dist*step;
  cursorChar.position.y=0;
  // Keep the player and visible NPCs from occupying the same spot.
  npcList.forEach(npc=>{
    if(!npc.mesh.visible) return;
    const ox=cursorChar.position.x-npc.mesh.position.x;
    const oz=cursorChar.position.z-npc.mesh.position.z;
    const d=Math.hypot(ox,oz), minD=0.42;
    if(d>0 && d<minD){
      const push=(minD-d)/d;
      cursorChar.position.x+=ox*push;
      cursorChar.position.z+=oz*push;
    }
  });
  cursorChar.rotation.y=Math.atan2(dx,dz);
  if(multiplayer && performance.now()-lastNetworkPosition>=80){
    multiplayer.position({x:cursorChar.position.x,y:cursorChar.position.y,z:cursorChar.position.z,rotation:cursorChar.rotation.y});
    lastNetworkPosition=performance.now();
  }
  pendingDistance+=step;
  if(pendingDistance>=10){ const d=Math.floor(pendingDistance); pendingDistance-=d; flushDistance(d); }
}

function flushDistance(amount) {
  if(!cursorChar||amount<=0)return;
  const s=getStats();
  s.distance=(s.distance||0)+amount;
  saveStats(s);
  checkAchievements();
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

  SATELLITE_CITY.roadNodes.forEach(([x,z])=>addNode(x,z));
  SATELLITE_CITY.roadSegments.forEach(([x1,z1,x2,z2])=>{
    addEdge(nodes[nodeIdx.get(x1+','+z1)],nodes[nodeIdx.get(x2+','+z2)]);
  });
  const mainSouth=nodes[nodeIdx.get('0,38')];
  const satelliteNorth=nodes[nodeIdx.get('0,55')];
  if(mainSouth&&satelliteNorth) addEdge(mainSouth,satelliteNorth);

  // Inner plaza loop: the walkable counterpart of the central ring mesh added
  // in addPaths(). It connects to each arterial without entering the fountain.
  const plazaNodes=PLAZA_POINTS.map(([x,z])=>addNode(x,z));
  plazaNodes.forEach((n,i)=>addEdge(n,plazaNodes[(i+1)%plazaNodes.length]));
  [[0,-6,0,-2.7],[6,0,2.7,0],[0,6,0,2.7],[-6,0,-2.7,0]].forEach(([x1,z1,x2,z2])=>{
    const a=nodes[nodeIdx.get(x1+','+z1)];
    const b=nodes[nodeIdx.get(x2+','+z2)];
    if(a&&b) addEdge(a,b);
  });
  roadGraph={nodes,nodeIdx};
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

function aStarRoad(sNode,eNode,graph) {
  if(sNode===eNode) return [sNode];
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
// (grid, central plaza ring, outer ring or satellite roads).
function connectToGrid(p,graph) {
  const key=p.x+','+p.z;
  if(graph.nodeIdx.has(key)) {
    const node=graph.nodes[graph.nodeIdx.get(key)];
    if(node.adj.length) return node;
  }
  if(ROAD_COORDS.includes(p.x)){
    const zs=ROAD_COORDS.slice().sort((a,b)=>Math.abs(a-p.z)-Math.abs(b-p.z));
    for(const z of zs) {
      const node=graph.nodes[graph.nodeIdx.get(p.x+','+z)];
      if(node&&node.adj.length&&!pathBlocked(p.x,p.z,p.x,z)) return node;
    }
  }
  if(ROAD_COORDS.includes(p.z)){
    const xs=ROAD_COORDS.slice().sort((a,b)=>Math.abs(a-p.x)-Math.abs(b-p.x));
    for(const x of xs) {
      const node=graph.nodes[graph.nodeIdx.get(x+','+p.z)];
      if(node&&node.adj.length&&!pathBlocked(p.x,p.z,x,p.z)) return node;
    }
  }
  // Nearest reachable node anywhere on the network. This handles spawn in the
  // fountain plaza, corner off-grid spots and satellite drives: the player is
  // snapped to the CLOSEST clear node so it never gets pushed the wrong way.
  const satelliteNode = SATELLITE_CITY.roadNodes
    .map(([x,z])=>graph.nodes[graph.nodeIdx.get(x+','+z)])
    .filter(node=>node && node.adj.length)
    .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  if(satelliteNode && p.z>=44 && !pathBlocked(p.x,p.z,satelliteNode.x,satelliteNode.z)) return satelliteNode;
  let best=null, bestD=Infinity;
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
  // Satellite-town buildings live off the main grid; snap to their road nodes.
  if(p.z>=44){
    SATELLITE_CITY.roadNodes.forEach(([x,z])=>candidates.push(new THREE.Vector3(x,0,z)));
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
      minX:b.min.x-0.15, maxX:b.max.x+0.15,
      minZ:b.min.z-0.15, maxZ:b.max.z+0.15
    });
  });
}

function segHitsBuilding(x1,z1,x2,z2) {
  const dx=x2-x1, dz=z2-z1, len2=dx*dx+dz*dz;
  if(len2<1e-6) return false;
  for(const bx of buildingBoxes){
    const t=clamp(((bx.minX-x1)*dx+(bx.minZ-z1)*dz)/len2,0,1);
    const cx=x1+dx*t, cz=z1+dz*t;
    if(cx>=bx.minX&&cx<=bx.maxX&&cz>=bx.minZ&&cz<=bx.maxZ) return true;
  }
  return false;
}

// 找一个「从 p 直达且不穿建筑/喷泉」的路点；p 已在路上则原样返回
function roadEntry(p) {
  const buildingEntry=buildingRoadEntry(p);
  if(buildingEntry) return buildingEntry;
  if(isRoadPoint(p)) return snapToRoadClear(p);
  if(p.z>=44){
    const nearest=SATELLITE_CITY.roadNodes.slice().sort((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)-Math.hypot(b[0]-p.x,b[1]-p.z))[0]!;
    const q=new THREE.Vector3(nearest[0],0,nearest[1]);
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
  SATELLITE_CITY.roadNodes.forEach(([x,z])=>tryPoint(x,z));
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

// ══════════════════════════════════════════════════════════════════════════════
// STATS / PROGRESSION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

function getUserId() {
  let id=localStorage.getItem('minicityUserId');
  if(!id){id='usr_'+Math.random().toString(36).substr(2,8);localStorage.setItem('minicityUserId',id);}
  return id;
}

function getStats() {
  const raw=localStorage.getItem('minicityStats');
  return raw?JSON.parse(raw):{interactions:0,buildingsVisited:[],joinDate:null,unlockLevel:0,achievements:[],npcsMet:[],npcsTalked:0,distance:0,nightToggles:0};
}
function saveStats(s){localStorage.setItem('minicityStats',JSON.stringify(s));}

function trackInteraction(buildingId) {
  const s=getStats();
  s.interactions++;
  if(buildingId&&!s.buildingsVisited.includes(buildingId)) s.buildingsVisited.push(buildingId);
  saveStats(s);
  updateWelcome();
  checkUnlocks(s);
  checkAchievements();
}

function updateWelcome() {
  const s=getStats();
  const show=(s.interactions||0)<2; // 第二次与建筑交互后不再显示
  const el=document.querySelector('.welcome-block');
  if(el) el.classList.toggle('hidden',!show);
}

function checkUnlocks(s) {
  const current=s.unlockLevel||0;
  for(let i=current;i<UNLOCK_TIERS.length;i++){
    if(s.interactions>=UNLOCK_TIERS[i].threshold){
      UNLOCK_TIERS[i].fn();
      s.unlockLevel=i+1; saveStats(s);
      showUnlockToast(UNLOCK_TIERS[i].label);
    } else break;
  }
}

function showUnlockToast(msg) {
  const toast=document.getElementById('unlockToast');
  document.getElementById('utText').textContent=msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),3400);
}

function calcLevel(n) {
  if(n>=20)return 5; if(n>=12)return 4;
  if(n>=7)return 3;  if(n>=3)return 2; return 1;
}

function formatTime(secs) {
  if(secs<60)return secs+'s';
  const m=Math.floor(secs/60),s=secs%60;
  return m+'m '+(s<10?'0'+s:s)+'s';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

function startTimeTracking() {
  trackingInterval = window.setInterval(()=>{
    const t=parseInt(localStorage.getItem('minicityTime')||'0')+1;
    localStorage.setItem('minicityTime',t);
  },1000);
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════

function checkLogin() {
  const overlay=document.getElementById('loginOverlay');
  const name=localStorage.getItem('minicityUser');
  overlay.style.display='none';
  if(name) applyUsername(name);
  if(shouldShowCG()) startCG();
  else if(name) proceedToCity();
  else showLogin();
}

function showLogin() {
  const overlay=document.getElementById('loginOverlay');
  overlay.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.remove('hidden')));
  setTimeout(()=>document.getElementById('loginInput').focus(),300);
}

function doLogin() {
  const input=document.getElementById('loginInput');
  const passwordInput=document.getElementById('loginPassword');
  const errorEl=document.getElementById('loginError');
  const name=(input.value||'').trim();
  const password=passwordInput?.value||'';
  const showError=(msg:string)=>{ if(!errorEl)return; errorEl.textContent=msg; errorEl.hidden=!msg; };
  if(!name||name.length<2){ showError('昵称至少需要两个字'); return; }
  if(!/^[\p{L}\p{N}]{2,40}$/u.test(name)){ showError('昵称只能使用中文、英文和数字，不能包含空格或特殊字符'); return; }
  if(!password){ showError('请输入密码'); return; }
  showError('');
  localStorage.setItem('minicityUser',name);
  localStorage.setItem('minicityPassword',password);
  const s=getStats();
  if(!s.joinDate){s.joinDate=Date.now();saveStats(s);}
  getUserId();
  applyUsername(name);
  checkAchievements();
  const overlay=document.getElementById('loginOverlay');
  overlay.classList.add('hidden');
  setTimeout(()=>{
    overlay.style.display='none';
    proceedToCity();
  },550);
}

function applyUsername(name) {
  const el=document.getElementById('logoUser');
  if(el) el.textContent='— '+name;
}

function proceedToCity() {
  entranceAnimation();
  if(cursorChar){ cursorChar.visible=true; }
  startTimeTracking();
  setupMultiplayer(localStorage.getItem('minicityUser')||'居民', localStorage.getItem('minicityPassword')||undefined);
  checkAchievements();
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS PANEL
// ══════════════════════════════════════════════════════════════════════════════

function openStatsPanel() {
  renderStats();
  document.getElementById('statsPanel').classList.add('open');
}
function closeStatsPanel() {
  document.getElementById('statsPanel').classList.remove('open');
}
function setStatsMode(mode) {
  statsMode=mode;
  document.getElementById('spModeClean').classList.toggle('active',mode==='clean');
  document.getElementById('spModeRaw').classList.toggle('active',mode==='raw');
  renderStats();
}
function renderStats() {
  statsMode==='clean' ? renderClean() : renderRaw();
}

function renderClean() {
  const s=getStats();
  const level=calcLevel(s.interactions);
  const name=localStorage.getItem('minicityUser')||'visitor';
  const since=s.joinDate?formatDate(s.joinDate):'today';
  const time=parseInt(localStorage.getItem('minicityTime')||'0');
  const visited=(s.buildingsVisited||[]).length;
  const totalBuildings=BUILDING_DEFS.length;

  const nextTier=UNLOCK_TIERS.find(t=>s.interactions<t.threshold);
  const prevThresh=UNLOCK_TIERS.slice().reverse().find(t=>s.interactions>=t.threshold)?.threshold||0;
  const nextThresh=nextTier?.threshold||UNLOCK_TIERS[UNLOCK_TIERS.length-1].threshold;
  const pct=nextTier?Math.min(100,Math.round(((s.interactions-prevThresh)/(nextThresh-prevThresh))*100)):100;

  const unlockRows=UNLOCK_TIERS.map(t=>{
    const done=s.interactions>=t.threshold;
    return `<div class="sp-ul-item${done?' done':''}">
      <span class="sp-ul-dot">${done?'✓':'○'}</span>
      <span class="sp-ul-name">${t.label}</span>
      <span class="sp-ul-thresh">${t.threshold} visits</span>
    </div>`;
  }).join('');

  const achList=s.achievements||[];
  const achRows=ACHIEVEMENTS.map(a=>{
    const done=achList.includes(a.id);
    return `<div class="sp-ul-item${done?' done':''}" title="${a.desc}">
      <span class="sp-ul-dot">${done?'★':'☆'}</span>
      <span class="sp-ul-name">${a.name}</span>
      <span class="sp-ul-thresh">${done?a.desc:'未达成'}</span>
    </div>`;
  }).join('');

  document.getElementById('spBody').innerHTML=`
    <div class="sp-user-row">
      <div class="sp-username">${name}</div>
      <div class="sp-level">LVL ${level}</div>
    </div>
    <div class="sp-since">citizen since ${since}</div>
    <div class="sp-cards">
      <div class="sp-card"><div class="sc-val">${formatTime(time)}</div><div class="sc-lbl">TIME IN CITY</div></div>
      <div class="sp-card"><div class="sc-val">${s.interactions}</div><div class="sc-lbl">INTERACTIONS</div></div>
      <div class="sp-card"><div class="sc-val">${visited}&thinsp;/&thinsp;${totalBuildings}</div><div class="sc-lbl">BUILDINGS VISITED</div></div>
      <div class="sp-card"><div class="sc-val">${Math.round(s.distance||0)}</div><div class="sc-lbl">DISTANCE WALKED</div></div>
    </div>
    <div class="sp-prog-section">
      ${nextTier
        ?`<div class="sp-prog-label">NEXT UNLOCK <span>${s.interactions}&thinsp;/&thinsp;${nextThresh} visits</span></div>
           <div class="sp-prog-track"><div class="sp-prog-fill" style="width:${pct}%"></div></div>`
        :`<div class="sp-prog-label sp-all-done">✓ all unlocks earned</div>`}
    </div>
    <div class="sp-unlocks">
      <div class="sp-ul-title">UNLOCK HISTORY</div>
      ${unlockRows}
    </div>
    <div class="sp-unlocks">
      <div class="sp-ul-title">ACHIEVEMENTS · ${achList.length}&thinsp;/&thinsp;${ACHIEVEMENTS.length}</div>
      ${achRows}
    </div>`;
}

function renderRaw() {
  const s=getStats();
  const uid=getUserId();
  const name=localStorage.getItem('minicityUser')||'visitor';
  const time=parseInt(localStorage.getItem('minicityTime')||'0');
  const visited=(s.buildingsVisited||[]).length;
  const joined=s.joinDate?new Date(s.joinDate).toISOString().split('T')[0]:new Date().toISOString().split('T')[0];
  const level=calcLevel(s.interactions);

  const F=20, V=17;
  const sep='+'+'-'.repeat(F+2)+'+'+'-'.repeat(V+2)+'+';
  const hdr='| '+('field').padEnd(F)+' | '+('value').padEnd(V)+' |';
  const row=(f,v)=>'| '+String(f).padEnd(F)+' | '+String(v).padEnd(V)+' |';

  const table=[sep,hdr,sep,
    row('user_id',uid),
    row('username',name),
    row('joined',joined),
    row('time_spent',time+'s'),
    row('interactions',s.interactions),
    row('buildings_visited',visited),
    row('city_level',level),
    row('unlocks_earned',s.unlockLevel||0),
    row('distance_walked',Math.round(s.distance||0)),
    row('achievements',(s.achievements||[]).length+'/'+ACHIEVEMENTS.length),
    row('npcs_met',(s.npcsMet||[]).length+'/'+NPC_PROFILES.length),
  sep].join('\n');

  const content=`> SELECT * FROM city_stats\n  WHERE user_id = '${uid}';\n\n${table}\n\n1 row in set (0.001 sec)\n\n> _`;
  document.getElementById('spBody').innerHTML=`<pre class="sp-raw">${content}</pre>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// POPULATION FILTER
// ══════════════════════════════════════════════════════════════════════════════

function setupFilter() {
  document.querySelectorAll('.pf-btn').forEach(btn=>{
    btn.addEventListener('click',()=>setFilter(btn.dataset.filter));
  });
}

function setFilter(filter) {
  currentFilter=filter;
  document.querySelectorAll('.pf-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
  if(filter==='friends'){
    npcList.forEach(npc=>{ if(npc.mesh.visible){ npc.mesh.visible=false; if(npc.tween){ npc.tween.kill(); npc.tween=null; } } });
    showUnlockToast('no friends online yet — invite someone!');
  } else {
    updateNpcSchedules();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL SYSTEM — ancient paper dialog
// ══════════════════════════════════════════════════════════════════════════════

function setupModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
  document.getElementById('npcClose').addEventListener('click', closeNpcDialog);
  document.getElementById('npcOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('npcOverlay')) closeNpcDialog();
  });
}

function openModal(b) {
  const content = BUILDING_CONTENT[b.id];
  if (!content) return;
  const visitor = localStorage.getItem('minicityUser') || '旅人';

  document.getElementById('modalNum').textContent = b.num;
  document.getElementById('modalTitle').textContent = content.name;
  document.getElementById('modalSlogan').textContent = content.slogan;

  const body = document.getElementById('modalBody');
  body.innerHTML = '';
  content.dialog.forEach((line, i) => {
    const p = document.createElement('p');
    p.className = 'modal-line';
    p.textContent = line.replace(/\{Visitor\}/g, visitor);
    p.style.animationDelay = (0.35 + i * 0.22) + 's';
    body.appendChild(p);
  });

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── NPC 交互对话框 ───────────────────────────────────────────────────────────
function openNpcDialog(npc) {
  pauseNpcs();
  dialogOpen=true; activeNpc=npc;
  const s=getStats();
  s.npcsTalked=(s.npcsTalked||0)+1;
  if(!s.npcsMet)s.npcsMet=[];
  if(!s.npcsMet.includes(npc.profile.id))s.npcsMet.push(npc.profile.id);
  saveStats(s);
  checkAchievements();
  if(cursorChar) npc.mesh.rotation.y=Math.atan2(cursorChar.position.x-npc.mesh.position.x,cursorChar.position.z-npc.mesh.position.z);
  const overlay=document.getElementById('npcOverlay');
  document.getElementById('npcName').textContent=npc.profile.name;
  document.getElementById('npcRole').textContent=npc.profile.role;
  document.getElementById('npcAvatar').style.background=
    `linear-gradient(135deg,#${npc.profile.head.toString(16).padStart(6,'0')},#${npc.profile.body.toString(16).padStart(6,'0')})`;
  overlay.classList.add('open');
  showNpcNode(npc.profile.dialog[0]);
}

function showNpcNode(node) {
  activeNode=node;
  const line=document.getElementById('npcLine');
  line.textContent=node.text;
  line.style.animation='none'; void line.offsetWidth; line.style.animation='';
  const optWrap=document.getElementById('npcOptions');
  optWrap.innerHTML='';
  node.options.forEach(o=>{
    const btn=document.createElement('button');
    btn.className='npc-opt';
    btn.textContent=o.text;
    btn.addEventListener('click',()=>{
      if(o.onPick)o.onPick();
      if(o.next!=null) showNpcNode(activeNpc.profile.dialog[o.next]);
      else closeNpcDialog();
    });
    optWrap.appendChild(btn);
  });
}

function closeNpcDialog() {
  if(!dialogOpen)return;
  dialogOpen=false; activeNpc=null; activeNode=null;
  document.getElementById('npcOverlay').classList.remove('open');
  resumeNpcs();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stdMat(p){
  if(!p) return new THREE.MeshStandardMaterial();
  const texKey = p.tex, rx = p.rx || 1, ry = p.ry || 1;
  const o = {};
  Object.keys(p).forEach(k => { if(k!=='tex' && k!=='rx' && k!=='ry') o[k]=p[k]; });
  if(texKey) {
    const t = _tex(texKey, rx, ry);
    if(t) o.map = t;
  }
  if(o.transparent) o.depthWrite=false;
  return new THREE.MeshStandardMaterial(o);
}
function mk(geo,mat){return new THREE.Mesh(resources.geometry(geo),mat);}
function part(group,geo,matOrParams,pos,shadow=true){
  const mat=matOrParams instanceof THREE.Material
    ? matOrParams
    : resources.material({kind:'part',...matOrParams},()=>stdMat(matOrParams));
  const m=new THREE.Mesh(resources.geometry(geo),mat);
  if(pos)m.position.set(pos[0],pos[1],pos[2]);
  m.castShadow=shadow; m.receiveShadow=true;
  if(mat.transparent){m.renderOrder=RENDER_ORDER.transparentSurface;}
  if(group)group.add(m);
  return m;
}

export function startMiniCity() {
  if(started)return;
  started=true;
  eventController=new AbortController();
  initCG({
    onFinish: () => {
      if(localStorage.getItem('minicityUser')) proceedToCity();
      else showLogin();
    },
    reduced: REDUCED,
  });
  document.body.classList.remove('day','night');
  document.body.classList.add(isNight?'night':'day');
  init();
}

export function destroyMiniCity() {
  if(!started)return;
  started=false;
  cancelAnimationFrame(animationFrame);
  clearInterval(clockInterval);
  clearInterval(trackingInterval);
  multiplayer?.close();
  multiplayer=null;
  remotePlayers.clear();
  destroyCG();
  eventController.abort();
  npcList.forEach(npc=>npc.tween?.kill());
  gsap.globalTimeline.clear();
  mapShotRenderer?.dispose();
  mapShotRenderer?.forceContextLoss();
  mapShotRenderer=null;
  renderer?.dispose();
  renderer?.forceContextLoss();
  scene?.clear();
  resources.dispose();
  document.getElementById('labelsWrap')?.replaceChildren();
  document.getElementById('mapIcons')?.replaceChildren();
}

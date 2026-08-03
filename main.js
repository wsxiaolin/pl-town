/* MiniCity — main.js · 物实小城改造版 */
'use strict';

const MOBILE  = () => window.innerWidth <= 680;
const REDUCED = false;

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  DAY_BG:         0xF9F8F6,  NIGHT_BG:       0xD4D3CE,
  DAY_GROUND:     0xF2F1EE,  NIGHT_GROUND:   0xC4C3BE,
  DAY_PATH:       0xE8E7E4,  NIGHT_PATH:     0xBCBBB6,
  BUILDING_WHITE: 0xFFFFFF,  BUILDING_BASE:  0xEAE9E6,
  ROOF_RIM:       0xF8F7F5,  BLUE:           0x3B6FE0,
  FOUNTAIN_RIM:   0xECEBE8,  FOUNTAIN_WATER: 0xC8DAFC,
  GOLD:           0xE8A838,  PARCHMENT:      0xE8D5A8,
  DARK_TOWER:     0x4A4A52,  RUIN_GREY:      0xB5B2AC,
};

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
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (renderer && renderer.capabilities) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (rx || ry) t.repeat.set(rx || 1, ry || 1);
  return t;
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
    _noise(ctx, s, 0.04);
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

  TEX.skyDay = new THREE.CanvasTexture(_texCanvases.skyDay);
  TEX.skyNight = new THREE.CanvasTexture(_texCanvases.skyNight);

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
}

// ── Globals ───────────────────────────────────────────────────────────────────
let renderer, scene, camera, groundMat;
const pathMats = [], lampGlobes = [], buildings = [], npcList = [];
let cursorChar = null;
let playerPath = [];
let lastFrameTime = performance.now();
let isNight    = localStorage.getItem('minicityTheme') === 'night';
let hoveredB   = null, mouseOnScene = false;
let currentFilter = 'bots';
let statsMode = 'clean';
let mapMode = false;
const cameraTarget = new THREE.Vector3(0,0,0);
let cgTimeline = null, cgAutoEnterTimer = null, cgScene5Shown = false;
let dialogOpen = false, activeNpc = null, activeNode = null;
let pendingDistance = 0;

const mouse2D     = new THREE.Vector2(-9999, -9999);
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();
const ROAD_COORDS = [-18, -12, -6, 0, 6, 12, 18];
const CITY_LIMIT = 22;
// 可调参数：镜头与角色
const CONFIG = {
  cameraNearSize: 11,   // 近景视野宽度（越小视角越窄）
  cameraMapSize: 26,    // 底图视野宽度
  cameraEdge: 0.55,     // 人物贴近画面边缘的比例，触发镜头移动
  playerSpeed: 4.2,     // 角色移动速度
  npcTalkRadius: 1.6,   // 玩家需走近该距离才能触发对话
};
const CAMERA_OFFSET = new THREE.Vector3(18,30,18);

// ── Building config ───────────────────────────────────────────────────────────
const PLH = 0.3;

const I = (svg) => `<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;

const BUILDING_DEFS = [
  { id:'activity',   num:'01', label:'活动区',     x: 4,  z:-9, shape:'bank',
    icon:I(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>`) },
  { id:'bulletin',   num:'02', label:'公告板',     x:-4,  z:-9, shape:'board',
    icon:I(`<rect x="4" y="5" width="16" height="14" rx="1"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>`) },
  { id:'techhalf',   num:'03', label:'技术半城',   x: 9,  z:-3, shape:'tower',
    icon:I(`<polyline points="8 6 4 12 8 18"/><polyline points="16 6 20 12 16 18"/>`) },
  { id:'blackhole',  num:'04', label:'黑洞半城',   x:-9,  z:-3, shape:'darktower',
    icon:I(`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="#3B6FE0"/>`) },
  { id:'laws',       num:'05', label:'城的法则',   x: 4,  z: 3, shape:'pavilion',
    icon:I(`<path d="M12 3v18"/><path d="M6 8h12"/><path d="M6 8l-2 6h4z"/><path d="M18 8l-2 6h4z"/>`) },
  { id:'library',    num:'06', label:'图书馆',     x:-4,  z: 3, shape:'library',
    icon:I(`<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/>`) },
  { id:'litreview',  num:'07', label:'文学审核部', x:-9,  z: 3, shape:'ruins',
    icon:I(`<path d="M4 20V8l5-4 5 4v8"/><path d="M14 20V12l6-3v11"/><line x1="4" y1="20" x2="20" y2="20"/>`) },
  { id:'catcafe',    num:'08', label:'猫咖馆',     x: 9,  z: 3, shape:'skyscraper',
    icon:I(`<path d="M6 8V5l3 2"/><path d="M18 8V5l-3 2"/><path d="M5 10c0-2 2-3 7-3s7 1 7 3v5c0 3-3 5-7 5s-7-2-7-5z"/>`) },
  { id:'academy',    num:'09', label:'物实学院',   x: 4,  z: 9, shape:'campus',
    icon:I(`<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1 2.5 3 6 3s6-2 6-3v-5"/>`) },
  { id:'news',       num:'10', label:'星尘报社',   x:-4,  z: 9, shape:'kiosk',
    icon:I(`<rect x="3" y="5" width="18" height="14" rx="1"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/>`) },
  { id:'mutualaid',  num:'11', label:'互助团',     x:-9,  z: 9, shape:'kiosk',
    icon:I(`<path d="M12 21s-7-5-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 11-7 11z"/>`) },
  { id:'screen',     num:'12', label:'大屏幕',     x: 9,  z: 9, shape:'screen',
    icon:I(`<rect x="3" y="4" width="18" height="13" rx="1"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>`) },
  { id:'elevator',   num:'13', label:'电梯',       x: 9,  z:-9, shape:'shaft',
    icon:I(`<rect x="6" y="3" width="12" height="18" rx="1"/><line x1="10" y1="8" x2="12" y2="6"/><line x1="12" y1="6" x2="14" y2="8"/><line x1="10" y1="16" x2="12" y2="18"/><line x1="12" y1="18" x2="14" y2="16"/>`) },
  { id:'residentid', num:'14', label:'居民证',     x:-9,  z:-9, shape:'altar',
    icon:I(`<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="8" cy="12" r="2"/><line x1="13" y1="11" x2="18" y2="11"/><line x1="13" y1="14" x2="16" y2="14"/>`) },
  { id:'stats',      num:'15', label:'STATS',      x:-5.5,z:-5.5,shape:'observatory', isStats:true,
    icon:I(`<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`) },
  { id:'knowledgebase', num:'16', label:'知识库',   x:-15, z:-15, shape:'library',
    icon:I(`<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 4v16"/><path d="M11 8h5"/><path d="M11 12h4"/>`) },
  { id:'newsstand',     num:'17', label:'报摊',     x:-9,  z:-15, shape:'market',
    icon:I(`<path d="M4 7h16v11H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M8 11h4"/><path d="M8 14h8"/>`) },
  { id:'community',     num:'18', label:'社区中心', x: 15, z:-15, shape:'clocktower',
    icon:I(`<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M7 11h2"/><path d="M15 11h2"/>`) },
  { id:'research',      num:'19', label:'研究院',   x: 15, z:-9,  shape:'factory',
    icon:I(`<path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 3h8"/><path d="M8 15h8"/>`) },
  { id:'commons',       num:'20', label:'众议院',   x:-15, z: 3,  shape:'temple',
    icon:I(`<path d="M3 10l9-6 9 6"/><path d="M5 10h14"/><path d="M7 10v8"/><path d="M12 10v8"/><path d="M17 10v8"/><path d="M4 18h16"/>`) },
  { id:'senate',        num:'21', label:'参议院',   x:-15, z: 9,  shape:'temple',
    icon:I(`<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M4 12h16"/>`) },
  { id:'writingclub',   num:'22', label:'文训社',   x:-15, z: 15, shape:'factory',
    icon:I(`<path d="M4 20l4-1 10-10a3 3 0 0 0-4-4L4 15z"/><path d="M13 6l5 5"/>`) },
  { id:'lab',           num:'23', label:'实验楼',   x: 15, z: 3,  shape:'greenhouse',
    icon:I(`<path d="M9 3h6"/><path d="M10 3v5l-4 9a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-9V3"/><path d="M8 16h8"/>`) },
  { id:'culturehall',   num:'24', label:'文化馆',   x: 15, z: 9,  shape:'screen',
    icon:I(`<path d="M4 5h16v14H4z"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="M6 19l3-4"/><path d="M18 19l-3-4"/>`) },
  { id:'teahouse',      num:'25', label:'茶馆',     x: 15, z: 15, shape:'pagoda',
    icon:I(`<path d="M5 10h12v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M17 11h1a2 2 0 0 1 0 4h-1"/><path d="M8 6c0-1 1-1 1-2"/><path d="M12 6c0-1 1-1 1-2"/>`) },
];

// ── Building dialog content (from copywriting) ────────────────────────────────
const BUILDING_CONTENT = {
  activity: {
    name:'活动区', slogan:'在这里领取你的货币吧。',
    dialog:[
      '钱袋落在柜台上，发出一声闷响。',
      '"在这里想要生存，没钱可不行。"柜台后面的人头也没抬，"必要的时候买些东西，以及……贿赂。"',
      '你会有越来越多的追随者，没钱给他们可不行。',
      '「马内的力量，还是大的。」'
    ]
  },
  bulletin: {
    name:'公告板', slogan:'一块镶了铁框、加了雨棚的木板。',
    dialog:[
      '一块普通的大木板，用铁镶了框，还安了雨棚。很明显，这里最近有人来修过。',
      '纸页都有些发黄了，不过还牢牢粘在上面，不掉下来。凑近一点好好看看——并非传单或小报，而是一堆公告。写这些公告的人做事一定特别有条理，句句分明，就是潦草了些。',
      '你正看着，一个空旷的声音忽然响起：',
      '「一座城市，怎么会没有管理人员呢？」',
      '——哦？难道这里还有"管理人员"？'
    ]
  },
  techhalf: {
    name:'技术半城', slogan:'你完全可以相信这里。',
    dialog:[
      '这里的所有居民都是知识居民，都是很友善的。',
      '但它对你没有那么友好——在你真正成为居民之前，也就是当你不再需要这本手册时，你才会体会到这里的乐趣。',
      '也就是说，在别的地方，可能会有危险。',
      '也有一些新居民偏偏喜欢这里，我们称他们为"新知者"。总有一些另一个半城的居民混进来，管理人员的部分工作，就是把他们请回去。他们居住的房子，我们叫"水实验"。',
      '「建议：熟悉这里之前，少接触这个区。」'
    ]
  },
  blackhole: {
    name:'黑洞半城', slogan:'这里包容一切。',
    dialog:[
      '正如名字所说的，这里包容一切。你会找到朋友，也会发现……黑暗。',
      '这里的人鱼龙混杂，尽量避免和坏人接触。什么是坏人？那些被"封禁"的人，他们的"居民权限"失效了——有些只是暂时的，有些是永远的。',
      '不过，我们允许你展示自己的存在，你可以在半城发布你的作品。在这个半城，你可以做作家、数学家、历史学家……某些方面，它比技术半城更多元。',
      '「无论在哪一个半城，那些发布\'水作品\'极多的人，都被称为\'伪用户\'。」'
    ]
  },
  laws: {
    name:'城的法则', slogan:'你违反的每一条法则，都会化作你不甘的泪水。',
    dialog:[
      '一卷羊皮纸摊在石台上，字迹工整得近乎冰冷。',
      '谨记，认真思考管理人员的每一次警告，他们对你的生活有很大影响。',
      '你要做一个好公民。',
      '「法则不是束缚，是这座城还在运转的理由。」'
    ]
  },
  library: {
    name:'图书馆', slogan:'这里是珍藏知识的地方。',
    dialog:[
      '推门进去，空气里是旧纸和木头的味道。',
      '技术半城的人们绞尽脑汁，为大家做出了一些优质作品，他们为了让更多人居住在技术半城而努力贡献。如果你选择住在技术半城，一些基本的知识你要明白——《实验记录》会给予你很大帮助。',
      '黑洞半城的人们也不落后，有些大佬就出现在这个半城。《这都是知识》里收录了他们的智慧。',
      '想当管理人员？翻开《志愿者要求一览》——志愿者是管理人员的基础。怀念外部世界吗？了解一下法律吧，这对你回去有很大帮助。',
      '角落里，一本厚厚的《物实百科全书》静静躺着，记载着这座城的历史与文化。旁边的小说合集，则承诺"文学可以带给你乐趣"。',
      '「招募图书管理员、收集员，欢迎大家。」',
      '待收集：杂文　未完整：小说'
    ]
  },
  litreview: {
    name:'文学审核部', slogan:'「已废弃」',
    dialog:[
      '你看到一行脚印，顺着它走了过去。脚印越来越杂乱。',
      '一栋古里古气的大房子，门前脚印十分杂乱，管理者似乎匆匆忙忙地离开的。门前挂着褪色的牌匾：文学审核部。',
      '原来所有书进图书馆之前都要经过他们的审核。权力还是蛮大的，或许他们有一部分人员就是管理人员。',
      '真令人痛心，这么气宇轩昂的组织……',
      '「已废弃。」',
      '告示板上的字迹还没干透。'
    ]
  },
  catcafe: {
    name:'物实猫咖馆', slogan:'闲暇时光来撸猫也不错。',
    dialog:[
      '一栋高得看不到顶的楼，门牌上画着一只打哈欠的猫。',
      '趁着三月的暖阳，和着微风听听风铃吧。',
      '不过，这可是高达 15000 多层的楼哦。',
      '还有——小心军火！',
      '「猫在窗台上眯着眼，像是已经在这里等了你很久。」'
    ]
  },
  academy: {
    name:'物实学院', slogan:'文化一条街。',
    dialog:[
      '现代化的大楼立在老街尽头，玻璃幕墙反着光。',
      '这貌似是一个学校，不知道里面是什么样子。咦，这里面的课程好像对我们的生存很有帮助。',
      '面前出现了一个五角星。这里可以收藏吗？拿着这些课，以后或许有用。',
      '「知识不是必需品，是奢侈品——但在物实，它两者都是。」'
    ]
  },
  news: {
    name:'星尘报社', slogan:'隶属于 SNO.星尘报社总部。',
    dialog:[
      '"拿着这份报纸吧！"',
      '你抬起头，想问他是哪个报社的。可那个人已经消失了。',
      '你看了看手中的报纸。报纸上写着：',
      '「隶属于 SNO.星尘报社总部」',
      '真有意思，连这都有。看起来，要在这里待一段时间了。',
      '「新闻是这座城里唯一比法则跑得更快的东西。」'
    ]
  },
  mutualaid: {
    name:'互助团', slogan:'你有什么需要吗？',
    dialog:[
      '一张广告贴在墙上，边角被风掀起。',
      '互助团成立了！你有什么需要吗？快来这里投稿吧，我们会尽所可能的帮助你！',
      '你对着空气说："我怎么能离开这里？"',
      '「抱歉，我们属于这里，无法帮你离开。」',
      '不要灰心。这个组织还是很有用的。',
      '「能帮的，他们都会帮。不能帮的，只有你自己。」'
    ]
  },
  screen: {
    name:'大屏幕', slogan:'闪着荧荧的光。',
    dialog:[
      '这条街竟然有尽头。尽头的墙上夹着一块大屏幕，闪着荧荧的光。',
      '屏幕亮起：',
      '你好，欢迎来到物实！',
      '有几点你需要注意：',
      '1. 一定要尊敬管理员们，尤其是紫兰斋。',
      '2. 不要理会那些骂人、刷屏的居民。',
      '3. 如果你是管理人员，记住，你的责任就是"移水"和"处理事件"，不要借着管理人员的名义去……（模糊）',
      '4. 尽量发布一些有意义的作品，否则你会失去一些货币。',
      '5. 请一定把这个大屏幕拆下来揣在兜里。不要担心它会消失——下一个来这里的人，同样也会看到它。',
      '「屏幕可以带走，规则要留下。」'
    ]
  },
  elevator: {
    name:'电梯', slogan:'我们会尽快修复其他按钮。',
    dialog:[
      '你拆下了大屏幕，却发现它后面藏着一架电梯。',
      '门缓缓打开，内部的按钮泛着幽光：',
      '⑤　④　③　②　①　-①',
      '「我们会尽快修复其他按钮。」',
      '一张便签贴在按钮旁，字迹潦草：每一层都是一座城的一部分，但不是每一层都还在。',
      '「选择你的楼层。」'
    ]
  },
  residentid: {
    name:'居民证', slogan:'请撕下这张纸，作为你的居民证。',
    dialog:[
      '一张纸静静躺在石台上，边角整齐。',
      '——————————————————',
      '{Visitor}',
      '我会遵守《这个城的法则》，我已阅读《居民生存指南》。',
      '——————————————————',
      '如你遇到 Bug 类困难，请联系 turtlesim。',
      '你要参与这个故事的话，就请签上你的名字。',
      '「签名之后，你就是这座城的人了。」'
    ]
  },
  knowledgebase: {
    name:'知识库', slogan:'所有被保存的东西，都在这里继续发光。',
    dialog:['墙面像索引一样延伸，抽屉里收着旧讨论、旧作品和被反复引用的词。','管理员给每一类知识都留了入口，免得后来的人在城里迷路。','「先查，再问。能留下来的东西，总会帮助下一个人。」']
  },
  newsstand: {
    name:'报摊', slogan:'消息比路灯亮得更早。',
    dialog:['报纸叠在木箱上，墨迹还没完全干。','摊主说今天的头条换了三次，因为这座城总有人突然出现，也总有人突然消失。','「拿一份吧。知道发生了什么，至少能少走一点弯路。」']
  },
  community: {
    name:'社区中心', slogan:'居民在这里互相确认彼此存在。',
    dialog:['大厅里挂着很多便签，有求助，有招募，也有一句简单的“我在”。','这里没有宏大的仪式，只有人们把零散的需要放到同一张桌子上。','「一座城不是建筑堆出来的，是回应堆出来的。」']
  },
  research: {
    name:'研究院', slogan:'把未知拆开，再小心地装回去。',
    dialog:['白色塔楼里传来低频的嗡鸣，像某种机器正在思考。','研究员们不急着给答案，他们先把问题写得更清楚。','「别害怕复杂。复杂只是还没有被命名。」']
  },
  commons: {
    name:'众议院', slogan:'每一种声音都能短暂停在这里。',
    dialog:['半圆形的座位围着中央讲台，纸页、脚步和争论声混在一起。','有人在讨论道路，有人在讨论规则，还有人在讨论一只猫是否拥有通行权。','「发言吧。城市会记住被认真说出口的话。」']
  },
  senate: {
    name:'参议院', slogan:'慢一点，才能决定更重的事。',
    dialog:['圆顶下的声音被压低，像每句话都要先经过墙壁审查。','这里不处理喧哗，只处理喧哗之后还剩下的问题。','「决定不是结束，是责任开始的地方。」']
  },
  writingclub: {
    name:'文训社', slogan:'把想法磨成能被别人读懂的形状。',
    dialog:['旧屋还亮着灯，桌上摊满修改过的稿纸。','有人划掉形容词，有人补上结尾，也有人只是安静读完。','「写得更清楚，不代表写得更安全。」']
  },
  lab: {
    name:'实验楼', slogan:'失败会被记录，成功也一样。',
    dialog:['玻璃门后是整齐的仪器和不太整齐的便签。','每一次实验都会留下编号，哪怕结果只是证明这条路不通。','「不要把异常丢掉。异常有时候是入口。」']
  },
  culturehall: {
    name:'文化馆', slogan:'城的记忆在这里被展出。',
    dialog:['展厅里有模型、照片、手稿，还有一些无法归类的小东西。','它们不一定重要，但它们共同证明：这座城曾经被很多人认真使用过。','「文化不是纪念品，是居民留下的痕迹。」']
  },
  teahouse: {
    name:'茶馆', slogan:'暂时坐下，也是一种前进。',
    dialog:['茶香从窗缝里慢慢散出来，把街上的急促脚步按慢了一拍。','人们在这里交换传闻，也交换沉默。','「有些答案不会在奔跑时出现。坐一会儿。」']
  },
};

// 道路网格路径点（覆盖整个城市，NPC 只在这些点上移动，不会穿过建筑）
function buildWaypoints() {
  const wps=[];
  ROAD_COORDS.forEach(x=>ROAD_COORDS.forEach(z=>wps.push(new THREE.Vector3(x,0,z))));
  return wps;
}
const WAYPOINTS = buildWaypoints();

// ── NPC 档案 ─────────────────────────────────────────────────────────────────
const NPC_PROFILES = [
  {
    id:'linxu', name:'林叙', role:'图书馆管理员',
    head:0xD4A574, body:0x8B9DBF, home:[-6,6], patrolRadius:8,
    dialog:[
      { text:'「灯还给你留着。这座城的知识，都沉在这些书页里。」', options:[
        { text:'你在管理什么？', next:1 },
        { text:'最近有什么传闻？', next:2 },
        { text:'谢谢，我先走了。', next:null },
      ]},
      { text:'「管理员把重要的东西收进书里：哪些街道不安全、哪些人值得信任。都写在纸上。」', options:[
        { text:'那我该读哪本？', next:3 },
        { text:'原来如此，谢谢。', next:null },
      ]},
      { text:'「传闻说东边老在半夜亮灯，但没几个人愿意承认自己去看过。」', options:[
        { text:'你会去查吗？', next:4 },
        { text:'听起来很可疑。', next:null },
      ]},
      { text:'「《实验记录》最适合新居民。别怕复杂，复杂只是还没被命名。」', options:[
        { text:'记住了，谢谢你。', next:null },
      ]},
      { text:'「我只会记在纸上。好奇心这种事，得你自己去。」', options:[
        { text:'明白了。', next:null },
      ]},
    ],
  },
  {
    id:'laoqin', name:'老秦', role:'修路工 · 向导',
    head:0xC68642, body:0xC4C9D8, home:[0,-6], patrolRadius:9,
    dialog:[
      { text:'「路都是我给铺平的。想认路？先认路名。」', options:[
        { text:'路名怎么认？', next:1 },
        { text:'这条路通到哪里？', next:2 },
        { text:'我赶时间，先走了。', next:null },
      ]},
      { text:'「南北叫街，东西叫道。你沿着数字走，绝不会丢。」', options:[
        { text:'难怪这么整齐。', next:null },
        { text:'记住了，谢谢老秦。', next:null },
      ]},
      { text:'「每条路最后都通向一座楼。你走的每一步，都是去找一个答案。」', options:[
        { text:'说得真够玄的。', next:null },
        { text:'那我该往哪走？', next:3 },
      ]},
      { text:'「往亮的地方走，准没错。夜里要是迷路，就看那些路灯。」', options:[
        { text:'好，心里有数了。', next:null },
      ]},
    ],
  },
  {
    id:'azi', name:'阿紫', role:'星尘报社记者',
    head:0xFDBCB4, body:0x3B6FE0, home:[6,-6], patrolRadius:8,
    dialog:[
      { text:'「嘿，新面孔！报摊头条还没定呢——这座城今天又发生了什么？」', options:[
        { text:'你在写这座城的故事？', next:1 },
        { text:'今天的头条是什么？', next:2 },
        { text:'我没什么可说的。', next:null },
      ]},
      { text:'「每栋楼都有一半的秘密。我的工作，就是把另一半问出来。」', options:[
        { text:'需要我帮忙打听吗？', next:3 },
        { text:'祝你好运。', next:null },
      ]},
      { text:'「还没定。可能是路灯昨夜集体熄灭，也可能是咖啡馆来了只新猫。」', options:[
        { text:'那很有新闻价值。', next:null },
        { text:'别写猫，小心猫咖店长找你。', next:4 },
      ]},
      { text:'「太好了！你要是听到什么怪事，来报摊找我。署你的名。」', options:[
        { text:'成交。', next:null },
      ]},
      { text:'「哈，店长那只猫比我还像主编。」', options:[
        { text:'确实是。', next:null },
      ]},
    ],
  },
  {
    id:'jiujin', name:'九斤', role:'猫咖馆店长',
    head:0x8D5524, body:0xC8C4BE, home:[6,6], patrolRadius:8,
    dialog:[
      { text:'「咪……欢迎光临。猫在上层，规矩在底层。」', options:[
        { text:'听说你的楼有一万五千层？', next:1 },
        { text:'来杯茶，谢谢。', next:2 },
        { text:'我只是路过。', next:null },
      ]},
      { text:'「嗯，一万五千层往上，还有一万五千层往下。猫都记不清。」', options:[
        { text:'那只猫是店主还是你？', next:3 },
        { text:'太夸张了。', next:null },
      ]},
      { text:'「茶温刚好。坐下喝一杯，脚步太快会吓到猫。」', options:[
        { text:'好茶。', next:null },
        { text:'那我慢点走。', next:null },
      ]},
      { text:'「喵。它是前任店长。我，是它雇的。」', options:[
        { text:'……懂了。', next:null },
      ]},
    ],
  },
];

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
  { id:'chat_all',      name:'城中人脉',      desc:'和每一位居民都交谈过',                  check:s=>(s.npcsMet||[]).length>=NPC_PROFILES.length },
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
  addGround(); addPaths(); addFountain();
  addBuildings(); addDecorations(); addCharacters();
  addLabels(); applyRenames();
  setupEvents(); setupFilter();
  setupModal();
  applyTheme(isNight, true);
  initAnimations();
  document.getElementById('labelsWrap').classList.add('hidden');
  requestAnimationFrame(loop);

  checkLogin();
}

// ── Renderer / Camera / Scene / Lighting ──────────────────────────────────────
function setupRenderer() {
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
}
function setupCamera() {
  const vs = CONFIG.cameraNearSize;
  camera = new THREE.OrthographicCamera(-vs,vs,vs,-vs,0.1,200);
  updateCameraProjection(vs);
  setCameraTarget(0,0,true);
}
function setupScene() {
  scene = new THREE.Scene();
  scene.background = isNight ? TEX.skyNight : TEX.skyDay;
  if (!scene.background) scene.background = new THREE.Color(isNight ? P.NIGHT_BG : P.DAY_BG);
}
function setupLighting() {
  const amb = new THREE.AmbientLight(0xFAF8F4, isNight ? 0.60 : 1.05);
  amb.name = 'amb'; scene.add(amb);
  const dir = new THREE.DirectionalLight(0xFFFFFF, isNight ? 0.30 : 0.55);
  dir.name = 'dir'; dir.position.set(14,22,8); dir.castShadow = true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.left=-22; dir.shadow.camera.right=22;
  dir.shadow.camera.top=22;   dir.shadow.camera.bottom=-22;
  dir.shadow.camera.near=0.5; dir.shadow.camera.far=70;
  dir.shadow.bias=-0.0006; dir.shadow.normalBias=0.02;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xD8E8FF, 0.18);
  fill.position.set(-6,8,-6); scene.add(fill);
}
function addGround() {
  groundMat = stdMat({ color: isNight?P.NIGHT_GROUND:P.DAY_GROUND, roughness:1, metalness:0, tex:'ground', rx:22, ry:22 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(110,110), groundMat);
  m.rotation.x = -Math.PI/2; m.receiveShadow = true; scene.add(m);
}

// ── Paths (grid layout for expanded city) ─────────────────────────────────────
function addPaths() {
  const col = isNight ? P.NIGHT_PATH : P.DAY_PATH;

  ROAD_COORDS.forEach(pos => {
    const width = pos === 0 ? 1.9 : 1.2;
    [[width,0.03,44,pos,0.015,0],[44,0.03,width,0,0.015,pos]].forEach(([w,h,d,x,y,z]) => {
      const rx = Math.max(1, w/3), ry = Math.max(1, d/3);
      const mat = stdMat({ color:col, roughness:1, tex:'road', rx:rx, ry:ry });
      pathMats.push(mat);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
      m.position.set(x,y,z); m.receiveShadow = true; scene.add(m);
    });
  });

  ROAD_COORDS.forEach(x => ROAD_COORDS.forEach(z => {
    const mat = stdMat({ color:col, roughness:1, tex:'plaza', rx:1, ry:1 });
    pathMats.push(mat);
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(0.96,0.96,0.034,16), mat);
    plaza.position.set(x,0.018,z); plaza.receiveShadow = true; scene.add(plaza);
  }));

  // Diagonal branch to Stats building at (-5.5, 0, -5.5)
  const diagMat = stdMat({ color:col, roughness:1, tex:'road', rx:1.5, ry:2 });
  pathMats.push(diagMat);
  const diag = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.03,5.66), diagMat);
  diag.position.set(-3.5, 0.015, -3.5);
  diag.rotation.y = Math.PI/4;
  diag.receiveShadow = true; scene.add(diag);
}

// ── Fountain ──────────────────────────────────────────────────────────────────
function addFountain() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(1.35,1.35,0.22,40), {color:P.FOUNTAIN_RIM,roughness:0.75,tex:'stone',rx:3,ry:1}, [0,0,0], true);
  part(g, new THREE.CylinderGeometry(1.0,1.0,0.06,40), {color:P.FOUNTAIN_WATER,roughness:0.05,metalness:0.15}, [0,0.1,0], false);
  part(g, new THREE.CylinderGeometry(0.07,0.07,0.45,12), {color:0xD4D3D0,roughness:0.55,tex:'stone',rx:1,ry:1}, [0,0.13,0], true);
  part(g, new THREE.SphereGeometry(0.11,16,16), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.25,roughness:0.2}, [0,0.69,0], false);
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
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
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
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = PLH+bh;
  part(g, new THREE.BoxGeometry(bw+0.2,0.12,bw+0.2), {color:P.ROOF_RIM,roughness:0.4,tex:'rooftile',rx:2,ry:2}, [0,top+0.06,0]);
  part(g, new THREE.BoxGeometry(1.1,0.72,1.1), {color:0xF9F8F6,roughness:0.06,tex:'glass',rx:1,ry:1}, [0,top+0.12+0.36,0]);
  part(g, new THREE.BoxGeometry(1.22,0.08,1.22), {color:P.ROOF_RIM,roughness:0.4,tex:'metal',rx:1,ry:1}, [0,top+0.12+0.72+0.04,0]);
  part(g, new THREE.CylinderGeometry(0.022,0.022,0.7,8), {color:0xD0CFCC,roughness:0.5,tex:'metal',rx:1,ry:1}, [0,top+0.12+0.72+0.08+0.35,0]);
  const tipY = top+0.12+0.72+0.08+0.7+0.07;
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
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
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
  // Glowing screen on front face
  const screenMat = stdMat({color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.25,roughness:0.1});
  part(g, new THREE.BoxGeometry(bw*0.8,bh*0.7,0.04), screenMat, [0,0.25+bh*0.5,0.32], false);
  // Screen frame
  part(g, new THREE.BoxGeometry(bw*0.85,bh*0.75,0.06), {color:0x2A2A30,roughness:0.3}, [0,0.25+bh*0.5,0.30], false);
  // Screen glow lines
  for (let i = 0; i < 4; i++) {
    part(g, new THREE.BoxGeometry(bw*0.6,0.03,0.02), {color:0xA8C8F8,emissive:0xA8C8F8,emissiveIntensity:0.2}, [0,0.25+bh*0.3+i*0.4,0.34], false);
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
  const bodyMat = mkBodyMat('wood', 1, 1);
  for (let i = 0; i < tiers; i++) {
    const w = bw * (1 - i * 0.18);
    const body = mk(new THREE.BoxGeometry(w, tierH, w), bodyMat);
    body.position.y = y + tierH/2; body.castShadow = body.receiveShadow = true; g.add(body);
    const roofW = w + 0.6;
    const roof = part(g, new THREE.ConeGeometry(roofW * 0.72, 0.22, 4), {color:0xC45A4A,roughness:0.4,tex:'pagoda_tile',rx:2,ry:1}, [0, y + tierH + 0.11, 0]);
    roof.rotation.y = Math.PI/4;
    y += tierH + 0.2;
  }
  part(g, new THREE.ConeGeometry(0.08, 0.35, 6), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.2}, [0, y, 0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body:g.children[1], bodyMat, labelEl:null, labelY:y+0.5};
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

const SHAPE_FNS = {
  bank:buildBank, board:buildBoard, tower:buildTower, darktower:buildDarkTower,
  pavilion:buildPavilion, library:buildLibrary, ruins:buildRuins,
  skyscraper:buildSkyscraper, campus:buildCampus, kiosk:buildKiosk,
  screen:buildScreen, shaft:buildShaft, altar:buildAltar, observatory:buildObservatory,
  pagoda:buildPagoda, market:buildMarket, greenhouse:buildGreenhouse,
  clocktower:buildClockTower, temple:buildTemple, factory:buildFactory
};

function addBuildings() {
  BUILDING_DEFS.forEach(cfg => {
    const b = SHAPE_FNS[cfg.shape](cfg);
    b.group.position.y = -3; // Start hidden below ground for entrance animation
    scene.add(b.group); buildings.push(b);
  });
}

// ── Decorations ───────────────────────────────────────────────────────────────
function addDecorations() {
  addDistrictBuildings();
  addCentralPark();
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
  addPond(-18, 18, 2.5);
  addPond(18, -18, 2.0);
  addFlowerbed(-3.0, 0, 4.0); addFlowerbed(3.0, 0, -4.0);
  addLamps([[0+1.9,0,-18.9],[0-1.9,0,18.9],[-18.9,0,0+1.9],[18.9,0,0-1.9]]);
  ROAD_COORDS.forEach(p=>{
    addLamps([[p+1.9,0,-18.9],[p-1.9,0,18.9],[-18.9,0,p+1.9],[18.9,0,p-1.9]]);
  });
}

function addDistrictBuildings() {
  const centers=[-21,-15,-9,-3,3,9,15,21], lots=[];
  centers.forEach(x=>centers.forEach(z=>{
    if(Math.hypot(x,z)<4.8)return;
    [[0,0],[-1.35,1.15],[1.25,-1.2]].forEach(([dx,dz],k)=>{
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
    [0xD8C8A0, 'brick'], [0xF0EFEC, 'stone'], [0xE8E0D5, 'brick']
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
  g.position.set(x,y,z); g.rotation.y=(i%4)*Math.PI/2; scene.add(g);
}

function addTrees(positions) {
  positions.forEach(([x,,z]) => {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.06,0.09,0.38,8), {color:0xE0DFDC,roughness:0.9,tex:'wood',rx:1,ry:1}, [0,0.19,0]);
    part(g, new THREE.SphereGeometry(0.30,12,12), {color:0xF5F4F2,roughness:0.85}, [0,0.66,0]);
    g.position.set(x,0,z); scene.add(g);
  });
}
function addLamps(positions) {
  positions.forEach(([x,,z]) => {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.04,0.04,1.15,8), {color:0xCDCCCA,roughness:0.7,tex:'metal',rx:1,ry:1}, [0,0.575,0]);
    const gm = stdMat({color:0xF8F7F5,roughness:0.15,emissive:0xEEF0FF,emissiveIntensity:isNight?0.6:0.05});
    const globe = mk(new THREE.SphereGeometry(0.13,14,14),gm);
    globe.position.y=1.28; g.add(globe); lampGlobes.push(gm);
    g.position.set(x,0,z); scene.add(g);
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

// ── Park & City Areas ────────────────────────────────────────────────────────
function addCentralPark() {
  // Large grassy area around the center
  const r = 3.5;
  const grassMat = stdMat({color:0xC8D8A8, roughness:1, tex:'grass', rx:4, ry:4});
  const grass = new THREE.Mesh(new THREE.CircleGeometry(r, 32), grassMat);
  grass.rotation.x = -Math.PI/2; grass.position.set(0, 0.015, 0); grass.receiveShadow = true;
  scene.add(grass);
  // Park trees
  addTrees([[-2.5,0,-2.5],[2.5,0,-2.5],[-2.5,0,2.5],[2.5,0,2.5]]);
  // Park benches
  addBench(-1.8, 0, 0, Math.PI/2); addBench(1.8, 0, 0, -Math.PI/2);
  // Flowerbeds around fountain
  addFlowerbed(-2.0, 0, -2.0); addFlowerbed(2.0, 0, 2.0);
  addFlowerbed(-2.0, 0, 2.0); addFlowerbed(2.0, 0, -2.0);
  // Park lamps
  addLamps([[-2.0,0,-1.0],[2.0,0,1.0]]);
  // Hedges along edges
  addHedgeRow(-3.0, 0, 0); addHedgeRow(3.0, 0, 0);
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
  pond.rotation.x = -Math.PI/2; pond.position.set(cx, 0.03, cz); scene.add(pond);
  // Stone border
  for (let i = 0; i < 12; i++) {
    const a = (i/12)*Math.PI*2;
    const stone = part(null, new THREE.SphereGeometry(0.15, 8, 8), {color:0xC4A86D, roughness:0.7, tex:'stone', rx:1, ry:1});
    stone.position.set(cx+Math.cos(a)*r, 0.05, cz+Math.sin(a)*r);
    scene.add(stone);
  }
  // Lily pads
  for (let i = 0; i < 3; i++) {
    const a = Math.random()*Math.PI*2, d = Math.random()*r*0.6;
    const lily = part(null, new THREE.CircleGeometry(0.12+Math.random()*0.05, 8), {color:0x5A8A3A, roughness:0.9, tex:'grass', rx:1, ry:1});
    lily.rotation.x = -Math.PI/2; lily.position.set(cx+Math.cos(a)*d, 0.04, cz+Math.sin(a)*d);
    scene.add(lily);
  }
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
  const shadow=mk(new THREE.CircleGeometry(0.17,16),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.11}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=0.012; g.add(shadow);
  const body=mk(new THREE.CylinderGeometry(0.10,0.13,0.30,12),stdMat({color:bodyHex,roughness:0.6}));
  body.position.y=0.15; body.castShadow=true; g.add(body);
  const head=mk(new THREE.SphereGeometry(0.135,14,14),stdMat({color:headHex,roughness:0.5}));
  head.position.y=0.43; head.castShadow=true; g.add(head);
  return g;
}
function addCharacters() {
  if (REDUCED) return;
  NPC_PROFILES.forEach(profile=>{
    const g=makeCharacter(profile.head,profile.body);
    g.traverse(c=>{ if(c.isMesh) c.userData.npcId=profile.id; });
    const start=WAYPOINTS[0];
    g.position.set(start.x,0,start.z); scene.add(g);
    const npc={profile, mesh:g, tween:null, patrol:waypointsNear(profile.home,profile.patrolRadius)};
    npcList.push(npc);
    if (!MOBILE()) scheduleWalk(npc);
  });
  cursorChar=makeCharacter(0xA8C8F8,0x3B6FE0);
  cursorChar.visible=false; scene.add(cursorChar);
}

function waypointsNear(home, radius) {
  const pts=WAYPOINTS.filter(p=>Math.hypot(p.x-home[0],p.z-home[1])<=radius);
  return pts.length?pts:WAYPOINTS.slice(0,8);
}

function scheduleWalk(npc) {
  if (npc.walking===false) return;
  const pool=npc.patrol;
  let ni;
  do{ ni=Math.floor(Math.random()*pool.length); }
  while(pool[ni].distanceTo(npc.mesh.position)<0.1);
  const target=pool[ni];
  const from=npc.mesh.position.clone();
  const dur=Math.max(1.0,from.distanceTo(target)/1.4)+Math.random()*0.8;
  gsap.to(npc.mesh.rotation,{y:Math.atan2(target.x-from.x,target.z-from.z),duration:0.35,ease:'power1.out'});
  npc.tween=gsap.to(npc.mesh.position,{x:target.x,z:target.z,duration:dur,ease:'power1.inOut',
    onComplete:()=>{ npc.tween=null; if(npc.walking!==false) gsap.delayedCall(0.5+Math.random()*2.0,()=>scheduleWalk(npc)); }});
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
    if (!MOBILE()) scheduleWalk(npc);
  });
}

function nearestNpcTo(p, radius) {
  let best=null, bestD=radius;
  npcList.forEach(npc=>{
    const d=npc.mesh.position.distanceTo(p);
    if(d<bestD){ bestD=d; best=npc; }
  });
  return best;
}

function npcForRaycast() {
  const hits=raycaster.intersectObjects(npcList.map(n=>n.mesh),true);
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
    el.addEventListener('click',e=>{e.preventDefault();navigateTo(b);});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigateTo(b);}});
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
  canvas.addEventListener('mousemove',onMouseMove);
  canvas.addEventListener('click',onCanvasClick);
  canvas.addEventListener('mouseenter',()=>{mouseOnScene=true; if(cursorChar)cursorChar.visible=true;});
  canvas.addEventListener('mouseleave',()=>{mouseOnScene=false; if(cursorChar)cursorChar.visible=false;});

  document.getElementById('themeToggle').addEventListener('click',()=>{
    isNight=!isNight;
    document.body.classList.toggle('night',isNight);
    document.body.classList.toggle('day',!isNight);
    localStorage.setItem('minicityTheme',isNight?'night':'day');
    applyTheme(isNight,false);
    const s=getStats();
    if(isNight)s.nightToggles=(s.nightToggles||0)+1;
    saveStats(s);
    checkAchievements();
  });
  document.getElementById('mapToggle').addEventListener('click',toggleMapMode);

  document.getElementById('spClose').addEventListener('click',closeStatsPanel);
  document.getElementById('spModeClean').addEventListener('click',()=>setStatsMode('clean'));
  document.getElementById('spModeRaw').addEventListener('click',()=>setStatsMode('raw'));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeStatsPanel();closeModal();closeNpcDialog();}
  });

  document.getElementById('loginBtn').addEventListener('click',doLogin);
  document.getElementById('loginInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

  document.getElementById('cgSkip').addEventListener('click',skipCG);

  window.addEventListener('resize',()=>{
    const w=window.innerWidth,h=window.innerHeight,vs=mapMode?CONFIG.cameraMapSize:CONFIG.cameraNearSize;
    renderer.setSize(w,h);
    updateCameraProjection(vs);
  });
}

function onMouseMove(e) {
  mouse2D.x=(e.clientX/window.innerWidth)*2-1;
  mouse2D.y=-(e.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse2D,camera);
  raycaster.ray.intersectPlane(groundPlane,cursorWorld);
  raycaster.setFromCamera(mouse2D,camera);
  const hits=raycaster.intersectObjects(buildings.map(b=>b.group),true);
  if(hits.length){
    const id=hits[0].object.userData.buildingId;
    const b=buildings.find(x=>x.id===id);
    if(b&&b!==hoveredB){if(hoveredB)unhover(hoveredB);hover(b);}
  } else{if(hoveredB)unhover(hoveredB);hoveredB=null;}
}
function onCanvasClick() {
  if (dialogOpen) return;
  raycaster.setFromCamera(mouse2D,camera);
  const npcHit=npcForRaycast();
  if(npcHit){ talkToOrWalk(npcHit); return; }
  const hits=raycaster.intersectObjects(buildings.map(b=>b.group),true);
  if(hits.length){const b=buildings.find(x=>x.id===hits[0].object.userData.buildingId);if(b)navigateTo(b);return;}
  const near=nearestNpcTo(cursorWorld,CONFIG.npcTalkRadius);
  if(near){ talkToOrWalk(near); return; }
  movePlayerTo(cursorWorld);
}

function talkToOrWalk(npc) {
  if(cursorChar && cursorChar.position.distanceTo(npc.mesh.position)<=CONFIG.npcTalkRadius){
    openNpcDialog(npc);
  } else {
    movePlayerTo(npc.mesh.position);
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
  if (REDUCED) { openModal(b); return; }
  const overlay=document.getElementById('transitionOverlay');
  const v=b.group.position.clone(); v.y=1.5; v.project(camera);
  const sx=(v.x*0.5+0.5)*window.innerWidth, sy=((-v.y)*0.5+0.5)*window.innerHeight;
  gsap.set(overlay,{left:sx,top:sy,xPercent:-50,yPercent:-50,scale:0.04,opacity:1,borderRadius:'50%',pointerEvents:'all'});
  gsap.to(overlay,{scale:55,borderRadius:'0%',duration:0.62,ease:'power3.in',onComplete:()=>{
    openModal(b);
    gsap.to(overlay,{opacity:0,duration:0.35,delay:0.05,onComplete:()=>{
      gsap.set(overlay,{scale:0.04,pointerEvents:'none'});
    }});
  }});
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
  tweenColor(groundMat.color,night?P.NIGHT_GROUND:P.DAY_GROUND,d);
  pathMats.forEach(m=>tweenColor(m.color,night?P.NIGHT_PATH:P.DAY_PATH,d));
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
    const v=b.group.position.clone();
    v.y=b.group.position.y+b.labelY;
    v.project(camera);
    b.labelEl.style.left=((v.x*0.5+0.5)*window.innerWidth)+'px';
    b.labelEl.style.top=(((-v.y)*0.5+0.5)*window.innerHeight)+'px';
  });
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  const now=performance.now();
  const delta=Math.min((now-lastFrameTime)/1000,0.05);
  lastFrameTime=now;
  updatePlayerMovement(delta);
  updateCameraFollow(delta);
  updateLabels();
  renderer.render(scene,camera);
}

function toggleMapMode() {
  mapMode=!mapMode;
  const btn=document.getElementById('mapToggle');
  btn&&btn.classList.toggle('active',mapMode);
  const size=mapMode?CONFIG.cameraMapSize:CONFIG.cameraNearSize;
  animateCameraSize(size);
  if(mapMode) setCameraTarget(0,0,false);
  else if(cursorChar) setCameraTarget(cursorChar.position.x,cursorChar.position.z,false);
}

function updateCameraFollow(delta) {
  if(!cursorChar||mapMode)return;
  const v=cursorChar.position.clone();
  v.y=0.4; v.project(camera);
  if(Math.abs(v.x)>CONFIG.cameraEdge||Math.abs(v.y)>CONFIG.cameraEdge){
    const t=1-Math.pow(0.001,delta);
    setCameraTarget(
      cameraTarget.x+(cursorChar.position.x-cameraTarget.x)*t,
      cameraTarget.z+(cursorChar.position.z-cameraTarget.z)*t,
      true
    );
  }
}

function setCameraTarget(x,z,instant) {
  const nx=clamp(x,-10,10), nz=clamp(z,-10,10);
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

function animateCameraSize(size) {
  const state={v:camera.top};
  gsap.to(state,{v:size,duration:0.55,ease:'power2.out',onUpdate:()=>updateCameraProjection(state.v)});
}

function movePlayerTo(target) {
  if(!cursorChar||dialogOpen)return;
  cursorChar.visible=true;
  playerPath = buildRoadPath(cursorChar.position, target);
}

function updatePlayerMovement(delta) {
  if(!cursorChar||!playerPath.length)return;
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
  cursorChar.rotation.y=Math.atan2(dx,dz);
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
  const start=nearestRoadPoint(from);
  const end=nearestRoadPoint(rawTarget);
  const mid1=new THREE.Vector3(start.x,0,end.z);
  const mid2=new THREE.Vector3(end.x,0,start.z);
  const useMid1=isRoadPoint(mid1)?mid1:mid2;
  return [start,useMid1,end].filter((p,i,arr)=>i===0||p.distanceTo(arr[i-1])>0.05);
}

function nearestRoadPoint(p) {
  const x=clamp(p.x,-CITY_LIMIT,CITY_LIMIT), z=clamp(p.z,-CITY_LIMIT,CITY_LIMIT);
  const rx=nearestRoadCoord(x), rz=nearestRoadCoord(z);
  return Math.abs(x-rx)<Math.abs(z-rz) ? new THREE.Vector3(rx,0,z) : new THREE.Vector3(x,0,rz);
}

function nearestRoadCoord(v) {
  return ROAD_COORDS.reduce((best,c)=>Math.abs(v-c)<Math.abs(v-best)?c:best,ROAD_COORDS[0]);
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
  checkUnlocks(s);
  checkAchievements();
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
  setInterval(()=>{
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
  const name=(input.value||'').trim();
  if(!name)return;
  localStorage.setItem('minicityUser',name);
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
  startTimeTracking();
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
  const showNPCs=(filter!=='friends');
  npcList.forEach(npc=>{ npc.mesh.visible=showNPCs; });
  if(!showNPCs) showUnlockToast('no friends online yet — invite someone!');
}

// ══════════════════════════════════════════════════════════════════════════════
// CG ANIMATION SYSTEM — 5-scene opening cinematic
// ══════════════════════════════════════════════════════════════════════════════

function shouldShowCG() {
  return !localStorage.getItem('minicityCGSeenV2');
}

function startCG() {
  const overlay = document.getElementById('cgOverlay');
  const wrap = document.getElementById('cgSceneWrap');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
  cgScene5Shown = false;

  if (REDUCED) { endCG(); return; }

  cgTimeline = gsap.timeline();

  cgTimeline.call(() => scene1(wrap), [], 0)
           .to({}, {duration: 4}, 0);
  cgTimeline.call(() => scene2(wrap), [], 4)
           .to({}, {duration: 4}, 4);
  cgTimeline.call(() => scene3(wrap), [], 8)
           .to({}, {duration: 4}, 8);
  cgTimeline.call(() => scene4(wrap), [], 12)
           .to({}, {duration: 4}, 12);
  cgTimeline.call(() => scene5(wrap), [], 16);
}

function scene1(wrap) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-void"><div class="cg-fall-lines"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">UNKNOWN ALTITUDE</span>
      <p class="cg-line cg-line-large">坠落。</p>
      <p class="cg-line" style="animation-delay:1.7s">可地面始终没有到来。</p>
    </div>`;
}

function scene2(wrap) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-wake"><div class="cg-horizon"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">SIGNAL ACQUIRED</span>
      <p class="cg-line">你睁开眼睛。</p>
      <p class="cg-line cg-highlight" style="animation-delay:1.8s">陌生的天际线正在苏醒。</p>
    </div>`;
}

function scene3(wrap) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-city"><div class="cg-city-silhouette"></div><div class="cg-searchlight"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">SECTOR 00 / MINICITY</span>
      <p class="cg-line">道路把城市切成两半。</p>
      <p class="cg-line" style="animation-delay:1.6s">一半明亮，一半吞没所有回声。</p>
    </div>`;
}

function scene4(wrap) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-approach"><div class="cg-gate"></div></div>
    <div class="cg-frame"></div>
    <div class="cg-text-block">
      <span class="cg-kicker">CITY LIMIT</span>
      <p class="cg-line cg-quote">「一座城市，怎么会没有管理人员呢？」</p>
      <p class="cg-line" style="animation-delay:1.8s">空旷的声音，像是在回答你。</p>
    </div>`;
}

function scene5(wrap) {
  if (cgScene5Shown) return;
  cgScene5Shown = true;
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-title"></div>
    <div class="cg-frame"></div>
    <div class="cg-title-block">
      <span class="cg-kicker">A CITY AWAITS</span>
      <h1 class="cg-title">物实小城</h1>
      <p class="cg-title-en">MINICITY</p>
      <button class="cg-enter-btn" id="cgEnterBtn">进入边界</button>
    </div>`;
  const btn = document.getElementById('cgEnterBtn');
  if (btn) btn.addEventListener('click', endCG);
  cgAutoEnterTimer = setTimeout(endCG, 8000);
}

function skipCG() {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  if (cgAutoEnterTimer) { clearTimeout(cgAutoEnterTimer); cgAutoEnterTimer = null; }
  const wrap = document.getElementById('cgSceneWrap');
  scene5(wrap);
}

function endCG() {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  if (cgAutoEnterTimer) { clearTimeout(cgAutoEnterTimer); cgAutoEnterTimer = null; }
  localStorage.setItem('minicityCGSeenV2', 'true');
  const overlay = document.getElementById('cgOverlay');
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
    if(localStorage.getItem('minicityUser')) proceedToCity();
    else showLogin();
  }, 600);
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
  return new THREE.MeshStandardMaterial(o);
}
function mk(geo,mat){return new THREE.Mesh(geo,mat);}
function part(group,geo,matOrParams,pos,shadow=true){
  const mat=matOrParams instanceof THREE.Material?matOrParams:stdMat(matOrParams);
  const m=new THREE.Mesh(geo,mat);
  if(pos)m.position.set(pos[0],pos[1],pos[2]);
  m.castShadow=shadow; m.receiveShadow=true;
  if(group)group.add(m);
  return m;
}

// ── Start ─────────────────────────────────────────────────────────────────────
document.body.classList.remove('day','night');
document.body.classList.add(isNight?'night':'day');
init();

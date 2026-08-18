import * as THREE from 'three';
import { gsap } from 'gsap';
import { townGameHour } from '../gameplay/time/townClock';
import type { LegacyStats } from './progression/legacyStats';

export type ThemeClockOptions = {
  getSkyTextures: () => { skyDay: THREE.Texture | null; skyNight: THREE.Texture | null };
  getScene: () => THREE.Scene;
  getPalette: () => { NIGHT_BG: number; DAY_BG: number; NIGHT_PATH: number; DAY_PATH: number };
  getPathMaterials: () => THREE.MeshStandardMaterial[];
  getGroundMaterials: () => { mat: THREE.MeshStandardMaterial; night: number; day: number }[];
  getLampGlobes: () => THREE.MeshStandardMaterial[];
  getIsNight: () => boolean;
  setIsNight: (value: boolean) => void;
  getGameClock: () => number;
  setGameClock: (value: number) => void;
  announceGuide: () => void;
  invalidateMapShot: () => void;
  updateNpcSchedules: () => void;
  getStats: () => LegacyStats;
  saveStats: (stats: LegacyStats) => void;
  checkAchievements: () => void;
};

export function createThemeClock(options: ThemeClockOptions) {
  function tweenColor(c: THREE.Color, hex: number, dur: number) {
    const t = new THREE.Color(hex);
    if (dur === 0) { c.copy(t); return; }
    gsap.to(c, { r: t.r, g: t.g, b: t.b, duration: dur, ease: 'power2.inOut' });
  }

  function applyTheme(night: boolean, instant: boolean) {
    const d = instant ? 0 : 0.72;
    const scene = options.getScene();
    const P = options.getPalette();
    const TEX = options.getSkyTextures();
    if (TEX.skyDay && TEX.skyNight) {
      scene.background = night ? TEX.skyNight : TEX.skyDay;
    } else if (scene.background instanceof THREE.Color) {
      tweenColor(scene.background, night ? P.NIGHT_BG : P.DAY_BG, d);
    }
    options.getPathMaterials().forEach(m => tweenColor(m.color, night ? P.NIGHT_PATH : P.DAY_PATH, d));
    options.getGroundMaterials().forEach(g => tweenColor(g.mat.color, night ? g.night : g.day, d));
    const amb = scene.getObjectByName('amb'), dir = scene.getObjectByName('dir');
    if (amb) gsap.to(amb, { intensity: night ? 0.60 : 1.05, duration: d });
    if (dir) gsap.to(dir, { intensity: night ? 0.30 : 0.55, duration: d });
    options.getLampGlobes().forEach(m => gsap.to(m, { emissiveIntensity: night ? 0.60 : 0.05, duration: d }));
  }

  function syncTimeAndTheme() {
    const gameClock = townGameHour();
    options.setGameClock(gameClock);
    options.announceGuide();
    const night = gameClock >= 19 || gameClock < 6;
    if (night !== options.getIsNight()) {
      options.setIsNight(night);
      document.body.classList.toggle('night', night);
      document.body.classList.toggle('day', !night);
      applyTheme(night, false);
      setTimeout(() => options.invalidateMapShot(), 1000);
      if (night) {
        const s = options.getStats();
        s.nightToggles = (s.nightToggles || 0) + 1;
        options.saveStats(s);
        options.checkAchievements();
      }
    }
    const el = document.getElementById('communityTime');
    if (el) {
      const h = Math.floor(gameClock), m = Math.floor((gameClock - h) * 60);
      el.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
    options.updateNpcSchedules();
  }

  return { applyTheme, syncTimeAndTheme };
}

import * as THREE from 'three';
import { gsap } from 'gsap';
import type { BuildingEntity } from '../city/buildingEntity';
import { restoreBuildingPresentation } from '../city/buildingDamage';
import { getCityConfig, getCityState, isConstructionPending, subscribeCityGovernance } from '../city/cityGovernanceClient';
import { RENDER_ORDER, SURFACE_Y } from './layers';

type Kind = 'oak' | 'pine' | 'cherry' | 'lamp' | 'bench' | 'flowers';
type Item = { key: string; kind: Kind | 'road'; x: number; z: number; width?: number; depth?: number };
type Visual = { signature: string; root: THREE.Group; glow?: THREE.MeshStandardMaterial; light?: THREE.PointLight };
const MAX_CONSTRUCTION_POINT_LIGHTS = 8;

export function createCityConstructionScene(options: {
  scene: THREE.Scene;
  buildings: BuildingEntity[];
  buildingPlots: readonly THREE.Object3D[];
  buildingAttachments?: ReadonlyMap<string, readonly THREE.Object3D[]>;
  getIsNight: () => boolean;
  refreshCollisions: () => void;
  refreshLabels: () => void;
  onConstructionChanged: () => void;
  onBuildingRestored: (building: BuildingEntity) => void;
}) {
  const root = new THREE.Group();
  root.name = 'city-construction';
  options.scene.add(root);
  const hidden = new Map<BuildingEntity, { children: THREE.Object3D[]; labelY?: number; body?: THREE.Mesh }>();
  const visuals = new Map<string, Visual>();
  const detachedPlots = new Map<THREE.Object3D, THREE.Object3D>();
  const detachedAttachments = new Map<THREE.Object3D, THREE.Object3D[]>();
  const plotsByBuilding = new Map<string, THREE.Object3D[]>();
  for (const plot of options.buildingPlots) {
    const buildingId = plot.userData.buildingId as string | undefined;
    if (!buildingId) continue;
    const plots = plotsByBuilding.get(buildingId) ?? [];
    plots.push(plot);
    plotsByBuilding.set(buildingId, plots);
  }
  let disposed = false;
  let night = options.getIsNight();

  function release(visual: Visual) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    visual.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    visual.light?.dispose();
    visual.root.removeFromParent();
  }

  function makeVisual(item: Item): Visual {
    const group = new THREE.Group();
    group.position.set(item.x, SURFACE_Y.landscape + 0.012, item.z);
    group.name = item.key;
    const visual: Visual = { signature: JSON.stringify(item), root: group };
    const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const part = (geometry: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = item.kind !== 'road';
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    if (item.kind === 'road') {
      const mat = material(0xaeb8ad);
      mat.depthWrite = false;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -1;
      const mesh = part(new THREE.PlaneGeometry(item.width!, item.depth!), mat, 0, 0, 0);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = RENDER_ORDER.roadMarking;
      group.position.y = SURFACE_Y.roadMarking + 0.012;
    } else if (item.kind === 'lamp') {
      const metal = material(0x4e5a59);
      part(new THREE.CylinderGeometry(0.08, 0.14, 0.14, 10), metal, 0, 0.07, 0);
      part(new THREE.CylinderGeometry(0.045, 0.065, 1.65, 8), metal, 0, 0.9, 0);
      visual.glow = material(0xffecc9);
      visual.glow.emissive.setHex(0xffd9a1);
      part(new THREE.SphereGeometry(0.16, 12, 8), visual.glow, 0, 1.8, 0);
      visual.light = new THREE.PointLight(0xffd9a1, 0, 4, 2);
      visual.light.position.y = 1.8;
      group.add(visual.light);
    } else if (item.kind === 'bench') {
      const wood = material(0xa97950);
      const metal = material(0x515a59);
      for (const x of [-0.48, 0.48]) part(new THREE.BoxGeometry(0.09, 0.45, 0.45), metal, x, 0.225, 0);
      part(new THREE.BoxGeometry(1.3, 0.1, 0.5), wood, 0, 0.48, 0);
      part(new THREE.BoxGeometry(1.3, 0.35, 0.08), wood, 0, 0.72, -0.22);
    } else if (item.kind === 'flowers') {
      part(new THREE.CylinderGeometry(0.52, 0.47, 0.18, 16), material(0x777c70), 0, 0.09, 0);
      const leaves = material(0x54844c);
      const petals = [material(0xedafc4), material(0xf5d176), material(0xbfa4dd)];
      for (let i = 0; i < 9; i++) {
        const angle = i * 2.39996;
        const r = 0.12 + (i % 3) * 0.12;
        const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
        part(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 5), leaves, x, 0.24, z);
        part(new THREE.SphereGeometry(0.09, 7, 5), petals[i % 3]!, x, 0.36, z);
      }
    } else {
      const wood = material(0x795b43);
      part(new THREE.CylinderGeometry(0.09, 0.16, 1.25, 9), wood, 0, 0.625, 0);
      const foliage = material(item.kind === 'cherry' ? 0xe5a2bd : item.kind === 'pine' ? 0x376956 : 0x68944f);
      if (item.kind === 'pine') {
        for (let i = 0; i < 3; i++) part(new THREE.ConeGeometry(0.72 - i * 0.16, 0.95, 9), foliage, 0, 1.15 + i * 0.45, 0);
      } else {
        for (const [x, y, z, radius] of [[0, 1.7, 0, 0.66], [-0.42, 1.4, 0.1, 0.48], [0.4, 1.45, -0.1, 0.5]]) {
          part(new THREE.SphereGeometry(radius, 10, 8), foliage, x!, y!, z!);
        }
      }
    }
    root.add(group);
    return visual;
  }

  function updateLighting() {
    night = options.getIsNight();
    let activeLights = 0;
    for (const visual of visuals.values()) {
      if (visual.glow) visual.glow.emissiveIntensity = night ? 0.9 : 0.03;
      if (visual.light) {
        // Three's WebGLLights counts zero-intensity lights too, and its standard
        // shader unrolls NUM_POINT_LIGHTS. WebGLRenderer skips invisible lights,
        // so bound the shader cost while preserving every lamp's emissive globe.
        visual.light.visible = night && activeLights++ < MAX_CONSTRUCTION_POINT_LIGHTS;
        visual.light.intensity = visual.light.visible ? 1.4 : 0;
      }
    }
  }

  function sync() {
    if (disposed) return;
    const config = getCityConfig();
    const state = getCityState();
    const restored: BuildingEntity[] = [];
    let changed = false;
    for (const building of options.buildings) {
      const pending = isConstructionPending(building.id);
      building.group.userData.constructionPending = pending;
      // Plot planes live directly in the scene, outside the building group.
      // Detach them so both rendering and plot raycasts lose the empty lot.
      for (const plot of plotsByBuilding.get(building.id) ?? []) {
        if (pending && plot.parent) {
          detachedPlots.set(plot, plot.parent);
          plot.removeFromParent();
          changed = true;
        } else if (!pending && detachedPlots.has(plot)) {
          detachedPlots.get(plot)!.add(plot);
          detachedPlots.delete(plot);
          changed = true;
        }
      }
      for (const attachment of options.buildingAttachments?.get(building.id) ?? []) {
        if (pending && !detachedAttachments.has(attachment)) {
          detachedAttachments.set(attachment, [...attachment.children]);
          attachment.clear();
          changed = true;
        } else if (!pending && detachedAttachments.has(attachment)) {
          attachment.add(...detachedAttachments.get(attachment)!);
          detachedAttachments.delete(attachment);
          changed = true;
        }
      }
      if (pending && !hidden.has(building)) {
        restoreBuildingPresentation(building);
        hidden.set(building, { children: [...building.group.children], labelY: building.labelY, body: building.body });
        building.group.clear();
        building.body = undefined;
        building.labelY = 0.25;
        gsap.killTweensOf(building.group.position);
        building.group.position.y = 0;
        changed = true;
      } else if (!pending && hidden.has(building)) {
        const saved = hidden.get(building)!;
        building.group.add(...saved.children);
        building.body = saved.body;
        building.labelY = saved.labelY;
        gsap.killTweensOf(building.group.position);
        building.group.position.y = 0;
        hidden.delete(building);
        restored.push(building);
        changed = true;
      }
    }
    // Retain existing visuals until a trusted snapshot can replace them.
    if (config && state && state.configVersion === config.version) {
      const items: Item[] = [];
      const built = new Set(state.projects.filter((project) => project.built).map((project) => project.id));
      for (const project of config.projects) {
        if (!built.has(project.id)) continue;
        project.placements?.forEach((placement, index) => items.push({ ...placement, key: `project:${project.id}:${index}` }));
        if (project.kind === 'road' && project.road) items.push({ ...project.road, kind: 'road', key: `road:${project.id}` });
      }
      for (const placed of state.decorations) {
        const plot = config.personalPlots.find((entry) => entry.id === placed.plotId);
        const decoration = config.decorations.find((entry) => entry.id === placed.decorationId);
        if (plot && decoration) items.push({ key: `plot:${plot.id}`, kind: decoration.kind, x: plot.x, z: plot.z });
      }
      const wanted = new Set(items.map((item) => item.key));
      for (const [key, visual] of visuals) {
        if (!wanted.has(key)) { release(visual); visuals.delete(key); }
      }
      for (const item of items) {
        if (!Number.isFinite(item.x) || !Number.isFinite(item.z)) continue;
        if (item.kind === 'road' && (!(item.width! > 0) || !(item.depth! > 0))) continue;
        const existing = visuals.get(item.key);
        if (existing?.signature === JSON.stringify(item)) continue;
        if (existing) release(existing);
        visuals.set(item.key, makeVisual(item));
      }
    }
    updateLighting();
    if (changed) {
      options.refreshCollisions();
      options.refreshLabels();
      restored.forEach(options.onBuildingRestored);
      options.onConstructionChanged();
    }
  }

  const unsubscribe = subscribeCityGovernance(sync);
  sync();
  return {
    update() { if (!disposed && night !== options.getIsNight()) updateLighting(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      visuals.forEach(release);
      visuals.clear();
      // Return pooled geometry to the scene before the session resource cleanup.
      hidden.forEach((saved, building) => {
        building.group.add(...saved.children);
        building.body = saved.body;
        building.labelY = saved.labelY;
      });
      hidden.clear();
      detachedPlots.forEach((parent, plot) => parent.add(plot));
      detachedPlots.clear();
      detachedAttachments.forEach((children, attachment) => attachment.add(...children));
      detachedAttachments.clear();
      root.removeFromParent();
    },
  };
}

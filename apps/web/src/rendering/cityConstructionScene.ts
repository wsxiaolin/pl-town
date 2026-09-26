import * as THREE from 'three';
import { gsap } from 'gsap';
import type { BuildingEntity } from '../city/buildingEntity';
import { restoreBuildingPresentation } from '../city/buildingDamage';
import { getCityConfig, getCityState, isConstructionPending, subscribeCityGovernance } from '../city/cityGovernanceClient';
import { RENDER_ORDER, SURFACE_Y } from './layers';
import { ResourcePool } from '../core/ResourcePool';
import { createConstructionDecorations } from './constructionDecorations';
import type { MeshHelpers } from './meshFactory';

type Kind = 'oak' | 'pine' | 'cherry' | 'lamp' | 'bench' | 'flowers';
type Item = { key: string; kind: Kind | 'road'; x: number; z: number; width?: number; depth?: number };
type Visual = { signature: string; root: THREE.Group; glow?: THREE.MeshStandardMaterial };
const MAX_CONSTRUCTION_POINT_LIGHTS = 8;

export function createCityConstructionScene(options: {
  scene: THREE.Scene;
  makeMaterial: MeshHelpers['stdMat'];
  buildings: BuildingEntity[];
  buildingAttachments?: ReadonlyMap<string, readonly THREE.Object3D[]>;
  getIsNight: () => boolean;
  getLightingPosition?: () => THREE.Vector3;
  refreshCollisions: () => void;
  refreshLabels: () => void;
  onBuildingRestored: (building: BuildingEntity) => void;
}) {
  const root = new THREE.Group();
  root.name = 'city-construction';
  options.scene.add(root);
  const hidden = new Map<BuildingEntity, { children: THREE.Object3D[]; labelY?: number; body?: THREE.Mesh }>();
  const visuals = new Map<string, Visual>();
  const resources = new ResourcePool();
  const makeDecoration = createConstructionDecorations(resources, options.makeMaterial);
  const lights: THREE.PointLight[] = [];
  const lightingPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  const detachedAttachments = new Map<THREE.Object3D, THREE.Object3D[]>();
  let disposed = false;
  let night = options.getIsNight();

  function release(visual: Visual) {
    // Geometry/materials are shared across plots and live until scene disposal.
    visual.root.removeFromParent();
  }

  function makeVisual(item: Item): Visual {
    const group = new THREE.Group();
    group.position.set(item.x, SURFACE_Y.landscape + 0.012, item.z);
    group.name = item.key;
    const visual: Visual = { signature: JSON.stringify(item), root: group };
    const material = (parameters: THREE.MeshStandardMaterialParameters) => {
      const settings = { roughness: 0.85, depthWrite: true, polygonOffset: false, ...parameters };
      return resources.material(settings, () => options.makeMaterial(settings));
    };
    const part = (geometry: THREE.BufferGeometry, mat: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(resources.geometry(geometry), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = item.kind !== 'road';
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    if (item.kind === 'road') {
      const mat = material({ color: 0xaeb8ad, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const mesh = part(new THREE.PlaneGeometry(item.width!, item.depth!), mat, 0, 0, 0);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = RENDER_ORDER.roadMarking;
      group.position.y = SURFACE_Y.roadMarking + 0.012;
    } else if (item.kind === 'lamp') {
      group.add(makeDecoration('lamp-post'));
      // Keep the globe separate: only its shared material changes emission at dusk.
      visual.glow = material({ color: 0xffecc9, emissive: 0xffd9a1 });
      part(new THREE.SphereGeometry(0.16, 12, 8), visual.glow, 0, 1.8, 0);
    } else {
      group.add(makeDecoration(item.kind));
    }
    root.add(group);
    return visual;
  }

  function updateLighting() {
    night = options.getIsNight();
    lightingPosition.copy(options.getLightingPosition?.() ?? root.position);
    const lamps: Visual[] = [];
    for (const visual of visuals.values()) {
      if (visual.glow) {
        visual.glow.emissiveIntensity = night ? 0.9 : 0.03;
        lamps.push(visual);
      }
    }
    // Keep the shader light count constant across dusk/day transitions. Allocate
    // the pool only once a lamp exists, then retarget it near the resident.
    if (lamps.length && !lights.length) {
      for (let index = 0; index < MAX_CONSTRUCTION_POINT_LIGHTS; index++) {
        const light = new THREE.PointLight(0xffd9a1, 0, 4, 2);
        lights.push(light);
        root.add(light);
      }
    }
    lamps.sort((a, b) => a.root.position.distanceToSquared(lightingPosition) - b.root.position.distanceToSquared(lightingPosition));
    lights.forEach((light, index) => {
      const lamp = lamps[index];
      light.intensity = 0;
      if (lamp) {
        light.position.copy(lamp.root.position);
        light.position.y += 1.8;
        if (night) light.intensity = 1.4;
      }
    });
  }

  function sync() {
    if (disposed) return;
    const config = getCityConfig();
    const state = getCityState();
    const restored: BuildingEntity[] = [];
    let changed = false;
    for (const building of options.buildings) {
      // A missing or mismatched snapshot means the governance service is
      // unavailable. Preserve the normal city until a trusted snapshot arrives.
      const pending = Boolean(config && state && state.configVersion === config.version
        && !config.initialBuiltBuildingIds.includes(building.id)
        && isConstructionPending(building.id));
      building.group.userData.constructionPending = pending;
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
    const items: Item[] = [];
    // A mismatched snapshot must never place decorations from another config.
    if (config && state && state.configVersion === config.version) {
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
    updateLighting();
    if (changed) {
      options.refreshCollisions();
      options.refreshLabels();
      restored.forEach(options.onBuildingRestored);
    }
  }

  const unsubscribe = subscribeCityGovernance(sync);
  sync();
  return {
    update() {
      if (!disposed && (night !== options.getIsNight()
        || lightingPosition.distanceToSquared(options.getLightingPosition?.() ?? root.position) >= 1)) updateLighting();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      visuals.forEach(release);
      visuals.clear();
      lights.forEach((light) => light.dispose());
      resources.dispose();
      // Return pooled geometry to the scene before the session resource cleanup.
      hidden.forEach((saved, building) => {
        building.group.add(...saved.children);
        building.body = saved.body;
        building.labelY = saved.labelY;
      });
      hidden.clear();
      detachedAttachments.forEach((children, attachment) => attachment.add(...children));
      detachedAttachments.clear();
      root.removeFromParent();
    },
  };
}

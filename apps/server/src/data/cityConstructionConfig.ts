import { AREA_PLOTS, AREA_PROJECTS, PERSONAL_AREAS } from './cityConstructionAreas.js';
import { BUILDING_CATALOG } from './buildingCatalog.js';

export type DecorationKind = 'oak' | 'pine' | 'cherry' | 'lamp' | 'bench' | 'flowers';
export type CityProject = {
  id: string; name: string; description: string; cost: number;
  kind: 'building' | 'road' | 'trees' | 'lights' | 'decoration';
  buildingId?: string;
  placements?: Array<{ kind: DecorationKind; x: number; z: number }>;
  road?: { x: number; z: number; width: number; depth: number };
};
export type CityConstructionConfig = {
  schemaVersion: 1; version: string; projects: CityProject[];
  personalPlots: Array<{ id: string; name: string; x: number; z: number; options: string[] }>;
  personalAreas?: Array<{ id: string; name: string; plotIds: string[] }>;
  decorations: Array<{ id: string; name: string; kind: DecorationKind; cost: number }>;
  initialBuiltBuildingIds: string[];
};

function buildingProject(buildingId: string, cost = 3000): CityProject {
  const building = BUILDING_CATALOG.find((entry) => entry.id === buildingId);
  if (!building) throw new Error(`Unknown construction building: ${buildingId}`);
  return { id: `build-${buildingId}`, buildingId, name: building.label, description: `共同筹建${building.label}`, kind: 'building', cost };
}

// Story venues intentionally remain pending in a fresh city. Their story
// entrypoints become available after the community completes the matching
// project through the House of Commons; they are not silently gifted as part
// of a future change to the initial-building policy.
export const COLLECTIVE_STORY_BUILDING_IDS = [
  'archive', 'newsstand', 'guesthouse', 'mall_south', 'mall_west', 'research',
] as const;

// Keep existing project definitions and IDs immutable. Newly governed buildings
// are appended below; a fresh city starts with only the House of Commons.
const constructionIds = [
  'catcafe', 'academy', 'shrine', 'beacon', 'television_tower', 'fried_chicken_shop',
  'tradingpost', 'guildhall', 'conservatory', 'arena', 'school_north', 'teahouse',
  'teahouse_outer', 'writingclub', 'senate', 'musichall', 'banana_palace', 'qipai_hall',
  'wushi_restaurant', 'tavern',
];

export const CITY_CONSTRUCTION_CONFIG: CityConstructionConfig = {
  schemaVersion: 1,
  version: '2026-09-26.pending.2',
  projects: [
    ...constructionIds.map((buildingId) => buildingProject(buildingId)),
    ...BUILDING_CATALOG.filter((building) => building.id !== 'commons' && !constructionIds.includes(building.id))
      .map((building) => buildingProject(building.id)),
    { id: 'greenbelt-path', name: '北侧绿道', description: '公共步行绿道', cost: 800, kind: 'road', road: { x: 22, z: -40, width: 8, depth: 1 } },
    { id: 'greenbelt-trees', name: '北侧植树', description: '公共绿化', cost: 600, kind: 'trees', placements: [{ kind: 'oak', x: 19, z: -38.5 }, { kind: 'pine', x: 25, z: -38.5 }] },
    { id: 'greenbelt-lights', name: '绿道路灯', description: '公共照明', cost: 400, kind: 'lights', placements: [{ kind: 'lamp', x: 22, z: -38.5 }] },
    { id: 'greenbelt-benches', name: '绿道座椅', description: '公共休憩点', cost: 300, kind: 'decoration', placements: [{ kind: 'bench', x: 22, z: -41.5 }] },
    { id: 'east-gate-path', name: '东门外步行道', description: '从东门通向外环的步行道', cost: 800, kind: 'road', road: { x: 40, z: 22, width: 1, depth: 8 } },
    { id: 'east-gate-trees', name: '东门植树', description: '东门外绿化', cost: 600, kind: 'trees', placements: [{ kind: 'oak', x: 38.5, z: 19 }, { kind: 'pine', x: 38.5, z: 25 }] },
    { id: 'east-gate-lights', name: '东门路灯', description: '东门外照明', cost: 400, kind: 'lights', placements: [{ kind: 'lamp', x: 38.5, z: 22 }] },
    { id: 'south-gate-path', name: '南门外步行道', description: '从南门通向外环的步行道', cost: 800, kind: 'road', road: { x: -22, z: 40, width: 8, depth: 1 } },
    { id: 'south-gate-trees', name: '南门植树', description: '南门外绿化', cost: 600, kind: 'trees', placements: [{ kind: 'cherry', x: -19, z: 38.5 }, { kind: 'oak', x: -25, z: 38.5 }] },
    { id: 'south-gate-lights', name: '南门路灯', description: '南门外照明', cost: 400, kind: 'lights', placements: [{ kind: 'lamp', x: -22, z: 38.5 }] },
    { id: 'west-gate-path', name: '西门外步行道', description: '从西门通向外环的步行道', cost: 800, kind: 'road', road: { x: -40, z: -22, width: 1, depth: 8 } },
    { id: 'west-gate-trees', name: '西门植树', description: '西门外绿化', cost: 600, kind: 'trees', placements: [{ kind: 'pine', x: -38.5, z: -19 }, { kind: 'oak', x: -38.5, z: -25 }] },
    { id: 'west-gate-lights', name: '西门路灯', description: '西门外照明', cost: 400, kind: 'lights', placements: [{ kind: 'lamp', x: -38.5, z: -22 }] },
    { id: 'corner-trees-ne', name: '东北角树林', description: '东北角公共树林', cost: 700, kind: 'trees', placements: [{ kind: 'oak', x: 38, z: -38 }, { kind: 'pine', x: 36, z: -40 }, { kind: 'cherry', x: 40, z: -36 }] },
    { id: 'corner-trees-se', name: '东南角树林', description: '东南角公共树林', cost: 700, kind: 'trees', placements: [{ kind: 'pine', x: 38, z: 38 }, { kind: 'oak', x: 36, z: 40 }, { kind: 'cherry', x: 40, z: 36 }] },
    { id: 'corner-trees-sw', name: '西南角树林', description: '西南角公共树林', cost: 700, kind: 'trees', placements: [{ kind: 'oak', x: -38, z: 38 }, { kind: 'pine', x: -36, z: 40 }, { kind: 'cherry', x: -40, z: 36 }] },
    { id: 'corner-trees-nw', name: '西北角树林', description: '西北角公共树林', cost: 700, kind: 'trees', placements: [{ kind: 'pine', x: -38, z: -38 }, { kind: 'oak', x: -36, z: -40 }, { kind: 'cherry', x: -40, z: -36 }] },
    { id: 'corner-lights-ne', name: '东北角路灯', description: '东北角夜间照明', cost: 450, kind: 'lights', placements: [{ kind: 'lamp', x: 38, z: -36 }, { kind: 'lamp', x: 36, z: -38 }] },
    { id: 'corner-lights-sw', name: '西南角路灯', description: '西南角夜间照明', cost: 450, kind: 'lights', placements: [{ kind: 'lamp', x: -38, z: 36 }, { kind: 'lamp', x: -36, z: 38 }] },
    { id: 'east-rim-benches', name: '东门外座椅', description: '东门外公共休憩点', cost: 300, kind: 'decoration', placements: [{ kind: 'bench', x: 41.5, z: 22 }] },
    ...AREA_PROJECTS,
  ],
  personalAreas: PERSONAL_AREAS,
  personalPlots: [
    { id: 'north-garden-1', name: '北侧花园一号', x: 30, z: -40, options: ['cherry', 'flowers', 'bench'] },
    { id: 'north-garden-2', name: '北侧花园二号', x: 34, z: -40, options: ['oak', 'pine', 'lamp'] },
    { id: 'north-garden-3', name: '北侧花园三号', x: 39, z: -40, options: ['cherry', 'flowers', 'lamp'] },
    { id: 'east-garden-1', name: '东侧花园一号', x: 40, z: 30, options: ['oak', 'lamp', 'bench'] },
    { id: 'east-garden-2', name: '东侧花园二号', x: 40, z: 34, options: ['pine', 'cherry', 'flowers'] },
    { id: 'east-garden-3', name: '东侧花园三号', x: 40, z: 39, options: ['lamp', 'flowers', 'bench'] },
    { id: 'south-garden-1', name: '南侧花园一号', x: -30, z: 40, options: ['cherry', 'oak', 'lamp'] },
    { id: 'south-garden-2', name: '南侧花园二号', x: -34, z: 40, options: ['pine', 'flowers', 'bench'] },
    { id: 'west-garden-1', name: '西侧花园一号', x: -40, z: -30, options: ['oak', 'lamp', 'flowers'] },
    { id: 'west-garden-2', name: '西侧花园二号', x: -40, z: -34, options: ['pine', 'cherry', 'bench'] },
    { id: 'west-garden-3', name: '西侧花园三号', x: -40, z: -39, options: ['lamp', 'flowers', 'oak'] },
    { id: 'residence-yard-1', name: '南郊住宅庭院', x: 16, z: 38, options: ['cherry', 'flowers', 'bench'] },
    { id: 'residence-yard-2', name: '西郊住宅庭院', x: -16, z: -38, options: ['oak', 'lamp', 'flowers'] },
    ...AREA_PLOTS,
  ],
  decorations: [
    { id: 'oak', name: '橡树', kind: 'oak', cost: 180 },
    { id: 'pine', name: '松树', kind: 'pine', cost: 180 },
    { id: 'cherry', name: '樱花树', kind: 'cherry', cost: 240 },
    { id: 'lamp', name: '路灯', kind: 'lamp', cost: 120 },
    { id: 'bench', name: '长椅', kind: 'bench', cost: 100 },
    { id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 },
  ],
  initialBuiltBuildingIds: ['commons'],
};

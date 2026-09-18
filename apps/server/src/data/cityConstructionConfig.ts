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
  decorations: Array<{ id: string; name: string; kind: DecorationKind; cost: number }>;
  initialBuiltBuildingIds: string[];
};

// Only these non-core buildings start as construction sites. Story venues such
// as archive, guesthouse, kingice and writingclub_outer remain built.
const constructionIds = ['catcafe', 'academy', 'shrine', 'beacon', 'television_tower', 'fried_chicken_shop', 'tradingpost', 'guildhall', 'conservatory', 'arena'];
export const CITY_CONSTRUCTION_CONFIG: CityConstructionConfig = {
  schemaVersion: 1,
  version: '2026-09-18.1',
  projects: [
    ...constructionIds.map((buildingId): CityProject => {
      const building = BUILDING_CATALOG.find((entry) => entry.id === buildingId);
      if (!building) throw new Error(`Unknown construction building: ${buildingId}`);
      return { id: `build-${buildingId}`, buildingId, name: building.label, description: `共同筹建${building.label}`, kind: 'building', cost: 3000 };
    }),
    // Northeast boundary greenbelt, beyond the outermost grid road (z = -36).
    { id: 'greenbelt-path', name: '北侧绿道', description: '公共步行绿道', cost: 800, kind: 'road', road: { x: 22, z: -40, width: 8, depth: 1 } },
    { id: 'greenbelt-trees', name: '北侧植树', description: '公共绿化', cost: 600, kind: 'trees', placements: [{ kind: 'oak', x: 19, z: -38.5 }, { kind: 'pine', x: 25, z: -38.5 }] },
    { id: 'greenbelt-lights', name: '绿道路灯', description: '公共照明', cost: 400, kind: 'lights', placements: [{ kind: 'lamp', x: 22, z: -38.5 }] },
    { id: 'greenbelt-benches', name: '绿道座椅', description: '公共休憩点', cost: 300, kind: 'decoration', placements: [{ kind: 'bench', x: 22, z: -41.5 }] },
  ],
  personalPlots: [
    { id: 'north-garden-1', name: '北侧花园一号', x: 30, z: -40, options: ['cherry', 'flowers', 'bench'] },
    { id: 'north-garden-2', name: '北侧花园二号', x: 34, z: -40, options: ['oak', 'pine', 'lamp'] },
    { id: 'north-garden-3', name: '北侧花园三号', x: 39, z: -40, options: ['cherry', 'flowers', 'lamp'] },
  ],
  decorations: [
    { id: 'oak', name: '橡树', kind: 'oak', cost: 180 },
    { id: 'pine', name: '松树', kind: 'pine', cost: 180 },
    { id: 'cherry', name: '樱花树', kind: 'cherry', cost: 240 },
    { id: 'lamp', name: '路灯', kind: 'lamp', cost: 120 },
    { id: 'bench', name: '长椅', kind: 'bench', cost: 100 },
    { id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 },
  ],
  initialBuiltBuildingIds: BUILDING_CATALOG.filter((entry) => !constructionIds.includes(entry.id)).map((entry) => entry.id),
};

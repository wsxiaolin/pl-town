import { BUILDING_CATALOG } from './buildingCatalog.js';
import type { CityConstructionConfig } from './data/cityConstructionConfig.js';
import { AREA_PROJECTS } from './data/cityConstructionAreas.js';

// Mirrored scene constraints, verified against the client in city-area-layout.mjs.
// Reserve the full largest decoration footprint, not just its center point.
export const AREA_CLEARANCE = {
  radius: 0.9, cityLimit: 42, ringOuterRadius: 39, beachLandEdge: -32,
  roadCoords: [-36, -27, -18, -12, -6, 0, 6, 12, 18, 27, 36],
};

export function validateCityAreaPlacement(config: CityConstructionConfig): void {
  const { radius, cityLimit, ringOuterRadius, beachLandEdge, roadCoords } = AREA_CLEARANCE;
  const plotIds = new Set(config.personalAreas?.flatMap((area) => area.plotIds) ?? []);
  const projectIds = new Set(AREA_PROJECTS.map((project) => project.id));
  const points = [
    ...config.personalPlots.filter((plot) => plotIds.has(plot.id)),
    ...config.projects.filter((project) => projectIds.has(project.id))
      .flatMap((project) => project.placements?.map((point, index) => ({ ...point, id: `${project.id}:${index}` })) ?? []),
  ];
  const legacyProjects = config.projects.filter((project) => !projectIds.has(project.id));
  const occupied = [...config.personalPlots.filter((plot) => !plotIds.has(plot.id)),
    ...legacyProjects.flatMap((project) => project.placements ?? [])];
  const roads = legacyProjects.flatMap((project) => project.road ? [project.road] : []);
  for (const [index, point] of points.entries()) {
    const { x, z } = point;
    const roadOverlap = roadCoords.some((coordinate) => {
      const halfWidth = coordinate === 0 ? 1.2 : [6, 12].includes(Math.abs(coordinate)) ? 0.75 : 0.5;
      return Math.abs(x - coordinate) < radius + halfWidth - 1e-6
        || Math.abs(z - coordinate) < radius + halfWidth - 1e-6;
    });
    const buildingOverlap = BUILDING_CATALOG.some((building) => Math.abs(x - building.x) < radius + 4
      && Math.abs(z - building.z) < radius + 4);
    const projectRoadOverlap = roads.some((road) => Math.abs(x - road.x) < road.width / 2 + radius
      && Math.abs(z - road.z) < road.depth / 2 + radius);
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.max(Math.abs(x), Math.abs(z)) + radius > cityLimit
      || Math.hypot(x, z) < ringOuterRadius + radius || x - radius < beachLandEdge
      // Procedural residence lots extend to 34.35, plus their plot and canopy.
      || Math.max(Math.abs(x), Math.abs(z)) < 36.5
      || roadOverlap || buildingOverlap || projectRoadOverlap
      || occupied.some((other) => Math.hypot(x - other.x, z - other.z) < radius * 2 - 1e-6)
      || points.slice(0, index).some((other) => Math.hypot(x - other.x, z - other.z) < radius * 2 - 1e-6)) {
      throw new Error(`City area placement overlaps reserved scenery: ${point.id}`);
    }
  }
}

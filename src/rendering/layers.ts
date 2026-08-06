export const SURFACE_Y = Object.freeze({
  base: 0,
  district: 0.018,
  plaza: 0.036,
  landscape: 0.036,
  buildingPlot: 0.036,
  road: 0.065,
  roadSurface: 0.086,
  roadMarking: 0.095,
  water: 0.105,
});

export const POLYGON_OFFSET = Object.freeze({
  plaza: { factor: -1, units: -1 },
  landscape: { factor: -2, units: -2 },
  buildingPlot: { factor: -3, units: -3 },
});

export const RENDER_ORDER = Object.freeze({
  base: 0,
  district: 1,
  plaza: 2,
  landscape: 3,
  buildingPlot: 4,
  road: 5,
  roadMarking: 6,
  transparentSurface: 7,
  overlay: 10,
});

// 年份镇贴地层高（相对所属台面/大城地面）。任意两层至少相差 0.004u，
// 满足 AGENTS.md「远镜头 z-fighting」最小层间距；渲染与审计共用本表。
export const YEAR_TOWN_SURFACE_Y = {
  sidewalk: 0.015,
  road: 0.019,
  street: 0.023,
  curb: 0.027,
  lane: 0.031,
  centerline: 0.035,
  plaza: 0.039,
  plazaRing: 0.043,
  innerRing: 0.047,
  innerDisc: 0.051,
  plot: 0.06,
  dock: 0.065,
  dockCap: 0.07,
} as const;

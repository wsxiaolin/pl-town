import type { Weather } from '../city/weather';

const WEATHER_TEXTURE_VARIANTS: Record<string, Partial<Record<Weather, string>>> = {
  asphalt: { clear: 'asphalt', rain: 'road_asphalt_wet', snow: 'road_snow_compact', 'snow-deep': 'road_snow_fresh' },
  road: { clear: 'road', rain: 'road_concrete_wet', snow: 'road_snow_compact', 'snow-deep': 'road_snow_fresh' },
  pavement: { clear: 'pavement', rain: 'road_concrete_wet', snow: 'road_snow_compact', 'snow-deep': 'road_snow_fresh' },
  residence_cream: { clear: 'residence_cream', rain: 'residence_cream_wet', snow: 'residence_cream_snow', 'snow-deep': 'residence_cream_snow' },
  facade_residence_cream: { clear: 'residence_cream', rain: 'residence_cream_wet', snow: 'residence_cream_snow', 'snow-deep': 'residence_cream_snow' },
  residence_redbrick: { clear: 'residence_redbrick', rain: 'residence_redbrick_wet', snow: 'residence_redbrick_snow', 'snow-deep': 'residence_redbrick_snow' },
  residence_bluepanel: { clear: 'residence_bluepanel', rain: 'residence_bluepanel_wet', snow: 'residence_bluepanel_snow', 'snow-deep': 'residence_bluepanel_snow' },
  residence_palestone: { clear: 'residence_palestone', rain: 'residence_palestone_wet', snow: 'residence_palestone_snow', 'snow-deep': 'residence_palestone_snow' },
  residence_clapboard: { clear: 'residence_clapboard', rain: 'residence_clapboard_wet', snow: 'residence_clapboard_snow', 'snow-deep': 'residence_clapboard_snow' },
  residence_mossplaster: { clear: 'residence_mossplaster', rain: 'residence_mossplaster_wet', snow: 'residence_mossplaster_snow', 'snow-deep': 'residence_mossplaster_snow' },
  residence_terracotta_roof: { clear: 'residence_terracotta_roof', rain: 'residence_terracotta_roof_wet', snow: 'residence_terracotta_roof_snow', 'snow-deep': 'snow_roof' },
  residence_slate_roof: { clear: 'residence_slate_roof', rain: 'residence_slate_roof_wet', snow: 'residence_slate_roof_snow', 'snow-deep': 'snow_roof' },
  residence_green_roof: { clear: 'residence_green_roof', rain: 'residence_green_roof_wet', snow: 'residence_green_roof_snow', 'snow-deep': 'snow_roof' },
  residence_wood: { clear: 'residence_cedar_porch', rain: 'residence_cedar_porch_wet', snow: 'residence_cedar_porch_snow', 'snow-deep': 'residence_cedar_porch_snow' },
  residence_tile: { clear: 'residence_tile', rain: 'residence_green_roof_wet', snow: 'residence_green_roof_snow', 'snow-deep': 'snow_roof' },
  residence_shingle: { clear: 'residence_shingle', rain: 'residence_slate_roof_wet', snow: 'residence_slate_roof_snow', 'snow-deep': 'snow_roof' },
  rooftile: { clear: 'rooftile', rain: 'residence_terracotta_roof_wet', snow: 'residence_terracotta_roof_snow', 'snow-deep': 'snow_roof' },
  glass: { clear: 'residence_blueglass', rain: 'residence_blueglass_wet', snow: 'residence_blueglass_snow', 'snow-deep': 'residence_blueglass_snow' },
};

export function weatherTextureKey(key: string, weather: Weather): string {
  return WEATHER_TEXTURE_VARIANTS[key]?.[weather] ?? key;
}

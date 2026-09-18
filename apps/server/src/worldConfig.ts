import { db } from './db.js';
import { BUILDING_CATALOG } from './buildingCatalog.js';
import type { Weather } from './types.js';

/**
 * Server-wide world configuration persisted in SQLite and applied to every
 * resident: the weather the server broadcasts, and per-building unlock
 * overrides. Kept deliberately small: one JSON row per logical section in
 * `world_config`, cached in memory because the server is single-process.
 */

export const WEATHER_VALUES: readonly Weather[] = ['clear', 'rain', 'snow', 'snow-deep'];
export const BUILDING_UNLOCK_STATES = ['default', 'locked', 'open'] as const;
export type BuildingUnlockState = (typeof BUILDING_UNLOCK_STATES)[number];
export type BuildingOverrides = Record<string, BuildingUnlockState>;

export type WeatherConfig = { value: Weather; autoBroadcast: boolean };

const BUILDING_IDS = new Set(BUILDING_CATALOG.map((building) => building.id));
const DEFAULT_WEATHER: WeatherConfig = { value: 'clear', autoBroadcast: true };
const now = () => new Date().toISOString();

const isWeather = (value: unknown): value is Weather => typeof value === 'string' && (WEATHER_VALUES as readonly string[]).includes(value);
const isUnlockState = (value: unknown): value is BuildingUnlockState => typeof value === 'string' && (BUILDING_UNLOCK_STATES as readonly string[]).includes(value);

function readRow(key: string): unknown {
  const row = db.prepare('SELECT value_json FROM world_config WHERE key = ?').get(key) as { value_json: string } | undefined;
  if (!row) return undefined;
  try { return JSON.parse(row.value_json) as unknown; } catch { return undefined; }
}

function writeRow(key: string, value: unknown): void {
  db.prepare(`
    INSERT INTO world_config (key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), now());
}

function parseWeather(value: unknown): WeatherConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_WEATHER };
  const input = value as Partial<WeatherConfig>;
  return {
    value: isWeather(input.value) ? input.value : DEFAULT_WEATHER.value,
    autoBroadcast: typeof input.autoBroadcast === 'boolean' ? input.autoBroadcast : DEFAULT_WEATHER.autoBroadcast,
  };
}

function parseOverrides(value: unknown): BuildingOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const overrides: BuildingOverrides = {};
  for (const [id, state] of Object.entries(value as Record<string, unknown>)) {
    if (!BUILDING_IDS.has(id) || !isUnlockState(state) || state === 'default') continue;
    overrides[id] = state;
  }
  return overrides;
}

let weatherCache: WeatherConfig | null = null;
let overridesCache: BuildingOverrides | null = null;

export function getWeatherConfig(): WeatherConfig {
  if (!weatherCache) weatherCache = parseWeather(readRow('weather'));
  return { ...weatherCache };
}

export function setWeatherConfig(config: WeatherConfig): WeatherConfig {
  const next: WeatherConfig = { value: isWeather(config.value) ? config.value : DEFAULT_WEATHER.value, autoBroadcast: config.autoBroadcast !== false };
  writeRow('weather', next);
  weatherCache = next;
  return { ...next };
}

export function getBuildingOverrides(): BuildingOverrides {
  if (!overridesCache) overridesCache = parseOverrides(readRow('buildings'));
  return { ...overridesCache };
}

export function setBuildingOverrides(overrides: BuildingOverrides): BuildingOverrides {
  const next = parseOverrides(overrides);
  writeRow('buildings', next);
  overridesCache = next;
  return { ...next };
}

/** Validate an untrusted override payload; returns null when the shape is wrong. */
export function sanitizeOverrides(input: unknown): BuildingOverrides | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > BUILDING_IDS.size) return null;
  const overrides: BuildingOverrides = {};
  for (const [id, state] of entries) {
    if (!BUILDING_IDS.has(id) || !isUnlockState(state)) return null;
    if (state !== 'default') overrides[id] = state;
  }
  return overrides;
}

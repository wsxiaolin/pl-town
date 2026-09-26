import { db } from './db.js';
import { BUILDING_CATALOG } from './buildingCatalog.js';
import type { Weather } from './types.js';

/**
 * Server-wide world configuration persisted in SQLite and applied to every
 * resident: the weather the server broadcasts, the per-building unlock
 * overrides, and the shop catalog (name/price/availability per product).
 * Kept deliberately small: one JSON row per logical section in
 * `world_config`, cached in memory because the server is single-process.
 */

export const WEATHER_VALUES: readonly Weather[] = ['clear', 'rain', 'snow', 'snow-deep'];
export const BUILDING_UNLOCK_STATES = ['default', 'locked', 'open'] as const;
export type BuildingUnlockState = (typeof BUILDING_UNLOCK_STATES)[number];
export type BuildingOverrides = Record<string, BuildingUnlockState>;

export type WeatherConfig = { value: Weather; autoBroadcast: boolean };

export type ShopProduct = { itemId: string; name: string; unitPrice: number; enabled: boolean };

export const DEFAULT_SHOP_CATALOG: readonly ShopProduct[] = Object.freeze([
  { itemId: 'dragonwell_tea', name: '龙井茶', unitPrice: 30, enabled: true },
  { itemId: 'beef', name: '牛肉', unitPrice: 45, enabled: true },
  { itemId: 'radish', name: '萝卜', unitPrice: 20, enabled: true },
  { itemId: 'music_box', name: '音乐盒', unitPrice: 120, enabled: true },
]);

const SHOP_ITEM_ID_PATTERN = /^[a-z0-9_]{2,64}$/;
const SHOP_NAME_MAX = 40;
const SHOP_PRODUCT_MAX = 50;
const SHOP_PRICE_MAX = 1_000_000;

// The generated catalog mirrors exactly the buildings the server manages
// (BUILDING_PRICES), so validating against it keeps "accepted" == "effective".
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

/** Lenient parse for the persisted row: skip broken entries, fall back to the shipped defaults. */
function parseShopProducts(value: unknown): ShopProduct[] {
  const entries = value && typeof value === 'object' && Array.isArray((value as { products?: unknown }).products)
    ? (value as { products: unknown[] }).products
    : null;
  if (!entries) return DEFAULT_SHOP_CATALOG.map((product) => ({ ...product }));
  const products: ShopProduct[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<ShopProduct>;
    if (typeof item.itemId !== 'string' || !SHOP_ITEM_ID_PATTERN.test(item.itemId) || seen.has(item.itemId)) continue;
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > SHOP_NAME_MAX) continue;
    if (typeof item.unitPrice !== 'number' || !Number.isInteger(item.unitPrice) || item.unitPrice < 1 || item.unitPrice > SHOP_PRICE_MAX) continue;
    seen.add(item.itemId);
    products.push({ itemId: item.itemId, name: item.name.trim(), unitPrice: item.unitPrice, enabled: item.enabled !== false });
  }
  return products;
}

/** Validate an untrusted shop payload; returns null when the shape is wrong. */
export function sanitizeShopProducts(input: unknown): ShopProduct[] | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const entries = (input as { products?: unknown }).products;
  if (!Array.isArray(entries) || entries.length > SHOP_PRODUCT_MAX) return null;
  const products: ShopProduct[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Partial<ShopProduct>;
    if (typeof item.itemId !== 'string' || !SHOP_ITEM_ID_PATTERN.test(item.itemId) || seen.has(item.itemId)) return null;
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > SHOP_NAME_MAX) return null;
    if (typeof item.unitPrice !== 'number' || !Number.isInteger(item.unitPrice) || item.unitPrice < 1 || item.unitPrice > SHOP_PRICE_MAX) return null;
    seen.add(item.itemId);
    products.push({ itemId: item.itemId, name: item.name.trim(), unitPrice: item.unitPrice, enabled: item.enabled !== false });
  }
  return products;
}

let weatherCache: WeatherConfig | null = null;
let overridesCache: BuildingOverrides | null = null;
let shopCache: ShopProduct[] | null = null;

export function getWeatherConfig(): WeatherConfig {
  if (!weatherCache) weatherCache = parseWeather(readRow('weather'));
  return { ...weatherCache };
}

export function setWeatherConfig(config: WeatherConfig): WeatherConfig {
  const next: WeatherConfig = { value: isWeather(config.value) ? config.value : DEFAULT_WEATHER.value, autoBroadcast: config.autoBroadcast === true };
  writeRow('weather', next);
  weatherCache = next;
  return { ...next };
}

export function getBuildingOverrides(): BuildingOverrides {
  if (!overridesCache) overridesCache = parseOverrides(readRow('buildings'));
  return { ...overridesCache };
}

/** Drop the in-memory cache so the next read reflects the current database (used after an in-process restore). */
export function resetWorldConfig(): void {
  weatherCache = null;
  overridesCache = null;
  shopCache = null;
}

export function getShopProducts(): ShopProduct[] {
  if (!shopCache) shopCache = parseShopProducts(readRow('shop'));
  return shopCache.map((product) => ({ ...product }));
}

export function setShopProducts(products: ShopProduct[]): ShopProduct[] {
  const next = parseShopProducts({ products });
  writeRow('shop', { products: next });
  shopCache = next;
  return next.map((product) => ({ ...product }));
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

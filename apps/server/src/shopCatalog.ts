/**
 * Shop catalog data contract — a leaf module with zero imports.
 *
 * Both `worldConfig.ts` (persistence) and `progression.ts` (live catalog)
 * need the product type, the shipped defaults, and the validators. Keeping
 * them here avoids the `progression → worldConfig → db → … → progression`
 * cycle ever dereferencing a binding mid-evaluation (a module-load-order
 * TDZ landmine), regardless of which module an entry point reaches first.
 */

export type ShopProduct = { itemId: string; name: string; unitPrice: number; enabled: boolean };

export const DEFAULT_SHOP_CATALOG: readonly ShopProduct[] = Object.freeze([
  { itemId: 'dragonwell_tea', name: '龙井茶', unitPrice: 30, enabled: true },
  { itemId: 'beef', name: '牛肉', unitPrice: 45, enabled: true },
  { itemId: 'radish', name: '萝卜', unitPrice: 20, enabled: true },
  { itemId: 'music_box', name: '音乐盒', unitPrice: 120, enabled: true },
]);

const SHOP_ITEM_ID_PATTERN = /^[a-z0-9_]{2,64}$/;
export const SHOP_NAME_MAX = 40;
export const SHOP_PRODUCT_MAX = 50;
export const SHOP_PRICE_MAX = 1_000_000;

/**
 * Validate one raw product entry; returns null when the shape is wrong.
 * `enabled` defaults to true; when present it must be a real boolean.
 */
export function coerceShopProduct(raw: unknown): ShopProduct | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<ShopProduct>;
  if (typeof item.itemId !== 'string' || !SHOP_ITEM_ID_PATTERN.test(item.itemId)) return null;
  if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > SHOP_NAME_MAX) return null;
  if (typeof item.unitPrice !== 'number' || !Number.isInteger(item.unitPrice) || item.unitPrice < 1 || item.unitPrice > SHOP_PRICE_MAX) return null;
  const enabled = item.enabled === undefined ? true : item.enabled;
  if (typeof enabled !== 'boolean') return null;
  return { itemId: item.itemId, name: item.name.trim(), unitPrice: item.unitPrice, enabled };
}

export const cloneShopCatalog = (products: readonly ShopProduct[]): ShopProduct[] => products.map((product) => ({ ...product }));

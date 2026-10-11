/**
 * 烟花设计协议（服务端真源）。客户端 `apps/web/src/city/fireworks/fireworksDesign.ts`
 * 镜像同一份数据契约；两侧字段/区间必须同步修改。
 *
 * 设计意图：烟花完全由参数与「点阵拼字位图」描述——不做任何文本→图形的
 * 转换，拼字一律由居民在网格上一格一格画出来（产品要求：让用户自己设计
 * 如何拼字，而不是直接允许输入文字）。
 */

export const FIREWORK_SAVE_PRICE = 30;
export const FIREWORK_DESIGN_MAX_PER_USER = 24;
export const FIREWORK_DESIGN_JSON_MAX_BYTES = 8_192;
export const FIREWORK_NAME_MAX = 20;
/** 观景台「所有人制作的烟花」清单上限（按 updated_at 取最新）。 */
export const FIREWORK_COMMUNITY_LIST_MAX = 200;

export const FIREWORK_SHAPES = [
  'peony', 'chrysanthemum', 'willow', 'ring', 'palm',
  'crossette', 'crackle', 'heart', 'star', 'pattern',
] as const;
export type FireworkShape = (typeof FIREWORK_SHAPES)[number];

/** 点阵拼字位图：cells 为 base64 打包位（行优先，每字节低 bit 在前）。 */
export type FireworkPattern = { cols: number; rows: number; cells: string };

export type FireworkDesign = {
  v: 1;
  /** 爆炸高度（世界 y，整数 24..90）。 */
  height: number;
  shape: FireworkShape;
  colors: { primary: string; secondary: string; trail: string };
  /** 爆炸半径百分比（60..160，100 = 基准）。 */
  size: number;
  /** 闪烁强度 0..100。 */
  sparkle: number;
  pattern?: FireworkPattern;
};

const HEX = /^#[0-9a-f]{6}$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);
const isInt = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

function popCountBitString(bytes: Uint8Array, totalBits: number): number {
  let count = 0;
  for (let i = 0; i < totalBits; i += 1) {
    // eslint-disable-next-line no-bitwise
    if ((bytes[i >> 3]! & (1 << (i & 7))) !== 0) count += 1;
  }
  return count;
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    return new Uint8Array(atob(value)
      .split('')
      .map((char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

function sanitizePattern(input: unknown): FireworkPattern | null {
  if (!input || typeof input !== 'object') return null;
  const { cols, rows, cells } = input as Partial<FireworkPattern>;
  if (!isInt(cols, 10, 26) || !isInt(rows, 10, 26) || typeof cells !== 'string') return null;
  const totalBits = cols * rows;
  const byteLength = Math.ceil(totalBits / 8);
  if (!BASE64.test(cells)) return null;
  const bytes = decodeBase64(cells);
  // 解码后字节数必须恰好装下 cols×rows 个位（base64 文本长度随填充浮动，
  // 不能直接拿字符串长度和字节数比较）。
  if (!bytes || bytes.length !== byteLength) return null;
  const count = popCountBitString(bytes, totalBits);
  // 少于 4 个点不成形；超过 55% 接近实心块（既不好看也浪费粒子）。
  if (count < 4 || count > Math.floor(totalBits * 0.55)) return null;
  return { cols, rows, cells };
}

/** 校验并规范化一份不受信任的烟花设计；不合法返回 null。 */
export function sanitizeFireworkDesign(input: unknown): FireworkDesign | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (!isInt(raw.height, 24, 90)) return null;
  if (typeof raw.shape !== 'string' || !(FIREWORK_SHAPES as readonly string[]).includes(raw.shape)) return null;
  const colors = raw.colors as Record<string, unknown> | undefined;
  if (!colors
    || !isHexColor(colors.primary) || !isHexColor(colors.secondary) || !isHexColor(colors.trail)) return null;
  if (!isInt(raw.size, 60, 160)) return null;
  if (!isInt(raw.sparkle, 0, 100)) return null;
  const design: FireworkDesign = {
    v: 1,
    height: raw.height,
    shape: raw.shape as FireworkShape,
    colors: { primary: colors.primary, secondary: colors.secondary, trail: colors.trail },
    size: raw.size,
    sparkle: raw.sparkle,
  };
  if (raw.shape === 'pattern') {
    const pattern = sanitizePattern(raw.pattern);
    if (!pattern) return null;
    design.pattern = pattern;
  }
  return design;
}

/** 服务端只存 base64 位图原样；规范化在客户端编码时完成。 */
export function serializeFireworkDesign(design: FireworkDesign): string {
  return JSON.stringify(design);
}

/** 烟花名：单行、去首尾空白、1..FIREWORK_NAME_MAX 字符、无控制字符。 */
export function sanitizeFireworkName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.replace(/[\p{C}]/gu, '').trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > FIREWORK_NAME_MAX) return null;
  return name;
}

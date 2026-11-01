// 烟花化学与工艺（纯模块：不依赖 DOM / Three.js）。
//
// 设计台里的「星体药」「添加物」「壳体」「开爆药」「点火方式」都由这里
// 推导成真实世界可读的原料清单与配比。数值是常见烟花配方的参考区间，
// 用于游戏内工艺模拟；现实制作需要持证场地、防静电与专业设备。
//
// 单位：百分比为质量分数；质量为克；长度为毫米；距离为米。

export const STAR_FORMULAS = [
  'kp-gold',
  'kp-streamer',
  'strontium-red',
  'barium-green',
  'copper-blue',
  'aluminum-white',
  'mgal-strobe',
  'dragon-egg',
] as const;
export type StarFormula = (typeof STAR_FORMULAS)[number];

export const STAR_FORMULA_LABELS: Readonly<Record<StarFormula, string>> = Object.freeze({
  'kp-gold': '硝金（硝酸钾金）',
  'kp-streamer': '硝金长尾',
  'strontium-red': '锶红',
  'barium-green': '钡绿',
  'copper-blue': '铜蓝',
  'aluminum-white': '铝白',
  'mgal-strobe': '镁铝闪光',
  'dragon-egg': '龙蛋碎金',
});

export const ADDITIVES = [
  'none',
  'titanium',
  'magnalium',
  'aluminum',
  'charcoal',
  'iron',
  'boron',
  'copper',
] as const;
export type FireworkAdditive = (typeof ADDITIVES)[number];

export const ADDITIVE_LABELS: Readonly<Record<FireworkAdditive, string>> = Object.freeze({
  none: '不加',
  titanium: '钛粉（白色爆闪）',
  magnalium: '镁铝合金（银色碎星）',
  aluminum: '铝粉（增亮）',
  charcoal: '木炭（金色长尾）',
  iron: '铁粉（橙色分枝）',
  boron: '硼粉（绿闪）',
  copper: '铜盐（蓝焰）',
});

export const SHELL_CASINGS = ['paper-sphere', 'paper-canister', 'multi-break'] as const;
export type ShellCasing = (typeof SHELL_CASINGS)[number];

export const SHELL_CASING_LABELS: Readonly<Record<ShellCasing, string>> = Object.freeze({
  'paper-sphere': '纸球壳',
  'paper-canister': '纸筒壳',
  'multi-break': '多层球（二次开爆）',
});

export const BURST_COMPOSITIONS = ['black-powder', 'flash-powder', 'whistle'] as const;
export type BurstComposition = (typeof BURST_COMPOSITIONS)[number];

export const BURST_COMPOSITION_LABELS: Readonly<Record<BurstComposition, string>> = Object.freeze({
  'black-powder': '黑火药（柔和）',
  'flash-powder': '闪光药（强爆闪）',
  whistle: '哨音药（低沉）',
});

export const IGNITIONS = ['time-fuse', 'electric-match'] as const;
export type FireworkIgnition = (typeof IGNITIONS)[number];

export const IGNITION_LABELS: Readonly<Record<FireworkIgnition, string>> = Object.freeze({
  'time-fuse': '导火索',
  'electric-match': '电点火',
});

/** 设计台上的工艺参数；缺省时由 normalize 补齐，旧设计因此仍可读。 */
export type FireworkCraft = {
  /** 星体药基础配方。 */
  formula: StarFormula;
  /** 额外添加物。 */
  additive: FireworkAdditive;
  /** 添加物质量分数（0..15%）。 */
  additivePercent: number;
  /** 壳体结构。 */
  casing: ShellCasing;
  /** 开爆药类型。 */
  burst: BurstComposition;
  /** 点火方式。 */
  ignition: FireworkIgnition;
  /** 炮筒内径（毫米）。 */
  mortarBore: number;
  /** 引信微调（秒，-0.8..0.8）。 */
  fuseOffset: number;
};

export const CRAFT_LIMITS = Object.freeze({
  additivePercentMin: 0,
  additivePercentMax: 15,
  mortarBoreMin: 52,
  mortarBoreMax: 350,
  fuseOffsetMin: -0.8,
  fuseOffsetMax: 0.8,
});

export type IngredientRole = 'oxidizer' | 'fuel' | 'colorant' | 'binder' | 'additive';

export type RecipeIngredient = {
  name: string;
  role: IngredientRole;
  percent: number;
  note?: string;
};

type FormulaInfo = {
  label: string;
  summary: string;
  colorHint: string;
  ingredients: readonly RecipeIngredient[];
  /** 相对燃速：越高烧得越快、寿命越短。 */
  burnRate: number;
  /** 相对亮度/色温。 */
  heat: number;
  /** 0..1，星体烟量。 */
  smoke: number;
  /** 0..1，碎金/闪烁倾向。 */
  glitter: number;
  /** 0..1，长尾倾向。 */
  trail: number;
  /** 0..1，爆裂时的碎星密度。 */
  crackle: number;
  /** 是否自带频闪。 */
  strobe: boolean;
};

export const FORMULAS: Readonly<Record<StarFormula, FormulaInfo>> = Object.freeze({
  'kp-gold': {
    label: STAR_FORMULA_LABELS['kp-gold'],
    summary: '最经典的金色星体，燃速温和、烟量中等，适合牡丹与垂柳。',
    colorHint: '#ffb347',
    ingredients: [
      { name: '硝酸钾', role: 'oxidizer', percent: 55, note: '氧化剂，提供氧' },
      { name: '木炭', role: 'fuel', percent: 30, note: '燃料，决定金色与尾焰' },
      { name: '硫磺', role: 'fuel', percent: 15, note: '降低点火温度，改善燃烧稳定性' },
    ],
    burnRate: 0.92,
    heat: 0.95,
    smoke: 0.55,
    glitter: 0.16,
    trail: 0.9,
    crackle: 0.08,
    strobe: false,
  },
  'kp-streamer': {
    label: STAR_FORMULA_LABELS['kp-streamer'],
    summary: '木炭比例更高，燃烧慢、拖尾长，适合垂柳和棕榈。',
    colorHint: '#ffd07a',
    ingredients: [
      { name: '硝酸钾', role: 'oxidizer', percent: 62 },
      { name: '木炭', role: 'fuel', percent: 26 },
      { name: '硫磺', role: 'fuel', percent: 12 },
    ],
    burnRate: 0.78,
    heat: 0.9,
    smoke: 0.62,
    glitter: 0.26,
    trail: 1,
    crackle: 0.05,
    strobe: false,
  },
  'strontium-red': {
    label: STAR_FORMULA_LABELS['strontium-red'],
    summary: '锶盐产生窄带红光；高氯酸钾提供稳定氧平衡，颜色纯、烟少。',
    colorHint: '#ff4d5e',
    ingredients: [
      { name: '高氯酸钾', role: 'oxidizer', percent: 52, note: '强氧化剂，需远离硫与金属粉' },
      { name: '碳酸锶', role: 'colorant', percent: 24, note: '红色发色剂' },
      { name: '虫胶', role: 'binder', percent: 12, note: '黏结星体，降低机械敏感度' },
      { name: '木炭', role: 'fuel', percent: 8 },
      { name: '硫磺', role: 'fuel', percent: 4 },
    ],
    burnRate: 1.12,
    heat: 0.92,
    smoke: 0.16,
    glitter: 0.04,
    trail: 0.35,
    crackle: 0.06,
    strobe: false,
  },
  'barium-green': {
    label: STAR_FORMULA_LABELS['barium-green'],
    summary: '硝酸钡发绿，燃烧温度高、亮度足；烟量比红光略大。',
    colorHint: '#56ff7a',
    ingredients: [
      { name: '硝酸钡', role: 'colorant', percent: 48, note: '绿色发色剂兼氧化剂' },
      { name: '高氯酸钾', role: 'oxidizer', percent: 22 },
      { name: '虫胶', role: 'binder', percent: 13 },
      { name: '木炭', role: 'fuel', percent: 12 },
      { name: '硫磺', role: 'fuel', percent: 5 },
    ],
    burnRate: 1.05,
    heat: 1.02,
    smoke: 0.28,
    glitter: 0.05,
    trail: 0.35,
    crackle: 0.06,
    strobe: false,
  },
  'copper-blue': {
    label: STAR_FORMULA_LABELS['copper-blue'],
    summary: '氧化铜在高温下发射蓝光，是最难做纯的颜色，燃速偏快。',
    colorHint: '#4da3ff',
    ingredients: [
      { name: '高氯酸钾', role: 'oxidizer', percent: 55 },
      { name: '氧化铜', role: 'colorant', percent: 20, note: '蓝色发色剂' },
      { name: '虫胶', role: 'binder', percent: 13 },
      { name: '木炭', role: 'fuel', percent: 8 },
      { name: '硫磺', role: 'fuel', percent: 4 },
    ],
    burnRate: 1.18,
    heat: 1.08,
    smoke: 0.18,
    glitter: 0.03,
    trail: 0.3,
    crackle: 0.05,
    strobe: false,
  },
  'aluminum-white': {
    label: STAR_FORMULA_LABELS['aluminum-white'],
    summary: '铝粉提高亮度和白度，燃速快，适合爆闪与银冠。',
    colorHint: '#fff3d6',
    ingredients: [
      { name: '硝酸钾', role: 'oxidizer', percent: 48 },
      { name: '铝粉', role: 'fuel', percent: 30, note: '金属燃料，显著增亮' },
      { name: '硫磺', role: 'fuel', percent: 17 },
      { name: '木炭', role: 'fuel', percent: 5 },
    ],
    burnRate: 1.35,
    heat: 1.28,
    smoke: 0.2,
    glitter: 0.52,
    trail: 0.55,
    crackle: 0.24,
    strobe: false,
  },
  'mgal-strobe': {
    label: STAR_FORMULA_LABELS['mgal-strobe'],
    summary: '镁铝合金产生周期性爆闪；配比敏感，燃烧时间短。',
    colorHint: '#e8f4ff',
    ingredients: [
      { name: '硝酸钾', role: 'oxidizer', percent: 50 },
      { name: '镁铝合金', role: 'fuel', percent: 28, note: '频闪与银白火花' },
      { name: '硫磺', role: 'fuel', percent: 17 },
      { name: '木炭', role: 'fuel', percent: 5 },
    ],
    burnRate: 1.42,
    heat: 1.2,
    smoke: 0.12,
    glitter: 0.82,
    trail: 0.45,
    crackle: 0.35,
    strobe: true,
  },
  'dragon-egg': {
    label: STAR_FORMULA_LABELS['dragon-egg'],
    summary: '钛粉与镁铝合金混合，爆裂时发出密集的白色碎裂声光。',
    colorHint: '#ffd166',
    ingredients: [
      { name: '硝酸钾', role: 'oxidizer', percent: 45 },
      { name: '镁铝合金', role: 'fuel', percent: 24 },
      { name: '硫磺', role: 'fuel', percent: 15 },
      { name: '木炭', role: 'fuel', percent: 10 },
      { name: '钛粉', role: 'additive', percent: 6, note: '白色碎星' },
    ],
    burnRate: 1.5,
    heat: 1.18,
    smoke: 0.2,
    glitter: 0.9,
    trail: 0.55,
    crackle: 0.95,
    strobe: false,
  },
});

type AdditiveInfo = {
  label: string;
  summary: string;
  color: string;
  recommendedPercent: number;
  maxPercent: number;
  heat: number;
  glitter: number;
  trail: number;
  crackle: number;
  strobe: boolean;
};

export const ADDITIVE_INFO: Readonly<Record<FireworkAdditive, AdditiveInfo>> = Object.freeze({
  none: { label: ADDITIVE_LABELS.none, summary: '只使用基础星体药。', color: '#ffffff', recommendedPercent: 0, maxPercent: 0, heat: 0, glitter: 0, trail: 0, crackle: 0, strobe: false },
  titanium: { label: ADDITIVE_LABELS.titanium, summary: '燃烧时炸出白色微星，形成“噼啪”碎闪。', color: '#fff2cc', recommendedPercent: 8, maxPercent: 15, heat: 0.12, glitter: 0.18, trail: 0, crackle: 0.75, strobe: false },
  magnalium: { label: ADDITIVE_LABELS.magnalium, summary: '银色碎星更密，适合做银冠与频闪。', color: '#eef6ff', recommendedPercent: 7, maxPercent: 12, heat: 0.16, glitter: 0.45, trail: 0.1, crackle: 0.3, strobe: true },
  aluminum: { label: ADDITIVE_LABELS.aluminum, summary: '提高亮度与色温，过量会盖住颜色。', color: '#ffffff', recommendedPercent: 6, maxPercent: 10, heat: 0.34, glitter: 0.22, trail: 0.05, crackle: 0.1, strobe: false },
  charcoal: { label: ADDITIVE_LABELS.charcoal, summary: '增加金色余焰和长尾，烟量上升。', color: '#ffc46b', recommendedPercent: 8, maxPercent: 15, heat: 0, glitter: 0.05, trail: 0.4, crackle: 0.05, strobe: false },
  iron: { label: ADDITIVE_LABELS.iron, summary: '橙色分枝火花，像小树枝炸开。', color: '#ff9a4a', recommendedPercent: 6, maxPercent: 10, heat: 0.08, glitter: 0.1, trail: 0.15, crackle: 0.4, strobe: false },
  boron: { label: ADDITIVE_LABELS.boron, summary: '微量硼粉带绿白闪光，剂量要小。', color: '#a8ffb0', recommendedPercent: 4, maxPercent: 8, heat: 0.1, glitter: 0.25, trail: 0, crackle: 0.2, strobe: true },
  copper: { label: ADDITIVE_LABELS.copper, summary: '铜盐让蓝焰更饱满，也会增加烟。', color: '#7cc8ff', recommendedPercent: 5, maxPercent: 8, heat: 0.06, glitter: 0.05, trail: 0.05, crackle: 0.05, strobe: false },
});

type CasingInfo = {
  label: string;
  summary: string;
  burstShape: 'sphere' | 'canister' | 'multi';
  starMassFactor: number;
  burstRadiusScale: number;
  secondaryDelay: number;
  boreClearance: number;
};

export const CASING_INFO: Readonly<Record<ShellCasing, CasingInfo>> = Object.freeze({
  'paper-sphere': { label: SHELL_CASING_LABELS['paper-sphere'], summary: '最常见球壳，星体均匀铺开。', burstShape: 'sphere', starMassFactor: 1, burstRadiusScale: 1, secondaryDelay: 0, boreClearance: 3 },
  'paper-canister': { label: SHELL_CASING_LABELS['paper-canister'], summary: '纸筒壳上下分层，星体更密、开爆偏柱状。', burstShape: 'canister', starMassFactor: 1.12, burstRadiusScale: 0.92, secondaryDelay: 0, boreClearance: 4 },
  'multi-break': { label: SHELL_CASING_LABELS['multi-break'], summary: '主爆后延迟二次开爆，形成两层花。', burstShape: 'multi', starMassFactor: 1.22, burstRadiusScale: 0.78, secondaryDelay: 0.45, boreClearance: 5 },
});

type BurstInfo = {
  label: string;
  summary: string;
  ingredients: readonly RecipeIngredient[];
  radiusScale: number;
  flashScale: number;
  smokeScale: number;
  shockScale: number;
  warning?: string;
};

export const BURST_INFO: Readonly<Record<BurstComposition, BurstInfo>> = Object.freeze({
  'black-powder': {
    label: BURST_COMPOSITION_LABELS['black-powder'],
    summary: '传统黑火药开爆，闪光柔和、烟量足。',
    ingredients: [
      { name: '硝酸钾', role: 'oxidizer', percent: 75 },
      { name: '木炭', role: 'fuel', percent: 15 },
      { name: '硫磺', role: 'fuel', percent: 10 },
    ],
    radiusScale: 1,
    flashScale: 0.8,
    smokeScale: 1,
    shockScale: 0.8,
  },
  'flash-powder': {
    label: BURST_COMPOSITION_LABELS['flash-powder'],
    summary: '高氯酸钾与铝粉的强闪光药，爆闪和冲击波明显。',
    ingredients: [
      { name: '高氯酸钾', role: 'oxidizer', percent: 70, note: '强氧化剂，机械敏感' },
      { name: '铝粉', role: 'fuel', percent: 30, note: '金属燃料' },
    ],
    radiusScale: 1.16,
    flashScale: 1.55,
    smokeScale: 0.35,
    shockScale: 1.25,
    warning: '闪光药爆速高、机械敏感，现实制作只允许专业场地与小剂量。',
  },
  whistle: {
    label: BURST_COMPOSITION_LABELS.whistle,
    summary: '哨音药开爆更慢，烟多、闪光弱，适合做低沉的一声。',
    ingredients: [
      { name: '高氯酸钾', role: 'oxidizer', percent: 70 },
      { name: '苯甲酸钾', role: 'fuel', percent: 30, note: '产生哨音' },
    ],
    radiusScale: 1.06,
    flashScale: 0.5,
    smokeScale: 0.9,
    shockScale: 0.6,
  },
});

export type ChemistryEffect = {
  burnRate: number;
  heat: number;
  smoke: number;
  glitter: number;
  trail: number;
  crackle: number;
  strobe: boolean;
  colorHint: string;
  burstShape: CasingInfo['burstShape'];
  burstRadiusScale: number;
  flashScale: number;
  shockScale: number;
  secondaryDelay: number;
  starMassFactor: number;
};

export type CraftInput = FireworkCraft & {
  caliber: number;
  starCount: number;
  starSize: number;
  liftCharge: number;
  breakCharge: number;
  burnTime: number;
  launchAngle: number;
};

export function defaultCraft(caliber = 150): FireworkCraft {
  return {
    formula: 'kp-gold',
    additive: 'none',
    additivePercent: 0,
    casing: 'paper-sphere',
    burst: 'black-powder',
    ignition: 'time-fuse',
    mortarBore: recommendedMortarBore(caliber),
    fuseOffset: 0,
  };
}

export function normalizeCraft(input: unknown, caliber: number): FireworkCraft {
  const fallback = defaultCraft(caliber);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fallback;
  const raw = input as Partial<FireworkCraft>;
  const formula = STAR_FORMULAS.includes(raw.formula as StarFormula) ? raw.formula as StarFormula : fallback.formula;
  const additive = ADDITIVES.includes(raw.additive as FireworkAdditive) ? raw.additive as FireworkAdditive : fallback.additive;
  const casing = SHELL_CASINGS.includes(raw.casing as ShellCasing) ? raw.casing as ShellCasing : fallback.casing;
  const burst = BURST_COMPOSITIONS.includes(raw.burst as BurstComposition) ? raw.burst as BurstComposition : fallback.burst;
  const ignition = IGNITIONS.includes(raw.ignition as FireworkIgnition) ? raw.ignition as FireworkIgnition : fallback.ignition;
  const clampInt = (value: unknown, fallbackValue: number, min: number, max: number): number =>
    Number.isInteger(value) ? Math.min(max, Math.max(min, value as number)) : fallbackValue;
  return {
    formula,
    additive,
    additivePercent: clampInt(raw.additivePercent, additive === 'none' ? 0 : ADDITIVE_INFO[additive].recommendedPercent, CRAFT_LIMITS.additivePercentMin, CRAFT_LIMITS.additivePercentMax),
    casing,
    burst,
    ignition,
    mortarBore: clampInt(raw.mortarBore, recommendedMortarBore(caliber), CRAFT_LIMITS.mortarBoreMin, CRAFT_LIMITS.mortarBoreMax),
    fuseOffset: typeof raw.fuseOffset === 'number' && Number.isFinite(raw.fuseOffset)
      ? Math.min(CRAFT_LIMITS.fuseOffsetMax, Math.max(CRAFT_LIMITS.fuseOffsetMin, Math.round(raw.fuseOffset * 100) / 100))
      : 0,
  };
}

export function recommendedMortarBore(caliber: number, casing: ShellCasing = 'paper-sphere'): number {
  return Math.max(CRAFT_LIMITS.mortarBoreMin, Math.round(caliber + CASING_INFO[casing].boreClearance + 1));
}

export function recommendedMortarLength(caliber: number, casing: ShellCasing = 'paper-sphere'): number {
  const caseFactor = casing === 'paper-canister' ? 1.2 : casing === 'multi-break' ? 1.12 : 1;
  return Math.round(Math.max(360, caliber * 3.1 * caseFactor) / 10) * 10;
}

/** 星体总质量：球体体积 × 密度，另计 8% 的引燃药与损耗。 */
export function starMassGrams(input: Pick<CraftInput, 'starCount' | 'starSize'>): number {
  const radiusCm = input.starSize / 20;
  const volume = (4 / 3) * Math.PI * radiusCm ** 3;
  return input.starCount * volume * 1.8 * 1.08;
}

/** 星体药最终配方：基础配方按添加物比例缩放，添加物单独列出。 */
export function starRecipe(input: Pick<CraftInput, 'formula' | 'additive' | 'additivePercent' | 'starCount' | 'starSize'>): RecipeIngredient[] {
  const formula = FORMULAS[input.formula];
  const additive = ADDITIVE_INFO[input.additive];
  const additivePct = input.additive === 'none' ? 0 : Math.min(CRAFT_LIMITS.additivePercentMax, Math.max(0, input.additivePercent));
  const baseScale = (100 - additivePct) / 100;
  const lines: RecipeIngredient[] = formula.ingredients.map((ingredient) => ({
    ...ingredient,
    percent: Math.round(ingredient.percent * baseScale * 10) / 10,
  }));
  if (additivePct > 0) {
    lines.push({
      name: additive.label,
      role: 'additive',
      percent: additivePct,
      note: additive.summary,
    });
  }
  return lines;
}

export type RecipeLine = RecipeIngredient & { grams: number };

export type ShoppingLine = {
  name: string;
  grams?: number;
  count?: number;
  use: string;
};

export type InstallationPlan = {
  boreMm: number;
  tubeLengthMm: number;
  clearanceMm: number;
  burialDepthMm: number;
  safetyDistanceM: number;
  ignitionLineM: number;
  steps: string[];
};

export type ChemistryReport = {
  effect: ChemistryEffect;
  starMassG: number;
  starRecipe: RecipeLine[];
  burstRecipe: RecipeLine[];
  liftRecipe: RecipeLine[];
  shopping: ShoppingLine[];
  installation: InstallationPlan;
  warnings: string[];
};

export function chemistryEffect(craft: FireworkCraft): ChemistryEffect {
  const formula = FORMULAS[craft.formula];
  const additive = ADDITIVE_INFO[craft.additive];
  const casing = CASING_INFO[craft.casing];
  const burst = BURST_INFO[craft.burst];
  const dose = craft.additive === 'none' ? 0 : Math.min(CRAFT_LIMITS.additivePercentMax, Math.max(0, craft.additivePercent));
  const doseScale = dose / 8;
  return {
    burnRate: formula.burnRate * (1 + doseScale * 0.04),
    heat: formula.heat + additive.heat * doseScale,
    smoke: Math.min(1, (formula.smoke + additive.crackle * doseScale * 0.05) * burst.smokeScale),
    glitter: Math.min(1, formula.glitter + additive.glitter * doseScale),
    trail: Math.min(1, formula.trail + additive.trail * doseScale),
    crackle: Math.min(1, formula.crackle + additive.crackle * doseScale + (craft.casing === 'multi-break' ? 0.12 : 0)),
    strobe: formula.strobe || additive.strobe,
    colorHint: additive.color !== '#ffffff' && dose > 0 ? additive.color : formula.colorHint,
    burstShape: casing.burstShape,
    burstRadiusScale: casing.burstRadiusScale * burst.radiusScale,
    flashScale: burst.flashScale,
    shockScale: burst.shockScale,
    secondaryDelay: casing.secondaryDelay,
    starMassFactor: casing.starMassFactor,
  };
}

function scaleRecipe(ingredients: readonly RecipeIngredient[], totalGrams: number): RecipeLine[] {
  return ingredients.map((ingredient) => ({
    ...ingredient,
    grams: Math.round(totalGrams * ingredient.percent) / 100,
  }));
}

function liftRecipe(liftCharge: number): RecipeLine[] {
  return scaleRecipe([
    { name: '硝酸钾', role: 'oxidizer', percent: 75 },
    { name: '木炭', role: 'fuel', percent: 15 },
    { name: '硫磺', role: 'fuel', percent: 10 },
  ], liftCharge);
}

function aggregateShopping(star: readonly RecipeLine[], lift: readonly RecipeLine[], burst: readonly RecipeLine[], input: CraftInput): ShoppingLine[] {
  const totals = new Map<string, { grams: number; uses: Set<string> }>();
  const add = (lines: readonly RecipeLine[], use: string) => {
    for (const line of lines) {
      const entry = totals.get(line.name) ?? { grams: 0, uses: new Set<string>() };
      entry.grams += line.grams;
      entry.uses.add(use);
      totals.set(line.name, entry);
    }
  };
  add(star, '星体药');
  add(lift, '发射药');
  add(burst, '开爆药');
  const lines: ShoppingLine[] = [...totals.entries()]
    .map(([name, entry]) => ({ name, grams: Math.round(entry.grams), use: [...entry.uses].join(' / ') }))
    .sort((a, b) => (b.grams ?? 0) - (a.grams ?? 0));
  const casing = CASING_INFO[input.casing];
  const installation = recommendInstallation(input);
  lines.push({ name: casing.label, count: 1, use: `装 ${input.starCount} 颗星体` });
  lines.push({ name: '黏土封口', grams: Math.max(20, Math.round(installation.boreMm * 0.4)), use: '炮筒底部与弹体封口' });
  lines.push({ name: input.ignition === 'electric-match' ? '电点火头' : '导火索', count: 1, use: input.ignition === 'electric-match' ? '接点火器' : '定引信时长' });
  return lines;
}

export function recommendInstallation(input: CraftInput): InstallationPlan {
  const boreMm = Math.max(recommendedMortarBore(input.caliber, input.casing), input.mortarBore);
  const tubeLengthMm = recommendedMortarLength(input.caliber, input.casing);
  const clearanceMm = Math.round(boreMm - input.caliber);
  const burialDepthMm = Math.round(tubeLengthMm * 0.66);
  const safetyDistanceM = Math.max(8, Math.round(input.caliber / 12 + input.breakCharge / 18));
  const ignitionLineM = input.ignition === 'electric-match' ? Math.max(12, Math.round(safetyDistanceM * 1.2)) : Math.max(8, Math.round(safetyDistanceM * 0.8));
  const steps = [
    `炮筒：内径 ${boreMm} mm、长 ${tubeLengthMm} mm 的无缝纸管/钢管，筒底垫 20 mm 黏土。`,
    `安装：炮筒埋入沙地或固定在发射架，埋深约 ${burialDepthMm} mm，向海面偏 ${input.launchAngle}°。`,
    `装填：先放发射药 ${input.liftCharge} g，再放弹体；弹体与筒壁间隙 ${clearanceMm} mm，不能卡死。`,
    `引信：${input.ignition === 'electric-match' ? `电点火头接 ${ignitionLineM} m 铜芯线，12 V 电源` : `导火索留 ${Math.round((2.5 + input.fuseOffset) * 10) / 10} s 引信，点火后撤离`}。`,
    `安全：人员与观众退到 ${safetyDistanceM} m 外，远离干燥草木；哑弹等待 15 分钟后再处理。`,
  ];
  return { boreMm, tubeLengthMm, clearanceMm, burialDepthMm, safetyDistanceM, ignitionLineM, steps };
}

export function chemistryReport(input: CraftInput): ChemistryReport {
  const craft = normalizeCraft(input, input.caliber);
  const effect = chemistryEffect(craft);
  const starMassG = Math.round(starMassGrams(input) * effect.starMassFactor);
  const star = scaleRecipe(starRecipe({ ...input, ...craft }), starMassG);
  const burstRecipeLines = scaleRecipe(BURST_INFO[craft.burst].ingredients, input.breakCharge);
  const lift = liftRecipe(input.liftCharge);
  const warnings: string[] = [];
  const additive = ADDITIVE_INFO[craft.additive];
  if (craft.additive !== 'none' && craft.additivePercent > additive.maxPercent) {
    warnings.push(`${additive.label} 超过建议上限 ${additive.maxPercent}%：现实配方会变得敏感、颜色也会发灰`);
  }
  if (craft.mortarBore < input.caliber + CASING_INFO[craft.casing].boreClearance - 1) {
    warnings.push(`炮筒内径 ${craft.mortarBore} mm 对 ${input.caliber} mm 弹体过紧，装填与开爆都不安全`);
  }
  if (craft.burst === 'flash-powder' && input.caliber > 200) {
    warnings.push('闪药配大口径：现实里只允许持证场地小剂量使用，游戏内仍按强爆闪表现');
  }
  if (craft.fuseOffset < -0.5) warnings.push('引信偏短：开爆点会明显低于设计高度');
  if (craft.fuseOffset > 0.5) warnings.push('引信偏长：弹体会过顶后下坠，开爆点变低');
  if (craft.casing === 'multi-break' && input.breakCharge < 20) warnings.push('多层球的开爆药偏少，第二层花会很小');
  if (effect.strobe && input.burnTime < 2) warnings.push('频闪星体燃烧时间太短，频闪来不及形成节奏');
  return {
    effect,
    starMassG,
    starRecipe: star,
    burstRecipe: burstRecipeLines,
    liftRecipe: lift,
    shopping: aggregateShopping(star, lift, burstRecipeLines, input),
    installation: recommendInstallation(input),
    warnings,
  };
}

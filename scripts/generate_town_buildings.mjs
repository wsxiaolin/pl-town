#!/usr/bin/env node
// 年份镇作品建筑生成器（T5，设计 docs/year-towns-design.md §7/§8）。
//
// 用法：/home/z/node22/bin/node scripts/generate_town_buildings.mjs [--data-dir=DIR] [--check]
//   --data-dir  数据目录（默认仓库同级 ../data：blackhole_top1000.json + blackhole_details.json）
//   --check     只读校验：重算全部产物并与磁盘逐字节比对（CI/门禁用），不写文件
//
// 产物（只覆盖下列明确文件，幂等：两次运行逐字节一致，无时间戳）：
//   apps/web/src/city/data/year-towns/gen-buildings.ts   115 座建筑配置（静态 import）
//   apps/web/src/city/data/year-towns/gen-loaders.ts     懒加载路由表（静态 import，import() 全部字面量）
//   apps/web/src/city/data/year-towns/gen-index.ts       1000 条 P 级铭牌索引（懒）
//   apps/web/src/city/data/year-towns/gen-t{y}[-a/b..].ts  D 级：正文+评论精选（懒，>850KB 拆分）
//   apps/web/src/city/data/year-towns/gen-b{y}.ts        超长正文包（>8KB 外置全文，懒）
//   apps/web/src/city/data/year-towns/gen-c{y}-{i}.ts    F 级：全部评论包（懒，≤850KB/包）
//   apps/server/src/data/yearTownCatalog.ts              服务端目录镜像（GENERATED，提交）
//   docs/year-towns-gen-report.md / .json                生成报告与对账数据
//
// 数据口径（data/detail_summary.md §五，T4.5 质检 7 条）：
//   ① commentsTruncated 巨楼面板标「仅展示最新 N 条 / 共 totalComments 条」；
//   ② Count 偏差作品渲染条数以 len(comments) 为准（断言不用 totalComments）；
//   ③ rank 344「电学实验的问号」评论置空 + locked 标记（正文正常）；
//   ④ 正文/评论的社区富文本标记由 sanitizeCommunityText 统一清洗（生成期烘焙）；
//   ⑤ 评论为平铺前缀结构，无树形；
//   ⑥ 空白评论过滤不渲染；
//   ⑦ 字符口径 len()（代码点计数，中文 1 字符）。

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOWNS_DIR = join(REPO_ROOT, 'apps/web/src/city/data/year-towns');
const SERVER_DATA_DIR = join(REPO_ROOT, 'apps/server/src/data');
const DOCS_DIR = join(REPO_ROOT, 'docs');

// ── 设计常量（docs/year-towns-design.md）──────────────────────────────────
const TOP_N = { 2019: 2, 2020: 10, 2021: 16, 2022: 20, 2023: 18, 2024: 16, 2025: 12, 2026: 12 };
const YEAR_COUNTS = { 2019: 2, 2020: 75, 2021: 147, 2022: 217, 2023: 202, 2024: 170, 2025: 128, 2026: 59 };
/**
 * 各镇街区的方位偏好（设计 §7.1 修订：设施族 → 街区）。
 * 值 = 该街区相对镇心的方位角偏移（弧度）；同族设施归拢成片，形成可辨认的城区，
 * 而不是按序号轮转散布。缺席的族按当前最小占用自动落位。
 */
const DISTRICT_BEARINGS = {
  // 制度与名录临主街（进入镇子第一眼看到秩序）。
  law: 0,
  guild: 0.5,
  press: 1.1,
  // 学理与观察在后街高处（安静、视野好）。
  academy: 2.2,
  observatory: 2.9,
  lab: 3.6,
  // 生活与聚会在另一侧（热闹、临水）。
  tavern: 4.3,
  gathering: 4.9,
  market: 5.4,
  dwelling: 5.9,
  narrative: 1.7,
};

/** 设施族 → 既有程序化 shape（与 yearTownMemorials.ts 的 FACILITY_SHAPES 同源）。 */
const FAMILY_SHAPES = {
  law: 'bank',
  gathering: 'market',
  academy: 'academy',
  observatory: 'observatory',
  narrative: 'pagoda',
  lab: 'greenhouse',
  tavern: 'tavern',
  market: 'mall',
  memorial: 'temple',
  dwelling: 'school',
  press: 'tower',
  guild: 'qipai',
};
/** 热度分层地块基准（设计 §7.1），过密镇按容量等比缩放（下限 0.5）。 */
const PLOT_BASE = { XL: 5.5, L: 4.6, M: 3.8, S: 3.2, ARCH: 4.2, TOWER: 3.0, STELE: 1.8 };
const BODY_INLINE_LIMIT = 8000;   // 正文 >8KB：D 级截断 + 全文外置 gen-b{y}
const BODY_EXCERPT = 2000;        // 截断预览长度（代码点）
const COMMENT_INLINE = 20;        // D 级评论精选条数（设计 §8.3）
const COMMENT_MAX = 500;          // 单条评论上限（超长截断加 …）
const PACK_BYTES = 850_000;       // 生成模块分片阈值（设计 ≤900KB）
const RECT_GAP = 0.5;             // 地块间距下限（轴对齐矩形任一轴分离 ≥ 此值）
const PAD_GAP = 0.3;              // 站台泊位圆（r=2.6）与地块矩形的最小间隙
const LOCKED_WORK_ID = '6256584dfa4ee80001c7104d'; // rank 344：评论区 403 锁定
const LABEL_MAX = 16;             // 建筑 label 上限（对齐 BUILDING_LABEL_MAX_LENGTH）
const SUBJECT_MAX = 48;           // 面板题名上限（设计 §8.3）
const ABSTRACT_MAX = 120;         // 摘要上限
const TAGS_MAX = 4;

// 2019 起源村为微型村（台面 r=9），手工布点（设计 §7.1 布局语法的定稿解；
// 角点约束放宽至 r ≤ plateauR−2.2，桥/环线站台矩形间距已逐项核验）。
const ORIGIN_VILLAGE_LAYOUT = {
  stele: { x: 92.1, z: 199.5 },
  rank1: { x: 96, z: 204.2 },
  rank2: { x: 92.2, z: 202.4 },
  tower: { x: 99.8, z: 204.2 },
};

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const dataDirArg = args.find((a) => a.startsWith('--data-dir='));
const DATA_DIR = dataDirArg ? resolve(dataDirArg.slice('--data-dir='.length)) : resolve(REPO_ROOT, '..', 'data');

const round2 = (v) => Math.round(v * 100) / 100;
const codePoints = (s) => Array.from(s);
const jstr = (v) => JSON.stringify(v);

function log(...parts) { process.stdout.write(parts.join(' ') + '\n'); }
function fail(message) { throw new Error(`[generate_town_buildings] ${message}`); }

// ── 1. 载入数据与同源模块（towns / transit / sanitize 经 esbuild 单一事实源）────
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (error) { fail(`无法读取 ${path}: ${error.message}`); }
}

async function bundleTownModules() {
  // esbuild 打包 towns.ts + transit.ts + sanitizeCommunityText.ts + yearTownMemorials.ts
  // + districtLayout.ts，生成器与运行时共用手写地标坐标。
  // —— 生成器与运行时共用同一实现（设计 §7.3「生成期烘焙 + 运行时同源」红线）。
  const result = await build({
    stdin: {
      contents: "export * from './sanitizeCommunityText'; export { YEAR_TOWNS } from './towns'; export { TRANSIT_STATIONS } from './transit'; export { YEAR_TOWN_MEMORIAL_BY_KEY, YEAR_TOWN_LANDMARK_NOTES, FACILITY_SHAPES } from './yearTownMemorials'; export { LANDMARK_PLACEMENTS } from './districtLayout';",
      loader: 'ts',
      resolveDir: TOWNS_DIR,
    },
    bundle: true, format: 'esm', platform: 'node', write: false, minify: true,
  });
  const temp = join(mkdtempSync(join(tmpdir(), 'yt-gen-')), 'bundle.mjs');
  writeFileSync(temp, result.outputFiles[0].text);
  return import(pathToFileURL(temp).href);
}

const townModules = await bundleTownModules();
const {
  YEAR_TOWNS, TRANSIT_STATIONS, YEAR_TOWN_MEMORIAL_BY_KEY, YEAR_TOWN_LANDMARK_NOTES, LANDMARK_PLACEMENTS,
} = townModules;

// 纪念目录完整性：106 座作品建筑必须逐一定义，且 key 与年份/名次一处不差。
{
  const expected = [];
  for (const town of YEAR_TOWNS) {
    const n = TOP_N[town.year];
    for (let i = 1; i <= n; i += 1) expected.push(`yt-w${town.year}-${String(i).padStart(2, '0')}`);
  }
  const defined = Object.keys(YEAR_TOWN_MEMORIAL_BY_KEY);
  const missing = expected.filter((k) => !YEAR_TOWN_MEMORIAL_BY_KEY[k]);
  const extra = defined.filter((k) => !expected.includes(k));
  if (missing.length > 0) fail(`纪念目录缺 ${missing.length} 项：${missing.slice(0, 5).join(', ')}…`);
  if (extra.length > 0) fail(`纪念目录多出 ${extra.length} 项：${extra.slice(0, 5).join(', ')}…`);
  for (const [key, m] of Object.entries(YEAR_TOWN_MEMORIAL_BY_KEY)) {
    if (!m.facility || !m.note) fail(`纪念设施 ${key} 缺设施名或导语`);
    if (!FAMILY_SHAPES[m.family]) fail(`纪念设施 ${key} 的设施族未知：${m.family}`);
  }
}

// ── 2. 数据对账与合并 ─────────────────────────────────────────────────────
// 两种来源：
//   A. 完整数据源（blackhole_top1000.json + blackhole_details.json）——原始秩/热度可用；
//   B. 离线重建（--from-catalog）：数据源不可得时，从现有 gen-buildings.ts 的
//      extras 与手写纪念目录恢复「建筑 → workId → 年份/名次」结构，只重排布局、
//      重算设施 image 与标签。作品正文/评论/热度一律不需要（设计 §7.1 修订）。
const CATALOG_PATH = join(TOWNS_DIR, 'gen-buildings.ts');
const hasDataSource = existsSync(join(DATA_DIR, 'blackhole_top1000.json'))
  && existsSync(join(DATA_DIR, 'blackhole_details.json'));

let works;
let townById = new Map(YEAR_TOWNS.map((t) => [t.id, t]));
let townWorks = {};

if (hasDataSource) {
  const top1000 = readJson(join(DATA_DIR, 'blackhole_top1000.json'));
  const details = readJson(join(DATA_DIR, 'blackhole_details.json'));
  const topWorks = top1000.works ?? [];
  const detailWorks = details.works ?? [];
  if (topWorks.length !== 1000 || detailWorks.length !== 1000) fail(`条数非 1000：top=${topWorks.length} details=${detailWorks.length}`);
  const detailById = new Map(detailWorks.map((w) => [w.id, w]));
  const topIds = new Set(topWorks.map((w) => w.id));
  for (const w of detailWorks) if (!topIds.has(w.id)) fail(`details 多出未知作品 ${w.id}`);
  for (const id of topIds) if (!detailById.has(id)) fail(`details 缺作品 ${id}`);
  if (new Set(detailWorks.map((w) => w.id)).size !== 1000) fail('details 存在重复 ID');

  works = topWorks.map((w) => {
    const d = detailById.get(w.id);
    const year = Number(String(d.meta?.createdAt ?? w.createdAt ?? '').slice(0, 4));
    if (!Number.isFinite(year) || year < 2019 || year > 2026) fail(`作品 ${w.id} 年份异常: ${year}`);
    return { id: w.id, rank: d.rank, subjectRaw: w.subject, year, meta: d.meta ?? {} };
  });

  const byYear = {};
  for (const w of works) byYear[w.year] = (byYear[w.year] ?? 0) + 1;
  for (const [year, count] of Object.entries(YEAR_COUNTS)) {
    if (byYear[year] !== count) fail(`${year} 年条数 ${byYear[year]} ≠ 设计表 ${count}`);
  }

  // 镇内排序（热度降、id 升）与镇内名次。
  for (const town of YEAR_TOWNS) {
    const list = works.filter((w) => w.year === town.year)
      .sort((a, b) => (b.meta.popularity ?? 0) - (a.meta.popularity ?? 0) || (a.id < b.id ? -1 : 1));
    list.forEach((w, i) => { w.townRank = i + 1; });
    townWorks[town.year] = list;
  }
} else {
  // 离线重建：结构完全取自手写纪念目录（唯一事实源，不会被产物覆盖）。
  // key 形如 yt-w{year}-{rank}，rank 即镇内名次。
  const restored = Object.values(YEAR_TOWN_MEMORIAL_BY_KEY).map((mem) => {
    const parsed = /^yt-w(20\d\d)-(\d\d)$/.exec(mem.key);
    if (!parsed) fail(`纪念目录 key 格式异常：${mem.key}`);
    return { key: mem.key, year: Number(parsed[1]), townRank: Number(parsed[2]), workId: mem.workId };
  }).sort((a, b) => a.year - b.year || a.townRank - b.townRank);
  if (restored.length !== 106) fail(`纪念目录读到 ${restored.length} 座设施 ≠ 106`);
  works = restored.map((r) => ({ id: r.workId, townRank: r.townRank, year: r.year, meta: {} }));
  for (const town of YEAR_TOWNS) {
    const expected = TOP_N[town.year];
    const got = restored.filter((r) => r.year === town.year);
    if (got.length !== expected) fail(`${town.label} 设施数 ${got.length} ≠ ${expected}`);
    townWorks[town.year] = works.filter((w) => w.year === town.year)
      .sort((a, b) => a.townRank - b.townRank);
  }
  log(`离线重建：从手写纪念目录恢复 106 座设施（不含作品原文/评论/热度）。`);
}

// ── 4. 布局（确定性：无 Math.random；2019 手工，其余镇街+环贪心）────────────
function rectOf(x, z, size) { return { x0: x - size / 2, x1: x + size / 2, z0: z - size / 2, z1: z + size / 2 }; }
function rectsSeparated(a, b, gap) {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1, 0);
  const dz = Math.max(a.z0 - b.z1, b.z0 - a.z1, 0);
  return dx >= gap || dz >= gap;
}
function rectWithinCircle(rect, cx, cz, r) {
  for (const [px, pz] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]]) {
    if (Math.hypot(px - cx, pz - cz) > r) return false;
  }
  return true;
}
function rectClearsPads(rect, pads) {
  for (const pad of pads) {
    const px = Math.min(Math.max(pad.x, rect.x0), rect.x1);
    const pz = Math.min(Math.max(pad.z, rect.z0), rect.z1);
    if (Math.hypot(px - pad.x, pz - pad.z) < pad.r + PAD_GAP) return false;
  }
  return true;
}
const stationPads = TRANSIT_STATIONS.map((s) => ({ x: s.platformX, z: s.platformZ, r: 2.6 }));

function layoutTown(town, items) {
  // items: [{ key, tier, size, family }] —— 按设施族归拢到各自街区方位。
  //
  // 布局语法（设计 §7.1 修订）：
  //   1. 中央广场：镇心留空 r ≈ plateauR×0.22，不落建筑；
  //   2. 纪念轴线：站台 → 镇心 → 轴线终点，XL（设施 #1）置于轴线尽端作对景；
  //   3. 环形主街：r = ringR 一圈留作街道，建筑不得骑跨；
  //   4. 街区分布：其余设施按 family 的方位偏好归拢，形成可辨认的同质街区；
  //   5. 密度梯度：靠近镇心（主街内侧）放 L/M，外圈放 S，形成核心密、边缘疏。
  const cx = town.x, cz = town.z;
  const rBuild = round2(town.plateauR - 3.5);
  const station = TRANSIT_STATIONS.find((s) => s.id === `station-${town.year}`);
  const ux = cx - station.platformX, uz = cz - station.platformZ;
  const norm = Math.hypot(ux, uz) || 1;
  const uxN = ux / norm, uzN = uz / norm;          // 进镇方向（站台 → 镇心）
  const pxN = -uzN, pzN = uxN;                     // 垂直向（大街两侧）
  const cornerLimit = round2(town.plateauR - (town.year === 2019 ? 2.2 : 0.9));
  const centerLimit = rBuild;
  const pads = stationPads;
  const plazaR = round2(town.plateauR * 0.22);      // 中央广场（禁止落位）
  const ringR = round2(town.plateauR * 0.62);       // 环形主街中心线
  const ringHalf = 1.15;                            // 街道半宽（含路缘）
  const streetAxisPhi = Math.atan2(uzN, uxN);

  let scale = Math.min(1, Math.sqrt((Math.PI * rBuild * rBuild * 0.36) / items.reduce((a, i) => a + i.size * i.size, 0)));
  scale = Math.max(0.45, scale);

  const insideRingBand = (r, half) => r > ringR - ringHalf - half && r < ringR + ringHalf + half;
  const insidePlaza = (r, half) => r < plazaR + half;

  let lastFailed = '';
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const placed = [];
    const placedRects = [];
    const place = (item, x, z, size) => {
      placed.push({ ...item, x: round2(x), z: round2(z), plot: round2(size) });
      placedRects.push(rectOf(x, z, size));
    };
    const fits = (x, z, size) => {
      const r = Math.hypot(x - cx, z - cz);
      if (r > centerLimit) return false;
      if (insidePlaza(r, size / 2)) return false;
      if (insideRingBand(r, size / 2)) return false;
      const rect = rectOf(x, z, size);
      if (!rectWithinCircle(rect, cx, cz, cornerLimit)) return false;
      if (!rectClearsPads(rect, pads)) return false;
      return placedRects.every((o) => rectsSeparated(rect, o, RECT_GAP));
    };

    // 1. XL：轴线尽端对景（落在环形主街之外，正对进镇方向）。
    const xl = items.find((i) => i.tier === 'XL');
    if (xl) {
      const xlSize = round2(xl.size * scale);
      const reach = Math.min(centerLimit - xlSize / 2 - 0.35, cornerLimit - xlSize / 2 - 0.6);
      place(xl, cx + uxN * reach, cz + uzN * reach, xlSize);
    }

    // 2. 其余设施：按街区方位归拢，沿该方位在内外两圈之间寻位。
    const rest = items.filter((i) => i.tier !== 'XL');
    // 同族连续落位（族内保持街道相邻），族间按方位角排序成环。
    const familyOrder = [...new Set(rest.map((i) => i.family))].sort(
      (a, b) => (DISTRICT_BEARINGS[a] ?? 0) - (DISTRICT_BEARINGS[b] ?? 0),
    );
    const ordered = familyOrder.flatMap((f) => rest.filter((i) => i.family === f));
    let allOk = true;
    for (const item of ordered) {
      const size = round2(item.size * scale);
      const bearing = streetAxisPhi + (DISTRICT_BEARINGS[item.family] ?? 0);
      // 内外两圈候选半径：内圈贴主街内侧，外圈贴台面边缘（密度梯度）。
      const radii = [
        round2(ringR + ringHalf + size / 2 + 0.5),        // 主街外侧
        round2(ringR - ringHalf - size / 2 - 0.5),        // 主街内侧
        round2(ringR + ringHalf + size / 2 + 2.4),        // 外环邻巷
        round2(ringR - ringHalf - size / 2 - 2.4),        // 内环邻巷
        round2(plazaR + size / 2 + 0.8),                  // 广场边缘
      ].filter((r) => r > plazaR + size / 2 + 0.4 && r <= centerLimit - size / 2 + 0.001);
      let done = false;
      // 方位候选：族方位附近逐级外扩（保持街区成片，又允许绕开已落位建筑）。
      for (const r of radii) {
        if (done) break;
        for (let dth = 0; dth <= Math.PI * 0.9 && !done; dth += 0.14) {
          for (const sign of [1, -1]) {
            if (dth === 0 && sign === -1) continue;
            const th = bearing + sign * dth;
            const x = cx + Math.cos(th) * r;
            const z = cz + Math.sin(th) * r;
            if (!fits(x, z, size)) continue;
            place(item, x, z, size);
            done = true;
            break;
          }
        }
      }
      if (!done) { allOk = false; lastFailed = `${item.key}(${item.family})`; break; }
    }
    if (allOk) return { placed, scale: round2(scale * 100) / 100 };
    scale = Math.max(0.45, scale * 0.92);
    if (attempt === 11) fail(`${town.label} 布局未收敛（最后失败项 ${lastFailed}，scale=${scale.toFixed(2)}）`);
  }
  fail(`${town.label} 布局未收敛（12 次缩放重试后仍有建筑无法落位）`);
}

// 组装各镇建筑条目（纪念设施 / archive / tower / stele）。
const townStructures = {};
for (const town of YEAR_TOWNS) {
  const topN = TOP_N[town.year];
  const list = townWorks[town.year];
  const structures = [];
  const tierOf = (townRank) => (townRank === 1 ? 'XL' : townRank <= 3 ? 'L' : townRank <= 10 ? 'M' : 'S');
  list.slice(0, topN).forEach((w, i) => {
    const key = `yt-w${town.year}-${String(i + 1).padStart(2, '0')}`;
    const memorial = YEAR_TOWN_MEMORIAL_BY_KEY[key];
    structures.push({
      key,
      tier: tierOf(i + 1),
      size: PLOT_BASE[tierOf(i + 1)],
      family: memorial.family,
      shape: FAMILY_SHAPES[memorial.family],
      memorial,
      workId: w.id,
      townRank: i + 1,
    });
  });
  if (town.year !== 2019) {
    structures.splice(3, 0, { key: `yt-arch-${town.year}`, tier: 'ARCH', size: PLOT_BASE.ARCH, family: 'press', shape: 'library', landmark: true });
  } else {
    structures.push({ key: 'yt-tower', tier: 'TOWER', size: PLOT_BASE.TOWER, family: 'press', shape: 'pavilion', landmark: true });
    structures.push({ key: 'yt-stele-2019', tier: 'STELE', size: PLOT_BASE.STELE, family: 'memorial', shape: 'shaft', landmark: true });
  }
  townStructures[town.year] = structures;
}

// 布局执行：坐标全部取自手写目录（yearTownMemorials.ts 的 layout 字段）。
// 生成器只负责把设施名/设施族/坐标固化为 BuildingConfig，不再自行布局。
const placements = {};
const placementsScaleCache = {};
for (const town of YEAR_TOWNS) {
  placementsScaleCache[town.year] = 1;
  placements[town.year] = townStructures[town.year].map((item) => {
    const layout = item.memorial?.layout ?? LANDMARK_PLACEMENTS[item.key];
    if (!layout) fail(`${item.key} 缺手写 layout（yearTownMemorials.ts 或 LANDMARK_PLACEMENTS）`);
    const facingRotation = { n: Math.PI, s: 0, e: Math.PI / 2, w: -Math.PI / 2 };
    return { ...item, x: layout.x, z: layout.z, plot: layout.plot ?? 4.2, rotY: facingRotation[layout.facing] };
  });
}

// ── 7. 生成模块文本（确定性，无时间戳）─────────────────────────────────
const GEN_HEADER = '// GENERATED FILE — do not edit by hand.\n' +
  '// 由 scripts/generate_town_buildings.mjs 产出（幂等；重跑前会清理旧 gen-* 文件）。\n' +
  '// 设施数据：手写目录 yearTownMemorials.ts（作品原文/评论/热度不进入年份群岛）。\n';

const ICON_GLYPHS = {
  tower: '<rect x="9" y="4" width="6" height="17"/><path d="M9 8h6M9 12h6M9 16h6"/>',
  skyscraper: '<rect x="6" y="4" width="5" height="17"/><rect x="13" y="8" width="5" height="13"/><path d="M8.5 8h.01M15.5 11h.01"/>',
  bank: '<path d="M3 9l9-6 9 6"/><path d="M5 9v11M9.5 9v11M14.5 9v11M19 9v11"/><path d="M3 20h18"/>',
  pavilion: '<path d="M4 10l8-6 8 6"/><path d="M6 10v10M18 10v10M12 10v10"/><path d="M4 20h16"/>',
  library: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/>',
  campus: '<rect x="4" y="10" width="16" height="10"/><path d="M2 10l10-6 10 6"/><path d="M9 14h6"/>',
  kiosk: '<rect x="6" y="8" width="12" height="13"/><path d="M4 8l8-5 8 5"/><path d="M10 12h4"/>',
  clocktower: '<rect x="8" y="6" width="8" height="15"/><path d="M8 6l4-3 4 3"/><path d="M12 10v4l2.2 1.6"/><circle cx="12" cy="8" r="0.4"/>',
  market: '<path d="M4 9h16l-1 11H5z"/><path d="M4 9l2-4h12l2 4"/><path d="M9 13h6"/>',
  greenhouse: '<path d="M4 20V9l8-5 8 5v11"/><path d="M4 9h16M8 9v11M16 9v11"/>',
  temple: '<path d="M4 10l8-6 8 6"/><path d="M6 10v4h12v-4M7 14v6M17 14v6M12 14v6"/><path d="M3 20h18"/>',
  qipai: '<rect x="5" y="9" width="14" height="11"/><path d="M8 9V6l4-3 4 3v3"/><path d="M9 13h6"/>',
  tavern: '<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/><path d="M2 8h20"/>',
  academy: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 12v5c0 1.4 10 1.4 10 0v-5"/>',
  observatory: '<path d="M4 20h16"/><path d="M6 20l4-8h4l4 8"/><circle cx="12" cy="8" r="3.4"/><path d="M14.5 5.5l4-2.6"/>',
  television_tower: '<path d="M12 21V7"/><path d="M8 21l4-12 4 12"/><path d="M7 7h10"/><circle cx="12" cy="4.6" r="1.6"/>',
  darktower: '<path d="M6 21l3-14 3 8 3-11 3 17"/><path d="M4 21h16"/>',
  ruins: '<path d="M5 21V9l3-3 3 3v4l3-5 3 5v8"/><path d="M3 21h18"/>',
  shaft: '<rect x="10" y="5" width="4" height="16"/><path d="M10 5l2-2.4 2 2.4"/><path d="M6 21h12"/><path d="M12 9v0.01M12 13v0.01"/>',
  mall: '<rect x="4" y="7" width="16" height="14"/><path d="M4 12h16M9 12v9M15 12v9"/>',
  school: '<rect x="4" y="9" width="16" height="12"/><path d="M2 9l10-6 10 6"/><path d="M12 13v4"/>',
};

function buildingEntry(p) {
  const label = p.memorial
    ? p.memorial.facility
    : (p.tier === 'ARCH' ? `${townById.get(`island-${p.year ?? 0}`).name}纪念名录` : p.tier === 'TOWER' ? '千作总目塔' : '起源村·界碑');
  const rotation = p.rotY === undefined ? '' : `, rotY: ${round2(p.rotY)}`;
  return `  defineBuilding({ id: ${jstr(p.key)}, num: ${jstr(numOf(p))}, label: ${jstr(label)}, x: ${round2(p.x)}, z: ${round2(p.z)}, shape: ${jstr(p.shape)}, icon: iconFor(${jstr(p.shape)})${rotation} }),`;
}
function numOf(p) {
  if (p.memorial) return `${String(p.year).slice(2)}${String(p.townRank).padStart(2, '0')}`;
  if (p.tier === 'ARCH') return `${String(p.year).slice(2)}98`;
  if (p.tier === 'TOWER') return '1988';
  return '1989';
}

const allPlaced = [];
for (const town of YEAR_TOWNS) allPlaced.push(...placements[town.year].map((p) => ({ ...p, year: town.year, townId: town.id })));

const genBuildingsTs = `${GEN_HEADER}// 115 座年份镇纪念设施配置（106 座设施 + 7 座纪念名录 + 千作总目塔 + 起源村界碑）。
// 静态导入（建筑随世界启动渲染）。作品原文/评论/热度等社区数据不进入年份群岛，
// 设施名与纪念导语来自手写目录 \`yearTownMemorials.ts\`（设计 §7.1 修订）。
import { defineBuilding } from '../buildings/_types';
import type { BuildingConfig } from '../buildings/_types';
import type { YearTownBuildingExtras } from './_types';
import { iconSvg } from '../buildings/_types';

const ICON_GLYPHS: Record<string, string> = ${jstr(ICON_GLYPHS)};
// noUncheckedIndexedAccess：Record 两侧索引访问均 string|undefined，iconSvg 只收
// string（TS2345）——兜底改为 pavilion 字面量常量，不再二次索引。
const PAVILION_ICON: string = ${jstr(ICON_GLYPHS.pavilion)};
const iconFor = (shape: string): string => iconSvg(ICON_GLYPHS[shape] ?? PAVILION_ICON);

export const YEAR_TOWN_BUILDING_CONFIGS: readonly BuildingConfig[] = [
${allPlaced.map(buildingEntry).join('\n')}
];

export const YEAR_TOWN_BUILDING_EXTRAS: Readonly<Record<string, YearTownBuildingExtras>> = {
${allPlaced.map((p) => {
    const kind = p.memorial ? 'work' : p.tier === 'ARCH' ? 'archive' : p.tier === 'TOWER' ? 'tower' : 'stele';
    const extras = { kind, townId: p.townId, year: p.year };
    if (p.memorial) extras.memorialKey = p.key;
    return `  ${jstr(p.key)}: ${jstr(extras)},`;
  }).join('\n')}
};
`;

// 纪念名录索引：各镇立起的设施（设施名 + 设施族 + 导语），不再含作品原文/评论。
const memorialIndex = allPlaced
  .filter((p) => p.memorial)
  .map((p) => ({
    key: p.key,
    townId: p.townId,
    year: p.year,
    townRank: p.townRank,
    facility: p.memorial.facility,
    family: p.memorial.family,
    note: p.memorial.note,
  }));

const genIndexTs = `${GEN_HEADER}// 106 条纪念设施索引（纪念名录 / 千作总目塔共用）。
// 仅含设施名、设施族与纪念导语；不含作品原文、评论与热度统计。
import type { MemorialIndexModule, MemorialIndexEntry } from './_types';

const data: MemorialIndexModule = { memorials: ${jstr(memorialIndex)} };
export default data;
export const YEAR_TOWN_MEMORIAL_INDEX: readonly MemorialIndexEntry[] = data.memorials;
`;

const yearTownCatalogTs = `${GEN_HEADER}// Mirrors apps/web/src/city/data/year-towns (T5) for the admin world-config map.
// Regenerate with \`node scripts/generate_town_buildings.mjs\` after editing source data.
// 治理口径（设计 §10）：年份镇建筑不入治理账本（无 personalPlots/Areas），
// 本镜像仅作 admin 世界图展示；已筹资项目 ID 不受影响（新增目录项零迁移）。

export type YearTownCatalogEntry = {
  id: string;
  label: string;
  num: string;
  x: number;
  z: number;
  townId: string;
  storyLocked: boolean;
};

export const YEAR_TOWN_CATALOG: readonly YearTownCatalogEntry[] = Object.freeze(
${jstr(allPlaced.map((p) => ({
    id: p.key,
    label: p.memorial ? p.memorial.facility : (p.tier === 'ARCH' ? `${townById.get(p.townId).name}纪念名录` : p.tier === 'TOWER' ? '千作总目塔' : '起源村·界碑'),
    num: numOf(p),
    x: round2(p.x), z: round2(p.z),
    townId: p.townId,
    storyLocked: false,
  })), null, 0).replace(/"(?<key>[a-zA-Z_]+)":/g, '$<key>:')}
);
`;

// ── 8. 报告 ────────────────────────────────────────────────────────────
const memorialPlaced = allPlaced.filter((p) => p.memorial);
const familyCounts = {};
for (const p of memorialPlaced) familyCounts[p.family] = (familyCounts[p.family] ?? 0) + 1;

const report = {
  generator: 'scripts/generate_town_buildings.mjs',
  node: `node${process.versions.node.split('.')[0]}`,
  dataBaseline: { mode: hasDataSource ? 'full-data' : 'offline-rebuild' },
  towns: YEAR_TOWNS.map((town) => ({
    year: town.year,
    town: town.label,
    facilities: TOP_N[town.year],
    hasArchive: town.year !== 2019,
    placementScale: town.year === 2019 ? 1 : placementsScaleCache[town.year],
  })),
  totals: {
    buildings: allPlaced.length,
    facilities: memorialPlaced.length,
    archives: allPlaced.filter((p) => p.tier === 'ARCH').length,
    landmarks: allPlaced.filter((p) => p.tier === 'TOWER' || p.tier === 'STELE').length,
    families: familyCounts,
    generatedFiles: 3 + 3, // buildings + index（loaders 已移除）+ catalog + report json/md
  },
};

// ── 8b. 内置断言（纪念设施红线）──────────────────────────────────────────
if (memorialPlaced.length !== 106) fail(`纪念设施数 ${memorialPlaced.length} ≠ 106`);
if (allPlaced.filter((p) => p.tier === 'ARCH').length !== 7) fail('纪念名录数 ≠ 7');
if (allPlaced.filter((p) => p.tier === 'TOWER').length !== 1 || allPlaced.filter((p) => p.tier === 'STELE').length !== 1) fail('总目塔/界碑缺失');
if (allPlaced.length !== 115) fail(`总结构 ${allPlaced.length} ≠ 115`);
const buildingIds = new Set(allPlaced.map((p) => p.key));
if (buildingIds.size !== 115) fail('建筑 ID 重复');
const nums = allPlaced.map((p) => numOf(p));
if (new Set(nums).size !== 115) fail('建筑 num 重复');
for (const p of memorialPlaced) {
  if (!p.memorial.facility) fail(`设施 ${p.key} 缺设施名`);
  if (!p.memorial.note) fail(`设施 ${p.key} 缺纪念导语`);
  if (!FAMILY_SHAPES[p.memorial.family]) fail(`设施 ${p.key} 设施族未知`);
}
// 设施名不得直接复述作品标题（纪念设施必须经过改写）。
for (const p of memorialPlaced) {
  const work = works.find((w) => w.id === p.workId);
  if (!work) continue;
  const subject = String(work.subjectRaw ?? '').replace(/[《》「」〃"'（）()\s]/g, '');
  const facility = p.memorial.facility.replace(/[·・\s]/g, '');
  if (subject.length >= 3 && facility === subject) fail(`设施 ${p.key} 直接复述作品标题：${facility}`);
}

// ── 9. 报告 Markdown ───────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString('en-US');
const reportMd = `# 年份群岛纪念设施生成报告

> 生成器：\`scripts/generate_town_buildings.mjs\`（幂等，只覆盖明确产物，--check 逐字节复核）
> 数据基线：${hasDataSource ? 'blackhole_top1000.json + blackhole_details.json（仅用于确定年份与镇内排序）' : '离线重建（无数据源；结构取自既有 gen-buildings.ts）'}
> 设计口径：设计 §7.1 修订——作品抽象为城市纪念设施，**作品原文/评论/热度/浏览量不进入年份群岛**。
> 设施名与纪念导语来自手写目录 \`apps/web/src/city/data/year-towns/yearTownMemorials.ts\`。
> 治理口径：年份群岛建筑不入治理账本（无 personalPlots/Areas，设计 §10）——服务端镜像仅作 admin 世界图登记。

## 各镇产出

| 镇 | 纪念设施 | 纪念名录 | 布局缩放 |
|---|---|---|---|
${report.towns.map((t) => `| ${t.town} | ${t.facilities} | ${t.hasArchive ? '1' : '—'} | ${t.placementScale} |`).join('\n')}

## 总量对账

| 项 | 数值 |
|---|---|
| 纪念设施（作品抽象） | ${report.totals.facilities}/106 |
| 镇纪念名录 | ${report.totals.archives}/7（起源村除外） |
| 千作总目塔 + 起源村界碑 | ${report.totals.landmarks}/2 |
| 总结构 | ${report.totals.buildings}/115 |
| 生成模块文件数 | ${report.totals.generatedFiles} |

## 设施族分布

| 设施族 | 座数 |
|---|---|
${Object.entries(familyCounts).sort((a, b) => b[1] - a[1]).map(([f, n]) => `| ${f} | ${n} |`).join('\n')}

## 布局语法（设计 §7.1 修订）

1. 海岸与地形先行：显式海岸线形成海湾、岬角和离岸小屿，山脊与城区阶地分开。
2. 街网先行：车站、主街、横街、巷道、站前广场和码头先定稿。
3. 逐栋手写：每座设施在纪念目录中登记世界坐标、地块尺寸和临街朝向。
4. 围合街廓：建筑沿街廓边缘形成街墙，街廓中心保留院落。
5. 交通避让：环线沿城区外围绕行，建筑、站房、道路和广场保持结构净距。

## 数据对齐说明（治理红线）

- \`buildings/_registry.ts\` 未改动：年份群岛建筑不逐座进主城注册表，
  合流点在 \`yearTownBuildings.ts\` → cityWorldAssembly 装配（与 BUILDING_DEFS 同一 buildingSceneController 管道）。
- 服务端 \`buildingCatalog.ts\` 未改动；独立镜像 \`yearTownCatalog.ts\`（115 条，storyLocked 全 false），
  已筹资项目 ID 零变更（AGENTS 治理红线）。
- \`gen-buildings.ts\` 与 \`gen-index.ts\` 是运行时静态数据，随仓库提交；生成器只覆盖明确产物。
`;


// ── 10. 输出与校验（--check 与磁盘逐字节比对）──────────────────────────
const outputs = new Map();
outputs.set(join(TOWNS_DIR, 'gen-buildings.ts'), genBuildingsTs);
outputs.set(join(TOWNS_DIR, 'gen-index.ts'), genIndexTs);
outputs.set(join(SERVER_DATA_DIR, 'yearTownCatalog.ts'), yearTownCatalogTs);
outputs.set(join(DOCS_DIR, 'year-towns-gen-report.json'), `${JSON.stringify(report, null, 2)}\n`);
outputs.set(join(DOCS_DIR, 'year-towns-gen-report.md'), reportMd);

if (CHECK_ONLY) {
  let mismatched = 0;
  for (const [path, text] of outputs) {
    if (!existsSync(path)) { log(`MISSING ${path}`); mismatched += 1; continue; }
    if (readFileSync(path, 'utf8') !== text) { log(`STALE   ${path}`); mismatched += 1; }
  }
  if (mismatched > 0) { log(`check 失败：${mismatched} 个产物与磁盘不一致（重跑 node scripts/generate_town_buildings.mjs）`); process.exit(1); }
  log(`check 通过：${outputs.size} 个生成产物与磁盘逐字节一致。`);
} else {
  mkdirSync(TOWNS_DIR, { recursive: true });
  mkdirSync(SERVER_DATA_DIR, { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });
  for (const [path, text] of outputs) writeFileSync(path, text);
  log(`生成完成：${outputs.size} 个文件（纪念设施 ${memorialPlaced.length} 座、总结构 ${allPlaced.length} 座）。`);
  log('  幂等性：node scripts/generate_town_buildings.mjs --check 可逐字节复核（两次运行产出一致）。');
}

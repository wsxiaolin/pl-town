#!/usr/bin/env node
// 年份镇作品建筑生成器（T5，设计 docs/year-towns-design.md §7/§8）。
//
// 用法：/home/z/node22/bin/node scripts/generate_town_buildings.mjs [--data-dir=DIR] [--check]
//   --data-dir  数据目录（默认仓库同级 ../data：blackhole_top1000.json + blackhole_details.json）
//   --check     只读校验：重算全部产物并与磁盘逐字节比对（CI/门禁用），不写文件
//
// 产物（先清后生成，幂等：两次运行逐字节一致，无时间戳）：
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

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOWNS_DIR = join(REPO_ROOT, 'apps/web/src/city/data/year-towns');
const SERVER_DATA_DIR = join(REPO_ROOT, 'apps/server/src/data');
const DOCS_DIR = join(REPO_ROOT, 'docs');
const GITIGNORE = join(REPO_ROOT, '.gitignore');
const NODE = process.execPath; // 必须用 /home/z/node22/bin/node 运行（README 教训 #12）

// ── 设计常量（docs/year-towns-design.md）──────────────────────────────────
const TOP_N = { 2019: 2, 2020: 10, 2021: 16, 2022: 20, 2023: 18, 2024: 16, 2025: 12, 2026: 12 };
const YEAR_COUNTS = { 2019: 2, 2020: 75, 2021: 147, 2022: 217, 2023: 202, 2024: 170, 2025: 128, 2026: 59 };
/** 各镇 shape 池（设计 §4 材质/shape 倾向 → 映射到既有程序化 builder）。 */
const TOWN_SHAPES = {
  2019: ['pavilion', 'shaft', 'ruins'],
  2020: ['clocktower', 'campus', 'kiosk', 'school'],
  2021: ['market', 'school', 'greenhouse', 'mall'],
  2022: ['tower', 'skyscraper', 'bank', 'mall'],
  2023: ['temple', 'qipai', 'tavern', 'market'],
  2024: ['greenhouse', 'library', 'academy', 'bank'],
  2025: ['bank', 'tower', 'campus', 'school'],
  2026: ['observatory', 'television_tower', 'skyscraper', 'darktower'],
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
  // esbuild 打包 towns.ts + transit.ts + sanitizeCommunityText.ts —— 生成器与
  // 运行时共用同一实现（设计 §7.3「生成期烘焙 + 运行时同源」红线）。
  const result = await build({
    stdin: {
      contents: "export * from './sanitizeCommunityText'; export { YEAR_TOWNS } from './towns'; export { TRANSIT_STATIONS } from './transit';",
      loader: 'ts',
      resolveDir: TOWNS_DIR,
    },
    bundle: true, format: 'esm', platform: 'node', write: false, minify: true,
  });
  const temp = join(mkdtempSync(join(tmpdir(), 'yt-gen-')), 'bundle.mjs');
  writeFileSync(temp, result.outputFiles[0].text);
  return import(pathToFileURL(temp).href);
}

const top1000 = readJson(join(DATA_DIR, 'blackhole_top1000.json'));
const details = readJson(join(DATA_DIR, 'blackhole_details.json'));
const townModules = await bundleTownModules();
const { sanitizeCommunityText, labelSafeText, sanitizeAuthorNickname, abstractOf, truncateByCodePoints, YEAR_TOWNS, TRANSIT_STATIONS } = townModules;

// ── 2. 数据对账与合并 ─────────────────────────────────────────────────────
const topWorks = top1000.works ?? [];
const detailWorks = details.works ?? [];
if (topWorks.length !== 1000 || detailWorks.length !== 1000) fail(`条数非 1000：top=${topWorks.length} details=${detailWorks.length}`);
const detailById = new Map(detailWorks.map((w) => [w.id, w]));
const topIds = new Set(topWorks.map((w) => w.id));
for (const w of detailWorks) if (!topIds.has(w.id)) fail(`details 多出未知作品 ${w.id}`);
for (const id of topIds) if (!detailById.has(id)) fail(`details 缺作品 ${id}`);
if (new Set(detailWorks.map((w) => w.id)).size !== 1000) fail('details 存在重复 ID');

const works = topWorks.map((w) => {
  const d = detailById.get(w.id);
  const year = Number(String(d.meta?.createdAt ?? w.createdAt ?? '').slice(0, 4));
  if (!Number.isFinite(year) || year < 2019 || year > 2026) fail(`作品 ${w.id} 年份异常: ${year}`);
  return {
    id: w.id,
    rank: d.rank,
    subjectRaw: w.subject,
    authorRaw: w.author?.nickname ?? '',
    bodyRaw: d.body ?? '',
    comments: d.comments ?? [],
    totalComments: d.totalComments ?? 0,
    commentsTruncated: d.commentsTruncated === true,
    locked: w.id === LOCKED_WORK_ID,
    model: d.model,
    meta: d.meta ?? {},
    year,
  };
});

const byYear = {};
for (const w of works) byYear[w.year] = (byYear[w.year] ?? 0) + 1;
for (const [year, count] of Object.entries(YEAR_COUNTS)) {
  if (byYear[year] !== count) fail(`${year} 年条数 ${byYear[year]} ≠ 设计表 ${count}`);
}
const townById = new Map(YEAR_TOWNS.map((t) => [t.id, t]));

// ── 3. 镇内排序（热度降、id 升）与镇内名次 ───────────────────────────────
const townWorks = {};
for (const town of YEAR_TOWNS) {
  const list = works.filter((w) => w.year === town.year)
    .sort((a, b) => (b.meta.popularity ?? 0) - (a.meta.popularity ?? 0) || (a.id < b.id ? -1 : 1));
  list.forEach((w, i) => { w.townRank = i + 1; });
  townWorks[town.year] = list;
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
  // items: [{ key, tier, size }] —— 顺序即优先级（XL 定轴端，L/arch 优先大街，M/S 街+环）。
  const cx = town.x, cz = town.z;
  const rBuild = round2(town.plateauR - 3.5);
  const station = TRANSIT_STATIONS.find((s) => s.id === `station-${town.year}`);
  const ux = cx - station.platformX, uz = cz - station.platformZ;
  const norm = Math.hypot(ux, uz) || 1;
  const uxN = ux / norm, uzN = uz / norm;          // 进镇方向（站台 → 镇心）
  const pxN = -uzN, pzN = uxN;                     // 垂直向（大街两侧）
  const cornerLimit = round2(town.plateauR - (town.year === 2019 ? 2.2 : 0.9)); // plot 不越台面缘（设计 §9.4：≤ r_top−0.5 再留 0.4）
  const centerLimit = rBuild;                                                       // 建筑中心 ≤ r_top−3.5（设计 §7.1，轨道梁净空）
  const pads = stationPads;

  let scale = Math.min(1, Math.sqrt((Math.PI * rBuild * rBuild * 0.4) / items.reduce((a, i) => a + i.size * i.size, 0)));
  scale = Math.max(0.45, scale);
  const streetAxisPhi = Math.atan2(uzN, uxN);
  // θ 与大街轴（含反方向）的角距，∈[0, π]。
  const axisDistance = (th) => {
    let d = Math.abs(th - streetAxisPhi) % Math.PI;
    if (d > Math.PI / 2) d = Math.PI - d;
    return d;
  };
  let lastFailed = '';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const placed = [];
    const placedRects = [];
    const place = (item, x, z, size) => {
      placed.push({ ...item, x: round2(x), z: round2(z), plot: round2(size) });
      placedRects.push(rectOf(x, z, size));
    };
    // XL 置轴线终点（对景地标，设计 §7.1）。
    const xl = items.find((i) => i.tier === 'XL');
    if (xl) {
      const xlSize = round2(xl.size * scale);
      const xlS = rBuild - xlSize / 2 - 0.35;
      place(xl, cx + uxN * xlS, cz + uzN * xlS, xlSize);
    }
    // 大街两侧候选（远端 → 近门端；侧向 = 街半宽 + 地块半宽 + 路缘余量）。
    const rest = items.filter((i) => i.tier !== 'XL');
    let allOk = true;
    for (const item of rest) {
      const size = round2(item.size * scale);
      const lat = 2.3 + size / 2;
      const sStep = Math.max(2.2, size + 1.1); // 沿街候选密度：碰撞检查把关实际间距
      const sMax = rBuild - 2.2 - size / 2 - 0.4;
      const sMin = -(rBuild - 2.0) + size / 2 + 0.4;
      let done = false;
      // 大街候选顺序：本侧优先（side ±1 交替的街景节奏），本侧放不下再试对侧
      // （过密镇如 2020·11 项收敛修复：仅单侧街 + 粗候选粒度会差 0.02–0.3u 溢出）。
      for (const sideSign of [item.side, -item.side]) {
        if (done) break;
        const side = sideSign * lat;
        for (let s = sMax; s >= sMin && !done; s -= sStep) {
          const x = cx + uxN * s + pxN * side;
          const z = cz + uzN * s + pzN * side;
          if (Math.hypot(x - cx, z - cz) > centerLimit) continue;
          const rect = rectOf(x, z, size);
          if (!rectWithinCircle(rect, cx, cz, cornerLimit)) continue;
          if (!rectClearsPads(rect, pads)) continue;
          if (!placedRects.every((r) => rectsSeparated(rect, r, RECT_GAP))) continue;
          place(item, x, z, size);
          done = true;
        }
      }
      if (!done) {
        // 环巷候选（4 圈环带，外→内）：远离大街轴优先（角距大者优先）。
        const bands = [rBuild - 0.7, rBuild - 2.3, rBuild - 3.9, rBuild - 5.5]
          .map((band) => band - size / 2)
          .filter((r) => r > size / 2 + 0.6 && r <= centerLimit);
        for (const rRing of bands) {
          if (done) break;
          const step = Math.max(0.36, 2.0 / rRing);
          const angles = [];
          for (let th = 0; th < Math.PI * 2 - 1e-9; th += step) angles.push(th);
          angles.sort((a, b) => axisDistance(b) - axisDistance(a));
          for (const th of angles) {
            if (axisDistance(th) < 0.3) continue; // 大街走廊让位
            const dx = Math.cos(th) * rRing, dz = Math.sin(th) * rRing;
            if (Math.hypot(dx, dz) > centerLimit) continue;
            const rect = rectOf(cx + dx, cz + dz, size);
            if (!rectWithinCircle(rect, cx, cz, cornerLimit)) continue;
            if (!rectClearsPads(rect, pads)) continue;
            if (!placedRects.every((r) => rectsSeparated(rect, r, RECT_GAP))) continue;
            place(item, cx + dx, cz + dz, size);
            done = true;
            break;
          }
        }
      }
      if (!done) { allOk = false; lastFailed = item.key; break; }
    }
    if (allOk) return { placed, scale: round2(scale * 100) / 100 };
    scale = Math.max(0.45, scale * 0.9);
    if (attempt === 9) fail(`${town.label} 布局未收敛（最后失败项 ${lastFailed}，scale=${scale.toFixed(2)}）`);
  }
  fail(`${town.label} 布局未收敛（10 次缩放重试后仍有建筑无法落位）`);
}

// 组装各镇建筑条目（works / archive / tower / stele）。
const townStructures = {};
for (const town of YEAR_TOWNS) {
  const topN = TOP_N[town.year];
  const list = townWorks[town.year];
  const structures = [];
  const tierOf = (townRank) => (townRank === 1 ? 'XL' : townRank <= 3 ? 'L' : townRank <= 10 ? 'M' : 'S');
  list.slice(0, topN).forEach((w, i) => {
    structures.push({
      key: `yt-w${town.year}-${String(i + 1).padStart(2, '0')}`,
      tier: tierOf(i + 1), size: PLOT_BASE[tierOf(i + 1)], side: i % 2 === 0 ? 1 : -1,
      shape: i === 0 ? TOWN_SHAPES[town.year][0] : TOWN_SHAPES[town.year][(i + 1) % TOWN_SHAPES[town.year].length],
      work: w, townRank: i + 1,
    });
  });
  if (town.year !== 2019) {
    structures.splice(3, 0, { key: `yt-arch-${town.year}`, tier: 'ARCH', size: PLOT_BASE.ARCH, side: -1, shape: 'library' });
  } else {
    structures.push({ key: 'yt-tower', tier: 'TOWER', size: PLOT_BASE.TOWER, shape: 'pavilion' });
    structures.push({ key: 'yt-stele-2019', tier: 'STELE', size: PLOT_BASE.STELE, shape: 'shaft' });
  }
  townStructures[town.year] = structures;
}

// 布局执行（2019 手工定稿解，其余走通用算法）。
const placements = {};
const placementsScaleCache = {};
for (const town of YEAR_TOWNS) {
  if (town.year === 2019) {
    placementsScaleCache[2019] = 1;
    const L = ORIGIN_VILLAGE_LAYOUT;
    const map = {
      'yt-w2019-01': { ...L.rank1, plot: 3.6 },
      'yt-w2019-02': { ...L.rank2, plot: 2.8 },
      'yt-tower': { ...L.tower, plot: 3.0 },
      'yt-stele-2019': { ...L.stele, plot: 1.8 },
    };
    const placed = townStructures[2019].map((item) => ({ ...item, ...map[item.key] }));
    // 手工解同样过校验（不通过即 fail，防数据漂移）。
    const rects = placed.map((p) => rectOf(p.x, p.z, p.plot));
    rects.forEach((r, i) => {
      if (!rectWithinCircle(r, town.x, town.z, town.plateauR - 2.2)) fail(`2019 ${placed[i].key} 越角点界`);
      if (!rectClearsPads(r, stationPads)) fail(`2019 ${placed[i].key} 与站台泊位冲突`);
      rects.forEach((o, j) => { if (i < j && !rectsSeparated(r, o, RECT_GAP)) fail(`2019 ${placed[i].key} 与 ${placed[j].key} 间距不足`); });
    });
    placements[2019] = placed;
  } else {
    const result = layoutTown(town, townStructures[town.year]);
    placementsScaleCache[town.year] = result.scale;
    placements[town.year] = result.placed;
  }
}

// ── 5. P 级铭牌数据（全部 1000 条）──────────────────────────────────────
function nameplateOf(w) {
  const sanitizedComments = w.comments
    .map((c) => ({ nickname: sanitizeAuthorNickname(c.nickname ?? ''), content: sanitizeCommunityText(c.content ?? ''), time: c.createdAt, verification: c.verification }))
    .filter((c) => c.content.trim().length > 0);
  return {
    id: w.id,
    rank: w.rank,
    year: w.year,
    townRank: w.townRank,
    subject: labelSafeText(w.subjectRaw, SUBJECT_MAX),
    label: labelSafeText(w.subjectRaw, LABEL_MAX),
    author: sanitizeAuthorNickname(w.authorRaw),
    popularity: w.meta.popularity ?? 0,
    visits: w.meta.visits ?? 0,
    stars: w.meta.stars ?? 0,
    tags: (w.meta.tags ?? []).slice(0, TAGS_MAX).map((t) => labelSafeText(String(t), 12)).filter(Boolean),
    abstract: abstractOf(w.bodyRaw, ABSTRACT_MAX),
    totalComments: w.totalComments,
    sampledComments: sanitizedComments.length,
    commentsTruncated: w.commentsTruncated,
    commentsLocked: w.locked,
    hasModel: w.model?.present === true,
  };
}
const nameplates = works
  .slice().sort((a, b) => a.year - b.year || a.townRank - b.townRank)
  .map(nameplateOf);
const nameplateById = new Map(nameplates.map((n) => [n.id, n]));

// ── 6. D 级详情 + F 级评论包 + 超长正文包 ────────────────────────────────
function commentOf(c) {
  const content = sanitizeCommunityText(c.content ?? '');
  const out = { nickname: sanitizeAuthorNickname(c.nickname ?? '') };
  if (c.createdAt) out.time = String(c.createdAt);
  const truncated = codePoints(content).length > COMMENT_MAX;
  out.content = truncated ? truncateByCodePoints(content, COMMENT_MAX) : content;
  if (c.verification) out.verification = String(c.verification);
  return out;
}
const detailByTown = {};   // year -> [{ id, body, bodyExternal, comments, pack?, locked? }]
const bodyPacks = {};      // year -> { workId: fullBody }
const commentPacks = {};   // year -> [ { key, works: [{id, comments}] } ]
let blankFiltered = 0, longCommentTruncated = 0, bodyExternalCount = 0;
for (const town of YEAR_TOWNS) {
  const dRecords = [];
  const bodies = {};
  const packs = [];
  let packWorks = [];
  let packBytes = 0;
  let packIndex = 1;
  for (const w of townWorks[town.year]) {
    const body = sanitizeCommunityText(w.bodyRaw);
    const bodyLong = codePoints(body).length > BODY_INLINE_LIMIT;
    if (bodyLong) { bodies[w.id] = body; bodyExternalCount += 1; }
    const filtered = w.comments.filter((c) => sanitizeCommunityText(c.content ?? '').trim().length > 0);
    blankFiltered += w.comments.length - filtered.length;
    const comments = filtered.map(commentOf);
    longCommentTruncated += comments.filter((c) => c.content.endsWith('…')).length;
    const record = {
      id: w.id,
      body: bodyLong ? truncateByCodePoints(body, BODY_EXCERPT) : body,
      bodyExternal: bodyLong,
      comments: comments.slice(0, COMMENT_INLINE),
    };
    if (w.locked) { record.locked = true; record.comments = []; }
    if (comments.length > COMMENT_INLINE && !w.locked) {
      record.pack = `${town.year}-${packIndex}`;
      const entry = { id: w.id, comments };
      const entryBytes = jstr(entry).length;
      if (packBytes > 0 && packBytes + entryBytes > PACK_BYTES) {
        packs.push({ key: `${town.year}-${packIndex}`, works: packWorks });
        packIndex += 1; packWorks = []; packBytes = 0;
        record.pack = `${town.year}-${packIndex}`;
      }
      packWorks.push(entry); packBytes += entryBytes;
    }
    dRecords.push(record);
  }
  if (packWorks.length > 0) packs.push({ key: `${town.year}-${packIndex}`, works: packWorks });
  detailByTown[town.year] = dRecords;
  if (Object.keys(bodies).length > 0) bodyPacks[town.year] = bodies;
  commentPacks[town.year] = packs;
}

// ── 7. 生成模块文本（确定性，无时间戳）─────────────────────────────────
const GEN_HEADER = '// GENERATED FILE — do not edit by hand.\n' +
  '// 由 scripts/generate_town_buildings.mjs 产出（幂等；重跑前会清理旧 gen-* 文件）。\n' +
  '// 数据源：../data/blackhole_top1000.json + blackhole_details.json（T4.5 质检收口口径）。\n';

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
  const label = p.work
    ? labelSafeText(p.work.subjectRaw, LABEL_MAX)
    : (p.tier === 'ARCH' ? `${townById.get(`island-${p.year ?? 0}`).name}档案馆` : p.tier === 'TOWER' ? '千作总目塔' : '起源村·界碑');
  return `  defineBuilding({ id: ${jstr(p.key)}, num: ${jstr(numOf(p))}, label: ${jstr(label)}, x: ${round2(p.x)}, z: ${round2(p.z)}, shape: ${jstr(p.shape)}, icon: iconFor(${jstr(p.shape)}) }),`;
}
function numOf(p) {
  if (p.work) return `${String(p.year).slice(2)}${String(p.townRank).padStart(2, '0')}`;
  if (p.tier === 'ARCH') return `${String(p.year).slice(2)}98`;
  if (p.tier === 'TOWER') return '1988';
  return '1989';
}

const allPlaced = [];
for (const town of YEAR_TOWNS) allPlaced.push(...placements[town.year].map((p) => ({ ...p, year: town.year, townId: town.id })));

const genBuildingsTs = `${GEN_HEADER}// 115 座年份镇建筑配置（106 作品 + 7 档案馆 + 千作总目塔 + 起源村界碑）。
// 静态导入（建筑随世界启动渲染；铭牌数据随配置常驻，设计 §7.2 P 级）。
import { defineBuilding } from '../buildings/_types';
import type { BuildingConfig } from '../buildings/_types';
import type { YearTownBuildingExtras, YearWorkNameplate } from './_types';
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
    const kind = p.work ? 'work' : p.tier === 'ARCH' ? 'archive' : p.tier === 'TOWER' ? 'tower' : 'stele';
    const extras = { kind, townId: p.townId, year: p.year };
    if (p.work) { extras.workId = p.work.id; extras.townRank = p.townRank; }
    return `  ${jstr(p.key)}: ${jstr(extras)},`;
  }).join('\n')}
};

/** 106 座作品建筑的铭牌数据（点击即开，不依赖懒加载模块）。 */
export const YEAR_TOWN_NAMEPLATES: Readonly<Record<string, YearWorkNameplate>> = {
${allPlaced.filter((p) => p.work).map((p) => `  ${jstr(p.key)}: ${jstr(nameplateById.get(p.work.id))},`).join('\n')}
};

/** 档案馆/总目塔/界碑的一句话导览（铭牌卡渲染）。 */
export const YEAR_TOWN_LANDMARK_BLURBS: Readonly<Record<string, string>> = {
${allPlaced.filter((p) => !p.work).map((p) => {
    const town = townById.get(p.townId);
    const text = p.tier === 'ARCH'
      ? `${town.label} · ${townWorks[p.year].length - TOP_N[p.year]} 条馆藏，可按热度检索。`
      : p.tier === 'TOWER'
        ? `${town.tagline} 收录黑洞区历史热门 Top1000 总目，可全局检索。`
        : '社区的起点——2019 年，黑洞区只有两块基石。';
    return `  ${jstr(p.key)}: ${jstr(text)},`;
  }).join('\n')}
};
`;

const genIndexTs = `${GEN_HEADER}// 1000 条 P 级铭牌索引（档案馆列表 / 总目塔检索共用；懒加载，≤350KB 预算）。
import type { YearIndexModule, YearWorkNameplate } from './_types';

const data: YearIndexModule = { works: ${jstr(nameplates)} };
export default data;
export const YEAR_TOWN_INDEX: readonly YearWorkNameplate[] = data.works;
`;

function dModule(year, partWorks) {
  return `${GEN_HEADER}// D 级详情（${year} 镇分片；正文 + 评论精选前 ${COMMENT_INLINE} 条；懒加载）。
import type { YearTownDetailModule } from './_types';

const data: YearTownDetailModule = { year: ${year}, works: ${jstr(partWorks)} };
export default data;
`;
}
function bodyPackModule(year, bodies) {
  return `${GEN_HEADER}// 超长正文包（${year} 镇；>${BODY_INLINE_LIMIT} 字外置全文，「展开全文」懒加载）。
import type { YearTownBodyPack } from './_types';

const data: YearTownBodyPack = { bodies: ${jstr(bodies)} };
export default data;
`;
}
function commentPackModule(pack) {
  return `${GEN_HEADER}// F 级全部评论包 ${pack.key}（≤${PACK_BYTES}B/包；「载入全部评论」懒加载）。
import type { YearTownCommentPackModule } from './_types';

const data: YearTownCommentPackModule = { works: ${jstr(pack.works)} };
export default data;
`;
}

// D 级分片（>PACK_BYTES 拆 -a/-b/…）。
const dFiles = {}; // filename -> text
for (const town of YEAR_TOWNS) {
  const records = detailByTown[town.year];
  if (jstr(records).length <= PACK_BYTES) {
    dFiles[`gen-t${town.year}.ts`] = dModule(town.year, records);
  } else {
    const parts = [];
    let current = [], currentBytes = 0;
    for (const record of records) {
      const bytes = jstr(record).length;
      if (currentBytes > 0 && currentBytes + bytes > PACK_BYTES) { parts.push(current); current = []; currentBytes = 0; }
      current.push(record); currentBytes += bytes;
    }
    if (current.length) parts.push(current);
    parts.forEach((part, i) => {
      dFiles[`gen-t${town.year}-${String.fromCharCode(97 + i)}.ts`] = dModule(town.year, part);
    });
  }
}

const townLoaderEntries = YEAR_TOWNS.map((town) => {
  const files = Object.keys(dFiles).filter((f) => f.startsWith(`gen-t${town.year}-`) || f === `gen-t${town.year}.ts`).sort();
  const fileOf = (f) => `./${f.replace(/\.ts$/, '')}`;
  if (files.length === 1) return `  ${town.year}: () => import(${jstr(fileOf(files[0]))}).then((m) => m.default),`;
  const parts = files.map((f) => `import(${jstr(fileOf(f))}).then((m) => m.default.works)`).join(', ');
  return `  ${town.year}: () => Promise.all([${parts}]).then((parts) => ({ year: ${town.year}, works: parts.flat() })),`;
}).join('\n');

const bodyPackLoaderEntries = Object.entries(bodyPacks).map(([year]) =>
  `  ${year}: () => import('./gen-b${year}').then((m) => m.default),`).join('\n');

const commentPackLoaderEntries = [];
for (const town of YEAR_TOWNS) for (const pack of commentPacks[town.year]) {
  commentPackLoaderEntries.push(`  ${jstr(pack.key)}: () => import('./gen-c${pack.key}').then((m) => m.default),`);
}

const genLoadersTs = `${GEN_HEADER}// 懒加载路由表（全部 import() 路径字面量——Vite 静态分析与分片的前提）。
import type { YearTownDetailModule, YearTownBodyPack, YearTownCommentPackModule } from './_types';

/** 镇 D 级模块（分片自动合并）。 */
export const TOWN_LOADERS: Readonly<Record<number, () => Promise<YearTownDetailModule>>> = {
${townLoaderEntries}
};

/** 超长正文包（有外置作品的镇才有）。 */
export const BODY_PACK_LOADERS: Readonly<Record<number, () => Promise<YearTownBodyPack>>> = {
${bodyPackLoaderEntries || '  //（无 >8KB 正文的镇）'}
};

/** 全部评论包。 */
export const COMMENT_PACK_LOADERS: Readonly<Record<string, () => Promise<YearTownCommentPackModule>>> = {
${commentPackLoaderEntries.join('\n') || '  //（无评论包）'}
};
`;

const yearTownCatalogTs = `${GEN_HEADER}// Mirrors apps/web/src/city/data/year-towns (T5) for the admin world-config map.
// Regenerate with \`npm run gen:year-towns\` after regenerating town buildings.
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
    label: p.work ? labelSafeText(p.work.subjectRaw, LABEL_MAX) : (p.tier === 'ARCH' ? `${townById.get(p.townId).name}档案馆` : p.tier === 'TOWER' ? '千作总目塔' : '起源村·界碑'),
    num: numOf(p),
    x: round2(p.x), z: round2(p.z),
    townId: p.townId,
    storyLocked: false,
  })), null, 0).replace(/"(?<key>[a-zA-Z_]+)":/g, '$<key>:')}
);
`;

// ── 8. 报告 ────────────────────────────────────────────────────────────
const totalArchiveEntries = nameplates.length - 106;
const report = {
  generator: 'scripts/generate_town_buildings.mjs',
  node: NODE,
  dataBaseline: { fetchedAt: details.fetchedAt ?? top1000.fetchedAt ?? null, works: 1000 },
  towns: YEAR_TOWNS.map((town) => {
    const dBytes = Object.entries(dFiles).filter(([f]) => f === `gen-t${town.year}.ts` || f.startsWith(`gen-t${town.year}-`))
      .reduce((a, [, text]) => a + Buffer.byteLength(text), 0);
    return {
      year: town.year, town: town.label,
      works: townWorks[town.year].length,
      topBuildings: TOP_N[town.year],
      archiveEntries: townWorks[town.year].length - TOP_N[town.year],
      archiveBuilding: town.year !== 2019,
      placementScale: town.year === 2019 ? 1 : placementsScaleCache[town.year],
      dFiles: Object.keys(dFiles).filter((f) => f === `gen-t${town.year}.ts` || f.startsWith(`gen-t${town.year}-`)),
      dBytes,
      bodyExternal: Object.keys(bodyPacks[town.year] ?? {}).length,
      commentPacks: commentPacks[town.year].length,
    };
  }),
  totals: {
    buildings: allPlaced.length,
    workBuildings: allPlaced.filter((p) => p.work).length,
    archiveBuildings: allPlaced.filter((p) => p.tier === 'ARCH').length,
    landmarkBuildings: allPlaced.filter((p) => p.tier === 'TOWER' || p.tier === 'STELE').length,
    archiveEntries: totalArchiveEntries,
    coverage: allPlaced.filter((p) => p.work).length + totalArchiveEntries,
    nameplates: nameplates.length,
    detailRecords: Object.values(detailByTown).reduce((a, list) => a + list.length, 0),
    bodyCoverage: Object.values(detailByTown).reduce((a, list) => a + list.length, 0),
    bodyExternalCount,
    worksWithComments: nameplates.filter((n) => n.sampledComments > 0).length,
    worksCommentsLocked: nameplates.filter((n) => n.commentsLocked).length,
    blankCommentsFiltered: blankFiltered,
    longCommentTruncated,
    commentsTruncatedWorks: nameplates.filter((n) => n.commentsTruncated).length,
    commentsTruncatedAt200: nameplates.filter((n) => n.commentsTruncated && n.sampledComments === 200).length,
    commentPackWorks: Object.values(commentPacks).reduce((a, packs) => a + packs.reduce((b, p) => b + p.works.length, 0), 0),
    generatedFiles: 6 + Object.keys(dFiles).length + Object.keys(bodyPacks).length + Object.values(commentPacks).reduce((a, p) => a + p.length, 0), // buildings/index/loaders + catalog + report md/json
  },
};

// ── 8b. 内置断言（任务红线：总建筑 + 档案条目 = 1000 全覆盖）──────────────
const workBuildingCount = allPlaced.filter((p) => p.work).length;
if (workBuildingCount !== 106) fail(`作品建筑数 ${workBuildingCount} ≠ 106`);
if (allPlaced.filter((p) => p.tier === 'ARCH').length !== 7) fail('档案馆数 ≠ 7');
if (allPlaced.filter((p) => p.tier === 'TOWER').length !== 1 || allPlaced.filter((p) => p.tier === 'STELE').length !== 1) fail('总目塔/界碑缺失');
if (allPlaced.length !== 115) fail(`总结构 ${allPlaced.length} ≠ 115`);
if (nameplates.length !== 1000) fail(`P 级索引 ${nameplates.length} ≠ 1000`);
if (workBuildingCount + totalArchiveEntries !== 1000) fail(`覆盖对账失败：${workBuildingCount}+${totalArchiveEntries} ≠ 1000`);
const detailIds = new Set(Object.values(detailByTown).flat().map((r) => r.id));
if (detailIds.size !== 1000) fail(`D 级覆盖 ${detailIds.size} ≠ 1000`);
for (const w of works) if (!detailIds.has(w.id)) fail(`D 级缺 ${w.id}`);
const buildingIds = new Set(allPlaced.map((p) => p.key));
if (buildingIds.size !== 115) fail('建筑 ID 重复');
const nums = allPlaced.map((p) => numOf(p));
if (new Set(nums).size !== 115) fail('建筑 num 重复');
for (const n of nameplates) {
  if (/[<>\u0000-\u001F]/.test(n.label)) fail(`label 不 label-safe: ${n.id}`);
  if (n.commentsLocked !== (n.id === LOCKED_WORK_ID)) fail(`锁定标记口径错误: ${n.id}`);
}
const locked = nameplates.find((n) => n.id === LOCKED_WORK_ID);
if (!locked || locked.subject.includes('电学实验的问号') === false) fail('rank 344 锁定作品缺失');

// ── 9. 报告 Markdown ───────────────────────────────────────────────────
const fmt = (n) => n.toLocaleString('en-US');
const reportMd = `# 年份镇建筑生成报告（T5）

> 生成器：\`scripts/generate_town_buildings.mjs\`（幂等，先清后生成，--check 逐字节复核）
> 数据基线：blackhole_top1000.json + blackhole_details.json（fetchedAt ${details.fetchedAt ?? '-'}，1000/1000 全量）
> 布局算法：街+环确定性贪心（无随机；排序键=热度降、id 升）；2019 起源村为设计 §7.1 手工定稿解
> 治理口径：年份镇建筑不入治理账本（无 personalPlots/Areas，设计 §10）——服务端镜像
> \`apps/server/src/data/yearTownCatalog.ts\` 仅作 admin 世界图登记，**已筹资项目 ID 零改动**（新目录项零迁移）。

## 各镇产出

| 镇 | 作品数 | 主题建筑(Top N) | 档案馆藏 | 布局缩放 | D 分片 | D 体积 | 外置正文 | 评论包 |
|---|---|---|---|---|---|---|---|---|
${report.towns.map((t) => `| ${t.town} | ${t.works} | ${t.topBuildings} | ${t.archiveEntries} | ${t.placementScale} | ${t.dFiles.length} | ${fmt(t.dBytes)}B | ${t.bodyExternal} | ${t.commentPacks} |`).join('\n')}

## 总量对账

| 项 | 数值 |
|---|---|
| 主题建筑（作品） | ${report.totals.workBuildings}/106 |
| 镇档案馆 | ${report.totals.archiveBuildings}/7（各镇 1 座，起源村除外） |
| 千作总目塔 + 起源村界碑 | ${report.totals.landmarkBuildings}/2 |
| 总结构 | ${report.totals.buildings}/115 |
| **作品建筑 + 档案馆藏条目** | **${workBuildingCount} + ${totalArchiveEntries} = ${workBuildingCount + totalArchiveEntries}/1000 ✅** |
| P 级铭牌索引（gen-index） | ${report.totals.nameplates}/1000 |
| D 级详情记录（正文+评论精选） | ${report.totals.detailRecords}/1000 |
| 正文覆盖 | ${report.totals.bodyCoverage}/1000（其中 ${report.totals.bodyExternalCount} 条 >8KB 外置 gen-b 包，详情级截断 2000 字） |
| 有评论的作品 | ${report.totals.worksWithComments}/1000（rank 344 服务端 403 锁定 → 「评论区已锁定」占位） |
| 空白评论（过滤不渲染） | ${fmt(report.totals.blankCommentsFiltered)} 条 |
| 单条 >500 字评论（截断加 …） | ${report.totals.longCommentTruncated} 条 |
| commentsTruncated 作品 | ${report.totals.commentsTruncatedWorks}（其中满 200 条采样 ${report.totals.commentsTruncatedAt200}，面板标「仅展示最新 N 条 / 共 totalComments 条」） |
| F 级评论包覆盖作品 | ${report.totals.commentPackWorks}（评论 >20 条 → 懒加载全部） |
| 生成模块文件数 | ${report.totals.generatedFiles} |

## T4.5 质检 7 条落实情况

1. 巨楼标记：commentsTruncated 随 P 级数据落盘，面板渲染「仅展示最新 {sampled} 条 / 共 {totalComments} 条」。
2. Count 偏差：面板评论条数一律取 \`len(comments)\`（sampledComments 字段），断言不使用 totalComments。
3. rank 344「电学实验的问号」：D 级 locked=true + 评论置空，面板「评论区已锁定」占位；正文 682 字正常内联。
4. 社区富文本（<discussion>/<user>/<color>/<a>…）：sanitizeCommunityText 生成期统一烘焙（与运行时同源，单测覆盖）。
5. 评论平铺前缀：数据无嵌套结构，面板线性渲染。
6. 空白评论：生成期过滤（${fmt(report.totals.blankCommentsFiltered)} 条不落盘）。
7. 字符口径：全部按代码点计数（Array.from，中文 1 字符，与 Python len() 一致）。

## 数据对齐说明（治理红线）

- \`buildings/_registry.ts\` 未改动：设计 §7.1 明确年份镇建筑不逐座进主城注册表（106 import 不可维护），
  合流点在 \`yearTownBuildings.ts\` → cityWorldAssembly 装配（与 BUILDING_DEFS 同一 buildingSceneController 管道）。
- 服务端 \`buildingCatalog.ts\` 未改动；新增独立镜像 \`yearTownCatalog.ts\`（115 条，storyLocked 全 false），
  \`check:building-catalog\` 门禁已扩展同源校验。已筹资项目 ID 零变更（AGENTS 治理红线）。
- gen-* 生成物不进 git（GOAL 红线「不留生成物入 git」；.gitignore 覆盖 \`apps/web/src/city/data/year-towns/gen-*\`），
  交付（T8 send_file 全目录）不受影响；yearTownCatalog.ts 镜像与本报告为提交物。
`;

// ── 10. 输出与校验（--check 与磁盘逐字节比对）──────────────────────────
const outputs = new Map();
outputs.set(join(TOWNS_DIR, 'gen-buildings.ts'), genBuildingsTs);
outputs.set(join(TOWNS_DIR, 'gen-loaders.ts'), genLoadersTs);
outputs.set(join(TOWNS_DIR, 'gen-index.ts'), genIndexTs);
for (const [name, text] of Object.entries(dFiles)) outputs.set(join(TOWNS_DIR, name), text);
for (const [year, bodies] of Object.entries(bodyPacks)) outputs.set(join(TOWNS_DIR, `gen-b${year}.ts`), bodyPackModule(year, bodies));
for (const packs of Object.values(commentPacks)) for (const pack of packs) outputs.set(join(TOWNS_DIR, `gen-c${pack.key}.ts`), commentPackModule(pack));
outputs.set(join(SERVER_DATA_DIR, 'yearTownCatalog.ts'), yearTownCatalogTs);
outputs.set(join(DOCS_DIR, 'year-towns-gen-report.json'), `${JSON.stringify(report, null, 2)}\n`);
outputs.set(join(DOCS_DIR, 'year-towns-gen-report.md'), reportMd);

const GEN_GLOB_HINT = 'apps/web/src/city/data/year-towns/gen-*';

function cleanGeneratedFiles() {
  // 幂等：先清后生成（本目录 gen-* 全部由本脚本拥有）。
  const stale = readdirSync(TOWNS_DIR).filter((f) => f.startsWith('gen-') && f.endsWith('.ts'));
  for (const f of stale) rmSync(join(TOWNS_DIR, f));
}

function ensureGitignore() {
  const current = readFileSync(GITIGNORE, 'utf8');
  if (current.includes(GEN_GLOB_HINT)) return false;
  const appended = `${current.endsWith('\n') ? '' : '\n'}\n# 年份镇 T5 生成物（scripts/generate_town_buildings.mjs 产出；GOAL 红线：生成物不入 git）\n${GEN_GLOB_HINT}\n`;
  writeFileSync(GITIGNORE, appended);
  return true;
}

if (CHECK_ONLY) {
  let mismatched = 0;
  for (const [path, text] of outputs) {
    if (!existsSync(path)) { log(`MISSING ${path}`); mismatched += 1; continue; }
    if (readFileSync(path, 'utf8') !== text) { log(`STALE   ${path}`); mismatched += 1; }
  }
  if (!readFileSync(GITIGNORE, 'utf8').includes(GEN_GLOB_HINT)) { log(`MISSING .gitignore rule ${GEN_GLOB_HINT}`); mismatched += 1; }
  if (mismatched > 0) { log(`check 失败：${mismatched} 个产物与磁盘不一致（重跑 npm run gen:year-towns）`); process.exit(1); }
  log(`check 通过：${outputs.size} 个生成产物与磁盘逐字节一致。`);
} else {
  cleanGeneratedFiles();
  mkdirSync(TOWNS_DIR, { recursive: true });
  mkdirSync(SERVER_DATA_DIR, { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });
  for (const [path, text] of outputs) writeFileSync(path, text);
  const gitignoreUpdated = ensureGitignore();
  log(`生成完成：${outputs.size} 个文件（建筑 ${allPlaced.length}、馆藏 ${totalArchiveEntries}、覆盖 1000/1000）。`);
  log('  幂等性：npm run gen:year-towns -- --check 可逐字节复核（两次运行产出一致）。');
  if (gitignoreUpdated) log('  .gitignore 已追加 gen-* 规则。');
}


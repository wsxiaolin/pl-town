import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

// 年份群岛产物审计（设计 §7.1 修订）：年份群岛只呈现改写后的纪念设施，
// 不得再把社区原始数据（作品正文 / 评论 / 热度 / 浏览量）烘焙进产物。
const dir = resolve(process.cwd(), 'src/city/data/year-towns');
const genFiles = readdirSync(dir).filter((f) => f.startsWith('gen-') && f.endsWith('.ts'));

test('生成产物只保留设施配置与纪念索引（不再生成正文/评论包）', () => {
  assert.deepEqual(genFiles.sort(), ['gen-buildings.ts', 'gen-index.ts']);
});

test('生成产物不含运行时网络依赖', () => {
  for (const file of genFiles) {
    const source = readFileSync(resolve(dir, file), 'utf8');
    assert.ok(!/\bfetch\s*\(/.test(source), `${file} 不应调用 fetch`);
    assert.ok(!/https?:\/\//.test(source), `${file} 不应引用远程 URL`);
  }
});

test('生成产物不含作品原始数据字段', () => {
  const forbidden = ['"body"', 'comments', 'popularity', 'visits', '"stars"', 'abstract', 'totalComments'];
  for (const file of genFiles) {
    const source = readFileSync(resolve(dir, file), 'utf8');
    for (const key of forbidden) {
      assert.ok(!source.includes(key), `${file} 不应包含原始数据字段 ${key}`);
    }
  }
});

test('纪念索引暴露设施名与导语，且逐条可对应手写目录', async () => {
  const index = await import('../../src/city/data/year-towns/gen-index');
  const memorials = await import('../../src/city/data/year-towns/yearTownMemorials');
  assert.equal(index.YEAR_TOWN_MEMORIAL_INDEX.length, 106);
  for (const entry of index.YEAR_TOWN_MEMORIAL_INDEX) {
    const source = memorials.YEAR_TOWN_MEMORIAL_BY_KEY[entry.key];
    assert.ok(source, `${entry.key} 应存在于手写目录`);
    assert.equal(entry.facility, source.facility);
    assert.equal(entry.note, source.note);
  }
});

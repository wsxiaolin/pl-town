import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

// 年份镇离线数据审计：加载器只能静态 import 同目录 gen-* 模块，
// 不得出现 fetch/http 等运行时网络依赖（首屏离线可用的前提）。
const loaderPath = resolve(process.cwd(), 'src/city/data/year-towns/gen-loaders.ts');
const source = readFileSync(loaderPath, 'utf8');

test('gen-loaders 不含运行时网络请求', () => {
  assert.ok(!/\bfetch\s*\(/.test(source), 'gen-loaders 不应调用 fetch');
  assert.ok(!/https?:\/\//.test(source), 'gen-loaders 不应引用远程 URL');
});

test('gen-loaders 的每个 import() 都是同目录 gen-* 字面量且文件存在', () => {
  const specs = [...source.matchAll(/import\((['"])(.+?)\1\)/g)].map((m) => m[2]!);
  assert.ok(specs.length >= 30, `import() 数量异常：${specs.length}`);
  for (const spec of specs) {
    assert.match(spec, /^\.\/gen-[a-z0-9-]+$/, `非字面量/越界模块：${spec}`);
    assert.ok(existsSync(resolve(loaderPath, '..', `${spec}.ts`)), `模块缺失：${spec}.ts`);
  }
});

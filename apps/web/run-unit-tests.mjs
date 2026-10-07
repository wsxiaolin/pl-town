#!/usr/bin/env node
// Unit-test runner: auto-discovers tests instead of the former hand-maintained
// `node <file> && node <file> && ...` chain in package.json. That single line
// was the repo's worst recurring merge conflict — every branch adding a test
// appended to it, so two branches doing so always collided.
//
// The file list is derived from the SOURCE tree (tests/unit/**/*.test.ts,
// mirroring tsconfig.test.json's include) and mapped onto the tsc outDir. It
// must NOT be derived from the outDir itself: tsc never cleans it, so stale
// compiled files of deleted sources would keep executing silently.
//
// Usage:
//   node run-unit-tests.mjs                    run every unit test
//   node run-unit-tests.mjs --only=a,b         restrict to these test names
//   node run-unit-tests.mjs --except=a,b       run everything but these
// Test names are paths relative to tests/unit without the .test.ts extension
// (e.g. `storySentences`, `nested/foo`).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)));

// Follow tsconfig `extends` chains so outDir/rootDir stay single-sourced in
// whichever config declares them; paths resolve against the declaring file's
// directory, matching tsc semantics.
function readTsconfigFields(fileName, fields, visited = new Set()) {
  if (visited.has(fileName)) return {};
  visited.add(fileName);
  const config = JSON.parse(readFileSync(fileName, 'utf8'));
  const inherited = config.extends
    ? readTsconfigFields(resolve(dirname(fileName), config.extends), fields, visited)
    : {};
  const own = {};
  for (const field of fields) {
    if (config.compilerOptions?.[field] !== undefined) {
      own[field] = { value: config.compilerOptions[field], from: dirname(fileName) };
    }
  }
  return { ...inherited, ...own };
}

const fields = readTsconfigFields(join(webRoot, 'tsconfig.test-run.json'), ['outDir', 'rootDir']);
if (!fields.outDir) {
  throw new Error('tsconfig.test-run.json chain does not declare compilerOptions.outDir');
}
const outDir = resolve(fields.outDir.from, fields.outDir.value);
const rootDir = fields.rootDir ? resolve(fields.rootDir.from, fields.rootDir.value) : webRoot;

const selection = { only: null, except: null };
for (const arg of process.argv.slice(2)) {
  const match = /^--(only|except)=(.+)$/.exec(arg);
  if (!match) {
    throw new Error(`unexpected argument "${arg}" — usage: node run-unit-tests.mjs [--only=a,b] [--except=a,b]`);
  }
  if (selection[match[1]]) throw new Error(`--${match[1]} given twice`);
  selection[match[1]] = match[2].split(',').map((name) => name.trim()).filter(Boolean);
}

const unitDir = join(webRoot, 'tests', 'unit');
const sourceTests = readdirSync(unitDir, { recursive: true })
  .map((name) => String(name).replaceAll('\\', '/'))
  .filter((name) => name.endsWith('.test.ts'));
if (sourceTests.length === 0) throw new Error(`no *.test.ts found under ${unitDir}`);
sourceTests.sort();
const names = sourceTests.map((file) => file.slice(0, -'.test.ts'.length));

if (selection.only) {
  const only = new Set(selection.only);
  const unknown = selection.only.filter((name) => !names.includes(name));
  if (unknown.length > 0) {
    throw new Error(`--only names without a source file: ${unknown.join(', ')}`);
  }
  names.length = 0;
  names.push(...only);
} else if (selection.except) {
  const except = new Set(selection.except);
  const unknown = selection.except.filter((name) => !names.includes(name));
  if (unknown.length > 0) {
    throw new Error(`--except names without a source file: ${unknown.join(', ')}`);
  }
  for (const name of except) {
    const index = names.indexOf(name);
    if (index >= 0) names.splice(index, 1);
  }
}
if (names.length === 0) {
  throw new Error('selection matched no test files — refusing to report success on an empty run');
}
names.sort();

const targets = names.map((name) => {
  const sourcePath = join(unitDir, `${name}.test.ts`);
  const compiledPath = join(outDir, relative(rootDir, sourcePath)).replace(/\.test\.ts$/, '.test.js');
  if (!existsSync(compiledPath)) {
    throw new Error(
      `compiled test missing: ${compiledPath}\n` +
      'the tsc -p tsconfig.test-run.json step must run before this runner',
    );
  }
  return { name, compiledPath };
});

let failures = 0;
for (const { name, compiledPath } of targets) {
  const result = spawnSync(process.execPath, [compiledPath], { stdio: 'inherit' });
  if (result.status !== 0 || result.error) {
    failures += 1;
    console.error(`FAIL ${name}`);
  } else {
    console.log(`pass ${name}`);
  }
}
console.log(`unit tests: ${targets.length - failures}/${targets.length} file(s) passed`);
process.exit(failures > 0 ? 1 : 0);

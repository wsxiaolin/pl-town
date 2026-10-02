import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';

// `test:unit` enumerates every compiled unit file by hand. A new test file that
// nobody appends to that list silently never runs in `test:domain` (the
// required CI job) while still looking like coverage in the repo. Fail loudly
// instead: every `tests/unit/*.test.ts` must be registered in either
// `test:unit` or `test:unit:story-sentences`.
//
// Resolve the app root from this compiled file
// (<repo>/node_modules/.cache/minicity-tests/tests/unit/): walk up to the
// workspace root (the package.json whose `workspaces` includes `apps/web`),
// then return <repo>/apps/web. This is cwd-independent, so the guard is not a
// landmine when a runner starts elsewhere.
function findAppRoot(): string {
  let directory = __dirname;
  while (true) {
    const candidate = join(directory, 'package.json');
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string; workspaces?: string[] };
      if (Array.isArray(pkg.workspaces) && pkg.workspaces.includes('apps/web')) {
        return join(directory, 'apps', 'web');
      }
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error('could not locate the workspace root from ' + __dirname);
    directory = parent;
  }
}

test('every unit test file is registered in the package test scripts', () => {
  const appRoot = findAppRoot();
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const registered = `${pkg.scripts['test:unit'] ?? ''} ${pkg.scripts['test:unit:story-sentences'] ?? ''}`;

  const files = readdirSync(join(appRoot, 'tests', 'unit'))
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => name.replace(/\.test\.ts$/, ''));

  assert.ok(files.length > 0, 'expected at least one unit test file');
  for (const name of files) {
    assert.match(
      registered,
      new RegExp(`tests/unit/${name}\\.test\\.js\\b`),
      `tests/unit/${name}.test.ts is not registered in test:unit or test:unit:story-sentences`,
    );
  }
});

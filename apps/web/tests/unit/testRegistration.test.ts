import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// `test:unit` enumerates every compiled unit file by hand. A new test file that
// nobody appends to that list silently never runs in `test:domain` (the
// required CI job) while still looking like coverage in the repo. Fail loudly
// instead: every `tests/unit/*.test.ts` must be registered in either
// `test:unit` or `test:unit:story-sentences`.
test('every unit test file is registered in the package test scripts', () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const registered = `${pkg.scripts['test:unit'] ?? ''} ${pkg.scripts['test:unit:story-sentences'] ?? ''}`;

  const files = readdirSync(join(process.cwd(), 'tests', 'unit'))
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

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';

// `test:unit` enumerates every compiled unit file by hand. A new test file that
// nobody appends to that list silently never runs in `test:domain` (the
// required CI job) while still looking like coverage in the repo. Fail loudly
// instead — in both directions:
//   forward: every `tests/unit/**.test.ts` must be registered in
//            `test:unit` or `test:unit:story-sentences`;
//   reverse: every registration must have a live source file. A stale entry is
//            silent locally because tsc never cleans the outDir, so the old
//            compiled assertions keep executing (CI only catches it via
//            MODULE_NOT_FOUND after `npm ci`).
//
// Resolve the app root from this compiled file
// (<repo>/node_modules/.cache/minicity-tests/tests/unit/): walk up to the
// workspace root (the package.json declaring `workspaces`), then locate the web
// app by its package name — not by a hard-coded directory layout, so a future
// `"apps/*"` glob or app move degrades gracefully. This is cwd-independent, so
// the guard is not a landmine when a runner starts elsewhere (e.g. Playwright
// importing from the repo root before `testIgnore` existed).
function findAppRoot(): string {
  let directory = __dirname;
  while (true) {
    const candidate = join(directory, 'package.json');
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { workspaces?: string[] };
      if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
        for (const entry of pkg.workspaces) {
          const appRoot = resolveWorkspaceEntry(directory, entry);
          if (appRoot) return appRoot;
        }
        throw new Error('could not locate the @minicity/web workspace from ' + __dirname);
      }
    }
    const parent = dirname(directory);
    if (parent === directory) throw new Error('could not locate the workspace root from ' + __dirname);
    directory = parent;
  }
}

// Resolve one `workspaces` entry — an exact path (`apps/web`) or a simple
// trailing glob (`apps/*`) — to the workspace whose package.json name is
// `@minicity/web`, or null.
function resolveWorkspaceEntry(root: string, entry: string): string | null {
  const star = entry.indexOf('*');
  const base = (star >= 0 ? entry.slice(0, star) : entry).replace(/\/+$/, '');
  const candidates = star >= 0 && base ? listSubdirectories(root, base) : [base];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const pkgPath = join(root, candidate, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
    if (pkg.name === '@minicity/web') return join(root, candidate);
  }
  return null;
}

function listSubdirectories(root: string, base: string): string[] {
  const directory = join(root, base);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${base}/${entry.name}`);
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('every unit test file is registered in the package test scripts', () => {
  const appRoot = findAppRoot();
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const registered = `${pkg.scripts['test:unit'] ?? ''} ${pkg.scripts['test:unit:story-sentences'] ?? ''}`;

  // Recursive to match tsconfig.test.json's `tests/unit/**/*.ts` include and
  // Playwright's `**/unit/**` ignore.
  const files = readdirSync(join(appRoot, 'tests', 'unit'), { recursive: true })
    .map((name) => String(name).replaceAll('\\', '/'))
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => name.replace(/\.test\.ts$/, ''));

  assert.ok(files.length > 0, 'expected at least one unit test file');
  for (const name of files) {
    assert.match(
      registered,
      new RegExp(`tests/unit/${escapeRegExp(name)}\\.test\\.js\\b`),
      `tests/unit/${name}.test.ts is not registered in test:unit or test:unit:story-sentences`,
    );
  }

  // Reverse guard: stale registrations keep executing deleted assertions
  // locally (tsc does not clean the outDir).
  const onDisk = new Set(files);
  const registeredNames = [...registered.matchAll(/tests\/unit\/(\S+)\.test\.js\b/g)].map((match) => match[1]!);
  for (const name of registeredNames) {
    assert.ok(
      onDisk.has(name),
      `tests/unit/${name}.test.ts no longer exists but is still registered in test:unit / test:unit:story-sentences; remove the stale entry`,
    );
  }
});

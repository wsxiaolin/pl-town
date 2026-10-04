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
// A third leg: every `test:unit*` script in apps/web must be wired into the
// root `test:domain`, otherwise a future `test:unit:extra` would pass this
// guard while CI never runs it.
//
// All offenders are reported in a single assertion (batch diff) instead of
// failing on the first one, so one run is enough to fix a batch of omissions.
//
// Resolve the app root from this compiled file
// (<repo>/node_modules/.cache/minicity-tests/tests/unit/): walk up to the
// workspace root (the package.json declaring `workspaces`), then locate the
// web app by its package name — not by a hard-coded directory layout, so a
// future `"apps/*"` glob or app rename degrades gracefully. This is
// cwd-independent, so the guard is not a landmine when a runner starts
// elsewhere (e.g. Playwright importing from the repo root).
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
    scripts?: Record<string, string>;
  };
  assert.ok(pkg.scripts, 'apps/web/package.json must define a scripts section');
  const scripts = pkg.scripts!;
  const registered = `${scripts['test:unit'] ?? ''} ${scripts['test:unit:story-sentences'] ?? ''}`;

  // Recursive to match tsconfig.test.json's `tests/unit/**/*.ts` include.
  // readdirSync's recursive typing is `(string | Buffer)[]` on the current
  // @types/node, hence the String() cast; the backslash normalization keeps
  // Windows separators comparable.
  const files = readdirSync(join(appRoot, 'tests', 'unit'), { recursive: true })
    .map((name) => String(name).replaceAll('\\', '/'))
    .filter((name) => name.endsWith('.test.ts'))
    .map((name) => name.replace(/\.test\.ts$/, ''));
  assert.ok(files.length > 0, 'expected at least one unit test file');

  // forward: on-disk test files that no script runs.
  const missing = files.filter(
    (name) => !new RegExp(`tests/unit/${escapeRegExp(name)}\\.test\\.js\\b`).test(registered),
  );
  // reverse: script entries whose source file was deleted (tsc does not clean
  // the outDir, so the stale compiled assertions keep executing locally).
  const onDisk = new Set(files);
  const stale = [...registered.matchAll(/tests\/unit\/(\S+)\.test\.js\b/g)]
    .map((match) => match[1]!)
    .filter((name) => !onDisk.has(name));

  assert.deepEqual(
    { missing, stale },
    { missing: [], stale: [] },
    'unit test registration mismatch — missing: .test.ts not registered in test:unit / test:unit:story-sentences; stale: registration without a .test.ts on disk (remove the entry)',
  );
});

test('every test:unit* script is wired into the root test:domain', () => {
  const appRoot = findAppRoot();
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.ok(pkg.scripts, 'apps/web/package.json must define a scripts section');
  const rootPkg = JSON.parse(readFileSync(join(appRoot, '..', '..', 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.ok(rootPkg.scripts, 'root package.json must define a scripts section');
  const domain = rootPkg.scripts!['test:domain'] ?? '';

  const unwired = Object.keys(pkg.scripts!).filter(
    (name) =>
      /^test:unit/.test(name) &&
      !domain.includes(`npm run ${name} -w @minicity/web`) &&
      !domain.includes(`npm run ${name} --workspace @minicity/web`),
  );
  assert.deepEqual(
    unwired,
    [],
    'test:unit* scripts not wired into the root test:domain — CI only runs what test:domain invokes',
  );
});

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';

// `test:unit` no longer enumerates test files by hand: it compiles the tests
// and then routes through `run-unit-tests.mjs`, which discovers every
// `tests/unit/**/*.test.ts` from the source tree and runs its compiled file.
// A new test file therefore runs automatically — the old failure mode (a file
// that silently never executes because nobody appended it to the package.json
// chain, which was also the chain's recurring merge conflict) is gone.
//
// What can still regress silently:
//   - a `test:unit*` script bypassing the runner (back to hand enumeration —
//     new files stop running, and the single shared line starts conflicting
//     across branches again), so every such script must invoke the runner;
//   - a `test:unit*` script not wired into the root `test:domain`, which is
//     the only thing CI executes — a future `test:unit:extra` would pass the
//     guard above while CI never runs it.
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

test('every test:unit* script routes through the auto-discovery runner', () => {
  const appRoot = findAppRoot();
  const pkg = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  assert.ok(pkg.scripts, 'apps/web/package.json must define a scripts section');
  const unitScripts = Object.entries(pkg.scripts!).filter(([name]) => /^test:unit/.test(name));
  assert.ok(unitScripts.length > 0, 'expected at least one test:unit* script');
  const bypassing = unitScripts
    .filter(([, command]) => !command.includes('run-unit-tests.mjs'))
    .map(([name]) => name);
  assert.deepEqual(
    bypassing,
    [],
    'test:unit* scripts must invoke run-unit-tests.mjs (auto-discovery). Hand-maintained `node <file>` chains made every new test append to one shared package.json line — the recurring merge conflict — and let unregistered files silently never run.',
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

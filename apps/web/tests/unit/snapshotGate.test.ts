import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// The snapshot workflow's run/skip/fail gate used to live inline in YAML and
// silently regressed once (#177). It is now a script so the decision matrix is
// covered here.

// Locate the script independently of the invocation cwd: fast path assumes the
// `npm run test:unit -w @minicity/web` layout (cwd = apps/web), then falls back
// to `git rev-parse --show-toplevel` so direct `node <file>` runs also work.
function repoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, '..', '..', 'scripts', 'snapshot-gate.sh'))) return join(cwd, '..', '..');
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return cwd; // let the assertion below emit a diagnostic
  }
}

const script = join(repoRoot(), 'scripts', 'snapshot-gate.sh');
assert.ok(
  existsSync(script),
  `snapshot-gate.sh not found at ${script}; run via \`npm run test:unit -w @minicity/web\` (cwd must be apps/web)`,
);

function gate(env: Record<string, string>): string {
  return execFileSync('bash', [script], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', ...env },
  }).trim();
}

test('snapshot gate runs when both secrets are configured', () => {
  assert.equal(gate({ RENDER_SNAPSHOT_URL: 'https://example.test', DEPLOY_SNAPSHOT_TOKEN: 'x' }), 'run');
});

// Exactly one of the pair configured is a half-rotated or typo'd secret — the
// realistic way backups silently stop — so it hard-fails on every trigger
// instead of degrading to the "not configured" skip path (#206 审查建议 1).
test('snapshot gate fails when only one secret is configured', () => {
  assert.equal(gate({ GITHUB_EVENT_NAME: 'push', RENDER_SNAPSHOT_URL: 'https://example.test' }), 'fail');
  assert.equal(gate({ GITHUB_EVENT_NAME: 'push', DEPLOY_SNAPSHOT_TOKEN: 'x' }), 'fail');
  assert.equal(gate({ GITHUB_EVENT_NAME: 'workflow_dispatch', RENDER_SNAPSHOT_URL: 'https://example.test' }), 'fail');
});

test('snapshot gate hard-fails on manual dispatch without secrets', () => {
  assert.equal(gate({ GITHUB_EVENT_NAME: 'workflow_dispatch' }), 'fail');
});

test('snapshot gate skips a plain push without secrets by default', () => {
  assert.equal(gate({ GITHUB_EVENT_NAME: 'push' }), 'skip');
});

test('snapshot gate fails a push when SNAPSHOT_REQUIRED is truthy (case-insensitive)', () => {
  for (const value of ['true', 'TRUE', 'True', 'yes', '1']) {
    assert.equal(gate({ GITHUB_EVENT_NAME: 'push', SNAPSHOT_REQUIRED: value }), 'fail', `SNAPSHOT_REQUIRED=${value}`);
  }
});

test('snapshot gate ignores a non-truthy SNAPSHOT_REQUIRED', () => {
  assert.equal(gate({ GITHUB_EVENT_NAME: 'push', SNAPSHOT_REQUIRED: 'false' }), 'skip');
});

test('configured secrets always win over SNAPSHOT_REQUIRED', () => {
  assert.equal(gate({ GITHUB_EVENT_NAME: 'push', SNAPSHOT_REQUIRED: 'true', RENDER_SNAPSHOT_URL: 'u', DEPLOY_SNAPSHOT_TOKEN: 't' }), 'run');
});

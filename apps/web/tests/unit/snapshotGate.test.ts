import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';

// The snapshot workflow's run/skip/fail gate used to live inline in YAML and
// silently regressed once (#177). It is now a script so the decision matrix is
// covered here.
const script = join(process.cwd(), '..', '..', 'scripts', 'snapshot-gate.sh');

function gate(env: Record<string, string>): string {
  return execFileSync('bash', [script], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', ...env },
  }).trim();
}

test('snapshot gate runs when both secrets are configured', () => {
  assert.equal(gate({ RENDER_SNAPSHOT_URL: 'https://example.test', DEPLOY_SNAPSHOT_TOKEN: 'x' }), 'run');
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

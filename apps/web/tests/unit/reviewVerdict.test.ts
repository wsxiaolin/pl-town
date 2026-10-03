import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// The AI reviewer's merge gate is shell logic; a parser that fails open on a
// decorated verdict line silently green-lights a BLOCKER. Pin the shapes models
// actually emit (bold, list markers, backticks, CRLF) plus the emoji fallback
// and the deliberate fail-open paths (missing file, missing verdict line).

// Locate the script independently of the invocation cwd: fast path assumes the
// `npm run test:unit -w @minicity/web` layout (cwd = apps/web), then falls back
// to `git rev-parse --show-toplevel`. The fallback matters because Playwright
// (before the follow-up PR that adds testIgnore to playwright.config.ts)
// imports `tests/unit/**` files with the repo root as cwd inside shard jobs —
// a cwd-only resolution turns into a module-level throw that fails the whole
// shard.
function repoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, '..', '..', 'scripts', 'review-verdict.sh'))) return join(cwd, '..', '..');
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  } catch {
    return cwd; // let the assertion below emit a diagnostic
  }
}

const script = join(repoRoot(), 'scripts', 'review-verdict.sh');
assert.ok(
  existsSync(script),
  `review-verdict.sh not found at ${script}; run via \`npm run test:unit -w @minicity/web\` (cwd must be apps/web)`,
);
const dir = mkdtempSync(join(tmpdir(), 'review-verdict-'));
test.after(() => rmSync(dir, { recursive: true, force: true }));

function verdict(report: string): { code: number; stdout: string; stderr: string } {
  const file = join(dir, 'report.md');
  writeFileSync(file, report);
  return runScript(file);
}

function runScript(file: string): { code: number; stdout: string; stderr: string } {
  const result = spawnSync('bash', [script, file], { encoding: 'utf8' });
  return {
    code: result.status ?? 1,
    stdout: String(result.stdout).trim(),
    stderr: String(result.stderr),
  };
}

for (const [label, report, expected] of [
  ['plain pass', 'REVIEW_VERDICT: PASS\n', 'PASS'],
  ['decorated pass', '**REVIEW_VERDICT: PASS**\n', 'PASS'],
  ['backticked pass', '`REVIEW_VERDICT: PASS`\n', 'PASS'],
  ['bold key', '**REVIEW_VERDICT:** PASS\n', 'PASS'],
  ['blocker verdict', 'REVIEW_VERDICT: BLOCKER\n', 'BLOCKER'],
  ['decorated blocker', '## REVIEW_VERDICT: BLOCKER\n', 'BLOCKER'],
  ['verdict with trailing notes', 'REVIEW_VERDICT: PASS — no blockers found\n', 'PASS'],
  ['CRLF pass', 'REVIEW_VERDICT: PASS\r\n', 'PASS'],
  ['emoji fallback', '### 🔴 Blocker\n', 'BLOCKER'],
  ['CJK emoji fallback', '### 🔴 阻断\n', 'BLOCKER'],
  ['prose emoji mention is not a blocker', 'No 🔴 Blocker findings — all clear.\n', 'PASS'],
  ['missing verdict defaults to pass', 'no verdict here\n', 'PASS'],
  ['numbered blocker', '1. REVIEW_VERDICT: BLOCKER\n', 'BLOCKER'],
  ['numbered pass', '10) REVIEW_VERDICT: PASS\n', 'PASS'],
  ['quoted prompt line is not a verdict', '6. End with `REVIEW_VERDICT: PASS` or `REVIEW_VERDICT: BLOCKER`.\n', 'PASS'],
  ['decorated verdict after a prompt quote', '6. End with REVIEW_VERDICT: PASS\n1. REVIEW_VERDICT: BLOCKER\n', 'BLOCKER'],
] as const) {
  test(`review verdict: ${label}`, () => {
    const result = verdict(report);
    assert.equal(result.stdout, expected, `${label} should resolve to ${expected}`);
    assert.equal(result.code, expected === 'BLOCKER' ? 1 : 0, `${label} exit code`);
  });
}

// 无 verdict 行的 fail-open 是设计决定：bot 打嗝不应把 required check 变红。
// stderr 警告保证该路径在 job log 里可见（#205 审查建议 3）。
test('review verdict: missing verdict line fails open with a stderr warning', () => {
  const result = verdict('no verdict here\n');
  assert.equal(result.stdout, 'PASS');
  assert.equal(result.code, 0);
  assert.match(result.stderr, /no REVIEW_VERDICT line found/);
});

// 报告文件缺失（上游步骤失败）时同样 fail-open：exit 0 且仅留 stderr 提示
// （无 stdout verdict；required check 只看退出码）。
test('review verdict: missing report file fails open', () => {
  const result = runScript(join(dir, 'does-not-exist.md'));
  assert.equal(result.code, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /report file not found/);
});

// 判定行被匹配但 token 不是 PASS/BLOCKER（如 REVIEW_VERDICT: PENDING）：
// 保持 fail-open，但 stderr 告警保证该路径在 job log 里可见。
test('review verdict: unrecognized verdict token warns and fails open', () => {
  const result = verdict('REVIEW_VERDICT: PENDING\n');
  assert.equal(result.stdout, 'PASS');
  assert.equal(result.code, 0);
  assert.match(result.stderr, /no PASS\/BLOCKER token/);
});

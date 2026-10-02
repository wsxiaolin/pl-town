import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// The AI reviewer's merge gate is shell logic; a parser that fails open on a
// decorated verdict line silently green-lights a BLOCKER. Pin the shapes models
// actually emit (bold, list markers, backticks, CRLF) plus the emoji fallback.
const script = join(process.cwd(), '..', '..', 'scripts', 'review-verdict.sh');
const dir = mkdtempSync(join(tmpdir(), 'review-verdict-'));

function verdict(report: string): { code: number; stdout: string } {
  const file = join(dir, 'report.md');
  writeFileSync(file, report);
  try {
    const stdout = execFileSync('bash', [script, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { code: 0, stdout: stdout.trim() };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { code: failure.status ?? -1, stdout: (failure.stdout ?? '').trim() };
  }
}

for (const [label, report, expected] of [
  ['plain blocker', 'REVIEW_VERDICT: BLOCKER\n', 'BLOCKER'],
  ['plain pass', 'REVIEW_VERDICT: PASS\n', 'PASS'],
  ['bold blocker', '**REVIEW_VERDICT: BLOCKER**\n', 'BLOCKER'],
  ['list pass', '- REVIEW_VERDICT: PASS\n', 'PASS'],
  ['backtick pass', '`REVIEW_VERDICT: PASS`\n', 'PASS'],
  ['no-space blocker', 'REVIEW_VERDICT:BLOCKER\n', 'BLOCKER'],
  ['trailing prose blocker', 'REVIEW_VERDICT: BLOCKER: because reasons\n', 'BLOCKER'],
  ['last line wins', 'REVIEW_VERDICT: BLOCKER\nREVIEW_VERDICT: PASS\n', 'PASS'],
  ['CRLF pass', 'REVIEW_VERDICT: PASS\r\n', 'PASS'],
  ['emoji fallback', '### 🔴 Blocker\n', 'BLOCKER'],
  ['CJK emoji fallback', '### 🔴 阻断\n', 'BLOCKER'],
  ['missing verdict defaults to pass', 'no verdict here\n', 'PASS'],
] as const) {
  test(`review verdict: ${label}`, () => {
    const result = verdict(report);
    assert.equal(result.stdout, expected, `${label} should resolve to ${expected}`);
    assert.equal(result.code, expected === 'BLOCKER' ? 1 : 0, `${label} exit code`);
  });
}

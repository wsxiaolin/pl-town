import assert from 'node:assert/strict';
import test from 'node:test';
import { NEWSPAPER_ARCHIVE, type NewspaperBlock, type NewspaperIssue } from '../../src/city/data/newspapers';

test('Newspaper archive retains every extracted weekly issue', () => {
  assert.ok(NEWSPAPER_ARCHIVE.length >= 80);
  const ids = new Set<string>();
  for (const issue of NEWSPAPER_ARCHIVE) {
    assert.ok(issue.id, 'issue has an id');
    assert.ok(!ids.has(issue.id), `duplicate issue id ${issue.id}`);
    ids.add(issue.id);
  }
});

test('Every issue has a series, a date and at least one page', () => {
  for (const issue of NEWSPAPER_ARCHIVE) {
    assert.ok(issue.series.length > 0, `${issue.id} series`);
    assert.match(issue.date, /^\d{4}\.\d{1,2}\.\d{1,2}$/, `${issue.id} date`);
    assert.ok(issue.pages.length >= 1, `${issue.id} pages`);
  }
});

test('Every page has a title and at least one block', () => {
  for (const issue of NEWSPAPER_ARCHIVE) {
    for (const page of issue.pages) {
      assert.ok(page.title.trim().length > 0, `${issue.id} page title`);
      assert.ok(page.blocks.length >= 1, `${issue.id} page blocks`);
    }
  }
});

test('Blocks carry valid kinds and link metadata', () => {
  const validKinds = new Set(['motto', 'separator', 'section', 'label', 'text', 'link', 'editor']);
  let linkCount = 0;
  for (const issue of NEWSPAPER_ARCHIVE) {
    for (const page of issue.pages) {
      for (const block of page.blocks as readonly NewspaperBlock[]) {
        assert.ok(validKinds.has(block.kind), `${issue.id} invalid kind ${block.kind}`);
        assert.ok(block.text.trim().length > 0, `${issue.id} empty block text`);
        if (block.kind === 'link') {
          linkCount += 1;
          assert.ok(block.href, `${issue.id} link href`);
          assert.ok(block.hrefType === 'discussion' || block.hrefType === 'experiment', `${issue.id} link hrefType`);
        }
      }
    }
  }
  assert.ok(linkCount > 0, 'archive contains referenced discussion/experiment links');
});

test('Chronologically ordered archive shows the oldest issue first', () => {
  const first = NEWSPAPER_ARCHIVE[0];
  assert.ok(first);
  assert.equal(first.series, '星辉周刊');
  assert.equal(first.date, '2023.7.23');
  const dates = NEWSPAPER_ARCHIVE.map((issue: NewspaperIssue) => issue.date);
  const sorted = [...dates].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  assert.deepEqual(dates, sorted, 'issues are sorted chronologically');
});
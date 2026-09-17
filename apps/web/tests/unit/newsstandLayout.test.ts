import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPageLayout } from '../../src/adapters/ui/newsstandLayout';
import type { NewspaperBlock, NewspaperPage } from '../../src/city/data/newspapers/newspapers-types';

function block(kind: NewspaperBlock['kind'], text: string, extra: Partial<NewspaperBlock> = {}): NewspaperBlock {
  return { kind, text, ...extra };
}

function page(blocks: NewspaperBlock[]): NewspaperPage {
  return { title: '头版', blocks };
}

test('newspaper layout folds empty categories into a single index line', () => {
  const layout = buildPageLayout(page([
    block('motto', '夜空中的明星划过天穹'),
    block('separator', '————————本周看点————————'),
    block('section', '精知优选'),
    block('text', '（本栏收录了部分黑洞区精选和知识库）'),
    block('label', '计算机科学'),
    block('label', '数学'),
    block('link', '计数问题', { href: 'a', hrefType: 'discussion' }),
    block('label', '物理'),
  ]));

  assert.equal(layout.motto, '夜空中的明星划过天穹');
  assert.ok(layout.separator?.includes('本周看点'));

  const story = layout.stories[0];
  assert.ok(story);
  assert.deepEqual(story.deck, ['（本栏收录了部分黑洞区精选和知识库）']);
  assert.equal(story.groups.length, 1);
  assert.equal(story.groups[0]?.label, '数学');
  assert.equal(story.groups[0]?.items.length, 1);
  assert.deepEqual(story.emptyLabels, ['计算机科学', '物理']);
});

test('newspaper layout attaches author bylines to the preceding entry', () => {
  const layout = buildPageLayout(page([
    block('section', '文学荟萃'),
    block('link', '絮语', { href: 'x', hrefType: 'discussion' }),
    block('text', '作者：@泉墨'),
    block('link', '镇上的巧克力工厂', { href: 'y', hrefType: 'discussion' }),
    block('text', '@北冥薛猫'),
  ]));

  const story = layout.stories[0];
  assert.ok(story);
  assert.equal(story.groups.length, 0);
  assert.deepEqual(story.loose.map((item) => item.byline), ['@泉墨', '@北冥薛猫']);
});

test('newspaper layout routes long-form sections into prose paragraphs', () => {
  const layout = buildPageLayout(page([
    block('section', '社论呐喊'),
    block('text', '这是一段足够长的社论正文，用来验证长文板块会被识别为分栏正文并逐段排版。'),
    block('text', '第二段同样保持较长的篇幅，让平均字数稳稳超过判定阈值，从而进入长文排版模式。'),
    block('text', '第三段继续补充论述，确保段落数量与长度都满足长文判定的条件后再交给渲染层。'),
  ]));

  const story = layout.stories[0];
  assert.ok(story);
  assert.equal(story.paragraphs.length, 3);
  assert.equal(story.groups.length, 0);
  assert.equal(story.loose.length, 0);
});

test('newspaper layout drops placeholder-only pages', () => {
  const layout = buildPageLayout(page([
    block('section', '社论呐喊'),
    block('text', '（本栏收录了部分社论）'),
    block('text', '无'),
  ]));

  assert.equal(layout.stories.length, 0);
});

test('newspaper layout recognises legacy category headings written as plain text', () => {
  const layout = buildPageLayout(page([
    block('section', '精知优选'),
    block('text', '（本栏收录了部分黑洞区精选和知识库）'),
    block('text', '物理'),
    block('link', '相对论趣谈', { href: 'a', hrefType: 'discussion' }),
    block('text', '作者：@沃尔夫冈'),
    block('text', '生命科学'),
    block('link', '神经如何传递兴奋', { href: 'b', hrefType: 'discussion' }),
  ]));

  const story = layout.stories[0];
  assert.ok(story);
  assert.deepEqual(story.groups.map((group) => group.label), ['物理', '生命科学']);
  assert.equal(story.groups[0]?.items[0]?.byline, '@沃尔夫冈');
  assert.equal(story.loose.length, 0);
});

test('newspaper layout turns decorative dash rows into band headings', () => {
  const layout = buildPageLayout(page([
    block('section', '尾声与编者'),
    block('text', '—————————————尾声—————————————'),
    block('link', '往期作品：星辉刊物目录', { href: 'z', hrefType: 'discussion' }),
  ]));

  const story = layout.stories[0];
  assert.ok(story);
  assert.deepEqual(story.bands, ['尾声']);
});

test('newspaper layout keeps short text entries inside their category group', () => {
  const layout = buildPageLayout(page([
    block('section', '冲精防淹'),
    block('label', '本周'),
    block('text', 'CrwwsAI模型（计算机科学）'),
    block('text', '论电车难题与AI伦理'),
    block('label', '下周'),
  ]));

  const story = layout.stories[0];
  assert.ok(story);
  assert.equal(story.groups.length, 1);
  assert.equal(story.groups[0]?.label, '本周');
  assert.deepEqual(story.groups[0]?.items.map((item) => item.text), [
    'CrwwsAI模型（计算机科学）',
    '论电车难题与AI伦理',
  ]);
  assert.deepEqual(story.emptyLabels, ['下周']);
});

test('newspaper layout preserves link href and hrefType on items', () => {
  const layout = buildPageLayout(page([
    block('section', '精知优选'),
    block('link', '计数问题', { href: '64bbd6ba5e2f05a09bf2d244', hrefType: 'discussion' }),
    block('link', '力学实验', { href: '64bbd6ba5e2f05a09bf2d245', hrefType: 'experiment' }),
  ]));

  const items = layout.stories[0]?.loose ?? [];
  assert.equal(items[0]?.href, '64bbd6ba5e2f05a09bf2d244');
  assert.equal(items[0]?.hrefType, 'discussion');
  assert.equal(items[1]?.href, '64bbd6ba5e2f05a09bf2d245');
  assert.equal(items[1]?.hrefType, 'experiment');
});

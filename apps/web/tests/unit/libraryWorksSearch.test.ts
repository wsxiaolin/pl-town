import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIBRARY_SEARCH_PAGE_SIZE,
  buildLibrarySearchUrl,
  libraryWorkArchiveUrl,
  libraryWorkMetaLine,
  libraryWorkTags,
  type LibraryWorkRecord,
} from '../../src/city/data/libraryWorksSearch';

test('Search URL omits the keywords param when blank', () => {
  const empty = buildLibrarySearchUrl('https://s.pltown.online/', { keywords: '' });
  assert.equal(empty, 'https://s.pltown.online/api/search?limit=24');

  const filled = buildLibrarySearchUrl('https://s.pltown.online', { keywords: '量子 力学' });
  assert.equal(
    filled,
    'https://s.pltown.online/api/search?keywords=%E9%87%8F%E5%AD%90+%E5%8A%9B%E5%AD%A6&limit=24',
  );
});

test('Search URL trims whitespace before deciding whether keywords are set', () => {
  const url = buildLibrarySearchUrl('https://s.pltown.online', { keywords: '   ' });
  assert.equal(url, 'https://s.pltown.online/api/search?limit=24');
});

test('Search URL custom limit is honoured', () => {
  const url = buildLibrarySearchUrl('https://s.pltown.online', { keywords: '力学' }, 5);
  assert.equal(url, 'https://s.pltown.online/api/search?keywords=%E5%8A%9B%E5%AD%A6&limit=5');
});

test('Work deep link matches the archive work page', () => {
  assert.equal(
    libraryWorkArchiveUrl('https://s.pltown.online/', '66A473D59E258E6B2F529E29'),
    'https://s.pltown.online/w/66a473d59e258e6b2f529e29',
  );
});

test('Meta line joins author, year, source and disciplines', () => {
  const record: LibraryWorkRecord = {
    id: 'a1',
    name: 'x',
    userName: '小临',
    year: 2024,
    source: '实验精选',
    primaryDiscipline: ['工学'],
    secondaryDiscipline: ['计算机科学与技术', '软件工程', '第三学科'],
  };
  assert.equal(libraryWorkMetaLine(record), '小临 · 2024 · 实验精选 · 工学 / 计算机科学与技术 / 软件工程');
});

test('Meta line falls back to anonymous and skips missing fields', () => {
  assert.equal(libraryWorkMetaLine({ id: 'a2', name: 'x' }), '匿名');
  assert.equal(libraryWorkMetaLine({ id: 'a3', name: 'x', userName: 'tyq', year: 'not-a-year' }), 'tyq');
});

test('Tags are trimmed, filtered and capped', () => {
  const record: LibraryWorkRecord = {
    id: 'a4',
    name: 'x',
    keyWords: [' 量子力学 ', '', '实粒子', '虚粒子', '自旋', '玻色子', '费米子'],
  };
  assert.deepEqual(libraryWorkTags(record), ['量子力学', '实粒子', '虚粒子', '自旋', '玻色子', '费米子']);
  assert.deepEqual(libraryWorkTags(record, 2), ['量子力学', '实粒子']);
});

test('Page size stays within the server-side cap', () => {
  assert.ok(LIBRARY_SEARCH_PAGE_SIZE >= 1 && LIBRARY_SEARCH_PAGE_SIZE <= 50);
});

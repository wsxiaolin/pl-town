import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIBRARY_SEARCH_PAGE_SIZE,
  LIBRARY_SEARCH_YEARS,
  buildLibrarySearchUrl,
  libraryArchiveMetaUrl,
  libraryHotTermsUrl,
  libraryWorkMetaLine,
  libraryWorkTags,
  libraryWorkUrls,
  type LibraryWorkRecord,
} from '../../src/city/data/libraryWorksSearch';

test('Search URL keeps only filled filters and always the page size', () => {
  const empty = buildLibrarySearchUrl('https://s.pltown.online/', { keywords: '', author: '', year: null });
  assert.equal(empty, 'https://s.pltown.online/api/search?limit=24');

  const full = buildLibrarySearchUrl('https://s.pltown.online', { keywords: '量子 力学', author: '小临', year: 2026 });
  assert.equal(
    full,
    'https://s.pltown.online/api/search?keywords=%E9%87%8F%E5%AD%90+%E5%8A%9B%E5%AD%A6&author=%E5%B0%8F%E4%B8%B4&year=2026&limit=24',
  );
});

test('Search URL trims whitespace before deciding whether a filter is set', () => {
  const url = buildLibrarySearchUrl('https://s.pltown.online', { keywords: '   ', author: ' 小临 ', year: null });
  assert.equal(url, 'https://s.pltown.online/api/search?author=%E5%B0%8F%E4%B8%B4&limit=24');
});

test('Search URL custom limit is honoured', () => {
  const url = buildLibrarySearchUrl('https://s.pltown.online', { keywords: '光学', author: '', year: null }, 8);
  assert.ok(url.endsWith('limit=8'), url);
});

test('Year filter is omitted when null or non-finite', () => {
  assert.ok(!buildLibrarySearchUrl('https://x.dev', { keywords: '', author: '', year: null }).includes('year='));
});

test('Work deep links match the archive work page and Physics Lab routes', () => {
  const urls = libraryWorkUrls('https://s.pltown.online/', '66a473d59e258e6b2f529e29');
  assert.equal(urls.archive, 'https://s.pltown.online/w/66a473d59e258e6b2f529e29');
  assert.equal(urls.experiment, 'https://plweb.turtlesim.com/#/p/Experiment/66a473d59e258e6b2f529e29');
  assert.equal(urls.discussion, 'https://plweb.turtlesim.com/#/p/Discussion/66a473d59e258e6b2f529e29');
});

test('Meta line joins author, year, source and disciplines', () => {
  const record: LibraryWorkRecord = {
    id: 'a1',
    name: '作品',
    userName: '小临',
    year: 2024,
    source: '黑洞精选',
    primaryDiscipline: ['理学'],
    secondaryDiscipline: ['物理学', '天文学', '化学'],
  };
  assert.equal(libraryWorkMetaLine(record), '小临 · 2024 · 黑洞精选 · 理学 / 物理学 / 天文学');
});

test('Meta line falls back to anonymous and skips missing fields', () => {
  assert.equal(libraryWorkMetaLine({ id: 'a2', name: 'x' }), '匿名');
  const partial: LibraryWorkRecord = { id: 'a3', name: 'x', userName: '  ', year: '2024', source: '其他' };
  assert.equal(libraryWorkMetaLine(partial), '匿名 · 2024 · 其他');
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

test('Helper endpoints point at the archive service', () => {
  assert.equal(libraryArchiveMetaUrl('https://s.pltown.online/'), 'https://s.pltown.online/api/meta');
  assert.equal(libraryHotTermsUrl('https://s.pltown.online'), 'https://s.pltown.online/api/stats?type=terms');
});

test('Page size stays within the server-side cap and years stay sorted', () => {
  assert.ok(LIBRARY_SEARCH_PAGE_SIZE >= 1 && LIBRARY_SEARCH_PAGE_SIZE <= 50);
  const descending = [...LIBRARY_SEARCH_YEARS];
  assert.deepEqual(LIBRARY_SEARCH_YEARS, descending.sort((a, b) => b - a));
  assert.ok(LIBRARY_SEARCH_YEARS.includes(2026) && LIBRARY_SEARCH_YEARS.includes(2020));
});

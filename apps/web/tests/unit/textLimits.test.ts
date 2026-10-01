import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NICKNAME_PATTERN,
  sanitizeBuildingLabel,
  sanitizeChatText,
  sanitizeHouseName,
  hasDisallowedControls,
} from '../../src/core/textLimits';

test('nicknames allow letters and numbers within 2-40 characters', () => {
  assert.equal(NICKNAME_PATTERN.test('小明'), true);
  assert.equal(NICKNAME_PATTERN.test('Alice'), true);
  assert.equal(NICKNAME_PATTERN.test('A'), false);
  assert.equal(NICKNAME_PATTERN.test('A'.repeat(41)), false);
  assert.equal(NICKNAME_PATTERN.test('小明!'), false);
  assert.equal(NICKNAME_PATTERN.test('小明 '), false);
});

test('passwords reject control characters', () => {
  assert.equal(hasDisallowedControls('resident-secret'), false);
  assert.equal(hasDisallowedControls('pass\u0000word'), true);
  assert.equal(hasDisallowedControls('line\nbreak'), true);
});

test('chat text strips controls and rejects empty or oversized input', () => {
  assert.equal(sanitizeChatText('  hello world  '), 'hello world');
  assert.equal(sanitizeChatText('clean\u0000chat'), 'cleanchat');
  assert.equal(sanitizeChatText('\u0000\u0001'), null);
  assert.equal(sanitizeChatText('a'.repeat(501)), null);
});

test('house names keep letters, numbers and light punctuation', () => {
  assert.equal(sanitizeHouseName('  晴风小屋  '), '晴风小屋');
  assert.equal(sanitizeHouseName('Integration Home'), 'Integration Home');
  assert.equal(sanitizeHouseName("Lin's rest"), "Lin's rest");
  assert.equal(sanitizeHouseName('<script>'), null);
  assert.equal(sanitizeHouseName('A'.repeat(25)), null);
  assert.equal(sanitizeHouseName('🏠小屋'), null);
});

test('building labels keep a 16-character sanitized fallback', () => {
  assert.equal(sanitizeBuildingLabel('金月店', 'mall'), '金月店');
  assert.equal(sanitizeBuildingLabel('\u0000', 'mall'), 'mall');
  assert.equal(sanitizeBuildingLabel('一二三四五六七八九十一二三四五六七八', 'mall').length, 16);
});

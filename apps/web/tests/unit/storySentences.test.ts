import assert from 'node:assert/strict';
import test from 'node:test';
import { splitStorySentences } from '../../src/adapters/ui/stories/storyDialogFlow';

test('splitStorySentences keeps sentence punctuation and trailing closing quotes', () => {
  assert.deepEqual(
    splitStorySentences('「3月20日\n\n毕业典礼那天，我没敢把信给他。\n\n也许他永远不会看到。但至少，它在这里。」'),
    ['「3月20日', '毕业典礼那天，我没敢把信给他。', '也许他永远不会看到。', '但至少，它在这里。」'],
  );
});

test('splitStorySentences keeps a quoted question intact', () => {
  assert.deepEqual(splitStorySentences('……这不就是我住的地方？'), ['……这不就是我住的地方？']);
  assert.deepEqual(splitStorySentences('「……这不就是我住的地方？」'), ['「……这不就是我住的地方？」']);
});

test('splitStorySentences falls back to the raw text when each line trims away', () => {
  assert.deepEqual(splitStorySentences('   '), ['   ']);
});

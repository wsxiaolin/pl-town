import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGI_STORY } from '../../src/gameplay/content/stories/magi/magiStory';
import { OVERCOAT_STORY } from '../../src/gameplay/content/stories/overcoat/overcoatStory';
import { YESTERDAY_SONG } from '../../src/gameplay/content/stories/yesterday/yesterdaySong';
import type { StoryDefinition } from '../../src/gameplay/stories/types';

function assertInteractionsResolve(story: StoryDefinition): void {
  for (const interaction of story.interactions ?? []) {
    const node = story.nodes[interaction.nodeId];
    assert(node, `${story.id}: missing interaction node ${interaction.nodeId}`);
    assert(node.choices?.some((choice) => choice.id === interaction.choiceId), `${story.id}: missing actor choice ${interaction.choiceId}`);
  }
  for (const interaction of story.buildingInteractions ?? []) {
    const node = story.nodes[interaction.nodeId];
    assert(node, `${story.id}: missing building node ${interaction.nodeId}`);
    assert(node.choices?.some((choice) => choice.id === interaction.choiceId), `${story.id}: missing building choice ${interaction.choiceId}`);
  }
}

test('side story world interactions reference existing choices', () => {
  assertInteractionsResolve(MAGI_STORY);
  assertInteractionsResolve(OVERCOAT_STORY);
  assertInteractionsResolve(YESTERDAY_SONG);
});

test('side story nodes reference existing destinations', () => {
  for (const story of [MAGI_STORY, OVERCOAT_STORY, YESTERDAY_SONG]) {
    for (const node of Object.values(story.nodes)) {
      for (const choice of node.choices ?? []) assert(story.nodes[choice.next], `${story.id}: missing destination ${choice.next}`);
    }
  }
});

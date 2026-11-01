import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGI_STORY } from '../../src/gameplay/content/stories/magi/magiStory';
import { OVERCOAT_STORY } from '../../src/gameplay/content/stories/overcoat/overcoatStory';
import { YESTERDAY_SONG } from '../../src/gameplay/content/stories/yesterday/yesterdaySong';
import { ICE_SANCTUM_STORY } from '../../src/gameplay/content/stories/iceKing/iceSanctumStory';
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
  for (const story of [MAGI_STORY, OVERCOAT_STORY, YESTERDAY_SONG, ICE_SANCTUM_STORY]) {
    for (const node of Object.values(story.nodes)) {
      for (const choice of node.choices ?? []) assert(story.nodes[choice.next], `${story.id}: missing destination ${choice.next}`);
    }
  }
});

import { REDDOT_STORY } from '../../src/gameplay/content/stories/reddot/reddotStory';
import { SINGLESTEP_STORY } from '../../src/gameplay/content/stories/singlestep/singlestepStory';
import { PROOFREAD_STORY } from '../../src/gameplay/content/stories/proofread/proofreadStory';
import { RECRUIT_STORY } from '../../src/gameplay/content/stories/recruit/recruitStory';
import { DUC_STORY } from '../../src/gameplay/content/stories/duc/ducStory';
import { YOUXUEPAI_STORY } from '../../src/gameplay/content/stories/youxuepai/youxuepaiStory';
import { DIAN_STORY } from '../../src/gameplay/content/stories/dian/dianStory';
import { ORCA_STORY } from '../../src/gameplay/content/stories/orca/orcaStory';
import { LETTER_STORY } from '../../src/gameplay/content/stories/letter/letterStory';
import { HUMAN_STORY } from '../../src/gameplay/content/stories/human/humanStory';
import { BEAUTY_STORY } from '../../src/gameplay/content/stories/beauty/beautyStory';
import { ZILAN_STORY } from '../../src/gameplay/content/stories/zilan/zilanStory';
import { BIRCH_STORY } from '../../src/gameplay/content/stories/birch/birchStory';
import { DEMOCRACY_STORY } from '../../src/gameplay/content/stories/democracy/democracyStory';
import { CITYIN_STORY } from '../../src/gameplay/content/stories/cityin/cityinStory';
import { FUKUSHIMA_STORY } from '../../src/gameplay/content/stories/fukushima/fukushimaStory';
import { WANDERING_STORY } from '../../src/gameplay/content/stories/wandering/wanderingStory';
import { TOUR_STORY } from '../../src/gameplay/content/stories/tour/tourStory';
import { YOUTH_STORY } from '../../src/gameplay/content/stories/youth/youthStory';
import { LIBERATION_STORY } from '../../src/gameplay/content/stories/liberation/liberationStory';
import { WEEKLY_STORY } from '../../src/gameplay/content/stories/weekly/weeklyStory';
import { HUIGUI_STORY } from '../../src/gameplay/content/stories/huigui/huiguiStory';
import { REVERBERATE_STORY } from '../../src/gameplay/content/stories/reverberate/reverberateStory';
import { ASKWAY_STORY } from '../../src/gameplay/content/stories/askway/askwayStory';

const ALL_SIDE_STORIES: readonly StoryDefinition[] = [
  MAGI_STORY, OVERCOAT_STORY, YESTERDAY_SONG, ICE_SANCTUM_STORY,
  REDDOT_STORY, SINGLESTEP_STORY, PROOFREAD_STORY, RECRUIT_STORY,
  DUC_STORY, YOUXUEPAI_STORY, DIAN_STORY, ORCA_STORY,
  LETTER_STORY, HUMAN_STORY, BEAUTY_STORY, ZILAN_STORY,
  BIRCH_STORY, DEMOCRACY_STORY, CITYIN_STORY, FUKUSHIMA_STORY,
  WANDERING_STORY, TOUR_STORY, YOUTH_STORY, LIBERATION_STORY,
  WEEKLY_STORY, HUIGUI_STORY, REVERBERATE_STORY, ASKWAY_STORY,
];

test('side story ids are unique', () => {
  const ids = ALL_SIDE_STORIES.map((story) => story.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate story id: ${ids.join(', ')}`);
});

test('side story definitions are structurally sound', () => {
  for (const story of ALL_SIDE_STORIES) {
    assert(story.nodes[story.startNode], `${story.id}: missing start node ${story.startNode}`);
    assertInteractionsResolve(story);
    for (const interaction of story.worldInteractions ?? []) {
      const node = story.nodes[interaction.nodeId];
      assert(node, `${story.id}: missing world interaction node ${interaction.nodeId}`);
      assert(node.choices?.some((choice) => choice.id === interaction.choiceId), `${story.id}: missing world choice ${interaction.choiceId}`);
    }
    for (const node of Object.values(story.nodes)) {
      for (const choice of node.choices ?? []) assert(story.nodes[choice.next], `${story.id}: ${node.id} -> missing ${choice.next}`);
    }
  }
});

test('every side story node is reachable from its start node', () => {
  for (const story of ALL_SIDE_STORIES) {
    const seen = new Set<string>([story.startNode]);
    const queue = [story.startNode];
    while (queue.length > 0) {
      const node = story.nodes[queue.shift()!];
      for (const choice of node?.choices ?? []) {
        if (seen.has(choice.next)) continue;
        seen.add(choice.next);
        queue.push(choice.next);
      }
    }
    const orphans = Object.keys(story.nodes).filter((id) => !seen.has(id));
    assert.deepEqual(orphans, [], `${story.id}: unreachable nodes ${orphans.join(', ')}`);
  }
});

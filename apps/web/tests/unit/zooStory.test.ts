import assert from 'node:assert/strict';
import test from 'node:test';
import { ZOO_STORY } from '../../src/gameplay/content/stories/zoo/zooStory';
import { ZOO_PLAYER_TEXT } from '../../src/gameplay/content/stories/zoo/zooContent';
import {
  S013_COMPLETED_ACHIEVEMENT,
  ZOO_ACHIEVEMENT_IDS,
  ZOO_DECLARED_FLAGS,
  ZOO_EXHIBIT_FLAGS,
  ZOO_FLAGS,
  ZOO_WORLD_POINT_IDS,
} from '../../src/gameplay/content/stories/zoo/zooMeta';
import type { StoryChoice, StoryCondition, StoryNode } from '../../src/gameplay/stories/types';

const nodes = ZOO_STORY.nodes;
const nodeList = Object.values(nodes);

function conditionsOf(choice: StoryChoice): readonly StoryCondition[] {
  return choice.availableWhen ?? [];
}

function reachableNodes(): Set<string> {
  const visited = new Set<string>([ZOO_STORY.startNode]);
  const queue = [ZOO_STORY.startNode];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes[id];
    assert(node, `missing node while walking: ${id}`);
    for (const choice of node.choices ?? []) {
      if (!visited.has(choice.next)) {
        visited.add(choice.next);
        queue.push(choice.next);
      }
    }
  }
  return visited;
}

test('zoo story keys and node ids stay in sync', () => {
  for (const [key, node] of Object.entries(nodes)) {
    assert.equal(node.id, key, `node key/id mismatch at ${key}`);
  }
  assert(nodes[ZOO_STORY.startNode], 'start node must exist');
});

test('every zoo choice destination exists', () => {
  for (const node of nodeList) {
    for (const choice of node.choices ?? []) {
      assert(nodes[choice.next], `${node.id}: missing destination ${choice.next}`);
    }
  }
});

test('every zoo world interaction targets an existing node and choice', () => {
  const interactions = ZOO_STORY.worldInteractions ?? [];
  assert.equal(interactions.length, ZOO_WORLD_POINT_IDS.length);
  for (const interaction of interactions) {
    assert(
      (ZOO_WORLD_POINT_IDS as readonly string[]).includes(interaction.interestPointId),
      `unexpected world interest point ${interaction.interestPointId}`,
    );
    const node = nodes[interaction.nodeId];
    assert(node, `missing world interaction node ${interaction.nodeId}`);
    assert(
      node.choices?.some((choice) => choice.id === interaction.choiceId),
      `missing world interaction choice ${interaction.choiceId}`,
    );
  }
});

test('every zoo NPC interaction targets an existing node and choice', () => {
  for (const interaction of ZOO_STORY.interactions ?? []) {
    const node = nodes[interaction.nodeId];
    assert(node, `missing NPC interaction node ${interaction.nodeId}`);
    assert(
      node.choices?.some((choice) => choice.id === interaction.choiceId),
      `missing NPC interaction choice ${interaction.choiceId}`,
    );
  }
});

test('all three zoo terminal endings are reachable from the start', () => {
  const reachable = reachableNodes();
  for (const ending of ['ending-keep', 'ending-joy', 'ending-pass']) {
    const node = nodes[ending];
    assert(node, `missing terminal ${ending}`);
    assert(node.terminal, `${ending} must be terminal`);
    assert.equal(node.choices?.length ?? 0, 0, `${ending} must not loop`);
    assert(reachable.has(ending), `${ending} must be reachable from ${ZOO_STORY.startNode}`);
  }
  const ruleBlank = nodes['rule-blank'];
  assert(ruleBlank, 'missing rule-blank');
  for (const choiceId of ['rule-keep', 'rule-joy', 'rule-pass']) {
    const choice: StoryChoice | undefined = ruleBlank.choices?.find((item) => item.id === choiceId);
    assert(choice, `missing ending choice ${choiceId}`);
    assert.equal(choice.ending, 'zoo.rule-eight', `${choiceId} must carry the shared ending id`);
  }
});

test('zoo flags and conditions only reference declared flags', () => {
  const declared = new Set(ZOO_DECLARED_FLAGS);
  const achievementIds = new Set<string>([
    ...Object.values(ZOO_ACHIEVEMENT_IDS),
    S013_COMPLETED_ACHIEVEMENT,
  ]);

  for (const node of nodeList) {
    for (const condition of node.guide?.visibleWhen ?? []) {
      if (condition.type === 'flag.equals') {
        assert(declared.has(condition.flagId), `${node.id}: undeclared guide flag ${condition.flagId}`);
      }
    }
    for (const choice of node.choices ?? []) {
      for (const [flagId] of Object.entries(choice.set ?? {})) {
        assert(declared.has(flagId), `${node.id}/${choice.id}: undeclared set flag ${flagId}`);
      }
      for (const effect of choice.effects ?? []) {
        if (effect.type === 'flag.set') {
          assert(declared.has(effect.flagId), `${node.id}/${choice.id}: undeclared effect flag ${effect.flagId}`);
        }
      }
      for (const condition of conditionsOf(choice)) {
        if (condition.type === 'flag.equals') {
          assert(declared.has(condition.flagId), `${node.id}/${choice.id}: undeclared condition flag ${condition.flagId}`);
        }
        if (condition.type === 'achievement.unlocked') {
          assert(achievementIds.has(condition.achievementId), `${node.id}/${choice.id}: unknown achievement ${condition.achievementId}`);
        }
      }
    }
  }
});

test('museum and meeting gates require the five exhibit flags', () => {
  const hub = nodes['exhibits-open'];
  assert(hub, 'missing exhibits hub');

  const museum = hub.choices?.find((choice) => choice.id === 'enter-museum');
  assert(museum, 'missing enter-museum choice');
  const museumFlags = conditionsOf(museum)
    .filter((condition) => condition.type === 'flag.equals')
    .map((condition) => condition.flagId);
  for (const flagId of ZOO_EXHIBIT_FLAGS) {
    assert(museumFlags.includes(flagId), `museum gate missing ${flagId}`);
  }

  const meeting = hub.choices?.find((choice) => choice.id === 'attend-meeting');
  assert(meeting, 'missing attend-meeting choice');
  const meetingFlags = conditionsOf(meeting)
    .filter((condition) => condition.type === 'flag.equals')
    .map((condition) => condition.flagId);
  for (const flagId of ZOO_EXHIBIT_FLAGS) {
    assert(meetingFlags.includes(flagId), `meeting gate missing ${flagId}`);
  }
  assert(meetingFlags.includes(ZOO_FLAGS.museumDone), 'meeting gate missing museum completion');
});

test('S013-only branch stays gated by its achievement', () => {
  const gated: StoryChoice[] = [];
  for (const node of nodeList) {
    for (const choice of node.choices ?? []) {
      if (conditionsOf(choice).some(
        (condition) => condition.type === 'achievement.unlocked'
          && condition.achievementId === S013_COMPLETED_ACHIEVEMENT,
      )) {
        gated.push(choice);
      }
    }
  }
  assert(gated.length >= 2, 'expected meeting and keeper S013 branches');
});

test('zoo story imports without raster assets', () => {
  for (const node of nodeList) {
    assert.equal(node.image, undefined, `${node.id} must not depend on a raster asset`);
  }
  assert.equal(ZOO_STORY.id, 'side.s014.zoo');
});

test('zoo player-facing copy contains no red-line tokens', () => {
  const forbidden = [
    '兔子', '兔血', '白狮', '海洋馆',
    '1:15', 'SCP', 'scp',
    '被放逐者', '放逐者', '小人物', '孤独', '假想朋友',
    '13 岁', '13岁', '自杀', '自尽',
    'rabbit', 'Rabbit',
  ];
  const strings: string[] = [...ZOO_PLAYER_TEXT];
  for (const node of nodeList) {
    strings.push(node.text, node.title ?? '', node.role ?? '', node.achievement?.name ?? '');
    if (node.guide) strings.push(node.guide.title, node.guide.objective);
    for (const choice of node.choices ?? []) strings.push(choice.label);
  }
  for (const value of strings) {
    for (const token of forbidden) {
      assert(!value.includes(token), `red-line token "${token}" leaked in: ${value.slice(0, 80)}`);
    }
  }
});

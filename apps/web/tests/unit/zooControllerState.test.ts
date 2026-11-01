import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isZooStorySuspended,
  resolveZooPointActivation,
  zooMeetingReady,
} from '../../src/city/zoo/zooControllerState';
import { normalizePendingAchievementIds, parsePendingAchievementIds } from '../../src/city/zoo/zooPending';
import { ZOO_ACHIEVEMENT_IDS, ZOO_POINT_IDS } from '../../src/gameplay/content/stories/zoo/zooMeta';
import { nextZooMeetingDayKey } from '../../src/city/zoo/zooTime';

const noExhibits = [false, false, false, false, false];
const allExhibits = [true, true, true, true, true];

test('suspension starts after museum-done and ends inside the meeting window', () => {
  assert.equal(isZooStorySuspended({ museumDone: false, meetingDone: false, meetingWindow: false }), false);
  assert.equal(isZooStorySuspended({ museumDone: true, meetingDone: false, meetingWindow: false }), true);
  assert.equal(isZooStorySuspended({ museumDone: true, meetingDone: false, meetingWindow: true }), false);
  assert.equal(isZooStorySuspended({ museumDone: true, meetingDone: true, meetingWindow: false }), false);
});

test('exhibit markers only appear at the hub before each visit', () => {
  const early = resolveZooPointActivation({
    nodeId: 'gate-intro',
    ticketAnswered: false,
    exhibits: noExhibits,
    museumDone: false,
    meetingDone: false,
    meetingWindow: false,
  });
  assert.deepEqual(early, []);

  const hub = resolveZooPointActivation({
    nodeId: 'exhibits-open',
    ticketAnswered: true,
    exhibits: [true, false, false, false, false],
    museumDone: false,
    meetingDone: false,
    meetingWindow: false,
  });
  assert.ok(hub.includes(ZOO_POINT_IDS.cat));
  assert.ok(!hub.includes(ZOO_POINT_IDS.pigeon));
  assert.ok(!hub.includes(ZOO_POINT_IDS.museum));
  assert.ok(hub.includes(ZOO_POINT_IDS.stand));
  assert.ok(!hub.includes(ZOO_POINT_IDS.office));
});

test('museum, office, and custom markers unlock on their own gates', () => {
  const afterMuseum = resolveZooPointActivation({
    nodeId: 'exhibits-open',
    ticketAnswered: true,
    exhibits: allExhibits,
    museumDone: true,
    meetingDone: false,
    meetingWindow: true,
  });
  assert.ok(afterMuseum.includes(ZOO_POINT_IDS.museum));
  assert.ok(afterMuseum.includes(ZOO_POINT_IDS.office));
  assert.ok(afterMuseum.includes(ZOO_POINT_IDS.phone));

  const waiting = resolveZooPointActivation({
    nodeId: 'exhibits-open',
    ticketAnswered: true,
    exhibits: allExhibits,
    museumDone: true,
    meetingDone: false,
    meetingWindow: false,
  });
  assert.ok(!waiting.includes(ZOO_POINT_IDS.office));

  const done = resolveZooPointActivation({
    nodeId: 'ending-keep',
    ticketAnswered: true,
    exhibits: allExhibits,
    museumDone: true,
    meetingDone: true,
    meetingWindow: true,
  });
  assert.ok(!done.includes(ZOO_POINT_IDS.office));
});

test('meeting readiness needs all five exhibits and the museum', () => {
  assert.equal(zooMeetingReady({ exhibits: noExhibits, museumDone: true }), false);
  assert.equal(zooMeetingReady({ exhibits: allExhibits, museumDone: false }), false);
  assert.equal(zooMeetingReady({ exhibits: allExhibits, museumDone: true }), true);
});

test('pending achievement ids are deduped and limited to zoo ids', () => {
  assert.deepEqual(
    normalizePendingAchievementIds([
      ZOO_ACHIEVEMENT_IDS.ruleEight,
      ZOO_ACHIEVEMENT_IDS.ruleEight,
      's013_completed',
      ZOO_ACHIEVEMENT_IDS.childHeart,
      42,
    ]),
    [ZOO_ACHIEVEMENT_IDS.ruleEight, ZOO_ACHIEVEMENT_IDS.childHeart],
  );
  assert.deepEqual(parsePendingAchievementIds('{bad-json'), []);
  assert.deepEqual(parsePendingAchievementIds(null), []);
  assert.deepEqual(parsePendingAchievementIds(JSON.stringify([ZOO_ACHIEVEMENT_IDS.rollCall])), [ZOO_ACHIEVEMENT_IDS.rollCall]);
});

test('next meeting day key skips to the first Friday', () => {
  assert.equal(nextZooMeetingDayKey(Date.UTC(2026, 10, 1, 4, 0, 0)), '2026-11-06');
  assert.equal(nextZooMeetingDayKey(Date.UTC(2026, 10, 6, 4, 0, 0)), '2026-11-06');
  assert.equal(nextZooMeetingDayKey(Date.UTC(2026, 10, 7, 4, 0, 0)), '2026-12-04');
});

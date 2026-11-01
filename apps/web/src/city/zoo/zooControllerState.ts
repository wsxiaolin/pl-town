import { ZOO_POINT_IDS } from '../../gameplay/content/stories/zoo/zooMeta';

export interface ZooPointActivationInput {
  nodeId: string;
  ticketAnswered: boolean;
  exhibits: readonly boolean[];
  museumDone: boolean;
  meetingDone: boolean;
  meetingWindow: boolean;
}

const EXHIBIT_POINTS = [
  ZOO_POINT_IDS.pigeon,
  ZOO_POINT_IDS.cat,
  ZOO_POINT_IDS.monkey,
  ZOO_POINT_IDS.beast,
  ZOO_POINT_IDS.waterfowl,
] as const;

export const ZOO_CUSTOM_POINT_IDS = [
  ZOO_POINT_IDS.stand,
  ZOO_POINT_IDS.signin,
  ZOO_POINT_IDS.borrowNote,
  ZOO_POINT_IDS.doorplate,
  ZOO_POINT_IDS.phone,
  ZOO_POINT_IDS.proxySign,
] as const;

export function resolveZooPointActivation(input: ZooPointActivationInput): string[] {
  const ids = new Set<string>();
  const allExhibits = input.exhibits.length >= EXHIBIT_POINTS.length && input.exhibits.every(Boolean);

  if (input.nodeId === 'exhibits-open') {
    EXHIBIT_POINTS.forEach((id, index) => {
      if (!input.exhibits[index]) ids.add(id);
    });
    if (allExhibits) ids.add(ZOO_POINT_IDS.museum);
  }

  if (input.ticketAnswered) {
    ZOO_CUSTOM_POINT_IDS.forEach((id) => ids.add(id));
  }

  if (allExhibits && input.museumDone && !input.meetingDone && input.meetingWindow) {
    ids.add(ZOO_POINT_IDS.office);
  }

  return [...ids];
}

export interface ZooSuspensionInput {
  museumDone: boolean;
  meetingDone: boolean;
  meetingWindow: boolean;
}

export function isZooStorySuspended(input: ZooSuspensionInput): boolean {
  return input.museumDone && !input.meetingDone && !input.meetingWindow;
}

export function zooMeetingReady(input: { exhibits: readonly boolean[]; museumDone: boolean }): boolean {
  return input.exhibits.length >= EXHIBIT_POINTS.length
    && input.exhibits.every(Boolean)
    && input.museumDone;
}

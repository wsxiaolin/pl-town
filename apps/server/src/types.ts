export type Position = { x: number; y: number; z: number; rotation?: number };

export type User = {
  id: string;
  nickname: string;
  email: string | null;
  position: Position;
};

export type PlayerProgress = {
  currency: number;
  inventory: Record<string, number>;
  achievements: string[];
  unlockedBuildings: string[];
  visitedBuildings: string[];
};

export type StoryFlagValue = boolean | number | string | null;

/** Server-owned state for a client-defined story. Story text/content stays client-side. */
export type StoryProgress = {
  storyId: string;
  definitionVersion: number;
  nodeId: string;
  flags: Record<string, StoryFlagValue>;
  ending: string | null;
  visitCount: number;
  updatedAt: string;
};

export type ClientMessage =
  | { type: 'hello'; token?: string; nickname?: string; password?: string }
  | { type: 'position'; position: Position }
  | { type: 'chat'; text: string }
  | { type: 'progress.get' }
  | { type: 'progress.building.visit'; buildingId: string }
  | { type: 'progress.building.unlock'; buildingId: string }
  | { type: 'progress.achievement.unlock'; achievementId: string }
  | { type: 'progress.shop.buy'; productId: string; quantity?: number }
  | { type: 'progress.item.consume'; itemId: string; quantity?: number }
  | { type: 'progress.reward.claim'; rewardId: string }
  | { type: 'story.get'; storyId: string }
  | { type: 'story.update'; storyId: string; definitionVersion?: number; nodeId?: string; flags?: Record<string, StoryFlagValue>; ending?: string | null; visit?: boolean }
  | { type: 'housing.list' }
  | { type: 'housing.claim'; buildingId: string; name?: string }
  | { type: 'housing.rename'; buildingId: string; name: string }
  | { type: 'housing.invite'; buildingId: string; userId: string }
  | { type: 'housing.apply'; buildingId: string }
  | { type: 'housing.accept'; requestId: number }
  | { type: 'housing.decline'; requestId: number }
  | { type: 'housing.kick'; buildingId: string; userId: string }
  | { type: 'housing.leave'; buildingId: string }
  | { type: 'housing.transfer'; buildingId: string; userId: string }
  | { type: 'housing.release'; buildingId: string };

export type ServerMessage = {
  type: string;
  [key: string]: unknown;
};

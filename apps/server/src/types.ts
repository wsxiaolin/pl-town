export type Position = { x: number; y: number; z: number; rotation?: number };

export type User = {
  id: string;
  nickname: string;
  email: string | null;
  position: Position;
};

export type ClientMessage =
  | { type: 'hello'; token?: string; nickname?: string; password?: string }
  | { type: 'position'; position: Position }
  | { type: 'chat'; text: string }
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

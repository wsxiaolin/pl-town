import Database from 'better-sqlite3';
import { DATABASE_PATH } from './config.js';
import type { Position, User } from './types.js';

export type House = {
  buildingId: string;
  name: string | null;
  ownerId: string;
  ownerNickname: string;
  members: Array<{ userId: string; nickname: string }>;
};

export type HousingRequest = {
  id: number;
  buildingId: string;
  houseName: string | null;
  ownerId: string;
  ownerNickname: string;
  requesterId: string;
  requesterNickname: string;
  targetId: string;
  targetNickname: string;
  kind: 'invite' | 'application';
  createdAt: string;
};

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    position_z REAL NOT NULL DEFAULT 0,
    rotation REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS houses (
    building_id TEXT PRIMARY KEY,
    name TEXT,
    owner_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS house_members (
    building_id TEXT NOT NULL REFERENCES houses(building_id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TEXT NOT NULL,
    PRIMARY KEY (building_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS house_members_user_idx ON house_members(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS house_members_one_home_idx ON house_members(user_id);
  CREATE TABLE IF NOT EXISTS housing_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id TEXT NOT NULL REFERENCES houses(building_id) ON DELETE CASCADE,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('invite', 'application')),
    created_at TEXT NOT NULL,
    UNIQUE (building_id, requester_id, target_id, kind)
  );
  CREATE INDEX IF NOT EXISTS housing_requests_target_idx ON housing_requests(target_id, created_at);
  CREATE INDEX IF NOT EXISTS housing_requests_requester_idx ON housing_requests(requester_id, created_at);
`);
{
  const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
}
{
  const existing = db.prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'users_nickname_unique'`).get() as { count: number };
  if (!existing.count) {
    const duplicates = db.prepare(`SELECT nickname FROM users GROUP BY nickname COLLATE NOCASE HAVING COUNT(*) > 1`).all() as Array<{ nickname: string }>;
    for (const duplicate of duplicates) {
      const rows = db.prepare(`SELECT rowid FROM users WHERE nickname = ? COLLATE NOCASE ORDER BY rowid`).all(duplicate.nickname) as Array<{ rowid: number }>;
      rows.slice(1).forEach((row) => db.prepare('UPDATE users SET nickname = ?, updated_at = ? WHERE rowid = ?').run(`${duplicate.nickname}${row.rowid}`, new Date().toISOString(), row.rowid));
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_unique ON users (nickname COLLATE NOCASE)');
  }
}

const now = () => new Date().toISOString();
const rowUser = (row: any): User => ({ id: row.id, nickname: row.nickname, email: row.email, position: { x: row.position_x, y: row.position_y, z: row.position_z, rotation: row.rotation ?? undefined } });

export function createUser(id: string, tokenHash: string, nickname: string, passwordHash: string): User {
  const timestamp = now();
  db.prepare('INSERT INTO users (id, nickname, password_hash, token_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, nickname, passwordHash, tokenHash, timestamp, timestamp);
  return getUser(id)!;
}
export function getUserByToken(tokenHash: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE token_hash = ?').get(tokenHash);
  return row ? rowUser(row) : null;
}
export function getUserByNickname(nickname: string): { id: string; nickname: string; passwordHash: string | null } | null {
  const row = db.prepare('SELECT id, nickname, password_hash FROM users WHERE nickname = ? COLLATE NOCASE').get(nickname) as { id: string; nickname: string; password_hash: string | null } | undefined;
  return row ? { id: row.id, nickname: row.nickname, passwordHash: row.password_hash } : null;
}
export function updateUserToken(id: string, tokenHash: string): void {
  db.prepare('UPDATE users SET token_hash = ?, updated_at = ? WHERE id = ?').run(tokenHash, now(), id);
}
export function getUser(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ? rowUser(row) : null;
}
export function updateUserProfile(id: string, nickname: string, email?: string): void {
  db.prepare('UPDATE users SET nickname = ?, email = COALESCE(?, email), updated_at = ? WHERE id = ?').run(nickname, email ?? null, now(), id);
}
export function savePosition(id: string, position: Position): void {
  db.prepare('UPDATE users SET position_x = ?, position_y = ?, position_z = ?, rotation = ?, updated_at = ? WHERE id = ?').run(position.x, position.y, position.z, position.rotation ?? null, now(), id);
}
export function listHouses(): House[] {
  const rows = db.prepare(`SELECT h.*, u.nickname AS owner_nickname FROM houses h JOIN users u ON u.id = h.owner_id ORDER BY h.building_id`).all() as any[];
  return rows.map((row) => ({ buildingId: row.building_id, name: row.name, ownerId: row.owner_id, ownerNickname: row.owner_nickname, members: (db.prepare('SELECT hm.user_id, u.nickname FROM house_members hm JOIN users u ON u.id = hm.user_id WHERE hm.building_id = ? ORDER BY hm.joined_at').all(row.building_id) as any[]).map((m) => ({ userId: m.user_id, nickname: m.nickname })) }));
}
export function getHouse(buildingId: string): House | null { return listHouses().find((house) => house.buildingId === buildingId) ?? null; }
export function claimHouse(buildingId: string, ownerId: string, name?: string): void {
  const timestamp = now();
  const transaction = db.transaction(() => {
    const existingMembership = db.prepare('SELECT 1 FROM house_members WHERE user_id = ?').get(ownerId);
    if (existingMembership) throw new Error('User already lives in a house');
    db.prepare('INSERT INTO houses (building_id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(buildingId, name?.trim() || null, ownerId, timestamp, timestamp);
    db.prepare('INSERT INTO house_members (building_id, user_id, joined_at) VALUES (?, ?, ?)').run(buildingId, ownerId, timestamp);
  });
  transaction();
}
export function renameHouse(buildingId: string, name: string): void { db.prepare('UPDATE houses SET name = ?, updated_at = ? WHERE building_id = ?').run(name.trim(), now(), buildingId); }
export function addMember(buildingId: string, userId: string): void { db.prepare('INSERT INTO house_members (building_id, user_id, joined_at) VALUES (?, ?, ?)').run(buildingId, userId, now()); }
export function removeMember(buildingId: string, userId: string): void { db.prepare('DELETE FROM house_members WHERE building_id = ? AND user_id = ?').run(buildingId, userId); }
export function transferHouse(buildingId: string, userId: string): void { db.prepare('UPDATE houses SET owner_id = ?, updated_at = ? WHERE building_id = ?').run(userId, now(), buildingId); }
export function deleteHouse(buildingId: string): void { db.prepare('DELETE FROM houses WHERE building_id = ?').run(buildingId); }

const requestQuery = `
  SELECT r.id, r.building_id, r.requester_id, r.target_id, r.kind, r.created_at,
         h.name AS house_name, h.owner_id, owner.nickname AS owner_nickname,
         requester.nickname AS requester_nickname, target.nickname AS target_nickname
  FROM housing_requests r
  JOIN houses h ON h.building_id = r.building_id
  JOIN users owner ON owner.id = h.owner_id
  JOIN users requester ON requester.id = r.requester_id
  JOIN users target ON target.id = r.target_id
  WHERE r.requester_id = ? OR r.target_id = ?
  ORDER BY r.created_at DESC
`;
const rowRequest = (row: any): HousingRequest => ({
  id: row.id,
  buildingId: row.building_id,
  houseName: row.house_name,
  ownerId: row.owner_id,
  ownerNickname: row.owner_nickname,
  requesterId: row.requester_id,
  requesterNickname: row.requester_nickname,
  targetId: row.target_id,
  targetNickname: row.target_nickname,
  kind: row.kind,
  createdAt: row.created_at,
});
export function listHousingRequestsForUser(userId: string): HousingRequest[] {
  return (db.prepare(requestQuery).all(userId, userId) as any[]).map(rowRequest);
}
export function getHousingRequest(id: number): HousingRequest | null {
  const row = db.prepare(`${requestQuery.replace('WHERE r.requester_id = ? OR r.target_id = ?', 'WHERE r.id = ?')}`).get(id);
  return row ? rowRequest(row) : null;
}
export function createHousingRequest(buildingId: string, requesterId: string, targetId: string, kind: HousingRequest['kind']): void {
  db.prepare('INSERT INTO housing_requests (building_id, requester_id, target_id, kind, created_at) VALUES (?, ?, ?, ?, ?)').run(buildingId, requesterId, targetId, kind, now());
}
export function deleteHousingRequest(id: number): void { db.prepare('DELETE FROM housing_requests WHERE id = ?').run(id); }
export function deleteHousingRequestsForUser(userId: string): void {
  db.prepare('DELETE FROM housing_requests WHERE requester_id = ? OR target_id = ?').run(userId, userId);
}

import Database from 'better-sqlite3';
import { DATABASE_PATH } from './config.js';
import { INITIAL_CURRENCY } from './progression.js';
import type { PlayerProgress, Position, User } from './types.js';

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
  CREATE TABLE IF NOT EXISTS player_progress (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    currency INTEGER NOT NULL CHECK (currency >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS player_inventory (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, item_id)
  );
  CREATE TABLE IF NOT EXISTS player_achievements (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, achievement_id)
  );
  CREATE TABLE IF NOT EXISTS player_building_unlocks (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, building_id)
  );
  CREATE TABLE IF NOT EXISTS player_building_visits (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    building_id TEXT NOT NULL,
    first_visited_at TEXT NOT NULL,
    PRIMARY KEY (user_id, building_id)
  );
  CREATE TABLE IF NOT EXISTS player_reward_claims (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id TEXT NOT NULL,
    claim_key TEXT NOT NULL,
    claimed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, reward_id, claim_key)
  );
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

function ensureProgress(userId: string): void {
  const timestamp = now();
  db.prepare('INSERT OR IGNORE INTO player_progress (user_id, currency, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(userId, INITIAL_CURRENCY, timestamp, timestamp);
}

function addInventory(userId: string, itemId: string, quantity: number): void {
  db.prepare(`
    INSERT INTO player_inventory (user_id, item_id, quantity, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at
  `).run(userId, itemId, quantity, now());
}

export function getPlayerProgress(userId: string): PlayerProgress {
  ensureProgress(userId);
  const currency = (db.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(userId) as { currency: number }).currency;
  const inventoryRows = db.prepare('SELECT item_id, quantity FROM player_inventory WHERE user_id = ? ORDER BY item_id').all(userId) as Array<{ item_id: string; quantity: number }>;
  const inventory = Object.fromEntries(inventoryRows.map((row) => [row.item_id, row.quantity]));
  const achievements = (db.prepare('SELECT achievement_id FROM player_achievements WHERE user_id = ? ORDER BY unlocked_at, achievement_id').all(userId) as Array<{ achievement_id: string }>).map((row) => row.achievement_id);
  const unlockedBuildings = (db.prepare('SELECT building_id FROM player_building_unlocks WHERE user_id = ? ORDER BY unlocked_at, building_id').all(userId) as Array<{ building_id: string }>).map((row) => row.building_id);
  const visitedBuildings = (db.prepare('SELECT building_id FROM player_building_visits WHERE user_id = ? ORDER BY first_visited_at, building_id').all(userId) as Array<{ building_id: string }>).map((row) => row.building_id);
  return { currency, inventory, achievements, unlockedBuildings, visitedBuildings };
}

export function recordBuildingVisit(userId: string, buildingId: string): { progress: PlayerProgress; welcomeItemsGranted: boolean } {
  let welcomeItemsGranted = false;
  db.transaction(() => {
    ensureProgress(userId);
    const inserted = db.prepare('INSERT OR IGNORE INTO player_building_visits (user_id, building_id, first_visited_at) VALUES (?, ?, ?)').run(userId, buildingId, now());
    if (!inserted.changes) return;
    const count = (db.prepare('SELECT COUNT(*) AS count FROM player_building_visits WHERE user_id = ?').get(userId) as { count: number }).count;
    if (count === 2) {
      addInventory(userId, 'city_guide', 1);
      addInventory(userId, 'city_badge', 1);
      welcomeItemsGranted = true;
    }
  })();
  return { progress: getPlayerProgress(userId), welcomeItemsGranted };
}

export function unlockAchievement(userId: string, achievementId: string, currencyReward: number): { progress: PlayerProgress; unlocked: boolean } {
  let unlocked = false;
  db.transaction(() => {
    ensureProgress(userId);
    const result = db.prepare('INSERT OR IGNORE INTO player_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)').run(userId, achievementId, now());
    if (!result.changes) return;
    db.prepare('UPDATE player_progress SET currency = currency + ?, updated_at = ? WHERE user_id = ?').run(currencyReward, now(), userId);
    unlocked = true;
  })();
  return { progress: getPlayerProgress(userId), unlocked };
}

export function purchaseBuilding(userId: string, buildingId: string, price: number): { progress: PlayerProgress; unlocked: boolean } {
  let unlocked = false;
  db.transaction(() => {
    ensureProgress(userId);
    if (db.prepare('SELECT 1 FROM player_building_unlocks WHERE user_id = ? AND building_id = ?').get(userId, buildingId)) return;
    if (price > 0) {
      const charged = db.prepare('UPDATE player_progress SET currency = currency - ?, updated_at = ? WHERE user_id = ? AND currency >= ?').run(price, now(), userId, price);
      if (!charged.changes) throw new Error('Insufficient currency');
    }
    db.prepare('INSERT INTO player_building_unlocks (user_id, building_id, unlocked_at) VALUES (?, ?, ?)').run(userId, buildingId, now());
    unlocked = true;
  })();
  return { progress: getPlayerProgress(userId), unlocked };
}

export function purchaseItem(userId: string, itemId: string, quantity: number, unitPrice: number): PlayerProgress {
  db.transaction(() => {
    ensureProgress(userId);
    const total = quantity * unitPrice;
    const charged = db.prepare('UPDATE player_progress SET currency = currency - ?, updated_at = ? WHERE user_id = ? AND currency >= ?').run(total, now(), userId, total);
    if (!charged.changes) throw new Error('Insufficient currency');
    addInventory(userId, itemId, quantity);
  })();
  return getPlayerProgress(userId);
}

export function consumeItem(userId: string, itemId: string, quantity: number): PlayerProgress {
  db.transaction(() => {
    ensureProgress(userId);
    const row = db.prepare('SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId) as { quantity: number } | undefined;
    if (!row || row.quantity < quantity) throw new Error('Item is not available');
    if (row.quantity === quantity) db.prepare('DELETE FROM player_inventory WHERE user_id = ? AND item_id = ?').run(userId, itemId);
    else db.prepare('UPDATE player_inventory SET quantity = quantity - ?, updated_at = ? WHERE user_id = ? AND item_id = ?').run(quantity, now(), userId, itemId);
  })();
  return getPlayerProgress(userId);
}

export function claimReward(userId: string, rewardId: string, claimKey: string, itemId: string, quantity: number): { progress: PlayerProgress; claimed: boolean } {
  let claimed = false;
  db.transaction(() => {
    ensureProgress(userId);
    const inserted = db.prepare('INSERT OR IGNORE INTO player_reward_claims (user_id, reward_id, claim_key, claimed_at) VALUES (?, ?, ?, ?)').run(userId, rewardId, claimKey, now());
    if (!inserted.changes) return;
    addInventory(userId, itemId, quantity);
    claimed = true;
  })();
  return { progress: getPlayerProgress(userId), claimed };
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

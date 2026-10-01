import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { initializeCityGovernance } from './cityGovernanceSchema.js';
import { CITY_CONSTRUCTION_CONFIG } from './data/cityConstructionConfig.js';
import { DATA_DIR, DATABASE_PATH } from './config.js';
import { MINICITY_APPLICATION_ID, MINICITY_SCHEMA_VERSION } from './databaseMetadata.js';
import { ensureProgress, addInventory } from './playerProgressDefaults.js';
import { previousDayKey, shanghaiDayKey } from './shanghaiTime.js';
import { acquireRuntimeLock, releaseRuntimeLock } from './runtimeLock.js';
import type { PlayerProgress, Position, StoryFlagValue, StoryProgress, User } from './types.js';
import type {
  NpcChangeRequestRow,
  StoryProgressDbRow,
  UserRow,
} from './dbRows.js';
export * from './dbChat.js';
export * from './dbHousing.js';
export * from './dbAdmin.js';

acquireRuntimeLock(DATA_DIR, 'server');
export const db = new Database(DATABASE_PATH);
const existingApplicationId = Number(db.pragma('application_id', { simple: true })) || 0;
const existingSchemaVersion = Number(db.pragma('user_version', { simple: true })) || 0;
if (existingApplicationId !== 0 && existingApplicationId !== MINICITY_APPLICATION_ID) throw new Error('Database does not belong to MiniCity');
if (existingSchemaVersion > MINICITY_SCHEMA_VERSION) throw new Error(`Database schema ${existingSchemaVersion} is newer than this server supports`);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.exec('BEGIN IMMEDIATE');
try {
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    session_expires_at TEXT,
    disabled_at TEXT,
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
  CREATE TABLE IF NOT EXISTS player_achievement_rewards (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    currency INTEGER NOT NULL CHECK (currency >= 0),
    granted_at TEXT NOT NULL,
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
  CREATE TABLE IF NOT EXISTS player_repeatable_reward_claims (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id TEXT NOT NULL,
    claim_count INTEGER NOT NULL CHECK (claim_count >= 0),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, reward_id)
  );
  CREATE TABLE IF NOT EXISTS player_daily_economy (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    day_key TEXT NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0 CHECK (streak >= 0),
    last_check_in_day TEXT,
    check_in_claimed INTEGER NOT NULL DEFAULT 0 CHECK (check_in_claimed IN (0, 1)),
    visited_buildings_json TEXT NOT NULL DEFAULT '[]',
    claimed_missions_json TEXT NOT NULL DEFAULT '[]',
    fulfilled_orders_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );
  -- Listings are an escrow ledger. Creating a listing moves the item out of
  -- the seller inventory; buying or cancelling settles it atomically.
  CREATE TABLE IF NOT EXISTS market_listings (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 20),
    price INTEGER NOT NULL CHECK (price > 0 AND price <= 9999),
    status TEXT NOT NULL CHECK (status IN ('active', 'sold', 'cancelled')),
    buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    closed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS market_listings_active_idx ON market_listings(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS market_listings_seller_idx ON market_listings(seller_id, status, created_at DESC);
  CREATE TABLE IF NOT EXISTS story_progress (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    story_id TEXT NOT NULL,
    definition_version INTEGER NOT NULL DEFAULT 1 CHECK (definition_version >= 1),
    node_id TEXT NOT NULL DEFAULT 'start',
    flags_json TEXT NOT NULL DEFAULT '{}',
    ending TEXT,
    visit_count INTEGER NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, story_id)
  );
  CREATE TABLE IF NOT EXISTS admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit(created_at DESC);
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    text TEXT NOT NULL,
    flagged_at TEXT,
    hidden_at TEXT,
    hidden_by TEXT,
    moderation_status TEXT NOT NULL DEFAULT 'unreviewed',
    moderation_request_id TEXT,
    moderation_risk_types_json TEXT NOT NULL DEFAULT '[]',
    moderation_error TEXT,
    moderated_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages(created_at DESC);
  CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS chat_messages_hidden_idx ON chat_messages(hidden_at);
  CREATE TABLE IF NOT EXISTS account_registrations (
    ip TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (ip, user_id)
  );
  CREATE INDEX IF NOT EXISTS account_registrations_ip_idx ON account_registrations(ip, created_at DESC);
  CREATE TABLE IF NOT EXISTS npc_change_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    requester_nickname TEXT NOT NULL,
    npc_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('add','edit','dialog')),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    change_json TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
    reviewer TEXT,
    review_note TEXT,
    created_at TEXT NOT NULL,
    reviewed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS npc_change_requests_status_idx ON npc_change_requests(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS npc_change_requests_npc_idx ON npc_change_requests(npc_id);
  CREATE TABLE IF NOT EXISTS world_config (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
{
  const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  if (!columns.some((column) => column.name === 'session_expires_at')) db.exec('ALTER TABLE users ADD COLUMN session_expires_at TEXT');
  // Physics Lab account link: set when a resident proved ownership of a
  // nickname that already exists in the Physics Lab community.
  if (!columns.some((column) => column.name === 'pl_user_id')) db.exec('ALTER TABLE users ADD COLUMN pl_user_id TEXT');
  if (!columns.some((column) => column.name === 'disabled_at')) db.exec('ALTER TABLE users ADD COLUMN disabled_at TEXT');
}
{
  const columns = db.prepare('PRAGMA table_info(story_progress)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'definition_version')) db.exec('ALTER TABLE story_progress ADD COLUMN definition_version INTEGER NOT NULL DEFAULT 1');
}
{
  const columns = db.prepare('PRAGMA table_info(chat_messages)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'moderation_status')) db.exec("ALTER TABLE chat_messages ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'unreviewed'");
  if (!columns.some((column) => column.name === 'moderation_request_id')) db.exec('ALTER TABLE chat_messages ADD COLUMN moderation_request_id TEXT');
  if (!columns.some((column) => column.name === 'moderation_risk_types_json')) db.exec("ALTER TABLE chat_messages ADD COLUMN moderation_risk_types_json TEXT NOT NULL DEFAULT '[]'");
  if (!columns.some((column) => column.name === 'moderation_error')) db.exec('ALTER TABLE chat_messages ADD COLUMN moderation_error TEXT');
  if (!columns.some((column) => column.name === 'moderated_at')) db.exec('ALTER TABLE chat_messages ADD COLUMN moderated_at TEXT');
}
if (existingSchemaVersion < 5) {
  db.exec(`
    INSERT INTO player_repeatable_reward_claims (user_id, reward_id, claim_count, updated_at)
    SELECT user_id, reward_id, COUNT(*), MAX(claimed_at)
    FROM player_reward_claims
    WHERE reward_id IN ('ice_reject', 'ice_accept')
    GROUP BY user_id, reward_id
    ON CONFLICT(user_id, reward_id) DO UPDATE SET
      claim_count = MAX(claim_count, excluded.claim_count),
      updated_at = excluded.updated_at;
    DELETE FROM player_reward_claims WHERE reward_id IN ('ice_reject', 'ice_accept');
  `);
}
// Existing achievements may already have paid their legacy reward. Recording
// them prevents an upgrade from paying those rewards a second time.
db.prepare(`
  INSERT OR IGNORE INTO player_achievement_rewards (user_id, achievement_id, currency, granted_at)
  SELECT user_id, achievement_id, 0, unlocked_at FROM player_achievements
`).run();
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
initializeCityGovernance(db);
db.pragma(`application_id = ${MINICITY_APPLICATION_ID}`);
db.pragma(`user_version = ${MINICITY_SCHEMA_VERSION}`);
db.exec('COMMIT');
} catch (error) {
  if (db.inTransaction) db.exec('ROLLBACK');
  throw error;
}

const now = () => new Date().toISOString();
type DailyEconomyRow = {
  user_id: string;
  day_key: string;
  streak: number;
  last_check_in_day: string | null;
  check_in_claimed: number;
  visited_buildings_json: string;
  claimed_missions_json: string;
  fulfilled_orders_json: string;
  updated_at: string;
};
const parseStringList = (value: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? [...new Set(parsed.filter((entry): entry is string => typeof entry === 'string'))] : [];
  } catch { return []; }
};
function ensureDailyEconomyRow(userId: string, timestamp: string, at = new Date()): DailyEconomyRow {
  const dayKey = shanghaiDayKey(at);
  let row = db.prepare('SELECT * FROM player_daily_economy WHERE user_id = ?').get(userId) as DailyEconomyRow | undefined;
  if (!row) {
    db.prepare('INSERT INTO player_daily_economy (user_id, day_key, updated_at) VALUES (?, ?, ?)').run(userId, dayKey, timestamp);
    row = db.prepare('SELECT * FROM player_daily_economy WHERE user_id = ?').get(userId) as DailyEconomyRow;
  } else if (row.day_key !== dayKey) {
    const streak = row.last_check_in_day === previousDayKey(dayKey) ? row.streak : 0;
    db.prepare(`UPDATE player_daily_economy SET day_key = ?, streak = ?, check_in_claimed = 0,
      visited_buildings_json = '[]', claimed_missions_json = '[]', fulfilled_orders_json = '[]', updated_at = ? WHERE user_id = ?`)
      .run(dayKey, streak, timestamp, userId);
    row = db.prepare('SELECT * FROM player_daily_economy WHERE user_id = ?').get(userId) as DailyEconomyRow;
  }
  return row;
}
function dailyEconomyView(row: DailyEconomyRow, at = new Date()): PlayerProgress['daily'] {
  const dayKey = shanghaiDayKey(at);
  const yesterday = previousDayKey(dayKey);
  return {
    dayKey,
    checkInStreak: row.last_check_in_day === dayKey || row.last_check_in_day === yesterday ? row.streak : 0,
    checkInClaimed: row.day_key === dayKey && Boolean(row.check_in_claimed),
    visitedBuildings: row.day_key === dayKey ? parseStringList(row.visited_buildings_json) : [],
    claimedMissions: row.day_key === dayKey ? parseStringList(row.claimed_missions_json) : [],
    fulfilledOrders: row.day_key === dayKey ? parseStringList(row.fulfilled_orders_json) : [],
  };
}
const cityBuildingBuilt = (buildingId: string): boolean => {
  const project = CITY_CONSTRUCTION_CONFIG.projects.find((entry) => entry.buildingId === buildingId);
  return !project || Boolean((db.prepare('SELECT built FROM city_projects WHERE id = ?').get(project.id) as { built: number } | undefined)?.built);
};

const rowUser = (row: UserRow): User => ({ id: row.id, nickname: row.nickname, email: row.email, plUserId: row.pl_user_id, position: { x: row.position_x, y: row.position_y, z: row.position_z, rotation: row.rotation ?? undefined } });

export function createUser(id: string, tokenHash: string, nickname: string, passwordHash: string, sessionExpiresAt: string, plUserId: string | null = null): User {
  const timestamp = now();
  db.prepare('INSERT INTO users (id, nickname, password_hash, token_hash, session_expires_at, pl_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, nickname, passwordHash, tokenHash, sessionExpiresAt, plUserId, timestamp, timestamp);
  return getUser(id)!;
}
export function getUserByToken(tokenHash: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE token_hash = ? AND disabled_at IS NULL AND session_expires_at > ?").get(tokenHash, now()) as UserRow | undefined;
  return row ? rowUser(row) : null;
}
export function getUserByNickname(nickname: string): { id: string; nickname: string; passwordHash: string | null; disabled: boolean } | null {
  const row = db.prepare('SELECT id, nickname, password_hash, disabled_at FROM users WHERE nickname = ? COLLATE NOCASE').get(nickname) as { id: string; nickname: string; password_hash: string | null; disabled_at: string | null } | undefined;
  return row ? { id: row.id, nickname: row.nickname, passwordHash: row.password_hash, disabled: Boolean(row.disabled_at) } : null;
}
export function updateUserToken(id: string, tokenHash: string, sessionExpiresAt: string): void {
  db.prepare('UPDATE users SET token_hash = ?, session_expires_at = ?, updated_at = ? WHERE id = ?').run(tokenHash, sessionExpiresAt, now(), id);
}
export function getUser(id: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? rowUser(row) : null;
}
export function updateUserProfile(id: string, nickname: string, email?: string): void {
  db.prepare('UPDATE users SET nickname = ?, email = COALESCE(?, email), updated_at = ? WHERE id = ?').run(nickname, email ?? null, now(), id);
}
export function savePosition(id: string, position: Position): void {
  db.prepare('UPDATE users SET position_x = ?, position_y = ?, position_z = ?, rotation = ?, updated_at = ? WHERE id = ?').run(position.x, position.y, position.z, position.rotation ?? null, now(), id);
}
// Note: reading progress can advance daily state (ensureDailyEconomyRow writes
// the current-day row on first touch or day rollover), so never call this
// against a read-only handle or from restore/telemetry paths.
export function getPlayerProgress(userId: string, at = new Date()): PlayerProgress {
  ensureProgress(db, userId, now());
  const daily = dailyEconomyView(ensureDailyEconomyRow(userId, now(), at), at);
  const currency = (db.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(userId) as { currency: number }).currency;
  const inventoryRows = db.prepare('SELECT item_id, quantity FROM player_inventory WHERE user_id = ? ORDER BY item_id').all(userId) as Array<{ item_id: string; quantity: number }>;
  const inventory = Object.fromEntries(inventoryRows.map((row) => [row.item_id, row.quantity]));
  const repeatableRewardRows = db.prepare('SELECT reward_id, claim_count FROM player_repeatable_reward_claims WHERE user_id = ? ORDER BY reward_id').all(userId) as Array<{ reward_id: string; claim_count: number }>;
  const repeatableRewardClaims = Object.fromEntries(repeatableRewardRows.map((row) => [row.reward_id, row.claim_count]));
  const achievements = (db.prepare('SELECT achievement_id FROM player_achievements WHERE user_id = ? ORDER BY unlocked_at, achievement_id').all(userId) as Array<{ achievement_id: string }>).map((row) => row.achievement_id);
  const unlockedBuildings = (db.prepare('SELECT building_id FROM player_building_unlocks WHERE user_id = ? ORDER BY unlocked_at, building_id').all(userId) as Array<{ building_id: string }>).map((row) => row.building_id);
  const visitedBuildings = (db.prepare('SELECT building_id FROM player_building_visits WHERE user_id = ? ORDER BY first_visited_at, building_id').all(userId) as Array<{ building_id: string }>).map((row) => row.building_id);
  return { currency, inventory, repeatableRewardClaims, achievements, unlockedBuildings, visitedBuildings, daily };
}

export function recordBuildingVisit(userId: string, buildingId: string, at = new Date()): { progress: PlayerProgress; welcomeItemsGranted: boolean } {
  if (!cityBuildingBuilt(buildingId)) throw new Error('Building is not built');
  let welcomeItemsGranted = false;
  db.transaction(() => {
    ensureProgress(db, userId, now());
    const timestamp = now();
    const daily = ensureDailyEconomyRow(userId, timestamp, at);
    const dailyVisits = parseStringList(daily.visited_buildings_json);
    if (!dailyVisits.includes(buildingId)) {
      dailyVisits.push(buildingId);
      db.prepare('UPDATE player_daily_economy SET visited_buildings_json = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(dailyVisits), timestamp, userId);
    }
    const inserted = db.prepare('INSERT OR IGNORE INTO player_building_visits (user_id, building_id, first_visited_at) VALUES (?, ?, ?)').run(userId, buildingId, now());
    if (!inserted.changes) return;
    const count = (db.prepare('SELECT COUNT(*) AS count FROM player_building_visits WHERE user_id = ?').get(userId) as { count: number }).count;
    if (count === 2) {
      addInventory(db, userId, 'city_guide', 1, now());
      addInventory(db, userId, 'city_badge', 1, now());
      welcomeItemsGranted = true;
    }
  })();
  return { progress: getPlayerProgress(userId, at), welcomeItemsGranted };
}

export function claimDailyCheckIn(userId: string, rewards: { baseReward: number; streakBonus: number; maxStreakBonus: number }, at = new Date()): { progress: PlayerProgress; claimed: boolean; reward: number; streak: number } {
  let claimed = false;
  let reward = 0;
  let streak = 0;
  db.transaction(() => {
    const timestamp = now();
    ensureProgress(db, userId, timestamp);
    const row = ensureDailyEconomyRow(userId, timestamp, at);
    const dayKey = shanghaiDayKey(at);
    if (row.check_in_claimed) { streak = row.streak; return; }
    streak = row.last_check_in_day === previousDayKey(dayKey) ? row.streak + 1 : 1;
    reward = rewards.baseReward + Math.min((streak - 1) * rewards.streakBonus, rewards.maxStreakBonus);
    db.prepare(`UPDATE player_daily_economy SET streak = ?, last_check_in_day = ?, check_in_claimed = 1, updated_at = ? WHERE user_id = ?`)
      .run(streak, dayKey, timestamp, userId);
    db.prepare('UPDATE player_progress SET currency = currency + ?, updated_at = ? WHERE user_id = ?').run(reward, timestamp, userId);
    claimed = true;
  })();
  return { progress: getPlayerProgress(userId, at), claimed, reward, streak };
}

export function claimDailyMission(userId: string, mission: { id: string; target: number; reward: number }, at = new Date()): { progress: PlayerProgress; claimed: boolean; reward: number } {
  let claimed = false;
  db.transaction(() => {
    const timestamp = now();
    ensureProgress(db, userId, timestamp);
    const row = ensureDailyEconomyRow(userId, timestamp, at);
    const claimedMissions = parseStringList(row.claimed_missions_json);
    const visits = parseStringList(row.visited_buildings_json);
    if (claimedMissions.includes(mission.id) || visits.length < mission.target) return;
    claimedMissions.push(mission.id);
    db.prepare('UPDATE player_daily_economy SET claimed_missions_json = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(claimedMissions), timestamp, userId);
    db.prepare('UPDATE player_progress SET currency = currency + ?, updated_at = ? WHERE user_id = ?').run(mission.reward, timestamp, userId);
    claimed = true;
  })();
  return { progress: getPlayerProgress(userId, at), claimed, reward: claimed ? mission.reward : 0 };
}

/** Shared ingredient deduction for crafting and supply orders. Caller holds the transaction. */
function takeInventoryItems(userId: string, requirements: ReadonlyArray<{ itemId: string; quantity: number }>, timestamp: string): void {
  // Same-item entries would otherwise double-count the availability check and
  // re-dereference a deleted row, so collapse them up front.
  const merged = new Map<string, number>();
  for (const requirement of requirements) merged.set(requirement.itemId, (merged.get(requirement.itemId) ?? 0) + requirement.quantity);
  const needed = [...merged].map(([itemId, quantity]) => ({ itemId, quantity }));
  for (const requirement of needed) {
    const row = db.prepare('SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?').get(userId, requirement.itemId) as { quantity: number } | undefined;
    if (!row || row.quantity < requirement.quantity) throw new Error('Ingredient is not available');
  }
  for (const requirement of needed) {
    if (requirement.quantity === (db.prepare('SELECT quantity FROM player_inventory WHERE user_id = ? AND item_id = ?').get(userId, requirement.itemId) as { quantity: number }).quantity) {
      db.prepare('DELETE FROM player_inventory WHERE user_id = ? AND item_id = ?').run(userId, requirement.itemId);
    } else {
      db.prepare('UPDATE player_inventory SET quantity = quantity - ?, updated_at = ? WHERE user_id = ? AND item_id = ?').run(requirement.quantity, timestamp, userId, requirement.itemId);
    }
  }
}

export function craftMarketRecipe(userId: string, recipe: { id: string; ingredients: ReadonlyArray<{ itemId: string; quantity: number }>; output: { itemId: string; quantity: number } }, at = new Date()): { progress: PlayerProgress; crafted: boolean } {
  let crafted = false;
  db.transaction(() => {
    const timestamp = now();
    ensureProgress(db, userId, timestamp);
    ensureDailyEconomyRow(userId, timestamp, at);
    takeInventoryItems(userId, recipe.ingredients, timestamp);
    addInventory(db, userId, recipe.output.itemId, recipe.output.quantity, timestamp);
    crafted = true;
  })();
  return { progress: getPlayerProgress(userId, at), crafted };
}

export function fulfillDailySupplyOrder(userId: string, order: { id: string; requirements: ReadonlyArray<{ itemId: string; quantity: number }>; reward: number }, at = new Date()): { progress: PlayerProgress; fulfilled: boolean; reward: number } {
  let fulfilled = false;
  db.transaction(() => {
    const timestamp = now();
    ensureProgress(db, userId, timestamp);
    const row = ensureDailyEconomyRow(userId, timestamp, at);
    const fulfilledOrders = parseStringList(row.fulfilled_orders_json);
    if (fulfilledOrders.includes(order.id)) return;
    takeInventoryItems(userId, order.requirements, timestamp);
    fulfilledOrders.push(order.id);
    db.prepare('UPDATE player_daily_economy SET fulfilled_orders_json = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(fulfilledOrders), timestamp, userId);
    db.prepare('UPDATE player_progress SET currency = currency + ?, updated_at = ? WHERE user_id = ?').run(order.reward, timestamp, userId);
    fulfilled = true;
  })();
  return { progress: getPlayerProgress(userId, at), fulfilled, reward: fulfilled ? order.reward : 0 };
}

export type MarketListingView = {
  id: string;
  itemId: string;
  quantity: number;
  price: number;
  status: 'active' | 'sold' | 'cancelled';
  sellerId: string;
  sellerNickname: string;
  buyerId: string | null;
  createdAt: string;
};

const listingView = (row: {
  id: string; item_id: string; quantity: number; price: number; status: 'active' | 'sold' | 'cancelled';
  seller_id: string; seller_nickname: string | null; buyer_id: string | null; created_at: string;
}): MarketListingView => ({
  id: row.id,
  itemId: row.item_id,
  quantity: row.quantity,
  price: row.price,
  status: row.status,
  sellerId: row.seller_id,
  sellerNickname: row.seller_nickname ?? '神秘居民',
  buyerId: row.buyer_id,
  createdAt: row.created_at,
});

export function listMarketListings(viewerId: string): { active: MarketListingView[]; own: MarketListingView[] } {
  const base = `SELECT l.id, l.item_id, l.quantity, l.price, l.status, l.seller_id, u.nickname AS seller_nickname, l.buyer_id, l.created_at
    FROM market_listings l JOIN users u ON u.id = l.seller_id`;
  const active = (db.prepare(`${base} WHERE l.status = 'active' ORDER BY l.created_at DESC LIMIT 60`).all() as Array<Parameters<typeof listingView>[0]>).map(listingView);
  const own = (db.prepare(`${base} WHERE l.seller_id = ? AND l.status != 'cancelled' ORDER BY l.created_at DESC LIMIT 60`).all(viewerId) as Array<Parameters<typeof listingView>[0]>).map(listingView);
  return { active, own };
}

export function createMarketListing(userId: string, itemId: string, quantity: number, price: number, maxActiveListings: number): { progress: PlayerProgress; listing: MarketListingView } {
  const timestamp = now();
  // The id is generated and re-fetched inside the transaction: resolving by
  // "latest created_at" could return a different listing under same-millisecond inserts.
  const listingId = randomUUID();
  db.transaction(() => {
    ensureProgress(db, userId, timestamp);
    const activeCount = (db.prepare(`SELECT COUNT(*) AS count FROM market_listings WHERE seller_id = ? AND status = 'active'`).get(userId) as { count: number }).count;
    if (activeCount >= maxActiveListings) throw new Error('Too many active listings');
    takeInventoryItems(userId, [{ itemId, quantity }], timestamp);
    db.prepare(`INSERT INTO market_listings (id, seller_id, item_id, quantity, price, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`).run(listingId, userId, itemId, quantity, price, timestamp, timestamp);
  })();
  const listing = (db.prepare(`SELECT l.id, l.item_id, l.quantity, l.price, l.status, l.seller_id, u.nickname AS seller_nickname, l.buyer_id, l.created_at
    FROM market_listings l JOIN users u ON u.id = l.seller_id WHERE l.id = ?`).get(listingId) as Parameters<typeof listingView>[0]);
  return { progress: getPlayerProgress(userId), listing: listingView(listing) };
}

export function buyMarketListing(buyerId: string, listingId: string): { progress: PlayerProgress; listing: MarketListingView; sellerId: string } {
  let listing: MarketListingView | null = null;
  let sellerId = '';
  db.transaction(() => {
    const timestamp = now();
    ensureProgress(db, buyerId, timestamp);
    const row = db.prepare(`SELECT l.*, u.nickname AS seller_nickname FROM market_listings l JOIN users u ON u.id = l.seller_id
      WHERE l.id = ? AND l.status = 'active'`).get(listingId) as (Parameters<typeof listingView>[0] & { seller_nickname: string | null }) | undefined;
    if (!row) throw new Error('Listing is not available');
    if (row.seller_id === buyerId) throw new Error('You cannot buy your own listing');
    // `price` is a unit price (validated 1..MAX_MARKET_LISTING_PRICE); the lot
    // settles at price * quantity in one atomic transfer.
    const total = row.price * row.quantity;
    const charged = db.prepare('UPDATE player_progress SET currency = currency - ?, updated_at = ? WHERE user_id = ? AND currency >= ?').run(total, timestamp, buyerId, total);
    if (!charged.changes) throw new Error('Insufficient currency');
    db.prepare('UPDATE player_progress SET currency = currency + ?, updated_at = ? WHERE user_id = ?').run(total, timestamp, row.seller_id);
    db.prepare(`UPDATE market_listings SET status = 'sold', buyer_id = ?, closed_at = ?, updated_at = ? WHERE id = ?`).run(buyerId, timestamp, timestamp, listingId);
    addInventory(db, buyerId, row.item_id, row.quantity, timestamp);
    sellerId = row.seller_id;
    listing = listingView({ ...row, status: 'sold', buyer_id: buyerId });
  })();
  return { progress: getPlayerProgress(buyerId), listing: listing!, sellerId };
}

export function cancelMarketListing(userId: string, listingId: string): { progress: PlayerProgress; listing: MarketListingView } {
  let listing: MarketListingView | null = null;
  db.transaction(() => {
    const timestamp = now();
    ensureProgress(db, userId, timestamp);
    const row = db.prepare(`SELECT l.*, u.nickname AS seller_nickname FROM market_listings l JOIN users u ON u.id = l.seller_id
      WHERE l.id = ? AND l.seller_id = ? AND l.status = 'active'`).get(listingId, userId) as (Parameters<typeof listingView>[0] & { seller_nickname: string | null }) | undefined;
    if (!row) throw new Error('Listing is not available');
    db.prepare(`UPDATE market_listings SET status = 'cancelled', closed_at = ?, updated_at = ? WHERE id = ?`).run(timestamp, timestamp, listingId);
    addInventory(db, userId, row.item_id, row.quantity, timestamp);
    listing = listingView({ ...row, status: 'cancelled' });
  })();
  return { progress: getPlayerProgress(userId), listing: listing! };
}

export function unlockAchievement(userId: string, achievementId: string, currencyReward: number): { progress: PlayerProgress; unlocked: boolean; rewardGranted: number } {
  let unlocked = false;
  let rewardGranted = 0;
  db.transaction(() => {
    ensureProgress(db, userId, now());
    const result = db.prepare('INSERT OR IGNORE INTO player_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)').run(userId, achievementId, now());
    unlocked = result.changes > 0;
    if (currencyReward <= 0) return;
    const reward = db.prepare('INSERT OR IGNORE INTO player_achievement_rewards (user_id, achievement_id, currency, granted_at) VALUES (?, ?, ?, ?)').run(userId, achievementId, currencyReward, now());
    if (!reward.changes) return;
    db.prepare('UPDATE player_progress SET currency = currency + ?, updated_at = ? WHERE user_id = ?').run(currencyReward, now(), userId);
    rewardGranted = currencyReward;
  })();
  return { progress: getPlayerProgress(userId), unlocked, rewardGranted };
}

export function purchaseBuilding(userId: string, buildingId: string, price: number): { progress: PlayerProgress; unlocked: boolean } {
  if (!cityBuildingBuilt(buildingId)) throw new Error('Building is not built');
  let unlocked = false;
  db.transaction(() => {
    ensureProgress(db, userId, now());
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
    ensureProgress(db, userId, now());
    const total = quantity * unitPrice;
    const charged = db.prepare('UPDATE player_progress SET currency = currency - ?, updated_at = ? WHERE user_id = ? AND currency >= ?').run(total, now(), userId, total);
    if (!charged.changes) throw new Error('Insufficient currency');
    addInventory(db, userId, itemId, quantity, now());
  })();
  return getPlayerProgress(userId);
}

export function purchaseFilmCityExperience(userId: string, price: number): PlayerProgress {
  db.transaction(() => {
    ensureProgress(db, userId, now());
    const charged = db.prepare('UPDATE player_progress SET currency = currency - ?, updated_at = ? WHERE user_id = ? AND currency >= ?').run(price, now(), userId, price);
    if (!charged.changes) throw new Error('Insufficient currency');
  })();
  return getPlayerProgress(userId);
}

export function consumeItem(userId: string, itemId: string, quantity: number): PlayerProgress {
  db.transaction(() => {
    ensureProgress(db, userId, now());
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
    ensureProgress(db, userId, now());
    const inserted = db.prepare('INSERT OR IGNORE INTO player_reward_claims (user_id, reward_id, claim_key, claimed_at) VALUES (?, ?, ?, ?)').run(userId, rewardId, claimKey, now());
    if (!inserted.changes) return;
    addInventory(db, userId, itemId, quantity, now());
    claimed = true;
  })();
  return { progress: getPlayerProgress(userId), claimed };
}

export function claimRepeatableReward(userId: string, rewardId: string, claimSequence: number, itemId: string, quantity: number): { progress: PlayerProgress; claimed: boolean; accepted: boolean } {
  let claimed = false;
  let accepted = false;
  db.transaction(() => {
    ensureProgress(db, userId, now());
    const row = db.prepare('SELECT claim_count FROM player_repeatable_reward_claims WHERE user_id = ? AND reward_id = ?').get(userId, rewardId) as { claim_count: number } | undefined;
    const claimCount = row?.claim_count ?? 0;
    if (claimSequence <= claimCount) {
      accepted = true;
      return;
    }
    if (claimSequence !== claimCount + 1) throw new Error('Invalid reward claim sequence');
    db.prepare(`
      INSERT INTO player_repeatable_reward_claims (user_id, reward_id, claim_count, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, reward_id) DO UPDATE SET claim_count = excluded.claim_count, updated_at = excluded.updated_at
    `).run(userId, rewardId, claimSequence, now());
    addInventory(db, userId, itemId, quantity, now());
    claimed = true;
    accepted = true;
  })();
  return { progress: getPlayerProgress(userId), claimed, accepted };
}

const STORY_DEFAULT_NODE = 'start';
const parseStoryFlags = (raw: unknown): Record<string, StoryFlagValue> => {
  if (typeof raw !== 'string') return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item === null || typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)))) as Record<string, StoryFlagValue>;
  } catch { return {}; }
};

const rowStoryProgress = (row: StoryProgressDbRow): StoryProgress => ({
  storyId: row.story_id,
  definitionVersion: row.definition_version,
  nodeId: row.node_id,
  flags: parseStoryFlags(row.flags_json),
  ending: row.ending ?? null,
  visitCount: row.visit_count,
  updatedAt: row.updated_at,
});

function ensureStoryProgress(userId: string, storyId: string): void {
  if (db.prepare('SELECT 1 FROM story_progress WHERE user_id = ? AND story_id = ?').get(userId, storyId)) return;
  const count = (db.prepare('SELECT COUNT(*) AS count FROM story_progress WHERE user_id = ?').get(userId) as { count: number }).count;
  if (count >= 64) throw new Error('Story storage limit reached');
  const timestamp = now();
  db.prepare('INSERT OR IGNORE INTO story_progress (user_id, story_id, definition_version, node_id, flags_json, ending, visit_count, created_at, updated_at) VALUES (?, ?, 1, ?, ?, NULL, 0, ?, ?)')
    .run(userId, storyId, STORY_DEFAULT_NODE, '{}', timestamp, timestamp);
}

export function getStoryProgress(userId: string, storyId: string): StoryProgress {
  ensureStoryProgress(userId, storyId);
  const row = db.prepare('SELECT story_id, definition_version, node_id, flags_json, ending, visit_count, updated_at FROM story_progress WHERE user_id = ? AND story_id = ?').get(userId, storyId) as StoryProgressDbRow | undefined;
  if (!row) throw new Error('Story progress is unavailable');
  return rowStoryProgress(row);
}

export type StoryProgressPatch = {
  definitionVersion?: number;
  nodeId?: string;
  flags?: Record<string, StoryFlagValue>;
  ending?: string | null;
  visit?: boolean;
};

/** Merge a client decision into server-owned story state atomically. */
export function updateStoryProgress(userId: string, storyId: string, patch: StoryProgressPatch): StoryProgress {
  db.transaction(() => {
    ensureStoryProgress(userId, storyId);
    const current = db.prepare('SELECT definition_version, node_id, flags_json, ending, visit_count FROM story_progress WHERE user_id = ? AND story_id = ?').get(userId, storyId) as StoryProgressDbRow;
    const definitionVersion = patch.definitionVersion ?? current.definition_version;
    const flags = { ...parseStoryFlags(current.flags_json), ...(patch.flags ?? {}) };
    if (Object.keys(flags).length > 128 || Buffer.byteLength(JSON.stringify(flags), 'utf8') > 16_384) throw new Error('Story flags exceed the storage limit');
    const nodeId = patch.nodeId ?? current.node_id;
    const ending = patch.ending === undefined ? current.ending : patch.ending;
    const visitCount = current.visit_count + (patch.visit ? 1 : 0);
    db.prepare('UPDATE story_progress SET definition_version = ?, node_id = ?, flags_json = ?, ending = ?, visit_count = ?, updated_at = ? WHERE user_id = ? AND story_id = ?')
      .run(definitionVersion, nodeId, JSON.stringify(flags), ending ?? null, visitCount, now(), userId, storyId);
  })();
  return getStoryProgress(userId, storyId);
}

export async function backupDatabase(destinationPath: string): Promise<void> {
  await db.backup(destinationPath);
}

export function verifyDatabase(): { ok: boolean; message: string } {
  const row = db.pragma('quick_check', { simple: true });
  const message = String(row);
  return { ok: message === 'ok', message };
}

export function residentCount(): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
}

export function databaseStatus(): { ready: boolean; applicationId: number; schemaVersion: number; sqliteVersion: string } {
  const row = db.prepare('SELECT sqlite_version() AS version').get() as { version: string };
  return {
    ready: Boolean(db.prepare('SELECT 1 AS ready').get()),
    applicationId: Number(db.pragma('application_id', { simple: true })),
    schemaVersion: Number(db.pragma('user_version', { simple: true })),
    sqliteVersion: row.version,
  };
}

export function checkpointDatabase(): void {
  db.pragma('wal_checkpoint(PASSIVE)');
}

// ── Anti-abuse: registration tracking ──────────────────────────────────
// The count check and the insertion of the registration record must happen in
// the same synchronous transaction; otherwise concurrent signups from one IP
// can each pass the cap check before any of them records, letting the IP
// exceed MAX_REGISTRATIONS_PER_IP. registerUserAtomic bundles user creation
// and registration recording so there is no awaitable gap between them.
export function countRegistrationsForIp(ip: string, sinceIso: string): number {
  return (db.prepare('SELECT COUNT(*) AS count FROM account_registrations WHERE ip = ? AND created_at >= ?').get(ip, sinceIso) as { count: number }).count;
}

export function registerUserAtomic(
  userId: string,
  tokenHash: string,
  nickname: string,
  passwordHash: string,
  expiresAt: string,
  ip: string,
  sinceIso: string,
  max: number,
  plUserId: string | null = null,
): { allowed: boolean } {
  return db.transaction(() => {
    if (countRegistrationsForIp(ip, sinceIso) >= max) return { allowed: false };
    createUser(userId, tokenHash, nickname, passwordHash, expiresAt, plUserId);
    db.prepare('INSERT OR IGNORE INTO account_registrations (ip, user_id, created_at) VALUES (?, ?, ?)').run(ip, userId, now());
    return { allowed: true };
  })();
}

export function recordRegistration(ip: string, userId: string): void {
  db.prepare('INSERT OR IGNORE INTO account_registrations (ip, user_id, created_at) VALUES (?, ?, ?)').run(ip, userId, now());
}

// ── In-process backup restore ──────────────────────────────────────
export function restoreFromBackupFile(backupPath: string): { rowsCopied: number } {
  db.pragma('wal_checkpoint(TRUNCATE)');
  // Copy rows in-process from the (read-only) backup into the live database.
  // We avoid ATTACH because the just-written backup may hold a lock that
  // blocks a second writer, and ATTACH cannot open WAL files read-only.
  const probe = new Database(backupPath, { readonly: true, fileMustExist: true });
  let rowsCopied = 0;
  try {
    const liveTables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_minicity-%'").all() as Array<{ name: string }>).map((row) => row.name);
    const backupTables = new Set((probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_minicity-%'").all() as Array<{ name: string }>).map((row) => row.name));
    // PRAGMA foreign_keys is a no-op inside an active transaction, so disable it
    // before BEGIN. Verification still runs inside the transaction regardless
    // of enforcement, and cleanup restores enforcement even after failure.
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      for (const table of backupTables) {
        if (!liveTables.includes(table)) continue;
        const sourceColumns = (probe.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
        if (!sourceColumns.length) continue;
        const columns = (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
        const shared = columns.filter((column) => sourceColumns.includes(column));
        if (!shared.length) continue;
        const columnList = shared.map((column) => `"${column}"`).join(', ');
        const placeholders = shared.map(() => '?').join(', ');
        db.prepare(`DELETE FROM ${quoteIdent(table)}`).run();
        const insert = db.prepare(`INSERT INTO ${quoteIdent(table)} (${columnList}) VALUES (${placeholders})`);
        const rows = probe.prepare(`SELECT ${columnList} FROM ${quoteIdent(table)}`).all() as Record<string, unknown>[];
        for (const row of rows) insert.run(...shared.map((column) => row[column]));
        rowsCopied += rows.length;
      }
      // Backups created before these tables existed won't contain them; clear any
      // live rows they still hold so they cannot reference restored/removed users.
      for (const table of liveTables) {
        if (!backupTables.has(table)) db.prepare(`DELETE FROM ${quoteIdent(table)}`).run();
      }
      initializeCityGovernance(db);
      db.prepare('UPDATE city_meta SET epoch = ? WHERE id = 1').run(randomUUID());
      // foreign_key_check reports violations even with enforcement off, so we
      // can verify before commit and throw to roll the restore back.
      const integrity = String(db.pragma('integrity_check', { simple: true }));
      const foreignKeyErrors = db.pragma('foreign_key_check') as unknown[];
      if (integrity !== 'ok' || foreignKeyErrors.length) {
        throw new Error(`Restore verification failed (${integrity}, ${foreignKeyErrors.length} foreign key errors)`);
      }
      // Revoke every resident session so restored credentials are not reused.
      db.prepare("UPDATE users SET token_hash = lower(hex(randomblob(32))), session_expires_at = NULL, updated_at = ?").run(now());
    })();
  } finally {
    try { db.pragma('foreign_keys = ON'); }
    finally { probe.close(); }
  }
  return { rowsCopied };
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

// ── NPC change requests (player proposals + admin review) ───────────────
export type NpcChangeKind = 'add' | 'edit' | 'dialog';
export type NpcChangeStatus = 'pending' | 'approved' | 'rejected';

export type NpcChangeRequest = {
  id: number;
  requesterId: string | null;
  requesterNickname: string;
  npcId: string;
  kind: NpcChangeKind;
  title: string;
  summary: string;
  change: Record<string, unknown>;
  status: NpcChangeStatus;
  reviewer: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const NPC_CHANGE_KINDS = new Set<NpcChangeKind>(['add', 'edit', 'dialog']);

export function createNpcChangeRequest(input: {
  requesterId: string; requesterNickname: string; npcId: string; kind: NpcChangeKind;
  title: string; summary: string; change: Record<string, unknown>;
}): NpcChangeRequest {
  if (!NPC_CHANGE_KINDS.has(input.kind)) throw new Error('Invalid NPC change kind');
  const timestamp = now();
  const result = db.prepare(
    `INSERT INTO npc_change_requests (requester_id, requester_nickname, npc_id, kind, title, summary, change_json, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(input.requesterId, input.requesterNickname, input.npcId, input.kind, input.title, input.summary, JSON.stringify(input.change), timestamp);
  return getNpcChangeRequest(Number(result.lastInsertRowid))!;
}

export function getNpcChangeRequest(id: number): NpcChangeRequest | null {
  const row = db.prepare('SELECT * FROM npc_change_requests WHERE id = ?').get(id) as NpcChangeRequestRow | undefined;
  return row ? rowNpcChangeRequest(row) : null;
}

export function listNpcChangeRequests(input: { status?: NpcChangeStatus; npcId?: string; limit: number; offset: number }): { items: NpcChangeRequest[]; total: number } {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (input.status) { conditions.push('status = ?'); params.push(input.status); }
  if (input.npcId) { conditions.push('npc_id = ?'); params.push(input.npcId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM npc_change_requests ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT * FROM npc_change_requests ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, input.limit, input.offset) as NpcChangeRequestRow[];
  return { total, items: rows.map(rowNpcChangeRequest) };
}

export function reviewNpcChangeRequest(id: number, status: 'approved' | 'rejected', reviewer: string, note?: string): NpcChangeRequest | null {
  if (status !== 'approved' && status !== 'rejected') throw new Error('Invalid review status');
  const timestamp = now();
  const result = db.prepare(
    `UPDATE npc_change_requests SET status = ?, reviewer = ?, review_note = ?, reviewed_at = ? WHERE id = ? AND status = 'pending'`,
  ).run(status, reviewer, note ?? null, timestamp, id);
  return result.changes > 0 ? getNpcChangeRequest(id) : null;
}

export function createAdminNpcChangeRequest(input: {
  reviewer: string; npcId: string; kind: NpcChangeKind; title: string; summary: string; change: Record<string, unknown>;
}): NpcChangeRequest {
  if (!NPC_CHANGE_KINDS.has(input.kind)) throw new Error('Invalid NPC change kind');
  const timestamp = now();
  const result = db.prepare(
    `INSERT INTO npc_change_requests (requester_id, requester_nickname, npc_id, kind, title, summary, change_json, status, reviewer, created_at, reviewed_at)
     VALUES (NULL, ?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?)`,
  ).run(input.reviewer, input.npcId, input.kind, input.title, input.summary, JSON.stringify(input.change), input.reviewer, timestamp, timestamp);
  return getNpcChangeRequest(Number(result.lastInsertRowid))!;
}

function rowNpcChangeRequest(row: NpcChangeRequestRow): NpcChangeRequest {
  let change: Record<string, unknown> = {};
  try { change = JSON.parse(row.change_json) as Record<string, unknown>; } catch { /* keep empty */ }
  return {
    id: row.id, requesterId: row.requester_id ?? null, requesterNickname: row.requester_nickname,
    npcId: row.npc_id, kind: row.kind as NpcChangeKind, title: row.title, summary: row.summary, change,
    status: row.status as NpcChangeStatus, reviewer: row.reviewer ?? null, reviewNote: row.review_note ?? null,
    createdAt: row.created_at, reviewedAt: row.reviewed_at ?? null,
  };
}

export function closeDatabase(): void {
  if (db.open) db.close();
  releaseRuntimeLock();
}

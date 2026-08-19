import Database from 'better-sqlite3';
import { DATA_DIR, DATABASE_PATH } from './config.js';
import { MINICITY_APPLICATION_ID, MINICITY_SCHEMA_VERSION } from './databaseMetadata.js';
import { ensureProgress, addInventory } from './playerProgressDefaults.js';
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
`);
{
  const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
  if (!columns.some((column) => column.name === 'session_expires_at')) db.exec('ALTER TABLE users ADD COLUMN session_expires_at TEXT');
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
db.pragma(`application_id = ${MINICITY_APPLICATION_ID}`);
db.pragma(`user_version = ${MINICITY_SCHEMA_VERSION}`);
db.exec('COMMIT');
} catch (error) {
  if (db.inTransaction) db.exec('ROLLBACK');
  throw error;
}

const now = () => new Date().toISOString();

const rowUser = (row: UserRow): User => ({ id: row.id, nickname: row.nickname, email: row.email, position: { x: row.position_x, y: row.position_y, z: row.position_z, rotation: row.rotation ?? undefined } });

export function createUser(id: string, tokenHash: string, nickname: string, passwordHash: string, sessionExpiresAt: string): User {
  const timestamp = now();
  db.prepare('INSERT INTO users (id, nickname, password_hash, token_hash, session_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, nickname, passwordHash, tokenHash, sessionExpiresAt, timestamp, timestamp);
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
export function getPlayerProgress(userId: string): PlayerProgress {
  ensureProgress(db, userId, now());
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
    ensureProgress(db, userId, now());
    const inserted = db.prepare('INSERT OR IGNORE INTO player_building_visits (user_id, building_id, first_visited_at) VALUES (?, ?, ?)').run(userId, buildingId, now());
    if (!inserted.changes) return;
    const count = (db.prepare('SELECT COUNT(*) AS count FROM player_building_visits WHERE user_id = ?').get(userId) as { count: number }).count;
    if (count === 2) {
      addInventory(db, userId, 'city_guide', 1, now());
      addInventory(db, userId, 'city_badge', 1, now());
      welcomeItemsGranted = true;
    }
  })();
  return { progress: getPlayerProgress(userId), welcomeItemsGranted };
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
): { allowed: boolean } {
  return db.transaction(() => {
    if (countRegistrationsForIp(ip, sinceIso) >= max) return { allowed: false };
    createUser(userId, tokenHash, nickname, passwordHash, expiresAt);
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
  const liveTables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_minicity-%'").all() as Array<{ name: string }>).map((row) => row.name);
  const backupTables = new Set((probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_minicity-%'").all() as Array<{ name: string }>).map((row) => row.name));
  let rowsCopied = 0;
  // PRAGMA foreign_keys is a no-op inside an active transaction, so disable it
  // here (before BEGIN) so child tables can be cleared before parent rows are
  // deleted without tripping a FOREIGN KEY constraint. Enforcement is restored
  // in a finally; the foreign_key_check pragma reports violations regardless
  // of the enforcement flag, so verification still runs inside the transaction.
  db.pragma('foreign_keys = OFF');
  try {
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
    db.pragma('foreign_keys = ON');
  }
  probe.close();
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

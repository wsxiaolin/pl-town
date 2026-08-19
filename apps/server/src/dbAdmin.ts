import { db } from './db.js';
import { listHouses, type House } from './dbHousing.js';
import type { AdminAuditRow, AdminUserRow, StoryProgressAdminRow } from './dbRows.js';
import type { StoryFlagValue } from './types.js';

const now = () => new Date().toISOString();
const parseStoryFlags = (json: string): Record<string, StoryFlagValue> => {
  try {
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, StoryFlagValue> : {};
  } catch {
    return {};
  }
};

export type AdminSummary = { users: number; disabledUsers: number; houses: number; housingRequests: number; inventoryRows: number; storyRows: number; storyParticipants: number; chatMessages: number; hiddenChatMessages: number; databaseBytes: number };
export type AdminUser = { id: string; nickname: string; email: string | null; disabled: boolean; createdAt: string; updatedAt: string; sessionExpiresAt: string | null; houseId: string | null };
export type AdminAuditEntry = { id: number; actor: string; action: string; target: string | null; details: Record<string, unknown>; createdAt: string };

export function getAdminSummary(databaseBytes = 0): AdminSummary {
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
  return {
    users: count('users'),
    disabledUsers: (db.prepare('SELECT COUNT(*) AS count FROM users WHERE disabled_at IS NOT NULL').get() as { count: number }).count,
    houses: count('houses'), housingRequests: count('housing_requests'), inventoryRows: count('player_inventory'), storyRows: count('story_progress'),
    storyParticipants: (db.prepare('SELECT COUNT(DISTINCT user_id) AS count FROM story_progress').get() as { count: number }).count,
    chatMessages: count('chat_messages'),
    hiddenChatMessages: (db.prepare('SELECT COUNT(*) AS count FROM chat_messages WHERE hidden_at IS NOT NULL').get() as { count: number }).count,
    databaseBytes,
  };
}

export function listAdminUsers(input: { query?: string; limit: number; offset: number }): { items: AdminUser[]; total: number } {
  const query = input.query?.trim() ?? '';
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
  const where = query ? "WHERE u.nickname LIKE ? ESCAPE '\\' OR u.id LIKE ? ESCAPE '\\'" : '';
  const params = query ? [pattern, pattern] : [];
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM users u ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT u.id, u.nickname, u.email, u.disabled_at, u.created_at, u.updated_at, u.session_expires_at, hm.building_id AS house_id
    FROM users u LEFT JOIN house_members hm ON hm.user_id = u.id ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`).all(...params, input.limit, input.offset) as AdminUserRow[];
  return { total, items: rows.map((row) => ({ id: row.id, nickname: row.nickname, email: row.email, disabled: Boolean(row.disabled_at), createdAt: row.created_at, updatedAt: row.updated_at, sessionExpiresAt: row.session_expires_at, houseId: row.house_id ?? null })) };
}

export function setUserDisabled(userId: string, disabled: boolean): boolean {
  const timestamp = now();
  const result = disabled ? db.prepare('UPDATE users SET disabled_at = ?, session_expires_at = NULL, updated_at = ? WHERE id = ?').run(timestamp, timestamp, userId) : db.prepare('UPDATE users SET disabled_at = NULL, updated_at = ? WHERE id = ?').run(timestamp, userId);
  return result.changes > 0;
}
export function revokeUserSession(userId: string): boolean { return db.prepare('UPDATE users SET session_expires_at = NULL, updated_at = ? WHERE id = ?').run(now(), userId).changes > 0; }
export function recordAdminAudit(actor: string, action: string, target?: string, details: Record<string, unknown> = {}): void {
  db.transaction(() => {
    db.prepare('INSERT INTO admin_audit (actor, action, target, details_json, created_at) VALUES (?, ?, ?, ?, ?)').run(actor, action, target ?? null, JSON.stringify(details), now());
    db.prepare('DELETE FROM admin_audit WHERE id NOT IN (SELECT id FROM admin_audit ORDER BY id DESC LIMIT 10000)').run();
  })();
}
export function listAdminAudit(limit: number): AdminAuditEntry[] {
  return (db.prepare('SELECT id, actor, action, target, details_json, created_at FROM admin_audit ORDER BY id DESC LIMIT ?').all(limit) as AdminAuditRow[]).map((row) => {
    let details: Record<string, unknown> = {};
    try { details = JSON.parse(row.details_json) as Record<string, unknown>; } catch { /* Retain an empty object. */ }
    return { id: row.id, actor: row.actor, action: row.action, target: row.target, details, createdAt: row.created_at };
  });
}

export function updateAdminUserNickname(userId: string, nickname: string): { ok: boolean; reason?: string } {
  const trimmed = nickname.trim();
  if (!trimmed) return { ok: false, reason: '昵称不能为空' };
  if (db.prepare('SELECT id FROM users WHERE nickname = ? COLLATE NOCASE AND id <> ?').get(trimmed, userId)) return { ok: false, reason: '昵称已被占用' };
  return { ok: db.prepare('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?').run(trimmed, now(), userId).changes > 0 };
}
export function moveUserToHouse(userId: string, buildingId: string | null): { ok: boolean; reason?: string } {
  if (buildingId !== null && !db.prepare('SELECT 1 FROM houses WHERE building_id = ?').get(buildingId)) return { ok: false, reason: '住房不存在' };
  try {
    db.transaction(() => {
      const owned = db.prepare('SELECT building_id FROM houses WHERE owner_id = ?').all(userId) as Array<{ building_id: string }>;
      for (const { building_id } of owned) {
        const next = db.prepare('SELECT user_id FROM house_members WHERE building_id = ? AND user_id <> ? ORDER BY joined_at LIMIT 1').get(building_id, userId) as { user_id: string } | undefined;
        if (next) db.prepare('UPDATE houses SET owner_id = ?, updated_at = ? WHERE building_id = ?').run(next.user_id, now(), building_id);
        else db.prepare('DELETE FROM houses WHERE building_id = ?').run(building_id);
      }
      db.prepare('DELETE FROM house_members WHERE user_id = ?').run(userId);
      if (buildingId) {
        if ((db.prepare('SELECT COUNT(*) AS count FROM house_members WHERE building_id = ?').get(buildingId) as { count: number }).count >= 10) throw new Error('该住房已满员');
        db.prepare('INSERT INTO house_members (building_id, user_id, joined_at) VALUES (?, ?, ?)').run(buildingId, userId, now());
      }
    })();
    return { ok: true };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '操作失败' }; }
}
export function setHouseRoster(buildingId: string, memberIds: string[]): { ok: boolean; reason?: string } {
  const house = db.prepare('SELECT owner_id FROM houses WHERE building_id = ?').get(buildingId) as { owner_id: string } | undefined;
  if (!house) return { ok: false, reason: '住房不存在' };
  const unique = [...new Set(memberIds)].filter((id) => db.prepare('SELECT 1 FROM users WHERE id = ?').get(id));
  if (!unique.includes(house.owner_id)) unique.unshift(house.owner_id);
  if (unique.length > 10) return { ok: false, reason: '成员数不能超过 10 人' };
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM house_members WHERE building_id = ?').run(buildingId);
      for (const id of unique) {
        db.prepare('DELETE FROM house_members WHERE user_id = ? AND building_id <> ?').run(id, buildingId);
        db.prepare('INSERT OR IGNORE INTO house_members (building_id, user_id, joined_at) VALUES (?, ?, ?)').run(buildingId, id, now());
      }
    })();
    return { ok: true };
  } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '操作失败' }; }
}
export type AdminHouse = House & { memberCount: number };
export function listAdminHouses(): AdminHouse[] { return listHouses().map((house) => ({ ...house, memberCount: house.members.length })); }

export type StoryProgressRow = { userId: string; nickname: string; storyId: string; definitionVersion: number; nodeId: string; ending: string | null; visitCount: number; flags: Record<string, StoryFlagValue>; updatedAt: string };
export function listStoryProgress(input: { query?: string; storyId?: string; limit: number; offset: number }): { items: StoryProgressRow[]; total: number } {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  const query = input.query?.trim() ?? '';
  if (query) { const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`; conditions.push("(u.nickname LIKE ? ESCAPE '\\' OR sp.user_id LIKE ? ESCAPE '\\' OR sp.story_id LIKE ? ESCAPE '\\')"); params.push(pattern, pattern, pattern); }
  if (input.storyId) conditions.push('sp.story_id = ?'), params.push(input.storyId);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM story_progress sp LEFT JOIN users u ON u.id = sp.user_id ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT sp.user_id, u.nickname, sp.story_id, sp.definition_version, sp.node_id, sp.ending, sp.visit_count, sp.flags_json, sp.updated_at
    FROM story_progress sp LEFT JOIN users u ON u.id = sp.user_id ${where} ORDER BY sp.updated_at DESC LIMIT ? OFFSET ?`).all(...params, input.limit, input.offset) as StoryProgressAdminRow[];
  return { total, items: rows.map((row) => ({ userId: row.user_id, nickname: row.nickname ?? '（已删除）', storyId: row.story_id, definitionVersion: row.definition_version, nodeId: row.node_id, ending: row.ending ?? null, visitCount: row.visit_count, flags: parseStoryFlags(row.flags_json), updatedAt: row.updated_at })) };
}

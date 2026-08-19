import { db } from './db.js';
import type { ChatMessage } from './types.js';
import type { ChatAuthorRow, ChatMessageRow } from './dbRows.js';

const now = () => new Date().toISOString();
const parseRiskTypes = (value: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((risk): risk is string => typeof risk === 'string') : [];
  } catch { return []; }
};

export function recordChatMessage(userId: string, nickname: string, text: string, moderationEnabled: boolean): number {
  return Number(db.prepare('INSERT INTO chat_messages (user_id, nickname, text, moderation_status, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, nickname, text, moderationEnabled ? 'pending' : 'unreviewed', now()).lastInsertRowid);
}

export function completeChatModeration(id: number, input: { requestId: string | null; rejected: boolean; riskTypes: string[] }): boolean {
  const timestamp = now();
  const result = input.rejected
    ? db.prepare(`UPDATE chat_messages SET moderation_status = 'rejected', moderation_request_id = ?, moderation_risk_types_json = ?, moderation_error = NULL,
        moderated_at = ?, flagged_at = COALESCE(flagged_at, ?), hidden_at = COALESCE(hidden_at, ?), hidden_by = COALESCE(hidden_by, 'system:bigmodel')
        WHERE id = ? AND moderation_status = 'pending'`).run(input.requestId, JSON.stringify(input.riskTypes), timestamp, timestamp, timestamp, id)
    : db.prepare(`UPDATE chat_messages SET moderation_status = 'approved', moderation_request_id = ?, moderation_risk_types_json = '[]', moderation_error = NULL, moderated_at = ?
        WHERE id = ? AND moderation_status = 'pending'`).run(input.requestId, timestamp, id);
  return result.changes > 0;
}

export function failChatModeration(id: number, reason: string): boolean {
  return db.prepare(`UPDATE chat_messages SET moderation_status = 'error', moderation_error = ?, moderated_at = ?
    WHERE id = ? AND moderation_status = 'pending'`).run(reason.slice(0, 500), now(), id).changes > 0;
}

export function listPendingChatModeration(limit = 1_000): Array<{ id: number; text: string }> {
  return db.prepare("SELECT id, text FROM chat_messages WHERE moderation_status = 'pending' ORDER BY id LIMIT ?").all(limit).map((row) => row as { id: number; text: string });
}

export type ChatListFilter = { query?: string; includeHidden?: boolean; onlyHidden?: boolean; onlyFlagged?: boolean; userId?: string; limit: number; offset: number };

export function listChatMessages(input: ChatListFilter): { items: ChatMessage[]; total: number } {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  const query = input.query?.trim() ?? '';
  if (query) { const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`; conditions.push("(nickname LIKE ? ESCAPE '\\' OR text LIKE ? ESCAPE '\\')"); params.push(pattern, pattern); }
  if (input.userId) conditions.push('user_id = ?'), params.push(input.userId);
  if (input.onlyFlagged) conditions.push('flagged_at IS NOT NULL');
  if (input.onlyHidden) conditions.push('hidden_at IS NOT NULL');
  else if (!input.includeHidden) conditions.push('hidden_at IS NULL');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM chat_messages ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT id, user_id, nickname, text, flagged_at, hidden_at, hidden_by, moderation_status, moderation_request_id,
    moderation_risk_types_json, moderation_error, moderated_at, created_at FROM chat_messages ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, input.limit, input.offset) as ChatMessageRow[];
  return { total, items: rows.map((row) => ({
    id: row.id, userId: row.user_id, nickname: row.nickname, text: row.text, flaggedAt: row.flagged_at ?? null, hiddenAt: row.hidden_at ?? null,
    hiddenBy: row.hidden_by ?? null, createdAt: row.created_at, moderationStatus: row.moderation_status, moderationRequestId: row.moderation_request_id ?? null,
    moderationRiskTypes: parseRiskTypes(row.moderation_risk_types_json), moderationError: row.moderation_error ?? null, moderatedAt: row.moderated_at ?? null,
  })) };
}

export type ChatAuthorSummary = { userId: string; nickname: string; messages: number; hidden: number; flagged: number; lastAt: string; disabled: boolean };

export function listChatAuthors(limit: number): ChatAuthorSummary[] {
  const rows = db.prepare(`SELECT cm.user_id, COALESCE(MAX(u.nickname), MAX(cm.nickname)) AS nickname, COUNT(*) AS messages,
    SUM(CASE WHEN cm.hidden_at IS NOT NULL THEN 1 ELSE 0 END) AS hidden, SUM(CASE WHEN cm.flagged_at IS NOT NULL THEN 1 ELSE 0 END) AS flagged,
    MAX(cm.created_at) AS last_at, MAX(CASE WHEN u.disabled_at IS NOT NULL THEN 1 ELSE 0 END) AS disabled
    FROM chat_messages cm LEFT JOIN users u ON u.id = cm.user_id GROUP BY cm.user_id ORDER BY last_at DESC LIMIT ?`).all(limit) as ChatAuthorRow[];
  return rows.map((row) => ({ userId: row.user_id, nickname: row.nickname, messages: row.messages, hidden: row.hidden ?? 0, flagged: row.flagged ?? 0, lastAt: row.last_at, disabled: Boolean(row.disabled) }));
}

export function setChatMessageHidden(id: number, hidden: boolean, actor: string): boolean {
  const result = hidden
    ? db.prepare('UPDATE chat_messages SET hidden_at = ?, hidden_by = ? WHERE id = ? AND hidden_at IS NULL').run(now(), actor, id)
    : db.prepare('UPDATE chat_messages SET hidden_at = NULL, hidden_by = NULL WHERE id = ?').run(id);
  return result.changes > 0;
}

export function flagChatMessage(id: number): boolean {
  return db.prepare('UPDATE chat_messages SET flagged_at = ? WHERE id = ? AND flagged_at IS NULL').run(now(), id).changes > 0;
}

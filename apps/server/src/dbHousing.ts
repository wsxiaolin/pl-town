import { db } from './db.js';
import type { HouseRow, HousingRequestRow } from './dbRows.js';

export type House = { buildingId: string; name: string | null; ownerId: string; ownerNickname: string; members: Array<{ userId: string; nickname: string }> };
export type HousingRequest = { id: number; buildingId: string; houseName: string | null; ownerId: string; ownerNickname: string; requesterId: string; requesterNickname: string; targetId: string; targetNickname: string; kind: 'invite' | 'application'; createdAt: string };
const now = () => new Date().toISOString();

export function listHouses(): House[] {
  const rows = db.prepare(`SELECT h.*, u.nickname AS owner_nickname FROM houses h JOIN users u ON u.id = h.owner_id ORDER BY h.building_id`).all() as HouseRow[];
  const memberRows = db.prepare('SELECT hm.building_id, hm.user_id, u.nickname FROM house_members hm JOIN users u ON u.id = hm.user_id ORDER BY hm.building_id, hm.joined_at').all() as Array<{ building_id: string; user_id: string; nickname: string }>;
  const members = new Map<string, Array<{ userId: string; nickname: string }>>();
  for (const member of memberRows) { const list = members.get(member.building_id) ?? []; list.push({ userId: member.user_id, nickname: member.nickname }); members.set(member.building_id, list); }
  return rows.map((row) => ({ buildingId: row.building_id, name: row.name, ownerId: row.owner_id, ownerNickname: row.owner_nickname, members: members.get(row.building_id) ?? [] }));
}
export function getHouse(buildingId: string): House | null { return listHouses().find((house) => house.buildingId === buildingId) ?? null; }
export function claimHouse(buildingId: string, ownerId: string, name?: string): void {
  const timestamp = now();
  db.transaction(() => { if (db.prepare('SELECT 1 FROM house_members WHERE user_id = ?').get(ownerId)) throw new Error('User already lives in a house'); db.prepare('INSERT INTO houses (building_id, name, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(buildingId, name?.trim() || null, ownerId, timestamp, timestamp); db.prepare('INSERT INTO house_members (building_id, user_id, joined_at) VALUES (?, ?, ?)').run(buildingId, ownerId, timestamp); })();
}
export function renameHouse(buildingId: string, name: string): void { db.prepare('UPDATE houses SET name = ?, updated_at = ? WHERE building_id = ?').run(name.trim(), now(), buildingId); }
export function addMember(buildingId: string, userId: string): void { db.prepare('INSERT INTO house_members (building_id, user_id, joined_at) VALUES (?, ?, ?)').run(buildingId, userId, now()); }
export function removeMember(buildingId: string, userId: string): void { db.prepare('DELETE FROM house_members WHERE building_id = ? AND user_id = ?').run(buildingId, userId); }
export function transferHouse(buildingId: string, userId: string): void { db.prepare('UPDATE houses SET owner_id = ?, updated_at = ? WHERE building_id = ?').run(userId, now(), buildingId); }
export function deleteHouse(buildingId: string): boolean { return db.prepare('DELETE FROM houses WHERE building_id = ?').run(buildingId).changes > 0; }

const requestQuery = `SELECT r.id, r.building_id, r.requester_id, r.target_id, r.kind, r.created_at, h.name AS house_name, h.owner_id, owner.nickname AS owner_nickname,
  requester.nickname AS requester_nickname, target.nickname AS target_nickname FROM housing_requests r JOIN houses h ON h.building_id = r.building_id JOIN users owner ON owner.id = h.owner_id
  JOIN users requester ON requester.id = r.requester_id JOIN users target ON target.id = r.target_id WHERE r.requester_id = ? OR r.target_id = ? ORDER BY r.created_at DESC`;
const rowRequest = (row: HousingRequestRow): HousingRequest => ({ id: row.id, buildingId: row.building_id, houseName: row.house_name, ownerId: row.owner_id, ownerNickname: row.owner_nickname, requesterId: row.requester_id, requesterNickname: row.requester_nickname, targetId: row.target_id, targetNickname: row.target_nickname, kind: row.kind, createdAt: row.created_at });
export function listHousingRequestsForUser(userId: string): HousingRequest[] { return (db.prepare(requestQuery).all(userId, userId) as HousingRequestRow[]).map(rowRequest); }
export function getHousingRequest(id: number): HousingRequest | null { const row = db.prepare(requestQuery.replace('WHERE r.requester_id = ? OR r.target_id = ?', 'WHERE r.id = ?')).get(id) as HousingRequestRow | undefined; return row ? rowRequest(row) : null; }
export function createHousingRequest(buildingId: string, requesterId: string, targetId: string, kind: HousingRequest['kind']): void { db.prepare('INSERT INTO housing_requests (building_id, requester_id, target_id, kind, created_at) VALUES (?, ?, ?, ?, ?)').run(buildingId, requesterId, targetId, kind, now()); }
export function deleteHousingRequest(id: number): void { db.prepare('DELETE FROM housing_requests WHERE id = ?').run(id); }
export function deleteHousingRequestsForUser(userId: string): void { db.prepare('DELETE FROM housing_requests WHERE requester_id = ? OR target_id = ?').run(userId, userId); }

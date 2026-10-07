import { randomUUID } from 'node:crypto';
import { db, getPlayerProgress } from './db.js';
import { ensureProgress } from './playerProgressDefaults.js';
import {
  FIREWORK_COMMUNITY_LIST_MAX,
  FIREWORK_DESIGN_JSON_MAX_BYTES,
  FIREWORK_DESIGN_MAX_PER_USER,
  FIREWORK_SAVE_PRICE,
  serializeFireworkDesign,
  type FireworkDesign,
} from './fireworks.js';
import type { PlayerProgress } from './types.js';

/**
 * 烟花设计持久化：`firework_designs` 存全体居民的云端烟花（观景台轮播
 * 用），`firework_save_ops` 保存 30 金币存稿的幂等回执（客户端重试不重复
 * 扣款，语义与城市治理 `city_operations` 一致）。
 */

export type FireworkDesignRecord = {
  id: string;
  name: string;
  design: FireworkDesign;
  authorId: string;
  authorNickname: string;
  createdAt: string;
  updatedAt: string;
};

export type FireworkSaveResult = {
  progress: PlayerProgress;
  record: FireworkDesignRecord;
  replayed: boolean;
  pricePaid: number;
};

type DesignRow = {
  id: string;
  user_id: string;
  name: string;
  data_json: string;
  created_at: string;
  updated_at: string;
  author_nickname?: string | null;
};

function parseDesignRow(row: DesignRow): FireworkDesignRecord {
  return {
    id: row.id,
    name: row.name,
    design: JSON.parse(row.data_json) as FireworkDesign,
    authorId: row.user_id,
    authorNickname: row.author_nickname ?? '神秘居民',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const recordView = (row: DesignRow): FireworkDesignRecord => {
  const view = parseDesignRow(row);
  // 契约边界：库里只可能有通过 sanitizeFireworkDesign 的行；损坏行不出库。
  return view;
};

/**
 * 保存（新建或更新）一份烟花设计并收取 FIREWORK_SAVE_PRICE 金币。
 * 同一 requestId 的重试按回执重放，不重复扣款、不重复建行。
 */
export function saveFireworkDesign(userId: string, authorNickname: string, requestId: string, name: string, design: FireworkDesign, existingDesignId: string | null): FireworkSaveResult {
  const dataJson = serializeFireworkDesign(design);
  if (Buffer.byteLength(dataJson, 'utf8') > FIREWORK_DESIGN_JSON_MAX_BYTES) throw new Error('Firework design is too large');
  const fingerprint = JSON.stringify([name, design, existingDesignId]);
  let record: FireworkDesignRecord | null = null;
  let replayed = false;
  db.transaction(() => {
    const timestamp = new Date().toISOString();
    ensureProgress(db, userId, timestamp);
    const receipt = db.prepare('SELECT design_id, fingerprint FROM firework_save_ops WHERE user_id = ? AND request_id = ?')
      .get(userId, requestId) as { design_id: string; fingerprint: string } | undefined;
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw new Error('requestId already used with different parameters');
      const row = db.prepare(`SELECT d.*, COALESCE(u.nickname, d.author_nickname) AS author_nickname
        FROM firework_designs d LEFT JOIN users u ON u.id = d.user_id WHERE d.id = ? AND d.user_id = ?`)
        .get(receipt.design_id, userId) as DesignRow | undefined;
      if (!row) throw new Error('Firework design is not available');
      record = recordView(row);
      replayed = true;
      return;
    }
    const charged = db.prepare('UPDATE player_progress SET currency = currency - ?, updated_at = ? WHERE user_id = ? AND currency >= ?')
      .run(FIREWORK_SAVE_PRICE, timestamp, userId, FIREWORK_SAVE_PRICE);
    if (!charged.changes) throw new Error(`存一份烟花需要 ${FIREWORK_SAVE_PRICE} 金币，余额不足`);
    let designId: string;
    if (existingDesignId) {
      const owned = db.prepare('SELECT id FROM firework_designs WHERE id = ? AND user_id = ?').get(existingDesignId, userId);
      if (!owned) throw new Error('Firework design is not available');
      db.prepare('UPDATE firework_designs SET name = ?, data_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .run(name, dataJson, timestamp, existingDesignId, userId);
      designId = existingDesignId;
    } else {
      const count = db.prepare('SELECT COUNT(*) AS n FROM firework_designs WHERE user_id = ?').get(userId) as { n: number };
      if (count.n >= FIREWORK_DESIGN_MAX_PER_USER) throw new Error(`烟花仓库已满（最多 ${FIREWORK_DESIGN_MAX_PER_USER} 份），先删除一些旧设计吧`);
      designId = randomUUID();
      db.prepare('INSERT INTO firework_designs (id, user_id, author_nickname, name, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(designId, userId, authorNickname, name, dataJson, timestamp, timestamp);
    }
    db.prepare('INSERT INTO firework_save_ops (user_id, request_id, design_id, fingerprint, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, requestId, designId, fingerprint, FIREWORK_SAVE_PRICE, timestamp);
    const row = db.prepare(`SELECT d.*, COALESCE(u.nickname, d.author_nickname) AS author_nickname
      FROM firework_designs d LEFT JOIN users u ON u.id = d.user_id WHERE d.id = ?`)
      .get(designId) as DesignRow;
    record = recordView(row);
  })();
  return { progress: getPlayerProgress(userId), record: record!, replayed, pricePaid: FIREWORK_SAVE_PRICE };
}

/** 自己的全部设计（≤24）+ 全体居民最新 200 份（观景台轮播数据源）。 */
export function listFireworkDesigns(userId: string): { own: FireworkDesignRecord[]; community: FireworkDesignRecord[] } {
  const ownRows = db.prepare(`SELECT d.*, COALESCE(u.nickname, d.author_nickname) AS author_nickname
    FROM firework_designs d LEFT JOIN users u ON u.id = d.user_id
    WHERE d.user_id = ? ORDER BY d.updated_at DESC`).all(userId) as DesignRow[];
  const communityRows = db.prepare(`SELECT d.*, COALESCE(u.nickname, d.author_nickname) AS author_nickname
    FROM firework_designs d LEFT JOIN users u ON u.id = d.user_id
    ORDER BY d.updated_at DESC LIMIT ?`).all(FIREWORK_COMMUNITY_LIST_MAX) as DesignRow[];
  return {
    own: ownRows.map(recordView),
    community: communityRows.map(recordView),
  };
}

/** 删除自己的设计（免费；已花掉的金币不退）。 */
export function deleteFireworkDesign(userId: string, designId: string): boolean {
  let deleted = false;
  db.transaction(() => {
    const result = db.prepare('DELETE FROM firework_designs WHERE id = ? AND user_id = ?').run(designId, userId);
    deleted = result.changes > 0;
  })();
  return deleted;
}

/** 库存修订号：有新的云端烟花时变化，客户端据此刷新观景台节目单。 */
export function fireworkLibraryRevision(): string {
  const row = db.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(updated_at), \'\') AS latest FROM firework_designs').get() as { n: number; latest: string };
  return `${row.n}:${row.latest}`;
}

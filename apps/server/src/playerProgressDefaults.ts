import type Database from 'better-sqlite3';
import { DEFAULT_UNLOCKED_BUILDING_IDS, INITIAL_CURRENCY } from './progression.js';

export function ensureProgress(db: Database.Database, userId: string, timestamp: string): void {
  db.prepare('INSERT OR IGNORE INTO player_progress (user_id, currency, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(userId, INITIAL_CURRENCY, timestamp, timestamp);
  const unlockBuilding = db.prepare('INSERT OR IGNORE INTO player_building_unlocks (user_id, building_id, unlocked_at) VALUES (?, ?, ?)');
  DEFAULT_UNLOCKED_BUILDING_IDS.forEach((buildingId) => unlockBuilding.run(userId, buildingId, timestamp));
}

export function addInventory(db: Database.Database, userId: string, itemId: string, quantity: number, timestamp: string): void {
  db.prepare(`
    INSERT INTO player_inventory (user_id, item_id, quantity, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at
  `).run(userId, itemId, quantity, timestamp);
}
